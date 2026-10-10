# Probes the round inspector guards.
#
# Every probe reintroduces a specific defect and names the test that must go red. A probe aimed
# at the wrong test is indistinguishable from a test that does not work, so the harness reports
# whether the RED test is the expected one rather than merely that something failed.

$ErrorActionPreference = 'Continue'

$Suite = '__tests__/admin/round-inspector.test.ts'
$Svc = 'apps/admin/lib/services/games/round-resolution.service.ts'
$Resolve = 'apps/admin/app/api/games/rounds/[roundId]/resolve/route.ts'
$List = 'apps/admin/app/api/games/rounds/route.ts'
$Dash = 'apps/admin/components/admin/AdminDashboard.tsx'
$Actions = 'apps/admin/lib/admin/round-resolution-actions.ts'

function Relax([string]$literal) {
  [regex]::Escape($literal) -replace '\r?\n', '\r?\n'
}

function Probe {
  param(
    [string]$Name,
    [string]$File,
    [string]$Find,
    [string]$Replace,
    [string]$ExpectRed
  )

  # -LiteralPath ON THE READ AS WELL AS THE WRITE, and this cost a destroyed file to learn.
  # These are Next.js dynamic routes, so paths contain `[roundId]` - which PowerShell parses as
  # a WILDCARD character class. `Get-Content $File` matched nothing and returned $null, while
  # `Set-Content -LiteralPath` wrote perfectly well, so the harness emptied the route file and
  # then "restored" it to $null. Every probe against it reported RED on the expected test, for
  # entirely the wrong reason: the file was gone, not the guard.
  #
  # Two rules: **-LiteralPath on every path that could contain a bracket**, and **refuse to
  # write if the read came back empty**, because a harness that can destroy the code under test
  # will eventually report a guard as working when nothing is there at all.
  $original = Get-Content -LiteralPath $File -Raw
  if ([string]::IsNullOrWhiteSpace($original)) {
    Write-Host "  [CANNOT READ FILE - ABORTING PROBE] $Name ($File)" -ForegroundColor Magenta
    return
  }

  $patched = [regex]::Replace($original, (Relax $Find), $Replace.Replace('$', '$$'), 1)

  if ($patched -eq $original) {
    Write-Host "  [PROBE DID NOT APPLY] $Name" -ForegroundColor Magenta
    return
  }

  Set-Content -LiteralPath $File -Value $patched -NoNewline
  try {
    $out = npx vitest run $Suite --reporter=verbose 2>&1 | Out-String
    # Collapse whitespace before matching: Out-String wraps at the console width, so a long
    # test name arrives split across two lines and a literal match silently misses it.
    $flat = ($out -replace '\s+', ' ')

    $failed = 0
    if ($flat -match 'Tests (\d+) failed') { $failed = [int]$Matches[1] }

    if ($failed -gt 0) {
      $hit = if ($flat -match [regex]::Escape(($ExpectRed -replace '\s+', ' '))) {
        'expected test'
      } else { 'OTHER test' }
      Write-Host ("  [RED: {0} failed, {1}] {2}" -f $failed, $hit, $Name) -ForegroundColor Green
    } else {
      Write-Host "  [STILL GREEN - GUARD IS NOT WORKING] $Name" -ForegroundColor Red
    }
  } finally {
    Set-Content -LiteralPath $File -Value $original -NoNewline
  }
}

Write-Host "`n=== the section guard ===" -ForegroundColor Cyan

Probe -Name 'the resolve route drops its guard for the weaker requireAdminAuth' `
  -File $Resolve `
  -Find '  const guard = await guardSection("round-inspector");' `
  -Replace '  const guard = await requireAdminAuth();' `
  -ExpectRed 'resolve asks guardSection'

Probe -Name 'the list route loses its guard entirely' `
  -File $List `
  -Find '  const guard = await guardSection("round-inspector");
  if (!guard.ok) return guard.response;' `
  -Replace '  const guard = { ok: true, admin: { email: "x" } } as never;' `
  -ExpectRed 'list guards every exported handler'

Write-Host "`n=== the score boundary ===" -ForegroundColor Cyan

Probe -Name 'manual resolution gains a score box' `
  -File $Svc `
  -Find '    round.resultSource = "manual";' `
  -Replace '    round.rawScore = 0;
    round.resultSource = "manual";' `
  -ExpectRed 'neither the route nor the service writes a score'

Probe -Name 'an operator can mark a round completed, which means a score landed' `
  -File $Actions `
  -Find '      status: "voided",' `
  -Replace '      status: "completed",' `
  -ExpectRed 'only ever moves a round to a terminal status that scores nothing'

Write-Host "`n=== the mandatory reason ===" -ForegroundColor Cyan

Probe -Name 'the route stops checking the reason length' `
  -File $Resolve `
  -Find '    if (reason.length < MIN_REASON_LENGTH) {' `
  -Replace '    if (false) {' `
  -ExpectRed 'the route refuses a short reason before doing anything'

Probe -Name 'the service trusts the route and drops its own reason check' `
  -File $Svc `
  -Find '  if (!reason || reason.trim().length < MIN_REASON_LENGTH) {' `
  -Replace '  if (false) {' `
  -ExpectRed 'the service refuses too, so a second caller cannot skip it'

Probe -Name 'the audit entry is filed as a settings change rather than a contest decision' `
  -File $Resolve `
  -Find '      category: "competition",' `
  -Replace '      category: "settings",' `
  -ExpectRed 'the audit entry is written after the change succeeds'

Write-Host "`n=== the untrusted key ===" -ForegroundColor Cyan

Probe -Name 'the action is looked up by indexing an object again' `
  -File $Svc `
  -Find '  const target = RESOLUTION_ACTIONS.get(action);' `
  -Replace '  const target = RESOLUTION_ACTIONS[action as never];' `
  -ExpectRed 'looks the action up in a Map, never by indexing an object'

Write-Host "`n=== the state machine and the list ===" -ForegroundColor Cyan

Probe -Name 'the service decides transitions itself instead of asking the model' `
  -File $Svc `
  -Find '    if (!canTransitionRound(round.status as RoundStatus, target.status)) {' `
  -Replace '    if (round.status === "completed") {' `
  -ExpectRed 'asks canTransitionRound rather than deciding for itself'

Probe -Name 'a manual resolution is indistinguishable from an automatic give-up' `
  -File $Svc `
  -Find '    round.resultSource = "manual";' `
  -Replace '    round.resultReceivedAt = new Date();' `
  -ExpectRed 'records that a human decided the outcome'

Probe -Name 'every unresolved round claims to be holding settlement' `
  -File $Svc `
  -Find '      holdingSettlement:
        r.status === "unresolved" &&
        contest?.unresolvedRoundPolicy === "hold_and_alert",' `
  -Replace '      holdingSettlement: r.status === "unresolved",' `
  -ExpectRed 'flags holding-settlement only for hold_and_alert contests'

Write-Host "`n=== reachability ===" -ForegroundColor Cyan

Probe -Name 'the section renders but has no menu entry, so nobody can reach it' `
  -File $Dash `
  -Find '        id: "round-inspector",' `
  -Replace '        id: "round-inspector-DISABLED",' `
  -ExpectRed 'the dashboard both lists it and renders it'

Write-Host ''
