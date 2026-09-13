# Probes for the play shape - anytime versus scheduled contests (chapter 22 / X6).
#
# Each probe reinstates a defect, runs ONLY the test that is supposed to catch it, and reports
# RED or GREEN from the summary counts. The harness lessons baked in here have each produced a
# false result on this programme before:
#
#   - Read AND write with -LiteralPath and pinned UTF-8 without a BOM.
#   - Refuse to write when the read came back empty, and assert the file actually CHANGED. A
#     probe that fails to apply is indistinguishable from a test that does not work.
#   - Collapse whitespace in the captured output, because Out-String wraps at the console width
#     and a long test name arrives split across two lines.
#   - Name the EXPECTED failing test, and expect 1-2 red. Five or more for a one-line change
#     means the mutation broke the file rather than the behaviour.

$ErrorActionPreference = 'Continue'
$Root = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $Root

$Utf8 = New-Object System.Text.UTF8Encoding $false
$DefaultSuite = '__tests__/services/play-shape.test.ts'

function Read-File([string]$Path) {
  [System.IO.File]::ReadAllText((Join-Path $Root $Path), $Utf8)
}

function Write-File([string]$Path, [string]$Text) {
  if ([string]::IsNullOrEmpty($Text)) { throw "refusing to write empty content to $Path" }
  [System.IO.File]::WriteAllText((Join-Path $Root $Path), $Text, $Utf8)
}

# Escape the literal, then relax every newline, so a CRLF pattern still matches an LF file.
function To-Pattern([string]$Literal) {
  [regex]::Escape($Literal) -replace '(\\r)?\\n', '\r?\n'
}

function Invoke-Probe {
  param(
    [string]$Name,
    [string]$File,
    [string]$From,
    [string]$To,
    [string]$ExpectTest,
    [string]$Suite = $script:DefaultSuite
  )

  $original = Read-File $File
  $mutated = [regex]::Replace($original, (To-Pattern $From), { param($m) $To }, 1)

  if ($mutated -eq $original) {
    Write-Host "[$Name] PROBE DID NOT APPLY - pattern not found in $File" -ForegroundColor Magenta
    return
  }

  Write-File $File $mutated
  try {
    $out = & npx vitest run $Suite -t $ExpectTest 2>&1 | Out-String
    $flat = ($out -replace '\s+', ' ')

    if ($flat -match 'Tests\s+(\d+)\s+failed') {
      Write-Host "[$Name] RED ($($Matches[1]) failed) - $ExpectTest" -ForegroundColor Green
    }
    elseif ($flat -match 'No test files found' -or $flat -match 'Tests\s+no tests') {
      Write-Host "[$Name] NO TEST RAN - check the -t pattern" -ForegroundColor Magenta
    }
    else {
      Write-Host "[$Name] GREEN - the guard did not catch it" -ForegroundColor Red
    }
  }
  finally {
    Write-File $File $original
  }
}

$SHAPE = 'lib/services/games/play-shape.ts'
$DEADLINE = 'lib/services/games/entry-deadline.ts'
$CREATE = 'apps/admin/lib/services/game-providers/provider-contest.service.ts'
$EDIT = 'apps/admin/lib/services/game-providers/provider-contest-edit.service.ts'
$SCHEDULE = 'apps/admin/components/admin/games/wizard/StepSchedule.tsx'
$PRIZES = 'apps/admin/components/admin/games/wizard/StepPrizes.tsx'

Write-Host "`n=== which source decides the shape ===" -ForegroundColor Cyan

# THE PROBE THAT MATTERS MOST. If the resolver secretly leaned on `family`, an `independent`
# race would come back as a puzzle - and every other test in the suite would still pass,
# because the only other scheduled fixture is `head_to_head`, which the forcing covers.
# RE-AIMED 9 SEPTEMBER 2026. This and the third probe below matched `resolvePlayMode`'s original
# one-line body, which the operator override (`22` s9) replaced with the shared `storedMode`
# helper. Both reported PROBE DID NOT APPLY, which reads like a broken harness rather than a
# moved target - so a real guard sat unprobed. Confirm the FILE CHANGED, never that a run was
# quiet.
Invoke-Probe -Name 'the declaration is ignored, family decides' -File $SHAPE `
  -From '    storedMode(title?.playMode) ??' `
  -To '' `
  -ExpectTest 'an independent title declaring scheduled IS scheduled'

Invoke-Probe -Name 'head_to_head is trusted rather than corrected' -File $SHAPE `
  -From 'if (title?.family === "head_to_head") return "scheduled";' `
  -To '' `
  -ExpectTest 'FORCES head_to_head to scheduled'

