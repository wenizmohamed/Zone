<?php
declare(strict_types=1);
namespace Zone\Engine\Core\Content;

use InvalidArgumentException;

/** Data-only definitions understood by the existing gameplay services. */
final class GameplayDefinitionValidator
{
    public static function schema(): array
    {
        $int = static fn (int $min, int $max): array => ['type' => 'integer', 'min' => $min, 'max' => $max];
        $money = $int(0, 2_000_000_000);
        $enum = static fn (array $values): array => ['type' => 'enum', 'values' => $values, 'editable' => false];
        $definitions = [
            'items' => ['key', ['type' => $enum(['weapon', 'armor', 'medical', 'booster', 'material']), 'price' => $money, 'mult' => ['type' => 'number', 'min' => .1, 'max' => 20], 'red' => ['type' => 'number', 'min' => 0, 'max' => .8], 'life' => $int(0, 100000), 'nerve' => $int(0, 1000)], ['type', 'price']],
            'jobs' => ['id', ['pay' => $money, 'energy' => $int(1, 1000), 'lvl' => $int(1, 100)], ['pay', 'energy', 'lvl']],
            'gyms' => ['index', ['e' => $int(1, 1000), 'xp' => $int(0, 1000000000), 'cost' => $money], ['e', 'xp', 'cost']],
            'courses' => ['id', ['cost' => $money, 'mins' => $int(1, 525600)], ['cost', 'mins']],
            'properties' => ['id', ['price' => $money, 'happy' => $int(1, 100000), 'upkeep' => $money], ['price', 'happy']],
            'upgrades' => ['id', ['cost' => $int(0, 1000000000)], ['cost']],
            'opponents' => ['id', ['lvl' => $int(1, 100), 'str' => $int(1, 1000000000), 'def' => $int(1, 1000000000), 'spd' => $int(1, 1000000000), 'dex' => $int(1, 1000000000), 'life' => $int(1, 1000000), 'cash' => $money], ['lvl', 'str', 'def', 'spd', 'dex', 'life', 'cash']],
            'missions' => ['id', ['ctr' => $enum(['crimes', 'trains', 'wins', 'shifts', 'buys']), 'n' => $int(1, 1000000), 'cash' => $money, 'pts' => $int(0, 1000000)], ['ctr', 'n', 'cash', 'pts']],
        ];
        $result = [];
        foreach ($definitions as $category => [$idField, $fields, $required]) {
            $result[$category] = ['idField' => $idField, 'creatable' => !in_array($category, ['gyms', 'upgrades'], true), 'required' => [...$required, 'name'], 'fields' => [...$fields,
                'name' => ['type' => 'bilingual', 'maxLength' => 120, 'optional' => true],
                'description' => ['type' => 'bilingual', 'maxLength' => 360, 'optional' => true, 'allowEmpty' => true],
                'image' => ['type' => 'asset', 'maxLength' => 240, 'optional' => true],
            ]];
        }
        $result['items']['variants'] = ['weapon' => ['price', 'mult'], 'armor' => ['price', 'red'], 'medical' => ['price', 'life', 'nerve'], 'booster' => ['price', 'life', 'nerve'], 'material' => ['price']];
        $result['items']['createTypes'] = ['weapon', 'medical', 'booster', 'material'];
        $baseCatalog = json_decode((string) file_get_contents(ZONE_ENGINE_ROOT . '/data/gameplay-catalog.json'), true, 64, JSON_THROW_ON_ERROR);
        $result['items']['fields']['model'] = ['type' => 'enum', 'optional' => true, 'values' => ['', ...array_keys(array_filter($baseCatalog['items'], static fn (array $item): bool => $item['type'] === 'weapon'))]];
        return $result;
    }

    public static function identifier(string $id): void
    {
        if (!preg_match('/^[a-z][a-z0-9_-]{1,63}$/D', $id) || in_array($id, ['constructor', 'prototype', 'fists'], true)) {
            throw new InvalidArgumentException('New ID must contain 2 to 64 lowercase letters, digits, underscores or hyphens, starting with a letter, and must not be reserved.');
        }
    }

    public static function catalog(array $catalog): array
    {
        $schema = self::schema();
        if (array_diff(array_keys($catalog), [...array_keys($schema), 'market'])) throw new InvalidArgumentException('Unknown gameplay catalog collection.');
        foreach ($schema as $category => $rules) {
            $rows = $catalog[$category] ?? null;
            if (!is_array($rows) || count($rows) > 1000 || ($rules['idField'] !== 'key' && !array_is_list($rows))) throw new InvalidArgumentException('Invalid gameplay catalog collection: ' . $category);
            $seen = [];
            foreach ($rows as $key => $entry) {
                if (!is_array($entry)) throw new InvalidArgumentException('Catalog entry must be a field object.');
                $id = $rules['idField'] === 'key' ? $key : ($rules['idField'] === 'id' ? ($entry['id'] ?? null) : (string) $key);
                if (!is_string($id) || !preg_match('/^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/D', $id) || in_array($id, ['constructor', 'prototype', 'fists'], true) || isset($seen[$id])) throw new InvalidArgumentException('Invalid or duplicate gameplay catalog ID.');
                $seen[$id] = true;
                self::definition($category, $entry);
            }
        }
        if (!is_array($catalog['market'] ?? null) || !array_is_list($catalog['market']) || count($catalog['market']) > 1000) throw new InvalidArgumentException('Invalid market catalog.');
        foreach ($catalog['market'] as $listing) {
            if (!is_array($listing) || array_diff(array_keys($listing), ['item', 'qty', 'seller']) || !isset($catalog['items'][$listing['item'] ?? '']) || !is_int($listing['qty'] ?? null) || $listing['qty'] < 0 || $listing['qty'] > 100000 || !is_string($listing['seller'] ?? null) || strlen($listing['seller']) > 160 || preg_match('/[<>\x00-\x1F\x7F]/u', $listing['seller'])) throw new InvalidArgumentException('Invalid market listing.');
        }
        return $catalog;
    }

