# Focused R101ad probes — fix-purchases section grant + empty helper debt.
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
    $filter = if ($ExpectTest) { $ExpectTest } else { 'R101ad' }
    $out = npx vitest run $SuiteFile -t $filter 2>&1 | Out-String
    $failed = [regex]::Match($out, 'Tests\s+(\d+)\s+failed').Groups[1].Value
    $passed = [regex]::Match($out, '(\d+)\s+passed').Groups[1].Value
    if ($failed -eq '1') {
      Write-Host "RED x1  $Name"
    } else {
      Write-Host "FAIL    $Name  failed=$failed passed=$passed"
      Write-Host "  expect: $ExpectTest"
      $lines = ($out -split "`n") | Where-Object { $_ -match 'FAIL|AssertionError|expected|×' } | Select-Object -First 8
      foreach ($l in $lines) { Write-Host "  $l" }
    }
  } finally {
    Write-Utf8 $full $orig
  }
}

$FIX = 'apps/admin/app/api/gamemaster/fix-purchases/route.ts'
$INV = 'tools/admin-routes/auth-inventory.ts'
$GRANT = 'fix-purchases names the gamemaster-management grant before any write'
$SUPER = 'keeps the super_admin write gate after the section grant'
$DEBT = 'finds no route in the helper-but-no-grant debt class'
$CARVE = 'names exactly eight intentional leftovers and never fix-purchases'

Invoke-Probe -Name 'fix-purchases wrong section' -File $FIX `
  -Find 'guardSection("gamemaster-management")' -Replace 'guardSection("overview")' -First `
  -ExpectTest $GRANT

Invoke-Probe -Name 'fix-purchases unguarded' -File $FIX `
  -Find '    const guard = await guardSection("gamemaster-management");' -Replace '    const g = 1; void g;' -First `
  -Find2 '    if (!guard.ok) return guard.response;' -Replace2 '' `
  -ExpectTest $GRANT

Invoke-Probe -Name 'fix-purchases restores verifyAdminAuth' -File $FIX `
  -Find 'guardSection("gamemaster-management")' -Replace 'verifyAdminAuth()' -First `
  -ExpectTest $GRANT

Invoke-Probe -Name 'super_admin gate removed' -File $FIX `
  -Find '    if (guard.admin.role !== "super_admin") {
      return NextResponse.json(
        { success: false, error: "Only super admins can run this operation" },
        { status: 403 },
      );
    }
' -Replace '' `
  -ExpectTest $SUPER

Invoke-Probe -Name 'carve-out re-includes fix-purchases' -File $INV `
  -Find 'export const HELPER_BY_DESIGN: Record<string, string> = {
  "auth/logout/route.ts":' -Replace 'export const HELPER_BY_DESIGN: Record<string, string> = {
  "gamemaster/fix-purchases/route.ts":
    "Wrongly carved out - this is admin repair debt, not Game Master portal.",
  "auth/logout/route.ts":' `
  -SuiteFile '__tests__/admin/admin-route-auth-inventory.test.ts' `
  -ExpectTest $CARVE

Invoke-Probe -Name 'helper debt reappears if carve-out deleted' -File $INV `
  -Find '  "auth/logout/route.ts":
    "Clears the caller''s own admin cookies and marks them offline. A section grant would " +
    "stop an employee without that section from signing out.",
' -Replace '' `
  -ExpectTest $DEBT

Write-Host "`nR101ad probes complete."
