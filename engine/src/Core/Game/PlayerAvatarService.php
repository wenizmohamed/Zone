<?php

declare(strict_types=1);

namespace Zone\Engine\Core\Game;

use InvalidArgumentException;
use RuntimeException;
use Zone\Engine\Core\Events\DomainEvent;
use Zone\Engine\Core\Events\EventBus;
use Zone\Engine\Core\Persistence\Database;

/**
 * PostgreSQL 16 & SQLite persistent Player Profile Avatar Service (ZONE v152).
 *
 * Supports:
 *  - Validated binary photo uploads (PNG, JPEG, WebP; 32..380,000 bytes; 16x16..1024x1024 px)
 *  - Strict magic-byte & anti-XSS/anti-SVG rejection
 *  - 8 curated Hand-Inked Gouache Syndicate Portrait Presets
 *  - Direct binary streaming (?raw=1&id=<playerId>) with immutable versioned cache tags
 *  - Single-query batched hydration for Player Directory, PvP, and Faction Rosters
 */
final class PlayerAvatarService
{
    public const MIN_BYTES = 32;
    public const MAX_BYTES = 380_000;
    public const MIN_DIMENSION = 16;
    public const MAX_DIMENSION = 1024;

    /**
     * @var array<string, array{nameEn: string, nameAr: string, roleEn: string, roleAr: string, bg1: string, bg2: string, accent: string, coat: string, skin: string, hair: string, detail: string}>
     */
    public const PRESETS = [
        'pier4_ghost' => [
            'nameEn' => 'Pier 4 Ghost',
            'nameAr' => 'شبح الرصيف ٤',
            'roleEn' => 'Harbor Stealth Operative',
            'roleAr' => 'عميل التخفي بالمرفأ',
            'bg1' => '#162836',
            'bg2' => '#0d1720',
            'accent' => '#38bdf8',
            'coat' => '#1e293b',
            'skin' => '#d6a887',
            'hair' => '#111827',
            'detail' => 'hood',
        ],
        'neon_enforcer' => [
            'nameEn' => 'Neon Enforcer',
            'nameAr' => 'منفّذ النيون',
            'roleEn' => 'Heavy Street Bruiser',
            'roleAr' => 'منفّذ الشوارع الثقيل',
            'bg1' => '#2b152d',
            'bg2' => '#140c18',
            'accent' => '#f43f5e',
            'coat' => '#3f1d2b',
            'skin' => '#c68b63',
            'hair' => '#1c1917',
            'detail' => 'visor',
        ],
        'velvet_queen' => [
            'nameEn' => 'Velvet Queen',
            'nameAr' => 'ملكة المخمل',
            'roleEn' => 'High-Stakes Casino Sovereign',
            'roleAr' => 'سيدة صالات الرهان',
            'bg1' => '#31152b',
            'bg2' => '#170b16',
            'accent' => '#f59e0b',
            'coat' => '#581c4a',
            'skin' => '#dfb191',
            'hair' => '#27141d',
            'detail' => 'crown',
        ],
        'crimson_viper' => [
            'nameEn' => 'Crimson Viper',
            'nameAr' => 'الأفعى القرمزية',
            'roleEn' => 'Syndicate Hitman',
            'roleAr' => 'قناص العقود السرية',
            'bg1' => '#321414',
            'bg2' => '#160909',
            'accent' => '#ef4444',
            'coat' => '#291515',
            'skin' => '#cfa07d',
            'hair' => '#0f172a',
            'detail' => 'scar',
        ],
        'gold_financier' => [
            'nameEn' => 'Gold Financier',
            'nameAr' => 'المموّل الذهبي',
            'roleEn' => 'Offshore Vault Mogul',
            'roleAr' => 'قطب الخزائن المصرفية',
            'bg1' => '#2d2310',
            'bg2' => '#151108',
            'accent' => '#eab308',
            'coat' => '#1f242d',
            'skin' => '#d8aa86',
            'hair' => '#292524',
            'detail' => 'glasses',
        ],
        'iron_chemist' => [
            'nameEn' => 'Iron Chemist',
            'nameAr' => 'الخيميائي الحديدي',
            'roleEn' => 'Underground Lab Master',
            'roleAr' => 'خبير المختبرات السرية',
            'bg1' => '#102a22',
            'bg2' => '#081612',
            'accent' => '#22c55e',
            'coat' => '#1e3a2f',
            'skin' => '#ceb094',
            'hair' => '#334155',
            'detail' => 'goggles',
        ],
        'harbor_captain' => [
            'nameEn' => 'Harbor Captain',
            'nameAr' => 'قبطان المرفأ',
            'roleEn' => 'Contraband Fleet Commander',
            'roleAr' => 'قائد أسطول التهريب',
            'bg1' => '#152438',
            'bg2' => '#0b131e',
            'accent' => '#60a5fa',
            'coat' => '#1e3a5f',
            'skin' => '#bf8a62',
            'hair' => '#3f3f46',
            'detail' => 'cap',
        ],
        'shadow_architect' => [
            'nameEn' => 'Shadow Architect',
            'nameAr' => 'مهندس الظلال',
            'roleEn' => 'Mastermind Consigliere',
            'roleAr' => 'العقل المدبر للنقابة',
            'bg1' => '#1f1b2e',
            'bg2' => '#100e18',
            'accent' => '#a855f7',
            'coat' => '#27203d',
            'skin' => '#dab08f',
            'hair' => '#18181b',
            'detail' => 'collar',
        ],
    ];

