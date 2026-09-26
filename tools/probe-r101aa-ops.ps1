# Focused R101aa probes — ops/money/customer cluster. RED on exactly one expected test each.

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
    $outRaw = & npx vitest run $SuiteFile -t $ExpectTest 2>&1 | Out-String
    $out = $outRaw
    $failed = [regex]::Match($out, 'Tests\s+(\d+)\s+failed').Groups[1].Value
    $passed = [regex]::Match($out, '(\d+)\s+passed').Groups[1].Value
    if (-not $failed) { $failed = '0' }
    if (-not $passed) { $passed = '0' }

    $red = ($failed -eq '1')
    if ($red) {
      Write-Host "RED x1  $Name  ->  $ExpectTest" -ForegroundColor Green
    } else {
      Write-Host "FAIL    $Name  (failed=$failed passed=$passed)" -ForegroundColor Red
      Write-Host $outRaw
    }
  } finally {
    Write-Utf8 $full $orig
  }
  if (-not $red) { throw "Probe not red on exactly one: $Name" }
}

Write-Host "`n=== R101aa probes ===`n"

$ASSIGN = 'apps/admin/app/api/customer-assignments/route.ts'
$SETTINGS = 'apps/admin/app/api/customer-assignments/settings/route.ts'
$RECON = 'apps/admin/app/api/reconciliation/route.ts'
$TX = 'apps/admin/app/api/transactions/route.ts'
$BACKFILL = 'apps/admin/app/api/platform-financials/backfill/route.ts'
$LOCK = 'apps/admin/app/api/lockouts/route.ts'
$PAY = 'apps/admin/app/api/payment-providers/route.ts'
$INC = 'apps/admin/app/api/incidents/route.ts'

Invoke-Probe -Name 'assignments list drops users grant' -File $ASSIGN `
  -Find 'guardAnySection(["customer-assignment", "users"])' `
  -Replace 'guardAnySection(["customer-assignment"])' `
  -ExpectTest 'every dual-caller file uses guardAnySection with both calling-screen grants'

Invoke-Probe -Name 'assignments settings wrong section' -File $SETTINGS `
  -Find 'guardSection("customer-assignment")' `
  -Replace 'guardSection("users")' `
  -ExpectTest 'every single-caller file names its calling-screen grant and no weaker helper'

Invoke-Probe -Name 'reconciliation drops overview' -File $RECON `
  -Find 'guardAnySection(["financial", "overview"])' `
  -Replace 'guardAnySection(["financial"])' `
  -ExpectTest 'every dual-caller file uses guardAnySection with both calling-screen grants'

Invoke-Probe -Name 'transactions drops users' -File $TX `
  -Find 'guardAnySection(["financial", "users"])' `
  -Replace 'guardSection("financial")' `
  -ExpectTest 'every dual-caller file uses guardAnySection with both calling-screen grants'

Invoke-Probe -Name 'backfill restores jwtVerify' -File $BACKFILL `
  -Find 'import { guardSection } from "@/lib/admin/section-route-guard";' `
  -Replace "import { guardSection } from `"@/lib/admin/section-route-guard`";`nimport { jwtVerify } from `"jose`";" `
  -ExpectTest 'platform-financials/backfill no longer hand-verifies a JWT'

Invoke-Probe -Name 'lockouts wrong section' -File $LOCK `
  -Find 'guardSection("fraud")' `
  -Replace 'guardSection("users")' `
  -ExpectTest 'every single-caller file names its calling-screen grant and no weaker helper'

Invoke-Probe -Name 'payment-providers unguarded' -File $PAY -First `
  -Find '    const guard = await guardSection("payment-providers");' `
  -Replace '    const g = 1; void g;' `
  -Find2 '    if (!guard.ok) return guard.response;' `
  -Replace2 '' `
  -ExpectTest 'every single-caller file names its calling-screen grant and no weaker helper'

Invoke-Probe -Name 'incidents weaker helper' -File $INC `
  -Find 'import { guardSection } from "@/lib/admin/section-route-guard";' `
  -Replace "import { guardSection } from `"@/lib/admin/section-route-guard`";`nimport { requireAdminAuth } from `"@/lib/admin/auth`";" `
  -Find2 '  if (!guard.ok) return guard.response;' `
  -Replace2 "  if (!guard.ok) return guard.response;`n  await requireAdminAuth();" `
  -ExpectTest 'every single-caller file names its calling-screen grant and no weaker helper'

Invoke-Probe -Name 'closed folder leak (inventory)' -File 'apps/admin/app/api/payment-providers/regenerate-env/route.ts' -First `
  -Find '    const guard = await guardSection("payment-providers");' `
  -Replace '    const g = 1; void g;' `
  -Find2 '    if (!guard.ok) return guard.response;' `
  -Replace2 '' `
  -SuiteFile '__tests__/admin/admin-route-auth-inventory.test.ts' `
  -ExpectTest 'no route under a closed folder is anything but section-granted'

Write-Host "`nAll R101aa probes RED x1`n"
