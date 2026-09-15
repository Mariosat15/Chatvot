# Probe harness for X6.5 step A2 - the contest create wizard and editor on the token layer.
#
# Same rules as the three A1 harnesses: one defect, one named expected test, and a green probe
# is a question with four known answers (weak test, wrong claim, unreachable guard, mutation
# with no observable).
#
# PROBE 3 IS THE ONE TO READ FIRST. It restores a caption shape the guard was blind to on its
# first run - `<Label>Attempts</Label>`, where the word touches the `<` of its own closing tag
# and so read as a generic type parameter - and it exists because that hole was found by
# accident rather than by the harness. A guard whose commonest input it cannot see is worse
# than no guard, because the file it skips is reported clean.

$ErrorActionPreference = 'Continue'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$Suite = '__tests__/admin/wizard-terminology.test.ts'
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

  $path = Join-Path $root $File

  # Reason: [IO.File]::ReadAllText, never Get-Content. PowerShell 5.1 decodes with the system
  # ANSI codepage, so an emoji in a touched file returns as mojibake and is written back that
  # way - the probe passes, the file is quietly mangled, and it surfaces two steps later as an
  # unexplained typecheck error. -LiteralPath is moot here only because no path has a bracket.
  $original = [IO.File]::ReadAllText($path)
  if ([string]::IsNullOrEmpty($original)) {
    Write-Host "HARNESS BROKEN  $Name - read returned nothing for $File" -ForegroundColor Magenta
    $script:fail++
    return
  }

  $pattern = Relaxed $From
  if (-not [regex]::IsMatch($original, $pattern)) {
    # Reason: DID NOT APPLY means the target MOVED, never that the run was quiet. Two probes
    # in an earlier phase sat unapplied for days against a body that had been rewritten, so
    # two real guards were never exercised while the harness reported nothing wrong.
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
    # Reason: collapse all whitespace before matching. Out-String wraps at the console width,
    # so a long test name arrives split across two lines and a literal match silently misses.
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
      # Reason: vitest's -t is a REGULAR EXPRESSION, so an apostrophe or a bracket in the
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

$WIZARD  = 'apps/admin/components/admin/games/ProviderContestWizard.tsx'
$EDITOR  = 'apps/admin/components/admin/games/ProviderContestEditor.tsx'
$BASICS  = 'apps/admin/components/admin/games/wizard/StepBasics.tsx'
$PRIZES  = 'apps/admin/components/admin/games/wizard/StepPrizes.tsx'
$REVIEW  = 'apps/admin/components/admin/games/wizard/StepReview.tsx'
$GAME    = 'apps/admin/components/admin/games/wizard/StepChooseGame.tsx'
$RANKS   = 'apps/admin/components/admin/games/PrizeDistributionEditor.tsx'

Write-Host "`n=== the surface reads its nouns from the token layer ===" -ForegroundColor Cyan

# 1. THE HOOK REMOVED FROM A STEP THAT DISPLAYS NOUNS. The step still renders, because the
#    tokens it used are now undefined - and `undefined` renders as NOTHING rather than as an
#    error, so the caption silently disappears. That is why this is a guard and not a type.
Invoke-Probe -Name '1  a step body stops calling useTerms' -File $BASICS `
  -From '  const terms = useTerms();' `
  -To '  const terms = { contest: "" } as never;' `
  -ExpectRed 'calls the hook in every file that displays a renameable noun'

# 2. A SECOND PACK DECLARED LOCALLY. The natural shortcut for anybody who finds the hook
#    inconvenient in a helper - and it reads correctly, imports a real module, and returns
#    real words. What it cannot do is see the operator's overrides, so the screen keeps
#    saying "Competition" after they rename it and nothing fails anywhere.
Invoke-Probe -Name '2  a local TERMS pack instead of the hook' -File $REVIEW `
  -From 'import { useTerms } from "@/contexts/TerminologyContext";' `
  -To 'import { TERMS } from "@/lib/constants/terminology";
const terms = TERMS;' `
  -ExpectRed 'imports the hook from the context, never re-declares a pack of its own'

# 3. THE CAPTION SHAPE THE GUARD WAS BLIND TO. `Attempts` immediately before the `<` of its
#    own closing tag. This is the probe the harness exists for: the first version of the
#    identifier heuristic treated `<` as code punctuation, so this exact line was skipped and
#    the editor was reported clean with a bare Title Case noun in it.
Invoke-Probe -Name '3  a bare Title Case caption against its closing tag' -File $EDITOR `
  -From '<Label className="text-gray-200">{terms.attempts}</Label>' `
  -To '<Label className="text-gray-200">Attempts</Label>' `
  -ExpectRed 'has no Title Case noun as a JSX literal or a quoted caption'

# 4. A LITERAL BESIDE A CORRECT TOKEN. The shape a later edit actually produces - somebody
#    adds a field and copies the trading form's wording rather than the file they are in - so
#    every positive assertion above still passes while the screen contradicts itself.
Invoke-Probe -Name '4  a literal noun beside the tokenised ones' -File $BASICS `
  -From 'label={`${terms.contest} Name *`}' `
  -To 'label="Competition Name *"' `
  -ExpectRed 'has no Title Case noun as a JSX literal or a quoted caption'

# 5. TRADING VOCABULARY IN A CAPTION. Not on the rename list at all: no token says
#    "Participants", so this is the word a wording pass is supposed to remove rather than one
#    it is supposed to route through a token.
Invoke-Probe -Name '5  trading vocabulary as a caption' -File $REVIEW `
  -From 'label={terms.players}' `
  -To 'label="Participants"' `
  -ExpectRed 'has no trading vocabulary in a caption, tokenised or not'

Write-Host "`n=== nothing edits the operator's own word ===" -ForegroundColor Cyan

# 6. CASE-FOLDED MID-SENTENCE. The single most tempting defect in the whole pass, because it
#    makes an awkward sentence read correctly - and it destroys the operator's capitalisation
#    ("eSports Cup" becomes "esports cup") for every word they choose.
Invoke-Probe -Name '6  a token lower-cased to fit a sentence' -File $GAME `
  -From 'built from the ${terms.game} you choose' `
  -To 'built from the ${terms.game.toLowerCase()} you choose' `
  -ExpectRed 'never case-folds a token'

# 7. A PLURAL DERIVED FROM A SINGULAR. The reason `prizes`, `players`, `contests`, `rounds`
#    and `attempts` are separate tokens rather than derived: appending "s" to a word the
#    operator chose is us editing their vocabulary, and it is wrong for most words that are
#    not English nouns ending in a consonant.
Invoke-Probe -Name '7  a plural built by appending s to a token' -File $WIZARD `
  -From 'title: `${terms.prizes} & Rules`' `
  -To 'title: `${terms.prize}s & Rules`' `
  -ExpectRed 'never derives a plural from a token'

Write-Host "`n=== the never-rename list stays literal ===" -ForegroundColor Cyan

# 8. A ROUTE ID TOKENISED. The defect a thorough wording pass produces rather than a careless
#    one: `activeTab=competitions` LOOKS like the same noun as every caption beside it. It is
#    an `ADMIN_SECTIONS` value, so renaming it breaks the deep link, the RBAC grant and every
#    bookmark - and the moment an operator renames the word, silently.
Invoke-Probe -Name '8  the section id built from a token' -File $WIZARD `
  -From 'router.push("/?activeTab=competitions");' `
  -To 'router.push(`/?activeTab=${terms.contests.toLowerCase()}`);' `
  -ExpectRed 'navigates by the section id, not by a token'

# 9. A TOKEN THAT DOES NOT EXIST. Typing `terms.tournament` is valid-looking code that the
#    compiler does catch - but only while the pack is a closed type, which is exactly the
#    property somebody relaxes when a helper takes `terms` as a loose parameter. The caption
#    then renders as nothing at all.
Invoke-Probe -Name '9  a token name that is not in the catalogue' -File $RANKS `
  -From 'Add {terms.rank}' `
  -To 'Add {terms.tournament}' `
  -ExpectRed 'uses tokens that exist, so a typo cannot render undefined'

Write-Host "`n=== the scan reaches what it claims to ===" -ForegroundColor Cyan

# 10. THE STEP BODIES DROPPED FROM THE SURFACE LIST. The vacuity probe, and the one that
#     matters most for a structural suite: with the orchestrator alone in the list, every
#     assertion above passes over a file that contains almost no captions, and the six step
#     bodies holding the actual labels are never read. A suite that examines nothing passes.
Invoke-Probe -Name '10 the surface list narrowed to the orchestrator' -File $Suite `
  -From 'const SURFACE = [' `
  -To 'const SURFACE = ["apps/admin/components/admin/games/ProviderContestWizard.tsx"]; const UNUSED_SURFACE = [' `
  -ExpectRed 'finds the step bodies, not just the orchestrator' `
  -AllowRed 3

Write-Host "`n=== the guard knows the codebase's own word for a contest ===" -ForegroundColor Cyan

# 11. THE LIVE DEFECT THIS ASSERTION WAS ADDED FOR. `toast.success("Contest saved.")` stood in
#     the editor through the whole of A2 and every probe above stayed green on it, because the
#     guard was built from token VALUES and `contest` defaults to "Competition" - so nothing
#     ever looked for the word "Contest". It is the spelling the services, the filenames and
#     every docblock use, which makes it the one a new caption reaches for. An operator who had
#     renamed the noun to "Tournament" saved a Tournament and was told a Contest had been saved.
Invoke-Probe -Name '11 the codebase''s own synonym for the contest token' -File $EDITOR `
  -From 'toast.success(`${terms.contest} saved.`);' `
  -To 'toast.success("Contest saved.");' `
  -ExpectRed 'has no Title Case noun as a JSX literal or a quoted caption'

Write-Host ""
if ($script:fail -eq 0) {
  Write-Host "all $($script:pass) probes red on the expected test" -ForegroundColor Green
} else {
  Write-Host "$($script:pass) red, $($script:fail) NOT red - read those above" -ForegroundColor Red
}

# ONE PROBE IS DELIBERATELY ABSENT, with the reason here rather than a tenth line that
# reports green and teaches the next reader the guard is decoration.
#
# There is no probe for the three `activeTab=competitions` call sites being COUNTED rather
# than merely found. Probe 8 mutates one of them and the guard names the file and line, so
# the count is exercised - but a probe that mutates only the SECOND of the three would prove
# the counting specifically, and it cannot be written with a single-replacement harness whose
# regex replaces the first match. Rewriting the harness to take an occurrence index buys one
# assertion on a list that a grep already shows is three long, and the shape it guards
# against - one call site correct and another dead - is what probe 8 turns red either way.
