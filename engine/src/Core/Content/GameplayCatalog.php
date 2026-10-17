<?php
declare(strict_types=1);
namespace Zone\Engine\Core\Content;

use InvalidArgumentException;
use RuntimeException;
use Zone\Engine\Core\Events\DomainEvent;
use Zone\Engine\Core\Events\EventBus;
use Zone\Engine\Core\Persistence\Database;
use Zone\Engine\Core\Publishing\ReleaseManager;

/** Typed gameplay authoring, staged until publication. */
final class GameplayCatalog
{
    public function __construct(private readonly Database $database, private readonly EventBus $events) {}

    private function initialize(): void
    {
        // Established reads need no seed payload or conflict-only draft insert.
        $channels = array_column($this->database->fetchAll("SELECT channel FROM gameplay_catalogs WHERE channel IN ('foundation', 'draft')"), 'channel');
        if (in_array('foundation', $channels, true) && in_array('draft', $channels, true)) return;
        $columns = ['channel', 'catalog_json', 'revision', 'updated_by', 'updated_at'];
        $foundation = $this->database->fetchOne("SELECT catalog_json FROM gameplay_catalogs WHERE channel = 'foundation'");
        if ($foundation === null) {
            $seed = (string) file_get_contents(ZONE_ENGINE_ROOT . '/data/gameplay-catalog.json');
            json_decode($seed, true, 64, JSON_THROW_ON_ERROR);
            $this->database->insertIgnore('gameplay_catalogs', $columns, ['foundation', $seed, 1, 'system', gmdate('c')]);
            $foundation = $this->database->fetchOne("SELECT catalog_json FROM gameplay_catalogs WHERE channel = 'foundation'");
        }
        if (!in_array('draft', $channels, true)) $this->database->insertIgnore('gameplay_catalogs', $columns, ['draft', $foundation['catalog_json'], 1, 'system', gmdate('c')]);
    }

    public function foundation(): array
    {
        $this->initialize();
        $row = $this->database->fetchOne("SELECT catalog_json FROM gameplay_catalogs WHERE channel = 'foundation'");
        return json_decode((string) $row['catalog_json'], true, 64, JSON_THROW_ON_ERROR);
    }

    public function active(): array
    {
        // The published catalog is immutable. Project only the required JSON;
        // city geometry and page content must not cross the DB connection for
        // each progression snapshot, guard or reward hook.
        $projection = $this->database->driver() === 'pgsql'
            ? "manifest_json->'content'->'gameplayCatalog'"
            : "json_extract(manifest_json, '$.content.gameplayCatalog')";
        $row = $this->database->fetchOne("SELECT {$projection} AS catalog_json FROM content_releases WHERE active = 1 LIMIT 1");
        if ($row === null || $row['catalog_json'] === null || $row['catalog_json'] === 'null') return $this->foundation();
        return json_decode((string) $row['catalog_json'], true, 64, JSON_THROW_ON_ERROR);
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
                if (($rule['editable'] ?? true) === false) throw new InvalidArgumentException('This field cannot be changed after creation: ' . $field);
                $optionalPresentation = in_array($field, ['name', 'description', 'image', 'mediaAsset'], true) || ($field === 'model' && $category === 'items' && ($previous['type'] ?? '') === 'weapon');
                $applicableItemField = $category === 'items' && in_array($field, $schema['variants'][$previous['type'] ?? ''] ?? [], true);
                if (!$optionalPresentation && !$applicableItemField && !array_key_exists($field, $previous)) throw new InvalidArgumentException('This field does not apply to the selected entry.');
                $rows[$key][$field] = GameplayDefinitionValidator::value($field, $value, $rule);
            }
            $rows[$key] = GameplayDefinitionValidator::definition($category, $rows[$key]);
            MediaReferences::assertDefinition($this->database, $category, $rows[$key]);
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

