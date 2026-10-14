param([string]$Name = 'beta-candidate-20261013')
$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
if ($Name -notmatch '^beta-candidate-[a-z0-9-]+$') { throw 'A beta-candidate name is required.' }
$candidateRoot = [IO.Path]::GetFullPath((Join-Path $repoRoot ('.tools/' + $Name)))
$allowedRoot = [IO.Path]::GetFullPath((Join-Path $repoRoot '.tools')) + [IO.Path]::DirectorySeparatorChar
if (-not $candidateRoot.StartsWith($allowedRoot, [StringComparison]::OrdinalIgnoreCase)) { throw 'Candidate escapes the workspace.' }
if (Test-Path -LiteralPath $candidateRoot) { throw 'Candidate already exists. Preserve it and choose a fresh name.' }
$runtime = @('index.html','admin.html','admin.css','admin.js','admin-studio.js','account.html','account.js','platform-runtime.js','player-session.js','favicon.svg','favicon.ico','support.js','image-slot.js','art','assets','dist','lib','scripts','api','package.json','vercel.json','README.md','.env.example')
foreach ($entry in $runtime) {
    if (-not (Test-Path -LiteralPath (Join-Path $repoRoot $entry))) { throw ('Missing candidate input: ' + $entry) }
}
$null = New-Item -ItemType Directory -Path $candidateRoot
foreach ($entry in $runtime) { Copy-Item -LiteralPath (Join-Path $repoRoot $entry) -Destination (Join-Path $candidateRoot $entry) -Recurse }
foreach ($engineCopy in @('engine','baseline-engine')) {
    $destination = Join-Path $candidateRoot $engineCopy
    $null = New-Item -ItemType Directory -Path $destination
    foreach ($entry in Get-ChildItem -LiteralPath (Join-Path $repoRoot 'engine')) {
        if ($entry.Name -eq 'var') { continue }
        Copy-Item -LiteralPath $entry.FullName -Destination (Join-Path $destination $entry.Name) -Recurse
    }
}
$null = New-Item -ItemType Directory -Path (Join-Path $candidateRoot 'engine/var')
$null = New-Item -ItemType Directory -Path (Join-Path $candidateRoot '.tools')
$runtimePath = Join-Path $repoRoot '.tools/php-8.5.10'
if (-not (Test-Path -LiteralPath (Join-Path $runtimePath 'php.exe'))) { throw 'Repository PHP runtime is missing.' }
$null = New-Item -ItemType Junction -Path (Join-Path $candidateRoot '.tools/php-8.5.10') -Target $runtimePath
[pscustomobject]@{
    Candidate = $candidateRoot
    EngineBaseline = (Join-Path $candidateRoot 'baseline-engine')
    CopiedProductionDatabase = $false
    CopiedCredentials = $false
    CopiedRelayConfiguration = $false
    EngineSourceIsolated = $true
    PublicServicesChanged = $false
}
