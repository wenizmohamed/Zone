$ErrorActionPreference = 'Stop'
$repositoryRoot = Resolve-Path (Join-Path $PSScriptRoot '..\..')
$php = Join-Path $repositoryRoot '.tools\php-8.5.10\php.exe'

if (-not (Test-Path -LiteralPath $php)) {
    throw "Repository-local PHP 8.5 runtime is missing: $php"
}

& $php (Join-Path $repositoryRoot 'engine\tests\run.php')
exit $LASTEXITCODE
