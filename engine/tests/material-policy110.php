<?php
declare(strict_types=1);

// Test-process-only seams: production retains the same RNG calls/server clock.
namespace Zone\Engine\Application {
    function random_int(int $minimum, int $maximum): int {
        $GLOBALS['material110Rng'][] = [$minimum, $maximum];
        if ($minimum === 1 && $maximum === 100) return $GLOBALS['material110Roll'] ?? 1;
        if ($minimum === 1 && $maximum === 10000 && !empty($GLOBALS['material110Fail'])) return 10000;
        return $minimum;
    }
}
namespace Zone\Engine\Core\Game {
    function time(): int { return $GLOBALS['material110Clock'] ?? \time(); }
}
namespace {
require dirname(__DIR__) . '/bootstrap.php';

use Zone\Engine\Core\Content\ContentManager;
use Zone\Engine\Core\Contracts\EventSubscriber;
use Zone\Engine\Core\Events\DomainEvent;
use Zone\Engine\Core\Events\EventBus;
use Zone\Engine\Core\Game\MaterialLootService;
use Zone\Engine\Core\Game\ProgressionService;
use Zone\Engine\Core\Game\WorldDirector;
use Zone\Engine\Core\Persistence\Database;
use Zone\Engine\Core\Publishing\ReleaseManager;

putenv('ZONE_REDIS_URL=');
$configured = getenv('ZONE_MATERIAL_TEST_URL');
if (is_string($configured) && $configured !== '') {
    $target = parse_url($configured);
    $sqliteRoot = str_replace('\\', '/', ZONE_ENGINE_ROOT . '/var/material-policy110-');
    if (str_starts_with($configured, 'sqlite:')) {
        if (!str_starts_with(str_replace('\\', '/', substr($configured, 7)), $sqliteRoot)) throw new RuntimeException('Only a material-policy test SQLite file is allowed.');
    } elseif ($target === false || !in_array($target['scheme'] ?? '', ['postgres','postgresql'], true)
        || !in_array($target['host'] ?? '', ['127.0.0.1','localhost'], true) || ($target['port'] ?? 0) !== 55433
        || !preg_match('~^/zone_beta_smoke_material110_[a-z0-9_]+$~D', $target['path'] ?? '') || strlen(ltrim($target['path'] ?? '', '/')) > 63) {
        throw new RuntimeException('A newly named disposable loopback material test database is required.');
    }
    $url = $configured;
} else $url = 'sqlite:' . ZONE_ENGINE_ROOT . '/var/material-policy110-' . bin2hex(random_bytes(7)) . '.sqlite';

function issueForTest(Database $db, EventBus $events, string $source, string $key, string $player, ?array $context = null, int $choice = 0): array {
    $loot = new MaterialLootService($db, $events); $context ??= $loot->publishedContext();
    return $loot->issue($source, $source === 'world' ? hash('sha256', $key) : $key, $source === 'world' ? null : $player, 1, $choice,
        static function (array $receipt) use ($db, $events, $source, $player, $context): void {
            if ($source === 'search') (new ProgressionService($db, $events, $context['catalog']))->grantItem($player, $receipt['itemId'], 1, substr(hash('sha256', $receipt['correlationId']), 0, 32), 'crime.loot');
            else $db->execute('INSERT INTO world_finds(id,item_id,quantity,location_id,created_at,expires_at) VALUES(:id,:item,1,\'market\',:at,:expires)', ['id' => $receipt['correlationId'], 'item' => $receipt['itemId'], 'at' => $GLOBALS['material110Clock'], 'expires' => $GLOBALS['material110Clock'] + 900]);
        }, $context);
}

// Each owned child receives the disposable URL in its environment, never CLI.
if (($argv[1] ?? '') === '--worker') {
    $db = Database::connect($url); $events = new EventBus($db);
    $GLOBALS['material110Clock'] = (int) $argv[5];
    echo "READY\n"; fflush(STDOUT); fgets(STDIN);
    try {
        if ($argv[2] === 'hold-search') {
            $result = $db->playerTransaction($argv[4], function () use ($db, $events, $argv): array {
                $result = issueForTest($db, $events, 'search', $argv[3], $argv[4]);
                echo "HOLDING\n"; fflush(STDOUT); fgets(STDIN); return $result;
            });
        } else $result = issueForTest($db, $events, $argv[2], $argv[3], $argv[4]);
        echo json_encode(['ok' => true, 'result' => $result], JSON_THROW_ON_ERROR) . "\n";
    } catch (Throwable $error) { echo json_encode(['ok' => false, 'class' => $error::class], JSON_THROW_ON_ERROR) . "\n"; }
    exit;
}

$engine = zone_engine($url); $db = Database::connect($url); $events = new EventBus($db);
$service = new MaterialLootService($db, $events); $releases = new ReleaseManager($db, $events); $count = 0;
$hour = intdiv(\time(), 3600) * 3600; $GLOBALS['material110Clock'] = $hour + 5;
function proof110(bool $condition, string $label): void { global $count; if (!$condition) throw new RuntimeException('FAIL: ' . $label); $count++; echo 'PASS: ' . $label . "\n"; }
// JSONB may reorder object members, never ordered lists or scalar types.
function canonical110(mixed $value): mixed { if (!is_array($value)) return $value; if (!array_is_list($value)) ksort($value,SORT_STRING); return array_map('canonical110',$value); }
function same110(mixed $left, mixed $right): bool { return canonical110($left)===canonical110($right); }
function reject110(callable $operation, string $label): void { try { $operation(); } catch (InvalidArgumentException|RuntimeException $error) { proof110(true, $label); return; } throw new RuntimeException('FAIL: expected rejection: ' . $label); }
function player110(): string { global $engine; return $engine->browserSessions()->create('material110-' . bin2hex(random_bytes(8)))['playerId']; }
function inv110(string $id): array { global $engine; return $engine->gameplay($id)['state']['inv']; }
function spent110(string $source, string $scope, ?int $clock = null): int {
    global $db; $clock ??= $GLOBALS['material110Clock'];
    return (int) $db->fetchOne('SELECT COALESCE(SUM(issued_value),0) AS total FROM material_issuance WHERE source=:source AND scope_id=:scope AND hour_start=:hour', ['source' => $source, 'scope' => $scope, 'hour' => intdiv($clock, 3600) * 3600])['total'];
}
function policy110(array $changes, bool $publish = true): array {
    global $engine; $draft = $engine->releaseDraft(); $manifest = $draft['manifest']; $manifest['worldPolicy'] = $changes;
    $saved = $engine->saveReleaseDraft($manifest, 'material-policy110', $draft['draftFingerprint']);
    return $publish ? $engine->publishRelease('material-policy110', $saved['draftFingerprint']) : $saved;
}
function child110(string $source, string $key, string $player): array {
    global $url; $command = [PHP_BINARY]; if (str_starts_with($url, 'postgres')) array_push($command, '-d', 'extension=pdo_pgsql');
    array_push($command, __FILE__, '--worker', $source, $key, $player, (string) $GLOBALS['material110Clock']);
    $process = proc_open($command, [0 => ['pipe','r'],1 => ['pipe','w'],2 => ['pipe','w']], $pipes, ZONE_REPOSITORY_ROOT, [...getenv(), 'ZONE_MATERIAL_TEST_URL' => $url], ['bypass_shell' => true]);
    if (!is_resource($process)) throw new RuntimeException('Could not start the isolated race child.');
    stream_set_timeout($pipes[1], 10); if (trim((string) fgets($pipes[1])) !== 'READY') throw new RuntimeException('Race child did not initialize.');
    return [$process,$pipes];
}
function finish110(array $child): array {
    [$process,$pipes] = $child; $line = trim((string) fgets($pipes[1]));
    foreach ($pipes as $pipe) fclose($pipe); $exit = proc_close($process);
    if ($exit !== 0 || $line === '') throw new RuntimeException('Isolated race child did not finish.');
    return json_decode($line, true, 16, JSON_THROW_ON_ERROR);
}

$db->execute('UPDATE cooldown_config SET seconds=0'); // Isolated deterministic tests only.
$engine = zone_engine($url);
$a = player110(); $b = player110(); $c = player110();
$engine->publishRelease('material110-legacy');
$legacyManifest=$engine->activeRelease()['manifest'];$originalSearch=array_column($engine->adminCrimes(),null,'id')['searchforcash'];$sandPrice=$engine->adminGameplayCatalog()['catalogs']['items']['sand']['price'];
$engine->saveCrime('searchforcash',['cash_min'=>999,'cash_max'=>999],'material110-draft-only');
$catalog=$engine->adminGameplayCatalog();$engine->saveGameplayCatalog('items','sand',['price'=>$sandPrice+1],$catalog['revision'],'material110-draft-only');
foreach(['absent','null']as$legacyShape){
    $manifest=$legacyManifest;if($legacyShape==='absent')unset($manifest['content']);else$manifest['content']=null;
    $releases->saveDraft($manifest,'material110-legacy-'.$legacyShape);$oldRelease=$releases->publish('material110-legacy-'.$legacyShape);
    $raw=json_decode((string)$db->fetchOne('SELECT manifest_json FROM content_releases WHERE id=:id',['id'=>$oldRelease['id']])['manifest_json'],true,64,JSON_THROW_ON_ERROR);
    proof110(!isset($raw['content']),'real legacy '.$legacyShape.'-content publication retains its supported snapshotless stored shape');
    $oldContext=$service->publishedContext();$bootstrap=$engine->gameBootstrap();
    proof110($oldContext['releaseId']===$oldRelease['id'] && same110($oldContext['crimes'],$bootstrap['content']['crimes']) && count($oldContext['crimes'])===31 && $oldContext['catalog']['items']['sand']['price']===$sandPrice,'legacy '.$legacyShape.' context and bootstrap share immutable foundation crimes/catalog, never mutable draft edits');
    $engine->publishRelease('material110-intermediate');$engine->activateRelease($oldRelease['id'],'material110-legacy-rollback');
    $played=$engine->attemptCrime('searchforcash',player110());
    proof110($played['success'] && $played['reward']['cash']===80 && $service->publishedContext()['releaseId']===$oldRelease['id'],'actual rollback to legacy '.$legacyShape.' release settles its visible foundation crime under retained release identity');
}
$engine->saveCrime('searchforcash',$originalSearch,'material110-restore');$catalog=$engine->adminGameplayCatalog();$engine->saveGameplayCatalog('items','sand',['price'=>$sandPrice],$catalog['revision'],'material110-restore');$engine->publishRelease('material110-restored');
$legacy = WorldDirector::normalizePolicy([]);
proof110($legacy['findValueBudgetPerHour'] === null && $legacy['searchValueBudgetPerHour'] === null && $legacy['materialItemIds'] === null, 'absent policy fields remain nullable legacy settings without silent opt-in');
$GLOBALS['material110Rng'] = []; $first = $engine->attemptCrime('searchforcash', $a);
proof110($first['loot'] === ['itemId' => 'sand','quantity' => 1] && $first['lootStatus'] === 'awarded' && $first['lootRollWon'] === true, 'legacy successful search retains its real single sand award');
proof110($GLOBALS['material110Rng'] === [[1,10000],[80,240],[1,100]], 'legacy successful search preserves the exact success/cash/12-percent RNG call sequence');
$GLOBALS['material110Roll'] = 13; $miss = $engine->attemptCrime('searchforcash', $a);
proof110($miss['loot'] === null && $miss['lootStatus'] === 'missed' && $miss['lootRollWon'] === false, 'a losing 12-percent roll is distinct from budget suppression');
$GLOBALS['material110Roll'] = 1; $GLOBALS['material110Fail'] = true; $GLOBALS['material110Rng'] = []; $failure = $engine->attemptCrime('searchforcash', $a); $GLOBALS['material110Fail'] = false;
proof110($failure['lootStatus'] === 'not-rolled' && $failure['lootRollWon'] === null && !in_array([1,100], $GLOBALS['material110Rng'], true), 'a failed search makes no material roll or reservation');
$baselineOwned = inv110($a);
$oldFind = hash('sha256','legacy-unclaimed-material110');
$db->execute('INSERT INTO world_finds(id,item_id,quantity,location_id,created_at,expires_at) VALUES(:id,\'sand\',1,\'market\',:at,:expires)', ['id' => $oldFind, 'at' => $GLOBALS['material110Clock']-60, 'expires' => $GLOBALS['material110Clock']+86400]);
$engine->createGameplayCatalog('items','copper-scrap',['type'=>'material','price'=>40,'name'=>['en'=>'Scrap Copper Wire','ar'=>'سلك نحاس خردة']],$engine->adminGameplayCatalog()['revision'],'material110');
proof110(!isset($service->publishedContext()['catalog']['items']['copper-scrap']),'a new draft-only eligible material never leaks into the published pool');
$engine->publishRelease('material110-multi-material-legacy');
$pool110=static function(string$key)use($db,$events,$c):array{return[issueForTest($db,$events,'search',$key.'-0',$c,null,0)['itemId'],issueForTest($db,$events,'search',$key.'-1',$c,null,1)['itemId']];};
$absentBefore=$pool110('absent-before-old-save');policy110(['tickSeconds'=>120]);$absentAfter=$pool110('absent-after-old-save');
proof110(!array_key_exists('materialItemIds',$engine->activeRelease()['manifest']['worldPolicy'])&&$absentBefore===['copper-scrap','sand']&&$absentAfter===$absentBefore,'absent eligible IDs include both published materials before and after an old-field-only policy save');
policy110(['materialItemIds'=>null]);$nullBefore=$pool110('null-before-old-save');policy110(['tickSeconds'=>60]);$nullAfter=$pool110('null-after-old-save');
proof110(array_key_exists('materialItemIds',$engine->activeRelease()['manifest']['worldPolicy'])&&$engine->activeRelease()['manifest']['worldPolicy']['materialItemIds']===null&&$nullBefore===$absentBefore&&$nullAfter===$nullBefore,'explicit null has the same multi-material pool and survives an old-field-only policy save without a hidden marker');
$catalog=$engine->adminGameplayCatalog();$engine->saveGameplayCatalog('items','copper-scrap',['price'=>80],$catalog['revision'],'material110-draft-price');
$reviewed = $engine->releaseDraft();
$configuredPolicy = ['enabled'=>true,'findsPerTick'=>1,'findQuantity'=>1,'findLifetimeSeconds'=>60,'maxActiveFinds'=>64,'supplyShift'=>0,'findValueBudgetPerHour'=>360,'searchValueBudgetPerHour'=>360,'materialItemIds'=>['copper-scrap']];
policy110($configuredPolicy,false);
proof110($engine->gameBootstrap()['worldPolicy']['findValueBudgetPerHour'] === null && $service->publishedContext()['catalog']['items']['copper-scrap']['price']===40, 'draft budgets and material-price edits never leak into published context');
reject110(fn () => $engine->publishRelease('material110-stale',$reviewed['draftFingerprint']), 'policy edits invalidate stale reviewed publication fingerprints');
$catalog=$engine->adminGameplayCatalog();$engine->saveGameplayCatalog('items','copper-scrap',['price'=>40],$catalog['revision'],'material110-draft-price-restore');
$valid = $engine->releaseDraft()['manifest'];
foreach ([['findValueBudgetPerHour'=>-1],['findValueBudgetPerHour'=>2_000_000_001],['findValueBudgetPerHour'=>'360'],['findValueBudgetPerHour'=>360.0],['searchValueBudgetPerHour'=>true],['materialItemIds'=>[]],['materialItemIds'=>['sand','sand']],['materialItemIds'=>['missing-material']],['materialItemIds'=>['bat']],['materialItemIds'=>['named'=>'sand']],['materialItemIds'=>array_map(fn($n)=>'m'.$n,range(1,33))],['searchLoot'=>['budget'=>360]]] as $index=>$bad) {
    $draft=$engine->releaseDraft(); $manifest=$valid; $manifest['worldPolicy']=[...$configuredPolicy,...$bad];
    reject110(fn () => $engine->saveReleaseDraft($manifest,'material110-invalid',$draft['draftFingerprint']), 'strict world-policy validation rejects invalid budget/reference/list/unknown-key case '.$index);
}
foreach (['missing','wrong-type'] as $case) {
    $manifest=$valid; $manifest['content']['gameplayCatalog']=$engine->adminGameplayCatalog()['catalogs'];
    if($case==='missing') unset($manifest['content']['gameplayCatalog']['items']['copper-scrap']);
    else $manifest['content']['gameplayCatalog']['items']['copper-scrap']=['type'=>'weapon','price'=>40,'mult'=>1,'name'=>['en'=>'Wrong type','ar'=>'نوع خاطئ']];
    $saved=$engine->saveReleaseDraft($manifest,'material110-full-release');
    reject110(fn () => $releases->publish('material110-full-release',$saved['draftFingerprint']), 'full release validation rejects '.$case.' material in the actual manifest catalog');
}
$engine->saveReleaseDraft($valid,'material110-restore');
$partial = policy110(['tickSeconds'=>120],false)['manifest']['worldPolicy'];
proof110($partial['findValueBudgetPerHour']===360 && $partial['searchValueBudgetPerHour']===360 && $partial['materialItemIds']===['copper-scrap'], 'partial policy updates preserve prior supported nullable fields and eligibility');
$null = policy110(['searchValueBudgetPerHour'=>null],false)['manifest']['worldPolicy'];
proof110($null['searchValueBudgetPerHour']===null && $null['findValueBudgetPerHour']===360, 'explicit null opts only that source out while preserving other settings');
$priorCrime = array_values(array_filter($engine->adminCrimes(),fn($row)=>$row['id']==='graffiti'))[0];
$engine->saveCrime('graffiti',['required_item'=>'bat','required_quantity'=>1,'consume_tool'=>false,'mastery_per_success'=>3,'chain_window_seconds'=>222,'chain_bonus_basis_points'=>12,'critical_failure_basis_points'=>50,'jail_seconds'=>60,'hospital_seconds'=>0],'material110');
$partialCrime=$engine->saveCrime('graffiti',['cash_max'=>801],'material110');
proof110($partialCrime['required_item']==='bat' && $partialCrime['mastery_per_success']===3 && $partialCrime['chain_window_seconds']===222 && $partialCrime['critical_failure_basis_points']===50 && $partialCrime['jail_seconds']===60,'partial crime authoring retains supported tool/mastery/chain/consequence rules');
$preview=array_column($engine->adminCrimes(),null,'id');$publishedCrimes=array_column($engine->activeRelease()['manifest']['content']['crimes'],null,'id');$metadataMatches=true;
foreach($publishedCrimes as$id=>$crime)foreach(['category','crime_xp_required','failure','penalty_minutes','description']as$field)if(!same110($preview[$id][$field]??null,$crime[$field]??null))$metadataMatches=false;
proof110($metadataMatches && $preview['graffiti']['cash_max']===801,'post-save Studio preview retains the same category, XP gates and legacy consequence metadata as release capture');
$savedPreview=$partialCrime;unset($savedPreview['correlationId']);
proof110($savedPreview===$preview['graffiti'] && preg_match('/^[a-f0-9]{32}$/D',$partialCrime['correlationId'])===1,'immediate crime save response equals the enriched admin preview row and retains its audit correlation');
$forgedPreview=$engine->saveCrime('graffiti',['category'=>'boot','crime_xp_required'=>999999,'failure'=>'hosp','penalty_minutes'=>999,'description'=>'untrusted preview metadata'],'material110');
foreach(['category','crime_xp_required','failure','penalty_minutes','description']as$field)proof110(same110($forgedPreview[$field]??null,$publishedCrimes['graffiti'][$field]??null),'crime save response retains server-owned '.$field.' metadata instead of client authoring it');
proof110(count(array_filter($preview,fn($crime)=>($crime['category']??'search')==='search'))===6 && $preview['bootlegging']['category']==='boot' && $preview['bootlegging']['crime_xp_required']===150 && $preview['lab']['failure']==='hosp','existing preview routes do not collapse into Search or lose Boot/Hospital classification');
$engine->saveCrime('graffiti',$priorCrime,'material110-restore');
$release=policy110([...$configuredPolicy,'tickSeconds'=>60]);
proof110($engine->gameBootstrap()['worldPolicy']['materialItemIds']===['copper-scrap'] && $engine->world()->snapshot($a)['policy']['searchValueBudgetPerHour']===360,'public bootstrap and world snapshot expose the effective flat normalized policy');
proof110(inv110($a)===$baselineOwned,'publication changes no saved owned inventory or retrospective material budget');
$GLOBALS['material110Clock']=$hour+3600+5; $world=$engine->world(); $created=0;
for($minute=0;$minute<13;$minute++){ $GLOBALS['material110Clock']=$hour+3600+$minute*60+5; $created+=$world->tick()['createdFinds']; }
proof110($created===10 && spent110('world','*')===360,'world global value budget issues exactly ten copper units despite expiry freeing active slots');
proof110((int)$db->fetchOne("SELECT COUNT(*) AS n FROM material_issuance WHERE source='world' AND status='awarded'")['n']===10,'world reservations freeze actual issue-time resale value and quantities');
$beforeTickRows=(int)$db->fetchOne('SELECT COUNT(*) AS n FROM material_issuance')['n']; $world->tick(); (new WorldDirector($db,$events))->tick();
proof110((int)$db->fetchOne('SELECT COUNT(*) AS n FROM material_issuance')['n']===$beforeTickRows,'same tick and reconstructed worker cannot duplicate issuance or skipped outcomes');
$db->execute('UPDATE world_finds SET expires_at=:expired WHERE claimed_by IS NULL AND id<>:old',['expired'=>$GLOBALS['material110Clock']-90000,'old'=>$oldFind]); $GLOBALS['material110Clock']+=60; $world->tick();
proof110(spent110('world','*')===360 && (int)$db->fetchOne('SELECT COUNT(*) AS n FROM world_finds WHERE id<>:old',['old'=>$oldFind])['n']===0,'expired unclaimed find cleanup cannot refund or erase frozen issued value');
$fp=$engine->releaseDraft()['draftFingerprint'];
for($i=0;$i<10;$i++) $search=issueForTest($db,$events,'search','player-b-'.$i,$b);
$ownedB=inv110($b); $cap=issueForTest($db,$events,'search','player-b-capped',$b);
proof110(spent110('search',$b)===360 && ($ownedB['copper-scrap']??0)===10 && $cap['status']==='budget-capped' && inv110($b)===$ownedB,'all search IDs share a per-player hourly budget and cap without a second grant');
$other=issueForTest($db,$events,'search','player-c-first',$c);
proof110($other['status']==='awarded' && spent110('search',$c)===36 && spent110('world','*')===360,'another player search budget and the global world budget are independent');
$again=issueForTest($db,$events,'search','player-b-0',$b);
proof110($again['replayed'] && inv110($b)===$ownedB && spent110('search',$b)===360,'same settlement correlation replays the receipt without double reservation or inventory grant');
proof110($engine->releaseDraft()['draftFingerprint']===$fp,'ordinary issuance and scoped serialization do not invalidate owner review fingerprints');
$engine->publishRelease('material110-republication');
proof110(issueForTest($db,$events,'search','after-republish',$b)['status']==='budget-capped' && spent110('search',$b)===360,'republication does not reset a player budget');
$GLOBALS['material110Clock']=$hour+7200; $newHour=issueForTest($db,$events,'search','new-hour',$b);
proof110($newHour['status']==='awarded' && spent110('search',$b)===36,'a UTC hour boundary starts a fresh allowance without carry');
$cappedReplay=issueForTest($db,$events,'search','player-b-capped',$b);
proof110($cappedReplay['status']==='budget-capped' && $cappedReplay['replayed'] && spent110('search',$b)===36,'a capped settlement cannot become later debt after an hour change');
$item=$engine->adminGameplayCatalog();$engine->saveGameplayCatalog('items','copper-scrap',['price'=>80],$item['revision'],'material110-price');
$review=$engine->releaseDraft();$item=$engine->adminGameplayCatalog();$engine->saveGameplayCatalog('items','copper-scrap',['price'=>40],$item['revision'],'material110-price');
reject110(fn ()=>$engine->publishRelease('material110-stale-price',$review['draftFingerprint']),'eligible material price edits invalidate the reviewed release');
$item=$engine->adminGameplayCatalog();$engine->saveGameplayCatalog('items','copper-scrap',['price'=>80],$item['revision'],'material110-price');$engine->publishRelease('material110-price');
for($i=0;$i<4;$i++) issueForTest($db,$events,'search','higher-price-'.$i,$b);
proof110(spent110('search',$b)===324 && issueForTest($db,$events,'search','higher-price-cap',$b)['status']==='budget-capped','new prices apply only to new receipts while earlier frozen value stays unchanged');
$context=$service->publishedContext();$oldInventory=inv110($c);
policy110(['findValueBudgetPerHour'=>0,'searchValueBudgetPerHour'=>0]);
$oldContext=issueForTest($db,$events,'search','inflight-old-context',$c,$context);
proof110($oldContext['status']==='awarded' && $oldContext['releaseId']===$context['releaseId'] && $oldContext['unitValue']===72,'in-flight settlement uses one old immutable release snapshot after a new zero policy publishes');
proof110(issueForTest($db,$events,'search','current-zero',$c)['status']==='budget-capped' && issueForTest($db,$events,'world','current-world-zero',$c)['status']==='budget-capped','new zero policy independently stops future source issuance');
$beforeClaims=spent110('world','*');$claim=$world->claim($a,$oldFind,'legacy-material110-claim');$claimAgain=$world->claim($a,$oldFind,'legacy-material110-claim');
proof110($claim['itemId']==='sand' && $claimAgain['replayed'] && (inv110($a)['sand']??0)===($baselineOwned['sand']??0)+1 && spent110('world','*')===$beforeClaims,'old unclaimed sand remains claimable exactly once without retroactive reservation or refund');
$GLOBALS['material110Rng']=[];$zeroReceipt=$engine->attemptCrime('searchforcash',$a);
proof110($zeroReceipt['loot']===null && $zeroReceipt['lootStatus']==='budget-capped' && $zeroReceipt['lootRollWon'] && count(array_filter($GLOBALS['material110Rng'],fn($r)=>$r===[1,100]))===1,'ordinary crime receipt distinguishes capped winning loot without rerolls or base reward suppression');
proof110($zeroReceipt['success'] && $zeroReceipt['reward']['cash']>=80 && $zeroReceipt['cost']['nerve']===2,'a capped material roll preserves ordinary crime success, cash, XP and Nerve rules');
$item=$engine->adminGameplayCatalog();$engine->saveGameplayCatalog('items','copper-scrap',['price'=>0],$item['revision'],'material110-free');$engine->publishRelease('material110-free');
proof110(issueForTest($db,$events,'search','zero-even-free',$c)['status']==='budget-capped','explicit zero stops issuance even when material resale is zero');
policy110(['findValueBudgetPerHour'=>null,'searchValueBudgetPerHour'=>null,'materialItemIds'=>null]);
proof110(issueForTest($db,$events,'search','configured-null-copper',$c)['itemId']==='copper-scrap' && issueForTest($db,$events,'search','configured-null-sand',$c,null,1)['itemId']==='sand','explicit null budgets and eligible IDs restore unlimited issuance from all published materials without new RNG');
$item=$engine->adminGameplayCatalog();$engine->saveGameplayCatalog('items','copper-scrap',['price'=>40],$item['revision'],'material110-restore');policy110($configuredPolicy);
$GLOBALS['material110Clock']=$hour+10800;$snapshot=$service->publishedContext();$before=inv110($c);$rows=(int)$db->fetchOne('SELECT COUNT(*) AS n FROM material_issuance')['n'];
reject110(fn ()=>$service->issue('search','rollback-grant110',$c,1,0,function($receipt)use($db,$events,$c,$snapshot){(new ProgressionService($db,$events,$snapshot['catalog']))->grantItem($c,$receipt['itemId'],1,str_repeat('1',32),'crime.loot');throw new RuntimeException('isolated effect failure');},$snapshot),'grant failure propagates through the actual reservation transaction');
proof110(inv110($c)===$before && (int)$db->fetchOne('SELECT COUNT(*) AS n FROM material_issuance')['n']===$rows && spent110('search',$c)===0,'grant failure rolls back owned inventory, ledger and material reservation together');
proof110(issueForTest($db,$events,'search','rollback-grant110',$c)['status']==='awarded','an actually rolled-back settlement can retry once without a stranded reservation');
$failEvents=new EventBus($db);$failEvents->subscribe(new class implements EventSubscriber{public function eventName():string{return'WorldTicked';}public function handle(DomainEvent $event):void{throw new RuntimeException('isolated world subscriber failure');}});
$beforeTicks=(int)$db->fetchOne('SELECT COUNT(*) AS n FROM world_ticks')['n'];$beforeWorld=spent110('world','*');
reject110(fn ()=>(new WorldDirector($db,$failEvents))->tick(),'real world event failure aborts a tick after reservation and find creation');
proof110(spent110('world','*')===$beforeWorld && (int)$db->fetchOne('SELECT COUNT(*) AS n FROM world_ticks')['n']===$beforeTicks,'world failure rolls tick identity, find and reservation back together');
policy110(['findValueBudgetPerHour'=>36,'searchValueBudgetPerHour'=>36]);$GLOBALS['material110Clock']=$hour+14400;$racePlayer=player110();
foreach(['world','search']as$source){$one=child110($source,'race-'.$source.'-one',$racePlayer);$two=child110($source,'race-'.$source.'-two',$racePlayer);fwrite($one[1][0],"GO\n");fflush($one[1][0]);fwrite($two[1][0],"GO\n");fflush($two[1][0]);$r1=finish110($one);$r2=finish110($two);$statuses=[$r1['result']['status']??'', $r2['result']['status']??''];sort($statuses);
    proof110($r1['ok']&&$r2['ok']&&$statuses===['awarded','budget-capped']&&spent110($source,$source==='world'?'*':$racePlayer)===36,'real '.$db->driver().' '.$source.' race cannot exceed one-unit source/scope budget');}
if($db->driver()==='pgsql'){
    $GLOBALS['material110Clock']=$hour+18000;$p1=player110();$p2=player110();$held=child110('hold-search','unrelated-held',$p1);fwrite($held[1][0],"GO\n");fflush($held[1][0]);proof110(trim((string)fgets($held[1][1]))==='HOLDING','first PostgreSQL player holds its own live reservation transaction');
    $free=child110('search','unrelated-free',$p2);fwrite($free[1][0],"GO\n");fflush($free[1][0]);$freeResult=finish110($free);
    proof110($freeResult['ok']&&$freeResult['result']['status']==='awarded','unrelated PostgreSQL player completes while another player reservation transaction is still held');fwrite($held[1][0],"RELEASE\n");fflush($held[1][0]);$heldResult=finish110($held);proof110($heldResult['ok'],'held player commits after unrelated player without a global crime/publication lock');
}
$GLOBALS['material110Clock']=$hour+21600;
foreach(['world','search']as$source){
    $before=inv110($racePlayer);$key='same-correlation-'.$source;$one=child110($source,$key,$racePlayer);$two=child110($source,$key,$racePlayer);
    fwrite($one[1][0],"GO\n");fflush($one[1][0]);fwrite($two[1][0],"GO\n");fflush($two[1][0]);$r1=finish110($one);$r2=finish110($two);
    proof110($r1['ok']&&$r2['ok']&&$r1['result']['status']==='awarded'&&$r2['result']['status']==='awarded'&&$r1['result']['replayed']!==$r2['result']['replayed']&&spent110($source,$source==='world'?'*':$racePlayer)===36,'concurrent '.$source.' replay commits one reservation and returns one frozen replay');
    if($source==='search')proof110((inv110($racePlayer)['copper-scrap']??0)===($before['copper-scrap']??0)+1,'concurrent same-correlation search grants exactly one owned unit');
    else proof110((int)$db->fetchOne('SELECT COUNT(*) AS n FROM world_finds WHERE id=:id',['id'=>hash('sha256',$key)])['n']===1,'concurrent same-correlation world request creates exactly one find');
}
policy110(['findValueBudgetPerHour'=>108,'searchValueBudgetPerHour'=>36,'findQuantity'=>3]);$GLOBALS['material110Clock']=$hour+25200;
$multi=$world->tick();$GLOBALS['material110Clock']+=60;$multiCap=$world->tick();
proof110($multi['createdFinds']===1&&$multiCap['createdFinds']===0&&spent110('world','*')===108,'actual three-unit world find reserves full quantity value and the next find cannot overspend');
$row=$db->fetchOne("SELECT quantity,unit_value,issued_value FROM material_issuance WHERE source='world' AND hour_start=:hour AND status='awarded'",['hour'=>$hour+25200]);
proof110((int)$row['quantity']===3&&(int)$row['unit_value']===36&&(int)$row['issued_value']===108,'world receipt freezes resale value times its actual three-unit quantity');
$manifest=$engine->activeRelease()['manifest'];$manifest['worldPolicy']['materialItemIds']=null;
$noMaterials=array_keys(array_filter($manifest['content']['gameplayCatalog']['items'],fn($item)=>($item['type']??'')==='material'));
foreach($noMaterials as$id)unset($manifest['content']['gameplayCatalog']['items'][$id]);
$manifest['content']['gameplayCatalog']['market']=array_values(array_filter($manifest['content']['gameplayCatalog']['market'],fn($listing)=>!in_array($listing['item'],$noMaterials,true)));
$releases->saveDraft($manifest,'material110-empty-pool');$releases->publish('material110-empty-pool');$GLOBALS['material110Clock']=$hour+28800;$before=inv110($a);
$empty=$engine->attemptCrime('searchforcash',$a);
proof110($empty['success']&&$empty['lootRollWon']&&$empty['lootStatus']==='no-eligible-material'&&$empty['loot']===null&&inv110($a)===$before&&spent110('search',$a)===0,'actual published empty-material catalog reports a won but unavailable roll without grant or debt');
$engine->publishRelease('material110-restore-pool');
$replayEmpty=$service->issue('search',$empty['serverProof']['correlationId'],$a,1,0,static function():void{throw new RuntimeException('A terminal empty-pool receipt must never grant later.');});
proof110($replayEmpty['replayed']&&$replayEmpty['status']==='no-eligible-material'&&spent110('search',$a)===0,'an empty-pool outcome remains terminal after eligible materials are republished');

echo 'MATERIAL110 EVIDENCE: '.json_encode(['adapter'=>$db->driver(),'database'=>$db->driver()==='pgsql'?ltrim((string)parse_url($url,PHP_URL_PATH),'/'):substr($url,7),'productionDataTouched'=>false,'existingInventoryRepriced'=>false,'clock'=>'test namespace only; UTC server hours in production','rng'=>'test namespace branch control; legacy call sequence checked','searchScope'=>'player','worldScope'=>'global','schema'=>'one append-only outcome/issuance table and one index'],JSON_THROW_ON_ERROR)."\n";
echo "MATERIAL110 RESULT: {$count} passed, 0 failed\n";
}
