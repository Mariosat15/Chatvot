# Probes `__tests__/admin/game-challenge-defaults.test.ts` - the per-title challenge defaults the
# owner asked for on 13 September 2026 ("we need to be able to specify the default settings for
# challenges for each specific game... so it's easier for the user to create challenges").
#
# Same harness shape as `probe-challenge-game-picker.ps1`. Four things it inherits, each of which
# has already produced a false result somewhere in this programme:
#
#   * Read AND write UTF-8 without a BOM. `Get-Content -Raw` decodes with the system ANSI
#     codepage on PowerShell 5.1, so every emoji in a touched file comes back as mojibake and is
#     written back that way - the probe passes and the file is quietly mangled.
#   * ASCII-only anchors. A middle dot or an arrow does not survive the round trip through the
#     shell, and the failure reports as PROBE DID NOT APPLY.
#   * PROBE DID NOT APPLY means the target MOVED, never that the run was quiet. Two probes in the
#     sibling harness sat unprobed for days because `resolvePlayMode`'s body had been replaced.
#   * Run the expected test ALONE with `-t` and read the summary counts. vitest prints a passing
#     test's name as readily as a failing one, so searching whole-suite output for the name
#     reports RED beside "failing tests: 0". And `-t` is a REGULAR EXPRESSION, so an apostrophe
#     or a bracket in a test name matches nothing and a passing run over zero tests looks exactly
#     like a missing guard.

$ErrorActionPreference = 'Continue'
$env:NODE_OPTIONS = ''

$SUITE = '__tests__/admin/game-challenge-defaults.test.ts'
$Utf8NoBom = New-Object System.Text.UTF8Encoding($false)

function Relax([string]$literal) { [regex]::Escape($literal) -replace '\r?\n', '\r?\n' }

function Probe {
  param([string]$Name, [string]$File, [string]$Find, [string]$Replace, [string]$ExpectRed, [string]$Suite = $SUITE)

  $path = Join-Path (Get-Location) $File
  $original = [System.IO.File]::ReadAllText($path, $Utf8NoBom)

  if ([string]::IsNullOrEmpty($original)) {
    Write-Host "  [READ FAILED - REFUSING TO WRITE] $Name" -ForegroundColor Magenta
    return
  }

  $patched = [regex]::Replace($original, (Relax $Find), $Replace.Replace('$', '$$'), 1)
  if ($patched -eq $original) {
    Write-Host "  [PROBE DID NOT APPLY] $Name" -ForegroundColor Magenta
    return
  }

  [System.IO.File]::WriteAllText($path, $patched, $Utf8NoBom)
  try {
    $alone = npx vitest run $Suite -t $ExpectRed --reporter=dot 2>&1 | Out-String
    $aloneFailed = 0
    if ($alone -match 'Tests\s+(\d+)\s+failed') { $aloneFailed = [int]$Matches[1] }
    $ran = ($alone -match 'Tests\s+') -and ($alone -notmatch 'No test found')

    $whole = npx vitest run $Suite --reporter=dot 2>&1 | Out-String
    $wholeFailed = 0
    if ($whole -match 'Tests\s+(\d+)\s+failed') { $wholeFailed = [int]$Matches[1] }

    if (-not $ran) {
      Write-Host "  [EXPECTED TEST DID NOT RUN - wrong name or wrong suite] $Name" -ForegroundColor Magenta
    } elseif ($aloneFailed -gt 0) {
      Write-Host ("  [RED: expected test failed, {0} red in suite] {1}" -f $wholeFailed, $Name) -ForegroundColor Green
    } else {
      Write-Host ("  [STILL GREEN - GUARD IS NOT WORKING, {0} red in suite] {1}" -f $wholeFailed, $Name) -ForegroundColor Red
    }
  } finally {
    [System.IO.File]::WriteAllText($path, $original, $Utf8NoBom)
    if ([System.IO.File]::ReadAllText($path, $Utf8NoBom) -ne $original) {
      Write-Host "  !! RESTORE FAILED for $File - check git diff" -ForegroundColor Red
    }
  }
}

