# Probe harness for X6.5 step A3 - the contest LIST and DETAIL screens on the token layer.
#
# Same rules as the A1 and A2 harnesses: one defect, one named expected test, and a green
# probe is a question with four known answers (weak test, wrong claim, unreachable guard,
# mutation with no observable).
#
# PROBE 3 IS THE ONE TO READ FIRST. It does not remove anything - it ADDS a second
# `getTerms()`, inside a panel, which compiles, renders and reads tidier than threading a
# prop. Nothing about the screen looks wrong until two reads disagree, at which point one
# panel says "Event" and the panel beside it says "Competition" in the same screenshot, and
# the operator concludes the setting is broken. It is the probe that proves the "resolve once
# per request" rule is enforced rather than merely described in a docblock.

$ErrorActionPreference = 'Continue'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$Suite = '__tests__/admin/contest-screens-terminology.test.ts'
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

  # Reason: -LiteralPath on the READ as well as the write. The detail page lives at
  # `app/competitions/view/[id]/page.tsx`, and PowerShell parses `[id]` as a wildcard
  # character class - so a plain read matches nothing, returns $null, and the write puts
  # that back happily. A harness destroyed the file it was probing this way once, emptied the
  # route, then "restored" it to nothing, and every probe went red on the expected test for
  # entirely the wrong reason. The empty-read check below is the second half of that fix.
  #
  # [IO.File]::ReadAllText rather than Get-Content, because PowerShell 5.1 decodes with the
  # system ANSI codepage and returns every emoji in a touched file as mojibake.
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
      # Reason: vitest's -t is a REGULAR EXPRESSION, so a parenthesis or an apostrophe in the
      # test's name matches nothing and a passing run over zero tests reads exactly like a
      # missing guard. Every name in the suite is paren-free for that reason.
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

$LIST      = 'apps/admin/components/admin/CompetitionsListSection.tsx'
$DETAIL    = 'apps/admin/app/competitions/view/[id]/page.tsx'
$SETTLED   = 'apps/admin/components/admin/competitions/SettledResultPanel.tsx'
$PRIZE     = 'apps/admin/components/admin/competitions/ContestPrizePanel.tsx'
$PROSE     = 'apps/admin/lib/admin/contest-result-presentation.ts'
$ANALYTICS = 'apps/admin/lib/admin/contest-analytics-presentation.ts'

Write-Host "`n=== the pack is resolved once, on the server, and threaded down ===" -ForegroundColor Cyan

# 1. THE PAGE STOPS RESOLVING THE PACK. A server component has no React context, so there is
#    no hook to fall back on - the panels below it would receive whatever the page happened to
#    have in scope. The page is the only place in this render that can ask the database.
Invoke-Probe -Name '1  the detail page stops calling getTerms' -File $DETAIL `
  -From '  const terms = await getTerms();' `
  -To '  const terms = { contest: "Competition" } as never;' `
  -ExpectRed 'calls getTerms on the page' `
  -AllowRed 2

# 2. THE PACK THREADED INTO ONE PANEL AND NOT THE OTHER. The half-renamed screen, in its
#    purest form: the prize panel honours the operator's word, the settled-results table
#    directly beneath it does not, and both render without error. This is why the handover is
#    COUNTED rather than merely found - a test asking whether `terms={terms}` appears at all
#    is green on exactly this.
Invoke-Probe -Name '2  one panel left without the pack' -File $DETAIL `
  -From @'
                terms={terms}
              />
'@ `
  -To @'
              />
'@ `
  -ExpectRed 'hands the pack to both panels'

