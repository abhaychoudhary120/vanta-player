#requires -Version 5.1
[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $root

if (-not (Test-Path -LiteralPath "node_modules")) {
    throw "Dependencies are not installed. Run 'npm run setup' first."
}

if ([string]::IsNullOrWhiteSpace($env:TAURI_SIGNING_PRIVATE_KEY)) {
    $keyPath = $env:TAURI_SIGNING_PRIVATE_KEY_PATH

    if ([string]::IsNullOrWhiteSpace($keyPath)) {
        $keyPath = Join-Path $HOME ".tauri\vanta.key"
    }

    if (-not (Test-Path -LiteralPath $keyPath)) {
        throw "Updater signing key not found at $keyPath. Set TAURI_SIGNING_PRIVATE_KEY or TAURI_SIGNING_PRIVATE_KEY_PATH before building."
    }

    $env:TAURI_SIGNING_PRIVATE_KEY = (Get-Content -LiteralPath $keyPath -Raw).Trim()
    Write-Host "Using updater signing key: $keyPath" -ForegroundColor DarkGray
}

Write-Host "Building VANTA and the NSIS installer..." -ForegroundColor Cyan
& npm run tauri:build
if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
}

$bundleDirectory = Join-Path $root "src-tauri\target\release\bundle\nsis"
if (Test-Path -LiteralPath $bundleDirectory) {
    $installer = Get-ChildItem -LiteralPath $bundleDirectory -Filter "*.exe" |
        Sort-Object LastWriteTime -Descending |
        Select-Object -First 1

    if ($null -ne $installer) {
        Write-Host ""
        Write-Host "Installer: $($installer.FullName)" -ForegroundColor Green

        $signature = "$($installer.FullName).sig"
        if (Test-Path -LiteralPath $signature) {
            Write-Host "Signature: $signature" -ForegroundColor Green
        }
    }
}

Write-Host "Build complete." -ForegroundColor Green
