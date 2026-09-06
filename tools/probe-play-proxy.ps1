# Probes for the rewrites that put the game's play surface on the platform's origin.
#
# Every guard here defends against the same production symptom: a blank frame in the player's
# browser with nothing in any server log. That is precisely the class of failure a test can catch
# cheaply and a build cannot catch at all, so each rule needs its own probe.
#
# Harness notes are in `tools/probe-callback-token.ps1` - UTF-8 without a BOM on read and write,
# refuse to write an empty file, judge by running the expected test ALONE with `-t`, and confirm
# the file actually changed before believing any outcome.

$ErrorActionPreference = 'Continue'
$env:NODE_OPTIONS = ''

$Suite = '__tests__/services/games-play-proxy.test.ts'
$Utf8 = New-Object System.Text.UTF8Encoding($false)

$src = 'next.config.ts'

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

Write-Host "`n=== the page is mounted where the service's own HTML expects it ===" -ForegroundColor Cyan

# The tidy-looking rename. It reviews as a namespacing improvement and serves a working HTML
# document whose stylesheet and script both 404 - a blank white frame, no server-side error.
Invoke-Probe -Name 'the play page is moved off /play' `
  -Find '{ source: "/play", destination: `${GAMES_UPSTREAM}/play` },' `
  -Replace '{ source: "/games-provider", destination: `${GAMES_UPSTREAM}/play` },' `
  -ExpectRed 'serves the play page at /play' `
  -MaxRed 1

# Without the wildcard the board renders and then cannot fetch its state or submit a solution.
Invoke-Probe -Name 'the wildcard covering the assets and /play/api/* is dropped' `
  -Find '    { source: "/play/:path*", destination: `${GAMES_UPSTREAM}/play/:path*` },' `
  -Replace '' `
  -ExpectRed 'covers the assets and the four' `
  -MaxRed 3

Write-Host "`n=== order is behaviour, not presentation ===" -ForegroundColor Cyan

# THE PROBE THIS SUITE EXISTS FOR. Grouping the two /play rules together looks like tidying and
# leaves every rule present and individually correct, while the wildcard swallows every
# thumbnail request and forwards it to a path the service does not serve.
Invoke-Probe -Name 'the artwork rule is moved below the /play wildcard' `
  -Find @'
    // Catalogue artwork: /play/assets/<gameCode>/<file> -> <service>/assets/<gameCode>/<file>
    {
      source: "/play/assets/:gameCode/:asset",
      destination: `${GAMES_UPSTREAM}/assets/:gameCode/:asset`,
    },
    // The play page itself, which the launch URL points at.
    { source: "/play", destination: `${GAMES_UPSTREAM}/play` },
    // Its stylesheet, its two scripts, and the four /play/api/* calls the board makes.
    { source: "/play/:path*", destination: `${GAMES_UPSTREAM}/play/:path*` },
'@ `
  -Replace @'
    { source: "/play", destination: `${GAMES_UPSTREAM}/play` },
    { source: "/play/:path*", destination: `${GAMES_UPSTREAM}/play/:path*` },
    {
      source: "/play/assets/:gameCode/:asset",
      destination: `${GAMES_UPSTREAM}/assets/:gameCode/:asset`,
    },
'@ `
  -ExpectRed 'matches artwork BEFORE' `
  -MaxRed 1

Write-Host "`n=== the /assets collision with the platform's own public folder ===" -ForegroundColor Cyan

# The obvious mount, and the one that half-works: shadowed by public/assets for any file that
# exists, shadowing the game for any that does not.
Invoke-Probe -Name 'artwork claims the bare /assets prefix' `
  -Find '      source: "/play/assets/:gameCode/:asset",' `
  -Replace '      source: "/assets/:gameCode/:asset",' `
  -ExpectRed 'never claims the bare /assets prefix' `
  -MaxRed 3

# The prefix exists only to dodge public/assets; the service knows nothing about it. Forwarding
# it unchanged asks the service for a path it does not serve.
Invoke-Probe -Name 'the /play prefix is forwarded to the service unchanged' `
  -Find '      destination: `${GAMES_UPSTREAM}/assets/:gameCode/:asset`,' `
  -Replace '      destination: `${GAMES_UPSTREAM}/play/assets/:gameCode/:asset`,' `
  -ExpectRed 'strips the /play prefix off artwork' `
  -MaxRed 1

Write-Host "`n=== the upstream is one value, on the loopback interface ===" -ForegroundColor Cyan

# Three rules with two ports: the page loads from a live service and its scripts from a dead one.
Invoke-Probe -Name 'one rule points at a different port' `
  -Find '    { source: "/play", destination: `${GAMES_UPSTREAM}/play` },' `
  -Replace '    { source: "/play", destination: "http://127.0.0.1:4011/play" },' `
  -ExpectRed 'takes the upstream from one place' `
  -MaxRed 1

# A public destination would send provider API traffic out over the network and back, and would
# also make the rewrite depend on DNS - the two things this route exists to avoid.
Invoke-Probe -Name 'the upstream is a public host rather than loopback' `
  -Find 'const GAMES_UPSTREAM = process.env.GAMES_INTERNAL_URL ?? "http://127.0.0.1:4010";' `
  -Replace 'const GAMES_UPSTREAM = process.env.GAMES_INTERNAL_URL ?? "http://games.example.com";' `
  -ExpectRed 'proxies over loopback' `
  -MaxRed 1

Write-Host "`n=== the afterFiles guarantee ===" -ForegroundColor Cyan

# Returning the object form with `beforeFiles` inverts the one property that makes these rules
# safe to add to a live app: that real pages and public/ files always win.
Invoke-Probe -Name 'the rules are returned as beforeFiles instead of a bare array' `
  -Find @'
  return [
    // Catalogue artwork: /play/assets/<gameCode>/<file> -> <service>/assets/<gameCode>/<file>
    {
      source: "/play/assets/:gameCode/:asset",
      destination: `${GAMES_UPSTREAM}/assets/:gameCode/:asset`,
    },
    // The play page itself, which the launch URL points at.
    { source: "/play", destination: `${GAMES_UPSTREAM}/play` },
    // Its stylesheet, its two scripts, and the four /play/api/* calls the board makes.
    { source: "/play/:path*", destination: `${GAMES_UPSTREAM}/play/:path*` },
  ];
'@ `
  -Replace @'
  return {
    beforeFiles: [
      {
        source: "/play/assets/:gameCode/:asset",
        destination: `${GAMES_UPSTREAM}/assets/:gameCode/:asset`,
      },
      { source: "/play", destination: `${GAMES_UPSTREAM}/play` },
      { source: "/play/:path*", destination: `${GAMES_UPSTREAM}/play/:path*` },
    ],
  };
'@ `
  -ExpectRed 'serves the play page at /play' `
  -MaxRed 7

Write-Host ""
if ($script:Bad -gt 0) {
  Write-Host "$($script:Green) pinned, $($script:Bad) NOT PINNED - read the magenta and red lines above" -ForegroundColor Red
} else {
  Write-Host "All $($script:Green) probes red on the expected test." -ForegroundColor Green
}
