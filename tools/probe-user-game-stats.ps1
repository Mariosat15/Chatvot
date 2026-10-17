# X7 step 1 — UserGameStats writer probes.
# Each probe must turn EXACTLY one named test red. ASCII anchors only.
# Reason: npx emits ExperimentalWarning on stderr; Stop would abort every probe.
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
    [string]$ExpectTest
  )

  $full = Join-Path $Root $File
  $original = Read-Utf8 $full
  if ($original.IndexOf($Find) -lt 0) {
    Write-Host "PROBE DID NOT APPLY: $Name"
    return
  }
  $mutated = $original.Replace($Find, $Replace)
  if ($mutated -eq $original) {
    Write-Host "PROBE DID NOT APPLY: $Name"
    return
  }
  Write-Utf8 $full $mutated

  try {
    $outFile = Join-Path $env:TEMP ("probe-ugs-" + $Name + ".txt")
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

$StatsSvc = "lib/services/games/user-game-stats.service.ts"
$Rewards = "lib/services/settlement/contest-rewards.ts"
$Points = "lib/services/games/normalized-points.ts"
$SuiteStats = "__tests__/services/user-game-stats.test.ts"
$SuiteRewards = "__tests__/services/contest-rewards.test.ts"
$SuitePoints = "__tests__/services/normalized-points.test.ts"

Write-Host "=== X7 step 1 probes ==="

Invoke-Probe -Name "1-no-overall-row" -File $StatsSvc `
  -Find 'await upsertFinish(record.userId, OVERALL_GAME_KEY, {' `
  -Replace 'if (false) await upsertFinish(record.userId, OVERALL_GAME_KEY, {' `
  -Suite $SuiteStats `
  -ExpectTest "writes the per-game row and the _overall rollup in one finish"

Invoke-Probe -Name "2-raw-score-on-overall" -File $StatsSvc `
  -Find 'rawScore: undefined,' `
  -Replace 'rawScore: record.rawScore,' `
  -Suite $SuiteStats `
  -ExpectTest "writes the per-game row and the _overall rollup in one finish"

Invoke-Probe -Name "3-elo-on-overall" -File $StatsSvc `
  -Find 'applyRating: false,' `
  -Replace 'applyRating: true,' `
  -Suite $SuiteStats `
  -ExpectTest "writes the per-game row and the _overall rollup in one finish"

Invoke-Probe -Name "4-fire-and-forget-stats" -File $Rewards `
  -Find 'await recordContestFinish({' `
  -Replace 'void recordContestFinish({' `
  -Suite $SuiteStats `
  -ExpectTest "contest-rewards awaits recordContestFinish"

Invoke-Probe -Name "5-unranked-still-zero" -File $Points `
  -Find 'if (typeof rank !== "number" || !Number.isFinite(rank) || rank < 1) {' `
  -Replace 'if (false && typeof rank !== "number") {' `
  -Suite $SuitePoints `
  -ExpectTest "returns 0 for an absent or non-positive rank"

Invoke-Probe -Name "6-call-site-fieldSize" -File "lib/actions/trading/competition-end.actions.ts" `
  -Find 'fieldSize: participants.length,' `
  -Replace '' `
  -Suite $SuiteRewards `
  -ExpectTest "passes fieldSize and entryFee so points are not computed from defaults forever"

Write-Host "=== done ==="
