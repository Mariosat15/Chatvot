# Probes for __tests__/admin/provider-contest-edit.test.ts
#
# Each probe injects ONE defect, runs the ONE test that should notice, and restores the file.
# The harness is the one from probe-e2e-round.ps1, with its lessons already paid for:
# -LiteralPath and explicit UTF-8 without a BOM on read AND write (PowerShell 5.1 otherwise
# mangles non-ASCII through the ANSI codepage and the "restore" writes the mangled text back);
# refuse to write if the read came back empty; confirm the file actually changed; and judge by
# the summary counts of a single filtered test rather than by searching whole-suite output for
# a test's name, which vitest prints for a passing test as readily as a failing one.
#
# 1-2 tests red is the honest number for a one-line change. Five or more means the probe
# damaged the file rather than the behaviour.

$ErrorActionPreference = "Continue"
$enc = New-Object System.Text.UTF8Encoding($false)
$suite = "__tests__/admin/provider-contest-edit.test.ts"
$results = @()

function Invoke-Probe {
    param(
        [string]$Name,
        [string]$File,
        [string]$From,
        [string]$To,
        [string]$TestName,
        # Defaults to the edit suite. Overridden for the one probe that must prove a guard
        # living in a DIFFERENT file's test - the flipped withholding test in the publish-UI
        # suite. Without this the probe runs a suite that does not contain the assertion and
        # reports "no test ran", which reads exactly like a broken harness.
        [string]$Suite = $suite
    )

    Write-Host ""
    Write-Host "PROBE: $Name" -ForegroundColor Cyan

    $path = (Resolve-Path -LiteralPath $File).Path
    $original = [System.IO.File]::ReadAllText($path, $enc)

    if ([string]::IsNullOrEmpty($original)) {
        Write-Host "  HARNESS BROKEN: read $File as empty - refusing to write" -ForegroundColor Magenta
        return [pscustomobject]@{ Name = $Name; Outcome = "HARNESS BROKEN" }
    }
    if (-not $original.Contains($From)) {
        Write-Host "  DID NOT APPLY: pattern absent from $File" -ForegroundColor Yellow
        return [pscustomobject]@{ Name = $Name; Outcome = "DID NOT APPLY" }
    }

    $mutated = $original.Replace($From, $To)
    [System.IO.File]::WriteAllText($path, $mutated, $enc)

    $onDisk = [System.IO.File]::ReadAllText($path, $enc)
    if ($onDisk -eq $original) {
        Write-Host "  HARNESS BROKEN: file unchanged after write" -ForegroundColor Magenta
        return [pscustomobject]@{ Name = $Name; Outcome = "HARNESS BROKEN" }
    }

    try {
        $raw = & npx vitest run $Suite -t $TestName 2>&1 | Out-String
        $out = $raw -replace '\s+', ' '
    }
    finally {
        [System.IO.File]::WriteAllText($path, $original, $enc)
    }

    if ($out -match 'No test files found' -or $out -match 'Tests\s+no tests') {
        $outcome = "PROBE BROKEN (no test ran)"
        Write-Host "  $outcome" -ForegroundColor Magenta
    }
    elseif ($out -match 'Tests\s+(\d+)\s+failed') {
        $outcome = "RED ($($Matches[1]) failed)"
        Write-Host "  $outcome" -ForegroundColor Green
    }
    elseif ($out -match 'Tests\s+\d+\s+passed') {
        $outcome = "GREEN - guard useless"
        Write-Host "  $outcome" -ForegroundColor Red
    }
    else {
        $outcome = "PROBE BROKEN (unreadable summary)"
        Write-Host "  $outcome" -ForegroundColor Magenta
    }

    return [pscustomobject]@{ Name = $Name; Outcome = $outcome }
}

$FIELDS = "apps/admin/lib/admin/competition-update-fields.ts"
$SERVICE = "apps/admin/lib/services/game-providers/provider-contest-edit.service.ts"
$ROUTE = "apps/admin/app/api/competitions/[id]/route.ts"
$LIST = "apps/admin/components/admin/CompetitionsListSection.tsx"
$POLICY = "apps/admin/lib/admin/provider-contest-edit-policy.ts"

# --- the allow-list ------------------------------------------------------------------------

