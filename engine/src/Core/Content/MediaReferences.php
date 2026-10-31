<?php
declare(strict_types=1);
namespace Zone\Engine\Core\Content;

use InvalidArgumentException;
use Zone\Engine\Core\Media\AssetLibrary;
use Zone\Engine\Core\Persistence\Database;

/** Published media is an immutable snapshot of metadata over immutable bytes. */
final class MediaReferences
{
    public static function assertDefinition(Database $database, string $category, array $definition): void
    {
        $id = $definition['mediaAsset'] ?? '';
        if ($id === '') return;
        $asset = (new AssetLibrary($database))->get($id);
        if (($asset['status'] ?? '') !== 'ready') throw new InvalidArgumentException('Uploaded media is not ready. Wait for the Studio worker and inspect any reported error.');
        if ($category === 'properties' && ($asset['kind'] ?? '') !== 'model') throw new InvalidArgumentException('A property interior must use a ready 3D model.');
        if ($category === 'items' && !in_array($asset['kind'] ?? '', ['model', 'image'], true)) throw new InvalidArgumentException('An item needs a model or image asset.');
    }

    public static function capture(Database $database, array $manifest): array
    {
        $library = new AssetLibrary($database); $ids = [];
        $catalog = $manifest['content']['gameplayCatalog'] ?? [];
        foreach (['items', 'properties'] as $category) foreach ($catalog[$category] ?? [] as $entry) {
            self::assertDefinition($database, $category, $entry);
            if (($entry['mediaAsset'] ?? '') !== '') $ids[$entry['mediaAsset']] = true;
        }
        $bindings = array_key_exists('mediaBindings', $manifest) ? $manifest['mediaBindings'] : [];
        if (!is_array($bindings) || !array_is_list($bindings) || count($bindings) > 256) throw new InvalidArgumentException('Media bindings must be a list of up to 256 entries.');
        $seen = [];
        foreach ($bindings as $binding) {
            if (!is_array($binding) || array_diff(array_keys($binding), ['targetType', 'targetId', 'assetId'])) throw new InvalidArgumentException('Invalid media binding fields.');
            $type = $binding['targetType'] ?? ''; $target = $binding['targetId'] ?? ''; $id = $binding['assetId'] ?? '';
            if (!in_array($type, ['property', 'item', 'weapon', 'armor', 'character', 'map'], true) || !is_string($target) || !preg_match('/^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/D', $target) || !is_string($id) || !preg_match('/^[a-f0-9]{64}$/D', $id) || isset($seen[$type . ':' . $target])) throw new InvalidArgumentException('Invalid or duplicate media binding.');
            if ($type === 'property' && !in_array($target, array_column($catalog['properties'] ?? [], 'id'), true)) throw new InvalidArgumentException('Media binding property does not exist.');
            if ($type === 'character' && !in_array($target, ['suit', 'street', 'tactical'], true)) throw new InvalidArgumentException('Media binding character outfit does not exist.');
            if ($type === 'map' && !in_array($target, ['bank', 'gym', 'alley', 'hospital', 'jail', 'market', 'shop', 'home', 'hq', 'jobs', 'school', 'casino', 'missions', 'arena', 'news', 'hof', 'pier'], true)) throw new InvalidArgumentException('Media binding map service does not exist.');
            if (in_array($type, ['item', 'weapon', 'armor'], true) && !isset($catalog['items'][$target])) throw new InvalidArgumentException('Media binding item does not exist.');
            if (in_array($type, ['weapon', 'armor'], true) && $catalog['items'][$target]['type'] !== $type) throw new InvalidArgumentException('Media binding item type does not match.');
            $asset = $library->get($id);
            unset($asset['metadata']['thumbnail']);
            if (($asset['status'] ?? '') !== 'ready' || ($type === 'item' ? !in_array($asset['kind'] ?? '', ['model', 'image'], true) : ($asset['kind'] ?? '') !== 'model')) throw new InvalidArgumentException('Media binding needs a ready compatible model or item image.');
            $ids[$id] = true; $seen[$type . ':' . $target] = true;
        }
        $result = [];
        foreach (array_keys($ids) as $id) {
            $asset = $library->get($id);
            unset($asset['metadata']['thumbnail']);
            $result[$id] = array_intersect_key($asset, array_flip(['id', 'name', 'status', 'kind', 'format', 'entry', 'members', 'metadata', 'transform', 'size']));
        }
        return $result;
    }

    public static function summarizeManifestBindings(array $manifest): array
    {
        $bindings = is_array($manifest['mediaBindings'] ?? null) ? $manifest['mediaBindings'] : [];
        $byType = [];
        foreach ($bindings as $binding) {
            if (is_array($binding) && is_string($binding['targetType'] ?? null)) {
                $t = $binding['targetType'];
                $byType[$t] = ($byType[$t] ?? 0) + 1;
            }
        }
        return [
            'bindingCount' => count($bindings),
            'byTargetType' => $byType,
        ];
    }

    /** @return list<string> */
    public static function supportedTargetTypes(): array
    {
        return ['property', 'item', 'weapon', 'armor', 'character', 'map'];
    }
}
