# Probes for __tests__/gamemaster/gm-contest-notifications.test.ts. Each injects one defect,
# runs the suite, restores the file (UTF-8, no BOM), and reports how many tests went red.
# Sequential by design: a parallel run once restored a file before its test read it.
$ErrorActionPreference = "Continue"
$utf8 = New-Object System.Text.UTF8Encoding($false)
$suite = "__tests__/gamemaster/gm-contest-notifications.test.ts"

$probes = @(
  # The creator stops hearing about a contest that earned them nothing.
  @{ File = "lib/services/gamemaster/gm-contest-notifications.ts"
     From = 'if (creatorId && !recipients.has(creatorId)) recipients.set(creatorId, 0);'
     To   = '' },
  # A funded contest is announced as if players were charged the per-seat amount.
  @{ File = "lib/services/gamemaster/gm-contest-notifications.ts"
     From = '      ? `free for players (you pay ${formatVolts(entryFee)} per seat)`'
     To   = '      ? formatVolts(entryFee)' },
  # The finish notice is sent for challenges instead of competitions.
  @{ File = "lib/services/settlement/contest-rewards.ts"
     From = '  if (kind === "competition") {'
     To   = '  if (kind === "challenge") {' },
  # The admin app loses the finished template, so its cron would settle silently.
  @{ File = "apps/admin/database/models/notification-template.model.ts"
     From = 'templateId: "gm_competition_finished",'
     To   = 'templateId: "gm_competition_done",' },
  # The funded branch announces before its transaction, i.e. even when the reserve aborts.
  @{ File = "lib/services/gamemaster/free-private-create.ts"
     From = '    void notifyGmContestCreated(doc, { reserve });'
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
