<?php

declare(strict_types=1);

namespace Zone\Engine\Core\Publishing;

use InvalidArgumentException;
use RuntimeException;
use Zone\Engine\Core\Events\DomainEvent;
use Zone\Engine\Core\Events\EventBus;
use Zone\Engine\Core\Persistence\Database;
use Zone\Engine\Core\Content\GameplayCatalog;

final class ReleaseManager
{
    private const CHANNEL = 'production';

    private const SCREEN_IDS = [
        'home', 'items', 'city', 'jobs', 'bank', 'gym', 'properties', 'education', 'crimes', 'missions',
        'newspaper', 'jail', 'hospital', 'casino', 'hof', 'faction', 'elimination', 'attack', 'market',
    ];

    private const BLOCK_TYPES = ['hero', 'text', 'callout', 'stat-grid', 'action-grid'];

    public function __construct(
        private readonly Database $database,
        private readonly EventBus $events,
    ) {
        $this->ensureDraft();
    }

    public function draft(): array
    {
        $row = $this->database->fetchOne(
            'SELECT channel, manifest_json, updated_by, updated_at FROM content_drafts WHERE channel = :channel',
            ['channel' => self::CHANNEL],
        );
        if ($row === null) {
            throw new RuntimeException('Production draft is unavailable.');
        }

        return [
            'channel' => $row['channel'],
            'manifest' => $this->decodeManifest((string) $row['manifest_json']),
            'updatedBy' => $row['updated_by'],
            'updatedAt' => $row['updated_at'],
        ];
    }

    /** Persist the installation's initial runtime once, before any admin edit. */
    public function initializeContent(array $content): void
    {
        $manifest = $this->defaultManifest();
        $manifest['content'] = $content;
        $this->database->insertIgnore('content_foundations', ['channel', 'manifest_json'], [self::CHANNEL, $this->encode($manifest)]);
    }

    public function foundation(): array
    {
        $row = $this->database->fetchOne('SELECT manifest_json FROM content_foundations WHERE channel = :channel', ['channel' => self::CHANNEL]);
        $manifest = $row === null ? $this->defaultManifest() : $this->decodeManifest((string) $row['manifest_json']);
        $manifest['content']['gameplayCatalog'] ??= (new GameplayCatalog($this->database, $this->events))->foundation();
        return $manifest;
    }

    public function saveDraft(array $manifest, string $actor): array
    {
        return $this->configurationTransaction(fn (): array => $this->saveDraftLocked($manifest, $actor));
    }

    /** One shared row serializes publication, rollback and admin configuration edits. */
    public function configurationTransaction(callable $action): mixed
    {
        return $this->database->transaction(function () use ($action): mixed {
            $this->database->execute('UPDATE content_drafts SET updated_at = updated_at WHERE channel = :channel', ['channel' => self::CHANNEL]);
            return $action();
        });
    }

    private function saveDraftLocked(array $manifest, string $actor): array
    {
        $manifest = $this->validateManifest($manifest);
        $actor = $this->validateActor($actor);
        $previous = $this->draft();
        $now = gmdate('c');
        $encoded = $this->encode($manifest);
        $correlationId = bin2hex(random_bytes(16));

        $this->database->transaction(function () use ($encoded, $actor, $now, $previous, $manifest, $correlationId): void {
            $this->database->execute(
                'INSERT INTO content_drafts (channel, manifest_json, updated_by, updated_at) VALUES (:channel, :manifest, :actor, :updated_at) '
                . 'ON CONFLICT (channel) DO UPDATE SET manifest_json = :manifest_update, updated_by = :actor_update, updated_at = :updated_at_update',
                [
                    'channel' => self::CHANNEL,
                    'manifest' => $encoded,
                    'actor' => $actor,
                    'updated_at' => $now,
                    'manifest_update' => $encoded,
                    'actor_update' => $actor,
                    'updated_at_update' => $now,
                ],
            );
            $this->recordAudit('DraftSaved', 'content-draft', self::CHANNEL, $previous['manifest'], $manifest, $actor, $correlationId, $now);
            $this->events->publish(new DomainEvent('ContentDraftSaved', [
                'channel' => self::CHANNEL,
                'actor' => $actor,
                'correlationId' => $correlationId,
            ]));
        });

        return [...$this->draft(), 'correlationId' => $correlationId];
    }

    public function publish(string $actor): array
    {
        return $this->configurationTransaction(fn (): array => $this->publishLocked($actor));
    }

