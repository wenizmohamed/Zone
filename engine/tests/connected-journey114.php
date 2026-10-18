<?php
declare(strict_types=1);

namespace Zone\Engine\Application {
    function random_int(int $minimum, int $maximum): int { return \connected114Roll($minimum, $maximum); }
}
namespace Zone\Engine\Core\Game {
    function random_int(int $minimum, int $maximum): int { return \connected114Roll($minimum, $maximum); }
}
namespace {
    // Test-only deterministic minimum rolls are installed only by this private
    // router wrapper. Neither production code nor ordinary live RNG is changed.
    function connected114Roll(int $minimum, int $maximum): int {
        $nonce = (string) getenv('ZONE_CONNECTED114_NONCE');
        if (PHP_SAPI === 'cli-server' && $nonce !== '' && hash_equals($nonce, (string) ($_SERVER['HTTP_X_ZONE_TEST_NONCE'] ?? ''))
            && ($_SERVER['HTTP_X_ZONE_TEST_ROLL'] ?? '') === 'minimum') return $minimum;
        return \random_int($minimum, $maximum);
    }
    if (PHP_SAPI === 'cli-server') {
        $database = (string) getenv('ZONE_DATABASE_URL');
        $prefix = 'sqlite:' . dirname(__DIR__) . '/var/connected-journey114-';
        if (!str_starts_with(str_replace('\\', '/', $database), str_replace('\\', '/', $prefix))
            || !preg_match('/[a-f0-9]{12}\.sqlite$/D', $database) || getenv('ZONE_CONNECTED114_NONCE') === false) {
            http_response_code(503); echo '{"error":"Disposable connected114 SQLite is required."}'; return;
        }
        return require dirname(__DIR__) . '/router.php';
    }

    require dirname(__DIR__) . '/bootstrap.php';
    use Zone\Engine\Core\Persistence\Database;

    $prefix = ZONE_ENGINE_ROOT . '/var/connected-journey114-' . bin2hex(random_bytes(6));
    $url = 'sqlite:' . $prefix . '.sqlite'; $nonce = bin2hex(random_bytes(32));
    $engine = zone_engine($url); $db = Database::connect($url); $passed = 0; $process = null;
    $evidence = ['adapter' => 'sqlite', 'database' => substr($url, 7), 'ordinaryAccounts' => 2,
        'testAuthoredBalance' => true, 'rng' => 'Explicit test-only minimum roll PHP namespace seam in isolated HTTP router',
        'walletStatInventoryGrants' => false, 'ownerPlaytest' => false, 'browserPixels' => false, 'receipts' => []];
    $sourceFiles = [...glob(ZONE_ENGINE_ROOT . '/src/Core/Game/*.php'), ZONE_ENGINE_ROOT . '/src/Application/GameEngine.php', __FILE__];
    $sourceBase = str_replace('\\', '/', ZONE_ENGINE_ROOT) . '/'; $sourceHashes = [];
    foreach ($sourceFiles as $file) $sourceHashes[str_replace($sourceBase, '', str_replace('\\', '/', $file))] = hash_file('sha256', $file);

