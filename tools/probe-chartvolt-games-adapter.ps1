# Probes for the ChartVolt Games adapter (X4a).
#
# Each probe injects one defect and asserts that a NAMED test goes red. A test that only ever
# passes proves nothing, and a probe that is not itself checked proves less than nothing - this
# repository has had four separate false probe results, so the harness below carries the fixes
# for all of them:
#
#   - UTF-8 WITHOUT A BOM on the read *and* the write. `Get-Content -Raw` decodes with the system
#     ANSI codepage on PowerShell 5.1, so every emoji in a touched file came back as mojibake and
#     was written back that way - probes passed and the file was quietly mangled.
#   - `-LiteralPath` on the READ as well as the write. A path containing `[roundId]` is parsed as
#     a wildcard character class, so the read matched nothing, returned $null, and the "restore"
#     wrote an empty file. Every probe went red on the expected test for entirely the wrong
#     reason, and the tell was the failure COUNT rather than the failure.
#   - REFUSE TO WRITE when the read came back empty, for the same reason.
#   - Judge a probe by running the EXPECTED TEST ALONE with `-t` and reading the summary counts.
#     Searching whole-suite output for the test's name reports RED beside "failed 0", because
#     vitest prints the name of a passing test just as readily.
#   - CONFIRM THE FILE ACTUALLY CHANGED. A pattern that fails to apply is indistinguishable from
#     a test that does not work.

$ErrorActionPreference = 'Continue'
$env:NODE_OPTIONS = ''

$Suite = '__tests__/services/chartvolt-games-adapter.test.ts'
$Utf8 = New-Object System.Text.UTF8Encoding($false)

$srcAdapter = 'lib/services/game-providers/adapters/chartvolt-games.adapter.ts'
$srcNormalise = 'lib/services/game-providers/adapters/chartvolt-games/normalise.ts'
$srcTransport = 'lib/services/game-providers/adapters/chartvolt-games/transport.ts'
$srcConnection = 'lib/services/game-providers/adapters/chartvolt-games/connection.ts'

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
$script:Red = 0

