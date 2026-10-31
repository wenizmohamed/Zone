<?php
declare(strict_types=1);

namespace Zone\Engine\Core\Game;

use InvalidArgumentException;
use RuntimeException;
use Zone\Engine\Core\Content\GameplayCatalog;
use Zone\Engine\Core\Events\EventBus;
use Zone\Engine\Core\Persistence\Database;

/** Frozen issuance receipts, independent of find expiry, owned stock and releases. */
final class MaterialLootService
{
    private readonly EventBus $events;

    public function __construct(private readonly Database $database, ?EventBus $events = null)
    {
        $this->events = $events ?? new EventBus($database);
    }

    /** World-only serialization, never a global player/publication lock. */
    public function withPublishedContext(callable $operation): mixed
    {
        return $this->database->transaction(function () use ($operation): mixed {
            $this->lockWorld();
            return $operation($this->publishedContext());
        });
    }

    /** One immutable release row: in-flight work may finish under that version. */
    public function publishedContext(): array
    {
        // Match ReleaseManager::normalizeRelease: absent/null legacy content
        // inherits the immutable foundation, but an explicit content object does
        // not inherit missing crime fields. All three sources share one read.
        if ($this->database->driver() === 'pgsql') {
            $policy = "CASE WHEN r.id IS NULL THEN f.manifest_json->'worldPolicy' ELSE r.manifest_json->'worldPolicy' END";
            $content = "COALESCE(NULLIF(r.manifest_json->'content','null'::jsonb),f.manifest_json->'content')";
            $projection = "jsonb_build_object('policy',policy,'catalog',COALESCE(NULLIF(content->'gameplayCatalog','null'::jsonb),foundation_catalog),'crimes',content->'crimes')";
        } else {
            $policy = "CASE WHEN r.id IS NULL THEN json_extract(f.manifest_json,'$.worldPolicy') ELSE json_extract(r.manifest_json,'$.worldPolicy') END";
            $content = "COALESCE(json_extract(r.manifest_json,'$.content'),json_extract(f.manifest_json,'$.content'))";
            $projection = "json_object('policy',json(policy),'catalog',COALESCE(json_extract(content,'$.gameplayCatalog'),json(foundation_catalog)),'crimes',json_extract(content,'$.crimes'))";
        }
        $sources = "SELECT r.id, {$policy} AS policy, {$content} AS content, g.catalog_json AS foundation_catalog FROM (SELECT 1) anchor "
            . "LEFT JOIN content_releases r ON r.active=1 LEFT JOIN content_foundations f ON f.channel='production' LEFT JOIN gameplay_catalogs g ON g.channel='foundation' LIMIT 1";
        $row = $this->database->fetchOne("SELECT COALESCE(id,'foundation') AS id, {$projection} AS context FROM ({$sources}) immutable");
        $data = json_decode((string) $row['context'], true, 64, JSON_THROW_ON_ERROR);
        return ['releaseId' => $row['id'] ?? 'foundation', 'policy' => WorldDirector::normalizePolicy($data['policy'] ?? []),
            'catalog' => $data['catalog'] ?? (new GameplayCatalog($this->database, $this->events))->foundation(), 'crimes' => $data['crimes'] ?? []];
    }

    private function lockWorld(): void
    {
        if ($this->database->driver() === 'pgsql') $this->database->fetchOne('SELECT pg_advisory_xact_lock(90120261008)');
        else $this->database->execute("UPDATE content_drafts SET updated_at=updated_at WHERE channel='production'"); // SQLite must acquire its writer lock before a budget read.
    }

