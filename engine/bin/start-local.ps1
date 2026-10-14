param([int]$Port = 4301)
$ErrorActionPreference = 'Stop'
$repo = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$configPath = Join-Path $repo '.tools/local-beta-config.json'
if (-not (Test-Path -LiteralPath $configPath)) { throw 'Local database configuration is missing. Run the local setup first.' }
$config = Get-Content -LiteralPath $configPath -Raw | ConvertFrom-Json
$runtimePath = Join-Path $repo '.tools/local-beta-runtime.json'
$fingerprintHasher = [System.Security.Cryptography.SHA256]::Create()
try {
    $targetFingerprint = [BitConverter]::ToString($fingerprintHasher.ComputeHash([Text.Encoding]::UTF8.GetBytes($config.databaseUrl))).Replace('-', '')
} finally {
    $fingerprintHasher.Dispose()
}
$php = Join-Path $repo '.tools/php-8.5.10/php.exe'
$router = Join-Path $repo 'engine/router.php'
$pg = Join-Path $repo '.tools/postgresql-18.6/pgsql/bin'
if (-not (Get-NetTCPConnection -State Listen -LocalPort $config.databasePort -ErrorAction SilentlyContinue)) {
    & (Join-Path $pg 'pg_ctl.exe') -D $config.clusterPath -l (Join-Path $repo '.tools/local-beta-postgres.log') -o ("-h 127.0.0.1 -p " + [int]$config.databasePort) start -w -t 20
    if ($LASTEXITCODE -ne 0) { throw 'PostgreSQL did not start.' }
}
$listener = Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue
if ($listener) {
    if (-not (Test-Path -LiteralPath $runtimePath)) { throw "Port $Port is occupied by an unregistered service." }
    $runtime = Get-Content -LiteralPath $runtimePath -Raw | ConvertFrom-Json
    $owner = Get-CimInstance Win32_Process -Filter "ProcessId=$($listener[0].OwningProcess)"
    if ($runtime.pid -ne $owner.ProcessId -or $runtime.port -ne $Port -or $runtime.repo -ne $repo -or $runtime.targetFingerprint -ne $targetFingerprint -or $owner.ExecutablePath -ne $php -or -not $owner.CommandLine.Contains($router)) { throw "Port $Port is occupied by a different checkout or database instance." }
    $health = Invoke-RestMethod "http://127.0.0.1:$Port/api/v1/health" -TimeoutSec 3
    if (-not $health.ok -or $health.engine.database -ne 'pgsql') { throw "Port $Port is occupied by a different service." }
    Write-Output "Already running: http://127.0.0.1:$Port/?screen=city&lang=en"
    exit 0
}
$env:ZONE_DATABASE_URL = $config.databaseUrl
$env:ZONE_PLAYER_SESSIONS = '1'
# Preserve configured owner access instead of silently clearing it.
# Cloud owner access arrives as a short-lived, verified gateway proof.
$env:VERCEL = ''
$relayConfigPath = Join-Path $repo '.tools/local-beta-relay-config.json'
if (Test-Path -LiteralPath $relayConfigPath) {
    $relayConfig = Get-Content -LiteralPath $relayConfigPath -Raw | ConvertFrom-Json
    if ($relayConfig.relayKey.Length -lt 32) { throw 'Relay configuration requires a strong authentication key.' }
    $env:ZONE_ENGINE_RELAY_KEY = $relayConfig.relayKey
    $env:ZONE_ENGINE_PUBLIC_HOSTS = $relayConfig.publicHosts -join ','
}
$process = Start-Process -FilePath $php -ArgumentList @('-d', 'extension=pdo_pgsql', '-S', "127.0.0.1:$Port", ('"' + $router + '"')) -WorkingDirectory $repo -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $repo '.tools/local-beta-php.log') -RedirectStandardError (Join-Path $repo '.tools/local-beta-php-errors.log')
@{pid=$process.Id;port=$Port;repo=$repo;targetFingerprint=$targetFingerprint} | ConvertTo-Json | Set-Content -LiteralPath $runtimePath -Encoding utf8
$ready = $false
for ($attempt = 0; $attempt -lt 15; $attempt++) {
    try { $health = Invoke-RestMethod "http://127.0.0.1:$Port/api/v1/health" -TimeoutSec 2; if ($health.ok -and $health.engine.database -eq 'pgsql') { $ready = $true; break } } catch { }
    Start-Sleep -Milliseconds 300
}
if (-not $ready) { throw 'Local engine failed its PostgreSQL health check. See .tools/local-beta-php-errors.log.' }
Write-Output "PASS: PostgreSQL-backed ZONE, PID $($process.Id), http://127.0.0.1:$Port/?screen=city&lang=en"
