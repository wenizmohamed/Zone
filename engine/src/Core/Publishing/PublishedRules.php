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
        $row = $this->database->fetchOne('SELECT manifest_json FROM content_releases WHERE active = 1 LIMIT 1');
        $manifest = $row === null ? [] : json_decode((string) $row['manifest_json'], true, 64, JSON_THROW_ON_ERROR);
        if (!isset($manifest['content']['engineModules'])) {
            $foundation = $this->database->fetchOne("SELECT manifest_json FROM content_foundations WHERE channel = 'production'");
            if ($foundation !== null) $manifest['content'] = json_decode((string) $foundation['manifest_json'], true, 64, JSON_THROW_ON_ERROR)['content'] ?? [];
        }
        $screen = ['crime' => 'crimes', 'stats' => 'gym', 'kill' => 'attack', 'blackjack' => 'casino', 'inventory' => 'items', 'blackmarket' => 'market', 'gangs' => 'faction', 'territories' => 'city'][$id] ?? $id;
        if (($manifest['modules'][$screen] ?? true) === false) return false;
        if (isset($manifest['content']['engineModules'])) {
            foreach ($manifest['content']['engineModules'] as $module) {
                if ($module['id'] === $id) return (bool) $module['installed'] && (bool) $module['enabled'];
            }
            return false;
        }
        // Initial discovery runs before the installation foundation is captured.
        $module = $this->database->fetchOne('SELECT installed, enabled FROM modules WHERE id = :id', ['id' => $id]);
        return $module !== null && (bool) $module['installed'] && (bool) $module['enabled'];
    }
}
