<?php

declare(strict_types=1);

require dirname(__DIR__) . '/bootstrap.php';

use Zone\Engine\Core\Persistence\Database;

// Independent real-HTTP integration gate. Every database, upload and process
// belongs to this run. No browser candidate database or live service is used.
$prefix = ZONE_ENGINE_ROOT . '/var/studio-media108-' . bin2hex(random_bytes(7));
$url = 'sqlite:' . $prefix . '.sqlite'; $assetRoot = $prefix . '-assets';
$previousRoot = getenv('ZONE_ASSET_ROOT'); putenv('ZONE_ASSET_ROOT=' . $assetRoot);
$engine = zone_engine($url); $db = Database::connect($url);
$passed = 0; $failed = []; $process = null; $relay = null; $relayBase = '';
$ownerSecret = bin2hex(random_bytes(32)); $relayKey = bin2hex(random_bytes(32));

function studioProof(bool $ok, string $label): void {
    global $passed, $failed;
    if ($ok) { $passed++; echo 'PASS: ' . $label . PHP_EOL; }
    else { $failed[] = $label; echo 'FAIL: ' . $label . PHP_EOL; }
}
function studioRequest(string $base, string $method, string $path, ?array $body = null, string $cookie = '', array $extra = []): array {
    $headers = ['Accept: application/json', 'Content-Type: application/json', 'Connection: close', 'Host: zone.test', 'Origin: https://zone.test', 'X-Forwarded-Proto: https'];
    if ($cookie !== '') $headers[] = 'Cookie: ' . $cookie;
    $context = stream_context_create(['http' => ['method' => $method, 'header' => implode("\r\n", [...$headers, ...$extra]), 'content' => $body === null ? '' : json_encode($body, JSON_THROW_ON_ERROR), 'ignore_errors' => true, 'timeout' => 15]]);
    $raw = @file_get_contents($base . $path, false, $context); $responseHeaders = http_get_last_response_headers() ?: [];
    preg_match('/\s(\d{3})\s/', $responseHeaders[0] ?? '', $match);
    return [(int) ($match[1] ?? 0), $raw === false || $raw === '' ? [] : json_decode($raw, true, 512, JSON_THROW_ON_ERROR), $responseHeaders];
}
function studioPort(): string {
    $socket = stream_socket_server('tcp://127.0.0.1:0', $errno, $error); if ($socket === false) throw new RuntimeException($error);
    $address = stream_socket_get_name($socket, false); fclose($socket); return $address;
}
function studioStart(string $url, string $assets, string $secret, string $relayKey, string $log): array {
    $address = studioPort();
    $environment = [...getenv(), 'ZONE_DATABASE_URL' => $url, 'DATABASE_URL' => '', 'POSTGRES_URL' => '', 'VERCEL' => '1', 'ZONE_ASSET_ROOT' => $assets,
        'ZONE_PLAYER_SESSIONS' => '1', 'ZONE_PLAYER_AUTH' => '', 'ZONE_BETA_OWNER_ACCESS' => '0', 'ZONE_ADMIN_TOKEN' => $secret, 'ZONE_ADMIN_USERNAME' => '', 'ZONE_ADMIN_PASSWORD_HASH' => '', 'ZONE_ADMIN_SESSION_SECRET' => '',
        'ZONE_ENGINE_RELAY_KEY' => $relayKey, 'ZONE_ENGINE_PUBLIC_HOSTS' => 'zone.test', 'ZONE_ENGINE_ORIGIN' => '', 'ZONE_REDIS_URL' => ''];
    $proc = proc_open([PHP_BINARY, '-S', $address, '-t', ZONE_REPOSITORY_ROOT, ZONE_ENGINE_ROOT . '/router.php'], [0 => ['pipe', 'r'], 1 => ['file', $log, 'a'], 2 => ['file', $log, 'a']], $pipes, ZONE_REPOSITORY_ROOT, $environment, ['bypass_shell' => true]);
    if (!is_resource($proc)) throw new RuntimeException('Owned Studio test process did not start.'); fclose($pipes[0]);
    $base = 'http://' . $address; $deadline = microtime(true) + 8;
    do { [$status] = studioRequest($base, 'GET', '/api/v1/health'); if ($status === 200) return [$base, $proc]; usleep(100000); } while (microtime(true) < $deadline && proc_get_status($proc)['running']);
    proc_terminate($proc); proc_close($proc); throw new RuntimeException('Owned Studio test process failed health.');
}
function studioCookie(array $headers, string $name): string {
    foreach ($headers as $header) if (stripos($header, 'Set-Cookie: ' . $name . '=') === 0) return explode(';', substr($header, 12), 2)[0];
    throw new RuntimeException('Expected HTTP cookie not issued.');
}
function studioCatalog(string $base, string $cookie): array { [$status, $draft] = studioRequest($base, 'GET', '/api/v1/admin/gameplay-catalog', null, $cookie); if ($status !== 200) throw new RuntimeException('Studio catalog unavailable.'); return $draft; }
function studioDraft(string $base, string $cookie): array { [$status, $draft] = studioRequest($base, 'GET', '/api/v1/admin/draft', null, $cookie); if ($status !== 200) throw new RuntimeException('Studio draft unavailable.'); return $draft; }
function studioUpload(string $base, string $cookie, string $name, string $bytes): array {
    [$status, $upload] = studioRequest($base, 'POST', '/api/v1/admin/assets/uploads', ['name' => $name, 'size' => strlen($bytes)], $cookie);
    if ($status !== 201) throw new RuntimeException('Upload begin rejected: ' . $status . ' ' . ($upload['error'] ?? ''));
    for ($offset = 0; $offset < strlen($bytes); $offset += 524288) {
        [$status, $chunk] = studioRequest($base, 'POST', '/api/v1/admin/assets/uploads/' . $upload['uploadId'] . '/chunks', ['offset' => $offset, 'base64' => base64_encode(substr($bytes, $offset, 524288))], $cookie);
        if ($status !== 200) throw new RuntimeException('Upload chunk rejected: ' . $status . ' ' . ($chunk['error'] ?? ''));
    }
    [$status, $asset] = studioRequest($base, 'POST', '/api/v1/admin/assets/uploads/' . $upload['uploadId'] . '/complete', [], $cookie);
    if ($status !== 200) throw new RuntimeException('Upload complete rejected: ' . $status . ' ' . ($asset['error'] ?? ''));
    return $asset;
}
function studioPublish(string $base, string $cookie): array {
    $draft = studioDraft($base, $cookie); [$status, $release] = studioRequest($base, 'POST', '/api/v1/admin/releases/publish', ['expectedFingerprint' => $draft['draftFingerprint']], $cookie);
    if ($status !== 201) throw new RuntimeException('HTTP publication failed: ' . $status . ' ' . ($release['error'] ?? ''));
    return $release;
}
function studioRelayRequest(string $base, string $key, string $method, string $path, ?array $body = null, bool $owner = false, array $extra = []): array {
    $raw = $body === null ? '' : json_encode($body, JSON_THROW_ON_ERROR);
    $headers = ['Accept: application/json', 'Content-Type: application/json', 'Connection: close', 'Origin: https://zone.test', 'X-Zone-Relay-Key: ' . $key, 'X-Zone-Client-Host: zone.test', 'X-Zone-Client-Proto: https', 'X-Zone-Client-Ip: 127.0.0.1'];
    if ($owner) { $stamp = (string) time(); $headers[] = 'X-Zone-Owner-Proof: ' . $stamp . '.' . hash_hmac('sha256', "owner-gateway:\n" . $method . "\n" . $path . "\n" . hash('sha256', $raw) . "\n" . $stamp, $key); }
    $context = stream_context_create(['http' => ['method' => $method, 'header' => implode("\r\n", [...$headers, ...$extra]), 'content' => $raw, 'ignore_errors' => true, 'timeout' => 15]]);
    $content = @file_get_contents($base . $path, false, $context); $responseHeaders = http_get_last_response_headers() ?: []; preg_match('/\s(\d{3})\s/', $responseHeaders[0] ?? '', $match);
    return [(int) ($match[1] ?? 0), $content === false || $content === '' ? [] : json_decode($content, true, 512, JSON_THROW_ON_ERROR)];
}

