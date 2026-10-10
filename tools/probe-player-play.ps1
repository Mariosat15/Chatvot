# Probes the player round-launch guards.
#
# Every probe reintroduces one specific defect and names the test that must go red. A probe aimed
# at the wrong test is indistinguishable from a test that does not work, so the harness reports
# whether the RED test is the expected one rather than merely that something failed.
#
# Watch the FAILURE COUNT as well as the colour. An honest probe turns 1 or 2 tests red; 5 or more
# for a one-line change means the harness has broken the file rather than the guard - which is
# exactly what happened on 5 Sep 2026 when a `[roundId]` path was read without -LiteralPath.

$ErrorActionPreference = 'Continue'

$UiSuite = '__tests__/games/provider-play-ui.test.ts'
$MsgSuite = '__tests__/games/provider-frame-messages.test.ts'
$StateSuite = '__tests__/games/play-state.test.ts'

$PlayPage = 'app/(root)/competitions/[id]/play/page.tsx'
$Host_ = 'components/games/ProviderRoundHost.tsx'
$Frame = 'components/games/ProviderGameFrame.tsx'
$Messages = 'components/games/provider-frame-messages.ts'
$Preflight = 'components/games/RoundPreflight.tsx'
$ClientState = 'components/games/play-state.ts'
$EntryButton = 'components/trading/CompetitionEntryButton.tsx'
$TradePage = 'app/(root)/competitions/[id]/trade/page.tsx'
$RoundsRoute = 'app/api/competitions/[id]/rounds/route.ts'
$StatusSvc = 'lib/services/games/round-status.service.ts'

function Relax([string]$literal) {
  [regex]::Escape($literal) -replace '\r?\n', '\r?\n'
}

function Probe {
  param(
    [string]$Name,
    [string]$File,
    [string]$Find,
    [string]$Replace,
    [string]$Suite,
    [string]$ExpectRed
  )

  # -LiteralPath on the READ as well as the write. These are Next.js dynamic routes, so the paths
  # contain `[competitionId]` and `[id]`, which PowerShell parses as wildcard character classes.
  # A plain `Get-Content $File` returns $null, and `Set-Content -LiteralPath` then writes that
  # $null back - destroying the file while every probe reports RED on the expected test.
  $original = Get-Content -LiteralPath $File -Raw
  if ([string]::IsNullOrWhiteSpace($original)) {
    Write-Host "  [CANNOT READ FILE - ABORTING PROBE] $Name ($File)" -ForegroundColor Magenta
    return
  }

  $patched = [regex]::Replace($original, (Relax $Find), $Replace.Replace('$', '$$'), 1)

  # Confirm the file actually changed before believing any outcome. A pattern that fails to
  # apply leaves the suite green and reads exactly like a test that does not work.
  if ($patched -eq $original) {
    Write-Host "  [PROBE DID NOT APPLY] $Name" -ForegroundColor Magenta
    return
  }

  Set-Content -LiteralPath $File -Value $patched -NoNewline
  try {
    $out = npx vitest run $Suite --reporter=verbose 2>&1 | Out-String
    # Collapse whitespace before matching: Out-String wraps at the console width, so a long test
    # name arrives split across two lines and a literal match silently misses it.
    $flat = ($out -replace '\s+', ' ')

    $failed = 0
    if ($flat -match 'Tests (\d+) failed') { $failed = [int]$Matches[1] }

    if ($failed -gt 0) {
      $hit = if ($flat -match [regex]::Escape(($ExpectRed -replace '\s+', ' '))) {
        'expected test'
      } else { 'OTHER test' }
      Write-Host ("  [RED: {0} failed, {1}] {2}" -f $failed, $hit, $Name) -ForegroundColor Green
    } else {
      Write-Host "  [STILL GREEN - GUARD IS NOT WORKING] $Name" -ForegroundColor Red
    }
  } finally {
    Set-Content -LiteralPath $File -Value $original -NoNewline
  }
}

Write-Host "`n=== an attempt must not be spent by a page load ===" -ForegroundColor Cyan

