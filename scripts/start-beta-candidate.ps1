param([string]$Name = 'beta-candidate-20261013', [int]$Port = 4313)
$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
if ($Name -notmatch '^beta-candidate-[a-z0-9-]+$' -or $Port -lt 1024 -or $Port -gt 65535) { throw 'Invalid candidate or loopback port.' }
$candidateRoot = (Resolve-Path -LiteralPath (Join-Path $repoRoot ('.tools/' + $Name))).Path
$allowedRoot = [IO.Path]::GetFullPath((Join-Path $repoRoot '.tools')) + [IO.Path]::DirectorySeparatorChar
if (-not $candidateRoot.StartsWith($allowedRoot, [StringComparison]::OrdinalIgnoreCase)) { throw 'Candidate escapes the workspace.' }
if (Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue) { throw 'Candidate port is already occupied. No process was stopped.' }
$php = Join-Path $candidateRoot '.tools/php-8.5.10/php.exe'
$router = Join-Path $candidateRoot 'engine/router.php'
$database = Join-Path $candidateRoot 'engine/var/candidate-browser.sqlite'
if (-not (Test-Path -LiteralPath $php) -or -not (Test-Path -LiteralPath $router)) { throw 'Candidate runtime inputs are missing.' }
$process = Start-Process -FilePath $php -ArgumentList @('-S', ('127.0.0.1:' + $Port), ('"' + $router + '"')) -WorkingDirectory $candidateRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $candidateRoot '.tools/candidate-browser.log') -RedirectStandardError (Join-Path $candidateRoot '.tools/candidate-browser-errors.log') -Environment @{
    ZONE_DATABASE_URL = ('sqlite:' + $database)
    DATABASE_URL = ''
    POSTGRES_URL = ''
    VERCEL = ''
    ZONE_PLAYER_SESSIONS = '1'
    ZONE_PLAYER_AUTH = ''
    ZONE_ADMIN_TOKEN = ''
    ZONE_ADMIN_USERNAME = ''
    ZONE_ADMIN_PASSWORD_HASH = ''
    ZONE_ADMIN_SESSION_SECRET = ''
    ZONE_ENGINE_RELAY_KEY = ''
    ZONE_ENGINE_PUBLIC_HOSTS = ''
    ZONE_BETA_OWNER_ACCESS = ''
}
$baseUrl = 'http://127.0.0.1:' + $Port
$health = $null
for ($attempt = 0; $attempt -lt 20; $attempt++) {
    try { $health = Invoke-RestMethod ($baseUrl + '/api/v1/health') -TimeoutSec 2; if ($health.ok) { break } } catch { }
    Start-Sleep -Milliseconds 150
}
if (-not $health.ok -or $health.engine.database -ne 'sqlite') { throw 'Isolated candidate did not become healthy. Public services were not changed.' }
[pscustomobject]@{ Url = $baseUrl; Pid = $process.Id; Source = $candidateRoot; Database = $database; Healthy = $health.ok; Adapter = $health.engine.database; PublicServicesChanged = $false }
