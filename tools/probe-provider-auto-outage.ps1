# Probe: the opt-in automatic outage response (owner decision, 20 September 2026).
#
# The property under test is that the platform NEVER takes a provider off sale by
# itself unless an operator switched the automation on for that provider - and that
# it still watches and still alerts either way. Each probe reintroduces one half of
# the behaviour that was removed and must turn EXACTLY one named test red.
#
# Parameterised on the SUITE per probe: these guards live in three files, and a probe
# run against the wrong suite reports "no test ran", which reads exactly like a
# broken harness rather than a missing guard.

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

$KillSuite = "__tests__/services/provider-kill-switch.test.ts"
$PauseSuite = "__tests__/services/provider-outage-pause.test.ts"
$AdminSuite = "__tests__/admin/game-providers-admin.test.ts"

$Kill = "lib/services/game-providers/provider-kill-switch.service.ts"
$Pause = "lib/services/game-providers/provider-outage-pause.service.ts"
$Route = "apps/admin/app/api/games/providers/[providerKey]/route.ts"
$AdminSvc = "apps/admin/lib/services/game-providers/provider-admin.service.ts"
$Section = "apps/admin/components/admin/games/GameProvidersSection.tsx"

$probes = @(
  @{
    # The defect this change exists to remove: the worker disabling a provider unasked.
    Name = "kill switch never disables without consent"
    File = $Kill
    Suite = $KillSuite
    Find = 'const mayAct = provider.autoOutageResponseEnabled === true;'
    Replace = 'const mayAct = true;'
    Expect = "does NOT disable when automatic response was never enabled"
  },
  @{
    # The other half of the same test, and the reason it asserts the alert rather than
    # merely permitting it: withholding the action must not withhold the warning.
    Name = "the alert is claimed once per outage episode"
    File = $Kill
    Suite = $KillSuite
    Find = '  return Boolean(claimed);'
    Replace = '  return true;'
    Expect = "does NOT disable when automatic response was never enabled"
  },
  @{
    Name = "pause worker asks for consent, not only for evidence"
    File = $Pause
    Suite = $PauseSuite
    Find = '    PROVIDER_AUTO_OUTAGE_FILTER,'
    Replace = '    { healthStatus: "down", healthDownSince: { $type: "date" } },'
    Expect = "does not pause when automatic outage response was never enabled"
  },
  @{
    # The asymmetry. Gating the RESUME on the flag strands every system-paused contest
    # the moment an operator switches the automation off, which is the likeliest moment
    # for them to do it.
    Name = "resume is deliberately NOT gated on consent"
    File = $Pause
    Suite = $PauseSuite
    Find = '      const evidence = classifyProviderEvidence(counts);'
    Replace = '      const evidence = classifyProviderEvidence(counts);
      if (
        !(await GameProvider.exists({
          providerKey: key,
          autoOutageResponseEnabled: true,
        }))
      ) {
        continue;
      }'
    Expect = "resumes a system pause even after the automation was switched off"
  },
  @{
    Name = "the toggle must not move the sale switch"
    File = $AdminSvc
    Suite = $AdminSuite
    Find = '    { $set: { autoOutageResponseEnabled } },'
    Replace = '    { $set: { autoOutageResponseEnabled, enabled: autoOutageResponseEnabled } },'
    Expect = "never touches the sale switch"
  },
  @{
    Name = "the toggle refuses an unknown provider"
    File = $AdminSvc
    Suite = $AdminSuite
    Find = '  if (!updated) return { success: false, error: "Provider not found." };'
    Replace = ''
    Expect = "refuses an unknown provider rather than creating one"
  },
  @{
    Name = "route refuses both switches in one request"
    File = $Route
    Suite = $AdminSuite
    Find = '      typeof body.enabled === "boolean" &&'
    Replace = '      false &&'
    Expect = "refuses a request that carries both switches"
  },
  @{
    Name = "route reaches the toggle service, not the sale one"
    File = $Route
    Suite = $AdminSuite
    Find = 'await setProviderAutoOutageResponse('
    Replace = 'await setProviderEnabled('
    Expect = "refuses a request that carries both switches"
  },
  @{
    Name = "audit line names the automation and what it permits"
    File = $Route
    Suite = $AdminSuite
    Find = 'Automatic outage response ${'
    Replace = 'Provider settings changed ${'
    Expect = "records which automation was changed"
  },
  @{
    Name = "audit records the value the operator chose"
    File = $Route
    Suite = $AdminSuite
    Find = 'newValue: body.autoOutageResponseEnabled,'
    Replace = 'newValue: true,'
    Expect = "records which automation was changed"
  },
  @{
    # A card rendering one switch while describing two is read as "I turned the
    # automation off" by an operator whose games are still being pulled by a worker.
    Name = "the second switch exists and has its own handler"
    File = $Section
    Suite = $AdminSuite
    Find = 'onCheckedChange={onToggleAutoResponse}'
    Replace = 'onCheckedChange={onToggle}'
    Expect = "renders both switches on the card"
  },
  @{
    Name = "the copy says what stays the operator's decision"
    File = $Section
    Suite = $AdminSuite
    Find = 'stay your decision'
    Replace = 'are unaffected'
    Expect = "renders both switches on the card"
  }
)

$failed = 0
foreach ($p in $probes) {
  $path = Join-Path $Root $p.File
  $orig = Read-Utf8 $path
  if ([string]::IsNullOrEmpty($orig) -or $orig.IndexOf($p.Find) -lt 0) {
    # DID NOT APPLY means the target MOVED, never that the run was quiet.
    Write-Host "PROBE DID NOT APPLY: $($p.Name)" -ForegroundColor Yellow
    $failed++
    continue
  }
  Write-Utf8 $path ($orig.Replace($p.Find, $p.Replace))
  # Reason: NOT named $suite. PowerShell variable names are case-insensitive, so a
  # lowercase local would overwrite a script-level $Suite for every later probe.
  $targetSuite = $p.Suite
  try {
    $out = & npx vitest run $targetSuite -t $p.Expect 2>&1 | Out-String
    $flat = Collapse $out
  }
  finally {
    Write-Utf8 $path $orig
  }
  # Reason: read the LAST "Tests N failed" - the failure detail block above the summary
  # also contains the word, and a zero-test run prints no "failed" at all, which must be
  # reported rather than read as a pass.
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
Write-Host "All automatic-outage-response probes REDx1" -ForegroundColor Green