function Invoke-Probe {
  param(
    [string]$Name,
    [string]$File,
    [string]$Find,
    [string]$Replace,
    [string]$ExpectRed,
    [int]$MaxRed = 2
  )

  $original = Read-Source $File
  # Round-trip check before touching anything: if the encoding mangles the file, every result
  # after this point is about the mangling and not about the guard.
  if ($original.Length -eq 0) {
    Write-Host "  [HARNESS FAULT - EMPTY READ] $Name" -ForegroundColor Magenta
    $script:Red++
    return
  }

  $patched = [regex]::Replace($original, (Relax $Find), $Replace.Replace('$', '$$'), 1)
  if ($patched -eq $original) {
    Write-Host "  [PROBE DID NOT APPLY] $Name" -ForegroundColor Magenta
    $script:Red++
    return
  }

  Write-Source $File $patched
  try {
    # The expected test, alone. `-t` matches against the full name including the describe block.
    $solo = (& npx vitest run $Suite -t $ExpectRed --reporter=dot 2>&1) | Out-String
    $solo = $solo -replace '\s+', ' '

    $soloFailed = 0
    if ($solo -match 'Tests (\d+) failed') { $soloFailed = [int]$Matches[1] }
    $soloPassed = 0
    if ($solo -match '(\d+) passed') { $soloPassed = [int]$Matches[1] }

    if ($soloFailed -eq 0 -and $soloPassed -eq 0) {
      Write-Host "  [NO TEST MATCHED '$ExpectRed'] $Name" -ForegroundColor Magenta
      $script:Red++
      return
    }

    if ($soloFailed -eq 0) {
      Write-Host "  [STILL GREEN - THE GUARD IS NOT PINNED] $Name" -ForegroundColor Red
      $script:Red++
      return
    }

    # Blast radius. A one-line change that reddens the whole suite is not reporting on this guard.
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

Write-Host "`n=== the signed request ===" -ForegroundColor Cyan

# Serialising twice is THE way a signed integration fails.
#
# THE FIRST VERSION OF THIS PROBE STAYED GREEN, AND THE REASON IS WORTH KEEPING. It signed
# `JSON.stringify({ ...body })` instead of the string that was sent - a genuine second
# serialisation, and byte-for-byte IDENTICAL, because spreading a plain object preserves key
# order. So the probe injected something that was not a defect, and the test was right to pass.
#
# That is the third distinct cause of a green probe in this repository, after a weak test and a
# wrong claim: A PROBE THAT INJECTS A HARMLESS CHANGE. It also says something true about the bug
# class - no test can catch a double-serialisation whose two results agree, and they usually do
# agree in one runtime with one object. What actually protects this is the structure: `sign`
# returns the headers for a string the caller already holds, so signing something else takes
# deliberate effort. The probe below is the case that genuinely bites - a pretty-printed body,
# which is exactly what somebody adds while debugging and then signs by accident.
Invoke-Probe -Name 'the body is signed with a different serialisation from the one sent' `
  -File $srcTransport `
  -Find '  const headers = sign(connection, serialised);' `
  -Replace '  const headers = sign(connection, body === undefined ? "" : JSON.stringify(body, null, 2));' `
  -ExpectRed 'signs the exact bytes it sends' -MaxRed 3

Invoke-Probe -Name 'a GET is signed over "{}" instead of an empty string' `
  -File $srcTransport `
  -Find '  const serialised = body === undefined ? "" : JSON.stringify(body);' `
  -Replace '  const serialised = JSON.stringify(body ?? {});' `
  -ExpectRed 'signs a GET over an empty string' -MaxRed 3

Invoke-Probe -Name 'the round id is interpolated unencoded' `
  -File $srcAdapter `
  -Find '      path: `/v1/rounds/${encodeURIComponent(roundId)}`,' `
  -Replace '      path: `/v1/rounds/${roundId}`,' `
  -ExpectRed 'percent-encodes a round id'

Write-Host "`n=== error mapping ===" -ForegroundColor Cyan

Invoke-Probe -Name "the provider's own retryable flag is ignored" `
  -File $srcTransport `
  -Find '  if (typeof declared === "boolean") return declared;' `
  -Replace '  if (false) return declared as boolean;' `
  -ExpectRed 'own retryable flag as authoritative'

Invoke-Probe -Name 'an unenumerated 4xx becomes retryable' `
  -File $srcTransport `
  -Find '  if (status >= 500) return true;
  return false;' `
  -Replace '  if (status >= 500) return true;
  return status !== 401 && status !== 403 && status !== 404 && status !== 409 && status !== 422;' `
  -ExpectRed 'unenumerated 4xx as NOT retryable'

Invoke-Probe -Name 'a network failure throws instead of returning' `
  -File $srcTransport `
  -Find '    const timedOut = error instanceof Error && error.name === "AbortError";' `
  -Replace '    throw error;
    const timedOut = error instanceof Error && error.name === "AbortError";' `
  -ExpectRed 'unreachable provider as retryable'

Write-Host "`n=== the catalogue ===" -ForegroundColor Cyan

Invoke-Probe -Name 'an unusable title is defaulted instead of skipped' `
  -File $srcAdapter `
  -Find '  if (
    scoreDirection !== "higher_is_better" &&
    scoreDirection !== "lower_is_better"
  ) {
    return null;
  }' `
  -Replace '  const coerced = scoreDirection === "lower_is_better" ? "lower_is_better" : "higher_is_better";
  if (coerced === "never") {
    return null;
  }' `
  -ExpectRed 'skips an unusable title' -MaxRed 3

Invoke-Probe -Name 'an all-unusable catalogue is reported as an empty success' `
  -File $srcAdapter `
  -Find '    if (games.length === 0 && raw.length > 0) {' `
  -Replace '    if (false) {' `
  -ExpectRed 'EVERY title is unusable'

Invoke-Probe -Name 'an unknown catalogue status becomes active' `
  -File $srcAdapter `
  -Find '      "maintenance";' `
  -Replace '      "active";' `
  -ExpectRed 'unrecognised status as maintenance'

Invoke-Probe -Name 'a capability flag is read for truthiness' `
  -File $srcAdapter `
  -Find '  return value === true;' `
  -Replace '  return Boolean(value);' `
  -ExpectRed 'capability flag strictly'

Invoke-Probe -Name 'a missing games array is treated as an empty catalogue' `
  -File $srcAdapter `
  -Find '    if (!Array.isArray(raw)) {' `
  -Replace '    if (false) {' `
  -ExpectRed 'no games array' -MaxRed 3

Write-Host "`n=== reading a result ===" -ForegroundColor Cyan

Invoke-Probe -Name 'a live round is coerced to a terminal status' `
  -File $srcNormalise `
  -Find '  if (!TERMINAL_STATUSES.includes(status as ProviderRoundStatus)) {' `
  -Replace '  if (false) {' `
  -ExpectRed 'still in progress with a distinguishable code' -MaxRed 3

Invoke-Probe -Name 'the score direction is hard-coded upward' `
  -File $srcNormalise `
  -Find '    const known = TITLE_DIRECTIONS.get(gameCode);
    if (known) return known;' `
  -Replace '    const known = TITLE_DIRECTIONS.get(gameCode);
    if (known) return "higher_is_better";' `
  -ExpectRed 'direction from the game code, both ways'

Invoke-Probe -Name 'an unparseable date is passed through as an Invalid Date' `
  -File $srcNormalise `
  -Find '  return Number.isNaN(parsed.getTime()) ? undefined : parsed;' `
  -Replace '  return parsed;' `
  -ExpectRed 'unparseable date rather than storing'

Invoke-Probe -Name "the provider's echoed round id is trusted over our own" `
  -File $srcAdapter `
  -Find '      roundId: request.roundId,
      providerRoundId,
      launchUrl,' `
  -Replace '      roundId: text(response.data.roundId) ?? request.roundId,
      providerRoundId,
      launchUrl,' `
  -ExpectRed 'repoint our round id'

Invoke-Probe -Name 'a round with no launch URL is accepted' `
  -File $srcAdapter `
  -Find '    if (!launchUrl || !providerRoundId) {' `
  -Replace '    if (false) {' `
  -ExpectRed 'no launch URL'

Invoke-Probe -Name 'the callback uses a second parser of its own' `
  -File $srcAdapter `
  -Find '    return normaliseResultBody(payload);
  }
}' `
  -Replace '    const parsed = normaliseResultBody(payload);
    if (parsed.success) parsed.data.rawScore = Math.round(parsed.data.rawScore);
    if (parsed.success) delete parsed.data.breakdown;
    return parsed;
  }
}' `
  -ExpectRed 'identically through the callback and the fetch' -MaxRed 3

