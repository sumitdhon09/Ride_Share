$ErrorActionPreference = "Stop"

$rootDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$frontendDir = Join-Path $rootDir "ridesharelive-frontend-main"
$backendDir = Join-Path $rootDir "ridesharelive-backend-main"
$logDir = Join-Path $rootDir ".logs"

New-Item -ItemType Directory -Force -Path $logDir | Out-Null

function Test-PortListening {
    param([int]$Port)

    return $null -ne (Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1)
}

function Wait-ForPort {
    param(
        [int]$Port,
        [int]$TimeoutSeconds
    )

    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    while ((Get-Date) -lt $deadline) {
        if (Test-PortListening -Port $Port) {
            return $true
        }
        Start-Sleep -Seconds 1
    }

    return $false
}

function Start-ServiceProcess {
    param(
        [string]$Name,
        [string]$WorkingDirectory,
        [string]$CommandLine,
        [string]$StdOutLog,
        [string]$StdErrLog
    )

    $process = Start-Process `
        -FilePath "cmd.exe" `
        -ArgumentList @("/c", $CommandLine) `
        -WorkingDirectory $WorkingDirectory `
        -RedirectStandardOutput $StdOutLog `
        -RedirectStandardError $StdErrLog `
        -PassThru

    Write-Host "$Name started (PID $($process.Id))."
    Write-Host "  stdout: $StdOutLog"
    Write-Host "  stderr: $StdErrLog"
}

$backendOutLog = Join-Path $logDir "backend.log"
$backendErrLog = Join-Path $logDir "backend.err.log"
$frontendOutLog = Join-Path $logDir "frontend.log"
$frontendErrLog = Join-Path $logDir "frontend.err.log"

$backendAlreadyRunning = Test-PortListening -Port 8080
$frontendAlreadyRunning = Test-PortListening -Port 5173

if ($backendAlreadyRunning) {
    Write-Host "Backend already listening on http://localhost:8080"
} else {
    Start-ServiceProcess `
        -Name "Backend" `
        -WorkingDirectory $backendDir `
        -CommandLine "powershell.exe -ExecutionPolicy Bypass -File .\\scripts\\run-local.ps1" `
        -StdOutLog $backendOutLog `
        -StdErrLog $backendErrLog
}

if ($frontendAlreadyRunning) {
    Write-Host "Frontend already listening on http://localhost:5173"
} else {
    Start-ServiceProcess `
        -Name "Frontend" `
        -WorkingDirectory $frontendDir `
        -CommandLine "npm.cmd run dev" `
        -StdOutLog $frontendOutLog `
        -StdErrLog $frontendErrLog
}

$backendReady = $backendAlreadyRunning -or (Wait-ForPort -Port 8080 -TimeoutSeconds 60)
$frontendReady = $frontendAlreadyRunning -or (Wait-ForPort -Port 5173 -TimeoutSeconds 30)

Write-Host ""
Write-Host "Status:"
Write-Host "  Backend : $(if ($backendReady) { 'ready at http://localhost:8080' } else { 'failed to start' })"
Write-Host "  Frontend: $(if ($frontendReady) { 'ready at http://localhost:5173' } else { 'failed to start' })"

if (-not $backendReady -or -not $frontendReady) {
    Write-Host ""
    Write-Host "Check logs in $logDir"
    exit 1
}
