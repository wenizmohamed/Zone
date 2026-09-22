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
    return Invoke-RestMethod -Uri ($baseUrl + $path) -Method $method -Headers @{ Origin = $baseUrl } -ContentType 'application/json' -Body ($body | ConvertTo-Json -Depth 30 -Compress) -TimeoutSec 15
}

try {
    $previousDatabaseUrl = $env:ZONE_DATABASE_URL
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
    Assert-Zone ($root.StatusCode -eq 200 -and $root.Content.Contains('Browser Crime MMO')) 'root serves the ZONE player game'
    $admin = Invoke-WebRequest -Uri ($baseUrl + '/admin') -UseBasicParsing -TimeoutSec 15
    Assert-Zone ($admin.StatusCode -eq 200 -and $admin.Content.Contains('ZONE Admin Control Plane')) 'admin route serves the control plane'

    $authRouteStatus = 0
    try {
        Invoke-WebRequest -Uri ($baseUrl + '/api/v1/admin/auth') -UseBasicParsing -TimeoutSec 15 -ErrorAction Stop | Out-Null
        $authRouteStatus = 200
    } catch {
        if ($null -ne $_.Exception.Response) { $authRouteStatus = [int]$_.Exception.Response.StatusCode }
    }
    Assert-Zone ($authRouteStatus -eq 404) 'administrator authentication route has been removed'

    $engine = Invoke-WebRequest -Uri ($baseUrl + '/engine') -UseBasicParsing -TimeoutSec 15
    Assert-Zone ($engine.StatusCode -eq 200 -and $engine.Content.Contains('ZONE Engine Control Room')) 'engine route opens directly without login'

    $territories = Get-ZoneJson '/api/v1/city/map'
    Assert-Zone ($territories.blocks.Count -eq 120) 'city API exposes 120 individually selectable territory blocks'
    Assert-Zone ($territories.summary.neutral -gt 0 -and $territories.summary.ownedByPlayerFaction -gt 0) 'city API exposes both grey neutral land and player-faction holdings'
    Assert-Zone (@($territories.blocks | Where-Object { $_.ownerFactionId -eq $null -and $_.ownerColor -eq '#68717b' }).Count -gt 0) 'neutral blocks use the canonical grey ownership color'
    Assert-Zone (@($territories.blocks | Where-Object { $_.ownerFactionId -eq 'vipers' -and $_.ownerColor -eq '#78d628' }).Count -gt 0) 'player faction blocks use the canonical green ownership color'
    Assert-Zone (@($territories.blocks | Where-Object { $_.neighbors.Count -gt 0 -and $_.benefits.Count -gt 0 }).Count -eq 120) 'every city block has adjacency and a strategic benefit'
    $claimable = $territories.blocks | Where-Object { $_.action -eq 'claim' } | Select-Object -First 1
    Assert-Zone ($null -ne $claimable) 'server identifies at least one valid adjacent neutral claim'
    $claimResult = Invoke-ZoneJson ("/api/v1/territories/{0}/action" -f $claimable.id) 'Post' @{ action = 'claim'; expectedVersion = [int]$claimable.version }
    $claimed = $claimResult.map.blocks | Where-Object { $_.id -eq $claimable.id } | Select-Object -First 1
    Assert-Zone ($claimed.ownerFactionId -eq 'vipers' -and $claimed.ownerColor -eq '#78d628' -and $claimed.version -eq ([int]$claimable.version + 1)) 'valid claim changes exactly that block to the server-derived green faction owner'
    $freshTerritories = Get-ZoneJson '/api/v1/city/map'
    $persistedClaim = $freshTerritories.blocks | Where-Object { $_.id -eq $claimable.id } | Select-Object -First 1
    Assert-Zone ($persistedClaim.ownerFactionId -eq 'vipers' -and $freshTerritories.revision -ne $territories.revision) 'claimed ownership persists and advances the live map revision'

    foreach ($asset in @('/admin.css', '/admin.js', '/platform-runtime.js')) {
        $response = Invoke-WebRequest -Uri ($baseUrl + $asset) -UseBasicParsing -TimeoutSec 15
        Assert-Zone ($response.StatusCode -eq 200 -and $response.RawContentLength -gt 100) "$asset is available and non-empty"
    }

    $adminScriptText = [System.IO.File]::ReadAllText((Join-Path $repoRoot 'admin.js'), [System.Text.Encoding]::UTF8)
    $adminHtmlText = [System.IO.File]::ReadAllText((Join-Path $repoRoot 'admin.html'), [System.Text.Encoding]::UTF8)
    Assert-Zone ($adminScriptText.Contains('المصمم المرئي') -and $adminScriptText.Contains('اقتصاد قابل للتدقيق') -and $adminHtmlText.Contains('Noto+Kufi+Arabic')) 'admin bundle includes complete Arabic section copy and Arabic typography'
    Assert-Zone ($adminScriptText.Contains('lang=${state.language}') -and $root.Content.Contains("URLSearchParams(window.location.search).get('lang')")) 'admin language is synchronized into the embedded player preview'

    $adminCrimes = Get-ZoneJson '/api/v1/admin/crimes'
    Assert-Zone ($adminCrimes.crimes.Count -eq 7) 'open admin loads the full seven-tier crime catalogue'
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
    Assert-Zone ($audit.entries[0].action -eq 'CrimeCreated' -and $audit.entries[0].actor -eq 'admin-panel') 'crime mutation records the fixed control-plane actor in the admin audit log'

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
    Assert-Zone (@($releaseOne.manifest.content.crimes | Where-Object { $_.id -eq 'platform-smoke-crime' }).Count -eq 1) 'published release contains the administrator-created crime'
    $bootstrap = Get-ZoneJson '/api/v1/game/bootstrap'
    Assert-Zone ($bootstrap.release.id -eq $releaseOne.id -and @($bootstrap.content.crimes | Where-Object { $_.id -eq 'platform-smoke-crime' }).Count -eq 1) 'player bootstrap consumes the published crime snapshot'
    Assert-Zone ($root.Content.Contains('MANAGED_CRIMES') -and $root.Content.Contains('commitManaged')) 'player bundle renders and executes server-managed crimes'
    Assert-Zone ($adminScriptText.Contains('installSectionPreviews') -and $adminScriptText.Contains('section-preview-frame')) 'every administrator section receives an embedded game preview'

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
    foreach ($path in @($database, "$database-wal", "$database-shm", $stdout, $stderr)) {
        if (Test-Path -LiteralPath $path) {
            $resolved = (Resolve-Path -LiteralPath $path).Path
            if (-not $resolved.StartsWith($engineVar, [System.StringComparison]::OrdinalIgnoreCase)) { throw "Refusing to remove unexpected smoke artifact: $resolved" }
            Remove-Item -LiteralPath $resolved -Force
        }
    }
}
