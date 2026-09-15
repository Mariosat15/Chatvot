# Probe harness for X6.5 step A4 - the analytics and financial surface, plus R92's
# game-aware challenge reporting.
#
# Same rules as the A1-A3 harnesses: one defect, one named expected test, and a green probe
# is a question with four known answers (weak test, wrong claim, unreachable guard, mutation
# with no observable).
#
# PROBES 1 AND 2 ARE THE ONES TO READ FIRST, and they are not aimed at this pass's code at
# all - they are aimed at the two exemptions A4 had to ADD to the shared scanner in
# `__tests__/helpers/terminology-scan.ts`. A4 was the first surface to import a model
# (`import Challenge from ...`) and to call a model's own static (`Challenge.findById`), both
# of which the literal-noun scan reported as captions. Widening an exemption is the one edit
# in a guard that can silently blind SIX suites at once, so each new exemption gets a probe
# proving the real hit it is adjacent to is still caught.
#
# PROBE 9 IS THE SECOND ONE TO READ. It restores R92 itself, in the shape it actually
# shipped: a `?? 0` over an absent field. Nothing throws, nothing logs, and the operator
# reads four plausible figures about a game that has no trades.

$ErrorActionPreference = 'Continue'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$Suite = '__tests__/admin/analytics-terminology.test.ts'
$script:pass = 0
$script:fail = 0

function Relaxed([string]$literal) {
  [regex]::Escape($literal) -replace '\\r\\n|\\n', '\r?\n'
}

