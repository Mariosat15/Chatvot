# Probes the genre-picker guard by reintroducing the defect it exists for, and by breaking
# each property the sentinels and the generated option list are supposed to hold.
#
# The defect, 9 September 2026: the Genre drop-down on the game content dialog opened as a
# tall, almost empty list with one word in it. Nothing was missing. It was the only native
# `<select>` left on the games surface, and a browser paints that list itself - background from
# the element's own `background-color`, options inheriting `color`. Every field here is themed
# `bg-white/5 text-white`, and a translucent white composites over the browser's light list
# surface, so all fifteen options rendered white on white. Only the highlighted row was
# legible, against the operating system's selection band.
#
# Probe 3 is the one worth reading. Radix reserves `""` for "nothing is selected" and throws on
# an item carrying it, so `<option value="">No genre</option>` could not be ported across as it
# stood - and a sentinel chosen carelessly ("none", "custom") is a genre an operator can type.
#
# Harness rules encoded here, each of which has produced a false result in this repository:
#   - -LiteralPath / ReadAllText on the READ as well as the WRITE, and refuse to write when the
#     read came back empty. A path with a [dynamic] segment is a PowerShell wildcard.
#   - UTF-8 WITHOUT a BOM on both, with a lossless round trip asserted before any mutation.
#   - Name the EXPECTED failing test per probe and run it alone with -t. Searching whole-suite
#     output for a name reports red for a passing test as readily as a failing one.
#   - Assert the file actually changed. DID NOT APPLY means the target moved, never that the
#     run was quiet.

$ErrorActionPreference = 'Continue'
$repo = Split-Path -Parent $PSScriptRoot
$utf8 = New-Object System.Text.UTF8Encoding($false)

$suite = "__tests__/admin/game-categories.test.ts"
$legibility = "__tests__/admin/native-select-legibility.test.ts"

$dialog = Join-Path $repo "apps\admin\components\admin\games\GameContentDialog.tsx"
$legibilityFile = Join-Path $repo "__tests__\admin\native-select-legibility.test.ts"
$incidents = Join-Path $repo "apps\admin\components\admin\IncidentsSection.tsx"

$probes = @(
    @{
        Name = "the real defect: the picker goes back to a native select"
        File = $dialog
        Expected = "uses the shared Select, never a native"
        Find = '<SelectTrigger className="h-10 border-white/10 bg-white/5 text-sm text-white">'
        Replace = '<select className="h-10 border-white/10 bg-white/5 text-sm text-white">'
    },
    @{
        Name = "the same mutation, against the whole-surface directory read"
        File = $dialog
        Expected = "no other picker on this surface has one either"
        Find = '<SelectTrigger className="h-10 border-white/10 bg-white/5 text-sm text-white">'
        Replace = '<select className="h-10 border-white/10 bg-white/5 text-sm text-white">'
    },
    @{
        Name = "no-genre travels as an empty string, which Radix throws on"
        File = $dialog
        Expected = "sentinels are non-empty and unreachable"
        Find = 'const NO_GENRE = "__no_genre__";'
        Replace = 'const NO_GENRE = "";'
    },
    @{
        Name = "a sentinel an operator could type as a genre"
        File = $dialog
        Expected = "sentinels are non-empty and unreachable"
        Find = 'const CUSTOM = "__custom__";'
        Replace = 'const CUSTOM = "custom";'
    },
    @{
        Name = "one option is typed out rather than generated"
        File = $dialog
        Expected = "generates the options from the vocabulary"
        Find = '<SelectItem key={entry.slug} value={entry.slug}>'
        Replace = '<SelectItem key="puzzle" value="puzzle">'
    },
    @{
        Name = "the vocabulary stops driving the list at all"
        File = $dialog
        Expected = "generates the options from the vocabulary"
        Find = '{GAME_CATEGORIES.map((entry) => ('
        Replace = '{[].map((entry: { slug: string; label: string }) => ('
    },
    # ---------------------------------------------------------------------------------------
    # The platform-wide rule: a native select on a translucent background, anywhere.
    # ---------------------------------------------------------------------------------------
    @{
        Name = "a clean native select is given a translucent background"
        Suite = $legibility
        File = $incidents
        Expected = "no unlisted file combines the two"
        Find = 'className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm"'
        Replace = 'className="bg-white/5 border border-gray-700 rounded-lg px-3 py-2 text-sm"'
    },
    @{
        # Proves the offender scan actually REACHES the known instance rather than the
        # exception list papering over a scan that finds nothing. Same role as the probe that
        # mutates the dialog primitive in probe-dialog-widths.ps1.
        Name = "the known exception is delisted, so the scan has to find it unaided"
        Suite = $legibility
        File = $legibilityFile
        Expected = "no unlisted file combines the two"
        Find = 'const KNOWN_UNFIXED = new Set(["apps/admin/components/admin/MessagingSection.tsx"]);'
        Replace = 'const KNOWN_UNFIXED = new Set<string>([]);'
    },
    @{
        # THE CONTROL. The first version of the scan was `<select\b[^>]*>`, which stops at the
        # `>` inside `onChange={(e) => ...}` and never reaches className - every assertion
        # green, every file reported clean. This is the probe that has to stay red.
        Name = "the scan reverts to stopping at the first > , as it originally did"
        Suite = $legibility
        File = $legibilityFile
        Expected = "reads past an inline handler to reach className"
        Find = '  const starts = /<select\b/g;'
        Replace = '  return [...source.matchAll(/<select\b[^>]*>/g)].map((m) => m[0]);' + "`n" + '  const starts = /<select\b/g;'
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

    # Reason: parameterise on the SUITE, not just the test name. A probe run against the wrong
    # file reports "no test found", which reads like a broken harness rather than a missing
    # guard - the sixth probing lesson in this repository.
    $targetSuite = if ($probe.ContainsKey('Suite')) { $probe.Suite } else { $suite }

    try {
        $raw = & npx vitest run $targetSuite -t $probe.Expected 2>&1 | Out-String
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
