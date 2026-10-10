# Probes `__tests__/games/challenge-game-picker.test.ts` - the other two things the owner asked
# for on 13 September 2026: the game selection is a scrolling list, and the dialog adapts to
# whatever settings a title declares.
#
# Same harness shape as `probe-challenge-arena.ps1` - see that file for the encoding notes
# (read/write UTF-8 without a BOM, ASCII-only anchors, and the rule that PROBE DID NOT APPLY
# means the target moved rather than that the run was quiet).

$ErrorActionPreference = 'Continue'
$env:NODE_OPTIONS = ''

$SUITE = '__tests__/games/challenge-game-picker.test.ts'
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

$COPY = 'lib/services/games/challenge-game-copy.ts'
$PICKER = 'components/challenges/ChallengeGamePicker.tsx'
$FIELDS = 'components/challenges/ChallengeSettingsFields.tsx'
$DIALOG = 'components/challenges/ChallengeCreateDialog.tsx'
$SCHEMA = 'lib/services/games/config-schema.ts'
$ADMIN = 'apps/admin/components/admin/games/ConfigSchemaFields.tsx'
$TITLES = 'lib/services/games/challengeable-titles.service.ts'

Write-Host "`n=== what a row says ===" -ForegroundColor Cyan

# The one fact a player cannot discover by playing. Reversed, a time trial advertises that the
# highest time wins - and the leaderboard then correctly pays the fastest, so the screen and the
# payout disagree with nobody to arbitrate.
Probe -Name 'the score direction is stated backwards' `
  -File $COPY `
  -Find 'title.scoreDirection === "lower_is_better" ? "Lowest wins" : "Highest wins",' `
  -Replace 'title.scoreDirection === "lower_is_better" ? "Highest wins" : "Lowest wins",' `
  -ExpectRed 'leads with the provider and ends with which direction wins'

# The ceiling printed as a length. `maxDurationSeconds` is the longest a round MAY last, so this
# is a deadline the platform never set - R66's distinction, one screen along.
Probe -Name 'the round ceiling is stated as a flat length' `
  -File $COPY `
  -Find '        ? `Up to ${minutes} min per round`' `
  -Replace '        ? `${minutes} min per round`' `
  -ExpectRed 'states the round ceiling as an UP TO'

# A guessed clock for a title that declares none - the shape R66 was reported for.
Probe -Name 'a title with no declared clock is given one anyway' `
  -File $COPY `
  -Find '  if (title.maxDurationSeconds && title.maxDurationSeconds > 0) {' `
  -Replace '  if (true) {' `
  -ExpectRed 'says nothing at all about the clock'

Write-Host "`n=== the list is a list ===" -ForegroundColor Cyan

# The defect itself, restored: the horizontal strip. It renders perfectly and puts the eleventh
# game off the right-hand edge of a dialog nobody scrolls sideways.
Probe -Name 'the list goes back to a horizontal strip' `
  -File $PICKER `
  -Find '      <div className="max-h-[13.5rem] space-y-1.5 overflow-y-auto rounded-xl border border-gray-800 bg-gray-900/40 p-1.5">' `
  -Replace '      <div className="flex flex-nowrap gap-1.5 overflow-x-auto rounded-xl border border-gray-800 bg-gray-900/40 p-1.5">' `
  -ExpectRed 'scrolls on its own axis with a capped height'

# The cap removed, which is the half-fix: the list is vertical and twenty games push the entry
# fee, the prize summary and the Send button below the fold. The screen reads as a game menu.
Probe -Name 'the height cap is removed and the dialog grows instead' `
  -File $PICKER `
  -Find 'max-h-[13.5rem] space-y-1.5 overflow-y-auto' `
  -Replace 'space-y-1.5' `
  -ExpectRed 'scrolls on its own axis with a capped height'

# Trading moved below the fetched titles. It is the one option every existing challenge depends
# on, and it needs no provider, no adapter and no content seed.
Probe -Name 'Trading is listed after the fetched provider titles' `
  -File $PICKER `
  -Find '        <GameRow
          label="Trading"' `
  -Replace '        <GameRow
          label="Trading-moved"' `
  -ExpectRed 'renders Trading first and without fetching it'

