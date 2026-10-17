<?php

declare(strict_types=1);

require dirname(__DIR__) . '/bootstrap.php';

use Zone\Engine\Core\Media\AssetLibrary;
use Zone\Engine\Core\Media\SafeBundle;
use Zone\Engine\Core\Persistence\Database;

putenv('ZONE_REDIS_URL=');
$prefix = ZONE_ENGINE_ROOT . '/var/asset-proof108-' . bin2hex(random_bytes(8));
$configured = getenv('ZONE_ASSET_TEST_URL');
if (is_string($configured) && $configured !== '') {
    $target = parse_url($configured);
    if ($target === false || !in_array($target['scheme'] ?? '', ['postgres','postgresql'], true)
        || !in_array($target['host'] ?? '', ['127.0.0.1','localhost'], true) || ($target['port'] ?? 0) !== 55433
        || !preg_match('~^/zone_beta_smoke_asset108_[a-z0-9_]+$~D', $target['path'] ?? '') || strlen(ltrim($target['path'], '/')) > 63) {
        throw new RuntimeException('Asset acceptance requires a newly created named disposable loopback database.');
    }
    $url = $configured; $databaseEvidence = ltrim($target['path'], '/');
} else { $url = 'sqlite:' . $prefix . '.sqlite'; $databaseEvidence = $prefix . '.sqlite'; }
$db = Database::connect($url); $db->migrateAndSeed();
$library = new AssetLibrary($db, $prefix . '-assets'); $count = 0;

function assetProof(bool $condition, string $label): void { global $count; if (!$condition) throw new RuntimeException('FAIL: ' . $label); $count++; echo 'PASS: ' . $label . PHP_EOL; }
function assetReject(callable $call, string $label): void { try { $call(); } catch (InvalidArgumentException|RuntimeException $error) { assetProof(true, $label); return; } throw new RuntimeException('FAIL: expected rejection: ' . $label); }
function assetUpload(string $name, string $bytes): array {
    global $library;
    $start = $library->begin(['name' => $name, 'size' => strlen($bytes)], 'isolated-studio');
    for ($offset = 0; $offset < strlen($bytes); $offset += AssetLibrary::CHUNK_BYTES) $library->append($start['uploadId'], ['offset' => $offset, 'base64' => base64_encode(substr($bytes, $offset, AssetLibrary::CHUNK_BYTES))], 'isolated-studio');
    return $library->complete($start['uploadId'], 'isolated-studio');
}
function assetZip(array $entries, bool $compressed = true): string {
    $data = ''; $central = ''; $total = 0;
    foreach ($entries as $name => $content) {
        $body = $compressed ? gzdeflate($content) : $content; $method = $compressed ? 8 : 0; $offset = strlen($data); $crc = crc32($content);
        $data .= "PK\x03\x04" . pack('vvvvvVVVvv', 20, 0, $method, 0, 0, $crc, strlen($body), strlen($content), strlen($name), 0) . $name . $body;
        $central .= "PK\x01\x02" . pack('vvvvvvVVVvvvvvVV', 20, 20, 0, $method, 0, 0, $crc, strlen($body), strlen($content), strlen($name), 0, 0, 0, 0, 0, $offset) . $name; $total++;
    }
    return $data . $central . "PK\x05\x06" . pack('vvvvVVv', 0, 0, $total, $total, strlen($central), strlen($data), 0);
}
function assetGltf(?string $uri = null): array {
    return ['asset' => ['version' => '2.0'], 'scene' => 0, 'scenes' => [['nodes' => [0]]], 'nodes' => [['mesh' => 0]],
        'meshes' => [['primitives' => [['attributes' => ['POSITION' => 0]]]]],
        'buffers' => [['byteLength' => 36, ...($uri === null ? [] : ['uri' => $uri])]],
        'bufferViews' => [['buffer' => 0, 'byteOffset' => 0, 'byteLength' => 36]],
        'accessors' => [['bufferView' => 0, 'componentType' => 5126, 'count' => 3, 'type' => 'VEC3', 'min' => [0,0,0], 'max' => [2,3,0]]]];
}
$triangle = pack('g*', 0,0,0, 2,0,0, 0,3,0);
$scene = json_encode(assetGltf(), JSON_THROW_ON_ERROR); $scene .= str_repeat(' ', (4 - strlen($scene) % 4) % 4);
$glb = 'glTF' . pack('VV', 2, 12 + 8 + strlen($scene) + 8 + strlen($triangle)) . pack('VV', strlen($scene), 0x4e4f534a) . $scene . pack('VV', strlen($triangle), 0x004e4942) . $triangle;
$obj = "o Triangle\nv 0 0 0\nv 2 0 0\nv 0 3 0\nf 1 2 3\n";

