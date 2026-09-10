# Probes the tasks 21-24 guards: one player's game performance on the admin user panel.
#
# Each probe reintroduces one defect, runs ONE named test, and expects it red with exactly one
# failure. A probe that turns five tests red is reporting harness damage rather than a working
# guard, which is why the failing test names are printed rather than counted.
#
# CONVENTIONS THAT HAVE EACH COST A FALSE RESULT IN THIS REPOSITORY BEFORE:
#   - UTF-8 without a BOM on the read AND the write, `-LiteralPath` on both, newlines relaxed
#     to `\r?\n`, and a refusal to write when the replacement did not apply. DID NOT APPLY
#     means the target moved, never that the run was quiet.
#   - The expected test is named and run alone with `-t`. A probe aimed at the wrong test is
#     indistinguishable from a test that does not work.
#   - `[roundId]`-style path segments are a PowerShell wildcard class, so `-LiteralPath` is
#     load-bearing here: `app/api/users/[userId]/performance/route.ts` reads as $null without
#     it, and a probe that empties the file it is restoring reports damage as success.
#
# PROBE 1 IS THE ONE THAT MATTERS, because it restores the actual defect: the games block
# inside the `totalTrades === 0` branch. Every other probe here protects a property; that one
# protects the reason the slice exists, and a test merely asserting the panel renders the
# component is GREEN against it.

$ErrorActionPreference = 'Continue'
$root = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $root

$enc = New-Object System.Text.UTF8Encoding $false

$PANEL     = "apps/admin/components/admin/UserFullDetailPanel.tsx"
$COMPONENT = "apps/admin/components/admin/games/PlayerGamePerformance.tsx"
$SERVICE   = "apps/admin/lib/services/games/player-game-performance.service.ts"
$ROUTE     = "apps/admin/app/api/users/[userId]/performance/route.ts"
$TYPES     = "lib/services/games/round-types.ts"
$INGEST    = "lib/services/games/participant-score.service.ts"

$GUARD = "__tests__/admin/player-game-performance.test.ts"

function Read-File([string]$rel) {
  return [System.IO.File]::ReadAllText((Join-Path $root $rel), $enc)
}

function Write-File([string]$rel, [string]$text) {
  [System.IO.File]::WriteAllText((Join-Path $root $rel), $text, $enc)
}

# Escapes the pattern, then relaxes every newline, so a CRLF pattern matches an LF file.
function To-Relaxed([string]$literal) {
  return ([regex]::Escape($literal) -replace '\\r\\n', '\r?\n') -replace '\\n', '\r?\n'
}

function Invoke-Probe {
  param(
    [string]$Name,
    [string]$File,
    [string]$Find,
    [string]$Replace,
    [string]$ExpectTest
  )

  $original = Read-File $File

  # A read that came back empty means the path was mangled, not that the file is empty. Writing
  # the mutation then destroys it and every probe reports red for the wrong reason.
  if ([string]::IsNullOrWhiteSpace($original)) {
    Write-Host "  UNREADABLE     $Name  <-- $File came back empty; fix the path" -ForegroundColor Magenta
    return
  }

  $pattern = To-Relaxed $Find
  $mutated = [regex]::Replace($original, $pattern, { param($m) $Replace }, 1)

  if ($mutated -eq $original) {
    Write-Host "  DID NOT APPLY  $Name" -ForegroundColor Magenta
    Write-Host "                 (the target moved - fix the probe, do not assume a pass)"
    return
  }

  Write-File $File $mutated
  try {
    $out = & npx vitest run $GUARD -t $ExpectTest --reporter=verbose 2>&1 | Out-String
  } finally {
    Write-File $File $original
  }

  # Collapse whitespace per line: `Out-String` wraps at the console width, so a long test name
  # arrives split across two lines and a literal match silently misses it.
  $flat = ($out -split "`n" | ForEach-Object { ($_ -replace '\s+', ' ').Trim() }) -join "`n"

  $failed = [regex]::Matches($flat, '(?m)^\s*(?:FAIL|×)\s+(.+)$') |
            ForEach-Object { $_.Groups[1].Value } |
            Sort-Object -Unique

  if ($flat -match 'Tests\s+(\d+)\s+failed') {
    $count = [int]$Matches[1]
    if ($count -eq 1) {
      Write-Host "  RED (1)        $Name" -ForegroundColor Green
    } else {
      Write-Host "  RED ($count)  $Name  <-- more than one; read the names" -ForegroundColor Yellow
      $failed | ForEach-Object { Write-Host "                 $_" }
    }
  } else {
    Write-Host "  GREEN          $Name  <-- THE GUARD DID NOT CATCH IT" -ForegroundColor Red
  }
}