# The reason dropped, so an unusable title is a dead control with nothing to read. Same class as
# a provider with no adapter: a disabled switch teaches nothing.
#
# ANCHORED ON THE ASCII PREFIX ONLY: the line ends in a middle dot, and a non-ASCII character
# does not survive the round trip through the shell - which reports PROBE DID NOT APPLY, an
# outcome indistinguishable from a guard whose target has moved.
Probe -Name 'a disabled row shows no reason' `
  -File $PICKER `
  -Find '{reason ?? facts.join(' `
  -Replace '{facts.join(' `
  -ExpectRed 'shows an unusable title disabled WITH ITS REASON'

Write-Host "`n=== the defaults ===" -ForegroundColor Cyan

# A boolean left absent rather than off. The control then renders in neither position, and the
# player cannot see which state a setting they are paying to play under is in.
Probe -Name 'a boolean with no declared default is left absent' `
  -File $SCHEMA `
  -Find '    else if (field.type === "boolean") values[field.name] = false;' `
  -Replace '' `
  -ExpectRed 'seeds a boolean with no declared default as OFF'

# The tidy-looking version: seed a bare number with its minimum. That submits a choice nobody
# made, and it passes every bounds check, so nothing downstream can tell.
Probe -Name 'a bare number is seeded with its minimum' `
  -File $SCHEMA `
  -Find '    if (field.default !== undefined) values[field.name] = field.default;' `
  -Replace '    if (field.default !== undefined) values[field.name] = field.default;
    else if (field.minimum !== undefined) values[field.name] = field.minimum;' `
  -ExpectRed 'seeds a boolean with no declared default as OFF'

# The admin form declaring its own copy again. Two definitions mean an operator's untouched form
# and a player's untouched form producing different rounds of the same title.
Probe -Name 'the admin form declares its own copy of the defaults' `
  -File $ADMIN `
  -Find 'export { defaultConfigValues } from "@/lib/services/games/config-schema";' `
  -Replace 'export function defaultConfigValues(fields: ConfigField[]): Record<string, unknown> {
  const values: Record<string, unknown> = {};
  for (const field of fields) if (field.default !== undefined) values[field.name] = field.default;
  return values;
}' `
  -ExpectRed 'is ONE definition shared with the admin form'

Write-Host "`n=== the form adapts ===" -ForegroundColor Cyan

# The one failure mode of the no-developer-needed claim. It reads as a helpful refinement and it
# makes every future title need a developer again.
Probe -Name 'the form special-cases one game field by name' `
  -File $FIELDS `
  -Find '  if (field.type === "boolean") {' `
  -Replace '  if (field.name === "boardSize") return null;
  if (field.type === "boolean") {' `
  -ExpectRed 'names no field, no game code and no provider key'

# The play clock stored in minutes. The stored value is then not what the title's own schema
# declares, and a title whose clock is genuinely in seconds needs a special case at the far end.
Probe -Name 'the play clock is stored in minutes rather than seconds' `
  -File $FIELDS `
  -Find '        onChange(raw === "" ? "" : Number(raw) * 60);' `
  -Replace '        onChange(raw === "" ? "" : Number(raw));' `
  -ExpectRed 'shows a play clock in minutes while STORING seconds'

# The hint printing raw seconds beside a box holding minutes - how somebody types 600 into a
# field expecting 10.
Probe -Name 'a duration hint states its bounds in seconds' `
  -File $FIELDS `
  -Find '  const unit = (raw: number) => (duration ? Math.round(raw / 60) : raw);' `
  -Replace '  const unit = (raw: number) => raw;' `
  -ExpectRed "states a duration field's bounds in the unit the box is showing"

# R60 reproduced exactly: the translucent surface a native select composites its own list over,
# which reported as the option list being empty rather than as a colour.
Probe -Name 'the select takes the dialog translucent surface (R60)' `
  -File $FIELDS `
  -Find 'className="h-9 w-full rounded-md border border-gray-700 bg-gray-800 px-3' `
  -Replace 'className="h-9 w-full rounded-md border border-gray-700 bg-gray-800/60 px-3' `
  -ExpectRed 'draws its own list surface opaque'

