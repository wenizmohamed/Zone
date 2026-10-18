<?php
declare(strict_types=1);
require dirname(__DIR__) . '/bootstrap.php';

use Zone\Engine\Core\Persistence\Database;

// One connected HTTP authoring-to-player journey. These deliberately simple
// disk OBJ fixtures prove transport and binding, not accepted house/weapon art.
// No inherited database/cache, owner playtest grants, browser or live writes.
$run114 = ZONE_ENGINE_ROOT . '/var/studio114-' . bin2hex(random_bytes(8));
if (!mkdir($run114, 0777, true) && !is_dir($run114)) throw new RuntimeException('Cannot create isolated Studio evidence directory.');
$database114 = 'sqlite:' . $run114 . '/game.sqlite'; $assets114 = $run114 . '/assets';
$previousAsset114 = getenv('ZONE_ASSET_ROOT'); $previousRedis114 = getenv('ZONE_REDIS_URL');
putenv('ZONE_ASSET_ROOT=' . $assets114); putenv('ZONE_REDIS_URL=');
$relayKey114 = bin2hex(random_bytes(32)); $base114 = ''; $php114 = null; $relay114 = null; $passed114 = 0; $failures114 = []; $worker114 = []; $helpers114 = [];
$sourceFiles114 = ['admin.js', 'admin-studio.js', 'admin-assets.js', 'engine/router.php', 'engine/bin/relay.mjs', 'engine/bin/worker.php',
    'engine/src/Application/GameEngine.php', 'engine/src/Core/Game/ProgressionService.php', 'engine/src/Core/Game/WorldDirector.php',
    'engine/src/Core/Content/GameplayCatalog.php', 'engine/src/Core/Content/ContentManager.php', 'engine/src/Core/Content/MediaReferences.php',
    'engine/src/Core/Publishing/ReleaseManager.php', 'engine/src/Core/Media/AssetLibrary.php', 'engine/src/Core/Media/AssetInspector.php', 'engine/tests/studio-journey114.php'];
$sourceHashes114 = []; foreach ($sourceFiles114 as $path) $sourceHashes114[$path] = hash_file('sha256', ZONE_REPOSITORY_ROOT . '/' . $path);
$evidence114 = ['baseRevision' => getenv('ZONE_TEST_REVISION') ?: 'unreported', 'sourceRoot' => ZONE_REPOSITORY_ROOT, 'sourceFingerprints' => $sourceHashes114,
    'database' => $run114 . '/game.sqlite', 'assetRoot' => $assets114, 'actualHttp' => true, 'actualNodeRelay' => true, 'browserPixels' => false,
    'browserFilePicker' => false, 'ownerPlaytestGrants' => false, 'balanceOrInventoryFixtures' => false, 'productionWrites' => 0];
$environment114 = [...getenv(), 'ZONE_DATABASE_URL' => $database114, 'DATABASE_URL' => '', 'POSTGRES_URL' => '', 'VERCEL' => '1',
    'ZONE_ASSET_ROOT' => $assets114, 'ZONE_REDIS_URL' => '', 'ZONE_PLAYER_SESSIONS' => '1', 'ZONE_PLAYER_AUTH' => '',
    'ZONE_ADMIN_TOKEN' => '', 'ZONE_ADMIN_USERNAME' => '', 'ZONE_ADMIN_PASSWORD_HASH' => '', 'ZONE_ADMIN_SESSION_SECRET' => '',
    'ZONE_ENGINE_RELAY_KEY' => $relayKey114, 'ZONE_ENGINE_PUBLIC_HOSTS' => 'zone.test', 'ZONE_ENGINE_ORIGIN' => ''];

