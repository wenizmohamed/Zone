param([Parameter(Mandatory = $true)][string]$BaseUrl)

# Read-only. Never publishes, logs in, creates a player, or performs a game action.
$ErrorActionPreference = 'Stop'
$BaseUrl = $BaseUrl.TrimEnd('/')
$passed = 0
function Assert-Zone([bool]$Condition, [string]$Message) {
    if (-not $Condition) { throw "FAILED: $Message" }
    $script:passed++
    Write-Output "PASS: $Message"
}
function Get-ZoneJson([string]$Path, [hashtable]$Headers = @{}) {
    return Invoke-RestMethod -Uri ($BaseUrl + $Path) -Method Get -Headers (@{ Accept = 'application/json' } + $Headers) -TimeoutSec 30
}
function Get-ZoneStatus([string]$Path) {
    try { return [int](Invoke-WebRequest -Uri ($BaseUrl + $Path) -UseBasicParsing -TimeoutSec 30 -ErrorAction Stop).StatusCode }
    catch { if ($null -ne $_.Exception.Response) { return [int]$_.Exception.Response.StatusCode }; throw }
}
$health = Get-ZoneJson '/api/v1/health'
Assert-Zone ($health.ok -eq $true) 'health endpoint is healthy'
Assert-Zone ($health.engine.php -like '8.5.*') 'PHP 8.5 is executing the engine'
Assert-Zone ($health.engine.database -eq 'pgsql') 'PostgreSQL is the persistence adapter'
Assert-Zone ($health.engine.serverAuthoritative -eq $true) 'gameplay authority is on the server'

$access = Get-ZoneJson '/api/v1/admin/session'
$betaAccess = $access.betaTesting -eq $true
if ($betaAccess) {
    Assert-Zone ($access.configured -and $access.authenticated -and -not $access.localDevelopment) 'explicit tester beta opens the control plane without owner sign-in'
} else {
    Assert-Zone ($access.configured -and -not $access.authenticated -and -not $access.localDevelopment) 'production owner access is configured and anonymous visitors stay locked'
    foreach ($path in @('/api/v1/admin/draft', '/api/v1/admin/gameplay-catalog', '/api/v1/admin/territories', '/api/v1/ledger', '/api/v1/events')) {
        Assert-Zone ((Get-ZoneStatus $path) -eq 401) "anonymous owner request is rejected: $path"
    }
}
foreach ($path in @('/api/v1/player', '/api/v1/city/map', '/api/v1/leaderboards')) {
    Assert-Zone ((Get-ZoneStatus $path) -eq 401) "anonymous private request is rejected: $path"
}

if (-not $betaAccess -and [string]::IsNullOrWhiteSpace($env:ZONE_VERIFY_OWNER_COOKIE)) { throw 'Owner verification requires an existing ZONE_VERIFY_OWNER_COOKIE as a private input. No account or owner session was created.' }
$ownerHeaders = if ($betaAccess) { @{} } else { @{ Cookie = $env:ZONE_VERIFY_OWNER_COOKIE } }
$draft = Get-ZoneJson '/api/v1/admin/draft' $ownerHeaders
$history = Get-ZoneJson '/api/v1/admin/releases' $ownerHeaders
$adminCrimes = Get-ZoneJson '/api/v1/admin/crimes' $ownerHeaders
$catalog = Get-ZoneJson '/api/v1/admin/gameplay-catalog' $ownerHeaders
$adminAudit = Get-ZoneJson '/api/v1/admin/audit' $ownerHeaders
$activeFirst = Get-ZoneJson '/api/v1/releases/active'
$activeSecond = Get-ZoneJson '/api/v1/releases/active'
$bootstrap = Get-ZoneJson '/api/v1/game/bootstrap'
$adminTerritories = Get-ZoneJson '/api/v1/admin/territories' $ownerHeaders
$activeHistory = @($history.releases | Where-Object { $_.active })
Assert-Zone ($draft.channel -eq 'production') 'authenticated owner reads the production draft'
Assert-Zone ($activeFirst.version -ge 1) 'an immutable published release exists'
Assert-Zone ($activeFirst.id -eq $activeSecond.id -and $activeFirst.version -eq $activeSecond.version) 'fresh reads return the same persisted release'
Assert-Zone ($activeHistory.Count -eq 1 -and $activeHistory[0].id -eq $activeFirst.id) 'release history and active pointer agree'
Assert-Zone ($adminCrimes.crimes.Count -ge 3 -and $null -ne $adminCrimes.crimes[0].success_basis_points) 'authenticated owner reads typed crime balance definitions'
Assert-Zone ($catalog.revision -ge 1 -and $null -ne $catalog.schema.items -and $null -ne $catalog.catalogs.items) 'typed gameplay authoring schema and draft are available to the owner'
Assert-Zone ($adminAudit.entries.Count -ge 1 -and -not [string]::IsNullOrWhiteSpace($adminAudit.entries[0].actor)) 'control-plane changes retain attributed audit trails'
Assert-Zone ($bootstrap.release.id -eq $activeFirst.id -and $bootstrap.content.crimes.Count -ge 3) 'public bootstrap exposes the published game content'
Assert-Zone ($adminTerritories.blocks.Count -eq 120) 'owner inspects all 120 city blocks without creating a player'
Assert-Zone (@($adminTerritories.blocks | Where-Object { $_.ownerFactionId -eq $null -and $_.ownerColor -eq '#68717b' }).Count -gt 0) 'neutral territory uses the canonical grey color'
Assert-Zone (@($adminTerritories.blocks | Where-Object { $_.neighbors.Count -gt 0 -and $_.benefits.Count -gt 0 }).Count -eq 120) 'every city block exposes adjacency and strategic benefits'

