# Probes for `__tests__/admin/trading-wizard-shell.test.ts`.
#
# Same harness as probe-game-contest-wizard.ps1; its lessons are already paid for and not
# re-derived here: -LiteralPath and explicit UTF-8 without a BOM on the read AND the write;
# refuse to write when the read came back empty; confirm the file actually changed; name the
# expected failing test and judge by the summary counts of that single filtered test.
#
# 1 test red is the honest number for a one-line change, and a probe reporting five is
# reporting on the harness rather than on the guard.
#
# WHAT IS BEING PROBED. Two claims. That the trading form's chrome MOVED into the shared shell
# rather than being copied there - so every probe here reinstates a hand-rolled copy, which is
# what a later "tidy-up" would actually look like. And that creating a competition is no longer
# refused because the forex market is shut, which is the owner's 4 September 2026 decision:
# every probe on that half restores the refusal in one of the four places it could hide - the
# handler, the wording, the information, and the submit button's disabled expression.

$ErrorActionPreference = "Continue"
$enc = New-Object System.Text.UTF8Encoding($false)
$suite = "__tests__/admin/trading-wizard-shell.test.ts"
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

$FORM = "apps/admin/components/admin/CompetitionCreatorForm.tsx"
$SHELL = "apps/admin/components/admin/wizard/WizardShell.tsx"

# =======================================================================================
# The chrome moved, it was not copied
# =======================================================================================

# 1. The shell dropped and the old sidebar rebuilt in place. This is the whole point of the
#    negative assertion: the positive one (does it import the shell) is green on a file that
#    imports it and then hand-rolls a panel beside it anyway.
$results += Invoke-Probe `
    -Name "the old hand-rolled sidebar comes back beside the shell" `
    -File $FORM `
    -From "          <WizardStepRail steps={steps} currentIndex={currentStep - 1} />" `
    -To "          <p>Creation Progress</p>" `
    -TestName "has no chrome of its own" `

# 2. A second Quick Preview card, which is how one wizard silently stops showing what the
#    other shows.
$results += Invoke-Probe `
    -Name "a second Quick Preview card is written into the form" `
    -File $FORM `
    -From "          <WizardPreview>" `
    -To "          <p>Quick Preview</p>`r`n          <WizardPreview>" `
    -TestName "has no chrome of its own"

# 3. The shell's own heading deleted, so the negative assertions above would pass on a form
#    with no sidebar at all. This is the "assert the slice found something" rule in probe form.
$results += Invoke-Probe `
    -Name "the shell stops defining the headings it owns" `
    -File $SHELL `
    -From "Creation Progress" `
    -To "Progress" `
    -TestName "has no chrome of its own"

# 4. Two step cards on one index - a copy-paste that renders the same accented heading twice
#    over two different bodies, and reviews as entirely correct.
$results += Invoke-Probe `
    -Name "two step cards read the same step" `
    -File $FORM `
    -From "<WizardStepCard step={steps[3]}>" `
    -To "<WizardStepCard step={steps[2]}>" `
    -TestName "drives the rail and every step header"

# 5. A step header written by hand again rather than read off the list, which is how a
#    reordered wizard puts one step's body under another's heading.
$results += Invoke-Probe `
    -Name "one step header goes back to being hand-written" `
    -File $FORM `
    -From "            <WizardStepCard step={steps[4]}>" `
    -To "            <div><h2>Prize Distribution</h2>" `
    -TestName "drives the rail and every step header"

# 6. The market card pushed down into the shell, which would put a trading-shaped default in
#    front of every game wizard that ever adopts it.
$results += Invoke-Probe `
    -Name "the market card is moved into the shared shell" `
    -File $SHELL `
    -From "export function WizardShell(" `
    -To "const unused = { marketStatus: true };`r`nexport function WizardShell(" `
    -TestName "keeps the market card out of the shell"

# =======================================================================================
# The 4 September decision
# =======================================================================================

# 7. THE ORIGINAL DEFECT, restored verbatim: an operator scheduling Monday's competition on a
#    Saturday is refused outright.
$results += Invoke-Probe `
    -Name "the market refusal comes back into the submit handler" `
    -File $FORM `
    -From "    setSubmitted(true);`r`n    setLoading(true);" `
    -To "    if (!marketStatus.isOpen) {`r`n      return;`r`n    }`r`n`r`n    setSubmitted(true);`r`n    setLoading(true);" `
    -TestName "has no market gate in the submit handler"

# 8. The wording alone, which outlives the code and is worse than the refusal was: an operator
#    reads it, believes it, and waits until Sunday on a form that would have submitted.
$results += Invoke-Probe `
    -Name "the card claims creation is blocked again" `
    -File $FORM `
    -From "                  You can still schedule a competition" `
    -To "                  Competition creation is BLOCKED" `
    -TestName "does not tell the operator that creation is blocked"

# 9. The information removed along with the refusal - the change that trades one wrong screen
#    for a blind one. A window straddling the weekend close is a real problem.
$results += Invoke-Probe `
    -Name "the market warnings are dropped with the refusal" `
    -File $FORM `
    -From "marketStatus.warnings.length > 0" `
    -To "false" `
    -TestName "still reports the market state and still warns"

# 10. The other half of the same claim: the gate survives and the RENDER goes. Two probes
#     because one assertion covering both was green on probe 9 - the field is mentioned twice,
#     so killing either mention alone leaves the other satisfying a bare field match.
$results += Invoke-Probe `
    -Name "the warnings are gated but never rendered" `
    -File $FORM `
    -From "{marketStatus.warnings.slice(0, 3).map((warning, idx) => (" `
    -To "{[].map((warning, idx) => (" `
    -TestName "still reports the market state and still warns"

# 11. The refusal moved onto the button, which is the same defect wearing a disabled attribute
#     and names no reason at all.
$results += Invoke-Probe `
    -Name "the refusal reappears as a disabled submit button" `
    -File $FORM `
    -From "                  loading || submitted || getTotalPrizePercentage() !== 100" `
    -To "                  loading || submitted || !marketStatus.isOpen" `
    -TestName "leaves the submit button gated on the form"

Write-Host ""
Write-Host "=======================================================" -ForegroundColor Cyan
Write-Host "SUMMARY" -ForegroundColor Cyan
Write-Host "=======================================================" -ForegroundColor Cyan
$results | ForEach-Object {
    $colour = if ($_.Outcome -like "RED*") { "Green" } else { "Red" }
    Write-Host ("  {0,-58} {1}" -f $_.Name, $_.Outcome) -ForegroundColor $colour
}
$red = ($results | Where-Object { $_.Outcome -like "RED*" }).Count
Write-Host ""
Write-Host "  $red of $($results.Count) probes red" -ForegroundColor Cyan
