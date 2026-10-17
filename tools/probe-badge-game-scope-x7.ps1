# X7 step 4 — badge scope / XP stamp probes.
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
  # Refuse to write an emptied file (PowerShell wildcard trap on [id] paths).
  if ([string]::IsNullOrEmpty($original)) {
    Write-Host "PROBE DID NOT APPLY: $Name (empty read)"
    return
  }
  Write-Utf8 $full $mutated

  try {
    $outFile = Join-Path $env:TEMP ("probe-x7s4-" + $Name + ".txt")
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

$Scope = "lib/services/games/badge-game-scope.ts"
$Eval = "lib/services/badge-evaluation.service.ts"
$Xp = "lib/services/xp-level.service.ts"
$Seed = "lib/services/badge-config-seed.service.ts"
$Played = "lib/services/games/played-games.service.ts"
$Suite = "__tests__/services/badge-game-scope-x7.test.ts"

Write-Host "=== X7 step 4 probes ==="

Invoke-Probe -Name "1-platform-empty-false" -File $Scope `
  -Find 'if (types.length === 0) return true;' `
  -Replace 'if (types.length === 0) return false;' `
  -Suite $Suite `
  -ExpectTest "empty gameTypes means platform and applies to everyone"

Invoke-Probe -Name "2-trading-always-show" -File $Scope `
  -Find 'return input.hasTradingActivity;' `
  -Replace 'return true;' `
  -Suite $Suite `
  -ExpectTest "trading-only badge is hidden from a games-only player unless the condition is platform"

Invoke-Probe -Name "3-provider-ignore-played" -File $Scope `
  -Find 'return providerKeys.some((k) => input.playedGameKeys.has(k));' `
  -Replace 'return true;' `
  -Suite $Suite `
  -ExpectTest "provider-scoped badge requires that gameKey in the played set"

Invoke-Probe -Name "4-stamp-always-trading" -File $Scope `
  -Find 'if (providerKeys.length === 1) return providerKeys[0];' `
  -Replace 'if (providerKeys.length === 1) return "trading";' `
  -Suite $Suite `
  -ExpectTest "gameKeyForBadgeXp stamps trading or a single provider key, never invents"

Invoke-Probe -Name "5-unscoped-as-trading" -File $Xp `
  -Find ': "_unscoped";' `
  -Replace ': "trading";' `
  -Suite $Suite `
  -ExpectTest "sumXpByGameKey buckets missing keys as _unscoped, never trading"

Invoke-Probe -Name "6-drop-evaluate-filter" -File $Eval -First `
  -Find 'if (
        !badgeAppliesToPlayer({
          gameTypes: (badge as Badge).gameTypes,
          conditionType: badge.condition?.type,
          playedGameKeys: played.gameKeys,
          hasTradingActivity: played.hasTradingActivity,
        })
      ) {
        continue;
      }' `
  -Replace '' `
  -Suite $Suite `
  -ExpectTest "evaluate and getUserBadges both call badgeAppliesToPlayer"

Invoke-Probe -Name "7-omit-gameTypes-return" -File $Seed -First `
  -Find 'gameTypes: Array.isArray(badge.gameTypes) ? badge.gameTypes : ["trading"],' `
  -Replace '/* gameTypes omitted */' `
  -Suite $Suite `
  -ExpectTest "getBadgesFromDB returns gameTypes so scope is not invented as platform"

Invoke-Probe -Name "8-drop-badge-xp-stamp" -File $Xp `
  -Find '...(badgeGameKey ? { gameKey: badgeGameKey } : {}),' `
  -Replace '' `
  -Suite $Suite `
  -ExpectTest "awardXPForBadge stamps gameKey via gameKeyForBadgeXp"

Invoke-Probe -Name "9-drop-xpByGameKey" -File $Xp `
  -Find 'xpByGameKey: sumXpByGameKey(userLevel.xpHistory),' `
  -Replace '' `
  -Suite $Suite `
  -ExpectTest "getUserLevel exposes xpByGameKey from the ledger, not a recomputed sum"

Invoke-Probe -Name "10-enabled-games-leak" -File $Played `
  -Find 'export async function getPlayedGamesSnapshot(' `
  -Replace "import { getEnabledGameTypes } from `"@/lib/games`";`nexport async function getPlayedGamesSnapshot(" `
  -Suite $Suite `
  -ExpectTest "played-games snapshot never calls getEnabledGameTypes"

Write-Host "=== done ==="
