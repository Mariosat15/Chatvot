# Probes for X6.5 A3b - the lowercase-prose terminology guard.
#
# Each probe reintroduces one shape of the defect the guard exists to catch, runs the named
# test alone, and asserts it goes red with exactly the expected count. Run alone rather than
# as part of the suite, because a probe judged by searching whole-suite output for a test's
# NAME reads a passing test as readily as a failing one - vitest prints the name either way.
#
# UTF-8 without a BOM on the read AND the write: PowerShell 5.1's `Get-Content -Raw` decodes
# with the system ANSI codepage, so every emoji in a touched file comes back as mojibake and
# is written back that way - probes pass, files are quietly mangled, and it surfaces two steps
# later as unexplained typecheck errors.

$ErrorActionPreference = "Continue"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$enc = New-Object System.Text.UTF8Encoding($false)
$Suite = "__tests__/admin/games-prose-terminology.test.ts"

function Read-File([string]$Path) { [IO.File]::ReadAllText($Path, [Text.Encoding]::UTF8) }
function Write-File([string]$Path, [string]$Text) { [IO.File]::WriteAllText($Path, $Text, $enc) }

function Invoke-Probe {
    param(
        [string]$Name,
        [string]$File,
        [string]$Find,
        [string]$Replace,
        [string]$TestName,
        [int]$ExpectedFailures = 1
    )

    $path = Join-Path $root $File
    $original = Read-File $path
    if ($original.Length -eq 0) {
        Write-Host "[$Name] ABORT - read came back empty" -ForegroundColor Red
        return
    }
    # A probe that fails to apply is indistinguishable from a test that does not work, so the
    # change is CONFIRMED before the run rather than assumed from a green result.
    if (-not $original.Contains($Find)) {
        Write-Host "[$Name] DID NOT APPLY - pattern absent, the target has moved" -ForegroundColor Red
        return
    }
    $mutated = $original.Replace($Find, $Replace)
    if ($mutated -eq $original) {
        Write-Host "[$Name] DID NOT APPLY - replacement changed nothing" -ForegroundColor Red
        return
    }
    Write-File $path $mutated

    try {
        # Run the ONE expected test and read the summary counts, never a name match.
        $out = & npx vitest run $Suite -t $TestName --reporter=dot 2>&1 | Out-String
        $out = ($out -replace "\s+", " ")
        if ($out -match "Tests\s+(\d+)\s+failed") {
            $failed = [int]$Matches[1]
            if ($failed -eq $ExpectedFailures) {
                Write-Host "[$Name] RED on exactly $failed test" -ForegroundColor Green
            }
            else {
                Write-Host "[$Name] RED but $failed tests failed, expected $ExpectedFailures" -ForegroundColor Yellow
            }
        }
        elseif ($out -match "No test found") {
            Write-Host "[$Name] NO TEST RAN - the -t pattern matched nothing" -ForegroundColor Red
        }
        else {
            Write-Host "[$Name] GREEN - the guard did not catch it" -ForegroundColor Red
        }
    }
    finally {
        Write-File $path $original
    }
}

Write-Host "`n=== X6.5 A3b prose guard probes ===`n" -ForegroundColor Cyan

# 1. The commonest shape: a sentence that names the noun directly.
Invoke-Probe -Name "1 lowercase noun in a paragraph" `
    -File "apps/admin/components/admin/games/UnscoredPolicyField.tsx" `
    -Find "no {terms.player} recorded a {terms.score} at all" `
    -Replace "no player recorded a score at all" `
    -TestName "has no lowercase noun in running prose"

# 2. A toast, which is prose an operator reads once and cannot scroll back to.
Invoke-Probe -Name "2 lowercase noun in a toast" `
    -File "apps/admin/components/admin/CompetitionsListSection.tsx" `
    -Find 'toast.error(`Failed to load ${terms.contests}`);' `
    -Replace 'toast.error("Failed to load competitions");' `
    -TestName "has no lowercase noun in running prose"

# 3. A synonym rather than a token's default value. Without `SYNONYMS` the guard is blind to
#    exactly the spelling this codebase prefers - "contest" is what every service and docblock
#    says, so it is the word somebody reaches for when writing a new caption.
Invoke-Probe -Name "3 synonym - contest" `
    -File "apps/admin/components/admin/games/ContestPlayModeField.tsx" `
    -Find "once the {terms.contest} exists" `
    -Replace "once the contest exists" `
    -TestName "has no lowercase noun in running prose"

# 4. Prose composed in a service module rather than in JSX, which is where one literal reaches
#    three surfaces - the two panels and the analytics screen all read this module.
Invoke-Probe -Name "4 lowercase noun in composed prose" `
    -File "apps/admin/lib/admin/contest-analytics-presentation.ts" `
    -Find 'return `Every figure below covers all ${contestCount} finished ${terms.contests}.`;' `
    -Replace 'return `Every figure below covers all ${contestCount} finished competitions.`;' `
    -TestName "has no lowercase noun in running prose"

# 5. The Title Case half, over the wider surface. Asserted separately because the two fail for
#    different reasons and the remedy differs.
Invoke-Probe -Name "5 Title Case caption" `
    -File "apps/admin/components/admin/games/RoundInspectorSection.tsx" `
    -Find "{terms.round} Inspector" `
    -Replace "Round Inspector" `
    -TestName "has no Title Case noun as a JSX literal or a quoted caption"

# 6. THE CANARY. Both assertions above are "no match was found", so a reader that returns
#    nothing satisfies both while reporting a column of passes - the fourth cause of a green
#    probe, a mutation with no observable. Pointing the walk at a directory that does not
#    exist is what a rename produces, and it must be caught by the reach test rather than by
#    silence. Two tests go red: the reach test, and `walk` throwing takes the file down.
Invoke-Probe -Name "6 canary - the walk finds nothing" `
    -File "__tests__/admin/games-prose-terminology.test.ts" `
    -Find 'walk(join(ADMIN, "components/admin/games"))' `
    -Replace 'walk(join(ADMIN, "components/admin/games")).slice(0, 0)' `
    -TestName "finds a substantial number of files, each with content"

Write-Host "`n=== done ===`n" -ForegroundColor Cyan
