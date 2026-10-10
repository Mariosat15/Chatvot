# Probes for the play-clock slice of 8 September 2026.
#
# THE DEFECT AT THE CENTRE OF IT: the round-start gate reserved `maxDurationSeconds`, the
# CATALOGUE CEILING, rather than the playing time the operator configured. A title allowing up
# to an hour therefore refused every attempt in any contest shorter than an hour, from the
# first second - which is what the owner reported as "as soon as the competition starts it says
# there is not enough time left". It was correct code enforcing a rule nobody had chosen.
#
# The rest of the slice follows from fixing it: a schema keyword so a title can say WHICH of its
# settings is the clock, a dropdown rather than a seconds box, a derived result grace period, and
# blocking validation so a contest nobody could start cannot be saved.
#
# Each probe reintroduces one form of one defect and asserts the EXPECTED test goes red, alone.
#
# Harness rules, every one learned by getting it wrong:
#   - Read via [System.IO.File] with UTF-8 and no BOM, on the read as well as the write.
#   - Refuse to write when the read came back empty: a probe that empties a file reports far
#     more damage than it caused, and the tell is the failure COUNT rather than the failure.
#   - Confirm the replacement changed the file. A probe that fails to apply is
#     indistinguishable from a test that does not work.
#   - Run the expected test ALONE with `-t` and read the summary counts. Searching whole-suite
#     output for a test's name finds it whether it passed or failed.
#   - Parameterise on the SUITE as well as the test: run against the wrong file and the harness
#     reports "no test ran", which reads like a broken harness rather than a missing guard.

$ErrorActionPreference = 'Continue'
$Root = Split-Path -Parent $PSScriptRoot
$Utf8 = New-Object System.Text.UTF8Encoding $false

$CLOCK  = '__tests__/admin/contest-round-clock.test.ts'
$CREATE = '__tests__/services/provider-contest-create.test.ts'
$LIFE   = '__tests__/services/round-lifecycle.test.ts'

function Read-File([string]$Rel) {
  $text = [System.IO.File]::ReadAllText((Join-Path $Root $Rel), $Utf8)
  if ([string]::IsNullOrEmpty($text)) { throw "PROBE ABORT: read $Rel came back empty" }
  return $text
}

function Write-File([string]$Rel, [string]$Text) {
  if ([string]::IsNullOrEmpty($Text)) { throw "PROBE ABORT: refusing to write empty $Rel" }
  [System.IO.File]::WriteAllText((Join-Path $Root $Rel), $Text, $Utf8)
}

# Escapes the literal then relaxes every newline, so a CRLF pattern matches an LF file.
function Relaxed([string]$Literal) {
  return ([regex]::Escape($Literal) -replace '\\r\\n|\\n', '\r?\n')
}

function Invoke-Probe {
  param(
    [string]$Name,
    [string]$File,
    [string]$From,
    [string]$To,
    [string]$Suite,
    [string]$ExpectTest
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
    $ran = ($flat -match 'Tests\s+') -and ($flat -notmatch 'No test found')

    if (-not $ran) {
      Write-Host "[$Name] NO TEST RAN - '$ExpectTest' matched nothing in $Suite" -ForegroundColor Magenta
      Write-Host $flat
    } elseif ($failed -ge 1) {
      Write-Host "[$Name] RED ($failed failed) - '$ExpectTest'" -ForegroundColor Green
    } else {
      Write-Host "[$Name] GREEN - '$ExpectTest' did not fail. Guard absent, test weak, probe aimed wrong, or the mutation changed no observable." -ForegroundColor Red
      Write-Host $flat
    }
  } finally {
    Write-File $File $original
    if ((Read-File $File) -ne $original) { Write-Host "[$Name] RESTORE FAILED" -ForegroundColor Red }
  }
}