Write-Host "`n=== gate 5b, and the configuration refusals ===" -ForegroundColor Cyan

Invoke-Probe -Name 'verifyCallback becomes a formality' `
  -File $srcAdapter `
  -Find '    const map = normaliseHeaders(headers);' `
  -Replace '    return { valid: true };
    const map = normaliseHeaders(headers);' `
  -ExpectRed 'not a formality' -MaxRed 3

Invoke-Probe -Name 'the signature shape is not checked' `
  -File $srcAdapter `
  -Find '    if (!/^sha256=[0-9a-f]{64}$/i.test(signature)) {' `
  -Replace '    if (false) {' `
  -ExpectRed 'not a formality'

Invoke-Probe -Name 'the timestamp window is not applied' `
  -File $srcAdapter `
  -Find '    if (!timestamp.valid) {' `
  -Replace '    if (false) {' `
  -ExpectRed 'not a formality'

Invoke-Probe -Name 'headers are read case-sensitively' `
  -File $srcAdapter `
  -Find '    const map = normaliseHeaders(headers);' `
  -Replace '    const map = new Map(Object.entries(headers));' `
  -ExpectRed 'case-insensitively' -MaxRed 3

Invoke-Probe -Name 'a missing base URL and a missing secret share one message' `
  -File $srcConnection `
  -Find '      reason: `No base URL is configured for provider "${providerKey}".`,' `
  -Replace '      reason: `Provider "${providerKey}" is not configured.`,' `
  -ExpectRed 'base URL and the credentials separately' -MaxRed 3

Invoke-Probe -Name 'an unconfigured provider is called anyway' `
  -File $srcAdapter `
  -Find '    const connection = await loadConnection(this.providerKey);
    if (!connection.ok) {
      return { success: false, error: connection.reason, retryable: false };
    }

    const response = await call<{
      roundId?: unknown;' `
  -Replace '    const connection = await loadConnection(this.providerKey);
    if (!connection.ok) {
      connection.connection = { baseUrl: "http://unset", apiKey: "", apiSecret: "", environment: "sandbox" } as never;
    }

    const response = await call<{
      roundId?: unknown;' `
  -ExpectRed 'does not call the provider at all' -MaxRed 3

Invoke-Probe -Name 'a missing configuration invites a retry' `
  -File $srcAdapter `
  -Find '      return { success: false, error: connection.reason, retryable: false };
    }

    const response = await call<{ games?: unknown }>({' `
  -Replace '      return { success: false, error: connection.reason, retryable: true };
    }

    const response = await call<{ games?: unknown }>({' `
  -ExpectRed 'NOT retryable'

Write-Host ("`n=== {0} pinned, {1} needing attention ===`n" -f $script:Green, $script:Red) -ForegroundColor Cyan
