# Probes the X6 contest-wizard guards by reintroducing each defect and confirming the
# suite goes red. A test that only ever passes proves nothing.
#
# Uses escaped, newline-relaxed patterns because a multi-line pattern with CRLF does not
# match an LF file, and a probe that fails to apply is indistinguishable from a test that
# does not work. Every probe asserts the file actually changed before believing the result.

$ErrorActionPreference = 'Continue'
$env:NODE_OPTIONS = ''

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

  $original = Get-Content $File -Raw
  $patched = [regex]::Replace($original, (Relax $Find), $Replace.Replace('$', '$$'), 1)

  if ($patched -eq $original) {
    Write-Host "  [PROBE DID NOT APPLY] $Name" -ForegroundColor Magenta
    return
  }

  Set-Content -LiteralPath $File -Value $patched -NoNewline
  try {
    $out = npx vitest run __tests__/services/provider-contest-create.test.ts --reporter=dot 2>&1 | Out-String
    $failed = 0
    if ($out -match 'Tests\s+(\d+)\s+failed') { $failed = [int]$Matches[1] }

    # Collapse all whitespace before matching. Out-String wraps at the console width, so a
    # long test name arrives split across two lines and a literal match silently misses it -
    # which is how every probe reported "OTHER test" on the first run.
    $flat = ($out -replace '\s+', ' ')
    $want = ($ExpectRed -replace '\s+', ' ')

    if ($failed -gt 0) {
      $hit = if ($flat -match [regex]::Escape($want)) { 'expected test' } else { 'OTHER test' }
      Write-Host ("  [RED: {0} failed, {1}] {2}" -f $failed, $hit, $Name) -ForegroundColor Green
    } else {
      Write-Host "  [STILL GREEN - GUARD IS NOT WORKING] $Name" -ForegroundColor Red
    }
  } finally {
    Set-Content -LiteralPath $File -Value $original -NoNewline
  }
}

Write-Host "`n=== probing the pre-flight checklist ===" -ForegroundColor Cyan

Probe -Name 'master switch becomes a refusal instead of a warning' `
  -File 'lib/services/games/contest-preflight.ts' `
  -Find '    warnings.push(
      "External games are switched off platform-wide' `
  -Replace '    errors.push(
      "External games are switched off platform-wide' `
  -ExpectRed 'warns, but does not refuse, when external games are off'

Probe -Name 'grace-period floor removed' `
  -File 'lib/services/games/contest-preflight.ts' `
  -Find '    if (input.resultGracePeriodSeconds < requiredGrace) {' `
  -Replace '    if (false) {' `
  -ExpectRed 'refuses a grace period below one round plus five minutes'

Probe -Name 'play window shorter than a round is allowed' `
  -File 'lib/services/games/contest-preflight.ts' `
  -Find '    if (windowSeconds > 0 && windowSeconds < roundSeconds) {' `
  -Replace '    if (false) {' `
  -ExpectRed 'refuses a play window shorter than one round'

Probe -Name 'chartvoltEnabled ignored, provider status trusted alone' `
  -File 'lib/services/games/contest-preflight.ts' `
  -Find '  if (!input.chartvoltEnabled) {' `
  -Replace '  if (false) {' `
  -ExpectRed 'refuses when we have not enabled the title'

Probe -Name 'single-player paid contest permitted' `
  -File 'lib/services/games/contest-preflight.ts' `
  -Find '  if (input.format === "competition" && input.minParticipants < 2) {' `
  -Replace '  if (false) {' `
  -ExpectRed 'refuses a single-player paid contest'

Write-Host "`n=== probing the settings schema ===" -ForegroundColor Cyan

Probe -Name 'unsupported root keyword ignored instead of refused' `
  -File 'lib/services/games/config-schema.ts' `
  -Find '  if (unknownRoot.length > 0) {' `
  -Replace '  if (false) {' `
  -ExpectRed 'FAILS CLOSED on a keyword it does not implement'

