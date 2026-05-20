# Build Screen Time Control Windows agent with PyInstaller
param(
    [string]$Version = "0.1.0"
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$AgentRoot = Join-Path $Root "apps" "windows-agent"
Set-Location $AgentRoot

Write-Host "Installing dependencies via Poetry..."
poetry install --no-interaction

$Dist = Join-Path $AgentRoot "dist"
New-Item -ItemType Directory -Force -Path $Dist | Out-Null

$Entry = Join-Path $AgentRoot "src" "screen_time_agent" "__main__.py"
$OutName = "ScreenTimeControl-$Version"

Write-Host "Running PyInstaller..."
poetry run pyinstaller `
    --onefile `
    --name $OutName `
    --paths (Join-Path $AgentRoot "src") `
    --hidden-import win32timezone `
    --hidden-import win32serviceutil `
    --hidden-import win32service `
    --hidden-import servicemanager `
    --collect-all firebase_admin `
    $Entry

Write-Host "Build complete: $Dist\$OutName.exe"
Write-Host "Sign placeholder: signtool sign /fd SHA256 ... (configure cert in CI)"
