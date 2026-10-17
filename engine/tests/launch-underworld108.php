<?php

declare(strict_types=1);

require dirname(__DIR__) . '/bootstrap.php';

use Zone\Engine\Core\Events\EventBus;
use Zone\Engine\Core\Game\PlayerCombatService;
use Zone\Engine\Core\Game\ProgressionService;
use Zone\Engine\Core\Persistence\Database;

$configured = getenv('ZONE_V108_TEST_URL');
if ($configured !== false && $configured !== '') {
    $target = parse_url($configured);
    if ($target === false || !in_array($target['scheme'] ?? '', ['postgres', 'postgresql'], true)
        || !in_array($target['host'] ?? '', ['127.0.0.1', 'localhost'], true) || ($target['port'] ?? 0) !== 55433
        || !preg_match('~^/zone_beta_smoke_underworld_[a-z0-9_]+$~D', $target['path'] ?? '')
        || strlen(ltrim($target['path'], '/')) > 63) throw new RuntimeException('A new named disposable loopback underworld database is required.');
    $url = $configured;
} else $url = 'sqlite:' . ZONE_ENGINE_ROOT . '/var/underworld108-' . bin2hex(random_bytes(6)) . '.sqlite';

$engine = zone_engine($url); $db = Database::connect($url); $events = new EventBus($db); $passed = 0; $process = null;
function underProof(bool $ok, string $message): void { global $passed; if (!$ok) throw new RuntimeException('FAIL: ' . $message); $passed++; echo 'PASS: ' . $message . PHP_EOL; }
function underReject(callable $fn): bool { try { $fn(); } catch (RuntimeException|InvalidArgumentException) { return true; } return false; }
function underPlayer(): string { global $engine; return $engine->browserSessions()->create('underworld108-' . bin2hex(random_bytes(7)))['playerId']; }
function underAct(string $id, string $action, string $entry): array { global $engine; return $engine->gameplayAction($action, $entry, $engine->gameplay($id)['state']['version'], $id); }
function underStored(string $id): array { global $db; return ['player' => $db->fetchOne('SELECT cash,bank_balance,life,nerve,energy,xp FROM players WHERE id=:id', ['id' => $id]), 'state' => $db->fetchOne('SELECT state_json,version FROM player_progression WHERE player_id=:id', ['id' => $id]), 'ledger' => $db->fetchAll('SELECT id,amount,asset,balance_after,reason FROM economy_ledger WHERE player_id=:id ORDER BY id', ['id' => $id])]; }
function underCrime(string $id, array $changes): array { global $engine; return $engine->saveCrime($id, ['name_en' => 'Isolated street job', 'name_ar' => 'شغلة شارع معزولة', 'nerve_cost' => 1, 'success_basis_points' => 10000, 'cash_min' => 100, 'cash_max' => 100, 'xp_reward' => 2, 'enabled' => true, ...$changes], 'isolated-underworld108'); }
function underWait(string $id, string $action): void { global $engine; $wait = $engine->actionCooldowns($id)['actions'][$action]['remainingSeconds'] ?? 0; if ($wait > 0) usleep(($wait + 1) * 1000000); }
function underHttp(string $base, string $method, string $path, ?array $body = null, string $cookie = ''): array {
    $headers = ['Accept: application/json', 'Content-Type: application/json', 'Connection: close', 'Host: zone.test', 'Origin: https://zone.test', 'X-Forwarded-Proto: https'];
    if ($cookie !== '') $headers[] = 'Cookie: ' . $cookie;
    $context = stream_context_create(['http' => ['method' => $method, 'header' => implode("\r\n", $headers), 'content' => $body === null ? '' : json_encode($body, JSON_THROW_ON_ERROR), 'ignore_errors' => true, 'timeout' => 8]]);
    $raw = @file_get_contents($base . $path, false, $context); $responseHeaders = http_get_last_response_headers() ?: [];
    preg_match('/\s(\d{3})\s/', $responseHeaders[0] ?? '', $match);
    return [(int) ($match[1] ?? 0), $raw === false ? [] : json_decode($raw, true, 512, JSON_THROW_ON_ERROR), $responseHeaders];
}
function underStart(string $url, string $log): array {
    $socket = stream_socket_server('tcp://127.0.0.1:0', $errno, $error); if ($socket === false) throw new RuntimeException($error);
    $address = stream_socket_get_name($socket, false); fclose($socket);
    $env = [...getenv(), 'ZONE_DATABASE_URL' => $url, 'DATABASE_URL' => '', 'POSTGRES_URL' => '', 'VERCEL' => '1', 'ZONE_PLAYER_SESSIONS' => '1', 'ZONE_PLAYER_AUTH' => '', 'ZONE_BETA_OWNER_ACCESS' => '0', 'ZONE_ADMIN_TOKEN' => bin2hex(random_bytes(32)), 'ZONE_ADMIN_USERNAME' => '', 'ZONE_ADMIN_PASSWORD_HASH' => '', 'ZONE_ADMIN_SESSION_SECRET' => '', 'ZONE_ENGINE_ORIGIN' => '', 'ZONE_ENGINE_RELAY_KEY' => '', 'ZONE_REDIS_URL' => ''];
    $command = [PHP_BINARY]; if (str_starts_with($url, 'postgres')) array_push($command, '-d', 'extension=pdo_pgsql');
    array_push($command, '-S', $address, '-t', ZONE_REPOSITORY_ROOT, ZONE_ENGINE_ROOT . '/router.php');
    $proc = proc_open($command, [0 => ['pipe', 'r'], 1 => ['file', $log, 'a'], 2 => ['file', $log, 'a']], $pipes, ZONE_REPOSITORY_ROOT, $env, ['bypass_shell' => true]);
    if (!is_resource($proc)) throw new RuntimeException('Owned isolated HTTP server failed to start.'); fclose($pipes[0]);
    $base = 'http://' . $address; $deadline = microtime(true) + 8;
    do { [$status] = underHttp($base, 'GET', '/api/v1/health'); if ($status === 200) return [$base, $proc]; usleep(100000); } while (microtime(true) < $deadline && proc_get_status($proc)['running']);
    proc_terminate($proc); proc_close($proc); throw new RuntimeException('Owned HTTP server did not become healthy.');
}
function underSession(string $base): array {
    [$status, $session, $headers] = underHttp($base, 'POST', '/api/v1/auth/session', []);
    if ($status !== 201) throw new RuntimeException('Ordinary HTTP session failed: ' . $status);
    foreach ($headers as $header) if (stripos($header, 'Set-Cookie: zone_player_session=') === 0) return [$session['playerId'], explode(';', substr($header, 12), 2)[0]];
    throw new RuntimeException('Ordinary cookie was not issued.');
}
function underHttpAct(string $base, string $cookie, string $action, string $id): array {
    [$status, $state] = underHttp($base, 'GET', '/api/v1/gameplay', null, $cookie);
    if ($status !== 200) throw new RuntimeException('Ordinary state unavailable.');
    return underHttp($base, 'POST', '/api/v1/gameplay/action', ['action' => $action, 'id' => $id, 'expectedVersion' => $state['state']['version']], $cookie);
}

