# Probes for R50 - the phantom `score: 0` that made every entrant prize-eligible.
#
# Same harness as probe-admin-provider-dispatch.ps1. Its lessons are already paid for and are
# not re-derived here: -LiteralPath and explicit UTF-8 without a BOM on the read AND the write;
# refuse to write when the read came back empty; confirm the file actually changed before
# believing any outcome; name the expected failing test and judge by the summary counts of that
# single filtered test, never by searching whole-suite output for a name vitest prints for a
# passing test as readily as a failing one.
#
# 1-2 tests red is the honest number for a one-line change. Five or more means the probe
# damaged the file rather than the behaviour.
#
# THE DEFECT BEING PROBED. `providerHasResult` is `Number.isFinite(participant.score)`, so a
# stored nought means "played and scored nothing" and is eligible for a prize. Three writers
# each supplied one before the player had played: the seat builder, the schema default, and the
# play state's `?? 0`. Any ONE of them is enough to reintroduce the defect, which is why there
# is a probe per writer rather than a probe for the fix.

$ErrorActionPreference = "Continue"
$enc = New-Object System.Text.UTF8Encoding($false)
$presence = "__tests__/services/provider-score-presence.test.ts"
$cleanup = "__tests__/services/phantom-score-cleanup.test.ts"
$results = @()

function Invoke-Probe {
    param(
        [string]$Name,
        [string]$File,
        [string]$From,
        [string]$To,
        [string]$TestName,
        [string]$Suite = $presence
    )

    Write-Host ""
    Write-Host "PROBE: $Name" -ForegroundColor Cyan

    $path = (Resolve-Path -LiteralPath $File).Path
    $original = [System.IO.File]::ReadAllText($path, $enc)

    if ([string]::IsNullOrEmpty($original)) {
        Write-Host "  HARNESS BROKEN: read $File as empty - refusing to write" -ForegroundColor Magenta
        return [pscustomobject]@{ Name = $Name; Outcome = "HARNESS BROKEN" }
    }
    if (-not $original.Contains($From)) {
        Write-Host "  DID NOT APPLY: pattern absent from $File" -ForegroundColor Yellow
        return [pscustomobject]@{ Name = $Name; Outcome = "DID NOT APPLY" }
    }

    $mutated = $original.Replace($From, $To)
    [System.IO.File]::WriteAllText($path, $mutated, $enc)

    $onDisk = [System.IO.File]::ReadAllText($path, $enc)
    if ($onDisk -eq $original) {
        Write-Host "  HARNESS BROKEN: file unchanged after write" -ForegroundColor Magenta
        return [pscustomobject]@{ Name = $Name; Outcome = "HARNESS BROKEN" }
    }

    try {
        $raw = & npx vitest run $Suite -t $TestName 2>&1 | Out-String
        $out = $raw -replace '\s+', ' '
    }
    finally {
        [System.IO.File]::WriteAllText($path, $original, $enc)
    }

    if ($out -match 'No test files found' -or $out -match 'Tests\s+no tests') {
        $outcome = "PROBE BROKEN (no test ran)"
        Write-Host "  $outcome" -ForegroundColor Magenta
    }
    elseif ($out -match 'Tests\s+(\d+)\s+failed') {
        $outcome = "RED ($($Matches[1]) failed)"
        Write-Host "  $outcome" -ForegroundColor Green
    }
    elseif ($out -match 'Tests\s+\d+\s+passed') {
        $outcome = "GREEN - guard useless"
        Write-Host "  $outcome" -ForegroundColor Red
    }
    else {
        $outcome = "PROBE BROKEN (unreadable summary)"
        Write-Host "  $outcome" -ForegroundColor Magenta
    }

    return [pscustomobject]@{ Name = $Name; Outcome = $outcome }
}

$SEAT = "lib/services/contest-entry/participant-seat.ts"
$MODEL = "database/models/trading/competition-participant.model.ts"
$SYNC = "lib/services/games/participant-score.service.ts"
$STATUS = "lib/services/games/round-status.service.ts"
$LOBBY = "components/games/ProviderContestLobby.tsx"
$SCORING = "lib/games/provider/scoring.ts"
$CORE = "tools/games/clear-phantom-scores-core.ts"

# ---------------------------------------------------------------------------------------
# WRITER 1: the seat builder.
# ---------------------------------------------------------------------------------------
$results += Invoke-Probe `
    -Name "seat writes score: 0 again (the original defect)" `
    -File $SEAT `
    -From "    gameKey: input.gameKey || TRADING_GAME_TYPE," `
    -To "    gameKey: input.gameKey || TRADING_GAME_TYPE,`r`n    score: 0," `
    -TestName "builds a provider seat with no score key at all"

$results += Invoke-Probe `
    -Name "seat writes score: 0 again - does the TRADING seat notice" `
    -File $SEAT `
    -From "    gameKey: input.gameKey || TRADING_GAME_TYPE," `
    -To "    gameKey: input.gameKey || TRADING_GAME_TYPE,`r`n    score: 0," `
    -TestName "builds a TRADING seat with no score key either"

# ---------------------------------------------------------------------------------------
# WRITER 2: the schema default. Aimed at the stored-document test, because a default fires
# during hydration and so cannot be seen by a test that reads through the model.
# ---------------------------------------------------------------------------------------
$results += Invoke-Probe `
    -Name "schema defaults score to 0 again" `
    -File $MODEL `
    -From @'
    score: {
      type: Number,
      required: false,
    },
'@ `
    -To @'
    score: {
      type: Number,
      required: true,
      default: 0,
    },
