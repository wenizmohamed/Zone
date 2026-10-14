<?php
declare(strict_types=1);
namespace Zone\Engine\Core\Publishing;
use Zone\Engine\Core\Persistence\Database;

/** Shared release gates for action handlers, subscribers and passive modifiers. */
final class PublishedRules
{
    public function __construct(private readonly Database $database) {}

    public function moduleEnabled(string $id): bool
    {
        return $this->moduleStates()[$id] ?? false;
    }

    /** Query only gates, never the full city/content payload for each hook. */
    public function moduleStates(): array
    {
        $projection = $this->database->driver() === 'pgsql'
            ? "jsonb_build_object('modules', manifest_json->'modules', 'engineModules', manifest_json->'content'->'engineModules')"
            : "json_object('modules', json_extract(manifest_json, '$.modules'), 'engineModules', json_extract(manifest_json, '$.content.engineModules'))";
        $row = $this->database->fetchOne("SELECT {$projection} AS gates FROM content_releases WHERE active = 1 LIMIT 1");
        $manifest = $row === null ? [] : json_decode((string) $row['gates'], true, 64, JSON_THROW_ON_ERROR);
        if (!isset($manifest['engineModules'])) {
            $foundation = $this->database->fetchOne("SELECT {$projection} AS gates FROM content_foundations WHERE channel = 'production'");
            if ($foundation !== null) $manifest['engineModules'] = json_decode((string) $foundation['gates'], true, 64, JSON_THROW_ON_ERROR)['engineModules'] ?? null;
        }
        $states = [];
        $modules = $manifest['engineModules'] ?? $this->database->fetchAll('SELECT id, installed, enabled FROM modules');
        foreach ($modules as $module) {
            $id = $module['id'];
            $screen = ['crime' => 'crimes', 'stats' => 'gym', 'kill' => 'attack', 'blackjack' => 'casino', 'inventory' => 'items', 'blackmarket' => 'market', 'gangs' => 'faction', 'territories' => 'city', 'leaderboards' => 'hof'][$id] ?? $id;
            $states[$id] = ($manifest['modules'][$screen] ?? true) !== false && (bool) $module['installed'] && (bool) $module['enabled'];
        }
        return $states;
    }
}
