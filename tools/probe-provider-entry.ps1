# Probes the X5 entry-and-ranking guards by reintroducing each defect and confirming the
# suite goes red. A test that only ever passes proves nothing.
#
# Same harness as tools/probe-contest-wizard.ps1, and for the same three reasons learned
# the hard way: a multi-line pattern with CRLF does not match an LF file, Out-String wraps
# long test names across lines so a literal match silently misses, and a probe that fails
# to apply is indistinguishable from a test that does not work.

$ErrorActionPreference = 'Continue'
$env:NODE_OPTIONS = ''

$Suite = '__tests__/services/provider-entry-and-ranking.test.ts'

function Relax([string]$literal) {
  [regex]::Escape($literal) -replace '\r?\n', '\r?\n'
}

function Probe {
  param(
    [string]$Name,
    [string]$File,
    [string]$Find,
    [string]$Replace,
    [string]$ExpectRed
  )

  $original = Get-Content $File -Raw
  $patched = [regex]::Replace($original, (Relax $Find), $Replace.Replace('$', '$$'), 1)

  if ($patched -eq $original) {
    Write-Host "  [PROBE DID NOT APPLY] $Name" -ForegroundColor Magenta
    return
  }

  Set-Content -LiteralPath $File -Value $patched -NoNewline
  try {
    $out = npx vitest run $Suite --reporter=dot 2>&1 | Out-String
    $failed = 0
    if ($out -match 'Tests\s+(\d+)\s+failed') { $failed = [int]$Matches[1] }

    $flat = ($out -replace '\s+', ' ')
    $want = ($ExpectRed -replace '\s+', ' ')

    if ($failed -gt 0) {
      $hit = if ($flat -match [regex]::Escape($want)) { 'expected test' } else { 'OTHER test' }
      Write-Host ("  [RED: {0} failed, {1}] {2}" -f $failed, $hit, $Name) -ForegroundColor Green
    } else {
      Write-Host "  [STILL GREEN - GUARD IS NOT WORKING] $Name" -ForegroundColor Red
    }
  } finally {
    Set-Content -LiteralPath $File -Value $original -NoNewline
  }
}

Write-Host "`n=== the participant schema ===" -ForegroundColor Cyan

Probe -Name 'capital goes back to unconditionally required (the original P0)' `
  -File 'database/models/trading/competition-participant.model.ts' `
  -Find 'startingCapital: {
      type: Number,
      required: function (this: { gameKey?: string }) {
        return (this.gameKey || "trading") === "trading";
      },' `
  -Replace 'startingCapital: {
      type: Number,
      required: true,' `
  -ExpectRed 'saves a provider participant that has no capital at all'

Probe -Name 'the load-bearing || "trading" is simplified away' `
  -File 'database/models/trading/competition-participant.model.ts' `
  -Find 'return (this.gameKey || "trading") === "trading";' `
  -Replace 'return this.gameKey === "trading";' `
  -ExpectRed 'refuses a participant whose label is an empty string'

# NOT PROBEABLE, and recorded here rather than quietly dropped.
#
# Removing the isAtRisk guard leaves `undefined / undefined` = NaN, and `NaN < 60` is false -
# the same answer the guard returns deliberately. No test can distinguish the two, so this
# was reported STILL GREEN on the first run and the honest conclusion is that the guard
# changes no behaviour today rather than that the test is broken. It is kept for the reason
# written beside it in the model: the accident holds only for `<`.
#
# The general rule this is an instance of: when a probe stays green, decide whether the test
# is weak or the CLAIM is wrong, before assuming the first.

Write-Host "`n=== the seat builder ===" -ForegroundColor Cyan

Probe -Name 'gameKey is left to the schema default again' `
  -File 'lib/services/contest-entry/participant-seat.ts' `
  -Find 'gameKey: input.gameKey || TRADING_GAME_TYPE,' `
  -Replace 'gameKey: TRADING_GAME_TYPE,' `
  -ExpectRed 'copies gameKey from the contest instead of letting the schema default it'

