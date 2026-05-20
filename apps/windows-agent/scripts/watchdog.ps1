# Lightweight watchdog — run at logon + hourly via Scheduled Task
$ServiceName = "ScreenTimeControlAgent"
$svc = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
if ($null -eq $svc) {
    Write-Host "Service $ServiceName not installed."
    exit 1
}
if ($svc.Status -ne "Running") {
    Write-Host "Starting $ServiceName..."
    Start-Service -Name $ServiceName
}
