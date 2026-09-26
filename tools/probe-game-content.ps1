# Probes for the game content editor - `__tests__/admin/game-content-editor.test.ts`.
#
# Same harness as probe-ai-route-guards.ps1; its lessons are already paid for and not
# re-derived here: -LiteralPath and explicit UTF-8 without a BOM on the read AND the write;
# refuse to write when the read came back empty; confirm the file actually changed; name the
# expected failing test and judge by the summary counts of that single filtered test.
#
# 1-2 tests red is the honest number for a one-line change. More than that is usually the
# harness having damaged the file rather than the guard doing its job.
#
# WHAT IS BEING DEFENDED. An operator now writes the words and pictures players read on a
# catalogue title. Three things fail silently if a guard here is removed: a provider-owned
# capability flag becomes editable from a screen labelled "title and description", an unknown
# field is dropped so the edit appears to save and does nothing, and the arena starts
# branching on a game code - which makes the no-developer-needed claim quietly false while
# every other test still passes.
#
# The last probe is the point of the suite: it CREATES a new unguarded route, because the test
# walks the directory rather than naming the files, and a hard-coded list would be green on
# the day the next route appears.

$ErrorActionPreference = "Continue"
$enc = New-Object System.Text.UTF8Encoding($false)
$suite = "__tests__/admin/game-content-editor.test.ts"
$results = @()

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
    # Escape the literal, then relax every newline: line endings are mixed across this
    # repository, so a literal multi-line pattern matches one file and silently misses the
    # next - which is indistinguishable from a test that does not work.
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

$FIELDS = "apps/admin/lib/admin/game-content-fields.ts"
$CONTENT_ROUTE = "apps/admin/app/api/games/providers/[providerKey]/games/content/route.ts"
$ARTWORK_ROUTE = "apps/admin/app/api/games/providers/[providerKey]/games/artwork/route.ts"
$FACTS = "components/games/arena/arena-facts.ts"

# ---------------------------------------------------------------------------------------
# 1. An unknown field is DROPPED rather than refused - the edit appears to save and does
#    nothing, which is this codebase's recurring failure mode.
# ---------------------------------------------------------------------------------------
$results += Invoke-Probe `
    -Name "an unknown field is silently ignored instead of refused" `
    -File $FIELDS `
    -From "    if (!EDITABLE_CONTENT_FIELDS.has(key)) {`r`n      return { ok: false, error: ``""`${key}`" is not an editable field of a game title.`` };`r`n    }" `
    -To "    if (!EDITABLE_CONTENT_FIELDS.has(key)) continue;" `
    -TestName "refuses an unknown field BY NAME instead of dropping it"

# ---------------------------------------------------------------------------------------
# 2. THE ONE THAT MATTERS. `gameKey` drops off the never-editable list. It is absent from the
#    allow-list too, so it is STILL refused - by the unknown-field branch, whose message also
#    contains the word "gameKey". A test asserting only "it was refused" is green here, and
#    the field stops being immutable the day somebody adds it to the allow-list.
# ---------------------------------------------------------------------------------------
$results += Invoke-Probe `
    -Name "gameKey loses its immutability message (still refused, for the wrong reason)" `
    -File $FIELDS `
    -From "  [`"gameKey`", `"the join key for every historical stat, and immutable`"]," `
    -To "" `
    -TestName "refuses a provider-owned field with ITS OWN message"

# ---------------------------------------------------------------------------------------
# 3. A provider capability flag becomes operator-editable. `supportsContentSeed` is the
#    fairness gate behind R53, so this is a refusal being switched off from a content form.
# ---------------------------------------------------------------------------------------
$results += Invoke-Probe `
    -Name "supportsContentSeed becomes editable content" `
    -File $FIELDS `
    -From "  `"highlights`",`r`n]);" `
    -To "  `"highlights`",`r`n  `"supportsContentSeed`",`r`n]);" `
    -TestName "never lets a capability flag be edited as though it were content"

# ---------------------------------------------------------------------------------------
# 4. The allow-list becomes a plain object, so a request-supplied key walks the prototype
#    chain. `"constructor"` returns something truthy and survives the check.
# ---------------------------------------------------------------------------------------
$results += Invoke-Probe `
    -Name "the allow-list is looked up as an object, admitting __proto__" `
    -File $FIELDS `
    -From "    if (!EDITABLE_CONTENT_FIELDS.has(key)) {" `
    -To "    const asObject = Object.fromEntries([...EDITABLE_CONTENT_FIELDS].map((f) => [f, true])) as Record<string, boolean>;`r`n    if (!asObject[key]) {" `
    -TestName "so a request-supplied key cannot walk the prototype chain"

# ---------------------------------------------------------------------------------------
# 5. An empty string stops meaning "clear". Every consumer treats an ABSENT value as "say
#    less" and falls back, so a stored "" renders an empty slot where nothing should appear.
# ---------------------------------------------------------------------------------------
$results += Invoke-Probe `
    -Name "an empty tagline is refused rather than clearing the field" `
    -File $FIELDS `
    -From "    if (value === null) return { ok: false, error: ``""`${field}`" must be text.`` };`r`n    if (value.length > CONTENT_LIMITS[field]) {" `
    -To "    if (!value) return { ok: false, error: ``""`${field}`" must be text.`` };`r`n    if (value.length > CONTENT_LIMITS[field]) {" `
    -TestName "treats an empty string as a decision to clear"

# ---------------------------------------------------------------------------------------
# 6. A plain http image is accepted. The browser refuses it as mixed content and draws
#    nothing, so the operator sees a missing logo with no error raised anywhere.
# ---------------------------------------------------------------------------------------
$results += Invoke-Probe `
    -Name "a plain http image address is accepted" `
    -File $FIELDS `
    -From "    return new URL(value).protocol === `"https:`";" `
    -To "    return [`"https:`", `"http:`"].includes(new URL(value).protocol);" `
    -TestName "refuses a plain http image"