// Explicitly authored isolated rules make outcomes repeatable. No player stats,
// wallets, inventory, clocks or staff grants are edited to pass this journey.
$engine->createGameplayCatalog('items', 'street-tool108', ['type' => 'material', 'price' => 50, 'name' => ['en' => 'Street tool', 'ar' => 'أداة الشارع']], $engine->adminGameplayCatalog()['revision'], 'isolated-underworld108');
$engine->createGameplayCatalog('items', 'field-med108', ['type' => 'medical', 'price' => 50, 'hospitalSeconds' => 60, 'name' => ['en' => 'Field recovery pack', 'ar' => 'حقيبة تعافي ميداني']], $engine->adminGameplayCatalog()['revision'], 'isolated-underworld108');
$engine->createGameplayCatalog('properties', 'home108', ['price' => 100, 'happy' => 500, 'name' => ['en' => 'Backroom', 'ar' => 'الغرفة الخلفية']], $engine->adminGameplayCatalog()['revision'], 'isolated-underworld108');
underCrime('tool-job108', ['required_item' => 'street-tool108', 'consume_tool' => true, 'mastery_per_success' => 7, 'chain_bonus_basis_points' => 1000]);
underCrime('jail-job108', ['success_basis_points' => 0, 'critical_failure_basis_points' => 10000, 'jail_seconds' => 120]);
underCrime('hospital-job108', ['success_basis_points' => 0, 'critical_failure_basis_points' => 10000, 'hospital_seconds' => 180]);
underCrime('quiet-fail108', ['success_basis_points' => 0]);
underCrime('level-job108', ['level_required' => 5]);
$partial = $engine->saveCrime('tool-job108', ['cash_max' => 101], 'isolated-underworld108');
underProof($partial['required_item'] === 'street-tool108' && $partial['mastery_per_success'] === 7 && $partial['consume_tool'] === true, 'partial Studio crime edit retains tool, mastery and consume fields');
underProof(underReject(fn () => $engine->saveCrime('tool-job108', ['required_quantity' => 0], 'isolated-underworld108')), 'invalid tool quantity is rejected without resetting valid content');
$engine->saveCrime('tool-job108', ['cash_max' => 100], 'isolated-underworld108');
$engine->saveShopCatalog([['item' => 'field-med108', 'qty' => 3, 'seller' => 'Studio stock']], $engine->adminGameplayCatalog()['revision'], 'isolated-underworld108');
$draft = $engine->releaseDraft()['manifest']; $draft['worldPolicy'] = ['enabled' => true, 'supplyShift' => 0, 'eventEveryTicks' => 1, 'maxActiveFinds' => 2];
$engine->saveReleaseDraft($draft, 'isolated-underworld108'); $release = $engine->publishRelease('isolated-underworld108');
$actor = underPlayer(); $other = underPlayer(); $actorStart = $engine->gameplay($actor); $engine->gameplay($other);
underProof($actorStart['player']['cash'] === 2500 && $actorStart['player']['level'] === 1 && $actorStart['state']['inv'] === ['smallkit' => 1], 'ordinary player starts with genuine novice state and no playtest provisioning');
$before = underStored($actor);
underProof(underReject(fn () => $engine->attemptCrime('level-job108', $actor)) && underStored($actor) === $before, 'level requirement rejects before reward, nerve, progression or inventory changes');
underProof(underReject(fn () => $engine->attemptCrime('tool-job108', $actor)) && underStored($actor) === $before, 'missing owned tool rejects atomically before streak or crime rewards');
underAct($actor, 'item.buy', 'street-tool108'); underAct($actor, 'item.buy', 'street-tool108');
$first = $engine->attemptCrime('tool-job108', $actor);
underProof($first['outcome'] === 'success' && $first['tool']['consumed'] === 1 && $first['reward']['cash'] === 100 && $first['mastery'] === 7 && $first['chain']['count'] === 1, 'published success consumes one tool and records exact mastery and first chain step');
$cooldownBefore = underStored($actor);
underProof(underReject(fn () => $engine->attemptCrime('tool-job108', $actor)) && underStored($actor) === $cooldownBefore, 'real immediate crime cooldown cannot duplicate tool consumption or reward');
underWait($actor, 'crime'); $second = $engine->attemptCrime('tool-job108', $actor);
underProof($second['reward']['cash'] === 110 && $second['chainBonusBasisPoints'] === 1000 && $second['mastery'] === 14 && $second['chain']['count'] === 2, 'second real timed attempt earns published chain bonus and exact cumulative mastery');
$tools = $db->fetchAll("SELECT amount FROM economy_ledger WHERE player_id=:id AND asset='item:street-tool108' AND reason='crime.tool'", ['id' => $actor]);
underProof(count($tools) === 2 && array_sum(array_column($tools, 'amount')) === -2 && $engine->gameplay($actor)['state']['inv']['street-tool108'] === 0, 'tool ledger reconciles exactly to two consumed owned units');
$failed = $engine->attemptCrime('quiet-fail108', $other);
underProof($failed['outcome'] === 'failure' && !$failed['success'] && $failed['penalty'] === null && $failed['reward']['cash'] === 0, 'ordinary failure is distinct from critical detention and never mints cash');
$beforeHome = $engine->gameplay($actor)['safehouses']; $home = underAct($actor, 'property.buy', 'home108');
underProof(!array_values(array_filter($beforeHome, fn ($house) => $house['id'] === 'home108'))[0]['enterable'] && array_values(array_filter($home['safehouses'], fn ($house) => $house['id'] === 'home108'))[0]['enterable'], 'published property becomes an owned enterable safehouse only after real purchase');

