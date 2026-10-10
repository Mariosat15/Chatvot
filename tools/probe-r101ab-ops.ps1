# Focused R101ab probes — money leftovers / ops health / employee self.
# RED on exactly one expected test each.

$ErrorActionPreference = 'Continue'
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

function Read-Utf8([string]$Path) {
  [System.IO.File]::ReadAllText((Resolve-Path -LiteralPath $Path), [System.Text.UTF8Encoding]::new($false))
}
function Write-Utf8([string]$Path, [string]$Text) {
  [System.IO.File]::WriteAllText((Resolve-Path -LiteralPath $Path), $Text, [System.Text.UTF8Encoding]::new($false))
}

function Invoke-Probe {
  param(
    [string]$Name,
    [string]$File,
    [string]$Find,
    [string]$Replace,
    [string]$Find2 = $null,
    [string]$Replace2 = $null,
    [switch]$First,
    [string]$SuiteFile = '__tests__/admin/privileged-route-guards.test.ts',
    [string]$ExpectTest
  )

  $full = Join-Path $Root $File
  $orig = Read-Utf8 $full
  if ([string]::IsNullOrEmpty($orig)) { throw "PROBE DID NOT APPLY (empty read): $File" }

  $mut = if ($First) {
    $idx = $orig.IndexOf($Find)
    if ($idx -lt 0) { throw "PROBE DID NOT APPLY (Find miss): $Name / $Find" }
    $orig.Remove($idx, $Find.Length).Insert($idx, $Replace)
  } else {
    if (-not $orig.Contains($Find)) { throw "PROBE DID NOT APPLY (Find miss): $Name / $Find" }
    $orig.Replace($Find, $Replace)
  }
  if ($Find2) {
    if (-not $mut.Contains($Find2)) { throw "PROBE DID NOT APPLY (Find2 miss): $Name" }
    $mut = $mut.Replace($Find2, $Replace2)
  }
  if ($mut -eq $orig) { throw "PROBE DID NOT APPLY (no change): $Name" }
  Write-Utf8 $full $mut

  try {
    $filter = if ($ExpectTest) { $ExpectTest } else { 'R101ab' }
    $out = npx vitest run $SuiteFile -t $filter 2>&1 | Out-String
    $flat = ($out -replace '\s+', ' ')
    $failed = [regex]::Match($out, 'Tests\s+(\d+)\s+failed').Groups[1].Value
    $passed = [regex]::Match($out, '(\d+)\s+passed').Groups[1].Value
    if ($failed -eq '1') {
      Write-Host "RED x1  $Name"
    } else {
      Write-Host "FAIL    $Name  failed=$failed passed=$passed"
      if ($flat -match $ExpectTest) { Write-Host "  (expect name present in output)" }
      else { Write-Host "  OTHER/missing expect: $ExpectTest" }
    }
  } finally {
    Write-Utf8 $full $orig
  }
}

$PAY = 'apps/admin/app/api/pending-payments/route.ts'
$ALERT = 'apps/admin/app/api/security/alerts/route.ts'
$HEALTH = 'apps/admin/app/api/health-overview/route.ts'
$PROF = 'apps/admin/app/api/employee/profile/password/route.ts'
$NOTIF = 'apps/admin/app/api/notifications/route.ts'
$KYC = 'apps/admin/app/api/kyc-history/route.ts'
$PRICE = 'apps/admin/app/api/price-health/route.ts'
$LIVE = 'apps/admin/app/api/live-ops/route.ts'

Invoke-Probe -Name 'pending-payments wrong section' -File $PAY `
  -Find 'guardSection("payments")' -Replace 'guardSection("overview")' -First `
  -ExpectTest 'every single-caller file names its calling-screen grant'

Invoke-Probe -Name 'pending-payments unguarded' -File $PAY `
  -Find '    const guard = await guardSection("payments");' -Replace '    const g = 1; void g;' -First `
  -Find2 '    if (!guard.ok) return guard.response;' -Replace2 '' `
  -ExpectTest 'pending-payments/route.ts: one guard and one refusal'

Invoke-Probe -Name 'security/alerts drops fraud half' -File $ALERT `
  -Find 'guardAnySection(["overview", "fraud"])' -Replace 'guardAnySection(["overview"])' `
  -ExpectTest 'security/alerts uses guardAnySection with overview and fraud'

Invoke-Probe -Name 'security/alerts wrong to section' -File $ALERT `
  -Find 'guardAnySection(["overview", "fraud"])' -Replace 'guardSection("overview")' `
  -ExpectTest 'security/alerts uses guardAnySection with overview and fraud'

Invoke-Probe -Name 'health-overview unguarded' -File $HEALTH `
  -Find '    const guard = await guardSection("overview");' -Replace '    const g = 1; void g;' -First `
  -Find2 '    if (!guard.ok) return guard.response;' -Replace2 '' `
  -ExpectTest 'health-overview/route.ts: one guard and one refusal'

Invoke-Probe -Name 'employee password wrong section' -File $PROF `
  -Find 'guardSection("profile")' -Replace 'guardSection("employees")' -First `
  -ExpectTest 'every single-caller file names its calling-screen grant'

Invoke-Probe -Name 'notifications weaker helper restored' -File $NOTIF `
  -Find 'const guard = await guardSection("notifications");' -Replace 'await requireAdminAuth(); const guard = { ok: true as const, admin: { id: "x", email: "x" } };' -First `
  -ExpectTest 'every single-caller file names its calling-screen grant'

Invoke-Probe -Name 'kyc-history wrong section' -File $KYC `
  -Find 'guardSection("kyc-history")' -Replace 'guardSection("kyc-settings")' -First `
  -ExpectTest 'every single-caller file names its calling-screen grant'

Invoke-Probe -Name 'price-health unguard GET only' -File $PRICE `
  -Find '    const guard = await guardSection("price-health");' -Replace '    const g = 1; void g;' -First `
  -Find2 '    if (!guard.ok) return guard.response;' -Replace2 '' `
  -ExpectTest 'price-health/route.ts: one guard and one refusal'

Invoke-Probe -Name 'live-ops wrong section' -File $LIVE `
  -Find 'guardSection("overview")' -Replace 'guardSection("incidents")' -First `
  -ExpectTest 'every single-caller file names its calling-screen grant'

Invoke-Probe -Name 'closed folder leak (inventory)' -File $HEALTH `
  -Find '    const guard = await guardSection("overview");' -Replace '    const g = 1; void g;' -First `
  -Find2 '    if (!guard.ok) return guard.response;' -Replace2 '' `
  -SuiteFile '__tests__/admin/admin-route-auth-inventory.test.ts' `
  -ExpectTest 'no route under a closed folder'
