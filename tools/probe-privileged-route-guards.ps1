# Probes for R101a - the admin routes that grant privilege or decide what a player can achieve.
#
# Each probe reintroduces one defect the guard exists to catch, names the test expected to go
# red, and runs that test ALONE. Harness rules applied here, each learned from a false result
# elsewhere in this repository:
#   - Read AND write with -LiteralPath and UTF-8 without a BOM, and refuse to write when the
#     read came back empty. A probe that destroys the file it is probing reports every test red
#     on the right name for entirely the wrong reason, and the tell is the failure COUNT.
#   - Name the expected failing test and run it alone with -t. Searching whole-suite output for
#     a test's name finds it whether it passed or failed.
#   - vitest -t is a REGEX. The patterns below are ASCII and contain no brackets, which matters
#     here more than usual: this suite's per-file test names include `[mapId]`, which a regex
#     reads as a character class, so those files are probed through a differently-named test.
#   - Every pattern is a SINGLE line with no leading whitespace. A multi-line pattern with CRLF
#     endings silently fails to match an LF file, and a probe that fails to apply is
#     indistinguishable from a test that does not work.
#   - FIRST-OCCURRENCE replacement is available and is needed, because the guard line in a
#     four-handler route is character-for-character identical in all four. Replacing every
#     occurrence would unguard the whole file, which turns several tests red and proves nothing
#     about the per-handler counting the suite exists to assert.

$ErrorActionPreference = 'Continue'
Set-Location (Join-Path $PSScriptRoot '..')

$Enc = New-Object System.Text.UTF8Encoding($false)
$Suite = '__tests__/admin/privileged-route-guards.test.ts'

function Read-Source([string]$Path) {
  $text = [System.IO.File]::ReadAllText((Resolve-Path -LiteralPath $Path), $Enc)
  if ([string]::IsNullOrWhiteSpace($text)) {
    throw "Read of $Path came back empty - refusing to probe."
  }
  return $text
}

function Write-Source([string]$Path, [string]$Text) {
  if ([string]::IsNullOrWhiteSpace($Text)) {
    throw "Refusing to write an empty $Path."
  }
  [System.IO.File]::WriteAllText((Resolve-Path -LiteralPath $Path), $Text, $Enc)
}

function Replace-First([string]$Text, [string]$Find, [string]$Replace) {
  $at = $Text.IndexOf($Find)
  if ($at -lt 0) { return $Text }
  return $Text.Substring(0, $at) + $Replace + $Text.Substring($at + $Find.Length)
}

function Invoke-Probe {
  param(
    [string]$Name,
    [string]$File,
    [string]$Find,
    [string]$Replace,
    [string]$Find2,
    [string]$Replace2,
    [string]$ExpectTest,
    [switch]$First
  )

  $original = Read-Source $File
  if (-not $original.Contains($Find)) {
    Write-Host "[$Name] PROBE DID NOT APPLY - pattern not found. The target moved; re-aim it." -ForegroundColor Yellow
    return
  }
  if ($Find2 -and -not $original.Contains($Find2)) {
    Write-Host "[$Name] PROBE DID NOT APPLY - second pattern not found. The target moved; re-aim it." -ForegroundColor Yellow
    return
  }

  $mutated = if ($First) { Replace-First $original $Find $Replace } else { $original.Replace($Find, $Replace) }
  if ($Find2) {
    $mutated = if ($First) { Replace-First $mutated $Find2 $Replace2 } else { $mutated.Replace($Find2, $Replace2) }
  }
  # Believing an outcome without confirming the file changed is how a green probe gets recorded
  # as an unprotected guard.
  if ($mutated -eq $original) {
    Write-Host "[$Name] PROBE CHANGED NOTHING - the replacement was a no-op." -ForegroundColor Yellow
    return
  }

  Write-Source $File $mutated
  try {
    $out = (& npx vitest run $Suite -t $ExpectTest 2>&1 | Out-String) -replace '\s+', ' '
    # Checked BEFORE the failure count, and deliberately: a run that matched no test prints no
    # "failed" line at all, so a bare fall-through to GREEN would report a moved or mis-spelled
    # -t pattern as an unprotected guard.
    if ($out -match 'No test files found' -or $out -notmatch 'Tests\s+\d') {
      Write-Host "[$Name] NO TEST RAN - the -t pattern matched nothing (vitest -t is a REGEX)" -ForegroundColor Red
      return
    }
    if ($out -match 'Tests\s+(\d+)\s+failed\s*\|\s*(\d+)\s+passed') {
      $failed = [int]$Matches[1]
      if ($failed -eq 1) {
        Write-Host "[$Name] RED on exactly 1 test - OK" -ForegroundColor Green
      } else {
        Write-Host "[$Name] RED on $failed tests - too wide, re-scope the assertion" -ForegroundColor Yellow
      }
    } elseif ($out -match 'Tests\s+(\d+)\s+failed') {
      Write-Host "[$Name] RED on $($Matches[1]) test(s) - OK" -ForegroundColor Green
    } else {
      Write-Host "[$Name] GREEN - the guard did not catch this. Ask which of the four causes." -ForegroundColor Red
    }
  } finally {
    Write-Source $File $original
  }
}

$EDIT = 'apps/admin/app/api/users/edit/route.ts'
$BADGES = 'apps/admin/app/api/badges/route.ts'
$TRIGGER = 'apps/admin/app/api/trigger-badge-evaluation/route.ts'
$MILESTONES = 'apps/admin/app/api/journey-milestones/route.ts'
$SEQUENCE = 'apps/admin/app/api/journey/maps/sequence/route.ts'

Write-Host "`n=== R101a probes ===`n"

# 1. THE defect. `role` is settable here and "admin" is a valid value, so an unguarded PATCH is
#    a grant of administrator to anybody who can reach the origin.
Invoke-Probe -Name 'users/edit unguarded' -File $EDIT `
  -Find 'const guard = await guardSection("users");' `
  -Replace 'const guard = { ok: true, admin: { id: "x", email: "x@x", name: "x", role: "admin" } } as any;' `
  -ExpectTest 'guards the PATCH before the database update'

# 2. The same guard, below the body parse. It still refuses, so this is a far smaller defect -
#    but the route has parsed an unauthenticated caller's JSON by then, and the assertion is
#    about position rather than presence, so it needs its own probe.
Invoke-Probe -Name 'users/edit guards after the body' -File $EDIT `
  -Find 'const guard = await guardSection("users");' `
  -Replace 'const guard = null as any;' `
  -Find2 'if (typeof userId !== "string" || !userId) {' `
  -Replace2 'const g2 = await guardSection("users"); if (!g2.ok) return g2.response; if (typeof userId !== "string" || !userId) {' `
  -ExpectTest 'users/edit/route.ts: refuses before it reads'

