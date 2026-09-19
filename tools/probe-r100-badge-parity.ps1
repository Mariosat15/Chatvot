# R100 probes — admin badge evaluator parity. RED on exactly one expected test each.

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
    [switch]$First,
    [string]$ExpectTest
  )

  $full = Join-Path $Root $File
  $orig = Read-Utf8 $full
  if ([string]::IsNullOrEmpty($orig)) { throw "PROBE DID NOT APPLY (empty read): $File" }

  $mut = if ($First) {
    $idx = $orig.IndexOf($Find)
    if ($idx -lt 0) { throw "PROBE DID NOT APPLY (Find miss): $Name" }
    $orig.Remove($idx, $Find.Length).Insert($idx, $Replace)
  } else {
    if (-not $orig.Contains($Find)) { throw "PROBE DID NOT APPLY (Find miss): $Name" }
    $orig.Replace($Find, $Replace)
  }
  if ($mut -eq $orig) { throw "PROBE DID NOT APPLY (no change): $Name" }
  Write-Utf8 $full $mut

  try {
    $out = npx vitest run __tests__/services/badge-evaluator-parity.test.ts -t $ExpectTest 2>&1 | Out-String
    $failed = [regex]::Match($out, 'Tests\s+(\d+)\s+failed').Groups[1].Value
    if ($failed -eq '1') {
      Write-Host "RED x1  $Name"
    } else {
      Write-Host "FAIL    $Name  failed=$failed"
      Write-Host "  expect: $ExpectTest"
    }
  } finally {
    Write-Utf8 $full $orig
  }
}

$MAIN = 'lib/services/badge-evaluation.service.ts'
$ADMIN = 'apps/admin/lib/services/badge-evaluation.service.ts'
$ADMIN_POS = 'apps/admin/lib/actions/trading/position.actions.ts'

Invoke-Probe -Name 'admin drifts from main' -File $ADMIN `
  -Find 'export async function gatherUserStats' -Replace 'export async function gatherUserStats /*drift*/' -First `
  -ExpectTest 'is byte-identical in both apps'

Invoke-Probe -Name 'typeof guard removed' -File $MAIN `
  -Find 'if (typeof userId !== "string" || !userId.trim()) {
    throw new Error("Invalid userId");
  }' -Replace '/* typeof guard removed */' `
  -ExpectTest 'refuses a non-string userId'

Invoke-Probe -Name 'cache get removed' -File $MAIN `
  -Find '_statsCache.get(userId)' -Replace '_statsCache.has(userId) && null' -First `
  -ExpectTest 'caches gatherUserStats behind a TTL map'

Invoke-Probe -Name 'category filter signature dropped' -File $MAIN `
  -Find 'categories?: string[]' -Replace '/* no categories */' -First `
  -ExpectTest 'accepts an optional category filter'

Invoke-Probe -Name 'trade limit dropped' -File $MAIN `
  -Find '.limit(2000)' -Replace '.limit(999999)' `
  -ExpectTest 'bounds the trade and position samples'

Invoke-Probe -Name 'admin trade-close loses categories' -File $ADMIN_POS `
  -Find 'evaluateUserBadges(session.user.id, ["Trading", "Profit", "Risk", "Speed", "Consistency", "Strategy"])' `
  -Replace 'evaluateUserBadges(session.user.id)' -First `
  -ExpectTest 'the admin trade-close path passes the same category list'
