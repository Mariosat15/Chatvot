# Probes for __tests__/admin/game-play-style.test.ts
#
# WHAT THIS IS DEFENDING. Until 9 September 2026 nobody could say from a screen whether a game
# is played by everybody at once. `provider_game.playMode` answered it, but that field arrives
# with the catalogue and is the PROVIDER's statement - which is right for a third party and
# wrong for ChartVolt Games, where the declaration is a TypeScript literal inside
# `games-service` that only changes on a rebuild and a redeploy.
#
# The dangerous implementation is the obvious one: a control that writes `playMode`. It saves,
# 10|# it toasts, and the next catalogue sync reverts it, because `playMode` is a member of
# `providerOwnedFields`. No error, nothing in a log. That is the "control that appears to work
# and does nothing" shape already on record for a provider enabled with no adapter, a
# `rankingMethod` a provider game ignores, and `isPaused` on a provider contest (R41).
#
# Probe 4 is therefore the important one in this file. It puts `playModeOverride` into the sync's
# allow-list, which is exactly how somebody would "tidy up" the two fields later.
#
# Harness rules, all of them learned the hard way by earlier probe files here: read and write
# through [System.IO.File] with UTF-8 and no BOM, refuse to write when the read came back empty,
# 20|# confirm the replacement actually changed the file, and run the expected test ALONE with `-t`
# reading the summary counts - searching whole-suite output for a name finds it either way.

$ErrorActionPreference = 'Continue'
$Root = Split-Path -Parent $PSScriptRoot
$Utf8 = New-Object System.Text.UTF8Encoding $false
$Suite = '__tests__/admin/game-play-style.test.ts'

$Shape = 'lib/services/games/play-shape.ts'
$Sync = 'lib/services/game-providers/catalogue.service.ts'
$Service = 'apps/admin/lib/services/game-providers/game-play-style.service.ts'
$Route = 'apps/admin/app/api/games/providers/[providerKey]/games/play-style/route.ts'
$Fields = 'apps/admin/lib/admin/game-content-fields.ts'
$Control = 'apps/admin/components/admin/games/GamePlayStyleControl.tsx'
$Catalogue = 'apps/admin/components/admin/games/ProviderCatalogueDialog.tsx'
$Picker = 'apps/admin/components/admin/games/wizard/StepChooseGame.tsx'

function Read-File([string]$Rel) {
  # -LiteralPath semantics by construction: [System.IO.File] does no globbing, which is what a
  # path containing `[providerKey]` needs. PowerShell's own Get-Content reads that as a
  # character class, matches nothing, and returns $null - and Set-Content then happily writes
  # the empty result back, emptying the file while every probe reports RED on the right test
  # for entirely the wrong reason.
  $text = [System.IO.File]::ReadAllText((Join-Path $Root $Rel), $Utf8)
  if ([string]::IsNullOrEmpty($text)) { throw "PROBE ABORT: read $Rel came back empty" }
  return $text
}

function Write-File([string]$Rel, [string]$Text) {
  if ([string]::IsNullOrEmpty($Text)) { throw "PROBE ABORT: refusing to write empty $Rel" }
  [System.IO.File]::WriteAllText((Join-Path $Root $Rel), $Text, $Utf8)
}

function Relaxed([string]$Literal) {
  return ([regex]::Escape($Literal) -replace '\\r\\n|\\n', '\r?\n')
}

