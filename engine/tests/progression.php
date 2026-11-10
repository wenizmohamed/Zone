<?php
declare(strict_types=1);
require dirname(__DIR__) . '/bootstrap.php';

use Zone\Engine\Core\Persistence\Database;
use Zone\Engine\Core\Events\EventBus;
use Zone\Engine\Core\Game\ProgressionService;

$dbPath = ZONE_ENGINE_ROOT . '/var/progression-test-' . bin2hex(random_bytes(6)) . '.sqlite';
$db = Database::connect('sqlite:' . $dbPath);
$db->migrateAndSeed();
$service = new ProgressionService($db, new EventBus($db));
$passed = 0;
$failed = 0;
function proof(bool $condition, string $name): void {
    global $passed, $failed;
    if ($condition) { $passed++; echo "PASS: $name\n"; }
    else { $failed++; fwrite(STDERR, "FAIL: $name\n"); }
}
function action(string $type, string $id): array {
    global $service;
    $state = $service->snapshot('founder-player');
    $quote = $type === 'market.buy' ? (array_column($state['state']['market'], 'price', 'item')[$id] ?? null) : null;
    return $service->act($type, $id, $state['state']['version'], 'founder-player', $quote);
}
function rejects(callable $call, string $fragment, string $name): void {
    try { $call(); proof(false, $name); }
    catch (Throwable $e) { proof(str_contains($e->getMessage(), $fragment), $name . ' [' . $e->getMessage() . ']'); }
}
function patchState(callable $change): void {
    global $db;
    $row = $db->fetchOne('SELECT state_json FROM player_progression WHERE player_id = :id', ['id' => 'founder-player']);
    $state = json_decode($row['state_json'], true, 512, JSON_THROW_ON_ERROR);
    $change($state);
    $db->execute('UPDATE player_progression SET state_json = :state WHERE player_id = :id', ['state' => json_encode($state), 'id' => 'founder-player']);
}

