# Probes for the production base-URL rules in round-launch.service.ts.
#
# The guard is three claims - https, non-loopback, and NOT ENFORCED IN DEVELOPMENT - and the
# third is the one a probe is really for. A check that fired locally would be switched off
# rather than fixed, so the carve-out needs pinning as firmly as the refusals.
#
# Harness notes are in `tools/probe-callback-token.ps1` - UTF-8 without a BOM on read and write,
# refuse to write an empty file, judge by running the expected test ALONE with `-t`, and confirm
# the file actually changed before believing any outcome.

$ErrorActionPreference = 'Continue'
$env:NODE_OPTIONS = ''

$Suite = '__tests__/services/provider-round-launch.test.ts'
$Utf8 = New-Object System.Text.UTF8Encoding($false)

$src = 'lib/services/games/round-launch.service.ts'

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
    [string]$Find,
    [string]$Replace,
    [string]$ExpectRed,
    [int]$MaxRed = 2
  )

  $original = Read-Source $src
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

  Write-Source $src $patched
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
    Write-Source $src $original
  }
}

Write-Host "`n=== the two production refusals ===" -ForegroundColor Cyan

# The live defect, reintroduced. It is the state the deployment was actually in.
Invoke-Probe -Name 'plain http is accepted in production again' `
  -Find '  if (parsed.protocol !== "https:") return null;' `
  -Replace '' `
  -ExpectRed 'refuses plain http in production' `
  -MaxRed 1

# The plausible wrong fix: allow anything that parses. Reviews as "we check the URL now".
Invoke-Probe -Name 'the loopback check is dropped' `
  -Find '  if (LOOPBACK_HOSTS.has(parsed.hostname)) return null;' `
  -Replace '' `
  -ExpectRed 'refuses a loopback host in production' `
  -MaxRed 1

# Matching the host by suffix is the shape somebody reaches for, and it passes 127.example.com
# while ALSO failing to catch a bare `::1`. Only the exact-set test can tell them apart.
Invoke-Probe -Name 'loopback is matched by substring rather than exactly' `
  -Find '  if (LOOPBACK_HOSTS.has(parsed.hostname)) return null;' `
  -Replace '  if (parsed.hostname.includes("localhost")) return null;' `
  -ExpectRed 'refuses a loopback host in production' `
  -MaxRed 1

Write-Host "`n=== fail closed ===" -ForegroundColor Cyan

# Returning the raw value when `URL` throws hands the provider a callback that is not an
# address. The catch block reads like defensive noise until you see what it prevents.
Invoke-Probe -Name 'an unparseable value is passed through instead of refused' `
  -Find '    // Fails closed. A value the regex accepts but `URL` cannot parse is not one to hand a
    // provider as a callback address.
    return null;' `
  -Replace '    return trimmed;' `
  -ExpectRed 'fails closed on a value the protocol test accepts' `
  -MaxRed 1

Write-Host "`n=== the development carve-out, which is the point of the pair ===" -ForegroundColor Cyan

# THE PROBE THIS FILE EXISTS FOR. Enforcing everywhere looks strictly safer and breaks every
# local rehearsal, which is how a guard gets deleted rather than fixed.
Invoke-Probe -Name 'the guard is enforced in development too' `
  -Find '  if (process.env.NODE_ENV !== "production") return trimmed;' `
  -Replace '' `
  -ExpectRed 'still allows plain http on loopback in development' `
  -MaxRed 1

# The inverted condition: enforced ONLY in development. Passes the dev test's opposite and
# leaves production wide open - and reads almost identically.
#
# MaxRed is 4 rather than the usual 1 or 2, and the larger number is correct rather than
# tolerated: inverting the test breaks BOTH halves at once - three production assertions stop
# refusing and the development one starts - so a blast radius of 1 here would mean the two
# halves were not independent.
Invoke-Probe -Name 'the environment test is inverted' `
  -Find '  if (process.env.NODE_ENV !== "production") return trimmed;' `
  -Replace '  if (process.env.NODE_ENV === "production") return trimmed;' `
  -ExpectRed 'refuses plain http in production' `
  -MaxRed 4

Write-Host "`n=== the control must be able to fail ===" -ForegroundColor Cyan

# A guard that refuses everything satisfies both refusal tests. This proves the happy path is
# doing work rather than being carried by them.
Invoke-Probe -Name 'production refuses every base URL' `
  -Find '  if (parsed.protocol !== "https:") return null;' `
  -Replace '  if (parsed.protocol === "https:") return null;' `
  -ExpectRed 'accepts https on a real host in production' `
  -MaxRed 3

Write-Host ""
if ($script:Bad -gt 0) {
  Write-Host "$($script:Green) pinned, $($script:Bad) NOT PINNED - read the magenta and red lines above" -ForegroundColor Red
} else {
  Write-Host "All $($script:Green) probes red on the expected test." -ForegroundColor Green
}