function Invoke-Probe {
  param(
    [string]$Name,
    [string]$File,
    [string]$From,
    [string]$To,
    [string]$ExpectTest,
    [int]$MaxRed = 3
  )

  $original = Read-File $File
  $mutated = [regex]::Replace($original, (Relaxed $From), { param($m) $To }, 1)

  if ($mutated -eq $original) {
    Write-Host "[$Name] PROBE DID NOT APPLY - pattern not found in $File" -ForegroundColor Magenta
    return
  }

  try {
    Write-File $File $mutated

    $out = & npx vitest run $Suite -t "$ExpectTest" 2>&1 | Out-String
    $flat = ($out -replace '\s+', ' ')

    $failed = 0
    if ($flat -match 'Tests\s+(\d+)\s+failed') { $failed = [int]$Matches[1] }

    if ($failed -ge 1 -and $failed -le $MaxRed) {
      Write-Host "[$Name] RED ($failed failed) - '$ExpectTest'" -ForegroundColor Green
    } elseif ($failed -gt $MaxRed) {
      # A one-line change turning many tests red usually means the harness damaged the file
      # rather than that the guard is broad. Name them rather than counting them: four probes
      # once read as harness damage when every extra failure was an honest second face of one
      # rule.
      Write-Host "[$Name] RED BUT BROADER THAN EXPECTED ($failed failed, expected <= $MaxRed)" -ForegroundColor Yellow
      ($flat | Select-String -Pattern '(?<=x )[^x]{10,120}' -AllMatches).Matches |
        ForEach-Object { $_.Value } | Select-Object -Unique |
        ForEach-Object { Write-Host "      $_" -ForegroundColor DarkYellow }
    } else {
      Write-Host "[$Name] GREEN - '$ExpectTest' did not fail. Guard absent, test weak, or probe aimed wrong." -ForegroundColor Red
      Write-Host $flat
    }
  } finally {
    Write-File $File $original
    if ((Read-File $File) -ne $original) { Write-Host "[$Name] RESTORE FAILED" -ForegroundColor Red }
  }
}

Write-Host "`n=== The resolver's precedence ===`n" -ForegroundColor Cyan

# 1 - the state of the world before this slice: the override is not consulted at all. This is
#     also what a later "simplification" back to one field looks like.
Invoke-Probe -Name '1 override ignored entirely (the world before this slice)' -File $Shape `
  -From @'
  return (
    storedMode(title?.playModeOverride) ??
    storedMode(title?.playMode) ??
    "anytime"
  );
'@ -To @'
  return title?.playMode === "scheduled" ? "scheduled" : "anytime";
'@ -ExpectTest 'lets our override decide when the provider says otherwise'

# 2 - the precedence inverted, so an operator can declare a two-player game staggered. There is
#     no such thing as playing an opponent at a different time, and the stored value would then
#     be read by a wizard that offers a gun-start it cannot deliver.
Invoke-Probe -Name '2 head-to-head no longer wins' -File $Shape `
  -From '  if (title?.family === "head_to_head") return "scheduled";' `
  -To '' `
  -ExpectTest 'a head-to-head title ignores the override entirely'

# 3 - the three shapes of missing collapsed to one. `??` passes an empty string straight
#     through, so a blank override masks the provider's own `scheduled` - and a document dump
#     shows a field that looks perfectly set.
Invoke-Probe -Name '3 empty-string override taken literally' -File $Shape `
  -From @'
  return (
    storedMode(title?.playModeOverride) ??
    storedMode(title?.playMode) ??
    "anytime"
  );
'@ -To @'
  return (title?.playModeOverride ?? title?.playMode) === "scheduled"
    ? "scheduled"
    : "anytime";
'@ -ExpectTest 'treats an empty-string override as no decision'

Write-Host "`n=== The sync must not own our field ===`n" -ForegroundColor Cyan

# 4 - THE PROBE THIS FILE EXISTS FOR. `playModeOverride` added to `providerOwnedFields`, which is
#     how a later reader would "tidy up" two fields that look like duplicates of each other. The
#     operator's decision then survives until the next catalogue pull and is silently reverted.
#
#     Three tests go red, and all three are honest: the surviving-override one, and the two that
#     assert the sync invents nothing on its update and create branches.
Invoke-Probe -Name '4 playModeOverride added to the sync allow-list' -File $Sync `
  -From '    playMode: game.playMode ?? "anytime",' `
  -To @'
    playMode: game.playMode ?? "anytime",
    playModeOverride: game.playMode ?? "anytime",
'@ -ExpectTest 'rewrites the provider' -MaxRed 3

# 4b - THE COPY THAT ACTUALLY RUNS. `catalogue.service.ts` exists twice and the operator's Sync
#      catalogue button runs the one in `apps/admin`, reached through that app's own `@` alias -
#      which no runtime assertion in the suite can see, because vitest aliases `@` to the
#      repository root. Adding the field to the admin allow-list alone reverts every operator's
#      decision on the next sync with every behavioural test above still green.
Invoke-Probe -Name '4b playModeOverride added to the ADMIN allow-list only' -File 'apps/admin/lib/services/game-providers/catalogue.service.ts' `
  -From '    playMode: game.playMode ?? "anytime",' `
  -To @'
    playMode: game.playMode ?? "anytime",
    playModeOverride: game.playMode ?? "anytime",
'@ -ExpectTest 'holds the same allow-list in BOTH copies'

Write-Host "`n=== The service ===`n" -ForegroundColor Cyan

# 5 - the naive implementation: write the provider's field instead of ours. Everything the
#     caller can see is correct - the response reports the right effective mode - and the value
#     lands in the one field the next sync overwrites.
Invoke-Probe -Name '5 writes playMode instead of playModeOverride' -File $Service `
  -From '      ? { $unset: { playModeOverride: "" } }
      : { $set: { playModeOverride: mode } },' `
  -To '      ? { $unset: { playMode: "" } }
      : { $set: { playMode: mode } },' `
  -ExpectTest 'stores our decision and reports what the wizard will now offer'

