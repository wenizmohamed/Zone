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
$session = $null
$csrfToken = ''

function Assert-Zone([bool]$condition, [string]$message) {
    if (-not $condition) { throw "FAIL: $message" }
    $script:passed++
    Write-Output "PASS: $message"
}

function Get-ZoneJson([string]$path) {
    if ($null -eq $session) {
        return Invoke-RestMethod -Uri ($baseUrl + $path) -Method Get -Headers @{ Accept = 'application/json' } -TimeoutSec 15
    }
    return Invoke-RestMethod -Uri ($baseUrl + $path) -Method Get -Headers @{ Accept = 'application/json' } -WebSession $session -TimeoutSec 15
}

function Invoke-ZoneJson([string]$path, [string]$method, [object]$body) {
    return Invoke-RestMethod -Uri ($baseUrl + $path) -Method $method -Headers @{ 'X-Zone-CSRF-Token' = $csrfToken; Origin = $baseUrl } -WebSession $session -ContentType 'application/json' -Body ($body | ConvertTo-Json -Depth 30 -Compress) -TimeoutSec 15
}

try {
    $previousDatabaseUrl = $env:ZONE_DATABASE_URL
    $previousAdminUsername = $env:ZONE_ADMIN_USERNAME
    $previousAdminPasswordHash = $env:ZONE_ADMIN_PASSWORD_HASH
    $previousAdminSessionSecret = $env:ZONE_ADMIN_SESSION_SECRET
    $env:ZONE_DATABASE_URL = 'sqlite:' + $database
    $env:ZONE_ADMIN_USERNAME = 'platform-smoke'
    $env:ZONE_ADMIN_PASSWORD_HASH = & $php -r "echo password_hash('platform-smoke-password', PASSWORD_ARGON2ID);"
    $env:ZONE_ADMIN_SESSION_SECRET = 'platform-smoke-session-secret-at-least-thirty-two-characters'
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
    Assert-Zone ($root.StatusCode -eq 200 -and $root.Content.Contains('Browser Crime MMO')) 'root serves the ZONE player game'
    $admin = Invoke-WebRequest -Uri ($baseUrl + '/admin') -UseBasicParsing -TimeoutSec 15
    Assert-Zone ($admin.StatusCode -eq 200 -and $admin.Content.Contains('ZONE Admin Control Plane')) 'admin route serves the control plane'

    $authBeforeLogin = Get-ZoneJson '/api/v1/admin/auth'
    Assert-Zone ($authBeforeLogin.authenticated -eq $false) 'admin starts unauthenticated'
    $login = Invoke-RestMethod -Uri ($baseUrl + '/api/v1/admin/auth/login') -Method Post -Headers @{ Origin = $baseUrl } -SessionVariable authenticatedSession -ContentType 'application/json' -Body (@{ username = 'platform-smoke'; password = 'platform-smoke-password' } | ConvertTo-Json -Compress) -TimeoutSec 15
    $session = $authenticatedSession
    $csrfToken = $login.csrfToken
    Assert-Zone ($login.authenticated -eq $true -and $login.user.username -eq 'platform-smoke' -and $csrfToken.Length -ge 32) 'admin login creates an authenticated session with CSRF protection'

    $engine = Invoke-WebRequest -Uri ($baseUrl + '/engine') -UseBasicParsing -WebSession $session -TimeoutSec 15
    Assert-Zone ($engine.StatusCode -eq 200 -and $engine.Content.Contains('ZONE Engine Control Room')) 'engine route serves the technical proof'

    foreach ($asset in @('/admin.css', '/admin.js', '/platform-runtime.js')) {
        $response = Invoke-WebRequest -Uri ($baseUrl + $asset) -UseBasicParsing -TimeoutSec 15
        Assert-Zone ($response.StatusCode -eq 200 -and $response.RawContentLength -gt 100) "$asset is available and non-empty"
    }

    $adminCrimes = Get-ZoneJson '/api/v1/admin/crimes'
    Assert-Zone ($adminCrimes.crimes.Count -eq 3) 'authenticated admin loads the full crime catalogue'
    $crime = Invoke-ZoneJson '/api/v1/admin/crimes/platform-smoke-crime' 'Put' @{
        name_en = 'Platform smoke crime'
        name_ar = 'جريمة فحص المنصة'
        nerve_cost = 5
        success_basis_points = 6800
        cash_min = 500
        cash_max = 1100
        xp_reward = 20
        enabled = $true
    }
    Assert-Zone ($crime.crime.id -eq 'platform-smoke-crime' -and $crime.crime.successRate -eq 68) 'admin creates a validated server crime definition'
    $publicCrimes = Get-ZoneJson '/api/v1/crimes'
    Assert-Zone (@($publicCrimes.crimes | Where-Object { $_.id -eq 'platform-smoke-crime' }).Count -eq 1) 'enabled crime becomes available through the player API'
    $audit = Get-ZoneJson '/api/v1/admin/audit'
    Assert-Zone ($audit.entries[0].action -eq 'CrimeCreated' -and $audit.entries[0].actor -eq 'platform-smoke') 'crime mutation records the authenticated actor in the admin audit log'

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
    $env:ZONE_DATABASE_URL = $previousDatabaseUrl
    $env:ZONE_ADMIN_USERNAME = $previousAdminUsername
    $env:ZONE_ADMIN_PASSWORD_HASH = $previousAdminPasswordHash
    $env:ZONE_ADMIN_SESSION_SECRET = $previousAdminSessionSecret
    foreach ($path in @($database, "$database-wal", "$database-shm", $stdout, $stderr)) {
        if (Test-Path -LiteralPath $path) {
            $resolved = (Resolve-Path -LiteralPath $path).Path
            if (-not $resolved.StartsWith($engineVar, [System.StringComparison]::OrdinalIgnoreCase)) { throw "Refusing to remove unexpected smoke artifact: $resolved" }
            Remove-Item -LiteralPath $resolved -Force
        }
    }
}