    public static function definition(string $category, array $definition, bool $creating = false): array
    {
        $schema = self::schema()[$category] ?? throw new InvalidArgumentException('Unknown editable catalog category.');
        if ($creating && !$schema['creatable']) throw new InvalidArgumentException('This category supports balance edits of existing definitions only.');
        if ($definition === [] || array_is_list($definition)) throw new InvalidArgumentException('Definition must be a nonempty field object.');
        $normalized = [];
        foreach ($definition as $field => $value) {
            if ($field === 'id' && !$creating && $schema['idField'] === 'id') { $normalized[$field] = $value; continue; }
            $rule = $schema['fields'][$field] ?? throw new InvalidArgumentException('Unknown definition field: ' . $field);
            $normalized[$field] = self::value($field, $value, $rule);
        }
        foreach ($schema['required'] as $field) {
            if ($field === 'name' && !$creating) continue;
            if (!array_key_exists($field, $normalized)) throw new InvalidArgumentException('Missing required definition field: ' . $field);
        }
        if ($category === 'items') {
            if ($creating && !in_array($normalized['type'], $schema['createTypes'], true)) throw new InvalidArgumentException('New armor is not supported by the current combat rules.');
            $allowed = [...$schema['variants'][$normalized['type']], 'type', 'name', 'description', 'image', ...($normalized['type'] === 'weapon' ? ['model'] : [])];
            if (array_diff(array_keys($normalized), $allowed)) throw new InvalidArgumentException('Item fields do not apply to its type.');
            foreach (match ($normalized['type']) { 'weapon' => ['mult'], 'armor' => ['red'], default => [] } as $field) {
                if (!isset($normalized[$field])) throw new InvalidArgumentException('Missing required item field: ' . $field);
            }
            if (in_array($normalized['type'], ['medical', 'booster'], true) && ($normalized['life'] ?? 0) + ($normalized['nerve'] ?? 0) < 1) throw new InvalidArgumentException('Consumable items must restore life or nerve.');
            if ($creating && $normalized['price'] < 1) throw new InvalidArgumentException('New item price must be positive.');
        }
        return $normalized;
    }

    public static function value(string $field, mixed $value, array $rule): mixed
    {
        if ($rule['type'] === 'bilingual') {
            if (!is_array($value) || array_diff(array_keys($value), ['en', 'ar']) !== []) throw new InvalidArgumentException($field . ' must contain English and Arabic text.');
            foreach (['en', 'ar'] as $language) {
                $text = $value[$language] ?? null;
                if (!is_string($text) || preg_match('//u', $text) !== 1 || (!(($rule['allowEmpty'] ?? false)) && trim($text) === '') || preg_match('/[<>\x00-\x1F\x7F]/u', $text) || preg_match_all('/./us', $text) > $rule['maxLength']) throw new InvalidArgumentException($field . ' must be plain text, up to ' . $rule['maxLength'] . ' characters per language.');
                $value[$language] = trim($text);
            }
            return $value;
        }
        if ($rule['type'] === 'enum') {
            if (!is_string($value) || !in_array($value, $rule['values'], true)) throw new InvalidArgumentException('Unknown ' . $field . ' value.');
            return $value;
        }
        if ($rule['type'] === 'asset') {
            if ($value === '') return '';
            if (!is_string($value) || strlen($value) > 240 || !preg_match('#^(?:art|assets)/[A-Za-z0-9_/-]+\.(?:png|jpg|jpeg|webp)$#D', $value)) throw new InvalidArgumentException('Image must reference an existing local art or assets image.');
            if (getenv('VERCEL') === '1') {
                PackagedAssets::assertImage($value);
                return $value;
            }
            $root = realpath(ZONE_REPOSITORY_ROOT);
            $path = realpath(ZONE_REPOSITORY_ROOT . '/' . $value);
            if ($path === false || $root === false || !str_starts_with(str_replace('\\', '/', $path), str_replace('\\', '/', $root) . '/') || !is_file($path) || filesize($path) < 1) throw new InvalidArgumentException('Image asset does not exist in this game.');
            return $value;
        }
        $numeric = $rule['type'] === 'integer' ? is_int($value) : (is_int($value) || is_float($value));
        if (!$numeric || !is_finite((float) $value) || $value < $rule['min'] || $value > $rule['max']) throw new InvalidArgumentException($field . ' must be a ' . $rule['type'] . ' between ' . $rule['min'] . ' and ' . $rule['max'] . '.');
        return $value;
    }
}
