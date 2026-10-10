# Probes for __tests__/admin/user-data-reset-coverage.test.ts (R87).
#
# Each probe reintroduces one shape of the defect the guard exists to catch and
# asserts EXACTLY the named test goes red. Every probe names its expected test
# and runs vitest with -t, so a probe aimed at the wrong test reports "NO TEST
# RAN" rather than passing quietly.
#
# Read and write with UTF8 without a BOM: PowerShell 5.1 decodes with the ANSI
# codepage otherwise and writes mojibake back into the file being probed.
#
# ONE ASSERTION IS DELIBERATELY UNPROBED. "reads both apps' model directories"
# is a size tripwire that exists so the other five cannot pass vacuously over an
# empty set. Every mutation that shrinks the set - a wrong directory, a broken
# parser - also breaks the five checks that read it, so a probe for it reports
# six failures and says nothing about the tripwire. It is covered instead by the
# fact that the other probes only go red one at a time.

$ErrorActionPreference = "Continue"
$Root = Split-Path -Parent $PSScriptRoot
$Suite = "__tests__/admin/user-data-reset-coverage.test.ts"
$Service = Join-Path $Root "apps/admin/lib/services/user-data-reset.service.ts"

$enc = New-Object System.Text.UTF8Encoding($false)

function Read-Text([string]$Path) {
  return [System.IO.File]::ReadAllText($Path, $enc)
}

function Write-Text([string]$Path, [string]$Text) {
  if ([string]::IsNullOrEmpty($Text)) {
    throw "refusing to write an empty file to $Path"
  }
  [System.IO.File]::WriteAllText($Path, $Text, $enc)
}

$script:passed = 0
$script:failed = 0

function Probe {
  param(
    [string]$Name,
    [string]$File,
    [string]$Find,
    [string]$Replace,
    [string]$ExpectRed
  )

  $original = Read-Text $File
  $patched = $original.Replace($Find, $Replace)
  if ($patched -eq $original) {
    Write-Host "[$Name] PROBE DID NOT APPLY - the target moved" -ForegroundColor Magenta
    $script:failed++
    return
  }

  Write-Text $File $patched
  try {
    $out = & npx vitest run $Suite -t $ExpectRed 2>&1 | Out-String
  } finally {
    Write-Text $File $original
  }

  # Collapse whitespace before matching: Out-String wraps at the console width,
  # so a summary line can arrive split across two lines.
  $flat = ($out -replace "\s+", " ")
  if ($flat -match "Tests (\d+) failed") {
    $n = [int]$Matches[1]
    if ($n -eq 1) {
      Write-Host "[$Name] RED on exactly 1 test" -ForegroundColor Green
      $script:passed++
    } else {
      Write-Host "[$Name] RED but on $n tests - too much blast radius" -ForegroundColor Yellow
      $script:failed++
    }
  } elseif ($flat -match "No test files found" -or $flat -match "Tests no tests") {
    Write-Host "[$Name] NO TEST RAN - the expected test name moved" -ForegroundColor Magenta
    $script:failed++
  } else {
    Write-Host "[$Name] STILL GREEN - GUARD IS NOT WORKING" -ForegroundColor Red
    $script:failed++
  }
}

$ownerTest = "clears the collections the owner reported as surviving a reset"
$classifyTest = "classifies every declared collection as cleared, zeroed or preserved"

# 1. The reported defect itself: chargebacks stop being cleared.
Probe -Name "chargebacks no longer cleared" -File $Service `
  -Find '  "chargebacks",' -Replace '  // "chargebacks",' `
  -ExpectRed $ownerTest

# 2. The messaging feature's own presence collection stops being cleared. This
#    is the near-identical name that is why it survived every reset while the
#    list looked complete.
Probe -Name "messaging user_presence no longer cleared" -File $Service `
  -Find '  "user_presence",' -Replace '  // "user_presence",' `
  -ExpectRed $ownerTest

# 3. A collection a model declares lands in neither list.
Probe -Name "a declared collection is classified nowhere" -File $Service `
  -Find '  "tradingsymbols",' -Replace '  // "tradingsymbols",' `
  -ExpectRed $classifyTest

# 4. The wallet is no longer declared as zeroed - the R86 blind spot, where a
#    money document is quietly treated as though the reset never touches it.
Probe -Name "creditwallets no longer declared zeroed" -File $Service `
  -Find '  "creditwallets", // balance' -Replace '  // "creditwallets", // balance' `
  -ExpectRed $classifyTest

# 5. One name is both cleared and preserved, so one of the two claims is a lie.
Probe -Name "a collection is cleared AND preserved" -File $Service `
  -Find '  "customer_assignments",' -Replace '  "customer_assignments",
  "appsettings",' `
  -ExpectRed "never both clears and preserves the same collection"

# 6. A typo in the raw delete list: deleteMany affects nothing and the reset
#    still reports success, which is how "alerts" sat here for months.
Probe -Name "a raw name matches no collection" -File $Service `
  -Find '  "conversations",' -Replace '  "conversationss",' `
  -ExpectRed "clears no raw name that matches no collection, unless it is listed as legacy"

# 7. A live collection is exempted as legacy, which is how a real typo hides
#    behind the word "legacy" and exempts itself from probe 6.
Probe -Name "a live collection is exempted as legacy" -File $Service `
  -Find 'export const LEGACY_RAW_COLLECTIONS: string[] = [
  "userprofiles",' -Replace 'export const LEGACY_RAW_COLLECTIONS: string[] = [
  "conversations",
  "userprofiles",' `
  -ExpectRed "carries no legacy exemption for a collection that does exist"

Write-Host ""
Write-Host "passed: $script:passed   failed: $script:failed"
