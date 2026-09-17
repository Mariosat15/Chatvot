# R96b probes — per-game coverage, games-only parity, neutral ladder, run_full.
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
    [string]$Suite = '__tests__/admin/r96b-gamification-orchestration.test.ts'
  )

  $full = Join-Path $Root $File
  $orig = Read-Utf8 $full
  # Reason: an empty read plus a happy write empties the file and every probe
  # then goes red for the wrong reason — refuse rather than report damage.
  if ([string]::IsNullOrEmpty($orig)) { throw "PROBE DID NOT APPLY (empty read): $File" }

  $idx = $orig.IndexOf($Find)
  if ($idx -lt 0) { throw "PROBE DID NOT APPLY (Find miss): $Name" }
  $mut = $orig.Remove($idx, $Find.Length).Insert($idx, $Replace)
  if ($mut -eq $orig) { throw "PROBE DID NOT APPLY (no change): $Name" }
  Write-Utf8 $full $mut

  try {
    $out = npx vitest run $Suite -t $ExpectTest 2>&1 | Out-String
    $failed = [regex]::Match($out, 'Tests\s+(\d+)\s+failed').Groups[1].Value
    $passed = [regex]::Match($out, 'Tests\s+.*?(\d+)\s+passed').Groups[1].Value
    if ($failed -eq '1') { Write-Host "RED x1  $Name" }
    else {
      Write-Host "FAIL    $Name  failed='$failed' passed='$passed'  expect=$ExpectTest"
      ($out -split "`n") | Where-Object { $_ -match 'FAIL|AssertionError|No test files|×' } |
        Select-Object -First 6 | ForEach-Object { Write-Host "  $($_.Trim())" }
    }
  } finally {
    Write-Utf8 $full $orig
  }
}

$COVERAGE = 'apps/admin/lib/services/games/gamification-coverage.ts'
$LADDER   = 'apps/admin/lib/admin/neutral-level-ladder.ts'
$ENGINE   = 'apps/admin/lib/gamification-engine.ts'
$ROUTE    = 'apps/admin/app/api/ai/gamification-wizard/route.ts'
$UI       = 'apps/admin/components/admin/GamificationWizardSection.tsx'

# ── Coverage ─────────────────────────────────────────────────────────────────

# 1 — credit platform badges to every game, so a brand-new title reports covered
#
#     Re-aimed 17 Sep 2026: the rarity writes moved behind `addCount` when the
#     module's object-injection warnings were cleared, so the old anchor
#     (`platformHave[rarity] += 1;`) reported "DID NOT APPLY" — which reads like
#     a broken harness rather than a moved target. The claim is unchanged.
Invoke-Probe -Name 'platform-credited-to-games' -File $COVERAGE `
  -Find 'addCount(platformHave, rarity);' `
  -Replace 'addCount(platformHave, rarity); for (const row of perGame.values()) addCount(row, rarity);' `
  -ExpectTest 'does not credit a platform badge to any game'

# 2 — stop inferring per-game scope from a game_* milestone condition
Invoke-Probe -Name 'milestone-scope-not-inferred' -File $COVERAGE `
  -Find 'const isGameScoped = conditionType.startsWith("game_");' `
  -Replace 'const isGameScoped = false;' `
  -ExpectTest 'infers per-game scope from a game'

# 3 — divide by zero on an empty catalogue of badges
Invoke-Probe -Name 'parity-divide-by-zero' -File $COVERAGE `
  -Find 'const ratio = traderXp === 0 ? 1 : gamesOnlyXp / traderXp;' `
  -Replace 'const ratio = gamesOnlyXp / traderXp;' `
  -ExpectTest 'reports parity rather than a divide-by-zero'

# 4 — parity measured against the trader instead of the games-only player
#     (both arms read the trader, so a lock-out scores 10)
Invoke-Probe -Name 'parity-reads-trader-twice' -File $COVERAGE `
  -Find 'playedGameKeys: allGameKeys,
        hasTradingActivity: false,' `
  -Replace 'playedGameKeys: allGameKeys,
        hasTradingActivity: true,' `
  -ExpectTest 'reports a games-only player locked out'

