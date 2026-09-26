# R106 probes — journey blueprint must stay 10 dual-path maps.
# Each probe reintroduces one defect and must turn RED on exactly one test.

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
    [string]$ExpectTest,
    [string]$Suite = '__tests__/services/journey-blueprint-dual-path.test.ts'
  )

  $full = Join-Path $Root $File
  $orig = Read-Utf8 $full
  if ([string]::IsNullOrEmpty($orig)) { throw "PROBE DID NOT APPLY (empty read): $File" }

  $idx = $orig.IndexOf($Find)
  if ($idx -lt 0) { Write-Host "DID NOT APPLY (Find miss): $Name"; return }
  $mut = $orig.Remove($idx, $Find.Length).Insert($idx, $Replace)
  if ($mut -eq $orig) { Write-Host "DID NOT APPLY (no change): $Name"; return }
  Write-Utf8 $full $mut

  try {
    $out = npx vitest run $Suite -t $ExpectTest 2>&1 | Out-String
    $collapsed = ($out -replace '\s+', ' ')
    $failed = [regex]::Match($collapsed, 'Tests\s+(\d+)\s+failed').Groups[1].Value
    $passed = [regex]::Match($collapsed, 'Tests\s+.*?(\d+)\s+passed').Groups[1].Value
    if ($failed -eq '1') { Write-Host "RED x1  $Name" }
    else {
      Write-Host "FAIL    $Name  failed='$failed' passed='$passed'  expect=$ExpectTest"
      ($out -split "`n") | Where-Object { $_ -match 'FAIL|AssertionError|No test files|DID NOT' } |
        Select-Object -First 6 | ForEach-Object { Write-Host "  $($_.Trim())" }
    }
  } finally {
    Write-Utf8 $full $orig
  }
}

$BP = 'lib/services/games/journey-blueprint.ts'
$SHELLS = 'lib/services/games/journey-map-shells.ts'

# 1 — shrink default map count back toward the two-map world
Invoke-Probe -Name 'default-map-count-2' -File $SHELLS `
  -Find 'export const DEFAULT_MAP_COUNT = 10;' `
  -Replace 'export const DEFAULT_MAP_COUNT = 2;' `
  -ExpectTest 'emits the historic 10-map sequence by default'

# 2 — cap mapCount option so a two-scope plan cannot grow
Invoke-Probe -Name 'ignore-mapCount-option' -File $BP `
  -Find 'Math.max(1, options.mapCount ?? DEFAULT_MAP_COUNT),' `
  -Replace 'Math.max(1, 2),' `
  -ExpectTest 'does not shrink to catalogue scope count'

# 3 — drop gaming OR paths on activity nodes
Invoke-Probe -Name 'no-or-paths' -File $BP `
  -Find 'orCompleteConditions: gaming ? [gaming] : [],' `
  -Replace 'orCompleteConditions: [],' `
  -ExpectTest 'gives activity milestones a gaming OR path'

# 4 — break sequence linking
Invoke-Probe -Name 'broken-next-link' -File $BP `
  -Find 'current.nextMapId = next.mapId;' `
  -Replace 'current.nextMapId = null;' `
  -ExpectTest 'links maps in sequence order'

Write-Host ''
Write-Host 'R106 probes finished.'