    function connectedProof(bool $ok, string $label): void {
        global $passed; if (!$ok) throw new \RuntimeException('FAIL: ' . $label);
        $passed++; echo 'PASS: ' . $label . PHP_EOL;
    }
    function connectedHttp(string $base, string $method, string $path, ?array $body = null, string $cookie = ''): array {
        global $nonce, $evidence;
        $headers = ['Accept: application/json', 'Content-Type: application/json', 'Connection: close',
            'Host: zone.test', 'Origin: https://zone.test', 'X-Forwarded-Proto: https',
            'X-Zone-Test-Nonce: ' . $nonce, 'X-Zone-Test-Roll: minimum'];
        if ($cookie !== '') $headers[] = 'Cookie: ' . $cookie;
        $context = stream_context_create(['http' => ['method' => $method, 'header' => implode("\r\n", $headers),
            'content' => $body === null ? '' : json_encode($body, JSON_THROW_ON_ERROR), 'ignore_errors' => true, 'timeout' => 10]]);
        $raw = @file_get_contents($base . $path, false, $context); $responseHeaders = http_get_last_response_headers() ?: [];
        preg_match('/\s(\d{3})\s/', $responseHeaders[0] ?? '', $match); $status = (int) ($match[1] ?? 0);
        $response = $raw === false ? [] : json_decode($raw, true, 512, JSON_THROW_ON_ERROR);
        if ($method === 'POST' && !str_starts_with($path, '/api/v1/auth/')) $evidence['receipts'][] = ['path' => $path, 'status' => $status, 'request' => $body, 'response' => $response];
        return [$status, $response, $responseHeaders];
    }
    function connectedStart(): array {
        global $url, $prefix, $nonce;
        $socket = stream_socket_server('tcp://127.0.0.1:0', $errno, $error); if ($socket === false) throw new \RuntimeException($error);
        $address = stream_socket_get_name($socket, false); fclose($socket);
        $environment = [...getenv(), 'ZONE_DATABASE_URL' => $url, 'DATABASE_URL' => '', 'POSTGRES_URL' => '', 'ZONE_REDIS_URL' => '',
            'ZONE_CONNECTED114_NONCE' => $nonce, 'VERCEL' => '1', 'ZONE_PLAYER_SESSIONS' => '1', 'ZONE_PLAYER_AUTH' => '',
            'ZONE_BETA_OWNER_ACCESS' => '0', 'ZONE_ADMIN_TOKEN' => bin2hex(random_bytes(32)), 'ZONE_ADMIN_USERNAME' => '',
            'ZONE_ADMIN_PASSWORD_HASH' => '', 'ZONE_ADMIN_SESSION_SECRET' => '', 'ZONE_ENGINE_ORIGIN' => '', 'ZONE_ENGINE_RELAY_KEY' => '',
            'ZONE_RATE_LIMIT_MAX' => '240', 'ZONE_RATE_LIMIT_WINDOW' => '10'];
        $process = proc_open([PHP_BINARY, '-S', $address, '-t', ZONE_REPOSITORY_ROOT, __FILE__],
            [0 => ['pipe', 'r'], 1 => ['file', $prefix . '.log', 'a'], 2 => ['file', $prefix . '.log', 'a']], $pipes,
            ZONE_REPOSITORY_ROOT, $environment, ['bypass_shell' => true, 'create_new_console' => false]);
        if (!is_resource($process)) throw new \RuntimeException('Private connected114 HTTP process did not start.'); fclose($pipes[0]);
        $base = 'http://' . $address; $deadline = microtime(true) + 10;
        do {
            [$status, $health] = connectedHttp($base, 'GET', '/api/v1/health');
            if ($status === 200) {
                connectedProof(($health['engine']['database'] ?? null) === 'sqlite', 'Owned loopback HTTP process independently reports SQLite, never production PostgreSQL');
                return [$base, $process];
            }
            usleep(100000);
        } while (microtime(true) < $deadline && proc_get_status($process)['running']);
        proc_terminate($process); proc_close($process); throw new \RuntimeException('Private connected114 HTTP health failed.');
    }
    function connectedSession(string $base): array {
        [$status, $session, $headers] = connectedHttp($base, 'POST', '/api/v1/auth/session', []);
        if ($status !== 201) throw new \RuntimeException('Ordinary session creation failed: ' . $status);
        foreach ($headers as $header) if (stripos($header, 'Set-Cookie: zone_player_session=') === 0) return [$session['playerId'], explode(';', substr($header, 12), 2)[0]];
        throw new \RuntimeException('Ordinary session cookie was not issued.');
    }
    function connectedState(string $base, string $cookie): array {
        [$status, $state] = connectedHttp($base, 'GET', '/api/v1/gameplay', null, $cookie);
        if ($status !== 200) throw new \RuntimeException('Ordinary gameplay read failed: ' . $status);
        return $state;
    }
    function connectedAct(string $base, string $cookie, string $action, string $id): array {
        $state = connectedState($base, $cookie);
        [$status, $receipt] = connectedHttp($base, 'POST', '/api/v1/gameplay/action', ['action' => $action, 'id' => $id, 'expectedVersion' => $state['state']['version']], $cookie);
        if ($status !== 200) throw new \RuntimeException($action . ' failed: ' . $status . ' ' . ($receipt['error'] ?? ''));
        return $receipt;
    }
    function connectedWait(string $base, string $cookie, string $action): void {
        $state = connectedState($base, $cookie);
        $seconds = (int) ($state['cooldowns']['actions'][$action]['remainingSeconds'] ?? 0);
        if ($seconds > 15) throw new \RuntimeException('Unexpected published cooldown; no clocks or rules are overridden.');
        if ($seconds > 0) usleep(($seconds + 1) * 1000000);
    }
    function connectedStored(string $id): array {
        global $db;
        return ['player' => $db->fetchOne('SELECT id,cash,bank_balance,xp,level,strength,defense,speed,dexterity FROM players WHERE id=:id', ['id' => $id]),
            'progression' => $db->fetchOne('SELECT state_json,version FROM player_progression WHERE player_id=:id', ['id' => $id]),
            'ledger' => $db->fetchAll('SELECT asset,amount,balance_after,reason,correlation_id FROM economy_ledger WHERE player_id=:id ORDER BY created_at,id', ['id' => $id])];
    }
    function connectedFight(string $base, string $cookie, string $opponent): array {
        [$status, $snapshot] = connectedHttp($base, 'GET', '/api/v1/player-combat', null, $cookie);
        if ($status !== 200) throw new \RuntimeException('Paired encounter snapshot failed.');
        [$status, $fight] = connectedHttp($base, 'POST', '/api/v1/player-combat/action', ['action' => 'start', 'opponentId' => $opponent, 'expectedVersion' => $snapshot['version']], $cookie);
        if ($status !== 200) throw new \RuntimeException('Paired encounter start failed: ' . json_encode($fight));
        $rounds = 0;
        while ($fight['encounter']['phase'] === 'fighting' && $rounds++ < 25) {
            [$status, $fight] = connectedHttp($base, 'POST', '/api/v1/player-combat/action', ['action' => 'strike', 'expectedVersion' => $fight['version']], $cookie);
            if ($status !== 200) throw new \RuntimeException('Paired strike failed: ' . json_encode($fight));
        }
        connectedProof($fight['encounter']['phase'] === 'won', 'Ordinary bought-and-equipped bat wins the actual paired battle under the explicitly deterministic test roll seam');
        [$status, $settled] = connectedHttp($base, 'POST', '/api/v1/player-combat/action', ['action' => 'finish', 'approach' => 'mug', 'expectedVersion' => $fight['version']], $cookie);
        if ($status !== 200) throw new \RuntimeException('Paired Mug settlement failed: ' . json_encode($settled));
        return $settled;
    }