function proof114(bool $ok, string $label): void {
    global $passed114;
    if (!$ok) throw new RuntimeException('FAIL: ' . $label);
    $passed114++; echo 'PASS: ' . $label . PHP_EOL;
}
function port114(): string {
    $socket = stream_socket_server('tcp://127.0.0.1:0', $errno, $error);
    if ($socket === false) throw new RuntimeException($error);
    $address = stream_socket_get_name($socket, false); fclose($socket); return $address;
}
function request114(string $method, string $path, ?array $body = null, string $cookie = '', bool $owner = false): array {
    global $base114, $relayKey114;
    $raw = $body === null ? '' : json_encode($body, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE);
    $headers = ['Accept: application/json', 'Content-Type: application/json', 'Connection: close', 'Origin: https://zone.test',
        'X-Zone-Relay-Key: ' . $relayKey114, 'X-Zone-Client-Host: zone.test', 'X-Zone-Client-Proto: https', 'X-Zone-Client-Ip: 127.0.0.1'];
    if ($cookie !== '') $headers[] = 'Cookie: ' . $cookie;
    if ($owner) {
        $stamp = (string) time();
        $headers[] = 'X-Zone-Owner-Proof: ' . $stamp . '.' . hash_hmac('sha256', "owner-gateway:\n" . $method . "\n" . $path . "\n" . hash('sha256', $raw) . "\n" . $stamp, $relayKey114);
    }
    $context = stream_context_create(['http' => ['method' => $method, 'header' => implode("\r\n", $headers), 'content' => $raw, 'ignore_errors' => true, 'timeout' => 12]]);
    $result = @file_get_contents($base114 . $path, false, $context); $responseHeaders = http_get_last_response_headers() ?: [];
    preg_match('/\s(\d{3})\s/', $responseHeaders[0] ?? '', $match);
    return [(int) ($match[1] ?? 0), $result === false || $result === '' ? [] : json_decode($result, true, 512, JSON_THROW_ON_ERROR), $responseHeaders];
}
function expect114(int $expected, string $method, string $path, ?array $body = null, string $cookie = '', bool $owner = false): array {
    [$status, $result, $headers] = request114($method, $path, $body, $cookie, $owner);
    if ($status !== $expected) throw new RuntimeException($method . ' ' . $path . ' returned ' . $status . ', expected ' . $expected . ': ' . ($result['error'] ?? 'no error body'));
    return [$result, $headers];
}
function catalog114(): array { return expect114(200, 'GET', '/api/v1/admin/gameplay-catalog', null, '', true)[0]; }
function draft114(): array { return expect114(200, 'GET', '/api/v1/admin/draft', null, '', true)[0]; }
function create114(string $category, string $id, array $definition): array {
    return expect114(201, 'POST', '/api/v1/admin/gameplay-catalog/' . $category, ['id' => $id, 'definition' => $definition, 'expectedRevision' => catalog114()['revision']], '', true)[0];
}
function edit114(string $category, string $id, array $changes): array {
    return expect114(200, 'PUT', '/api/v1/admin/gameplay-catalog/' . $category . '/' . $id, ['changes' => $changes, 'expectedRevision' => catalog114()['revision']], '', true)[0];
}
function action114(string $cookie, string $action, string $id, ?int $expectedPrice = null): array {
    $state = expect114(200, 'GET', '/api/v1/gameplay', null, $cookie)[0];
    $body = ['action' => $action, 'id' => $id, 'expectedVersion' => $state['state']['version']];
    if ($expectedPrice !== null) $body['expectedPrice'] = $expectedPrice;
    return expect114(200, 'POST', '/api/v1/gameplay/action', $body, $cookie)[0];
}
function player114(): array {
    [$session, $headers] = expect114(201, 'POST', '/api/v1/auth/session', []);
    foreach ($headers as $header) if (stripos($header, 'Set-Cookie: zone_player_session=') === 0) return [$session['playerId'], explode(';', substr($header, 12), 2)[0]];
    throw new RuntimeException('Ordinary session cookie was not issued.');
}
function upload114(string $path): array {
    $bytes = file_get_contents($path);
    [$upload] = expect114(201, 'POST', '/api/v1/admin/assets/uploads', ['name' => basename($path), 'size' => strlen($bytes)], '', true);
    for ($offset = 0; $offset < strlen($bytes); $offset += 524288) expect114(200, 'POST', '/api/v1/admin/assets/uploads/' . $upload['uploadId'] . '/chunks', ['offset' => $offset, 'base64' => base64_encode(substr($bytes, $offset, 524288))], '', true);
    return expect114(200, 'POST', '/api/v1/admin/assets/uploads/' . $upload['uploadId'] . '/complete', [], '', true)[0];
}
function publish114(): array {
    return expect114(201, 'POST', '/api/v1/admin/releases/publish', ['expectedFingerprint' => draft114()['draftFingerprint']], '', true)[0];
}
function worker114(): void {
    global $environment114, $worker114, $run114;
    $index = count($worker114); $log = $run114 . '/worker-' . $index . '.log';
    $process = proc_open([PHP_BINARY, ZONE_ENGINE_ROOT . '/bin/worker.php', '--once', '--role=studio', '--id=studio114'], [0 => ['pipe', 'r'], 1 => ['file', $log, 'w'], 2 => ['file', $log, 'a']], $pipes, ZONE_REPOSITORY_ROOT, $environment114, ['bypass_shell' => true]);
    if (!is_resource($process)) throw new RuntimeException('Owned one-cycle Studio worker did not start.');
    fclose($pipes[0]); $exit = proc_close($process);
    if ($exit !== 0) throw new RuntimeException('Owned Studio worker failed: ' . $exit . ' ' . file_get_contents($log));
    $events = array_map(static fn (string $line): array => json_decode($line, true, 32, JSON_THROW_ON_ERROR), array_values(array_filter(explode("\n", file_get_contents($log)))));
    $worker114[] = $events;
    if (!array_filter($events, static fn (array $event): bool => $event['event'] === 'cycle' && $event['assets']['processed'] === 1)) throw new RuntimeException('Studio worker did not inspect the queued upload.');
}

