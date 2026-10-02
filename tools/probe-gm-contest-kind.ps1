# Probes for __tests__/gamemaster/gm-contest-kind.test.ts. Each injects one defect, runs the
# suite, restores the file, and reports how many tests went red. Sequential by design: a
# parallel run once restored a file before its test read it and reported a false green.
$ErrorActionPreference = "Continue"
$utf8 = New-Object System.Text.UTF8Encoding($false)
$suite = "__tests__/gamemaster/gm-contest-kind.test.ts"

$probes = @(
  @{ File = "lib/utils/gm-contest-kind.ts"
     From = 'if (isSponsoredContest(contest.fundingMode)) return "funded";'
     To   = 'if (resolveCompetitionVisibility(contest.visibility) === "gm_private") return "private"; if (isSponsoredContest(contest.fundingMode)) return "funded";' },
  @{ File = "app/(root)/gamemaster/page-content.tsx"
     From = 'return filterByContestKind(byStatus, compKindFilter);'
     To   = 'return byStatus;' },
  @{ File = "lib/services/gamemaster/earning-contest-kind.ts"
     From = 'if ((row.sourceType ?? "competition") !== "competition") return null;'
     To   = '' }
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