assetReject(fn () => $library->begin(['name' => '../bad.glb', 'size' => 1], 'isolated-studio'), 'upload name cannot contain a path');
assetReject(fn () => $library->begin(['name' => 'bad.php', 'size' => 1], 'isolated-studio'), 'executable upload extension is rejected');
assetReject(fn () => $library->begin(['name' => 'huge.glb', 'size' => 134217729], 'isolated-studio'), '128 MiB upload limit enforced before disk allocation');
$upload = $library->begin(['name' => 'triangle.glb', 'size' => strlen($glb)], 'isolated-studio');
assetReject(fn () => $library->append($upload['uploadId'], ['offset' => 0, 'base64' => base64_encode($glb)], 'other-editor'), 'upload is tied to the editor identity');
assetReject(fn () => $library->append($upload['uploadId'], ['offset' => 5, 'base64' => base64_encode('gap')], 'isolated-studio'), 'chunks cannot leave holes');
assetReject(fn () => $library->append($upload['uploadId'], ['offset' => 0, 'base64' => base64_encode(str_repeat('x', 524289))], 'isolated-studio'), 'chunk decoder cannot exceed 512 KiB');
assetReject(fn () => $library->complete($upload['uploadId'], 'isolated-studio'), 'incomplete upload cannot be finalized');
$append = $library->append($upload['uploadId'], ['offset' => 0, 'base64' => base64_encode($glb)], 'isolated-studio');
$replay = $library->append($upload['uploadId'], ['offset' => 0, 'base64' => base64_encode($glb)], 'isolated-studio');
assetProof($append['receivedBytes'] === strlen($glb) && $replay['replayed'], 'identical chunk retry is idempotent');
assetReject(fn () => $library->append($upload['uploadId'], ['offset' => 0, 'base64' => base64_encode(str_repeat('x', strlen($glb)))], 'isolated-studio'), 'conflicting chunk retry cannot overwrite bytes');
$queued = $library->complete($upload['uploadId'], 'isolated-studio');
assetProof($queued['id'] === hash('sha256', $glb) && $queued['status'] === 'queued', 'finalize hashes bytes and queues inspection rather than blocking HTTP');
assetProof($library->complete($upload['uploadId'], 'isolated-studio')['id'] === $queued['id'], 'complete replay returns the same immutable identity');
assetReject(fn () => $library->content($queued['id']), 'uninspected model cannot expose member content');
$job = $library->runPending(); $ready = $library->get($queued['id']);
assetProof($job['processed'] === 1 && $ready['status'] === 'ready', 'worker parses a real GLB to ready status');
assetProof($ready['metadata']['bounds']['size'] === [2,3,0] && $ready['metadata']['vertices'] === 3 && $ready['metadata']['triangles'] === 1, 'reported bounds and triangles come from actual geometry');
assetProof(str_starts_with($ready['metadata']['thumbnail'], 'data:image/svg+xml;base64,') && $ready['metadata']['thumbnailKind'] === 'geometry-projection', 'real geometry projection thumbnail is explicitly identified');
assetProof(!isset($ready['metadata']['_storage']) && !str_contains(json_encode($ready), $prefix), 'public metadata contains no private disk paths');
$first = $library->content($queued['id'], '', 0, 17); $rest = $library->content($queued['id'], '', 17);
assetProof(base64_decode($first['base64']) . base64_decode($rest['base64']) === $glb, 'range content reconstructs exact original GLB bytes');
assetReject(fn () => $library->content($queued['id'], '../source'), 'content route rejects parent traversal');
assetReject(fn () => $library->content($queued['id'], '', -1), 'content range rejects negative offsets');
assetReject(fn () => $library->content($queued['id'], '', 0, 524289), 'content chunk cap remains below relay limits');
assetReject(fn () => $library->updateTransform($queued['id'], ['scale' => INF], 'isolated-studio'), 'normalizer rejects non-finite controls');
assetReject(fn () => $library->updateTransform($queued['id'], ['rotation' => [0,0]], 'isolated-studio'), 'normalizer rejects incomplete vectors');
$changed = $library->updateTransform($queued['id'], ['scale' => 1.25, 'rotation' => [0,90,0], 'floorOffset' => .2, 'cameraTarget' => [0,1,0]], 'isolated-studio');
assetProof($changed['transform']['scale'] === 1.25 && $changed['transform']['rotation'] === [0,90,0], 'owner normalization controls persist separately from immutable bytes');
assetProof(hash('sha256', base64_decode($library->content($queued['id'])['base64'])) === $queued['id'], 'normalizing cannot rewrite original model bytes');
assetProof($library->runPending()['processed'] === 0, 'completed inspection job does not run twice');
$duplicate = assetUpload('same-triangle.glb', $glb);
assetProof($duplicate['id'] === $ready['id'] && $library->runPending()['processed'] === 0, 'duplicate content deduplicates queued work and preserves authored transform');

