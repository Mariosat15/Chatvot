# Shared probe harness. Dot-sourced by probe-engine.ps1 and probe-scoring.ps1.
#
# A test that has only ever passed proves nothing. Each probe removes exactly one guard and
# asserts that the test written for it goes red - and that the blast radius is small, because a
# one-line change turning many tests red usually means the harness damaged the file rather than
# removed the guard.
#
# ONE COPY, NOT TWO. Two probe scripts with their own copies of these functions is the "one rule,
# two copies" shape behind several defects in this repository, none of which any mirror check can
# see. The duplication would have a good excuse - the two suites probe unrelated files - and it
# would still drift.
#
# LESSONS BAKED IN, EACH OF WHICH HAS ALREADY PRODUCED A FALSE RESULT SOMEWHERE IN THIS REPO:
#
#   - -LiteralPath on the READ as well as the write. Paths containing [brackets] are parsed by
#     PowerShell as a wildcard character class, so Get-Content returns $null while Set-Content
#     happily writes it back - emptying the file and reporting success.
#   - Refuse to write when the read came back empty, for the same reason.
#   - UTF-8 without a BOM in both directions. Get-Content -Raw decodes with the system ANSI
#     codepage on PowerShell 5.1, silently mangling every emoji and accented character.
#   - Assert the file actually changed. A pattern that fails to match is indistinguishable from
#     a test that does not work, and CRLF/LF mismatches make multi-line patterns miss.
#   - Collapse whitespace in captured output before matching. Console wrapping splits a long
#     test name across two lines and defeats a literal comparison.
#   - Name the expected failing test and check the red one is the one meant. A probe aimed at the
#     wrong test is indistinguishable from a broken guard.

$script:Utf8NoBom = New-Object System.Text.UTF8Encoding($false)

function Read-Source([string]$Path) {
  $full = (Resolve-Path -LiteralPath $Path).Path
  $text = [System.IO.File]::ReadAllText($full, [System.Text.Encoding]::UTF8)
  if ([string]::IsNullOrEmpty($text)) {
    throw "Read-Source got nothing from $Path - refusing to continue, this is how a probe empties a file"
  }
  return $text
}

function Write-Source([string]$Path, [string]$Text) {
  if ([string]::IsNullOrEmpty($Text)) {
    throw "Write-Source refused an empty body for $Path"
  }
  $full = (Resolve-Path -LiteralPath $Path).Path
  [System.IO.File]::WriteAllText($full, $Text, $script:Utf8NoBom)
}

# Escape the literal, then relax every newline, so a pattern authored with either line ending
# matches a file saved with the other.
function To-Pattern([string]$Literal) {
  return ([regex]::Escape($Literal) -replace '(\\r)?\\n', '\r?\n')
}

