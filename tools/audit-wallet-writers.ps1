# Audit every place the platform moves a credit wallet balance.
#
# Reason: the reconciliation screen compares a wallet against the sum of its
# WalletTransaction rows. That comparison is only meaningful if EVERY balance
# change writes a matching row. R79 proved one writer did not; this counts them
# all rather than reading the folders that look suspicious.
#
# Report only. Prints, for each writer, whether a WalletTransaction is created
# within the enclosing window, so the ones needing a human read are obvious.

$ErrorActionPreference = "Continue"
$root = Split-Path -Parent $PSScriptRoot

# Every shape a balance change can take.
$patterns = @(
  '\$inc:\s*\{[^}]*creditBalance',
  '\$set:\s*\{[^}]*creditBalance',
  'creditBalance\s*=\s*[^=]',
  'creditBalance:\s*-?[A-Za-z0-9_.]'
)

$excluded = @(
  '__tests__', 'node_modules', '.next', 'dist', 'tools\probe-',
  'tools\audit-wallet-writers', 'scripts\', '.md', '.html'
)

function IsExcluded($path) {
  foreach ($e in $excluded) { if ($path -like "*$e*") { return $true } }
  return $false
}

$files = Get-ChildItem -Path $root -Recurse -Include *.ts, *.tsx -File |
  Where-Object { -not (IsExcluded $_.FullName) }

$rows = @()

foreach ($file in $files) {
  $text = [System.IO.File]::ReadAllText($file.FullName)
  if ($text -notmatch 'creditBalance') { continue }
  $lines = $text -split "`r?`n"

  for ($i = 0; $i -lt $lines.Count; $i++) {
    $line = $lines[$i]
    $hit = $false
    foreach ($p in $patterns) { if ($line -match $p) { $hit = $true; break } }
    if (-not $hit) { continue }

    # A read, a prop or a comparison is not a write.
    if ($line -match '^\s*(//|\*)') { continue }
    if ($line -match 'creditBalance\s*(===|!==|==|>=|<=|>|<)') { continue }
    if ($line -match 'creditBalance=\{') { continue }        # JSX prop
    if ($line -match '(const|let|var)\s') { continue }
    if ($line -match '\.creditBalance\s*\|\|') { continue }

    # Reason: a ledger row is written near its balance change, never pages away.
    # 80 lines covers the largest real case (the withdrawal refund paths).
    $from = [Math]::Max(0, $i - 80)
    $to = [Math]::Min($lines.Count - 1, $i + 80)
    $window = ($lines[$from..$to] -join "`n")

    $hasLedger = $window -match 'WalletTransaction' -or
                 $window -match 'wallettransactions' -or
                 $window -match 'recordWalletTransaction'

    $rows += [pscustomobject]@{
      File   = $file.FullName.Substring($root.Length + 1)
      Line   = $i + 1
      Ledger = if ($hasLedger) { "yes" } else { "NO" }
      Code   = $line.Trim()
    }
  }
}

"`n=== WALLET BALANCE WRITERS: $($rows.Count) ===`n"
$rows | Sort-Object Ledger, File | Format-Table -AutoSize -Wrap

$missing = @($rows | Where-Object { $_.Ledger -eq "NO" })
"`n=== NO LEDGER ROW IN WINDOW: $($missing.Count) ===`n"
$missing | ForEach-Object { "  $($_.File):$($_.Line)  $($_.Code)" }
