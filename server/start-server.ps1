$ErrorActionPreference = "Stop"
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
  Write-Host "npm not found on PATH" -ForegroundColor Red
  exit 1
}
$p = Start-Process -FilePath npm -ArgumentList @("run", "dev") -WorkingDirectory "C:\Users\manue\Desktop\twin_cakery\erp\server" -NoNewWindow -PassThru
Write-Host "server pid: $($p.Id)" -ForegroundColor Gray
Start-Sleep 12
try {
  $r = Invoke-WebRequest -Uri "http://127.0.0.1:4000/api/v1/payments" -TimeoutSec 8
  Write-Host "PAYMENTS ENDPOINT STATUS: $($r.StatusCode)" -ForegroundColor Green
} catch {
  Write-Host "PAYMENTS ENDPOINT: $($_.Exception.Message)" -ForegroundColor Yellow
}