'@ `
    -TestName "stores nothing for score when the writer omits it"

# ---------------------------------------------------------------------------------------
# WRITER 3: the play state's `?? 0`, which is what made the lobby's own comment false.
# ---------------------------------------------------------------------------------------
$results += Invoke-Probe `
    -Name "play state defaults the score to 0 again" `
    -File $STATUS `
    -From "        participantScore: participant.score," `
    -To "        participantScore: participant.score ?? 0," `
    -TestName "reports no participant score for a seated player who has not scored"

$results += Invoke-Probe `
    -Name "hero tile renders the raw value again, so a nought reaches the screen" `
    -File $LOBBY `
    -From @'
              value={
                typeof state?.participantScore === "number"
                  ? state.participantScore.toLocaleString()
                  : "-"
              }
'@ `
    -To '              value={state ? String(state.participantScore) : "-"}' `
    -TestName "renders a dash rather than a nought on the hero tile"

# ---------------------------------------------------------------------------------------
# WRITER 4: the sync, which is the one that survives a support action rather than an entry.
# ---------------------------------------------------------------------------------------
$results += Invoke-Probe `
    -Name "sync sets a score even when no round contributed" `
    -File $SYNC `
    -From 'contributed ? { $set: { score } } : { $unset: { score: "" } },' `
    -To '{ $set: { score: score ?? 0 } },' `
    -TestName "stores no score when the only round contributed none"

# ---------------------------------------------------------------------------------------
# THE MONEY ASSERTION. Not a writer - the gate itself. Proves the owner's example is held by
# eligibility rather than by an accident of ordering.
# ---------------------------------------------------------------------------------------
$results += Invoke-Probe `
    -Name "every participant has a result, R45's gate neutered" `
    -File $SCORING `
    -From "  return Number.isFinite(participant.score);" `
    -To "  return true;" `
    -TestName "pays the owner's example correctly"

# ---------------------------------------------------------------------------------------
# THE MIGRATION'S REFUSALS. Each one is a filter clause, and a filter clause is exactly the
# thing that gets quietly widened.
# ---------------------------------------------------------------------------------------
$results += Invoke-Probe `
    -Name "cleanup ignores who actually scored" `
    -File $CORE `
    -From "        userId: { `$nin: scoringPlayers }," `
    -To "" `
    -TestName "leaves a player who has a contributing round" `
    -Suite $cleanup

$results += Invoke-Probe `
    -Name "cleanup carries its own copy of the scoring statuses" `
    -File $CORE `
    -From "      status: { `$in: SCORING_ROUND_STATUSES }," `
    -To '      status: { $in: ["completed"] },' `
    -TestName "respects every status in the shared scoring list" `
    -Suite $cleanup

$results += Invoke-Probe `
    -Name "cleanup clears any score, not only an exact zero" `
    -File $CORE `
    -From "        score: 0,`r`n        userId:" `
    -To "        score: { `$lte: 1840 },`r`n        userId:" `
    -TestName "leaves a real score alone" `
    -Suite $cleanup

$results += Invoke-Probe `
    -Name "cleanup includes settled contests" `
    -File $CORE `
    -From '.find({ gameType: "provider", status: { $nin: SETTLED_STATUSES } })' `
    -To '.find({ gameType: "provider" })' `
    -TestName "leaves a completed contest" `
    -Suite $cleanup

$results += Invoke-Probe `
    -Name "cleanup repairs an R7 mislabel instead of reporting it" `
    -File $CORE `
    -From "    const clearable = candidates.filter((row) => !isTrading(row));" `
    -To "    const clearable = candidates;" `
    -TestName "reports a trading-labelled seat on a provider contest without touching it" `
    -Suite $cleanup

$results += Invoke-Probe `
    -Name "cleanup writes without --apply" `
    -File $CORE `
    -From "    if (options.apply && clearable.length > 0) {" `
    -To "    if (clearable.length > 0) {" `
    -TestName "reports without writing anything by default" `
    -Suite $cleanup

<#
  NOT PROBED, deliberately, and recorded rather than carried as a probe that reports green.

  The exact `score: 0` filter exists TWICE in the core: once in the read that builds the
  report, and once re-asserted inside the `updateMany` so a score arriving between the read
  and the write survives. Widening the WRITE copy alone changes nothing any test can observe,
  because the read has already excluded every row with a real score - so a probe for it would
  be green on a correct file and green on a broken one, which teaches the next reader that the
  re-assertion is decoration.

  The read copy above IS probed, and it only goes red because the test asserts
  `totalClearable` - the figure an operator reads before `--apply` - rather than only what was
  written. Asserting the write alone left it green, since the second filter refused the update.
#>

Write-Host ""
Write-Host "================ SUMMARY ================" -ForegroundColor Cyan
$results | ForEach-Object { Write-Host ("  {0,-14} {1}" -f $_.Outcome, $_.Name) }
$bad = @($results | Where-Object { $_.Outcome -notlike "RED*" })
Write-Host ""
if ($bad.Count -eq 0) {
    Write-Host "All $($results.Count) probes red on the expected test." -ForegroundColor Green
}
else {
    Write-Host "$($bad.Count) probe(s) did not go red - investigate before believing any guard." -ForegroundColor Red
}