Write-Host ""
Write-Host "Tasks 21-24 - a player's game performance, measured on what the game reports" -ForegroundColor Cyan
Write-Host ""

# ---- The defect itself -----------------------------------------------------------------

Invoke-Probe -Name "the games block goes back inside the no-trades branch" `
  -File $PANEL `
  -Find  "                        </Card>`n                        <PlayerGamePerformance games={perfGames} />`n                      </>" `
  -Replace "                        </Card>`n                      </>" `
  -ExpectTest "renders the games component on both sides of the trades gate"

Invoke-Probe -Name "the trading figures lose their trading heading" `
  -File $PANEL `
  -Find  "                          Trading Performance" `
  -Replace "                          Client Performance" `
  -ExpectTest "keeps the trading figures labelled as trading"

# ---- Which rounds produced a score -----------------------------------------------------

Invoke-Probe -Name "a voided round counts as scored" `
  -File $SERVICE `
  -Find  "                  { `$isNumber: `"`$rawScore`" },`n                  { `$in: [`"`$status`", SCORE_PRODUCING_ROUND_STATUSES] }," `
  -Replace "                  { `$isNumber: `"`$rawScore`" }," `
  -ExpectTest "does not count a voided round"

Invoke-Probe -Name "a voided round can be nominated as their best" `
  -File $SERVICE `
  -Find  "    status: { `$in: SCORE_PRODUCING_ROUND_STATUSES }," `
  -Replace "" `
  -ExpectTest "does not count a voided round"

Invoke-Probe -Name "a partial run stops counting" `
  -File $TYPES `
  -Find  "  `"completed`",`n  `"expired`",`n  `"abandoned`",`n];" `
  -Replace "  `"completed`",`n];" `
  -ExpectTest "counts a partial run, because a partial run counts"

Invoke-Probe -Name "the ingestion path keeps its own copy of the list" `
  -File $INGEST `
  -Find  "export const SCORING_ROUND_STATUSES: RoundStatus[] = [`n  ...SCORE_PRODUCING_ROUND_STATUSES,`n];" `
  -Replace "export const SCORING_ROUND_STATUSES: RoundStatus[] = [`n  `"completed`",`n  `"expired`",`n];" `
  -ExpectTest "the ingestion path's list IS the shared list"

# ---- Best score, in the right direction ------------------------------------------------

Invoke-Probe -Name "every title ranks upward" `
  -File $SERVICE `
  -Find  "    .sort({ rawScore: direction === `"lower_is_better`" ? 1 : -1 })" `
  -Replace "    .sort({ rawScore: -1 })" `
  -ExpectTest "takes the lowest on a lower-is-better title"

Invoke-Probe -Name "the direction falls back to the title's absence rather than the default" `
  -File $SERVICE `
  -Find  "      const scoreDirection = title?.scoreDirection ?? `"higher_is_better`";" `
  -Replace "      const scoreDirection = title?.scoreDirection ?? `"lower_is_better`";" `
  -ExpectTest "still reports a game whose catalogue row has gone"

# ---- Absence is not zero ---------------------------------------------------------------

Invoke-Probe -Name "an absent score is reported as nought" `
  -File $SERVICE `
  -Find  "        bestScore: best?.rawScore ?? null," `
  -Replace "        bestScore: best?.rawScore ?? 0," `
  -ExpectTest "reports no score as null rather than as zero"

Invoke-Probe -Name "a genuine nought is collapsed into absence" `
  -File $SERVICE `
  -Find  "        bestScore: best?.rawScore ?? null," `
  -Replace "        bestScore: best?.rawScore || null," `
  -ExpectTest "keeps a genuine zero, which is a real result"