# ---------------------------------------------------------------------------------------
# 7. The content route loses its section grant. Eight admin routes in this codebase have been
#    found authorising on admin-at-all or on nothing.
# ---------------------------------------------------------------------------------------
$results += Invoke-Probe `
    -Name "the content route loses its section guard" `
    -File $CONTENT_ROUTE `
    -From "  const guard = await guardSection(`"game-providers`");" `
    -To "" `
    -TestName "content/route.ts: guards every exported handler"

# ---------------------------------------------------------------------------------------
# 8. The guard survives only in prose. This is what the comment-stripping is for: these files
#    discuss `guardSection` at length, so a bare toContain stays green here.
# ---------------------------------------------------------------------------------------
$results += Invoke-Probe `
    -Name "the artwork route's guard becomes a comment, so the file still MENTIONS it" `
    -File $ARTWORK_ROUTE `
    -From "  const guard = await guardSection(`"game-providers`");" `
    -To "  // const guard = await guardSection(`"game-providers`");" `
    -TestName "artwork/route.ts: guards every exported handler"

# ---------------------------------------------------------------------------------------
# 9. The arena starts branching on a game code. This is the single failure mode of the
#    no-developer-needed claim, and nothing else in the suite can see it.
# ---------------------------------------------------------------------------------------
$results += Invoke-Probe `
    -Name "the arena special-cases one title by its game code" `
    -File $FACTS `
    -From "export function interactionChip(family: string | undefined): ArenaChip | null {" `
    -To "export function interactionChip(family: string | undefined, gameCode?: string): ArenaChip | null {`r`n  if (gameCode === `"circuit-sprint`") return { label: `"Sprint`", detail: `"Race the clock`" };" `
    -TestName "arena-facts.ts: branches on no game identifier"

# ---------------------------------------------------------------------------------------
# 10. THE POINT OF THE ROUTE HALF: another route appears, unguarded. A hard-coded list of
#     files is green here, which is the whole reason the test walks the directory.
# ---------------------------------------------------------------------------------------
Write-Host ""
Write-Host "PROBE: a NEW unguarded provider-game route is added" -ForegroundColor Cyan

$newDir = (Resolve-Path -LiteralPath "apps/admin/app/api/games/providers").Path + "\probe-new-route"
$newRoute = "$newDir\route.ts"
$body = @"
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const body = await request.json();
  return NextResponse.json({ ok: true, echo: body });
}
"@

try {
    New-Item -ItemType Directory -Path $newDir -Force | Out-Null
    [System.IO.File]::WriteAllText($newRoute, $body, $enc)

    if (-not (Test-Path -LiteralPath $newRoute)) {
        Write-Host "  HARNESS BROKEN: the new route was not written" -ForegroundColor Magenta
        $results += [pscustomobject]@{ Name = "a NEW unguarded provider-game route is added"; Outcome = "HARNESS BROKEN" }
    }
    else {
        $raw = & npx vitest run $suite -t "probe-new-route" 2>&1 | Out-String
        $results += Read-Outcome -Name "a NEW unguarded provider-game route is added" -Out ($raw -replace '\s+', ' ')
    }
}
finally {
    Remove-Item -LiteralPath $newDir -Recurse -Force -ErrorAction SilentlyContinue
}

if (Test-Path -LiteralPath $newDir) {
    Write-Host "  WARNING: the probe route was NOT cleaned up - delete $newDir" -ForegroundColor Magenta
}

Write-Host ""
Write-Host "================ SUMMARY ================" -ForegroundColor Cyan
$results | ForEach-Object { Write-Host ("  {0,-28} {1}" -f $_.Outcome, $_.Name) }
Write-Host ""
$bad = @($results | Where-Object { $_.Outcome -notlike "RED*" })
if ($bad.Count -eq 0) {
    Write-Host "All $($results.Count) probes red on the expected test." -ForegroundColor Green
}
else {
    Write-Host "$($bad.Count) probe(s) did not go red - investigate before believing any guard." -ForegroundColor Red
}
