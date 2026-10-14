<?php
declare(strict_types=1);
require dirname(__DIR__) . '/bootstrap.php';
use Zone\Engine\Core\Persistence\Database;
use Zone\Engine\Core\Security\BrowserSessions;
use Zone\Engine\Core\Security\RequestGuard;

$engine = zone_engine('sqlite::memory:');
$sessions = $engine->browserSessions();
$passed = 0;
function sessionProof(bool $ok, string $message): void { global $passed; if (!$ok) throw new RuntimeException('FAIL: ' . $message); $passed++; echo 'PASS: ' . $message . PHP_EOL; }
function sessionReject(callable $fn): bool { try { $fn(); } catch (RuntimeException) { return true; } return false; }
$first = $sessions->create('127.0.0.1', 1791230000);
$second = $sessions->create('127.0.0.1', 1791230000);
sessionProof($first['playerId'] !== $second['playerId'] && $first['playerId'] !== 'founder-player', 'different browsers get isolated accounts, never founder');
sessionProof($sessions->resolve($first['token'], 1791230001) === $first['playerId'], 'opaque session resolves its own server account');
sessionProof(sessionReject(fn () => $sessions->resolve(str_repeat('a', 64), 1791230001)), 'fabricated session rejected');
sessionProof(sessionReject(fn () => $sessions->resolve($first['token'], $first['expiresAt'])), 'expired session rejected at boundary');
$one = $engine->gameplay($first['playerId']);
$two = $engine->gameplay($second['playerId']);
sessionProof($one['player']['level'] === 1 && $one['player']['cash'] === 2500 && $one['state']['points'] === 0, 'beta account begins with real novice state, not inflated demonstration progress');
sessionProof($one['state']['fac']['respect'] === 0 && $one['state']['gym'] === 0 && $one['state']['prop'] === 'shack', 'starter faction history, gym and property are not fabricated achievements');
sessionProof(count($one['state']['inv']) === 1 && $one['state']['equip'] === 'fists', 'starter inventory is server-owned');
$purchase = $engine->gameplayAction('item.buy', 'drink', $one['state']['version'], $first['playerId']);
sessionProof($purchase['player']['cash'] === 1510 && $purchase['state']['inv']['drink'] === 1, 'own session purchase settles real published price');
sessionProof($engine->gameplay($second['playerId'])['player']['cash'] === 2500, 'another browser balance and inventory remain untouched');
sessionProof($engine->player()['cash'] === 48500, 'existing founder progress survives browser onboarding');
$allLedger = array_filter($engine->ledger(100), fn ($row) => $row['player_id'] === $first['playerId']);
$ledger = array_filter($allLedger, fn ($row) => $row['asset'] === 'cash');
sessionProof(array_sum(array_column($ledger, 'amount')) === 1510, 'starting grant and purchase reconcile in economy ledger');
$startingCash = array_values(array_filter($ledger, fn ($row) => $row['reason'] === 'beta.starting-grant'))[0];
$startingInventory = array_values(array_filter($allLedger, fn ($row) => $row['asset'] === 'item:smallkit' && $row['reason'] === 'beta.starting-inventory'));
sessionProof(count($startingInventory) === 1 && (int) $startingInventory[0]['amount'] === 1 && $startingInventory[0]['correlation_id'] === $startingCash['correlation_id'], 'starting medical item and cash issuance share provenance without minting units on reload');
$purchaseInventory = array_values(array_filter($allLedger, fn ($row) => $row['asset'] === 'item:drink' && $row['correlation_id'] === $purchase['result']['correlationId']));
sessionProof(count($purchaseInventory) === 1 && (int) $purchaseInventory[0]['amount'] === 1, 'session purchase traces one actual owned unit alongside cash');
$sessions->revoke($first['token']);
sessionProof(sessionReject(fn () => $sessions->resolve($first['token'], 1791230001)), 'revocation invalidates session without deleting account');
for ($i = 2; $i < 10; $i++) $sessions->create('127.0.0.1', 1791230000);
sessionProof(sessionReject(fn () => $sessions->create('127.0.0.1', 1791230000)), 'new-account limit rejects eleventh creation in an hour');
sessionProof(isset($sessions->create('127.0.0.1', 1791233600)['playerId']), 'creation allowance resets by server time');
$admin = RequestGuard::adminSession('owner-secret', 1791230000);
sessionProof(RequestGuard::validAdminSession($admin, 'owner-secret', 1791230001), 'owner session is signed and time-limited');
sessionProof(!RequestGuard::validAdminSession($admin, 'other-secret', 1791230001), 'rotating owner secret invalidates existing owner sessions');
sessionProof(!RequestGuard::validAdminSession($admin, 'owner-secret', 1791273200), 'owner session expires exactly at twelve hours');
sessionProof(!RequestGuard::validAdminSession(substr($admin, 0, -1) . 'x', 'owner-secret', 1791230001), 'tampered owner session cannot access admin');
sessionProof(RequestGuard::cookie(['HTTP_COOKIE' => 'other=a; zone_player_session=' . $second['token']], BrowserSessions::COOKIE) === $second['token'], 'cookie parser selects exact session name');
sessionProof(RequestGuard::cookie(['HTTP_COOKIE' => 'not_zone_player_session=bad'], BrowserSessions::COOKIE) === '', 'similarly named attacker cookie is not a session');

// Repeated boot must not rerun DDL and inserts for every player request.
$db = Database::connect('sqlite::memory:');
$db->migrateAndSeed();
$db->execute('CREATE TABLE write_probe (id INTEGER PRIMARY KEY)');
$db->execute("CREATE TRIGGER detect_reseed BEFORE INSERT ON crimes BEGIN SELECT RAISE(ABORT, 'unexpected reseed'); END");
$db->migrateAndSeed();
sessionProof(true, 'schema fingerprint avoids repeated seeding on unchanged boot');
echo "BROWSER SESSIONS RESULT: {$passed} passed, 0 failed\n";
