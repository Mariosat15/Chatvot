# R99 probes — badge catalogue add-only sync. RED on exactly one expected test each.

$ErrorActionPreference = 'Continue'
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

function Read-Utf8([string]$Path) {
  [System.IO.File]::ReadAllText((Resolve-Path -LiteralPath $Path), [System.Text.UTF8Encoding]::new($false))
}
function Write-Utf8([string]$Path, [string]$Text) {
  [System.IO.File]::WriteAllText((Resolve-Path -LiteralPath $Path), $Text, [System.Text.UTF8Encoding]::new($false))
}

function Invoke-Probe {
  param(
    [string]$Name,
    [string]$File,
    [string]$Find,
    [string]$Replace,
    [switch]$First,
    [string]$ExpectTest
  )

  $full = Join-Path $Root $File
  $orig = Read-Utf8 $full
  if ([string]::IsNullOrEmpty($orig)) { throw "PROBE DID NOT APPLY (empty read): $File" }

  $mut = if ($First) {
    $idx = $orig.IndexOf($Find)
    if ($idx -lt 0) { throw "PROBE DID NOT APPLY (Find miss): $Name / $Find" }
    $orig.Remove($idx, $Find.Length).Insert($idx, $Replace)
  } else {
    if (-not $orig.Contains($Find)) { throw "PROBE DID NOT APPLY (Find miss): $Name" }
    $orig.Replace($Find, $Replace)
  }
  if ($mut -eq $orig) { throw "PROBE DID NOT APPLY (no change): $Name" }
  Write-Utf8 $full $mut

  try {
    $out = npx vitest run __tests__/services/badge-catalogue-r99.test.ts -t $ExpectTest 2>&1 | Out-String
    $failed = [regex]::Match($out, 'Tests\s+(\d+)\s+failed').Groups[1].Value
    if ($failed -eq '1') { Write-Host "RED x1  $Name" }
    else {
      Write-Host "FAIL    $Name  failed=$failed  expect=$ExpectTest"
      ($out -split "`n") | Where-Object { $_ -match 'FAIL|AssertionError|×' } | Select-Object -First 6 | ForEach-Object { Write-Host "  $_" }
    }
  } finally {
    Write-Utf8 $full $orig
  }
}

$MAIN = 'lib/services/badge-config-seed.service.ts'
$ADMIN = 'apps/admin/lib/services/badge-config-seed.service.ts'
$JSON = 'data/defaults/badges.json'

$anchor = @'
          added++;
        }
      }

      if (added > 0) {
'@

$withOverwrite = @'
          added++;
        } else {
          const existing = existingBadges.find((b: any) => b.id === badge.id) as any;
          const conditionChanged = JSON.stringify(existing?.condition) !== JSON.stringify(badge.condition);
          if (conditionChanged) {
            await BadgeConfig.updateOne(
              { id: badge.id },
              { $set: { condition: badge.condition } },
            );
          }
        }
      }

      if (added > 0) {
'@

Invoke-Probe -Name 'overwrite restored on main' -File $MAIN `
  -Find $anchor -Replace $withOverwrite `
  -ExpectTest 'never overwrites condition on an existing row'

Invoke-Probe -Name 'overwrite restored on admin' -File $ADMIN `
  -Find $anchor -Replace $withOverwrite `
  -ExpectTest 'never overwrites condition on an existing row'

Invoke-Probe -Name 'JSON preference inverted' -File $MAIN `
  -Find 'const savedDefaults = getDefaultBadges();' `
  -Replace 'const savedDefaults = null; /* getDefaultBadges() bypassed */' -First `
  -ExpectTest 'prefers saved JSON defaults on an empty database'

Invoke-Probe -Name 'catalogue size lie' -File $JSON `
  -Find '"id": "new_trade_1000_plus"' -Replace '"id": "new_trade_1000_plus_REMOVED"' -First `
  -ExpectTest 'documents the live catalogue sizes'

Invoke-Probe -Name 'add-only shape broken on main' -File $MAIN `
  -Find $anchor -Replace $withOverwrite `
  -ExpectTest 'both seed services stay add-only'
