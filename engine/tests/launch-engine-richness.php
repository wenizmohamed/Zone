<?php
declare(strict_types=1);
require dirname(__DIR__) . '/bootstrap.php';

use Zone\Engine\Core\Events\EventBus;
use Zone\Engine\Core\Game\CombatService;
use Zone\Engine\Core\Game\LoadoutService;
use Zone\Engine\Core\Game\PlayerCombatService;
use Zone\Engine\Core\Game\ProgressionService;
use Zone\Engine\Core\Persistence\Database;
use Zone\Engine\Core\Publishing\ReleaseManager;

$configuredUrl = getenv('ZONE_RICHNESS_TEST_URL');
if ($configuredUrl !== false && $configuredUrl !== '') {
    $target = parse_url($configuredUrl);
    if ($target === false || !in_array($target['scheme'] ?? '', ['postgres', 'postgresql'], true)
        || !in_array($target['host'] ?? '', ['127.0.0.1', 'localhost'], true)
        || ($target['port'] ?? 0) !== 55433
        || !preg_match('~^/zone_beta_smoke_richness_[a-z0-9_]+$~D', $target['path'] ?? '')
        || strlen(ltrim($target['path'], '/')) > 63) throw new RuntimeException('Disposable loopback richness database required.');
    $url = $configuredUrl;
} else $url = 'sqlite:' . ZONE_ENGINE_ROOT . '/var/launch-engine-richness-' . bin2hex(random_bytes(6)) . '.sqlite';
$engine = zone_engine($url); $db = Database::connect($url); $events = new EventBus($db); $passed = 0;
function richProof(bool $ok, string $label): void { global $passed; if (!$ok) throw new RuntimeException('FAIL: ' . $label); $passed++; echo 'PASS: ' . $label . PHP_EOL; }
function richAct(string $player, string $action, string $id): array { global $engine; $s=$engine->gameplay($player); return $engine->gameplayAction($action,$id,$s['state']['version'],$player); }
function richPlayer(): string { global $engine; return $engine->browserSessions()->create('richness-' . bin2hex(random_bytes(6)))['playerId']; }
// JSONB canonicalizes object-key order. Preserve exact values/types and list
// order while comparing JSON objects independently of storage key ordering.
function richSorted(array $value): array {foreach($value as &$child) if(is_array($child)) $child=richSorted($child); unset($child); if(!array_is_list($value)) ksort($value); return $value;}
function richReject(callable $fn, string $fragment = ''): bool { try {$fn();} catch (RuntimeException|InvalidArgumentException $error) {return $fragment === '' || str_contains($error->getMessage(),$fragment);} return false; }
function richRound(string $player): array { global $db,$events; $s=new CombatService($db,$events,static fn(int $min,int $max):int=>$min); $v=$s->snapshot($player); $v=$s->act('start','dockside-rookie','',$v['version'],$player); return $s->act('strike','','',$v['version'],$player); }

// First regression is independent of Studio's new authoring support.
richAct('founder-player','item.buy','armor');
$npc=new CombatService($db,$events,static fn(int $min,int $max):int=>$min);
$start=$npc->act('start','rayan','',$npc->snapshot('founder-player')['version'],'founder-player');
$stored=json_decode($db->fetchOne('SELECT state_json FROM combat_encounters WHERE player_id=:id',['id'=>'founder-player'])['state_json'],true,512,JSON_THROW_ON_ERROR);
richProof($stored['encounter']['armorReduction']===0 || $stored['encounter']['armorReduction']===0.0,'owned but unequipped armor grants no NPC protection');
$npc->act('finish','','leave',$start['version'],'founder-player');

