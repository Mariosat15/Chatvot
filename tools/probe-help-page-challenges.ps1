# Probes the help page's challenge guards. Each probe restores one of the claims the page
# actually carried before 14 September 2026 and must turn EXACTLY the named test red.
#
# Every defect here is invisible by construction: the page renders perfectly whether it says
# challenges are trading-only or not, and the only witness is a player who reads it and
# concludes the platform cannot do something it plainly can. There is no wrong number to
# assert on, so the probes are the only evidence the guards see the wording at all.
#
# Same harness as `probe-open-challenges.ps1` - see that file for why each defence exists
# (UTF-8 without a BOM on the read AND the write, a refusal to write when the read came
# back empty, `PROBE DID NOT APPLY` when the anchor has moved, the expected test run ALONE
# with `-t` and judged on the summary counts rather than on its name appearing in the
# output, and the whole suite re-run only to measure blast radius).
#
# One thing is specific to this file. The help page is prose inside JSX, so the formatter
# breaks sentences wherever the line runs out. `Relax` turns every newline in the anchor into
# `\r?\n`, but it does NOT absorb the indentation that follows one - so anchors here are kept
# to a single line wherever possible, and where they cannot be, the exact indentation is part
# of the string. An anchor spanning a wrap that does not match reports `PROBE DID NOT
# APPLY`, which reads like a broken harness rather than a moved target.

$ErrorActionPreference = 'Continue'
$env:NODE_OPTIONS = ''

$SUITE = '__tests__/challenges/help-page-challenges.test.ts'
$Utf8NoBom = New-Object System.Text.UTF8Encoding($false)

function Relax([string]$literal) { [regex]::Escape($literal) -replace '\r?\n', '\r?\n' }

function Probe {
  param([string]$Name, [string]$File, [string]$Find, [string]$Replace, [string]$ExpectRed, [string]$Suite = $SUITE)

  $path = Join-Path (Get-Location) $File
  $original = [System.IO.File]::ReadAllText($path, $Utf8NoBom)

  if ([string]::IsNullOrEmpty($original)) {
    Write-Host "  [READ FAILED - REFUSING TO WRITE] $Name" -ForegroundColor Magenta
    return
  }

  $patched = [regex]::Replace($original, (Relax $Find), $Replace.Replace('$', '$$'), 1)
  if ($patched -eq $original) {
    Write-Host "  [PROBE DID NOT APPLY] $Name" -ForegroundColor Magenta
    return
  }

  [System.IO.File]::WriteAllText($path, $patched, $Utf8NoBom)
  try {
    $alone = npx vitest run $Suite -t $ExpectRed --reporter=dot 2>&1 | Out-String
    $aloneFailed = 0
    if ($alone -match 'Tests\s+(\d+)\s+failed') { $aloneFailed = [int]$Matches[1] }
    $ran = ($alone -match 'Tests\s+') -and ($alone -notmatch 'No test found')

    $whole = npx vitest run $Suite --reporter=dot 2>&1 | Out-String
    $wholeFailed = 0
    if ($whole -match 'Tests\s+(\d+)\s+failed') { $wholeFailed = [int]$Matches[1] }

    if (-not $ran) {
      Write-Host "  [EXPECTED TEST DID NOT RUN - wrong name or wrong suite] $Name" -ForegroundColor Magenta
    } elseif ($aloneFailed -gt 0) {
      Write-Host ("  [RED: expected test failed, {0} red in suite] {1}" -f $wholeFailed, $Name) -ForegroundColor Green
    } else {
      Write-Host ("  [STILL GREEN - GUARD IS NOT WORKING, {0} red in suite] {1}" -f $wholeFailed, $Name) -ForegroundColor Red
    }
  } finally {
    [System.IO.File]::WriteAllText($path, $original, $Utf8NoBom)
    if ([System.IO.File]::ReadAllText($path, $Utf8NoBom) -ne $original) {
      Write-Host "  !! RESTORE FAILED for $File - check git diff" -ForegroundColor Red
    }
  }
}

$HELP = 'app/(root)/help/page-content.tsx'

Write-Host "`n=== the vocabulary ===" -ForegroundColor Cyan

# The banned noun, restored in the fair-play block.
#
# Reason it is injected HERE rather than in the intro, where it actually used to be: the
# intro's first sentence is the start marker of the open-seat slice, so mutating it turns
# two tests red - the vocabulary guard and the slice's own marker assertion. That is an
# honest second face of one edit rather than a broken guard, but a probe that reports more
# damage than it caused teaches the next reader to distrust the count.
Probe -Name 'the page calls a challenge a duel again' `
  -File $HELP `
  -Find 'Keep your challenges clean' `
  -Replace 'Keep your duels clean' `
  -ExpectRed 'never says duel'

Write-Host "`n=== open challenges ===" -ForegroundColor Cyan

# The exact sentence that was there. It is the most damaging line on the page, because a
# player who believes it never looks for the Open tab.
Probe -Name 'the denial that a challenge can be left open comes back' `
  -File $HELP `
  -Find 'You can name the person you want to play, or leave the second' `
  -Replace 'There is no public lobby - every challenge is an invitation from one player to another. You can name the person you want to play, or leave the second' `
  -ExpectRed 'does not deny that a challenge can be left open'

