# Probes R74 - what a credit is worth, from one stored number.
#
# The platform stored the answer twice and the two defaults disagreed by a factor of a
# hundred. Every probe below restores one piece of that and must turn EXACTLY the named
# test red. Nothing here throws, nothing logs, and every figure reconciles against its own
# source - so a probe is the only thing that proves any of these guards work at all.
#
# Same harness as `probe-challenge-settlement.ps1` - see that file for why each defence
# exists (UTF-8 without a BOM on the read AND the write, a refusal to write when the read
# came back empty, `PROBE DID NOT APPLY` when the anchor has moved, the expected test run
# ALONE with `-t` and judged on the summary counts rather than on its name appearing in the
# output, and the whole suite re-run only to measure blast radius).

$ErrorActionPreference = 'Continue'
$env:NODE_OPTIONS = ''

$SUITE = '__tests__/services/credit-value.test.ts'
$Utf8NoBom = New-Object System.Text.UTF8Encoding($false)

function Relax([string]$literal) { [regex]::Escape($literal) -replace '\r?\n', '\r?\n' }

function Probe {
  param([string]$Name, [string]$File, [string]$Find, [string]$Replace, [string]$ExpectRed, [string]$Suite = $SUITE)

  $path = Join-Path (Get-Location) $File
  $original = [System.IO.File]::ReadAllText($path, $Utf8NoBom)

  if ([string]::IsNullOrEmpty($original)) {
    Write-Host "  [READ FAILED - REFUSING TO WRITE] $Name" -ForegroundColor Magenta
    return
  }

  $patched = [regex]::Replace($original, (Relax $Find), $Replace.Replace('$', '$$'), 1)
  if ($patched -eq $original) {
    Write-Host "  [PROBE DID NOT APPLY] $Name" -ForegroundColor Magenta
    return
  }

  [System.IO.File]::WriteAllText($path, $patched, $Utf8NoBom)
  try {
    $alone = npx vitest run $Suite -t $ExpectRed --reporter=dot 2>&1 | Out-String
    $aloneFailed = 0
    if ($alone -match 'Tests\s+(\d+)\s+failed') { $aloneFailed = [int]$Matches[1] }
    $ran = ($alone -match 'Tests\s+') -and ($alone -notmatch 'No test found')

    $whole = npx vitest run $Suite --reporter=dot 2>&1 | Out-String
    $wholeFailed = 0
    if ($whole -match 'Tests\s+(\d+)\s+failed') { $wholeFailed = [int]$Matches[1] }

    if (-not $ran) {
      Write-Host "  [EXPECTED TEST DID NOT RUN - wrong name or wrong suite] $Name" -ForegroundColor Magenta
    } elseif ($aloneFailed -gt 0) {
      Write-Host ("  [RED: expected test failed, {0} red in suite] {1}" -f $wholeFailed, $Name) -ForegroundColor Green
    } else {
      Write-Host ("  [STILL GREEN - GUARD IS NOT WORKING, {0} red in suite] {1}" -f $wholeFailed, $Name) -ForegroundColor Red
    }
  } finally {
    [System.IO.File]::WriteAllText($path, $original, $Utf8NoBom)
    if ([System.IO.File]::ReadAllText($path, $Utf8NoBom) -ne $original) {
      Write-Host "  !! RESTORE FAILED for $File - check git diff" -ForegroundColor Red
    }
  }
}

$RESOLVER = 'lib/utils/credit-value.ts'
$PLAYER_SETTINGS = 'app/api/settings/route.ts'
$ADMIN_SETTINGS = 'apps/admin/app/api/settings/route.ts'
$HELP = 'app/api/help-settings/route.ts'
$CURRENCY = 'apps/admin/components/admin/CurrencySettingsSection.tsx'

Write-Host "`n=== the resolver ===" -ForegroundColor Cyan

# `|| DEFAULT` is the one-character version of this function and it is wrong in the one
# direction nobody checks: a NEGATIVE rate is neither falsy nor usable, and it flips the
# sign of every conversion on the platform while every screen keeps rendering.
Probe -Name 'the rate guard becomes a truthiness check, admitting a negative rate' `
  -File $RESOLVER `
  -Find 'if (!Number.isFinite(rate) || rate <= 0) return DEFAULT_EUR_TO_CREDITS_RATE;' `
  -Replace 'if (!rate) return DEFAULT_EUR_TO_CREDITS_RATE;' `
  -ExpectRed 'falls back to the default when the stored rate is negative'