    // Content rules are authored only in this fresh private database. Player
    // wallets, inventories, stats, clocks and cooldowns are never provisioned.
    $engine->createGameplayCatalog('items', 'journey-tool114', ['type' => 'material', 'price' => 50, 'name' => ['en' => 'Private test tool', 'ar' => 'أداة اختبار معزولة']], $engine->adminGameplayCatalog()['revision'], 'isolated-connected114');
    $engine->createGameplayCatalog('items', 'journey-med114', ['type' => 'medical', 'price' => 40, 'hospitalSeconds' => 60, 'name' => ['en' => 'Private timer medicine', 'ar' => 'دواء مؤقت معزول']], $engine->adminGameplayCatalog()['revision'], 'isolated-connected114');
    foreach ([
        'journey-success114' => ['required_item' => 'journey-tool114', 'consume_tool' => true, 'mastery_per_success' => 7, 'chain_bonus_basis_points' => 1000],
        'journey-jail114' => ['success_basis_points' => 0, 'critical_failure_basis_points' => 10000, 'jail_seconds' => 60],
        'journey-hospital114' => ['success_basis_points' => 0, 'critical_failure_basis_points' => 10000, 'hospital_seconds' => 180],
    ] as $id => $rule) $engine->saveCrime($id, ['name_en' => 'Private connected route', 'name_ar' => 'مسار معزول', 'nerve_cost' => 1,
        'success_basis_points' => 10000, 'cash_min' => 100, 'cash_max' => 100, 'xp_reward' => 2, 'enabled' => true, ...$rule], 'isolated-connected114');
    $release = $engine->publishRelease('isolated-connected114', $engine->releaseDraft()['draftFingerprint']);
    $evidence['releaseId'] = $release['id'];
    try {
        [$base, $process] = connectedStart(); [$a, $cookieA] = connectedSession($base); [$b, $cookieB] = connectedSession($base);
        $initialA = connectedState($base, $cookieA); $initialB = connectedState($base, $cookieB);
        connectedProof($a !== $b && $a !== 'founder-player' && $initialA['player']['cash'] === 2500 && $initialB['player']['cash'] === 2500
            && $initialA['state']['inv'] === ['smallkit' => 1], 'Two ordinary cookie accounts start with earned-game baseline, no owner or direct player fixtures');
        $beforeMissing = connectedStored($a);
        [$status] = connectedHttp($base, 'POST', '/api/v1/crimes/journey-success114/attempt', [], $cookieA);
        connectedProof($status === 400 && connectedStored($a) === $beforeMissing, 'Missing tool rejects before money, progression, inventory or ledger changes');
        for ($i = 0; $i < 3; $i++) { connectedAct($base, $cookieA, 'item.buy', 'journey-tool114'); connectedAct($base, $cookieA, 'item.buy', 'journey-med114'); }
        connectedAct($base, $cookieA, 'item.buy', 'bat'); connectedAct($base, $cookieA, 'item.equip', 'bat');
        $afterPurchases = connectedState($base, $cookieA);
        connectedProof($afterPurchases['player']['cash'] === 1430 && $afterPurchases['state']['equip'] === 'bat', 'Actual HTTP purchases and equipment debit exactly the authored prices');
        [$status, $first] = connectedHttp($base, 'POST', '/api/v1/crimes/journey-success114/attempt', ['success' => false, 'cashReward' => 999999], $cookieA);
        connectedProof($status === 200 && $first['reward']['cash'] === 100 && $first['mastery'] === 7 && $first['chain']['count'] === 1 && $first['tool']['consumed'] === 1, 'Tool crime consumes one real unit and settles authored success/mastery/chain, ignoring client outcome claims');
        connectedWait($base, $cookieA, 'crime');
        [$status, $second] = connectedHttp($base, 'POST', '/api/v1/crimes/journey-success114/attempt', [], $cookieA);
        connectedProof($status === 200 && $second['reward']['cash'] === 110 && $second['mastery'] === 14 && $second['chain']['count'] === 2, 'Second real cooldown-compliant crime stores exact mastery and chain-adjusted reward');
        connectedWait($base, $cookieA, 'crime');
        [$status, $jailed] = connectedHttp($base, 'POST', '/api/v1/crimes/journey-jail114/attempt', [], $cookieA);
        connectedProof($status === 200 && $jailed['penalty']['type'] === 'jail' && $jailed['penalty']['seconds'] === 60, 'Actual authored failure creates a durable jail consequence');
        $bail = connectedAct($base, $cookieA, 'jail.bailSelf', 'self');
        connectedProof($bail['result']['cashDelta'] === -1000 && $bail['state']['jailUntil'] === 0, 'Self recovery charges the actual one-minute bail instead of resetting player state');
        connectedWait($base, $cookieA, 'crime');
        [$status, $hospital] = connectedHttp($base, 'POST', '/api/v1/crimes/journey-hospital114/attempt', [], $cookieA);
        connectedProof($status === 200 && $hospital['penalty']['type'] === 'hosp' && $hospital['penalty']['seconds'] === 180, 'Separate authored failure creates hospital time rather than jail');
        for ($i = 0; $i < 3; $i++) $recovery = connectedAct($base, $cookieA, 'item.use', 'journey-med114');
        connectedProof($recovery['state']['hospUntil'] === 0 && $recovery['state']['inv']['journey-med114'] === 0 && $recovery['state']['inv']['journey-tool114'] === 1,
            'Three owned timer-only medical uses recover the real sentence without fake Life or replacement items');
        [$status, $deposit] = connectedHttp($base, 'POST', '/api/v1/bank/deposit', ['amount' => 2000], $cookieB);
        connectedProof($status === 200 && $deposit['player']['cash'] === 500 && $deposit['player']['bank_balance'] === 2000, 'Second ordinary account banks real cash before the paired encounter');
        $protected = connectedFight($base, $cookieA, $b); $protectedB = connectedState($base, $cookieB);
        connectedProof($protected['result']['cashDelta'] === 25 && $protectedB['player']['cash'] === 475 && $protectedB['player']['bank_balance'] === 2000,
            'Real two-account Mug transfers only pocket cash while banked money remains protected');
        connectedAct($base, $cookieA, 'item.use', 'smallkit'); connectedAct($base, $cookieB, 'item.use', 'smallkit');
        [$status, $opponents] = connectedHttp($base, 'GET', '/api/v1/player-combat/opponents', null, $cookieA);
        $target = array_values(array_filter($opponents['players'] ?? [], static fn ($row) => $row['id'] === $b))[0] ?? null;
        [, $combatState] = connectedHttp($base, 'GET', '/api/v1/player-combat', null, $cookieA);
        $beforeDeniedStart = connectedStored($a);
        $beforeDeniedEnergy = $db->fetchOne('SELECT energy FROM players WHERE id=:id', ['id' => $a]);
        [$deniedStatus] = connectedHttp($base, 'POST', '/api/v1/player-combat/action', ['action' => 'start', 'opponentId' => $b, 'expectedVersion' => $combatState['version']], $cookieA);
        connectedProof($deniedStatus === 429 && connectedStored($a) === $beforeDeniedStart && $db->fetchOne('SELECT energy FROM players WHERE id=:id', ['id' => $a]) === $beforeDeniedEnergy,
            'Actual attack endpoint rejects the same active cooldown without charging more energy or money');
        $evidence['cooldownEligibility'] = ['player' => $target, 'attackCooldownSeconds' => $opponents['attackCooldownSeconds'] ?? null];
        connectedProof($status === 200 && $target !== null && !$target['eligible'] && stripos($target['reason'] ?? '', 'cooldown') !== false,
            'After real recovery, opponent eligibility explains the still-active attacker cooldown rather than advertising an impossible action');
        connectedProof(is_int($opponents['attackCooldownSeconds'] ?? null) && $opponents['attackCooldownSeconds'] > 0 && $opponents['attackCooldownSeconds'] <= 8,
            'Roster exposes actual server-clock attack seconds for localized remaining-time feedback');
        connectedWait($base, $cookieA, 'attack');
        [$status, $readyOpponents] = connectedHttp($base, 'GET', '/api/v1/player-combat/opponents', null, $cookieA);
        $readyTarget = array_values(array_filter($readyOpponents['players'] ?? [], static fn ($row) => $row['id'] === $b))[0] ?? null;
        connectedProof($status === 200 && ($readyTarget['eligible'] ?? false) && ($readyOpponents['attackCooldownSeconds'] ?? null) === 0,
            'After the real deadline, refreshed roster eligibility recovers instead of remaining permanently disabled');
        [$status, $withdrawal] = connectedHttp($base, 'POST', '/api/v1/bank/withdraw', ['amount' => 2000], $cookieB);
        connectedProof($status === 200 && $withdrawal['player']['cash'] === 2475 && $withdrawal['player']['bank_balance'] === 0, 'Ordinary withdrawal exposes only the actual saved bank balance');
        $unprotected = connectedFight($base, $cookieA, $b);
        connectedProof($unprotected['result']['cashDelta'] === 124 && $unprotected['result']['cashDelta'] > $protected['result']['cashDelta'], 'Second ordinary Mug demonstrates larger pocket exposure after the actual withdrawal');
        foreach ([$a, $b] as $id) {
            $stored = connectedStored($id); $state = json_decode($stored['progression']['state_json'], true, 512, JSON_THROW_ON_ERROR);
            foreach (['cash' => (int) $stored['player']['cash'], 'bank' => (int) $stored['player']['bank_balance']] as $asset => $balance) {
                $sum = array_sum(array_column(array_filter($stored['ledger'], static fn ($row) => $row['asset'] === $asset), 'amount'));
                connectedProof($sum === $balance, 'All real transactions reconcile retained ' . $asset . ' for ' . $id);
            }
            foreach ($state['inv'] as $item => $quantity) {
                $sum = array_sum(array_column(array_filter($stored['ledger'], static fn ($row) => $row['asset'] === 'item:' . $item), 'amount'));
                connectedProof($sum === $quantity, 'Every purchased, consumed and retained inventory unit reconciles for ' . $item);
            }
        }
        $transfers = $db->fetchAll("SELECT player_id,correlation_id,amount,reason FROM economy_ledger WHERE reason IN ('player-combat.mug.credit','player-combat.mug.debit')");
        connectedProof(count($transfers) === 4 && array_sum(array_column($transfers, 'amount')) === 0, 'Both paired Mug transfers conserve money in four correlated ledger rows');
        foreach ([$protected, $unprotected] as $settlement) {
            $rows = array_values(array_filter($transfers, static fn ($row) => $row['correlation_id'] === $settlement['result']['correlationId']));
            connectedProof(count($rows) === 2 && array_sum(array_column($rows, 'amount')) === 0
                && count(array_filter($rows, static fn ($row) => $row['player_id'] === $a && $row['amount'] > 0)) === 1
                && count(array_filter($rows, static fn ($row) => $row['player_id'] === $b && $row['amount'] < 0)) === 1,
                'The actual HTTP settlement correlation ties one actor credit to one defender debit');
        }
        $savedA = connectedStored($a); $savedB = connectedStored($b);
        proc_terminate($process); proc_close($process); $process = null;
        [$base, $process] = connectedStart(); $returnedA = connectedState($base, $cookieA); $returnedB = connectedState($base, $cookieB);
        connectedProof($returnedA['player']['id'] === $a && $returnedB['player']['id'] === $b && connectedStored($a) === $savedA && connectedStored($b) === $savedB,
            'Fresh owned HTTP restart and ordinary cookie return retain both complete journeys without grants or settlement replay');
        $returnedHashes = [];
        foreach ($sourceFiles as $file) $returnedHashes[str_replace($sourceBase, '', str_replace('\\', '/', $file))] = hash_file('sha256', $file);
        connectedProof($returnedHashes === $sourceHashes, 'All executed engine and test source hashes stayed byte-identical throughout the connected journey');
        $evidence['final'] = ['a' => $savedA, 'b' => $savedB, 'protectedMug' => 25, 'unprotectedMug' => 124, 'restartCount' => 1];
        $evidence['result'] = 'passed'; echo "CONNECTED JOURNEY114 RESULT: {$passed} passed, 0 failed\n";
    } finally {
        if (is_resource($process)) { proc_terminate($process); proc_close($process); }
        $evidence['sourceSha256'] = $sourceHashes;
        $evidence['testSha256'] = $sourceHashes['tests/connected-journey114.php']; $evidence['passedAssertions'] = $passed;
        file_put_contents($prefix . '.json', json_encode($evidence, JSON_THROW_ON_ERROR | JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . PHP_EOL);
        echo 'CONNECTED JOURNEY114 EVIDENCE: ' . $prefix . '.json' . PHP_EOL;
    }
}
