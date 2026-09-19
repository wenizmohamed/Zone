param(
    [Parameter(Mandatory = $true)]
    [string]$BaseUrl
)

$ErrorActionPreference = 'Stop'
$BaseUrl = $BaseUrl.TrimEnd('/')
$passed = 0

function Assert-Zone {
    param([bool]$Condition, [string]$Message)
    if (-not $Condition) { throw "FAILED: $Message" }
    $script:passed++
    Write-Output "PASS: $Message"
}

function Get-ZoneJson {
    param([string]$Path)
    return Invoke-RestMethod -Uri ($BaseUrl + $Path) -Method Get -Headers @{ Accept = 'application/json' } -TimeoutSec 30
}

$health = Get-ZoneJson '/api/v1/health'
Assert-Zone ($health.ok -eq $true) 'health endpoint is healthy'
Assert-Zone ($health.engine.php -like '8.5.*') 'PHP 8.5 is executing the engine'
Assert-Zone ($health.engine.database -eq 'pgsql') 'PostgreSQL is the live persistence adapter'
Assert-Zone ($health.engine.serverAuthoritative -eq $true) 'gameplay authority is on the server'

$draft = Get-ZoneJson '/api/v1/admin/draft'
$history = Get-ZoneJson '/api/v1/admin/releases'
$adminCrimes = Get-ZoneJson '/api/v1/admin/crimes'
$adminAudit = Get-ZoneJson '/api/v1/admin/audit'
$activeFirst = Get-ZoneJson '/api/v1/releases/active'
$activeSecond = Get-ZoneJson '/api/v1/releases/active'
$activeHistory = @($history.releases | Where-Object { $_.active })

Assert-Zone ($draft.channel -eq 'production') 'open admin reads the production draft without login'
Assert-Zone ($activeFirst.version -ge 1) 'an immutable production release exists'
Assert-Zone ($activeFirst.id -eq $activeSecond.id -and $activeFirst.version -eq $activeSecond.version) 'fresh release reads return the same persisted version'
Assert-Zone ($activeHistory.Count -eq 1 -and $activeHistory[0].id -eq $activeFirst.id) 'release history and active pointer agree'
Assert-Zone ($adminCrimes.crimes.Count -ge 3 -and $null -ne $adminCrimes.crimes[0].success_basis_points) 'open admin reads typed crime definitions including balance fields'
Assert-Zone ($adminAudit.entries.Count -ge 1 -and -not [string]::IsNullOrWhiteSpace($adminAudit.entries[0].actor)) 'administrator mutations retain an attributed audit trail'

$game = Invoke-WebRequest -Uri ($BaseUrl + '/') -UseBasicParsing -TimeoutSec 30
$admin = Invoke-WebRequest -Uri ($BaseUrl + '/admin') -UseBasicParsing -TimeoutSec 30
$engine = Invoke-WebRequest -Uri ($BaseUrl + '/engine') -UseBasicParsing -MaximumRedirection 0 -TimeoutSec 30
Assert-Zone ($game.StatusCode -eq 200 -and $game.Content.Contains('ZONE | Browser Crime MMO')) 'player game renders from the deployment'
Assert-Zone ($admin.StatusCode -eq 200 -and $admin.Content.Contains('ZONE Admin Control Plane') -and -not $admin.Content.Contains('loginForm')) 'admin control plane renders directly with no login form'
Assert-Zone ($engine.StatusCode -eq 200 -and $engine.Content.Contains('ZONE Engine Control Room')) 'engine control room renders directly with no redirect'

$authStatus = 0
try {
    Invoke-WebRequest -Uri ($BaseUrl + '/api/v1/admin/auth') -UseBasicParsing -TimeoutSec 30 -ErrorAction Stop | Out-Null
    $authStatus = 200
} catch {
    if ($null -ne $_.Exception.Response) { $authStatus = [int]$_.Exception.Response.StatusCode }
}
Assert-Zone ($authStatus -eq 404) 'administrator authentication endpoint is absent'

Write-Output "RESULT: $passed production checks passed"
