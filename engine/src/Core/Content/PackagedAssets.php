<?php
declare(strict_types=1);
namespace Zone\Engine\Core\Content;

use InvalidArgumentException;

/** Static assets are on Vercel's CDN, not inside its PHP function bundle. */
final class PackagedAssets
{
    public static function assertImage(string $path, ?string $inventoryPath = null): void
    {
        $inventoryPath ??= ZONE_ENGINE_ROOT . '/config/image-assets.json';
        if (!is_file($inventoryPath)) throw new InvalidArgumentException('The shipped image inventory is unavailable. Rebuild this release.');
        try { $inventory = json_decode((string) file_get_contents($inventoryPath), true, 16, JSON_THROW_ON_ERROR); }
        catch (\JsonException) { throw new InvalidArgumentException('The shipped image inventory is invalid. Rebuild this release.'); }
        if (($inventory['schemaVersion'] ?? null) !== 1 || !is_int($inventory['images'][$path] ?? null) || $inventory['images'][$path] < 1) throw new InvalidArgumentException('Image asset does not exist in this game.');
    }
}