# 3. A PANEL RESOLVES THE PACK FOR ITSELF. Compiles, renders, and looks like one less prop to
#    thread. Two reads inside one request are two answers to one question - the "one rule, two
#    copies" shape behind referenceId, failedReason, challengeId and the Game Master `||` -
#    and here the drift is visible to an operator in a single screenshot.
Invoke-Probe -Name '3  a panel resolving the pack a second time' -File $SETTLED `
  -From '  terms: TerminologyPack;' `
  -To '  terms?: TerminologyPack;
}
async function getTerms(): Promise<never> {
  return null as never;
}
interface Unused {' `
  -ExpectRed 'does not resolve the pack a second time inside a panel' `
  -AllowRed 2

# 4. THE LIST SECTION STOPS CALLING THE HOOK. The client half of the same rule. Every token it
#    renders becomes `undefined`, and `undefined` renders as NOTHING rather than as an error -
#    so the captions silently disappear rather than reverting to the defaults, which is the
#    failure mode a type cannot catch on a template literal.
Invoke-Probe -Name '4  the list stops calling useTerms' -File $LIST `
  -From '  const terms = useTerms();' `
  -To '  const terms = {} as never;' `
  -ExpectRed 'calls useTerms and imports it from the context'

# 5. THE LIST TURNED INTO A SERVER COMPONENT. Not a hypothetical: dropping "use client" is a
#    one-line change somebody makes while chasing a bundle size, and `useTerms()` throws at
#    render the moment it happens. The assertion documents WHY this half of the surface uses a
#    hook while the other half takes a prop.
Invoke-Probe -Name '5  the list loses its client directive' -File $LIST `
  -From '"use client";' `
  -To '// server component now;' `
  -ExpectRed 'is a client component, which is why it uses the hook at all'

Write-Host "`n=== the prose module cannot answer without being asked ===" -ForegroundColor Cyan

# 6. THE PACK MADE OPTIONAL. An optional pack is a default by another name: the caller that
#    forgets still compiles, the sentence still renders, and the only symptom is an operator's
#    rename not reaching one of three surfaces. This module is behind both panels AND the
#    analytics screen, so one literal here was worth three.
#
#    THE FIRST VERSION OF THIS PROBE STAYED GREEN, and it was the fourth cause: a mutation
#    with no observable. It added a second, unrelated optional key beside the pack
#    (`termsOptional?: never`) rather than making the pack itself optional, so `terms:
#    TerminologyPack` was still present and `terms?:` still absent - the guard was answering
#    the question it was asked. Mutate the thing the assertion names, never something that
#    merely reads like it.
Invoke-Probe -Name '6  a prose function makes the pack optional' -File $PROSE `
  -From 'export function prizeRedistributionNote(terms: TerminologyPack): string {' `
  -To 'export function prizeRedistributionNote(terms?: TerminologyPack): string {' `
  -ExpectRed 'requires a TerminologyPack in every function that produces a sentence'

# 7. THE DEFAULTS IMPORTED BESIDE THE TYPE. The one-line change that makes every signature
#    assertion cosmetic - the parameter stays required and the body reads `TERMS` anyway, so
#    the screens render the platform's nouns while the types say the operator's reached them.
Invoke-Probe -Name '7  the prose module imports the defaults' -File $PROSE `
  -From 'import type { TerminologyPack } from "@/lib/constants/terminology";' `
  -To 'import { TERMS } from "@/lib/constants/terminology";
import type { TerminologyPack } from "@/lib/constants/terminology";' `
  -ExpectRed 'never imports the defaults, so it cannot answer without being asked'

# 8. THE ANALYTICS WRAPPER SWALLOWS THE PACK. It accepts one and calls the inner function
#    without it - which satisfies any check on its own signature while the analytics screen
#    renders the defaults. The wrapper is the shape that makes a threading bug invisible,
#    because the screen one layer up is demonstrably passing something.
Invoke-Probe -Name '8  the analytics wrapper drops the pack' -File $ANALYTICS `
  -From 'terms,' `
  -To '' `
  -ExpectRed 'threads the pack through the analytics wrapper rather than re-deriving' `
  -AllowRed 2

Write-Host "`n=== no renameable noun survives as a literal ===" -ForegroundColor Cyan

# 9. A CAPTION HARD-CODED BESIDE A CORRECT ONE. The load-bearing probe. Every positive
#    assertion in the suite stays green: the page still calls getTerms, still threads the
#    pack, still renders `terms.players` four other times. Only the scan can see this, and it
#    is precisely what happens when a new figure is added by copying the block above it.
Invoke-Probe -Name '9  a figure captioned with a literal noun' -File $DETAIL `
  -From '<p className="text-xs text-gray-500">{terms.players}</p>' `
  -To '<p className="text-xs text-gray-500">Participants</p>' `
  -ExpectRed 'has no Title Case noun as a JSX literal or a quoted caption'

# 10. THE CODEBASE'S OWN SYNONYM. `Contest` is not any token's default value - `contest`
#     defaults to "Competition" - so a guard built from values alone never looks for it, and
#     it is the spelling the services, the filenames and every docblock use. A2 shipped with a
#     live one of these for a day before the synonym list was added.
Invoke-Probe -Name '10 the synonym a value-built guard cannot see' -File $LIST `
  -From 'Create {terms.contest}' `
  -To 'Create Contest' `
  -ExpectRed 'has no Title Case noun as a JSX literal or a quoted caption'

# 11. TRADING VOCABULARY ON A SCREEN THAT SERVES EVERY GAME. There is no token for these and
#     there must not be - they are the words this pass exists to remove from the screen an
#     operator uses for a puzzle contest. The lowercase forms stay legal, because this module
#     names trading deliberately where trading is the subject.
Invoke-Probe -Name '11 a trading noun in a caption' -File $DETAIL `
  -From '{terms.prizePool}</p>' `
  -To 'Portfolio Pool</p>' `
  -ExpectRed 'has no trading vocabulary in a caption'

Write-Host "`n=== the never-rename list holds ===" -ForegroundColor Cyan

# 12. A ROUTE BUILT FROM A TOKEN. The other direction, and it fails harder than a wrong word:
#     `/competitions/new` is the URL in an operator's bookmark, so the moment they rename the
#     noun the button leads to a page that does not exist. The symptom is a blank screen with
#     nothing in a log naming the cause.
Invoke-Probe -Name '12 a route path built from a token' -File $LIST `
  -From '<Link href="/competitions/new">' `
  -To '<Link href={`/${terms.contests}/new`}>' `
  -ExpectRed 'links by route, never by a token'

# 13. A STORED STATUS COMPARED AGAINST A TOKEN. `active` is on the document and drives the
#     state machine. Compared against an operator's word it matches nothing, every contest
#     falls into the `default:` arm - which on this screen is the same grey a completed
#     contest uses - and no error is raised anywhere.
Invoke-Probe -Name '13 a stored status replaced by a token' -File $LIST `
  -From '"active"' `
  -To 'terms.contest' `
  -ExpectRed 'keeps the status values it switches on' `
  -AllowRed 2

Write-Host "`n=== the scan reaches what it claims to ===" -ForegroundColor Cyan

# 14. THE SURFACE LIST EMPTIED. The vacuity probe, and for a suite whose central claims are
#     all "no match was found" it is the one that keeps the rest honest: with nothing in the
#     list, the literal-noun and trading-word assertions both pass over zero files and report
#     two greens. A test that examines nothing passes everything asked of it.
Invoke-Probe -Name '14 the surface list emptied' -File $Suite `
  -From 'const SURFACE = [' `
  -To 'const SURFACE: string[] = []; const UNUSED_SURFACE = [' `
  -ExpectRed 'reads every file, and each one has content' `
  -AllowRed 4

Write-Host ""
if ($script:fail -eq 0) {
  Write-Host "all $($script:pass) probes red on the expected test" -ForegroundColor Green
} else {
  Write-Host "$($script:pass) red, $($script:fail) NOT red - read those above" -ForegroundColor Red
}

# TWO PROBES ARE DELIBERATELY ABSENT, with the reasons here rather than two more lines that
# report green and teach the next reader the guards are decoration.
#
# There is no probe for the "hands the pack to every presentation helper it calls" assertion.
# Removing `terms` from a call to `resolveNoWinnersNotice` is caught by probe 6's assertion as
# readily as by that one, because both read the same file region - and with the harness
# replacing only the FIRST match, a mutation aimed at the call site lands on the import list
# above it instead. The property it holds is real; the probe would be measuring the harness.
#
# There is no probe for the `Game Master` exemption either, and that one is a known shape
# rather than a gap: the exemption is what keeps the guard from firing on
# `competition.gameMasterName || "Game Master"`, which is CORRECT code. A probe would have to
# prove a bare "Game" caption is still caught, which is what probe 9 and 10 already do for the
# noun scan generally. Removing the exemption turns the suite red on a correct file - the
# failure mode of a guard that is deleted by the first person it inconveniences - so the
# tripwire is the assertion that the live file passes, not an injected defect.