# 6 - clearing stores an empty string rather than removing the key. `resolvePlayMode` reads the
#     field's PRESENCE to decide whether we have taken a decision, so a stored "" is a decision
#     that means nothing - the `entryBlockThreshold` distinction.
Invoke-Probe -Name '6 clear stores "" instead of $unset' -File $Service `
  -From '      ? { $unset: { playModeOverride: "" } }' `
  -To '      ? { $set: { playModeOverride: "" } }' `
  -ExpectTest 'clears it by removing the key'

# 7 - the head-to-head refusal removed. Note this is NOT covered by probe 2: the resolver still
#     forces `scheduled`, so the effective answer stays right and the only damage is a stored
#     value nothing reads - the fifth instance of that class after `requiresSyncPlay`,
#     `isPaused`, `lastSuccessfulRoundAt` and `family`.
Invoke-Probe -Name '7 head-to-head write accepted and ignored' -File $Service `
  -From @'
  if (!canOverridePlayMode(title)) {
    return {
      success: false,
      error:
        "This game needs an opponent, so it is always played by both players at once. There is nothing to choose.",
    };
  }
'@ -To '' -ExpectTest 'refuses a head-to-head title, naming the reason'

# 8 - the validator called and then ignored. A route-level allow-list that admits anything means
#     an enum violation reaches Mongoose, which is a 500 an operator reads as a bug in the page.
Invoke-Probe -Name '8 play style validator accepts anything' -File $Service `
  -From '  if (!PLAY_MODES.includes(value as PlayMode)) {' `
  -To '  if (false) {' `
  -ExpectTest 'refuses anything else, including the shapes that look harmless'

Write-Host "`n=== The route ===`n" -ForegroundColor Cyan

# 9 - no authorization at all. Ninth-instance territory: every sibling route in this folder has
#     a guard, which is precisely what would send a reader past the one that does not.
Invoke-Probe -Name '9 guard removed' -File $Route `
  -From @'
  const guard = await guardSection("game-providers");
  if (!guard.ok) return guard.response;

  try {
'@ -To @'
  try {
'@ -ExpectTest 'guards every exported handler with the section that reveals the screen' -MaxRed 4

# 10 - the guard demoted to "is this an admin at all". An employee granted one unrelated section
#      passes it, and could change how every game on the platform is played.
Invoke-Probe -Name '10 downgraded to verifyAdminAuth' -File $Route `
  -From 'const guard = await guardSection("game-providers");' `
  -To 'const guard = await verifyAdminAuth();' `
  -ExpectTest 'guards every exported handler with the section that reveals the screen' -MaxRed 4

# 11 - guard present but after the body is parsed. Still refuses, and work has been done for an
#      unauthenticated caller.
Invoke-Probe -Name '11 guard moved below request.json()' -File $Route `
  -From @'
  const guard = await guardSection("game-providers");
  if (!guard.ok) return guard.response;

  try {
    const { providerKey } = await params;
    const body = (await request.json()) as {
      gameCode?: string;
      playMode?: unknown;
    };
'@ -To @'
  try {
    const { providerKey } = await params;
    const body = (await request.json()) as {
      gameCode?: string;
      playMode?: unknown;
    };
    const guard = await guardSection("game-providers");
    if (!guard.ok) return guard.response;
'@ -ExpectTest 'guards before it reads the body' -MaxRed 4

# 12 - the guard called, its refusal discarded. Reads perfectly and authorizes nothing.
Invoke-Probe -Name '12 refusal never returned' -File $Route `
  -From '  if (!guard.ok) return guard.response;' `
  -To '' `
  -ExpectTest 'own refusal, once per guard' -MaxRed 4

# 13 - the presence check dropped, so `null` and "absent" become the same request. A malformed
#      body of `{ gameCode }` then silently undoes an operator's decision.
Invoke-Probe -Name '13 absent field treated as a clear' -File $Route `
  -From '    if (!("playMode" in body)) {' `
  -To '    if (false) {' `
  -ExpectTest 'demands the field be present'

Write-Host "`n=== It is not content ===`n" -ForegroundColor Cyan

# 14 - the entry deleted from the never-editable map.
#
#      THIS IS THE ONE MOST LIKELY TO COME BACK GREEN, and the reason is the `gameKey` lesson
#      from `competition-update-fields.ts`: the field is absent from the EDITABLE set too, so it
#      is still refused - by the unknown-field branch, whose message also names the field. Only
#      an assertion pinning the specific explanation can see the difference.
Invoke-Probe -Name '14 play style no longer explained as barred' -File $Fields `
  -From '  ["playModeOverride", "changed with the Play style control, which has its own audit line"],' `
  -To '' `
  -ExpectTest 'refuses it with ITS OWN reason' -MaxRed 2

Write-Host "`n=== The control, and where the style is shown ===`n" -ForegroundColor Cyan

# 15 - the control decides for itself instead of asking the shared helper. It compiles, it looks
#      right, and it is the shape behind `referenceId`, `failedReason`, `challengeId` and the
#      Game Master `||` - two copies of one rule, drifting the first time either moves.
Invoke-Probe -Name '15 control re-derives the head-to-head rule' -File $Control `
  -From '  const overridable = canOverridePlayMode(title);' `
  -To '  const overridable = title.family !== "head_to_head";' `
  -ExpectTest 'asks the shared helper whether the choice exists' -MaxRed 2

# 16 - the control gone from the Games list. The count assertion is what catches its opposite
#      too: a second copy on one row gives an operator two switches for one setting, and
#      whichever they touched last wins.
Invoke-Probe -Name '16 control removed from the Games list' -File $Catalogue `
  -From '<GamePlayStyleControl' `
  -To '<GamePlayStyleControlRemoved' `
  -ExpectTest 'appears on the Games list, exactly once'

# 17 - the badge gone from the wizard's picker. An operator then chooses a game with no idea that
#      the next step is about to close entry at the start and withhold the attempts control.
Invoke-Probe -Name '17 badge removed from the game picker' -File $Picker `
  -From 'PLAY_MODE_COPY.get(title.playMode)?.label' `
  -To 'title.family' `
  -ExpectTest 'appears on the wizard' -MaxRed 2

# 18 - the picker resolving the shape a second time. It is handed the resolved value already, so
#      a local resolution is a second opinion that can disagree with the controls the later steps
#      render - and it would disagree only for the rows where it matters.
Invoke-Probe -Name '18 picker re-derives the shape' -File $Picker `
  -From '                    {PLAY_MODE_COPY.get(title.playMode)?.label}' `
  -To '                    {PLAY_MODE_COPY.get(resolvePlayMode(title))?.label}' `
  -ExpectTest 'does not re-derive the style on the picker'

Write-Host "`nDone. Every probe should read RED. A GREEN line means that guard is not holding.`n" -ForegroundColor Cyan
