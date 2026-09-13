# Probes for the provider health panel (X6's fifth destination) and the R38 stamp.
#
# Harness rules, every one of which has produced a false result on this codebase before:
#   * -LiteralPath on the READ as well as the write.
#   * UTF-8 without a BOM both ways, or emoji in the touched services come back as mojibake.
#   * Refuse to write empty content.
#   * Match with newlines relaxed, substitute as a plain string.
#   * Name the expected failing test, run it alone with -t, and treat "no test matched" as a
#     BROKEN PROBE rather than as a pass.

$ErrorActionPreference = 'Continue'

$Utf8NoBom = New-Object System.Text.UTF8Encoding($false)

$HEALTH_SUITE = '__tests__/admin/provider-health.test.ts'
$ROUND_SUITE = '__tests__/services/round-lifecycle.test.ts'

$SERVICE = 'apps/admin/lib/services/games/provider-health.service.ts'
$ROUTE = 'apps/admin/app/api/games/provider-health/route.ts'
$PANEL = 'apps/admin/components/admin/games/ProviderHealthSection.tsx'
$INGEST = 'lib/services/games/result-ingestion.service.ts'
$DTO = 'apps/admin/lib/services/game-providers/provider-admin.service.ts'

function Read-Source([string]$Path) {
  $resolved = (Resolve-Path -LiteralPath $Path).Path
  $text = [System.IO.File]::ReadAllText($resolved, $Utf8NoBom)
  if ([string]::IsNullOrWhiteSpace($text)) { throw "Read of $Path returned nothing." }
  return $text
}

function Write-Source([string]$Path, [string]$Text) {
  if ([string]::IsNullOrWhiteSpace($Text)) { throw "Refusing to write empty content to $Path." }
  $resolved = (Resolve-Path -LiteralPath $Path).Path
  [System.IO.File]::WriteAllText($resolved, $Text, $Utf8NoBom)
}

function To-Pattern([string]$Literal) {
  return [Regex]::Escape($Literal) -replace '(\\r)?\\n', '\r?\n'
}

