# Probes the dialog-width guard by reintroducing the defect it exists for, and by breaking
# each of the properties the tokens are supposed to hold.
#
# The defect, 9 September 2026: every admin DialogContent that asked for room with an
# UNPREFIXED `max-w-*` was rendering at 32rem. `cn()` is twMerge, which keys a conflict on the
# utility group AND the modifier, so `max-w-4xl` does not displace the primitive's own
# `sm:max-w-lg`; both reach the DOM, and Tailwind emits the `sm:` rule afterwards at equal
# specificity. The game catalogue's seven-column table was clipped at the fourth column.
#
# Probe 6 is the one worth reading: it mutates the PRIMITIVE, and proves the control test
# reads the base class list out of dialog.tsx rather than carrying its own copy of it.
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

$suite = "__tests__/admin/dialog-widths.test.ts"

$tokens = Join-Path $repo "apps\admin\lib\admin\dialog-widths.ts"
$catalogue = Join-Path $repo "apps\admin\components\admin\games\ProviderCatalogueDialog.tsx"
$credentials = Join-Path $repo "apps\admin\components\admin\games\ProviderCredentialsDialog.tsx"
$primitive = Join-Path $repo "apps\admin\components\ui\dialog.tsx"

$probes = @(
    @{
        Name = "the real defect: the catalogue asks for width with a bare max-w-4xl"
        File = $catalogue
        Expected = "has no DialogContent carrying its own unprefixed max-w"
        Find = 'className={`max-h-[85vh] overflow-y-auto ${DIALOG_WIDTH_WIDE}`}'
        Replace = 'className="max-h-[85vh] max-w-4xl overflow-y-auto"'
    },
    @{
        Name = "the same mutation, against the token-is-named assertion"
        File = $catalogue
        Expected = "names a width token inside every DialogContent it opens"
        Find = 'className={`max-h-[85vh] overflow-y-auto ${DIALOG_WIDTH_WIDE}`}'
        Replace = 'className="max-h-[85vh] max-w-4xl overflow-y-auto"'
    },
    @{
        Name = "a token loses its sm: modifier, so the base cap survives the merge"
        File = $tokens
        Expected = "displaces the primitive's own cap"
        Find = 'export const DIALOG_WIDTH_WIDE = "sm:max-w-'
        Replace = 'export const DIALOG_WIDTH_WIDE = "max-w-'
    },
    @{
        Name = "a token drops its small-screen gutter"
        File = $tokens
        Expected = "viewport gutter"
        Find = 'DIALOG_WIDTH_MEDIUM = "sm:max-w-[min(56rem,calc(100vw-3rem))]"'
        Replace = 'DIALOG_WIDTH_MEDIUM = "sm:max-w-[min(56rem)]"'
    },
    @{
        Name = "two tokens collapse onto one width"
        File = $tokens
        Expected = "keeps the three tokens distinct"
        Find = 'DIALOG_WIDTH_STANDARD = "sm:max-w-[min(32rem,calc(100vw-3rem))]"'
        Replace = 'DIALOG_WIDTH_STANDARD = "sm:max-w-[min(56rem,calc(100vw-3rem))]"'
    },
    @{
        Name = "the PRIMITIVE stops capping, so the control has nothing left to measure"
        File = $primitive
        Expected = "still reports an unprefixed width as capped"
        Find = 'max-w-[calc(100%-1rem)] sm:max-w-lg'
        Replace = 'max-w-[calc(100%-1rem)]'
    },
    @{
        Name = "a second dialog is opened with no width at all"
        File = $credentials
        Expected = "names a width token inside every DialogContent it opens"
        Find = '<DialogContent className={DIALOG_WIDTH_STANDARD}>'
        Replace = '<DialogContent>'
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
