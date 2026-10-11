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
    -WorkingDirectory $front -RedirectStandardOutput (Join-Path $root '_e1_gate.out.log') `
    -RedirectStandardError (Join-Path $root '_e1_gate.err.log') -PassThru -WindowStyle Hidden
  for ($i = 0; $i -lt 40; $i++) {
    Start-Sleep -Milliseconds 500
    try { $h = Invoke-RestMethod -Uri "$base/health" -TimeoutSec 2; if ($h.status -eq 'ok') { return $true } } catch {}
  }
  Write-Output '---BOOT FAILED: OUT---'; Get-Content (Join-Path $root '_e1_gate.out.log') -ErrorAction SilentlyContinue
  Write-Output '---BOOT FAILED: ERR---'; Get-Content (Join-Path $root '_e1_gate.err.log') -ErrorAction SilentlyContinue
  return $false
}

function Db1([string]$sql) {
  return (& $psql -h localhost -U postgres -d twin_cakery -w -At -c $sql 2>$null) -join ''
}

# PS 5.1 quirk: Invoke-RestMethod returns JSON arrays nested one level; flatten.
function Arr($v) {
  if ($null -eq $v) { return ,@() }
  return @($v | ForEach-Object { $_ })
}

Stop-Api
if (-not (Start-Api)) { exit 1 }
Write-Output 'HEALTH_OK=true'

$login = Invoke-RestMethod -Method Post -Uri "$base/api/v1/auth/login" -ContentType 'application/json' `
  -Body (@{ username = 'manager'; password = 'TwinCakery123!' } | ConvertTo-Json)
