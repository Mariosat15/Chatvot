# Probes for the HTTP API guards. Run with: pwsh -File tools/probe-api.ps1
#
# Each probe removes exactly one guard and asserts that the test written for it goes red. A test
# that has only ever passed proves nothing, and the specification's most important requirements -
# idempotency, the fairness seed, every round reaching a terminal state - are all invisible when
# broken. Nothing errors, nothing logs; a contest is simply unfair or unsettleable.
#
# ONE GUARD IS DELIBERATELY NOT PROBED, AND IT IS WORTH SAYING WHY.
# "a score sent by the client is ignored entirely" cannot be probed by deleting a line, because the
# guard is the ABSENCE of code: no path reads a score off the request. That is stronger than a check
# - a check can be bypassed, an absent field cannot be read - but it also means there is nothing to
# remove. The test still earns its place as a regression guard for the day somebody adds one.

. "$PSScriptRoot/probe-harness.ps1"

# The two suites. Named with a `Suite` prefix rather than `$API` / `$PLAY` for a reason that cost a
# whole probe run: PowerShell variable names are CASE-INSENSITIVE, so `$PLAY` and the `$play` source
# path below were one variable, and every play probe ran `src/rounds/play.ts` as its test suite. It
# printed nothing, exited 0, and twelve probes reported GREEN - which reads as twelve broken guards.
# The harness now refuses a suite path that is not a `test-*.ts` file, but the naming is the fix.
$SuiteApi = "$PSScriptRoot/test-api.ts"
$SuitePlay = "$PSScriptRoot/test-play.ts"

$srcCreate = "$PSScriptRoot/../src/rounds/create.ts"
$srcLifecycle = "$PSScriptRoot/../src/rounds/lifecycle.ts"
$srcAuth = "$PSScriptRoot/../src/http/inbound-auth.ts"
$srcRoundsRoute = "$PSScriptRoot/../src/http/rounds.ts"
$srcDeliver = "$PSScriptRoot/../src/callback/deliver.ts"
$srcPlay = "$PSScriptRoot/../src/rounds/play.ts"
$srcAssets = "$PSScriptRoot/../src/http/assets.ts"
$srcApp = "$PSScriptRoot/../src/app.ts"

$results = @()

Write-Host ""
Write-Host "Authentication" -ForegroundColor Cyan

$results += Invoke-Probe -Name "signature is actually verified" -Suite $SuiteApi -File $srcAuth `
  -Find 'const matches = secrets.some((secret) => safeEqual(offered, hmacHex(rawBody, secret)));' `
  -Replace 'const matches = true;' `
  -ExpectRed "rejects a signature made with the wrong secret" -MaxRed 3

$results += Invoke-Probe -Name "a future timestamp is rejected too" -Suite $SuiteApi -File $srcAuth `
  -Find 'const ageSeconds = Math.abs(Math.floor(Date.now() / 1000) - seconds);' `
  -Replace 'const ageSeconds = Math.floor(Date.now() / 1000) - seconds;' `
  -ExpectRed "rejects a timestamp from the future, not only a stale one"

Write-Host ""
Write-Host "Idempotency and collisions" -ForegroundColor Cyan

# NOT PROBED: the pre-flight `Round.findOne({ roundId })` in `createRound`.
#
# Deleting it leaves the suite green, and that is worth recording rather than papering over with a
# weaker assertion, because the honest answer here is the third of the three: neither the test nor
# the claim is wrong - the guard changes no answer. Without the pre-flight read the insert is
# attempted, the unique index rejects it, and the E11000 branch below re-reads and returns exactly
# the same response through exactly the same `reuse`. The two mechanisms are not redundant in what
# they COST - one write is attempted rather than none - but they are indistinguishable in what they
# ANSWER, and no observation of the API can separate them. The E11000 branch is probed on its own
# below, which is where the property actually lives.
#
# What IS probeable is the branch that decides a live launch URL is returned unchanged: minting a
# fresh token on every retry would satisfy "the same round" and break "the same launch URL".
$results += Invoke-Probe -Name "a live launch URL is returned unchanged" -Suite $SuiteApi -File $srcCreate `
  -Find '  if (existing.launchUrlExpiresAt.getTime() > now.getTime()) {
    return respond(existing);
  }' `
  -Replace '  if (false) {
    return respond(existing);
  }' `
  -ExpectRed "the same roundId returns the same round and the same launch URL" -MaxRed 4

