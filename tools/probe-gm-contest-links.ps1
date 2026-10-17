# Probes for __tests__/admin/gm-detail-contest-links.test.ts.
# Each injects one defect, runs the suite, expects exactly one red test, then restores.
$ErrorActionPreference = "Continue"
$utf8 = New-Object System.Text.UTF8Encoding($false)
$suite = "__tests__/admin/gm-detail-contest-links.test.ts"
$helper = "apps/admin/lib/admin/admin-contest-href.ts"
$view = "apps/admin/components/admin/GameMasterDetailView.tsx"
$button = "apps/admin/components/admin/gamemaster/ContestOpenButton.tsx"
$probes = @(
  @{ File = $helper; From = 'if (!base || !isCompetitionIdShaped(id)) return null;'; To = 'if (!isCompetitionIdShaped(id)) return null;' },
  @{ File = $helper; From = 'if (!base || !isCompetitionIdShaped(id)) return null;'; To = 'if (!base) return null;' },
  @{ File = $helper; From = '["challenge", "/challenges/view/"]'; To = '["challenge", "/competitions/view/"]' },
  @{ File = "apps/admin/app/api/gamemasters/[id]/route.ts"; From = 'sourceId: e.sourceId ? String(e.sourceId) : null,'; To = '' },
  @{ File = $view; From = '<ContestOpenButton kind="competition" id={comp.id} />'; To = '' },
  @{ File = $view; From = 'kind={e.sourceType}'; To = 'kind="competition"' },
  @{ File = $button; From = 'adminContestViewHref(kind, id)'; To = '`/competitions/view/${id}`' },
  @{ File = $button; From = 'if (!href) {'; To = 'if (false) {' }
)
foreach ($p in $probes) {
  $full = Join-Path (Get-Location) $p.File
  $orig = [IO.File]::ReadAllText($full, $utf8)
  if (-not $orig.Contains($p.From)) { Write-Output "PROBE DID NOT APPLY: $($p.File)"; continue }
  $mutated = $orig.Replace($p.From, $p.To)
  if ($mutated -eq $orig) { Write-Output "PROBE DID NOT CHANGE FILE: $($p.File)"; continue }
  [IO.File]::WriteAllText($full, $mutated, $utf8)
  $out = (npx vitest run $suite 2>&1 | Out-String) -replace '\s+', ' '
  [IO.File]::WriteAllText($full, $orig, $utf8)
  $m = [regex]::Match($out, 'Tests\s+(\d+) failed')
  $n = if ($m.Success) { $m.Groups[1].Value } else { "0" }
  Write-Output "$($p.File) [$($p.From.Substring(0, [Math]::Min(40, $p.From.Length)))]: $n failed"
}
