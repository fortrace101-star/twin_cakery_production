$ErrorActionPreference = 'Stop'
$root = 'C:\Users\manue\Desktop\twin_cakery\erp'
$front = Join-Path $root 'erp-interface-design'
$tsx = Join-Path $front 'node_modules\.bin\tsx.cmd'
$psql = 'C:\pgsql\bin\psql.exe'
$base = 'http://localhost:4317'
$env:PORT = '4317'
$env:NODE_ENV = 'development'
$env:DATABASE_URL = 'postgres://postgres:90210@localhost:5432/twin_cakery'
$env:PGPASSWORD = '90210'

function Stop-Api {
  $conns = Get-NetTCPConnection -LocalPort 4317 -State Listen -ErrorAction SilentlyContinue
  foreach ($c in $conns) { Stop-Process -Id $c.OwningProcess -Force -ErrorAction SilentlyContinue }
  Start-Sleep -Milliseconds 900
}

function Start-Api {
  $p = Start-Process -FilePath $tsx -ArgumentList '--tsconfig', '../server/tsconfig.json', '../server/index.ts' `
    -WorkingDirectory $front -RedirectStandardOutput (Join-Path $root 'server\_d06.out.log') `
    -RedirectStandardError (Join-Path $root 'server\_d06.err.log') -PassThru -WindowStyle Hidden
  for ($i = 0; $i -lt 40; $i++) {
    Start-Sleep -Milliseconds 500
    try { $h = Invoke-RestMethod -Uri "$base/health" -TimeoutSec 2; if ($h.status -eq 'ok') { return $true } } catch {}
  }
  Write-Output '---BOOT FAILED: OUT---'; Get-Content (Join-Path $root 'server\_d06.out.log') -ErrorAction SilentlyContinue
  Write-Output '---BOOT FAILED: ERR---'; Get-Content (Join-Path $root 'server\_d06.err.log') -ErrorAction SilentlyContinue
  return $false
}

function Db1([string]$sql) {
  return (& $psql -h localhost -U postgres -d twin_cakery -w -At -c $sql 2>$null) -join ''
}

Stop-Api
if (-not (Start-Api)) { exit 1 }
Write-Output 'HEALTH_OK=true'

# 1) login -> JWT
$login = Invoke-RestMethod -Method Post -Uri "$base/api/v1/auth/login" -ContentType 'application/json' `
  -Body (@{ username = 'manager'; password = 'TwinCakery123!' } | ConvertTo-Json)
$H = @{ Authorization = "Bearer $($login.token)" }
Write-Output "LOGIN_OK=$([bool]$login.token)"

# 2) baselines
$apiBefore = (Invoke-RestMethod -Uri "$base/api/v1/orders" -Headers $H).Count
$dbBefore = [int](Db1 'SELECT count(*) FROM orders;')
Write-Output "ORDERS_BEFORE api=$apiBefore db=$dbBefore"

# 3) create an order through the same API the UI calls
$cust = (Invoke-RestMethod -Uri "$base/api/v1/customers" -Headers $H) | Select-Object -First 1
$num = "TC-D06-$([int](Get-Random -Minimum 100000 -Maximum 999999))"
$body = @{
  orderNumber = $num; customerId = $cust.id; salespersonId = $null
  items = @(@{ productId = 'prod-1'; variantOptions = '1 kg - D06 gate'; quantity = 1; unitPrice = 4500; total = 4500; recipeVersion = 'v1.2' })
  subtotal = 4500; discount = 0; deliveryCharge = 0; taxAmount = 0; total = 4500
  requiredAt = '2026-10-20 12:00'; notes = 'D06 gate persistence test'; status = 'CONFIRMED'
  paymentStatus = 'UNPAID'; deliveryStatus = 'PENDING'; quotationId = $null; inquiryId = $null; createdBy = 'usr-manager'
} | ConvertTo-Json -Depth 6
$created = Invoke-RestMethod -Method Post -Uri "$base/api/v1/orders" -Headers $H -ContentType 'application/json' -Body $body
Write-Output "CREATED_ID=$($created.id) NUM=$($created.orderNumber)"

# 4) D-06 core assertion: the row must ALREADY be in Postgres the instant 201 returns (no sleep)
$immediate = Db1 "SELECT id || '|' || order_number || '|' || status || '|' || total FROM orders WHERE id = '$($created.id)';"
Write-Output "DB_IMMEDIATELY_AFTER_201=$immediate"
$items = Db1 "SELECT count(*) FROM order_items WHERE order_id = '$($created.id)';"
$hist = Db1 "SELECT count(*) FROM order_status_history WHERE order_id = '$($created.id)';"
Write-Output "CHILDREN items=$items hist=$hist"

# 5) "refresh": restart the API so the cache is rebuilt from Postgres, then refetch
Stop-Api
if (-not (Start-Api)) { exit 1 }
$login2 = Invoke-RestMethod -Method Post -Uri "$base/api/v1/auth/login" -ContentType 'application/json' `
  -Body (@{ username = 'manager'; password = 'TwinCakery123!' } | ConvertTo-Json)
$H2 = @{ Authorization = "Bearer $($login2.token)" }
$after = Invoke-RestMethod -Uri "$base/api/v1/orders" -Headers $H2
$found = $after | Where-Object { $_.id -eq $created.id }
Write-Output "AFTER_RESTART api=$($after.Count) persisted=$([bool]$found)"

# 6) cleanup: stop API first so no write-back can resurrect the row, then delete
Stop-Api
& $psql -h localhost -U postgres -d twin_cakery -w -c "DELETE FROM order_items WHERE order_id = '$($created.id)'; DELETE FROM order_status_history WHERE order_id = '$($created.id)'; DELETE FROM orders WHERE id = '$($created.id)';" | Out-Null
$dbAfter = [int](Db1 'SELECT count(*) FROM orders;')
Write-Output "ORDERS_AFTER_CLEANUP db=$dbAfter (baseline $dbBefore)"

$pass = ($immediate -like "$($created.id)*") -and ($items -eq '1') -and ($hist -eq '1') -and [bool]$found -and ($dbAfter -eq $dbBefore)
Write-Output "GATE_RESULT=$(if ($pass) {'PASS'} else {'FAIL'})"
exit $(if ($pass) { 0 } else { 1 })
