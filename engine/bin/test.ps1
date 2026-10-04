$ErrorActionPreference = 'Stop'
$repositoryRoot = Resolve-Path (Join-Path $PSScriptRoot '..\..')
$php = Join-Path $repositoryRoot '.tools\php-8.5.10\php.exe'

if (-not (Test-Path -LiteralPath $php)) {
    throw "Repository-local PHP 8.5 runtime is missing: $php"
}

& $php (Join-Path $repositoryRoot 'engine\tests\run.php')
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
& $php (Join-Path $repositoryRoot 'engine\tests\concurrency.php')
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
& $php (Join-Path $repositoryRoot 'engine\tests\publishing.php')
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
& $php (Join-Path $repositoryRoot 'engine\tests\gameplay-catalog.php')
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
& $php (Join-Path $repositoryRoot 'engine\tests\progression.php')
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
& $php (Join-Path $repositoryRoot 'engine\tests\combat.php')
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
& $php (Join-Path $repositoryRoot 'engine\tests\gameplay-integration.php')
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
& $php (Join-Path $repositoryRoot 'engine\tests\territory-lifecycle.php')
exit $LASTEXITCODE
