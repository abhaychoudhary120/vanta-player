#requires -Version 5.1
[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $root

function Write-Step {
    param([string]$Message)
    Write-Host ""
    Write-Host "== $Message ==" -ForegroundColor Cyan
}

function Require-Command {
    param([string]$Name)

    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw "Required command '$Name' was not found on PATH."
    }
}

function Invoke-Checked {
    param(
        [string]$FilePath,
        [string[]]$Arguments = @()
    )

    & $FilePath @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "'$FilePath $($Arguments -join ' ')' failed with exit code $LASTEXITCODE."
    }
}

Write-Host "VANTA setup"
Write-Host "Project: $root"

Write-Step "Checking tools"
Require-Command "node"
Require-Command "npm"
Require-Command "cargo"
Require-Command "rustc"

$nodeVersion = (& node --version).Trim()
$npmVersion = (& npm --version).Trim()
$rustVersion = (& rustc --version).Trim()
$cargoVersion = (& cargo --version).Trim()

Write-Host "Node:  $nodeVersion"
Write-Host "npm:   $npmVersion"
Write-Host "Rust:  $rustVersion"
Write-Host "Cargo: $cargoVersion"

$nodeParts = $nodeVersion.TrimStart("v").Split(".")
$nodeMajor = [int]$nodeParts[0]
$nodeMinor = [int]$nodeParts[1]
$supportedNode = (
    ($nodeMajor -eq 20 -and $nodeMinor -ge 19) -or
    ($nodeMajor -eq 22 -and $nodeMinor -ge 12) -or
    ($nodeMajor -ge 23)
)

if (-not $supportedNode) {
    throw "Node 20.19+, 22.12+, or newer is required by Vite 8. Found $nodeVersion."
}

Write-Step "Checking native build prerequisites"
$vswhere = Join-Path ${env:ProgramFiles(x86)} "Microsoft Visual Studio\Installer\vswhere.exe"
$hasMsvc = $false

if (Test-Path -LiteralPath $vswhere) {
    $vcPaths = @(& $vswhere -latest -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath 2>$null)
    $hasMsvc = $vcPaths.Count -gt 0 -and -not [string]::IsNullOrWhiteSpace(($vcPaths -join ""))
}

if (-not $hasMsvc) {
    Write-Warning "MSVC C++ build tools were not detected. Cargo and Tauri builds require them."
    Write-Host @'
Install "Visual Studio 2022 Build Tools" with the "Desktop development with C++" workload,
including the MSVC v143 toolset and a Windows 10/11 SDK. Example (administrator terminal):

  winget install --id Microsoft.VisualStudio.2022.BuildTools --exact --override "--wait --passive --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended"

Restart the terminal after installation.
'@ -ForegroundColor Yellow
} else {
    Write-Host "MSVC C++ tools: detected"
}

$webViewKeys = @(
    "HKLM:\SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}",
    "HKCU:\SOFTWARE\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}"
)
$hasWebView2 = $false

foreach ($key in $webViewKeys) {
    try {
        $version = (Get-ItemProperty -LiteralPath $key -Name "pv" -ErrorAction Stop).pv
        if (-not [string]::IsNullOrWhiteSpace($version)) {
            $hasWebView2 = $true
            break
        }
    } catch {
        # Key is absent for this install scope.
    }
}

if ($hasWebView2) {
    Write-Host "WebView2 Runtime: detected"
} else {
    Write-Warning "WebView2 Runtime was not detected. Windows 11 includes it; Windows 10 may need the Evergreen Runtime."
}

Write-Step "Installing JavaScript dependencies"
if (Test-Path -LiteralPath "package-lock.json") {
    Invoke-Checked "npm" @("ci")
} else {
    Invoke-Checked "npm" @("install")
}

Write-Step "Setup complete"
Write-Host "Start the desktop app with: npm run app:dev"
Write-Host "Build the installer with:  npm run app:build"

if (-not $hasMsvc) {
    Write-Host "Resolve the MSVC warning above before running the desktop app or installer build."
}
