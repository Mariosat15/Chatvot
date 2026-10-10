# Probe: X9 dedicated re-settle guards.
# Expect each probe to turn EXACTLY one named test red.
#
# Reason: $ErrorActionPreference must be Continue — npm's ExperimentalWarning on
# stderr aborts the run under Stop and can leave a mutated file unrestored.

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

$Suite = "__tests__/services/provider-resettle.test.ts"
$Service = "lib/services/settlement/provider-resettle.service.ts"
$Model = "database/models/games/game-round.model.ts"

$probes = @(
  @{
    Name = "completed-to-voided transition"
    File = $Model
    Find = '["completed", ["voided"]],'
    Replace = '["completed", []],'
    Expect = "permits completed/abandoned/expired"
  },
  @{
    Name = "trading refusal"
    File = $Service
    Find = 'error: "Re-settle is for provider contests only. Use Adjust results for trading.",'
    Replace = 'error: "ok",'
    Expect = "refuses a trading contest"
  },
  @{
    Name = "route guard"
    File = "apps/admin/app/api/competitions/[id]/re-settle/route.ts"
    Find = 'guardSection("competitions")'
    Replace = 'guardSection("overview")'
    Expect = "route guards with competitions"
  }
)

$failed = 0
foreach ($p in $probes) {
  $path = Join-Path $Root $p.File
  $orig = Read-Utf8 $path
  if ([string]::IsNullOrEmpty($orig)) {
    Write-Host "HARNESS BROKEN (empty read): $($p.Name)" -ForegroundColor Magenta
    $failed++
    continue
  }
  if ($orig.IndexOf($p.Find) -lt 0) {
    Write-Host "PROBE DID NOT APPLY: $($p.Name)" -ForegroundColor Yellow
    $failed++
    continue
  }
  Write-Utf8 $path ($orig.Replace($p.Find, $p.Replace))
  $onDisk = Read-Utf8 $path
  if ($onDisk -eq $orig) {
    Write-Host "HARNESS BROKEN (unchanged): $($p.Name)" -ForegroundColor Magenta
    $failed++
    continue
  }
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
Write-Host "All re-settle probes RED×1" -ForegroundColor Green
