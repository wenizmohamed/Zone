param([string]$Name = 'beta-candidate-20261013', [string]$Creator = 'zonebeta')
$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
if ($Name -notmatch '^beta-candidate-[a-z0-9-]+$') { throw 'Invalid isolated candidate name.' }
if ($Creator -notmatch '^[a-z_][a-z0-9_]*$') { throw 'Invalid local test-database creator.' }
$candidateRoot = (Resolve-Path -LiteralPath (Join-Path $repoRoot ('.tools/' + $Name))).Path
$allowedRoot = [IO.Path]::GetFullPath((Join-Path $repoRoot '.tools')) + [IO.Path]::DirectorySeparatorChar
if (-not $candidateRoot.StartsWith($allowedRoot, [StringComparison]::OrdinalIgnoreCase)) { throw 'Candidate escapes the workspace.' }
$config = Get-Content -LiteralPath (Join-Path $repoRoot '.tools/local-beta-config.json') -Raw | ConvertFrom-Json
$connection = [Uri]$config.databaseUrl
if ($connection.Host -notin @('127.0.0.1','localhost')) { throw 'Only the existing loopback PostgreSQL server can host isolated tests.' }
$psql = Join-Path $repoRoot '.tools/postgresql-18.6/pgsql/bin/psql.exe'
$php = Join-Path $candidateRoot '.tools/php-8.5.10/php.exe'
if (-not (Test-Path -LiteralPath $psql) -or -not (Test-Path -LiteralPath $php)) { throw 'Local database or PHP test runtime is missing.' }
$userInfo = $connection.UserInfo.Split(':', 2)
$databaseUser = [Uri]::UnescapeDataString($userInfo[0])
$databasePassword = if ($userInfo.Count -gt 1) { [Uri]::UnescapeDataString($userInfo[1]) } else { '' }
$previous = @{}
foreach ($key in @('PGPASSWORD','ZONE_DATABASE_URL','DATABASE_URL','POSTGRES_URL','ZONE_POSTGRES_TEST_URL','ZONE_DEPTH_TEST_URL')) { $previous[$key] = [Environment]::GetEnvironmentVariable($key, 'Process') }
$suiteCount = 0
try {
    $env:PGPASSWORD = $databasePassword
    foreach ($key in @('ZONE_DATABASE_URL','DATABASE_URL','POSTGRES_URL','ZONE_POSTGRES_TEST_URL','ZONE_DEPTH_TEST_URL')) { [Environment]::SetEnvironmentVariable($key, $null, 'Process') }
    # Existing setup uses a privileged local creator and a separate least-privilege
    # game role. Never grant CREATE DATABASE to the running game account.
    $canCreate = & $psql '-h' $connection.Host '-p' ([string]$connection.Port) '-U' $Creator '-d' 'postgres' '-w' '-At' '-c' 'SELECT rolsuper OR rolcreatedb FROM pg_roles WHERE rolname = current_user;'
    if ($LASTEXITCODE -ne 0 -or [string]::Join('', $canCreate).Trim() -ne 't') { throw 'Configured local creator cannot create isolated test databases.' }
    foreach ($suite in @('postgres-beta.php','player-market.php','player-combat.php','family-activities.php','beta-multiplayer-integration.php')) {
        $databaseName = 'zone_beta_smoke_' + (Get-Date -Format 'yyyyMMddHHmmss') + '_' + [Guid]::NewGuid().ToString('N').Substring(0,8)
        if ($databaseName -notmatch '^zone_beta_smoke_[a-z0-9_]+$' -or $databaseName.Length -gt 63) { throw 'Invalid disposable database target.' }
        $quotedOwner = $databaseUser.Replace('"','""')
        & $psql '-h' $connection.Host '-p' ([string]$connection.Port) '-U' $Creator '-d' 'postgres' '-w' '-v' 'ON_ERROR_STOP=1' '-c' ('CREATE DATABASE "' + $databaseName + '" OWNER "' + $quotedOwner + '";')
        if ($LASTEXITCODE -ne 0) { throw 'Could not create the named isolated test database.' }
        $builder = [UriBuilder]::new($connection)
        $builder.Path = '/' + $databaseName
        if ($suite -eq 'postgres-beta.php') { $env:ZONE_POSTGRES_TEST_URL = $builder.Uri.AbsoluteUri }
        else { $env:ZONE_DEPTH_TEST_URL = $builder.Uri.AbsoluteUri }
        Write-Output ('ISOLATED POSTGRES SUITE: ' + $suite + '; database=' + $databaseName)
        & $php '-d' 'extension=pdo_pgsql' (Join-Path $candidateRoot ('engine/tests/' + $suite))
        if ($LASTEXITCODE -ne 0) { throw ('PostgreSQL suite failed: ' + $suite) }
        $suiteCount++
        $env:ZONE_POSTGRES_TEST_URL = ''
        $env:ZONE_DEPTH_TEST_URL = ''
    }
    Write-Output ('RESULT: ' + $suiteCount + ' isolated PostgreSQL suites passed. No live game database was used. Named test databases were retained for inspection.')
} finally {
    foreach ($key in $previous.Keys) { [Environment]::SetEnvironmentVariable($key, $previous[$key], 'Process') }
}
