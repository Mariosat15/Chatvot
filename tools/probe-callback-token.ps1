# Probes for R34 - the callback token the platform promised providers and could not store.
#
# Each probe injects one defect and asserts that a NAMED test goes red. A test that only ever
# passes proves nothing, and a probe that is not itself checked proves less than nothing - this
# repository has had five separate false probe results, so the harness below carries the fixes
# for all of them. See `tools/probe-chartvolt-games-adapter.ps1` for the full list; the short
# version is: UTF-8 without a BOM on read and write, `-LiteralPath` on both, refuse to write an
# empty file, judge by running the expected test ALONE with `-t` and reading the counts, and
# confirm the file actually changed before believing any outcome.
#
# TWO SUITES ARE INVOLVED, so every probe names its own. The platform half lives in
# `provider-callback-token.test.ts` and the admin half in `game-providers-admin.test.ts`, and a
# probe aimed at the wrong suite reports "NO TEST MATCHED" rather than passing quietly.

$ErrorActionPreference = 'Continue'
$env:NODE_OPTIONS = ''

$SuitePlatform = '__tests__/services/provider-callback-token.test.ts'
$SuiteAdmin = '__tests__/admin/game-providers-admin.test.ts'
$Utf8 = New-Object System.Text.UTF8Encoding($false)

$srcLoader = 'lib/services/games/callback-verification.ts'
$srcGate = 'lib/services/games/result-ingestion.service.ts'
$srcModel = 'database/models/whitelabel.model.ts'
$srcAdminService = 'apps/admin/lib/services/game-providers/provider-admin.service.ts'
$srcAdminRoute = 'apps/admin/app/api/games/providers/[providerKey]/credentials/route.ts'
$srcTypes = 'apps/admin/components/admin/games/provider-types.ts'

function Relax([string]$literal) { [regex]::Escape($literal) -replace '\\r\\n|\\n', '\r?\n' }

function Read-Source([string]$Path) {
  $full = Join-Path (Get-Location) $Path
  return [System.IO.File]::ReadAllText($full, $Utf8)
}

function Write-Source([string]$Path, [string]$Text) {
  if ([string]::IsNullOrEmpty($Text)) { throw "refusing to write an empty file to $Path" }
  $full = Join-Path (Get-Location) $Path
  [System.IO.File]::WriteAllText($full, $Text, $Utf8)
}

$script:Green = 0
$script:Bad = 0

function Invoke-Probe {
  param(
    [string]$Name,
    [string]$File,
    [string]$Suite,
    [string]$Find,
    [string]$Replace,
    [string]$ExpectRed,
    [int]$MaxRed = 2
  )

  $original = Read-Source $File
  if ($original.Length -eq 0) {
    Write-Host "  [HARNESS FAULT - EMPTY READ] $Name" -ForegroundColor Magenta
    $script:Bad++
    return
  }

  $patched = [regex]::Replace($original, (Relax $Find), $Replace.Replace('$', '$$'), 1)
  if ($patched -eq $original) {
    Write-Host "  [PROBE DID NOT APPLY] $Name" -ForegroundColor Magenta
    $script:Bad++
    return
  }

  Write-Source $File $patched
  try {
    $solo = (& npx vitest run $Suite -t $ExpectRed --reporter=dot 2>&1) | Out-String
    $solo = $solo -replace '\s+', ' '

    $soloFailed = 0
    if ($solo -match 'Tests (\d+) failed') { $soloFailed = [int]$Matches[1] }
    $soloPassed = 0
    if ($solo -match '(\d+) passed') { $soloPassed = [int]$Matches[1] }

    if ($soloFailed -eq 0 -and $soloPassed -eq 0) {
      Write-Host "  [NO TEST MATCHED '$ExpectRed'] $Name" -ForegroundColor Magenta
      $script:Bad++
      return
    }

    if ($soloFailed -eq 0) {
      Write-Host "  [STILL GREEN - THE GUARD IS NOT PINNED] $Name" -ForegroundColor Red
      $script:Bad++
      return
    }

    $all = (& npx vitest run $Suite --reporter=dot 2>&1) | Out-String
    $all = $all -replace '\s+', ' '
    $allFailed = 0
    if ($all -match 'Tests (\d+) failed') { $allFailed = [int]$Matches[1] }

    if ($allFailed -gt $MaxRed) {
      Write-Host ("  [RED* {0} of suite failed, expected <= {1}] {2}" -f $allFailed, $MaxRed, $Name) -ForegroundColor Yellow
    } else {
      Write-Host ("  [RED {0}] {1}" -f $allFailed, $Name) -ForegroundColor Green
    }
    $script:Green++
  } finally {
    Write-Source $File $original
  }
}