$objAsset = assetUpload('triangle.obj', $obj); $library->runPending(); $objView = $library->get($objAsset['id']);
assetProof($objView['status'] === 'ready' && $objView['metadata']['triangles'] === 1, 'OBJ is actually parsed, not only accepted by extension');
$largeObj = $obj . str_repeat('# model-transport-proof-' . str_repeat('x', 1000) . "\n", 2400);
$largeAsset = assetUpload('large-chunk-house.obj', $largeObj); $library->runPending();
$largeBytes = '';
for ($offset = 0; $offset < strlen($largeObj); $offset += AssetLibrary::CHUNK_BYTES) $largeBytes .= base64_decode($library->content($largeAsset['id'], '', $offset)['base64']);
assetProof(strlen($largeObj) > 2097152 && $largeBytes === $largeObj && $library->get($largeAsset['id'])['status'] === 'ready', 'a real multi-megabyte model crosses multiple upload/download chunks without altering bytes');
$sourceDirectory = $prefix . '-assets/objects/' . $largeAsset['id'];
assetProof(hash_file('sha256', $sourceDirectory . '/source') === $largeAsset['id'] && count(glob($prefix . '-assets/uploads/*.part')) === 0, 'finalized uploads retain one hashed original and release only committed temporary chunk copies');
$bundle = assetUpload('house.zip', assetZip(['models/house.gltf' => json_encode(assetGltf('../buffers/triangle.bin'), JSON_THROW_ON_ERROR), 'buffers/triangle.bin' => $triangle]));
$library->runPending(); $bundleView = $library->get($bundle['id']);
assetProof($bundleView['status'] === 'ready' && $bundleView['entry'] === 'models/house.gltf' && count($bundleView['members']) === 2, 'nested glTF bundle resolves safe parent-relative binary resources');
assetProof(base64_decode($library->content($bundle['id'], 'buffers/triangle.bin')['base64']) === $triangle, 'ZIP member content retains exact extracted buffer bytes');
$badRemote = assetUpload('remote.gltf', json_encode(assetGltf('https://example.invalid/secret.bin'), JSON_THROW_ON_ERROR)); $library->runPending();
assetProof($library->get($badRemote['id'])['status'] === 'failed', 'external model references are rejected without network fetch');
$truncated = assetUpload('truncated.glb', substr($glb, 0, -4)); $library->runPending();
assetProof($library->get($truncated['id'])['status'] === 'failed', 'truncated GLB cannot be marked ready');
$badImage = assetUpload('script.png', '<?php echo "not an image";'); $library->runPending();
assetProof($library->get($badImage['id'])['status'] === 'failed', 'image magic and dimensions are inspected rather than trusting extension');
$pngChunk = static fn (string $type, string $bytes): string => pack('N', strlen($bytes)) . $type . $bytes . pack('N', crc32($type . $bytes));
$png = "\x89PNG\r\n\x1a\n" . $pngChunk('IHDR', pack('NNCCCCC',1,1,8,6,0,0,0)) . $pngChunk('IDAT', gzcompress("\0\xff\x80\x20\xff")) . $pngChunk('IEND', '');
$image = assetUpload('pixel.png', $png); $library->runPending();
assetProof($library->get($image['id'])['status'] === 'ready' && $library->get($image['id'])['metadata']['width'] === 1, 'valid PNG retains real dimensions and image kind');
$invalidPng = $png; $invalidPng[45] = chr(ord($invalidPng[45]) ^ 1);
$corruptImage = assetUpload('corrupt-pixel.png', $invalidPng); $library->runPending();
assetProof($library->get($corruptImage['id'])['status'] === 'failed', 'corrupt PNG pixel stream or CRC cannot receive ready status');
$mp3 = str_repeat("\xff\xfb\x90\x64" . str_repeat("\0",413), 8);
$sound = assetUpload('authored-silence.mp3', $mp3); $library->runPending();
assetProof($library->get($sound['id'])['status'] === 'ready' && $library->get($sound['id'])['metadata']['frames'] === 8, 'MP3 readiness requires consecutive complete Layer III frames, not only an extension');
$badSound = assetUpload('false-audio.mp3', "\xff\xfb\x90\x64short"); $library->runPending();
assetProof($library->get($badSound['id'])['status'] === 'failed', 'truncated MP3 frame cannot be reported ready');