$SHARED = 'lib/services/games/challenge-defaults.ts'
$ADMIN_SHARED = 'apps/admin/lib/services/games/challenge-defaults.ts'
$SERVICE = 'apps/admin/lib/services/game-providers/challenge-defaults.service.ts'
$ROUTE = 'apps/admin/app/api/games/providers/[providerKey]/games/challenge-defaults/route.ts'
$CONTROL = 'apps/admin/components/admin/games/GameChallengeDefaultsDialog.tsx'
$MODEL = 'database/models/games/provider-game.model.ts'
$CONTENT = 'apps/admin/lib/admin/game-content-fields.ts'
$TITLES = 'lib/services/games/challengeable-titles.service.ts'
$DIALOG = 'components/challenges/ChallengeCreateDialog.tsx'
$CONFIG = 'lib/services/games/challenge-round-config.ts'
$RESOLUTION = 'lib/services/games/challenge-provider-resolution.ts'
$API = 'app/api/challenges/route.ts'

Write-Host "`n=== one reading of the stored join rule ===" -ForegroundColor Cyan

# The whole reason `resolveChallengeStartPolicy` exists. Inverted, an absent stored value reserves
# a round - which is R73 for every title no operator has ever touched, and the refusal a player
# reads names the clock rather than the setting behind it.
Probe -Name 'an absent join rule reserves a round' `
  -File $SHARED `
  -Find '  return stored?.roundStartPolicy === "reserve_full_round"
    ? "reserve_full_round"
    : CHALLENGE_ROUND_START_POLICY;' `
  -Replace '  return stored?.roundStartPolicy === "until_window_closes"
    ? "until_window_closes"
    : "reserve_full_round";' `
  -ExpectRed 'is PERMISSIVE for every shape of missing'
#   Aimed at the PERMISSIVE test rather than the explicit one, and that is not interchangeable: the
#   inversion still answers `reserve_full_round` to an explicit `reserve_full_round`, so the test
#   named for the explicit case is green against it. The fourth cause of a green probe - a mutation
#   with no observable on the test it was pointed at. The defect lives in the FALLBACK.

# The config module asking the question again. The two readings then agree until one of them is
# edited, and the drift is silent: a challenge created under one rule and played under the other.
Probe -Name 'the round config re-derives the join rule itself' `
  -File $CONFIG `
  -Find '    roundStartPolicy: resolveChallengeStartPolicy(challenge),' `
  -Replace '    roundStartPolicy:
      challenge.roundStartPolicy === "reserve_full_round"
        ? "reserve_full_round"
        : "until_window_closes",' `
  -ExpectRed 'keeps `reserve_full_round` as a comparison in the resolver' `
  -Suite '__tests__/games/challenge-arena.test.ts'

# The create route deciding for itself instead of storing what the pre-flight approved. A title
# whose operator reinstated the reservation is then approved permissively and stored strictly, and
# every round of it is refused - R73 arriving through the door built to close it.
Probe -Name 'the create route stores its own policy, not the approved one' `
  -File $API `
  -Find '        roundStartPolicy: resolvedRoundStartPolicy ?? CHALLENGE_ROUND_START_POLICY,' `
  -Replace '        roundStartPolicy: CHALLENGE_ROUND_START_POLICY,' `
  -ExpectRed 'stores the policy the pre-flight was run against'

# The resolver pre-flighting against one policy and returning another. Nothing downstream can see
# the disagreement, because both values are legal.
Probe -Name 'the pre-flight runs against a policy it does not return' `
  -File $RESOLUTION `
  -Find '  const roundStartPolicy = resolveChallengeStartPolicy(title.challengeDefaults);' `
  -Replace '  const roundStartPolicy = CHALLENGE_ROUND_START_POLICY;' `
  -ExpectRed 'reads the join rule off the stored title'

Write-Host "`n=== the strict write ===" -ForegroundColor Cyan

# The silent clamp. It stores a number the operator did not choose and reads back as their own -
# which is exactly why the read half is lenient and this one is not.
Probe -Name 'an out-of-range length is clamped instead of refused' `
  -File $SHARED `
  -Find '    } else if (minutes < input.bounds.minMinutes || minutes > input.bounds.maxMinutes) {' `
  -Replace '    } else if (false) {' `
  -ExpectRed 'REFUSES an out-of-range length and NAMES the range'

# R73 recreated through the new control: a reservation as long as the whole challenge, so no
# player can ever start a round. Both pay, neither plays.
Probe -Name 'a reservation longer than the challenge is accepted' `
  -File $SHARED `
  -Find '      if (attemptSeconds >= minutes * 60) {' `
  -Replace '      if (false) {' `
  -ExpectRed 'REFUSES a reservation as long as the whole challenge'

