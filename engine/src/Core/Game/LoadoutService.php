<?php

declare(strict_types=1);

namespace Zone\Engine\Core\Game;

use InvalidArgumentException;
use RuntimeException;
use Zone\Engine\Core\Content\GameplayCatalog;
use Zone\Engine\Core\Events\EventBus;
use Zone\Engine\Core\Persistence\Database;

/** Catalog and ownership, never client claims, determine all weapon and armor slots. */
final class LoadoutService
{
    public const WEAPON_SLOTS = ['primary', 'secondary', 'melee', 'temporary'];
    public const ARMOR_SLOTS = ['head', 'body', 'hands', 'legs', 'feet'];
    public const ALL_SLOTS = ['primary', 'secondary', 'melee', 'temporary', 'head', 'body', 'hands', 'legs', 'feet'];

    public const TACTICAL_ARMOR_CATALOG = [
        'tac_helmet' => [
            'id' => 'tac_helmet',
            'slot' => 'head',
            'type' => 'armor',
            'red' => 0.12,
            'price' => 45000,
            'nameEn' => 'Ballistic Kevlar Helmet',
            'nameAr' => 'خوذة كيفلر باليستية',
        ],
        'tac_plate' => [
            'id' => 'tac_plate',
            'slot' => 'body',
            'type' => 'armor',
            'red' => 0.28,
            'price' => 95000,
            'nameEn' => 'Interceptor Plate Carrier',
            'nameAr' => 'درع صدري اعتراضي',
        ],
        'tac_gloves' => [
            'id' => 'tac_gloves',
            'slot' => 'hands',
            'type' => 'armor',
            'red' => 0.08,
            'price' => 28000,
            'nameEn' => 'Reinforced Tactical Gloves',
            'nameAr' => 'قفازات تكتيكية مقواة',
        ],
        'tac_greaves' => [
            'id' => 'tac_greaves',
            'slot' => 'legs',
            'type' => 'armor',
            'red' => 0.12,
            'price' => 52000,
            'nameEn' => 'Composite Shin & Thigh Guards',
            'nameAr' => 'واقيات ساق مركبة',
        ],
        'tac_boots' => [
            'id' => 'tac_boots',
            'slot' => 'feet',
            'type' => 'armor',
            'red' => 0.08,
            'price' => 30000,
            'nameEn' => 'Steel-Toe Assault Boots',
            'nameAr' => 'حذاء اقتحام مصفح',
        ],
    ];

    public const TEMPORARY_TACTICAL_ITEMS = [
        'flash_grenade' => [
            'mult' => 1.15,
            'nameEn' => 'Flashbang Grenade',
            'nameAr' => 'قنبلة ضوئية',
        ],
        'smoke_grenade' => [
            'mult' => 1.15,
            'nameEn' => 'Smoke Grenade',
            'nameAr' => 'قنبلة دخانية',
        ],
        'epinephrine' => [
            'mult' => 1.15,
            'nameEn' => 'Epinephrine Auto-Injector',
            'nameAr' => 'حاقن إبينفرين',
        ],
    ];

    public const AUX_MELEE_ITEMS = [
        'cut_throat_razor' => [
            'mult' => 1.35,
            'nameEn' => 'Cut-Throat Pocket Razor',
            'nameAr' => 'شفرة نشل دقيقة',
        ],
    ];

