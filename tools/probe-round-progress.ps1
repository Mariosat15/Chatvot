# Probes for "it is not showing live the boards the user finished".
#
# WHAT THIS SLICE DID, 11 September 2026: there was no mid-round reporting anywhere on either
# side of the provider seam, so a contest board could say a player was playing and nothing more,
# however many boards they had solved. The game now posts its own figures after each solved
# board and the platform stores them on `game_round.scoreBreakdown`.
#
# THE CLAIM WORTH PROBING ABOVE ALL OTHERS is that this is not a second scoring door. Chapter 02
# section 10 rule 3 says scores enter through exactly one function; there is now a second
# authenticated write onto a round, and the probes below exist to prove it cannot become one.
#
# Conventions carried from the earlier harnesses in this folder, each of which cost a false
# result once:
#
#   * UTF-8 WITHOUT a BOM on the read AND the write. PowerShell 5.1's `Get-Content -Raw` decodes
#     with the system ANSI codepage and writes the mojibake back.
#   * `-LiteralPath` semantics via `System.IO.File`, because one path here contains
#     `[providerKey]` and PowerShell parses that as a wildcard character class - emptying the
#     route and reporting success.
#   * Refuse to write when the read came back empty.
#   * Relax newlines in the pattern - a CRLF pattern never matches an LF file.
#   * Run the expected test ALONE with `-t` and read the summary counts.
#   * `-t` IS A REGULAR EXPRESSION. Every expected name below is plain ASCII with no brackets.
#   * DID NOT APPLY means the target moved, never that the run was quiet.
#
# A MUTATION MUST CHANGE AN OBSERVABLE, which is the fourth cause of a green probe after a weak
# test, a wrong claim and an unreachable guard. Several probes below deliberately inject a CALL
# rather than an import, because an assertion banning `foo(` is untouched by a line reading
# `foo }`.

$ErrorActionPreference = 'Continue'
$Root = Split-Path -Parent $PSScriptRoot
$DefaultSuite = '__tests__/games/round-progress.test.ts'

$Utf8NoBom = New-Object System.Text.UTF8Encoding($false)

function Read-Source([string]$Path) {
  [System.IO.File]::ReadAllText($Path, [System.Text.UTF8Encoding]::new($false))
}

function Write-Source([string]$Path, [string]$Text) {
  if ([string]::IsNullOrEmpty($Text)) {
    throw "refusing to write an empty file to $Path"
  }
  [System.IO.File]::WriteAllText($Path, $Text, $Utf8NoBom)
}

function To-Relaxed([string]$Literal) {
  [regex]::Escape($Literal) -replace '(\\r)?\\n', '\r?\n'
}

function Invoke-Probe {
  param(
    [string]$Name,
    [string]$File,
    [string]$Find,
    [string]$Replace,
    [string]$ExpectTest,
    [string]$Suite = $DefaultSuite
  )

  $path = Join-Path $Root $File
  $original = Read-Source $path
  if ([string]::IsNullOrEmpty($original)) {
    Write-Host "[$Name] UNREADABLE - $File came back empty, refusing to probe" -ForegroundColor Magenta
    return
  }

  $mutated = [regex]::Replace($original, (To-Relaxed $Find), { param($m) $Replace }, 1)

  if ($mutated -eq $original) {
    Write-Host "[$Name] DID NOT APPLY - the target moved, so nothing was tested" -ForegroundColor Magenta
    return
  }

  Write-Source $path $mutated
  try {
    $out = & npx vitest run $Suite -t $ExpectTest 2>&1 | Out-String
    $flat = ($out -replace '\s+', ' ')
    if ($flat -match 'Tests\s+(\d+)\s+failed') {
      $failed = [int]$Matches[1]
      if ($failed -eq 1) {
        Write-Host "[$Name] RED (1 failure, as expected)" -ForegroundColor Green
      } else {
        Write-Host "[$Name] RED but $failed failures - blast radius, check the probe" -ForegroundColor Yellow
      }
    } elseif ($flat -match 'No test found' -or $flat -match 'Tests\s+no tests') {
      Write-Host "[$Name] NO TEST RAN - wrong test name, or wrong suite" -ForegroundColor Magenta
    } else {
      Write-Host "[$Name] GREEN - the guard is absent, weak, unreachable, or changes no observable" -ForegroundColor Red
    }
  } finally {
    Write-Source $path $original
  }
}