Probe -Name 'a provider seat carries trading capital again' `
  -File 'lib/services/contest-entry/participant-seat.ts' `
  -Find '  if (!isTrading) return seat;' `
  -Replace '  if (!isTrading) return { ...seat, startingCapital: 0, currentCapital: 0, availableCapital: 0 };' `
  -ExpectRed 'omits the three virtual-capital fields for a provider contest'

Probe -Name 'a field name the schema does not declare creeps in' `
  -File 'lib/services/contest-entry/participant-seat.ts' `
  -Find '    score: 0,' `
  -Replace '    score: 0,
    pnlPercent: 0,' `
  -ExpectRed 'writes only field names the schema declares'

Write-Host "`n=== the provider scoring module ===" -ForegroundColor Cyan

Probe -Name 'lower_is_better stops being negated' `
  -File 'lib/games/provider/scoring.ts' `
  -Find 'return participant.scoreDirection === "lower_is_better" ? -score : score;' `
  -Replace 'return score;' `
  -ExpectRed 'negates the score when the title declares lower is better'

Probe -Name 'the module starts branching on rankingMethod' `
  -File 'lib/games/provider/scoring.ts' `
  -Find 'export function getProviderRankingValue(
  participant: RankableParticipant,
): number {' `
  -Replace 'export function getProviderRankingValue(
  participant: RankableParticipant,
  rankingMethod?: string,
): number {
  if (rankingMethod === "roi") return 0;' `
  -ExpectRed 'ignores rankingMethod entirely'

Probe -Name 'tie-breaking on join time is reintroduced' `
  -File 'lib/games/provider/scoring.ts' `
  -Find 'export function getProviderTieBreakerValue(): number {
  return 0;' `
  -Replace 'export function getProviderTieBreakerValue(p?: { enteredAt?: Date }): number {
  return p?.enteredAt ? -p.enteredAt.getTime() : 0;' `
  -ExpectRed 'declares no tie-breaks, so identical scores are a genuine tie'

Write-Host "`n=== the registry and settlement routing ===" -ForegroundColor Cyan

Probe -Name 'the provider module is unregistered' `
  -File 'lib/games/registry.ts' `
  -Find 'const MODULES: readonly GameModule[] = [tradingGameModule, providerGameModule];' `
  -Replace 'const MODULES: readonly GameModule[] = [tradingGameModule];' `
  -ExpectRed 'refuses a provider contest with no_settle_path, not unknown_game'

Probe -Name 'settlement starts allowing a provider contest down the trading path' `
  -File 'lib/games/settlement.ts' `
  -Find '  if (gameModule.type !== TRADING_GAME_TYPE) {' `
  -Replace '  if (false) {' `
  -ExpectRed 'refuses a provider contest with no_settle_path, not unknown_game'

Write-Host "`n=== the round-launch guards ===" -ForegroundColor Cyan

$Suite = '__tests__/services/provider-round-launch.test.ts'

Probe -Name 'THE SEAT CHECK IS REMOVED - anyone signed in can play a paid contest' `
  -File 'lib/services/games/round-launch.service.ts' `
  -Find '    if (!participant) {' `
  -Replace '    if (false) {' `
  -ExpectRed 'REFUSES a signed-in user who never joined the competition'

Probe -Name 'the base URL falls back to localhost instead of refusing' `
  -File 'lib/services/games/round-launch.service.ts' `
  -Find '  const raw = process.env.NEXT_PUBLIC_BASE_URL?.trim();
  if (!raw) return null;' `
  -Replace '  const raw = process.env.NEXT_PUBLIC_BASE_URL?.trim() || "http://localhost:3000";
  if (!raw) return null;' `
  -ExpectRed 'refuses when the public base URL is not configured'

Probe -Name 'a non-http base URL is accepted' `
  -File 'lib/services/games/round-launch.service.ts' `
  -Find '  if (!/^https?:\/\//i.test(raw)) return null;' `
  -Replace '  if (false) return null;' `
  -ExpectRed 'refuses a relative or non-http base URL'

Probe -Name 'finalizing becomes a playable status' `
  -File 'lib/services/games/round-launch.service.ts' `
  -Find 'const PLAYABLE_STATUSES = new Set(["active"]);' `
  -Replace 'const PLAYABLE_STATUSES = new Set(["active", "finalizing"]);' `
  -ExpectRed 'refuses while the contest is FINALIZING'

Probe -Name 'the play-window START check is dropped' `
  -File 'lib/services/games/round-launch.service.ts' `
  -Find '    if (contest.playWindowStart && new Date() < new Date(contest.playWindowStart)) {' `
  -Replace '    if (false) {' `
  -ExpectRed 'refuses before the play window opens'

Probe -Name 'the per-title switch is not re-checked at play time' `
  -File 'lib/services/games/round-launch.service.ts' `
  -Find '    if (!title.chartvoltEnabled || title.providerStatus !== "active") {' `
  -Replace '    if (false) {' `
  -ExpectRed 'refuses a title an operator has switched off mid-contest'

Probe -Name 'a trading contest is allowed down the provider launch path' `
  -File 'lib/services/games/round-launch.service.ts' `
  -Find '    if (!isProviderContest(contest)) {' `
  -Replace '    if (false) {' `
  -ExpectRed 'refuses a trading competition rather than half-launching it'

Probe -Name 'our own misconfiguration is leaked to the player' `
  -File 'lib/services/games/round-launch.service.ts' `
  -Find '      return refuse(
        "misconfigured",
        "This game is temporarily unavailable. Please try again later.",
      );
    }

    // `maxDurationSeconds` lives on the catalogue row' `
  -Replace '      return refuse("misconfigured", config.error);
    }

    // `maxDurationSeconds` lives on the catalogue row' `
  -ExpectRed 'gives a neutral message when OUR configuration is the problem'

