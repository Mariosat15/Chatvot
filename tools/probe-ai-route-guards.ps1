# Probes for the AI route guards - `__tests__/admin/ai-route-guards.test.ts`.
#
# Same harness as probe-phantom-score.ps1; its lessons are already paid for and not re-derived
# here: -LiteralPath and explicit UTF-8 without a BOM on the read AND the write; refuse to
# write when the read came back empty; confirm the file actually changed; name the expected
# failing test and judge by the summary counts of that single filtered test.
#
# 1-2 tests red is the honest number for a one-line change.
#
# THE DEFECT BEING PROBED. Until 8 September 2026 all five routes under `apps/admin/app/api/ai/`
# had no authorization of any kind, and the admin app has no middleware - so an arbitrary
# prompt could be answered with the platform's OpenAI key, and two of the five WRITE badge and
# milestone configuration. The guard is one line per handler, which makes it exactly the kind of
# thing a later edit removes without noticing.
#
# The sixth probe is the point of the whole test: it CREATES a new unguarded route, because the
# test reads the directory rather than naming the five files, and a hard-coded list would be
# green on the day a sixth route appears.

$ErrorActionPreference = "Continue"
$enc = New-Object System.Text.UTF8Encoding($false)
$suite = "__tests__/admin/ai-route-guards.test.ts"
$results = @()

function Invoke-Probe {
    param(
        [string]$Name,
        [string]$File,
        [string]$From,
        [string]$To,
        [string]$TestName
    )

    Write-Host ""
    Write-Host "PROBE: $Name" -ForegroundColor Cyan

    $path = (Resolve-Path -LiteralPath $File).Path
    $original = [System.IO.File]::ReadAllText($path, $enc)

    if ([string]::IsNullOrEmpty($original)) {
        Write-Host "  HARNESS BROKEN: read $File as empty - refusing to write" -ForegroundColor Magenta
        return [pscustomobject]@{ Name = $Name; Outcome = "HARNESS BROKEN" }
    }
    # Line endings are MIXED across this repository - `generate-competition/route.ts` is CRLF
    # and `evaluate-balance/route.ts` is LF - so a literal multi-line pattern matches one and
    # silently misses the other, which is indistinguishable from a test that does not work.
    # Escape the literal, then relax every newline.
    $pattern = [regex]::Escape($From) -replace '\\r\\n|\\n', '\r?\n'
    if (-not [regex]::IsMatch($original, $pattern)) {
        Write-Host "  DID NOT APPLY: pattern absent from $File" -ForegroundColor Yellow
        return [pscustomobject]@{ Name = $Name; Outcome = "DID NOT APPLY" }
    }

    $mutated = [regex]::Replace($original, $pattern, { param($m) $To })
    [System.IO.File]::WriteAllText($path, $mutated, $enc)

    $onDisk = [System.IO.File]::ReadAllText($path, $enc)
    if ($onDisk -eq $original) {
        Write-Host "  HARNESS BROKEN: file unchanged after write" -ForegroundColor Magenta
        return [pscustomobject]@{ Name = $Name; Outcome = "HARNESS BROKEN" }
    }

    try {
        $raw = & npx vitest run $suite -t $TestName 2>&1 | Out-String
        $out = $raw -replace '\s+', ' '
    }
    finally {
        [System.IO.File]::WriteAllText($path, $original, $enc)
    }

    return Read-Outcome -Name $Name -Out $out
}

function Read-Outcome {
    param([string]$Name, [string]$Out)

    if ($Out -match 'No test files found' -or $Out -match 'Tests\s+no tests') {
        $outcome = "PROBE BROKEN (no test ran)"
        Write-Host "  $outcome" -ForegroundColor Magenta
    }
    elseif ($Out -match 'Tests\s+(\d+)\s+failed') {
        $outcome = "RED ($($Matches[1]) failed)"
        Write-Host "  $outcome" -ForegroundColor Green
    }
    elseif ($Out -match 'Tests\s+\d+\s+passed') {
        $outcome = "GREEN - guard useless"
        Write-Host "  $outcome" -ForegroundColor Red
    }
    else {
        $outcome = "PROBE BROKEN (unreadable summary)"
        Write-Host "  $outcome" -ForegroundColor Magenta
    }

    return [pscustomobject]@{ Name = $Name; Outcome = $outcome }
}

$COMP = "apps/admin/app/api/ai/generate-competition/route.ts"
$BAL = "apps/admin/app/api/ai/evaluate-balance/route.ts"
$WIZ = "apps/admin/app/api/ai/gamification-wizard/route.ts"

