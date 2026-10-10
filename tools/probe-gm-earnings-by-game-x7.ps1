# X7 step 5 — GM earnings by game probes.
# Each probe must turn EXACTLY one named test red. ASCII anchors only.
$ErrorActionPreference = "Continue"
$Root = Split-Path -Parent $PSScriptRoot
if (-not $Root) { $Root = (Get-Location).Path }
Set-Location $Root

function Read-Utf8([string]$Path) {
  return [System.IO.File]::ReadAllText((Resolve-Path -LiteralPath $Path), [System.Text.UTF8Encoding]::new($false))
}
function Write-Utf8([string]$Path, [string]$Content) {
  [System.IO.File]::WriteAllText((Resolve-Path -LiteralPath $Path), $Content, [System.Text.UTF8Encoding]::new($false))
}

function Invoke-Probe {
  param(
    [string]$Name,
    [string]$File,
    [string]$Find,
    [string]$Replace,
    [string]$Suite,
    [string]$ExpectTest,
    [switch]$First
  )

  $full = Join-Path $Root $File
  $original = Read-Utf8 $full
  $idx = $original.IndexOf($Find)
  if ($idx -lt 0) {
    Write-Host "PROBE DID NOT APPLY: $Name"
    return
  }
  $mutated = if ($First) {
    $original.Remove($idx, $Find.Length).Insert($idx, $Replace)
  } else {
    $original.Replace($Find, $Replace)
  }
  if ($mutated -eq $original) {
    Write-Host "PROBE DID NOT APPLY: $Name"
    return
  }
  if ([string]::IsNullOrEmpty($original)) {
    Write-Host "PROBE DID NOT APPLY: $Name (empty read)"
    return
  }
  Write-Utf8 $full $mutated

  try {
    $outFile = Join-Path $env:TEMP ("probe-x7s5-" + $Name + ".txt")
    cmd /c "npx vitest run `"$Suite`" -t `"$ExpectTest`" > `"$outFile`" 2>&1"
    $out = [System.IO.File]::ReadAllText($outFile, [System.Text.UTF8Encoding]::new($false))
    if (-not $out) { $out = "" }
    $collapsed = ($out -replace "\s+", " ")
    $failed = 0
    if ($collapsed -match "(\d+)\s+failed") { $failed = [int]$Matches[1] }
    $ran = $collapsed -match [regex]::Escape($ExpectTest)
    $status = if ($failed -eq 1 -and $ran) { "RED x1 OK" } else { "UNEXPECTED (failed=$failed ran=$ran)" }
    Write-Host "$Name : $status"
  } finally {
    Write-Utf8 $full $original
  }
}

$ByGame = "lib/services/gamemaster/earnings-by-game.ts"
$Distribute = "lib/services/settlement/game-master-fees/distribute.ts"
$Outcome = "lib/services/settlement/challenge-outcome.ts"
$Model = "database/models/gamemaster/gamemaster-earning.model.ts"
$Backfill = "tools/gamemaster/backfill-gm-earning-gamekey-core.ts"
$EarningsRoute = "app/api/gamemaster/earnings/route.ts"
$Dashboard = "app/api/gamemaster/dashboard/route.ts"
$Suite = "__tests__/services/gm-earnings-by-game-x7.test.ts"

Write-Host "=== X7 step 5 probes ==="

Invoke-Probe -Name "1-blank-is-trading" -File $ByGame `
  -Find 'if (typeof gameKey === "string" && gameKey.trim()) return gameKey.trim();' `
  -Replace 'if (typeof gameKey === "string" && gameKey.trim()) return "broken";' `
  -Suite $Suite `
  -ExpectTest "resolveEarningGameKey treats absent, null, blank as trading"

Invoke-Probe -Name "2-summarise-groups" -File $ByGame `
  -Find 'const key = resolveEarningGameKey(row.gameKey);' `
  -Replace 'const key = row.gameKey || "other";' `
  -Suite $Suite `
  -ExpectTest "summariseEarningsByGame groups on coalesced key and sorts by net desc"

Invoke-Probe -Name "3-distribute-stamp" -File $Distribute `
  -Find 'gameKey:' `
  -Replace 'gameLabel:' `
  -Suite $Suite `
  -ExpectTest "main distribute stamps gameKey with trading fallback" `
  -First

Invoke-Probe -Name "4-challenge-pass" -File $Outcome `
  -Find 'gameKey: challenge.gameKey,' `
  -Replace 'gameKey: "trading",' `
  -Suite $Suite `
  -ExpectTest "challenge-outcome passes challenge.gameKey onto the settlement contest"

Invoke-Probe -Name "5-no-schema-default" -File $Model `
  -Find 'gameKey: {
      type: String,
      index: true,
    },' `
  -Replace 'gameKey: {
      type: String,
      index: true,
      default: "trading",
    },' `
  -Suite $Suite `
  -ExpectTest "GameMasterEarning schema declares gameKey without a default"

Invoke-Probe -Name "6-backfill-missing-filter" -File $Backfill `
  -Find '{ _id: row._id, ...missingStringFilter("gameKey") },' `
  -Replace '{ _id: row._id },' `
  -Suite $Suite `
  -ExpectTest "backfill core re-asserts the missing filter on write"

Invoke-Probe -Name "7-earnings-route" -File $EarningsRoute `
  -Find 'summariseEarningsByGame(allFilteredEarnings)' `
  -Replace '([] as ReturnType<typeof summariseEarningsByGame>)' `
  -Suite $Suite `
  -ExpectTest "player earnings route returns byGame from summariseEarningsByGame"

Invoke-Probe -Name "8-dashboard-stages" -File $Dashboard `
  -Find '...earningsByGameGroupStages(),' `
  -Replace '...[],' `
  -Suite $Suite `
  -ExpectTest "dashboard route aggregates with earningsByGameGroupStages"

Write-Host "=== done ==="