# A reservation on a title that declares no round length. The gate then reserves nothing, so the
# switch is a control that appears to work and does nothing - a provider with no adapter, again.
Probe -Name 'a reservation is accepted with no declared round length' `
  -File $SHARED `
  -Find '    if (attemptSeconds === undefined || attemptSeconds <= 0) {' `
  -Replace '    if (false) {' `
  -ExpectRed 'REFUSES a reservation on a title that declares no round length'

# The tidy-looking version: store what `validateConfigValues` filled in. That freezes the
# provider's own declared defaults onto the title, and the frozen copy then wins for ever - even
# after a later sync changes them. The second source of truth this module exists to avoid.
Probe -Name 'the schema-filled defaults are stored as the operator choice' `
  -File $SHARED `
  -Find '    const sentKeys = Object.keys(input.submitted.settings ?? {});
    const chosen = Object.fromEntries(
      Object.entries(validated.values).filter(([key]) => sentKeys.includes(key)),
    );
    if (Object.keys(chosen).length > 0) defaults.settings = chosen;' `
  -Replace '    if (Object.keys(validated.values).length > 0) defaults.settings = validated.values;' `
  -ExpectRed 'stores NOTHING when nothing was submitted'

# Errors stopping at the first. An operator fixing one refusal per submission gives up, which is
# the reasoning behind the contest pre-flight accumulating too.
Probe -Name 'the first refusal short-circuits the rest' `
  -File $SHARED `
  -Find '  if (errors.length > 0) return { ok: false, errors };' `
  -Replace '  if (errors.length > 0) return { ok: false, errors: [errors[0]] };' `
  -ExpectRed 'returns EVERY refusal, not the first'

Write-Host "`n=== the lenient read ===" -ForegroundColor Cyan

# The read refusing rather than clamping. A provider narrowing their schema, or an administrator
# narrowing the bounds, then takes the challenge dialog down for a title that is otherwise
# perfectly playable - for a reason no player can act on.
Probe -Name 'a stored length outside the bounds is passed through unclamped' `
  -File $SHARED `
  -Find '  const durationMinutes = Math.min(
    input.bounds.maxMinutes,
    Math.max(input.bounds.minMinutes, Math.round(chosen)),
  );' `
  -Replace '  const durationMinutes = Math.round(chosen);' `
  -ExpectRed 'CLAMPS a stored length that has gone out of range'

# The schema defaults dropped from under the stored answers. A setting the schema has since
# stopped accepting then leaves its control empty rather than falling back to a usable value.
Probe -Name 'a dropped setting leaves its control empty' `
  -File $SHARED `
  -Find '    settings: { ...defaultConfigValues(input.fields), ...validated.values },' `
  -Replace '    settings: { ...validated.values },' `
  -ExpectRed 'DROPS a stored setting the schema has stopped accepting'

Write-Host "`n=== the field is the operator's ===" -ForegroundColor Cyan

# `challengeDefaults` added to the sync allow-list. Every operator choice is then reverted on the
# next scheduled sync, with a success toast when it was saved and nothing in a log when it goes.
Probe -Name 'the sync is allowed to overwrite the defaults' `
  -File 'lib/services/game-providers/catalogue.service.ts' `
  -Find '    family: game.family,' `
  -Replace '    family: game.family,
    challengeDefaults: {},' `
  -ExpectRed 'rewrites the provider.s OWN fields and does not touch ours'

# The generic content editor allowed to write them. One screen labelled "title and description"
# then decides how many attempts a paying player gets and when entry closes.
Probe -Name 'the content editor may write the defaults' `
  -File $CONTENT `
  -Find '  ["challengeDefaults", "changed with the Challenge defaults control, which has its own audit line"],' `
  -Replace '' `
  -ExpectRed 'keeps them beside the play style'

Write-Host "`n=== the write path is guarded ===" -ForegroundColor Cyan

# The guard removed from one handler. Every neighbour having one is precisely what carries a
# reader past the file that does not - R40, R47, R51, R57.
Probe -Name 'one handler loses its section guard' `
  -File $ROUTE `
  -Find 'const guard = await guardSection("game-providers");' `
  -Replace 'const guard = { ok: true as const, response: undefined };' `
  -ExpectRed 'guards EVERY exported handler with the section that reveals the screen'