    private function publishLocked(string $actor): array
    {
        $actor = $this->validateActor($actor);
        $draft = $this->draft();
        $manifest = $this->validateManifest($draft['manifest']);
        $releaseId = bin2hex(random_bytes(16));
        $correlationId = bin2hex(random_bytes(16));
        $publishedAt = gmdate('c');
        $current = $this->database->fetchOne('SELECT MAX(version) AS version FROM content_releases');
        $version = ((int) ($current['version'] ?? 0)) + 1;
        $previous = $this->active();

        $this->database->transaction(function () use ($releaseId, $version, $manifest, $actor, $publishedAt, $previous, $correlationId): void {
            $this->database->execute('UPDATE content_releases SET active = 0 WHERE active = 1');
            $this->database->execute(
                'INSERT INTO content_releases (id, version, manifest_json, active, published_by, published_at) '
                . 'VALUES (:id, :version, :manifest, 1, :actor, :published_at)',
                [
                    'id' => $releaseId,
                    'version' => $version,
                    'manifest' => $this->encode($manifest),
                    'actor' => $actor,
                    'published_at' => $publishedAt,
                ],
            );
            $next = [
                'id' => $releaseId,
                'version' => $version,
                'manifest' => $manifest,
                'active' => true,
                'publishedBy' => $actor,
                'publishedAt' => $publishedAt,
            ];
            $this->recordAudit('ReleasePublished', 'content-release', $releaseId, $previous, $next, $actor, $correlationId, $publishedAt);
            $this->events->publish(new DomainEvent('ReleasePublished', [
                'releaseId' => $releaseId,
                'version' => $version,
                'actor' => $actor,
                'correlationId' => $correlationId,
            ]));
        });

        return [...$this->active(), 'correlationId' => $correlationId];
    }

    public function active(): array
    {
        $row = $this->database->fetchOne(
            'SELECT id, version, manifest_json, active, published_by, published_at FROM content_releases WHERE active = 1 LIMIT 1',
        );
        if ($row === null) {
            return [
                'id' => 'foundation-default',
                'version' => 0,
                'manifest' => $this->foundation(),
                'active' => true,
                'publishedBy' => 'system',
                'publishedAt' => null,
            ];
        }

        return $this->normalizeRelease($row);
    }

    public function releases(): array
    {
        return array_map(
            fn (array $row): array => $this->normalizeRelease($row),
            $this->database->fetchAll(
                'SELECT id, version, manifest_json, active, published_by, published_at FROM content_releases ORDER BY version DESC',
            ),
        );
    }

    public function activate(string $releaseId, string $actor): array
    {
        return $this->configurationTransaction(fn (): array => $this->activateLocked($releaseId, $actor));
    }

    private function activateLocked(string $releaseId, string $actor): array
    {
        if (!preg_match('/^[a-f0-9]{32}$/', $releaseId)) {
            throw new InvalidArgumentException('Invalid release identifier.');
        }
        $actor = $this->validateActor($actor);
        $target = $this->database->fetchOne(
            'SELECT id, version, manifest_json, active, published_by, published_at FROM content_releases WHERE id = :id',
            ['id' => $releaseId],
        );
        if ($target === null) {
            throw new RuntimeException("Unknown release: {$releaseId}");
        }

        $previous = $this->active();
        $correlationId = bin2hex(random_bytes(16));
        $now = gmdate('c');
        $normalizedTarget = $this->normalizeRelease($target);
        $normalizedTarget['active'] = true;

        $this->database->transaction(function () use ($releaseId, $actor, $previous, $normalizedTarget, $correlationId, $now): void {
            $this->database->execute('UPDATE content_releases SET active = 0 WHERE active = 1');
            $this->database->execute('UPDATE content_releases SET active = 1 WHERE id = :id', ['id' => $releaseId]);
            $this->recordAudit('ReleaseActivated', 'content-release', $releaseId, $previous, $normalizedTarget, $actor, $correlationId, $now);
            $this->events->publish(new DomainEvent('ReleaseActivated', [
                'releaseId' => $releaseId,
                'version' => $normalizedTarget['version'],
                'actor' => $actor,
                'correlationId' => $correlationId,
            ]));
        });

        return [...$this->active(), 'correlationId' => $correlationId];
    }

    private function ensureDraft(): void
    {
        if ($this->database->fetchOne('SELECT channel FROM content_drafts WHERE channel = :channel', ['channel' => self::CHANNEL]) !== null) {
            return;
        }
        $this->database->execute(
            'INSERT INTO content_drafts (channel, manifest_json, updated_by, updated_at) VALUES (:channel, :manifest, :actor, :updated_at)',
            [
                'channel' => self::CHANNEL,
                'manifest' => $this->encode($this->defaultManifest()),
                'actor' => 'system',
                'updated_at' => gmdate('c'),
            ],
        );
    }