foreach ([['../escape.obj' => $obj], ['same.obj' => $obj, 'SAME.obj' => $obj], ['bad.php' => 'script']] as $index => $files) {
    $rejected = assetUpload('bad-bundle-' . $index . '.zip', assetZip($files)); $library->runPending();
    assetProof($library->get($rejected['id'])['status'] === 'failed', ['ZIP-slip path blocked','case-ambiguous ZIP paths blocked','executable ZIP member blocked'][$index]);
}
$corruptZip = assetZip(['triangle.obj' => $obj]); $corruptZip[40] = chr(ord($corruptZip[40]) ^ 127);
$corrupt = assetUpload('corrupt.zip', $corruptZip); $library->runPending();
assetProof($library->get($corrupt['id'])['status'] === 'failed', 'corrupt ZIP member fails CRC/inflate validation');
$bomb = assetUpload('bomb.zip', assetZip(['padding.txt' => str_repeat('0', 2097152), 'triangle.obj' => $obj])); $library->runPending();
assetProof($library->get($bomb['id'])['status'] === 'failed', 'compression bomb ratio is bounded before extraction');
assetProof(!is_file($prefix . '-assets/escape.obj'), 'malicious bundle did not create a file outside its object directory');

$leaseAsset = assetUpload('leased.obj', $obj . '# lease\n');
$db->execute("UPDATE asset_jobs SET status='working',attempts=1,lease_owner='another-worker',lease_until=:lease WHERE asset_id=:id", ['lease' => time() + 100, 'id' => $leaseAsset['id']]);
assetProof($library->runPending()['processed'] === 0, 'active lease cannot be stolen by another worker');
$db->execute('UPDATE asset_jobs SET lease_until=0 WHERE asset_id=:id', ['id' => $leaseAsset['id']]);
$library->runPending();
assetProof($library->get($leaseAsset['id'])['status'] === 'ready' && (int) $db->fetchOne('SELECT attempts FROM asset_jobs WHERE asset_id=:id', ['id' => $leaseAsset['id']])['attempts'] === 2, 'expired lease recovers exactly once after worker loss');
$library->heartbeat('asset-proof108', ['role' => 'studio', 'status' => 'running']);
assetProof($library->health()['workers'][0]['healthy'] === true, 'fresh persistent worker heartbeat is observable');
$library->heartbeat('asset-proof108', ['role' => 'studio', 'status' => 'stopped']);
assetProof($library->health()['workers'][0]['healthy'] === false, 'stopped worker is not reported healthy');