try {
    $engine114 = zone_engine($database114); $db114 = Database::connect($database114);
    $baseline114 = $engine114->publishRelease('isolated-studio114-baseline');
    $address = port114(); $upstreamPort = (int) substr(strrchr($address, ':'), 1);
    $php114 = proc_open([PHP_BINARY, '-S', $address, '-t', ZONE_REPOSITORY_ROOT, ZONE_ENGINE_ROOT . '/router.php'], [0 => ['pipe', 'r'], 1 => ['file', $run114 . '/php.log', 'a'], 2 => ['file', $run114 . '/php.log', 'a']], $pipes, ZONE_REPOSITORY_ROOT, $environment114, ['bypass_shell' => true]);
    if (!is_resource($php114)) throw new RuntimeException('Owned HTTP engine failed to start.'); fclose($pipes[0]);
    $helpers114['phpPid'] = proc_get_status($php114)['pid'];
    $relayAddress = port114(); $relayPort = (int) substr(strrchr($relayAddress, ':'), 1); $base114 = 'http://' . $relayAddress;
    $relay114 = proc_open(['node', ZONE_ENGINE_ROOT . '/bin/relay.mjs'], [0 => ['pipe', 'r'], 1 => ['file', $run114 . '/relay.log', 'a'], 2 => ['file', $run114 . '/relay.log', 'a']], $pipes, ZONE_REPOSITORY_ROOT, [...$environment114, 'ZONE_ENGINE_LOCAL_PORT' => (string) $upstreamPort, 'ZONE_ENGINE_RELAY_PORT' => (string) $relayPort], ['bypass_shell' => true]);
    if (!is_resource($relay114)) throw new RuntimeException('Owned relay failed to start.'); fclose($pipes[0]);
    $helpers114['relayPid'] = proc_get_status($relay114)['pid'];
    $deadline = microtime(true) + 8;
    do { [$status] = request114('GET', '/api/v1/health'); if ($status === 200) break; usleep(100000); } while (microtime(true) < $deadline && proc_get_status($relay114)['running'] && proc_get_status($php114)['running']);
    proof114($status === 200, 'isolated real relay and credential-free PC-style engine become healthy');
    $ownerSession = expect114(200, 'GET', '/api/v1/admin/session', null, '', true)[0];
    proof114($ownerSession['authenticated'] === true && $ownerSession['configured'] === false, 'gateway owner session opens Studio without a password or owner-account fixture');

    $obj = "o studio114_transport_fixture\nv 0 0 0\nv 2 0 0\nv 2 3 0\nv 0 3 0\nv 0 0 4\nv 2 0 4\nv 2 3 4\nv 0 3 4\nf 1 2 3\nf 1 3 4\nf 5 8 7\nf 5 7 6\nf 1 5 6\nf 1 6 2\nf 4 3 7\nf 4 7 8\nf 1 4 8\nf 1 8 5\nf 2 6 7\nf 2 7 3\n";
    $disk114 = $run114 . '/transport-house.obj'; file_put_contents($disk114, $obj);
    $houseAsset = upload114($disk114); $houseId = $houseAsset['id'];
    proof114($houseId === hash_file('sha256', $disk114) && $houseAsset['status'] === 'queued', 'disk model crosses real HTTP upload byte-exact and queues actual inspection');
    $revisionBeforeQueued = catalog114()['revision'];
    expect114(422, 'POST', '/api/v1/admin/gameplay-catalog/properties', ['id' => 'not-inspected114', 'definition' => ['name' => ['en' => 'Queued room', 'ar' => 'غرفة قيد الفحص'], 'price' => 135, 'happy' => 700, 'mediaAsset' => $houseId], 'expectedRevision' => $revisionBeforeQueued], '', true);
    proof114(catalog114()['revision'] === $revisionBeforeQueued, 'queued model cannot bind a property or advance the catalog revision');
    worker114(); $inspected = expect114(200, 'GET', '/api/v1/admin/assets/' . $houseId, null, '', true)[0];
    proof114($inspected['status'] === 'ready' && $inspected['metadata']['bounds']['size'] === [2, 3, 4], 'actual one-cycle CLI worker computes the uploaded model bounds');
    $fit = ['scale' => .75, 'rotation' => [0, 90, 0], 'floorOffset' => .2, 'cameraTarget' => [0, 1, 0]];
    expect114(200, 'PUT', '/api/v1/admin/assets/' . $houseId . '/transform', $fit, '', true);
    $house = ['price' => 120, 'happy' => 700, 'name' => ['en' => 'Harbor backroom', 'ar' => 'الغرفة الخلفية بالميناء'], 'description' => ['en' => 'An operator-authored test room.', 'ar' => 'غرفة اختبار أنشأها مشغل الاستوديو.'], 'mediaAsset' => $houseId];
    create114('properties', 'backroom114', $house);
    $updated = edit114('properties', 'backroom114', ['price' => 135]); $savedHouse = array_values(array_filter($updated['catalogs']['properties'], static fn (array $row): bool => $row['id'] === 'backroom114'))[0];
    proof114($savedHouse === ['id' => 'backroom114', ...$house, 'price' => 135], 'price-only property edit preserves custom model, bilingual name/description and happiness');
    $weapon = ['type' => 'weapon', 'price' => 120, 'mult' => 1.4, 'name' => ['en' => 'Harbor implement', 'ar' => 'أداة الميناء'], 'description' => ['en' => 'Uploaded transport fixture, not accepted weapon art.', 'ar' => 'نموذج اختبار للرفع وليس رسماً معتمداً للسلاح.'], 'mediaAsset' => $houseId];
    create114('items', 'implement114', $weapon);
    $medical = ['type' => 'medical', 'price' => 25, 'hospitalSeconds' => 30, 'name' => ['en' => 'Clinic recovery wrap', 'ar' => 'ضمادة التعافي بالعيادة'], 'description' => ['en' => 'Reduces actual hospital time.', 'ar' => 'تقلل وقت المستشفى الفعلي.']];
    create114('items', 'wrap114', $medical); $editedMedical = edit114('items', 'wrap114', ['hospitalSeconds' => 45]);
    proof114($editedMedical['catalogs']['items']['wrap114'] === [...$medical, 'hospitalSeconds' => 45] && $editedMedical['catalogs']['items']['implement114'] === $weapon, 'medical timer edit retains bilingual fields, price and unrelated custom equipment');
    $crime = ['name_en' => 'Harbor equipment job', 'name_ar' => 'مهمة معدات الميناء', 'nerve_cost' => 1, 'success_basis_points' => 10000, 'cash_min' => 17, 'cash_max' => 17, 'xp_reward' => 0, 'level_required' => 2, 'enabled' => true, 'required_item' => 'implement114', 'required_quantity' => 1, 'consume_tool' => false, 'mastery_per_success' => 4, 'chain_window_seconds' => 120, 'chain_bonus_basis_points' => 250, 'critical_failure_basis_points' => 0, 'jail_seconds' => 0, 'hospital_seconds' => 0];
    expect114(200, 'PUT', '/api/v1/admin/crimes/harbor114', $crime, '', true);
    $editedCrime = expect114(200, 'PUT', '/api/v1/admin/crimes/harbor114', ['cash_min' => 19, 'cash_max' => 19], '', true)[0]['crime'];
    proof114($editedCrime['level_required'] === 2 && $editedCrime['required_item'] === 'implement114' && $editedCrime['mastery_per_success'] === 4 && $editedCrime['name_ar'] === $crime['name_ar'], 'reward-only crime edit preserves operator-authored level, tool, mastery and Arabic fields');
    $hospitalCrime = [...$crime, 'name_en' => 'Clinic consequence proof', 'name_ar' => 'اختبار نتيجة المستشفى', 'level_required' => 1, 'success_basis_points' => 0, 'cash_min' => 0, 'cash_max' => 0, 'required_item' => null, 'critical_failure_basis_points' => 10000, 'hospital_seconds' => 120];
    expect114(200, 'PUT', '/api/v1/admin/crimes/clinic114', $hospitalCrime, '', true);
    $stock = [['item' => 'implement114', 'qty' => 3, 'seller' => 'Harbor operator'], ['item' => 'wrap114', 'qty' => 6, 'seller' => 'Clinic operator']]; $beforeShop = catalog114();
    $savedStock = expect114(200, 'PUT', '/api/v1/admin/shop-catalog', ['listings' => $stock, 'expectedRevision' => $beforeShop['revision']], '', true)[0];
    proof114($savedStock['catalogs']['market'] === $stock && $savedStock['catalogs']['items'] === $beforeShop['catalogs']['items'], 'shop stock publishes operator item references without replacing item definitions');
    expect114(409, 'PUT', '/api/v1/admin/shop-catalog', ['listings' => [], 'expectedRevision' => $beforeShop['revision']], '', true);
    proof114(catalog114()['catalogs']['market'] === $stock, 'stale shop request cannot erase the newer reviewed stock');
    $previewDraft = draft114(); $preview = $previewDraft['manifest']; $preview['content']['gameplayCatalog'] = catalog114()['catalogs'];
    $preview['content']['crimes'] = expect114(200, 'GET', '/api/v1/admin/crimes', null, '', true)[0]['crimes'];
    expect114(200, 'PUT', '/api/v1/admin/draft', ['manifest' => $preview, 'expectedFingerprint' => $previewDraft['draftFingerprint']], '', true);
    foreach (['en', 'ar'] as $language) {
        $readPreview = draft114()['manifest']['content'];
        proof114($readPreview['gameplayCatalog']['items']['implement114']['name'][$language] === $weapon['name'][$language] && $readPreview['gameplayCatalog']['items']['wrap114']['name'][$language] === $medical['name'][$language], 'saved preview payload retains exact ' . $language . ' equipment and medical copy, not a rendered-preview claim');
    }
    [$earlyPlayer, $earlyCookie] = player114(); $earlyBootstrap = expect114(200, 'GET', '/api/v1/game/bootstrap', null, $earlyCookie)[0];
    proof114(!isset($earlyBootstrap['content']['gameplayCatalog']['items']['implement114']) && !isset($earlyBootstrap['mediaAssets'][$houseId]), 'saving previews does not leak unpublished items or models to ordinary sessions');
    $release114 = publish114(); [$playerId114, $cookie114] = player114();
    $bootstrap = expect114(200, 'GET', '/api/v1/game/bootstrap', null, $cookie114)[0]; $initial = expect114(200, 'GET', '/api/v1/gameplay', null, $cookie114)[0];
    proof114($initial['player']['cash'] === 2500 && $initial['player']['level'] === 1 && $initial['state']['inv'] === ['smallkit' => 1] && $playerId114 !== 'founder-player', 'post-publication ordinary account starts with genuine novice resources and no fixture grants');
    proof114($bootstrap['mediaAssets'][$houseId]['transform'] === $fit && $bootstrap['content']['gameplayCatalog']['items']['implement114']['mediaAsset'] === $houseId && $bootstrap['content']['gameplayCatalog']['market'] === $stock, 'fresh ordinary bootstrap sees the same published fitted model, equipment and shop stock');
    expect114(422, 'POST', '/api/v1/crimes/harbor114/attempt', [], $cookie114);
    $gateBefore = expect114(200, 'GET', '/api/v1/gameplay', null, $cookie114)[0];
    proof114($gateBefore['player']['cash'] === 2500 && $gateBefore['player']['nerve'] === $initial['player']['nerve'], 'published level gate rejects novice without taking money or nerve');
    $gateEdit = expect114(200, 'PUT', '/api/v1/admin/crimes/harbor114', ['level_required' => 1], '', true)[0]['crime'];
    proof114($gateEdit['cash_min'] === 19 && $gateEdit['required_item'] === 'implement114' && $gateEdit['mastery_per_success'] === 4, 'editing the level gate retains previously edited reward, tool and mastery');
    expect114(422, 'POST', '/api/v1/crimes/harbor114/attempt', [], $cookie114);
    $secondRelease114 = publish114();
    expect114(400, 'POST', '/api/v1/crimes/harbor114/attempt', [], $cookie114);
    proof114(expect114(200, 'GET', '/api/v1/gameplay', null, $cookie114)[0]['player']['nerve'] === $initial['player']['nerve'], 'newly published level change still enforces owned tool before charging the novice');
    $buy = action114($cookie114, 'item.buy', 'implement114'); $equip = action114($cookie114, 'item.equip', 'implement114');
    proof114($buy['result']['cashDelta'] === -120 && $equip['state']['equip'] === 'implement114' && $equip['loadout']['weaponMultiplier'] === 1.4, 'ordinary player buys and equips custom media item with authored combat multiplier');
    $boughtHouse = action114($cookie114, 'property.buy', 'backroom114'); $ownedHouse = array_values(array_filter($boughtHouse['safehouses'], static fn (array $row): bool => $row['id'] === 'backroom114'))[0];
    proof114($boughtHouse['result']['cashDelta'] === -135 && $ownedHouse['enterable'] === true && $ownedHouse['mediaAsset'] === $houseId, 'ordinary property purchase unlocks the same uploaded safehouse model, not another room');
    for ($unit = 0; $unit < 4; $unit++) action114($cookie114, 'market.buy', 'wrap114', 25);
    $stockAfter = expect114(200, 'GET', '/api/v1/gameplay', null, $cookie114)[0];
    proof114($stockAfter['state']['inv']['wrap114'] === 4 && array_values(array_filter($stockAfter['state']['market'], static fn (array $row): bool => $row['item'] === 'wrap114'))[0]['qty'] === 2, 'ordinary shop purchases debit four authored medical units from real stock');
    $job = expect114(200, 'POST', '/api/v1/crimes/harbor114/attempt', [], $cookie114)[0];
    proof114($job['outcome'] === 'success' && $job['reward']['cash'] === 19 && $job['mastery'] === 4 && $job['tool']['consumed'] === 0, 'published tool-gated job pays exact edited reward and keeps the nonconsumed equipped tool');
    $cooldown = expect114(200, 'GET', '/api/v1/gameplay', null, $cookie114)[0]['cooldowns']['actions']['crime']['availableAtEpoch'];
    while (time() < $cooldown) usleep(100000);
    $injury = expect114(200, 'POST', '/api/v1/crimes/clinic114/attempt', [], $cookie114)[0];
    $hospitalized = expect114(200, 'GET', '/api/v1/gameplay', null, $cookie114)[0];
    proof114($injury['outcome'] === 'critical_failure' && $injury['penalty']['type'] === 'hosp' && $hospitalized['state']['hospUntil'] > time() * 1000, 'operator-authored consequence reaches the real ordinary-player hospital timer');
    $firstWrap = action114($cookie114, 'item.use', 'wrap114');
    proof114($firstWrap['result']['hospitalSecondsReduced'] === 45 && $firstWrap['state']['hospUntil'] === $hospitalized['state']['hospUntil'] - 45000, 'edited45-second medicine cuts exact server hospital time rather than resetting the timer');
    action114($cookie114, 'item.use', 'wrap114'); $recovered = action114($cookie114, 'item.use', 'wrap114');
    proof114($recovered['state']['hospUntil'] === 0 && $recovered['state']['inv']['wrap114'] === 1 && $recovered['state']['equip'] === 'implement114', 'bounded medical recovery consumes three real units and retains equipment plus unused stock');
    $ledgerBeforeNoEffect = $db114->fetchAll('SELECT * FROM economy_ledger WHERE player_id=:id ORDER BY id', ['id' => $playerId114]);
    expect114(400, 'POST', '/api/v1/gameplay/action', ['action' => 'item.use', 'id' => 'wrap114', 'expectedVersion' => $recovered['state']['version']], $cookie114);
    $returned = expect114(200, 'GET', '/api/v1/gameplay', null, $cookie114)[0];
    proof114($returned['state']['version'] === $recovered['state']['version'] && $returned['state']['inv']['wrap114'] === 1 && $db114->fetchAll('SELECT * FROM economy_ledger WHERE player_id=:id ORDER BY id', ['id' => $playerId114]) === $ledgerBeforeNoEffect, 'no-effect medicine request preserves owned unit, state version and exact economic history');
    // Real Studio history activation replaces the active catalog with one
    // lacking both custom item definitions. It must not erase owned gear.
    expect114(200, 'POST', '/api/v1/admin/releases/' . $baseline114['id'] . '/activate', [], '', true);
    $rolledBootstrap = expect114(200, 'GET', '/api/v1/game/bootstrap', null, $cookie114)[0];
    $rolled = expect114(200, 'GET', '/api/v1/gameplay', null, $cookie114)[0];
    proof114(!isset($rolledBootstrap['content']['gameplayCatalog']['items']['implement114']) && !isset($rolledBootstrap['content']['gameplayCatalog']['items']['wrap114']) && !isset($rolledBootstrap['mediaAssets'][$houseId]), 'actual Studio rollback replaces the ordinary catalog and withdraws its uploaded media references');
    proof114($rolled['state']['inv']['implement114'] === 1 && $rolled['state']['inv']['wrap114'] === 1 && $rolled['state']['ownedProperties']['backroom114'] === 1 && $rolled['player']['cash'] === $returned['player']['cash'] && $db114->fetchAll('SELECT * FROM economy_ledger WHERE player_id=:id ORDER BY id', ['id' => $playerId114]) === $ledgerBeforeNoEffect, 'catalog replacement retains owned custom inventory, property, wallet and ledger instead of deleting stock');
    expect114(200, 'POST', '/api/v1/admin/releases/' . $secondRelease114['id'] . '/activate', [], '', true);
    $restored = expect114(200, 'GET', '/api/v1/gameplay', null, $cookie114)[0];
    $restoredBootstrap = expect114(200, 'GET', '/api/v1/game/bootstrap', null, $cookie114)[0];
    proof114($restored['loadout']['weaponId'] === 'implement114' && $restored['loadout']['weaponMultiplier'] === 1.4 && $restoredBootstrap['mediaAssets'][$houseId]['transform'] === $fit, 'reactivation restores the same equipped item and fitted model without another purchase or lost inventory');
    $freshEngine = zone_engine($database114); $fresh = $freshEngine->gameplay($playerId114);
    proof114($freshEngine->activeRelease()['id'] === $secondRelease114['id'] && $fresh['state']['prop'] === 'backroom114' && $fresh['state']['equip'] === 'implement114' && $fresh['state']['inv']['wrap114'] === 1, 'fresh engine connection retains published identity, owned house, equipped custom item and medical inventory');
    $sums = $db114->fetchAll("SELECT asset,SUM(amount) AS amount FROM economy_ledger WHERE player_id=:id GROUP BY asset", ['id' => $playerId114]); $sums = array_column($sums, 'amount', 'asset');
    proof114((int) $sums['cash'] === $fresh['player']['cash'] && (int) $sums['item:wrap114'] === 1 && (int) $sums['item:implement114'] === 1, 'ordinary wallet and both custom inventories reconcile to immutable ledger receipts');
    $endHashes114 = []; foreach ($sourceFiles114 as $path) $endHashes114[$path] = hash_file('sha256', ZONE_REPOSITORY_ROOT . '/' . $path);
    proof114($endHashes114 === $sourceHashes114, 'all exact Studio, transport and gameplay sources remain unchanged throughout this connected journey');
    $evidence114 += ['input' => ['path' => $disk114, 'sha256' => $houseId], 'releases' => [$release114['id'], $secondRelease114['id']], 'playerId' => $playerId114,
        'finalCash' => $fresh['player']['cash'], 'wrapUnits' => 1, 'workerCycles' => count($worker114), 'baselineReleaseId' => $baseline114['id']];
} catch (Throwable $error) { $failures114[] = $error->getMessage(); echo 'FAIL: ' . $error->getMessage() . PHP_EOL;
} finally {
    if (is_resource($relay114)) {
        $context = stream_context_create(['http' => ['method' => 'POST', 'header' => 'X-Zone-Relay-Key: ' . $relayKey114 . "\r\nContent-Length: 0\r\nConnection: close", 'content' => '', 'ignore_errors' => true, 'timeout' => 3]]);
        @file_get_contents($base114 . '/__zone_relay_stop', false, $context); $deadline = microtime(true) + 3;
        while (proc_get_status($relay114)['running'] && microtime(true) < $deadline) usleep(100000);
        $helpers114['relayStoppedGracefully'] = !proc_get_status($relay114)['running'];
        if ($helpers114['relayStoppedGracefully']) proc_close($relay114); else $failures114[] = 'Owned relay did not stop gracefully; no Node kill issued.';
    }
    if (is_resource($php114)) { proc_terminate($php114); proc_close($php114); $helpers114['phpStopped'] = true; }
    if ($previousAsset114 === false) putenv('ZONE_ASSET_ROOT'); else putenv('ZONE_ASSET_ROOT=' . $previousAsset114);
    if ($previousRedis114 === false) putenv('ZONE_REDIS_URL'); else putenv('ZONE_REDIS_URL=' . $previousRedis114);
}
$evidence114 += ['helpers' => $helpers114, 'passed' => $passed114, 'failed' => count($failures114), 'failures' => $failures114];
file_put_contents($run114 . '/evidence.json', json_encode($evidence114, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR) . PHP_EOL);
echo 'STUDIO114 EVIDENCE PATH: ' . $run114 . '/evidence.json' . PHP_EOL;
echo 'STUDIO114 EVIDENCE: ' . json_encode($evidence114, JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR) . PHP_EOL;
echo 'STUDIO114 RESULT: ' . $passed114 . ' passed, ' . count($failures114) . ' failed' . PHP_EOL;
exit($failures114 === [] ? 0 : 1);