$game = Invoke-WebRequest -Uri ($BaseUrl + '/') -UseBasicParsing -TimeoutSec 30
$admin = Invoke-WebRequest -Uri ($BaseUrl + '/admin') -UseBasicParsing -TimeoutSec 30
$adminScript = Invoke-WebRequest -Uri ($BaseUrl + '/admin.js') -UseBasicParsing -TimeoutSec 30
$adminScriptText = [System.Text.Encoding]::UTF8.GetString($adminScript.RawContentStream.ToArray())
$engine = Invoke-WebRequest -Uri ($BaseUrl + '/engine') -Headers $ownerHeaders -UseBasicParsing -TimeoutSec 30
$sessionScript = Invoke-WebRequest -Uri ($BaseUrl + '/player-session.js') -UseBasicParsing -TimeoutSec 30
Assert-Zone ($game.StatusCode -eq 200 -and $game.Content.Contains('ZONE | Browser Crime MMO')) 'player shell renders'
Assert-Zone ($admin.StatusCode -eq 200 -and $admin.Content.Contains('adminOwnerToken')) 'Admin shell renders its owner-unlock control'
Assert-Zone ($engine.StatusCode -eq 200 -and $engine.Content.Contains('ZONE Engine Control Room')) 'owner-authorized engine control room renders'
Assert-Zone ($admin.Content.Contains('Noto+Kufi+Arabic') -and $adminScriptText.Contains('المصمم المرئي') -and $adminScriptText.Contains('اقتصاد قابل للتدقيق')) 'complete Arabic Admin bundle is shipped'
Assert-Zone ($adminScriptText.Contains('lang=${state.language}') -and $game.Content.Contains("URLSearchParams(window.location.search).get('lang')")) 'Admin and player preview synchronize language'
Assert-Zone ($game.Content.Contains('commitManaged') -and $game.Content.Contains('loadLeaderboards') -and $game.Content.Contains('joinFaction')) 'server-backed crime, family and standings clients are shipped'
Assert-Zone ($sessionScript.Content.Contains('/api/v1/auth/session') -and $sessionScript.Content.Contains('same-origin')) 'server-owned browser-session bootstrap is shipped'
Assert-Zone ($adminScriptText.Contains('installSectionPreviews') -and $adminScriptText.Contains('section-preview-frame')) 'Admin embeds section previews'

if (-not [string]::IsNullOrWhiteSpace($env:ZONE_VERIFY_PLAYER_COOKIE)) {
    $playerHeaders = @{ Cookie = $env:ZONE_VERIFY_PLAYER_COOKIE }
    $player = Get-ZoneJson '/api/v1/player' $playerHeaders
    $map = Get-ZoneJson '/api/v1/city/map' $playerHeaders
    $standings = Get-ZoneJson '/api/v1/leaderboards' $playerHeaders
    Assert-Zone ($player.player.id -ne 'founder-player' -and $map.blocks.Count -eq 120) 'existing test-player session reads its own account and complete city'
    Assert-Zone ($standings.limit -eq 50 -and $standings.rows.Count -le 50) 'existing test-player session reads bounded standings'
}
Write-Output "RESULT: $passed read-only production checks passed"
