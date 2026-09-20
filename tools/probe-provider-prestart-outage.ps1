# Probe: X9 pre-start outage responses.
# Expect each probe to turn EXACTLY one named test red.

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

$Suite = "__tests__/services/provider-prestart-outage.test.ts"
$Gate = "lib/services/game-providers/provider-entry-gate.ts"
$Entry = "lib/services/contest-entry.service.ts"

$probes = @(
  @{
    Name = "down blocks entries"
    File = $Gate
    Find = 'return provider.healthStatus === "down";'
    Replace = 'return false;'
    Expect = "blocks down and disabled"
  },
  @{
    Name = "hide empty upcoming"
    File = $Gate
    Find = 'if (seats > 0) return false;'
    Replace = 'if (seats > 0) return true;'
    Expect = "keeps contests that already have seats"
  },
  @{
    Name = "entry wiring after seat check"
    File = $Entry
    Find = 'fail("provider_unavailable", PROVIDER_OUTAGE_ENTRY_MESSAGE)'
    Replace = 'fail("failed", "x")'
    Expect = "enterContest refuses with provider_unavailable"
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
  try {
    $out = & npx vitest run $Suite -t $p.Expect 2>&1 | Out-String
    $flat = Collapse $out
  }
  finally {
    Write-Utf8 $path $orig
  }
  $passCount = if ($flat -match "Tests\s+(\d+)\s+failed") { [int]$Matches[1] } else { -1 }
  if ($passCount -eq 1) {
    Write-Host "RED×1 $($p.Name) → $($p.Expect)" -ForegroundColor Green
  } else {
    Write-Host "UNEXPECTED $($p.Name) failed=$passCount" -ForegroundColor Red
    Write-Host $flat.Substring(0, [Math]::Min(400, $flat.Length))
    $failed++
  }
}

if ($failed -gt 0) { exit 1 }
Write-Host "All pre-start outage probes RED×1" -ForegroundColor Green