    private function validateManifest(array $manifest): array
    {
        if (($manifest['schemaVersion'] ?? null) !== 1) {
            throw new InvalidArgumentException('Manifest schemaVersion must be 1.');
        }
        if (!is_array($manifest['branding'] ?? null) || !is_array($manifest['branding']['name'] ?? null)) {
            throw new InvalidArgumentException('Manifest branding.name must be bilingual.');
        }
        $this->validateBilingual($manifest['branding']['name'], 'branding.name');
        $this->validateBilingual($manifest['branding']['tagline'] ?? [], 'branding.tagline');
        if (!preg_match('/^#[0-9a-fA-F]{6}$/', (string) ($manifest['branding']['accent'] ?? ''))) {
            throw new InvalidArgumentException('Manifest branding.accent must be a six-digit hex color.');
        }

        if (!is_array($manifest['announcement'] ?? null) || !is_bool($manifest['announcement']['enabled'] ?? null)) {
            throw new InvalidArgumentException('Manifest announcement must declare an enabled boolean.');
        }
        $this->validateBilingual($manifest['announcement']['text'] ?? [], 'announcement.text');

        if (!is_array($manifest['modules'] ?? null)) {
            throw new InvalidArgumentException('Manifest modules must be an object.');
        }
        foreach ($manifest['modules'] as $id => $enabled) {
            if (!preg_match('/^[a-z][a-z0-9-]{1,79}$/', (string) $id) || !is_bool($enabled)) {
                throw new InvalidArgumentException('Every module state must use a safe id and a boolean value.');
            }
        }

        if (!is_array($manifest['pages'] ?? null)) {
            throw new InvalidArgumentException('Manifest pages must be an array.');
        }
        $pageIds = [];
        $slugs = [];
        foreach ($manifest['pages'] as $pageIndex => $page) {
            if (!is_array($page)) {
                throw new InvalidArgumentException("Page {$pageIndex} must be an object.");
            }
            $id = (string) ($page['id'] ?? '');
            $slug = (string) ($page['slug'] ?? '');
            if (!preg_match('/^[a-z][a-z0-9-]{1,79}$/', $id) || isset($pageIds[$id])) {
                throw new InvalidArgumentException("Page {$pageIndex} has an invalid or duplicate id.");
            }
            if (!preg_match('/^[a-z][a-z0-9-]{1,79}$/', $slug) || isset($slugs[$slug])) {
                throw new InvalidArgumentException("Page {$pageIndex} has an invalid or duplicate slug.");
            }
            if (!is_bool($page['enabled'] ?? null)) {
                throw new InvalidArgumentException("Page {$id} must declare an enabled boolean.");
            }
            $this->validateBilingual($page['title'] ?? [], "pages.{$id}.title");
            if (!is_array($page['blocks'] ?? null)) {
                throw new InvalidArgumentException("Page {$id} blocks must be an array.");
            }
            $blockIds = [];
            foreach ($page['blocks'] as $blockIndex => $block) {
                if (!is_array($block)) {
                    throw new InvalidArgumentException("Page {$id} block {$blockIndex} must be an object.");
                }
                $blockId = (string) ($block['id'] ?? '');
                $type = (string) ($block['type'] ?? '');
                if (!preg_match('/^[a-z][a-z0-9-]{1,79}$/', $blockId) || isset($blockIds[$blockId])) {
                    throw new InvalidArgumentException("Page {$id} has an invalid or duplicate block id.");
                }
                if (!in_array($type, self::BLOCK_TYPES, true)) {
                    throw new InvalidArgumentException("Unregistered builder block type: {$type}");
                }
                $this->validateBilingual($block['content'] ?? [], "pages.{$id}.blocks.{$blockId}.content");
                $this->rejectExecutableKeys($block);
                $blockIds[$blockId] = true;
            }
            $pageIds[$id] = true;
            $slugs[$slug] = true;
        }

        if (!is_array($manifest['navigation'] ?? null)) {
            throw new InvalidArgumentException('Manifest navigation must be an array.');
        }
        $allowedNavigation = array_fill_keys([...self::SCREEN_IDS, ...array_keys($pageIds)], true);
        $seenNavigation = [];
        foreach ($manifest['navigation'] as $id) {
            if (!is_string($id) || !isset($allowedNavigation[$id]) || isset($seenNavigation[$id])) {
                throw new InvalidArgumentException('Manifest navigation contains an unknown or duplicate page id.');
            }
            $seenNavigation[$id] = true;
        }

        if (isset($manifest['content'])) {
            if (!is_array($manifest['content'])) {
                throw new InvalidArgumentException('Manifest content must be an object.');
            }
            foreach (['crimes', 'engineModules', 'themes'] as $collection) {
                if (isset($manifest['content'][$collection]) && !is_array($manifest['content'][$collection])) {
                    throw new InvalidArgumentException("Manifest content.{$collection} must be an array.");
                }
            }
            foreach (($manifest['content']['crimes'] ?? []) as $crimeIndex => $crime) {
                if (!is_array($crime) || !preg_match('/^[a-z][a-z0-9-]{1,79}$/', (string) ($crime['id'] ?? ''))) {
                    throw new InvalidArgumentException("Manifest content crime {$crimeIndex} has an invalid id.");
                }
                foreach (['name_en', 'name_ar'] as $field) {
                    if (!is_string($crime[$field] ?? null) || trim($crime[$field]) === '' || strlen($crime[$field]) > 160) {
                        throw new InvalidArgumentException("Manifest content crime {$crimeIndex} has an invalid {$field}.");
                    }
                }
                foreach (['nerve_cost', 'success_basis_points', 'cash_min', 'cash_max', 'xp_reward'] as $field) {
                    if (!is_int($crime[$field] ?? null) && !is_float($crime[$field] ?? null)) {
                        throw new InvalidArgumentException("Manifest content crime {$crimeIndex} has an invalid {$field}.");
                    }
                }
                if (!is_bool($crime['enabled'] ?? null)) {
                    throw new InvalidArgumentException("Manifest content crime {$crimeIndex} must declare enabled as a boolean.");
                }
            }
        }

        $this->rejectExecutableKeys($manifest);
        return $manifest;
    }

