# Probe: the centralised incident hub (21 September 2026).
#
# Each probe reintroduces one half of a defect this slice removed and must turn
# EXACTLY one named test red. Parameterised on the SUITE, because these guards live
# in one file today and a probe aimed at the wrong suite reports "no test ran".

$ErrorActionPreference = "Continue"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

function Read-Utf8([string]$Path) {
  $bytes = [System.IO.File]::ReadAllBytes($Path)
  if ($bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF) {
    return [System.Text.Encoding]::UTF8.GetString($bytes, 3, $bytes.Length - 3)
  }
  return [System.Text.Encoding]::UTF8.GetString($bytes)
}

function Write-Utf8([string]$Path, [string]$Text) {
  $enc = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($Path, $Text, $enc)
}

function Collapse([string]$s) { return ($s -replace "\s+", " ") }

$Suite = "__tests__/admin/incident-hub.test.ts"
$Actions = "apps/admin/lib/admin/incident-actions.ts"
$Route = "apps/admin/app/api/incidents/[id]/act/route.ts"
$Notice = "apps/admin/components/admin/incidents/HubWithheldAction.tsx"
$Resolve = "apps/admin/app/api/incidents/[id]/resolve/route.ts"

$euro = [char]0x20AC

$probes = @(
  @{
    Name = "re-settle is not offered for a trading contest"
    File = $Actions
    Suite = $Suite
    Find = 's.isProviderGame &&'
    Replace = ''
    Expect = "offers re-settle only for a completed game contest that has a board"
  },
  @{
    Name = "the subject section is required as well as incidents"
    File = $Route
    Suite = $Suite
    Find = '  const subjectGuard = await guardSection(action.section);'
    Replace = ''
    Expect = "checks incidents, then the Map, then the subject section"
  },
  @{
    Name = "a consequence sentence does not live in a component"
    File = $Notice
    Suite = $Suite
    Find = 'is done from Incident Management'
    Replace = 'Immediately close ALL open positions at current market prices. is done from Incident Management'
    Expect = "the trading and game emergency sentences live only in the copy module"
  },
  @{
    Name = "the player is not told a euro amount"
    File = $Resolve
    Suite = $Suite
    Find = 'You have been credited ${formatVolts(comp.amount)}'
    Replace = "You have been credited ${euro}`${comp.amount}"
    Expect = "the player notification uses formatVolts and not a euro amount"
  }
)

$failed = 0
foreach ($p in $probes) {
  $path = Join-Path $Root $p.File
  $orig = Read-Utf8 $path
  if ([string]::IsNullOrEmpty($orig) -or $orig.IndexOf($p.Find) -lt 0) {
    Write-Host "PROBE DID NOT APPLY: $($p.Name)" -ForegroundColor Yellow
    $failed++
    continue
  }
  Write-Utf8 $path ($orig.Replace($p.Find, $p.Replace))
  $targetSuite = $p.Suite
  try {
    $out = & npx vitest run $targetSuite -t $p.Expect 2>&1 | Out-String
    $flat = Collapse $out
  }
  finally {
    Write-Utf8 $path $orig
  }
  $m = [regex]::Matches($flat, "Tests\s+(\d+)\s+failed")
  $failCount = if ($m.Count -gt 0) { [int]$m[$m.Count - 1].Groups[1].Value } else { -1 }
  if ($failCount -eq 1) {
    Write-Host "RED x1  $($p.Name) -> $($p.Expect)" -ForegroundColor Green
  } else {
    Write-Host "UNEXPECTED $($p.Name) failed=$failCount" -ForegroundColor Red
    Write-Host $flat.Substring([Math]::Max(0, $flat.Length - 700))
    $failed++
  }
}

if ($failed -gt 0) { exit 1 }
Write-Host "All incident-hub probes REDx1" -ForegroundColor Green
