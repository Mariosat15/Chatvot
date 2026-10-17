# Probes for the sponsored banner and the Access & Funding wizard step (2 Oct 2026). Each
# injects one defect and runs only the test that should catch it; every line should report
# "1 failed (expected)".
$ErrorActionPreference = "Continue"
$utf8 = New-Object System.Text.UTF8Encoding($false)
$suite = "__tests__/services/sponsored-contest-and-funding-step.test.ts"
$wizard = "app/(root)/gamemaster/create-competition/page-content.tsx"

$probes = @(
  @{ File = "lib/utils/sponsored-contest-copy.ts"
     From = 'return fundingMode === "gm_funded";'; To = 'return Boolean(fundingMode);'
     Expect = "only gm_funded is sponsored" },
  @{ File = "lib/utils/sponsored-contest-copy.ts"
     From = 'Free to enter - ${name}'; To = '${name}'
     Expect = "names the Game Master and says the entry is free" },
  @{ File = "components/game-page/GamePageContests.tsx"
     From = '<SponsoredContestBanner'; To = '<div data-x'
     Expect = "GamePageContests.tsx renders SponsoredContestBanner" },
  @{ File = "lib/utils/access-funding-step.ts"
     From = 'if (input.fundingOffered && !input.fundingMode) {'; To = 'if (false) {'
     Expect = "refuses until who-pays is picked when funding is offered" },
  @{ File = "lib/utils/access-funding-step.ts"
     From = 'if (!input.visibility) return'; To = 'if (false) return'
     Expect = "refuses until who-can-join is picked" },
  @{ File = "lib/utils/access-funding-step.ts"
     From = 'return fundingOffered && fundingMode ? fundingMode : "player_paid";'; To = 'return fundingMode ?? "player_paid";'
     Expect = "an unoffered or unpicked funding always posts player_paid" },
  @{ File = $wizard
     From = 'fundingMode: effectiveFunding,'; To = 'fundingMode,'
     Expect = "the trading wizard re-checks the step on launch and posts the effective funding" },
  @{ File = $wizard
     From = '      title: "Access & Funding",'; To = '      title: "Access",'
     Expect = "the trading wizard lists it third" },
  @{ File = "components/gamemaster/CreateCompetitionGate.tsx"
     From = 'useState<FundingMode | undefined>(undefined)'; To = 'useState<FundingMode | undefined>("player_paid")'
     Expect = "the gate never pre-selects a funding mode" }
)

foreach ($p in $probes) {
  $full = Join-Path (Get-Location) $p.File
  $orig = [IO.File]::ReadAllText($full, $utf8)
  if (-not $orig.Contains($p.From)) {
    Write-Output "PROBE DID NOT APPLY: $($p.File) :: $($p.From.Substring(0, [Math]::Min(50, $p.From.Length)))"
    continue
  }
  [IO.File]::WriteAllText($full, $orig.Replace($p.From, $p.To), $utf8)
  try {
    $out = (npx vitest run $suite -t $p.Expect 2>&1 | Out-String) -replace '\s+', ' '
    $m = [regex]::Match($out, 'Tests\s+(\d+) failed')
    $n = if ($m.Success) { $m.Groups[1].Value } else { "0" }
    $hit = if ($out -match [regex]::Escape(($p.Expect -replace '\s+', ' '))) { "expected" } else { "OTHER" }
    Write-Output "$($p.File): $n failed ($hit)"
  } finally {
    [IO.File]::WriteAllText($full, $orig, $utf8)
  }
}