# ── Engine criterion ─────────────────────────────────────────────────────────

# 5 — score parity even with no catalogue, so a trading-only deployment is
#     marked down for a games-only player it does not have
Invoke-Probe -Name 'parity-scored-without-catalogue' -File $ENGINE `
  -Find 'if (games.length > 0) {' `
  -Replace 'if (true) {' `
  -ExpectTest 'is scored only when a catalogue is supplied'

# ── Neutral ladder ───────────────────────────────────────────────────────────

# 6 — overlapping bands
Invoke-Probe -Name 'ladder-bands-overlap' -File $LADDER `
  -Find 'const maxXP = isLast ? Number.MAX_SAFE_INTEGER : minXP + rounded - 1;' `
  -Replace 'const maxXP = isLast ? Number.MAX_SAFE_INTEGER : minXP + rounded;' `
  -ExpectTest 'proposes a monotonic ladder'

# 7 — stop flagging a game noun in a title
Invoke-Probe -Name 'audit-ignores-game-nouns' -File $LADDER `
  -Find 'if (title && GAME_NOUNS.test(title)) tradingShapedTitles.push(title);' `
  -Replace 'if (false) tradingShapedTitles.push(title);' `
  -ExpectTest 'flags the shipped trading-shaped ladder'

# 8 — stop flagging a non-increasing threshold
Invoke-Probe -Name 'audit-ignores-monotonicity' -File $LADDER `
  -Find 'if (min <= previousMin) monotonic = false;' `
  -Replace 'if (false) monotonic = false;' `
  -ExpectTest 'flags a non-monotonic ladder'

# ── run_full pipeline ────────────────────────────────────────────────────────

# 9 — overwrite an operator's ladder on every run
Invoke-Probe -Name 'ladder-overwritten' -File $ROUTE `
  -Find 'if (proposeLadder && existingLevels.length === 0) {' `
  -Replace 'if (proposeLadder) {' `
  -ExpectTest 'writes a ladder only when none exists'

# 10 — replace mode, so a later run overwrites authored badges
Invoke-Probe -Name 'run-full-replaces-badges' -File $ROUTE `
  -Find 'mode: "add-only",' `
  -Replace 'mode: "replace",' `
  -ExpectTest 'drives badge generation in add-only mode'

# 11 — drop the deterministic fix stage
Invoke-Probe -Name 'run-full-skips-autofix' -File $ROUTE `
  -Find 'steps.autoFix = await applyAutoFixes();' `
  -Replace 'steps.autoFix = null; const _deadFixer = applyAutoFixes;' `
  -ExpectTest 'chains all four stages in one action'

# 12 — stop reporting the post-run gap
Invoke-Probe -Name 'run-full-hides-gap' -File $ROUTE `
  -Find 'const finalCoverage = await computeCoverage();' `
  -Replace 'const finalCoverage = steps.badges;' `
  -ExpectTest 'reports the post-run gap'

# 13 — browser owns the sequence again
Invoke-Probe -Name 'ui-chains-client-side' -File $UI `
  -Find 'action: "run_full",' `
  -Replace 'action: "agent_badges",' `
  -ExpectTest 'delegates the sequence to the server'

# 14 — let the two seeded badge catalogues drift again. The admin copy had silently
# lagged the main one through R96a and R96b, and check:mirrors compares models only.
Invoke-Probe -Name 'badge-catalogue-drifts' -File 'apps/admin/lib/constants/badges.ts' `
  -Find '  | "Volume"' `
  -Replace '' `
  -ExpectTest 'mirrors the seeded badge catalogue into admin' `
  -Suite '__tests__/services/badge-r96b.test.ts'

# ── Rebuild from scratch ─────────────────────────────────────────────────────

$RESET = 'apps/admin/lib/services/gamification-reset.service.ts'
$COPY  = 'apps/admin/lib/admin/gamification-reset-copy.ts'

# 15 — accept any confirmation, so a stray click wipes the system
Invoke-Probe -Name 'reset-accepts-any-phrase' -File $RESET `
  -Find 'if (confirmation !== GAMIFICATION_RESET_CONFIRMATION) {' `
  -Replace 'if (false) {' `
  -ExpectTest 'refuses without the exact confirmation phrase'

