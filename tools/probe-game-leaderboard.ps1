# X7 step 2 - UserGameStats leaderboard probes
$ErrorActionPreference = 'Continue'
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

$Suite = '__tests__/services/game-leaderboard.test.ts'
$Service = 'lib/services/games/game-leaderboard.service.ts'
$Client = 'components/leaderboard/LeaderboardClient.tsx'
$Api = 'app/api/leaderboard/route.ts'

function Read-Utf8([string]$Path) {
  return [System.IO.File]::ReadAllText((Resolve-Path -LiteralPath $Path))
}
function Write-Utf8([string]$Path, [string]$Text) {
  $utf8 = New-Object System.Text.UTF8Encoding $false
  [System.IO.File]::WriteAllText((Resolve-Path -LiteralPath $Path), $Text, $utf8)
}

function Run-Test([string]$Name) {
  $out = & cmd /c "npx vitest run $Suite -t `"$Name`" 2>&1"
  return (($out | Out-String) -replace '\s+', ' ')
}

function Invoke-Probe {
  param(
    [string]$Label,
    [string]$File,
    [string]$Find,
    [string]$Replace,
    [string]$ExpectTest
  )
  $original = Read-Utf8 $File
  $idx = $original.IndexOf($Find)
  if ($idx -lt 0) {
    Write-Host ("FAIL {0} - PROBE DID NOT APPLY" -f $Label)
    return
  }
  $mutated = $original.Remove($idx, $Find.Length).Insert($idx, $Replace)
  Write-Utf8 $File $mutated
  try {
    $text = Run-Test $ExpectTest
    $failed = -1
    if ($text -match 'Tests\s+(\d+)\s+failed') { $failed = [int]$Matches[1] }
    elseif ($text -match '(\d+)\s+failed\s+\|\s+\d+\s+passed') { $failed = [int]$Matches[1] }
    elseif ($text -match 'FAIL\s+' + [regex]::Escape($Suite)) { $failed = 1 }
    if ($failed -eq 1 -and $text.Contains($ExpectTest)) {
      Write-Host ("PASS {0} - RED x1 on expected test" -f $Label)
    } elseif ($failed -eq 0) {
      Write-Host ("FAIL {0} - stayed GREEN" -f $Label)
    } else {
      $snip = $text.Substring(0, [Math]::Min(400, $text.Length))
      Write-Host ("FAIL {0} - failed={1}. {2}" -f $Label, $failed, $snip)
    }
  } finally {
    Write-Utf8 $File $original
  }
}

Write-Host '=== probe-game-leaderboard ==='

$findEnabled = 'expect(stripped).not.toMatch(/getEnabledGameTypes/)'
$replEnabled = 'expect(stripped).toMatch(/getEnabledGameTypes/)'
Invoke-Probe -Label 'no enabled-set read' -File $Suite -Find $findEnabled -Replace $replEnabled -ExpectTest 'service file must not call getEnabledGameTypes'

$findRating = 'if (!isOverall) entry.rating = row.rating ?? 1200;'
$replRating = 'entry.rating = row.rating ?? 1200;'
Invoke-Probe -Label 'overall omits rating' -File $Service -Find $findRating -Replace $replRating -ExpectTest 'omits rating on the overall board and includes it per game'

Invoke-Probe -Label 'tie ranks share place' -File $Service -Find 'const rank = i + 1;' -Replace 'const rank = i + 2;' -ExpectTest 'ranks by totalPoints descending with dense ties'

Invoke-Probe -Label 'tabs always lead with Overall' -File $Service -Find 'gameKey: OVERALL_GAME_KEY,' -Replace 'gameKey: TRADING_GAME_TYPE,' -ExpectTest 'lists Overall plus distinct gameKeys without using enabled flags'

Invoke-Probe -Label 'diff does not write' -File $Suite -Find 'expect(after).toBe(before);' -Replace 'expect(after).toBe(before + 1);' -ExpectTest 'diffTop100WithLegacy reports divergence without mutating either board'

Invoke-Probe -Label 'client default stays legacy' -File $Client -Find 'useState<BoardSource>("legacy")' -Replace 'useState<BoardSource>("stats")' -ExpectTest 'client defaults to legacy during R14 parallel period'

$api = Read-Utf8 $Api
if ($api.Contains('searchParams.get("source") || "legacy"')) {
  Write-Host 'PASS api defaults to legacy source'
} else {
  Write-Host 'FAIL api defaults to legacy source'
}

Write-Host '=== done ==='
