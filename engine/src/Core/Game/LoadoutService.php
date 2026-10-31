<?php
declare(strict_types=1);
namespace Zone\Engine\Core\Game;

use Zone\Engine\Core\Content\GameplayCatalog;
use Zone\Engine\Core\Events\EventBus;
use Zone\Engine\Core\Persistence\Database;

/** Catalog and ownership, never client claims, determine both independent slots. */
final class LoadoutService
{
    /** One statement pins item balance and module gates to the same release. */
    public static function publishedView(Database $database, EventBus $events): array
    {
        $projection = $database->driver() === 'pgsql'
            ? "jsonb_build_object('items', manifest_json->'content'->'gameplayCatalog'->'items', 'modules', manifest_json->'modules', 'engineModules', manifest_json->'content'->'engineModules')"
            : "json_object('items', json_extract(manifest_json, '$.content.gameplayCatalog.items'), 'modules', json_extract(manifest_json, '$.modules'), 'engineModules', json_extract(manifest_json, '$.content.engineModules'))";
        $row = $database->fetchOne("SELECT {$projection} AS rules FROM content_releases WHERE active = 1 LIMIT 1");
        $view = $row === null ? [] : json_decode((string) $row['rules'], true, 64, JSON_THROW_ON_ERROR);
        if (!isset($view['items'], $view['engineModules'])) {
            $foundation = $database->fetchOne("SELECT {$projection} AS rules FROM content_foundations WHERE channel = 'production'");
            $fallback = $foundation === null ? [] : json_decode((string) $foundation['rules'], true, 64, JSON_THROW_ON_ERROR);
            $view['items'] ??= $fallback['items'] ?? (new GameplayCatalog($database, $events))->foundation()['items'];
            $view['engineModules'] ??= $fallback['engineModules'] ?? $database->fetchAll('SELECT id, installed, enabled FROM modules');
        }
        $territoriesEnabled = false;
        foreach ($view['engineModules'] as $module) {
            if ($module['id'] === 'territories') $territoriesEnabled = ($view['modules']['city'] ?? true) !== false && (bool) $module['installed'] && (bool) $module['enabled'];
        }
        return ['items' => $view['items'], 'territoriesEnabled' => $territoriesEnabled];
    }

    public static function resolve(array $state, array $items): array
    {
        $weaponId = $state['equip'] ?? null;
        $armorId = $state['armorEquip'] ?? null;
        if (!is_string($weaponId) || ($state['inv'][$weaponId] ?? 0) < 1 || ($items[$weaponId]['type'] ?? null) !== 'weapon') $weaponId = null;
        if (!is_string($armorId) || ($state['inv'][$armorId] ?? 0) < 1 || ($items[$armorId]['type'] ?? null) !== 'armor') $armorId = null;
        $weaponMultiplier = $weaponId === null ? 1.0 : max(1.0, (float) ($items[$weaponId]['mult'] ?? 1));
        $armorReduction = $armorId === null ? 0.0 : min(0.95, max(0.0, (float) ($items[$armorId]['red'] ?? 0)));
        return ['weaponId' => $weaponId, 'armorId' => $armorId,
            'weaponMultiplier' => $weaponMultiplier,
            'armorReduction' => $armorReduction,
            'weaponBonusPct' => (int) round(($weaponMultiplier - 1.0) * 100),
            'armorMitigationPct' => (int) round($armorReduction * 100)];
    }

    public static function removeMissing(array &$state, string $id): void
    {
        if (($state['inv'][$id] ?? 0) > 0) return;
        if (($state['equip'] ?? null) === $id) $state['equip'] = null;
        if (($state['armorEquip'] ?? null) === $id) $state['armorEquip'] = null;
    }

    public static function equippedSlotCount(array $state, array $items): int
    {
        $resolved = self::resolve($state, $items);
        return (int) ($resolved['weaponId'] !== null) + (int) ($resolved['armorId'] !== null);
    }
}