    private function validateBilingual(array $value, string $path): void
    {
        foreach (['en', 'ar'] as $language) {
            if (!array_key_exists($language, $value) || !is_string($value[$language])) {
                throw new InvalidArgumentException("{$path}.{$language} must be a string.");
            }
            if (strlen($value[$language]) > 12000) {
                throw new InvalidArgumentException("{$path}.{$language} exceeds 4000 characters.");
            }
        }
    }

    private function rejectExecutableKeys(array $value): void
    {
        foreach ($value as $key => $child) {
            if (is_string($key) && (preg_match('/^on[a-z]+$/i', $key) || in_array(strtolower($key), ['html', 'script', 'javascript'], true))) {
                throw new InvalidArgumentException("Executable manifest field is forbidden: {$key}");
            }
            if (is_array($child)) {
                $this->rejectExecutableKeys($child);
            }
        }
    }

    private function validateActor(string $actor): string
    {
        $actor = trim($actor);
        if ($actor === '' || strlen($actor) > 480) {
            throw new InvalidArgumentException('Admin actor must contain 1 to 160 characters.');
        }
        return $actor;
    }

    private function recordAudit(
        string $action,
        string $targetType,
        string $targetId,
        mixed $previous,
        mixed $next,
        string $actor,
        string $correlationId,
        string $createdAt,
    ): void {
        $this->database->execute(
            'INSERT INTO admin_audit_log (id, actor, action, target_type, target_id, previous_json, next_json, correlation_id, created_at) '
            . 'VALUES (:id, :actor, :action, :target_type, :target_id, :previous_json, :next_json, :correlation_id, :created_at)',
            [
                'id' => bin2hex(random_bytes(16)),
                'actor' => $actor,
                'action' => $action,
                'target_type' => $targetType,
                'target_id' => $targetId,
                'previous_json' => $previous === null ? null : $this->encode($previous),
                'next_json' => $next === null ? null : $this->encode($next),
                'correlation_id' => $correlationId,
                'created_at' => $createdAt,
            ],
        );
    }

    private function normalizeRelease(array $row): array
    {
        $manifest = $this->decodeManifest((string) $row['manifest_json']);
        // Legacy releases created before runtime snapshots use the immutable
        // installation foundation, never the administrator's current draft.
        $manifest['content'] ??= $this->foundation()['content'] ?? [];
        $manifest['content']['gameplayCatalog'] ??= (new GameplayCatalog($this->database, $this->events))->foundation();
        return [
            'id' => $row['id'],
            'version' => (int) $row['version'],
            'manifest' => $manifest,
            'active' => (bool) $row['active'],
            'publishedBy' => $row['published_by'],
            'publishedAt' => $row['published_at'],
        ];
    }

    private function decodeManifest(string $json): array
    {
        $decoded = json_decode($json, true, 64, JSON_THROW_ON_ERROR);
        if (!is_array($decoded)) {
            throw new RuntimeException('Stored release manifest must be an object.');
        }
        return $decoded;
    }

    private function encode(mixed $value): string
    {
        return json_encode($value, JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    }

    private function defaultManifest(): array
    {
        return [
            'schemaVersion' => 1,
            'branding' => [
                'name' => ['en' => 'ZONE', 'ar' => 'زون'],
                'tagline' => ['en' => 'Build the city. Run the world.', 'ar' => 'ابنِ المدينة. أدر العالم.'],
                'accent' => '#a3d900',
            ],
            'announcement' => [
                'enabled' => true,
                'text' => [
                    'en' => 'ZONE is running from the active engine release.',
                    'ar' => 'تعمل ZONE من الإصدار النشط للمحرك.',
                ],
            ],
            'modules' => array_fill_keys(self::SCREEN_IDS, true),
            'navigation' => self::SCREEN_IDS,
            'pages' => [],
        ];
    }
}