# The guard run after the body is read. An unauthorised caller then reaches the parser, and the
# refusal it gets back describes their own payload.
Probe -Name 'the body is read before the guard runs' `
  -File $ROUTE `
  -Find '  const guard = await guardSection("game-providers");
  if (!guard.ok) return guard.response;

  try {
    const { providerKey } = await params;
    const body = (await request.json()) as {
      gameCode?: string;
      challengeDefaults?: unknown;
    };' `
  -Replace '  try {
    const { providerKey } = await params;
    const body = (await request.json()) as {
      gameCode?: string;
      challengeDefaults?: unknown;
    };
    const guard = await guardSection("game-providers");
    if (!guard.ok) return guard.response;' `
  -ExpectRed 'guards before it reads the body'

# The presence check dropped, so `{ gameCode }` alone silently clears an operator decision -
# which is a different fact from `null`, the explicit "the platform decides again".
Probe -Name 'an absent field clears the decision' `
  -File $ROUTE `
  -Find '"challengeDefaults" in body' `
  -Replace 'true' `
  -ExpectRed 'demands the field be PRESENT'

# The audit line dropped. A money-adjacent setting then changes with no attribution, and "did
# this ever happen" is unanswerable afterwards.
Probe -Name 'the change is not recorded' `
  -File $ROUTE `
  -Find 'await auditLogService.log({' `
  -Replace 'await Promise.resolve({' `
  -ExpectRed 'records the change, because a money-adjacent setting needs attribution'

Write-Host "`n=== the two controls ===" -ForegroundColor Cyan

# A game named in the operator's dialog. It reads as a helpful refinement and it makes the
# no-developer-needed claim false for the next title, with every existing test still passing.
Probe -Name 'the dialog special-cases one field by name' `
  -File $CONTROL `
  -Find 'export default function GameChallengeDefaultsDialog(' `
  -Replace 'const HIDDEN = (field: { name: string }) => field.name === "boardSize";
export default function GameChallengeDefaultsDialog(' `
  -ExpectRed 'names no game code, provider key or field'

# The dialog seeding itself instead of through the resolver. An operator then sees a stored
# setting the schema has stopped accepting as a value they cannot save again.
Probe -Name 'the dialog seeds its draft itself' `
  -File $CONTROL `
  -Find 'resolveChallengeDefaults(' `
  -Replace 'rawDefaults(' `
  -ExpectRed 'seeds its own draft through the SAME resolver a player reads'

Write-Host "`n=== the player is handed the answer ===" -ForegroundColor Cyan

# The reader dropping the resolved defaults. Every form then opens on the platform default and
# the schema's own values, with an operator screen in front of it that appears to do something.
Probe -Name 'the title reader sends no resolved defaults' `
  -File $TITLES `
  -Find '        defaults: resolveChallengeDefaults({' `
  -Replace '        defaults: {
          durationMinutes: 60,
          roundStartPolicy: "until_window_closes" as const,
          settings: {},
        },
        unusedDefaults: resolveChallengeDefaults({' `
  -ExpectRed 'carries the resolved challenge defaults' `
  -Suite '__tests__/services/challengeable-titles.test.ts'

# The bounds read per title rather than once. Not a defect on its own - the probe is here because
# the reader must ask the SAME singleton the duration box asks, and a hard-coded pair is how the
# picker and the box come to disagree about the limits.
Probe -Name 'the reader hard-codes the duration bounds' `
  -File $TITLES `
  -Find '  const challengeSettings = await ChallengeSettings.getSingleton();' `
  -Replace '  const challengeSettings = {
    minDurationMinutes: 1,
    maxDurationMinutes: 1440,
    defaultDurationMinutes: 60,
  } as Awaited<ReturnType<typeof ChallengeSettings.getSingleton>>;' `
  -ExpectRed 'reads the platform bounds from the challenge settings singleton' `
  -Suite '__tests__/services/challengeable-titles.test.ts'

# The length left behind on a pick. The pre-chosen settings then arrive with a window nobody
# chose for them, which is the owner's own report one field along.
Probe -Name 'a pick moves the settings but not the length' `
  -File $DIALOG `
  -Find '    setFormData((prev) => ({
      ...prev,
      duration:
        next.type === "provider"
          ? next.title.defaults.durationMinutes
          : settings?.defaultDurationMinutes ?? prev.duration,
    }));' `
  -Replace '' `
  -ExpectRed 'seeds the settings AND the length'

# Trading keeping the game's length. A trading challenge has no title to ask, so the value has no
# author - and it is silent, because any duration inside the bounds is accepted.
Probe -Name 'going back to Trading keeps the game length' `
  -File $DIALOG `
  -Find '          : settings?.defaultDurationMinutes ?? prev.duration,' `
  -Replace '          : prev.duration,' `
  -ExpectRed 'own length when the player picks Trading again'

Write-Host "`n=== done ===`n" -ForegroundColor Cyan
