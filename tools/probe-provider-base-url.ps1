# Probes for the provider base-URL rule: https everywhere, http on loopback only.
#
# The guard is a pair of claims and each needs its own probe, because the plausible wrong fix
# satisfies one of them. "Allow http on localhost" and "allow http" both make the rehearsal
# work; only the first is safe, and only a separate private-range test can tell them apart.
#
# Harness notes are in `tools/probe-callback-token.ps1` - UTF-8 without a BOM on read and
# write, refuse to write an empty file, judge by running the expected test ALONE with `-t`,
# and confirm the file actually changed before believing any outcome.

$ErrorActionPreference = 'Continue'
$env:NODE_OPTIONS = ''

$Suite = '__tests__/admin/game-providers-admin.test.ts'
$Utf8 = New-Object System.Text.UTF8Encoding($false)

$srcService = 'apps/admin/lib/services/game-providers/provider-admin.service.ts'
$srcDialog = 'apps/admin/components/admin/games/ProviderRegisterDialog.tsx'

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

Write-Host "`n=== the carve-out is loopback and nothing wider ===" -ForegroundColor Cyan

# THE PLAUSIBLE WRONG FIX. It makes the rehearsal work, reviews as "we allow http now", and
# puts a live provider's API key on the wire. This is the probe the pair exists for.
Invoke-Probe -Name 'the check accepts any http host, not just loopback' `
  -File $srcService `
  -Find '  if (parsed.protocol !== "http:") return false;' `
  -Replace '  if (parsed.protocol === "http:") return true;' `
  -ExpectRed 'refuses http on a private network address'

# The same fix spelled as a wider host test. `endsWith` is the shape somebody reaches for.
Invoke-Probe -Name 'loopback is matched by suffix, so 127.example.com passes' `
  -File $srcService `
  -Find '  return LOOPBACK_HOSTS.has(host) || /^127\.\d+\.\d+\.\d+$/.test(host);' `
  -Replace '  return host.includes("127.") || host.includes("localhost");' `
  -ExpectRed 'refuses http on a private network address'

# The private ranges added "for consistency", which is the argument the comment warns about.
Invoke-Probe -Name 'the private ranges are treated as loopback' `
  -File $srcService `
  -Find '  return LOOPBACK_HOSTS.has(host) || /^127\.\d+\.\d+\.\d+$/.test(host);' `
  -Replace '  return LOOPBACK_HOSTS.has(host) || /^(127|10|192\.168|172)\./.test(host);' `
  -ExpectRed 'refuses http on a private network address'

Write-Host "`n=== the carve-out actually exists ===" -ForegroundColor Cyan

# The rule as it was before 6 Sep 2026. Registering a provider on this machine is impossible,
# which is what blocked the whole end-to-end rehearsal.
Invoke-Probe -Name 'the rule reverts to https-only' `
  -File $srcService `
  -Find '  if (parsed.protocol === "https:") return true;
  if (parsed.protocol !== "http:") return false;' `
  -Replace '  return parsed.protocol === "https:";
  if (parsed.protocol !== "http:") return false;' `
  -ExpectRed 'accepts http on a loopback host' -MaxRed 3

Write-Host "`n=== the protocol still has to be http ===" -ForegroundColor Cyan

# Localhost is not a trusted host, it is a host with no network hop. A `file:` URL is neither
# a provider API nor something transport.ts can call.
Invoke-Probe -Name 'any protocol is accepted on a loopback host' `
  -File $srcService `
  -Find '  if (parsed.protocol !== "http:") return false;' `
  -Replace '  if (false) return false;' `
  -ExpectRed 'refuses a non-http protocol on a loopback host'

Write-Host "`n=== one rule, one message ===" -ForegroundColor Cyan

# Register and update are two call sites. A second copy of the message is the shape behind
# four defects in this codebase, and the drift is invisible until an operator reads one.
Invoke-Probe -Name 'update carries its own copy of the error message' `
  -File $srcService `
  -Find '  if (input.baseUrl !== undefined && !isAcceptableProviderUrl(input.baseUrl)) {
    return { success: false, error: PROVIDER_URL_ERROR };' `
  -Replace '  if (input.baseUrl !== undefined && !isAcceptableProviderUrl(input.baseUrl)) {
    return { success: false, error: "The base URL must be a valid https:// URL." };' `
  -ExpectRed 'applies the same URL rule when the base URL is edited'

# Update skipping the check entirely: register is guarded, edit is not. The half-guarded file
# is exactly what the credentials-route lesson said to count handlers for.
Invoke-Probe -Name 'the edit path stops checking the URL at all' `
  -File $srcService `
  -Find '  if (input.baseUrl !== undefined && !isAcceptableProviderUrl(input.baseUrl)) {' `
  -Replace '  if (false) {' `
  -ExpectRed 'applies the same URL rule when the base URL is edited'

Write-Host ""
if ($script:Bad -gt 0) {
  Write-Host ("$($script:Green) probes red, $($script:Bad) NOT PINNED OR HARNESS FAULT") -ForegroundColor Red
  exit 1
}
Write-Host ("All $($script:Green) probes went red on the expected test.") -ForegroundColor Green
