# Probes for the admin prize basis and the settled snapshot (`12` s2.6).
#
# Each probe reinstates one defect and expects ONE named test to go red. Naming the expected
# test is the point: a probe aimed at the wrong test is indistinguishable from a test that does
# not work.
#
# TWO THINGS ABOUT THIS HARNESS SPECIFICALLY.
#
# `prize-projection.ts` exists twice and a test asserts the two copies are BYTE-IDENTICAL, so
# any probe touching the arithmetic must patch BOTH copies or it turns two tests red - the
# mirror guard plus the behaviour guard - and "2 failed" is indistinguishable from collateral
# damage. The mirror guard gets its own probe, which patches one copy only.
#
# The byte-identical assertion reads the RAW file while every other structural test strips
# comments first, so a comment-only edit is invisible to all of them except that one. That is
# what makes it probe-able at all.

$ErrorActionPreference = "Continue"

$Root = Split-Path -Parent $PSScriptRoot
$Suite = "__tests__/admin/contest-prize-basis.test.ts"

$Projection = Join-Path $Root "lib\utils\prize-projection.ts"
$AdminProjection = Join-Path $Root "apps\admin\lib\utils\prize-projection.ts"
$Presentation = Join-Path $Root "apps\admin\lib\admin\contest-result-presentation.ts"
$Panel = Join-Path $Root "apps\admin\components\admin\competitions\ContestPrizePanel.tsx"
$SettledPanel = Join-Path $Root "apps\admin\components\admin\competitions\SettledResultPanel.tsx"

$Utf8NoBom = New-Object System.Text.UTF8Encoding($false)

