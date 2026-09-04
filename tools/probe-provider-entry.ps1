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
  -Replace 'export function getProviderTieBreakerValue(): number {
  return 1;' `
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

Write-Host "`n=== done ===`n" -ForegroundColor Cyan
