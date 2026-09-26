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
# Reason: parameterised per probe — two of these are pinned by a test in the
# outage-pause suite, and run against the default one they report "no test ran",
# which reads exactly like a broken harness rather than a missing guard.
$PauseSuite = "__tests__/services/provider-outage-pause.test.ts"
$Gate = "lib/services/game-providers/provider-entry-gate.ts"
$Pause = "lib/services/game-providers/provider-outage-pause.service.ts"
$Entry = "lib/services/contest-entry.service.ts"

$probes = @(
  @{
    Name = "observed-down blocks entries"
    File = $Gate
    Find = 'return providerObservedDown(provider);'
    Replace = 'return false;'
    Expect = "blocks an observed-down provider"
  },
  @{
    # Re-aimed 20 Sep 2026. The permission gate now sits IN FRONT of the evidence
    # rule, so an unstamped provider is already refused for want of consent and
    # the old target test stayed green against a raw-status read. The only
    # assertion that can still see this is the opted-in-but-never-checked case.
    Name = "R111: gate must not read the raw status"
    File = $Gate
    Find = 'return providerObservedDown(provider);'
    Replace = 'return provider.healthStatus === "down";'
    Expect = "needs the evidence AND the permission"
  },
  @{
    Name = "automatic block is withheld without consent"
    File = $Gate
    Find = 'if (provider.autoOutageResponseEnabled !== true) return false;'
    Replace = 'if (false) return false;'
    Expect = "withholds the automatic block unless the operator opted in"
  },
  @{
    Name = "query form carries the consent as well as the evidence"
    File = $Gate
    Find = '  autoOutageResponseEnabled: true,'
    Replace = ''
    Expect = "the query form carries the permission as well as the evidence"
  },
  @{
    Name = "entry list query uses the consent form"
    File = $Gate
    Find = '$or: [{ enabled: false }, PROVIDER_AUTO_OUTAGE_FILTER],'
    Replace = '$or: [{ enabled: false }, PROVIDER_OBSERVED_DOWN_FILTER],'
    Expect = "both readers of the stored status go through the shared rule"
  },
  @{
    Name = "observed-down needs the status, not only the stamp"
    File = $Gate
    Find = 'if (provider.healthStatus !== "down") return false;'
    Replace = 'if (false) return false;'
    Expect = "requires the stamp as well as the status"
  },
  @{
    Name = "single-provider read projects the stamp"
    File = $Gate
    Find = '.select("enabled healthStatus healthDownSince autoOutageResponseEnabled")'
    Replace = '.select("enabled healthStatus")'
    Expect = "both readers of the stored status go through the shared rule"
  },
  @{
    Name = "R111: pause worker must not read the raw status (structural)"
    File = $Pause
    Find = '    PROVIDER_AUTO_OUTAGE_FILTER,'
    Replace = '    { healthStatus: "down" },'
    Expect = "both readers of the stored status go through the shared rule"
  },
  @{
    Name = "R111: pause worker must not read the raw status (behavioural)"
    File = $Pause
    Suite = $PauseSuite
    Find = '    PROVIDER_AUTO_OUTAGE_FILTER,'
    Replace = '    { healthStatus: "down" },'
    Expect = "does not pause a provider that has never been health checked"
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
  # Reason: NOT named $suite. PowerShell variable names are case-INSENSITIVE, so
  # a lowercase local overwrites $Suite for every later probe — the two probes
  # after the first per-probe override then ran against the wrong file and
  # reported a skipped run, which reads exactly like a missing guard.
  $targetSuite = if ($p.ContainsKey("Suite")) { $p.Suite } else { $Suite }
  try {
    $out = & npx vitest run $targetSuite -t $p.Expect 2>&1 | Out-String
    $flat = Collapse $out
  }
  finally {
    Write-Utf8 $path $orig
  }
  # Reason: read the LAST "Tests N failed" — the failure detail block above the
  # summary also contains the word, and a zero-test run prints no "failed" at
  # all, which must be reported rather than read as a pass.
  $m = [regex]::Matches($flat, "Tests\s+(\d+)\s+failed")
  $failCount = if ($m.Count -gt 0) { [int]$m[$m.Count - 1].Groups[1].Value } else { -1 }
  if ($failCount -eq 1) {
    Write-Host "RED x1  $($p.Name) -> $($p.Expect)" -ForegroundColor Green
  } else {
    Write-Host "UNEXPECTED $($p.Name) failed=$failCount" -ForegroundColor Red
    Write-Host $flat.Substring([Math]::Max(0, $flat.Length - 600))
    $failed++
  }
}

if ($failed -gt 0) { exit 1 }
Write-Host "All pre-start outage probes RED×1" -ForegroundColor Green