$results += Invoke-Probe -Name "a changed parameter is a 409" -Suite $SuiteApi -File $srcCreate `
  -Find '  if (existing.fingerprint !== expected) {
    throw roundConflict(existing.roundId);
  }' `
  -Replace '  if (false) {
    throw roundConflict(existing.roundId);
  }' `
  -ExpectRed "the same roundId with different config is a 409" -MaxRed 3

# The fingerprint must include who the round is for. Without it, two players issued the same id are
# accepted silently and one plays the other's round.
$results += Invoke-Probe -Name "the fingerprint covers the player" -Suite $SuiteApi -File $srcCreate `
  -Find '    parts.playerId,
    parts.contentSeed ?? null,' `
  -Replace '    parts.contentSeed ?? null,' `
  -ExpectRed "a different player on the same roundId IS a collision"

# This probe is the reason the test behind it fires ten requests rather than two. With two it went
# red on one run and green on the next: whether the duplicate-key branch runs at all is a matter of
# timing, and the pre-flight check returns the same answer when it wins the race. A probe whose
# outcome varies between runs teaches a team to rerun the harness instead of reading it.
$results += Invoke-Probe -Name "a simultaneous duplicate insert is handled" -Suite $SuiteApi -File $srcCreate `
  -Find '    if (isDuplicateKey(error)) {' `
  -Replace '    if (false) {' `
  -ExpectRed "simultaneous creates still produce one round"

Write-Host ""
Write-Host "Fairness and the content seed" -ForegroundColor Cyan

$results += Invoke-Probe -Name "a ranked round without a seed is refused" -Suite $SuiteApi -File $srcCreate `
  -Find '  if (mode === "ranked" && !contentSeed) {' `
  -Replace '  if (false) {' `
  -ExpectRed "refuses a ranked round with no contentSeed"

# The seed decides every board in the contest. A launch URL carrying it would let a player generate
# the whole set before starting, which is why section 12 forbids it in the URL specifically.
$results += Invoke-Probe -Name "the launch URL does not carry the seed" -Suite $SuiteApi -File $srcCreate `
  -Find '    launchUrl: launchUrlFor(round.launchToken),' `
  -Replace '    launchUrl: launchUrlFor(round.launchToken) + "&s=" + (round.contentSeed ?? ""),' `
  -ExpectRed "the launch URL does not leak the content seed" -MaxRed 3

# The widest probe here, and every test it breaks is broken honestly. A test that SOLVES a board
# reproduces that board independently from the contest seed - the whole point of a deterministic
# engine - so pointing the server at a different seed genuinely breaks each of them.
#
# MaxRed is 8 for a reason worth stating, because it is the only probe in this file whose blast
# radius is NOT a fixed number. The substituted seed is `providerRoundId`, which is random per
# round, so the boards differ between runs - and "a wrong solution is refused by name" then fails
# only on the runs where the deliberately-wrong paths happen to break a different rule on the new
# board. Observed as 6 red on one run and 7 on the next. A limit set to the first number observed
# would fail this probe intermittently, which teaches a team to rerun the harness rather than read
# it: the same lesson as a test that only fails when the suite is busy.
$results += Invoke-Probe -Name "content comes from the contest seed, not the round" -Suite $SuitePlay -File $srcPlay `
  -Find '  return round.contentSeed ?? round.providerRoundId;' `
  -Replace '  return round.providerRoundId;' `
  -ExpectRed "two players on one contentSeed face the same content" -MaxRed 8

$results += Invoke-Probe -Name "presentation varies per player" -Suite $SuitePlay -File $srcPlay `
  -Find '  const generated = generateForPlayer(
    contentSeedFor(round),
    round.presentationSeed,
    index,
    shapeFor(config.gridSize),
  );
  return toClientPuzzle(generated, index);' `
  -Replace '  const generated = generateForPlayer(
    contentSeedFor(round),
    "fixed",
    index,
    shapeFor(config.gridSize),
  );
  return toClientPuzzle(generated, index);' `
  -ExpectRed "the same content is presented differently to different players"