$SCHEMA   = 'lib/services/games/config-schema.ts'
$ROUND    = 'lib/services/games/round.service.ts'
$DRAFT    = 'apps/admin/components/admin/games/contest-draft.ts'
$FIELDS   = 'apps/admin/components/admin/games/ConfigSchemaFields.tsx'
$WIZARD   = 'apps/admin/components/admin/games/ProviderContestWizard.tsx'
$NOTE     = 'apps/admin/components/admin/games/RoundClockNote.tsx'

Write-Host '=== The gate: which duration is reserved ===' -ForegroundColor Cyan

# 1. THE ORIGINAL DEFECT, VERBATIM. The gate goes back to the catalogue ceiling, so a contest
#    shorter than the ceiling refuses every attempt for its whole life however short the
#    operator set play to.
Invoke-Probe -Name '1 gate reads the ceiling' -File $ROUND `
  -From '(config.attemptSeconds ?? config.maxDurationSeconds ?? 0) * 1000;' `
  -To '(config.maxDurationSeconds ?? 0) * 1000;' `
  -Suite $LIFE -ExpectTest 'gates on the CONFIGURED playing time, not the title'

# 2. THE OPPOSITE, and the reason expiry was NOT changed with the gate. Expiry reads the
#    configured attempt, so a round is killed at the moment the contest stopped reserving for
#    it rather than when the game is actually finished - cutting a player off mid-board with a
#    score the provider never sent.
Invoke-Probe -Name '2 expiry reads the attempt' -File $ROUND `
  -From 'const maxDuration = (config.maxDurationSeconds ?? 300) * 1000;' `
  -To 'const maxDuration = (config.attemptSeconds ?? config.maxDurationSeconds ?? 300) * 1000;' `
  -Suite $LIFE -ExpectTest 'still clamps expiresAt against the CEILING'

# 3. The reservation becomes a fraction of the attempt. This is the tempting "fix" for the
#    original report - it makes the message honest and quietly abandons the fairness rule that
#    every player is scored over the same length of play.
Invoke-Probe -Name '3 reserves half an attempt' -File $DRAFT `
  -From @'
    lastAttemptStart: reservesFullRound
      ? new Date(end.getTime() - attemptSeconds * 1000)
'@ `
  -To @'
    lastAttemptStart: reservesFullRound
      ? new Date(end.getTime() - (attemptSeconds / 2) * 1000)
'@ `
  -Suite $CLOCK -ExpectTest 'reserves the WHOLE attempt, never a fraction of it'

Write-Host '=== Resolving which setting IS the clock ===' -ForegroundColor Cyan

# 4. The resolver ignores the declared field and always answers with the ceiling, which is the
#    original defect one layer up: every consumer - gate, pre-flight, note, preview, player
#    pre-flight - goes back to reserving an hour for a ten-minute contest at once.
Invoke-Probe -Name '4 resolver ignores the declared clock' -File $SCHEMA `
  -From 'const field = fields.find((candidate) => candidate.format === "duration-seconds");' `
  -To 'const field = fields.find(() => false);' `
  -Suite $CLOCK -ExpectTest 'reserves the CONFIGURED playing time, not the game'

# 5. The fallback goes. A title that declares no clock - every existing one until today, and
#    any provider who never adopts the keyword - loses its reservation entirely, so the contest
#    reserves nothing and an attempt can be admitted that the contest end will cut short.
Invoke-Probe -Name '5 no fallback to the ceiling' -File $SCHEMA `
  -From @'
  return typeof catalogueMaxSeconds === "number" && catalogueMaxSeconds > 0
    ? catalogueMaxSeconds
    : undefined;
'@ `
  -To @'
  return undefined;
'@ `
  -Suite $CLOCK -ExpectTest 'falls back to the ceiling when the title declares no play clock'