# The whole defect in one character. Multiplying by the rate rather than dividing gives
# 1,000 credits = EUR 100,000 - obviously absurd, and still nothing throws.
Probe -Name 'the derived value multiplies by the rate instead of dividing' `
  -File $RESOLVER `
  -Find 'return 1 / resolveEurToCreditsRate(storedRate);' `
  -Replace 'return resolveEurToCreditsRate(storedRate);' `
  -ExpectRed 'agrees with dividing by the rate'

# The historical default put back on the fallback constant. This is the exact number that
# was live: it makes the fallback quote EUR 1 per credit again.
Probe -Name 'the fallback constant goes back to the historical 1 credit = EUR 1' `
  -File $RESOLVER `
  -Find 'export const DEFAULT_CREDIT_VALUE_IN_BASE_CURRENCY = creditValueInBaseCurrency(
  DEFAULT_EUR_TO_CREDITS_RATE,
);' `
  -Replace 'export const DEFAULT_CREDIT_VALUE_IN_BASE_CURRENCY = 1;' `
  -ExpectRed 'exports a default fallback equal to'

Write-Host "`n=== the mirror ===" -ForegroundColor Cyan

# `check:mirrors` compares MODELS and has never had an opinion about a utility module, so
# this text comparison is the entire guarantee that the two copies agree.
Probe -Name 'the admin copy of the resolver drifts by one character' `
  -File 'apps/admin/lib/utils/credit-value.ts' `
  -Find 'export const DEFAULT_EUR_TO_CREDITS_RATE = 100;' `
  -Replace 'export const DEFAULT_EUR_TO_CREDITS_RATE = 1000;' `
  -ExpectRed 'is byte-identical in both apps'

Write-Host "`n=== the settings routes, which reach every client conversion ===" -ForegroundColor Cyan

# The defect exactly as it stood: serve the stored field. Every client conversion is built
# from what this route returns, so this one line is worth a hundredfold on every screen.
Probe -Name 'the player route serves the stored valueInEUR again' `
  -File $PLAYER_SETTINGS `
  -Find '        valueInEUR: derivedCreditValue,' `
  -Replace '        valueInEUR: JSON.parse(JSON.stringify(settings)).credits.valueInEUR,' `
  -ExpectRed 'the player app overrides the stored field rather than reading it'

Probe -Name 'the admin route serves the stored valueInEUR again' `
  -File $ADMIN_SETTINGS `
  -Find '          valueInEUR: creditValueInBaseCurrency(' `
  -Replace '          valueInEUR: serialised.credits.valueInEUR, unused: creditValueInBaseCurrency(' `
  -ExpectRed 'the admin app overrides the stored field rather than reading it'

# The subtler half: keep the imports, stop consulting the rate. This is what defeats a bare
# name check, because both identifiers are still on the import line - so the assertion has
# to match the CALL with its argument, and this probe is what proves it does.
Probe -Name 'the player route keeps the imports and stops consulting the rate' `
  -File $PLAYER_SETTINGS `
  -Find 'const conversionSettings = await CreditConversionSettings.getSingleton();
    const derivedCreditValue = creditValueInBaseCurrency(
      conversionSettings?.eurToCreditsRate,
    );' `
  -Replace 'const derivedCreditValue = 1;' `
  -ExpectRed 'the player app derives valueInEUR from the rate'

# The PUT writing the field is how the fix un-does itself: an operator saving any unrelated
# currency setting persists the derived value into the collection that must not hold it, and
# a stored 0.01 is then indistinguishable from one somebody typed.
Probe -Name 'the admin PUT writes valueInEUR back to AppSettings' `
  -File $ADMIN_SETTINGS `
  -Find 'const { valueInEUR: _derived, ...creditsUpdate } = updateData.credits;
      settings.credits = { ...settings.credits, ...creditsUpdate };' `
  -Replace 'settings.credits = { ...settings.credits, ...updateData.credits };' `
  -ExpectRed 'the admin PUT refuses to write valueInEUR'

Write-Host "`n=== the help page, which renders both figures side by side ===" -ForegroundColor Cyan

