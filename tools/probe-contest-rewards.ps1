# Probes for R94 - the one reward stage every finalize path calls.
#
# Each probe reintroduces one defect the guard exists to catch and asserts the EXPECTED test
# goes red, alone. Harness rules applied here, each learned from a false result elsewhere:
#   - Read AND write with -LiteralPath and UTF-8 without a BOM, and refuse to write when the
#     read came back empty. A probe that destroys the file it is probing reports every test
#     red on the right name for entirely the wrong reason, and the tell is the failure COUNT.
#   - Name the expected failing test and run it ALONE with -t. Searching whole-suite output
#     for a test's name finds it whether it passed or failed.
#   - vitest -t is a REGEX, so the patterns below are ASCII and regex-safe.
#   - Every pattern is a SINGLE line with no leading whitespace. A multi-line pattern with
#     CRLF endings silently fails to match an LF file, and a probe that fails to apply is
#     indistinguishable from a test that does not work.

$ErrorActionPreference = 'Continue'
Set-Location (Join-Path $PSScriptRoot '..')

$Enc = New-Object System.Text.UTF8Encoding($false)

function Read-Source([string]$Path) {
  $text = [System.IO.File]::ReadAllText((Resolve-Path -LiteralPath $Path), $Enc)
  if ([string]::IsNullOrWhiteSpace($text)) {
    throw "Read of $Path came back empty - refusing to probe."
  }
  return $text
}

function Write-Source([string]$Path, [string]$Text) {
  if ([string]::IsNullOrWhiteSpace($Text)) {
    throw "Refusing to write an empty $Path."
  }
  [System.IO.File]::WriteAllText((Resolve-Path -LiteralPath $Path), $Text, $Enc)
}

function Invoke-Probe {
  param(
    [string]$Name,
    [string]$File,
    [string]$Find,
    [string]$Replace,
    [string]$ExpectTest,
    [string]$Suite = '__tests__/services/contest-rewards.test.ts'
  )

  $original = Read-Source $File
  if (-not $original.Contains($Find)) {
    Write-Host "[$Name] PROBE DID NOT APPLY - pattern not found. The target moved; re-aim it." -ForegroundColor Yellow
    return
  }

  Write-Source $File $original.Replace($Find, $Replace)
  try {
    $out = (& npx vitest run $Suite -t $ExpectTest 2>&1 | Out-String) -replace '\s+', ' '
    # Checked BEFORE the failure count, and deliberately: a run that matched no test prints
    # no "failed" line at all, so a bare fall-through to GREEN would report a moved or
    # mis-spelled -t pattern as an unprotected guard.
    if ($out -match 'No test files found' -or $out -match 'Tests\s+no tests' -or $out -notmatch 'Tests\s+\d') {
      Write-Host "[$Name] NO TEST RAN - the -t pattern matched nothing (vitest -t is a REGEX)" -ForegroundColor Red
      return
    }
    if ($out -match 'Tests\s+(\d+)\s+failed\s*\|\s*(\d+)\s+passed') {
      $failed = [int]$Matches[1]
      if ($failed -eq 1) {
        Write-Host "[$Name] RED on exactly 1 test - OK" -ForegroundColor Green
      } else {
        Write-Host "[$Name] RED on $failed tests - too wide, re-scope the assertion" -ForegroundColor Yellow
      }
    } elseif ($out -match 'Tests\s+(\d+)\s+failed') {
      Write-Host "[$Name] RED on $($Matches[1]) test(s) - OK" -ForegroundColor Green
    } else {
      Write-Host "[$Name] GREEN - the guard did not catch this. Ask which of the four causes." -ForegroundColor Red
    }
  } finally {
    Write-Source $File $original
  }
}

$STAGE = 'lib/services/settlement/contest-rewards.ts'
$ADMIN_STAGE = 'apps/admin/lib/services/settlement/contest-rewards.ts'
$MAIN_COMP = 'lib/actions/trading/competition-end.actions.ts'
$ADMIN_COMP = 'apps/admin/lib/actions/trading/competition-end.actions.ts'
$MAIN_CHAL = 'lib/actions/trading/challenge-finalize.actions.ts'
$ADMIN_CHAL = 'apps/admin/lib/actions/trading/challenge-finalize.actions.ts'
$PROV_COMP = 'lib/services/settlement/provider-finalize.ts'
$PROV_CHAL = 'lib/services/settlement/provider-challenge-finalize.ts'

Write-Host "`n=== R94 probes ===`n"

# 1. An absent rank defaulted to a number. THE defect this input shape exists to prevent: a
#    player excluded by the eligibility gate (R45) or refunded for never scoring (R50) holds
#    no place, and treating absent as a number pays a non-scorer a first place.
Invoke-Probe -Name 'absent rank becomes first' -File $STAGE `
  -Find 'if (typeof rank === "number" && rank >= 1) {' `
  -Replace 'const rank9 = rank ?? 1; if (typeof rank9 === "number" && rank9 >= 1) { const rank = rank9;' `
  -ExpectTest 'gives an UNRANKED player completion XP and no bonus'

# 2. Completion XP paid only to those who placed. Reads as an optimisation and silently
#    stops every mid-field player earning anything for turning up.
Invoke-Probe -Name 'completion XP for placers only' -File $STAGE `
  -Find 'awardActivityXP(userId, completionEvent, gameKey).catch(() => {});' `
  -Replace 'if (typeof rank === "number") awardActivityXP(userId, completionEvent, gameKey).catch(() => {});' `
  -ExpectTest 'awards completion XP to every player, placed or not'

