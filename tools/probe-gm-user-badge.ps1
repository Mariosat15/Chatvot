# Probes for __tests__/gamemaster/gm-user-badge.test.ts. Each injects one defect, runs the
# suite, restores the file (UTF-8, no BOM), and reports how many tests went red.
$ErrorActionPreference = "Continue"
$utf8 = New-Object System.Text.UTF8Encoding($false)
$suite = "__tests__/gamemaster/gm-user-badge.test.ts"

$probes = @(
  # A lapsed subscription still wearing the badge.
  @{ File = "lib/services/gamemaster/active-game-masters.ts"
     From = 'return { status: "active", endDate: { $gt: now } };'
     To   = 'return { status: "active" };' },
  # The global leaderboard's mobile card loses the badge.
  @{ File = "components/leaderboard/GlobalLeaderboardTable.tsx"
     From = '<GameMasterBadge userId={row.userId} compact />'
     To   = '' },
  # The contest board loses it.
  @{ File = "components/trading/CompetitionLeaderboard.tsx"
     From = '<GameMasterBadge userId={entry.userId} />'
     To   = '' },
  # The badge shows for everybody.
  @{ File = "components/gamemaster/GameMasterBadge.tsx"
     From = 'if (!userId || !ids.has(String(userId))) return null;'
     To   = 'if (!userId) return null;' },
  # The id list is served to anonymous callers.
  @{ File = "app/api/gamemaster/active-ids/route.ts"
     From = 'if (!session?.user?.id) {'
     To   = 'if (false) {' }
)

foreach ($p in $probes) {
  $path = Join-Path (Get-Location) $p.File
  $orig = [System.IO.File]::ReadAllText($path, $utf8)
  if (-not $orig.Contains($p.From)) { Write-Output "PROBE DID NOT APPLY: $($p.File)"; continue }
  [System.IO.File]::WriteAllText($path, $orig.Replace($p.From, $p.To), $utf8)
  try {
    $out = (npx vitest run $suite 2>&1 | Out-String) -replace '\s+', ' '
  } finally {
    [System.IO.File]::WriteAllText($path, $orig, $utf8)
  }
  if ($out -match 'Tests\s+(\d+) failed') { Write-Output "RED x$($Matches[1]): $($p.File)" }
  else { Write-Output "GREEN (guard missing): $($p.File)" }
}
