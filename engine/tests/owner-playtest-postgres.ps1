$ErrorActionPreference = 'Stop'
$candidateRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$workspaceRoot = [IO.Path]::GetFullPath((Join-Path $candidateRoot '../..'))
if ($candidateRoot -notlike '*\.tools\beta-candidate-*') { throw 'Owner PostgreSQL test requires an isolated candidate.' }
$configPath = Join-Path $workspaceRoot '.tools/local-beta-config.json'
$config = Get-Content -LiteralPath $configPath -Raw | ConvertFrom-Json
$connection = [Uri]$config.databaseUrl
if ($connection.Host -notin @('127.0.0.1','localhost')) { throw 'Only disposable loopback PostgreSQL tests are permitted.' }
$psql = Join-Path $workspaceRoot '.tools/postgresql-18.6/pgsql/bin/psql.exe'
$php = Join-Path $workspaceRoot '.tools/php-8.5.10/php.exe'
$userInfo = $connection.UserInfo.Split(':', 2)
$databaseUser = [Uri]::UnescapeDataString($userInfo[0])
if ($databaseUser -notmatch '^[a-z_][a-z0-9_]*$') { throw 'Invalid test role.' }
$password = if ($userInfo.Count -gt 1) { [Uri]::UnescapeDataString($userInfo[1]) } else { '' }
$previous = @{}
foreach ($name in @('PGPASSWORD', 'ZONE_OWNER_TEST_URL', 'ZONE_DATABASE_URL', 'DATABASE_URL', 'POSTGRES_URL')) { $previous[$name] = [Environment]::GetEnvironmentVariable($name, 'Process') }
try {
    $env:PGPASSWORD = $password
    $canCreate = & $psql '-h' $connection.Host '-p' ([string]$connection.Port) '-U' 'zonebeta' '-d' 'postgres' '-w' '-At' '-c' 'SELECT rolsuper OR rolcreatedb FROM pg_roles WHERE rolname = current_user;'
    if ($LASTEXITCODE -ne 0 -or [string]::Join('', $canCreate).Trim() -ne 't') { throw 'Existing local creator cannot create a disposable test database.' }
    $databaseName = 'zone_beta_smoke_owner_' + [Guid]::NewGuid().ToString('N').Substring(0,12)
    if ($databaseName -notmatch '^zone_beta_smoke_[a-z0-9_]+$') { throw 'Invalid test database target.' }
    & $psql '-h' $connection.Host '-p' ([string]$connection.Port) '-U' 'zonebeta' '-d' 'postgres' '-w' '-v' 'ON_ERROR_STOP=1' '-c' ('CREATE DATABASE "' + $databaseName + '" OWNER "' + $databaseUser + '";')
    if ($LASTEXITCODE -ne 0) { throw 'Disposable owner test database creation failed.' }
    $builder = [UriBuilder]::new($connection); $builder.Path = '/' + $databaseName
    foreach ($name in @('ZONE_DATABASE_URL','DATABASE_URL','POSTGRES_URL')) { [Environment]::SetEnvironmentVariable($name, $null, 'Process') }
    $env:ZONE_OWNER_TEST_URL = $builder.Uri.AbsoluteUri
    Write-Output ('ISOLATED OWNER POSTGRES DATABASE: ' + $databaseName)
    & $php '-d' 'extension=pdo_pgsql' (Join-Path $PSScriptRoot 'owner-playtest.php')
    if ($LASTEXITCODE -ne 0) { throw 'Owner playtest PostgreSQL proof failed.' }
    Write-Output 'Only the new named test database was written. No live database was used. Test fixture retained for inspection.'
} finally { foreach ($name in $previous.Keys) { [Environment]::SetEnvironmentVariable($name, $previous[$name], 'Process') } }
