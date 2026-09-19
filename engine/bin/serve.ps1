$ErrorActionPreference = 'Stop'
$repositoryRoot = Resolve-Path (Join-Path $PSScriptRoot '..\..')
$php = Join-Path $repositoryRoot '.tools\php-8.5.10\php.exe'

if (-not (Test-Path -LiteralPath $php)) {
    throw "Repository-local PHP 8.5 runtime is missing: $php"
}

Push-Location $repositoryRoot
try {
    & $php -S 127.0.0.1:4285 engine/router.php
} finally {
    Pop-Location
}