Probe -Name 'undeclared keys pass through to the provider' `
  -File 'lib/services/games/config-schema.ts' `
  -Find '  for (const field of fields) {
    const label' `
  -Replace '  for (const k of Object.keys(submitted)) values[k] = submitted[k];
  for (const field of fields) {
    const label' `
  -ExpectRed 'drops any key the schema does not declare'

Write-Host "`n=== probing the stored-contest bridge ===" -ForegroundColor Cyan

Probe -Name 'missing attempts policy silently defaults to single' `
  -File 'lib/services/games/contest-config.ts' `
  -Find '  if (!contest.attemptsPolicy) {
    return { ok: false, error: "This contest has no attempts policy." };
  }' `
  -Replace '  if (!contest.attemptsPolicy) {
    contest = { ...contest, attemptsPolicy: "single" };
  }' `
  -ExpectRed 'REFUSES a contest missing round settings'

Probe -Name 'stale allowance survives the single-attempt policy' `
  -File 'lib/services/games/contest-config.ts' `
  -Find '        attemptsPolicy === "single" ? undefined : contest.attemptsAllowed,' `
  -Replace '        contest.attemptsAllowed,' `
  -ExpectRed 'drops a stale allowance under the single-attempt policy'

Write-Host "`n=== probing the structural guards ===" -ForegroundColor Cyan

Probe -Name 'contest created visible to players instead of as a draft' `
  -File 'apps/admin/lib/services/game-providers/provider-contest.service.ts' `
  -Find '      status: "draft",' `
  -Replace '      status: "upcoming",' `
  -ExpectRed 'the create service writes status draft'

Probe -Name 'player lobby stops excluding drafts' `
  -File 'app/api/competitions/route.ts' `
  -Find '      status: { $ne: "draft" },' `
  -Replace '      status: { $in: ["active", "completed"] },' `
  -ExpectRed 'excludes draft in the query itself'

Probe -Name 'startingCapital made unconditional again' `
  -File 'database/models/trading/competition.model.ts' `
  -Find '      required: function (this: { gameType?: string }) {' `
  -Replace '      requiredDisabled: function (this: { gameType?: string }) {' `
  -ExpectRed 'startingCapital is still required for a trading competition'

Probe -Name 'a trading field leaks into the provider create path' `
  -File 'apps/admin/lib/services/game-providers/provider-contest.service.ts' `
  -Find '      entryFee: input.entryFee,' `
  -Replace '      startingCapital: 10000,
      entryFee: input.entryFee,' `
  -ExpectRed 'the provider create path sets no trading field'

Probe -Name 'the field renderer branches on a game code' `
  -File 'apps/admin/components/admin/games/ConfigSchemaFields.tsx' `
  -Find '  if (field.type === "boolean") {' `
  -Replace '  if (field.gameCode === "special") return null;
  if (field.type === "boolean") {' `
  -ExpectRed 'branches on declared type, never on a game or provider'

Probe -Name 'contest API guarded on provider credentials instead of competitions' `
  -File 'apps/admin/app/api/games/contests/route.ts' `
  -Find '  const guard = await guardSection("competitions");
  if (!guard.ok) return guard.response;

  try {
    const titles' `
  -Replace '  const guard = await guardSection("game-providers");
  if (!guard.ok) return guard.response;

  try {
    const titles' `
  -ExpectRed 'guarded on competitions, not on provider credentials'

Write-Host "`n=== confirming the suite is green again ===" -ForegroundColor Cyan
$final = npx vitest run __tests__/services/provider-contest-create.test.ts --reporter=dot 2>&1 | Out-String
if ($final -match 'Tests\s+(\d+)\s+passed') {
  Write-Host "  restored: $($Matches[1]) passed" -ForegroundColor Green
} else {
  Write-Host "  RESTORE FAILED - inspect git diff" -ForegroundColor Red
}