Write-Host ""
Write-Host "Terminal states" -ForegroundColor Cyan

$results += Invoke-Probe -Name "a round is claimed once, not twice" -Suite $SuitePlay -File $srcLifecycle `
  -Find '    { roundId, status: { $nin: TERMINAL_STATUSES } },' `
  -Replace '    { roundId },' `
  -ExpectRed "a round can only reach a terminal state once"

$results += Invoke-Probe -Name "a voided round carries no score" -Suite $SuiteApi -File $srcLifecycle `
  -Find '  if (status === "voided") return {};' `
  -Replace '  if (false) return {};' `
  -ExpectRed "voids a live round, records no score, and returns the attempt"

# For a lower-is-better title a literal zero is the BEST possible score, so this is the defect that
# pays the player who never loaded the game.
$results += Invoke-Probe -Name "no result is the worst score, not zero" -Suite $SuiteApi -File $srcLifecycle `
  -Find '  const result = solvedAny
    ? scoreRound(title, config, boards)
    : zeroScore(title, config);' `
  -Replace '  const result = solvedAny
    ? scoreRound(title, config, boards)
    : { score: 0, durationMs: 0, breakdown: {} };' `
  -ExpectRed "an expired Circuit Perfect round reports the WORST time, not zero" -MaxRed 3

$results += Invoke-Probe -Name "the gameplay clock completes rather than expires" -Suite $SuitePlay -File $srcLifecycle `
  -Find '  const gameplay = gameplayEndsAt(round);
  if (gameplay && now.getTime() >= gameplay.getTime()) {
    return { playable: false, owes: "completed" };
  }' `
  -Replace '  const gameplay = gameplayEndsAt(round);
  if (gameplay && now.getTime() >= gameplay.getTime()) {
    return { playable: false, owes: "expired" };
  }' `
  -ExpectRed "a finished gameplay clock completes rather than expires" -MaxRed 3

$results += Invoke-Probe -Name "an overdue round is closed when fetched" -Suite $SuiteApi -File $srcRoundsRoute `
  -Find '  if (!status.playable && status.owes) {' `
  -Replace '  if (false && status.owes) {' `
  -ExpectRed "fetching an overdue round expires it on the spot" -MaxRed 3

Write-Host ""
Write-Host "Delivery" -ForegroundColor Cyan

# Regenerating the eventId per attempt makes every retry a new score to the platform, which is the
# exact thing the platform's duplicate detection relies on this value to prevent.
$results += Invoke-Probe -Name "the eventId is stable across retries" -Suite $SuitePlay -File $srcDeliver `
  -Find '        "delivery.lastAttemptAt": now,
        "delivery.firstAttemptAt": first,
        "delivery.nextAttemptAt": nextAttemptAt,' `
  -Replace '        "delivery.lastAttemptAt": now,
        "delivery.firstAttemptAt": first,
        "delivery.eventId": `cvg_ev_reissued_${Math.random().toString(36).slice(2)}`,
        "delivery.nextAttemptAt": nextAttemptAt,' `
  -ExpectRed "a retried delivery reuses the same eventId"