# 16 — look a request-supplied scope up on an object, so "constructor" survives
Invoke-Probe -Name 'reset-scope-prototype-chain' -File $RESET `
  -Find 'VALID_SCOPES.has(s)' `
  -Replace '(s as string) in { badges: 1, milestones: 1, levels: 1 }' `
  -ExpectTest 'ignores a scope it does not recognise'

# 17 — stop suppressing the defaults, so the wipe is undone on the next read
Invoke-Probe -Name 'reset-defaults-reseed' -File $RESET `
  -Find 'badgeDefaultsSuppressed: true' `
  -Replace 'badgeDefaultsSuppressed: false' `
  -ExpectTest 'suppresses the shipped defaults'

# 18 — delete player-earned rows without being asked
Invoke-Probe -Name 'reset-deletes-earned-badges' -File $RESET `
  -Find 'orphanedPlayerProgress.userBadges = await UserBadge.countDocuments();' `
  -Replace 'await UserBadge.deleteMany({});' `
  -ExpectTest 'keeps player-earned rows unless asked'

# 19 — read the system BEFORE wiping it, so every add-only build step concludes
#      nothing is missing and the rebuild reports success over an empty platform.
#
#      Re-aimed 17 Sep 2026. The first version appended `const _late =
#      resetGamification;` after the wipe, which moved nothing: a mutation with
#      no observable, so the positional test stayed green and read exactly like a
#      guard that does not work.
#      Keep the anchor ASCII: the first re-aim matched the section comment,
#      whose box-drawing characters do not survive the shell, and reported
#      "DID NOT APPLY" — which reads like a broken harness rather than a moved
#      target.
Invoke-Probe -Name 'reset-reads-before-wipe' -File $ROUTE `
  -Find 'if (mode === "rebuild") {' `
  -Replace 'const _early = await dbTools.readXPConfig();
      if (mode === "rebuild") {' `
  -ExpectTest 'wipes and rebuilds in ONE run'

# 20 — default to rebuild, so inaction is destructive
Invoke-Probe -Name 'run-full-defaults-to-rebuild' -File $ROUTE `
  -Find 'mode = "add",' `
  -Replace 'mode = "rebuild",' `
  -ExpectTest 'defaults to add'

# 21 — carry on building after a refused wipe and report success
Invoke-Probe -Name 'refused-wipe-falls-through' -File $ROUTE `
  -Find 'if (!reset.success) {' `
  -Replace 'if (false) {' `
  -ExpectTest 'refuses the WHOLE run when the wipe is refused'

# 22 — let the panel carry its own copy of the phrase
Invoke-Probe -Name 'ui-duplicates-phrase' -File $UI `
  -Find 'import {
  ALL_GAMIFICATION_RESET_SCOPES,' `
  -Replace 'const GAMIFICATION_RESET_CONFIRMATION = "RESET GAMIFICATION";
import {
  ALL_GAMIFICATION_RESET_SCOPES,' `
  -ExpectTest 'the phrase and the scope ids have ONE definition'

# 23 — reach a model from the client-bundled copy module (R58)
Invoke-Probe -Name 'copy-module-reaches-model' -File $COPY `
  -Find 'export const GAMIFICATION_RESET_CONFIRMATION' `
  -Replace 'import BadgeConfig from "@/database/models/badge-config.model";
export const GAMIFICATION_RESET_CONFIRMATION' `
  -ExpectTest 'the copy module reaches no model'

# 24 — leave the panel armed after a rebuild
Invoke-Probe -Name 'panel-stays-armed' -File $UI `
  -Find 'setSetupMode("add");' `
  -Replace '' `
  -ExpectTest 'disarms the panel after a rebuild'

Write-Host 'R96b orchestration probes done.'