# 3. The podium widened past three. A fourth place is a completion, not a placing.
Invoke-Probe -Name 'podium widened' -File $STAGE `
  -Find 'const MAX_PODIUM_RANK = 3;' `
  -Replace 'const MAX_PODIUM_RANK = 4;' `
  -ExpectTest 'awards a podium bonus to the top three only'

# 4. A challenge paid a competition podium. Two formats, two XP ledgers - a challenge has
#    one winner and no second place to be paid for.
Invoke-Probe -Name 'challenge pays a podium' -File $STAGE `
  -Find 'if (kind === "challenge") {' `
  -Replace 'if (false) {' `
  -ExpectTest 'pays the winner bonus, never a podium'

# 5. Badges evaluated for placers only - which is how a player who enters steadily and never
#    makes a podium earns nothing, for ever, with nothing thrown and nothing logged.
Invoke-Probe -Name 'badges for placers only' -File $STAGE `
  -Find 'evaluateUserBadges(userId).catch(() => {});' `
  -Replace 'if (typeof rank === "number") evaluateUserBadges(userId).catch(() => {});' `
  -ExpectTest 'evaluates badges for every player exactly once, placed or not'

# 6. An absent gameKey left absent rather than resolved to trading. Invariant 5: an
#    unlabelled contest predates X1 and is a trading one, so this files every pre-X1 finish
#    in a per-game rollup keyed on nothing.
Invoke-Probe -Name 'absent label left absent' -File $STAGE `
  -Find 'const gameKey = input.gameKey || TRADING_GAME_TYPE;' `
  -Replace 'const gameKey = input.gameKey;' `
  -ExpectTest 'resolves an ABSENT gameKey to trading'

# 7a/7b. The label dropped on the way to the ledger, once per award line. Every award is
#    correct, every total adds up, and no per-game rollup can ever be built from the
#    history. TWO probes because there are three award lines and the first version of this
#    test ran only a competition - so dropping the label on the challenge-won line came
#    back GREEN, the third cause of a green probe: a real guard the fixture could not reach.
Invoke-Probe -Name 'label not carried (challenge win)' -File $STAGE `
  -Find 'awardActivityXP(userId, "challenge_won", gameKey).catch(() => {});' `
  -Replace 'awardActivityXP(userId, "challenge_won").catch(() => {});' `
  -ExpectTest 'carries the contest.s gameKey onto every XP award'

Invoke-Probe -Name 'label not carried (podium)' -File $STAGE `
  -Find 'awardActivityXP(userId, event, gameKey).catch(() => {});' `
  -Replace 'awardActivityXP(userId, event).catch(() => {});' `
  -ExpectTest 'carries the contest.s gameKey onto every XP award'

# 8. Best-rank kept only by luck: the later duplicate always wins, so an unranked row erases
#    a podium place depending purely on iteration order. The competition path legitimately
#    hands over a participant list and a leaderboard that overlap.
Invoke-Probe -Name 'last duplicate wins' -File $STAGE `
  -Find 'if (typeof p.rank === "number" && (existing === undefined || p.rank < existing)) {' `
  -Replace 'if (true) {' `
  -ExpectTest 'awards a duplicated player once, keeping the BEST rank'

# 9. Deduplication removed outright. The same finish paid two or three times over, and for a
#    podium player the bonus as well.
Invoke-Probe -Name 'duplicates awarded twice' -File $STAGE `
  -Find 'if (!bestByUser.has(p.userId)) {' `
  -Replace 'bestByUser.set(p.userId + bestByUser.size, p.rank); if (!bestByUser.has(p.userId)) {' `
  -ExpectTest 'awards a duplicated player once, keeping the BEST rank'

# 10. A blank userId admitted. Awards land on a player that does not exist and the badge
#     service is called with an empty id.
Invoke-Probe -Name 'blank userId admitted' -File $STAGE `
  -Find 'if (!p?.userId) continue;' `
  -Replace 'if (false) continue;' `
  -ExpectTest 'skips a row with no userId rather than awarding a blank player'

# 11. A trading figure read here. THE property that makes this stage survive the next game:
#     the moment it reads a P&L it has to learn what each game means by one.
Invoke-Probe -Name 'reads a trading figure' -File $STAGE `
  -Find 'export interface ContestRewardParticipant {' `
  -Replace 'export interface ContestRewardParticipant { pnl?: number;' `
  -ExpectTest 'reads no trading figure at all'