$world = $engine->world(); $readBefore = $db->fetchOne('SELECT COUNT(*) AS total FROM world_finds')['total'];
$world->snapshot($actor); $world->snapshot($actor);
underProof($db->fetchOne('SELECT COUNT(*) AS total FROM world_finds')['total'] === $readBefore, 'world snapshot reads never generate street finds or mutate economy');
$tick = $world->tick(); $repeatTick = $world->tick();
underProof($tick['status'] === 'ticked' && $repeatTick['status'] === 'already-ticked' && $repeatTick['createdFinds'] === 0, 'durable worker tick is restart-safe and does not duplicate an interval');
$worldView = $world->snapshot($actor); $find = $worldView['finds'][0];
underProof(count($worldView['finds']) === 1 && count($worldView['events']) === 1 && $worldView['supply']['field-med108'] === 3, 'bounded worker creates actual material find, published shop stock and underworld event');
$findClaim = $world->claim($actor, $find['id'], 'claim-underworld108'); $again = $world->claim($actor, $find['id'], 'claim-underworld108');
underProof($findClaim['quantity'] === 1 && $again['replayed'] === true && $again['correlationId'] === $findClaim['correlationId'], 'retried street-find claim replays one exact receipt');
underProof(underReject(fn () => $world->claim($other, $find['id'], 'other-underworld108')), 'second player cannot duplicate a globally claimed street find');
$findLedger = $db->fetchAll("SELECT amount FROM economy_ledger WHERE player_id=:id AND reason='world.street-find'", ['id' => $actor]);
underProof(count($findLedger) === 1 && (int) $findLedger[0]['amount'] === 1, 'one material issuance ledger row backs the claimed server find');
$market = $engine->gameplay($actor); $quote = $market['state']['market'][0]['price'];
$engine->gameplayAction('market.buy', 'field-med108', $market['state']['version'], $actor, $quote);
underProof($engine->gameplay($other)['state']['market'][0]['qty'] === 2, 'world shop purchase consumes one shared published unit visible to another ordinary account');
$world->tick(); underProof($world->snapshot($actor)['supply']['field-med108'] === 2, 'repeating the same tick cannot restock a sold item');
$reopened = zone_engine($url);
underProof($reopened->world()->snapshot($actor)['supply']['field-med108'] === 2 && $reopened->gameplay($actor)['state']['skill']['tool-job108'] === 14, 'engine reconstruction retains world stock, mastery, ownership and claim durability');