# 6. The clamp goes. The stored settings are operator input and the schema's own range is the
#    only thing that says what the game will honour; unclamped, the platform reserves a length
#    the game is about to refuse, so the screen and the round disagree.
Invoke-Probe -Name '6 setting not clamped' -File $SCHEMA `
  -From @'
  const clamped = Math.min(
    field.maximum ?? numeric,
    Math.max(field.minimum ?? numeric, numeric),
  );
'@ `
  -To @'
  const clamped = numeric;
'@ `
  -Suite $CLOCK -ExpectTest 'clamps a setting outside the declared range rather than trusting it'

Write-Host '=== The schema keyword fails closed ===' -ForegroundColor Cyan

# 7. An unrecognised `format` is ignored rather than refused. Same reasoning as the
#    unimplemented-keyword rule: the contest saves, and the platform treats a declared clock as
#    an ordinary integer with nothing anywhere saying so.
Invoke-Probe -Name '7 unknown format ignored' -File $SCHEMA `
  -From @'
        typeof rawField.format !== "string" ||
        !CONFIG_FIELD_FORMATS.includes(rawField.format as ConfigFieldFormat)
'@ `
  -To @'
        false
'@ `
  -Suite $CREATE -ExpectTest 'accepts a declared `format`, and fails closed on one it does not know'

# 8. A duration on a string field is admitted. Every reservation is then NaN - and every NaN
#    comparison is false, so every gate silently OPENS.
Invoke-Probe -Name '8 duration on a string' -File $SCHEMA `
  -From 'if (type !== "integer" && type !== "number") {' `
  -To 'if (false) {' `
  -Suite $CREATE -ExpectTest 'refuses a duration format on a field that is not a number'

# 9. Two clocks are admitted, so which one is reserved depends on property order.
Invoke-Probe -Name '9 two clocks admitted' -File $SCHEMA `
  -From 'if (duplicateFormats.length > 0) {' `
  -To 'if (false) {' `
  -Suite $CREATE -ExpectTest 'refuses two fields claiming to be the same clock'

Write-Host '=== The duration control ===' -ForegroundColor Cyan

# 10. The control is keyed on the field NAME. It works, for exactly one title, and quietly makes
#     this Circuit Sprint's control rather than the platform's - the one failure mode of the
#     no-developer-needed claim.
Invoke-Probe -Name '10 keyed on a field name' -File $FIELDS `
  -From 'if (field.format === "duration-seconds") {' `
  -To 'if (field.name === "durationSeconds") {' `
  -Suite $CLOCK -ExpectTest 'keys the control on the declared format, never on a field name'

# 11. The presets stop being filtered against the title's range, so an operator picks an hour on
#     a title that allows five minutes; the game clamps it, and the contest reserves a length
#     nobody chose.
Invoke-Probe -Name '11 presets not filtered' -File $FIELDS `
  -From 'return seconds >= min && (max === undefined || seconds <= max);' `
  -To 'return true;' `
  -Suite $CLOCK -ExpectTest 'filters the list against the title'