$engine->createGameplayCatalog('items','launch-plate',['type'=>'armor','price'=>100,'red'=>0.5,'name'=>['en'=>'Launch plate','ar'=>'درع الاختبار']],$engine->adminGameplayCatalog()['revision'],'isolated-richness');
$engine->createGameplayCatalog('items','launch-boost',['type'=>'booster','price'=>100,'happy'=>100000,'energy'=>10,'name'=>['en'=>'Launch booster','ar'=>'منشط الاختبار']],$engine->adminGameplayCatalog()['revision'],'isolated-richness');
$engine->createGameplayCatalog('properties','launch-home',['price'=>100,'happy'=>8000,'name'=>['en'=>'Launch home','ar'=>'منزل الاختبار']],$engine->adminGameplayCatalog()['revision'],'isolated-richness');
$loadoutRelease=$engine->publishRelease('isolated-richness');
$plain=richPlayer(); $armored=richPlayer(); $other=richPlayer();
foreach([$plain,$armored] as $id) richAct($id,'item.buy','launch-plate');
$before=$engine->gameplay($armored); $otherBefore=$engine->gameplay($other);
richProof(richReject(fn()=>richAct($other,'item.equip','launch-plate'),'do not own'),'unowned published armor cannot be equipped');
$equipped=richAct($armored,'item.equip','launch-plate');
richProof($equipped['state']['armorEquip']==='launch-plate' && $equipped['state']['equip']==='fists','armor uses its own persistent slot without replacing the weapon');
richProof($equipped['loadout']['armorId']==='launch-plate' && $equipped['loadout']['armorReduction']===0.5,'published custom armor produces a truthful authoritative loadout');
richProof(richReject(fn()=>$engine->gameplayAction('item.unequip','launch-plate',$before['state']['version'],$armored)),'stale loadout mutation cannot erase newer equipment');
richProof(richSorted($engine->gameplay($other)['state'])===richSorted($otherBefore['state']),'loadout actions do not change another player');
$reopened=zone_engine($url)->gameplay($armored);
richProof($reopened['state']['armorEquip']==='launch-plate' && $reopened['player']['cash']===$equipped['player']['cash'],'equipment and exact purchase cash survive engine reconstruction');
$nakedRound=richRound($plain); $armorRound=richRound($armored);
richProof($armorRound['encounter']['log'][1]['d'] < $nakedRound['encounter']['log'][1]['d'],'NPC incoming damage decreases only when the owned custom armor is equipped');

$attackA=richPlayer(); $targetA=richPlayer(); $attackB=richPlayer(); $targetB=richPlayer();
foreach([$targetA,$targetB] as $id) richAct($id,'item.buy','launch-plate'); richAct($targetB,'item.equip','launch-plate');
$pvp=new PlayerCombatService($db,$events,static fn(int $min,int $max):int=>$min);
$damages=[];
foreach([[$attackA,$targetA],[$attackB,$targetB]] as [$attacker,$target]) { $fight=$pvp->act('start',$target,'',$pvp->snapshot($attacker)['version'],$attacker); $fight=$pvp->act('strike','','',$fight['version'],$attacker); $damages[]=$fight['encounter']['log'][0]['d']; $pvp->act('finish','','leave',$fight['version'],$attacker); }
richProof($damages[1] < $damages[0],'real paired-player combat uses the same equipped-armor reduction as NPC combat');
$removed=richAct($targetB,'item.unequip','launch-plate'); richProof($removed['loadout']['armorId']===null && $removed['loadout']['armorReduction']===0.0,'explicit unequip removes protection without deleting the item');
richProof(richReject(fn()=>richAct($targetB,'item.unequip','launch-plate')),'repeated unequip fails without another progression mutation');
richAct($targetB,'item.equip','launch-plate'); $sold=richAct($targetB,'item.sell','launch-plate');
richProof($sold['state']['inv']['launch-plate']===0 && $sold['state']['armorEquip']===null,'selling the last equipped armor clears its slot');
$ledger=$db->fetchAll('SELECT amount,balance_after,reason FROM economy_ledger WHERE player_id=:id AND asset=:asset ORDER BY created_at,id',['id'=>$targetB,'asset'=>'item:launch-plate']);
richProof(count($ledger)===2 && array_sum(array_column($ledger,'amount'))===0,'armor purchase and sale reconcile exactly in the item ledger');
richAct($targetA,'item.equip','launch-plate');
$escrow=$engine->playerMarketAction('list','launch-plate',1,100,$engine->gameplay($targetA)['state']['version'],$targetA);
richProof($engine->gameplay($targetA)['state']['armorEquip']===null && $engine->gameplay($targetA)['state']['inv']['launch-plate']===0,'real market escrow of the last armor removes its protection slot');
$engine->playerMarketAction('cancel',$escrow['result']['listingId'],1,0,$escrow['ownListings'][0]['version'],$targetA);
richProof($engine->gameplay($targetA)['state']['armorEquip']===null && $engine->gameplay($targetA)['state']['inv']['launch-plate']===1,'returning escrow restores the real unit but never auto-equips it');
$edge=LoadoutService::resolve(['equip'=>'wrong-type','armorEquip'=>'custom','inv'=>['wrong-type'=>1,'custom'=>1]],['wrong-type'=>['type'=>'armor','mult'=>20],'custom'=>['type'=>'armor','red'=>2]]);
richProof($edge['weaponId']===null && $edge['weaponMultiplier']===1.0 && $edge['armorReduction']===0.95,'loadout ignores a wrong-type weapon slot and defensively bounds armor reduction');
richProof(LoadoutService::resolve(['armorEquip'=>'custom','inv'=>['custom'=>0]],['custom'=>['type'=>'armor','red'=>0.5]])['armorId']===null,'stale zero-owned slot metadata cannot grant protection');

