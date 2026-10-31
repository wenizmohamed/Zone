<?php

declare(strict_types=1);

namespace Zone\Engine\Core\Modules;

use RuntimeException;
use Zone\Engine\Core\Contracts\GameModule;
use Zone\Engine\Core\Events\EventBus;
use Zone\Engine\Core\Persistence\Database;

final class ModuleRegistry
{
    /** @var array<string, array<string, mixed>> */
    private array $manifests = [];

    public function __construct(
        private readonly Database $database,
        private readonly EventBus $events,
        private readonly string $modulesPath,
    ) {
    }

    public function discoverAndBoot(): void
    {
        $existingRows = [];
        foreach ($this->database->fetchAll('SELECT id, version, manifest_json FROM modules') as $row) $existingRows[$row['id']] = $row;
        foreach (glob($this->modulesPath . '/*/module.json') ?: [] as $manifestPath) {
            $manifest = json_decode((string) file_get_contents($manifestPath), true, 512, JSON_THROW_ON_ERROR);
            foreach (['id', 'name', 'version', 'class'] as $required) {
                if (!isset($manifest[$required]) || !is_string($manifest[$required])) {
                    throw new RuntimeException("Invalid module manifest {$manifestPath}: missing {$required}.");
                }
            }
            $id = $manifest['id'];
            $this->manifests[$id] = $manifest;
            $existing = $existingRows[$id] ?? null;
            if ($existing === null) $this->database->insertIgnore(
                'modules',
                ['id', 'name', 'version', 'installed', 'enabled', 'manifest_json'],
                [$id, $manifest['name'], $manifest['version'], 1, (int) ($manifest['enabledByDefault'] ?? true), json_encode($manifest, JSON_THROW_ON_ERROR)],
            );
            if ($existing === null || json_decode((string) $existing['manifest_json'], true, 64, JSON_THROW_ON_ERROR) != $manifest) $this->database->execute(
                'UPDATE modules SET name = :name, version = :version, manifest_json = :manifest WHERE id = :id',
                ['id' => $id, 'name' => $manifest['name'], 'version' => $manifest['version'], 'manifest' => json_encode($manifest, JSON_THROW_ON_ERROR)],
            );
            if ($existing !== null && $existing['version'] !== $manifest['version']) {
                $this->database->insertIgnore(
                    'module_version_history',
                    ['module_id', 'from_version', 'to_version', 'changed_at'],
                    [$id, $existing['version'], $manifest['version'], gmdate('c')],
                );
            }
        }

        $bootStates = (new \Zone\Engine\Core\Publishing\PublishedRules($this->database))->moduleStates();
        foreach ($this->database->fetchAll('SELECT id FROM modules ORDER BY id') as $row) {
            if (!($bootStates[$row['id']] ?? false)) {
                continue;
            }
            $manifest = $this->manifests[$row['id']] ?? null;
            if ($manifest === null) {
                continue;
            }
            $class = $manifest['class'];
            $module = new $class();
            if (!$module instanceof GameModule) {
                throw new RuntimeException("Module {$row['id']} must implement GameModule.");
            }
            $module->boot($this->events, $this->database);
        }
    }

    public function all(): array
    {
        $rows = $this->database->fetchAll('SELECT id, name, version, installed, enabled, manifest_json FROM modules ORDER BY id');
        return array_map(static function (array $row): array {
            $manifest = json_decode($row['manifest_json'], true, 512, JSON_THROW_ON_ERROR);
            return [
                'id' => $row['id'],
                'name' => $row['name'],
                'version' => $row['version'],
                'installed' => (bool) $row['installed'],
                'enabled' => (bool) $row['enabled'],
                'description' => $manifest['description'] ?? '',
                'description_ar' => $manifest['description_ar'] ?? ($manifest['description'] ?? ''),
                'provides' => $manifest['provides'] ?? [],
                'subscribes' => $manifest['subscribes'] ?? [],
            ];
        }, $rows);
    }

    public function isEnabled(string $id): bool
    {
        $row = $this->database->fetchOne('SELECT installed, enabled FROM modules WHERE id = :id', ['id' => $id]);
        return $row !== null && (bool) $row['installed'] && (bool) $row['enabled'];
    }

    public function summary(): array
    {
        $all = $this->all();
        return [
            'total' => count($all),
            'installed' => count(array_filter($all, static fn (array $m): bool => $m['installed'])),
            'enabled' => count(array_filter($all, static fn (array $m): bool => $m['installed'] && $m['enabled'])),
        ];
    }

    private function runtimeEnabled(string $id): bool
    {
        return (new \Zone\Engine\Core\Publishing\PublishedRules($this->database))->moduleEnabled($id);
    }

    public function changeState(string $id, string $action): array
    {
        if (!isset($this->manifests[$id])) {
            throw new RuntimeException("Unknown module: {$id}");
        }
        $values = match ($action) {
            'install' => [1, 1],
            'uninstall' => [0, 0],
            'enable' => [1, 1],
            'disable' => [1, 0],
            default => throw new RuntimeException("Unsupported module action: {$action}"),
        };
        $this->database->execute(
            'UPDATE modules SET installed = :installed, enabled = :enabled WHERE id = :id',
            ['id' => $id, 'installed' => $values[0], 'enabled' => $values[1]],
        );
        return array_values(array_filter($this->all(), static fn (array $module): bool => $module['id'] === $id))[0];
    }
}