try {
    $log = ZONE_ENGINE_ROOT . '/var/underworld108-http-' . bin2hex(random_bytes(5)) . '.log'; [$base, $process] = underStart($url, $log);
    [$patient, $patientCookie] = underSession($base); [$prisoner, $prisonerCookie] = underSession($base); [$helper, $helperCookie] = underSession($base);
    underProof(count(array_unique([$patient, $prisoner, $helper])) === 3 && !in_array('founder-player', [$patient, $prisoner, $helper], true), 'three HTTP cookies are independent ordinary accounts, not shared founder or staff identities');
    for ($i = 0; $i < 4; $i++) { [$status] = underHttpAct($base, $patientCookie, 'item.buy', 'field-med108'); if ($status !== 200) throw new RuntimeException('Ordinary medical purchase failed.'); }
    [$status, $hospitalResult] = underHttp($base, 'POST', '/api/v1/crimes/hospital-job108/attempt', ['success' => true, 'cashReward' => 999999], $patientCookie);
    underProof($status === 200 && $hospitalResult['outcome'] === 'critical_failure' && $hospitalResult['penalty']['type'] === 'hosp' && $hospitalResult['reward']['cash'] === 0, 'actual HTTP critical crime ignores proposed outcome and creates hospital consequence');
    [$status, $patientState] = underHttp($base, 'GET', '/api/v1/gameplay', null, $patientCookie); $hospitalUntil = $patientState['state']['hospUntil'];
    [$status, $medicalResult] = underHttpAct($base, $patientCookie, 'item.use', 'field-med108');
    underProof($status === 200 && $medicalResult['result']['hospitalSecondsReduced'] === 60 && $medicalResult['state']['hospUntil'] === $hospitalUntil - 60000 && $medicalResult['state']['hospUntil'] > (int) (microtime(true) * 1000), 'owned medical pack cuts exactly sixty seconds instead of erasing hospital time');
    underHttpAct($base, $patientCookie, 'item.use', 'field-med108'); [$status, $recovered] = underHttpAct($base, $patientCookie, 'item.use', 'field-med108');
    underProof($status === 200 && $recovered['state']['hospUntil'] === 0 && $recovered['state']['inv']['field-med108'] === 1, 'three ordinary medical uses complete real recovery and preserve the fourth item');
    $noEffectBefore = underStored($patient); [$status] = underHttpAct($base, $patientCookie, 'item.use', 'field-med108');
    underProof($status === 400 && underStored($patient) === $noEffectBefore, 'no-effect medical use preserves exact wallet, inventory, version and ledger');
    [$status, $jailResult] = underHttp($base, 'POST', '/api/v1/crimes/jail-job108/attempt', [], $prisonerCookie);
    underProof($status === 200 && $jailResult['outcome'] === 'critical_failure' && $jailResult['penalty']['type'] === 'jail', 'actual HTTP critical crime produces a distinct persisted jail sentence');
    [$status, $helperState] = underHttp($base, 'GET', '/api/v1/gameplay', null, $helperCookie);
    $realInmates = array_values(array_filter($helperState['state']['inmates'], fn ($inmate) => $inmate['id'] === $prisoner));
    underProof(count($realInmates) === 1 && $realInmates[0]['npc'] === false, 'another ordinary account sees the real jailed player, explicitly distinct from practice NPCs');
    [$status, $bailResult] = underHttpAct($base, $prisonerCookie, 'jail.bailSelf', 'self');
    underProof($status === 200 && $bailResult['state']['jailUntil'] === 0 && $bailResult['result']['cashDelta'] === -2000, 'ordinary self bail charges the authoritative two-minute fee and releases jail');
    $bailBefore = underStored($prisoner); [$status] = underHttpAct($base, $prisonerCookie, 'jail.bailSelf', 'self');
    underProof($status === 400 && underStored($prisoner) === $bailBefore, 'already released character cannot be charged for repeated bail');
    underWait($prisoner, 'crime'); underHttp($base, 'POST', '/api/v1/crimes/jail-job108/attempt', [], $prisonerCookie);
    [$status, $paidByOther] = underHttpAct($base, $helperCookie, 'jail.bail', $prisoner);
    [$statusReload, $releasedByOther] = underHttp($base, 'GET', '/api/v1/gameplay', null, $prisonerCookie);
    underProof($status === 200 && $paidByOther['result']['npc'] === false && $paidByOther['result']['targetPlayerId'] === $prisoner && $statusReload === 200 && $releasedByOther['state']['jailUntil'] === 0, 'paired-lock ordinary bail genuinely releases the other jailed account');
    // Bust has a real server roll. Both possible outcomes are checked, not
    // repeatedly retried until an artificial success appears.
    underWait($prisoner, 'crime'); underHttp($base, 'POST', '/api/v1/crimes/jail-job108/attempt', [], $prisonerCookie);
    $busterBefore = $engine->gameplay($patient); [$status, $bust] = underHttpAct($base, $patientCookie, 'jail.bust', $prisoner);
    $targetAfterBust = $engine->gameplay($prisoner);
    underProof($status === 200 && $bust['result']['npc'] === false && $bust['player']['nerve'] === $busterBefore['player']['nerve'] - 5, 'ordinary bust targets the real prisoner and spends exactly five nerve');
    underProof($bust['result']['success'] ? $targetAfterBust['state']['jailUntil'] === 0 : ($targetAfterBust['state']['jailUntil'] > 0 && $bust['state']['jailUntil'] > (int) (microtime(true) * 1000)), 'actual bust roll either releases target or jails helper without falsely releasing target');
    proc_terminate($process); proc_close($process); $process = null; [$base, $process] = underStart($url, $log);
    [$status, $returned] = underHttp($base, 'GET', '/api/v1/gameplay', null, $prisonerCookie);
    underProof($status === 200 && $returned['player']['id'] === $prisoner && $returned['state']['jailUntil'] === $targetAfterBust['state']['jailUntil'], 'owned HTTP process restart preserves ordinary identity and exact recovery state');
} finally { if (is_resource($process)) { proc_terminate($process); proc_close($process); } }

