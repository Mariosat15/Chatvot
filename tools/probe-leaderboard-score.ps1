# Probes for the provider leaderboard score seam (R37).
#
# Each probe breaks one part of the fix and asserts the NAMED test goes red. A probe aimed at
# the wrong test is indistinguishable from a test that does not work, so every entry names the
# test it expects to fail and the harness runs that test alone with `-t`.
#
# Two harness rules learned the hard way on this codebase and applied here:
#   * UTF-8 without a BOM on the read AND the write. PowerShell 5.1's `Get-Content -Raw`
#     decodes with the system ANSI codepage, so a round trip mangles every emoji in the file
#     and the damage surfaces later as unexplained typecheck errors.
#   * Refuse to write when the read came back empty, and use -LiteralPath on both. A path
#     containing `[` is a wildcard to PowerShell, so a read silently returns nothing while the
#     write happily truncates the file - every probe then goes red for the wrong reason.

$ErrorActionPreference = 'Continue'

$Utf8NoBom = New-Object System.Text.UTF8Encoding($false)

function Read-Source([string]$Path) {
  $text = [System.IO.File]::ReadAllText((Resolve-Path -LiteralPath $Path), $Utf8NoBom)
  if ([string]::IsNullOrWhiteSpace($text)) { throw "Read of $Path returned nothing." }
  return $text
}

function Write-Source([string]$Path, [string]$Text) {
  if ([string]::IsNullOrWhiteSpace($Text)) { throw "Refusing to write empty content to $Path." }
  [System.IO.File]::WriteAllText((Resolve-Path -LiteralPath $Path), $Text, $Utf8NoBom)
}

# Escapes a literal then relaxes every newline, so a CRLF file matches a pattern written here.
function To-Pattern([string]$Literal) {
  return [Regex]::Escape($Literal) -replace '(\\r)?\\n', '\r?\n'
}

$probes = @(
  @{
    Name  = 'score is dropped from the projection'
    File  = 'lib/actions/trading/competition.actions.ts'
    From  = 'losingTrades status enteredAt startingCapital score'
    To    = 'losingTrades status enteredAt startingCapital'
    Test  = 'ranks a provider contest on score, not on trading PnL'
  },
  @{
    # Single-line on purpose. The first attempt spanned two lines with a literal CRLF, the
    # regex matched because it relaxes newlines, and String.Replace then did nothing - which
    # reported as "file unchanged" and looks exactly like an already-applied edit. This file
    # is LF; provider-settlement.service.ts is CRLF. Never assume either.
    Name  = 'score is dropped from the ranking input'
    File  = 'lib/actions/trading/competition.actions.ts'
    From  = '      score: p.score,'
    To    = ''
    Test  = 'ranks a provider contest on score, not on trading PnL'
  },
  @{
    Name  = 'the direction is never resolved'
    File  = 'lib/actions/trading/competition.actions.ts'
    From  = '? await resolveScoreDirection(competition.gameKey)'
    To    = '? undefined'
    Test  = 'ranks a lower-is-better provider contest with the lowest score first'
  },
  @{
    Name  = 'gameKey is dropped from the contest projection'
    File  = 'lib/actions/trading/competition.actions.ts'
    From  = '.select("rules status gameType gameKey")'
    To    = '.select("rules status gameType")'
    Test  = 'ranks a lower-is-better provider contest with the lowest score first'
  },
  @{
    # THIS PROBE BREAKS TWO FILES AT ONCE, and needing to is the finding rather than a
    # weakness in the harness.
    #
    # An unrecognised stored direction is refused entry twice: `resolveScoreDirection` narrows
    # it to the upward default, and `getProviderRankingValue` separately tests equality against
    # the one downward value. EITHER ALONE IS SUFFICIENT, so two single-site probes both
    # reported GREEN - the resolver replaced by a cast (the module then saves it) and the
    # module's equality flipped to an inequality (the resolver has already narrowed, so the
    # module never sees the odd value). That is a fourth cause of a green probe to add to weak
    # test, wrong claim and missing test: **the property is held redundantly, and no
    # single-site change can express its absence.**
    #
    # Both sites are kept deliberately. The redundancy is cheap and the failure it prevents -
    # a silently reversed leaderboard - is one a player cannot be compensated for.
    Name  = 'both direction guards are removed at once'
    Edits = @(
      @{
        File = 'lib/services/games/score-direction.service.ts'
        From = @'
  return title.scoreDirection === "lower_is_better"
    ? "lower_is_better"
    : "higher_is_better";
'@
        To   = '  return title.scoreDirection as "higher_is_better" | "lower_is_better";'
      },
      @{
        File = 'lib/games/provider/scoring.ts'
        From = 'participant.scoreDirection === "lower_is_better"'
        To   = 'participant.scoreDirection !== "higher_is_better"'
      }
    )
    Test  = 'treats an unrecognised stored direction as higher-is-better'
  }
)