$results += Invoke-Probe -Name "a failure schedules a retry" -Suite $SuitePlay -File $srcDeliver `
  -Find '  const nextAttemptAt = new Date(now.getTime() + delayFor(attempt + 1));' `
  -Replace '  const nextAttemptAt = null as unknown as Date;' `
  -ExpectRed "a failed delivery schedules a later attempt rather than giving up" -MaxRed 3

$results += Invoke-Probe -Name "the backoff is capped" -Suite $SuitePlay -File $srcDeliver `
  -Find '  return MAX_BACKOFF_MS;' `
  -Replace '  return MAX_BACKOFF_MS * Math.pow(2, attempt - BACKOFF_MS.length);' `
  -ExpectRed "the retry backoff is capped inside the 24-hour window"

# Marking a suppressed delivery as acknowledged would turn the rehearsal into a different scenario:
# a provider that had nothing to say, rather than a result that was never delivered.
# Anchored on the return line alone, deliberately. The line above it contains an emoji, and a
# pattern carrying one has already failed to apply in this repo - the shell mangles it, the probe
# matches nothing, and "did not apply" is indistinguishable from a test that does not work.
$results += Invoke-Probe -Name "suppression leaves the delivery pending" -Suite $SuitePlay -File $srcDeliver `
  -Find '    return { sent: false, reason: "suppressed", retryable: false };' `
  -Replace '    await Round.updateOne({ roundId }, { $set: { "delivery.acknowledgedAt": new Date() } });
    return { sent: false, reason: "suppressed", retryable: false };' `
  -ExpectRed "a suppressed callback leaves a fetchable result and an unfinished delivery"

$results += Invoke-Probe -Name "practice results are not reported" -Suite $SuitePlay -File $srcDeliver `
  -Find '  return round.mode === "ranked";' `
  -Replace '  return true;' `
  -ExpectRed "a practice round is never delivered"

Write-Host ""
Write-Host "The play surface" -ForegroundColor Cyan

$results += Invoke-Probe -Name "a GET does not start the round" -Suite $SuitePlay -File $srcPlay `
  -Find 'export async function currentState(token: string): Promise<PlayState> {
  const round = await roundForToken(token);' `
  -Replace 'export async function currentState(token: string): Promise<PlayState> {
  return startOrResume(token);
  const round = await roundForToken(token);' `
  -ExpectRed "reading the state does NOT start the round" -MaxRed 3

$results += Invoke-Probe -Name "a submission is actually verified" -Suite $SuitePlay -File $srcPlay `
  -Find '  const verdict = verifyAttempt(generated, paths);' `
  -Replace '  const verdict = { solved: true as const, cellsUsed: 0 };' `
  -ExpectRed "a wrong solution is refused by name, at HTTP 200" -MaxRed 3

$results += Invoke-Probe -Name "a board cannot be resubmitted" -Suite $SuitePlay -File $srcPlay `
  -Find '  if (board.solvedAt) {
    throw new ApiError(400, "ROUND_NOT_PLAYABLE", "That board is already solved.");
  }' `
  -Replace '  if (false) {
    throw new ApiError(400, "ROUND_NOT_PLAYABLE", "That board is already solved.");
  }' `
  -ExpectRed "a board cannot be solved twice"

Write-Host ""
Write-Host "Error surface" -ForegroundColor Cyan

# Both `in` and object indexing walk the prototype chain, so `__proto__` resolves to a truthy value
# that is not a renderer. "Safe by accident" is not safe.
$results += Invoke-Probe -Name "asset lookup does not walk the prototype chain" -Suite $SuiteApi -File $srcAssets `
  -Find '  if (!title || !Object.hasOwn(RENDERERS, name)) {' `
  -Replace '  if (!title || !(name in RENDERERS)) {' `
  -ExpectRed "an asset name from the prototype chain is refused"

$results += Invoke-Probe -Name "an unknown path is JSON, not Express HTML" -Suite $SuiteApi -File $srcApp `
  -Find '  app.use((_req, res) => {
    sendError(res, 404, "NOT_FOUND", "No such endpoint.");
  });' `
  -Replace '  app.use((_req, _res, next) => {
    next();
  });' `
  -ExpectRed "an unknown path is a JSON 404" -MaxRed 3

Write-ProbeSummary $results
