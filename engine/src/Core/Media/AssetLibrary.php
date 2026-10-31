<?php

declare(strict_types=1);

namespace Zone\Engine\Core\Media;

use InvalidArgumentException;
use RuntimeException;
use Throwable;
use Zone\Engine\Core\Events\EventBus;
use Zone\Engine\Core\Persistence\Database;
use Zone\Engine\Core\Publishing\ReleaseManager;

/** Immutable disk assets with resumable chunks and a durable, leased inspection queue. */
final class AssetLibrary
{
    public const MAX_UPLOAD_BYTES = 134217728;
    public const CHUNK_BYTES = 524288;
    private readonly string $root;

    public function __construct(private readonly Database $db, ?string $root = null)
    {
        $this->root = rtrim($root ?? (getenv('ZONE_ASSET_ROOT') ?: ZONE_ENGINE_ROOT . '/var/assets'), '/\\');
        if ($this->root === '' || !preg_match('~^(?:[A-Za-z]:[/\\\\]|/)~', $this->root)) throw new InvalidArgumentException('Asset storage needs an absolute private directory.');
        SafeBundle::directory($this->root);
        foreach (['uploads', 'objects', 'heartbeats'] as $part) SafeBundle::directory($this->root . '/' . $part);
    }

    public function begin(array $input, string $actor): array
    {
        self::actor($actor);
        $name = $input['name'] ?? null; $size = $input['size'] ?? null;
        if (!is_string($name) || $name === '' || strlen($name) > 240 || basename(str_replace('\\', '/', $name)) !== $name || !preg_match('//u', $name)
            || preg_match('/[\x00-\x1f\x7f:<>"|?*]/', $name)) throw new InvalidArgumentException('Choose a file with a safe name.');
        $extension = strtolower(pathinfo($name, PATHINFO_EXTENSION));
        if (!in_array($extension, AssetInspector::EXTENSIONS, true)) throw new InvalidArgumentException('Supported uploads: GLB, glTF, FBX, OBJ, ZIP, PNG, WebP, JPG and MP3.');
        if (!is_int($size) || $size < 1 || $size > self::MAX_UPLOAD_BYTES) throw new InvalidArgumentException('File size must be between 1 byte and 128 MiB.');
        $pending = $this->db->fetchOne("SELECT COUNT(*) AS count FROM asset_uploads WHERE actor=:actor AND status='uploading' AND updated_at>:cutoff", ['actor' => $actor, 'cutoff' => time() - 86400]);
        if ((int) $pending['count'] >= 10) throw new InvalidArgumentException('Finish an existing upload before starting another.');
        $free = @disk_free_space($this->root);
        if ($free !== false && $free < $size * 3 + 268435456) throw new RuntimeException('There is not enough safe disk space for this asset.');
        $id = bin2hex(random_bytes(16)); $now = time();
        $handle = fopen($this->uploadPath($id), 'xb');
        if ($handle === false) throw new RuntimeException('Upload storage is unavailable.');
        fclose($handle);
        try {
            $this->db->execute('INSERT INTO asset_uploads (id,actor,name,expected_bytes,received_bytes,status,created_at,updated_at) VALUES (:id,:actor,:name,:size,0,\'uploading\',:created,:updated)', ['id' => $id, 'actor' => $actor, 'name' => $name, 'size' => $size, 'created' => $now, 'updated' => $now]);
        } catch (Throwable $error) { unlink($this->uploadPath($id)); throw $error; }
        return ['uploadId' => $id, 'name' => $name, 'size' => $size, 'receivedBytes' => 0, 'chunkBytes' => self::CHUNK_BYTES, 'status' => 'uploading'];
    }

