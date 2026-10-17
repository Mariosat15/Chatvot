# Probes for __tests__/utils/wizard-defaults-and-lobby-notice.test.ts.
# Each injects one defect, runs the suite, expects exactly one red test, then restores.
$ErrorActionPreference = "Continue"
$utf8 = New-Object System.Text.UTF8Encoding($false)
$suite = "__tests__/utils/wizard-defaults-and-lobby-notice.test.ts"
$probes = @(
  @{ File = "lib/utils/lobby-notice.ts"; From = 'if (playMode !== "scheduled") return null;'; To = '' },
  @{ File = "lib/utils/default-contest-window.ts"; From = 'const LEAD_MINUTES = 60;'; To = 'const LEAD_MINUTES = 24 * 60;' },
  @{ File = "components/gamemaster/ProviderContestCreateForm.tsx"; From = 'lobbySeconds={title.lobbySeconds}'; To = '' },
  @{ File = "app/api/gamemaster/creation-options/route.ts"; From = 'lobbySeconds: t.lobbySeconds,'; To = '' },
  @{ File = "apps/admin/components/admin/CompetitionCreatorForm.tsx"; From = 'defaultContestWindow(24 * 60)'; To = '({ startDate: "", startTime: "", endDate: "", endTime: "" })' }
)
foreach ($p in $probes) {
  $full = Join-Path (Get-Location) $p.File
  $orig = [IO.File]::ReadAllText($full, $utf8)
  if (-not $orig.Contains($p.From)) { Write-Output "PROBE DID NOT APPLY: $($p.File)"; continue }
  [IO.File]::WriteAllText($full, $orig.Replace($p.From, $p.To), $utf8)
  $out = (npx vitest run $suite 2>&1 | Out-String) -replace '\s+', ' '
  [IO.File]::WriteAllText($full, $orig, $utf8)
  $m = [regex]::Match($out, 'Tests\s+(\d+) failed')
  $n = if ($m.Success) { $m.Groups[1].Value } else { "0" }
  Write-Output "$($p.File): $n failed"
}
