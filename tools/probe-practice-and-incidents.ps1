# Probes for practice-round exit and Round Inspector practice ending.
$ErrorActionPreference = "Continue"
$utf8 = New-Object System.Text.UTF8Encoding($false)

$probes = @(
  @{
    Suite = "__tests__/admin/practice-round-exit.test.ts"
    File = "components/games/PracticeRoundHost.tsx"
    From = 'window.addEventListener("pagehide", endIfLive);'
    To = ''
    Expect = "listens for pagehide"
  },
  @{
    Suite = "__tests__/admin/practice-round-exit.test.ts"
    File = "apps/admin/components/admin/games/RoundInspectorSection.tsx"
    From = 'isPractice={round.contestType === "practice"}'
    To = 'isPractice={false}'
    Expect = "passes isPractice"
  },
  @{
    Suite = "__tests__/admin/round-inspector.test.ts"
    File = "apps/admin/app/api/games/rounds/[roundId]/resolve/route.ts"
    From = 'if (round.contestType !== "practice" || round.contestId) {'
    To = 'if (false) {'
    Expect = "the resolve route refuses a non-practice round"
  },
  @{
    Suite = "__tests__/admin/round-inspector.test.ts"
    File = "apps/admin/lib/services/games/round-resolution.service.ts"
    From = 'contestType: "practice",'
    To = 'contestType: "competition",'
    Expect = "queries unresolved rounds, live rounds past expiry, and open practice rounds"
  },
  @{
    Suite = "__tests__/admin/incident-hub.test.ts"
    File = "apps/admin/components/admin/IncidentsSection.tsx"
    From = "statusFilter"
    To = "statusPick"
    Expect = "offers search and status"
  }
)

foreach ($p in $probes) {
  $full = Join-Path (Get-Location) $p.File
  $orig = [IO.File]::ReadAllText($full, $utf8)
  if (-not $orig.Contains($p.From)) {
    Write-Output "PROBE DID NOT APPLY: $($p.File) :: $($p.From.Substring(0, [Math]::Min(50, $p.From.Length)))"
    continue
  }
  $mutated = $orig.Replace($p.From, $p.To)
  if ($mutated -eq $orig) {
    Write-Output "PROBE DID NOT CHANGE: $($p.File)"
    continue
  }
  [IO.File]::WriteAllText($full, $mutated, $utf8)
  try {
    $out = (npx vitest run $p.Suite -t $p.Expect 2>&1 | Out-String) -replace '\s+', ' '
    $m = [regex]::Match($out, 'Tests\s+(\d+) failed')
    $n = if ($m.Success) { $m.Groups[1].Value } else { "0" }
    $hit = if ($out -match [regex]::Escape(($p.Expect -replace '\s+', ' '))) { "expected" } else { "OTHER" }
    Write-Output "$($p.File): $n failed ($hit)"
  } finally {
    [IO.File]::WriteAllText($full, $orig, $utf8)
  }
}
