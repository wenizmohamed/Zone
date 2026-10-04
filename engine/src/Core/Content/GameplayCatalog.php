<?php
declare(strict_types=1);
namespace Zone\Engine\Core\Content;

use InvalidArgumentException;
use RuntimeException;
use Zone\Engine\Core\Events\DomainEvent;
use Zone\Engine\Core\Events\EventBus;
use Zone\Engine\Core\Persistence\Database;
use Zone\Engine\Core\Publishing\ReleaseManager;

/** Bounded edits of existing gameplay definitions, staged until publication. */
final class GameplayCatalog
{
    public function __construct(private readonly Database $database, private readonly EventBus $events) {}

    private function initialize(): void
    {
        $columns = ['channel', 'catalog_json', 'revision', 'updated_by', 'updated_at'];
        $foundation = $this->database->fetchOne("SELECT catalog_json FROM gameplay_catalogs WHERE channel = 'foundation'");
        if ($foundation === null) {
            $seed = (string) file_get_contents(ZONE_ENGINE_ROOT . '/data/gameplay-catalog.json');
            json_decode($seed, true, 64, JSON_THROW_ON_ERROR);
            $this->database->insertIgnore('gameplay_catalogs', $columns, ['foundation', $seed, 1, 'system', gmdate('c')]);
            $foundation = $this->database->fetchOne("SELECT catalog_json FROM gameplay_catalogs WHERE channel = 'foundation'");
        }
        $this->database->insertIgnore('gameplay_catalogs', $columns, ['draft', $foundation['catalog_json'], 1, 'system', gmdate('c')]);
    }

    public function foundation(): array
    {
        $this->initialize();
        $row = $this->database->fetchOne("SELECT catalog_json FROM gameplay_catalogs WHERE channel = 'foundation'");
        return json_decode((string) $row['catalog_json'], true, 64, JSON_THROW_ON_ERROR);
    }

    public function active(): array
    {
        $this->initialize();
        $row = $this->database->fetchOne('SELECT manifest_json FROM content_releases WHERE active = 1 LIMIT 1');
        $manifest = $row === null ? [] : json_decode((string) $row['manifest_json'], true, 64, JSON_THROW_ON_ERROR);
        return $manifest['content']['gameplayCatalog'] ?? $this->foundation();
    }

    public function draft(): array
    {
        $this->initialize();
        $row = $this->database->fetchOne("SELECT * FROM gameplay_catalogs WHERE channel = 'draft'");
        return ['catalogs' => json_decode((string) $row['catalog_json'], true, 64, JSON_THROW_ON_ERROR), 'revision' => (int) $row['revision'],
            'updatedBy' => $row['updated_by'], 'updatedAt' => $row['updated_at'], 'schema' => self::schema()];
    }

    public function update(string $category, string $id, array $changes, int $expectedRevision, string $actor): array
    {
        if ($expectedRevision < 1 || trim($actor) === '' || strlen($actor) > 160) throw new InvalidArgumentException('A current catalog revision and valid actor are required.');
        return (new ReleaseManager($this->database, $this->events))->configurationTransaction(function () use ($category, $id, $changes, $expectedRevision, $actor): array {
            $draft = $this->draft();
            if ($draft['revision'] !== $expectedRevision) throw new RuntimeException('Gameplay catalog changed. Refresh and try again.');
            $schema = self::schema()[$category] ?? throw new InvalidArgumentException('Unknown editable catalog category.');
            $rows = $draft['catalogs'][$category];
            $key = $schema['idField'] === 'key' ? $id : ($schema['idField'] === 'index' ? (ctype_digit($id) ? (int) $id : -1) : array_search($id, array_column($rows, 'id'), true));
            if ($key === false || !isset($rows[$key])) throw new InvalidArgumentException('Unknown catalog entry. Existing IDs cannot be added or renamed.');
            if ($changes === [] || array_is_list($changes)) throw new InvalidArgumentException('Catalog changes must be a nonempty field object.');
            $previous = $rows[$key];
            foreach ($changes as $field => $value) {
                $rule = $schema['fields'][$field] ?? throw new InvalidArgumentException('Catalog field is not editable: ' . $field);
                if ($field !== 'name' && !array_key_exists($field, $previous)) throw new InvalidArgumentException('This field does not apply to the selected entry.');
                $rows[$key][$field] = $this->validateValue($field, $value, $rule);
            }
            $draft['catalogs'][$category] = $rows;
            $correlation = bin2hex(random_bytes(16));
            $now = gmdate('c');
            $this->database->execute("UPDATE gameplay_catalogs SET catalog_json = :catalog, revision = revision + 1, updated_by = :actor, updated_at = :at WHERE channel = 'draft'", ['catalog' => json_encode($draft['catalogs'], JSON_THROW_ON_ERROR), 'actor' => $actor, 'at' => $now]);
            $this->database->execute('INSERT INTO admin_audit_log (id, actor, action, target_type, target_id, previous_json, next_json, correlation_id, created_at) VALUES (:id, :actor, :action, :type, :target, :previous, :next, :correlation, :at)',
                ['id' => bin2hex(random_bytes(16)), 'actor' => $actor, 'action' => 'GameplayCatalogUpdated', 'type' => 'gameplay-catalog', 'target' => $category . ':' . $id, 'previous' => json_encode($previous, JSON_THROW_ON_ERROR), 'next' => json_encode($rows[$key], JSON_THROW_ON_ERROR), 'correlation' => $correlation, 'at' => $now]);
            $this->events->publish(new DomainEvent('GameplayCatalogUpdated', ['category' => $category, 'id' => $id, 'revision' => $draft['revision'] + 1, 'actor' => $actor, 'correlationId' => $correlation]));
            return $this->draft();
        });
    }

