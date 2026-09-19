# Probes the task-12 guards by reintroducing the defect they exist for, and by breaking each
# property the shape's forced values and withheld controls are supposed to hold.
#
# The defect, 10 September 2026: `ProviderContestEditor.tsx` never imported `play-shape.ts`.
# The wizard had withheld the attempts and round-start controls on a simultaneous contest
# since `22` s8; the editor offered both, and `applyEdit` forces both unconditionally and
# BEFORE it reads what the operator sent. So choosing "Best of several" on a race saved as
# `single`, with a success toast and the screen still showing the choice until a reload.
#
# Probes 8-11 are the ones worth reading. They mutate `play-shape.ts` rather than a screen,
# because the invariant that matters is not "the editor hides two controls" - it is that a
# control is withheld exactly when the shape forces its value. A third mode that forces
# something and offers its control anyway is the failure this catches, on the day it is added.
#
# Harness rules encoded here, each of which has produced a false result in this repository:
#   - -LiteralPath / ReadAllText on the READ as well as the WRITE, and refuse to write when the
#     read came back empty. A path with a [dynamic] segment is a PowerShell wildcard, and this
#     harness mutates `app/api/games/contests/[competitionId]/route.ts`.
#   - UTF-8 WITHOUT a BOM on both, with a lossless round trip asserted before any mutation.
#   - Name the EXPECTED failing test per probe and run it alone with -t. Searching whole-suite
#     output for a name reports red for a passing test as readily as a failing one.
#   - Assert the file actually changed. DID NOT APPLY means the target moved, never that the
#     run was quiet.

$ErrorActionPreference = 'Continue'
$repo = Split-Path -Parent $PSScriptRoot
$utf8 = New-Object System.Text.UTF8Encoding($false)

$suite = "__tests__/admin/contest-mode-adaptive-settings.test.ts"

$editor = Join-Path $repo "apps\admin\components\admin\games\ProviderContestEditor.tsx"
$prizes = Join-Path $repo "apps\admin\components\admin\games\wizard\StepPrizes.tsx"
$shapeFile = Join-Path $repo "lib\services\games\play-shape.ts"
# Reason: -LiteralPath everywhere, because [competitionId] is a PowerShell wildcard character
# class. A Get-Content on it matches nothing and returns $null while Set-Content writes that
# back happily - the harness that emptied a route and reported six passing probes.
$route = Join-Path $repo "apps\admin\app\api\games\contests\[competitionId]\route.ts"

$probes = @(
    # ---------------------------------------------------------------------------------------
    # The screens
    # ---------------------------------------------------------------------------------------
    @{
        Name = "the real defect: the editor offers attempts on a simultaneous contest"
        File = $editor
        Expected = "withholds every attempts control"
        Find = '          {!shape.requiresSingleAttempt && ('
        Replace = '          {true && ('
    },
    @{
        # The half-removed guard. With the condition written twice this was green, because the
        # surviving copy satisfied a backwards search from the attempts count.
        Name = "the attempts count escapes the guard on its own"
        File = $editor
        Expected = "withholds every attempts control"
        Find = '              {draft.attemptsPolicy !== "single" && ('
        Replace = '            </>
          )}
          {draft.attemptsPolicy !== "single" && ('
    },
    @{
        Name = "the round-start control goes back to being unconditional"
        File = $editor
        Expected = "withholds the round-start control"
        Find = '        {shape.offersRoundStartPolicy ? ('
        Replace = '        {true ? ('
    },
    @{
        # The exact wording that was there before task 12, on a shape whose start is also the
        # moment entry closes.
        Name = "the editor hardcodes its date label again"
        File = $editor
        Expected = "takes its date labels and hints from the shape"
        Find = '            label={shape.copy.startLabel}'
        Replace = '            label="Contest starts"'
    },
    @{
        Name = "the editor resolves the shape for itself instead of being handed it"
        File = $editor
        Expected = "does not resolve the shape itself"
        Find = '  const shape = playShapeRules(playMode ?? "anytime");'
        Replace = '  const shape = playShapeRules(resolvePlayMode(stored as never));'
    },
    @{
        # Not a rename: once a title supports two shapes, the title's answer is its DEFAULT, so
        # this tells the editor a staggered contest is a synchronised one.
        Name = "the route resolves from the title rather than from the contest"
        File = $route
        Expected = "resolves from the stored contest and the title"
        Find = 'resolveContestPlayMode(contest.playMode, title)'
        Replace = 'resolvePlayMode(title)'
    },
    @{
        Name = "the wizard carries its own copy of the withheld sentence"
        File = $prizes
        Expected = "both screens read the sentences rather than carrying them"
        Find = '          {shape.copy.attemptsWithheld}'
        Replace = '          Everyone plays this game at the same moment, so there is one attempt each. A race cannot be re-run against a field that has already finished.'
    },
    # ---------------------------------------------------------------------------------------
    # The invariant: withheld exactly when forced
    # ---------------------------------------------------------------------------------------
    @{
        Name = "a forced round-start policy whose control is offered anyway"
        File = $shapeFile
        Expected = "the round-start control is offered only when nothing is forced"
        Find = '  offersRoundStartPolicy: false,
  forcedRoundStartPolicy: "until_window_closes",'
        Replace = '  offersRoundStartPolicy: true,
  forcedRoundStartPolicy: "until_window_closes",'
    },
    @{
        # The mirror image. Dropping the flag while the forced value stays is the more likely
        # accident, because the flag reads as presentation and the policy reads as behaviour.
        Name = "a forced attempts policy whose control is offered anyway"
        File = $shapeFile
        Expected = "the attempts control is withheld only when a policy is forced"
        Find = '  requiresSingleAttempt: true,
  forcedAttemptsPolicy: "single",'
        Replace = '  requiresSingleAttempt: false,
  forcedAttemptsPolicy: "single",'
    },
    @{
        Name = "a control is withheld with no reason given in its place"
        File = $shapeFile
        Expected = "a withheld control carries its reason"
        Find = '    attemptsWithheld:
      "Everyone plays this game at the same moment'
        Replace = '    unusedWithheld:
      "Everyone plays this game at the same moment'
    },
    @{
        # A shape that adapts nothing visible. Every structural assertion stays green, because
        # the screens are still reading `shape.copy` - they are just being told the same thing.
        Name = "the two shapes are given identical wording"
        File = $shapeFile
        Expected = "gives the two shapes different words"
        Find = '    startLabel: "Everyone starts at",'
        Replace = '    startLabel: "Contest starts",'
    }
)

