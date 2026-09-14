# NAFOJ: build a working FerretDB v1.24.2 binary (Windows / PowerShell).
# `go install` alone produces a binary that panics on start because the
# embedded build/version/version.txt is not generated for module installs,
# so we clone the tagged source, write the version file, and build from it.
param(
    [string]$Version = 'v1.24.2',
    [string]$OutDir = "$env:USERPROFILE\.hydro\bin"
)
$ErrorActionPreference = 'Stop'
$src = Join-Path $env:TEMP "ferretdb-src-$Version"
if (Test-Path $src) { Remove-Item -Recurse -Force $src }
git clone --depth 1 --branch $Version https://github.com/FerretDB/FerretDB.git $src
if ($LASTEXITCODE -ne 0) { throw 'git clone failed' }
Set-Content -Path (Join-Path $src 'build/version/version.txt') -Value $Version -NoNewline
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
Push-Location $src
go build -trimpath -o (Join-Path $OutDir 'ferretdb.exe') ./cmd/ferretdb
Pop-Location
if ($LASTEXITCODE -ne 0) { throw 'go build failed' }
& (Join-Path $OutDir 'ferretdb.exe') --version
Write-Host "FerretDB installed to $OutDir\ferretdb.exe"