try {
    $initial = $service->snapshot('founder-player');
    proof(count($initial['catalogs']['items']) === 58, 'all existing item definitions available from server');
    proof($initial['state']['inv']['smallkit'] === 3 && $initial['state']['prop'] === 'apt', 'existing founder inventory and property preserved as initial demo seed');
    $bought = action('market.buy', 'drink');
    proof($bought['player']['cash'] === $initial['player']['cash'] - 990 && $bought['state']['inv']['drink'] === 3, 'market purchase debits authoritative cash and persists item');
    $resumed = (new ProgressionService($db, new EventBus($db)))->snapshot('founder-player');
    proof($resumed['state']['inv']['drink'] === 3 && $resumed['player']['cash'] === $bought['player']['cash'], 'new service session reloads purchase and wallet consistently');
    rejects(fn () => $service->act('market.buy', 'drink', $initial['state']['version'], 'founder-player'), 'Progression state changed.', 'stale tab cannot duplicate purchase');
    proof($service->snapshot('founder-player')['player']['cash'] === $bought['player']['cash'], 'stale request leaves wallet unchanged');
    rejects(fn () => action('item.buy', 'sniper'), 'Not enough cash', 'insufficient cash blocks purchase');
    rejects(fn () => action('item.equip', 'sniper'), 'do not own', 'unowned weapons cannot be equipped');
    action('item.equip', 'revolver');
    proof($service->snapshot('founder-player')['state']['equip'] === 'revolver', 'owned equipment persists');
    $sold = action('item.sell', 'revolver');
    proof($sold['state']['inv']['revolver'] === 0 && $sold['state']['equip'] === null, 'selling last equipped item clears equipment');
    rejects(fn () => action('item.sell', 'revolver'), 'do not own', 'sold item cannot be sold twice');
    rejects(fn () => action('item.use', 'drink'), 'resources are full', 'full bars keep consumable');
    $service->applyPenalty('founder-player', 'hosp', 10);
    rejects(fn () => action('item.use', 'drink'), 'resources are full', 'hospital does not allow wasting a full-nerve booster');
    proof($service->snapshot('founder-player')['state']['inv']['drink'] === 3, 'ineffective hospitalized item use preserves inventory');
    $hospitalKit = action('item.use', 'smallkit');
    proof($hospitalKit['state']['hospUntil'] === 0 && $hospitalKit['state']['inv']['smallkit'] === 2, 'medical item can still clear hospital with full life');
    $db->execute('UPDATE players SET nerve = 20 WHERE id = :id', ['id' => 'founder-player']);
    $used = action('item.use', 'drink');
    proof($used['player']['nerve'] === 24 && $used['state']['inv']['drink'] === 2, 'item consumption changes authoritative resource exactly once');
    $claimed = action('mission.claim', 'b1');
    proof($claimed['state']['points'] === 122 && $claimed['result']['cashDelta'] === 2000, 'server purchase progress unlocks mission reward');
    rejects(fn () => action('mission.claim', 'b1'), 'already been claimed', 'mission reward cannot be replayed');
    rejects(fn () => action('mission.claim', 't4'), 'Complete the mission', 'client cannot claim unearned mission');
    $service->recordMetric('founder-player', 'trains', 4);
    proof(action('mission.claim', 't4')['result']['cashDelta'] === 3000, 'trusted engine metrics unlock corresponding mission');
    $service->recordCrime('founder-player', 'searchforcash', true);
    $crime = $service->snapshot('founder-player')['state'];
    proof($crime['ctr']['crimes'] === 1 && $crime['crimeXp'] === 98 && $crime['skill']['searchforcash'] === 1, 'crime skill and successful count use trusted server record');
    $enrolled = action('course.enroll', 'bio');
    proof($enrolled['state']['edu']['total'] === 1200000, 'education uses twenty actual server-clock minutes');
    rejects(fn () => action('course.enroll', 'bio'), 'already active', 'duplicate enrollment cannot charge again');
    patchState(function (&$state) { $state['edu']['until'] = 1; });
    $completed = $service->snapshot('founder-player');
    proof($completed['state']['edu'] === null && $completed['state']['eduDone']['bio'] === 1 && $completed['player']['max_life'] === $initial['player']['max_life'] + 50, 'elapsed course applies persisted effect');
    proof($service->snapshot('founder-player')['player']['max_life'] === $completed['player']['max_life'], 'education completion applies only once');
    action('property.buy', 'shack');
    $moved = action('property.buy', 'apt');
    proof($moved['result']['cashDelta'] === 0 && $moved['player']['max_happy'] === 500, 'moving back to owned property is free and restores correct happy cap');
    rejects(fn () => action('property.buy', 'island'), 'Not enough cash', 'unaffordable property does not alter ownership');
    rejects(fn () => action('job.take', 'firm'), 'level is too low', 'job level requirement enforced on server');
    proof(action('job.take', 'army')['state']['job'] === 'army', 'available selected job persists');
    rejects(fn () => action('gym.join', '7'), 'Train more', 'gym progression gate cannot be bypassed');
    $upgrade = action('faction.upgrade', 'energyMax');
    proof($upgrade['player']['max_energy'] === $initial['player']['max_energy'] + 10, 'family energy upgrade affects authoritative cap');
    rejects(fn () => action('faction.upgrade', 'energyMax'), 'already owned', 'upgrade cannot be charged or applied twice');
    $beforeRevive = $service->snapshot('founder-player')['player']['energy'];
    $revived = action('hospital.revive', 'patient-0');
    proof($revived['player']['energy'] === $beforeRevive - 75 && $revived['state']['patients'][0]['until'] === 0, 'revive consumes server energy and persists target recovery');
    rejects(fn () => action('hospital.revive', 'patient-0'), 'already recovered', 'revive cannot farm the same patient repeatedly');
    patchState(function (&$state) { $state['jailUntil'] = (int) floor(microtime(true) * 1000) + 120000; });
    rejects(fn () => action('market.buy', 'drink'), 'leave jail or hospital', 'jailed player cannot buy while blocked');
    $bailed = action('jail.bailSelf', 'self');
    proof($bailed['state']['jailUntil'] === 0 && $bailed['result']['cashDelta'] < 0, 'bail clears persisted jail with authoritative charge');
    $service->applyPenalty('founder-player', 'hosp', 10);
    rejects(fn () => $service->assertAvailable('founder-player', 'crime'), 'leave jail or hospital', 'server penalty blocks other engine actions');
    $service->assertAvailable('founder-player', 'hospital');
    $service->clearHospital('founder-player');
    proof($service->snapshot('founder-player')['state']['hospUntil'] === 0, 'authoritative paid treatment clears hospital status');
    patchState(function (&$state) { $state['fac']['chain'] = 9; $state['fac']['chainAt'] = (int) floor(microtime(true) * 1000); });
    proof($service->recordCombatWin('founder-player', 12, 'hosp') === 437, 'tenth hospitalization awards one server chain milestone');
    $afterChain = $service->snapshot('founder-player')['state'];
    proof($afterChain['ctr']['wins'] === 1 && $afterChain['fac']['chain'] === 10, 'combat outcome records win and chain together');
    proof($service->recordCombatWin('founder-player', 12, 'mug') === 0 && $service->snapshot('founder-player')['state']['fac']['chain'] === 10, 'mug does not add hospitalization respect or chain');
    $engine = zone_engine('sqlite:' . $dbPath);
    $db->execute("UPDATE territory_blocks SET benefit_key = 'market_discount', benefit_value = 2000 WHERE id = 'ZC-053'");
    $quote = array_column($service->snapshot('founder-player')['state']['market'], null, 'item')['drink'];
    proof($quote['price'] === 911 && $quote['discountBasisPoints'] === 800, 'owned market advantage is quoted and capped below resale spread');
    $oldMarket = $service->snapshot('founder-player');
    rejects(fn () => $service->act('market.buy', 'drink', $oldMarket['state']['version'], 'founder-player'), 'current market price', 'market purchase requires the displayed quote');
    $db->execute("UPDATE territory_blocks SET benefit_value = 0 WHERE id = 'ZC-053'");
    rejects(fn () => $service->act('market.buy', 'drink', $oldMarket['state']['version'], 'founder-player', $quote['price']), 'market price changed', 'changed family benefit cannot silently increase purchase price');
    $afterRejection = $service->snapshot('founder-player');
    proof($afterRejection['player']['cash'] === $oldMarket['player']['cash'] && $afterRejection['state']['inv']['drink'] === $oldMarket['state']['inv']['drink'], 'rejected price change preserves wallet and inventory');
    $db->execute("UPDATE territory_blocks SET benefit_value = 2000 WHERE id = 'ZC-053'");
    $discountBuy = action('market.buy', 'drink');
    proof($discountBuy['result']['cashDelta'] === -$quote['price'], 'merchant charge exactly matches the displayed family discount');
    $resale = action('item.sell', 'drink');
    proof($resale['result']['cashDelta'] < -$discountBuy['result']['cashDelta'], 'buy-sell loop cannot mint money from stacked discounts');
    $engine->changeModule('territories', 'disable');
    proof(array_column($service->snapshot('founder-player')['state']['market'], null, 'item')['drink']['price'] === 911, 'unpublished territory module edit cannot change market prices');
    $engine->publishRelease('progression-test');
    proof(array_column($service->snapshot('founder-player')['state']['market'], null, 'item')['drink']['price'] === 990, 'published disabled territory module removes market advantage');
    $ledger = $db->fetchAll('SELECT * FROM economy_ledger WHERE player_id = :id ORDER BY rowid', ['id' => 'founder-player']);
    $cashDelta = array_sum(array_map(fn ($row) => $row['asset'] === 'cash' ? (int) $row['amount'] : 0, $ledger));
    proof($service->snapshot('founder-player')['player']['cash'] === $initial['player']['cash'] + $cashDelta, 'all cash changes reconcile exactly with economy ledger');
    rejects(fn () => action('item.buy', '../../secret'), 'Unknown item', 'unknown item identifiers rejected');
    $hj = action('torn.happyJump', 'stack');
    proof($hj['result']['type'] === 'torn.happyJump' && $hj['state']['cooldowns']['drugUntil'] > 0, 'server-authoritative torn.happyJump stacks happy/energy and arms drug cooldown');
    $shop = action('torn.shoplift', 'sallys');
    proof($shop['result']['cashDelta'] === 3800 && $shop['state']['skill']['shoplift'] >= 1, 'server-authoritative torn.shoplift spends nerve, awards loot, and increments shoplift skill');
    $prep = action('torn.combatPrep', 'heart:ap:secondary');
    proof($prep['state']['tornCombat']['hitbox'] === 'heart' && $prep['state']['tornCombat']['ammo'] === 'ap', 'server-authoritative torn.combatPrep persists hitbox and special ammo for CombatService');
    $cd = action('torn.bankCd', '30d');
    proof($cd['state']['tornState']['activeCd']['term'] === '30d' && $cd['result']['bankDelta'] === 25400, 'server-authoritative torn.bankCd locks certificate and credits vault yield');
} catch (Throwable $e) {
    proof(false, 'unexpected exception: ' . $e->getMessage());
    fwrite(STDERR, $e->getTraceAsString() . "\n");
}
echo "\nProgression: $passed passed, $failed failed.\n";
exit($failed > 0 ? 1 : 0);