# 1. The original defect: a blind assign. Restoring it is a one-line change to the route.
$results += Invoke-Probe `
    -Name "route blind-assigns the raw body again (the original defect)" `
    -File $ROUTE `
    -From "Object.assign(competition, filtered.update);" `
    -To "Object.assign(competition, body);" `
    -TestName "assigns the FILTERED update, never the raw request body"

# 2. gameKey drops off the never-editable list. NOTE the assertion this is aimed at is about
#    the MESSAGE, not the refusal: `gameKey` is absent from the allow-list too, so it stays
#    refused either way - as an unknown field. The first version of this probe stayed green
#    for that reason, and the test was strengthened rather than the probe re-aimed.
$results += Invoke-Probe `
    -Name "gameKey drops off the never-editable list" `
    -File $FIELDS `
    -From '  "gameKey",' `
    -To '' `
    -TestName "REFUSES gameKey with the IMMUTABILITY message"

# 3. Unknown keys are dropped instead of refused - the silent version, which is the one that
#    loses an operator's work with a success toast on top.
$results += Invoke-Probe `
    -Name "unknown fields are silently dropped rather than refused" `
    -File $FIELDS `
    -From @'
    if (!allowed.has(key)) {
      return {
        ok: false,
        error: `"${key}" is not an editable field on a trading contest.`,
        update: {},
      };
    }
'@ `
    -To @'
    if (!allowed.has(key)) {
      continue;
    }
'@ `
    -TestName "REFUSES an unknown field rather than silently dropping it"

# 4. The Set becomes an object used as a lookup table - the real prototype trap, and the same
#    one as the round-resolution action list. `({name:1})["constructor"]` is truthy, so
#    `constructor` is admitted and handed to Object.assign.
#
#    An earlier version of this probe swapped Object.keys for for...in and stayed GREEN,
#    correctly: measured, the two return identical keys for a JSON body because prototype
#    properties are not enumerable. That was a wrong CLAIM in the test, not a weak test.
$results += Invoke-Probe `
    -Name "allow-list checked by object lookup rather than a Set" `
    -File $FIELDS `
    -From @'
  const allowed = new Set<string>(TRADING_EDITABLE_FIELDS);
  const forbidden = new Set<string>(NEVER_EDITABLE_FIELDS);
'@ `
    -To @'
  const allowedTable: Record<string, boolean> = {};
  for (const f of TRADING_EDITABLE_FIELDS) allowedTable[f] = true;
  const allowed = { has: (k: string) => Boolean(allowedTable[k]) };
  const forbidden = new Set<string>(NEVER_EDITABLE_FIELDS);
'@ `
    -TestName "refuses prototype-shaped keys"

# --- the route -----------------------------------------------------------------------------