// Two actual ordinary counterparties, authoritative paired locks and settlement.
// Only the existing combat RNG seam is deterministic (minimum valid roll).
$attacker = underPlayer(); $defender = underPlayer(); $engine->gameplay($attacker); $engine->gameplay($defender);
$engine->bankDeposit(2000, $defender);
$combat = new PlayerCombatService($db, $events, static fn (int $minimum, int $maximum): int => $minimum);
function underMug(PlayerCombatService $combat, string $attacker, string $defender): array {
    $fight = $combat->act('start', $defender, '', $combat->snapshot($attacker)['version'], $attacker);
    while ($fight['encounter']['phase'] === 'fighting') $fight = $combat->act('strike', '', '', $fight['version'], $attacker);
    if ($fight['encounter']['phase'] !== 'won') throw new RuntimeException('Deterministic paired encounter was not won.');
    return $combat->act('finish', '', 'mug', $fight['version'], $attacker);
}
$protected = underMug($combat, $attacker, $defender); $protectedAfter = $engine->gameplay($defender);
underProof($protected['result']['cashDelta'] === 25 && $protectedAfter['player']['cash'] === 475 && $protectedAfter['player']['bank_balance'] === 2000, 'actual paired Mug takes five percent of pocket cash and leaves all two thousand banked cash untouched');
underAct($defender, 'item.use', 'smallkit'); underAct($attacker, 'item.use', 'smallkit');
$engine->bankWithdraw(1000, $defender);
foreach ([$defender, $attacker] as $id) if ($engine->hospitalQuote($id)['available']) $engine->hospitalHeal($id);
$engine->bankWithdraw(1000, $defender);
underWait($attacker, 'attack'); $unprotectedBefore = $engine->gameplay($defender)['player'];
$unprotected = underMug($combat, $attacker, $defender); $unprotectedAfter = $engine->gameplay($defender)['player'];
underProof($unprotected['result']['cashDelta'] === (int) round($unprotectedBefore['cash'] * .05) && $unprotected['result']['cashDelta'] > $protected['result']['cashDelta'] && $unprotectedAfter['bank_balance'] === 0, 'withdrawing protected cash exposes a measurably larger real pocket loss in the next paired Mug');
$mugDebit = $db->fetchAll("SELECT amount,correlation_id FROM economy_ledger WHERE player_id=:id AND reason='player-combat.mug.debit' ORDER BY correlation_id", ['id' => $defender]);
$mugCredit = $db->fetchAll("SELECT amount,correlation_id FROM economy_ledger WHERE player_id=:id AND reason='player-combat.mug.credit' ORDER BY correlation_id", ['id' => $attacker]);
underProof(count($mugDebit) === 2 && count($mugCredit) === 2 && array_sum(array_column($mugDebit, 'amount')) + array_sum(array_column($mugCredit, 'amount')) === 0, 'paired mug debits and credits conserve cash exactly with matching transfer count');
echo 'UNDERWORLD108 EVIDENCE: ' . json_encode(['adapter' => $db->driver(), 'release' => $release['id'], 'ordinaryHttpAccounts' => 3, 'serverRestarts' => 1, 'testAuthoredRules' => true, 'playerStatWalletInventoryFixtures' => false, 'combatRng' => 'existing deterministic minimum seam', 'protectedMug' => $protected['result']['cashDelta'], 'unprotectedMug' => $unprotected['result']['cashDelta']], JSON_THROW_ON_ERROR) . PHP_EOL;
echo "UNDERWORLD108 RESULT: {$passed} passed, 0 failed\n";
