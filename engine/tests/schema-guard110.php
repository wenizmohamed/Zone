<?php
declare(strict_types=1);

// Isolated successor to the independent failing race proof. Its evidence and
// source remain untouched. No engine bootstrap or production migration is run.
$repo = dirname(__DIR__,2);
const SG_FIXTURE_RELEASE = 'b687ea177453086a8b7a70cd91a8c1e0';
function sgRoot(string $repo): string {
    $root = $repo . '/engine/var/schema-guard110-' . bin2hex(random_bytes(7));
    if (file_exists($root) || !mkdir($root . '/engine/database',0775,true) || !mkdir($root . '/engine/data') || !mkdir($root . '/engine/src/Core/Persistence',0775,true)) throw new RuntimeException('Fresh guard fixture required.'); return $root;
}
function sgCheckRoot(string $root, string $repo): void { $real = realpath($root); if ($real === false || !str_starts_with(str_replace('\\','/',$real),str_replace('\\','/',$repo) . '/engine/var/schema-guard110-')) throw new RuntimeException('Only an isolated guard fixture is permitted.'); }
function sgHelper(string $repo): void {
    require_once $repo . '/engine/tests/support/schema-promotion110.php';
}
function sgConnection(string $driver, string $root, string $repo): array {
    if ($driver === 'sqlite') return ['dsn' => 'sqlite:' . $root . '/fresh.sqlite','user' => null,'password' => null,'database' => $root . '/fresh.sqlite'];
    if ($driver !== 'pgsql') throw new RuntimeException('Unexpected adapter.');
    $config = json_decode((string)file_get_contents(dirname($repo,2) . '/.tools/local-beta-config.json'),true,64,JSON_THROW_ON_ERROR);$target=parse_url($config['databaseUrl']);
    if (!in_array($target['host'] ?? '',['127.0.0.1','localhost'],true) || ($target['port'] ?? 0) !== 55433) throw new RuntimeException('Only the existing loopback proof server is permitted.');
    $user=urldecode($target['user']);$password=urldecode($target['pass']);if(!preg_match('/^[a-z_][a-z0-9_]*$/D',$user))throw new RuntimeException('Unexpected disposable owner.');
    $name='zone_beta_smoke_guard110_' . bin2hex(random_bytes(7));$admin=new PDO('pgsql:host=127.0.0.1;port=55433;dbname=postgres;sslmode=disable;connect_timeout=5','zonebeta',$password,[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
    $exists=$admin->prepare('SELECT COUNT(*) FROM pg_database WHERE datname=?');$exists->execute([$name]);if((int)$exists->fetchColumn()!==0)throw new RuntimeException('Existing database reuse refused.');$admin->exec('CREATE DATABASE "'.$name.'" OWNER "'.$user.'"');
    return ['dsn'=>'pgsql:host=127.0.0.1;port=55433;dbname='.$name.';sslmode=disable;connect_timeout=5','user'=>$user,'password'=>$password,'database'=>$name];
}
function sgPdo(array $connection): PDO { $pdo=new PDO($connection['dsn'],$connection['user'],$connection['password'],[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);if(str_starts_with($connection['dsn'],'sqlite:')){$pdo->exec('PRAGMA foreign_keys=ON');$pdo->exec('PRAGMA busy_timeout=5000');}return $pdo; }
function sgSetup(string $repo,string $root,string $driver,array $connection): array {
    $new=$repo.'/engine/database/schema.'.($driver==='pgsql'?'postgresql':'sqlite').'.sql';$old=b110Schema($new,$driver);$schema=$root.'/engine/database/'.basename($new);$crimes=$root.'/engine/data/crimes.json';
    file_put_contents($schema,$old);file_put_contents($crimes,file_get_contents($repo.'/engine/data/crimes.json'));
    $fingerprint=hash('sha256',$old.file_get_contents($crimes));$pdo=sgPdo($connection);$pdo->exec($old);$pdo->exec('CREATE TABLE engine_metadata(name VARCHAR(80) PRIMARY KEY,value TEXT NOT NULL)');$pdo->prepare('INSERT INTO engine_metadata VALUES(?,?)')->execute(['schema-fingerprint',$fingerprint]);
    $pdo->exec("INSERT INTO players(id,username,cash,bank_balance,resources_updated_at)VALUES('retained-guard110','Retained guard proof',321,456,CURRENT_TIMESTAMP)");
    $pdo->prepare('INSERT INTO player_credentials(player_id,login_name,password_hash,recovery_hash,created_at,updated_at)VALUES(?,?,?,?,?,?)')->execute(['retained-guard110','retainedguard110','isolated-not-production',str_repeat('b',64),1,1]);
    $pdo->prepare('INSERT INTO content_releases(id,version,manifest_json,active,published_by,published_at)VALUES(?,4,?,1,?,CURRENT_TIMESTAMP)')->execute([SG_FIXTURE_RELEASE,'{"proof":"isolated-schema-guard"}','guard110']);
    return ['schema'=>$schema,'crimes'=>$crimes,'newSchema'=>$new,'oldSql'=>$old,'oldFingerprint'=>$fingerprint];
}
final class SchemaGuardProofPDO extends PDO {
    public ?Closure $pause = null; public ?Closure $beforeLock = null; public bool $paused = false; public bool $lockBoundaryPaused = false; public array $executed = []; public bool $seedAttempted = false; public bool $lockSeen = false;
    public function prepare(string $query,array $options=[]):PDOStatement|false {
        if(preg_match('/^INSERT(?: OR IGNORE)? INTO players\b/',$query))$this->seedAttempted=true;
        if(!$this->paused && str_contains($query,"SELECT value FROM engine_metadata WHERE name = 'schema-fingerprint'")){$this->paused=true;if($this->pause!==null)($this->pause)();}
        if(str_starts_with($query,'UPDATE engine_metadata SET value = value'))$this->lockSeen=true;
        return parent::prepare($query,$options);
    }
    public function exec(string $statement):int|false {
        if(!$this->lockBoundaryPaused&&$this->beforeLock!==null&&(str_contains($statement,'pg_advisory_xact_lock(90120261005)')||str_starts_with($statement,'CREATE TABLE IF NOT EXISTS engine_metadata'))){$this->lockBoundaryPaused=true;($this->beforeLock)();}
        $this->executed[]=$statement;if(str_contains($statement,'pg_advisory_xact_lock(90120261005)'))$this->lockSeen=true;return parent::exec($statement);
    }
}
function sgDatabase(PDO $pdo,string $driver): object { $reflection=new ReflectionClass(Zone\Engine\Core\Persistence\Database::class);$database=$reflection->newInstanceWithoutConstructor();$reflection->getConstructor()->invoke($database,$pdo,$driver);return $database; }
function sgWait(string $file): void { $until=microtime(true)+15;while(!is_file($file)&&microtime(true)<$until)usleep(20000);if(!is_file($file))throw new RuntimeException('Isolated scheduling marker timed out.'); }
function sgStart(array $arguments,array $environment=[]):array {
    $process=proc_open([PHP_BINARY,...$arguments],[0=>['pipe','r'],1=>['pipe','w'],2=>['pipe','w']],$pipes,null,[...getenv(),...$environment],['bypass_shell'=>true]);if(!is_resource($process))throw new RuntimeException('Owned proof child failed to start.');fclose($pipes[0]);return[$process,$pipes];
}
function sgFinish(array $child): array { [$process,$pipes]=$child;$out=stream_get_contents($pipes[1]);$error=stream_get_contents($pipes[2]);fclose($pipes[1]);fclose($pipes[2]);$exit=proc_close($process);if($exit!==0)throw new RuntimeException('Isolated proof child failed: '.substr($error,0,500));return json_decode(trim($out),true,64,JSON_THROW_ON_ERROR); }

if(PHP_SAPI==='cli-server'){
    $root=(string)getenv('ZONE_SCHEMA_GUARD_ROOT');sgCheckRoot($root,$repo);define('ZONE_ENGINE_ROOT',$root.'/engine');require ZONE_ENGINE_ROOT.'/src/Core/Persistence/Database.php';
    $driver=(string)getenv('ZONE_SCHEMA_GUARD_DRIVER');$path=parse_url($_SERVER['REQUEST_URI'],PHP_URL_PATH);if(!in_array($path,['/old','/health','/guarded-paused'],true)){http_response_code(404);exit;}
    $connection=['dsn'=>getenv('ZONE_SCHEMA_GUARD_DSN'),'user'=>getenv('ZONE_SCHEMA_GUARD_USER')?:null,'password'=>getenv('ZONE_SCHEMA_GUARD_PASSWORD')?:null];
    $pdo=new SchemaGuardProofPDO($connection['dsn'],$connection['user'],$connection['password'],[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
    if($path!=='/health'){$label=$path==='/old'?'old':'guarded';$pdo->pause=static function()use($root,$label):void{file_put_contents($root.'/'.$label.'-entered',(string)microtime(true));sgWait($root.'/'.$label.'-release');};}
    else file_put_contents($root.'/health-entered',(string)microtime(true));
    $method=new ReflectionMethod(Zone\Engine\Core\Persistence\Database::class,'migrateAndSeed');$span=[$method->getStartLine(),$method->getEndLine()];$entered=microtime(true);sgDatabase($pdo,$driver)->migrateAndSeed();
    $opcodeStatus=function_exists('opcache_get_status')?opcache_get_status(false):false;
    $body=json_encode(['ok'=>true,'pid'=>getmypid(),'sapi'=>PHP_SAPI,'os'=>PHP_OS_FAMILY,'opcacheCli'=>ini_get('opcache.enable_cli'),'opcacheActive'=>is_array($opcodeStatus)&&!empty($opcodeStatus['opcache_enabled']),'databaseCached'=>function_exists('opcache_is_script_cached')&&opcache_is_script_cached(ZONE_ENGINE_ROOT.'/src/Core/Persistence/Database.php'),'methodSpan'=>$span,'entered'=>$entered,'completed'=>microtime(true),'seedAttempted'=>$pdo->seedAttempted,'lockSeen'=>$pdo->lockSeen,'sqlExecuted'=>count(array_filter($pdo->executed,static fn($sql)=>str_contains($sql,'CREATE TABLE IF NOT EXISTS material_issuance')))],JSON_THROW_ON_ERROR);
    header('Content-Type: application/json');header('Content-Length: '.strlen($body));header('Connection: close');echo$body;exit;
}
if(($argv[1]??'')==='--client'){
    $root=$argv[2];sgCheckRoot($root,$repo);$port=(int)$argv[3];$path=$argv[4];$label=$argv[5];if($port<1||$port>65535||!in_array($path,['/old','/health','/guarded-paused'],true)||!preg_match('/^[a-z0-9-]+$/D',$label))throw new RuntimeException('Invalid isolated client.');
    $socket=stream_socket_client('tcp://127.0.0.1:'.$port,$errno,$error,5);if(!$socket)throw new RuntimeException('Isolated client could not connect.');stream_set_timeout($socket,20);$request="GET {$path} HTTP/1.1\r\nHost: 127.0.0.1:{$port}\r\nConnection: close\r\n\r\n";if(fwrite($socket,$request)!==strlen($request))throw new RuntimeException('Isolated request was not sent.');fflush($socket);file_put_contents($root.'/'.$label.'-sent','sent');$raw=stream_get_contents($socket);fclose($socket);$parts=explode("\r\n\r\n",$raw,2);if(!str_contains($parts[0]??'','200 OK'))throw new RuntimeException('Isolated HTTP request failed.');echo$parts[1];exit;
}

$driver=in_array('pgsql',$argv,true)?'pgsql':'sqlite';sgHelper($repo);
if(in_array($argv[1]??'',['--cached-case','--lock-boundary-case'],true)){
    $root=sgRoot($repo);define('ZONE_ENGINE_ROOT',$root.'/engine');require$repo.'/engine/src/Core/Persistence/Database.php';$connection=sgConnection($driver,$root,$repo);$files=sgSetup($repo,$root,$driver,$connection);$installer=sgPdo($connection);
    $before=b110Snapshot($installer,b110Tables($installer));$pdo=new SchemaGuardProofPDO($connection['dsn'],$connection['user'],$connection['password'],[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);$atCommit=null;
    $install=static function()use($files,$installer,&$atCommit):void{
        // Same scheduling window as the independent failing proof. Both current
        // SQL and current crime BYTES change after initial capture, before SELECT.
        $newCrimes=file_get_contents($files['crimes'])."\n";$after=hash('sha256',file_get_contents($files['newSchema']).$newCrimes);
        $prepared=b110Prepare($installer,$files['oldFingerprint'],$after);file_put_contents($files['schema'],file_get_contents($files['newSchema']));file_put_contents($files['crimes'],$newCrimes);$atCommit=b110Commit($installer,$prepared,$files['schema'],$files['crimes']);
    };
    if($argv[1]==='--lock-boundary-case'){
        // The installer owns the real migration lock and has exposed new SQL,
        // but not its later crime bytes or bookkeeping. The request reads that
        // intermediate fingerprint. Commit at the acquire boundary makes a
        // reread performed BEFORE the lock insufficient on either adapter.
        $newCrimes=file_get_contents($files['crimes'])."\n";$after=hash('sha256',file_get_contents($files['newSchema']).$newCrimes);
        $prepared=b110Prepare($installer,$files['oldFingerprint'],$after);file_put_contents($files['schema'],file_get_contents($files['newSchema']));
        $pdo->beforeLock=static function()use($files,$installer,$prepared,$newCrimes,&$atCommit):void{file_put_contents($files['crimes'],$newCrimes);$atCommit=b110Commit($installer,$prepared,$files['schema'],$files['crimes']);};
    }else$pdo->pause=$install;
    sgDatabase($pdo,$driver)->migrateAndSeed();$expected=hash('sha256',file_get_contents($files['schema']).file_get_contents($files['crimes']));
    $evidence=['driver'=>$driver,'case'=>$argv[1],'database'=>$connection['database'],'root'=>$root,'pausedAfterOldCapture'=>$pdo->paused,'lockBoundaryPause'=>$pdo->lockBoundaryPaused,'lockAcquired'=>$pdo->lockSeen,'noSeedAttempt'=>!$pdo->seedAttempted,'oldSqlNotExecuted'=>!in_array($files['oldSql'],$pdo->executed,true),'newSqlNotReexecuted'=>!in_array(file_get_contents($files['newSchema']),$pdo->executed,true),'fingerprintRemainsCurrent'=>b110Fingerprint($installer)===$expected,'noFounderInserted'=>(int)$installer->query("SELECT COUNT(*) FROM players WHERE id='founder-player'")->fetchColumn()===0,'existingDataPreserved'=>b110Snapshot($installer,array_keys($before['counts']))===$before,'helperPreserved'=>$atCommit['dataPreserved']??false,'productionWrites'=>false];
    file_put_contents($root.'/cached-request-evidence.json',json_encode($evidence,JSON_THROW_ON_ERROR|JSON_PRETTY_PRINT));echo json_encode($evidence,JSON_THROW_ON_ERROR);exit;
}

$passed=0;function sgProof(bool$ok,string$label):void{global$passed;if(!$ok)throw new RuntimeException('FAIL: '.$label);$passed++;echo'PASS: '.$label.PHP_EOL;}
$arguments=$driver==='pgsql'?['-d','extension=pdo_pgsql']:[];$cached=sgFinish(sgStart([...$arguments,__FILE__,'--cached-case',$driver]));
foreach(['pausedAfterOldCapture','lockAcquired','noSeedAttempt','oldSqlNotExecuted','newSqlNotReexecuted','fingerprintRemainsCurrent','noFounderInserted','existingDataPreserved','helperPreserved']as$key)sgProof($cached[$key]===true,'actual '.$driver.' stale captured request: '.$key);
$boundary=sgFinish(sgStart([...$arguments,__FILE__,'--lock-boundary-case',$driver]));
foreach(['lockBoundaryPause','lockAcquired','noSeedAttempt','oldSqlNotExecuted','newSqlNotReexecuted','fingerprintRemainsCurrent','noFounderInserted','existingDataPreserved','helperPreserved']as$key)sgProof($boundary[$key]===true,'actual '.$driver.' lock-boundary source change: '.$key);
$root=sgRoot($repo);$connection=sgConnection($driver,$root,$repo);$files=sgSetup($repo,$root,$driver,$connection);$installer=sgPdo($connection);$before=b110Snapshot($installer,b110Tables($installer));
$git=proc_open(['git','-C',$repo,'show','5882cc70ff48744378af2b0eab270584d3052ea1:engine/src/Core/Persistence/Database.php'],[0=>['pipe','r'],1=>['pipe','w'],2=>['pipe','w']],$pipes);if(!is_resource($git))throw new RuntimeException('Baseline Database source unavailable.');fclose($pipes[0]);$oldSource=stream_get_contents($pipes[1]);fclose($pipes[1]);$errors=stream_get_contents($pipes[2]);fclose($pipes[2]);if(proc_close($git)!==0)throw new RuntimeException('Baseline source read failed.');
$dbSource=$root.'/engine/src/Core/Persistence/Database.php';file_put_contents($dbSource,$oldSource);$guardedSource=file_get_contents($repo.'/engine/src/Core/Persistence/Database.php');
if(in_array('--aged-source',$argv,true)&&!touch($dbSource,time()-10))throw new RuntimeException('Could not age the isolated old-source fixture.');
$socket=stream_socket_server('tcp://127.0.0.1:0',$errno,$error);if(!$socket)throw new RuntimeException('No isolated loopback port.');$address=stream_socket_get_name($socket,false);fclose($socket);$port=(int)substr(strrchr($address,':'),1);
$environment=[...getenv(),'ZONE_SCHEMA_GUARD_ROOT'=>$root,'ZONE_SCHEMA_GUARD_DRIVER'=>$driver,'ZONE_SCHEMA_GUARD_DSN'=>$connection['dsn'],'ZONE_SCHEMA_GUARD_USER'=>$connection['user']??'','ZONE_SCHEMA_GUARD_PASSWORD'=>$connection['password']??''];
// cli-server can enable OPcache even when enable_cli is0. This fixture proves
// the explicit no-opcode-cache source-first contract, not a cached live host.
// A cached production runtime requires actual owned-process replacement or a
// confirmed reload before migration. This isolated proof does not perform it.
$server=proc_open([PHP_BINARY,...$arguments,'-d','opcache.enable=0','-S',$address,'-t',$root,__FILE__],[0=>['pipe','r'],1=>['file',$root.'/http.log','a'],2=>['file',$root.'/http.log','a']],$serverPipes,$root,$environment,['bypass_shell'=>true]);if(!is_resource($server))throw new RuntimeException('Isolated PHP server did not start.');fclose($serverPipes[0]);
try{
    for($i=0;$i<50;$i++){$probe=@stream_socket_client('tcp://'.$address,$errno,$error,.2);if($probe){fclose($probe);break;}usleep(50000);}
    $old=sgStart([__FILE__,'--client',$root,(string)$port,'/old','old-client']);sgWait($root.'/old-entered');
    sgProof(hash_file('sha256',$files['schema'])===hash('sha256',$files['oldSql'])&&b110Fingerprint($installer)===$files['oldFingerprint'],'old HTTP request is paused while SQL and metadata remain old');
    $temporary=$dbSource.'.guarded';file_put_contents($temporary,$guardedSource);if(!rename($temporary,$dbSource))throw new RuntimeException('Isolated source-first replacement failed.');
    $barrier=sgStart([__FILE__,'--client',$root,(string)$port,'/health','barrier-client']);sgWait($root.'/barrier-client-sent');usleep(200000);
    sgProof(!is_file($root.'/health-entered'),'actual PHP server does not execute the sent health barrier concurrently with its old request');
    file_put_contents($root.'/old-release','release');$oldResult=sgFinish($old);$barrierResult=sgFinish($barrier);
    sgProof(!$oldResult['seedAttempted']&&b110Fingerprint($installer)===$files['oldFingerprint'],'old Database request finishes safely before any SQL/fingerprint change');
    sgProof($barrierResult['entered']>=$oldResult['completed']&&$barrierResult['pid']===$oldResult['pid'],'completed health response is a same-PHP-process after-old-request barrier');
    file_put_contents($root.'/http-source-barrier-observation.json',json_encode(['old'=>$oldResult,'barrier'=>$barrierResult,'agedSource'=>in_array('--aged-source',$argv,true),'oldSourceHash'=>hash('sha256',$oldSource),'guardedSourceHash'=>hash('sha256',$guardedSource),'installedSourceHash'=>hash_file('sha256',$dbSource)],JSON_THROW_ON_ERROR|JSON_PRETTY_PRINT));
    sgProof($oldResult['opcacheActive']===false&&$barrierResult['opcacheActive']===false&&!$oldResult['databaseCached']&&!$barrierResult['databaseCached'],'isolated HTTP source-first proof actually runs without opcode caching, not merely enable_cli=0');
    sgProof($oldResult['methodSpan']!==$barrierResult['methodSpan']&&$barrierResult['opcacheCli']==='0'&&$barrierResult['sapi']==='cli-server','barrier request loads the newly installed actual Database method with CLI opcode cache off');
    sgProof($barrierResult['os']==='Windows','source-first barrier proof uses the actual Windows PHP server semantics required by the PC target');
    for($i=0;$i<3;$i++){$loaded=sgFinish(sgStart([__FILE__,'--client',$root,(string)$port,'/health','after-barrier-'.$i]));sgProof($loaded['methodSpan']===$barrierResult['methodSpan']&&$loaded['pid']===$barrierResult['pid'],'post-barrier request '.($i+1).' loads guarded Database in the same server');}
    $guarded=sgStart([__FILE__,'--client',$root,(string)$port,'/guarded-paused','guarded-client']);sgWait($root.'/guarded-entered');
    $afterFingerprint=hash('sha256',file_get_contents($files['newSchema']).file_get_contents($files['crimes']));$prepared=b110Prepare($installer,$files['oldFingerprint'],$afterFingerprint);file_put_contents($files['schema'],file_get_contents($files['newSchema']));$committed=b110Commit($installer,$prepared,$files['schema'],$files['crimes']);
    file_put_contents($root.'/guarded-release','release');$guardedResult=sgFinish($guarded);
    sgProof($guardedResult['lockSeen']&&!$guardedResult['seedAttempted']&&$guardedResult['sqlExecuted']===0,'guarded HTTP request spanning the install rechecks under lock without any seed or schema execution');
    sgProof(b110Fingerprint($installer)===$afterFingerprint&&(int)$installer->query("SELECT COUNT(*) FROM players WHERE id='founder-player'")->fetchColumn()===0,'post-install guarded request neither downgrades fingerprint nor inserts a founder');
    sgProof($committed['dataPreserved']&&b110Snapshot($installer,array_keys($before['counts']))===$before,'two-phase source-first migration preserves retained account/data digests and active v4');
    $evidence=['driver'=>$driver,'root'=>$root,'database'=>$connection['database'],'runtime'=>['binary'=>PHP_BINARY,'sha256'=>hash_file('sha256',PHP_BINARY),'version'=>PHP_VERSION],'oldRequest'=>$oldResult,'barrier'=>$barrierResult,'guardedRequest'=>$guardedResult,'sourceDatabaseHash'=>hash('sha256',$guardedSource),'sourceFirstBarrierPassed'=>true,'agedSource'=>in_array('--aged-source',$argv,true),'opcodeContract'=>['isolatedOpcodeCache'=>'explicitly-disabled','cliServerEnableCliAloneDisablesCache'=>false,'cachedProductionRequires'=>'actual-owned-process-replacement-or-confirmed-reload-before-migration'],'finalFingerprint'=>$afterFingerprint,'productionWrites'=>false,'existingRuntimeStopped'=>false,'testOnlyServerPid'=>$guardedResult['pid'],'passed'=>$passed,'failed'=>0];
    file_put_contents($root.'/http-barrier-evidence.json',json_encode($evidence,JSON_THROW_ON_ERROR|JSON_PRETTY_PRINT));echo'SCHEMA GUARD110 EVIDENCE: '.$root.'/http-barrier-evidence.json'.PHP_EOL;
}finally{foreach(['old','guarded']as$label)if(!is_file($root.'/'.$label.'-release'))file_put_contents($root.'/'.$label.'-release','test-cleanup');proc_terminate($server);proc_close($server);}
echo"SCHEMA GUARD110 RESULT: {$passed} passed, 0 failed ({$driver}; isolated Windows PHP HTTP server)\n";
