param([string]$ConfigPath = '', [string]$RuntimeDirectory = '')
$ErrorActionPreference = 'Stop'
$repo = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
if ($RuntimeDirectory -eq '') { $RuntimeDirectory = Join-Path $repo '.tools' }
$runtimeDirectoryPath = (Resolve-Path -LiteralPath $RuntimeDirectory).Path
if ($ConfigPath -eq '') { $ConfigPath = Join-Path $repo '.tools/local-beta-relay-config.json' }
if (-not (Test-Path -LiteralPath $ConfigPath)) { throw 'Private relay configuration is missing.' }
$config = Get-Content -LiteralPath $ConfigPath -Raw | ConvertFrom-Json
$port = if ($config.port) { [int]$config.port } else { 55435 }
$upstreamPort = if ($config.upstreamPort) { [int]$config.upstreamPort } else { 4301 }
if ($port -lt 1 -or $port -gt 65535 -or $upstreamPort -lt 1 -or $upstreamPort -gt 65535) { throw 'Invalid local relay port.' }
$key = [string]$config.relayKey
if ($key -notmatch '^[\x21-\x7e]{32,512}$') { throw 'A strong private relay key is required.' }
$hosts = @($config.publicHosts | ForEach-Object { ([string]$_).ToLowerInvariant() })
if ($hosts.Count -eq 0) { throw 'Exact public host allowlist is required.' }
foreach ($hostName in $hosts) { if ($hostName -notmatch '^[a-z0-9][a-z0-9.-]*[a-z0-9]$' -or $hostName.Contains('..')) { throw 'Invalid public host allowlist.' } }
$node = (Get-Command node -ErrorAction Stop).Source
$relay = Join-Path $repo 'engine/bin/relay.mjs'
$sourceHash = (Get-FileHash -LiteralPath $relay -Algorithm SHA256).Hash
$runtimePath = Join-Path $runtimeDirectoryPath 'local-beta-relay-runtime.json'
$hasher = [System.Security.Cryptography.SHA256]::Create()
try {
    $configMaterial = $key + "`n" + ($hosts -join ',') + "`n$port`n$upstreamPort"
    $configFingerprint = [BitConverter]::ToString($hasher.ComputeHash([Text.Encoding]::UTF8.GetBytes($configMaterial))).Replace('-', '')
    $fingerprint = [BitConverter]::ToString($hasher.ComputeHash([Text.Encoding]::UTF8.GetBytes(($configMaterial + "`n$sourceHash")))).Replace('-', '')
} finally { $hasher.Dispose() }
$listener = Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue
$authHeaders = @{ 'X-Zone-Relay-Key' = $key; 'X-Zone-Client-Host' = $hosts[0]; 'X-Zone-Client-Proto' = 'https'; 'X-Zone-Client-IP' = '127.0.0.1' }
function Test-RegisteredRelayHealth {
    # The PHP worker can briefly queue readiness behind real gameplay reads.
    # Retry the registered listener; a slow probe never starts a duplicate relay.
    for ($relayProbe = 0; $relayProbe -lt 3; $relayProbe++) {
        try {
            $relayHealth = Invoke-RestMethod "http://127.0.0.1:$port/api/v1/health" -Headers $authHeaders -TimeoutSec 5
            if ($relayHealth.ok) { return $true }
        } catch { }
        if ($relayProbe -lt 2) { Start-Sleep -Milliseconds 250 }
    }
    return $false
}
if ($listener) {
    if (@($listener | Where-Object { $_.LocalAddress -ne '127.0.0.1' }).Count -gt 0) { throw 'Relay listener must bind only IPv4 loopback.' }
    if (-not (Test-Path -LiteralPath $runtimePath)) { throw 'Relay port is occupied by an unregistered service.' }
    $runtime = Get-Content -LiteralPath $runtimePath -Raw | ConvertFrom-Json
    $owner = Get-CimInstance Win32_Process -Filter "ProcessId=$($listener[0].OwningProcess)"
    if ($runtime.pid -ne $owner.ProcessId -or $runtime.port -ne $port -or $runtime.repo -ne $repo -or $owner.ExecutablePath -ne $node -or -not $owner.CommandLine.Contains($relay)) { throw 'Relay port belongs to a different process or configuration.' }
    if ($runtime.fingerprint -eq $fingerprint) {
        if (-not (Test-RegisteredRelayHealth)) { throw 'The registered relay failed three bounded readiness probes.' }
        Write-Output "PASS: Existing authenticated loopback relay, port $port, PID $($owner.ProcessId)."
        exit 0
    }
    if (-not $runtime.sourceHash -or $runtime.configFingerprint -ne $configFingerprint -or $runtime.sourceHash -eq $sourceHash) { throw 'Relay configuration changed or older registration cannot prove restart identity.' }
    # Close the authenticated owned listener. Never send a process termination signal.
    $stopped = Invoke-RestMethod "http://127.0.0.1:$port/__zone_relay_stop" -Method Post -Headers @{ 'X-Zone-Relay-Key' = $key } -TimeoutSec 3
    if (-not $stopped.stopping) { throw 'Owned relay did not acknowledge graceful shutdown.' }
    for ($attempt = 0; $attempt -lt 125; $attempt++) {
        $oldProcess = Get-Process -Id $owner.ProcessId -ErrorAction SilentlyContinue
        $oldListener = Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue
        if (-not $oldProcess -and -not $oldListener) { break }
        Start-Sleep -Milliseconds 200
    }
    if ($oldProcess -or $oldListener) { throw 'Owned relay has not completed graceful shutdown; no process was killed.' }
}
$previous = @{}
$environment = @{ ZONE_ENGINE_RELAY_KEY = $key; ZONE_ENGINE_PUBLIC_HOSTS = ($hosts -join ','); ZONE_ENGINE_RELAY_PORT = [string]$port; ZONE_ENGINE_LOCAL_PORT = [string]$upstreamPort }
try {
    foreach ($name in $environment.Keys) { $previous[$name] = [Environment]::GetEnvironmentVariable($name, 'Process'); [Environment]::SetEnvironmentVariable($name, $environment[$name], 'Process') }
    $process = Start-Process -FilePath $node -ArgumentList @(('"' + $relay + '"')) -WorkingDirectory $repo -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $runtimeDirectoryPath "local-beta-relay-$port.log") -RedirectStandardError (Join-Path $runtimeDirectoryPath "local-beta-relay-$port-errors.log")
} finally { foreach ($name in $previous.Keys) { [Environment]::SetEnvironmentVariable($name, $previous[$name], 'Process') } }
@{ pid = $process.Id; port = $port; repo = $repo; fingerprint = $fingerprint; configFingerprint = $configFingerprint; sourceHash = $sourceHash } | ConvertTo-Json | Set-Content -LiteralPath $runtimePath -Encoding utf8
$ready = $false
for ($attempt = 0; $attempt -lt 15; $attempt++) {
    try { $health = Invoke-RestMethod "http://127.0.0.1:$port/api/v1/health" -Headers $authHeaders -TimeoutSec 2; if ($health.ok) { $ready = $true; break } } catch { }
    Start-Sleep -Milliseconds 300
}
if (-not $ready) { throw 'Local relay failed the bounded health check. Inspect the per-port relay error log.' }
Write-Output "PASS: Authenticated loopback relay, port $port, PID $($process.Id)."