    /** @var array<int, bool> */
    private static array $schemaEnsured = [];

    public function __construct(
        private readonly Database $database,
        private readonly EventBus $events,
    ) {
        $this->ensureSchema();
    }

    public function ensureSchema(): void
    {
        $dbKey = spl_object_id($this->database);
        if (!empty(self::$schemaEnsured[$dbKey])) {
            return;
        }
        $this->database->execute(
            "CREATE TABLE IF NOT EXISTS player_avatars (
                player_id VARCHAR(64) PRIMARY KEY,
                mime_type VARCHAR(32) NOT NULL,
                image_base64 TEXT NOT NULL,
                sha256 VARCHAR(64) NOT NULL,
                preset_id VARCHAR(48) NOT NULL DEFAULT '',
                updated_at VARCHAR(40) NOT NULL
            )"
        );
        self::$schemaEnsured[$dbKey] = true;
    }

    /**
     * @return list<array<string, string>>
     */
    public static function presetCatalog(): array
    {
        $out = [];
        foreach (self::PRESETS as $id => $spec) {
            $out[] = [
                'id' => $id,
                'nameEn' => $spec['nameEn'],
                'nameAr' => $spec['nameAr'],
                'roleEn' => $spec['roleEn'],
                'roleAr' => $spec['roleAr'],
                'accent' => $spec['accent'],
                'dataUrl' => self::presetDataUrl($id),
            ];
        }
        return $out;
    }

    public static function presetSvg(string $presetId): string
    {
        $spec = self::PRESETS[$presetId] ?? throw new InvalidArgumentException('Unknown syndicate portrait preset.');
        $detailSvg = match ($spec['detail']) {
            'hood' => '<path d="M52 118 C52 54 104 42 128 42 C152 42 204 54 204 118 L192 152 L176 92 C160 72 96 72 80 92 L64 152 Z" fill="' . $spec['coat'] . '" stroke="#12100e" stroke-width="4.5" stroke-linejoin="round"/>',
            'visor' => '<rect x="86" y="98" width="84" height="20" rx="9" fill="' . $spec['accent'] . '" stroke="#12100e" stroke-width="4"/><path d="M92 105 H164" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" opacity="0.7"/>',
            'crown' => '<path d="M88 68 L104 44 L128 60 L152 44 L168 68 Z" fill="' . $spec['accent'] . '" stroke="#12100e" stroke-width="4" stroke-linejoin="round"/>',
            'scar' => '<path d="M144 90 L154 126 M145 104 L156 101" stroke="' . $spec['accent'] . '" stroke-width="3.6" stroke-linecap="round"/>',
            'glasses' => '<rect x="88" y="98" width="34" height="20" rx="5" fill="#1e293b" stroke="' . $spec['accent'] . '" stroke-width="3.5"/><rect x="134" y="98" width="34" height="20" rx="5" fill="#1e293b" stroke="' . $spec['accent'] . '" stroke-width="3.5"/><path d="M122 107 H134" stroke="' . $spec['accent'] . '" stroke-width="3.5"/>',
            'goggles' => '<circle cx="106" cy="107" r="15" fill="#064e3b" stroke="' . $spec['accent'] . '" stroke-width="4"/><circle cx="150" cy="107" r="15" fill="#064e3b" stroke="' . $spec['accent'] . '" stroke-width="4"/><path d="M121 107 H135" stroke="#12100e" stroke-width="4"/>',
            'cap' => '<path d="M76 84 C84 54 172 54 180 84 Z" fill="' . $spec['coat'] . '" stroke="#12100e" stroke-width="4.5"/><path d="M72 84 H184" stroke="' . $spec['accent'] . '" stroke-width="6" stroke-linecap="round"/>',
            default => '<path d="M74 176 L96 146 L128 168 L160 146 L182 176" fill="none" stroke="' . $spec['accent'] . '" stroke-width="4.5" stroke-linejoin="round"/>',
        };

        return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256">'
            . '<defs>'
            . '<radialGradient id="g" cx="50%" cy="38%" r="68%">'
            . '<stop offset="0%" stop-color="' . $spec['bg1'] . '"/>'
            . '<stop offset="100%" stop-color="' . $spec['bg2'] . '"/>'
            . '</radialGradient>'
            . '</defs>'
            . '<rect width="256" height="256" rx="28" fill="url(#g)"/>'
            . '<circle cx="128" cy="116" r="86" fill="none" stroke="' . $spec['accent'] . '" stroke-width="2.5" stroke-dasharray="10 7" opacity="0.48"/>'
            . '<path d="M44 244 C54 184 88 164 128 164 C168 164 202 184 212 244 Z" fill="' . $spec['coat'] . '" stroke="#12100e" stroke-width="5" stroke-linejoin="round"/>'
            . '<path d="M108 166 L128 214 L148 166 Z" fill="' . $spec['accent'] . '" stroke="#12100e" stroke-width="3.8" stroke-linejoin="round"/>'
            . '<rect x="114" y="138" width="28" height="34" rx="10" fill="' . $spec['skin'] . '" stroke="#12100e" stroke-width="4"/>'
            . '<ellipse cx="128" cy="110" rx="44" ry="50" fill="' . $spec['skin'] . '" stroke="#12100e" stroke-width="5"/>'
            . '<path d="M84 102 C84 62 172 62 172 102 C164 82 146 76 128 76 C110 76 92 82 84 102 Z" fill="' . $spec['hair'] . '" stroke="#12100e" stroke-width="4" stroke-linejoin="round"/>'
            . '<circle cx="109" cy="109" r="4.6" fill="#12100e"/>'
            . '<circle cx="147" cy="109" r="4.6" fill="#12100e"/>'
            . '<path d="M100 97 Q109 92 118 96 M138 96 Q147 92 156 97" fill="none" stroke="#12100e" stroke-width="3.4" stroke-linecap="round"/>'
            . '<path d="M114 134 Q128 141 142 133" fill="none" stroke="#12100e" stroke-width="3.8" stroke-linecap="round"/>'
            . $detailSvg
            . '<rect x="6" y="6" width="244" height="244" rx="24" fill="none" stroke="' . $spec['accent'] . '" stroke-width="3.5" opacity="0.82"/>'
            . '</svg>';
    }

    public static function presetDataUrl(string $presetId): string
    {
        return 'data:image/svg+xml;base64,' . base64_encode(self::presetSvg($presetId));
    }

    public static function customAvatarUrl(string $playerId, string $sha256): string
    {
        return '/api/v1/player-profile/avatar?raw=1&id=' . rawurlencode($playerId) . '&v=' . substr($sha256, 0, 10);
    }

    public function state(string $targetQuery): array
    {
        $resolvedId = $this->resolveTargetPlayerId($targetQuery);
        $row = $this->database->fetchOne(
            'SELECT player_id, mime_type, image_base64, sha256, preset_id, updated_at FROM player_avatars WHERE player_id = :pid',
            ['pid' => $resolvedId],
        );

        return [
            ...$this->formatAvatarRow($resolvedId, $row),
            'presets' => self::presetCatalog(),
        ];
    }

    /**
     * @return array{bytes: string, mimeType: string, sha256: string, updatedAt: string}|null
     */
    public function rawBinary(string $targetQuery): ?array
    {
        $resolvedId = $this->resolveTargetPlayerId($targetQuery);
        $row = $this->database->fetchOne(
            'SELECT mime_type, image_base64, sha256, updated_at FROM player_avatars WHERE player_id = :pid',
            ['pid' => $resolvedId],
        );
        if ($row === null) {
            return null;
        }
        $b64 = (string) ($row['image_base64'] ?? '');
        $mime = (string) ($row['mime_type'] ?? '');
        if ($b64 === '' || !in_array($mime, ['image/png', 'image/jpeg', 'image/webp'], true)) {
            return null;
        }
        $bytes = base64_decode($b64, true);
        if ($bytes === false || $bytes === '') {
            return null;
        }

        return [
            'bytes' => $bytes,
            'mimeType' => $mime,
            'sha256' => (string) ($row['sha256'] ?? ''),
            'updatedAt' => (string) ($row['updated_at'] ?? ''),
        ];
    }

    public function act(string $playerId, string $action, array $payload = []): array
    {
        $cleanPlayerId = trim($playerId);
        if ($cleanPlayerId === '' || strlen($cleanPlayerId) > 64 || !preg_match('/^[A-Za-z0-9_-]+$/D', $cleanPlayerId)) {
            throw new InvalidArgumentException('Invalid player identifier for avatar update.');
        }

        $cleanAction = strtolower(trim($action));
        if (!in_array($cleanAction, ['upload', 'preset', 'remove'], true)) {
            throw new InvalidArgumentException('Unsupported avatar action. Expected upload, preset, or remove.');
        }

        if ($cleanAction === 'upload') {
            $rawDataUrl = $payload['dataUrl'] ?? null;
            if (!is_string($rawDataUrl) || trim($rawDataUrl) === '') {
                throw new InvalidArgumentException('Avatar upload requires a base64 image dataUrl.');
            }
            $decoded = self::validateAndDecodeUpload($rawDataUrl);
            $updatedAt = gmdate('c');

            $this->database->playerTransaction($cleanPlayerId, function () use ($cleanPlayerId, $decoded, $updatedAt): void {
                $this->upsertRow(
                    $cleanPlayerId,
                    $decoded['mimeType'],
                    $decoded['base64'],
                    $decoded['sha256'],
                    '',
                    $updatedAt,
                );
                $this->events->publish(new DomainEvent('PlayerAvatarUpdated', [
                    'playerId' => $cleanPlayerId,
                    'mode' => 'upload',
                    'mimeType' => $decoded['mimeType'],
                    'bytes' => $decoded['byteLength'],
                    'width' => $decoded['width'],
                    'height' => $decoded['height'],
                    'sha256' => $decoded['sha256'],
                ]));
            });

            return [
                'ok' => true,
                'playerId' => $cleanPlayerId,
                'hasCustomAvatar' => true,
                'presetId' => '',
                'mimeType' => $decoded['mimeType'],
                'width' => $decoded['width'],
                'height' => $decoded['height'],
                'sha256' => $decoded['sha256'],
                'dataUrl' => $decoded['dataUrl'],
                'avatarUrl' => self::customAvatarUrl($cleanPlayerId, $decoded['sha256']),
                'updatedAt' => $updatedAt,
            ];
        }

        if ($cleanAction === 'preset') {
            $presetId = is_string($payload['presetId'] ?? null) ? strtolower(trim($payload['presetId'])) : '';
            if ($presetId === '' || !isset(self::PRESETS[$presetId])) {
                throw new InvalidArgumentException('Invalid syndicate portrait preset ID.');
            }
            $sha = hash('sha256', 'preset:' . $presetId);
            $svgDataUrl = self::presetDataUrl($presetId);
            $updatedAt = gmdate('c');

            $this->database->playerTransaction($cleanPlayerId, function () use ($cleanPlayerId, $presetId, $sha, $updatedAt): void {
                $this->upsertRow(
                    $cleanPlayerId,
                    'preset',
                    '',
                    $sha,
                    $presetId,
                    $updatedAt,
                );
                $this->events->publish(new DomainEvent('PlayerAvatarUpdated', [
                    'playerId' => $cleanPlayerId,
                    'mode' => 'preset',
                    'presetId' => $presetId,
                ]));
            });

            return [
                'ok' => true,
                'playerId' => $cleanPlayerId,
                'hasCustomAvatar' => false,
                'presetId' => $presetId,
                'mimeType' => 'preset',
                'sha256' => $sha,
                'dataUrl' => $svgDataUrl,
                'avatarUrl' => $svgDataUrl,
                'updatedAt' => $updatedAt,
            ];
        }

        $updatedAt = gmdate('c');
        $this->database->playerTransaction($cleanPlayerId, function () use ($cleanPlayerId): void {
            $this->database->execute(
                'DELETE FROM player_avatars WHERE player_id = :pid',
                ['pid' => $cleanPlayerId],
            );
            $this->events->publish(new DomainEvent('PlayerAvatarRemoved', [
                'playerId' => $cleanPlayerId,
            ]));
        });

        return [
            'ok' => true,
            'playerId' => $cleanPlayerId,
            'hasCustomAvatar' => false,
            'presetId' => '',
            'mimeType' => null,
            'sha256' => null,
            'dataUrl' => null,
            'avatarUrl' => null,
            'updatedAt' => $updatedAt,
        ];
    }

    /**
     * Single batched IN (...) query hydrating directory & profile records.
     * Uses distinct named placeholders (:id0, :id1, ...) for 100% PostgreSQL 16 compatibility.
     *
     * @param list<string> $playerIds
     * @return array<string, array{hasCustomAvatar: bool, avatarPresetId: string, avatarUrl: ?string, avatarDataUrl: ?string, updatedAt: ?string}>
     */
    public function batchSummaryForPlayers(array $playerIds): array
    {
        $cleanIds = [];
        foreach ($playerIds as $rawId) {
            $id = trim((string) $rawId);
            if ($id !== '' && strlen($id) <= 64 && preg_match('/^[A-Za-z0-9_-]+$/D', $id)) {
                $cleanIds[$id] = true;
            }
        }
        $uniqueIds = array_keys($cleanIds);
        if ($uniqueIds === []) {
            return [];
        }

        $placeholders = [];
        $params = [];
        foreach ($uniqueIds as $index => $pid) {
            $key = 'id' . $index;
            $placeholders[] = ':' . $key;
            $params[$key] = $pid;
        }

        $sql = 'SELECT player_id, mime_type, sha256, preset_id, updated_at FROM player_avatars WHERE player_id IN ('
            . implode(', ', $placeholders)
            . ')';
        $rows = $this->database->fetchAll($sql, $params);

        $map = [];
        foreach ($rows as $row) {
            $pid = (string) ($row['player_id'] ?? '');
            if ($pid === '') {
                continue;
            }
            $mime = (string) ($row['mime_type'] ?? '');
            $presetId = (string) ($row['preset_id'] ?? '');
            $sha = (string) ($row['sha256'] ?? '');
            $updatedAt = isset($row['updated_at']) ? (string) $row['updated_at'] : null;

            if ($mime !== 'preset' && in_array($mime, ['image/png', 'image/jpeg', 'image/webp'], true) && $sha !== '') {
                $rawUrl = self::customAvatarUrl($pid, $sha);
                $map[$pid] = [
                    'hasCustomAvatar' => true,
                    'avatarPresetId' => '',
                    'avatarUrl' => $rawUrl,
                    'avatarDataUrl' => $rawUrl,
                    'updatedAt' => $updatedAt,
                ];
            } elseif ($presetId !== '' && isset(self::PRESETS[$presetId])) {
                $svgUrl = self::presetDataUrl($presetId);
                $map[$pid] = [
                    'hasCustomAvatar' => false,
                    'avatarPresetId' => $presetId,
                    'avatarUrl' => $svgUrl,
                    'avatarDataUrl' => $svgUrl,
                    'updatedAt' => $updatedAt,
                ];
            }
        }

        return $map;
    }

    /**
     * @return array{mimeType: string, binary: string, base64: string, dataUrl: string, sha256: string, byteLength: int, width: int, height: int}
     */
    public static function validateAndDecodeUpload(string $rawDataUrl): array
    {
        $trimmed = trim($rawDataUrl);
        if (strlen($trimmed) > 560_000) {
            throw new InvalidArgumentException('Avatar dataUrl exceeds maximum allowed payload size (380 KB max).');
        }

        $lowerHead = strtolower(substr($trimmed, 0, 512));
        foreach (['image/svg', '<svg', '<html', '<!doctype', '<script', 'javascript:', 'vbscript:', 'onload=', 'onerror='] as $forbidden) {
            if (str_contains($lowerHead, $forbidden)) {
                throw new InvalidArgumentException('SVG, HTML, and script payloads are strictly forbidden for player avatars.');
            }
        }

        if (!preg_match('#^data:image/(png|jpeg|jpg|webp);base64,([A-Za-z0-9+/=\r\n\t ]+)$#isD', $trimmed, $matches)) {
            throw new InvalidArgumentException('Avatar must be a valid base64-encoded PNG, JPEG, or WebP data URL.');
        }

        $subType = strtolower($matches[1]);
        $declaredMime = $subType === 'jpg' ? 'image/jpeg' : 'image/' . $subType;
        $cleanB64 = preg_replace('/[\r\n\t ]+/', '', $matches[2]) ?? '';
        if ($cleanB64 === '') {
            throw new InvalidArgumentException('Avatar base64 payload cannot be empty.');
        }

        $binary = base64_decode($cleanB64, true);
        if ($binary === false) {
            throw new InvalidArgumentException('Avatar image contains invalid base64 characters.');
        }

        $byteLength = strlen($binary);
        if ($byteLength < self::MIN_BYTES || $byteLength > self::MAX_BYTES) {
            throw new InvalidArgumentException(sprintf(
                'Decoded avatar size (%d bytes) must be between %d and %d bytes.',
                $byteLength,
                self::MIN_BYTES,
                self::MAX_BYTES,
            ));
        }

        $lowerBinSample = strtolower(substr($binary, 0, min(4096, $byteLength)));
        foreach (['<svg', '<script', '<!doctype html', '<html', '<?php'] as $badToken) {
            if (str_contains($lowerBinSample, $badToken)) {
                throw new InvalidArgumentException('Executable or markup content detected inside image bytes.');
            }
        }

        $detectedMime = self::detectMagicMime($binary);
        if ($detectedMime === null) {
            throw new InvalidArgumentException('Unrecognized image binary header. Only genuine PNG, JPEG, and WebP files are accepted.');
        }
        if ($detectedMime !== $declaredMime) {
            throw new InvalidArgumentException('Avatar MIME header does not match its binary file signature.');
        }

        [$width, $height] = self::extractDimensions($binary, $detectedMime);
        if ($width < self::MIN_DIMENSION || $width > self::MAX_DIMENSION || $height < self::MIN_DIMENSION || $height > self::MAX_DIMENSION) {
            throw new InvalidArgumentException(sprintf(
                'Avatar dimensions (%dx%d) must be between %dx%d and %dx%d pixels.',
                $width,
                $height,
                self::MIN_DIMENSION,
                self::MIN_DIMENSION,
                self::MAX_DIMENSION,
                self::MAX_DIMENSION,
            ));
        }

        $canonicalB64 = base64_encode($binary);
        $sha = hash('sha256', $binary);

        return [
            'mimeType' => $detectedMime,
            'binary' => $binary,
            'base64' => $canonicalB64,
            'dataUrl' => 'data:' . $detectedMime . ';base64,' . $canonicalB64,
            'sha256' => $sha,
            'byteLength' => $byteLength,
            'width' => $width,
            'height' => $height,
        ];
    }

    private static function detectMagicMime(string $binary): ?string
    {
        if (str_starts_with($binary, "\x89PNG\r\n\x1a\n")) {
            return 'image/png';
        }
        if (str_starts_with($binary, "\xFF\xD8\xFF")) {
            return 'image/jpeg';
        }
        if (strlen($binary) >= 16 && substr($binary, 0, 4) === 'RIFF' && substr($binary, 8, 4) === 'WEBP') {
            return 'image/webp';
        }
        return null;
    }

    /**
     * @return array{0: int, 1: int}
     */
    private static function extractDimensions(string $binary, string $mimeType): array
    {
        if (function_exists('getimagesizefromstring')) {
            $info = @getimagesizefromstring($binary);
            if (is_array($info) && isset($info[0], $info[1]) && (int) $info[0] > 0 && (int) $info[1] > 0) {
                return [(int) $info[0], (int) $info[1]];
            }
        }

        if ($mimeType === 'image/png' && strlen($binary) >= 24 && substr($binary, 12, 4) === 'IHDR') {
            $unpacked = unpack('Nwidth/Nheight', substr($binary, 16, 8));
            if (is_array($unpacked) && (int) ($unpacked['width'] ?? 0) > 0 && (int) ($unpacked['height'] ?? 0) > 0) {
                return [(int) $unpacked['width'], (int) $unpacked['height']];
            }
        }

        if ($mimeType === 'image/webp' && strlen($binary) >= 30) {
            $chunk = substr($binary, 12, 4);
            if ($chunk === 'VP8 ' && strlen($binary) >= 30) {
                $w = unpack('v', substr($binary, 26, 2))[1] ?? 0;
                $h = unpack('v', substr($binary, 28, 2))[1] ?? 0;
                return [$w & 0x3FFF, $h & 0x3FFF];
            }
            if ($chunk === 'VP8L' && strlen($binary) >= 25 && ord($binary[20]) === 0x2F) {
                $bits = unpack('V', substr($binary, 21, 4))[1] ?? 0;
                $w = ($bits & 0x3FFF) + 1;
                $h = (($bits >> 14) & 0x3FFF) + 1;
                return [$w, $h];
            }
            if ($chunk === 'VP8X' && strlen($binary) >= 30) {
                $w = (ord($binary[24]) | (ord($binary[25]) << 8) | (ord($binary[26]) << 16)) + 1;
                $h = (ord($binary[27]) | (ord($binary[28]) << 8) | (ord($binary[29]) << 16)) + 1;
                return [$w, $h];
            }
        }

        throw new InvalidArgumentException('Unable to verify valid raster dimensions from image header.');
    }

    private function upsertRow(
        string $playerId,
        string $mimeType,
        string $imageBase64,
        string $sha256,
        string $presetId,
        string $updatedAt,
    ): void {
        $this->database->execute(
            'INSERT INTO player_avatars (player_id, mime_type, image_base64, sha256, preset_id, updated_at)
             VALUES (:pid, :mime, :b64, :sha, :preset, :updated)
             ON CONFLICT (player_id) DO UPDATE SET
                 mime_type = EXCLUDED.mime_type,
                 image_base64 = EXCLUDED.image_base64,
                 sha256 = EXCLUDED.sha256,
                 preset_id = EXCLUDED.preset_id,
                 updated_at = EXCLUDED.updated_at',
            [
                'pid' => $playerId,
                'mime' => $mimeType,
                'b64' => $imageBase64,
                'sha' => $sha256,
                'preset' => $presetId,
                'updated' => $updatedAt,
            ],
        );
    }

    private function resolveTargetPlayerId(string $targetQuery): string
    {
        $clean = ltrim(trim($targetQuery), '#');
        if ($clean === '' || strlen($clean) > 64 || !preg_match('/^[A-Za-z0-9_-]+$/D', $clean)) {
            throw new InvalidArgumentException('Invalid player profile identifier.');
        }

        $byId = $this->database->fetchOne('SELECT id FROM players WHERE id = :pid', ['pid' => $clean]);
        if ($byId !== null && isset($byId['id'])) {
            return (string) $byId['id'];
        }

        $byName = $this->database->fetchOne(
            'SELECT id FROM players WHERE LOWER(username) = LOWER(:uname) LIMIT 1',
            ['uname' => $clean],
        );
        if ($byName !== null && isset($byName['id'])) {
            return (string) $byName['id'];
        }

        return $clean;
    }

    /**
     * @param array<string, mixed>|null $row
     * @return array<string, mixed>
     */
    private function formatAvatarRow(string $playerId, ?array $row): array
    {
        if ($row === null) {
            return [
                'ok' => true,
                'playerId' => $playerId,
                'hasCustomAvatar' => false,
                'presetId' => '',
                'mimeType' => null,
                'sha256' => null,
                'dataUrl' => null,
                'avatarUrl' => null,
                'updatedAt' => null,
            ];
        }

        $mime = (string) ($row['mime_type'] ?? '');
        $b64 = (string) ($row['image_base64'] ?? '');
        $sha = (string) ($row['sha256'] ?? '');
        $presetId = (string) ($row['preset_id'] ?? '');
        $updatedAt = isset($row['updated_at']) ? (string) $row['updated_at'] : null;

        if ($b64 !== '' && in_array($mime, ['image/png', 'image/jpeg', 'image/webp'], true)) {
            return [
                'ok' => true,
                'playerId' => $playerId,
                'hasCustomAvatar' => true,
                'presetId' => '',
                'mimeType' => $mime,
                'sha256' => $sha,
                'dataUrl' => 'data:' . $mime . ';base64,' . $b64,
                'avatarUrl' => self::customAvatarUrl($playerId, $sha),
                'updatedAt' => $updatedAt,
            ];
        }

        if ($presetId !== '' && isset(self::PRESETS[$presetId])) {
            $svgDataUrl = self::presetDataUrl($presetId);
            return [
                'ok' => true,
                'playerId' => $playerId,
                'hasCustomAvatar' => false,
                'presetId' => $presetId,
                'mimeType' => 'preset',
                'sha256' => $sha,
                'dataUrl' => $svgDataUrl,
                'avatarUrl' => $svgDataUrl,
                'updatedAt' => $updatedAt,
            ];
        }

        return [
            'ok' => true,
            'playerId' => $playerId,
            'hasCustomAvatar' => false,
            'presetId' => '',
            'mimeType' => null,
            'sha256' => null,
            'dataUrl' => null,
            'avatarUrl' => null,
            'updatedAt' => $updatedAt,
        ];
    }
}
