# Probes for `__tests__/admin/game-contest-wizard.test.ts`.
#
# Same harness as probe-ai-route-guards.ps1; its lessons are already paid for and not
# re-derived here: -LiteralPath and explicit UTF-8 without a BOM on the read AND the write;
# refuse to write when the read came back empty; confirm the file actually changed; name the
# expected failing test and judge by the summary counts of that single filtered test.
#
# 1 test red is the honest number for a one-line change, and a probe reporting five is
# reporting on the harness rather than on the guard.
#
# WHAT IS BEING PROBED. Two defects, one cosmetic and one not. The chrome: two contest wizards
# that looked like two products, now one shared shell - and the guard that matters there is the
# NEGATIVE one, because importing the shell is trivially satisfied by a screen that hand-rolls
# a sidebar beside it. And the assistant: one hard-coded trading prompt for every contest,
# which on a game produces fluent, confident, wrong copy with nothing in a log.

$ErrorActionPreference = "Continue"
$enc = New-Object System.Text.UTF8Encoding($false)
$suite = "__tests__/admin/game-contest-wizard.test.ts"
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

    # Line endings are mixed across this repository, so a literal multi-line pattern matches
    # one file and silently misses the next - which is indistinguishable from a test that does
    # not work. Escape the literal, then relax every newline.
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

$VOCAB = "apps/admin/lib/admin/ai-contest-vocabulary.ts"
$ROUTE = "apps/admin/app/api/ai/generate-competition/route.ts"
$SHELL = "apps/admin/components/admin/wizard/WizardShell.tsx"
$WIZARD = "apps/admin/components/admin/games/ProviderContestWizard.tsx"
$BASICS = "apps/admin/components/admin/games/wizard/StepBasics.tsx"
$PICKER = "apps/admin/components/admin/games/wizard/StepChooseGame.tsx"
$PAGE = "apps/admin/app/competitions/new/page.tsx"

# =======================================================================================
# The vocabulary
# =======================================================================================

# 1. THE ORIGINAL DEFECT: a game contest answered in trading's words.
$results += Invoke-Probe `
    -Name "the game prompt goes back to saying trading competition platform" `
    -File $VOCAB `
    -From "You are a creative marketing expert for a skill-game competition platform." `
    -To "You are a creative marketing expert for a trading competition platform." `
    -TestName "does not reuse trading"

# 2. The unit read without the direction - "the fastest time wins" on an endurance game,
#    which is not merely wrong wording but the opposite instruction to a player.
$results += Invoke-Probe `
    -Name "a timed game is always described as a race" `
    -File $VOCAB `
    -From "    return scoreDirection === `"lower_is_better`"`r`n      ? `"the fastest time wins`"`r`n      : `"the longest time survived wins`";" `
    -To "    return `"the fastest time wins`";" `
    -TestName "reads a timed game as speed only"

# 3. Trading's prompt edited in the same breath as the new one, which is what would destroy
#    the only evidence the trading wizard's output is unchanged.
$results += Invoke-Probe `
    -Name "trading's own prompt is reworded" `
    -File $VOCAB `
    -From "Generate engaging, exciting competition content that attracts traders." `
    -To "Generate engaging content for people who like competitions." `
    -TestName "is the same string it always was"

# 4. The ban list becomes advice rather than a rule.
$results += Invoke-Probe `
    -Name "the trading words are no longer forbidden by name" `
    -File $VOCAB `
    -From "- Never use these words: `${TRADING_WORDS.join(`", `")}" `
    -To "- Prefer game language" `
    -TestName "forbids the trading words by name"

# =======================================================================================
# The route
# =======================================================================================

# 5. THE TEMPTING SHORTCUT: an unknown game falls back to trading instead of refusing, so the
#    operator gets confident copy about markets for a puzzle and nothing reports it.
$results += Invoke-Probe `
    -Name "an unknown gameKey silently falls back to trading" `
    -File $ROUTE `
    -From "  return { ok: true, vocabulary: providerVocabulary(title) };" `
    -To "  return { ok: true, vocabulary: TRADING_VOCABULARY };" `
    -TestName "refuses an unknown game instead"