    private function validateValue(string $field, mixed $value, array $rule): mixed
    {
        if ($rule['type'] === 'bilingual') {
            if (!is_array($value) || array_diff(array_keys($value), ['en', 'ar']) !== []) throw new InvalidArgumentException('Name must contain English and Arabic text.');
            foreach (['en', 'ar'] as $language) {
                $text = $value[$language] ?? null;
                if (!is_string($text) || trim($text) === '' || preg_match('/[<>\x00-\x1F\x7F]/u', $text) || preg_match_all('/./us', $text) > $rule['maxLength']) throw new InvalidArgumentException('Name must contain 1 to 120 plain-text characters per language.');
                $value[$language] = trim($text);
            }
            return $value;
        }
        $numeric = $rule['type'] === 'integer' ? is_int($value) : (is_int($value) || is_float($value));
        if (!$numeric || !is_finite((float) $value) || $value < $rule['min'] || $value > $rule['max']) throw new InvalidArgumentException($field . ' must be a ' . $rule['type'] . ' between ' . $rule['min'] . ' and ' . $rule['max'] . '.');
        return $value;
    }

    public static function schema(): array
    {
        $int = static fn (int $min, int $max): array => ['type' => 'integer', 'min' => $min, 'max' => $max];
        $money = $int(0, 2_000_000_000);
        $name = ['type' => 'bilingual', 'maxLength' => 120, 'optional' => true];
        $definitions = [
            'items' => ['key', ['price' => $money, 'mult' => ['type' => 'number', 'min' => .1, 'max' => 20], 'red' => ['type' => 'number', 'min' => 0, 'max' => .8], 'life' => $int(0, 100000), 'nerve' => $int(0, 1000)]],
            'jobs' => ['id', ['pay' => $money, 'energy' => $int(1, 1000), 'lvl' => $int(1, 100)]],
            'gyms' => ['index', ['e' => $int(1, 1000), 'xp' => $int(0, 1000000000), 'cost' => $money]],
            'courses' => ['id', ['cost' => $money, 'mins' => $int(1, 525600)]],
            'properties' => ['id', ['price' => $money, 'happy' => $int(1, 100000)]],
            'upgrades' => ['id', ['cost' => $int(0, 1000000000)]],
            'opponents' => ['id', ['lvl' => $int(1, 100), 'str' => $int(1, 1000000000), 'def' => $int(1, 1000000000), 'spd' => $int(1, 1000000000), 'dex' => $int(1, 1000000000), 'life' => $int(1, 1000000), 'cash' => $money]],
            'missions' => ['id', ['n' => $int(1, 1000000), 'cash' => $money, 'pts' => $int(0, 1000000)]],
        ];
        $result = [];
        foreach ($definitions as $category => [$idField, $fields]) $result[$category] = ['idField' => $idField, 'fields' => [...$fields, 'name' => $name]];
        return $result;
    }
}
