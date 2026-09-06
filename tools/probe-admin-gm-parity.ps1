# Probes the R26 guard: reintroduce the defect, prove the parity suite catches it.
#
# Each probe must turn RED on the test named in -Expect. Two failure modes are as bad as a
# passing probe and both have happened in this repo, so the harness checks for them:
#
#   1. A probe that never applied. A pattern with the wrong indentation or CRLF against an LF
#      file silently matches nothing, the suite stays green, and it reads as a broken test.
#   2. A probe that destroyed the file. `Get-Content` without -LiteralPath treats `[roundId]`
#      in a Next.js dynamic route as a character class and returns nothing, which then gets
#      written back. The tell is the failure COUNT: one small change should turn 1-3 tests
#      red, not the whole suite.
#
# Run from the repo root:  pwsh -File tools/probe-admin-gm-parity.ps1

$ErrorActionPreference = 'Continue'

$Suite = '__tests__/services/admin-finalize-gamemaster-parity.test.ts'

# UTF-8 WITHOUT a BOM, on both the read and the write.
#
# This is not tidiness, it is the bug that made the first run of this script corrupt two files.
# `Get-Content -Raw` in Windows PowerShell decodes using the system ANSI codepage, so every
# emoji in these services came back as mojibake; writing that back with `WriteAllText` - which
# encodes UTF-8 - persisted it. The probes themselves passed, the files were quietly mangled,
# and it surfaced two steps later as four unexplained typecheck errors. A BOM would be just as
# bad in the other direction, since these are .ts files read by tooling that does not expect one.
$Utf8NoBom = New-Object System.Text.UTF8Encoding($false)

function Read-Source {
  param([string]$Path)
  $full = (Resolve-Path -LiteralPath $Path).Path
  $text = [System.IO.File]::ReadAllText($full, [System.Text.Encoding]::UTF8)
  if ([string]::IsNullOrEmpty($text)) {
    throw "ABORT: read '$Path' as empty. Refusing to write it back."
  }
  return $text
}

function Write-Source {
  param([string]$Path, [string]$Text)
  if ([string]::IsNullOrEmpty($Text)) {
    throw "ABORT: refusing to write empty content to '$Path'."
  }
  $full = (Resolve-Path -LiteralPath $Path).Path
  [System.IO.File]::WriteAllText($full, $Text, $Utf8NoBom)
}

# Proves the round trip is lossless before any probe runs. Reason: a probe that silently
# corrupts the file it restores is worse than one that fails, because the damage outlives the
# run and looks like somebody else's regression.
function Assert-RoundTrip {
  param([string]$Path)
  $before = Read-Source -Path $Path
  Write-Source -Path $Path -Text $before
  $after = Read-Source -Path $Path
  if ($after -ne $before) {
    throw "ABORT: read/write round trip changed '$Path'. Fix the encoding before probing."
  }
}

# Escapes the pattern, then relaxes every newline so an LF file matches a CRLF here-string.
function To-Relaxed-Regex {
  param([string]$Literal)
  $escaped = [regex]::Escape($Literal)
  return ($escaped -replace '(\\r)?\\n', '\r?\n')
}

function Invoke-Probe {
  param(
    [string]$Name,
    [string]$File,
    [string]$Find,
    [string]$Replace,
    [string]$Expect
  )

  Write-Host ""
  Write-Host "=== PROBE: $Name" -ForegroundColor Cyan

  $original = Read-Source -Path $File
  $pattern = To-Relaxed-Regex -Literal $Find

  # `$` is a substitution marker in a .NET replacement string, so it has to be doubled or a
  # replacement containing one silently inserts something else. And the replace-count overload
  # lives on the Regex INSTANCE - the 4th positional argument of the static method is
  # RegexOptions, which fails with a message about enumerator names rather than about counts.
  $literalReplace = $Replace.Replace('$', '$$')
  $patched = [regex]::new($pattern).Replace($original, $literalReplace, 1)

  if ($patched -eq $original) {
    Write-Host "  [PROBE DID NOT APPLY] pattern matched nothing - the probe is broken, not the test" -ForegroundColor Magenta
    return
  }

  Write-Source -Path $File -Text $patched
  try {
    # Two runs, on purpose, and the first version of this harness got it wrong in a way worth
    # recording: it searched the whole-suite output for the expected test's NAME, which vitest
    # prints for a passing test as readily as a failing one. Every probe reported RED while
    # reporting "failing tests: 0" beside it. Matching the ✗ glyph is no better, because it does
    # not survive the console encoding reliably on Windows.
    #
    # So: ask vitest to run ONLY the expected test and read the summary counts, which are plain
    # ASCII and unambiguous. Then run the whole suite purely to measure blast radius.
    $targeted = (& npx vitest run $Suite -t $Expect 2>&1 | Out-String) -replace '\s+', ' '
    $whole = (& npx vitest run $Suite 2>&1 | Out-String) -replace '\s+', ' '

    $expectedFailed = $targeted -match 'Tests\s+[1-9]\d*\s+failed'
    $expectedRan = $targeted -match 'Tests\s+\d'

    $totalFailed = 0
    if ($whole -match 'Tests\s+(\d+)\s+failed') { $totalFailed = [int]$Matches[1] }

    if (-not $expectedRan) {
      Write-Host "  [HARNESS BROKEN] vitest printed no test summary - cannot judge anything" -ForegroundColor Magenta
    }
    elseif ($Expect -eq 'THIS PROBE IS EXPECTED TO STAY GREEN') {
      if ($totalFailed -eq 0) {
        Write-Host "  [GREEN as required] the change moves no money, as the comment claims" -ForegroundColor Green
      }
      else {
        Write-Host "  [RED, but this probe must stay GREEN] $totalFailed failing - the 'query cache only' claim is wrong" -ForegroundColor Red
      }
    }
    elseif ($expectedFailed) {
      Write-Host "  [RED on the expected test] $Expect" -ForegroundColor Green
      Write-Host "  whole-suite failures: $totalFailed" -ForegroundColor DarkGray
      if ($totalFailed -gt 4) {
        Write-Host "  [SUSPICIOUS] $totalFailed failures for a one-line change - check the file survived" -ForegroundColor Yellow
      }
    }
    elseif ($totalFailed -eq 0) {
      Write-Host "  [STILL GREEN - THE GUARD IS NOT WORKING]" -ForegroundColor Red
    }
    else {
      Write-Host "  [RED, BUT NOT ON THE EXPECTED TEST] wanted: $Expect" -ForegroundColor Yellow
      Write-Host "  whole-suite failures: $totalFailed" -ForegroundColor DarkGray
    }
  }
  finally {
    Write-Source -Path $File -Text $original
  }
}