# Reason: the corrective half, and the reason it is asserted inside the /challenges card
# rather than page-wide. This probe came back GREEN first time round: `<em>Open</em>` is
# written four times and "open to anyone" three, so destroying the one that carries the
# claim left the others satisfying a bare match. Weak test, not a wrong claim - the fix was
# to slice to the construct, which is the `!expectedOrigin` lesson again.
Probe -Name 'the Open tab is dropped from the routes block' `
  -File $HELP `
  -Find '<em>Open</em> (challenges' `
  -Replace '<em>Taken</em> (challenges' `
  -ExpectRed 'names the Open tab in the routes block'

# The other half, in the paragraph a player reads before deciding the feature is not for
# them. Mentioned only in a later bullet, the open seat is there and undiscovered.
#
# This one came back green twice before it was right, for two different reasons. The first
# anchor spanned a line wrap and reported DID NOT APPLY - `Relax` turns a newline IN the
# anchor into `\r?\n` but cannot absorb one the anchor writes as a space. The second applied
# cleanly and changed a verb the assertion never reads, which is a mutation with no
# observable: indistinguishable from a guard that does not work.
Probe -Name 'the open seat is dropped from the opening description' `
  -File $HELP `
  -Find 'seat <strong className="text-white">open to anyone</strong> and' `
  -Replace 'seat <strong className="text-white">unassigned</strong> and' `
  -ExpectRed 'offers the open seat in the opening description'

# The decline route admits only the named `challengedId`, so an open seat has nobody who may
# decline it. Unsaid, the missing button reads as a bug.
Probe -Name 'the missing Decline button is left unexplained' `
  -File $HELP `
  -Find 'Open challenges have no Decline' `
  -Replace 'Open challenges behave the same way' `
  -ExpectRed 'says decline is unavailable on an open challenge'

Write-Host "`n=== trading is one of two ways to play ===" -ForegroundColor Cyan

# The heading as it stood: the trading sandbox rules presented as the rules of a challenge.
# A game challenge has no starting capital, so every bullet under it was false for one of the
# two kinds.
Probe -Name 'the trading rule block stops saying it is about trading' `
  -File $HELP `
  -Find 'Rules inside a <em>trading</em> challenge' `
  -Replace 'Trading rules inside a challenge' `
  -ExpectRed 'scopes the trading-only rule blocks'

# Liquidation cannot happen in a game challenge - there is no position and no margin.
Probe -Name 'the liquidation block stops saying it is about trading' `
  -File $HELP `
  -Find 'Liquidation &amp; disqualification (trading)' `
  -Replace 'Liquidation &amp; disqualification' `
  -ExpectRed 'scopes the trading-only rule blocks'

# Scoping the trading half without adding the game half leaves a player told what does NOT
# apply to them and never what does.
Probe -Name 'the game rule block is removed' `
  -File $HELP `
  -Find 'Rules inside a <em>game</em> challenge' `
  -Replace 'More about challenges' `
  -ExpectRed 'carries the game half beside it'

# `POST /api/challenges` gates on `gameNeedsMarketHours(gameLabel.gameType)`, so a game
# challenge can be created at the weekend. Told otherwise, a player waits until Monday to
# start a puzzle.
Probe -Name 'the market-hours guard is stated as applying to every challenge' `
  -File $HELP `
  -Find '<strong>trading</strong> challenge also needs the' `
  -Replace 'challenge also needs the' `
  -ExpectRed 'scopes the market-hours guard to trading'

# `getProviderTieBreakerValue` always returns 0, so the tie-breakers are a control that does
# nothing on a game challenge.
Probe -Name 'the tie-breakers are offered as how every challenge breaks a tie' `
  -File $HELP `
  -Find 'Tie-breakers (trading)' `
  -Replace 'Tie-breakers' `
  -ExpectRed 'does not offer the six trading ranking methods'

Write-Host "`n=== the routes it sends players to ===" -ForegroundColor Cyan

# Reason: the play route existed for a day before the page mentioned it, so the failure mode
# is real rather than hypothetical - a game challenger with nowhere documented to go.
Probe -Name 'the game play screen is dropped from the routes block' `
  -File $HELP `
  -Find '/challenges/[id]/play' `
  -Replace '/challenges/[id]/trade' `
  -ExpectRed 'documents the game play screen and not only the trading one'

Write-Host "`nThe route-existence probe is deliberately absent." -ForegroundColor Yellow
Write-Host "It asserts four page.tsx files are on disk, so injecting the defect means" -ForegroundColor DarkGray
Write-Host "deleting or renaming a live route directory. That is a destructive edit this" -ForegroundColor DarkGray
Write-Host "harness restores by rewriting ONE file, so it cannot put a directory back." -ForegroundColor DarkGray
Write-Host "The claim was verified by hand instead: all four exist (checked 14 Sep 2026)." -ForegroundColor DarkGray
Write-Host "`nDone.`n" -ForegroundColor Cyan