# ---- Practice, and other people's rounds -----------------------------------------------

Invoke-Probe -Name "practice rounds are counted as performance" `
  -File $SERVICE `
  -Find  "    { `$match: { userId: userId.trim(), mode: `"ranked`" } }," `
  -Replace "    { `$match: { userId: userId.trim() } }," `
  -ExpectTest "excludes practice rounds entirely"

# ---- The metrics come from the game ----------------------------------------------------

Invoke-Probe -Name "the breakdown is taken from the latest round instead of the best" `
  -File $SERVICE `
  -Find  "        bestRoundBreakdown: hasEntries(best?.scoreBreakdown)" `
  -Replace "        bestRoundBreakdown: hasEntries(aggregate.lastBreakdown)" `
  -ExpectTest "carries the best round's own breakdown, verbatim"

Invoke-Probe -Name "an empty breakdown is treated as a breakdown" `
  -File $SERVICE `
  -Find  "    Object.keys(value as Record<string, unknown>).length > 0" `
  -Replace "    true" `
  -ExpectTest "reports an empty breakdown as null so the empty state can be shown"

Invoke-Probe -Name "the component grows a metric label table" `
  -File $COMPONENT `
  -Find  "                  const metric = humanizeMetric(key, value);" `
  -Replace "                  const METRIC_LABELS: Record<string, string> = { bestLapMs: `"Best Lap`" };`n                  const metric = { label: METRIC_LABELS[key] ?? key, value: String(value) };" `
  -ExpectTest "labels metrics through the shared humaniser only"

Invoke-Probe -Name "the component re-derives the category from the slug" `
  -File $COMPONENT `
  -Find  "                    {game.category.label}" `
  -Replace "                    {resolveGameCategory(game.category.slug)?.label}" `
  -ExpectTest "does not re-derive the category"

Invoke-Probe -Name "the service branches on which game it is looking at" `
  -File $SERVICE `
  -Find  "      const derivedCode = gameKey.split(`":`")[2] ?? gameKey;" `
  -Replace "      const derivedCode = gameKey === `"provider:x:y`" ? `"racing`" : gameKey.split(`":`")[2] ?? gameKey;" `
  -ExpectTest "the service names no game and no category"

Invoke-Probe -Name "task 23's empty state is dropped" `
  -File $COMPONENT `
  -Find  "                Detailed performance metrics are not available for this game." `
  -Replace "                No data." `
  -ExpectTest "carries task 23's empty state"

# ---- Labels ----------------------------------------------------------------------------

Invoke-Probe -Name "a retired title is captioned Unknown" `
  -File $SERVICE `
  -Find  "        title: title?.displayName ?? title?.gameCode ?? derivedCode," `
  -Replace "        title: title?.displayName ?? `"Unknown game`"," `
  -ExpectTest "still reports a game whose catalogue row has gone"

# ---- Authorization ---------------------------------------------------------------------

Invoke-Probe -Name "the route is guarded by being an admin at all" `
  -File $ROUTE `
  -Find  "    const guard = await guardSection(`"users`");`n    if (!guard.ok) return guard.response;" `
  -Replace "    const auth = await verifyAdminAuth();`n    if (!auth.authorized) return auth.response;" `
  -ExpectTest "every exported handler is behind guardSection"

Invoke-Probe -Name "the route is granted by the wrong section" `
  -File $ROUTE `
  -Find  "    const guard = await guardSection(`"users`");" `
  -Replace "    const guard = await guardSection(`"analytics`");" `
  -ExpectTest "every exported handler is behind guardSection"

# ---- The two mirrors -------------------------------------------------------------------

Invoke-Probe -Name "the two copies of round-types.ts drift" `
  -File $TYPES `
  -Find  "export type ScoreProducingRoundStatus" `
  -Replace "export type ScoreProducingStatus" `
  -ExpectTest "both copies of round-types.ts are byte-identical"

Invoke-Probe -Name "the two humanisers drift" `
  -File "lib/utils/humanize-metric.ts" `
  -Find  "const UNIT_SUFFIXES" `
  -Replace "const UNITS" `
  -ExpectTest "both copies of humanize-metric.ts are byte-identical"

Write-Host ""
