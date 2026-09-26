# Focused R101y probes — settings cluster. Mirrors the R101y block in
# tools/probe-privileged-route-guards.ps1 so a full-harness run is not required
# to prove this slice. RED on exactly one expected test each.

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
    Write-Utf8 $full $mut

    $outRaw = & npx vitest run $SuiteFile -t $ExpectTest 2>&1 | Out-String
    $out = $outRaw
    $collapsed = ($out -replace '\s+', ' ')
    $failed = [regex]::Match($out, 'Tests\s+(\d+)\s+failed').Groups[1].Value
    $passed = [regex]::Match($out, '(\d+)\s+passed').Groups[1].Value
    if (-not $failed) { $failed = '0' }
    if (-not $passed) { $passed = '0' }

    # Reason: vitest -t is a regex; a name that matches multiple tests can report failed>1.
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

Write-Host "`n=== R101y probes ===`n"

$SETTINGS = 'apps/admin/app/api/settings/route.ts'
$TRADING_RISK = 'apps/admin/app/api/settings/trading-risk/route.ts'
$COMPANY = 'apps/admin/app/api/company-settings/route.ts'
$HERO = 'apps/admin/app/api/hero-settings/route.ts'
$MDB = 'apps/admin/app/api/mdb-cluster-settings/route.ts'
$KYC = 'apps/admin/app/api/kyc-settings/route.ts'

Invoke-Probe -Name 'settings currency unguarded' -File $SETTINGS -First `
  -Find '    const guard = await guardSection("currency");' `
  -Replace '    const g = 1; void g;' `
  -Find2 '    if (!guard.ok) return guard.response;' `
  -Replace2 '' `
  -ExpectTest 'every single-caller settings file names its calling-screen grant and no weaker helper'

Invoke-Probe -Name 'settings wrong section (settings instead of currency)' -File $SETTINGS `
  -Find 'guardSection("currency")' `
  -Replace 'guardSection("settings")' `
  -ExpectTest '/api/settings is currency, never the generic settings section'

Invoke-Probe -Name 'trading-risk wrong section' -File $TRADING_RISK `
  -Find 'guardSection("competitions")' `
  -Replace 'guardSection("currency")' `
  -ExpectTest 'every single-caller settings file names its calling-screen grant and no weaker helper'

Invoke-Probe -Name 'company-settings drops hero-page grant' -File $COMPANY `
  -Find 'guardAnySection(["company", "hero-page"])' `
  -Replace 'guardAnySection(["company"])' `
  -ExpectTest 'every dual-caller settings file uses guardAnySection with both calling-screen grants'

Invoke-Probe -Name 'hero-settings becomes guardSection only' -File $HERO -First `
  -Find '  const guard = await guardAnySection(["hero-page", "branding"]);' `
  -Replace '  const guard = await guardSection("hero-page");' `
  -ExpectTest 'every dual-caller settings file uses guardAnySection with both calling-screen grants'

Invoke-Probe -Name 'kyc-settings weaker helper' -File $KYC `
  -Find 'import { guardSection } from "@/lib/admin/section-route-guard";' `
  -Replace "import { guardSection } from `"@/lib/admin/section-route-guard`";`nimport { requireAdminAuth } from `"@/lib/admin/auth`";" `
  -Find2 '  if (!guard.ok) return guard.response;' `
  -Replace2 "  if (!guard.ok) return guard.response;`n  await requireAdminAuth();" `
  -ExpectTest 'every single-caller settings file names its calling-screen grant and no weaker helper'

Invoke-Probe -Name 'mdb-cluster-settings unguarded closed folder' -File $MDB -First `
  -Find '  const guard = await guardSection("mdb-cluster");' `
  -Replace '  const g = 1; void g;' `
  -Find2 '  if (!guard.ok) return guard.response;' `
  -Replace2 '' `
  -ExpectTest 'mdb-cluster-settings/route.ts: one guard and one refusal for every exported handler'

Invoke-Probe -Name 'mdb-cluster section missing from ADMIN_SECTIONS' -File 'apps/admin/database/models/admin-employee.model.ts' `
  -Find '"mdb-cluster",' `
  -Replace '// "mdb-cluster",' `
  -ExpectTest 'mdb-cluster is an ADMIN_SECTIONS value so the grant can be issued'

Invoke-Probe -Name 'settings inventory stays section-granted' -File $TRADING_RISK `
  -Find '    const guard = await guardSection("competitions");' `
  -Replace '    const g = 1; void g;' `
  -Find2 '    if (!guard.ok) return guard.response;' `
  -Replace2 '' `
  -SuiteFile '__tests__/admin/admin-route-auth-inventory.test.ts' `
  -ExpectTest 'no route under a closed folder is anything but section-granted'

Write-Host ''
Write-Host 'Helper debt after R101y: 67. Remaining helper-but-no-grant folders (gamemaster,' -ForegroundColor DarkGray
Write-Host 'customer-assignments, database, email-templates, ...).' -ForegroundColor DarkGray
Write-Host ''
Write-Host 'All R101y probes RED x1.' -ForegroundColor Green