Probe -Name 'the play page launches a round while rendering' `
  -File $PlayPage `
  -Find '  const outcome = await getPlayState(competitionId, session.user.id);' `
  -Replace '  const outcome = await getPlayState(competitionId, session.user.id);
  await launchContestRound(competitionId, { userId: session.user.id });' `
  -Suite $UiSuite `
  -ExpectRed 'the play page does not launch a round while rendering'

Probe -Name 'the GET handler reaches the launch path, so polling burns attempts' `
  -File $RoundsRoute `
  -Find '    const outcome = await getPlayState(competitionId, session.user.id);' `
  -Replace '    const outcome = await getPlayState(competitionId, session.user.id);
    await launchContestRound(competitionId, { userId: session.user.id });' `
  -Suite $UiSuite `
  -ExpectRed 'the GET handler exists beside the POST and is the one the client polls'

Write-Host "`n=== the user id must come from the session ===" -ForegroundColor Cyan

Probe -Name 'the GET handler takes the user id from the query string' `
  -File $RoundsRoute `
  -Find '    const outcome = await getPlayState(competitionId, session.user.id);' `
  -Replace '    const outcome = await getPlayState(competitionId, new URL(_request.url).searchParams.get("userId") ?? "");' `
  -Suite $UiSuite `
  -ExpectRed 'both handlers read the id off the session'

Probe -Name 'the play state stops scoping rounds to the caller' `
  -File $StatusSvc `
  -Find '    const rounds = await GameRound.find({
      contestId: contest._id,
      userId,
    })' `
  -Replace '    const rounds = await GameRound.find({
      contestId: contest._id,
    })' `
  -Suite $StateSuite `
  -ExpectRed "never returns another player's rounds or score"

Write-Host "`n=== no score from the browser ===" -ForegroundColor Cyan

Probe -Name 'the message parser passes a score through' `
  -File $Messages `
  -Find '  return {
    type: candidate.type as ProviderFrameMessageType,
    height: typeof candidate.height === "number" ? candidate.height : undefined,
  };' `
  -Replace '  return {
    ...(data as object),
    type: candidate.type as ProviderFrameMessageType,
    height: typeof candidate.height === "number" ? candidate.height : undefined,
  };' `
  -Suite $MsgSuite `
  -ExpectRed 'strips a score off a finished message'

Probe -Name 'the allowlist becomes an object, reopening the prototype hole' `
  -File $Messages `
  -Find '  if (
    !(PROVIDER_FRAME_MESSAGE_TYPES as readonly string[]).includes(candidate.type)
  ) {
    return null;
  }' `
  -Replace '  const lookup: Record<string, boolean> = { ready: true, finished: true, exit: true, resize: true };
  if (!lookup[candidate.type]) {
    return null;
  }' `
  -Suite $MsgSuite `
  -ExpectRed 'rejects prototype-chain keys instead of treating them as message types'

Probe -Name 'the height is used unclamped' `
  -File $Messages `
  -Find '  if (!Number.isFinite(height)) return MIN_FRAME_HEIGHT;
  return Math.min(MAX_FRAME_HEIGHT, Math.max(MIN_FRAME_HEIGHT, Math.round(height)));' `
  -Replace '  return Math.round(height);' `
  -Suite $MsgSuite `
  -ExpectRed 'clamps a height into a range a page can survive'

Probe -Name 'a javascript: launch URL is accepted as an origin' `
  -File $Messages `
  -Find '    if (url.protocol !== "https:" && url.protocol !== "http:") return null;' `
  -Replace '' `
  -Suite $MsgSuite `
  -ExpectRed 'refuses a launch URL that is not absolute http(s)'

Write-Host "`n=== the frame is supervised ===" -ForegroundColor Cyan

Probe -Name 'the frame stops checking which window sent the message' `
  -File $Frame `
  -Find '      if (event.source !== frameRef.current?.contentWindow) return;' `
  -Replace '' `
  -Suite $UiSuite `
  -ExpectRed 'checks both the source window and the origin of every message'

Probe -Name 'the frame stops checking the origin' `
  -File $Frame `
  -Find '      if (event.origin !== expectedOrigin) {' `
  -Replace '      if (false) {' `
  -Suite $UiSuite `
  -ExpectRed 'checks both the source window and the origin of every message'

