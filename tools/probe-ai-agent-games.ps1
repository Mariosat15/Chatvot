# Probe harness for X6.5 step A6 - what the AI agent knows and what it reports.
#
# Same rules as tools/probe-terminology-delivery.ps1, not repeated here: one defect per probe,
# one NAMED expected test, `-LiteralPath` on the read as well as the write, UTF-8 without a
# BOM both ways, and a refusal to write when the read came back empty.
#
# Two harness facts that have each cost a false result on this codebase and apply here:
#   - vitest's `-t` is a REGULAR EXPRESSION, so every expected-test name below is ASCII and
#     regex-safe. A name containing an apostrophe or a bracket matches nothing, and a passing
#     run over zero tests reads exactly like a missing guard.
#   - a probe reporting MORE damage than it caused is not reporting on your guard. The honest
#     number for a one-line mutation is 1.
#
# TWO PROBES ARE DELIBERATELY ABSENT and both reasons are at the bottom of the file.

$ErrorActionPreference = 'Continue'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$Suite = '__tests__/admin/ai-agent-games-knowledge.test.ts'
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
    [string]$ExpectRed
  )

  $path = Join-Path $root $File
  $pattern = Relaxed $From

  $original = [IO.File]::ReadAllText($path)
  if ([string]::IsNullOrEmpty($original)) {
    Write-Host "HARNESS BROKEN  $Name - read returned nothing for $File" -ForegroundColor Magenta
    $script:fail++
    return
  }
  if (-not [regex]::IsMatch($original, $pattern)) {
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

    $out = & cmd.exe /c "npx vitest run $Suite -t `"$ExpectRed`" --reporter=basic 2>&1" | Out-String
    $flat = ($out -replace '\s+', ' ')

    if ($flat -match 'Tests\s+(\d+)\s+failed') {
      $count = [int]$Matches[1]
      if ($count -eq 1) {
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

$ROUTE = 'apps/admin/app/api/ai-agent/chat/route.ts'
$KB = 'apps/admin/lib/ai-agent/knowledge-base.ts'
$GAMES_KB = 'apps/admin/lib/ai-agent/games-knowledge-base.ts'

Write-Host "`n=== the games material reaches the model ===" -ForegroundColor Cyan

# 1. THE R42 SHAPE, AND THE ONE DEFECT THE WHOLE MODULE COULD HAVE SHIPPED WITH. Written,
#    reviewed, tested in isolation and imported by nothing, so the agent has never seen a word
#    of it while every other assertion in the suite still passes.
Invoke-Probe -Name '1  the games material not composed in' -File $KB `
  -From '${GAMES_KNOWLEDGE_BASE}' -To '' `
  -ExpectRed 'is composed into the knowledge base the prompt reads'

# 2. A GAME NAMED IN THE MATERIAL. This is the single failure mode of the no-developer-needed
#    claim, and it is wrong about the SECOND title rather than the first - so it reads
#    perfectly today and silently misinforms on the day a catalogue is synced.
Invoke-Probe -Name '2  a game title named in the knowledge base' -File $GAMES_KB `
  -From 'a provider game' -To 'a provider game such as Circuit Sprint' `
  -ExpectRed 'enumerates no game anywhere'

# 3. A STALE PATH REINTRODUCED. The one thing an operator cannot work around: they either
#    find the screen or they open a support ticket, and a confidently wrong path is worse
#    than none because they stop looking.
Invoke-Probe -Name '3  a stale navigation path returns' -File $GAMES_KB `
  -From 'Finance' -To 'Financials ->' `
  -ExpectRed 'carries no navigation path the sidebar does not have'

Write-Host "`n=== the vocabulary clause ===" -ForegroundColor Cyan

# 4. THE CLAUSE SPLICED INTO THE PROMPT RATHER THAN APPENDED. The historical string is the
#    only evidence the agent still behaves as it did, and that evidence exists only while the
#    clause is concatenated - so this mutation destroys a guarantee while reading as a tidy-up.
Invoke-Probe -Name '4  the clause spliced into the base prompt' -File $ROUTE `
  -From 'return SYSTEM_PROMPT_BASE + vocabularyRule(terms);' `
  -To 'return SYSTEM_PROMPT_BASE.replace("ChartVolt admin panel", `${vocabularyRule(terms)} ChartVolt admin panel`);' `
  -ExpectRed 'appends it rather than splicing it into the prompt'

# 5. THE VOCABULARY TAKEN OFF THE REQUEST. `gameKey`'s rule one layer along: a caller-supplied
#    vocabulary is arbitrary text inside a system prompt, and the caller here is a browser.
Invoke-Probe -Name '5  the terms taken from the caller' -File $ROUTE `
  -From 'buildSystemPrompt(await getTerms())' -To 'buildSystemPrompt(body.terms)' `
  -ExpectRed 'reads the terms server-side and never off the request'

Write-Host "`n=== a provider contest reports its score ===" -ForegroundColor Cyan

# 6. THE DEFECT ITSELF, IN ITS MOST PLAUSIBLE FORM: the trading fields reported "because the
#    seat has them". It does - `participant-seat.ts` defaults all three to `0` on every seat
#    regardless of game - so the output is complete, consistent, confident and wrong, and it
#    is the version an operator quotes into a prize dispute.
#    Anchored on the line ABOVE the return rather than on the return itself: this file's
#    withholding branch spells an absent score as an em dash, and PowerShell 5.1 decodes a
#    BOM-less .ps1 with the system ANSI codepage - so a pattern carrying that character
#    matches nothing and the probe reports DID NOT APPLY, which reads like a moved target
#    rather than an unrepresentable one. Keep every pattern in this file ASCII.
Invoke-Probe -Name '6  trading figures zeroed rather than withheld' -File $ROUTE `
  -From '    const hasScore = typeof row.score === "number" && Number.isFinite(row.score);' `
  -To '    const hasScore = typeof row.score === "number" && Number.isFinite(row.score);
    if (hasScore) {
      return { score: row.score.toLocaleString(), pnl: reportedFigure(row.pnl) };
    }' `
  -ExpectRed 'withholds every trading figure rather than zeroing it'

# 7. THE SCORE COLUMN HARD-LABELLED. The whole subject of X6.5: an operator who renamed the
#    word reads ours instead of theirs, on the one column that decided the prize.
Invoke-Probe -Name '7  the score column hard-labelled' -File $ROUTE `
  -From '    return [{ key: "score", label: terms.score }];' `
  -To '    return [{ key: "score", label: "Score" }];' `
  -ExpectRed 'labels the score column with the operator'

# 8. R92's read side left open in the challenge report - the state this surface was actually
#    in until today, so the probe restores the real defect verbatim.
Invoke-Probe -Name '8  a challenge reported on P and L regardless of game' -File $ROUTE `
  -From '  const isProviderChallenge = hasProviderGameLabel(challenge);' `
  -To '  const isProviderChallenge = false;' `
  -ExpectRed 'reports a challenge on score too'

# 9. The mixed list with nothing to tell the rows apart. Every other column on that table is
#    identical for a trading challenge and a game one.
Invoke-Probe -Name '9  no game column on the challenge list' -File $ROUTE `
  -From '    game: resolveGameBadge(c).label,' -To '' `
  -ExpectRed 'tells a trading challenge from a game one in the list'

Write-Host "`n=== nothing invented, nothing guessed ===" -ForegroundColor Cyan

# 10. THE PHANTOM ZERO AT ITS SOURCE. `|| 0` and `?? 0` differ only where it matters: an
#     absent figure and a real zero are different facts, and the falsy form reports the first
#     as the second - `entryBlockThreshold`'s rule in the reporter.
Invoke-Probe -Name '10 an absent figure reported as zero' -File $ROUTE `
  -From '  return typeof value === "number" && Number.isFinite(value)' `
  -To '  return typeof value === "number" || true' `
  -ExpectRed 'renders an absent number as a dash and a stored zero as zero'

# 11. The original spelling, restored where it was. Kept separate from probe 10 because this
#     one proves the report-level sweep, not the helper - a correct helper that four call
#     sites route around is the shape this suite exists to catch.
Invoke-Probe -Name '11 the original phantom zero restored in a report' -File $ROUTE `
  -From '    ...participantMetrics(p, isProviderContest),' `
  -To '    pnl: p.pnl?.toFixed(2) || "0",' `
  -ExpectRed 'uses no phantom zero in the competition reports'

# 12. THE SUBTLEST DEFECT IN THE FILE, AND THE ONE A REVIEWER WOULD APPROVE: the fallback
#     "repaired" by ordering on score instead of declining. The direction lives on the
#     catalogue title, so on a time trial this names the SLOWEST player and puts a medal
#     beside them. Declining is the only correct answer a reporter can give.
Invoke-Probe -Name '12 a provider winner inferred by sorting on score' -File $ROUTE `
  -From '    const topParticipant = isProviderContest
      ? []
      : await db' `
  -To '    const topParticipant = await db' `
  -ExpectRed 'refuses to infer a provider winner by sorting'

# 13. The live leaderboard ordered on a trading metric for a game. Note the failure is
#     uniform across every player, which is why nothing looks broken: no impossible row, no
#     total that fails to add up, just a plausible order decided by a field that is `0`
#     for all of them.
Invoke-Probe -Name '13 the live provider board ordered on P and L' -File $ROUTE `
  -From '  const participantSort: Record<string, 1 | -1> = isProviderContest
    ? { currentRank: 1 }
    : { pnl: -1, currentCapital: -1 };' `
  -To '  const participantSort: Record<string, 1 | -1> = { pnl: -1, currentCapital: -1 };' `
  -ExpectRed 'orders a live provider leaderboard on the rank the engine computed'

# 14. THE FOURTH QUERY SPELLED OUT INLINE, which is why that assertion counts rather than
#     merely looking for the shared constant. Three of four correct is a board whose stored
#     and live branches disagree about the order, intermittently, depending on which tool the
#     model happened to call.
Invoke-Probe -Name '14 one of the three queries opting out of the shared sort' -File $ROUTE `
  -From '      .sort(participantSort)' -To '      .sort({ pnl: -1 })' `
  -ExpectRed 'orders a live provider leaderboard on the rank the engine computed'

# NO PROBE FOR 'states the two facts that make every trading answer wrong on a game', and the
# reason is recorded rather than the omission left to be noticed.
#
# It is a claim about PROSE the owner may legitimately rewrite. The only mutations that turn
# it red are deleting the word "score" or the money sentence from the knowledge base, which is
# indistinguishable from an editorial pass - so a probe here would report on the wording of a
# paragraph rather than on a behaviour, and the first person to improve that paragraph would
# be told their edit broke a guard. The assertion is kept because the two facts are
# load-bearing and their absence is worth reporting; the probe is not, because a red here
# would carry no information about the agent.
#
# NO PROBE FOR the `TERMS.score.length` hedge-check inside 'labels the score column with the
# operator', either. The only way to turn it red is to empty the shipped default, which stops
# a dozen unrelated suites at the same time - a probe reporting more damage than it caused is
# not reporting on your guard, and probe 7 already covers the assertion that line protects.

Write-Host ""
Write-Host "red: $($script:pass)   green or broken: $($script:fail)" -ForegroundColor Cyan
if ($script:fail -gt 0) { exit 1 }