$Service = 'lib/services/games/round-progress.service.ts'
$Route = 'app/api/games/providers/[providerKey]/progress/route.ts'
$Launch = 'lib/services/games/round-launch.service.ts'
$Activity = 'lib/services/games/contest-activity.service.ts'
$Model = 'database/models/games/game-round.model.ts'
$GsProgress = 'games-service/src/callback/progress.ts'
$GsPlay = 'games-service/src/rounds/play.ts'
$Contract = 'apps/admin/lib/services/game-providers/contract.ts'

Write-Host ''
Write-Host '=== It is not a second scoring door ===' -ForegroundColor Cyan

# THE ONE THAT MATTERS. A spread names no forbidden field and writes every field the provider
# sent, which is exactly how `rawScore` arrives one day. The assertion is a shape, not a ban.
Invoke-Probe -Name 'the update spreads what the provider sent' -File $Service `
  -Find '    { $set: { scoreBreakdown: breakdown, progressAt: new Date() } },' `
  -Replace '    { $set: { ...breakdown, progressAt: new Date() } },' `
  -ExpectTest 'writes two named paths and builds them from nothing the provider chose'

# The direct form of the same defect: a second path on the update.
Invoke-Probe -Name 'a score is written beside the breakdown' -File $Service `
  -Find '    { $set: { scoreBreakdown: breakdown, progressAt: new Date() } },' `
  -Replace '    { $set: { scoreBreakdown: breakdown, rawScore: 0, progressAt: new Date() } },' `
  -ExpectTest 'names none of the fields that decide money or position'

# A live gate that is not there means a finished round's breakdown can be overwritten by a late
# report carrying no score - so the board and the payout describe different runs.
Invoke-Probe -Name 'a finished round is accepted' -File $Service `
  -Find '  if (!LIVE_ROUND_STATUSES.includes(round.status)) {' `
  -Replace '  if (false) {' `
  -ExpectTest 'a round that is no longer live is refused'

# The route re-implementing verification is the drift the thin route exists to prevent, and it
# is how the two endpoints come to disagree about what a valid request is. Injected as a CALL:
# an import line would satisfy a ban written against `loadProviderSecrets }`.
Invoke-Probe -Name 'the route verifies for itself' -File $Route `
  -Find '    const outcome = await recordRoundProgress({ providerKey, rawBody, headers });' `
  -Replace '    await loadProviderSecrets(providerKey);
    const outcome = await recordRoundProgress({ providerKey, rawBody, headers });' `
  -ExpectTest 'the route decides nothing and cannot reach the ingestion door'

Write-Host ''
Write-Host '=== What a report may carry ===' -ForegroundColor Cyan

# Storing a nested object renders `[object Object]` on a board, and the alternative - the
# platform deciding how to flatten a provider's structure - is per-game code.
Invoke-Probe -Name 'objects and arrays are stored too' -File $Service `
  -Find '      typeof value === "string" ||
      typeof value === "boolean" ||
      (typeof value === "number" && Number.isFinite(value))' `
  -Replace '      value !== undefined' `
  -ExpectTest 'drops what cannot be rendered rather than flattening it'

Invoke-Probe -Name 'a prototype key is kept' -File $Service `
  -Find '    if (key === "__proto__" || key === "constructor" || key === "prototype") continue;' `
  -Replace '    if (false) continue;' `
  -ExpectTest 'refuses a key that would write through the prototype'

# Without the cap one document grows on every board until 16MB refuses the write - a store that
# fills up by SUCCEEDING, which is the `brandingFiles` failure in a new place.
Invoke-Probe -Name 'the cap is removed' -File $Service `
  -Find '    if (count >= MAX_PROGRESS_ENTRIES) break;' `
  -Replace '    if (false) break;' `
  -ExpectTest 'caps how much one report can store'

# An empty object is truthy, so it passes the `!breakdown` refusal and is stored - blanking a
# board's activity line with a report that contained nothing.
Invoke-Probe -Name 'an empty report becomes an empty object' -File $Service `
  -Find '  return count > 0 ? kept : null;' `
  -Replace '  return kept;' `
  -ExpectTest 'an empty or unrenderable report is nothing, not an empty object'

Write-Host ''
Write-Host '=== The status codes are a retry instruction ===' -ForegroundColor Cyan

# A silent 200 for a round we cannot find hides a game pointed at the wrong environment for good.
Invoke-Probe -Name 'a missing round reports success' -File $Route `
  -Find '    case "round_not_found":
      return 404;' `
  -Replace '    case "round_not_found":
      return 200;' `
  -ExpectTest 'says so in the status codes'