    public function append(string $uploadId, array $payload, string $actor): array
    {
        self::uploadId($uploadId); self::actor($actor);
        $offset = $payload['offset'] ?? null; $encoded = $payload['base64'] ?? null;
        if (!is_int($offset) || $offset < 0 || !is_string($encoded) || strlen($encoded) > 699052) throw new InvalidArgumentException('Chunk offset or size is invalid.');
        $bytes = base64_decode($encoded, true);
        if ($bytes === false || $bytes === '' || strlen($bytes) > self::CHUNK_BYTES || base64_encode($bytes) !== $encoded) throw new InvalidArgumentException('Chunk must contain canonical base64 for at most 512 KiB.');
        return $this->lockedUpload($uploadId, $actor, function (array $row) use ($uploadId, $offset, $bytes): array {
            if ($row['status'] !== 'uploading') throw new InvalidArgumentException('This upload has already been completed.');
            $received = (int) $row['received_bytes']; $expected = (int) $row['expected_bytes'];
            if ($offset + strlen($bytes) > $expected || $offset > $received) throw new InvalidArgumentException('Chunk would leave a gap or exceed the declared file size.');
            $path = $this->uploadPath($uploadId);
            if (is_link($path)) throw new RuntimeException('Upload storage identity changed.');
            $handle = fopen($path, 'c+b');
            if ($handle === false || !flock($handle, LOCK_EX)) throw new RuntimeException('Upload cannot be locked.');
            try {
                if ($offset < $received) {
                    if ($offset + strlen($bytes) > $received) throw new InvalidArgumentException('A replayed chunk cannot partly overlap new bytes.');
                    fseek($handle, $offset);
                    if (fread($handle, strlen($bytes)) !== $bytes) throw new InvalidArgumentException('A replayed chunk differs from the stored bytes.');
                    return ['uploadId' => $uploadId, 'receivedBytes' => $received, 'size' => $expected, 'replayed' => true, 'status' => 'uploading'];
                }
                if (fstat($handle)['size'] < $received) throw new RuntimeException('Upload bytes are missing; start this file again.');
                // Repair only uncommitted tail bytes left by an interrupted append.
                if (!ftruncate($handle, $received) || fseek($handle, $received) !== 0) throw new RuntimeException('Upload tail cannot be recovered.');
                self::write($handle, $bytes); fflush($handle);
                $received += strlen($bytes);
                $this->db->execute('UPDATE asset_uploads SET received_bytes=:received,updated_at=:now WHERE id=:id', ['received' => $received, 'now' => time(), 'id' => $uploadId]);
                return ['uploadId' => $uploadId, 'receivedBytes' => $received, 'size' => $expected, 'replayed' => false, 'status' => 'uploading'];
            } finally { flock($handle, LOCK_UN); fclose($handle); }
        });
    }

    public function complete(string $uploadId, string $actor): array
    {
        self::uploadId($uploadId); self::actor($actor);
        $result = $this->lockedUpload($uploadId, $actor, function (array $row) use ($uploadId, $actor): array {
            if ($row['status'] === 'complete' && is_string($row['asset_id'])) return $this->get($row['asset_id']);
            if ($row['status'] !== 'uploading' || (int) $row['received_bytes'] !== (int) $row['expected_bytes']) throw new InvalidArgumentException('Upload is incomplete. Send all file chunks first.');
            $path = $this->uploadPath($uploadId); clearstatcache(true, $path);
            if (is_link($path) || !is_file($path) || filesize($path) !== (int) $row['expected_bytes']) throw new RuntimeException('Upload byte count does not match its manifest.');
            $id = hash_file('sha256', $path);
            if ($id === false) throw new RuntimeException('Upload cannot be hashed.');
            $object = $this->objectPath($id); SafeBundle::directory($object);
            $raw = $object . '/source';
            if (is_link($raw)) throw new RuntimeException('Asset storage identity changed.');
            if (!is_file($raw)) {
                $temporary = $object . '/source-' . bin2hex(random_bytes(8)) . '.part';
                if (!copy($path, $temporary) || hash_file('sha256', $temporary) !== $id || !rename($temporary, $raw)) throw new RuntimeException('Immutable asset could not be finalized.');
            } elseif (hash_file('sha256', $raw) !== $id) throw new RuntimeException('Existing immutable asset failed its integrity check.');
            $now = time(); $format = strtolower(pathinfo($row['name'], PATHINFO_EXTENSION));
            $kind = in_array($format, ['glb', 'gltf', 'fbx', 'obj', 'zip'], true) ? 'model' : ($format === 'mp3' ? 'audio' : 'image');
            $this->db->insertIgnore('asset_library', ['id','name','actor','status','kind','format','entry','members_json','metadata_json','transform_json','created_at','updated_at'], [$id,$row['name'],$actor,'queued',$kind,$format,'','[]','{}','{}',$now,$now]);
            $asset = $this->db->fetchOne('SELECT * FROM asset_library WHERE id=:id', ['id' => $id]);
            // Same content has one queue identity; duplicate complete/retry cannot enqueue a second inspection.
            if ($asset['status'] !== 'ready') $this->db->insertIgnore('asset_jobs', ['asset_id','status','attempts','next_attempt','lease_until','updated_at'], [$id,'queued',0,0,0,$now]);
            $this->db->execute("UPDATE asset_uploads SET status='complete',asset_id=:asset,updated_at=:now WHERE id=:id", ['asset' => $id, 'now' => $now, 'id' => $uploadId]);
            return $this->get($id);
        });
        // The verified original has committed successfully. Retaining a second
        // full-sized upload would otherwise double every asset's disk footprint.
        $part = $this->uploadPath($uploadId);
        if (is_file($part) && !is_link($part)) unlink($part);
        return $result;
    }