Invoke-Probe -Name 'an unrecognised value is honoured as scheduled' -File $SHAPE `
  -From '  if (value === "anytime" || value === "scheduled") return value;' `
  -To '  if (value) return value as PlayMode;' `
  -ExpectTest 'falls back to anytime on a value it does not recognise'

Write-Host "`n=== the consequences ===" -ForegroundColor Cyan

Invoke-Probe -Name 'a scheduled contest keeps its entry window open' -File $SHAPE `
  -From '  entryClosesAtStart: true,' -To '  entryClosesAtStart: false,' `
  -ExpectTest 'closes entry at the start of a scheduled contest'

Invoke-Probe -Name 'a race can be re-run' -File $SHAPE `
  -From '  forcedAttemptsPolicy: "single",' -To '' `
  -ExpectTest 'closes entry at the start of a scheduled contest'

Invoke-Probe -Name 'the round-start policy is not forced' -File $SHAPE `
  -From '  forcedRoundStartPolicy: "until_window_closes",' -To '' `
  -ExpectTest 'closes entry at the start of a scheduled contest'

# The reverse direction, which is the half a one-sided guard misses: a rule applied to EVERY
# contest satisfies every scheduled assertion and destroys the whole live catalogue's settings.
Invoke-Probe -Name 'every contest is treated as scheduled' -File $SHAPE `
  -From '  entryClosesAtStart: false,' -To '  entryClosesAtStart: true,' `
  -ExpectTest 'leaves an anytime contest with every control'