function Read-Source([string]$Path) {
    # ReadAllText never globs. A sibling harness once emptied a `[id]` route with Get-Content
    # and "restored" it to nothing, while every probe went red on the expected test for
    # entirely the wrong reason.
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

Write-Host "Probing the admin prize basis" -ForegroundColor White

# --- the shared projection ------------------------------------------------------------------
# Every edit here is applied to BOTH copies, or the byte-identical guard fires as well.

# 1. The redistribution boundary off by one, which silently leaves one claimed rank's share in
#    the unclaimed pile and under-pays the rank that should have absorbed it.
Invoke-Probe -Name "the unclaimed boundary is off by one" `
    -ExpectTest "redistributes an unclaimed rank" `
    -Edits @(
    @{
        Target  = $Projection
        Find    = "if (index >= currentParticipants) unclaimedPercentage += prize.percentage;"
        Replace = "if (index > currentParticipants) unclaimedPercentage += prize.percentage;"
    },
    @{
        Target  = $AdminProjection
        Find    = "if (index >= currentParticipants) unclaimedPercentage += prize.percentage;"
        Replace = "if (index > currentParticipants) unclaimedPercentage += prize.percentage;"
    }
)

# 2. The platform fee stops being deducted, which is the single most expensive line in the file.
Invoke-Probe -Name "the platform fee is no longer deducted" `
    -ExpectTest "redistributes an unclaimed rank" `
    -Edits @(
    @{
        Target  = $Projection
        Find    = "((prizePool * adjustedPercentage) / 100) * (1 - platformFeePercentage);"
        Replace = "((prizePool * adjustedPercentage) / 100) * 1;"
    },
    @{
        Target  = $AdminProjection
        Find    = "((prizePool * adjustedPercentage) / 100) * (1 - platformFeePercentage);"
        Replace = "((prizePool * adjustedPercentage) / 100) * 1;"
    }
)

# 3. The credits fallback dropped. Provider contests carry `prizePoolCredits`, so the whole
#    panel renders zeroes on exactly the game this work is for.
Invoke-Probe -Name "the prizePoolCredits fallback is dropped" `
    -ExpectTest "falls back from prizePool to prizePoolCredits" `
    -Edits @(
    @{
        Target  = $Projection
        Find    = "competition.prizePool || competition.prizePoolCredits || 0;"
        Replace = "competition.prizePool || 0;"
    },
    @{
        Target  = $AdminProjection
        Find    = "competition.prizePool || competition.prizePoolCredits || 0;"
        Replace = "competition.prizePool || 0;"
    }
)

# 4. An unheld rank reported as filled, which is what puts an amount against a rank nobody can
#    claim - the projection's form of R45.
Invoke-Probe -Name "an unheld rank is reported as filled" `
    -ExpectTest "marks an unheld rank rather than reporting an amount for it" `
    -Edits @(
    @{
        Target  = $Projection
        Find    = "const isFilled = index < currentParticipants;"
        Replace = "const isFilled = true;"
    },
    @{
        Target  = $AdminProjection
        Find    = "const isFilled = index < currentParticipants;"
        Replace = "const isFilled = true;"
    }
)

# 5. NOT PROBED, AND THE REASON IS THE FINDING. Removing the `filledPositions > 0` ternary
#    leaves the suite GREEN, and the third of the three explanations applies: the guard is real
#    but changes no answer. `filledPositions` is zero only when nobody has entered or no rank
#    pays, and in both cases every row is unfilled - so `bonusPerWinner` becomes `Infinity` or
#    `NaN` and is read by nothing, because `isFilled && bonusPerWinner > 0` short-circuits
#    first. The ternary stays: it is one of the four expressions pinned character for character,
#    and the accident holds only for `>`, so an "is there a bonus" check written the other way
#    round would propagate the `Infinity`.
#
#    Recorded here rather than shipped as a green probe, on the same reasoning as R42's second
#    game gate: a probe that reports green teaches the next reader the guard is decoration.
#    Same class as X5's `isAtRisk` NaN guard.

# 6. One copy diverges. The edit is a COMMENT, so it is invisible to every structural test that
#    strips comments and visible only to the byte-identical guard - which is the only way to
#    probe that guard without also breaking behaviour.
Invoke-Probe -Name "the two copies of the projection drift apart" `
    -ExpectTest "keeps the two copies of the projection byte-identical" `
    -Edits @(
    @{
        Target  = $AdminProjection
        Find    = "export function projectPrizeDistribution("
        Replace = "// admin-only tweak`nexport function projectPrizeDistribution("
    }
)

# 7. A model import reaches the shared module. It typechecks and it breaks the client bundle -
#    the shape behind R39, where a lucide icon crossing the boundary took the trading lobby
#    down in production.
Invoke-Probe -Name "a Mongoose model is imported into the shared projection" `
    -ExpectTest "takes no Mongoose model into either shared module" `
    -Edits @(
    @{
        Target  = $Projection
        Find    = "/** The shape both callers already hold."
        Replace = "import mongoose from `"mongoose`";`n`n/** The shape both callers already hold."
    },
    @{
        Target  = $AdminProjection
        Find    = "/** The shape both callers already hold."
        Replace = "import mongoose from `"mongoose`";`n`n/** The shape both callers already hold."
    }
)

# --- the settled resolvers ------------------------------------------------------------------

# 8. `0` instead of `null` for a rank nobody placed in. This is the exact read-side defect R45
#    is about, and the one an operator reads as a payout bug.
Invoke-Probe -Name "an unclaimed rank reports a paid amount of zero" `
    -ExpectTest "reports a rank nobody placed in as null, never as zero" `
    -Edits @(
    @{
        Target  = $Presentation
        Find    = "          : null,`n      names: atRank.map("
        Replace = "          : 0,`n      names: atRank.map("
    }
)

# 9. A tied rank reports one winner's amount instead of the rank's total, halving it.
Invoke-Probe -Name "a tied rank reports half of what it paid" `
    -ExpectTest "sums a tied rank rather than reporting one of its winners" `
    -Edits @(
    @{
        Target  = $Presentation
        Find    = "? paidEntries.reduce((sum, entry) => sum + (entry.prizeAmount ?? 0), 0)"
        Replace = "? (paidEntries[0].prizeAmount ?? 0)"
    }
)

# 10. The tie inferred from the flag alone. `isTied` is add-only and was silently discarded
#     before X5, so historical contests hold tied rows with the flag unset.
Invoke-Probe -Name "a tie is only believed when the flag is set" `
    -ExpectTest "infers a tie from two rows sharing a rank even without the flag" `
    -Edits @(
    @{
        Target  = $Presentation
        Find    = "isTied: atRank.length > 1 || atRank.some((entry) => entry.isTied === true),"
        Replace = "isTied: atRank.some((entry) => entry.isTied === true),"
    }
)

# 11. Settled rows returned for an empty leaderboard, which is what captions a column of blanks
#     as the amounts paid.
Invoke-Probe -Name "an absent settled record still claims to be settled" `
    -ExpectTest "falls back to the projection when no settled record exists" `
    -Edits @(
    @{
        Target  = $Presentation
        Find    = "  const settled = input.finalLeaderboard ?? [];`n  if (settled.length === 0) return null;"
        Replace = "  const settled = input.finalLeaderboard ?? [];"
    }
)

# 12. The stale caution restored beside real payments - a warning that has become untrue, and
#     the same class as the play screen's play-window note.
Invoke-Probe -Name "the floor caution is shown beside amounts already paid" `
    -ExpectTest "does not tell an operator a recorded payment might be higher" `
    -Edits @(
    @{
        Target  = $Presentation
        Find    = "return basis === `"settled`" ? PRIZE_SETTLED_NOTE : PRIZE_REDISTRIBUTION_NOTE;"
        Replace = "return PRIZE_REDISTRIBUTION_NOTE;"
    }
)

# 13. The snapshot sorted in place, silently reordering whatever else reads the same array.
Invoke-Probe -Name "the settled snapshot is sorted in place" `
    -ExpectTest "does not reorder the caller's array in place" `
    -Edits @(
    @{
        Target  = $Presentation
        Find    = "return [...settled].sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0));"
        Replace = "return settled.sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0));"
    }
)

# --- the panels ------------------------------------------------------------------------------

# 14. The panel does its own arithmetic beside the shared module, which is the defect this whole
#     slice removes: two screens quoting different amounts for one rank.
Invoke-Probe -Name "the panel recomputes the redistribution itself" `
    -ExpectTest "shares the projection module with the player-facing table" `
    -Edits @(
    @{
        Target  = $Panel
        Find    = "  const projected = projectPrizeDistribution(competition);"
        Replace = "  const projected = projectPrizeDistribution(competition);`n  let unclaimedPercentage = 0;`n  projected.rows.forEach((r) => { unclaimedPercentage += r.configuredPercentage; });"
    }
)

# 15. The redistribution badge dropped, so the operator sees 70% where the player sees 75%.
Invoke-Probe -Name "the redistribution badge is hidden from the operator" `
    -ExpectTest "keeps the redistribution badge the player already sees" `
    -Edits @(
    @{
        Target  = $Panel
        Find    = "{row.bonusPercentage > 0 && ("
        Replace = "{false && ("
    }
)

# 16. The heading fixed at "Prize Distribution", which reads as configuration above real money.
Invoke-Probe -Name "the heading claims configuration above real payments" `
    -ExpectTest "picks its heading from the basis" `
    -Edits @(
    @{
        Target  = $Panel
        Find    = "{basis === `"settled`" ? `"Prizes Paid`" : `"Prize Distribution`"}"
        Replace = "{`"Prize Distribution`"}"
    }
)

# 17. The settled panel reads trading's metric unconditionally, which is R46 reinstated one
#     panel over: 0 trades and +0.00% against a provider contest whose score sits unrendered.
Invoke-Probe -Name "the settled panel hard-codes trading's metric" `
    -ExpectTest "reads the game's own metric rather than hard-coding either one" `
    -Edits @(
    @{
        Target  = $SettledPanel
        Find    = "          const metric = resolveResultMetric(row, isProviderGame);"
        Replace = "          const metric = { value: String(row.pnl ?? 0), label: `"P&L`" };"
    }
)

# 18. The settled panel renders an empty table instead of nothing, which is indistinguishable
#     from data that failed to load.
Invoke-Probe -Name "an empty settled panel renders instead of nothing" `
    -ExpectTest "renders nothing at all when there is no settled record" `
    -Edits @(
    @{
        Target  = $SettledPanel
        Find    = "  if (!rows) return null;"
        Replace = "  const safeRows = rows ?? [];"
    }
)

# 19. The stored disqualification reason dropped - the one thing here that cannot be
#     reconstructed later, and the thing an operator has to tell the player.
Invoke-Probe -Name "the stored disqualification reason is dropped" `
    -ExpectTest "shows the stored qualification verdict and its reason" `
    -Edits @(
    @{
        Target  = $SettledPanel
        Find    = "                  {row.disqualificationReason && ("
        Replace = "                  {false && ("
    }
)

Write-Host ""
Write-Host "Done. Every probe should read RED as expected (1 failed)." -ForegroundColor White
Write-Host "A GREEN probe means the guard is not held - re-aim it or write the test." -ForegroundColor White