    /** @return list<array<string,mixed>> */
    public function all(): array
    {
        return array_map(function (array $row): array {
            $view = $this->view($row); $view['memberCount'] = count($view['members']); $view['members'] = [];
            unset($view['metadata']['thumbnail']);
            // GET /assets/{id} returns the complete immutable member manifest
            // and actual geometry thumbnail after selection. The shelf stays
            // bounded even when it contains hundreds of texture-rich bundles.
            return $view;
        }, $this->db->fetchAll('SELECT * FROM asset_library ORDER BY created_at DESC,id DESC LIMIT 100'));
    }

    public function get(string $assetId): array { return $this->view($this->row($assetId)); }

    public function updateTransform(string $assetId, array $transform, string $actor): array
    {
        // Fit edits share publication's configuration lock. A late transform
        // cannot slip between the reviewed fingerprint and release capture.
        return (new ReleaseManager($this->db, new EventBus($this->db)))->configurationTransaction(function () use ($assetId, $transform, $actor): array {
        self::actor($actor); $row = $this->row($assetId);
        if ($row['status'] !== 'ready' || $row['kind'] !== 'model') throw new InvalidArgumentException('Only a ready 3D model has normalization controls.');
        $accepted = ['scale','rotation','floorOffset','cameraTarget'];
        foreach (array_keys($transform) as $key) if (!in_array($key, $accepted, true)) throw new InvalidArgumentException('Unknown model transform field.');
        $current = json_decode($row['transform_json'], true, 16, JSON_THROW_ON_ERROR);
        foreach ($transform as $key => $value) {
            if ($key === 'rotation' || $key === 'cameraTarget') {
                if (!is_array($value) || !array_is_list($value) || count($value) !== 3) throw new InvalidArgumentException('Model vector controls require three finite numbers.');
                foreach ($value as $component) self::number($component, $key === 'rotation' ? -360 : -10000, $key === 'rotation' ? 360 : 10000);
            } else self::number($value, $key === 'scale' ? 0.000001 : -10000, 10000);
            $current[$key] = $value;
        }
        $this->db->execute('UPDATE asset_library SET transform_json=:json,updated_at=:now WHERE id=:id', ['json' => self::json($current), 'now' => time(), 'id' => $assetId]);
        return $this->get($assetId);
        });
    }

    /** Ready members only. The router separately enforces active-publication visibility. */
    public function content(string $assetId, string $member = '', int $offset = 0, int $length = self::CHUNK_BYTES): array
    {
        $row = $this->row($assetId);
        if ($row['status'] !== 'ready') throw new InvalidArgumentException('Asset inspection has not finished successfully.');
        if ($offset < 0 || $length < 1 || $length > self::CHUNK_BYTES) throw new InvalidArgumentException('Asset chunk range is invalid.');
        $member = $member === '' ? $row['entry'] : $member; SafeBundle::member($member);
        $manifest = json_decode($row['members_json'], true, 32, JSON_THROW_ON_ERROR); $selected = null;
        foreach ($manifest as $entry) if ($entry['name'] === $member) { $selected = $entry; break; }
        if ($selected === null || $offset > $selected['size']) throw new InvalidArgumentException('Asset member or offset is outside the manifest.');
        $metadata = json_decode($row['metadata_json'], true, 64, JSON_THROW_ON_ERROR);
        $storage = $metadata['_storage'] ?? '';
        if (!is_string($storage) || !preg_match('/^members-[a-f0-9]{32}$/D', $storage)) throw new RuntimeException('Asset storage manifest is invalid.');
        $base = $this->objectPath($assetId) . '/' . $storage;
        $path = $base . '/' . $member;
        $resolved = realpath($path); $resolvedBase = realpath($base);
        if ($resolved === false || $resolvedBase === false || is_link($path) || !str_starts_with(str_replace('\\', '/', $resolved), str_replace('\\', '/', $resolvedBase) . '/') || filesize($resolved) !== $selected['size']) throw new RuntimeException('Asset member no longer matches its stored manifest.');
        $handle = fopen($resolved, 'rb');
        if ($handle === false) throw new RuntimeException('Asset member cannot be read.');
        try {
            fseek($handle, $offset);
            $bytes = fread($handle, min($length, $selected['size'] - $offset) ?: 1);
            if ($bytes === false) throw new RuntimeException('Asset bytes cannot be read.');
        } finally { fclose($handle); }
        return ['base64' => base64_encode($bytes), 'mime' => $selected['mime'], 'total' => $selected['size'], 'offset' => $offset, 'member' => $member, 'sha256' => $selected['sha256'] ?? null];
    }

