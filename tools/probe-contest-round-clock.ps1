# Probes for the contest-clock explanation on the operator's screens (`12` s2.5).
#
# Each probe reinstates one defect and expects ONE named test to go red. Naming the expected
# test is the point: a probe aimed at the wrong test is indistinguishable from a test that does
# not work - and on 7 September a probe in `probe-lobby-theme.ps1` reported green for a whole
# day because the guard beside it had been narrowed and the probe was never re-aimed.
#
# THIS HARNESS TARGETS SIX FILES, so the target is a parameter. Two of them are the mirrored
# pre-flights, where a guard has to be broken in BOTH copies at once or the surviving one keeps
# the test green - the same reason R42's game gates could not be probed one at a time.

$ErrorActionPreference = "Continue"

$Root = Split-Path -Parent $PSScriptRoot
$Suite = "__tests__/admin/contest-round-clock.test.ts"

$Note = Join-Path $Root "apps\admin\components\admin\games\RoundClockNote.tsx"
$Draft = Join-Path $Root "apps\admin\components\admin\games\contest-draft.ts"
$Wizard = Join-Path $Root "apps\admin\components\admin\games\ProviderContestWizard.tsx"
$Editor = Join-Path $Root "apps\admin\components\admin\games\ProviderContestEditor.tsx"
$Preflight = Join-Path $Root "lib\services\games\contest-preflight.ts"
$AdminPreflight = Join-Path $Root "apps\admin\lib\services\games\contest-preflight.ts"

$Utf8NoBom = New-Object System.Text.UTF8Encoding($false)

function Read-Source([string]$Path) {
    # -LiteralPath equivalent: ReadAllText never globs, which matters because sibling harnesses
    # touch `[id]` paths and a silent empty read there once emptied a route and "restored" it
    # to nothing while every probe went red on the expected test for the wrong reason.
    $text = [System.IO.File]::ReadAllText($Path, $Utf8NoBom)
    if ([string]::IsNullOrWhiteSpace($text)) {
        throw "ABORT: read of $Path came back empty. Refusing to continue."
    }
    return $text
}

function Write-Source([string]$Path, [string]$Text) {
    if ([string]::IsNullOrWhiteSpace($Text)) {
        throw "ABORT: refusing to write empty content to $Path"
    }
    [System.IO.File]::WriteAllText($Path, $Text, $Utf8NoBom)
}

function To-Relaxed([string]$Literal) {
    return ([regex]::Escape($Literal) -replace "\\r\\n|\\n", "\r?\n")
}

# One or more edits, applied together, then all restored together.
function Invoke-Probe {
    param(
        [string]$Name,
        [string]$ExpectTest,
        # Each edit: @{ Target = <path>; Find = <literal>; Replace = <literal> }
        [array]$Edits
    )

    Write-Host ""
    Write-Host "=== PROBE: $Name" -ForegroundColor Cyan
    Write-Host "    expects red: $ExpectTest"

    $originals = @{}
    $applied = $true

    foreach ($edit in $Edits) {
        $target = $edit.Target
        if (-not $originals.ContainsKey($target)) {
            $originals[$target] = Read-Source $target
        }
    }

    foreach ($edit in $Edits) {
        $target = $edit.Target
        $current = Read-Source $target
        $pattern = To-Relaxed $edit.Find
        $patched = [regex]::Replace($current, $pattern, { param($m) $edit.Replace }, 1)
        if ($patched -eq $current) {
            Write-Host "    PROBE DID NOT APPLY - pattern never matched in $(Split-Path -Leaf $target). Result is meaningless." -ForegroundColor Red
            $applied = $false
            break
        }
        Write-Source $target $patched
    }

    try {
        if ($applied) {
            $out = & npx vitest run $Suite -t $ExpectTest 2>&1 | Out-String
            $flat = ($out -replace "\s+", " ")

            if ($flat -match "Tests\s+(\d+)\s+failed") {
                $failed = [int]$Matches[1]
                if ($failed -eq 1) {
                    Write-Host "    RED as expected (1 failed)" -ForegroundColor Green
                }
                else {
                    Write-Host "    RED but $failed tests failed - expected exactly 1. Suspect collateral damage, not a guard." -ForegroundColor Yellow
                }
            }
            elseif ($flat -match "No test found") {
                Write-Host "    NO TEST RAN - the expected test name does not match. Probe is mis-aimed." -ForegroundColor Red
            }
            elseif ($flat -match "Tests\s+.*(passed|skipped)") {
                Write-Host "    GREEN - the guard is NOT held by this test. Investigate: weak test, wrong claim, unreachable, missing test, or a defect the COMPILER refuses." -ForegroundColor Red
            }
            else {
                Write-Host "    UNKNOWN result - read the output." -ForegroundColor Yellow
                Write-Host $out
            }
        }
    }
    finally {
        foreach ($target in $originals.Keys) {
            Write-Source $target $originals[$target]
            if ((Read-Source $target) -ne $originals[$target]) {
                Write-Host "    !! RESTORE FAILED - fix $target by hand before continuing." -ForegroundColor Red
            }
        }
    }
}