# The clearest statement of the defect: two contradictory answers to one question, on one
# screen, each correct against the model it came from.
Probe -Name 'the help page serves the stored value beside the rate again' `
  -File $HELP `
  -Find 'valueInEUR: creditValueInBaseCurrency(creditSettings.eurToCreditsRate),' `
  -Replace 'valueInEUR: (appSettings as any)?.credits?.valueInEUR ?? 1,' `
  -ExpectRed 'derives both figures from the one rate'

Probe -Name 'the help page stops narrowing the rate it publishes' `
  -File $HELP `
  -Find 'eurToCreditsRate: resolveEurToCreditsRate(
          creditSettings.eurToCreditsRate,
        ),' `
  -Replace 'eurToCreditsRate: creditSettings.eurToCreditsRate,' `
  -ExpectRed 'derives both figures from the one rate'

Write-Host "`n=== the client fallbacks ===" -ForegroundColor Cyan

# A fallback is a stored value as far as the player reading it is concerned. Each of these
# used to be a hard-coded 1, so a slow or failed settings fetch put the old figure back on
# screen - briefly, silently, and on the one screen where it matters most.
Probe -Name 'the player context falls back to 1 credit = EUR 1 again' `
  -File 'contexts/AppSettingsContext.tsx' `
  -Find '    valueInEUR: DEFAULT_CREDIT_VALUE_IN_BASE_CURRENCY,' `
  -Replace '    valueInEUR: 1.0,' `
  -ExpectRed 'the player context falls back to the derived default'

Probe -Name 'the admin context falls back to 1 credit = EUR 1 again' `
  -File 'apps/admin/contexts/AppSettingsContext.tsx' `
  -Find '    valueInEUR: DEFAULT_CREDIT_VALUE_IN_BASE_CURRENCY,' `
  -Replace '    valueInEUR: 1.0,' `
  -ExpectRed 'the admin context falls back to the derived default'

# `|| 1` rather than `?? DEFAULT` - the original spelling, on the balance a player checks.
Probe -Name 'the wallet balance restores its || 1 fallback' `
  -File 'components/trading/WalletBalanceDisplay.tsx' `
  -Find '(settings?.credits.valueInEUR ??
                DEFAULT_CREDIT_VALUE_IN_BASE_CURRENCY)' `
  -Replace '(settings?.credits.valueInEUR || 1)' `
  -ExpectRed 'the wallet balance falls back to the derived default'

Probe -Name 'the help page fallback contradicts its own rate again' `
  -File 'app/(root)/help/page-content.tsx' `
  -Find '    valueInEUR: DEFAULT_CREDIT_VALUE_IN_BASE_CURRENCY,' `
  -Replace '    valueInEUR: 1,' `
  -ExpectRed 'the help page falls back to the derived default'

Write-Host "`n=== the admin currency screen ===" -ForegroundColor Cyan

# An editable control here is a second stored number by another name. Restoring it means the
# whole fix holds only until the next operator saves this screen.
Probe -Name 'the currency screen offers an editable valueInEUR input again' `
  -File $CURRENCY `
  -Find '        <div className="mt-2 rounded-md border border-gray-600 bg-gray-800 px-3 py-2 text-gray-100">' `
  -Replace '        <Input
          type="number"
          step="0.0001"
          value={settings.credits.valueInEUR}
          onChange={(e) =>
            setSettings({
              ...settings,
              credits: {
                ...settings.credits,
                valueInEUR: parseFloat(e.target.value),
              },
            })
          }
        />
        <div className="mt-2 rounded-md border border-gray-600 bg-gray-800 px-3 py-2 text-gray-100">' `
  -ExpectRed 'does not render an input bound to valueInEUR'

# Withholding a control without saying where the value went teaches an operator the setting
# no longer exists - and they go looking for it, or ask for it back.
Probe -Name 'the currency screen stops naming the screen that owns the rate' `
  -File $CURRENCY `
  -Find 'Credit Conversion</strong>' `
  -Replace 'the other settings screen</strong>' `
  -ExpectRed 'points the operator at the rate instead'

Write-Host ""
