# Probe harness for X6.5 step A1's DELIVERY half - getting resolved tokens to a component.
#
# Same rules as tools/probe-terminology-tokens.ps1: one defect, one named expected test, and
# a green probe is a question with four known answers (weak test, wrong claim, unreachable
# guard, mutation with no observable). The harness rules in that file's header apply here too
# and are not repeated.
#
# ONE PROBE IS DELIBERATELY ABSENT and the reason is in place at the bottom of the file.

$ErrorActionPreference = 'Continue'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$Suite = '__tests__/admin/terminology-delivery.test.ts'
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
    [string]$ExpectRed
  )

  $path = Join-Path $root $File
  $pattern = Relaxed $From

  $original = [IO.File]::ReadAllText($path)
  if ([string]::IsNullOrEmpty($original)) {
    Write-Host "HARNESS BROKEN  $Name - read returned nothing for $File" -ForegroundColor Magenta
    $script:fail++
    return
  }
  if (-not [regex]::IsMatch($original, $pattern)) {
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

    $out = & cmd.exe /c "npx vitest run $Suite -t `"$ExpectRed`" --reporter=basic 2>&1" | Out-String
    $flat = ($out -replace '\s+', ' ')

    if ($flat -match 'Tests\s+(\d+)\s+failed') {
      $count = [int]$Matches[1]
      if ($count -eq 1) {
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

$LAYOUT = 'apps/admin/app/layout.tsx'
$CONTEXT = 'apps/admin/contexts/TerminologyContext.tsx'

Write-Host "`n=== the provider is mounted ===" -ForegroundColor Cyan

# 1. THE DEFECT THE WHOLE SUITE EXISTS FOR. This is `AppSettingsProvider`'s state exactly:
#    a context, a hook, nineteen callers and no mount. Every other test in the file is about
#    correctness given that tokens arrive.
Invoke-Probe -Name '1  the provider not mounted at all' -File $LAYOUT `
  -From '        <TerminologyProvider terms={terms}>{children}</TerminologyProvider>' `
  -To '        {children}' `
  -ExpectRed 'the admin root layout mounts TerminologyProvider'

# 2. MOUNTED AND DELIVERING NOTHING. A self-closing provider beside `{children}` renders
#    perfectly, satisfies any check that the provider is mentioned, and reaches no consumer -
#    the same defect as probe 1 with an extra step, and the one a reviewer waves through.
Invoke-Probe -Name '2  the provider rendered BESIDE children' -File $LAYOUT `
  -From '        <TerminologyProvider terms={terms}>{children}</TerminologyProvider>' `
  -To '        <TerminologyProvider terms={terms} />
        {children}' `
  -ExpectRed 'the provider WRAPS children rather than rendering beside them'

# 3. The stored override never read, so the pack is the defaults on every screen while the
#    settings form saves correctly. Aimed at the CALL, because `getTerms` survives on the
#    import line - an import is not a use.
Invoke-Probe -Name '3  getTerms named but not called' -File $LAYOUT `
  -From '  const terms = await getTerms();' -To '  const terms = { ...TERMS_DEFAULTS };' `
  -ExpectRed 'the layout resolves the pack server-side by CALLING getTerms'

# 4. STATIC RENDERING BAKING THE WORDS IN. `getTerms()` answers the defaults when the read
#    fails, so a build machine with no database freezes the default wording into a static
#    page - and a frozen word is indistinguishable from an override that did not save.
Invoke-Probe -Name '4  the static-rendering opt-out removed' -File $LAYOUT `
  -From '  noStore();' -To '' `
  -ExpectRed 'the layout opts out of static rendering'

# 5. A SECOND RESOLVER, IN THE BROWSER. Two resolvers is two answers, and the one that drifts
#    is the copy the operator is looking at.
Invoke-Probe -Name '5  the pack assembled in the browser' -File $CONTEXT `
  -From 'import type { TerminologyPack } from "@/lib/constants/terminology";' `
  -To 'import { resolveTerms, type TerminologyPack } from "@/lib/constants/terminology";

const BROWSER_PACK = resolveTerms(null);' `
  -ExpectRed 'the pack is never assembled in the browser'

Write-Host "`n=== an unmounted provider refuses ===" -ForegroundColor Cyan

# 6. THE REFUSAL MADE UNREACHABLE. Note this is the defect the structural form of the check
#    could not catch: the file still contains the throw, and it still reads correctly.
Invoke-Probe -Name '6  the refusal never fires' -File $CONTEXT `
  -From '  if (!terms) {' -To '  if (false) {' `
  -ExpectRed 'requireTerms throws when there is no provider'

# 7. A silent copy handed back instead of the pack, so a consumer holding a reference to the
#    provider's value and one from the hook are two different objects.
Invoke-Probe -Name '7  the pack copied rather than returned' -File $CONTEXT `
  -From '  return terms;
}' -To '  return { ...terms };
}' `
  -ExpectRed 'requireTerms returns the pack it was given, unchanged'

# 8. THE REFUSAL DUPLICATED INSTEAD OF SHARED - two places for one of them to be softened
#    into a default, which is the exact softening this file exists to refuse.
Invoke-Probe -Name '8  useTerms repeats the check instead of routing through it' -File $CONTEXT `
  -From '  return requireTerms(useContext(TerminologyContext));' `
  -To '  const terms = useContext(TerminologyContext);
  if (!terms) throw new Error("no TerminologyProvider");
  return terms;' `
  -ExpectRed 'useTerms routes through requireTerms rather than repeating the check'

Write-Host "`n=== the AppSettingsProvider canary ===" -ForegroundColor Cyan

# 9. THE EXCEPTION ASSERTING IT IS STILL AN OFFENDER. Injecting the FIX is what turns this
#    red, which is the point: it fires on the day the recorded defect is closed, so the
#    record cannot outlive the problem and be worked around by somebody who believes it.
Invoke-Probe -Name '9  AppSettingsProvider mounted - the canary must fire' -File $LAYOUT `
  -From '        <TerminologyProvider terms={terms}>{children}</TerminologyProvider>' `
  -To '        <AppSettingsProvider>
          <TerminologyProvider terms={terms}>{children}</TerminologyProvider>
        </AppSettingsProvider>' `
  -ExpectRed 'apps/admin still mounts no AppSettingsProvider'

Write-Host "`n=== the vitest alias tripwire ===" -ForegroundColor Cyan

# 10. THE ALIAS ORDERED BELOW THE CATCH-ALL. Vite tries aliases in order, so an entry under
#     `"@"` is silently dead - and dead in the way that reads as working, because the file
#     still contains a perfectly correct mapping. This is the config's own recorded rule
#     ("more specific entries must stay ABOVE `@`") and nothing but this held it.
Invoke-Probe -Name '10 the alias moved below the catch-all' -File 'vitest.config.ts' `
  -From '      "@/contexts/TerminologyContext": path.resolve(
        __dirname,
        "apps/admin/contexts/TerminologyContext.tsx",
      ),
      "@": path.resolve(__dirname, "."),' `
  -To '      "@": path.resolve(__dirname, "."),
      "@/contexts/TerminologyContext": path.resolve(
        __dirname,
        "apps/admin/contexts/TerminologyContext.tsx",
      ),' `
  -ExpectRed 'the alias entry sits above the catch-all, or it never fires'

# NO PROBE FOR 'has no main-app contexts/TerminologyContext competing for the alias', and the
# reason is recorded rather than the omission left to be noticed.
#
# The only mutation that turns it red is CREATING `contexts/TerminologyContext.tsx` at the
# repository root - a new file, which this harness cannot make and then reliably remove: every
# probe here restores exactly one file's original bytes in a `finally`, and a harness that
# creates a module instead would leave it behind on an interrupted run. That residue is worse
# than the missing probe, because a stray main-app context is precisely the condition the
# tripwire exists to report, so the next run would fire for a reason nobody caused.
#
# It is also the one assertion in this file that cannot silently stop working: it names two
# absolute paths and asserts `false`, with no slice, no regex and no identifier to drift.

# NO PROBE FOR 'exports the shapes a consumer needs', and the reason rather than the omission:
# the only mutation that turns it red is renaming or deleting an export, which stops the test
# file COMPILING. A probe whose defect is refused by the compiler is indistinguishable from a
# harness that did not apply, and the guard it would be aiming at is already carried by every
# other test in the file importing those names.

Write-Host ""
Write-Host "red: $($script:pass)   green or broken: $($script:fail)" -ForegroundColor Cyan
if ($script:fail -gt 0) { exit 1 }
