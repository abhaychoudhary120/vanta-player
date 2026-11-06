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

Write-Host "Starting VANTA in development mode..." -ForegroundColor Cyan
& npm run tauri:dev
exit $LASTEXITCODE
