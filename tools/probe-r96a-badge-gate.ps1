# R96a probes — game-aware badge gate. RED on exactly one expected test each.

$ErrorActionPreference = 'Continue'
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

function Read-Utf8([string]$Path) {
  [System.IO.File]::ReadAllText((Resolve-Path -LiteralPath $Path), [System.Text.UTF8Encoding]::new($false))
}
function Write-Utf8([string]$Path, [string]$Text) {
  [System.IO.File]::WriteAllText((Resolve-Path -LiteralPath $Path), $Text, [System.Text.UTF8Encoding]::new($false))
}

function Invoke-Probe {
  param(
    [string]$Name,
    [string]$File,
    [string]$Find,
    [string]$Replace,
    [switch]$First,
    # Reason: three of the floor assignments now appear twice — once on the R96b
    # game-scoped arm and once on the cross-game arm — so a first-occurrence probe
    # silently mutates the wrong branch and reports the guard as absent.
    [int]$Index = 0,
    [string]$ExpectTest,
    [string]$Suite = '__tests__/services/badge-gate-r96a.test.ts'
  )

  $full = Join-Path $Root $File
  $orig = Read-Utf8 $full
  if ([string]::IsNullOrEmpty($orig)) { throw "PROBE DID NOT APPLY (empty read): $File" }

  $mut = if ($First) {
    $idx = -1
    for ($i = 0; $i -le $Index; $i++) {
      $idx = $orig.IndexOf($Find, $idx + 1)
      if ($idx -lt 0) { throw "PROBE DID NOT APPLY (Find miss #$i): $Name / $Find" }
    }
    $orig.Remove($idx, $Find.Length).Insert($idx, $Replace)
  } else {
    if (-not $orig.Contains($Find)) { throw "PROBE DID NOT APPLY (Find miss): $Name" }
    $orig.Replace($Find, $Replace)
  }
  if ($mut -eq $orig) { throw "PROBE DID NOT APPLY (no change): $Name" }
  Write-Utf8 $full $mut

  try {
    $out = npx vitest run $Suite -t $ExpectTest 2>&1 | Out-String
    $collapsed = ($out -replace '\s+', ' ')
    $failed = [regex]::Match($out, 'Tests\s+(\d+)\s+failed').Groups[1].Value
    if ($failed -eq '1') { Write-Host "RED x1  $Name" }
    else {
      Write-Host "FAIL    $Name  failed=$failed  expect=$ExpectTest"
      ($out -split "`n") | Where-Object { $_ -match 'FAIL|AssertionError|×' } | Select-Object -First 8 | ForEach-Object { Write-Host "  $_" }
    }
  } finally {
    Write-Utf8 $full $orig
  }
}

$MAIN = 'lib/services/badge-evaluation.service.ts'
$ADMIN = 'apps/admin/lib/services/badge-evaluation.service.ts'

# 1 — empty the set so every real type falls through to trading floors
# Reason: expect a behavioural test — renaming the Set still satisfies the structural one.
Invoke-Probe -Name 'drop-cross-game-set' -File $MAIN -First `
  -Find 'new Set(crossGameConditionTypes());' `
  -Replace 'new Set(["__never__"]);' `
  -ExpectTest 'games-only player clears a rare cross-game'

# 2 — cross-game arm still applies trade floors (index 1: index 0 is the game-scoped arm)
Invoke-Probe -Name 'cross-game-keeps-trade-floor' -File $MAIN -First -Index 1 `
  -Find 'effectiveMinTrades = 0;' `
  -Replace 'effectiveMinTrades = Math.max(minTrades || 0, tierReqs.trades);' `
  -ExpectTest 'games-only player clears a rare cross-game'

# 3 — compsStat still WithTrades on cross-game arm
Invoke-Probe -Name 'cross-game-uses-with-trades' -File $MAIN -First -Index 1 `
  -Find 'compsStat = stats.completedCompetitions;' `
  -Replace 'compsStat = stats.completedCompetitionsWithTrades;' `
  -ExpectTest 'cross-game competition floor reads completedCompetitions'

# 4 — trading floor Math.max removed (fail-open on trading)
Invoke-Probe -Name 'drop-trading-math-max' -File $MAIN -First `
  -Find 'effectiveMinTrades = Math.max(minTrades || 0, tierReqs.trades);' `
  -Replace 'effectiveMinTrades = minTrades || 0;' `
  -ExpectTest 'trading-typed badges still take the stricter rarity'

# 5 — admin diverges (R100 regression)
Invoke-Probe -Name 'admin-diverges' -File $ADMIN -First `
  -Find 'const CROSS_GAME_CONDITION_TYPES = new Set(crossGameConditionTypes());' `
  -Replace 'const CROSS_GAME_CONDITION_TYPES_RENAMED = new Set(crossGameConditionTypes()); const CROSS_GAME_CONDITION_TYPES = CROSS_GAME_CONDITION_TYPES_RENAMED;' `
  -ExpectTest 'both evaluators stay byte-identical'

# 6 — every non-exempt type treated as cross-game (fail open on trading floors)
Invoke-Probe -Name 'unknown-becomes-cross-game' -File $MAIN `
  -Find 'const isCrossGame = CROSS_GAME_CONDITION_TYPES.has(type);' `
  -Replace 'const isCrossGame = true;' `
  -ExpectTest 'trading-typed badge still refuses'

# 7 — stored minTrades honoured on cross-game again (ASCII-only find)
Invoke-Probe -Name 'honour-stored-minTrades' -File $MAIN -First -Index 1 `
  -Find 'effectiveMinTrades = 0;' `
  -Replace 'effectiveMinTrades = minTrades || 0;' `
  -ExpectTest 'ignores a stored minTrades'

Write-Host 'R96a probes done.'