Invoke-Probe -Name 'a withheld reason is attached to a control that is shown' -File $SHAPE `
  -From '  offersRoundStartPolicy: true,
  copy: {
    startLabel: "Contest starts",' `
  -To '  offersRoundStartPolicy: true,
  copy: {
    roundStartWithheld: "Not applicable.",
    startLabel: "Contest starts",' `
  -ExpectTest 'explains a withheld control and says nothing when the control is offered'

# The stale wording that was live for a month, reinstated. `12` s2.10 moved entry to the last
# playable moment while this sentence still said registration closed at the start.
Invoke-Probe -Name 'the anytime hint claims registration closes at the start' -File $SHAPE `
  -From '    startHint: "Play opens at this moment.",' `
  -To '    startHint: "Registration closes at this moment.",' `
  -ExpectTest 'gives the two date controls different words'

Write-Host "`n=== the entry deadline ===" -ForegroundColor Cyan

Invoke-Probe -Name 'the flag is ignored' -File $DEADLINE `
  -From '  if (input.entryClosesAtStart) return new Date(input.startTime);' -To '' `
  -ExpectTest 'closes entry at the START, not one attempt before the end'

# THE ORDERING TRAP. A scheduled contest is stored with `until_window_closes`, so checking the
# flag AFTER the policy leaves entry open for the contest's whole duration - and the arithmetic
# still runs, still returns a date, and still looks right on screen.
Invoke-Probe -Name 'the flag is checked after the policy' -File $DEADLINE `
  -From '  if (input.entryClosesAtStart) return new Date(input.startTime);

  const reserves' `
  -To '  const reserves' `
  -ExpectTest 'ignores the policy and the attempt length entirely'

Invoke-Probe -Name 'the flag defaults to closing at the start' -File $DEADLINE `
  -From '  if (input.entryClosesAtStart) return new Date(input.startTime);' `
  -To '  if (input.entryClosesAtStart !== false) return new Date(input.startTime);' `
  -ExpectTest 'leaves every existing caller alone'

Write-Host "`n=== the write paths ===" -ForegroundColor Cyan

Invoke-Probe -Name 'create does not force the attempts policy' -File $CREATE `
  -From 'const attemptsPolicy = shape.forcedAttemptsPolicy ?? input.attemptsPolicy;' `
  -To 'const attemptsPolicy = input.attemptsPolicy;' `
  -ExpectTest 'OVERRIDES the operator on a scheduled title'

Invoke-Probe -Name 'create does not force the round-start policy' -File $CREATE `
  -From '    shape.forcedRoundStartPolicy ?? input.roundStartPolicy ?? "reserve_full_round";' `
  -To '    input.roundStartPolicy ?? "reserve_full_round";' `
  -ExpectTest 'OVERRIDES the operator on a scheduled title'

Invoke-Probe -Name 'create writes the deadline without the shape' -File $CREATE `
  -From '        entryClosesAtStart: shape.entryClosesAtStart,' -To '' `
  -ExpectTest 'OVERRIDES the operator on a scheduled title'

# The reverse direction on the write path, for the same reason as the rules probe above.
Invoke-Probe -Name 'create forces every contest to one attempt' -File $CREATE `
  -From 'const attemptsPolicy = shape.forcedAttemptsPolicy ?? input.attemptsPolicy;' `
  -To 'const attemptsPolicy = "single" as typeof input.attemptsPolicy;' `
  -ExpectTest 'leaves an anytime contest exactly as the operator asked'

# THE EDIT PROBE THAT MATTERS. Written inside the `input` branch it reads perfectly correctly
# and only fails on the edit that does not mention the control - which is the ordinary edit.
Invoke-Probe -Name 'edit only forces when the operator touches the control' -File $EDIT `
  -From '  if (title.shape?.forcedRoundStartPolicy) {
    competition.roundStartPolicy = title.shape.forcedRoundStartPolicy;
  } else if (input.roundStartPolicy !== undefined) {' `
  -To '  if (input.roundStartPolicy !== undefined) {' `
  -ExpectTest 're-forces the rules on an edit that never mentions them'

Invoke-Probe -Name 'edit forgets the attempts policy' -File $EDIT `
  -From 'const attemptsPolicy = title.shape?.forcedAttemptsPolicy ?? input.attemptsPolicy;' `
  -To 'const attemptsPolicy = input.attemptsPolicy;' `
  -ExpectTest 're-forces the rules on an edit that never mentions them'

Invoke-Probe -Name 'edit recomputes the deadline without the shape' -File $EDIT `
  -From '    entryClosesAtStart: title.shape?.entryClosesAtStart,' -To '' `
  -ExpectTest 're-forces the rules on an edit that never mentions them'

Invoke-Probe -Name 'edit forces every contest, not just scheduled ones' -File $EDIT `
  -From 'const attemptsPolicy = title.shape?.forcedAttemptsPolicy ?? input.attemptsPolicy;' `
  -To 'const attemptsPolicy = "single" as typeof input.attemptsPolicy;' `
  -ExpectTest 'still honours the operator on an anytime contest'

Write-Host "`n=== the wizard is handed the resolved shape ===" -ForegroundColor Cyan

Invoke-Probe -Name 'the raw declaration reaches the wizard' -File $CREATE `
  -From '        playMode: resolvePlayMode(title),' `
  -To '        playMode: (title.playMode ?? "anytime") as PlayMode,' `
  -ExpectTest 'reports the resolved shape, not the raw declaration'

Invoke-Probe -Name 'the round-start control is offered on a scheduled contest' -File $SCHEDULE `
  -From '      {shape.offersRoundStartPolicy ? (' -To '      {true ? (' `
  -ExpectTest 'withholds the controls from the same rule'

Invoke-Probe -Name 'the attempts control is offered on a scheduled contest' -File $PRIZES `
  -From '      {shape.requiresSingleAttempt ? (' -To '      {false ? (' `
  -ExpectTest 'withholds the controls from the same rule'

Write-Host "`n=== one producer ===" -ForegroundColor Cyan

$ADMIN_SHAPE = 'apps/admin/lib/services/games/play-shape.ts'

Invoke-Probe -Name 'the mirror drifts' -File $ADMIN_SHAPE `
  -From '  entryClosesAtStart: true,' -To '  entryClosesAtStart: false,' `
  -ExpectTest 'byte-identical'

Write-Host "`n=== nothing switches on a game code ===" -ForegroundColor Cyan

# RE-AIMED 9 SEPTEMBER 2026. This read `title?.playMode` until task 11 moved the step onto the
# draft's chosen mode. Left alone it would have reported PROBE DID NOT APPLY, which reads like a
# broken harness rather than a moved target - the lesson from the trading-surface probe.
Invoke-Probe -Name 'the wizard special-cases one title' -File $SCHEDULE `
  -From '  const shape = playShapeRules(draft.playMode ?? "anytime");' `
  -To '  const shape = playShapeRules(title?.gameCode === "circuit-sprint" ? "anytime" : (draft.playMode ?? "anytime"));' `
  -ExpectTest 'names no game code, provider key or game key'

# RE-AIMED for the same reason: the create service resolved the shape from the title alone.
Invoke-Probe -Name 'a service forms its own opinion about a mode' -File $CREATE `
  -From '  const shape = playShapeRules(playMode);' `
  -To '  const shape = playMode === "scheduled" ? playShapeRules("scheduled") : playShapeRules("anytime");' `
  -ExpectTest 'has one resolver, so the wizard and the services cannot disagree'

Write-Host "`n=== task 11: the operator's per-contest choice ===" -ForegroundColor Cyan

# THE PROBE THAT MATTERS MOST IN THIS SECTION, and the defect task 11 exists to close. Reading
# the title rather than the contest is not a hypothetical mistake - it is what the edit service
# did until 9 September 2026, correctly, while a title had exactly one shape.
Invoke-Probe -Name 'edit resolves the shape from the TITLE again' -File $EDIT `
  -From 'playShapeRules(resolveContestPlayMode(competition.playMode, title))' `
  -To 'playShapeRules(resolveContestPlayMode(undefined, title))' `
  -ExpectTest 'does not rewrite a staggered contest'

# The mirror-image mutation. Reading the contest's own value UNCONDITIONALLY - never falling
# back to the title - passes the probe above and silently drops the forcing for every contest
# created before the field existed, which is all of them.
Invoke-Probe -Name 'edit trusts a contest that has no stored shape' -File $SHAPE `
  -From '  return storedMode(storedContestMode) ?? resolvePlayMode(title);' `
  -To '  return storedMode(storedContestMode) ?? "anytime";' `
  -ExpectTest 'falls back to the title for a contest created before the field existed'

Invoke-Probe -Name 'create ignores the operator and stores the title default' -File $CREATE `
  -From '  const playMode = resolveContestPlayMode(input.playMode, title);' `
  -To '  const playMode = resolveContestPlayMode(undefined, title);' `
  -ExpectTest 'stores the chosen shape and forces that shape'

# A create that stamps the rules but never stores the mode. The contest behaves correctly on the
# day it is made and its FIRST EDIT re-forces it from the title - the defect one step removed,
# and invisible to every assertion about attempts and deadlines at create time.
Invoke-Probe -Name 'create forces the rules but stores no shape' -File $CREATE `
  -From '      playMode,' -To '' `
  -ExpectTest 'stores the chosen shape and forces that shape'

Write-Host "`n=== task 11: the choice is validated against a stored set ===" -ForegroundColor Cyan

Invoke-Probe -Name 'any requested shape is accepted' -File $CREATE `
  -From '  if (input.playMode !== undefined && !isPlayModeSupported(title, input.playMode)) {' `
  -To '  if (false) {' `
  -ExpectTest 'refuses a shape the title does not support'

# The reverse direction. Refusing an ABSENT mode passes every refusal assertion and breaks the
# whole live catalogue plus every caller written before task 11.
Invoke-Probe -Name 'an omitted shape is refused as unsupported' -File $CREATE `
  -From '  if (input.playMode !== undefined && !isPlayModeSupported(title, input.playMode)) {' `
  -To '  if (!isPlayModeSupported(title, input.playMode)) {' `
  -ExpectTest 'still stores a shape when the caller sends none'

Invoke-Probe -Name 'an unrecognised value is admitted rather than refused' -File $SHAPE `
  -From '  const requested = storedMode(mode);
  if (!requested) return false;' `
  -To '  const requested = storedMode(mode);
  if (!requested) return true;' `
  -ExpectTest 'refuses an unrecognised shape rather than falling back'

Invoke-Probe -Name 'head_to_head is overridden by its supported set' -File $SHAPE `
  -From '  if (title?.family === "head_to_head") return [fallback];' -To '' `
  -ExpectTest 'refuses anytime on a head_to_head title even when its set names it'

# The refusal that names nothing. An operator told only that their choice is unsupported has to
# read another screen to find out what to pick, and the message still reads like a real error.
Invoke-Probe -Name 'the refusal does not name what IS supported' -File $CREATE `
  -From '    const allowed = resolveSupportedPlayModes(title)
      .map((mode) => PLAY_MODE_COPY.get(mode)?.label ?? mode)
      .join(" or ");' `
  -To '    const allowed = "";' `
  -ExpectTest 'refuses a shape the title does not support'

Write-Host "`n=== task 11: the supported set the picker is built from ===" -ForegroundColor Cyan

# A set that does NOT contain the title's own style. Every contest already created on that title
# was created as it, and the operator could not pick it back.
Invoke-Probe -Name 'the title default is dropped from its own supported set' -File $SHAPE `
  -From '  const declared = new Set<PlayMode>([fallback]);' `
  -To '  const declared = new Set<PlayMode>();' `
  -ExpectTest 'always contains the title'

Invoke-Probe -Name 'the wizard is handed the raw supported list' -File $CREATE `
  -From '        supportedPlayModes: resolveSupportedPlayModes(title),' `
  -To '        supportedPlayModes: (title.supportedPlayModes ?? []) as PlayMode[],' `
  -ExpectTest 'reports the resolved SUPPORTED SET'

Write-Host "`n=== done ===" -ForegroundColor Cyan
