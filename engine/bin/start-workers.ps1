#Requires -Version 7.2
param([switch]$Test, [string]$TestConfigPath = '', [switch]$Stop, [switch]$Restart, [int]$StopTimeoutSeconds = 20, [int]$MaxSeconds = 0)
$ErrorActionPreference = 'Stop'
$launchTest=$Test.IsPresent; $launchConfig=$TestConfigPath; $launchStop=$Stop.IsPresent; $launchRestart=$Restart.IsPresent; $launchMax=$MaxSeconds
. (Join-Path $PSScriptRoot 'keep-workers.ps1') -LibraryOnly
if ($StopTimeoutSeconds -lt 1 -or $StopTimeoutSeconds -gt 60) { throw 'Bounded stop wait must be 1 to 60 seconds.' }
$plan=Get-ZoneWorkerPlan $launchTest $launchConfig
$shell=(Get-Command pwsh.exe -ErrorAction Stop).Source
$state=Get-ZoneWorkerState $plan
$registered=$null
if ($state -and $state.supervisorPid -gt 0) {
    $registered=Get-ZoneWorkerRegistration ([int]$state.supervisorPid) ([string]$state.supervisorCreatedAt) $shell @($plan.Keeper)
}
if ($launchStop -or $launchRestart) {
    if ($registered) {
        [IO.File]::WriteAllText($plan.StopFile,'owner-requested-graceful-stop')
        $until=[DateTime]::UtcNow.AddSeconds($StopTimeoutSeconds)
        do { if (-not (Get-Process -Id $registered.Id -ErrorAction SilentlyContinue)) { break }; Start-Sleep -Milliseconds 250 } while ([DateTime]::UtcNow -lt $until)
        if (Get-Process -Id $registered.Id -ErrorAction SilentlyContinue) { throw 'Owned workers are still draining their current job. Stop remains requested; no process was killed and no replacement was started.' }
    } elseif ($state) {
        foreach ($entry in $state.children.Values) {
            $owned=Get-ZoneWorkerRegistration ([int]$entry.pid) ([string]$entry.createdAt) $plan.Php @($plan.Worker, ('--role=' + $entry.role), ('--id=' + $entry.id), ([string]$entry.stopFile))
            if ($owned) { [IO.File]::WriteAllText($entry.stopFile,'owner-stop-orphaned-supervisor-child') }
        }
    }
    if ($launchStop -and -not $launchRestart) { [pscustomobject]@{ status='stop-requested'; runtime=$plan.RuntimePath; targetFingerprint=$plan.TargetFingerprint; forcedKills=0 }; return }
    $registered=$null; $state=Get-ZoneWorkerState $plan
}
if ($registered) {
    if ($state.sourceFingerprint -ne $plan.SourceFingerprint) { throw 'Running workers have older source. Use this launcher -Restart for an owned graceful refresh.' }
    [pscustomobject]@{ status='already-running'; supervisorPid=$registered.Id; runtime=$plan.RuntimePath; databaseName=$plan.DatabaseName; studioPid=$state.children.studio.pid; worldPid=$state.children.world.pid; targetFingerprint=$plan.TargetFingerprint }
    return
}
if ($state) {
    foreach ($entry in $state.children.Values) {
        $active=Get-ZoneWorkerRegistration ([int]$entry.pid) ([string]$entry.createdAt) $plan.Php @($plan.Worker, ('--role=' + $entry.role), ('--id=' + $entry.id), ([string]$entry.stopFile))
        if ($active -and ($state.sourceFingerprint -ne $plan.SourceFingerprint -or (Test-Path -LiteralPath $plan.StopFile))) { throw 'Previously owned children still exist with a draining or older-source registration. No replacement was started.' }
    }
}
if (Test-Path -LiteralPath $plan.StopFile) { Remove-Item -LiteralPath $plan.StopFile }
$arguments=@('-NoProfile','-NonInteractive','-File',('"' + $plan.Keeper + '"'))
if ($launchTest) { $arguments+=@('-Test','-TestConfigPath',('"' + $plan.ConfigPath + '"')) }
if ($launchMax -gt 0) { $arguments+=@('-MaxSeconds',[string]$launchMax) }
$supervisor=Start-Process -FilePath $shell -ArgumentList $arguments -WorkingDirectory $plan.Repo -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $plan.RuntimeDirectory 'supervisor-output.log') -RedirectStandardError (Join-Path $plan.RuntimeDirectory 'supervisor-errors.log')
$until=[DateTime]::UtcNow.AddSeconds(20); $ready=$false
do {
    if ($supervisor.HasExited) { throw 'Worker supervisor exited before readiness. Inspect its private runtime error log.' }
    if (Test-Path -LiteralPath $plan.RuntimePath) {
        $state=Get-ZoneWorkerState $plan
        if ($state.supervisorPid -eq $supervisor.Id -and $state.status -eq 'running' -and $state.children.studio.status -eq 'running' -and $state.children.world.status -eq 'running') { $ready=$true; break }
    }
    Start-Sleep -Milliseconds 250
} while ([DateTime]::UtcNow -lt $until)
if (-not $ready) { throw 'Owned worker supervisor started but both role heartbeats are not yet ready. No duplicate was started.' }
[pscustomobject]@{ status='running'; supervisorPid=$supervisor.Id; runtime=$plan.RuntimePath; databaseName=$plan.DatabaseName; studioPid=$state.children.studio.pid; worldPid=$state.children.world.pid; targetFingerprint=$plan.TargetFingerprint; sourceFingerprint=$plan.SourceFingerprint; visibleWindows=0; forcedKills=0 }
