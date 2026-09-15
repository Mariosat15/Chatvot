# Probe harness for R88 (a renamed level ladder must reach every screen) and R89 (the
# routes that read and write it must be authorized).
#
# Same rules as tools/probe-terminology-delivery.ps1 and not repeated here: one defect per
# probe, one NAMED expected test, `-LiteralPath`-equivalent byte reads, UTF-8 without a BOM
# on the read and the write, a relaxed newline in every pattern, and a refusal to believe an
# outcome when the replacement changed nothing.
#
# A green probe is a question with four known answers - weak test, wrong claim, unreachable
# guard, or a mutation with no observable - so read the reason before loosening an assertion.
#
# THREE PROBES ARE DELIBERATELY ABSENT, each recorded where it would have gone rather than
# only in a list at the end - one because the guard changes no observable, two because the
# property already has a witness or the mutation is refused by the compiler.

$ErrorActionPreference = 'Continue'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$Suite = '__tests__/services/level-ladder-rename.test.ts'
$script:pass = 0
$script:fail = 0

function Relaxed([string]$literal) {
  [regex]::Escape($literal) -replace '\\r\\n|\\n', '\r?\n'
}

function Invoke-Probe {
  param(
    [string]$Name,
    [string]$File,
    [string]$From,
    [string]$To,
    [string]$ExpectRed
  )

  $path = Join-Path $root $File
  $pattern = Relaxed $From

  $original = [IO.File]::ReadAllText($path)
  if ([string]::IsNullOrEmpty($original)) {
    Write-Host "HARNESS BROKEN  $Name - read returned nothing for $File" -ForegroundColor Magenta
    $script:fail++
    return
  }
  if (-not [regex]::IsMatch($original, $pattern)) {
    Write-Host "DID NOT APPLY   $Name - pattern not found in $File" -ForegroundColor Magenta
    $script:fail++
    return
  }

  try {
    $mutated = [regex]::Replace($original, $pattern, { param($m) $To }, 1)
    if ($mutated -eq $original) {
      Write-Host "DID NOT APPLY   $Name - replacement changed nothing" -ForegroundColor Magenta
      $script:fail++
      return
    }
    [IO.File]::WriteAllText($path, $mutated, (New-Object Text.UTF8Encoding $false))

    $out = & cmd.exe /c "npx vitest run $Suite -t `"$ExpectRed`" --reporter=basic 2>&1" | Out-String
    $flat = ($out -replace '\s+', ' ')

    if ($flat -match 'Tests\s+(\d+)\s+failed') {
      $count = [int]$Matches[1]
      if ($count -le 2) {
        Write-Host "RED             $Name" -ForegroundColor Green
      } else {
        Write-Host "RED (x$count)      $Name - more than the expected test broke" -ForegroundColor Yellow
      }
      $script:pass++
    } elseif (
      $flat -match 'No test files found' -or
      $flat -match 'Tests\s+no tests' -or
      $flat -match 'Tests\s+0\s+passed' -or
      $flat -notmatch 'Tests\s+\d+\s+passed'
    ) {
      Write-Host "NO TEST RAN     $Name - '$ExpectRed' matched nothing" -ForegroundColor Magenta
      $script:fail++
    } else {
      Write-Host "GREEN           $Name - the guard is not doing its job" -ForegroundColor Red
      $script:fail++
    }
  } finally {
    [IO.File]::WriteAllText($path, $original, (New-Object Text.UTF8Encoding $false))
  }
}

$RESOLVER = 'lib/utils/level-title.ts'
$LEVELS = 'lib/constants/levels.ts'
$BOARD = 'app/api/leaderboard/route.ts'
$PAGE = 'app/(root)/competitions/[id]/page.tsx'

Write-Host "`n=== the operator's ladder wins over the cache ===" -ForegroundColor Cyan

# 1. THE DEFECT ITSELF, restored in one line. The cached title first is exactly what the five
#    read sites were doing by another road, and it reads as the obvious implementation.
Invoke-Probe -Name '1  the cached title preferred over the ladder' -File $RESOLVER `
  -From '  const title =
    trimmed(entry.title) ||
    trimmed(stored?.currentTitle) ||
    resolveLevelName(level, ladder);' `
  -To '  const title =
    trimmed(stored?.currentTitle) ||
    trimmed(entry.title) ||
    resolveLevelName(level, ladder);' `
  -ExpectRed 'prefers the ladder'

# 2. THE LEVEL NUMBER taken from the same cache. An operator who moves a threshold leaves
#    every stored level wrong until the next award, and the paid-entry gate compares on it.
#    Written as a `??` fallback it reads as tolerating a ladder that cannot place the player.
Invoke-Probe -Name '2  the level read from the stored number first' -File $RESOLVER `
  -From '  const level = entry.level;' `
  -To '  const level = numeric(stored?.currentLevel) ?? entry.level;' `
  -ExpectRed 'derives the level from XP against the ladder'

# 3. THE CACHE DROPPED ENTIRELY. This is the over-correction: a rung an operator saved with a
#    blank title has no name, so a real historical title is replaced with "Level 2" on every
#    screen the player appears on. Note the FIXTURE had to be an empty TITLE, not an empty
#    ladder - against an empty ladder the scan falls back to the code ladder, every rung is
#    named, and this probe came back green.
Invoke-Probe -Name '3  the cache fallback removed' -File $RESOLVER `
  -From '    trimmed(stored?.currentTitle) ||
' -To '' `
  -ExpectRed 'falls back to the cached title'

# 4. NO DOCUMENT, NO ROW. Every leaderboard has to render a player who has never earned XP.
Invoke-Probe -Name '4  an absent XP document not defaulted to rung one' -File $RESOLVER `
  -From '  const entry = levelEntryForXP(numeric(stored?.currentXP) ?? 0, ladder);' `
  -To '  const entry = stored ? levelEntryForXP(numeric(stored.currentXP) ?? 0, ladder) : undefined;' `
  -ExpectRed 'renders a player who has never earned XP'

# 5. ARTWORK TAKEN FROM THE DATABASE. `GameIconName` is a union of committed SVG assets and
#    the colour is a Tailwind class that must exist in the compiled stylesheet, so an
#    operator-typed value for either draws NOTHING while reviewing as perfectly correct.
Invoke-Probe -Name '5  icon and colour taken from the operator entry' -File $RESOLVER `
  -From '  const art = TITLE_LEVELS.find((e) => e.level === level) ?? TITLE_LEVELS[0];' `
  -To '  const art = entry ?? TITLE_LEVELS[0];' `
  -ExpectRed 'takes the icon and colour from the code ladder'

# NO PROBE FOR THE XP COERCION, and this is the third of the four green-probe answers: the
# guard changes no observable. `numeric()` looked like the obvious sixth probe and came back
# green on all five rows, because JavaScript coerces both sides of `xp >= entry.minXP`
# anyway and an unparseable total makes every comparison false, falling through the scan to
# rung one - which is the same answer `?? 0` produces. The comment in the test says so
# rather than claiming a fix, and the guard stays because the accident holds only for this
# scan: a reader comparing with `<`, or averaging, would be silently wrong on a `NaN`.

Write-Host "`n=== naming a level with no player to scan ===" -ForegroundColor Cyan

# 7. THE POSITION FORM. `ladder[level - 1]` throws on a ladder an operator has shortened and
#    names the WRONG rung on one they have reordered - and this string is quoted to a player
#    being refused paid entry.
Invoke-Probe -Name '7  resolveLevelName matched by array position' -File $RESOLVER `
  -From '  const configured = trimmed(ladder.find((e) => e.level === level)?.title);' `
  -To '  const configured = trimmed(ladder[level - 1]?.title);' `
  -ExpectRed 'matches on the level number, not on array position'

# 8. The last resort removed, so a level no ladder can name renders an empty string - a
#    refusal message with a hole in it.
Invoke-Probe -Name '8  the plain level-number fallback removed' -File $RESOLVER `
  -From '  return `Level ${level}`;' -To '  return "";' `
  -ExpectRed 'falls back to the code ladder, then to a plain level number'

Write-Host "`n=== one definition of the XP to level rule ===" -ForegroundColor Cyan

# 9. AN EMPTY LADDER TAKEN LITERALLY. An operator saving an empty level list would take down
#    every leaderboard AND the paid-entry gate with an undefined read - which is what the
#    database copy of this scan did before it was consolidated here.
Invoke-Probe -Name '9  the empty-ladder fallback removed' -File $LEVELS `
  -From '  const entries = ladder.length > 0 ? ladder : TITLE_LEVELS;' `
  -To '  const entries = ladder;' `
  -ExpectRed "falls back to the code ladder when the operator's is empty"

# 10. Below the first threshold answering nothing. A brand-new player has 0 XP, so this is
#     the common case rather than an edge one.
#
#     RE-AIMED 15 Sep 2026. The pattern read `return entries[0];` and the line is now
#     `const [lowest] = entries;` - destructured to satisfy the object-injection rule - so
#     this probe had been reporting DID NOT APPLY and the guard beneath it sat unexercised.
#     A probe naming something that no longer exists fails in the quiet direction.
Invoke-Probe -Name '10 the below-first-threshold answer removed' -File $LEVELS `
  -From '  const [lowest] = entries;
  return lowest;' -To '  return undefined as unknown as TitleLevel;' `
  -ExpectRed 'places an XP total below the first threshold on the first rung'

Write-Host "`n=== every read site goes through the resolver ===" -ForegroundColor Cyan

# 11. A SITE BACK ON THE CONSTANT. The synchronous `getTitleByXP` is still exported and still
#     correct against the hard-coded array, so this compiles, runs and is the defect.
Invoke-Probe -Name '11 a read site recomputing from the constant' -File $BOARD `
  -From 'resolveLevelTitle(' -To 'getTitleByXP_LEGACY(' `
  -ExpectRed 'app/api/leaderboard/route.ts calls resolveLevelTitle'

# 12. THE LADDER NEVER READ, so the resolver's default parameter applies and the site is back
#     on the constant while CALLING the fix - the defect wearing the fix's name, which probe
#     11's assertion is green against.
Invoke-Probe -Name '12 the ladder argument dropped' -File $BOARD `
  -From 'const ladder = await getTitleLevels();' -To 'const ladder = undefined;' `
  -ExpectRed 'app/api/leaderboard/route.ts reads the ladder it resolves against'

# 13. RESOLVED PER ROW. A database read per participant is the shape that made
#     `getComprehensiveDashboardData` unpollable, and it produces identical output.
Invoke-Probe -Name '13 the ladder read inside the row map' -File $BOARD `
  -From 'const display = resolveLevelTitle(userLevels.get(entry.userId), ladder);' `
  -To 'const display = resolveLevelTitle(userLevels.get(entry.userId), await getTitleLevels());' `
  -ExpectRed 'app/api/leaderboard/route.ts reads the ladder once, not per row'

# 14. THE LITERAL REINTRODUCED as a fallback, which is how it got into six files in the first
#     place - each one individually reasonable-looking.
Invoke-Probe -Name '14 a hard-coded rung name reintroduced' -File $BOARD `
  -From 'userTitle: display.title,' -To 'userTitle: display.title || "Novice Trader",' `
  -ExpectRed 'app/api/leaderboard/route.ts'

Write-Host "`n=== the difficulty-band exemption's canary ===" -ForegroundColor Cyan

# 15. THE EXEMPTION MADE STALE BY INJECTING THE FIX. A contest's difficulty band shares the
#     words and not the concept, so the literal is permitted inside that map alone. Injecting
#     the day X6.5 tokenises those bands is what turns this red - so the exemption cannot
#     outlive the reason for it and be worked around by somebody who believes the comment.
Invoke-Probe -Name '15 the difficulty band tokenised - the canary must fire' -File $PAGE `
  -From 'beginner: { level: "Novice", label: "Novice Trader", score: 10 },' `
  -To 'beginner: { level: "Novice", label: `Novice ${terms.player}`, score: 10 },' `
  -ExpectRed 'the difficulty-band exemption is still an offender'

Write-Host "`n=== the resolver stays client-importable, and mirrored ===" -ForegroundColor Cyan

# 16. R58 - a `"use client"` file may not name a driver-reaching module in a value-import
#     position, and admin screens import this one. The typecheck cannot see the breach: the
#     import is valid TypeScript and a clean `tsc --noEmit` is consistent with an app that
#     cannot build at all.
Invoke-Probe -Name '16 the resolver reaching a model' -File $RESOLVER `
  -From 'import type { GameIconName } from "@/lib/constants/game-icons";' `
  -To 'import type { GameIconName } from "@/lib/constants/game-icons";
import UserLevel from "@/database/models/gamification/user-level.model";' `
  -ExpectRed 'imports no model and no database service'

# 17. MIRROR DRIFT. `check:mirrors` compares MODELS and has never had an opinion about a
#     utility module, so two copies could disagree about which ladder wins with every other
#     guard in this file staying green - and the admin copy is the one an operator reads.
Invoke-Probe -Name '17 the admin copy drifted' -File 'apps/admin/lib/utils/level-title.ts' `
  -From '  const level = entry.level;' `
  -To '  const level = numeric(stored?.currentLevel) ?? entry.level;' `
  -ExpectRed 'apps/admin/lib/utils/level-title.ts matches the main copy'

Write-Host "`n=== R89 - the ladder's routes are authorized ===" -ForegroundColor Cyan

# 18. THE GUARD REMOVED FROM A WRITER. `badges-xp/manage` rebalances the level ladder and
#     badge XP values, so this is the unauthenticated write, not a listing.
Invoke-Probe -Name '18 the manage route unguarded' -File 'apps/admin/app/api/badges-xp/manage/route.ts' `
  -From '  const guard = await guardSection("badges");
  if (!guard.ok) return guard.response;

  try {
    await connectToDatabase();' `
  -To '  try {
    await connectToDatabase();' `
  -ExpectRed 'guards every exported handler'

# 19. ONE HANDLER GUARDED AND ONE NOT - the shape a mention-based assertion passes while
#     leaving a mutation wide open, and `seed-badges-xp` is exactly it: the GET force-resets
#     both configurations just as destructively as the POST.
Invoke-Probe -Name '19 seed-badges-xp guarded on POST only' -File 'apps/admin/app/api/seed-badges-xp/route.ts' `
  -From 'export async function GET() {
  const guard = await guardSection("badges");
  if (!guard.ok) return guard.response;
' -To 'export async function GET() {
' `
  -ExpectRed 'guards every exported handler'

# 20. ADMIN-AT-ALL RATHER THAN THE SECTION. `verifyAdminAuth` asks only whether the caller is
#     an admin, so an employee granted one unrelated section passes - ninth instance of that
#     class, and the one a reviewer reads straight past because a helper IS being called.
Invoke-Probe -Name '20 the section grant weakened to admin-at-all' -File 'apps/admin/app/api/badges-xp/route.ts' `
  -From 'const guard = await guardSection("badges");' `
  -To 'const guard = await guardSection("overview");' `
  -ExpectRed 'asks for the badges section, not admin-at-all'

Write-Host "`n=== R88 on the dashboard - one rung from one place ===" -ForegroundColor Cyan

$DASH = 'lib/actions/comprehensive-dashboard.actions.ts'

# 21. THE DEFECT AS IT ACTUALLY SHIPPED, and the reason this site needed a guard of its own:
#     `level` and `title` were moved onto the resolver and the two ARTWORK fields beside them
#     were left on the award-time cache, so the fix reviewed as complete. A renamed rung
#     reached the heading and the colour and icon stayed at whatever the player last earned.
Invoke-Probe -Name '21 the artwork left on the award-time cache' -File $DASH `
  -From '      titleColor: levelDisplay.color,
      titleIcon: levelDisplay.icon,' `
  -To '      titleColor: (userLevelData as any).currentColor || "#9ca3af",
      titleIcon: (userLevelData as any).currentIcon || "*",' `
  -ExpectRed 'comes from the resolver'

# 22. ONE FIELD OF THE FOUR. The partial form is the one to prove, because a guard asserting
#     the object "mentions levelDisplay" is green against it - three correct fields cover for
#     the fourth, which is exactly how this defect survived review the first time.
Invoke-Probe -Name '22 a single field back on the cache' -File $DASH `
  -From '      title: levelDisplay.title,' `
  -To '      title: (userLevelData as any).currentTitle || "Novice Trader",' `
  -ExpectRed 'does not read currentTitle off the award-time cache'

# 23. PRESENTATION TAKEN FROM THE PROGRESS CALCULATION. `calculateXPProgress` returns a
#     `currentLevel` carrying a title, icon and colour straight off the operator's row, so
#     this is the OTHER road to the same defect - it never mentions the cache, it calls no
#     legacy helper, and it reads as using the value already in hand.
#
#     AIMED AT THE READ, NOT THE DESTRUCTURING. The first spelling only added `currentLevel`
#     to the destructured list and came back GREEN - correctly, and it is the fourth cause of
#     a green probe rather than a weak test: a value pulled out and never consumed changes no
#     observable, and the assertion is about what the object is BUILT from. Two tests go red
#     here, the field's own and this one, which is the honest number for one edit.
Invoke-Probe -Name '23 the rung taken from the progress calculation' -File $DASH `
  -From '      titleIcon: levelDisplay.icon,' `
  -To '      titleIcon: currentLevel.icon,' `
  -ExpectRed 'does not take presentation from the progress calculation'

# 24. THE DISCARDED SECOND READ RESTORED. Not a correctness defect - the result was thrown
#     away - but it awaited two database reads per dashboard load for nothing, on the one
#     action already too heavy to poll (`13` s5.1b). The canary keeps it from drifting back
#     in as a harmless-looking parallel fetch.
Invoke-Probe -Name '24 the redundant progress read restored' -File $DASH `
  -From '    getUserGlobalRank(userId).catch(() => ({ rank: 0, totalUsers: 0, percentile: 0 })),' `
  -To '    calculateXPProgress(0).catch(() => ({ progressPercent: 0, xpToNext: 100 })),
    getUserGlobalRank(userId).catch(() => ({ rank: 0, totalUsers: 0, percentile: 0 })),' `
  -ExpectRed 'computes progress once'

# NO PROBE FOR THE SLICE HELPER ITSELF, and it is worth saying why rather than leaving the
# gap to be noticed: `dashboardPlayerObject` uses `lastIndexOf` because this file has TWO
# `player: {` - the return type declaration and the object literal - and the first spelling
# of it sliced the TYPE and reported `titleIcon: string;` as failing to read the resolver.
# The mutation that proves the helper is a third `player: {` between the two, which is not a
# defect any reviewer would write. It carries an inline assertion instead: the slice must not
# match `level: number;`, so it cannot silently go back to examining a type declaration.

# NO PROBE FOR 'apps/admin/lib/constants/levels.ts matches the main copy', and the reason
# rather than the omission left to be noticed: probe 10 already mutates the main copy of
# `levelEntryForXP`, which turns that mirror assertion red as a side effect. A probe aimed at
# the admin copy would report red for the same reason as its sibling and prove nothing
# additional - the two files' byte-identity is one property with one witness.
#
# NO PROBE FOR 'the resolver exports the shapes a consumer needs'. The only mutation that
# turns it red is renaming or deleting an export, which stops the test file COMPILING - and a
# probe whose defect is refused by the compiler is indistinguishable from a harness that did
# not apply. The property is carried by every other test here importing those names.

Write-Host ""
Write-Host "red: $($script:pass)   green or broken: $($script:fail)" -ForegroundColor Cyan
if ($script:fail -gt 0) { exit 1 }
