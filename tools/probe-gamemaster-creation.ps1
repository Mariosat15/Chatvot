# Probes for the Game Master contest creation API (X6).
#
# Same harness as probe-admin-provider-dispatch.ps1. Its lessons are already paid for and are
# not re-derived here: -LiteralPath and explicit UTF-8 without a BOM on the read AND the
# write; refuse to write when the read came back empty; confirm the file actually changed
# before believing any outcome; and judge by the summary counts of a single filtered test
# rather than by searching whole-suite output for a test's name, which vitest prints for a
# passing test as readily as a failing one.
#
# 1-2 tests red is the honest number for a one-line change. Five or more means the probe
# damaged the file rather than the behaviour.

$ErrorActionPreference = "Continue"
$enc = New-Object System.Text.UTF8Encoding($false)
$suite = "__tests__/services/gamemaster-creation-permissions.test.ts"
$results = @()

function Invoke-Probe {
    param(
        [string]$Name,
        [string]$File,
        [string]$From,
        [string]$To,
        [string]$TestName,
        [string]$Suite = $suite
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

$GATE = "lib/services/gamemaster/game-permissions.ts"
$LIMITS = "lib/services/gamemaster/subscription-limits.ts"
$UPDATE = "apps/admin/lib/admin/gamemaster-limits-update.ts"
$MAIN_ROUTE = "app/api/gamemaster/competitions/route.ts"
$ADMIN_ROUTE = "apps/admin/app/api/gamemaster/competitions/route.ts"
$SYNC = "apps/admin/app/api/gamemasters/sync-referrals/route.ts"
$DETAIL = "apps/admin/app/api/gamemasters/[id]/route.ts"
$CONTROL = "apps/admin/components/admin/gamemaster/CompetitionCreationControl.tsx"

# ---------------------------------------------------------------------------------------
# 1. The override must outrank the package. Reversing the precedence is the natural
#    mistake, because reading the package first is how every other limit resolves.
# ---------------------------------------------------------------------------------------
$results += Invoke-Probe `
    -Name "Package outranks an explicit admin deny" `
    -File $GATE `
    -From @'
  if (input.override === "enabled") {
    canCreateCompetitions = true;
    creationDecidedBy = "admin_override";
  } else if (input.override === "disabled") {
    canCreateCompetitions = false;
    creationDecidedBy = "admin_override";
  } else if (pkg && typeof pkg.canCreateCompetitions === "boolean") {
'@ `
    -To @'
  if (pkg && typeof pkg.canCreateCompetitions === "boolean") {
    canCreateCompetitions = pkg.canCreateCompetitions;
    creationDecidedBy = "current_package";
  } else if (input.override === "enabled") {
    canCreateCompetitions = true;
    creationDecidedBy = "admin_override";
  } else if (input.override === "disabled") {
    canCreateCompetitions = false;
    creationDecidedBy = "admin_override";
  } else if (false) {
'@ `
    -TestName "an explicit admin deny beats a package that grants creation"

# ---------------------------------------------------------------------------------------
# 2. `allowedGameTypes` must default to trading only. Defaulting to "everything the
#    platform has" is the shape that quietly hands a Game Master provider contests before
#    chapter 19 s5's economic constraint is satisfied.
# ---------------------------------------------------------------------------------------
$results += Invoke-Probe `
    -Name "allowedGameTypes defaults to every registered game" `
    -File $LIMITS `
    -From @'
export const DEFAULT_ALLOWED_GAME_TYPES: readonly string[] = ["trading"];
'@ `
    -To @'
export const DEFAULT_ALLOWED_GAME_TYPES: readonly string[] = [
  "trading",
  "provider",
];
'@ `
    -TestName "defaults to trading only, so widening is an explicit edit"

# ---------------------------------------------------------------------------------------
# 3. An EMPTY stored array is the shape a bad edit or a half-run migration leaves behind.
#    Reading it literally locks every Game Master out of the thing they pay for.
# ---------------------------------------------------------------------------------------
$results += Invoke-Probe `
    -Name "An empty allowedGameTypes array is read literally as 'no games'" `
    -File $LIMITS `
    -From @'
  return cleaned.length > 0 ? cleaned : DEFAULT_ALLOWED_GAME_TYPES;
'@ `
    -To @'
  return cleaned;
'@ `
    -TestName "treats an EMPTY stored array as the default, not as 'no games'"

# ---------------------------------------------------------------------------------------
# 4. The override must not widen the GAMES. Letting it through is the single most
#    plausible mistake here, because "enabled" reads like "allowed to do everything".
# ---------------------------------------------------------------------------------------
$results += Invoke-Probe `
    -Name "An enabled override also widens allowedGameTypes" `
    -File $GATE `
    -From @'
    allowedGameTypes: resolveAllowedGameTypes(
      pkg && Array.isArray(pkg.allowedGameTypes)
        ? pkg.allowedGameTypes
        : limits.allowedGameTypes,
    ),
'@ `
    -To @'
    allowedGameTypes: overrideActive
      ? ["trading", "provider"]
      : resolveAllowedGameTypes(
          pkg && Array.isArray(pkg.allowedGameTypes)
            ? pkg.allowedGameTypes
            : limits.allowedGameTypes,
        ),
'@ `
    -TestName "an admin override does NOT widen which games may be created"

# ---------------------------------------------------------------------------------------
# 5. The refusal must name the right cause. Collapsing the two messages is tidier and it
#    sends a Game Master to buy an upgrade that cannot possibly help.
# ---------------------------------------------------------------------------------------
$results += Invoke-Probe `
    -Name "Refusal always blames the package, even when an admin denied it" `
    -File $GATE `
    -From @'
        input.limits.creationDecidedBy === "admin_override"
          ? "Competition creation has been disabled for your account by an administrator. Please contact support."
          : "Your package does not allow competition creation. Upgrade your package to create competitions.",
'@ `
    -To @'
        "Your package does not allow competition creation. Upgrade your package to create competitions.",
'@ `
    -TestName "blames the administrator when an override denied it, not the package"

# ---------------------------------------------------------------------------------------
# 6. The participant floor. `|| 2` looks equivalent and is not: it is the floor that stops
#    a paid single-player contest, and no paid format on this platform may be one.
# ---------------------------------------------------------------------------------------
$results += Invoke-Probe `
    -Name "minParticipants floor lowered to 1" `
    -File $GATE `
    -From @'
export const MIN_CONTEST_PARTICIPANTS = 2;
'@ `
    -To @'
export const MIN_CONTEST_PARTICIPANTS = 1;
'@ `
    -TestName "raises 1 and absent to 2, because no paid format is single-player"

# ---------------------------------------------------------------------------------------
# 7. Route capability is a SEPARATE question from permission. Collapsing it means the day
#    somebody grants `provider` the route stamps `gameKey: "provider"` on a real contest -
#    and `gameKey` is immutable, so that cannot be corrected in place afterwards.
# ---------------------------------------------------------------------------------------
$results += Invoke-Probe `
    -Name "Route claims it can build any permitted game type" `
    -File $GATE `
    -From @'
export const ROUTE_CREATABLE_GAME_TYPES: readonly string[] = ["trading"];
'@ `
    -To @'
export const ROUTE_CREATABLE_GAME_TYPES: readonly string[] = [
  "trading",
  "provider",
];
'@ `
    -TestName "refuses a game type the route cannot actually build"

# ---------------------------------------------------------------------------------------
# 8. R31 on the read side, in this module. `??` is the plausible modernisation of `||` and
#    it passes NaN straight through onto a required Number path.
# ---------------------------------------------------------------------------------------
$results += Invoke-Probe `
    -Name "Referral percentage resolved with ?? instead of Number.isFinite" `
    -File $GATE `
    -From @'
    referralFeePercentage: pkg
      ? finiteOr(pkg.referralFeePercentage, DEFAULT_GM_LIMITS.referralFeePercentage)
      : finiteOr(limits.referralFeePercentage, DEFAULT_GM_LIMITS.referralFeePercentage),
'@ `
    -To @'
    referralFeePercentage: pkg
      ? (pkg.referralFeePercentage ?? DEFAULT_GM_LIMITS.referralFeePercentage)
      : (limits.referralFeePercentage ??
        DEFAULT_GM_LIMITS.referralFeePercentage),
'@ `
    -TestName "does not resurrect the cached rate when the LIVE package has none"

# ---------------------------------------------------------------------------------------
# 9. update_limits must REFUSE an unknown field, not drop it. Dropping is tidier and it
#    means the edit appears to save while doing nothing.
# ---------------------------------------------------------------------------------------
$results += Invoke-Probe `
    -Name "Unknown field silently dropped instead of refused" `
    -File $UPDATE `
    -From @'
    if (!EDITABLE_LIMIT_FIELDS.has(key)) {
'@ `
    -To @'
    if (false && !EDITABLE_LIMIT_FIELDS.has(key)) {
'@ `
    -TestName "refuses an unknown field by NAME rather than dropping it"

# ---------------------------------------------------------------------------------------
# 10. The mass assignment itself, restored. This is the defect that was there before:
#     every key the browser sent written onto the document that decides a Game Master's
#     caps, share and games - through a raw-driver update that runs no validation.
#
#     RE-AIMED ONCE, and the first attempt is the instructive part. It was pointed at
#     "the route resolves the badge's answer with the same function as the gate" and came
#     back GREEN - not a weak test and not a wrong claim, but the third cause: there was
#     no test for this at all. Restoring the spread leaves `resolveCreationLimits` and
#     `competitionCreationOverride` in the file, so the badge test stays satisfied while
#     the mass assignment is wide open. Naming the expected failing test is what exposed
#     it; a bare "did the suite go red" would have recorded a passing probe.
# ---------------------------------------------------------------------------------------
$results += Invoke-Probe `
    -Name "update_limits restored to a blind spread" `
    -File "apps/admin/app/api/gamemasters/[id]/route.ts" `
    -From @'
        const validated = validateLimitsUpdate(subscription.limits, limits);
        if (!validated.ok) {
          return NextResponse.json({ error: validated.error }, { status: 400 });
        }
        updateData = { ...updateData, limits: validated.limits };
'@ `
    -To @'
        updateData = {
          ...updateData,
          limits: { ...subscription.limits, ...limits },
        };
'@ `
    -TestName "does not spread the caller's body onto the stored limits"

# A second aim at the same file: call the validator but ignore its verdict. Green on the
# negative assertion above, red only on the positive one - which is why both exist.
$results += Invoke-Probe `
    -Name "Validator called but its refusal ignored" `
    -File "apps/admin/app/api/gamemasters/[id]/route.ts" `
    -From @'
        const validated = validateLimitsUpdate(subscription.limits, limits);
'@ `
    -To @'
        const validated = validateLimitsUpdate({}, {});
'@ `
    -TestName "routes update_limits through the validator"

# ---------------------------------------------------------------------------------------
# 11. An override limit below 2 participants is the same regulatory hole one field along.
# ---------------------------------------------------------------------------------------
$results += Invoke-Probe `
    -Name "Override participant cap accepts 1" `
    -File $UPDATE `
    -From @'
        perContest < 2
'@ `
    -To @'
        perContest < 1
'@ `
    -TestName "refuses a participant override below 2"

# ---------------------------------------------------------------------------------------
# 12. A cleared override must not leave its caps behind, or setting it again months later
#     silently restores numbers nobody can see.
# ---------------------------------------------------------------------------------------
$results += Invoke-Probe `
    -Name "Cleared override keeps its stale caps" `
    -File $UPDATE `
    -From @'
  if (override === "enabled" && body.overrideLimits) {
'@ `
    -To @'
  if (body.overrideLimits) {
'@ `
    -TestName "discards overrideLimits when the override is not enabled"

# ---------------------------------------------------------------------------------------
# 13. Both creation routes must decide with the shared gate. Calling the permission check
#     but labelling from the raw request lets the two disagree - and `gameKey` is
#     immutable, so a mislabelled contest is unrecoverable.
# ---------------------------------------------------------------------------------------
$results += Invoke-Probe `
    -Name "Main route labels from the request instead of the verdict" `
    -File $MAIN_ROUTE `
    -From @'
      ...contestGameLabel(verdict.gameType),
'@ `
    -To @'
      ...contestGameLabel(body.gameType),
'@ `
    -TestName "labels the contest with the game type the VERDICT approved"

$results += Invoke-Probe `
    -Name "Admin route labels from the request instead of the verdict" `
    -File $ADMIN_ROUTE `
    -From @'
      ...contestGameLabel(verdict.gameType),
'@ `
    -To @'
      ...contestGameLabel(body.gameType),
'@ `
    -TestName "labels the contest with the game type the VERDICT approved"

# ---------------------------------------------------------------------------------------
# 14. The unauthenticated route, restored. Aimed at the handler-vs-guard COUNT, which is
#     the only assertion that catches it - a file with one guarded handler and one
#     unguarded one passes any mention-based check.
# ---------------------------------------------------------------------------------------
$results += Invoke-Probe `
    -Name "sync-referrals POST unauthenticated again" `
    -File $SYNC `
    -From @'
export async function POST() {
  try {
    await requireSectionAccess("gamemaster-management");

'@ `
    -To @'
export async function POST() {
  try {
'@ `
    -TestName "guards every exported handler"

# ---------------------------------------------------------------------------------------
# 15. The badge must not re-derive precedence in the browser. Importing the resolved value
#     is trivially satisfied by a component that then works the answer out again itself,
#     so the NEGATIVE assertion is the load-bearing half.
# ---------------------------------------------------------------------------------------
$results += Invoke-Probe `
    -Name "Control re-derives the answer from the package client-side" `
    -File $CONTROL `
    -From @'
  const allowed = gm.limits?.canCreateCompetitions !== false;
'@ `
    -To @'
  const packageConfig = { canCreateCompetitions: true };
  const allowed =
    gm.competitionCreationOverride === "disabled"
      ? false
      : packageConfig.canCreateCompetitions;
'@ `
    -TestName "the control does NOT re-derive precedence in the browser"

# ---------------------------------------------------------------------------------------
# 16. The two copies of the gate must agree. `check:mirrors` compares MODELS, so it has no
#     opinion about this file - and two permission rules that disagree make what a Game
#     Master may create depend on which app answered.
#
#     This probe is what caught the mirror being genuinely stale during the build, before
#     it was written: `checkRouteCanCreateGameType` existed in the main copy only, and the
#     admin typecheck was the second thing to notice, not the first.
# ---------------------------------------------------------------------------------------
$results += Invoke-Probe `
    -Name "Admin copy of the gate drifts from the main copy" `
    -File "apps/admin/lib/services/gamemaster/game-permissions.ts" `
    -From @'
export const MIN_CONTEST_PARTICIPANTS = 2;
'@ `
    -To @'
export const MIN_CONTEST_PARTICIPANTS = 3;
'@ `
    -TestName "both copies exist and agree"

# ---------------------------------------------------------------------------------------
# 17. The R7 guard had to be LOOSENED to accept an argument, because the routes now stamp a
#     resolved game type rather than always trading. A loosened guard is worth re-probing:
#     what must still be caught is a label derived from CALLER INPUT, which is a way to
#     mislabel a contest against an immutable field, and which the old no-argument pattern
#     used to prevent as a side effect of being stricter than its own purpose.
#
#     Note the probe deliberately uses `body.gameType` rather than a nonsense value: the
#     mutated code compiles and reads entirely plausibly, which is the point.
# ---------------------------------------------------------------------------------------
$results += Invoke-Probe `
    -Name "Route labels the contest from the request body instead of the verdict" `
    -File "app/api/gamemaster/competitions/route.ts" `
    -From @'
      ...contestGameLabel(verdict.gameType),
'@ `
    -To @'
      ...contestGameLabel(body.gameType),
'@ `
    -TestName "never derives the label from the request body" `
    -Suite "__tests__/services/game-guards.test.ts"

Write-Host ""
Write-Host "================ SUMMARY ================" -ForegroundColor Cyan
$results | Format-Table -AutoSize
$bad = @($results | Where-Object { $_.Outcome -notlike "RED*" })
if ($bad.Count -gt 0) {
    Write-Host "$($bad.Count) probe(s) did NOT come back red - read each one." -ForegroundColor Red
}
else {
    Write-Host "All $($results.Count) probes red on the expected test." -ForegroundColor Green
}
