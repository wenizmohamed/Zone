<?php
declare(strict_types=1);
require dirname(__DIR__) . '/bootstrap.php';
$socket = stream_socket_server('tcp://127.0.0.1:0', $errno, $error);
if (!$socket) throw new RuntimeException($error);
$address = stream_socket_get_name($socket, false); fclose($socket);
$prefix = ZONE_ENGINE_ROOT . '/var/private-static-' . bin2hex(random_bytes(6));
$process = proc_open([PHP_BINARY, '-S', $address, '-t', ZONE_REPOSITORY_ROOT, ZONE_ENGINE_ROOT . '/router.php'], [0 => ['pipe', 'r'], 1 => ['file', $prefix . '.log', 'a'], 2 => ['file', $prefix . '.log', 'a']], $pipes, ZONE_REPOSITORY_ROOT, [...getenv(), 'ZONE_DATABASE_URL' => 'sqlite:' . $prefix . '.sqlite', 'VERCEL' => '', 'ZONE_PLAYER_SESSIONS' => '1'], ['bypass_shell' => true]);
if (!is_resource($process)) throw new RuntimeException('Private path test server did not start.'); fclose($pipes[0]);
$count = 0;
function staticRequest(string $address, string $path): array {
    $connection = @stream_socket_client('tcp://' . $address, $error, $message, 2);
    if (!$connection) return [0, ''];
    fwrite($connection, "GET {$path} HTTP/1.1\r\nHost: {$address}\r\nConnection: close\r\n\r\n");
    $response = stream_get_contents($connection); fclose($connection);
    preg_match('/HTTP\/1\.[01] (\d+)/', $response, $match);
    return [(int) ($match[1] ?? 0), explode("\r\n\r\n", $response, 2)[1] ?? ''];
}
function staticProof(bool $ok, string $label): void { global $count; if (!$ok) throw new RuntimeException('FAIL: ' . $label); $count++; echo 'PASS: ' . $label . PHP_EOL; }
try {
    for ($i = 0; $i < 50; $i++) { [$status] = staticRequest($address, '/favicon.svg'); if ($status === 200) break; usleep(100000); }
    foreach (['/.env.example', '/%2eenv.example', '/%252eenv.example', '/.tools/php-8.5.10/php.ini', '/%2etools/local-beta-config.json', '/.vercel/project.json', '/.git/config', '/engine/var/' . basename($prefix) . '.log', '/engine/bin/test.ps1', '/engine/database/schema.sqlite.sql', '/engine%2fvar/zone-engine.sqlite', '/engine%5cvar/zone-engine.sqlite', '/assets/../.env.example', '/docs/README.md', '/README.md'] as $path) {
        [$status, $body] = staticRequest($address, $path);
        staticProof(in_array($status, [403, 404], true), 'private path never serves repository bytes: ' . $path);
    }
    foreach (['/favicon.svg', '/support.js', '/assets/zone-design.css', '/dist/city-map-torn.html', '/engine/assets/engine.css', '/admin-studio.js', '/engine/assets/studio-engine.css'] as $path) {
        [$status, $body] = staticRequest($address, $path);
        staticProof($status === 200 && strlen($body) > 0, 'legitimate public asset remains available: ' . $path);
    }
    [$status, $body] = staticRequest($address, '/engine?lang=en');
    $studioCss = file_get_contents(ZONE_ENGINE_ROOT . '/public/assets/studio-engine.css');
    staticProof($status === 200 && str_contains($body, '<style id="engine-studio-style">' . $studioCss . '</style>'), 'actual PHP HTTP Engine response embeds the exact reviewed Studio stylesheet');
    staticProof(!str_contains($body, 'href="/engine/assets/studio-engine.css'), 'Engine page does not request a route rejected by the existing production relay');
} finally { proc_terminate($process); proc_close($process); }
echo 'PRIVATE STATIC RESULT: ' . $count . ' passed, 0 failed' . PHP_EOL;