function Read-Source([string]$path) {
    $text = [System.IO.File]::ReadAllText($path, $utf8)
    if ([string]::IsNullOrWhiteSpace($text)) {
        Write-Host "ABORT: read returned empty for $path" -ForegroundColor Red
        exit 1
    }
    return $text
}

function Write-Source([string]$path, [string]$text) {
    if ([string]::IsNullOrWhiteSpace($text)) {
        Write-Host "ABORT: refusing to write empty content to $path" -ForegroundColor Red
        exit 1
    }
    [System.IO.File]::WriteAllText($path, $text, $utf8)
}

# Reason: escape the pattern, then relax every newline to \r?\n. A multi-line literal with
# CRLF endings does not match an LF file, and the probe then reports DID NOT APPLY on a
# perfectly good target.
function Relaxed([string]$literal) {
    return [regex]::Escape($literal) -replace '\\r\\n|\\n', '\r?\n'
}

$results = @()

foreach ($probe in $probes) {
    Write-Host ""
    Write-Host "=== $($probe.Name) ===" -ForegroundColor Cyan

    $path = $probe.File
    if (-not (Test-Path -LiteralPath $path)) {
        Write-Host "ABORT: $path does not exist. Re-aim the probe." -ForegroundColor Red
        exit 1
    }

    $original = Read-Source $path

    Write-Source $path $original
    if ((Read-Source $path) -ne $original) {
        Write-Host "ABORT: read/write is not lossless. Fix the encoding before trusting any probe." -ForegroundColor Red
        exit 1
    }

    $mutated = [regex]::Replace(
        $original,
        (Relaxed $probe.Find),
        [System.Text.RegularExpressions.MatchEvaluator] { param($m) $probe.Replace }
    )
    if ($mutated -eq $original) {
        Write-Host "PROBE DID NOT APPLY - the target moved. This is NOT a quiet pass; re-aim it." -ForegroundColor Red
        $results += "DID NOT APPLY: $($probe.Name)"
        continue
    }

    Write-Host "Injecting the defect ..." -ForegroundColor Yellow
    Write-Source $path $mutated

    try {
        $raw = & npx vitest run $suite -t $probe.Expected 2>&1 | Out-String
        # Reason: Out-String wraps at the console width, so a long test name arrives split
        # across two lines and a literal match silently misses it. Collapse whitespace first.
        $flat = ($raw -replace '\s+', ' ')

        if ($flat -match 'Tests\s+(\d+)\s+failed') {
            $failed = [int]$Matches[1]
            if ($failed -eq 1) {
                Write-Host "RED (1 failure, as expected) - the guard catches the defect." -ForegroundColor Green
                $results += "RED (1): $($probe.Name)"
            } else {
                Write-Host "RED but $failed failures for a one-line change. Expected 1." -ForegroundColor Yellow
                Write-Host "  More damage than the probe caused means it is not reporting on this guard." -ForegroundColor Yellow
                $results += "RED ($failed): $($probe.Name)"
            }
        } elseif ($flat -match 'No test found') {
            Write-Host "NO TEST RAN - the expected name does not match any test. Re-aim it." -ForegroundColor Red
            $results += "NO TEST: $($probe.Name)"
        } else {
            Write-Host "GREEN - THE GUARD DOES NOT CATCH THE DEFECT." -ForegroundColor Red
            Write-Host "  Four causes, and they need different answers: a weak test, a wrong claim," -ForegroundColor Red
            Write-Host "  an unreachable guard, or a mutation that changed no observable." -ForegroundColor Red
            Write-Host ($raw -split "`n" | Select-Object -Last 12)
            $results += "GREEN: $($probe.Name)"
        }
    } finally {
        Write-Source $path $original
        if ((Read-Source $path) -eq $original) {
            Write-Host "Restored $(Split-Path -Leaf $path)." -ForegroundColor Cyan
        } else {
            Write-Host "RESTORE FAILED - check git status before committing." -ForegroundColor Red
        }
    }
}

Write-Host ""
Write-Host "=== Summary ===" -ForegroundColor Cyan
$results | ForEach-Object { Write-Host "  $_" }