$probes = @(
  @{
    Name  = 'the stored healthStatus is rendered instead of a derived verdict'
    File  = $SERVICE
    From  = '    ...verdictFor({ blockers, rounds, events }),'
    To    = '    verdict: provider.healthStatus as never, summary: "stored",'
    Test  = 'reports a provider healthy while its stored healthStatus still says down'
    Suite = $HEALTH_SUITE
  },
  @{
    Name  = 'no traffic is reported as healthy'
    File  = $SERVICE
    From  = '      verdict: "no_traffic",
      summary: `No rounds started in the last ${WINDOW_HOURS} hours, so there is nothing to judge this provider by.`,'
    To    = '      verdict: "healthy",
      summary: `No rounds started in the last ${WINDOW_HOURS} hours.`,'
    Test  = 'says so rather than reporting healthy or down'
    Suite = $HEALTH_SUITE
  },
  @{
    Name  = 'live rounds are counted as evidence of success'
    File  = $SERVICE
    From  = '  if (rounds.completed === 0) {'
    To    = '  if (false) {'
    Test  = 'treats rounds that are all still in play as no evidence either'
    Suite = $HEALTH_SUITE
  },
  @{
    Name  = 'configuration stops outranking traffic, so a switch reads as an outage'
    File  = $SERVICE
    From  = '  if (blockers.length > 0) {'
    To    = '  if (blockers.length > 99) {'
    Test  = 'configuration outranks traffic, so a switch is never reported as an outage'
    Suite = $HEALTH_SUITE
  },
  @{
    Name  = 'the missing callback credential blocker is dropped'
    File  = $SERVICE
    From  = '    if (!credential?.callbackToken || !credential?.callbackSecret) {'
    To    = '    if (false) {'
    Test  = 'reports not_configured and names the missing callback credentials'
    Suite = $HEALTH_SUITE
  },
  @{
    Name  = 'the master switch and the provider switch are collapsed into one blocker'
    File  = $SERVICE
    From  = '    if (!provider.enabled) {
      blockers.push("This provider is disabled.");
    }'
    To    = '    if (false) {
      blockers.push("This provider is disabled.");
    }'
    Test  = 'names the master switch separately from the provider switch'
    Suite = $HEALTH_SUITE
  },
  @{
    Name  = 'signature failures are folded into a general error count'
    File  = $SERVICE
    From  = '  if (events.signatureInvalid > 0 && events.scored === 0) {'
    To    = '  if (false) {'
    Test  = 'reports down when every delivery failed verification'
    Suite = $HEALTH_SUITE
  },
  @{
    Name  = 'a duplicate delivery is counted as a failure'
    File  = $SERVICE
    From  = '    const duplicates = eventsWith("duplicate_ignored");'
    To    = '    const duplicates = 0;'
    Test  = 'does not count a duplicate delivery as a failure'
    Suite = $HEALTH_SUITE
  },
  @{
    Name  = 'unresolved rounds are judged by a flat count rather than a share'
    File  = $SERVICE
    From  = '  if (unresolvedShare > DEGRADED_UNRESOLVED_SHARE) {'
    To    = '  if (rounds.unresolved > 5) {'
    Test  = 'degrades when a meaningful share never reported'
    Suite = $HEALTH_SUITE
  },
  @{
    Name  = 'the last-successful-round query is windowed'
    File  = $SERVICE
    From  = '      { $match: { status: "completed" } },'
    To    = '      { $match: { status: "completed", createdAt: { $gte: since } } },'
    Test  = 'finds the last round that scored even when it is outside the window'
    Suite = $HEALTH_SUITE
  },
  @{
    Name  = 'the round counts stop respecting the window'
    File  = $SERVICE
    From  = '      { $match: { createdAt: { $gte: since } } },
      {
        $group: {
          _id: { providerKey: "$providerKey", status: "$status" },'
    To    = '      {
        $group: {
          _id: { providerKey: "$providerKey", status: "$status" },'
    Test  = 'counts rounds only inside the window'
    Suite = $HEALTH_SUITE
  },
  @{
    Name  = 'the route settles for being an admin at all'
    File  = $ROUTE
    From  = 'const guard = await guardSection("provider-health");'
    To    = 'const guard = { ok: true, response: null } as never;'
    Test  = 'guards the route by section, not merely by being an admin'
    Suite = $HEALTH_SUITE
  },
  @{
    Name  = 'the panel renders the unwritten stored field'
    File  = $PANEL
    From  = '  lastSuccessfulRoundAt?: string | null;'
    To    = '  lastSuccessfulRoundAt?: string | null;
  storedStatus?: string;
  lastHealthCheckAt?: string;'
    Test  = 'neither the service nor the panel reads the stored health field'
    Suite = $HEALTH_SUITE
  },
  @{
    Name  = 'the unwritten fields go back on the provider list wire'
    File  = $DTO
    From  = '      enabled: provider.enabled,
      lastCatalogueSyncAt: provider.lastCatalogueSyncAt,'
    To    = '      enabled: provider.enabled,
      healthStatus: provider.healthStatus,
      lastCatalogueSyncAt: provider.lastCatalogueSyncAt,'
    Test  = 'keeps the unwritten fields off the provider list wire as well'
    Suite = $HEALTH_SUITE
  },
  @{
    Name  = 'the panel grows a round list, duplicating the inspector'
    File  = $PANEL
    From  = 'const response = await fetch("/api/games/provider-health");'
    To    = 'const response = await fetch("/api/games/rounds");'
    Test  = 'does not duplicate the round inspector''s job'
    Suite = $HEALTH_SUITE
  },
  @{
    Name  = 'the menu entry is removed, leaving the section clickable by nobody'
    File  = 'apps/admin/components/admin/AdminDashboard.tsx'
    From  = '        id: "provider-health",
        label: "Provider Health",'
    To    = '        id: "provider-health-disabled",
        label: "Provider Health",'
    Test  = 'is wired into the admin navigation and the render switch'
    Suite = $HEALTH_SUITE
  },
  @{
    Name  = 'R38: the lastSuccessfulRoundAt writer is removed again'
    File  = $INGEST
    From  = '  if (target === "completed") {'
    To    = '  if (false) {'
    Test  = 'stamps lastSuccessfulRoundAt when a result scores'
    Suite = $ROUND_SUITE
  },
  @{
    Name  = 'R38: every terminal status is stamped, including ones that scored nothing'
    File  = $INGEST
    From  = '  if (target === "completed") {'
    To    = '  if (true) {'
    Test  = 'does not stamp a round that ended without a score'
    Suite = $ROUND_SUITE
  }
)

$failures = 0

foreach ($probe in $probes) {
  Write-Host ''
  Write-Host "PROBE: $($probe.Name)" -ForegroundColor Cyan

  $original = Read-Source $probe.File

  if ($original -notmatch (To-Pattern $probe.From)) {
    Write-Host "  DID NOT APPLY - pattern not found in $($probe.File)" -ForegroundColor Yellow
    $failures++
    continue
  }

  $broken = $original.Replace($probe.From, $probe.To)
  if ($broken -eq $original) {
    Write-Host "  DID NOT APPLY - $($probe.File) unchanged" -ForegroundColor Yellow
    $failures++
    continue
  }

  Write-Source $probe.File $broken

  try {
    $raw = & npx vitest run $probe.Suite -t "$($probe.Test)" 2>&1
    $out = (($raw | Out-String) -replace '\s+', ' ')
  } finally {
    Write-Source $probe.File $original
  }

  if ($out -match 'No test files found|Tests\s+no tests') {
    Write-Host "  PROBE BROKEN - no test matched `"$($probe.Test)`"" -ForegroundColor Magenta
    $failures++
  } elseif ($out -match 'Tests\s+(\d+)\s+failed') {
    $red = [int]$Matches[1]
    if ($red -eq 1) {
      Write-Host '  RED as expected (1 test failed)' -ForegroundColor Green
    } else {
      Write-Host "  RED but $red tests failed - blast radius larger than expected" -ForegroundColor Yellow
      $failures++
    }
  } elseif ($out -notmatch 'Tests\s+\d+\s+passed') {
    Write-Host "  PROBE BROKEN - no test matched `"$($probe.Test)`"" -ForegroundColor Magenta
    $failures++
  } else {
    Write-Host '  GREEN - the guard is not doing its job' -ForegroundColor Red
    $failures++
  }
}

Write-Host ''
if ($failures -eq 0) {
  Write-Host "All $($probes.Count) probes behaved as expected." -ForegroundColor Green
} else {
  Write-Host "$failures of $($probes.Count) probes did not behave as expected." -ForegroundColor Red
}
