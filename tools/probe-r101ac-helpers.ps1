# Focused R101ac probes — clear helpers. RED on exactly one expected test each.
# R101ac describe has three aggregated tests (not per-file it.each).

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
    $filter = if ($ExpectTest) { $ExpectTest } else { 'R101ac' }
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

$AI = 'apps/admin/app/api/ai-agent/config/route.ts'
$UP = 'apps/admin/app/api/images/upload/route.ts'
$CLEAN = 'apps/admin/app/api/admin/cleanup/run/route.ts'
$COOKIE = 'apps/admin/app/api/cookie-consent/route.ts'
$DEP = 'apps/admin/app/api/dev-zone/dependency-check/route.ts'
$SYNC = 'apps/admin/app/api/gamification/sync-user/route.ts'
$ENV = 'apps/admin/app/api/environment/route.ts'
$RESET = 'apps/admin/app/api/reset-all-data/route.ts'
$GRANT = 'every single-caller file names its calling-screen grant'
$DUAL = 'images/upload uses guardAnySection with branding and landing-pages'
$COVER = 'covers twenty-one clear helper route files'

Invoke-Probe -Name 'ai-agent wrong section' -File $AI `
  -Find 'guardSection("ai-agent")' -Replace 'guardSection("overview")' -First `
  -ExpectTest $GRANT

Invoke-Probe -Name 'ai-agent unguarded' -File $AI `
  -Find '    const guard = await guardSection("ai-agent");' -Replace '    const g = 1; void g;' -First `
  -Find2 '    if (!guard.ok) return guard.response;' -Replace2 '' `
  -ExpectTest $GRANT

Invoke-Probe -Name 'images/upload drops landing-pages' -File $UP `
  -Find 'guardAnySection(["branding", "landing-pages"])' -Replace 'guardAnySection(["branding"])' `
  -ExpectTest $DUAL

Invoke-Probe -Name 'images/upload wrong to section' -File $UP `
  -Find 'guardAnySection(["branding", "landing-pages"])' -Replace 'guardSection("branding")' `
  -ExpectTest $DUAL

Invoke-Probe -Name 'cleanup wrong section' -File $CLEAN `
  -Find 'guardSection("data-cleanup")' -Replace 'guardSection("database")' -First `
  -ExpectTest $GRANT

Invoke-Probe -Name 'cookie-consent jwt restored' -File $COOKIE `
  -Find 'guardSection("cookie-consent")' -Replace 'guardSection("overview")' `
  -ExpectTest $GRANT

Invoke-Probe -Name 'dependency-check all wrong section' -File $DEP `
  -Find 'guardSection("dependency-updates")' -Replace 'guardSection("overview")' `
  -ExpectTest $GRANT

Invoke-Probe -Name 'sync-user wrong section' -File $SYNC `
  -Find 'guardSection("users")' -Replace 'guardSection("badges")' `
  -ExpectTest $GRANT

Invoke-Probe -Name 'environment weaker helper' -File $ENV `
  -Find 'id: guard.admin.id,' -Replace 'id: (await getAdminSession())!.id,' -First `
  -ExpectTest $GRANT

Invoke-Probe -Name 'reset-all-data unguarded' -File $RESET `
  -Find '    const guard = await guardSection("database");' -Replace '    const g = 1; void g;' -First `
  -Find2 '    if (!guard.ok) return guard.response;' -Replace2 '' `
  -ExpectTest $GRANT

Invoke-Probe -Name 'closed folder leak (inventory)' -File $AI `
  -Find '    const guard = await guardSection("ai-agent");' -Replace '    const g = 1; void g;' -First `
  -Find2 '    if (!guard.ok) return guard.response;' -Replace2 '' `
  -SuiteFile '__tests__/admin/admin-route-auth-inventory.test.ts' `
  -ExpectTest 'no route under a closed folder'