# 12. The handler logs and RETHROWS, which reads as careful. Every call site runs after the
#     money has committed, so a propagated failure is a paid contest reported as a failed
#     one - and an operator who believes that finalizes it again.
Invoke-Probe -Name 'logs and rethrows' -File $STAGE `
  -Find '    console.error(' `
  -Replace '    throw error;
    console.error(' `
  -ExpectTest 'NEVER throws into its caller'

# 13. The empty case reporting awards nobody earned, which makes the log line a lie.
Invoke-Probe -Name 'empty contest reports awards' -File $STAGE `
  -Find 'if (bestByUser.size === 0) {' `
  -Replace 'if (bestByUser.size === 0) { return { playersRewarded: 1, podiumAwards: 1 }; } if (false) {' `
  -ExpectTest 'does nothing, and reports nothing, for an empty contest'

# 14-19. THE DEFECT ITSELF, once per finalize path: the site stops calling the shared stage.
#        This is the state each of the six was in before this commit - and for the two
#        provider paths and the admin challenge path, the state of awarding NOTHING at all.
Invoke-Probe -Name 'main competition stops calling' -File $MAIN_COMP `
  -Find 'awardContestRewards({' -Replace 'legacyRewards({' `
  -ExpectTest 'awards through the shared stage'

Invoke-Probe -Name 'admin competition stops calling' -File $ADMIN_COMP `
  -Find 'awardContestRewards({' -Replace 'legacyRewards({' `
  -ExpectTest 'awards through the shared stage'

Invoke-Probe -Name 'main challenge stops calling' -File $MAIN_CHAL `
  -Find 'awardContestRewards({' -Replace 'legacyRewards({' `
  -ExpectTest 'awards through the shared stage'

Invoke-Probe -Name 'admin challenge stops calling' -File $ADMIN_CHAL `
  -Find 'awardContestRewards({' -Replace 'legacyRewards({' `
  -ExpectTest 'awards through the shared stage'

Invoke-Probe -Name 'provider competition stops calling' -File $PROV_COMP `
  -Find 'awardContestRewards({' -Replace 'legacyRewards({' `
  -ExpectTest 'awards through the shared stage'

Invoke-Probe -Name 'provider challenge stops calling' -File $PROV_CHAL `
  -Find 'awardContestRewards({' -Replace 'legacyRewards({' `
  -ExpectTest 'awards through the shared stage'

# 20. THE LOAD-BEARING HALF: an inline copy kept BESIDE the shared call, which is what a
#     half-finished extraction leaves behind. Every positive assertion is satisfied and the
#     player is awarded twice for one finish.
Invoke-Probe -Name 'inline XP copy kept beside it' -File $MAIN_COMP `
  -Find 'await awardContestRewards({' `
  -Replace 'awardActivityXP("u", "competition_completed"); await awardContestRewards({' `
  -ExpectTest 'no longer awards XP or badges of its own'

# 21. Same shape, badges rather than XP, on the admin competition path - which is the one
#     that actually held this block before the extraction.
Invoke-Probe -Name 'inline badge copy kept beside it' -File $ADMIN_COMP `
  -Find 'await awardContestRewards({' `
  -Replace 'evaluateUserBadges("u"); await awardContestRewards({' `
  -ExpectTest 'no longer awards XP or badges of its own'

# 22. A challenge site asking for the competition kind. The call is present, the import is
#     right, and both players are paid a podium bonus for a two-player contest.
Invoke-Probe -Name 'challenge asks for competition kind' -File $MAIN_CHAL `
  -Find 'kind: "challenge",' -Replace 'kind: "competition",' `
  -ExpectTest 'asks for the right KIND at each site'

# 23. A hard-coded label at a call site. Every provider finish lands in the trading rollup
#     while every figure still adds up - the failure mode R7 exists for.
Invoke-Probe -Name 'label hard-coded at the call site' -File $PROV_COMP `
  -Find 'gameKey: stored?.gameKey,' -Replace 'gameKey: "trading",' `
  -ExpectTest 'passes the contest.s own gameKey, never a literal'

# 24. The two copies allowed to disagree. `check:mirrors` compares MODELS, so it has no
#     opinion about this file, and two copies that differ reinstate R94 one layer down.
Invoke-Probe -Name 'the two copies diverge' -File $ADMIN_STAGE `
  -Find 'const MAX_PODIUM_RANK = 3;' -Replace 'const MAX_PODIUM_RANK = 5;' `
  -ExpectTest 'is byte-identical in both apps'

# DELIBERATELY UNPROBED, with the reason, rather than shipped as a probe that reports green:
#
#   `if (rank === 1)` widened to `if (rank >= 1)` on the challenge branch changes no
#   observable. Both challenge finalizers pass either rank 1 or nothing at all - a tie
#   leaves both players unranked - so there is no fixture in which a challenge carries a
#   rank 2, and writing one would assert against a state the callers cannot produce. The
#   strict spelling is kept because it is the honest statement of the rule, not because a
#   test holds it. If a challenge format ever ranks a runner-up, this becomes probeable and
#   should be probed.

Write-Host "`n=== done ===`n"