function Invoke-Probe {
  param(
    [string]$Name,
    [string]$File,
    [string]$From,
    [string]$To,
    [string]$ExpectRed,
    [int]$AllowRed = 1,
    [string]$InSuite
  )

  $suite = if ($InSuite) { $InSuite } else { $Suite }
  $path = Join-Path $root $File

  # Reason: -LiteralPath / ReadAllText on the READ as well as the write. The challenge detail
  # page lives at `app/challenges/view/[id]/page.tsx`, and PowerShell parses `[id]` as a
  # wildcard character class - so a plain Get-Content matches nothing, returns $null, and the
  # write puts that back happily. A harness destroyed the file it was probing this way once.
  #
  # ReadAllText/WriteAllText with UTF8Encoding($false) rather than Get-Content/Set-Content,
  # for TWO reasons, and the second one cost real time during A4. PowerShell 5.1's
  # Get-Content decodes with the system ANSI codepage, so every emoji in a touched file comes
  # back as mojibake; and `Set-Content -Encoding UTF8` WRITES A BOM, which lands as a
  # phantom one-line diff at the top of the file and, in a .tsx, in front of the first
  # import. Both failures are invisible until something two steps later goes wrong.
  $original = [IO.File]::ReadAllText($path)
  if ([string]::IsNullOrEmpty($original)) {
    Write-Host "HARNESS BROKEN  $Name - read returned nothing for $File" -ForegroundColor Magenta
    $script:fail++
    return
  }

  $pattern = Relaxed $From
  if (-not [regex]::IsMatch($original, $pattern)) {
    # Reason: DID NOT APPLY means the target MOVED, never that the run was quiet.
    Write-Host "DID NOT APPLY   $Name - pattern not found in $File" -ForegroundColor Magenta
    $script:fail++
    return
  }

  try {
    $mutated = [regex]::Replace($original, $pattern, { param($m) $To }, 1)
    if ($mutated -eq $original) {
      Write-Host "DID NOT APPLY   $Name - replacement changed nothing" -ForegroundColor Magenta
      $script:fail++
      return
    }
    [IO.File]::WriteAllText($path, $mutated, (New-Object Text.UTF8Encoding $false))

    # Reason: run the expected test ALONE with -t and read the summary counts. Searching the
    # whole suite's output for the test's NAME reports RED beside "failed 0", because vitest
    # prints a passing test's name as readily as a failing one.
    $out = & cmd.exe /c "npx vitest run $suite -t `"$ExpectRed`" --reporter=basic 2>&1" | Out-String
    # Reason: collapse all whitespace before matching. Out-String wraps at the console width,
    # so a long test name arrives split across two lines and a literal match silently misses.
    $flat = ($out -replace '\s+', ' ')

    if ($flat -match 'Tests\s+(\d+)\s+failed') {
      $count = [int]$Matches[1]
      if ($count -le $AllowRed) {
        Write-Host "RED             $Name" -ForegroundColor Green
      } else {
        Write-Host "RED (x$count)      $Name - more than the expected test broke" -ForegroundColor Yellow
      }
      $script:pass++
    } elseif (
      $flat -match 'No test files found' -or
      $flat -match 'Tests\s+no tests' -or
      $flat -match 'Tests\s+0\s+passed' -or
      $flat -notmatch 'Tests\s+\d+\s+passed'
    ) {
      # Reason: vitest's -t is a REGULAR EXPRESSION, so a parenthesis or an apostrophe in the
      # test's name matches nothing and a passing run over zero tests reads exactly like a
      # missing guard. Every name targeted here is paren-free for that reason.
      Write-Host "NO TEST RAN     $Name - '$ExpectRed' matched nothing" -ForegroundColor Magenta
      $script:fail++
    } else {
      Write-Host "GREEN           $Name - the guard is not doing its job" -ForegroundColor Red
      $script:fail++
    }
  } finally {
    [IO.File]::WriteAllText($path, $original, (New-Object Text.UTF8Encoding $false))
  }
}

$ANALYTICS  = 'apps/admin/components/admin/CompetitionAnalytics.tsx'
$FINANCIALS = 'apps/admin/components/admin/FinancialDashboard.tsx'
$TX_DIALOG  = 'apps/admin/components/admin/transactions/TransactionDetailDialog.tsx'
$VIEW       = 'apps/admin/app/challenges/view/[id]/page.tsx'
$CARD       = 'apps/admin/components/admin/competitions/ChallengePlayerCard.tsx'
$ROWS       = 'apps/admin/components/admin/competitions/ChallengeStatRows.tsx'
$ROUTE      = 'apps/admin/app/api/competition-analytics/route.ts'
$MODEL      = 'database/models/trading/challenge.model.ts'
$OUTCOME    = 'lib/services/settlement/challenge-outcome.ts'
$SCANNER    = '__tests__/helpers/terminology-scan.ts'

Write-Host "`n=== the two exemptions A4 added to the shared scanner ===" -ForegroundColor Cyan

# 1. THE IMPORT-LINE SKIP TAKEN TOO FAR. The exemption skips a line that both starts with
#    `import`/`export` AND contains `from`, which is the only shape a module specifier has.
#    Widened to skip every line mentioning `export`, it swallows `export const CAPTION =
#    "Competition Entry"` - a real hard-coded caption, in the one file shape where a caption
#    is most likely to be extracted to a constant. The probe removes the `from` requirement.
Invoke-Probe -Name '1  the import skip widened to every export' -File $SCANNER `
  -From "if (/^\s*(?:import|export)\b.*\bfrom\b/.test(line.text)) continue;" `
  -To "if (/^\s*(?:import|export)\b/.test(line.text)) continue;" `
  -ExpectRed 'skips a module specifier and nothing else' `
  -InSuite '__tests__/helpers/terminology-scan.test.ts'

# 2. THE MEMBER-ACCESS EXEMPTION TAKEN TOO FAR. `Challenge.findById` had to be exempted, and
#    the tempting spelling is a bare `${word}\.` - which also exempts every sentence that
#    ENDS in the noun, "...refunded to the Competition.", the commonest caption shape there
#    is. Requiring an identifier character after the dot separates the two exactly.
Invoke-Probe -Name '2  the member-access exemption swallowing a sentence end' -File $SCANNER `
  -From '|${word}\\s*[:=(]|${word}\\.[A-Za-z_$]`,' `
  -To '|${word}\\s*[:=(]|${word}\\.`,' `
  -ExpectRed 'still catches a caption that ends in the noun' `
  -InSuite '__tests__/helpers/terminology-scan.test.ts'

Write-Host "`n=== no renameable noun survives as a literal ===" -ForegroundColor Cyan

# 3. A CAPTION HARD-CODED BESIDE A CORRECT ONE. The load-bearing wording probe. Every
#    positive assertion stays green: the screen still calls `useTerms`, still renders forty
#    other tokens. Only the scan can see this, and it is exactly what happens when a new card
#    is added by copying the one above it.
Invoke-Probe -Name '3  a headline card captioned with a literal noun' -File $ANALYTICS `
  -From 'Total {terms.contests}' `
  -To 'Total Competitions' `
  -ExpectRed 'has no Title Case noun as a JSX literal or a quoted caption'

# 4. THE LOWERCASE HALF, which is the one A4 nearly shipped with. Mid-sentence prose is where
#    a noun hides: the sentence reads perfectly, so nobody re-reads it, and a value-built
#    guard scanning only for Title Case never looks.
Invoke-Probe -Name '4  a lowercase noun in running prose' -File $FINANCIALS `
  -From 'Pools from {terms.contests} where all {terms.players} were' `
  -To 'Pools from competitions where all participants were' `
  -ExpectRed 'has no lowercase noun in running prose'

# 5. TRADING VOCABULARY IN AN UNCONDITIONAL CAPTION. `05` section 10's binding rule in its
#    purest form: a figure is generalised, or explicitly scoped to one game, or removed.
#    "Total P&L" on a screen that serves a puzzle contest is none of the three - and it keeps
#    computing and keeps rendering, which is why it needs a guard rather than a review.
Invoke-Probe -Name '5  a trading noun in an unconditional caption' -File $ANALYTICS `
  -From 'Avg {terms.entryFee}' `
  -To 'Avg Portfolio Fee' `
  -ExpectRed 'has no trading vocabulary in an unconditional caption'

# 6. THE HOOK DROPPED FROM A SCREEN. Every token becomes `undefined`, and `undefined` renders
#    as NOTHING rather than as an error - so the captions silently VANISH rather than
#    reverting to the defaults. A type cannot catch it inside a template literal.
Invoke-Probe -Name '6  a screen stops calling useTerms' -File $TX_DIALOG `
  -From '  const terms = useTerms();' `
  -To '  const terms = {} as never;' `
  -ExpectRed 'TransactionDetailDialog calls useTerms'

# 7. THE SERVER PAGE REACHING FOR THE HOOK. `useTerms` in a server component throws at
#    render - but the reason the assertion is a NEGATIVE one is subtler: adding the hook is
#    how somebody makes this page a client component while chasing a prop, which takes its
#    database reads into the browser.
Invoke-Probe -Name '7  the server page reaching for the hook' -File $VIEW `
  -From 'import { getTerms } from "@/lib/services/terminology.service";' `
  -To 'import { getTerms } from "@/lib/services/terminology.service";
import { useTerms } from "@/contexts/TerminologyContext";' `
  -ExpectRed 'the challenge detail page resolves terms on the server'

Write-Host "`n=== R92 - the write side ===" -ForegroundColor Cyan

# 8. ONE COPY OF THE STAT BLOCK LOSES THE FIELD. The half-fixed model: the challenger's card
#    reports a score and the challenged player's reports `+0.00`, which reads as one player
#    having played badly rather than as a missing field. This is why the declaration is
#    COUNTED - a test asking whether `score` appears at all is green on exactly this.
Invoke-Probe -Name '8  one stat block loses the score field' -File $MODEL `
  -From '      score: Number,' `
  -To '' `
  -ExpectRed 'declares score on both stat blocks'

# 9. R92 ITSELF, RESTORED. A `?? 0` at the writer. It compiles, it stores a number, and
#    settlement reports success - and on a lower-is-better title that phantom zero sorts
#    FIRST, so a player who never scored becomes the winner. Identical to R50's `default: 0`
#    on `CompetitionParticipant.score`, one model along.
Invoke-Probe -Name '9  the writer coalesces an absent score to zero' -File $OUTCOME `
  -From 'score: challenger.score,' `
  -To 'score: challenger.score ?? 0,' `
  -ExpectRed 'gives the stored score no default and no coalesce' `
  -AllowRed 2

# 10. THE SCHEMA DEFAULT, which is the same defect from the other direction and the one
#     `check:mirrors` cannot see - it compares field paths and enum values, never a default.
#     A stored 0 from a default is indistinguishable from a deliberate 0.
Invoke-Probe -Name '10 the schema defaults the score to zero' -File $MODEL `
  -From '      score: Number,' `
  -To '      score: { type: Number, default: 0 },' `
  -ExpectRed 'gives the stored score no default and no coalesce' `
  -AllowRed 2

Write-Host "`n=== R92 - the read side ===" -ForegroundColor Cyan

# 11. THE LABEL NEVER REACHES THE SCREEN. The state R92 actually shipped in: the components
#     branch correctly and are handed nothing, so `isProviderGame` is always false and every
#     positive assertion about them stays green. The defect is one field on a route.
Invoke-Probe -Name '11 the route stops sending the challenge game label' -File $ROUTE `
  -From 'gameType: chalLabel.gameType,' `
  -To '' `
  -ExpectRed 'the analytics route sends the challenge game label'

# 12. A COMPONENT WRITES ITS OWN TERNARY. It imports the shared rule, which satisfies any
#     mention-based check, and then answers the question itself - so a provider CHALLENGE and
#     a provider COMPETITION report the same result two different ways. The assertion is a
#     CALL with its argument for exactly this.
Invoke-Probe -Name '12 a component answering the metric question itself' -File $ROWS `
  -From '  const metric = resolveResultMetric(stats, isProviderGame, terms);' `
  -To '  const metric = { label: "P&L", value: String(stats.pnl ?? 0), tone: "neutral" as const, sub: null };
  void resolveResultMetric;' `
  -ExpectRed 'ChallengeStatRows resolves the figure through the shared rule' `
  -AllowRed 2

# 13. THE EARLY RETURN MOVED BELOW THE READS. The branch still exists and the rows still do
#     not render, so the screen LOOKS right - but the reads have run, which is the shape that
#     survives a refactor and then leaks the moment somebody hoists a variable. Position is
#     the claim, not presence.
Invoke-Probe -Name '13 the early return moved below the trading reads' -File $ROWS `
  -From @'
  if (isProviderGame) {
'@ `
  -To @'
  const hoistedPnl = stats.pnl ?? 0;
  void hoistedPnl;
  if (isProviderGame) {
'@ `
  -ExpectRed 'ChallengeStatRows returns before it reads a trading field'

# 14. THE CARD'S TRADE ROW UNGATED. The card holds the property by a different mechanism -
#     `resolveParticipantSubline` returning null - so this is asserted separately from probe
#     13 rather than by one shared `it.each`. Ungated, it renders "Trades: 0" for a puzzle.
Invoke-Probe -Name '14 the card renders its trade row ungated' -File $CARD `
  -From '        {subline !== null && (' `
  -To '        {true && (' `
  -ExpectRed 'ChallengePlayerCard gates its trade row on the shared subline rule'

# 15. THE CARD REACHES FOR A TRADING FIGURE DIRECTLY. The negative half of the same
#     assertion, and it is the one that catches a future edit rather than a past one: reading
#     `row.pnl` here is how the card grows a second, ungated trading row next to the gated
#     one, with the gate above it still reading as though it governs.
Invoke-Probe -Name '15 the card reads a trading figure outside the gate' -File $CARD `
  -From '  const subline = resolveParticipantSubline(row, isProviderGame);' `
  -To '  const subline = resolveParticipantSubline(row, isProviderGame);
  const roi = row.pnlPercentage ?? 0;
  void roi;' `
  -ExpectRed 'ChallengePlayerCard gates its trade row on the shared subline rule'

# 16. THE DETAIL PAGE RENAMES TRADING'S OWN SETTINGS RATHER THAN WITHHOLDING THEM. The
#     honest answer for a provider game is silence: a reworded Rules block sends an operator
#     looking for a setting that does not exist there, which is worse than the old wording.
Invoke-Probe -Name '16 trading-only configuration rendered for a provider game' -File $VIEW `
  -From 'challenge.rules && !isProviderGame' `
  -To 'challenge.rules' `
  -ExpectRed 'the challenge detail page withholds trading-only configuration'

Write-Host "`n=== the never-rename list holds ===" -ForegroundColor Cyan

# 17. A LEDGER KEY TOKENISED. The canary, and the probe that fails when somebody is HELPFUL -
#     it looks like finishing the job A4 started. `competition_entry` is a stored enum value
#     on `WalletTransaction` documents already written: compared against an operator's word it
#     matches nothing, the label renders blank against real money, and nothing logs.
Invoke-Probe -Name '17 a stored ledger value replaced by a token' -File $FINANCIALS `
  -From 'competition_entry:' `
  -To '[terms.contest + "_entry"]:' `
  -ExpectRed 'tokenises the LABEL and leaves the key alone' `
  -AllowRed 2

Write-Host "`n=== the scan reaches what it claims to ===" -ForegroundColor Cyan

# 18. THE SURFACE LIST EMPTIED. The vacuity probe. For a suite whose central wording claims
#     are all "no match was found", this is the one that keeps the rest honest: with nothing
#     in the list all three scans pass over zero files and report three greens. A test that
#     examines nothing passes everything asked of it.
Invoke-Probe -Name '18 the surface list emptied' -File $Suite `
  -From 'const SURFACE = [ANALYTICS, FINANCIALS, TX_DIALOG, CHALLENGE_VIEW];' `
  -To 'const SURFACE: string[] = [];' `
  -ExpectRed 'reads every file, each with content' `
  -AllowRed 4

Write-Host ""
if ($script:fail -eq 0) {
  Write-Host "all $($script:pass) probes red on the expected test" -ForegroundColor Green
} else {
  Write-Host "$($script:pass) red, $($script:fail) NOT red - read those above" -ForegroundColor Red
}

# TWO PROBES ARE DELIBERATELY ABSENT, with the reasons here rather than two more lines that
# report green and teach the next reader the guards are decoration.
#
# There is no probe for the `challengeKeys` addition to the analytics route's catalogue
# lookup. Removing it makes `gameDisplayName` null for every challenge, which is a missing
# NAME rather than a missing label - the game-awareness assertions all still pass, correctly,
# because `gameType` and `gameKey` still arrive and the screens still branch right. The
# property is real and thin; a probe would be measuring the fixture.
#
# There is no probe for the admin copies of the model and the outcome service either, and
# that is a harness limit rather than a gap: the assertions are `it.each` over both apps with
# ONE name, so a mutation in either copy turns the same named test red and the probe cannot
# distinguish which half it proved. The main copy is probed (8, 9, 10); the mirror is held by
# `check:mirrors` for the model and by the byte-for-byte comparison for the service, which is
# the guarantee that actually applies to two files that must agree.