# 3. The shape the defect wore. Beside the new guard this call is harmless, which is exactly
#    why its absence is asserted: a swallowed session read reads to a reviewer as an
#    authorization check and performs none.
Invoke-Probe -Name 'users/edit session read restored' -File $EDIT `
  -Find '    // Log audit action. The actor comes from the guard above, so there is no longer a path' `
  -Replace '    const admin = await getAdminSession();' `
  -ExpectTest 'no longer treats the audit-log session lookup'

# 4. The audit entry back under a condition that skips it. Probed separately from 3 because
#    deleting the session read and attributing the entry correctly are two different claims.
Invoke-Probe -Name 'users/edit audit actor not the guard' -File $EDIT `
  -Find '        id: guard.admin.id,' `
  -Replace '        id: "unknown",' `
  -ExpectTest 'attributes the audit entry to the guard'

# 5. `{ id: userId }` with an OBJECT value is a query operator, not a value, so `{"$ne":null}`
#    matches the first user in the collection. `!userId` is true for no object, so the
#    presence check cannot stand in for the type check.
Invoke-Probe -Name 'users/edit takes any userId' -File $EDIT `
  -Find 'if (typeof userId !== "string" || !userId) {' `
  -Replace 'if (!userId) {' `
  -ExpectTest 'refuses a non-string userId rather than merely a missing one'

# 6. A real section, wrongly chosen. The compiler cannot see this: `settings` exists, compiles,
#    and issues the grant to a different set of employees.
Invoke-Probe -Name 'users/edit names the wrong section' -File $EDIT `
  -Find 'await guardSection("users")' `
  -Replace 'await guardSection("settings")' `
  -ExpectTest 'users/edit/route.ts: guards every handler with the section'

# 7. One handler of four unguarded. The whole point of counting per handler: a file whose POST
#    is guarded and whose GET is not passes any check that asks whether the FILE mentions a
#    guard. First occurrence only - the four guard lines are character-for-character identical.
Invoke-Probe -Name 'badges one handler unguarded' -File $BADGES -First `
  -Find 'const guard = await guardSection("badges");' `
  -Replace 'const guard = { ok: true } as any;' `
  -ExpectTest 'badges/route.ts: one guard and one refusal'

# 8. The guard called and its result discarded. A guard whose outcome nobody reads authorizes
#    nothing, and this is the half a whole-file match for the refusal cannot see, because a
#    sibling handler still has one.
Invoke-Probe -Name 'badges one refusal discarded' -File $BADGES -First `
  -Find 'if (!guard.ok) return guard.response;' `
  -Replace 'void guard;' `
  -ExpectTest 'badges/route.ts: one guard and one refusal'

# 9. Three handlers correct, the fourth on a neighbouring section - which is why the section is
#    asserted per handler slice rather than as a set over the file.
Invoke-Probe -Name 'badges one handler wrong section' -File $BADGES -First `
  -Find 'await guardSection("badges")' `
  -Replace 'await guardSection("settings")' `
  -ExpectTest 'badges/route.ts: guards every handler with the section'

# 10. An omitted `userId` means "every user" on this route, so it must not fall through to the
#     bulk branch on a bad value - and the ADMIN copy of `gatherUserStats` has no type check of
#     its own (R100), so an object here reaches a query as an operator.
Invoke-Probe -Name 'trigger takes any userId' -File $TRIGGER `
  -Find 'if (userId !== undefined && typeof userId !== "string") {' `
  -Replace 'if (false) {' `
  -ExpectTest 'refuses a non-string userId on the evaluation trigger'