    /** Claim one job at a time. Expired leases are recoverable after process death. */
    public function runPending(int $limit = 1): array
    {
        if ($limit < 1 || $limit > 8) throw new InvalidArgumentException('Asset worker batch must contain 1 to 8 jobs.');
        $results = [];
        for ($i = 0; $i < $limit; $i++) {
            $claim = $this->claim(); if ($claim === null) break;
            $id = $claim['asset_id']; $owner = $claim['lease_owner'];
            try {
                $row = $this->row($id); $object = $this->objectPath($id); $raw = $object . '/source';
                if (is_link($raw) || hash_file('sha256', $raw) !== $id) throw new InvalidArgumentException('Stored original asset failed its immutable hash check.');
                $storage = 'members-' . $owner; $directory = $object . '/' . $storage; SafeBundle::directory($directory);
                if ($row['format'] === 'zip') $members = SafeBundle::extract($raw, $directory);
                else {
                    $entry = 'asset.' . $row['format'];
                    if (!copy($raw, $directory . '/' . $entry)) throw new RuntimeException('Asset cannot be prepared for inspection.');
                    $members = [['name' => $entry, 'size' => filesize($raw), 'mime' => AssetInspector::mime($entry)]];
                }
                $entry = AssetInspector::chooseEntry($members);
                $inspection = AssetInspector::inspect($directory, $entry, $members);
                foreach ($members as &$member) { $member['sha256'] = hash_file('sha256', $directory . '/' . $member['name']); }
                unset($member);
                $metadata = $inspection['metadata']; $metadata['_storage'] = $storage; $metadata['inspectedAt'] = gmdate('c');
                $metadata['originalSha256'] = $id; $metadata['originalBytes'] = filesize($raw); $metadata['inspectionEngine'] = 'bounded-geometry-worker-v108';
                // The browser first auto-fits actual bounds; this is the owner's
                // multiplier over that fit, not another absolute normalization.
                $transform = ['scale' => 1, 'rotation' => [0,0,0], 'floorOffset' => 0, 'cameraTarget' => [0,0,0]];
                $this->db->transaction(function () use ($id, $owner, $inspection, $entry, $members, $metadata, $transform): void {
                    $now = time();
                    if ($this->db->execute("UPDATE asset_jobs SET status='done',lease_until=0,last_error=NULL,updated_at=:now WHERE asset_id=:id AND status='working' AND lease_owner=:owner AND lease_until>:deadline", ['now' => $now, 'id' => $id, 'owner' => $owner, 'deadline' => $now]) !== 1) throw new RuntimeException('Asset lease expired before completion.');
                    $this->db->execute("UPDATE asset_library SET status='ready',kind=:kind,format=:format,entry=:entry,members_json=:members,metadata_json=:metadata,transform_json=:transform,error=NULL,updated_at=:now WHERE id=:id", ['kind' => $inspection['kind'], 'format' => $inspection['format'], 'entry' => $entry, 'members' => self::json($members), 'metadata' => self::json($metadata), 'transform' => self::json($transform), 'now' => $now, 'id' => $id]);
                });
                $results[] = ['id' => $id, 'status' => 'ready'];
            } catch (Throwable $error) {
                $message = substr($error->getMessage(), 0, 500); $terminal = $error instanceof InvalidArgumentException || (int) $claim['attempts'] >= 3;
                $status = $terminal ? 'failed' : 'queued';
                $this->db->transaction(function () use ($id, $owner, $message, $status, $claim): void {
                    $now = time(); $delay = (int) $claim['attempts'] * 15;
                    $changed = $this->db->execute('UPDATE asset_jobs SET status=:status,lease_until=0,next_attempt=:next,last_error=:error,updated_at=:now WHERE asset_id=:id AND lease_owner=:owner AND status=\'working\'', ['status' => $status, 'next' => $now + $delay, 'error' => $message, 'now' => $now, 'id' => $id, 'owner' => $owner]);
                    if ($changed === 1) $this->db->execute('UPDATE asset_library SET status=:status,error=:error,updated_at=:now WHERE id=:id', ['status' => $status, 'error' => $message, 'now' => $now, 'id' => $id]);
                });
                $results[] = ['id' => $id, 'status' => $status, 'error' => $message];
            }
        }
        return ['processed' => count($results), 'jobs' => $results, 'heartbeat' => time()];
    }