Write-Host "`n=== which field becomes the bearer token ===" -ForegroundColor Cyan

# THE DEFECT ITSELF, PUT BACK. This is the line R34 was.
Invoke-Probe -Name 'the loader reverts to the API key the provider issued us' `
  -File $srcLoader -Suite $SuitePlatform `
  -Find '  const callbackToken = credentials?.callbackToken || credentials?.apiKey;' `
  -Replace '  const callbackToken = credentials?.apiKey;' `
  -ExpectRed 'prefers the callback token WE issue' -MaxRed 3

# `??` looks equivalent and differs on exactly one input: a stored empty string.
Invoke-Probe -Name 'the loader uses ?? so a blank token is offered to gate 3' `
  -File $srcLoader -Suite $SuitePlatform `
  -Find '  const callbackToken = credentials?.callbackToken || credentials?.apiKey;' `
  -Replace '  const callbackToken = credentials?.callbackToken ?? credentials?.apiKey;' `
  -ExpectRed 'treats a blank stored token as absent'

# The compatibility path, removed. A provider configured before R34 stops authenticating.
Invoke-Probe -Name 'the loader drops the backward-compatible fallback' `
  -File $srcLoader -Suite $SuitePlatform `
  -Find '  const callbackToken = credentials?.callbackToken || credentials?.apiKey;' `
  -Replace '  const callbackToken = credentials?.callbackToken;' `
  -ExpectRed 'falls back to the API key'

# The source discriminator is what lets a test prove the PRECEDENCE rather than the outcome.
# MaxRed is 3 because all three source assertions legitimately fail together - a wide blast
# radius here is the guard working, not the harness damaging the file.
Invoke-Probe -Name 'the token source is always reported as the new field' `
  -File $srcLoader -Suite $SuitePlatform `
  -Find '    callbackTokenSource: credentials?.callbackToken' `
  -Replace '    callbackTokenSource: (true as boolean)' `
  -ExpectRed 'falls back to the API key' -MaxRed 3

Write-Host "`n=== the schema, not just the type ===" -ForegroundColor Cyan

# A DECLARED TYPE IS NOT A STORED FIELD. Removing the schema path leaves the TypeScript
# interface intact, so nothing fails to compile - Mongoose strict mode simply discards the value
# on write and every read returns undefined. That is the mirror-drift failure mode, and it is why
# this probe exists separately from the loader ones.
Invoke-Probe -Name 'the schema drops the field so strict mode discards every write' `
  -File $srcModel -Suite $SuitePlatform `
  -Find "          callbackToken: { type: String }," `
  -Replace '' `
  -ExpectRed 'prefers the callback token WE issue' -MaxRed 4

Write-Host "`n=== gate 3 ===" -ForegroundColor Cyan

# Accepting BOTH credentials would look like a generous fix and would mean rotating the real
# token never revokes anything.
Invoke-Probe -Name 'gate 3 accepts the API key as well as the callback token' `
  -File $srcGate -Suite $SuitePlatform `
  -Find '  if (!secrets.callbackToken || !safeEqual(offeredToken, secrets.callbackToken)) {' `
  -Replace '  if (!secrets.callbackToken || (!safeEqual(offeredToken, secrets.callbackToken) && !safeEqual(offeredToken, "the-key-THEY-issued-us"))) {' `
  -ExpectRed 'refuses the provider''s own API key'