// Controlled interleaving hook: switch an actually published immutable release
// after capture. This is not a PostgreSQL concurrent-publication capacity claim.
$raceA=richPlayer(); $raceB=richPlayer();
foreach([$raceA,$raceB] as $id){richAct($id,'item.buy','launch-plate');richAct($id,'item.equip','launch-plate');}
$engine->saveGameplayCatalog('items','launch-plate',['red'=>0.9],$engine->adminGameplayCatalog()['revision'],'isolated-richness');
$newLoadoutRelease=$engine->publishRelease('isolated-richness'); $engine->activateRelease($loadoutRelease['id'],'isolated-richness');
$hookRuns=0;
$racing=new PlayerCombatService($db,$events,static fn(int $min,int $max):int=>$min,null,static function(array $rules)use($db,$events,$newLoadoutRelease,&$hookRuns):void {if($hookRuns++===0)(new ReleaseManager($db,$events))->activate($newLoadoutRelease['id'],'isolated-richness');});
$race=$racing->act('start',$raceB,'',$racing->snapshot($raceA)['version'],$raceA); $race=$racing->act('strike','','',$race['version'],$raceA);
richProof($race['encounter']['log'][0]['d']===24 && $race['encounter']['log'][1]['d']===24,'mid-command release switch cannot mix either side armor rules in one paired strike');
$race=$racing->act('strike','','',$race['version'],$raceA);
richProof($race['encounter']['log'][2]['d']===5 && $race['encounter']['log'][3]['d']===5,'the next command deliberately captures the newer published armor rules for both sides');
$racing->act('finish','','leave',$race['version'],$raceA);
// Explicit historical timer fixture only: verify the legacy quick-win path
// cannot continue a chain whose last trusted win is over five minutes old.
$chainPlayer=richPlayer(); $chainProgress=new ProgressionService($db,$events); $chainProgress->recordMetric($chainPlayer,'wins');
$chainRow=$db->fetchOne('SELECT state_json FROM player_progression WHERE player_id=:id',['id'=>$chainPlayer]); $chainState=json_decode($chainRow['state_json'],true,512,JSON_THROW_ON_ERROR); $chainState['fac']['chainAt']-=300001;
$db->execute('UPDATE player_progression SET state_json=:state WHERE player_id=:id',['id'=>$chainPlayer,'state'=>json_encode($chainState,JSON_THROW_ON_ERROR)]);
$chainProgress->recordMetric($chainPlayer,'wins');
richProof($engine->gameplay($chainPlayer)['state']['fac']['chain']===1,'legacy trusted quick-win metrics reset expired chains instead of extending them');