Write-Host "Probing the contest-clock explanation" -ForegroundColor White

# --- describeRoundFit ---------------------------------------------------------------------

# 1. The deadline computed from the start rather than the end, which is the plausible slip and
#    puts the cut-off at the beginning of the contest.
Invoke-Probe -Name "the last-attempt moment is measured from the wrong end" `
    -ExpectTest "says when the last attempt can start" `
    -Edits @(
    @{
        Target  = $Draft
        Find    = "lastAttemptStart: new Date(end.getTime() - maxDurationSeconds * 1000),"
        Replace = "lastAttemptStart: new Date(start.getTime() + maxDurationSeconds * 1000),"
    }
)

# 2. An absent duration guessed rather than declined. This is the one that would contradict the
#    server: `RoundPreflight.tsx` applies no gate, so a screen stating a cut-off invents one.
Invoke-Probe -Name "an absent round length is guessed instead of declined" `
    -ExpectTest "says nothing at all when the catalogue declares no duration" `
    -Edits @(
    @{
        Target  = $Draft
        Find    = "if (typeof maxDurationSeconds !== `"number`" || !(maxDurationSeconds > 0)) {`n    return undefined;`n  }"
        Replace = "if (false) {`n    return undefined;`n  }"
    }
)

# 3. Half-typed dates rendered as "Invalid Date" into a sentence about the operator's contest.
Invoke-Probe -Name "an unparseable date is rendered rather than skipped" `
    -ExpectTest "says nothing while the dates are still half-typed" `
    -Edits @(
    @{
        Target  = $Draft
        Find    = "if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {"
        Replace = "if (false) {"
    }
)

# 4. The too-short boundary made inclusive, refusing a contest exactly one round long that the
#    server accepts. A guard stricter than the server it mirrors is still a wrong answer.
Invoke-Probe -Name "a contest exactly one round long is flagged as too short" `
    -ExpectTest "does not flag a contest exactly one round long" `
    -Edits @(
    @{
        Target  = $Draft
        Find    = "windowTooShort: windowSeconds < maxDurationSeconds,"
        Replace = "windowTooShort: windowSeconds <= maxDurationSeconds,"
    }
)

# --- one definition, both screens ---------------------------------------------------------

# 5. The editor stops explaining the clock. Probed on the EDITOR rather than the wizard,
#    because a test that mentions only one screen is green when the other loses it - the same
#    reason the withholding test in `12` s2.2 swaps its two destinations rather than deleting
#    one.
Invoke-Probe -Name "only the wizard explains the clock" `
    -ExpectTest "is rendered by the wizard AND the editor" `
    -Edits @(
    @{
        Target  = $Editor
        Find    = "import { RoundClockNote } from `"./RoundClockNote`";"
        Replace = ""
    }
)

# 6. A screen derives the deadline itself beside the shared note. This is the drift the shared
#    module exists to prevent, and importing the note does not prevent it.
Invoke-Probe -Name "a screen recomputes the deadline for itself" `
    -ExpectTest "derives the deadline in ONE place, not in the screens" `
    -Edits @(
    @{
        Target  = $Wizard
        Find    = "function StepTiming({"
        Replace = "const ownDeadline = (e: number, d: number) => new Date(e - d * maxDurationSeconds * 1000);`n`nfunction StepTiming({"
    }
)

# 7. The actionable half dropped, leaving the rule without the moment. "Reserves 300 seconds"
#    on its own is the formula the owner already could not relate to the contest.
Invoke-Probe -Name "the rule is stated without the wall-clock moment" `
    -ExpectTest "names the reserved seconds and the wall-clock moment, not a formula" `
    -Edits @(
    @{
        Target  = $Note
        Find    = "{fit.lastAttemptStart.toLocaleString()}"
        Replace = "{fit.reservedSeconds}"
    }
)

