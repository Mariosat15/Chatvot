# Probe harness for the level ladder - R88 (reads), R90 (local rung maps) and R91 (the editor
# that could destroy the ladder).
#
# PROBE 9 IS THE ONE TO READ FIRST. It is the reason R91 exists at all: it restores the local
# `TITLE_LEVELS` state variable that shadowed the canonical constant, which meant the R90
# reach regex was satisfied by a hard-coded ten-rung ladder living inside the component. The
# guard reported the file clean while it held the very thing the guard forbids.
#
# Same rules as every harness here: one defect per probe, one named expected test, and a green
# probe is a question with four known answers - weak test, wrong claim, unreachable guard, or
# a mutation with no observable.

$ErrorActionPreference = 'Continue'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$Suite = '__tests__/services/level-ladder-rename.test.ts'
$script:pass = 0
$script:fail = 0

function Relaxed([string]$literal) {
  [regex]::Escape($literal) -replace '\\r\\n|\\n', '\r?\n'
}

function Invoke-Probe {
  param(
    [string]$Name,
    [string]$File,
    [string]$From,
    [string]$To,
    [string]$ExpectRed,
    [int]$AllowRed = 1
  )

  # Reason: -LiteralPath on the READ as well as the write. One of these paths contains
  # `[id]`, which PowerShell parses as a wildcard character class, so Get-Content matches
  # nothing and returns $null while the write happily empties the file. A probe that
  # destroys the file it is probing reports every test red for entirely the wrong reason.
  $path = Join-Path $root $File
  $original = [IO.File]::ReadAllText($path)
  if ([string]::IsNullOrEmpty($original)) {
    Write-Host "HARNESS BROKEN  $Name - read returned nothing for $File" -ForegroundColor Magenta
    $script:fail++
    return
  }

  $pattern = Relaxed $From
  if (-not [regex]::IsMatch($original, $pattern)) {
    # Reason: DID NOT APPLY means the target MOVED, never that the run was quiet.
    Write-Host "DID NOT APPLY   $Name - pattern not found in $File" -ForegroundColor Magenta
    $script:fail++
    return
  }

  try {
    $mutated = [regex]::Replace($original, $pattern, { param($m) $To }, 1)
    if ($mutated -eq $original) {
      Write-Host "DID NOT APPLY   $Name - replacement changed nothing" -ForegroundColor Magenta
      $script:fail++
      return
    }
    [IO.File]::WriteAllText($path, $mutated, (New-Object Text.UTF8Encoding $false))

    # Reason: run the expected test ALONE with -t and read the summary counts. Searching the
    # whole suite's output for the test's NAME reports RED beside "failed 0", because vitest
    # prints a passing test's name as readily as a failing one.
    $out = & cmd.exe /c "npx vitest run $Suite -t `"$ExpectRed`" --reporter=basic 2>&1" | Out-String
    $flat = ($out -replace '\s+', ' ')

    if ($flat -match 'Tests\s+(\d+)\s+failed') {
      $count = [int]$Matches[1]
      if ($count -le $AllowRed) {
        Write-Host "RED             $Name" -ForegroundColor Green
      } else {
        Write-Host "RED (x$count)      $Name - more than the expected test broke" -ForegroundColor Yellow
      }
      $script:pass++
    } elseif (
      $flat -match 'No test files found' -or
      $flat -match 'Tests\s+no tests' -or
      $flat -match 'Tests\s+0\s+passed' -or
      $flat -notmatch 'Tests\s+\d+\s+passed'
    ) {
      # Reason: vitest's -t is a REGULAR EXPRESSION, so a bracket or an apostrophe in the
      # test's name matches nothing and a passing run over zero tests reads exactly like a
      # missing guard. Every name below is regex-safe for that reason.
      Write-Host "NO TEST RAN     $Name - '$ExpectRed' matched nothing" -ForegroundColor Magenta
      $script:fail++
    } else {
      Write-Host "GREEN           $Name - the guard is not doing its job" -ForegroundColor Red
      $script:fail++
    }
  } finally {
    [IO.File]::WriteAllText($path, $original, (New-Object Text.UTF8Encoding $false))
  }
}

$ENTRY  = 'components/trading/CompetitionEntryButton.tsx'
$SIDEBAR = 'components/trading/lobby/TradingLobbySidebar.tsx'
$LOBBY  = 'app/(root)/competitions/page-content.tsx'
$FORM   = 'apps/admin/components/admin/CompetitionCreatorForm.tsx'
$CREATE = 'apps/admin/app/competitions/create/page.tsx'
$EDITOR = 'apps/admin/components/admin/BadgeXPManagementSection.tsx'
$TITLE  = 'lib/utils/level-title.ts'
$GM_PAGE = 'app/(root)/gamemaster/create-competition/page.tsx'
$GM_FORM = 'app/(root)/gamemaster/create-competition/page-content.tsx'

Write-Host "`n=== R90 - no screen holds its own list of rung names ===" -ForegroundColor Cyan

# 1. THE ORIGINAL DEFECT, VERBATIM. A ten-entry map in a component that gates on a
#    twenty-rung ladder, so rungs 11-20 rendered as nothing at all and rungs 1-10 carried
#    whatever the author had typed rather than what the operator had configured.
Invoke-Probe -Name '1  the local rung map restored' -File $ENTRY `
  -From 'resolveLevelName(' `
  -To 'LEVEL_NAMES_LOCAL(' `
  -ExpectRed 'the four fixed screens resolve through the shared helper, not a local map'

# 2. THE SHAPE A LATER EDIT ACTUALLY PRODUCES. The resolver kept, and a local map added
#    beside it for one extra caption - so every positive assertion passes while one of the
#    two answers on the screen is the author's and not the operator's.
Invoke-Probe -Name '2  a local map beside the correct resolver' -File $SIDEBAR `
  -From 'import { resolveLevelName }' `
  -To 'const LEVEL_NAMES: Record<number, string> = { 1: "Novice" };
import { resolveLevelName }' `
  -ExpectRed 'the four fixed screens resolve through the shared helper, not a local map'

# 3. THE DIRECTORY WALK NARROWED. The vacuity probe, and the one that matters most for a
#    scan-based suite: with the walk returning nothing, every `it.each` below it produces
#    zero cases and the whole R90 block passes having examined no file at all.
Invoke-Probe -Name '3  the gate-screen walk finds nothing' -File $Suite `
  -From 'for (const dir of ["components", "app", "apps/admin/components"]) walk(dir);' `
  -To 'for (const dir of ["lib/constants"]) walk(dir);' `
  -ExpectRed 'finds the level-gate screens'

# 4. THE EXEMPTION LIST WIDENED. The quietest way to lose this guard: a screen that grows a
#    hard-coded map is added to NAMES_NO_RUNG with a plausible reason, and the second half of
#    that block - that the file still renders the NUMBER its reason describes - is what
#    refuses it. Asserting only the absence of ladder reach would admit the exemption.
Invoke-Probe -Name '4  a real offender excused as rendering a number' -File $Suite `
  -From 'const NAMES_NO_RUNG' `
  -To 'const NAMES_NO_RUNG: { file: string; reason: string; number: RegExp }[] = [
  { file: "components/trading/CompetitionEntryButton.tsx", reason: "excused", number: /nothing-like-this/ },
]; const UNUSED_NO_RUNG' `
  -ExpectRed 'renders a number, not a name' `
  -AllowRed 2

# 5. THE ORIGINAL DEFECT, VERBATIM, ON THE FILE THAT CARRIED IT. Probe 5 used to prove the
#    opposite - that the Game Master page was STILL an offender - and was re-aimed rather
#    than deleted when the page was fixed on 16 Sep 2026. Note this restores the *name*
#    only: rung 3 of the default ladder is "Trainee", so a Game Master reading
#    "Skilled Trader" gated on a rung whose real name is something else entirely.
Invoke-Probe -Name '5a the Game Master rung names typed in again' -File $GM_FORM `
  -From '                                  Level {level.level}: {level.title} (' `
  -To '                                  Level 3: Skilled Trader (' `
  -ExpectRed 'the Game Master form names no rung of its own and caps at no number'

# 5b. THE CAP, WHICH IS THE HALF THAT WAS WRONG EVEN AGAINST THE DEFAULT LADDER. The maxLevel
#     list was a literal `[1..10]` over a twenty-rung ladder, so no Game Master could gate
#     above halfway - and it named no rung, so probe 5a cannot see it. Two halves, two probes,
#     because fixing either alone still leaves a Game Master unable to say what they meant.
Invoke-Probe -Name '5b the maxLevel cap of ten restored' -File $GM_FORM `
  -From '                                    level.level >= levelRequirement.minLevel,' `
  -To '                                    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].includes(level.level),' `
  -ExpectRed 'the Game Master form names no rung of its own and caps at no number'

Write-Host "`n=== R88 - the operator's ladder is the authority ===" -ForegroundColor Cyan

# 6. THE STALE CACHE READ. This is the fix prescription the risk register originally
#    carried, and it is wrong: `currentTitle` is stamped at award time, so a rung renamed
#    afterwards never reaches a player who has not levelled up since. It reads as the
#    obvious fix, which is exactly why it needs a probe.
Invoke-Probe -Name '6  the title taken from the award-time cache' -File $TITLE `
  -From '    trimmed(entry.title) ||
    trimmed(stored?.currentTitle) ||' `
  -To '    trimmed(stored?.currentTitle) ||
    trimmed(entry.title) ||' `
  -ExpectRed 'prefers the ladder'

# 7. ARTWORK TAKEN FROM THE OPERATOR'S TEXT. The subtle half of R88: the NAME is the
#    operator's, the icon and colour are not - an operator-typed icon name has no committed
#    SVG behind it and an operator-typed colour is not a compiled Tailwind class, so both
#    must be matched out of the code ladder by level NUMBER. Taking them from the stored
#    entry renders a missing glyph and an unstyled label, and neither throws.
Invoke-Probe -Name '7  icon and colour read from the stored entry' -File $TITLE `
  -From '  const art = TITLE_LEVELS.find((e) => e.level === level) ?? TITLE_LEVELS[0];' `
  -To '  const art = { icon: entry.icon, color: entry.color };' `
  -ExpectRed 'takes the icon and colour from the code ladder'

# 8. THE ADMIN FORM BACK ON THE CONSTANT. The two forms are a third shape - they offer the
#    whole ladder as choices - so they never call the resolver and can only be guarded on
#    what they must NOT import. A value import here is a dropdown of our names over the
#    operator's, on the one screen where the choice is made.
Invoke-Probe -Name '8  the admin form imports the constant again' -File $FORM `
  -From 'levelLadder.map(' `
  -To 'TITLE_LEVELS_LOCAL.map(' `
  -ExpectRed 'offers the operator''s ladder, not the constant'

Write-Host "`n=== R91 - the editor cannot overwrite what it failed to load ===" -ForegroundColor Cyan

# 9. THE SHADOWING STATE VARIABLE. READ THIS ONE. The defect was not that the editor held a
#    hard-coded ladder - it was that the variable holding it was named `TITLE_LEVELS`, so the
#    R90 reach regex matched a bare identifier and pronounced the file clean. The regex is
#    now anchored to an IMPORT of the constant or a CALL to a helper for this reason.
Invoke-Probe -Name '9  the shadowing TITLE_LEVELS state restored' -File $EDITOR `
  -From 'const [storedLevels, setStoredLevels] = useState<any[]>([]);' `
  -To 'const [TITLE_LEVELS, setStoredLevels] = useState<any[]>([{ level: 1, title: "Novice Trader" }]);
  const storedLevels = TITLE_LEVELS;' `
  -ExpectRed 'holds no hard-coded ladder of its own'

# 10. THE SAVE GUARD DELETED. The whole of R91 in one line: the POST replaces the stored
#     document outright, so a save made before the ladder arrived wrote whatever state held.
Invoke-Probe -Name '10 the save no longer refuses an unloaded ladder' -File $EDITOR `
  -From 'if (!ladderLoaded || levels.length === 0) {' `
  -To 'if (false) {' `
  -ExpectRed 'the save refuses before the ladder has loaded'

# 11. THE GUARD THAT TOASTS AND FALLS THROUGH. The condition present, correct and complete,
#     and no `return` - so the operator is told the ladder did not load and the save proceeds
#     anyway. It is the shape this same file already had on its XP tab, which is why it is the
#     likely edit, and every positive assertion about the condition passes on it.
#
#     THIS PROBE CAME BACK GREEN ONCE, against `if (!ladderLoaded && false)`, and the honest
#     answer was a weak test rather than a wrong claim: the assertion matched the opening of
#     the condition and could not see it neutered. The test now pins both clauses AND the
#     return. The `&& false` mutation is not probed - see the footer.
Invoke-Probe -Name '11 the guard toasts and falls through' -File $EDITOR `
  -From '      return;
    }' `
  -To '    }' `
  -ExpectRed 'the save refuses before the ladder has loaded'

# 11b. THE LENGTH CLAUSE DROPPED FROM THE SAVE. Distinct from probe 12, which drops it from
#      the FLAG: this one leaves the flag correct and lets an empty `levels` array through the
#      save, which POSTs nothing over the stored ladder. Two clauses, two ways to lose it.
Invoke-Probe -Name '11b the save stops checking the ladder is non-empty' -File $EDITOR `
  -From 'if (!ladderLoaded || levels.length === 0) {' `
  -To 'if (!ladderLoaded) {' `
  -ExpectRed 'the save refuses before the ladder has loaded'

# 12. THE LENGTH TEST DROPPED FROM THE FLAG. `if (xpData.levels)` admits `[]`, so an empty
#     response sets the flag, the guard passes, and the save POSTs an empty ladder over the
#     stored one. The defect one step along from the one that was fixed, and it reads as a
#     harmless simplification.
Invoke-Probe -Name '12 the flag set by an empty response' -File $EDITOR `
  -From 'Array.isArray(xpData.levels) && xpData.levels.length > 0' `
  -To 'Array.isArray(xpData.levels)' `
  -ExpectRed 'the flag is set only by a non-empty loaded ladder'

# 13. A SECOND WRITER OF THE FLAG. The shape that survives every other assertion here: the
#     original setter untouched, and a second one in the failure path so the editor arms
#     itself precisely when the read failed. Caught only by the count.
Invoke-Probe -Name '13 a second setLadderLoaded in the failure path' -File $EDITOR `
  -From 'setLadderLoaded(true);' `
  -To 'setLadderLoaded(true);
        setLadderLoaded(true);' `
  -ExpectRed 'the flag is set only by a non-empty loaded ladder'

# 14. THE REFUSAL REDUCED TO A DISABLED CONTROL. A greyed-out button teaches nothing - an
#     operator reads it as the feature being broken and reloads nothing. The refusal has to
#     name the missing thing and the action, which is the same rule as a provider with no
#     adapter and a rankingMethod a provider game ignores.
Invoke-Probe -Name '14 the refusal replaced by silence' -File $EDITOR `
  -From 'Reload the page' `
  -To 'Unavailable' `
  -ExpectRed 'the editor control is withheld with its reason, not disabled'

# 15. AN UNGUARDED RUNG READ. storedLevels is empty until the fetch lands, so `[0]` is no
#     longer the guaranteed fallback it was when state was seeded with ten rungs. This
#     throws on exactly the failed-load path the whole defect is about.
Invoke-Probe -Name '15 a rung read that assumes a loaded ladder' -File $EDITOR `
  -From 'levelData?.icon' `
  -To 'levelData.icon' `
  -ExpectRed 'every read of a rung survives an empty ladder'

# 16. THE HARD-CODED RUNG COUNT RESTORED. Found by accident rather than by design - the
#     string test above went red on PROSE, not on the literal it was written for. "Level 10
#     (Trading God) is the maximum level" was wrong twice: the ladder has twenty rungs, and
#     the name is the operator's to change. A claim about the data is as renameable as a
#     label, and it is the one a diff scrolls past because it reads like documentation.
Invoke-Probe -Name '16 the hard-coded maximum-level claim' -File $EDITOR `
  -From '{topRung' `
  -To '{false' `
  -ExpectRed 'states no rung count of its own'

Write-Host "`n=== the read sites stay on the shared resolver ===" -ForegroundColor Cyan

# 17. THE LADDER READ TWICE ON ONE PAGE. Two reads is two answers - the page renders one
#     ladder and hands the form another - and it is the natural shape when somebody adds a
#     second consumer rather than threading the prop down. Caught only by the count.
Invoke-Probe -Name '17 a second ladder read on one page' -File $CREATE `
  -From 'await getTitleLevels()' `
  -To 'await getTitleLevels(); await getTitleLevels()' `
  -ExpectRed 'reads the ladder once and hands it down'

# 18. THE PROP DROPPED. The read kept, correct and complete, and never passed to the form -
#     so the form falls back to whatever it does without a ladder and the page's own read is
#     dead code that reviews as the fix being present.
Invoke-Probe -Name '18 the ladder read but not handed down' -File $CREATE `
  -From 'levelLadder={levelLadder}' `
  -To 'className="contents"' `
  -ExpectRed 'reads the ladder once and hands it down'

# 19. THE GAME MASTER FORM BACK ON THE CONSTANT. The same third shape as the two admin forms
#     - it offers the whole ladder as choices and so never calls the resolver - which is why
#     it is exempt from LADDER_REACH and has to be guarded on what it must NOT import. Probed
#     separately from probe 8 because the two files are exempted for the same reason and a
#     single probe would leave whichever one it did not name unproven.
Invoke-Probe -Name '19 the Game Master form imports the constant again' -File $GM_FORM `
  -From 'levelLadder.map(' `
  -To 'TITLE_LEVELS_LOCAL.map(' `
  -ExpectRed 'offers the operator''s ladder, not the constant'

# 20. THE PROP DROPPED ON THE GAME MASTER PAGE. The server half reads the ladder, correctly,
#     and never hands it over - so the client falls back to nothing and the read is dead code
#     that reviews as the fix being present. Probe 18's defect on the page that needed it most,
#     this being the one screen where a Game Master chooses which rung may enter.
Invoke-Probe -Name '20 the Game Master ladder read but not handed down' -File $GM_PAGE `
  -From 'levelLadder={levelLadder}' `
  -To 'className="contents"' `
  -ExpectRed 'reads the ladder once and hands it down'

# 21. THE CONTAINMENT ASSERTION AIMED AT THE SERVER HALF. The vacuity trap the client/server
#     split introduces, and it reads as the more natural of the two: `page.tsx` is the file
#     whose name a reader remembers, it holds no `minLevel`, so the walk never returns it and
#     the assertion fails - which is the honest outcome. The dangerous direction is the one
#     this probe pins by contrast: name the server half and the CONTROLS go unexamined.
Invoke-Probe -Name '21 the walk assertion names the server half' -File $Suite `
  -From 'expect(screens).toContain(GAMEMASTER_FORM);' `
  -To 'expect(screens).toContain(GAMEMASTER_PAGE);' `
  -ExpectRed 'finds the level-gate screens'

Write-Host ""
if ($script:fail -eq 0) {
  Write-Host "all $($script:pass) probes red on the expected test" -ForegroundColor Green
} else {
  Write-Host "$($script:pass) red, $($script:fail) NOT red - read those above" -ForegroundColor Red
}

# THREE PROBES ARE DELIBERATELY ABSENT, with the reasons here rather than three more lines
# that report green and teach the next reader the guards are decoration.
#
# There is no probe for the save guard's condition being made UNREACHABLE while still reading
# correctly - `if (!ladderLoaded && false)`. It was written, it came back green, and it is not
# in the file, because catching it means pinning the condition character for character and
# that guard would then fail on any legitimate rewording. A guard that fires on correct code
# is the one the next reader deletes, which costs more than this shape does: nobody writes
# `&& false` by accident, whereas probes 10, 11, 11b, 12 and 13 are all edits somebody makes
# on purpose while believing they are simplifying.
#
# There is no probe for `LADDER_BY_FETCH`'s endpoint assertion being aimed at the right
# endpoint. Mutating the fetch URL turns that test red, which probe-able - but the property
# worth proving is that the URL names the route which actually returns the ladder, and that
# is a claim about a route handler rather than about this component. It is held instead by
# the route's own suite.
#
# And there is no probe for the R91 refusal being rendered rather than merely reachable. The
# branch is `{!ladderLoaded ? ... : ...}`, so the only mutation that removes the render
# without removing the condition is one that swaps the arms - and swapping them makes the
# editor available exactly when the ladder is absent, which is probe 10's defect arriving by
# a different road. It would report red on the same test and prove nothing new.