    public const AUX_HEAD_ARMOR_ITEMS = [
        'paint_mask' => [
            'red' => 0.05,
            'nameEn' => 'Respirator Paint Mask',
            'nameAr' => 'قناع طلاء واقٍ',
        ],
    ];

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
            if ($module['id'] === 'territories') {
                $territoriesEnabled = ($view['modules']['city'] ?? true) !== false && (bool) $module['installed'] && (bool) $module['enabled'];
            }
        }
        return ['items' => $view['items'], 'territoriesEnabled' => $territoriesEnabled];
    }

    public static function naturalWeaponSlot(string $itemId, array $itemDef = []): string
    {
        if (isset($itemDef['slot']) && in_array($itemDef['slot'], self::WEAPON_SLOTS, true)) {
            return (string) $itemDef['slot'];
        }
        if (isset(self::TEMPORARY_TACTICAL_ITEMS[$itemId]) || ($itemDef['type'] ?? null) === 'temporary') {
            return 'temporary';
        }
        if (in_array($itemId, ['bat', 'knife'], true) || str_starts_with($itemId, 'melee')) {
            return 'melee';
        }
        if (
            $itemId === 'magnum'
            || str_starts_with($itemId, 'pistol')
            || str_starts_with($itemId, 'revolver')
        ) {
            return 'secondary';
        }
        return 'primary';
    }

    public static function resolve(array $state, array $items): array
    {
        $inv = is_array($state['inv'] ?? null) ? $state['inv'] : [];
        $rwWeapons = is_array($state['rwWeapons'] ?? null) ? $state['rwWeapons'] : [];
        $tacticalArmor = is_array($state['tacticalArmor'] ?? null) ? $state['tacticalArmor'] : [];

        // 1. Validate legacy single weapon & armor slots first for 100% baseline parity.
        $legacyWeaponId = is_string($state['equip'] ?? null) ? $state['equip'] : null;
        $legacyWeaponSpec = null;
        if ($legacyWeaponId !== null) {
            if (isset($rwWeapons[$legacyWeaponId]) && is_array($rwWeapons[$legacyWeaponId])) {
                $legacyWeaponSpec = self::normalizeRwWeapon($legacyWeaponId, $rwWeapons[$legacyWeaponId]);
            } elseif (($inv[$legacyWeaponId] ?? 0) >= 1 && ($items[$legacyWeaponId]['type'] ?? null) === 'weapon') {
                $legacyWeaponSpec = self::normalizeCatalogWeapon($legacyWeaponId, $items[$legacyWeaponId]);
            } else {
                $legacyWeaponId = null;
            }
        }

        $legacyArmorId = is_string($state['armorEquip'] ?? null) ? $state['armorEquip'] : null;
        $legacyArmorSpec = null;
        if ($legacyArmorId !== null) {
            if (isset(self::TACTICAL_ARMOR_CATALOG[$legacyArmorId]) && (int) ($tacticalArmor[$legacyArmorId] ?? 0) >= 1) {
                $legacyArmorSpec = self::TACTICAL_ARMOR_CATALOG[$legacyArmorId];
            } elseif (($inv[$legacyArmorId] ?? 0) >= 1 && ($items[$legacyArmorId]['type'] ?? null) === 'armor') {
                $legacyArmorSpec = self::normalizeCatalogArmor($legacyArmorId, $items[$legacyArmorId], 'body');
            } else {
                $legacyArmorId = null;
            }
        }

        $hasExplicitSlots = isset($state['loadoutSlots']) && is_array($state['loadoutSlots']);
        $rawSlots = $hasExplicitSlots ? $state['loadoutSlots'] : [];

        $slotDetails = [];
        $flatSlots = [];
        foreach (self::ALL_SLOTS as $s) {
            $flatSlots[$s] = null;
            $slotDetails[$s] = [
                'slot' => $s,
                'kind' => in_array($s, self::WEAPON_SLOTS, true) ? 'weapon' : 'armor',
                'itemId' => null,
                'nameEn' => null,
                'nameAr' => null,
                'mult' => null,
                'red' => null,
                'rarity' => null,
                'perk' => null,
            ];
        }

        if (!$hasExplicitSlots) {
            if ($legacyWeaponId !== null && $legacyWeaponSpec !== null) {
                $targetSlot = $legacyWeaponSpec['slot'];
                $flatSlots[$targetSlot] = $legacyWeaponId;
                $slotDetails[$targetSlot] = [
                    'slot' => $targetSlot,
                    'kind' => 'weapon',
                    'itemId' => $legacyWeaponId,
                    'nameEn' => $legacyWeaponSpec['nameEn'],
                    'nameAr' => $legacyWeaponSpec['nameAr'],
                    'mult' => $legacyWeaponSpec['mult'],
                    'red' => null,
                    'rarity' => $legacyWeaponSpec['rarity'],
                    'perk' => $legacyWeaponSpec['perk'],
                ];
            }
            if ($legacyArmorId !== null && $legacyArmorSpec !== null) {
                $targetArmorSlot = $legacyArmorSpec['slot'] ?? 'body';
                $flatSlots[$targetArmorSlot] = $legacyArmorId;
                $slotDetails[$targetArmorSlot] = [
                    'slot' => $targetArmorSlot,
                    'kind' => 'armor',
                    'itemId' => $legacyArmorId,
                    'nameEn' => $legacyArmorSpec['nameEn'],
                    'nameAr' => $legacyArmorSpec['nameAr'],
                    'mult' => null,
                    'red' => (float) ($legacyArmorSpec['red'] ?? 0.0),
                    'rarity' => 'standard',
                    'perk' => null,
                ];
            }

            $weaponMultiplier = $legacyWeaponSpec === null ? 1.0 : max(1.0, (float) $legacyWeaponSpec['mult']);
            $armorReduction = $legacyArmorSpec === null ? 0.0 : min(0.95, max(0.0, (float) ($legacyArmorSpec['red'] ?? 0.0)));
            $weaponPerks = ($legacyWeaponSpec !== null && $legacyWeaponSpec['perk'] !== null) ? [$legacyWeaponSpec['perk']] : [];

            return [
                'weaponId' => $legacyWeaponId,
                'armorId' => $legacyArmorId,
                'weaponMultiplier' => $weaponMultiplier,
                'armorReduction' => $armorReduction,
                'weaponBonusPct' => (int) round(($weaponMultiplier - 1.0) * 100),
                'armorMitigationPct' => (int) round($armorReduction * 100),
                'slots' => $flatSlots,
                'loadoutSlots' => $flatSlots,
                'slotDetails' => $slotDetails,
                'equippedSlotsCount' => (int) ($legacyWeaponId !== null) + (int) ($legacyArmorId !== null),
                'activeWeaponSlot' => $legacyWeaponSpec['slot'] ?? 'primary',
                'weaponPerks' => $weaponPerks,
                'perkModifiers' => self::computePerkModifiers($weaponPerks),
            ];
        }

        // 2. Full 9-slot resolution when state['loadoutSlots'] is configured.
        $usedInvCounts = [];
        $usedTacCounts = [];
        $usedRwIds = [];
        $validWeaponsBySlot = [];
        $validArmorsBySlot = [];

        foreach (self::WEAPON_SLOTS as $wSlot) {
            $candidate = isset($rawSlots[$wSlot]) && is_string($rawSlots[$wSlot]) && $rawSlots[$wSlot] !== ''
                ? $rawSlots[$wSlot]
                : null;
            if ($candidate === null) {
                continue;
            }
            if (isset($rwWeapons[$candidate]) && is_array($rwWeapons[$candidate]) && !isset($usedRwIds[$candidate])) {
                if ($wSlot === 'temporary') {
                    continue;
                }
                $usedRwIds[$candidate] = true;
                $spec = self::normalizeRwWeapon($candidate, $rwWeapons[$candidate]);
                $validWeaponsBySlot[$wSlot] = $spec;
                $flatSlots[$wSlot] = $candidate;
                $slotDetails[$wSlot] = [
                    'slot' => $wSlot,
                    'kind' => 'weapon',
                    'itemId' => $candidate,
                    'nameEn' => $spec['nameEn'],
                    'nameAr' => $spec['nameAr'],
                    'mult' => $spec['mult'],
                    'red' => null,
                    'rarity' => $spec['rarity'],
                    'perk' => $spec['perk'],
                ];
            } elseif (($inv[$candidate] ?? 0) > ($usedInvCounts[$candidate] ?? 0)) {
                if (($items[$candidate]['type'] ?? null) === 'weapon') {
                    $usedInvCounts[$candidate] = ($usedInvCounts[$candidate] ?? 0) + 1;
                    $spec = self::normalizeCatalogWeapon($candidate, $items[$candidate]);
                    $validWeaponsBySlot[$wSlot] = $spec;
                    $flatSlots[$wSlot] = $candidate;
                    $slotDetails[$wSlot] = [
                        'slot' => $wSlot,
                        'kind' => 'weapon',
                        'itemId' => $candidate,
                        'nameEn' => $spec['nameEn'],
                        'nameAr' => $spec['nameAr'],
                        'mult' => $spec['mult'],
                        'red' => null,
                        'rarity' => 'standard',
                        'perk' => null,
                    ];
                } elseif ($wSlot === 'melee' && isset(self::AUX_MELEE_ITEMS[$candidate])) {
                    $usedInvCounts[$candidate] = ($usedInvCounts[$candidate] ?? 0) + 1;
                    $mSpec = self::AUX_MELEE_ITEMS[$candidate];
                    $spec = [
                        'id' => $candidate,
                        'slot' => 'melee',
                        'mult' => (float) $mSpec['mult'],
                        'nameEn' => $mSpec['nameEn'],
                        'nameAr' => $mSpec['nameAr'],
                        'rarity' => 'standard',
                        'perk' => null,
                    ];
                    $validWeaponsBySlot[$wSlot] = $spec;
                    $flatSlots[$wSlot] = $candidate;
                    $slotDetails[$wSlot] = [
                        'slot' => $wSlot,
                        'kind' => 'weapon',
                        'itemId' => $candidate,
                        'nameEn' => $spec['nameEn'],
                        'nameAr' => $spec['nameAr'],
                        'mult' => $spec['mult'],
                        'red' => null,
                        'rarity' => 'standard',
                        'perk' => null,
                    ];
                } elseif ($wSlot === 'temporary' && isset(self::TEMPORARY_TACTICAL_ITEMS[$candidate])) {
                    $usedInvCounts[$candidate] = ($usedInvCounts[$candidate] ?? 0) + 1;
                    $tSpec = self::TEMPORARY_TACTICAL_ITEMS[$candidate];
                    $spec = [
                        'id' => $candidate,
                        'slot' => 'temporary',
                        'mult' => (float) $tSpec['mult'],
                        'nameEn' => $tSpec['nameEn'],
                        'nameAr' => $tSpec['nameAr'],
                        'rarity' => 'tactical',
                        'perk' => null,
                    ];
                    $validWeaponsBySlot[$wSlot] = $spec;
                    $flatSlots[$wSlot] = $candidate;
                    $slotDetails[$wSlot] = [
                        'slot' => $wSlot,
                        'kind' => 'weapon',
                        'itemId' => $candidate,
                        'nameEn' => $spec['nameEn'],
                        'nameAr' => $spec['nameAr'],
                        'mult' => $spec['mult'],
                        'red' => null,
                        'rarity' => 'tactical',
                        'perk' => null,
                    ];
                }
            }
        }

        foreach (self::ARMOR_SLOTS as $aSlot) {
            $candidate = isset($rawSlots[$aSlot]) && is_string($rawSlots[$aSlot]) && $rawSlots[$aSlot] !== ''
                ? $rawSlots[$aSlot]
                : null;
            if ($candidate === null) {
                continue;
            }
            if (
                isset(self::TACTICAL_ARMOR_CATALOG[$candidate])
                && self::TACTICAL_ARMOR_CATALOG[$candidate]['slot'] === $aSlot
                && (int) ($tacticalArmor[$candidate] ?? 0) > ($usedTacCounts[$candidate] ?? 0)
            ) {
                $usedTacCounts[$candidate] = ($usedTacCounts[$candidate] ?? 0) + 1;
                $spec = self::TACTICAL_ARMOR_CATALOG[$candidate];
                $validArmorsBySlot[$aSlot] = $spec;
                $flatSlots[$aSlot] = $candidate;
                $slotDetails[$aSlot] = [
                    'slot' => $aSlot,
                    'kind' => 'armor',
                    'itemId' => $candidate,
                    'nameEn' => $spec['nameEn'],
                    'nameAr' => $spec['nameAr'],
                    'mult' => null,
                    'red' => (float) $spec['red'],
                    'rarity' => 'tactical',
                    'perk' => null,
                ];
            } elseif (($inv[$candidate] ?? 0) > ($usedInvCounts[$candidate] ?? 0) && ($items[$candidate]['type'] ?? null) === 'armor') {
                $usedInvCounts[$candidate] = ($usedInvCounts[$candidate] ?? 0) + 1;
                $spec = self::normalizeCatalogArmor($candidate, $items[$candidate], $aSlot);
                $validArmorsBySlot[$aSlot] = $spec;
                $flatSlots[$aSlot] = $candidate;
                $slotDetails[$aSlot] = [
                    'slot' => $aSlot,
                    'kind' => 'armor',
                    'itemId' => $candidate,
                    'nameEn' => $spec['nameEn'],
                    'nameAr' => $spec['nameAr'],
                    'mult' => null,
                    'red' => (float) $spec['red'],
                    'rarity' => 'standard',
                    'perk' => null,
                ];
            } elseif ($aSlot === 'head' && isset(self::AUX_HEAD_ARMOR_ITEMS[$candidate]) && ($inv[$candidate] ?? 0) > ($usedInvCounts[$candidate] ?? 0)) {
                $usedInvCounts[$candidate] = ($usedInvCounts[$candidate] ?? 0) + 1;
                $hSpec = self::AUX_HEAD_ARMOR_ITEMS[$candidate];
                $spec = [
                    'id' => $candidate,
                    'slot' => 'head',
                    'red' => (float) $hSpec['red'],
                    'nameEn' => $hSpec['nameEn'],
                    'nameAr' => $hSpec['nameAr'],
                ];
                $validArmorsBySlot[$aSlot] = $spec;
                $flatSlots[$aSlot] = $candidate;
                $slotDetails[$aSlot] = [
                    'slot' => $aSlot,
                    'kind' => 'armor',
                    'itemId' => $candidate,
                    'nameEn' => $spec['nameEn'],
                    'nameAr' => $spec['nameAr'],
                    'mult' => null,
                    'red' => (float) $spec['red'],
                    'rarity' => 'standard',
                    'perk' => null,
                ];
            }
        }

        // Fall back to legacy equip / armorEquip if explicitly set outside loadoutSlots and still available.
        if ($validWeaponsBySlot === [] && $legacyWeaponId !== null && $legacyWeaponSpec !== null) {
            $targetSlot = $legacyWeaponSpec['slot'];
            $validWeaponsBySlot[$targetSlot] = $legacyWeaponSpec;
            $flatSlots[$targetSlot] = $legacyWeaponId;
            $slotDetails[$targetSlot] = [
                'slot' => $targetSlot,
                'kind' => 'weapon',
                'itemId' => $legacyWeaponId,
                'nameEn' => $legacyWeaponSpec['nameEn'],
                'nameAr' => $legacyWeaponSpec['nameAr'],
                'mult' => $legacyWeaponSpec['mult'],
                'red' => null,
                'rarity' => $legacyWeaponSpec['rarity'],
                'perk' => $legacyWeaponSpec['perk'],
            ];
        }
        if ($validArmorsBySlot === [] && $legacyArmorId !== null && $legacyArmorSpec !== null) {
            $targetArmorSlot = $legacyArmorSpec['slot'] ?? 'body';
            $validArmorsBySlot[$targetArmorSlot] = $legacyArmorSpec;
            $flatSlots[$targetArmorSlot] = $legacyArmorId;
            $slotDetails[$targetArmorSlot] = [
                'slot' => $targetArmorSlot,
                'kind' => 'armor',
                'itemId' => $legacyArmorId,
                'nameEn' => $legacyArmorSpec['nameEn'],
                'nameAr' => $legacyArmorSpec['nameAr'],
                'mult' => null,
                'red' => (float) ($legacyArmorSpec['red'] ?? 0.0),
                'rarity' => 'standard',
                'perk' => null,
            ];
        }

        $preferredSlotRaw = (string) ($state['tornCombat']['slot'] ?? 'primary');
        $preferredSlot = $preferredSlotRaw === 'temp' ? 'temporary' : $preferredSlotRaw;
        if (!in_array($preferredSlot, self::WEAPON_SLOTS, true)) {
            $preferredSlot = 'primary';
        }

        $activeWeaponSlot = 'primary';
        $activeWeapon = null;
        if (isset($validWeaponsBySlot[$preferredSlot]) && ($preferredSlot !== 'temporary' || count($validWeaponsBySlot) === 1)) {
            $activeWeaponSlot = $preferredSlot;
            $activeWeapon = $validWeaponsBySlot[$preferredSlot];
        } else {
            foreach (['primary', 'secondary', 'melee', 'temporary'] as $candidateSlot) {
                if (isset($validWeaponsBySlot[$candidateSlot])) {
                    $activeWeaponSlot = $candidateSlot;
                    $activeWeapon = $validWeaponsBySlot[$candidateSlot];
                    break;
                }
            }
        }

        $weaponId = $activeWeapon['id'] ?? null;
        $weaponMultiplier = $activeWeapon === null ? 1.0 : max(1.0, (float) $activeWeapon['mult']);

        if ($activeWeapon !== null && $activeWeaponSlot !== 'temporary' && isset($validWeaponsBySlot['temporary'])) {
            $weaponMultiplier = round($weaponMultiplier + 0.15, 2);
        }
        $backupCount = max(0, count(array_diff_key($validWeaponsBySlot, ['temporary' => true])) - 1);
        if ($activeWeapon !== null && $backupCount > 0) {
            $weaponMultiplier = round($weaponMultiplier + ($backupCount * 0.05), 2);
        }

        $weaponPerks = [];
        foreach ($validWeaponsBySlot as $wSpec) {
            if (is_array($wSpec['perk'] ?? null)) {
                $weaponPerks[] = $wSpec['perk'];
            }
        }

        $armorId = null;
        if (isset($validArmorsBySlot['body'])) {
            $armorId = (string) $validArmorsBySlot['body']['id'];
        } elseif ($validArmorsBySlot !== []) {
            $firstArmor = reset($validArmorsBySlot);
            $armorId = (string) $firstArmor['id'];
        }

        $totalArmorRed = 0.0;
        foreach ($validArmorsBySlot as $aSpec) {
            $totalArmorRed += max(0.0, (float) ($aSpec['red'] ?? 0.0));
        }
        $armorReduction = round(min(0.95, max(0.0, $totalArmorRed)), 4);

        return [
            'weaponId' => $weaponId,
            'armorId' => $armorId,
            'weaponMultiplier' => $weaponMultiplier,
            'armorReduction' => $armorReduction,
            'weaponBonusPct' => (int) round(($weaponMultiplier - 1.0) * 100),
            'armorMitigationPct' => (int) round($armorReduction * 100),
            'slots' => $flatSlots,
            'loadoutSlots' => $flatSlots,
            'slotDetails' => $slotDetails,
            'equippedSlotsCount' => count($validWeaponsBySlot) + count($validArmorsBySlot),
            'activeWeaponSlot' => $activeWeaponSlot,
            'weaponPerks' => $weaponPerks,
            'perkModifiers' => self::computePerkModifiers($weaponPerks),
        ];
    }

    public static function equipSlot(array &$state, array $items, string $slot, ?string $itemId): array
    {
        $cleanSlot = strtolower(trim($slot));
        if ($cleanSlot === 'temp') {
            $cleanSlot = 'temporary';
        }
        if (!in_array($cleanSlot, self::ALL_SLOTS, true)) {
            throw new InvalidArgumentException('Invalid loadout slot: ' . $slot);
        }

        $inv = is_array($state['inv'] ?? null) ? $state['inv'] : [];
        $rwWeapons = is_array($state['rwWeapons'] ?? null) ? $state['rwWeapons'] : [];
        $tacticalArmor = is_array($state['tacticalArmor'] ?? null) ? $state['tacticalArmor'] : [];

        if (!isset($state['loadoutSlots']) || !is_array($state['loadoutSlots'])) {
            $state['loadoutSlots'] = array_fill_keys(self::ALL_SLOTS, null);
            $existingWeapon = is_string($state['equip'] ?? null) ? $state['equip'] : null;
            if ($existingWeapon !== null && $existingWeapon !== 'fists') {
                if (isset($rwWeapons[$existingWeapon])) {
                    $wSlot = self::naturalWeaponSlot($existingWeapon, $rwWeapons[$existingWeapon]);
                    $state['loadoutSlots'][$wSlot] = $existingWeapon;
                } elseif (($inv[$existingWeapon] ?? 0) >= 1 && ($items[$existingWeapon]['type'] ?? null) === 'weapon') {
                    $wSlot = self::naturalWeaponSlot($existingWeapon, $items[$existingWeapon]);
                    $state['loadoutSlots'][$wSlot] = $existingWeapon;
                }
            }
            $existingArmor = is_string($state['armorEquip'] ?? null) ? $state['armorEquip'] : null;
            if ($existingArmor !== null) {
                if (isset(self::TACTICAL_ARMOR_CATALOG[$existingArmor]) && (int) ($tacticalArmor[$existingArmor] ?? 0) >= 1) {
                    $aSlot = self::TACTICAL_ARMOR_CATALOG[$existingArmor]['slot'];
                    $state['loadoutSlots'][$aSlot] = $existingArmor;
                } elseif (($inv[$existingArmor] ?? 0) >= 1 && ($items[$existingArmor]['type'] ?? null) === 'armor') {
                    $state['loadoutSlots']['body'] = $existingArmor;
                }
            }
        } else {
            foreach (self::ALL_SLOTS as $s) {
                $state['loadoutSlots'][$s] ??= null;
            }
        }

        $cleanItem = $itemId === null ? '' : trim($itemId);
        if (in_array(strtolower($cleanItem), ['', 'none', 'null', 'unequip', 'fists'], true)) {
            $prev = $state['loadoutSlots'][$cleanSlot] ?? null;
            $state['loadoutSlots'][$cleanSlot] = null;
            self::syncLegacyPointers($state, $items, $prev);
            return self::resolve($state, $items);
        }

        $isWeaponSlot = in_array($cleanSlot, self::WEAPON_SLOTS, true);
        if ($isWeaponSlot) {
            if (isset($rwWeapons[$cleanItem]) && is_array($rwWeapons[$cleanItem])) {
                if ($cleanSlot === 'temporary') {
                    throw new InvalidArgumentException('Ranked War bonus weapons cannot be placed in the temporary grenade slot.');
                }
                foreach (self::WEAPON_SLOTS as $otherSlot) {
                    if ($otherSlot !== $cleanSlot && ($state['loadoutSlots'][$otherSlot] ?? null) === $cleanItem) {
                        $state['loadoutSlots'][$otherSlot] = null;
                    }
                }
                $state['loadoutSlots'][$cleanSlot] = $cleanItem;
            } elseif (isset($items[$cleanItem])) {
                $ownedQty = (int) ($inv[$cleanItem] ?? 0);
                if ($ownedQty < 1) {
                    throw new RuntimeException('You do not own this item.');
                }
                $type = (string) ($items[$cleanItem]['type'] ?? '');
                if ($cleanSlot === 'temporary') {
                    if ($type !== 'weapon' && !isset(self::TEMPORARY_TACTICAL_ITEMS[$cleanItem])) {
                        throw new InvalidArgumentException('Only tactical grenades or weapons can be equipped in the temporary slot.');
                    }
                } elseif ($cleanSlot === 'melee') {
                    if ($type !== 'weapon' && !isset(self::AUX_MELEE_ITEMS[$cleanItem])) {
                        throw new InvalidArgumentException('Only owned melee weapons or blades can be equipped in the melee slot.');
                    }
                } elseif ($type !== 'weapon') {
                    throw new InvalidArgumentException('Only owned weapons can be equipped in weapon slots.');
                }
                self::dedupeIfOverOwned($state['loadoutSlots'], self::WEAPON_SLOTS, $cleanSlot, $cleanItem, $ownedQty);
                $state['loadoutSlots'][$cleanSlot] = $cleanItem;
            } else {
                throw new InvalidArgumentException('Unknown weapon or tactical item: ' . $cleanItem);
            }
        } else {
            // Armor slot: head, body, hands, legs, feet
            if (isset(self::TACTICAL_ARMOR_CATALOG[$cleanItem])) {
                $spec = self::TACTICAL_ARMOR_CATALOG[$cleanItem];
                if ($spec['slot'] !== $cleanSlot) {
                    throw new InvalidArgumentException(sprintf('%s belongs in the %s armor slot.', $spec['nameEn'], $spec['slot']));
                }
                if ((int) ($tacticalArmor[$cleanItem] ?? 0) < 1) {
                    throw new RuntimeException('You do not own ' . $spec['nameEn'] . '.');
                }
                $state['loadoutSlots'][$cleanSlot] = $cleanItem;
            } elseif (isset($items[$cleanItem])) {
                $ownedQty = (int) ($inv[$cleanItem] ?? 0);
                if ($ownedQty < 1) {
                    throw new RuntimeException('You do not own this armor item.');
                }
                if (($items[$cleanItem]['type'] ?? null) !== 'armor' && !($cleanSlot === 'head' && isset(self::AUX_HEAD_ARMOR_ITEMS[$cleanItem]))) {
                    throw new InvalidArgumentException('Only armor items can be equipped in armor slots.');
                }
                self::dedupeIfOverOwned($state['loadoutSlots'], self::ARMOR_SLOTS, $cleanSlot, $cleanItem, $ownedQty);
                $state['loadoutSlots'][$cleanSlot] = $cleanItem;
            } else {
                throw new InvalidArgumentException('Unknown armor item: ' . $cleanItem);
            }
        }

        self::syncLegacyPointers($state, $items, null);
        return self::resolve($state, $items);
    }

    public static function removeMissing(array &$state, string $id): void
    {
        $ownedInv = max(0, (int) ($state['inv'][$id] ?? 0));
        $ownedTac = max(0, (int) ($state['tacticalArmor'][$id] ?? 0));
        $ownedRw = isset($state['rwWeapons'][$id]) && is_array($state['rwWeapons'][$id]) ? 1 : 0;
        $maxAllowed = max($ownedInv, $ownedTac, $ownedRw);

        if ($maxAllowed <= 0) {
            if (($state['equip'] ?? null) === $id) {
                $state['equip'] = null;
            }
            if (($state['armorEquip'] ?? null) === $id) {
                $state['armorEquip'] = null;
            }
        }

        if (isset($state['loadoutSlots']) && is_array($state['loadoutSlots'])) {
            $seen = 0;
            foreach (self::ALL_SLOTS as $slot) {
                if (($state['loadoutSlots'][$slot] ?? null) === $id) {
                    $seen++;
                    if ($seen > $maxAllowed) {
                        $state['loadoutSlots'][$slot] = null;
                    }
                }
            }
        }
    }

    public static function equippedSlotCount(array $state, array $items): int
    {
        $resolved = self::resolve($state, $items);
        $legacyCount = (int) ($resolved['weaponId'] !== null) + (int) ($resolved['armorId'] !== null);
        return max($legacyCount, (int) ($resolved['equippedSlotsCount'] ?? 0));
    }

    private static function syncLegacyPointers(array &$state, array $items, ?string $clearedItem): void
    {
        $resolved = self::resolve($state, $items);
        $state['equip'] = $resolved['weaponId'];
        $state['armorEquip'] = $resolved['armorId'];
        if ($clearedItem !== null && $resolved['weaponId'] === null && ($state['equip'] ?? null) === $clearedItem) {
            $state['equip'] = null;
        }
        if ($clearedItem !== null && $resolved['armorId'] === null && ($state['armorEquip'] ?? null) === $clearedItem) {
            $state['armorEquip'] = null;
        }
    }

    /**
     * @param array<string, mixed> $slots
     * @param list<string> $groupSlots
     */
    private static function dedupeIfOverOwned(array &$slots, array $groupSlots, string $targetSlot, string $itemId, int $ownedQty): void
    {
        $otherSlotsWithItem = [];
        foreach ($groupSlots as $s) {
            if ($s !== $targetSlot && ($slots[$s] ?? null) === $itemId) {
                $otherSlotsWithItem[] = $s;
            }
        }
        while (count($otherSlotsWithItem) >= $ownedQty) {
            $evict = array_pop($otherSlotsWithItem);
            if ($evict !== null) {
                $slots[$evict] = null;
            }
        }
    }

    private static function normalizeCatalogWeapon(string $id, array $def): array
    {
        $nameEn = is_array($def['name'] ?? null) ? (string) ($def['name']['en'] ?? $id) : ucfirst(str_replace('_', ' ', $id));
        $nameAr = is_array($def['name'] ?? null) ? (string) ($def['name']['ar'] ?? $nameEn) : $nameEn;
        return [
            'id' => $id,
            'slot' => self::naturalWeaponSlot($id, $def),
            'mult' => max(1.0, (float) ($def['mult'] ?? 1.0)),
            'nameEn' => $nameEn,
            'nameAr' => $nameAr,
            'rarity' => 'standard',
            'perk' => null,
        ];
    }

    private static function normalizeRwWeapon(string $id, array $rw): array
    {
        $perkKey = (string) ($rw['perk'] ?? 'warlord');
        $perkValue = (int) ($rw['perkValuePct'] ?? 20);
        return [
            'id' => $id,
            'slot' => self::naturalWeaponSlot((string) ($rw['baseItemId'] ?? $id), $rw),
            'mult' => max(1.0, (float) ($rw['mult'] ?? 3.5)),
            'nameEn' => (string) ($rw['nameEn'] ?? 'Ranked War Bonus Weapon'),
            'nameAr' => (string) ($rw['nameAr'] ?? 'سلاح حرب مصنف إضافي'),
            'rarity' => (string) ($rw['rarity'] ?? 'yellow'),
            'perk' => [
                'id' => $perkKey,
                'valuePct' => $perkValue,
                'labelEn' => (string) ($rw['perkLabelEn'] ?? ucfirst($perkKey) . ' +' . $perkValue . '%'),
                'labelAr' => (string) ($rw['perkLabelAr'] ?? $perkKey . ' +' . $perkValue . '%'),
            ],
        ];
    }

    private static function normalizeCatalogArmor(string $id, array $def, string $slot): array
    {
        $nameEn = is_array($def['name'] ?? null) ? (string) ($def['name']['en'] ?? $id) : ucfirst(str_replace('_', ' ', $id));
        $nameAr = is_array($def['name'] ?? null) ? (string) ($def['name']['ar'] ?? $nameEn) : $nameEn;
        return [
            'id' => $id,
            'slot' => $slot,
            'red' => min(0.95, max(0.0, (float) ($def['red'] ?? 0.0))),
            'nameEn' => $nameEn,
            'nameAr' => $nameAr,
        ];
    }

    /**
     * @param list<array<string, mixed>> $perks
     * @return array<string, int>
     */
    private static function computePerkModifiers(array $perks): array
    {
        $mods = [
            'plunderPct' => 0,
            'warlordRespectPct' => 0,
            'executeHpPct' => 0,
            'bloodlustHealPct' => 0,
        ];
        foreach ($perks as $perk) {
            $id = (string) ($perk['id'] ?? '');
            $val = max(0, (int) ($perk['valuePct'] ?? 0));
            if ($id === 'plunder') {
                $mods['plunderPct'] = max($mods['plunderPct'], $val);
            } elseif ($id === 'warlord') {
                $mods['warlordRespectPct'] = max($mods['warlordRespectPct'], $val);
            } elseif ($id === 'execute') {
                $mods['executeHpPct'] = max($mods['executeHpPct'], $val);
            } elseif ($id === 'bloodlust') {
                $mods['bloodlustHealPct'] = max($mods['bloodlustHealPct'], $val);
            }
        }
        return $mods;
    }
}