# 12. The no-presets fallback goes. A title allowing at most 45 seconds gets a dropdown with
#     nothing in it - a control that appears to work and offers nothing.
Invoke-Probe -Name '12 no number-box fallback' -File $FIELDS `
  -From 'if (presets.length === 0) {' `
  -To 'if (false) {' `
  -Suite $CLOCK -ExpectTest 'keeps a plain number box when no preset can fit'

# 13. Opening Custom writes a value. An operator who looks and changes their mind has silently
#     edited the contest.
Invoke-Probe -Name '13 Custom edits the value' -File $FIELDS `
  -From @'
          if (next === CUSTOM) {
'@ `
  -To @'
          if (false) {
'@ `
  -Suite $CLOCK -ExpectTest 'does not change the stored value merely because Custom was opened'

# 14. Minutes reach the wire. The value then disagrees with the schema's own minimum and
#     maximum, so validation rejects a legal choice.
Invoke-Probe -Name '14 stores minutes' -File $FIELDS `
  -From 'onChange(Number(next) * 60);' `
  -To 'onChange(Number(next));' `
  -Suite $CLOCK -ExpectTest 'stores seconds, so the game receives what its own schema declares'

Write-Host '=== The derived result grace period ===' -ForegroundColor Cyan

# 15. The derivation goes and the fixed 900 is sent. Every contest with more than ten minutes of
#     play is then REFUSED by the pre-flight, naming a field no screen offers.
Invoke-Probe -Name '15 grace not derived' -File $DRAFT `
  -From @'
  return Math.max(
    draft.resultGracePeriodSeconds,
'@ `
  -To @'
  return Math.min(
    draft.resultGracePeriodSeconds,
'@ `
  -Suite $CLOCK -ExpectTest 'raises the floor to cover the chosen playing time'

# 16. The derivation carries its own margin. Two margins is "one rule, two copies" in its most
#     silent form: the wizard derives a number the server then refuses.
Invoke-Probe -Name '16 grace has its own margin' -File $DRAFT `
  -From 'import { RESULT_GRACE_MARGIN_SECONDS } from "@/lib/services/games/contest-preflight";' `
  -To 'const RESULT_GRACE_MARGIN_SECONDS = 120;' `
  -Suite $CLOCK -ExpectTest 'uses the SAME margin the pre-flight then demands'

# 17. The edit payload forgets it. The two screens then disagree about whether a twenty-minute
#     contest can be saved at all - creation works, editing refuses.
Invoke-Probe -Name '17 edit payload forgets it' -File $DRAFT `
  -From @'
    resultGracePeriodSeconds: deriveResultGraceSeconds(
      draft,
      resolveAttemptSeconds(
        options.schemaFields ?? [],
'@ `
  -To @'
    resultGracePeriodSeconds: draft.resultGracePeriodSeconds,
    unusedGrace: deriveResultGraceSeconds(
      draft,
      resolveAttemptSeconds(
        options.schemaFields ?? [],
'@ `
  -Suite $CLOCK -ExpectTest 'is applied by the payload builders, so no caller can forget'

Write-Host '=== The wizard blocks a contest nobody could start ===' -ForegroundColor Cyan

# 18. The block becomes a warning again. The amber caution was already there and an operator
#     could read it, agree and click Next; the contest then saves, publishes, sells seats and
#     refuses every one of them.
Invoke-Probe -Name '18 block removed' -File $WIZARD `
  -From 'if (fit?.windowTooShort && fit.reservesFullRound) {' `
  -To 'if (false) {' `
  -Suite $CLOCK -ExpectTest 'blocks the schedule step, naming both durations'

# 19. The message stops naming the playing time, so the operator is told the contest is too
#     short and left to guess which of two fields three steps apart to change.
Invoke-Probe -Name '19 message omits the play time' -File $WIZARD `
  -From @'
        return `Play is set to ${describeDurationSeconds(
          fit.reservedSeconds,
        )} but the contest only runs for ${describeDurationSeconds(
'@ `
  -To @'
        return `This contest is too short: ${describeDurationSeconds(
'@ `
  -Suite $CLOCK -ExpectTest 'blocks the schedule step, naming both durations'

Write-Host '=== The note stops contradicting the operator ===' -ForegroundColor Cyan

# 20. The note goes back to the ceiling wording, in copy the operator actually reads. This is
#     the sentence that made the original defect unreportable: it AGREED with the gate, so both
#     were wrong together and the screen confirmed the refusal was correct.
#
#     Aimed at the JSX rather than at a comment on purpose - `readCode` strips comments, so a
#     probe that edits the prose explaining the mistake changes nothing the test can see and
#     reports GREEN.
Invoke-Probe -Name '20 note names the ceiling' -File $NOTE `
  -From 'Shorten the playing time,' `
  -To 'Shorten the longest possible round,' `
  -Suite $CLOCK -ExpectTest 'separates the game'

Write-Host '=== Done ===' -ForegroundColor Cyan
