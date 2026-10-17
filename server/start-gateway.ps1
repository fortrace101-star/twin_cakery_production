$ErrorActionPreference = "Stop"
if (-not (Get-Command npm -CommandType Application -ErrorAction SilentlyContinue)) { Write-Host "npm missing" -ForegroundColor Red; exit 1 }
$npm = Get-Command npm -CommandType Application
Start-Process -FilePath $npm.Source -ArgumentList "run dev" -WorkingDirectory "C:\Users\manue\Desktop\twin_cakery\erp\server" -NoNewWindow
Start-Sleep 14
try {
  Invoke-WebRequest -Uri "http://127.0.0.1:4000/api/v1/payments" -TimeoutSec 8 | Out-File -FilePath "C:\Users\manue\Desktop\twin_cakery\erp\server\gateway-check.log" -Append
  Write-Host "GATEWAY-UP" -ForegroundColor Green
} catch {
  Write-Host "GATEWAY-DOWN $($_.Exception.Message)" -ForegroundColor Yellow
}