# 6. Vocabulary starts travelling from the browser, which is both a prompt-injection surface
#    and a way for the wizard's state to drift from a catalogue an operator has since edited.
$results += Invoke-Probe `
    -Name "the route reads a game word off the request body" `
    -File $ROUTE `
    -From "const { prompt, type, gameKey } = await request.json();" `
    -To "const { prompt, type, gameKey, displayName } = await request.json();" `
    -TestName "reads only prompt, type and gameKey"

# =======================================================================================
# The chrome - and the negative half is the one that matters
# =======================================================================================

# 7. The shell is imported AND a sidebar is hand-rolled beside it. This is the shape behind
#    every "one rule, two copies" defect here, and the positive assertion is green on it.
$results += Invoke-Probe `
    -Name "the wizard rebuilds its own Quick Preview beside the shared one" `
    -File $WIZARD `
    -From "          <WizardPreview>" `
    -To "          <h3>Quick Preview</h3>`r`n          <WizardPreview>" `
    -TestName "has no chrome of its own"

# 8. The rail is dropped, which is what "looks like a different product" was.
$results += Invoke-Probe `
    -Name "the progress rail is removed" `
    -File $WIZARD `
    -From "          <WizardStepRail steps={STEPS} currentIndex={step} />" `
    -To "" `
    -TestName "renders the shared shell rather than"

# 9. A step body gated on a bare number: reorder the list and one step renders under
#    another's heading, with no error anywhere.
$results += Invoke-Probe `
    -Name "a step body is gated on a numeric literal" `
    -File $WIZARD `
    -From "{step === STEP_SCHEDULE && (" `
    -To "{step === 3 && (" `
    -TestName "drives the rail and the step bodies"

# 10. A trading figure returns to the preview - `05` s10's rule broken on the smallest
#     possible surface.
$results += Invoke-Probe `
    -Name "the preview grows a starting-capital row" `
    -File $WIZARD `
    -From "            <WizardPreviewRow`r`n              icon={Users}`r`n              label=`"Participants`"" `
    -To "            <WizardPreviewRow icon={Users} label=`"Capital`" value={draft.startingCapital} />`r`n            <WizardPreviewRow`r`n              icon={Users}`r`n              label=`"Participants`"" `
    -TestName "shows game facts in the preview"

# 11. The market card is copied across from trading, where it is a control that appears to
#     mean something and cannot: a puzzle does not care whether forex is open.
$results += Invoke-Probe `
    -Name "the forex market card appears on the game wizard" `
    -File $WIZARD `
    -From "          {selected && (" `
    -To "          {marketStatus && (" `
    -TestName "has no market card"

# =======================================================================================
# The assistant, on the screen
# =======================================================================================

# 12. One Generate button loses the game. It still renders, still generates, and returns
#     trading copy - the exact defect, one prop along.
$results += Invoke-Probe `
    -Name "a per-field Generate button stops sending the game" `
    -File $BASICS `
    -From "            currentDescription={draft.description}`r`n            gameKey={title?.gameKey}" `
    -To "            currentDescription={draft.description}" `
    -TestName "passes the game to EVERY entry point"

# 13. Generated text is displayed and never stored, which an operator discovers after saving.
$results += Invoke-Probe `
    -Name "the generated name is not written into the draft" `
    -File $BASICS `
    -From "onGenerate={(data) => data.title && patch({ name: data.title })}" `
    -To "onGenerate={(data) => data.title && console.log(data.title)}" `
    -TestName "writes what it generates into the draft"

# 14. A second copy of the banner, which is how one wizard silently stops sending the game.
$results += Invoke-Probe `
    -Name "a second AI banner is written by hand" `
    -File $BASICS `
    -From "      <AiContentPanel" `
    -To "      <h4>AI Content Generator</h4>`r`n      <AiContentPanel" `
    -TestName "keeps one definition of the panel"

# 15. The first special case for a specific title - the single failure mode of the
#     "no developer needed for a new game" claim.
$results += Invoke-Probe `
    -Name "the picker gains a per-title special case" `
    -File $PICKER `
    -From "        const lowerWins = title.scoreDirection === `"lower_is_better`";" `
    -To "        const lowerWins = title.gameCode === `"circuit-sprint`";" `
    -TestName "names no game anywhere"

# =======================================================================================
# R39, on a new surface
# =======================================================================================

# 16. The page hands a COMPONENT across the server/client boundary. This is the mutation that
#     took the trading lobby down on 6 September, and note it is refused by the compiler as
#     well - the test exists because the typecheck is not what runs in CI on every edit.
$results += Invoke-Probe `
    -Name "the page passes the icon component rather than an element" `
    -File $PAGE `
    -From "icon={<Gamepad2 />}" `
    -To "icon={Gamepad2}" `
    -TestName "is handed a rendered element"

# 17. The same defect from the other side: the shell asks for a component.
$results += Invoke-Probe `
    -Name "the header prop is typed as a component again" `
    -File $SHELL `
    -From "  icon: ReactNode;" `
    -To "  icon: LucideIcon;" `
    -TestName "is handed a rendered element"

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