# 11. The body-position rule on a second file, because one file satisfying it is not evidence
#     the rule is enforced per handler across the cluster.
#
#     WRITTEN WITH -First FIRST, AND IT CAME BACK GREEN. The four guard lines in this file are
#     identical, so first-occurrence replacement unguarded the GET - which has no body to parse
#     - and then added a redundant guard to the POST, which already had one before its body.
#     The mutation was applied, the file did change, and the defect was never created. That is
#     the "aimed at the wrong code path" cause, and it is indistinguishable from a broken test:
#     both print GREEN. Replacing EVERY guard is what puts POST and PUT into the state the
#     assertion is about; the handlers left with no guard at all fail a different test, which
#     -t filters out.
Invoke-Probe -Name 'milestones guards after the body' -File $MILESTONES `
  -Find '    const guard = await guardSection("journey-map");' `
  -Replace '    const gm = 1; void gm;' `
  -Find2 '    const data = await request.json();' `
  -Replace2 '    const data = await request.json(); const guard = await guardSection("journey-map"); if (!guard.ok) return guard.response;' `
  -ExpectTest 'journey-milestones/route.ts: refuses before it reads'

# 12. The assertion that found two real routes this sweep had missed. `journey/maps/sequence`
#     and `journey/maps/[mapId]/milestones` were unguarded because the fix listed `journey/*`
#     file by file; the folder walk caught both. This probe restores that state, so the guard
#     against the NEXT such route is proven rather than assumed.
Invoke-Probe -Name 'a new route arrives unguarded' -File $SEQUENCE `
  -Find '    const guard = await guardSection("journey-map");' `
  -Replace '    const unused = 1; void unused;' `
  -Find2 '    if (!guard.ok) return guard.response;' `
  -Replace2 '' `
  -ExpectTest 'and none of the closed folders leak an unguarded file'

$CREDIT = 'apps/admin/app/api/users/credit/route.ts'
$DELETE = 'apps/admin/app/api/users/delete/route.ts'
$LIST = 'apps/admin/app/api/users/route.ts'
$HISTORY = 'apps/admin/app/api/users/[userId]/history/route.ts'
$CONVOS = 'apps/admin/app/api/users/[userId]/conversations/route.ts'
$PRESENCE = 'apps/admin/app/api/users/presence/route.ts'

Write-Host "`n=== R101b probes ===`n"

# 13. The money bypass, restored. The wallet is CREATED here if it is missing, so an
#     unauthenticated caller does not merely adjust an existing balance - it brings one into
#     existence and writes a ledger row attributed to nobody.
Invoke-Probe -Name 'credit unguarded' -File $CREDIT `
  -Find '    const guard = await guardSection("users");' `
  -Replace '    const guard = { ok: true, admin: { id: "x", email: "x@x", name: "x", role: "admin" } } as any;' `
  -ExpectTest 'credit refuses before it touches a wallet'

# 14. The truthiness reading of the amount. `NaN` is falsy, so `!amount` happens to catch it -
#     which is why this probe restores `=== 0` ALONE rather than deleting the check: `Infinity`
#     is truthy, is not zero, and reaches a balance write. A probe that also deleted the zero
#     check would turn the same test red for the boring reason and prove nothing about the
#     finite one.
Invoke-Probe -Name 'credit takes a non-finite amount' -File $CREDIT `
  -Find 'if (typeof amount !== "number" || !Number.isFinite(amount) || amount === 0) {' `
  -Replace 'if (typeof amount !== "number" || amount === 0) {' `
  -ExpectTest 'credit refuses a non-finite amount'

# 15. The guard moved below the first deletion. It still refuses - but the Better Auth `user`
#     document is already gone by then, so the refusal is a 403 handed back after the account
#     it was protecting has been erased. Position, not presence.
Invoke-Probe -Name 'delete guards after the first deletion' -File $DELETE `
  -Find '    const guard = await guardSection("users");' `
  -Replace '    const gd = 1; void gd;' `
  -Find2 '      .deleteOne({ id: userId });' `
  -Replace2 '      .deleteOne({ id: userId }); const guard = await guardSection("users"); if (!guard.ok) return guard.response;' `
  -ExpectTest 'delete refuses before the first deletion'

# 16. `{ $ne: null }` as a userId. `!userId` is false for any object, so the presence check
#     admits it, and `deleteMany({ userId })` then matches every row in ~20 collections. The
#     same probe on the same test as 15 deliberately: one assertion, two independent claims,
#     and either failing alone is the evidence that they are not covering for each other.
Invoke-Probe -Name 'delete takes any userId' -File $DELETE `
  -Find 'if (!userId || typeof userId !== "string") {' `
  -Replace 'if (!userId) {' `
  -ExpectTest 'delete refuses before the first deletion'

# 17. The PII list, unguarded. This route had no authorization call of any kind, and it returns
#     every player's email and name.
Invoke-Probe -Name 'user list unguarded' -File $LIST `
  -Find '    const guard = await guardSection("users");' `
  -Replace '    const gl = 1; void gl;' `
  -Find2 '    if (!guard.ok) return guard.response;' `
  -Replace2 '' `
  -ExpectTest 'the user list and the history read both guard before connecting'

# 18. The same claim on the history route, because one file satisfying "guards before it
#     connects" is not evidence the pair does.
Invoke-Probe -Name 'history unguarded' -File $HISTORY `
  -Find '    const guard = await guardSection("users");' `
  -Replace '    const gh = 1; void gh;' `
  -Find2 '    if (!guard.ok) return guard.response;' `
  -Replace2 '' `
  -ExpectTest 'the user list and the history read both guard before connecting'

# 19. The hand-rolled JWT check, restored. It is the subtlest of the five, because it LOOKS
#     like authorization and is the only one a reviewer would defend: it verifies a real token
#     with the real secret. What it never asks is whether the holder was granted `users`.
Invoke-Probe -Name 'conversations verifies by hand' -File $CONVOS `
  -Find '    const guard = await guardSection("users");' `
  -Replace '    const token = request.headers.get("cookie"); verify(token as string, getAdminJwtSecret()); const guard = { ok: true } as any;' `
  -ExpectTest 'conversations no longer verifies a token by hand'

# 20. A weaker helper reintroduced on a file that KEEPS its guard - which is the only mutation
#     that isolates the directory-wide negative. Unguarding the file instead would turn the
#     per-handler suite red as well and the probe would be measuring the wrong assertion.
#     No import is added, exactly as the reviewer who would write this line would not think to:
#     the suite reads text, and the point is that a `getAdminSession()` call sitting beside a
#     real guard reads as belt-and-braces and is in fact a second answer to one question.
Invoke-Probe -Name 'a weaker helper returns beside the guard' -File $PRESENCE `
  -Find '    if (!guard.ok) return guard.response;' `
  -Replace '    if (!guard.ok) return guard.response; const s = await getAdminSession(); void s;' `
  -ExpectTest 'every file names guardSection and no weaker helper'

$TH_EXPORT = 'apps/admin/app/api/trading-history/export/route.ts'
$MSG_CONV = 'apps/admin/app/api/messaging/conversations/route.ts'
$MSG_SETTINGS = 'apps/admin/app/api/messaging/settings/route.ts'
$MSG_EMP = 'apps/admin/app/api/messaging/employees/route.ts'

Write-Host "`n=== R101c probes ===`n"

# 21. Trading-history export was world-readable. Restoring that state.
Invoke-Probe -Name 'trading-history export unguarded' -File $TH_EXPORT `
  -Find '    const guard = await guardSection("trading-history");' `
  -Replace '    const g = 1; void g;' `
  -Find2 '    if (!guard.ok) return guard.response;' `
  -Replace2 '' `
  -ExpectTest 'trading-history/export/route.ts: one guard and one refusal'

# 22. Wrong grant on the export - financial would compile and silently widen who can download
#     every player's trades.
Invoke-Probe -Name 'trading-history export wrong section' -File $TH_EXPORT `
  -Find 'guardSection("trading-history")' `
  -Replace 'guardSection("financial")' `
  -ExpectTest 'trading-history/export/route.ts: guards every handler with the section'

# 23. Hand-rolled JWT restored beside the guard on a messaging route - the shape that hid the
#     whole folder from the handler-vs-guard count.
Invoke-Probe -Name 'messaging hand-rolled jwt returns' -File $MSG_EMP `
  -Find 'import { guardSection } from "@/lib/admin/section-route-guard";' `
  -Replace 'import { guardSection } from "@/lib/admin/section-route-guard"; import { verify } from "jsonwebtoken";' `
  -ExpectTest 'every file names guardSection, no weaker helper, and no jsonwebtoken import'

# 24. Settings and inbox grants collapse - settings gets the inbox section.
Invoke-Probe -Name 'settings uses inbox grant' -File $MSG_SETTINGS `
  -Find 'guardSection("messaging-settings")' `
  -Replace 'guardSection("messaging")' `
  -ExpectTest 'messaging/settings is the only file under messaging/'

# 25. Inbox route takes the settings grant - the other direction of the same collapse.
Invoke-Probe -Name 'inbox uses settings grant' -File $MSG_CONV `
  -Find 'guardSection("messaging")' `
  -Replace 'guardSection("messaging-settings")' `
  -ExpectTest 'messaging/settings is the only file under messaging/'

# 26. A closed-folder route loses its grant entirely.
Invoke-Probe -Name 'messaging closed folder loses grant' -File $MSG_EMP `
  -Find '    const guard = await guardSection("messaging");' `
  -Replace '    const g = 1; void g;' `
  -Find2 '    if (!guard.ok) return guard.response;' `
  -Replace2 '' `
  -ExpectTest 'and none of the closed folders leak an unguarded file'

$VIS_BLOCK = 'apps/admin/app/api/visitors/block/route.ts'
$VIS_CLEAR = 'apps/admin/app/api/visitors/clear/route.ts'

Write-Host "`n=== R101e probes ===`n"

# 27. visitors/block POST was world-writable. Restoring that on one handler.
Invoke-Probe -Name 'visitors block unguarded' -File $VIS_BLOCK -First `
  -Find '    const guard = await guardSection("visitors");' `
  -Replace '    const g = 1; void g;' `
  -Find2 '    if (!guard.ok) return guard.response;' `
  -Replace2 '' `
  -ExpectTest 'visitors/block/route.ts: one guard and one refusal'

# 28. Wrong grant - landing-pages would compile and silently widen who can block IPs.
Invoke-Probe -Name 'visitors block wrong section' -File $VIS_BLOCK -First `
  -Find 'guardSection("visitors")' `
  -Replace 'guardSection("landing-pages")' `
  -ExpectTest 'visitors/block/route.ts: guards every handler with the section'

# 29. Clear loses its grant - the destructive half of the folder.
Invoke-Probe -Name 'visitors clear unguarded' -File $VIS_CLEAR `
  -Find '    const guard = await guardSection("visitors");' `
  -Replace '    const g = 1; void g;' `
  -Find2 '    if (!guard.ok) return guard.response;' `
  -Replace2 '' `
  -ExpectTest 'every visitors file names guardSection'

# 30. Folder-level canary: a closed visitors route loses its grant entirely.
Invoke-Probe -Name 'visitors closed folder loses grant' -File $VIS_CLEAR `
  -Find '    const guard = await guardSection("visitors");' `
  -Replace '    const g = 1; void g;' `
  -Find2 '    if (!guard.ok) return guard.response;' `
  -Replace2 '' `
  -ExpectTest 'and none of the closed folders leak an unguarded file'

$LP_CLEAR = 'apps/admin/app/api/landing-pages/analytics/clear/route.ts'
$LP_ROUTE = 'apps/admin/app/api/landing-pages/route.ts'

Write-Host "`n=== R101f probes ===`n"

# 31. analytics/clear was world-writable. Restoring that on the destructive half.
Invoke-Probe -Name 'landing-pages clear unguarded' -File $LP_CLEAR `
  -Find '    const guard = await guardSection("landing-pages");' `
  -Replace '    const g = 1; void g;' `
  -Find2 '    if (!guard.ok) return guard.response;' `
  -Replace2 '' `
  -ExpectTest 'every landing-pages file names guardSection'

# 32. Wrong grant - visitors would compile and silently widen who can edit landing pages.
Invoke-Probe -Name 'landing-pages wrong section' -File $LP_ROUTE -First `
  -Find 'guardSection("landing-pages")' `
  -Replace 'guardSection("visitors")' `
  -ExpectTest 'landing-pages/route.ts: guards every handler with the section'

# 33. One handler of the list/create route loses its grant.
Invoke-Probe -Name 'landing-pages list unguarded' -File $LP_ROUTE -First `
  -Find '    const guard = await guardSection("landing-pages");' `
  -Replace '    const g = 1; void g;' `
  -Find2 '    if (!guard.ok) return guard.response;' `
  -Replace2 '' `
  -ExpectTest 'landing-pages/route.ts: one guard and one refusal'

# 34. Folder-level canary: a closed landing-pages route loses its grant entirely.
Invoke-Probe -Name 'landing-pages closed folder loses grant' -File $LP_CLEAR `
  -Find '    const guard = await guardSection("landing-pages");' `
  -Replace '    const g = 1; void g;' `
  -Find2 '    if (!guard.ok) return guard.response;' `
  -Replace2 '' `
  -ExpectTest 'and none of the closed folders leak an unguarded file'

$MD_CLEAN = 'apps/admin/app/api/market-data/cleanup/route.ts'
$MD_SETTINGS = 'apps/admin/app/api/market-data/settings/route.ts'

Write-Host "`n=== R101g probes ===`n"

# 35. cleanup was world-writable - the destructive half of the folder.
Invoke-Probe -Name 'market-data cleanup unguarded' -File $MD_CLEAN `
  -Find '    const guard = await guardSection("market-data");' `
  -Replace '    const g = 1; void g;' `
  -Find2 '    if (!guard.ok) return guard.response;' `
  -Replace2 '' `
  -ExpectTest 'every market-data file names guardSection'

# 36. Wrong grant - symbols would compile and silently widen who can wipe candles.
Invoke-Probe -Name 'market-data wrong section' -File $MD_CLEAN `
  -Find 'guardSection("market-data")' `
  -Replace 'guardSection("symbols")' `
  -ExpectTest 'market-data/cleanup/route.ts: guards every handler with the section'

# 37. One handler of settings loses its grant.
Invoke-Probe -Name 'market-data settings unguarded' -File $MD_SETTINGS -First `
  -Find '    const guard = await guardSection("market-data");' `
  -Replace '    const g = 1; void g;' `
  -Find2 '    if (!guard.ok) return guard.response;' `
  -Replace2 '' `
  -ExpectTest 'market-data/settings/route.ts: one guard and one refusal'

# 38. Folder-level canary: a closed market-data route loses its grant entirely.
Invoke-Probe -Name 'market-data closed folder loses grant' -File $MD_CLEAN `
  -Find '    const guard = await guardSection("market-data");' `
  -Replace '    const g = 1; void g;' `
  -Find2 '    if (!guard.ok) return guard.response;' `
  -Replace2 '' `
  -ExpectTest 'and none of the closed folders leak an unguarded file'

$SYM_SYNC = 'apps/admin/app/api/symbols/sync/route.ts'
$SYM_ROUTE = 'apps/admin/app/api/symbols/route.ts'

Write-Host "`n=== R101h probes ===`n"

# 39. sync was world-writable - rewrites the live symbol catalogue.
Invoke-Probe -Name 'symbols sync unguarded' -File $SYM_SYNC `
  -Find '    const guard = await guardSection("symbols");' `
  -Replace '    const g = 1; void g;' `
  -Find2 '    if (!guard.ok) return guard.response;' `
  -Replace2 '' `
  -ExpectTest 'every symbols file names guardSection'

# 40. Wrong grant - market-data would compile and silently widen who can sync symbols.
Invoke-Probe -Name 'symbols wrong section' -File $SYM_SYNC `
  -Find 'guardSection("symbols")' `
  -Replace 'guardSection("market-data")' `
  -ExpectTest 'symbols/sync/route.ts: guards every handler with the section'

# 41. One handler of the list/create route loses its grant.
Invoke-Probe -Name 'symbols list unguarded' -File $SYM_ROUTE -First `
  -Find '    const guard = await guardSection("symbols");' `
  -Replace '    const g = 1; void g;' `
  -Find2 '    if (!guard.ok) return guard.response;' `
  -Replace2 '' `
  -ExpectTest 'symbols/route.ts: one guard and one refusal'

# 42. Folder-level canary.
Invoke-Probe -Name 'symbols closed folder loses grant' -File $SYM_SYNC `
  -Find '    const guard = await guardSection("symbols");' `
  -Replace '    const g = 1; void g;' `
  -Find2 '    if (!guard.ok) return guard.response;' `
  -Replace2 '' `
  -ExpectTest 'and none of the closed folders leak an unguarded file'

$MS_TEMPLATE = 'apps/admin/app/api/market-settings/template-holidays/route.ts'
$MS_AUTO = 'apps/admin/app/api/market-settings/automatic-holidays/route.ts'

Write-Host "`n=== R101i probes ===`n"

# 43. template-holidays POST was world-writable - rewrites the holiday calendar.
# Reason: -First keeps blast to one handler; all three guard lines are identical.
Invoke-Probe -Name 'template-holidays POST unguarded' -File $MS_TEMPLATE -First `
  -Find '    const guard = await guardSection("market");' `
  -Replace '    const g = 1; void g;' `
  -Find2 '    if (!guard.ok) return guard.response;' `
  -Replace2 '' `
  -ExpectTest 'every market-settings file names guardSection'

# 44. Wrong grant - visitors would compile and silently widen who can edit market settings.
Invoke-Probe -Name 'market-settings wrong section' -File $MS_TEMPLATE -First `
  -Find 'guardSection("market")' `
  -Replace 'guardSection("visitors")' `
  -ExpectTest 'market-settings/template-holidays/route.ts: guards every handler with the section'

# 45. automatic-holidays GET was world-readable with no auth.
Invoke-Probe -Name 'automatic-holidays GET unguarded' -File $MS_AUTO `
  -Find '    const guard = await guardSection("market");' `
  -Replace '    const g = 1; void g;' `
  -Find2 '    if (!guard.ok) return guard.response;' `
  -Replace2 '' `
  -ExpectTest 'market-settings/automatic-holidays/route.ts: one guard and one refusal'

# 46. Folder-level canary.
Invoke-Probe -Name 'market-settings closed folder loses grant' -File $MS_AUTO `
  -Find '    const guard = await guardSection("market");' `
  -Replace '    const g = 1; void g;' `
  -Find2 '    if (!guard.ok) return guard.response;' `
  -Replace2 '' `
  -ExpectTest 'and none of the closed folders leak an unguarded file'

$PAGES_ROUTE = 'apps/admin/app/api/pages/route.ts'
$PAGES_SAVE = 'apps/admin/app/api/pages/save-defaults/route.ts'

Write-Host "`n=== R101j probes ===`n"

# 47. pages/route.ts POST was world-writable - creates site pages anonymously.
# Reason: -First keeps blast to one handler; GET and POST share identical guard lines.
Invoke-Probe -Name 'pages/route.ts POST unguarded' -File $PAGES_ROUTE -First `
  -Find '    const guard = await guardSection("site-pages");' `
  -Replace '    const g = 1; void g;' `
  -Find2 '    if (!guard.ok) return guard.response;' `
  -Replace2 '' `
  -ExpectTest 'every pages file names guardSection'

# 48. Wrong grant - landing-pages would compile and silently widen who can edit site pages.
Invoke-Probe -Name 'pages wrong section' -File $PAGES_ROUTE -First `
  -Find 'guardSection("site-pages")' `
  -Replace 'guardSection("landing-pages")' `
  -ExpectTest 'pages/route.ts: guards every handler with the section'

# 49. save-defaults POST was world-writable - persists page defaults to disk.
Invoke-Probe -Name 'save-defaults POST unguarded' -File $PAGES_SAVE `
  -Find '    const guard = await guardSection("site-pages");' `
  -Replace '    const g = 1; void g;' `
  -Find2 '    if (!guard.ok) return guard.response;' `
  -Replace2 '' `
  -ExpectTest 'pages/save-defaults/route.ts: one guard and one refusal'

# 50. Folder-level canary.
Invoke-Probe -Name 'pages closed folder loses grant' -File $PAGES_SAVE `
  -Find '    const guard = await guardSection("site-pages");' `
  -Replace '    const g = 1; void g;' `
  -Find2 '    if (!guard.ok) return guard.response;' `
  -Replace2 '' `
  -ExpectTest 'and none of the closed folders leak an unguarded file'

$SIM_RUN = 'apps/admin/app/api/simulator/run/route.ts'
$SIM_CLEAN = 'apps/admin/app/api/simulator/cleanup/route.ts'
$SIM_AI = 'apps/admin/app/api/simulator/ai/route.ts'
$TESTS_RUN = 'apps/admin/app/api/tests/run/route.ts'
$TESTS_SUITES = 'apps/admin/app/api/tests/suites/route.ts'
$TRADING_CLEAN = 'apps/admin/app/api/admin/trading-tests/cleanup/route.ts'

Write-Host "`n=== R101k probes ===`n"

# 51. simulator/run POST was world-writable - starts/stops simulations anonymously.
# Reason: -First keeps blast to one handler; GET and POST share identical guard lines.
Invoke-Probe -Name 'simulator/run POST unguarded' -File $SIM_RUN -First `
  -Find '    const guard = await guardSection("performance-simulator");' `
  -Replace '    const g = 1; void g;' `
  -Find2 '    if (!guard.ok) return guard.response;' `
  -Replace2 '' `
  -ExpectTest 'every simulator file names guardSection'

# 52. Wrong grant - dev-zone-menu would compile and silently widen who can run the simulator.
Invoke-Probe -Name 'simulator wrong section' -File $SIM_RUN -First `
  -Find 'guardSection("performance-simulator")' `
  -Replace 'guardSection("dev-zone-menu")' `
  -ExpectTest 'simulator/run/route.ts: guards every handler with the section'

# 53. cleanup POST was world-writable - deletes all simulation data anonymously.
Invoke-Probe -Name 'simulator/cleanup unguarded' -File $SIM_CLEAN -First `
  -Find '    const guard = await guardSection("performance-simulator");' `
  -Replace '    const g = 1; void g;' `
  -Find2 '    if (!guard.ok) return guard.response;' `
  -Replace2 '' `
  -ExpectTest 'simulator/cleanup/route.ts: one guard and one refusal'

# 54. Folder-level canary. Aimed at ai/ (one handler) rather than cleanup with -First:
# Reason: the canary filters files with NO auth call at all; ungating one of two handlers
# leaves guardSection in the file and the probe stays green (fourth cause).
Invoke-Probe -Name 'simulator closed folder loses grant' -File $SIM_AI `
  -Find '    const guard = await guardSection("performance-simulator");' `
  -Replace '    const g = 1; void g;' `
  -Find2 '    if (!guard.ok) return guard.response;' `
  -Replace2 '' `
  -ExpectTest 'and none of the closed folders leak an unguarded file'

Write-Host "`n=== R101l probes ===`n"

# 55. tests/run POST was world-writable - spawns vitest and writes TestRun rows anonymously.
Invoke-Probe -Name 'tests/run POST unguarded' -File $TESTS_RUN `
  -Find '    const guard = await guardSection("performance-simulator");' `
  -Replace '    const g = 1; void g;' `
  -Find2 '    if (!guard.ok) return guard.response;' `
  -Replace2 '' `
  -ExpectTest 'every test-runner file names guardSection'

# 56. Wrong grant - same silent widening as R101k probe 52, aimed at the unit-test runner.
Invoke-Probe -Name 'tests wrong section' -File $TESTS_RUN `
  -Find 'guardSection("performance-simulator")' `
  -Replace 'guardSection("dev-zone-menu")' `
  -ExpectTest 'tests/run/route.ts: guards every handler with the section'

# 57. trading-tests/cleanup POST was world-writable - deletes test trade rows anonymously.
Invoke-Probe -Name 'trading-tests/cleanup unguarded' -File $TRADING_CLEAN `
  -Find '    const guard = await guardSection("performance-simulator");' `
  -Replace '    const g = 1; void g;' `
  -Find2 '    if (!guard.ok) return guard.response;' `
  -Replace2 '' `
  -ExpectTest 'admin/trading-tests/cleanup/route.ts: one guard and one refusal'

# 58. Folder-level canary on a single-handler file (suites GET only).
# Reason: R101k lesson - canary filters files with NO auth call at all; a multi-handler
# file with -First leaves guardSection in the file and the probe stays green.
Invoke-Probe -Name 'tests closed folder loses grant' -File $TESTS_SUITES `
  -Find '    const guard = await guardSection("performance-simulator");' `
  -Replace '    const g = 1; void g;' `
  -Find2 '    if (!guard.ok) return guard.response;' `
  -Replace2 '' `
  -ExpectTest 'and none of the closed folders leak an unguarded file'

$CHECK_DB = 'apps/admin/app/api/check-database/route.ts'
$RECOVER = 'apps/admin/app/api/recover-stats/route.ts'
$INDEXES = 'apps/admin/app/api/admin/database/indexes/route.ts'
$FLEET = 'apps/admin/app/api/server-fleet/route.ts'
$RESTRICTIONS = 'apps/admin/app/api/fraud/restrictions/route.ts'

Write-Host "`n=== R101m probes ===`n"

# 59. check-database POST was world-writable - dumps competition and trade data anonymously.
Invoke-Probe -Name 'check-database unguarded' -File $CHECK_DB `
  -Find '    const guard = await guardSection("database");' `
  -Replace '    const g = 1; void g;' `
  -Find2 '    if (!guard.ok) return guard.response;' `
  -Replace2 '' `
  -ExpectTest 'every R101m file names its section grant'

# 60. recover-stats POST was world-writable - rewrites participant stats anonymously.
Invoke-Probe -Name 'recover-stats unguarded' -File $RECOVER `
  -Find '    const guard = await guardSection("database");' `
  -Replace '    const g = 1; void g;' `
  -Find2 '    if (!guard.ok) return guard.response;' `
  -Replace2 '' `
  -ExpectTest 'recover-stats/route.ts: one guard and one refusal'

# 61. Wrong grant on indexes - DatabaseIndexesTab mounts on the simulator screen, not database.
# Reason: -First keeps blast to one of two identical guard lines.
Invoke-Probe -Name 'indexes wrong section' -File $INDEXES -First `
  -Find 'guardSection("performance-simulator")' `
  -Replace 'guardSection("database")' `
  -ExpectTest 'every R101m file names its section grant'

# 62. server-fleet DELETE was world-writable - deletes fleet rows anonymously.
# Reason: -First on GET would leave DELETE guarded; aim at DELETE by matching after GET is harder,
# so unguard both with a full replace and expect the R101m aggregate (one file wrong is enough).
Invoke-Probe -Name 'server-fleet unguarded' -File $FLEET `
  -Find '    const guard = await guardSection("server-fleet");' `
  -Replace '    const g = 1; void g;' `
  -Find2 '    if (!guard.ok) return guard.response;' `
  -Replace2 '' `
  -ExpectTest 'every R101m file names its section grant'

# 63. Folder-level canary on a single-handler R101m file.
Invoke-Probe -Name 'restrictions closed folder loses grant' -File $RESTRICTIONS `
  -Find '    const guard = await guardSection("fraud");' `
  -Replace '    const g = 1; void g;' `
  -Find2 '    if (!guard.ok) return guard.response;' `
  -Replace2 '' `
  -ExpectTest 'and none of the closed folders leak an unguarded file'

$AVAIL = 'apps/admin/app/api/employees/availability/route.ts'
$RISK = 'apps/admin/app/api/trading-risk-settings/route.ts'
$MARGIN = 'apps/admin/app/api/trigger-margin-check/route.ts'

Write-Host "`n=== R101n probes ===`n"

# 64. availability PUT was hand-verified only - MessagingSection owns the toggle.
# Reason: -First keeps blast to one of two identical guard lines.
Invoke-Probe -Name 'availability unguarded' -File $AVAIL -First `
  -Find '    const guard = await guardSection("messaging");' `
  -Replace '    const g = 1; void g;' `
  -Find2 '    if (!guard.ok) return guard.response;' `
  -Replace2 '' `
  -ExpectTest 'every R101n file names its section grant'

# 65. Wrong grant on availability - messaging, not employees/users.
Invoke-Probe -Name 'availability wrong section' -File $AVAIL -First `
  -Find 'guardSection("messaging")' `
  -Replace 'guardSection("users")' `
  -ExpectTest 'every R101n file names its section grant'

# 66. trading-risk-settings POST was hand-verified only - rewrites live margin thresholds.
Invoke-Probe -Name 'risk-settings unguarded' -File $RISK -First `
  -Find '    const guard = await guardSection("trading-risk");' `
  -Replace '    const g = 1; void g;' `
  -Find2 '    if (!guard.ok) return guard.response;' `
  -Replace2 '' `
  -ExpectTest 'every R101n file names its section grant'

# 67. trigger-margin-check liquidates positions - orphan, shares trading-risk by domain.
Invoke-Probe -Name 'margin-check unguarded' -File $MARGIN `
  -Find '    const guard = await guardSection("trading-risk");' `
  -Replace '    const g = 1; void g;' `
  -Find2 '    if (!guard.ok) return guard.response;' `
  -Replace2 '' `
  -ExpectTest 'every R101n file names its section grant'

# 68. Folder-level canary on a single-handler R101n file.
Invoke-Probe -Name 'margin-check closed folder loses grant' -File $MARGIN `
  -Find '    const guard = await guardSection("trading-risk");' `
  -Replace '    const g = 1; void g;' `
  -Find2 '    if (!guard.ok) return guard.response;' `
  -Replace2 '' `
  -ExpectTest 'and none of the closed folders leak an unguarded file'

$ADMIN_FUNDS = 'apps/admin/app/api/admin-funds/route.ts'
$VAT = 'apps/admin/app/api/vat/route.ts'
$CLAWBACK = 'apps/admin/app/api/atlas/refund/clawback/route.ts'
$WITHDRAWALS = 'apps/admin/app/api/withdrawals/route.ts'
$WD_PUT = 'apps/admin/app/api/withdrawals/[id]/route.ts'

Write-Host "`n=== R101o probes ===`n"

# 69. admin-funds POST was admin-at-all - FinancialDashboard owns the screen.
# Reason: -First keeps blast to one of two identical guard lines.
Invoke-Probe -Name 'admin-funds unguarded' -File $ADMIN_FUNDS -First `
  -Find '    const guard = await guardSection("financial");' `
  -Replace '    const g = 1; void g;' `
  -Find2 '    if (!guard.ok) return guard.response;' `
  -Replace2 '' `
  -ExpectTest 'every R101o file names its section grant and no weaker helper'

# 70. Wrong grant on vat - financial, not pending-withdrawals.
Invoke-Probe -Name 'vat wrong section' -File $VAT -First `
  -Find 'guardSection("financial")' `
  -Replace 'guardSection("pending-withdrawals")' `
  -ExpectTest 'every R101o file names its section grant and no weaker helper'

# 71. clawback POST moves wallet credits - FinancialDashboard owns Atlas refunds.
Invoke-Probe -Name 'clawback unguarded' -File $CLAWBACK `
  -Find '    const guard = await guardSection("financial");' `
  -Replace '    const g = 1; void g;' `
  -Find2 '    if (!guard.ok) return guard.response;' `
  -Replace2 '' `
  -ExpectTest 'every R101o file names its section grant and no weaker helper'

# 72. withdrawals list was admin-at-all - PendingWithdrawalsSection owns the screen.
Invoke-Probe -Name 'withdrawals unguarded' -File $WITHDRAWALS `
  -Find '    const guard = await guardSection("pending-withdrawals");' `
  -Replace '    const g = 1; void g;' `
  -Find2 '    if (!guard.ok) return guard.response;' `
  -Replace2 '' `
  -ExpectTest 'every R101o file names its section grant and no weaker helper'

# 73. Wrong grant on withdrawals PUT - pending-withdrawals, not financial.
# Reason: -LiteralPath required - [id] is a PowerShell wildcard character class.
Invoke-Probe -Name 'withdrawals wrong section' -File $WD_PUT -First `
  -Find 'guardSection("pending-withdrawals")' `
  -Replace 'guardSection("financial")' `
  -ExpectTest 'every R101o file names its section grant and no weaker helper'

# 74. Folder-level canary on a single-handler R101o file.
Invoke-Probe -Name 'withdrawals closed folder loses grant' -File $WITHDRAWALS `
  -Find '    const guard = await guardSection("pending-withdrawals");' `
  -Replace '    const g = 1; void g;' `
  -Find2 '    if (!guard.ok) return guard.response;' `
  -Replace2 '' `
  -ExpectTest 'and none of the closed folders leak an unguarded file'

Write-Host "`n=== R101p probes ===`n"

$FIN_DASH = 'apps/admin/app/api/financial-dashboard/route.ts'
$FEE = 'apps/admin/app/api/fee-settings/route.ts'
$DEPOSITS_FAILED = 'apps/admin/app/api/deposits/failed/route.ts'
$CB_LIST = 'apps/admin/app/api/chargebacks/route.ts'
$CB_LOOKUP = 'apps/admin/app/api/chargebacks/lookup/route.ts'
$WD_SETTINGS = 'apps/admin/app/api/withdrawal-settings/route.ts'

# 75. financial-dashboard was hand-rolled jwtVerify - FinancialDashboard owns it.
Invoke-Probe -Name 'financial-dashboard unguarded' -File $FIN_DASH -First `
  -Find '    const guard = await guardSection("financial");' `
  -Replace '    const g = 1; void g;' `
  -Find2 '    if (!guard.ok) return guard.response;' `
  -Replace2 '' `
  -ExpectTest 'every R101p file names its section grant and no weaker helper'

# 76. fee-settings wrong section - fees, not financial.
Invoke-Probe -Name 'fee-settings wrong section' -File $FEE -First `
  -Find 'guardSection("fees")' `
  -Replace 'guardSection("financial")' `
  -ExpectTest 'every R101p file names its section grant and no weaker helper'

# 77. deposits/failed was admin-at-all - FailedDepositsSection owns it.
Invoke-Probe -Name 'deposits failed unguarded' -File $DEPOSITS_FAILED `
  -Find '    const guard = await guardSection("failed-deposits");' `
  -Replace '    const g = 1; void g;' `
  -Find2 '    if (!guard.ok) return guard.response;' `
  -Replace2 '' `
  -ExpectTest 'every R101p file names its section grant and no weaker helper'

# 78. chargebacks list grant swapped with lookup - two screens, two grants.
Invoke-Probe -Name 'chargebacks list as users' -File $CB_LIST -First `
  -Find 'guardSection("financial")' `
  -Replace 'guardSection("users")' `
  -ExpectTest 'chargebacks list is financial while lookup is users'

# 79. chargebacks lookup grant swapped with list.
Invoke-Probe -Name 'chargebacks lookup as financial' -File $CB_LOOKUP -First `
  -Find 'guardSection("users")' `
  -Replace 'guardSection("financial")' `
  -ExpectTest 'chargebacks list is financial while lookup is users'

# 80. Closed-folder canary on a single-handler R101p file (multi-handler -First leaves
# siblings guarded, so AUTH_CALL still matches and the leak check stays green).
Invoke-Probe -Name 'financial-analytics closed folder loses grant' -File 'apps/admin/app/api/financial-analytics/route.ts' `
  -Find '    const guard = await guardSection("financial");' `
  -Replace '    const g = 1; void g;' `
  -Find2 '    if (!guard.ok) return guard.response;' `
  -Replace2 '' `
  -ExpectTest 'and none of the closed folders leak an unguarded file'

Write-Host "`n=== R101q probes ===`n"

$CB_ID = 'apps/admin/app/api/chargebacks/[id]/route.ts'
$BANK = 'apps/admin/app/api/admin-bank-accounts/route.ts'
$CANCEL = 'apps/admin/app/api/cancel-pending-payment/route.ts'
$VENDORS = 'apps/admin/app/api/vendors/route.ts'
$AUTH_TS = 'apps/admin/lib/admin/auth.ts'

# 81. chargebacks/[id] drops to a single grant - locks one of two calling screens out.
Invoke-Probe -Name 'chargebacks id financial only' -File $CB_ID -First `
  -Find 'guardAnySection(["financial", "users"])' `
  -Replace 'guardSection("financial")' `
  -ExpectTest 'every dual-caller file uses guardAnySection with both calling-screen grants'

# 82. admin-bank-accounts loses pending-withdrawals half.
Invoke-Probe -Name 'bank accounts company only' -File $BANK -First `
  -Find 'guardAnySection(["company", "pending-withdrawals"])' `
  -Replace 'guardSection("company")' `
  -ExpectTest 'every dual-caller file uses guardAnySection with both calling-screen grants'

# 83. cancel-pending drops payments half.
Invoke-Probe -Name 'cancel pending failed-deposits only' -File $CANCEL `
  -Find 'guardAnySection(["failed-deposits", "payments"])' `
  -Replace 'guardSection("failed-deposits")' `
  -ExpectTest 'every dual-caller file uses guardAnySection with both calling-screen grants'

# 84. vendors unguarded - VendorSubscriptionsSection owns it.
Invoke-Probe -Name 'vendors unguarded' -File $VENDORS -First `
  -Find '    const guard = await guardSection("vendors");' `
  -Replace '    const g = 1; void g;' `
  -Find2 '    if (!guard.ok) return guard.response;' `
  -Replace2 '' `
  -ExpectTest 'vendors routes name the vendors section and no weaker helper'

# 85. empty accept-either checked after auth - would open on a miswired caller without a cookie.
Invoke-Probe -Name 'empty any-section after auth' -File $AUTH_TS `
  -Find '  if (sections.length === 0) {
    throw new Error("Access denied to section: (none)");
  }

  const auth = await verifyAdminAuth();' `
  -Replace '  const auth = await verifyAdminAuth();

  if (sections.length === 0) {
    throw new Error("Access denied to section: (none)");
  }' `
  -ExpectTest 'guardAnySection refuses an empty section list before authenticating'

# 86. Closed-folder canary on vendors (single section, multi-handler - use -First carefully:
# mark-paid is single-handler).
Invoke-Probe -Name 'vendors mark-paid closed folder loses grant' -File 'apps/admin/app/api/vendors/[id]/mark-paid/route.ts' `
  -Find '    const guard = await guardSection("vendors");' `
  -Replace '    const g = 1; void g;' `
  -Find2 '    if (!guard.ok) return guard.response;' `
  -Replace2 '' `
  -ExpectTest 'and none of the closed folders leak an unguarded file'

Write-Host "`n=== R101r probes ===`n"

$FRAUD_ALERTS = 'apps/admin/app/api/fraud/alerts/route.ts'
$FRAUD_USER = 'apps/admin/app/api/fraud/user-status/route.ts'
$FRAUD_SCORE = 'apps/admin/app/api/fraud/suspicion-score/route.ts'
$FRAUD_BAN = 'apps/admin/app/api/fraud/investigation/ban/route.ts'

# 87. alerts unguarded - FraudMonitoringSection's list.
Invoke-Probe -Name 'fraud alerts unguarded' -File $FRAUD_ALERTS -First `
  -Find '    const guard = await guardSection("fraud");' `
  -Replace '    const g = 1; void g;' `
  -Find2 '    if (!guard.ok) return guard.response;' `
  -Replace2 '' `
  -ExpectTest 'every fraud file names the fraud section grant and no weaker helper'

# 88. user-status drops to users-only - locks FraudMonitoringSection out of its own folder.
Invoke-Probe -Name 'fraud user-status users only' -File $FRAUD_USER `
  -Find 'guardAnySection(["fraud", "users"])' `
  -Replace 'guardSection("users")' `
  -ExpectTest 'user-status accepts either the fraud or the users grant'

# 89. suspicion-score wrong section - a neighbouring grant that compiles.
# Reason: four handlers each name fraud; -First leaves three and the file-wide
# `named.includes("fraud")` stays green (fourth cause). Replace every call.
Invoke-Probe -Name 'fraud suspicion-score wrong section' -File $FRAUD_SCORE `
  -Find 'guardSection("fraud")' `
  -Replace 'guardSection("users")' `
  -ExpectTest 'every fraud file names the fraud section grant and no weaker helper'

# 90. investigation/ban unguarded - money-adjacent identity write.
Invoke-Probe -Name 'fraud investigation ban unguarded' -File $FRAUD_BAN -First `
  -Find '    const guard = await guardSection("fraud");' `
  -Replace '    const g = 1; void g;' `
  -Find2 '    if (!guard.ok) return guard.response;' `
  -Replace2 '' `
  -ExpectTest 'every fraud file names the fraud section grant and no weaker helper'

# 91. Closed-folder canary on the whole fraud/ tree.
Invoke-Probe -Name 'fraud closed folder loses grant' -File $FRAUD_ALERTS -First `
  -Find '    const guard = await guardSection("fraud");' `
  -Replace '    const g = 1; void g;' `
  -Find2 '    if (!guard.ok) return guard.response;' `
  -Replace2 '' `
  -ExpectTest 'and none of the closed folders leak an unguarded file'

# 92. Inventory canary - fraud leaves the helper frozen list.
Invoke-Probe -Name 'fraud inventory stays section-granted' -File $FRAUD_ALERTS -First `
  -Find '    const guard = await guardSection("fraud");' `
  -Replace '    const g = 1; void g;' `
  -Find2 '    if (!guard.ok) return guard.response;' `
  -Replace2 '' `
  -ExpectTest 'no route under a closed folder is anything but section-granted'

Write-Host ''
Write-Host 'UNPROBED, with the reason: "finds no route in the no-check-of-any-kind class" and' -ForegroundColor DarkGray
Write-Host '"finds no route in the hand-verified-no-grant class". Both are already green (empty' -ForegroundColor DarkGray
Write-Host 'after R101m/R101n). Turning either red means adding a route in that class, which the' -ForegroundColor DarkGray
Write-Host 'inventory ratchet also catches. The closed-folder leak check is the probeable guard.' -ForegroundColor DarkGray
Write-Host 'Helper debt after R101r: 122. Remaining are helper-but-no-grant folders (employees,' -ForegroundColor DarkGray
Write-Host 'settings, marketplace, invoices, gamemaster, ...).' -ForegroundColor DarkGray
Write-Host ''
