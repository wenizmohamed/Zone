$ErrorActionPreference = 'Stop'
$repositoryRoot = Resolve-Path (Join-Path $PSScriptRoot '..\..')
$php = Join-Path $repositoryRoot '.tools\php-8.5.10\php.exe'
$depthUrl = $env:ZONE_DEPTH_TEST_URL
Remove-Item Env:ZONE_DEPTH_TEST_URL -ErrorAction SilentlyContinue

if (-not (Test-Path -LiteralPath $php)) {
    throw "Repository-local PHP 8.5 runtime is missing: $php"
}

& $php (Join-Path $repositoryRoot 'engine\tests\run.php')
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
& $php (Join-Path $repositoryRoot 'engine\tests\concurrency.php')
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
& $php (Join-Path $repositoryRoot 'engine\tests\publishing.php')
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
& $php (Join-Path $repositoryRoot 'engine\tests\beta-engine-hardening.php')
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
& $php (Join-Path $repositoryRoot 'engine\tests\owner-playtest.php')
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
& $php (Join-Path $repositoryRoot 'engine\tests\owner-playtest-http.php')
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
& $php (Join-Path $repositoryRoot 'engine\tests\gameplay-catalog.php')
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
& $php (Join-Path $repositoryRoot 'engine\tests\content-authoring.php')
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
& $php (Join-Path $repositoryRoot 'engine\tests\catalog-egress.php')
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
& $php (Join-Path $repositoryRoot 'engine\tests\browser-sessions.php')
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
& $php (Join-Path $repositoryRoot 'engine\tests\player-accounts.php')
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
& $php (Join-Path $repositoryRoot 'engine\tests\access-http.php')
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
& $php (Join-Path $repositoryRoot 'engine\tests\private-static-http.php')
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
& $php (Join-Path $repositoryRoot 'engine\tests\leaderboards.php')
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
& $php (Join-Path $repositoryRoot 'engine\tests\progression.php')
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
& $php (Join-Path $repositoryRoot 'engine\tests\beta-depth.php')
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
& $php (Join-Path $repositoryRoot 'engine\tests\family-leadership.php')
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
& $php (Join-Path $repositoryRoot 'engine\tests\combat.php')
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
& $php (Join-Path $repositoryRoot 'engine\tests\rookie-combat.php')
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
foreach ($suite in @('player-market.php', 'player-combat.php', 'family-activities.php', 'beta-multiplayer-integration.php')) {
    & $php (Join-Path $repositoryRoot "engine\tests\$suite")
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    if ($depthUrl) {
        $env:ZONE_DEPTH_TEST_URL = $depthUrl
        & $php -d extension=pdo_pgsql (Join-Path $repositoryRoot "engine\tests\$suite")
        if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
        Remove-Item Env:ZONE_DEPTH_TEST_URL -ErrorAction SilentlyContinue
    }
}
& $php (Join-Path $repositoryRoot 'engine\tests\gameplay-integration.php')
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
& $php (Join-Path $repositoryRoot 'engine\tests\launch-first-session.php')
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
& $php (Join-Path $repositoryRoot 'engine\tests\launch-studio-workflow.php')
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
& $php (Join-Path $repositoryRoot 'engine\tests\territory-lifecycle.php')
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
& $php (Join-Path $repositoryRoot 'engine\tests\territory-orphan.php')
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
& $php (Join-Path $repositoryRoot 'engine\tests\territory-http.php')
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
if ($env:ZONE_POSTGRES_TEST_URL) {
    & $php -d extension=pdo_pgsql (Join-Path $repositoryRoot 'engine\tests\postgres-beta.php')
    exit $LASTEXITCODE
}
exit 0