function Invoke-Probe {
  param(
    [string]$Name,
    [string]$Suite,
    [string]$File,
    [string]$Find,
    [string]$Replace,
    [string]$ExpectRed,
    # How many tests this defect may legitimately turn red.
    #
    # Defaults to 2, because for a local guard the honest number is 1 or 2. Some properties really
    # are cross-cutting - determinism is relied on by every generation test - and those probes
    # declare it, so the threshold stays tight everywhere it can be. A single global threshold
    # either hides a harness failure or cries wolf about a real cross-cutting property.
    [int]$MaxRed = 2
  )

  # The suite is checked before anything is patched, because a probe pointed at a file that is not
  # a test suite reports GREEN - the expected test cannot fail if it never ran - and GREEN is the
  # outcome that reads as a broken guard. This is not hypothetical: `$PLAY` and `$play` are the
  # SAME variable in PowerShell, which is case-insensitive, so a suite variable and a source-file
  # variable differing only in case silently became one and twelve probes ran `src/rounds/play.ts`
  # as their test suite. It printed nothing and exited 0.
  if (-not (Test-Path -LiteralPath $Suite)) {
    throw "Invoke-Probe: suite '$Suite' does not exist"
  }
  if ((Split-Path -Leaf $Suite) -notlike 'test-*.ts') {
    throw "Invoke-Probe: '$Suite' is not a test suite - check for a case-insensitive variable collision"
  }

  $original = Read-Source $File
  $pattern = To-Pattern $Find
  $patched = [regex]::Replace($original, $pattern, [System.Text.RegularExpressions.MatchEvaluator] { param($m) $Replace }, 1)

  if ($patched -eq $original) {
    Write-Host "  ??    $Name" -ForegroundColor Yellow
    Write-Host "        PROBE DID NOT APPLY - the pattern matched nothing, so this result means nothing." -ForegroundColor Yellow
    return [pscustomobject]@{ Name = $Name; Outcome = 'DID-NOT-APPLY' }
  }

  Write-Source $File $patched
  try {
    $raw = & npx tsx $Suite 2>&1
    $lines = @($raw | ForEach-Object { ($_ -replace '\s+', ' ').Trim() })

    $redTests = @($lines | Where-Object { $_ -like 'FAIL *' } | ForEach-Object { $_.Substring(5).Trim() })
    $expected = ($ExpectRed -replace '\s+', ' ').Trim()
    $hitExpected = $redTests -contains $expected
    # Unanchored at the front on purpose: the API and play suites label their totals
    # ("API tests: 40 passed, 0 failed"), and an anchored pattern silently logged nothing.
    $summary = ($lines | Where-Object { $_ -match '\d+ passed, \d+ failed$' } | Select-Object -Last 1)
  }
  finally {
    Write-Source $File $original
  }

  # No summary line at all means the suite did not run to completion - it crashed on import, or it
  # was never a suite. Reporting that as GREEN blames the guard for a harness fault, which is the
  # one thing this file exists to prevent.
  if (-not $summary) {
    Write-Host "  ??    $Name" -ForegroundColor Yellow
    Write-Host "        SUITE PRODUCED NO SUMMARY - it did not run. This result means nothing." -ForegroundColor Yellow
    return [pscustomobject]@{ Name = $Name; Outcome = 'DID-NOT-APPLY' }
  }

  if ($hitExpected -and $redTests.Count -le $MaxRed) {
    Write-Host "  RED   $Name" -ForegroundColor Green
    Write-Host "        $summary | red: $($redTests -join '; ')" -ForegroundColor DarkGray
    return [pscustomobject]@{ Name = $Name; Outcome = 'RED' }
  }
  elseif ($hitExpected) {
    Write-Host "  RED*  $Name" -ForegroundColor Yellow
    Write-Host "        expected test went red but $($redTests.Count) failed, over the declared limit of $MaxRed - suspect the harness, not the guard" -ForegroundColor Yellow
    Write-Host "        $summary | red: $($redTests -join '; ')" -ForegroundColor DarkGray
    return [pscustomobject]@{ Name = $Name; Outcome = 'RED-WIDE' }
  }
  else {
    Write-Host "  GREEN $Name" -ForegroundColor Red
    Write-Host "        expected '$expected' to fail. It did not." -ForegroundColor Red
    Write-Host "        $summary | red: $($redTests -join '; ')" -ForegroundColor DarkGray
    return [pscustomobject]@{ Name = $Name; Outcome = 'GREEN' }
  }
}

function Write-ProbeSummary($Results) {
  Write-Host ""
  $red = @($Results | Where-Object { $_.Outcome -eq 'RED' }).Count
  $wide = @($Results | Where-Object { $_.Outcome -eq 'RED-WIDE' }).Count
  $green = @($Results | Where-Object { $_.Outcome -eq 'GREEN' }).Count
  $noop = @($Results | Where-Object { $_.Outcome -eq 'DID-NOT-APPLY' }).Count
  Write-Host ("$red red, $wide red-but-wide, $green GREEN (bad), $noop did not apply") -ForegroundColor Cyan
  Write-Host ""
  if ($green -gt 0 -or $noop -gt 0) { exit 1 }
  exit 0
}
