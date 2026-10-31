<?php
declare(strict_types=1);

namespace Zone\Engine\Core\Security;

use RuntimeException;
use Zone\Engine\Core\Persistence\Database;
use Zone\Engine\Core\Economy\Ledger;

/** Guest and claimed-account access share opaque, server-owned sessions. */
final readonly class BrowserSessions
{
    public const COOKIE = 'zone_player_session';
    public const LIFETIME = 60 * 60 * 24 * 30;

    public function __construct(private Database $database) {}

    public function resolve(string $token, ?int $now = null): string
    {
        if (!preg_match('/^[a-f0-9]{64}$/', $token)) throw new RuntimeException('Player session expired.');
        $row = $this->database->fetchOne('SELECT player_id, expires_at FROM browser_sessions WHERE token_hash = :hash', ['hash' => hash('sha256', $token)]);
        if ($row === null || (int) $row['expires_at'] <= ($now ?? time())) throw new RuntimeException('Player session expired.');
        return (string) $row['player_id'];
    }

    /** The opaque token is returned to the HTTP cookie writer, never stored as plaintext. */
    public function create(string $clientAddress, ?int $now = null): array
    {
        $now ??= time();
        $bucket = hash('sha256', 'beta-session:' . $clientAddress);
        // Atomic upsert counts attempts even if later account creation fails.
        $this->database->execute('INSERT INTO session_creation_limits (bucket, window_started_at, count) VALUES (:bucket, :now, 1) '
            . 'ON CONFLICT (bucket) DO UPDATE SET count = CASE WHEN session_creation_limits.window_started_at <= :floor THEN 1 ELSE session_creation_limits.count + 1 END, '
            . 'window_started_at = CASE WHEN session_creation_limits.window_started_at <= :floor2 THEN :now2 ELSE session_creation_limits.window_started_at END',
            ['bucket' => $bucket, 'now' => $now, 'floor' => $now - 3600, 'floor2' => $now - 3600, 'now2' => $now]);
        $rate = $this->database->fetchOne('SELECT count FROM session_creation_limits WHERE bucket = :bucket', ['bucket' => $bucket]);
        if ((int) ($rate['count'] ?? 0) > 10) throw new RuntimeException('Too many new beta accounts. Try again later.');
        return $this->database->transaction(function () use ($now): array {
            $id = 'player-' . bin2hex(random_bytes(12));
            $this->database->execute('INSERT INTO players (id, username, cash, happy, max_happy, resources_updated_at) VALUES (:id, :name, :cash, :happy, :happy2, :at)',
                ['id' => $id, 'name' => 'Player_' . strtoupper(substr($id, -6)), 'cash' => 2500, 'happy' => 100, 'happy2' => 100, 'at' => gmdate('c', $now)]);
            (new Ledger($this->database))->record($id, 'cash', 2500, 2500, 'beta.starting-grant', bin2hex(random_bytes(16)));
            return $this->issue($id, $now);
        });
    }

    /** Called only after server-side account authorization. No starting grant. */
    public function issue(string $playerId, ?int $now = null): array
    {
        $now ??= time();
        $token = bin2hex(random_bytes(32));
        $this->database->execute('INSERT INTO browser_sessions (token_hash, player_id, created_at, expires_at) VALUES (:hash, :player, :created, :expires)',
            ['hash' => hash('sha256', $token), 'player' => $playerId, 'created' => $now, 'expires' => $now + self::LIFETIME]);
        return ['playerId' => $playerId, 'token' => $token, 'expiresAt' => $now + self::LIFETIME];
    }

    public function revoke(string $token): void
    {
        $this->database->execute('DELETE FROM browser_sessions WHERE token_hash = :hash', ['hash' => hash('sha256', $token)]);
    }

    public function activeCount(?int $now = null): int
    {
        $row = $this->database->fetchOne(
            'SELECT COUNT(*) AS total FROM browser_sessions WHERE expires_at > :now',
            ['now' => $now ?? time()],
        );
        return (int) ($row['total'] ?? 0);
    }
}