$low=richPlayer(); $high=richPlayer(); $home=richAct($high,'property.buy','launch-home');
richProof($home['player']['max_happy']===8000 && $home['player']['happy']===100 && $home['result']['cashDelta']===-100,'published property changes capacity and charges once without inventing current happiness');
richAct($high,'item.buy','launch-boost'); richAct($high,'item.buy','launch-boost');
$boost=richAct($high,'item.use','launch-boost');
richProof($boost['result']['restored']===['life'=>0,'nerve'=>0,'energy'=>0,'happy'=>7900] && $boost['state']['inv']['launch-boost']===1,'published booster restores only exact missing happiness and consumes one item');
$full=$engine->gameplay($high); richProof(richReject(fn()=>richAct($high,'item.use','launch-boost')),'full capped resources preserve the remaining booster');
richProof($engine->gameplay($high)['state']['version']===$full['state']['version'] && $engine->gameplay($high)['state']['inv']['launch-boost']===1,'rejected full-bar use changes neither version nor inventory');
$lowTrain=$engine->trainGym('strength',1,$low); $highTrain=$engine->trainGym('strength',1,$high);
richProof($highTrain['happiness']['value']===8000 && $highTrain['happiness']['multiplier'] > $lowTrain['happiness']['multiplier'],'Gym reports server-read happiness and its existing exact multiplier');
richProof($highTrain['gain'] > $lowTrain['gain'] && $highTrain['cost']['energy']===$lowTrain['cost']['energy'],'real authored happiness restoration improves actual Gym gain without changing energy cost');
richProof(zone_engine($url)->gameplay($high)['player']['strength']===$highTrain['player']['strength'],'happy-powered training persists through engine reconstruction');
richProof($highTrain['cost']['energy']===5 && $highTrain['player']['energy']===95,'training keeps published five-energy cost and authoritative balance');
$energyBoost=richAct($high,'item.use','launch-boost');
richProof($energyBoost['result']['restored']===['life'=>0,'nerve'=>0,'energy'=>5,'happy'=>0] && $energyBoost['player']['energy']===100,'same published booster restores only missing energy without exceeding its cap');
$uses=$db->fetchAll("SELECT amount,balance_after FROM economy_ledger WHERE player_id=:id AND asset='item:launch-boost' AND reason='item.use'",['id'=>$high]);
richProof(count($uses)===2 && array_sum(array_column($uses,'amount'))===-2,'only the two successful consumptions produce inventory ledger debits');
$directPassed = $passed;
echo 'DIRECT RICHNESS RESULT: ' . $directPassed . ' passed, 0 failed (' . $db->driver() . ')' . PHP_EOL;
// Independent real HTTP owner publication and two ordinary accounts. No grants,
// edited balances, forced outcomes, fake cooldowns or production configuration.
function richHttp(string $base,string $method,string $path,?array $body=null,string $cookie=''): array {
    $headers=['Accept: application/json','Content-Type: application/json','Connection: close','Host: zone.test','Origin: https://zone.test','X-Forwarded-Proto: https']; if($cookie!=='') $headers[]='Cookie: '.$cookie;
    $context=stream_context_create(['http'=>['method'=>$method,'header'=>implode("\r\n",$headers),'content'=>$body===null?'':json_encode($body,JSON_THROW_ON_ERROR),'ignore_errors'=>true,'timeout'=>8]]);
    $raw=@file_get_contents($base.$path,false,$context); $responseHeaders=http_get_last_response_headers()?:[]; preg_match('/\s(\d{3})\s/',$responseHeaders[0]??'',$status);
    return [(int)($status[1]??0),$raw===false?[]:json_decode($raw,true,512,JSON_THROW_ON_ERROR),$responseHeaders];
}
function richCookie(array $headers): string { foreach($headers as $header) if(stripos($header,'Set-Cookie: ')===0) return explode(';',substr($header,12),2)[0]; throw new RuntimeException('Missing isolated cookie.'); }
function richServer(string $databaseUrl,string $secret,string $log): array {
    $socket=stream_socket_server('tcp://127.0.0.1:0',$errno,$error); if($socket===false) throw new RuntimeException($error); $address=stream_socket_get_name($socket,false); fclose($socket);
    $env=[...getenv(),'ZONE_DATABASE_URL'=>$databaseUrl,'DATABASE_URL'=>'','POSTGRES_URL'=>'','VERCEL'=>'1','ZONE_PLAYER_SESSIONS'=>'1','ZONE_PLAYER_AUTH'=>'','ZONE_ADMIN_TOKEN'=>$secret,'ZONE_BETA_OWNER_ACCESS'=>'0','ZONE_ENGINE_RELAY_KEY'=>''];
    $process=proc_open([PHP_BINARY,'-S',$address,'-t',ZONE_REPOSITORY_ROOT,ZONE_ENGINE_ROOT.'/router.php'],[0=>['pipe','r'],1=>['file',$log,'a'],2=>['file',$log,'a']],$pipes,ZONE_REPOSITORY_ROOT,$env,['bypass_shell'=>true]);
    if(!is_resource($process)) throw new RuntimeException('Isolated richness server did not start.'); fclose($pipes[0]); $base='http://'.$address; $deadline=microtime(true)+8;
    do {[$status]=richHttp($base,'GET','/api/v1/health'); if($status===200) return [$base,$process]; usleep(100000);}while(microtime(true)<$deadline);
    proc_terminate($process); proc_close($process); throw new RuntimeException('Isolated richness server readiness failed.');
}
function richHttpState(string $base,string $cookie): array {[$status,$s]=richHttp($base,'GET','/api/v1/gameplay',null,$cookie); if($status!==200) throw new RuntimeException('Richness HTTP gameplay read failed.'); return $s;}
function richHttpAct(string $base,string $cookie,string $action,string $id): array { $s=richHttpState($base,$cookie); [$status,$result]=richHttp($base,'POST','/api/v1/gameplay/action',['action'=>$action,'id'=>$id,'expectedVersion'=>$s['state']['version']],$cookie); if($status!==200) throw new RuntimeException('Richness HTTP action failed: '.$action.' '.($result['error']??$status)); return $result; }
$httpPrefix=ZONE_ENGINE_ROOT.'/var/launch-richness-http-'.bin2hex(random_bytes(6)); $httpUrl='sqlite:'.$httpPrefix.'.sqlite'; $secret=bin2hex(random_bytes(32)); $process=null;
try {
    [$base,$process]=richServer($httpUrl,$secret,$httpPrefix.'.log');
    [$status,$auth,$headers]=richHttp($base,'POST','/api/v1/admin/session',['token'=>$secret]); richProof($status===200 && $auth['authenticated'],'isolated owner authenticates through the real HTTP gate'); $ownerCookie=richCookie($headers);
    $definitions=[['items','http-plate',['type'=>'armor','price'=>100,'red'=>0.4,'name'=>['en'=>'HTTP plate','ar'=>'درع الويب']]],['items','http-booster',['type'=>'booster','price'=>100,'happy'=>100000,'energy'=>10,'name'=>['en'=>'HTTP booster','ar'=>'منشط الويب']]],['properties','http-home',['price'=>100,'happy'=>8000,'name'=>['en'=>'HTTP home','ar'=>'منزل الويب']]]];
    foreach($definitions as [$category,$id,$definition]) {[$status,$catalog]=richHttp($base,'GET','/api/v1/admin/gameplay-catalog',null,$ownerCookie); [$status]=richHttp($base,'POST','/api/v1/admin/gameplay-catalog/'.$category,['id'=>$id,'definition'=>$definition,'expectedRevision'=>$catalog['revision']],$ownerCookie); richProof($status===201,'owner creates authored '.$id.' through authenticated HTTP');}
    [$status,$public]=richHttp($base,'GET','/api/v1/game/bootstrap'); richProof(!isset($public['content']['gameplayCatalog']['items']['http-plate']),'saved armor draft stays absent from public gameplay until publication');
    [$status,$draft]=richHttp($base,'GET','/api/v1/admin/draft',null,$ownerCookie); [$status,$release]=richHttp($base,'POST','/api/v1/admin/releases/publish',['expectedFingerprint'=>$draft['draftFingerprint']],$ownerCookie); richProof($status===201,'owner publishes the authored armor, booster and property through real HTTP');
    [$status,$a,$headers]=richHttp($base,'POST','/api/v1/auth/session',[]); $cookieA=richCookie($headers); richProof($status===201,'first ordinary HTTP account is created without owner grants');
    [$status,$b,$headers]=richHttp($base,'POST','/api/v1/auth/session',[]); $cookieB=richCookie($headers); $untouched=richHttpState($base,$cookieB); richProof($status===201 && $a['playerId']!==$b['playerId'],'second ordinary account has an independent persistent identity');
    [$status]=richHttp($base,'POST','/api/v1/admin/gameplay-catalog/items',['id'=>'forged-owner','definition'=>$definitions[0][2],'expectedRevision'=>1],$cookieA); richProof($status===401,'ordinary cookie cannot author content or grant itself gear');
    $owned=richHttpAct($base,$cookieA,'item.buy','http-plate'); $equipped=richHttpAct($base,$cookieA,'item.equip','http-plate'); richProof($owned['player']['cash']===2400 && $equipped['loadout']['armorId']==='http-plate' && $equipped['loadout']['armorReduction']===0.4,'ordinary HTTP purchase and equip use the published price and custom armor effect');
    richHttpAct($base,$cookieA,'property.buy','http-home'); richHttpAct($base,$cookieA,'item.buy','http-booster'); $restored=richHttpAct($base,$cookieA,'item.use','http-booster'); richProof($restored['result']['restored']['happy']===7900 && $restored['player']['happy']===8000,'ordinary HTTP booster fills only the published property happiness capacity');
    [$status,$trained]=richHttp($base,'POST','/api/v1/gym/train',['stat'=>'strength','sessions'=>1,'happy'=>999999,'gain'=>999999],$cookieA); richProof($status===200 && $trained['happiness']['value']===8000 && $trained['cost']['energy']===5 && $trained['player']['energy']===95,'actual HTTP Gym ignores client gain/happy claims and spends normal energy');
    $saved=richHttpState($base,$cookieA); proc_terminate($process); proc_close($process); $process=null; [$base,$process]=richServer($httpUrl,$secret,$httpPrefix.'.log'); $returned=richHttpState($base,$cookieA);
    richProof($returned['player']['id']===$a['playerId'] && $returned['state']['armorEquip']==='http-plate' && $returned['player']['cash']===$saved['player']['cash'] && $returned['player']['strength']===$trained['player']['strength'],'same ordinary cookie preserves purchased loadout, cash and training after actual server restart');
    $afterB=richHttpState($base,$cookieB); richProof($afterB['player']['cash']===$untouched['player']['cash'] && $afterB['state']===$untouched['state'],'second ordinary account remains unchanged through owner publishing and first-account actions');
    $version=$returned['state']['version']; richHttpAct($base,$cookieA,'item.unequip','http-plate'); [$status,$stale]=richHttp($base,'POST','/api/v1/gameplay/action',['action'=>'item.equip','id'=>'http-plate','expectedVersion'=>$version],$cookieA); richProof($status===409 && $stale['error']==='Progression state changed. Refresh and try again.','stale HTTP loadout version cannot reapply newer removed armor');
    echo 'HTTP RICHNESS EVIDENCE: '.json_encode(['adapter'=>'sqlite','ordinaryAccounts'=>2,'serverRestarts'=>1,'staffGrants'=>false,'release'=>$release['id'],'database'=>$httpPrefix.'.sqlite','log'=>$httpPrefix.'.log'],JSON_THROW_ON_ERROR).PHP_EOL;
} finally {if(is_resource($process)){proc_terminate($process); proc_close($process);}}
echo 'LAUNCH ENGINE RICHNESS RESULT: ' . $passed . ' passed, 0 failed (direct=' . $db->driver() . '; HTTP=sqlite; HTTP checks=' . ($passed - $directPassed) . ')' . PHP_EOL;