try {
    [$base, $process] = studioStart($url, $assetRoot, $ownerSecret, $relayKey, $prefix . '.log');
    [$status, $owner, $headers] = studioRequest($base, 'POST', '/api/v1/admin/session', ['token' => $ownerSecret]); $ownerCookie = studioCookie($headers, 'zone_admin_session');
    studioProof($status === 200 && $owner['authenticated'], 'owner uses the real isolated HTTP authorization gate');
    [$status, $session, $headers] = studioRequest($base, 'POST', '/api/v1/auth/session', []); $playerCookie = studioCookie($headers, 'zone_player_session'); $playerId = $session['playerId'];
    studioProof($status === 201 && $playerId !== 'founder-player', 'a distinct ordinary HTTP account is not an owner playtest fixture');
    [$status] = studioRequest($base, 'GET', '/api/v1/admin/assets', null, $playerCookie);
    studioProof($status === 401, 'ordinary cookie cannot enumerate the unpublished asset library');
    [$status] = studioRequest($base, 'POST', '/api/v1/admin/assets/uploads', ['name' => 'blocked.obj', 'size' => 100], $playerCookie);
    studioProof($status === 401 && (int) $db->fetchOne('SELECT COUNT(*) AS n FROM asset_uploads')['n'] === 0, 'ordinary upload request writes neither a reservation nor asset bytes');

    $obj = "o studio-proof-house\nv 0 0 0\nv 2 0 0\nv 0 3 0\nv 0 0 4\nf 1 2 3\nf 1 2 4\nf 1 3 4\nf 2 3 4\n";
    $asset = studioUpload($base, $ownerCookie, 'proof-house.obj', $obj); $assetId = $asset['id'];
    studioProof($assetId === hash('sha256', $obj) && $asset['status'] === 'queued', 'real HTTP upload preserves original hash and queues inspection instead of faking readiness');
    $catalog = studioCatalog($base, $ownerCookie);
    [$status] = studioRequest($base, 'POST', '/api/v1/admin/gameplay-catalog/properties', ['id' => 'queued-house108', 'definition' => ['price' => 100, 'happy' => 500, 'name' => ['en' => 'Queued house', 'ar' => 'منزل قيد الفحص'], 'mediaAsset' => $assetId], 'expectedRevision' => $catalog['revision']], $ownerCookie);
    studioProof($status === 422, 'queued uninspected geometry cannot be attached as a ready property');
    $work = $engine->assets()->runPending(1); $asset = $engine->assets()->get($assetId);
    studioProof($work['processed'] === 1 && $asset['status'] === 'ready' && $asset['metadata']['bounds']['size'] === [2, 3, 4], 'actual same-source worker inspects submitted geometry and computes real bounds');
    foreach (['', '?draft=1'] as $query) {
        [$status] = studioRequest($base, 'GET', '/api/v1/assets/' . $assetId . $query, null, $playerCookie);
        studioProof($status === 404, 'ordinary account cannot read unpublished metadata' . ($query === '' ? '' : ' by claiming draft=1'));
        [$status] = studioRequest($base, 'GET', '/api/v1/assets/' . $assetId . '/content' . $query, null, $playerCookie);
        studioProof($status === 404, 'ordinary account cannot read unpublished raw bytes' . ($query === '' ? '' : ' by claiming draft=1'));
    }
    [$status] = studioRequest($base, 'GET', '/api/v1/assets/' . $assetId, null, $ownerCookie);
    studioProof($status === 404, 'owner public media URL does not implicitly expose unpublished draft metadata');
    [$status, $draftAsset] = studioRequest($base, 'GET', '/api/v1/assets/' . $assetId . '?draft=1', null, $ownerCookie);
    studioProof($status === 200 && $draftAsset['id'] === $assetId, 'explicit draft=1 plus real owner cookie enables inspector metadata');
    [$status, $bytes] = studioRequest($base, 'GET', '/api/v1/assets/' . $assetId . '/content?draft=1&offset=0&length=524288', null, $ownerCookie);
    studioProof($status === 200 && base64_decode($bytes['base64'], true) === $obj, 'owner draft preview reads exact immutable uploaded bytes through the chunk endpoint');
    [$status] = studioRequest($base, 'GET', '/api/v1/assets/' . $assetId . '/content?draft=1&member=../../private', null, $ownerCookie);
    studioProof($status === 422, 'draft owner content reads still reject traversal outside the bundle');
    [$status, $boundedChunk] = studioRequest($base, 'GET', '/api/v1/assets/' . $assetId . '/content?draft=1&length=524289', null, $ownerCookie);
    studioProof($status === 200 && strlen(base64_decode($boundedChunk['base64'], true)) <= 524288, 'public content route clamps requested chunks to its bounded response size');
    $fit = ['scale' => .75, 'rotation' => [0, 90, 0], 'floorOffset' => .2, 'cameraTarget' => [0, 1, 0]];
    [$status, $fitted] = studioRequest($base, 'PUT', '/api/v1/admin/assets/' . $assetId . '/transform', $fit, $ownerCookie);
    studioProof($status === 200 && $fitted['transform'] === $fit, 'real inspector save persists all finite transform controls');
    $catalog = studioCatalog($base, $ownerCookie); $beforeCatalog = $catalog['catalogs'];
    [$status, $created] = studioRequest($base, 'POST', '/api/v1/admin/gameplay-catalog/properties', ['id' => 'house108', 'definition' => ['price' => 100, 'happy' => 500, 'name' => ['en' => 'Custom backroom', 'ar' => 'الغرفة الخلفية الخاصة'], 'mediaAsset' => $assetId], 'expectedRevision' => $catalog['revision']], $ownerCookie);
    studioProof($status === 201 && $created['created']['id'] === 'house108', 'Studio creates a property bound to the inspected uploaded model via actual HTTP');
    $catalog = studioCatalog($base, $ownerCookie);
    [$status, $updated] = studioRequest($base, 'PUT', '/api/v1/admin/gameplay-catalog/properties/house108', ['changes' => ['price' => 125], 'expectedRevision' => $catalog['revision']], $ownerCookie);
    $house = array_values(array_filter($updated['catalogs']['properties'] ?? [], fn ($row) => $row['id'] === 'house108'))[0] ?? [];
    studioProof($status === 200 && ($house['mediaAsset'] ?? '') === $assetId && ($house['name']['ar'] ?? '') === 'الغرفة الخلفية الخاصة' && $house['price'] === 125, 'price-only save retains uploaded media and untouched bilingual fields');
    [$status, $bootstrapBefore] = studioRequest($base, 'GET', '/api/v1/game/bootstrap', null, $playerCookie);
    studioProof(!isset($bootstrapBefore['mediaAssets'][$assetId]) && !in_array('house108', array_column($bootstrapBefore['content']['gameplayCatalog']['properties'], 'id'), true), 'new house and uploaded media stay out of ordinary published bootstrap before publication');

    $beforeCrimeRules = studioDraft($base, $ownerCookie);
    [$status, $crimeRuleEdit] = studioRequest($base, 'PUT', '/api/v1/admin/crimes/searchforcash', ['mastery_per_success' => 9], $ownerCookie);
    $afterCrimeRules = studioDraft($base, $ownerCookie);
    studioProof($status === 200 && $crimeRuleEdit['crime']['mastery_per_success'] === 9 && $beforeCrimeRules['draftFingerprint'] !== $afterCrimeRules['draftFingerprint'], 'crime-rule-only edit invalidates the reviewed publication fingerprint');
    [$staleStatus] = studioRequest($base, 'POST', '/api/v1/admin/releases/publish', ['expectedFingerprint' => $beforeCrimeRules['draftFingerprint']], $ownerCookie);
    studioProof($staleStatus === 409, 'stale reviewed publication cannot silently publish an unseen crime-rule edit');

    // The renderer consumes mediaAsset as a visual model/image, not an audio
    // field. The binding list must enforce the same type rule as item CRUD.
    $mp3 = str_repeat("\xff\xfb\x90\x64" . str_repeat("\0", 413), 8);
    $sound = studioUpload($base, $ownerCookie, 'bounded-test-silence.mp3', $mp3); $engine->assets()->runPending(1);
    $draft = studioDraft($base, $ownerCookie); $valid = $draft['manifest']; $audioBinding = $valid;
    $audioBinding['mediaBindings'] = [['targetType' => 'item', 'targetId' => 'smallkit', 'assetId' => $sound['id']]];
    [$status] = studioRequest($base, 'PUT', '/api/v1/admin/draft', ['manifest' => $audioBinding, 'expectedFingerprint' => $draft['draftFingerprint']], $ownerCookie);
    studioProof($status === 422, 'item visual media binding rejects audio just like item CRUD');
    if ($status === 200) $engine->saveReleaseDraft($valid, 'isolated-studio108-restoration');

    // Null and scalar policies must fail at draft save, not silently become a
    // default-enabled runtime policy. Each probe restores a valid draft.
    foreach (['null' => null, 'scalar boolean' => true, 'scalar integer' => 2, 'scalar string' => 'enabled', 'null enabled' => ['enabled' => null], 'null tick interval' => ['tickSeconds' => null]] as $label => $policy) {
        $draft = studioDraft($base, $ownerCookie); $valid = $draft['manifest']; $changed = $valid; $changed['worldPolicy'] = $policy;
        [$status] = studioRequest($base, 'PUT', '/api/v1/admin/draft', ['manifest' => $changed, 'expectedFingerprint' => $draft['draftFingerprint']], $ownerCookie);
        studioProof($status === 422, 'Studio rejects worldPolicy ' . $label . ' instead of silently enabling defaults');
        if ($status === 200) $engine->saveReleaseDraft($valid, 'isolated-studio108-restoration');
    }
    $draft = studioDraft($base, $ownerCookie); $valid = $draft['manifest']; $badBindings = $valid; $badBindings['mediaBindings'] = null;
    [$status] = studioRequest($base, 'PUT', '/api/v1/admin/draft', ['manifest' => $badBindings, 'expectedFingerprint' => $draft['draftFingerprint']], $ownerCookie);
    studioProof($status === 422, 'Studio rejects null mediaBindings instead of accepting a non-list');
    if ($status === 200) $engine->saveReleaseDraft($valid, 'isolated-studio108-restoration');

    $catalog = studioCatalog($base, $ownerCookie); $listings = [['item' => 'smallkit', 'qty' => 4, 'seller' => 'Owner-authored inventory']];
    [$status, $stockDraft] = studioRequest($base, 'PUT', '/api/v1/admin/shop-catalog', ['listings' => $listings, 'expectedRevision' => $catalog['revision']], $ownerCookie);
    studioProof($status === 200 && $stockDraft['catalogs']['market'] === $listings && $stockDraft['catalogs']['items'] === $beforeCatalog['items'], 'shop-only draft save changes inventory without resetting item rules or other definitions');
    [$status, $stillOld] = studioRequest($base, 'GET', '/api/v1/game/bootstrap', null, $playerCookie);
    studioProof($stillOld['content']['gameplayCatalog']['market'] === $bootstrapBefore['content']['gameplayCatalog']['market'], 'shop draft stock does not leak into ordinary published rules');
    [$status] = studioRequest($base, 'PUT', '/api/v1/admin/shop-catalog', ['listings' => [], 'expectedRevision' => $catalog['revision']], $ownerCookie);
    studioProof($status === 409 && studioCatalog($base, $ownerCookie)['catalogs']['market'] === $listings, 'stale shop save conflicts without erasing newer inventory');
    $release = studioPublish($base, $ownerCookie);
    [$status, $published] = studioRequest($base, 'GET', '/api/v1/assets/' . $assetId, null, $playerCookie);
    studioProof($status === 200 && $published['transform'] === $fit, 'ordinary player reads the actual immutable published fitted asset after publication');
    [$status, $publishedBootstrap] = studioRequest($base, 'GET', '/api/v1/game/bootstrap', null, $playerCookie);
    studioProof($status === 200 && $publishedBootstrap['mediaAssets'][$assetId]['transform'] === $fit && $publishedBootstrap['content']['gameplayCatalog']['market'] === $listings, 'published bootstrap contains exact authored shop stock and fitted media metadata');
    $newFit = [...$fit, 'scale' => 1.5, 'floorOffset' => .5];
    $beforeFit = studioDraft($base, $ownerCookie);
    studioRequest($base, 'PUT', '/api/v1/admin/assets/' . $assetId . '/transform', $newFit, $ownerCookie);
    $afterFit = studioDraft($base, $ownerCookie);
    studioProof($beforeFit['draftFingerprint'] !== $afterFit['draftFingerprint'], 'bound-model fitted transform edit invalidates the reviewed publication fingerprint');
    [$staleFitStatus] = studioRequest($base, 'POST', '/api/v1/admin/releases/publish', ['expectedFingerprint' => $beforeFit['draftFingerprint']], $ownerCookie);
    studioProof($staleFitStatus === 409, 'stale reviewed publication cannot silently adopt an unseen fitted transform');
    [$status, $frozen] = studioRequest($base, 'GET', '/api/v1/assets/' . $assetId, null, $ownerCookie);
    [$draftStatus, $latestFit] = studioRequest($base, 'GET', '/api/v1/assets/' . $assetId . '?draft=1', null, $ownerCookie);
    studioProof($status === 200 && $frozen['transform'] === $fit && $draftStatus === 200 && $latestFit['transform'] === $newFit, 'later inspector edits remain draft-only and cannot move an already-published house');
    [$status, $publishedBytes] = studioRequest($base, 'GET', '/api/v1/assets/' . $assetId . '/content', null, $playerCookie);
    studioProof($status === 200 && base64_decode($publishedBytes['base64'], true) === $obj && hash_file('sha256', $assetRoot . '/objects/' . $assetId . '/source') === $assetId, 'normalizer edits never rewrite original model bytes or published content');
    $draft = studioDraft($base, $ownerCookie); studioPublish($base, $ownerCookie);
    [$status, $refitPublished] = studioRequest($base, 'GET', '/api/v1/assets/' . $assetId, null, $playerCookie);
    studioProof($status === 200 && $refitPublished['transform'] === $newFit, 'deliberate new publication adopts the newer fitted transform');
    [$status, $state] = studioRequest($base, 'GET', '/api/v1/gameplay', null, $playerCookie);
    [$status, $bought] = studioRequest($base, 'POST', '/api/v1/gameplay/action', ['action' => 'property.buy', 'id' => 'house108', 'expectedVersion' => $state['state']['version']], $playerCookie);
    studioProof($status === 200 && $bought['result']['cashDelta'] === -125 && $bought['safehouses'][array_search('house108', array_column($bought['safehouses'], 'id'), true)]['enterable'], 'ordinary HTTP player actually buys the published uploaded house at its authored price');
    // Test signed owner proofs over the actual Node relay with a PC engine
    // deliberately holding no owner credential (the production split).
    proc_terminate($process); proc_close($process); $process = null;
    [$base, $process] = studioStart($url, $assetRoot, '', $relayKey, $prefix . '.log');
    $relayAddress = studioPort(); $relayPort = (int) substr(strrchr($relayAddress, ':'), 1); $upstreamPort = (int) parse_url($base, PHP_URL_PORT); $relayBase = 'http://' . $relayAddress;
    $relayEnv = [...getenv(), 'ZONE_ENGINE_RELAY_KEY' => $relayKey, 'ZONE_ENGINE_PUBLIC_HOSTS' => 'zone.test', 'ZONE_ENGINE_LOCAL_PORT' => (string) $upstreamPort, 'ZONE_ENGINE_RELAY_PORT' => (string) $relayPort];
    $relay = proc_open(['node', ZONE_ENGINE_ROOT . '/bin/relay.mjs'], [0 => ['pipe', 'r'], 1 => ['file', $prefix . '-relay.log', 'a'], 2 => ['file', $prefix . '-relay.log', 'a']], $pipes, ZONE_REPOSITORY_ROOT, $relayEnv, ['bypass_shell' => true]);
    if (!is_resource($relay)) throw new RuntimeException('Owned relay test failed to start.'); fclose($pipes[0]);
    $deadline = microtime(true) + 8;
    do { [$relayStatus] = studioRelayRequest($relayBase, $relayKey, 'GET', '/api/v1/health'); if ($relayStatus === 200) break; usleep(100000); } while (microtime(true) < $deadline && proc_get_status($relay)['running']);
    studioProof($relayStatus === 200, 'actual owned Node relay and credential-free PC engine become healthy together');
    $otherObj = $obj . '# private second model' . "\n"; $pending = $engine->assets()->begin(['name' => 'private.obj', 'size' => strlen($otherObj)], 'isolated-studio108');
    $engine->assets()->append($pending['uploadId'], ['offset' => 0, 'base64' => base64_encode($otherObj)], 'isolated-studio108');
    $private = $engine->assets()->complete($pending['uploadId'], 'isolated-studio108'); $engine->assets()->runPending(1); $privateId = $private['id'];
    [$status] = studioRelayRequest($relayBase, $relayKey, 'GET', '/api/v1/assets/' . $privateId . '?draft=1');
    studioProof($status === 404, 'relay cannot expose an unpublished draft merely from the draft query flag');
    [$status, $proofAsset] = studioRelayRequest($relayBase, $relayKey, 'GET', '/api/v1/assets/' . $privateId . '?draft=1', null, true);
    studioProof($status === 200 && $proofAsset['id'] === $privateId, 'signed owner proof survives the real relay only for explicit draft inspection');
    [$status] = studioRelayRequest($relayBase, $relayKey, 'GET', '/api/v1/assets/' . $privateId, null, true);
    studioProof($status === 404, 'even a valid signed owner proof does not implicitly publish a private model');
    [$status] = studioRelayRequest($relayBase, $relayKey, 'GET', '/api/v1/assets/' . $privateId . '?draft=1', null, false, ['X-Zone-Gateway-Owner: 1']);
    studioProof($status === 404, 'caller-supplied gateway owner header cannot forge a real relay proof');
    [$status, $relayCatalog] = studioRelayRequest($relayBase, $relayKey, 'GET', '/api/v1/admin/gameplay-catalog', null, true);
    if ($status !== 200) throw new RuntimeException('Signed relay catalog read unavailable.');
    $largeListings = array_fill(0, 600, ['item' => 'smallkit', 'qty' => 1, 'seller' => str_repeat('S', 120)]);
    [$status, $largeStockResponse] = studioRelayRequest($relayBase, $relayKey, 'PUT', '/api/v1/admin/shop-catalog', ['listings' => $largeListings, 'expectedRevision' => $relayCatalog['revision']], true);
    if ($status !== 200) echo 'DIAGNOSTIC: valid large shop save returned HTTP ' . $status . ': ' . ($largeStockResponse['error'] ?? 'no JSON error') . PHP_EOL;
    studioProof($status === 200, 'schema-valid large shop draft crosses the same owner transport as its supported catalog size');
    $large = $obj . '#' . str_repeat(' ', 524288 - strlen($obj) - 1);
    [$status, $begin] = studioRelayRequest($relayBase, $relayKey, 'POST', '/api/v1/admin/assets/uploads', ['name' => 'large-proof.obj', 'size' => strlen($large)], true);
    studioProof($status === 201, 'real signed relay authorizes an owned large-model upload reservation');
    if ($status === 201) {
        $chunkPath = '/api/v1/admin/assets/uploads/' . $begin['uploadId'] . '/chunks';
        [$status, $chunk] = studioRelayRequest($relayBase, $relayKey, 'POST', $chunkPath, ['offset' => 0, 'base64' => base64_encode($large)], true);
        studioProof($status === 200 && $chunk['receivedBytes'] === 524288, 'actual 512KiB decoded asset chunk crosses the relay above the normal64KiB request cap');
        [$status, $complete] = studioRelayRequest($relayBase, $relayKey, 'POST', '/api/v1/admin/assets/uploads/' . $begin['uploadId'] . '/complete', [], true);
        studioProof($status === 200 && $complete['id'] === hash('sha256', $large), 'large relay upload finalization preserves exact submitted binary hash');
    }
    echo 'STUDIO MEDIA108 EVIDENCE: ' . json_encode(['database' => $prefix . '.sqlite', 'assets' => $assetRoot, 'actualHttp' => true, 'actualNodeRelay' => true, 'sourceRevision' => 'working candidate', 'productionWrites' => false, 'failures' => $failed], JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES) . PHP_EOL;
} catch (Throwable $error) {
    $failed[] = 'Uncaught test failure: ' . $error->getMessage(); echo 'FAIL: ' . $error->getMessage() . PHP_EOL;
} finally {
    if (is_resource($relay)) {
        $context = stream_context_create(['http' => ['method' => 'POST', 'header' => 'X-Zone-Relay-Key: ' . $relayKey . "\r\nContent-Length: 0\r\nConnection: close", 'content' => '', 'ignore_errors' => true, 'timeout' => 3]]);
        @file_get_contents($relayBase . '/__zone_relay_stop', false, $context);
        if (!proc_get_status($relay)['running']) proc_close($relay);
        else { usleep(250000); if (!proc_get_status($relay)['running']) proc_close($relay); else $failed[] = 'Owned relay did not stop gracefully; process handle retained, no Node kill issued.'; }
    }
    if (is_resource($process)) { proc_terminate($process); proc_close($process); }
    if ($previousRoot === false) putenv('ZONE_ASSET_ROOT'); else putenv('ZONE_ASSET_ROOT=' . $previousRoot);
}
echo 'STUDIO MEDIA108 RESULT: ' . $passed . ' passed, ' . count($failed) . ' failed' . PHP_EOL;
exit($failed === [] ? 0 : 1);