# ---------------------------------------------------------------------------------------
# 1. The guard is deleted outright - the original defect.
# ---------------------------------------------------------------------------------------
$results += Invoke-Probe `
    -Name "generate-competition loses its guard entirely" `
    -File $COMP `
    -From "  const guard = await guardSection(`"competitions`");`r`n  if (!guard.ok) return guard.response;`r`n" `
    -To "" `
    -TestName "generate-competition/route.ts: guards every exported handler"

# ---------------------------------------------------------------------------------------
# 2. The guard survives only in prose. This is what the comment-stripping is for: these files
#    discuss `guardSection` at length, so a bare toContain would stay green here.
# ---------------------------------------------------------------------------------------
$results += Invoke-Probe `
    -Name "guard becomes a comment, so the file still MENTIONS it" `
    -File $BAL `
    -From "  const guard = await guardSection(`"badges`");`r`n  if (!guard.ok) return guard.response;" `
    -To "  // const guard = await guardSection(`"badges`"); if (!guard.ok) return guard.response;" `
    -TestName "evaluate-balance/route.ts: guards every exported handler"

# ---------------------------------------------------------------------------------------
# 3. Guard present but AFTER the body is read - refuses, having already worked for a stranger.
# ---------------------------------------------------------------------------------------
$results += Invoke-Probe `
    -Name "guard moves below await request.json()" `
    -File $WIZ `
    -From "  const guard = await guardSection(`"gamification-wizard`");`r`n  if (!guard.ok) return guard.response;`r`n`r`n  try {`r`n    await connectToDatabase();`r`n    const body = await request.json();" `
    -To "  try {`r`n    await connectToDatabase();`r`n    const body = await request.json();`r`n    const guard = await guardSection(`"gamification-wizard`");`r`n    if (!guard.ok) return guard.response;" `
    -TestName "gamification-wizard/route.ts: refuses before reading the request body"

# ---------------------------------------------------------------------------------------
# 4. The guard names an id that is not a section.
#
#    First written as `guardSection("ai-generation" as never)`, which reported GREEN - and the
#    cause was the probe, not the guard. The test's regex requires the closing paren straight
#    after the string, so `as never` meant zero matches and the assertion loop never ran: a
#    vacuous pass. Fixed on both sides - a bare wrong literal here, and a "found at least one"
#    assertion in the test, because an assertion inside a loop over an empty list is green.
# ---------------------------------------------------------------------------------------
$results += Invoke-Probe `
    -Name "guard names a section that does not exist" `
    -File $COMP `
    -From "await guardSection(`"competitions`")" `
    -To "await guardSection(`"ai-generation`")" `
    -TestName "generate-competition/route.ts: names a real section"

# ---------------------------------------------------------------------------------------
# 5. The route invents its own refusal instead of returning the guard's, which collapses 401
#    and 403 into one answer - a missing session then reads as a permissions problem.
# ---------------------------------------------------------------------------------------
$results += Invoke-Probe `
    -Name "route returns its own 403 rather than the guard's response" `
    -File $COMP `
    -From "  if (!guard.ok) return guard.response;" `
    -To "  if (!guard.ok) return NextResponse.json({ error: `"Forbidden`" }, { status: 403 });" `
    -TestName "returns the guard's own refusal rather than inventing a status"

# ---------------------------------------------------------------------------------------
# 6. THE POINT OF THE TEST: a sixth route appears, unguarded. A hard-coded list of five files
#    is green here, which is the whole reason the test walks the directory.
# ---------------------------------------------------------------------------------------
Write-Host ""
Write-Host "PROBE: a SIXTH unguarded AI route is added" -ForegroundColor Cyan

$sixthDir = (Resolve-Path -LiteralPath "apps/admin/app/api/ai").Path + "\probe-sixth-route"
$sixth = "$sixthDir\route.ts"
$body = @"
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const body = await request.json();
  return NextResponse.json({ ok: true, echo: body });
}
"@

try {
    New-Item -ItemType Directory -Path $sixthDir -Force | Out-Null
    [System.IO.File]::WriteAllText($sixth, $body, $enc)

    if (-not (Test-Path -LiteralPath $sixth)) {
        Write-Host "  HARNESS BROKEN: sixth route was not written" -ForegroundColor Magenta
        $results += [pscustomobject]@{ Name = "a SIXTH unguarded AI route is added"; Outcome = "HARNESS BROKEN" }
    }
    else {
        $raw = & npx vitest run $suite -t "probe-sixth-route" 2>&1 | Out-String
        $results += Read-Outcome -Name "a SIXTH unguarded AI route is added" -Out ($raw -replace '\s+', ' ')
    }
}
finally {
    Remove-Item -LiteralPath $sixthDir -Recurse -Force -ErrorAction SilentlyContinue
}

if (Test-Path -LiteralPath $sixthDir) {
    Write-Host "  WARNING: the probe route was NOT cleaned up - delete $sixthDir" -ForegroundColor Magenta
}

Write-Host ""
Write-Host "================ SUMMARY ================" -ForegroundColor Cyan
$results | ForEach-Object { Write-Host ("  {0,-24} {1}" -f $_.Outcome, $_.Name) }
Write-Host ""
$bad = @($results | Where-Object { $_.Outcome -notlike "RED*" })
if ($bad.Count -eq 0) {
    Write-Host "All $($results.Count) probes red on the expected test." -ForegroundColor Green
}
else {
    Write-Host "$($bad.Count) probe(s) did not go red - investigate before believing any guard." -ForegroundColor Red
}
