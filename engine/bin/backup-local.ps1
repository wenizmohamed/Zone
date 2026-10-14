$ErrorActionPreference = 'Stop'
$repo = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$config = Get-Content (Join-Path $repo '.tools/local-beta-config.json') -Raw | ConvertFrom-Json
$directory = Join-Path $repo '.tools/local-beta-backups'
New-Item -ItemType Directory -Force -Path $directory | Out-Null
$output = Join-Path $directory ('zone-local-' + (Get-Date -Format 'yyyyMMdd-HHmmss-fffffff') + '-' + [Guid]::NewGuid().ToString('N') + '.dump')
if (Test-Path -LiteralPath $output) { throw 'Backup destination already exists. Refusing overwrite.' }
$pg = Join-Path $repo '.tools/postgresql-18.6/pgsql/bin'
$oldPassword = $env:PGPASSWORD
try {
    $env:PGPASSWORD = $config.password
    & (Join-Path $pg 'pg_dump.exe') -h 127.0.0.1 -p $config.databasePort -U $config.username -d zone_local_beta -Fc -f $output
    if ($LASTEXITCODE -ne 0) { throw 'Backup failed.' }
    & (Join-Path $pg 'pg_restore.exe') -l $output | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Backup archive validation failed.' }
} finally { $env:PGPASSWORD = $oldPassword }
Write-Output "PASS: PostgreSQL backup archive validated: $output"