# The `safeEqual("", "")` trap: two empty strings compare EQUAL, so dropping the presence check
# authenticates a request that carries no Authorization header at all.
Invoke-Probe -Name 'gate 3 stops checking that a token is configured at all' `
  -File $srcGate -Suite $SuitePlatform `
  -Find '  if (!secrets.callbackToken || !safeEqual(offeredToken, secrets.callbackToken)) {' `
  -Replace '  if (!safeEqual(offeredToken, secrets.callbackToken ?? "")) {' `
  -ExpectRed 'refuses an empty bearer token'

Write-Host "`n=== the admin screen ===" -ForegroundColor Cyan

# The enable gate. Without it the switch turns on into a configuration where every result is
# refused at gate 3 and logged as a suspected attack.
Invoke-Probe -Name 'a provider can be enabled with no callback token' `
  -File $srcAdminService -Suite $SuiteAdmin `
  -Find '    if (!credential.callbackToken) {' `
  -Replace '    if (false) {' `
  -ExpectRed 'refuses when no callback token is stored'

# Accepting the fallback here would let every new integration keep relying on a transitional path.
Invoke-Probe -Name 'the enable gate accepts the API key fallback' `
  -File $srcAdminService -Suite $SuiteAdmin `
  -Find '    if (!credential.callbackToken) {' `
  -Replace '    if (!credential.callbackToken && !credential.apiKey) {' `
  -ExpectRed 'refuses when no callback token is stored'

# Not persisting it: the dialog sends the value, the operator sees a success toast, and the badge
# still reads "not set".
Invoke-Probe -Name 'saveCredentials never stores the token' `
  -File $srcAdminService -Suite $SuiteAdmin `
  -Find '    callbackToken: firstNonBlank(input.callbackToken, existing?.callbackToken),' `
  -Replace '' `
  -ExpectRed 'returns presence booleans' -MaxRed 4

# Blank must mean KEEP. If it meant clear, an operator changing only the environment would
# silently break every inbound callback.
Invoke-Probe -Name 'a blank token overwrites the stored one' `
  -File $srcAdminService -Suite $SuiteAdmin `
  -Find '    callbackToken: firstNonBlank(input.callbackToken, existing?.callbackToken),' `
  -Replace '    callbackToken: input.callbackToken,' `
  -ExpectRed 'keeps the stored value when a field is submitted blank'

# A presence badge that is hardcoded is worse than absent: it tells an operator the token is
# stored when it is not, and the failure then looks like the provider's fault.
#
# AIMED AT THE ABSENCE TEST, DELIBERATELY. The first version pointed at "returns presence
# booleans" and stayed GREEN, because that test stores every credential - so `true` and
# `Boolean(credential.callbackToken)` agree and the fixture cannot tell the branches apart. The
# test asserting a MISSING credential reads false was written because of this probe.
Invoke-Probe -Name 'the presence badge is hardcoded true' `
  -File $srcAdminService -Suite $SuiteAdmin `
  -Find '            hasCallbackToken: Boolean(credential.callbackToken),' `
  -Replace '            hasCallbackToken: true,' `
  -ExpectRed 'reports a missing credential as absent'

# The route seam. Both halves pass their own tests while the value is dropped between them.
Invoke-Probe -Name 'the route drops the token between the dialog and the service' `
  -File $srcAdminRoute -Suite $SuiteAdmin `
  -Find '      callbackToken: body.callbackToken,' `
  -Replace '' `
  -ExpectRed 'forwards the callback token'

# The client type must carry a boolean, never a value - a string field invites a component to
# render it, and it would be `undefined` in every environment anyone checked.
Invoke-Probe -Name 'the client type carries the value instead of a boolean' `
  -File $srcTypes -Suite $SuiteAdmin `
  -Find '  hasCallbackToken: boolean;' `
  -Replace '  callbackToken?: string;' `
  -ExpectRed 'never pre-fills a secret field'

Write-Host ""
Write-Host ("{0} red, {1} NOT PROVING ANYTHING" -f $script:Green, $script:Bad) -ForegroundColor Cyan
if ($script:Bad -gt 0) { exit 1 }
