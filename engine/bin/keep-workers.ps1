#Requires -Version 7.2
param([switch]$LibraryOnly, [switch]$Test, [string]$TestConfigPath = '', [int]$MaxSeconds = 0)
$ErrorActionPreference = 'Stop'

function Get-ZoneWorkerDigest([string]$Value) {
    $hasher = [Security.Cryptography.SHA256]::Create()
    try { return [Convert]::ToHexString($hasher.ComputeHash([Text.Encoding]::UTF8.GetBytes($Value))).ToLowerInvariant() }
    finally { $hasher.Dispose() }
}
function Get-ZoneWorkerPlan([bool]$IsTest, [string]$CandidateConfig) {
    $sourceRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..')).TrimEnd('\','/')
    $privateRoot = Join-Path $sourceRoot '.tools'
    if ($IsTest) {
        if ($CandidateConfig -eq '') { throw 'Test mode requires an explicit isolated config under .tools/v108.' }
        $configPath = [IO.Path]::GetFullPath($CandidateConfig)
        $testBoundary = [IO.Path]::GetFullPath((Join-Path $sourceRoot '.tools/v108')).TrimEnd('\','/') + [IO.Path]::DirectorySeparatorChar
        if (-not $configPath.StartsWith($testBoundary, [StringComparison]::OrdinalIgnoreCase)) { throw 'Test config must remain under this checkout .tools/v108.' }
    } else {
        if ($CandidateConfig -ne '') { throw 'Production workers read only the exact repository local-beta-config.json.' }
        $configPath = Join-Path $privateRoot 'local-beta-config.json'
    }
    if (-not (Test-Path -LiteralPath $configPath -PathType Leaf) -or (Get-Item -LiteralPath $configPath).LinkType) { throw 'The exact private worker database config is missing or linked.' }
    $config = Get-Content -LiteralPath $configPath -Raw | ConvertFrom-Json
    $connection = [Uri]([string]$config.databaseUrl)
    $databaseName = [Uri]::UnescapeDataString($connection.AbsolutePath.Trim('/'))
    if ($connection.Scheme -notin @('postgres','postgresql') -or $connection.Host -notin @('127.0.0.1','localhost') -or $connection.Port -ne 55433 -or $connection.UserInfo -eq '') { throw 'Workers require the explicit existing loopback PostgreSQL server on 55433.' }
    if (($IsTest -and ($databaseName -notmatch '^zone_beta_smoke_[a-z0-9_]+$' -or $databaseName.Length -gt 63)) -or (-not $IsTest -and $databaseName -ne 'zone_local_beta')) { throw 'Worker database target is outside the approved PC-backed scope.' }
    $identity = Get-ZoneWorkerDigest ($sourceRoot.ToLowerInvariant() + "`n" + $connection.Scheme + '://' + $connection.Host + ':55433/' + $databaseName)
    $runtimeDirectory = if ($IsTest) { Join-Path $sourceRoot ('.tools/v108/workers-' + $identity.Substring(0,16)) } else { Join-Path $sourceRoot '.tools/zone-workers' }
    if (-not (Test-Path -LiteralPath $runtimeDirectory)) { [void](New-Item -ItemType Directory -Path $runtimeDirectory) }
    if ((Get-Item -LiteralPath $runtimeDirectory).LinkType) { throw 'Worker runtime directory cannot be a junction or symbolic link.' }
    $phpPath = Join-Path $sourceRoot '.tools/php-8.5.10/php.exe'
    if ($IsTest -and -not (Test-Path -LiteralPath $phpPath)) {
        $originalRoot = [IO.Path]::GetFullPath((Join-Path $sourceRoot '../..'))
        $phpPath = Join-Path $originalRoot '.tools/php-8.5.10/php.exe'
    }
    if (-not (Test-Path -LiteralPath $phpPath -PathType Leaf)) { throw 'The repository-local PHP 8.5 runtime is required.' }
    $phpPath = [IO.Path]::GetFullPath($phpPath)
    $workerPath = Join-Path $sourceRoot 'engine/bin/worker.php'
    $keeperPath = Join-Path $sourceRoot 'engine/bin/keep-workers.ps1'
    $sourceFiles = @($workerPath, $keeperPath, (Join-Path $sourceRoot 'engine/bin/inspect-asset.mjs'), (Join-Path $sourceRoot 'engine/src/Core/Media/AssetLibrary.php'), (Join-Path $sourceRoot 'engine/src/Core/Media/AssetInspector.php'), (Join-Path $sourceRoot 'engine/src/Core/Media/SafeBundle.php'), (Join-Path $sourceRoot 'engine/src/Core/Game/WorldDirector.php'))
    foreach ($file in $sourceFiles) { if (-not (Test-Path -LiteralPath $file -PathType Leaf)) { throw 'A required worker source artifact is missing.' } }
    $sourceFingerprint = Get-ZoneWorkerDigest (($sourceFiles | ForEach-Object { (Get-FileHash -LiteralPath $_ -Algorithm SHA256).Hash }) -join "`n")
    $assetRoot = if ($IsTest) { Join-Path $runtimeDirectory 'assets' } else { Join-Path $sourceRoot 'engine/var/assets' }
    return [pscustomobject]@{ Repo=$sourceRoot; ConfigPath=$configPath; DatabaseUrl=[string]$config.databaseUrl; DatabaseName=$databaseName; TargetFingerprint=$identity; SourceFingerprint=$sourceFingerprint; Php=$phpPath; Worker=$workerPath; Keeper=$keeperPath; RuntimeDirectory=$runtimeDirectory; RuntimePath=(Join-Path $runtimeDirectory 'runtime.json'); StopFile=(Join-Path $runtimeDirectory 'supervisor.stop'); AssetRoot=$assetRoot; IsTest=$IsTest }
}
function Write-ZoneWorkerRuntime($Plan, $State) {
    $temporary = Join-Path $Plan.RuntimeDirectory ('runtime-' + [Guid]::NewGuid().ToString('N') + '.part')
    [IO.File]::WriteAllText($temporary, ($State | ConvertTo-Json -Depth 10), [Text.UTF8Encoding]::new($false))
    [IO.File]::Move($temporary, $Plan.RuntimePath, $true)
}
function Get-ZoneWorkerRegistration([int]$ProcessId, [string]$Creation, [string]$Executable, [string[]]$RequiredArguments) {
    if ($ProcessId -lt 1) { return $null }
    $process = Get-Process -Id $ProcessId -ErrorAction SilentlyContinue
    if (-not $process) { return $null }
    if ($process.StartTime.ToFileTimeUtc().ToString() -ne $Creation) { throw 'A registered process id was reused; no process was signaled.' }
    $owner = Get-CimInstance Win32_Process -Filter ('ProcessId=' + $ProcessId)
    if (-not $owner -or -not ([string]$owner.ExecutablePath).Equals($Executable, [StringComparison]::OrdinalIgnoreCase)) { throw 'Registered process executable changed; no process was signaled.' }
    foreach ($argument in $RequiredArguments) { if (-not ([string]$owner.CommandLine).Contains($argument, [StringComparison]::OrdinalIgnoreCase)) { throw 'Registered process source/arguments changed; no process was signaled.' } }
    return $process
}
function Get-ZoneWorkerState($Plan) {
    if (-not (Test-Path -LiteralPath $Plan.RuntimePath)) { return $null }
    $state = Get-Content -LiteralPath $Plan.RuntimePath -Raw | ConvertFrom-Json -AsHashtable
    if ($state.repo -ne $Plan.Repo -or $state.targetFingerprint -ne $Plan.TargetFingerprint) { throw 'Existing worker registration belongs to a different checkout or database.' }
    return $state
}
if ($LibraryOnly) { return }

$plan = Get-ZoneWorkerPlan $Test.IsPresent $TestConfigPath
$mutex = [Threading.Mutex]::new($false, 'Local\ZONE.Workers.' + $plan.TargetFingerprint)
$acquired = $false
try { try { $acquired = $mutex.WaitOne(0) } catch [Threading.AbandonedMutexException] { $acquired = $true }; if (-not $acquired) { Write-Output 'Registered worker supervisor already owns this source/database target.'; exit 0 }
    $state = Get-ZoneWorkerState $plan
    if ($state -and $state.status -eq 'running' -and $state.supervisorPid -ne $PID) {
        $oldSupervisor = Get-ZoneWorkerRegistration ([int]$state.supervisorPid) ([string]$state.supervisorCreatedAt) ((Get-Process -Id $PID).Path) @($plan.Keeper)
        if ($oldSupervisor) { throw 'A verified supervisor already owns the target registration.' }
    }
    if ($state -and $state.sourceFingerprint -ne $plan.SourceFingerprint) {
        foreach ($oldChild in @($state.children.Values)) {
            if (Get-Process -Id ([int]$oldChild.pid) -ErrorAction SilentlyContinue) { throw 'Older-source children remain alive. Request their owned graceful stop before replacing source.' }
        }
    }
    $logPath = Join-Path $plan.RuntimeDirectory 'supervisor.log'
    function Write-ZoneWorkerLog([string]$Event, [string]$Detail) { [IO.File]::AppendAllText($logPath, ([DateTime]::UtcNow.ToString('o') + ' ' + $Event + ' ' + $Detail + [Environment]::NewLine), [Text.UTF8Encoding]::new($false)) }
    $previousChildren = if ($state) { $state.children } else { @{} }
    $state = [ordered]@{ version=108; repo=$plan.Repo; databaseName=$plan.DatabaseName; targetFingerprint=$plan.TargetFingerprint; sourceFingerprint=$plan.SourceFingerprint; test=$plan.IsTest; supervisorPid=$PID; supervisorCreatedAt=(Get-Process -Id $PID).StartTime.ToFileTimeUtc().ToString(); status='running'; startedAt=[DateTime]::UtcNow.ToString('o'); updatedAt=[DateTime]::UtcNow.ToString('o'); children=@{} }
    $env:ZONE_DATABASE_URL = $plan.DatabaseUrl
    $env:ZONE_ASSET_ROOT = $plan.AssetRoot
    $env:ZONE_WORKER_SOURCE_ROOT = $plan.Repo
    $env:DATABASE_URL = ''; $env:POSTGRES_URL = ''; $env:VERCEL = ''; $env:ZONE_REDIS_URL = ''
    $env:ZONE_NODE_BINARY = (Get-Command node.exe -ErrorAction Stop).Source
    $started = [DateTime]::UtcNow; $lastProbe = [DateTime]::MinValue; $lastProbeResult = @{}; $probeProcess = $null
    foreach ($role in @('studio','world')) {
        $entry = @{ role=$role; id=('zone-' + $role); pid=0; createdAt=''; status='waiting'; starts=0; restarts=0; failures=0; nextStartAt=0L; lastStartAt=0L; heartbeatAt=0L; stopRequestedAt=0L; stopFile=(Join-Path $plan.RuntimeDirectory ($role + '.stop')); stdout=''; stderr='' }
        if ($previousChildren -and $previousChildren.Contains($role)) {
            $old = $previousChildren[$role]
            $owned = Get-ZoneWorkerRegistration ([int]$old.pid) ([string]$old.createdAt) $plan.Php @($plan.Worker, ('--role=' + $role), ('--id=zone-' + $role), ([string]$old.stopFile))
            if ($owned) { foreach ($key in @('pid','createdAt','starts','restarts','lastStartAt','stdout','stderr')) { $entry[$key] = $old[$key] }; $entry.status='adopted' }
        }
        $state.children[$role] = $entry
    }
    if (Test-Path -LiteralPath $plan.StopFile) { throw 'Supervisor stop marker exists. Use start-workers.ps1 to clear it after verifying previous owned processes.' }
    Write-ZoneWorkerRuntime $plan $state
    Write-ZoneWorkerLog 'started' ('pid=' + $PID + ' target=' + $plan.TargetFingerprint.Substring(0,16))
    do {
        $now = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
        foreach ($role in @('studio','world')) {
            $entry = $state.children[$role]
            $active = if ($entry.pid -gt 0) { Get-Process -Id ([int]$entry.pid) -ErrorAction SilentlyContinue } else { $null }
            if ($active -and $active.StartTime.ToFileTimeUtc().ToString() -ne $entry.createdAt) { throw 'Worker process id was reused; supervisor refuses to signal or adopt it.' }
            if (-not $active -and $entry.pid -gt 0) {
                Write-ZoneWorkerLog 'child-exited' ($role + ' pid=' + $entry.pid)
                $entry.restarts++; $entry.failures++; $entry.pid=0; $entry.status='backoff'; $entry.stopRequestedAt=0L
                $entry.nextStartAt=$now + [Math]::Min(60, [Math]::Pow(2,[Math]::Min(6,$entry.failures)))
            }
            if (-not $active -and $now -ge $entry.nextStartAt -and -not (Test-Path -LiteralPath $plan.StopFile)) {
                if (Test-Path -LiteralPath $entry.stopFile) { Remove-Item -LiteralPath $entry.stopFile }
                $entry.starts++; $generation = '{0:D4}' -f [int]$entry.starts
                $entry.stdout = Join-Path $plan.RuntimeDirectory ($role + '-' + $generation + '.log')
                $entry.stderr = Join-Path $plan.RuntimeDirectory ($role + '-' + $generation + '-errors.log')
                $child = Start-Process -FilePath $plan.Php -ArgumentList @('-d','extension=pdo_pgsql','-d','memory_limit=512M',('"' + $plan.Worker + '"'),('--role=' + $role),('--id=zone-' + $role),('--stop-file="' + $entry.stopFile + '"'),'--interval-ms=1000') -WorkingDirectory $plan.Repo -WindowStyle Hidden -PassThru -RedirectStandardOutput $entry.stdout -RedirectStandardError $entry.stderr
                $entry.pid=$child.Id; $entry.createdAt=$child.StartTime.ToFileTimeUtc().ToString(); $entry.lastStartAt=$now; $entry.heartbeatAt=0L; $entry.status='starting'
                Write-ZoneWorkerLog 'child-started' ($role + ' pid=' + $child.Id + ' generation=' + $generation)
            }
        }
        if (([DateTime]::UtcNow - $lastProbe).TotalSeconds -ge 5 -and (-not $probeProcess -or $probeProcess.HasExited)) {
            if ($probeProcess) { $probeProcess.Dispose(); $probeProcess=$null }
            $code = 'require getenv("ZONE_WORKER_SOURCE_ROOT")."/engine/bootstrap.php"; $d=Zone\Engine\Core\Persistence\Database::connect(getenv("ZONE_DATABASE_URL")); echo json_encode($d->fetchAll("SELECT id,updated_at,payload_json FROM worker_heartbeats WHERE id IN (''zone-studio'',''zone-world'')"),JSON_THROW_ON_ERROR);'
            $info = [Diagnostics.ProcessStartInfo]::new(); $info.FileName=$plan.Php; $info.UseShellExecute=$false; $info.CreateNoWindow=$true; $info.RedirectStandardOutput=$true; $info.RedirectStandardError=$true
            foreach ($part in @('-d','extension=pdo_pgsql','-d','memory_limit=512M','-r',$code)) { $info.ArgumentList.Add($part) }
            $probeProcess = [Diagnostics.Process]::Start($info); $outputTask=$probeProcess.StandardOutput.ReadToEndAsync(); $errorTask=$probeProcess.StandardError.ReadToEndAsync()
            if ($probeProcess.WaitForExit(7000) -and $probeProcess.ExitCode -eq 0) {
                try { $rows = $outputTask.Result | ConvertFrom-Json; $lastProbeResult=@{}; foreach ($row in $rows) { $lastProbeResult[$row.id]=$row } } catch { Write-ZoneWorkerLog 'heartbeat-unavailable' 'Invalid heartbeat response; no child was killed.' }
            } else { Write-ZoneWorkerLog 'heartbeat-unavailable' 'Read-only heartbeat probe unavailable; no duplicate probe or child is started.' }
            $lastProbe=[DateTime]::UtcNow
        }
        foreach ($role in @('studio','world')) {
            $entry=$state.children[$role]
            if ($entry.pid -le 0) { continue }
            if ($lastProbeResult.ContainsKey($entry.id)) {
                $row=$lastProbeResult[$entry.id]; $payload=$row.payload_json | ConvertFrom-Json
                if ([int]$payload.pid -eq [int]$entry.pid) { $entry.heartbeatAt=[long]$row.updated_at; if ($payload.status -eq 'running') { $entry.status='running' } }
            }
            if ((($entry.heartbeatAt -gt 0 -and $now - $entry.heartbeatAt -gt 120) -or ($entry.heartbeatAt -eq 0 -and $now - $entry.lastStartAt -gt 120)) -and $entry.stopRequestedAt -eq 0) {
                $owned=Get-ZoneWorkerRegistration ([int]$entry.pid) ([string]$entry.createdAt) $plan.Php @($plan.Worker, ('--role=' + $role), ('--id=zone-' + $role), ([string]$entry.stopFile))
                if ($owned) { [IO.File]::WriteAllText($entry.stopFile,'supervisor-heartbeat-recovery'); $entry.stopRequestedAt=$now; $entry.status='graceful-restart-requested'; Write-ZoneWorkerLog 'stale-heartbeat' ($role + ' graceful stop requested') }
            }
            if ($entry.status -eq 'running' -and $now - $entry.lastStartAt -ge 30) { $entry.failures=0 }
        }
        $state.updatedAt=[DateTime]::UtcNow.ToString('o'); Write-ZoneWorkerRuntime $plan $state
        if ((Test-Path -LiteralPath $plan.StopFile) -or ($MaxSeconds -gt 0 -and ([DateTime]::UtcNow - $started).TotalSeconds -ge $MaxSeconds)) { break }
        Start-Sleep -Milliseconds 1000
    } while ($true)
    $state.status='stopping'; Write-ZoneWorkerRuntime $plan $state
    foreach ($entry in $state.children.Values) {
        if ($entry.pid -le 0) { continue }
        $owned=Get-ZoneWorkerRegistration ([int]$entry.pid) ([string]$entry.createdAt) $plan.Php @($plan.Worker, ('--role=' + $entry.role), ('--id=' + $entry.id), ([string]$entry.stopFile))
        if ($owned) { [IO.File]::WriteAllText($entry.stopFile,'supervisor-shutdown') }
    }
    $drainUntil=[DateTime]::UtcNow.AddSeconds(95)
    do {
        $remaining=0
        foreach ($entry in $state.children.Values) {
            $active=if ($entry.pid -gt 0) { Get-Process -Id ([int]$entry.pid) -ErrorAction SilentlyContinue } else { $null }
            if ($active) { $remaining++ } else { $entry.status='stopped' }
        }
        if ($remaining -eq 0) { break }; Start-Sleep -Milliseconds 250
    } while ([DateTime]::UtcNow -lt $drainUntil)
    $state.status=if ($remaining -eq 0) { 'stopped' } else { 'drain-timeout' }; $state.updatedAt=[DateTime]::UtcNow.ToString('o'); Write-ZoneWorkerRuntime $plan $state
    Write-ZoneWorkerLog $state.status ('remaining=' + $remaining)
    if ($remaining -gt 0) { throw 'Owned children did not finish graceful drain. No process was force-killed.' }
} finally { if ($acquired) { $mutex.ReleaseMutex() }; $mutex.Dispose() }