$H = @{ Authorization = "Bearer $($login.token)" }
Write-Output "LOGIN_OK=$([bool]$login.token)"
try {

$custId = Db1 'SELECT customer_id FROM orders LIMIT 1;'
$dbBefore = [int](Db1 'SELECT count(*) FROM orders;')
Write-Output "CUSTOMER=$custId ORDERS_BEFORE=$dbBefore"

# 1) order history + print
$hist = Arr (Invoke-RestMethod -Uri "$base/api/v1/customers/$custId/orders" -Headers $H)
Write-Output "HISTORY count=$($hist.Count) first=$($hist[0].id) hasSnapshotKey=$($null -ne ($hist[0] | Get-Member -Name snapshot -ErrorAction SilentlyContinue))"
$print = Invoke-RestMethod -Uri "$base/api/v1/customers/$custId/order-history/print" -Headers $H
Write-Output "PRINT count=$($print.orders.Count) printedAt=$([bool]$print.printedAt)"

# 2) create order via API -> snapshot must exist the instant 201 returns (rule 27)
$num = "TC-E1-$([int](Get-Random -Minimum 100000 -Maximum 999999))"
$body = @{
  orderNumber = $num; customerId = $custId; salespersonId = $null
  items = @(@{ productId = 'prod-1'; variantOptions = '1 kg - E1 gate'; quantity = 1; unitPrice = 5000; total = 5000; recipeVersion = 'v1.2' })
  subtotal = 5000; discount = 0; deliveryCharge = 0; taxAmount = 0; total = 5000
  requiredAt = '2026-10-20 12:00'; notes = 'E1 gate snapshot test'; status = 'CONFIRMED'
  paymentStatus = 'UNPAID'; deliveryStatus = 'PENDING'; quotationId = $null; inquiryId = $null; createdBy = 'usr-manager'
} | ConvertTo-Json -Depth 6
$created = Invoke-RestMethod -Method Post -Uri "$base/api/v1/orders" -Headers $H -ContentType 'application/json' -Body $body
Write-Output "CREATED_ID=$($created.id)"
$snapCount = Db1 "SELECT count(*) FROM order_customer_snapshots WHERE order_id = '$($created.id)';"
$snapPhone = Db1 "SELECT snapshot_phone FROM order_customer_snapshots WHERE order_id = '$($created.id)';"
Write-Output "SNAPSHOT rows=$snapCount phone=$snapPhone"


# 3) history now shows the new order first WITH its snapshot
$hist2 = Arr (Invoke-RestMethod -Uri "$base/api/v1/customers/$custId/orders" -Headers $H)
$newFirst = $hist2[0].id -eq $created.id
Write-Output "NEW_FIRST=$newFirst SNAP_NON_NULL=$($null -ne $hist2[0].snapshot)"

# 4) snapshot immutability: edit the profile, snapshot must not follow (rule 27)
$cust = Invoke-RestMethod -Uri "$base/api/v1/customers/$custId" -Headers $H
$origPhone = $cust.phone
[void](Invoke-RestMethod -Method Patch -Uri "$base/api/v1/customers/$custId" -Headers $H -ContentType 'application/json' -Body (@{ phone = '0700 999 888' } | ConvertTo-Json))
$hist3 = Arr (Invoke-RestMethod -Uri "$base/api/v1/customers/$custId/orders" -Headers $H)
$snapAfter = ($hist3 | Where-Object { $_.id -eq $created.id })[0].snapshot.snapshotPhone
$immutable = $snapAfter -eq $origPhone
Write-Output "SNAPSHOT_IMMUTABLE=$immutable (orig=$origPhone afterEdit=$snapAfter)"
[void](Invoke-RestMethod -Method Patch -Uri "$base/api/v1/customers/$custId" -Headers $H -ContentType 'application/json' -Body (@{ phone = $origPhone } | ConvertTo-Json))

# 4b) Repeat Order (spec §5, rule 28): template copy, original never mutated
$origId = $hist[0].id
$origJson = Invoke-RestMethod -Uri "$base/api/v1/orders/$origId" -Headers $H | ConvertTo-Json -Depth 6
$repeatBody = @{
  requiredAt = '2026-11-15 10:00'
  notes = 'Repeat gate: nuts allergy, blue icing'
  deliveryCharge = 2000
  discount = 0
  taxAmount = 0
  items = @(@{ productId = 'prod-1'; variantOptions = '2 kg - repeat gate'; quantity = 2; unitPrice = 6000; total = 12000; recipeVersion = 'v1.2' })
} | ConvertTo-Json -Depth 6
$repeat = Invoke-RestMethod -Method Post -Uri "$base/api/v1/orders/$origId/repeat" -Headers $H -ContentType 'application/json' -Body $repeatBody
$ro = $repeat.order
Write-Output "REPEAT id=$($ro.id) status=$($ro.status) from=$($repeat.repeatedFrom) total=$($ro.total) items=$($ro.items.Count) createdBy=$($ro.createdBy)"
$origAfter = Invoke-RestMethod -Uri "$base/api/v1/orders/$origId" -Headers $H | ConvertTo-Json -Depth 6
Write-Output "ORIGINAL_UNCHANGED=$($origAfter -eq $origJson)"
$rsnap = Db1 "SELECT count(*) FROM order_customer_snapshots WHERE order_id = '$($ro.id)';"
$rhist = Db1 "SELECT count(*) FROM order_status_history WHERE order_id = '$($ro.id)';"
Write-Output "REPEAT_DB snapshot=$rsnap hist=$rhist"
$roImmut = ($ro.status -eq 'AWAITING_CONFIRMATION') -and ($ro.total -eq 14000) -and ($ro.items.Count -eq 1) -and ($repeat.repeatedFrom -eq $origId) -and ($ro.createdBy -eq 'usr-manager')
Write-Output "REPEAT_FIELDS_OK=$roImmut"
# eligibility: a cancelled order is not a valid template (409)
Invoke-RestMethod -Method Post -Uri "$base/api/v1/orders/$($ro.id)/cancel" -Headers $H -ContentType 'application/json' -Body (@{ reason = 'E1 gate eligibility check' } | ConvertTo-Json) | Out-Null
$repeat409 = $false
try { Invoke-RestMethod -Method Post -Uri "$base/api/v1/orders/$($ro.id)/repeat" -Headers $H -ContentType 'application/json' -Body '{}' | Out-Null } catch { $repeat409 = ($_.Exception.Response.StatusCode.value__ -eq 409) }
Write-Output "REPEAT_CANCELLED_409=$repeat409"

# 5) occasion -> recurring reminder scheduled automatically
$ev = Invoke-RestMethod -Method Post -Uri "$base/api/v1/customers/$custId/events" -Headers $H -ContentType 'application/json' `
  -Body (@{ eventType = 'birthday'; eventDate = '1992-04-10'; recurrenceRule = 'ANNUAL'; notes = 'E1 gate event' } | ConvertTo-Json)
Write-Output "EVENT_ID=$($ev.id)"
$reminders = Arr (Invoke-RestMethod -Uri "$base/api/v1/customer-reminders?days=365" -Headers $H)
$myRem = @($reminders | Where-Object { $_.eventId -eq $ev.id })
Write-Output "REMINDER_SCHEDULED=$($myRem.Count -eq 1) forDate=$($myRem[0].reminderForDate) status=$($myRem[0].status) custName=$($myRem[0].customerName)"

# 6) staff contacts -> outcome recorded + rolled to next occurrence (never auto)
$contacted = Invoke-RestMethod -Method Patch -Uri "$base/api/v1/customer-reminders/$($myRem[0].id)/contacted" -Headers $H -ContentType 'application/json' `
  -Body (@{ outcome = 'Called; planning a 1kg cake'; followUpNotes = 'Call again in March' } | ConvertTo-Json)
Write-Output "CONTACTED status=$($contacted.status) by=$($contacted.contactedBy) lastAt=$([bool]$contacted.lastContactedAt)"
$reminders2 = Arr (Invoke-RestMethod -Uri "$base/api/v1/customer-reminders?days=365" -Headers $H)
$rolled = @($reminders2 | Where-Object { $_.eventId -eq $ev.id -and $_.status -eq 'PENDING' })
Write-Output "ROLLED=$($rolled.Count -eq 1) nextForDate=$($rolled[0].reminderForDate)"

# 7) dismiss the rolled occurrence, then remove the event
$dismissed = Invoke-RestMethod -Method Patch -Uri "$base/api/v1/customer-reminders/$($rolled[0].id)/dismiss" -Headers $H -ContentType 'application/json' -Body '{}'
Write-Output "DISMISSED status=$($dismissed.status)"
$delOk = $true
try { Invoke-RestMethod -Method Delete -Uri "$base/api/v1/customers/$custId/events/$($ev.id)" -Headers $H | Out-Null } catch { $delOk = $false }
Write-Output "EVENT_DELETED=$delOk"
$evLeft = Db1 "SELECT count(*) FROM customer_events WHERE id = '$($ev.id)';"
$remLeft = Db1 "SELECT count(*) FROM customer_event_reminders WHERE event_id = '$($ev.id)';"
Write-Output "DB_AFTER_DELETE events=$evLeft reminders=$remLeft"

# 8) cleanup order test data (stop API first so no write-back resurrects rows)
Stop-Api
& $psql -h localhost -U postgres -d twin_cakery -w -c "DELETE FROM order_items WHERE order_id IN ('$($created.id)', '$($ro.id)'); DELETE FROM order_status_history WHERE order_id IN ('$($created.id)', '$($ro.id)'); DELETE FROM order_customer_snapshots WHERE order_id IN ('$($created.id)', '$($ro.id)'); DELETE FROM orders WHERE id IN ('$($created.id)', '$($ro.id)');" | Out-Null
$dbAfter = [int](Db1 'SELECT count(*) FROM orders;')
$phoneAfter = Db1 "SELECT phone FROM customers WHERE id = '$custId';"
Write-Output "ORDERS_AFTER=$dbAfter (baseline $dbBefore) PHONE_RESTORED=$($phoneAfter -eq $origPhone)"

$pass = ($snapCount -eq '1') -and $newFirst -and $immutable -and $roImmut -and ($rsnap -eq '1') -and ($rhist -eq '1') -and $repeat409 -and ($origAfter -eq $origJson) -and `
  ($myRem.Count -eq 1) -and `
  ($contacted.status -eq 'CONTACTED') -and ($rolled.Count -eq 1) -and ($dismissed.status -eq 'DISMISSED') -and `
  ($evLeft -eq '0') -and ($remLeft -eq '0') -and ($dbAfter -eq $dbBefore) -and ($phoneAfter -eq $origPhone)
Write-Output "GATE_RESULT=$(if ($pass) {'PASS'} else {'FAIL'})"
exit $(if ($pass) { 0 } else { 1 })
} catch {
  Write-Output "ERR=$($_.Exception.Message)"
  Stop-Api
  exit 1
}