$failures = 0

foreach ($probe in $probes) {
  Write-Host ''
  Write-Host "PROBE: $($probe.Name)" -ForegroundColor Cyan

  # One probe may need to break several files at once - see the last entry for why that is a
  # finding rather than a convenience. A single-file probe is just the one-element case.
  $edits = if ($probe.ContainsKey('Edits')) {
    $probe.Edits
  } else {
    @(@{ File = $probe.File; From = $probe.From; To = $probe.To })
  }

  $originals = @{}
  $applied = $true

  foreach ($edit in $edits) {
    $original = Read-Source $edit.File
    $originals[$edit.File] = $original

    $pattern = To-Pattern $edit.From
    if ($original -notmatch $pattern) {
      Write-Host "  DID NOT APPLY - pattern not found in $($edit.File)" -ForegroundColor Yellow
      $applied = $false
      break
    }

    # Reason it substitutes as a plain string rather than with -replace, having used the regex
    # only to CONFIRM the match: `$` in a replacement string is a group reference to .NET, and
    # several of these patterns contain one. The regex answers "is it there", String.Replace
    # does the edit - which is also why a match can succeed while the edit does nothing, when
    # the pattern spans a newline the file writes differently.
    $broken = $original.Replace($edit.From, $edit.To)
    if ($broken -eq $original) {
      Write-Host "  DID NOT APPLY - $($edit.File) unchanged" -ForegroundColor Yellow
      $applied = $false
      break
    }

    Write-Source $edit.File $broken
  }

  $out = ''
  try {
    if ($applied) {
      $raw = & npx vitest run __tests__/services/provider-contest-lobby-shape.test.ts -t "$($probe.Test)" 2>&1
      # Collapse whitespace: Out-String wraps at the console width, so a long test name arrives
      # split across two lines and a literal match silently misses it.
      $out = (($raw | Out-String) -replace '\s+', ' ')
    }
  } finally {
    # Restore every file that was read, whether or not its edit landed.
    foreach ($file in $originals.Keys) { Write-Source $file $originals[$file] }
  }

  if (-not $applied) {
    $failures++
    continue
  }

  # A `-t` filter matching no test is a fault in the probe, never in the code - and without this
  # branch it reports as GREEN, which is the opposite conclusion. One apostrophe in a test name
  # was enough to produce that false result in tools/probe-provider-lobby.ps1.
  if ($out -notmatch 'Tests\s+\d+\s+(passed|failed)') {
    Write-Host "  PROBE BROKEN - no test matched `"$($probe.Test)`"" -ForegroundColor Magenta
    $failures++
  } elseif ($out -match 'Tests\s+(\d+)\s+failed') {
    $red = [int]$Matches[1]
    if ($red -eq 1) {
      Write-Host "  RED as expected (1 test failed)" -ForegroundColor Green
    } else {
      Write-Host "  RED but $red tests failed - blast radius larger than expected" -ForegroundColor Yellow
      $failures++
    }
  } else {
    Write-Host '  GREEN - the guard is not doing its job' -ForegroundColor Red
    $failures++
  }
}

Write-Host ''
if ($failures -eq 0) {
  Write-Host "All $($probes.Count) probes behaved as expected." -ForegroundColor Green
} else {
  Write-Host "$failures of $($probes.Count) probes did not behave as expected." -ForegroundColor Red
}
