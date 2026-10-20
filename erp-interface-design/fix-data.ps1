$lines = Get-Content 'src/components/erp/data.ts'
$result = @()
foreach($l in $lines) {
  if($l -notmatch 'import type') {
    $result += $l
  }
}
$result | Set-Content 'src/components/erp/data.ts' -Force