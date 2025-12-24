# Starts two Vite dev servers in parallel on ports 5173 and 5174

param(
  [int]$PortA = 5173,
  [int]$PortB = 5174
)

$root = $PSScriptRoot

# Start both servers as background jobs
try {
  Write-Host "[start-frontend-both] Starting server A on port $PortA (background)..."
  Start-Job -ScriptBlock {
    param($pRoot, $pPort)
    & "$pRoot\start-frontend.ps1" -Port $pPort
  } -ArgumentList $root, $PortA | Out-Null

  Write-Host "[start-frontend-both] Starting server B on port $PortB (background)..."
  Start-Job -ScriptBlock {
    param($pRoot, $pPort)
    & "$pRoot\start-frontend.ps1" -Port $pPort
  } -ArgumentList $root, $PortB | Out-Null

  Write-Host "[start-frontend-both] Both jobs started. Use Get-Job to inspect outputs."
}
catch {
  Write-Warning "[start-frontend-both] Failed to start jobs: $($_.Exception.Message)"
}