# One log line per refused board turns a misconfigured game into a flood that buries the
# warnings that matter - on the highest-rate provider route there is.
Invoke-Probe -Name 'every refusal is logged' -File $Route `
  -Find '    return NextResponse.json(
      {
        received: outcome.accepted,' `
  -Replace '    if (!outcome.accepted) console.warn("refused", outcome.result);
    return NextResponse.json(
      {
        received: outcome.accepted,' `
  -ExpectTest 'and does not log one line per refused board'

Write-Host ''
Write-Host '=== The address is always offered ===' -ForegroundColor Cyan

# Withholding the URL means a provider who adds progress reporting needs a config change on OUR
# side before their feature can work - and nothing tells them that is what is missing.
Invoke-Probe -Name 'the URL is sent conditionally' -File $Launch `
  -Find '      progressCallbackUrl: `${baseUrl}/api/games/providers/${config.providerKey}/progress`,' `
  -Replace '      ...(false ? { progressCallbackUrl: "" } : {}),' `
  -ExpectTest 'supplies it at launch beside the result callback'

Invoke-Probe -Name 'the two contracts drift' -File $Contract `
  -Find '  progressCallbackUrl?: string;' `
  -Replace '  progressCallbackUrl?: string | null;' `
  -ExpectTest 'the two apps carry the same contract'

Write-Host ''
Write-Host '=== A live player moves up the feed ===' -ForegroundColor Cyan

# Without this every live player's entry is frozen at the moment they pressed Play, so a contest
# in which four people have each just solved a board orders them by who started first.
Invoke-Probe -Name 'the feed ignores the progress report' -File $Activity `
  -Find '  return row.completedAt ?? row.progressAt ?? row.startedAt ?? row.createdAt;' `
  -Replace '  return row.completedAt ?? row.startedAt ?? row.createdAt;' `
  -ExpectTest 'the feed orders on the progress report, under the result and over the start'

# A field absent from the projection arrives `undefined`, so the coalesce above silently skips
# it and every assertion about ordering still passes.
Invoke-Probe -Name 'the projection omits it' -File $Activity `
  -Find 'progressAt ' `
  -Replace '' `
  -ExpectTest 'and the query actually selects it'

# Strict mode discards a field the schema does not declare, while the service reports success -
# the mirror-drift failure from the one-writer direction.
Invoke-Probe -Name 'one model copy loses the field' -File $Model `
  -Find '  progressAt: { type: Date },' `
  -Replace '' `
  -ExpectTest 'the field is declared on both copies of the model'

Write-Host ''
Write-Host '=== The game never waits for us ===' -ForegroundColor Cyan

# An await here is a visible stall between solving a board and being handed the next one, in a
# round the player PAID for.
Invoke-Probe -Name 'the send is awaited' -File $GsPlay `
  -Find '  void sendProgress(round);' `
  -Replace '  await sendProgress(round);' `
  -ExpectTest 'starts the send and does not wait for it'

# The finishing branch is already delivering a result with the same figures and a score beside
# them, and the platform refuses progress for a round that is no longer live - so a send there
# is a guaranteed refusal, warned about, on every completed round.
Invoke-Probe -Name 'progress is sent when the round finishes too' -File $GsPlay `
  -Find '    await round.save();
    await finishRound(round.roundId, { status: "completed", at: now });' `
  -Replace '    await round.save();
    void sendProgress(round);
    await finishRound(round.roundId, { status: "completed", at: now });' `
  -ExpectTest 'and not on the branch that finishes the round'

Invoke-Probe -Name 'a failed send throws behind the player' -File $GsProgress `
  -Find '  } catch (error) {' `
  -Replace '  } catch (error) {
    throw error;' `
  -ExpectTest 'never rejects, so there is no unhandled rejection behind the player'

# A second "progress breakdown" drifts the moment either changes, and a board saying five solved
# beside a result saying four is worse than a board saying nothing.
Invoke-Probe -Name 'the figures are hand-rolled' -File $GsProgress `
  -Find '    return scoreRound(title, round.config as unknown as RoundConfig, boards).breakdown ?? null;' `
  -Replace '    return { boardsCompleted: boards.filter((b) => b.solvedAt).length };' `
  -ExpectTest 'computes the figures with the same function the result uses'

# A score arriving outside the one result callback is the second door, from the other side.
Invoke-Probe -Name 'a score is sent with the progress' -File $GsProgress `
  -Find '    roundId: round.roundId,
    providerRoundId: round.providerRoundId,
    breakdown,' `
  -Replace '    roundId: round.roundId,
    providerRoundId: round.providerRoundId,
    score: 1,
    breakdown,' `
  -ExpectTest 'sends no score, only the display figures'

Write-Host ''
Write-Host 'Done. Every line should read RED with exactly 1 failure.' -ForegroundColor Cyan