# A title with no settings rendering nothing at all, which reads as a dialog still loading.
Probe -Name 'a title with no settings renders silence' `
  -File $FIELDS `
  -Find '  if (fields.length === 0) {' `
  -Replace '  if (false) {' `
  -ExpectRed 'says so when a title has no settings'

Write-Host "`n=== the dialog carries them ===" -ForegroundColor Cyan

# A third writer of the selection that forgets the settings. The form then renders the new
# title's controls over the old title's values, and the route refuses a field nobody saw.
Probe -Name 'the game is reset somewhere without reseeding the settings' `
  -File $DIALOG `
  -Find '      setSelection({ type: "trading" });
      setGameSettings({});' `
  -Replace '      setSelection({ type: "trading" });' `
  -ExpectRed 'moves the game and its settings TOGETHER'

# The merge, which is the change somebody makes to "keep the player's choices". Keys from the
# previous schema then travel to a route that refuses them by name.
#
# RE-AIMED 13 Sep 2026: the seed used to be `defaultConfigValues(next.title.settingsFields)` and
# is now the title's own resolved defaults, so the old pattern reported PROBE DID NOT APPLY -
# which reads like a broken harness rather than a moved target. The claim is unchanged.
Probe -Name 'the previous game settings are merged rather than replaced' `
  -File $DIALOG `
  -Find '    setGameSettings(next.type === "provider" ? next.title.defaults.settings : {});' `
  -Replace '    setGameSettings((prev) => ({
      ...prev,
      ...(next.type === "provider" ? next.title.defaults.settings : {}),
    }));' `
  -ExpectRed 'replaces the settings WHOLE on a game change'

# The picker wired straight at the setter. It compiles, reviews as correct, and silently skips
# the seeding - so an untouched form submits nothing where the title declared defaults.
Probe -Name 'the picker sets the selection state directly' `
  -File $DIALOG `
  -Find '            onSelect={chooseGame}' `
  -Replace '            onSelect={setSelection}' `
  -ExpectRed 'routes every pick through the one handler'

# The settings dropped from the payload, so every challenge is created on the schema's own
# defaults - the state before this work, with a form in front of it that appears to do something.
Probe -Name 'the chosen settings are not sent to the create route' `
  -File $DIALOG `
  -Find '              settings: gameSettings,' `
  -Replace '' `
  -ExpectRed 'sends them to the create route'

Write-Host "`n=== the field list reaches the client ===" -ForegroundColor Cyan

# The reader dropping the parsed fields. The dialog then renders an empty form for every title
# and says the game has no settings to choose - which is a sentence, not an error.
Probe -Name 'the title reader sends no field list' `
  -File $TITLES `
  -Find '      settingsFields: parsed.ok ? parsed.fields : [],' `
  -Replace '      settingsFields: [],' `
  -ExpectRed 'carries the parsed settings fields' `
  -Suite '__tests__/services/challengeable-titles.test.ts'

# Anything at all reaching the client from a failed parse. The obvious mutation - reading
# `(parsed as { fields?: unknown[] }).fields ?? []` - came back GREEN, and it is the fourth cause
# of a green probe rather than a weak test: a `ParseResult` failure carries `error` and no
# `fields` at all, so `?? []` produces the identical empty list. The mutation therefore fabricates
# a field, which is what "a partial list" would look like on the wire.
Probe -Name 'a malformed schema sends a partial field list' `
  -File $TITLES `
  -Find '      settingsFields: parsed.ok ? parsed.fields : [],' `
  -Replace '      settingsFields: parsed.ok ? parsed.fields : [{} as ConfigField],' `
  -ExpectRed 'carries an EMPTY field list for a malformed schema' `
  -Suite '__tests__/services/challengeable-titles.test.ts'

Write-Host "`n=== done ===`n" -ForegroundColor Cyan