    /**
     * Reserve before the effect, in the same transaction. A repeated correlation
     * returns the frozen receipt without repeating its effect, even in a new hour.
     * Null is unlimited; new unlimited awards are recorded, never backfilled.
     */
    public function issue(string $source, string $correlationId, ?string $playerId, int $quantity, int $choice, callable $effect, ?array $publishedContext = null): array
    {
        if (!in_array($source, ['world','search'], true)
            || !preg_match('/^[A-Za-z0-9:_-]{1,100}$/D', $correlationId)
            || $quantity < 1 || $quantity > 1000 || $choice < 0
            || ($source === 'world' ? $playerId !== null : ($playerId === null || $playerId === '' || strlen($playerId) > 100))) {
            throw new InvalidArgumentException('Invalid material issuance identity or quantity.');
        }
        $scope = $source === 'world' ? '*' : $playerId;
        $settle = function () use ($source, $correlationId, $scope, $quantity, $choice, $effect, $publishedContext): array {
            $context = $publishedContext ?? $this->publishedContext();
            $prior = $this->database->fetchOne('SELECT * FROM material_issuance WHERE source=:source AND correlation_id=:id', ['source' => $source, 'id' => $correlationId]);
            if ($prior !== null) {
                if ($prior['scope_id'] !== $scope || (int) $prior['quantity'] !== $quantity) throw new RuntimeException('Material issuance correlation belongs to a different request.');
                return [...$this->receipt($prior), 'replayed' => true];
            }
            $policy = $context['policy'];
            $budget = $policy[$source === 'world' ? 'findValueBudgetPerHour' : 'searchValueBudgetPerHour'];
            $now = time(); $hour = intdiv($now, 3600) * 3600;
            $finish = function (string $status, ?string $itemId = null, int $unitValue = 0, int $value = 0) use ($context, $source, $correlationId, $scope, $hour, $quantity, $now, $effect): array {
                $row = ['source' => $source, 'correlation_id' => $correlationId, 'scope_id' => $scope, 'hour_start' => $hour,
                    'status' => $status, 'item_id' => $itemId, 'quantity' => $quantity, 'unit_value' => $unitValue, 'issued_value' => $value,
                    'release_id' => $context['releaseId'], 'created_at' => $now];
                $this->database->execute('INSERT INTO material_issuance (source,correlation_id,scope_id,hour_start,status,item_id,quantity,unit_value,issued_value,release_id,created_at) VALUES (:source,:correlation_id,:scope_id,:hour_start,:status,:item_id,:quantity,:unit_value,:issued_value,:release_id,:created_at)', $row);
                $receipt = [...$this->receipt($row), 'replayed' => false];
                if ($status === 'awarded') $effect($receipt); // Failure rolls reservation and effect back together.
                return $receipt;
            };
            if ($budget === 0) return $finish('budget-capped'); // Stops even zero-value materials.
            $items = $context['catalog']['items'] ?? [];
            $materials = array_keys(array_filter($items, static fn (array $item): bool => ($item['type'] ?? '') === 'material'));
            sort($materials, SORT_STRING);
            if ($policy['materialItemIds'] !== null) $materials = array_values(array_intersect($materials, $policy['materialItemIds']));
            // Legacy catalog has only sand. A published new material deliberately
            // expands the nullable pool; selection consumes no extra RNG call.
            $itemId = $materials === [] ? null : $materials[$choice % count($materials)];
            if ($itemId === null) return $finish('no-eligible-material');
            $unitValue = (int) round((int) $items[$itemId]['price'] * .9);
            $value = $unitValue * $quantity;
            $spent = (int) $this->database->fetchOne('SELECT COALESCE(SUM(issued_value),0) AS spent FROM material_issuance WHERE source=:source AND scope_id=:scope AND hour_start=:hour', ['source' => $source, 'scope' => $scope, 'hour' => $hour])['spent'];
            if ($budget !== null && $value > $budget - $spent) return $finish('budget-capped', $itemId, $unitValue);
            return $finish('awarded', $itemId, $unitValue, $value);
        };
        if ($source === 'search') return $this->database->playerTransaction((string) $playerId, $settle);
        return $this->database->transaction(function () use ($settle): array { $this->lockWorld(); return $settle(); });
    }

    private function receipt(array $row): array
    {
        return ['source' => $row['source'], 'correlationId' => $row['correlation_id'], 'scopeId' => $row['scope_id'], 'status' => $row['status'],
            'hourStart' => (int) $row['hour_start'], 'itemId' => $row['item_id'], 'quantity' => (int) $row['quantity'],
            'unitValue' => (int) $row['unit_value'], 'issuedValue' => (int) $row['issued_value'], 'releaseId' => $row['release_id']];
    }

    public function hourlyUsage(string $source, string $scopeId = '*', ?int $now = null): array
    {
        $hour = intdiv($now ?? time(), 3600) * 3600;
        $row = $this->database->fetchOne(
            'SELECT COUNT(*) AS award_count, COALESCE(SUM(issued_value), 0) AS spent_value FROM material_issuance WHERE source = :source AND scope_id = :scope AND hour_start = :hour',
            ['source' => $source, 'scope' => $scopeId, 'hour' => $hour],
        );
        return [
            'source' => $source,
            'scopeId' => $scopeId,
            'hourStart' => $hour,
            'awardCount' => (int) ($row['award_count'] ?? 0),
            'spentValue' => (int) ($row['spent_value'] ?? 0),
        ];
    }

    public function totalAwardedCount(?string $source = null): int
    {
        if ($source !== null) {
            $row = $this->database->fetchOne(
                "SELECT COUNT(*) AS total FROM material_issuance WHERE status = 'awarded' AND source = :source",
                ['source' => $source],
            );
            return max(0, (int) ($row['total'] ?? 0));
        }
        $row = $this->database->fetchOne("SELECT COUNT(*) AS total FROM material_issuance WHERE status = 'awarded'");
        return max(0, (int) ($row['total'] ?? 0));
    }
}
