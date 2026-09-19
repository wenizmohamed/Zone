param(
    [Parameter(Mandatory = $true)]
    [string]$BaseUrl,

    [string]$Username = $env:ZONE_ADMIN_USERNAME,

    [string]$Password = $env:ZONE_ADMIN_PASSWORD
)

$ErrorActionPreference = 'Stop'
$BaseUrl = $BaseUrl.TrimEnd('/')

if ([string]::IsNullOrWhiteSpace($Username) -or [string]::IsNullOrWhiteSpace($Password)) {
    throw 'Set ZONE_ADMIN_USERNAME and ZONE_ADMIN_PASSWORD, or pass -Username and -Password.'
}

$passed = 0

function Assert-Zone {
    param(
        [bool]$Condition,
        [string]$Message
    )

    if (-not $Condition) {
        throw "FAILED: $Message"
    }

    $script:passed++
    Write-Output "PASS: $Message"
}

function Get-ZoneJson {
    param(
        [string]$Path,
        [Microsoft.PowerShell.Commands.WebRequestSession]$Session
    )

    $parameters = @{
        Uri = $BaseUrl + $Path
        Method = 'Get'
        Headers = @{ Accept = 'application/json' }
        TimeoutSec = 30
    }
    if ($null -ne $Session) {
        $parameters.WebSession = $Session
    }

    return Invoke-RestMethod @parameters
}

$health = Get-ZoneJson '/api/v1/health'
Assert-Zone ($health.ok -eq $true) 'health endpoint is healthy'
Assert-Zone ($health.engine.php -like '8.5.*') 'PHP 8.5 is executing the engine'
Assert-Zone ($health.engine.database -eq 'pgsql') 'PostgreSQL is the live persistence adapter'
Assert-Zone ($health.engine.serverAuthoritative -eq $true) 'gameplay authority is on the server'

$anonymous = Get-ZoneJson '/api/v1/admin/auth'
Assert-Zone ($anonymous.authenticated -eq $false) 'anonymous visitors are not administrators'

$loginParameters = @{
    Uri = $BaseUrl + '/api/v1/admin/auth/login'
    Method = 'Post'
    Headers = @{ Origin = $BaseUrl; Accept = 'application/json' }
    SessionVariable = 'adminSession'
    ContentType = 'application/json'
    Body = @{ username = $Username; password = $Password } | ConvertTo-Json -Compress
    TimeoutSec = 30
}
$login = Invoke-RestMethod @loginParameters

Assert-Zone ($login.authenticated -eq $true -and $login.user.username -eq $Username) 'administrator credentials create a signed session'
Assert-Zone ([string]$login.csrfToken).Length -ge 32 'administrator session includes CSRF protection'

$draft = Get-ZoneJson '/api/v1/admin/draft' $adminSession
$history = Get-ZoneJson '/api/v1/admin/releases' $adminSession
$adminCrimes = Get-ZoneJson '/api/v1/admin/crimes' $adminSession
$adminAudit = Get-ZoneJson '/api/v1/admin/audit' $adminSession
$activeFirst = Get-ZoneJson '/api/v1/releases/active'
$activeSecond = Get-ZoneJson '/api/v1/releases/active'
$activeHistory = @($history.releases | Where-Object { $_.active })

Assert-Zone ($draft.channel -eq 'production') 'admin reads the production draft'
Assert-Zone ($activeFirst.version -ge 1) 'an immutable production release exists'
Assert-Zone ($activeFirst.id -eq $activeSecond.id -and $activeFirst.version -eq $activeSecond.version) 'fresh release reads return the same persisted version'
Assert-Zone ($activeHistory.Count -eq 1 -and $activeHistory[0].id -eq $activeFirst.id) 'release history and active pointer agree'
Assert-Zone ($adminCrimes.crimes.Count -ge 3 -and $null -ne $adminCrimes.crimes[0].success_basis_points) 'admin reads typed crime definitions including balance fields'
Assert-Zone ($adminAudit.entries.Count -ge 1 -and -not [string]::IsNullOrWhiteSpace($adminAudit.entries[0].actor)) 'administrator mutations have an attributed audit trail'

$game = Invoke-WebRequest -Uri ($BaseUrl + '/') -UseBasicParsing -TimeoutSec 30
$admin = Invoke-WebRequest -Uri ($BaseUrl + '/admin') -UseBasicParsing -TimeoutSec 30
Assert-Zone ($game.StatusCode -eq 200 -and $game.Content.Contains('ZONE | Browser Crime MMO')) 'player game renders from the deployment'
Assert-Zone ($admin.StatusCode -eq 200 -and $admin.Content.Contains('ZONE Admin Control Plane')) 'admin control plane renders from the deployment'

$csrfHeaders = @{
    Origin = $BaseUrl
    Accept = 'application/json'
    'X-Zone-CSRF-Token' = $login.csrfToken
}
$logoutParameters = @{
    Uri = $BaseUrl + '/api/v1/admin/auth/logout'
    Method = 'Post'
    WebSession = $adminSession
    Headers = $csrfHeaders
    ContentType = 'application/json'
    Body = '{}'
    TimeoutSec = 30
}
$logout = Invoke-RestMethod @logoutParameters
Assert-Zone ($logout.authenticated -eq $false -and $logout.signedOut -eq $Username) 'logout invalidates the signed session'

$protectedStatus = 0
try {
    Invoke-WebRequest -Uri ($BaseUrl + '/api/v1/admin/draft') -WebSession $adminSession -UseBasicParsing -TimeoutSec 30 -ErrorAction Stop | Out-Null
    $protectedStatus = 200
} catch {
    if ($null -ne $_.Exception.Response) {
        $protectedStatus = [int]$_.Exception.Response.StatusCode
    }
}
Assert-Zone ($protectedStatus -eq 401) 'protected admin data rejects the logged-out session'

Write-Output "RESULT: $passed production checks passed"