    public function create(string $category, string $id, array $definition, int $expectedRevision, string $actor): array
    {
        if ($expectedRevision < 1 || trim($actor) === '' || strlen($actor) > 160 || preg_match('/[\x00-\x1F\x7F]/', $actor)) throw new InvalidArgumentException('A current catalog revision and valid actor are required.');
        GameplayDefinitionValidator::identifier($id);
        $definition = GameplayDefinitionValidator::definition($category, $definition, true);
        MediaReferences::assertDefinition($this->database, $category, $definition);
        return (new ReleaseManager($this->database, $this->events))->configurationTransaction(function () use ($category, $id, $definition, $expectedRevision, $actor): array {
            $draft = $this->draft();
            if ($draft['revision'] !== $expectedRevision) throw new RuntimeException('Gameplay catalog changed. Refresh and try again.');
            $schema = self::schema()[$category];
            $rows = $draft['catalogs'][$category];
            $exists = $schema['idField'] === 'key' ? array_key_exists($id, $rows) : in_array($id, array_column($rows, 'id'), true);
            if ($exists) throw new InvalidArgumentException('Catalog ID already exists. Choose a new ID.');
            if (count($rows) >= 1000) throw new InvalidArgumentException('Catalog category has reached its entry limit.');
            $entry = $schema['idField'] === 'id' ? ['id' => $id, ...$definition] : $definition;
            if ($schema['idField'] === 'key') $rows[$id] = $entry;
            else $rows[] = $entry;
            $draft['catalogs'][$category] = $rows;
            $correlation = bin2hex(random_bytes(16));
            $now = gmdate('c');
            $this->database->execute("UPDATE gameplay_catalogs SET catalog_json = :catalog, revision = revision + 1, updated_by = :actor, updated_at = :at WHERE channel = 'draft'", ['catalog' => json_encode($draft['catalogs'], JSON_THROW_ON_ERROR), 'actor' => $actor, 'at' => $now]);
            $this->database->execute('INSERT INTO admin_audit_log (id, actor, action, target_type, target_id, previous_json, next_json, correlation_id, created_at) VALUES (:id, :actor, :action, :type, :target, :previous, :next, :correlation, :at)', ['id' => bin2hex(random_bytes(16)), 'actor' => $actor, 'action' => 'GameplayCatalogCreated', 'type' => 'gameplay-catalog', 'target' => $category . ':' . $id, 'previous' => 'null', 'next' => json_encode($entry, JSON_THROW_ON_ERROR), 'correlation' => $correlation, 'at' => $now]);
            $this->events->publish(new DomainEvent('GameplayCatalogCreated', ['category' => $category, 'id' => $id, 'revision' => $draft['revision'] + 1, 'actor' => $actor, 'correlationId' => $correlation]));
            return [...$this->draft(), 'created' => ['category' => $category, 'id' => $id]];
        });
    }

    public function updateMarket(array $listings, int $expectedRevision, string $actor): array
    {
        if ($expectedRevision < 1 || trim($actor) === '' || strlen($actor) > 160) throw new InvalidArgumentException('A current catalog revision and valid actor are required.');
        return (new ReleaseManager($this->database, $this->events))->configurationTransaction(function () use ($listings, $expectedRevision, $actor): array {
            $draft = $this->draft();
            if ($draft['revision'] !== $expectedRevision) throw new RuntimeException('Gameplay catalog changed. Refresh and try again.');
            $previous = $draft['catalogs']['market'];
            $draft['catalogs']['market'] = $listings;
            GameplayDefinitionValidator::catalog($draft['catalogs']);
            $now = gmdate('c'); $correlation = bin2hex(random_bytes(16));
            $this->database->execute("UPDATE gameplay_catalogs SET catalog_json = :catalog, revision = revision + 1, updated_by = :actor, updated_at = :at WHERE channel = 'draft'", ['catalog' => json_encode($draft['catalogs'], JSON_THROW_ON_ERROR), 'actor' => $actor, 'at' => $now]);
            $this->database->execute('INSERT INTO admin_audit_log (id, actor, action, target_type, target_id, previous_json, next_json, correlation_id, created_at) VALUES (:id, :actor, :action, :type, :target, :previous, :next, :correlation, :at)',
                ['id' => bin2hex(random_bytes(16)), 'actor' => $actor, 'action' => 'ShopCatalogUpdated', 'type' => 'shop-catalog', 'target' => 'market', 'previous' => json_encode($previous, JSON_THROW_ON_ERROR), 'next' => json_encode($listings, JSON_THROW_ON_ERROR), 'correlation' => $correlation, 'at' => $now]);
            $this->events->publish(new DomainEvent('ShopCatalogUpdated', ['revision' => $draft['revision'] + 1, 'actor' => $actor, 'correlationId' => $correlation]));
            return $this->draft();
        });
    }

    public static function schema(): array
    {
        return GameplayDefinitionValidator::schema();
    }
}
