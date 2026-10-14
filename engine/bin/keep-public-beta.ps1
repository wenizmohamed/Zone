param([switch]$Once)
$ErrorActionPreference = 'Stop'
$publicRepo = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$runtimePath = Join-Path $publicRepo '.tools/local-beta-public-runtime.json'
$sshPath = (Get-Command ssh.exe).Source
$shellPath = (Get-Process -Id $PID).Path
$relayConfig = Get-Content (Join-Path $publicRepo '.tools/local-beta-relay-config.json') -Raw | ConvertFrom-Json
$publicPort = [int]$relayConfig.port
$logPath = Join-Path $publicRepo '.tools/local-beta-watchdog.log'
$sshProcess = $null
$cycle = 0
function Write-BetaStatus([string]$message) {
    ('{0} {1}' -f [DateTime]::UtcNow.ToString('o'), $message) | Add-Content -LiteralPath $logPath -Encoding utf8
}
function Find-BetaTransport {
    $matches = @(Get-CimInstance Win32_Process -Filter "Name='ssh.exe'" | Where-Object { $_.ExecutablePath -eq $sshPath -and $_.CommandLine.Contains("127.0.0.1:${publicPort}:127.0.0.1:${publicPort}") -and $_.CommandLine.EndsWith('auralistening') -and $_.CommandLine.Contains('BatchMode=yes') })
    if ($matches.Count -gt 1) { throw 'Multiple registered-target SSH transports require inspection.' }
    if ($matches.Count -eq 1) { return (Get-Process -Id $matches[0].ProcessId) }
    return $null
}
function Invoke-BetaStarter([string]$name) {
    $child = Start-Process -FilePath $shellPath -ArgumentList @('-NoProfile', '-File', ('"' + (Join-Path $PSScriptRoot $name) + '"')) -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $publicRepo ('.tools/supervisor-' + $name + '.out.log')) -RedirectStandardError (Join-Path $publicRepo ('.tools/supervisor-' + $name + '.err.log'))
    if (-not $child.WaitForExit(60000)) { throw ('Starter timeout: ' + $name + ', PID ' + $child.Id) }
    if ($child.ExitCode -ne 0) { throw ('Starter failed: ' + $name + ', exit ' + $child.ExitCode) }
}
if (Test-Path -LiteralPath $runtimePath) {
    $previousRuntime = Get-Content -LiteralPath $runtimePath -Raw | ConvertFrom-Json
    $previousOwner = Get-CimInstance Win32_Process -Filter "ProcessId=$($previousRuntime.pid)"
    if ($previousOwner -and $previousOwner.CommandLine.Contains($PSCommandPath) -and $previousRuntime.pid -ne $PID) {
        Write-Output 'PASS: Registered public beta supervisor is already running.'
        exit 0
    }
}
@{pid=$PID;repo=$publicRepo;port=$publicPort;sshPid=$null} | ConvertTo-Json | Set-Content -LiteralPath $runtimePath -Encoding utf8
Write-BetaStatus 'Supervisor started.'
do {
    try {
        $cycle++
        Write-BetaStatus ('Health cycle ' + $cycle + ' starting.')
        Invoke-BetaStarter 'start-local.ps1'
        Invoke-BetaStarter 'start-relay.ps1'
        if ($null -eq $sshProcess -or $sshProcess.HasExited) { $sshProcess = Find-BetaTransport }
        if ($null -eq $sshProcess -or $sshProcess.HasExited) {
            $sshProcess = Start-Process -FilePath $sshPath -ArgumentList @('-N','-T','-o','BatchMode=yes','-o','ExitOnForwardFailure=yes','-o','ServerAliveInterval=20','-o','ServerAliveCountMax=3','-R',"127.0.0.1:${publicPort}:127.0.0.1:${publicPort}",'auralistening') -WindowStyle Hidden -PassThru -RedirectStandardError (Join-Path $publicRepo '.tools/local-beta-public-ssh.log')
            @{pid=$PID;repo=$publicRepo;port=$publicPort;sshPid=$sshProcess.Id} | ConvertTo-Json | Set-Content -LiteralPath $runtimePath -Encoding utf8
            Write-BetaStatus ('Started registered reverse transport, PID ' + $sshProcess.Id)
            Start-Sleep -Seconds 1
            if ($sshProcess.HasExited) { throw 'Reverse transport exited before readiness.' }
        }
        @{pid=$PID;repo=$publicRepo;port=$publicPort;sshPid=$sshProcess.Id;lastHealthyAt=[DateTime]::UtcNow.ToString('o');cycle=$cycle} | ConvertTo-Json | Set-Content -LiteralPath $runtimePath -Encoding utf8
        Write-BetaStatus ('Health cycle ' + $cycle + ' ready.')
        if ($Once) { Write-Output 'PASS: Engine, relay and reverse transport started.'; break }
    } catch {
        Write-BetaStatus $_.Exception.Message
        if ($Once) { throw }
    }
    Start-Sleep -Seconds 20
} while (-not $Once)