Write-Host "`n=== the settlement path ===" -ForegroundColor Cyan

$Suite = '__tests__/services/provider-settlement.test.ts'

Probe -Name 'THE DISPATCH STOPS ROUTING PROVIDER CONTESTS - they fall through to trading' `
  -File 'lib/actions/trading/competition-end.actions.ts' `
  -Find '    if (route.path === "provider") {' `
  -Replace '    if (false) {' `
  -ExpectRed 'ranks by score and pays the winners'

Probe -Name 'the dispatch FAILS OPEN, settling an unknown game as trading' `
  -File 'lib/games/settlement.ts' `
  -Find '  if (!gameModule) {
    return {
      path: "none",
      reason: "unknown_game",' `
  -Replace '  if (!gameModule) {
    return {
      path: "trading",
      reason: "unknown_game",' `
  -ExpectRed 'FAILS CLOSED on a label with no registered module'

Probe -Name 'the leaderboard stores the negated comparison value instead of the raw score' `
  -File 'lib/services/settlement/provider-settlement.service.ts' `
  -Find '      score: p.score,' `
  -Replace '      score: p.scoreDirection === "lower_is_better" && p.score !== undefined ? -p.score : p.score,' `
  -ExpectRed 'stores the RAW score even when the title sorts downward'

Probe -Name 'winnerPnL is written unconditionally, claiming a puzzle had a profit' `
  -File 'lib/services/settlement/contest-completion.service.ts' `
  -Find '  if (leaderboard[0]?.pnl !== undefined) {
    contest.winnerPnL = leaderboard[0].pnl;
  }' `
  -Replace '  contest.winnerPnL = leaderboard[0]?.pnl ?? 0;' `
  -ExpectRed 'records no winner PnL, because a puzzle has none'

Probe -Name 'score is un-declared on finalLeaderboard again (strict mode discards it)' `
  -File 'database/models/trading/competition.model.ts' `
  -Find '        score: Number,
        isTied: Boolean,' `
  -Replace '        isTied: Boolean,' `
  -ExpectRed 'actually PERSISTS the leaderboard fields the schema used to discard'

Probe -Name 'isTied is un-declared again - the pre-existing trading defect returns' `
  -File 'database/models/trading/competition.model.ts' `
  -Find '        isTied: Boolean,
        qualificationStatus: String,' `
  -Replace '        qualificationStatus: String,' `
  -ExpectRed 'actually PERSISTS the leaderboard fields the schema used to discard'

Probe -Name 'the ledger row writes finalPnl for a game that has none' `
  -File 'lib/services/settlement/prize-payout.service.ts' `
  -Find '  if (winner.pnl !== undefined) metadata.finalPnl = winner.pnl;' `
  -Replace '  metadata.finalPnl = winner.pnl ?? 0;' `
  -ExpectRed "puts the score on the winner's ledger row, not a phantom PnL"

Probe -Name 'the prize-pool integrity cap is removed' `
  -File 'lib/services/settlement/provider-settlement.service.ts' `
  -Find '  if (prizePool > actualCollectedFees && actualCollectedFees > 0) {' `
  -Replace '  if (false) {' `
  -ExpectRed 'caps a prize pool inflated beyond the fees actually collected'

Probe -Name 'the lock is not released when settlement refuses, stranding the contest' `
  -File 'lib/actions/trading/competition-end.actions.ts' `
  -Find '    if (route.path === "none") {' `
  -Replace '    if (route.path === "none" && false) {' `
  -ExpectRed 'refuses a contest whose game has no module, leaving it untouched'

Write-Host "`n=== the unresolved-round policies ===" -ForegroundColor Cyan

$Suite = '__tests__/services/provider-settlement.test.ts'

Probe -Name 'THE EXCLUSION FILTER IS REMOVED - a refunded player is ranked and paid too' `
  -File 'lib/services/settlement/provider-settlement.service.ts' `
  -Find '  const participants = allParticipants.filter((p) => !excluded.has(p.userId));' `
  -Replace '  const participants = allParticipants;' `
  -ExpectRed 'does NOT pay them a prize as well'

Probe -Name 'exclusion relies on the participant status instead of filtering' `
  -File 'lib/services/settlement/provider-settlement.service.ts' `
  -Find '  const excluded = new Set(assessment.excludedUserIds);' `
  -Replace '  const excluded = new Set<string>();' `
  -ExpectRed 'does NOT pay them a prize as well'

Probe -Name 'the pool is not reduced by the refunded fees' `
  -File 'lib/services/settlement/provider-settlement.service.ts' `
  -Find '    prizePool = Math.max(0, prizePool - refund.totalRefunded);' `
  -Replace '    prizePool = Math.max(0, prizePool);' `
  -ExpectRed 'reduces the pool even when the integrity cap cannot do it for us'
# Reason this names the awkward test rather than the obvious one: with the participant count
# already reduced, the integrity cap recomputes the same pool by a different route and the
# obvious test passes without this line. Only a contest whose pool sits BELOW the fees
# collected can tell the two apart.

Probe -Name 'the participant count is left at its original value' `
  -File 'lib/services/settlement/provider-settlement.service.ts' `
  -Find '    participantCount = Math.max(0, participantCount - refundedCount);' `
  -Replace '    participantCount = Math.max(0, participantCount);' `
  -ExpectRed 'the remaining winners are paid from the reduced pot'

Probe -Name 'the refund is never paid - the obligation goes back to being named only' `
  -File 'lib/services/settlement/provider-settlement.service.ts' `
  -Find '  const refund = await refundExcludedParticipants({' `
  -Replace '  const refund = await (async () => ({ refundedUserIds: [] as string[], totalRefunded: 0, alreadyRefundedUserIds: [] as string[] }))(); void refundExcludedParticipants; const _unused = ({' `
  -ExpectRed "returns the excluded player's entry fee"

Probe -Name 'THE IDEMPOTENCY CHECK IS REMOVED - a second settlement refunds again' `
  -File 'lib/services/settlement/exclusion-refund.ts' `
  -Find '  const alreadyRefunded = new Set(priorRefunds.map((t) => t.userId));' `
  -Replace '  const alreadyRefunded = new Set<string>();' `
  -ExpectRed 'does not refund twice when the contest is settled again'

Probe -Name 'the per-player dedupe is dropped - best_of_n refunds once per round' `
  -File 'lib/services/settlement/unresolved-rounds.ts' `
  -Find '  const userIds = [...new Set(rounds.map((r) => r.userId))];' `
  -Replace '  const userIds = rounds.map((r) => r.userId);' `
  -ExpectRed 'refunds a player ONCE even with several unresolved rounds'

Probe -Name 'a refund is recorded as winnings' `
  -File 'lib/services/settlement/exclusion-refund.ts' `
  -Find '          totalSpentOnCompetitions: -entryFee,
          totalRefunded: entryFee,' `
  -Replace '          totalWonFromCompetitions: entryFee,' `
  -ExpectRed 'records the refund as a reversed spend, never as winnings'

Probe -Name 'the refund row is not attributed to the competition' `
  -File 'lib/services/settlement/exclusion-refund.ts' `
  -Find '          competitionId,
          status: "completed",' `
  -Replace '          status: "completed",' `
  -ExpectRed 'writes a refund row attributed to the competition'

Probe -Name 'the participant is not marked refunded' `
  -File 'lib/services/settlement/exclusion-refund.ts' `
  -Find '    await CompetitionParticipant.updateOne(' `
  -Replace '    await Promise.resolve(); void CompetitionParticipant; const _skip = (' `
  -ExpectRed 'marks the participant refunded'

Probe -Name 'HOLD_AND_ALERT STOPS BLOCKING - a held contest settles and pays out' `
  -File 'lib/services/settlement/unresolved-rounds.ts' `
  -Find '  if (policy === "hold_and_alert") {' `
  -Replace '  if (false) {' `
  -ExpectRed 'pays nobody and leaves the contest claimable'

Probe -Name 'the hold gate moves AFTER the lock - the contest is claimed and released' `
  -File 'lib/services/settlement/provider-finalize.ts' `
  -Find '    if (held.blocksSettlement) {' `
  -Replace '    if (held.blocksSettlement && false) {' `
  -ExpectRed 'pays nobody and leaves the contest claimable'

# The stranding bug and the in-transaction hold check are probed by
# `tools/probe-reprobe.ps1`, because they can only be reached through the mocked race in
# `provider-settlement-late-hold.test.ts` - the pre-lock gate catches every refusal this
# suite can produce, so probed against this file both stayed green.

Probe -Name 'the hold becomes permanent - a resolved round still refuses' `
  -File 'lib/services/settlement/unresolved-rounds.ts' `
  -Find '  if (rounds.length === 0) {' `
  -Replace '  if (false) {' `
  -ExpectRed 'settles normally once the round is no longer unresolved'

Probe -Name 'score_zero starts refunding, because the policy check is dropped' `
  -File 'lib/services/settlement/unresolved-rounds.ts' `
  -Find '  if (policy === "score_zero") {' `
  -Replace '  if (false) {' `
  -ExpectRed 'settles on time and refunds nobody'

Probe -Name 'an absent policy defaults to exclude instead of score_zero' `
  -File 'lib/services/settlement/unresolved-rounds.ts' `
  -Find '  if (stored === "exclude" || stored === "hold_and_alert") return stored;
  return "score_zero";' `
  -Replace '  if (stored === "hold_and_alert") return stored;
  return "exclude";' `
  -ExpectRed 'is the fallback for a contest that predates the field'

# DELIBERATELY NOT PROBED: passing `contestId` as a plain string. It stayed green, and the
# claim was wrong rather than the test being weak - Mongoose casts a string to ObjectId when
# the query executes, verified directly. The explicit construction is for the reader; the
# `isValid` guard beside it is the load-bearing part, because an unparseable id throws a
# CastError that would abort a settlement which could otherwise pay everyone.

Write-Host "`n=== done ===`n" -ForegroundColor Cyan