Probe -Name 'the sandbox gains top navigation' `
  -File $Frame `
  -Find 'sandbox="allow-scripts allow-same-origin allow-forms"' `
  -Replace 'sandbox="allow-scripts allow-same-origin allow-forms allow-top-navigation"' `
  -Suite $UiSuite `
  -ExpectRed 'sandboxes the frame without top navigation or popups'

# Aimed at the RENDER guard specifically - the two-space indent and the brace distinguish it from
# the listener's `if (!expectedOrigin) return;`. The first version of the test could not tell the
# two apart and stayed green through exactly this patch.
Probe -Name 'the frame renders even when the launch URL has no verifiable origin' `
  -File $Frame `
  -Find '  if (!expectedOrigin) {' `
  -Replace '  if (false) {' `
  -Suite $UiSuite `
  -ExpectRed 'refuses to render a frame whose launch URL has no verifiable origin'

Probe -Name 'the message listener attaches even with no origin to check against' `
  -File $Frame `
  -Find '    if (!expectedOrigin) return;' `
  -Replace '    if (false) return;' `
  -Suite $UiSuite `
  -ExpectRed 'refuses to render a frame whose launch URL has no verifiable origin'

Write-Host "`n=== a provider contest must not reach the trading workspace ===" -ForegroundColor Cyan

Probe -Name 'the trading page loses its provider guard' `
  -File $TradePage `
  -Find '  if (isProviderContest(competition)) {' `
  -Replace '  if (false) {' `
  -Suite $UiSuite `
  -ExpectRed 'the trading page redirects a provider contest to the play route'

Probe -Name 'the play route bounces a seatless player to /trade, forming a loop' `
  -File $PlayPage `
  -Find '    if (outcome.refusal === "not_provider_contest") {
      redirect(`/competitions/${competitionId}/trade`);
    }' `
  -Replace '    if (outcome.refusal === "not_provider_contest") {
      redirect(`/competitions/${competitionId}/trade`);
    }
    if (outcome.refusal === "not_a_participant") {
      redirect(`/competitions/${competitionId}/trade`);
    }' `
  -Suite $UiSuite `
  -ExpectRed 'cannot form a redirect loop with the play route'

Probe -Name 'the CTA sends a provider contest to the trading workspace' `
  -File $EntryButton `
  -Find '                  href={
                    isProviderGame
                      ? `/competitions/${competition._id}/play`
                      : `/competitions/${competition._id}/trade`
                  }' `
  -Replace '                  href={`/competitions/${competition._id}/trade`}' `
  -Suite $UiSuite `
  -ExpectRed 'the contest CTA sends a provider contest to play and a trading contest to trade'

Probe -Name 'the trade-history button is offered on a provider contest again' `
  -File $EntryButton `
  -Find '              {!isProviderGame && (' `
  -Replace '              {true && (' `
  -Suite $UiSuite `
  -ExpectRed 'does not offer a trade-history button on a provider contest'

Write-Host "`n=== the pre-flight must be honest about the cost ===" -ForegroundColor Cyan

Probe -Name 'a live round is labelled Play, implying a second attempt is spent' `
  -File $Preflight `
  -Find '          : resuming
            ? "Resume your round"' `
  -Replace '          : resuming
            ? "Play"' `
  -Suite $UiSuite `
  -ExpectRed 'offers resume rather than play when a round is already live'

Probe -Name 'the button stops disabling itself when attempts run out' `
  -File $Preflight `
  -Find '        disabled={launching || exhausted || windowClosed}' `
  -Replace '        disabled={launching}' `
  -Suite $UiSuite `
  -ExpectRed 'disables the control when there is nothing left to spend'

Write-Host "`n=== the two copies of the play state must agree ===" -ForegroundColor Cyan

Probe -Name 'the client copy of PlayState drifts from the server copy' `
  -File $ClientState `
  -Find '  attemptsRemaining: number;' `
  -Replace '  attemptsLeft: number;' `
  -Suite $UiSuite `
  -ExpectRed 'declares the same fields on both sides of the wire'

Probe -Name 'the server copy of PlayerRoundView gains a field the client lacks' `
  -File $StatusSvc `
  -Find '  /** True while a result may still arrive for this round. */
  isLive: boolean;' `
  -Replace '  /** True while a result may still arrive for this round. */
  isLive: boolean;
  providerRoundId?: string;' `
  -Suite $UiSuite `
  -ExpectRed 'declares the same fields on both sides of the wire'

Write-Host "`nDone.`n" -ForegroundColor Cyan
