<?php
declare(strict_types=1);
require dirname(__DIR__) . '/bootstrap.php';

$passed = 0;
function previewProof110(bool $ok, string $label): void { global $passed; if (!$ok) throw new RuntimeException('FAIL: ' . $label); $passed++; echo 'PASS: ' . $label . PHP_EOL; }
function previewRequest110(string $base, string $method, string $path, ?array $body = null, string $cookie = ''): array {
    $headers = ['Host: preview110.test','X-Forwarded-Proto: https','Origin: https://preview110.test','Accept: application/json','Content-Type: application/json','Connection: close'];
    if ($cookie !== '') $headers[] = 'Cookie: ' . $cookie;
    $context = stream_context_create(['http' => ['method' => $method,'header' => implode("\r\n",$headers),'content' => $body === null ? '' : json_encode($body,JSON_THROW_ON_ERROR),'ignore_errors' => true,'timeout' => 10]]);
    $raw = @file_get_contents($base . $path,false,$context); $responseHeaders = http_get_last_response_headers() ?: [];
    preg_match('/\s(\d{3})\s/',$responseHeaders[0] ?? '',$match);
    return [(int)($match[1] ?? 0),$raw === false || $raw === '' ? [] : json_decode($raw,true,512,JSON_THROW_ON_ERROR),$responseHeaders];
}
$prefix = ZONE_ENGINE_ROOT . '/var/crime-preview110-http-' . bin2hex(random_bytes(7));
$socket = stream_socket_server('tcp://127.0.0.1:0',$errno,$error); if (!$socket) throw new RuntimeException($error);
$address = stream_socket_get_name($socket,false); fclose($socket); $base = 'http://' . $address;
$environment = [...getenv(),'ZONE_DATABASE_URL' => 'sqlite:' . $prefix . '.sqlite','DATABASE_URL' => '','POSTGRES_URL' => '','ZONE_REDIS_URL' => '',
    'ZONE_ENGINE_RELAY_KEY' => '', 'VERCEL' => '1','ZONE_ADMIN_TOKEN' => 'isolated-crime-preview110-secret','ZONE_PLAYER_AUTH' => '','ZONE_PLAYER_SESSIONS' => '1'];
$process = proc_open([PHP_BINARY,'-S',$address,'-t',ZONE_REPOSITORY_ROOT,ZONE_ENGINE_ROOT . '/router.php'],[0 => ['pipe','r'],1 => ['file',$prefix . '.log','a'],2 => ['file',$prefix . '.log','a']],$pipes,ZONE_REPOSITORY_ROOT,$environment,['bypass_shell' => true]);
if (!is_resource($process)) throw new RuntimeException('Isolated preview HTTP server could not start.'); fclose($pipes[0]);
try {
    for ($i=0;$i<50;$i++) { [$status] = previewRequest110($base,'GET','/api/v1/health'); if ($status === 200) break; usleep(100000); }
    previewProof110($status === 200,'new isolated SQLite HTTP engine becomes healthy');
    [$status] = previewRequest110($base,'PUT','/api/v1/admin/crimes/graffiti',['cash_max' => 801]);
    previewProof110($status === 401,'crime preview save remains owner-authenticated');
    [$status,,$headers] = previewRequest110($base,'POST','/api/v1/admin/session',['token' => 'isolated-crime-preview110-secret']);
    $owner = ''; foreach ($headers as $header) if (stripos($header,'Set-Cookie: ') === 0) $owner = explode(';',substr($header,12),2)[0];
    previewProof110($status === 200 && $owner !== '','real owner HTTP session is established without production credentials');
    [, $before] = previewRequest110($base,'GET','/api/v1/admin/crimes',null,$owner); $before = array_column($before['crimes'],null,'id');
    [, $bootstrap] = previewRequest110($base,'GET','/api/v1/game/bootstrap'); $baseline = array_column($bootstrap['content']['crimes'],null,'id');
    previewProof110(count($before) === 31 && count(array_filter($before,fn($crime) => ($crime['category'] ?? 'search') === 'search')) === 6 && $before['bootlegging']['category'] === 'boot','initial admin GET retains all 31 crimes, six Search routes and the Boot route');
    foreach (['graffiti' => ['cash_max' => 801],'bootlegging' => ['cash_max' => 1001],'lab' => ['cash_max' => 2001]] as $id => $changes) {
        [$status,$response] = previewRequest110($base,'PUT','/api/v1/admin/crimes/' . $id,[...$changes,'category' => 'forged','crime_xp_required' => 999999,'failure' => 'forged','penalty_minutes' => 999,'description' => 'client preview spoof'], $owner);
        $saved = $response['crime'] ?? [];
        previewProof110($status === 200 && $saved['id'] === $id && preg_match('/^[a-f0-9]{32}$/D',$saved['correlationId'] ?? '') === 1,'actual PUT ' . $id . ' returns its saved crime and original audit correlation');
        foreach (['category','crime_xp_required','failure','penalty_minutes','description'] as $field) {
            previewProof110(($saved[$field] ?? null) === ($baseline[$id][$field] ?? null),'actual PUT ' . $id . ' preserves server-owned ' . $field . ' instead of client preview metadata');
        }
        [, $loaded] = previewRequest110($base,'GET','/api/v1/admin/crimes',null,$owner); $loaded = array_column($loaded['crimes'],null,'id');
        unset($saved['correlationId']);
        previewProof110($saved === $loaded[$id] && $saved['cash_max'] === $changes['cash_max'],'actual PUT ' . $id . ' response equals subsequent enriched admin GET with its real authored reward');
        $before[$id] = $saved; // Mirror Studio replacing a single saved row.
    }
    previewProof110(count(array_filter($before,fn($crime) => ($crime['category'] ?? 'search') === 'search')) === 6 && $before['bootlegging']['crime_xp_required'] === 150 && $before['lab']['failure'] === 'hosp','Studio-style immediate response replacement preserves category counts, XP gates and Hospital metadata');
    [, $after] = previewRequest110($base,'GET','/api/v1/game/bootstrap');
    previewProof110($after['release']['id'] === $bootstrap['release']['id'] && $after['content']['crimes'] === $bootstrap['content']['crimes'],'draft saves do not alter active release identity or ordinary-player definitions');
} finally {
    // Only this test-owned ephemeral server, never an existing runtime.
    proc_terminate($process); proc_close($process);
}
echo 'CRIME PREVIEW110 HTTP EVIDENCE: new isolated SQLite database; real owner GET/PUT; no browser or live publication claim.' . PHP_EOL;
echo "CRIME PREVIEW110 HTTP RESULT: {$passed} passed, 0 failed\n";