# 5. The provider refusal moves AFTER the assign. Presence unchanged; only position wrong -
#    which is exactly what a `toContain` guard cannot see.
$results += Invoke-Probe `
    -Name "provider refusal moved after the body is applied" `
    -File $ROUTE `
    -From @'
    if (hasProviderGameLabel(competition)) {
      return NextResponse.json(
        {
          error:
            "This is a provider-game contest. Edit it from the game contest editor, not the trading form.",
        },
        { status: 400 },
      );
    }

'@ `
    -To '' `
    -TestName "refuses a provider contest BEFORE it reads or applies a body"

# 6. One handler loses its section guard. Counting handlers against guards is what catches it;
#    a `toContain("guardSection")` check stays green because two others still have it.
$results += Invoke-Probe `
    -Name "the PUT handler loses its section guard" `
    -File $ROUTE `
    -From @'
    const guard = await guardSection("competitions");
    if (!guard.ok) return guard.response;
    const admin = guard.admin;

    const { id } = await params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { error: "Invalid competition ID" },
        { status: 400 },
      );
    }

    await connectToDatabase();

    const competition = await Competition.findById(id);
    if (!competition) {
      return NextResponse.json(
        { error: "Competition not found" },
        { status: 404 },
      );
    }

    if (hasProviderGameLabel(competition)) {
'@ `
    -To @'
    const admin = { id: "admin", email: "a@b.c", name: "a", role: "admin" };

    const { id } = await params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { error: "Invalid competition ID" },
        { status: 400 },
      );
    }

    await connectToDatabase();

    const competition = await Competition.findById(id);
    if (!competition) {
      return NextResponse.json(
        { error: "Competition not found" },
        { status: 404 },
      );
    }

    if (hasProviderGameLabel(competition)) {
'@ `
    -TestName "guards every exported handler on the competitions section"

# --- the freeze ----------------------------------------------------------------------------

# 7. The freeze gate turns on STATUS instead of participants - the tempting version, and the
#    one that leaves an upcoming contest with paid entrants fully rewritable.
$results += Invoke-Probe `
    -Name "freeze keyed on status instead of participants" `
    -File $SERVICE `
    -From "const entered = (competition.currentParticipants ?? 0) > 0;" `
    -To 'const entered = competition.status === "active";' `
    -TestName "REFUSES a frozen field once a player has entered, naming it"

# 8. The cap may be lowered below the players already seated.
$results += Invoke-Probe `
    -Name "the participant cap may drop below those already entered" `
    -File $SERVICE `
    -From "      input.maxParticipants < competition.currentParticipants" `
    -To "      false" `
    -TestName "refuses a cap below the players already entered"

# 9. entryFee joins the survives-entry list. A one-word change, and the money defect.
$results += Invoke-Probe `
    -Name "entryFee added to the survives-entry list" `
    -File $POLICY `
    -From '  "maxParticipants",' `
    -To '  "maxParticipants",
  "entryFee",' `
    -TestName "freezes every money and fairness field once a player has entered"

# 10. Settings are stored as submitted rather than coerced, so "7" reaches the provider as a
#     string and is refused at play time.
$results += Invoke-Probe `
    -Name "settings stored as submitted rather than coerced" `
    -File $SERVICE `
    -From "    coercedSettings = validated.values;" `
    -To "    coercedSettings = input.settings;" `
    -TestName "edits a draft freely and stores the COERCED setting"

# 11. The pre-flight is skipped, so a title disabled since creation still saves.
$results += Invoke-Probe `
    -Name "pre-flight not re-run on edit" `
    -File $SERVICE `
    -From "    if (!preflight.ok) {" `
    -To "    if (false) {" `
    -TestName "re-runs the pre-flight, so a title disabled since creation blocks the save"

# 12. Validation reads the submitted subset rather than the merged contest, so an endTime
#     before the stored startTime saves happily.
$results += Invoke-Probe `
    -Name "timing validated against the submitted subset, not the merged contest" `
    -File $SERVICE `
    -From "  const startTime = input.startTime ?? stored.startTime;" `
    -To "  const startTime = input.startTime ?? new Date(0);" `
    -TestName "validates the MERGED contest, not the submitted subset"

# 13. The registration deadline is left behind when the start time moves.
$results += Invoke-Probe `
    -Name "registration deadline left behind when the start time moves" `
    -File $SERVICE `
    -From "    competition.registrationDeadline = new Date(input.startTime);" `
    -To "" `
    -TestName "moves the registration deadline with the start time"

# 14. `finalizing` drops out of the closed set - the subtle one, because a change landing then
#     may or may not be counted depending purely on timing.
$results += Invoke-Probe `
    -Name "finalizing no longer counts as closed to edits" `
    -File $POLICY `
    -From '  "finalizing",' `
    -To '' `
    -TestName "treats finalizing as closed, not merely completed"

# --- the list screen -----------------------------------------------------------------------

# 15. The Edit link stops routing by game, so a provider contest goes to the trading editor.
$results += Invoke-Probe `
    -Name "Edit link sends every contest to the trading editor" `
    -File $LIST `
    -From @'
                    hasProviderGameLabel(competition)
                      ? `/competitions/edit-game/${competition._id}`
                      : `/competitions/edit/${competition._id}`
'@ `
    -To '                    `/competitions/edit/${competition._id}`' `
    -TestName "routes a provider contest to the game editor and trading to the trading editor"

# 16. The two destinations are SWAPPED, so a provider contest reaches the trading form after
#     all. Both links are still present and both routes still exist, so a test asserting only
#     that the game editor is linked stays green - which is why the flipped withholding test
#     asserts the ORDER of the two branches. This probe lives in the publish-UI suite because
#     that is where the flipped test is, and pointing it at the edit suite would report
#     "no test ran" and read as a broken harness rather than a missing guard.
$results += Invoke-Probe `
    -Name "Edit destinations swapped - provider contest reaches the trading form" `
    -File $LIST `
    -Suite "__tests__/admin/provider-contest-publish-ui.test.ts" `
    -From @'
                      ? `/competitions/edit-game/${competition._id}`
                      : `/competitions/edit/${competition._id}`
'@ `
    -To @'
                      ? `/competitions/edit/${competition._id}`
                      : `/competitions/edit-game/${competition._id}`
'@ `
    -TestName "keeps the trading editor away from provider contests"

Write-Host ""
Write-Host "==================== SUMMARY ====================" -ForegroundColor Cyan
foreach ($r in $results) { Write-Host ("  {0,-28} {1}" -f $r.Outcome, $r.Name) }
$bad = @($results | Where-Object { $_.Outcome -notlike "RED*" })
if ($bad.Count -gt 0) {
    Write-Host ""
    Write-Host "$($bad.Count) probe(s) did not go red as expected." -ForegroundColor Red
    exit 1
}
Write-Host ""
Write-Host "All probes red on the expected test." -ForegroundColor Green
