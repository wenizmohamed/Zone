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

    private function vercelHandle(string $id): string
    {
        $callsigns = ['Vincenzo', 'Corleone', 'Viper', 'Luciano', 'Castellano', 'Valenti', 'Moretti', 'Bellini'];
        return $callsigns[hexdec(substr($id, -2)) % count($callsigns)] . '_' . strtoupper(substr($id, -4));
    }

    private function decodeVercelLedger(string $playerId): ?array
    {
        $raw = (string) ($_COOKIE['zone_player_ledger'] ?? RequestGuard::cookie($_SERVER, 'zone_player_ledger'));
        if ($raw === '' || !str_contains($raw, '.')) return null;
        [$payload, $sig] = explode('.', $raw, 2);
        if (!hash_equals(hash_hmac('sha256', $payload, 'zone-vercel-ledger-v126'), $sig)) return null;
        $b64 = strtr($payload, '-_', '+/');
        $pad = strlen($b64) % 4;
        if ($pad > 0) $b64 .= str_repeat('=', 4 - $pad);
        $rawBin = base64_decode($b64, true);
        if ($rawBin === false) return null;
        $json = @gzinflate($rawBin);
        if ($json === false) return null;
        $snap = json_decode($json, true);
        if (!is_array($snap) || ($snap['p'] ?? '') !== $playerId) return null;
        return $snap;
    }

    public function resolve(string $token, ?int $now = null): string
    {
        if (!preg_match('/^[a-f0-9]{64}$/', $token)) throw new RuntimeException('Player session expired.');
        $now ??= time();
        $row = $this->database->fetchOne('SELECT player_id, expires_at FROM browser_sessions WHERE token_hash = :hash', ['hash' => hash('sha256', $token)]);
        if ($row === null && getenv('VERCEL') === '1') {
            return $this->database->transaction(function () use ($token, $now): string {
                $id = 'player-' . substr(hash('sha256', 'zone-vercel-session:' . $token), 0, 24);
                $handle = $this->vercelHandle($id);
                $snap = $this->decodeVercelLedger($id);
                $initCash = isset($snap['c']) ? (int) $snap['c'] : 85000;
                $initBank = isset($snap['b']) ? (int) $snap['b'] : 125000;
                $existing = $this->database->fetchOne('SELECT id, username FROM players WHERE id = :id', ['id' => $id]);
                if ($existing === null) {
                    $this->database->execute('INSERT INTO players (id, username, level, cash, bank_balance, happy, max_happy, resources_updated_at) VALUES (:id, :name, :lvl, :cash, :bank, :happy, :happy2, :at)',
                        ['id' => $id, 'name' => $handle, 'lvl' => 7, 'cash' => $initCash, 'bank' => $initBank, 'happy' => 100, 'happy2' => 100, 'at' => gmdate('c', $now)]);
                    (new Ledger($this->database))->record($id, 'cash', $initCash, $initCash, 'beta.starting-grant', substr(hash('sha256', 'grant:' . $id), 0, 32));
                } elseif (str_starts_with((string) ($existing['username'] ?? ''), 'Player_')) {
                    $this->database->execute('UPDATE players SET username = :name WHERE id = :id', ['name' => $handle, 'id' => $id]);
                }
                $this->database->execute('INSERT INTO browser_sessions (token_hash, player_id, created_at, expires_at) VALUES (:hash, :player, :created, :expires) ON CONFLICT (token_hash) DO NOTHING',
                    ['hash' => hash('sha256', $token), 'player' => $id, 'created' => $now, 'expires' => $now + self::LIFETIME]);
                return $id;
            });
        }
        if ($row === null || (int) $row['expires_at'] <= $now) throw new RuntimeException('Player session expired.');
        if (getenv('VERCEL') === '1') {
            $id = (string) $row['player_id'];
            $existing = $this->database->fetchOne('SELECT id, username FROM players WHERE id = :id', ['id' => $id]);
            if ($existing !== null && str_starts_with((string) ($existing['username'] ?? ''), 'Player_')) {
                $this->database->execute('UPDATE players SET username = :name WHERE id = :id', ['name' => $this->vercelHandle($id), 'id' => $id]);
            }
            $snap = $this->decodeVercelLedger($id);
            if ($snap !== null && (int) ($snap['v'] ?? 0) > 1) {
                $prog = $this->database->fetchOne('SELECT version FROM player_progression WHERE player_id = :id', ['id' => $id]);
                if ((int) ($prog['version'] ?? 0) < (int) $snap['v'] && isset($snap['c'], $snap['b'])) {
                    $this->database->execute('UPDATE players SET cash = :c, bank_balance = :b WHERE id = :id', ['c' => (int) $snap['c'], 'b' => (int) $snap['b'], 'id' => $id]);
                }
            }
        }
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
        if ((int) ($rate['count'] ?? 0) > 10 && getenv('VERCEL') !== '1') throw new RuntimeException('Too many new beta accounts. Try again later.');
        return $this->database->transaction(function () use ($now): array {
            $token = bin2hex(random_bytes(32));
            $id = getenv('VERCEL') === '1'
                ? 'player-' . substr(hash('sha256', 'zone-vercel-session:' . $token), 0, 24)
                : 'player-' . bin2hex(random_bytes(12));
            $handle = getenv('VERCEL') === '1'
                ? $this->vercelHandle($id)
                : ('Player_' . strtoupper(substr($id, -6)));
            $this->database->execute('INSERT INTO players (id, username, cash, happy, max_happy, resources_updated_at) VALUES (:id, :name, :cash, :happy, :happy2, :at)',
                ['id' => $id, 'name' => $handle, 'cash' => 2500, 'happy' => 100, 'happy2' => 100, 'at' => gmdate('c', $now)]);
            (new Ledger($this->database))->record($id, 'cash', 2500, 2500, 'beta.starting-grant', bin2hex(random_bytes(16)));
            $this->database->execute('INSERT INTO browser_sessions (token_hash, player_id, created_at, expires_at) VALUES (:hash, :player, :created, :expires)',
                ['hash' => hash('sha256', $token), 'player' => $id, 'created' => $now, 'expires' => $now + self::LIFETIME]);
            return ['playerId' => $id, 'token' => $token, 'expiresAt' => $now + self::LIFETIME];
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

    public function purgeExpired(?int $now = null): int
    {
        return $this->database->execute(
            'DELETE FROM browser_sessions WHERE expires_at <= :now',
            ['now' => $now ?? time()],
        );
    }
}
