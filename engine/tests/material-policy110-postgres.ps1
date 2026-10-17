#Requires -Version 7.2
$ErrorActionPreference='Stop'
$candidate=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$original=[IO.Path]::GetFullPath((Join-Path $candidate '../..'))
if(-not$candidate.Equals((Join-Path $original '.tools/zone-beta106-crimes'),[StringComparison]::OrdinalIgnoreCase)){throw 'Material acceptance requires the existing isolated integration checkout.'}
$config=Get-Content -LiteralPath (Join-Path $original '.tools/local-beta-config.json') -Raw|ConvertFrom-Json
$connection=[Uri]$config.databaseUrl
if($connection.Scheme -notin @('postgres','postgresql') -or $connection.Host -notin @('127.0.0.1','localhost') -or $connection.Port -ne 55433){throw 'Only the existing loopback test server is permitted.'}
$parts=$connection.UserInfo.Split(':',2);$owner=[Uri]::UnescapeDataString($parts[0]);$password=if($parts.Count -gt 1){[Uri]::UnescapeDataString($parts[1])}else{''}
if($owner -notmatch '^[a-z_][a-z0-9_]*$'){throw 'Unexpected database role.'}
$pg=[ordered]@{PGHOST=$connection.Host;PGPORT='55433';PGDATABASE='postgres';PGUSER='zonebeta';PGPASSWORD=$password;PGSSLMODE='disable';PGCONNECT_TIMEOUT='5'}
$psql=Join-Path $original '.tools/postgresql-18.6/pgsql/bin/psql.exe';$php=Join-Path $original '.tools/php-8.5.10/php.exe'
function Run-Private([string]$Exe,[string[]]$Arguments,[System.Collections.IDictionary]$Environment){
    $start=[Diagnostics.ProcessStartInfo]::new();$start.FileName=$Exe;$start.WorkingDirectory=$candidate;$start.UseShellExecute=$false;$start.CreateNoWindow=$true;$start.WindowStyle=[Diagnostics.ProcessWindowStyle]::Hidden;$start.RedirectStandardOutput=$true;$start.RedirectStandardError=$true
    foreach($key in @($start.Environment.Keys)){if($key.StartsWith('PG',[StringComparison]::OrdinalIgnoreCase)){[void]$start.Environment.Remove($key)}}
    foreach($key in $Environment.Keys){$start.Environment[$key]=[string]$Environment[$key]};foreach($argument in $Arguments){[void]$start.ArgumentList.Add($argument)}
    $process=[Diagnostics.Process]::Start($start);$out=$process.StandardOutput.ReadToEndAsync();$err=$process.StandardError.ReadToEndAsync()
    if(-not$process.WaitForExit(60000)){throw 'Disposable proof exceeded its bounded wait; no persistent process was changed or killed.'}
    [pscustomobject]@{exit=$process.ExitCode;output=$out.GetAwaiter().GetResult()+$err.GetAwaiter().GetResult()}
}
$name='zone_beta_smoke_material110_'+(Get-Date -Format 'MMddHHmmss')+'_'+[Guid]::NewGuid().ToString('N').Substring(0,8)
if($name -notmatch '^zone_beta_smoke_material110_[a-z0-9_]+$' -or $name.Length -gt 63){throw 'Invalid disposable database name.'}
$exists=Run-Private $psql @('-X','-w','-At','-v','ON_ERROR_STOP=1','-c',("SELECT COUNT(*) FROM pg_database WHERE datname='"+$name+"';")) $pg
if($exists.exit -ne 0 -or $exists.output.Trim() -ne '0'){throw 'Refusing to reuse any existing database.'}
$created=Run-Private $psql @('-X','-w','-At','-v','ON_ERROR_STOP=1','-c',('CREATE DATABASE "'+$name+'" OWNER "'+$owner+'";')) $pg
if($created.exit -ne 0){throw 'New disposable material acceptance database could not be created.'}
$builder=[UriBuilder]::new($connection);$builder.Path='/'+$name
$environment=[ordered]@{ZONE_MATERIAL_TEST_URL=$builder.Uri.AbsoluteUri;ZONE_DATABASE_URL='';DATABASE_URL='';POSTGRES_URL='';ZONE_REDIS_URL=''}
Write-Output ('DISPOSABLE MATERIAL POSTGRES DATABASE: '+$name)
$result=Run-Private $php @('-d','extension=pdo_pgsql',(Join-Path $PSScriptRoot 'material-policy110.php')) $environment
$safe=$result.output.Replace($connection.AbsoluteUri,'[private-connection]').Replace($builder.Uri.AbsoluteUri,'[private-connection]').Replace($owner,'[private-role]')
if($password -ne ''){$safe=$safe.Replace($password,'[private-password]')}
Write-Output $safe.TrimEnd()
if($result.exit -ne 0){throw 'Isolated PostgreSQL material policy proof failed.'}
Write-Output 'Only the new named disposable database was written. It is retained for inspection; no live fixture, config, runtime or publication was changed.'