$cliAsset = assetUpload('worker-loop.obj', $obj . '# cli\n');
$workerCommand = [PHP_BINARY]; if ($db->driver() === 'pgsql') array_push($workerCommand, '-d', 'extension=pdo_pgsql');
array_push($workerCommand, ZONE_ENGINE_ROOT . '/bin/worker.php', '--role=studio', '--id=asset-proof-cli', '--max-seconds=1', '--interval-ms=250');
$process = proc_open($workerCommand, [0 => ['pipe','r'],1 => ['pipe','w'],2 => ['pipe','w']], $pipes, ZONE_REPOSITORY_ROOT, [...getenv(), 'ZONE_DATABASE_URL' => $url, 'ZONE_ASSET_ROOT' => $prefix . '-assets'], ['bypass_shell' => true]);
if (!is_resource($process)) throw new RuntimeException('Isolated persistent worker failed to start.');
fclose($pipes[0]); $stdout = stream_get_contents($pipes[1]); $stderr = stream_get_contents($pipes[2]); fclose($pipes[1]); fclose($pipes[2]); $exit = proc_close($process);
assetProof($exit === 0 && $stderr === '' && str_contains($stdout, '"event":"started"') && str_contains($stdout, '"event":"stopped"'), 'persistent CLI loop starts, polls, and shuts down cleanly in isolation');
assetProof($library->get($cliAsset['id'])['status'] === 'ready', 'persistent worker processes a queued upload without an HTTP action');
$resumed = new AssetLibrary(Database::connect($url), $prefix . '-assets');
assetProof($resumed->get($ready['id'])['transform']['scale'] === 1.25 && $resumed->get($bundle['id'])['status'] === 'ready', 'fresh process retains asset readiness and authored transforms');
assetProof(count($resumed->all()) >= 10, 'Studio asset shelf lists stored inspected and rejected uploads');
$shelf = $resumed->all();
assetProof(count(array_filter($shelf, static fn (array $entry): bool => $entry['members'] === [] && !isset($entry['metadata']['thumbnail']))) === count($shelf), 'Studio shelf stays compact while selected asset retains the full member manifest and thumbnail');
// A dedicated world worker ticks independently of model inspection. A restart
// in the same interval must not duplicate world issuance.
$worldCommand = [PHP_BINARY]; if ($db->driver() === 'pgsql') array_push($worldCommand, '-d', 'extension=pdo_pgsql');
array_push($worldCommand, ZONE_ENGINE_ROOT . '/bin/worker.php', '--role=world', '--id=asset-proof-world', '--once');
$worldCounts = [];
for ($attempt = 0; $attempt < 2; $attempt++) {
    $process = proc_open($worldCommand, [0 => ['pipe','r'],1 => ['pipe','w'],2 => ['pipe','w']], $pipes, ZONE_REPOSITORY_ROOT, [...getenv(), 'ZONE_DATABASE_URL' => $url, 'ZONE_ASSET_ROOT' => $prefix . '-assets'], ['bypass_shell' => true]);
    if (!is_resource($process)) throw new RuntimeException('World worker did not start.'); fclose($pipes[0]);
    $worldOut = stream_get_contents($pipes[1]); $worldError = stream_get_contents($pipes[2]); fclose($pipes[1]); fclose($pipes[2]);
    assetProof(proc_close($process) === 0 && $worldError === '' && str_contains($worldOut, '"event":"cycle"'), 'world-only CLI worker completes actual authoritative tick, attempt ' . ($attempt + 1));
    $worldCounts[] = (int) $db->fetchOne('SELECT COUNT(*) AS total FROM world_ticks')['total'];
}
assetProof($worldCounts[0] > 0 && $worldCounts[1] === $worldCounts[0], 'restarting persistent world role cannot duplicate its committed interval tick');
echo 'ASSET108 EVIDENCE: ' . json_encode(['database' => $databaseEvidence, 'assets' => $prefix . '-assets', 'glb' => $ready['id'], 'bundle' => $bundle['id'], 'adapter' => $db->driver(), 'productionDataTouched' => false], JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES) . PHP_EOL;
echo "LAUNCH ASSET108 RESULT: {$count} passed, 0 failed\n";