    public function heartbeat(string $workerId, array $payload): void
    {
        if (!preg_match('/^[a-zA-Z0-9_-]{1,64}$/D', $workerId)) throw new InvalidArgumentException('Worker identity is invalid.');
        $this->db->execute('INSERT INTO worker_heartbeats (id,updated_at,payload_json) VALUES (:id,:now,:payload) ON CONFLICT(id) DO UPDATE SET updated_at=excluded.updated_at,payload_json=excluded.payload_json', ['id' => $workerId, 'now' => time(), 'payload' => self::json($payload)]);
    }

    public function health(): array
    {
        $counts = $this->db->fetchAll('SELECT status,COUNT(*) AS count FROM asset_jobs GROUP BY status'); $queue = [];
        foreach ($counts as $row) $queue[$row['status']] = (int) $row['count'];
        $totalAssetsRow = $this->db->fetchOne('SELECT COUNT(*) AS count FROM asset_library');
        $readyAssetsRow = $this->db->fetchOne("SELECT COUNT(*) AS count FROM asset_library WHERE status='ready'");
        $heartbeats = $this->db->fetchAll('SELECT id,updated_at,payload_json FROM worker_heartbeats ORDER BY updated_at DESC LIMIT 10');
        return ['queue' => $queue, 'totalAssets' => (int) ($totalAssetsRow['count'] ?? 0), 'readyAssets' => (int) ($readyAssetsRow['count'] ?? 0), 'workers' => array_map(static function (array $row): array {
            $payload = json_decode($row['payload_json'], true, 16, JSON_THROW_ON_ERROR);
            return ['id' => $row['id'], 'updatedAt' => (int) $row['updated_at'], 'healthy' => (int) $row['updated_at'] >= time() - 100 && ($payload['status'] ?? '') === 'running', 'payload' => $payload];
        }, $heartbeats), 'limits' => ['uploadBytes' => self::MAX_UPLOAD_BYTES, 'chunkBytes' => self::CHUNK_BYTES, 'expandedBytes' => SafeBundle::MAX_EXPANDED_BYTES, 'bundleMembers' => SafeBundle::MAX_MEMBERS]];
    }

    public function uploadingCount(): int
    {
        $row = $this->db->fetchOne("SELECT COUNT(*) AS count FROM asset_uploads WHERE status = 'uploading'");
        return max(0, (int) ($row['count'] ?? 0));
    }