$AdminEnd = 'apps/admin/lib/actions/trading/competition-end.actions.ts'

# Every file a probe will rewrite, checked for a lossless round trip up front. All of these
# contain emoji in log strings, which is exactly what the encoding bug destroyed.
foreach ($f in @(
    $AdminEnd,
    'lib/services/settlement/fees.service.ts',
    'lib/services/settlement/game-master-fees/distribute.ts'
  )) {
  Assert-RoundTrip -Path $f
}
Write-Host "Round-trip check passed for all probe targets." -ForegroundColor DarkGray

# 1. The defect itself: no referral stage, gross fee booked as platform income.
#
# This one legitimately turns all five tests red, so the harness's blast-radius warning fires and
# should be read and dismissed rather than acted on: every test in this suite asserts on the
# referral stage, so removing the call is not a small change from the suite's point of view. The
# warning earns its keep against a probe that damages a file, where the failures are unrelated.
Invoke-Probe -Name 'admin finalize stops calling the shared fee-and-referral stage' `
  -File $AdminEnd `
  -Find @'
    const { grossPlatformFee: actualPlatformFee } =
      await settleFeesAndGameMasters({
'@ `
  -Replace @'
    const actualPlatformFee =
      actualWinners > 0 ? prizePool - totalDistributed : prizePool * platformFeeFraction;
    await Promise.resolve({
'@ `
  -Expect 'pays the referring Game Master when the admin app settles the contest'

# 2. Pays the referrer but books the GROSS fee - the half-fix the parity test exists for.
Invoke-Probe -Name 'platform fee recorded gross instead of net of commission' `
  -File 'lib/services/settlement/fees.service.ts' `
  -Find '  const netPlatformFee = Math.max(0, grossPlatformFee - gmEarnings);' `
  -Replace '  const netPlatformFee = Math.max(0, grossPlatformFee);' `
  -Expect 'books the platform fee NET of the commission, not gross'

# 3. An inactive Game Master's share absorbed silently instead of recorded as retained.
Invoke-Probe -Name 'retained fee no longer recorded for an inactive Game Master' `
  -File 'lib/services/settlement/fees.service.ts' `
  -Find '      for (const inactiveGm of calculation.retained) {' `
  -Replace '      for (const inactiveGm of [] as typeof calculation.retained) {' `
  -Expect "records a retained fee when the Game Master's subscription is not active"

# 4. Idempotency, aimed at the guard that ACTUALLY provides it.
#
# The first version of this probe removed the `existingEarning` duplicate check in
# `distribute.ts` and stayed GREEN. That was neither a weak test nor a broken probe: the check
# is simply unreachable in this scenario, because a second `finalizeCompetition` refuses at
# `status !== "active"` long before the referral stage runs. The claim in the test's comment was
# wrong and has been corrected. Re-aimed at the status guard, which is the thing the test pins.
Invoke-Probe -Name 'status guard removed, so a second finalize re-runs settlement' `
  -File $AdminEnd `
  -Find '    if (competition.status !== "active") {' `
  -Replace '    if (false) {' `
  -Expect 'pays a Game Master once when the admin app finalizes twice'

# 5. The walletMap wiring. Expected to stay GREEN, and that is the point - it is a query
#    cache, so removing it must change no money. A red here would mean the comment claiming
#    it is only a cache is wrong.
Invoke-Probe -Name 'CONTROL: admin passes an empty walletMap (must stay green)' `
  -File $AdminEnd `
  -Find '        walletMap,' `
  -Replace '        walletMap: new Map(),' `
  -Expect 'THIS PROBE IS EXPECTED TO STAY GREEN'

Write-Host ""
Write-Host "Done. Probes 1-4 must be RED on their named test; probe 5 must stay GREEN." -ForegroundColor Cyan
