<?php

declare(strict_types=1);

namespace Zone\Engine\Core\Themes;

use RuntimeException;
use Zone\Engine\Core\Persistence\Database;

final class ThemeRegistry
{
    /** @var array<string, array<string, mixed>> */
    private array $manifests = [];

    public function __construct(private readonly Database $database, private readonly string $themesPath)
    {
    }

    public function discover(): void
    {
        $existingRows = [];
        foreach ($this->database->fetchAll('SELECT id, manifest_json FROM themes') as $row) $existingRows[$row['id']] = $row;
        foreach (glob($this->themesPath . '/*/theme.json') ?: [] as $manifestPath) {
            $manifest = json_decode((string) file_get_contents($manifestPath), true, 512, JSON_THROW_ON_ERROR);
            foreach (['id', 'name', 'version', 'stylesheet'] as $required) {
                if (!isset($manifest[$required]) || !is_string($manifest[$required])) {
                    throw new RuntimeException("Invalid theme manifest {$manifestPath}: missing {$required}.");
                }
            }
            $this->manifests[$manifest['id']] = $manifest + ['directory' => dirname($manifestPath)];
            $existing = $existingRows[$manifest['id']] ?? null;
            if ($existing === null) $this->database->insertIgnore(
                'themes',
                ['id', 'name', 'version', 'installed', 'active', 'manifest_json'],
                [$manifest['id'], $manifest['name'], $manifest['version'], 1, (int) ($manifest['activeByDefault'] ?? false), json_encode($manifest, JSON_THROW_ON_ERROR)],
            );
            if ($existing === null || json_decode((string) $existing['manifest_json'], true, 64, JSON_THROW_ON_ERROR) != $manifest) $this->database->execute(
                'UPDATE themes SET name = :name, version = :version, manifest_json = :manifest WHERE id = :id',
                ['id' => $manifest['id'], 'name' => $manifest['name'], 'version' => $manifest['version'], 'manifest' => json_encode($manifest, JSON_THROW_ON_ERROR)],
            );
        }
        $active = $this->database->fetchOne('SELECT id FROM themes WHERE installed = 1 AND active = 1 LIMIT 1');
        if ($active === null && $this->manifests !== []) {
            $first = array_key_first($this->manifests);
            $this->activate((string) $first);
        }
    }

    public function all(): array
    {
        $rows = $this->database->fetchAll('SELECT id, name, version, installed, active, manifest_json FROM themes ORDER BY id');
        return array_map(static function (array $row): array {
            $manifest = json_decode($row['manifest_json'], true, 512, JSON_THROW_ON_ERROR);
            return [
                'id' => $row['id'],
                'name' => $row['name'],
                'version' => $row['version'],
                'installed' => (bool) $row['installed'],
                'active' => (bool) $row['active'],
                'description' => $manifest['description'] ?? '',
                'description_ar' => $manifest['description_ar'] ?? ($manifest['description'] ?? ''),
                'preview' => $manifest['preview'] ?? '#d7ff3f',
            ];
        }, $rows);
    }

    public function activate(string $id): array
    {
        if (!isset($this->manifests[$id])) {
            throw new RuntimeException("Unknown theme: {$id}");
        }
        $this->database->transaction(function () use ($id): void {
            $this->database->execute('UPDATE themes SET active = 0');
            $this->database->execute('UPDATE themes SET installed = 1, active = 1 WHERE id = :id', ['id' => $id]);
        });
        return array_values(array_filter($this->all(), static fn (array $theme): bool => $theme['id'] === $id))[0];
    }

    public function activeTheme(): ?array
    {
        $active = array_values(array_filter($this->all(), static fn (array $theme): bool => $theme['installed'] && $theme['active']));
        return $active[0] ?? null;
    }

    /** @return list<string> */
    public function installedThemeIds(): array
    {
        return array_values(array_map(
            static fn (array $t): string => (string) $t['id'],
            array_filter($this->all(), static fn (array $t): bool => $t['installed']),
        ));
    }

    public function activeStylesheet(?string $publishedId = null): string
    {
        $row = $this->database->fetchOne('SELECT id FROM themes WHERE installed = 1 AND active = 1 LIMIT 1');
        $id = $publishedId ?? $row['id'] ?? array_key_first($this->manifests);
        if ($id === null || !isset($this->manifests[$id])) {
            return '';
        }
        $manifest = $this->manifests[$id];
        $path = $manifest['directory'] . '/' . $manifest['stylesheet'];
        return (string) file_get_contents($path);
    }
}