    private function claim(): ?array
    {
        return $this->db->transaction(function (): ?array {
            $now = time();
            if ($this->db->driver() === 'sqlite') $this->db->execute("UPDATE asset_jobs SET updated_at=updated_at WHERE status='queued' OR status='working'");
            $row = $this->db->fetchOne("SELECT * FROM asset_jobs WHERE (status='queued' AND next_attempt<=:now) OR (status='working' AND lease_until<=:expired) ORDER BY updated_at,asset_id LIMIT 1" . ($this->db->driver() === 'pgsql' ? ' FOR UPDATE SKIP LOCKED' : ''), ['now' => $now, 'expired' => $now]);
            if ($row === null) return null;
            if ((int) $row['attempts'] >= 3) {
                $this->db->execute("UPDATE asset_jobs SET status='failed',lease_until=0,last_error='Inspection retry budget exhausted',updated_at=:now WHERE asset_id=:id", ['now' => $now, 'id' => $row['asset_id']]);
                $this->db->execute("UPDATE asset_library SET status='failed',error='Inspection retry budget exhausted',updated_at=:now WHERE id=:id", ['now' => $now, 'id' => $row['asset_id']]);
                return null;
            }
            $owner = bin2hex(random_bytes(16)); $attempts = (int) $row['attempts'] + 1;
            $this->db->execute("UPDATE asset_jobs SET status='working',attempts=:attempts,lease_owner=:owner,lease_until=:lease,updated_at=:now WHERE asset_id=:id", ['attempts' => $attempts, 'owner' => $owner, 'lease' => $now + 90, 'now' => $now, 'id' => $row['asset_id']]);
            $this->db->execute("UPDATE asset_library SET status='processing',updated_at=:now WHERE id=:id", ['now' => $now, 'id' => $row['asset_id']]);
            return [...$row, 'attempts' => $attempts, 'lease_owner' => $owner];
        });
    }

    private function lockedUpload(string $id, string $actor, callable $callback): array
    {
        return $this->db->transaction(function () use ($id, $actor, $callback): array {
            if ($this->db->driver() === 'sqlite') $this->db->execute('UPDATE asset_uploads SET id=id WHERE id=:id', ['id' => $id]);
            $row = $this->db->fetchOne('SELECT * FROM asset_uploads WHERE id=:id' . ($this->db->driver() === 'pgsql' ? ' FOR UPDATE' : ''), ['id' => $id]);
            if ($row === null || $row['actor'] !== $actor) throw new InvalidArgumentException('Upload is not owned by this editor.');
            if ($row['status'] === 'uploading' && (int) $row['updated_at'] < time() - 86400) throw new InvalidArgumentException('Upload expired after 24 hours. Start the file again.');
            return $callback($row);
        });
    }

    private function row(string $id): array
    {
        self::assetId($id); $row = $this->db->fetchOne('SELECT * FROM asset_library WHERE id=:id', ['id' => $id]);
        if ($row === null) throw new InvalidArgumentException('Unknown uploaded asset.');
        return $row;
    }

    private function view(array $row): array
    {
        $metadata = json_decode($row['metadata_json'], true, 64, JSON_THROW_ON_ERROR); unset($metadata['_storage']);
        return ['id' => $row['id'], 'name' => $row['name'], 'status' => $row['status'], 'kind' => $row['kind'], 'format' => $row['format'], 'entry' => $row['entry'], 'members' => json_decode($row['members_json'], true, 32, JSON_THROW_ON_ERROR), 'metadata' => $metadata, 'transform' => json_decode($row['transform_json'], true, 16, JSON_THROW_ON_ERROR), 'error' => $row['error'], 'createdAt' => (int) $row['created_at'], 'updatedAt' => (int) $row['updated_at']];
    }

    private function uploadPath(string $id): string { self::uploadId($id); return $this->root . '/uploads/' . $id . '.part'; }
    private function objectPath(string $id): string { self::assetId($id); return $this->root . '/objects/' . $id; }
    private static function assetId(string $id): void { if (!preg_match('/^[a-f0-9]{64}$/D', $id)) throw new InvalidArgumentException('Asset identifier must be its lowercase SHA-256 hash.'); }
    private static function uploadId(string $id): void { if (!preg_match('/^[a-f0-9]{32}$/D', $id)) throw new InvalidArgumentException('Upload identifier is invalid.'); }
    private static function actor(string $actor): void { if ($actor === '' || strlen($actor) > 160 || preg_match('/[\x00-\x1f]/', $actor)) throw new InvalidArgumentException('Editor identity is invalid.'); }
    private static function number(mixed $value, float $min, float $max): void { if ((!is_int($value) && !is_float($value)) || !is_finite((float) $value) || $value < $min || $value > $max) throw new InvalidArgumentException('Model control is outside the finite supported range.'); }
    private static function json(mixed $value): string { return json_encode($value, JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE); }
    private static function write(mixed $handle, string $bytes): void { $offset = 0; while ($offset < strlen($bytes)) { $written = fwrite($handle, substr($bytes, $offset)); if ($written === false || $written === 0) throw new RuntimeException('Upload storage is full or unavailable.'); $offset += $written; } }
}
