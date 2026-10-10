# Probes for Free Private (Game Master funded) competitions. Each injects one defect and
# runs only the test that should catch it; every line should report "1 failed (expected)".
$ErrorActionPreference = "Continue"
$utf8 = New-Object System.Text.UTF8Encoding($false)
$rules = "__tests__/services/free-private-rules.test.ts"
$money = "__tests__/services/free-private-money.test.ts"

$probes = @(
  @{ Suite = $rules; File = "lib/services/gamemaster/free-private-competition.ts"
     From = 'if (input.visibility !== "gm_private") {'; To = 'if (false) {'
     Expect = "a public contest is refused rather than silently downgraded" },
  @{ Suite = $money; File = "lib/services/gamemaster/free-private-reserve.ts"
     From = '{ userId: args.gameMasterUserId, creditBalance: { $gte: reserve } },'; To = '{ userId: args.gameMasterUserId },'
     Expect = "refuses with no write when the Game Master cannot cover every place" },
  @{ Suite = $money; File = "lib/services/gamemaster/free-private-reserve.ts"
     From = '"freePrivate.reserveRemaining": { $gte: fee },'; To = ''
     Expect = "refuses a seat once the reserve is exhausted" },
  @{ Suite = $money; File = "lib/services/gamemaster/free-private-reserve.ts"
     From = 'if (existing) return 0;'; To = ''
     Expect = "all disqualified" },
  @{ Suite = $money; File = "lib/services/settlement/free-private-refund.ts"
     From = 'if (already.has(userId)) continue;'; To = ''
     Expect = "an excluded seat is not refunded twice" },
  @{ Suite = $money; File = "lib/services/settlement/free-private-refund.ts"
     From = 'outcome: args.noWinners ? "all_disqualified" : "settled",'; To = 'outcome: "settled",'
     Expect = "all disqualified" },
  @{ Suite = $money; File = "lib/services/settlement/free-private-refund.ts"
     From = 'if (!isGmFundedContest(contest)) return null;'; To = ''
     Expect = "fundedGameMasterOf is null" },
  @{ Suite = $rules; File = "lib/actions/trading/competition-cancel.actions.ts"
     From = 'for (const participant of fundedGameMaster ? [] : participants) {'; To = 'for (const participant of participants) {'
     Expect = "skips the player loop" },
  @{ Suite = $rules; File = "apps/admin/lib/admin/incident-actions.ts"
     From = 's.isGmFunded === true &&'; To = ''
     Expect = "is never offered on a player-paid" },
  @{ Suite = $rules; File = "apps/admin/lib/admin/free-private-edit-guard.ts"
     From = 'if (fundingMode !== "gm_funded") return null;'; To = ''
     Expect = "leaves other fields and player-paid" }
)

foreach ($p in $probes) {
  $full = Join-Path (Get-Location) $p.File
  $orig = [IO.File]::ReadAllText($full, $utf8)
  if (-not $orig.Contains($p.From)) {
    Write-Output "PROBE DID NOT APPLY: $($p.File) :: $($p.From.Substring(0, [Math]::Min(50, $p.From.Length)))"
    continue
  }
  $mutated = $orig.Replace($p.From, $p.To)
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