# 8. The settings/timing split collapsed, so one generic paragraph appears in both places -
#    which is the copy people learn to skip.
Invoke-Probe -Name "both screens get the same generic paragraph" `
    -ExpectTest "explains the game's settings and the contest clock in BOTH places" `
    -Edits @(
    @{
        Target  = $Editor
        Find    = "variant=`"timing`""
        Replace = "variant=`"settings`""
    }
)

# 9. The too-short warning removed from the point of cause, so the operator meets it only on
#    review, having already set the dates that caused it.
Invoke-Probe -Name "the too-short contest is not flagged beside the dates" `
    -ExpectTest "warns about a contest too short for its own game before the review step" `
    -Edits @(
    @{
        Target  = $Note
        Find    = "{fit?.windowTooShort && ("
        Replace = "{false && ("
    }
)

# --- no game named -------------------------------------------------------------------------

# 10. A per-game special case, which is the one failure mode of the "no developer needed for a
#     new title" claim. Written the obvious way: read the sprint's own config key.
#
#     RE-AIMED. The first version injected `const configured = 120; // durationSeconds` and
#     reported GREEN, which is the guard behaving correctly rather than a hole: `readCode`
#     strips comments before matching, deliberately, because these files EXPLAIN the mistakes
#     they forbid and a test that reads prose fails in both directions. A mention in a comment
#     is not per-game code. The mutation has to be code, so it now reads the config key.
Invoke-Probe -Name "the note grows a special case for one game's config key" `
    -ExpectTest "names no game, provider or config field anywhere in the explanation" `
    -Edits @(
    @{
        Target  = $Note
        Find    = "  const fit = describeRoundFit({ startTime, endTime, maxDurationSeconds });"
        Replace = "  const fit = describeRoundFit({ startTime, endTime, maxDurationSeconds });`n  const configuredRound = Number(settings[`"durationSeconds`"]);"
    }
)

# --- the refusal ---------------------------------------------------------------------------

# 11. The old wording restored, in BOTH copies at once. One copy alone leaves the test green,
#     because the assertion loops over the pair - so this proves the pair, not one file.
Invoke-Probe -Name "the refusal goes back to quoting a number the operator never chose" `
    -ExpectTest "calls the reserved figure the game's longest possible round, in BOTH copies" `
    -Edits @(
    @{
        Target  = $Preflight
        Find    = "``The contest is shorter than this game's longest possible round (`${roundSeconds} seconds), so no player could finish. That is the game's maximum rather than the length set in its own settings - the platform reserves the maximum so an attempt is never cut short.``"
        Replace = "``The play window is shorter than one round of this game (`${roundSeconds} seconds), so no player could finish.``"
    },
    @{
        Target  = $AdminPreflight
        Find    = "``The contest is shorter than this game's longest possible round (`${roundSeconds} seconds), so no player could finish. That is the game's maximum rather than the length set in its own settings - the platform reserves the maximum so an attempt is never cut short.``"
        Replace = "``The play window is shorter than one round of this game (`${roundSeconds} seconds), so no player could finish.``"
    }
)

# 12. The gate "fixed" to read the configured value - the wrong-direction repair this whole
#     slice exists to prevent. It makes the message honest and lets a round be cut off
#     mid-play, which chapter 03 section 1.2 forbids.
Invoke-Probe -Name "the gate reads the configured round length instead of the ceiling" `
    -ExpectTest "still gates on the ceiling rather than the configured value" `
    -Edits @(
    @{
        Target  = $Preflight
        Find    = "const roundSeconds = input.title.maxDurationSeconds;"
        Replace = "const roundSeconds = Number(input.settings[`"durationSeconds`"]);"
    },
    @{
        Target  = $AdminPreflight
        Find    = "const roundSeconds = input.title.maxDurationSeconds;"
        Replace = "const roundSeconds = Number(input.settings[`"durationSeconds`"]);"
    }
)

# --- the stale caution ---------------------------------------------------------------------

# 13. The false promise restored. It told operators publishing did not exist yet, two days
#     after it shipped.
Invoke-Probe -Name "the review step tells the operator to wait for publishing" `
    -ExpectTest "tells the operator to publish rather than to wait for a feature" `
    -Edits @(
    @{
        Target  = $Wizard
        Find    = "Press{`" `"}`n            <strong className=`"text-white`">Publish</strong> on the contest list when you are`n            ready for it to appear."
        Replace = "Publishing arrives with the player-facing game screens."
    }
)

Write-Host ""
Write-Host "Done. Every probe should read RED as expected (1 failed)." -ForegroundColor White
