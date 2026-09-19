$ErrorActionPreference = 'Stop'

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$php = Join-Path $repoRoot '.tools\php-8.5.10\php.exe'
$router = Join-Path $repoRoot 'engine\router.php'
$engineVar = (Resolve-Path (Join-Path $repoRoot 'engine\var')).Path
$database = Join-Path $engineVar ("platform-smoke-{0}.sqlite" -f [Guid]::NewGuid().ToString('N'))
$stdout = Join-Path $engineVar ("platform-smoke-{0}.out.log" -f [Guid]::NewGuid().ToString('N'))
$stderr = Join-Path $engineVar ("platform-smoke-{0}.err.log" -f [Guid]::NewGuid().ToString('N'))
$listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, 0)
$listener.Start()
$port = ([System.Net.IPEndPoint]$listener.LocalEndpoint).Port
$listener.Stop()
$baseUrl = "http://127.0.0.1:$port"
$process = $null
$passed = 0

function Assert-Zone([bool]$condition, [string]$message) {
    if (-not $condition) { throw "FAIL: $message" }
    $script:passed++
    Write-Output "PASS: $message"
}

function Get-ZoneJson([string]$path) {
    return Invoke-RestMethod -Uri ($baseUrl + $path) -Method Get -Headers @{ Accept = 'application/json' } -TimeoutSec 15
}

function Invoke-ZoneJson([string]$path, [string]$method, [object]$body) {
    return Invoke-RestMethod -Uri ($baseUrl + $path) -Method $method -Headers @{ 'X-Zone-Admin-Actor' = 'platform-smoke' } -ContentType 'application/json' -Body ($body | ConvertTo-Json -Depth 30 -Compress) -TimeoutSec 15
}

try {
    $previousDemoMode = $env:ZONE_DEMO_MODE
    $previousDatabaseUrl = $env:ZONE_DATABASE_URL
    $env:ZONE_DEMO_MODE = '1'
    $env:ZONE_DATABASE_URL = 'sqlite:' + $database
    $process = Start-Process -FilePath $php -ArgumentList @('-S', "127.0.0.1:$port", $router) -WorkingDirectory $repoRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput $stdout -RedirectStandardError $stderr

    $ready = $false
    for ($attempt = 0; $attempt -lt 40; $attempt++) {
        try {
            $health = Get-ZoneJson '/api/v1/health'
            $ready = $true
            break
        } catch {
            Start-Sleep -Milliseconds 100
        }
    }
    Assert-Zone $ready 'PHP engine starts and health endpoint responds'

    $root = Invoke-WebRequest -Uri ($baseUrl + '/') -UseBasicParsing -TimeoutSec 15
    Assert-Zone ($root.StatusCode -eq 200 -and $root.Content.Contains('Playable Browser Game Prototype')) 'root serves the ZONE player game'
    $admin = Invoke-WebRequest -Uri ($baseUrl + '/admin') -UseBasicParsing -TimeoutSec 15
    Assert-Zone ($admin.StatusCode -eq 200 -and $admin.Content.Contains('ZONE Admin Control Plane')) 'admin route serves the control plane'
    $engine = Invoke-WebRequest -Uri ($baseUrl + '/engine') -UseBasicParsing -TimeoutSec 15
    Assert-Zone ($engine.StatusCode -eq 200 -and $engine.Content.Contains('ZONE Engine Control Room')) 'engine route serves the technical proof'

    foreach ($asset in @('/admin.css', '/admin.js', '/platform-runtime.js')) {
        $response = Invoke-WebRequest -Uri ($baseUrl + $asset) -UseBasicParsing -TimeoutSec 15
        Assert-Zone ($response.StatusCode -eq 200 -and $response.RawContentLength -gt 100) "$asset is available and non-empty"
    }

    $activeZero = Get-ZoneJson '/api/v1/releases/active'
    Assert-Zone ($activeZero.version -eq 0) 'foundation release is active before publishing'
    $draft = Get-ZoneJson '/api/v1/admin/draft'
    $draft.manifest.branding.name.en = 'ZONE Publish Proof'
    $draft.manifest.pages = @(@{
        id = 'operations'
        slug = 'operations'
        enabled = $true
        title = @{ en = 'Operations'; ar = 'العمليات' }
        blocks = @(@{ id = 'operations-hero'; type = 'hero'; content = @{ en = 'Published from the admin control plane'; ar = 'تم النشر من لوحة التحكم' } })
    })
    $draft.manifest.navigation += 'operations'
    $saved = Invoke-ZoneJson '/api/v1/admin/draft' 'Put' @{ manifest = $draft.manifest }
    Assert-Zone ($saved.manifest.branding.name.en -eq 'ZONE Publish Proof') 'admin saves a validated draft'
    $activeAfterDraft = Get-ZoneJson '/api/v1/releases/active'
    Assert-Zone ($activeAfterDraft.version -eq 0) 'saving a draft does not alter the active game release'
    $releaseOne = Invoke-ZoneJson '/api/v1/admin/releases/publish' 'Post' @{}
    Assert-Zone ($releaseOne.version -eq 1 -and $releaseOne.manifest.pages[0].id -eq 'operations') 'publishing creates release 1 with the admin page'

    $draftTwo = Get-ZoneJson '/api/v1/admin/draft'
    $draftTwo.manifest.branding.name.en = 'ZONE Second Release'
    $null = Invoke-ZoneJson '/api/v1/admin/draft' 'Put' @{ manifest = $draftTwo.manifest }
    $releaseTwo = Invoke-ZoneJson '/api/v1/admin/releases/publish' 'Post' @{}
    Assert-Zone ($releaseTwo.version -eq 2) 'a second publish creates immutable release 2'
    $restored = Invoke-ZoneJson ("/api/v1/admin/releases/{0}/activate" -f $releaseOne.id) 'Post' @{}
    Assert-Zone ($restored.version -eq 1) 'rollback reactivates release 1'
    $history = Get-ZoneJson '/api/v1/admin/releases'
    Assert-Zone ($history.releases.Count -eq 2) 'release history retains both immutable snapshots'

    Write-Output "RESULT: $passed platform checks passed"
} finally {
    if ($process -and -not $process.HasExited) {
        Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
        Wait-Process -Id $process.Id -Timeout 5 -ErrorAction SilentlyContinue
    }
    $env:ZONE_DEMO_MODE = $previousDemoMode
    $env:ZONE_DATABASE_URL = $previousDatabaseUrl
    foreach ($path in @($database, "$database-wal", "$database-shm", $stdout, $stderr)) {
        if (Test-Path -LiteralPath $path) {
            $resolved = (Resolve-Path -LiteralPath $path).Path
            if (-not $resolved.StartsWith($engineVar, [System.StringComparison]::OrdinalIgnoreCase)) { throw "Refusing to remove unexpected smoke artifact: $resolved" }
            Remove-Item -LiteralPath $resolved -Force
        }
    }
}
