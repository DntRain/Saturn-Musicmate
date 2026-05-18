param(
  [string]$Version = "22.13.1",
  [string]$Arch = "x64"
)

$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$resourcesDir = Join-Path $repoRoot "src-tauri/resources"
$nodeExe = Join-Path $resourcesDir "node.exe"
$cacheDir = Join-Path $repoRoot ".cache/node"
$distName = "node-v$Version-win-$Arch"
$zipName = "$distName.zip"
$baseUrl = "https://nodejs.org/dist/v$Version"
$zipPath = Join-Path $cacheDir $zipName
$shasumsPath = Join-Path $cacheDir "SHASUMS256.txt"
$extractDir = Join-Path $cacheDir $distName

New-Item -ItemType Directory -Force $resourcesDir | Out-Null
New-Item -ItemType Directory -Force $cacheDir | Out-Null

if (-not (Test-Path $zipPath)) {
  Invoke-WebRequest "$baseUrl/$zipName" -OutFile $zipPath
}

Invoke-WebRequest "$baseUrl/SHASUMS256.txt" -OutFile $shasumsPath

$expectedLine = Get-Content $shasumsPath | Where-Object { $_ -match "\s$([regex]::Escape($zipName))$" } | Select-Object -First 1
if (-not $expectedLine) {
  throw "Could not find $zipName in SHASUMS256.txt"
}

$expectedHash = ($expectedLine -split "\s+")[0].ToLowerInvariant()
$hashCommand = Get-Command Get-FileHash -ErrorAction SilentlyContinue
if ($hashCommand) {
  $actualHash = (Get-FileHash $zipPath -Algorithm SHA256).Hash.ToLowerInvariant()
} else {
  $certutilOutput = certutil -hashfile $zipPath SHA256
  if ($LASTEXITCODE -ne 0) {
    throw "certutil failed to hash $zipPath"
  }
  $actualHash = ($certutilOutput | Where-Object { $_ -match '^[0-9a-fA-F]{64}$' } | Select-Object -First 1).ToLowerInvariant()
}

if (-not $actualHash) {
  throw "Could not compute SHA256 for $zipPath"
}

if ($actualHash -ne $expectedHash) {
  Remove-Item $zipPath -Force
  throw "SHA256 mismatch for $zipName. Expected $expectedHash, got $actualHash"
}

if (Test-Path $extractDir) {
  Remove-Item $extractDir -Recurse -Force
}

Expand-Archive $zipPath -DestinationPath $cacheDir -Force
Copy-Item (Join-Path $extractDir "node.exe") $nodeExe -Force

Write-Host "Prepared $nodeExe from $zipName"
