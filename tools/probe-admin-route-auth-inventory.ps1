# R101d - mutation probes for __tests__/admin/admin-route-auth-inventory.test.ts
#
# Each probe reintroduces one defect the suite claims to catch and asserts the run goes red on
# EXACTLY the named test. The count is the signal, not the failure: a one-line change that turns
# five tests red is not reporting on the guard it was aimed at, it has broken the file.
#
# Harness rules learned the hard way and repeated here because forgetting any one of them
# produces a false pass:
#   - -LiteralPath on the READ as well as the write. Next.js dynamic routes contain [userId],
#     which PowerShell parses as a wildcard character class, so Get-Content matches nothing,
#     returns $null, and Set-Content happily writes it back - emptying the file and then
#     "restoring" it to nothing.
#   - Refuse to write when the read came back empty, for the same reason.
#   - UTF-8 without a BOM on both, because PowerShell 5.1's -Raw decodes with the system ANSI
#     codepage and mangles every emoji in the touched file.
#   - Assert the file actually changed. A probe that fails to apply is indistinguishable from a
#     test that does not work.
#   - Run the expected test ALONE with -t and read the summary counts. Searching whole-suite
#     output for a test's name finds it whether it passed or failed.
#   - -t is a REGULAR EXPRESSION. Keep the names here regex-safe.

$ErrorActionPreference = "Continue"
$Suite = "__tests__/admin/admin-route-auth-inventory.test.ts"
$Root = Split-Path -Parent $PSScriptRoot

function Read-File([string]$Path) {
  $full = Join-Path $Root $Path
  $text = [System.IO.File]::ReadAllText($full, [System.Text.UTF8Encoding]::new($false))
  if ([string]::IsNullOrEmpty($text)) { throw "read of $Path came back empty" }
  return $text
}

function Write-File([string]$Path, [string]$Text) {
  if ([string]::IsNullOrEmpty($Text)) { throw "refusing to write nothing to $Path" }
  [System.IO.File]::WriteAllText(
    (Join-Path $Root $Path), $Text, [System.Text.UTF8Encoding]::new($false))
}

function Invoke-Probe {
  param(
    [int]$Number,
    [string]$What,
    [string]$Expect,
    [string]$Path,
    [string]$Find,
    [string]$Replace
  )

  $original = Read-File $Path
  # Reason: relax every newline so a CRLF pattern still matches an LF file, and vice versa.
  $pattern = [regex]::Escape($Find) -replace "\\r\\n|\\n", "\r?\n"
  $mutated = [regex]::Replace($original, $pattern, { param($m) $Replace }, 1)

  if ($mutated -eq $original) {
    Write-Host "PROBE $Number DID NOT APPLY - $What" -ForegroundColor Magenta
    Write-Host "  the target has moved; this is not evidence about the guard" -ForegroundColor Magenta
    return
  }

  Write-File $Path $mutated
  try {
    $out = & npx vitest run $Suite -t $Expect 2>&1 | Out-String
  } finally {
    Write-File $Path $original
  }

  $flat = ($out -replace "\s+", " ")
  $failed = 0
  if ($flat -match "Tests\s+(\d+)\s+failed") { $failed = [int]$Matches[1] }

  if ($failed -eq 1) {
    Write-Host "PROBE $Number RED (1 failure) - $What" -ForegroundColor Green
  } elseif ($failed -eq 0) {
    Write-Host "PROBE $Number GREEN - $What" -ForegroundColor Red
    Write-Host "  the guard did not fire. Weak test, wrong claim, unreachable guard, or a" -ForegroundColor Red
    Write-Host "  mutation with no observable - decide which before believing either outcome." -ForegroundColor Red
  } else {
    Write-Host "PROBE $Number RED ($failed failures) - $What" -ForegroundColor Yellow
    Write-Host "  more damage than the mutation caused; not reporting on this guard" -ForegroundColor Yellow
  }
}

Write-Host ""
Write-Host "R101d - admin route authorization inventory" -ForegroundColor Cyan
Write-Host ""

# 1. The ratchet's forward direction: a newly unguarded route must land in a list.
#    Reason: this is the whole point of the suite - a route.ts added next month with no
#    authorization. Simulated by taking the grant off one that has it.
#    badges-xp rather than badges: the latter is under a closed folder, so unguarding it makes
#    two claims at once, and a probe reporting on two guards reports on neither.
Invoke-Probe -Number 1 `
  -What "a guarded route loses its grant and is not recorded as debt" `
  -Expect "the routes with no check of any kind are exactly the recorded list" `
  -Path "apps/admin/app/api/badges-xp/route.ts" `
  -Find "guardSection(" -Replace "noGuardSection("

# 2. The ratchet's reverse direction: guarding a recorded route must turn it red, so the line
#    is deleted in the same commit as the guard - the only moment anybody knows why.
Invoke-Probe -Number 2 `
  -What "a recorded route is guarded and its line is left behind" `
  -Expect "the routes with no check of any kind are exactly the recorded list" `
  -Path "apps/admin/app/api/market-status/route.ts" `
  -Find "export async function GET" `
  -Replace "const _unused = guardSection('market-data');`nexport async function GET"

# 3. The hand-verified class exists at all. Reason: sixteen routes refuse a forgery against the
#    real secret while asking nothing about grants, and a grep for helper names walks past
#    every one of them. Collapsing the class into the no-check list must be visible.
Invoke-Probe -Number 3 `
  -What "a hand-verified route stops being distinguishable from an unguarded one" `
  -Expect "the routes that hand-verify a token are exactly the recorded list" `
  -Path "__tests__/helpers/route-guard-audit.ts" `
  -Find "return /\b(verify|jwtVerify|decode)\s*\(\s*token/;" `
  -Replace "return /\bthis-never-matches-anything\b/;"

# 4. The largest class. Reason: an employee granted one unrelated section passes all 189 of
#    these, so the list is the measure of how much of R101c is mechanical.
Invoke-Probe -Number 4 `
  -What "a route gains a helper without a grant and is not recorded" `
  -Expect "the routes that authenticate without a grant are exactly the recorded list" `
  -Path "apps/admin/app/api/withdrawals/route.ts" `
  -Find "await verifyAdminAuth()" -Replace "await guardSection('financial')"

# 5. THE SEVERITY ASSERTION. Reason: a helper called after the write has already let the write
#    happen. users/edit was exactly this shape, and it sat in the middle class reviewing as
#    careful. Proven able to fire against 87d13897, where it reports three.
Invoke-Probe -Number 5 `
  -What "a handler authenticates only after it has written" `
  -Expect "no handler authenticates only after it has written to the database" `
  -Path "apps/admin/app/api/users/credit/route.ts" `
  -Find "const guard = await guardSection(" `
  -Replace "await Wallet.updateOne({}, {});`n    const guard = await guardSection("

# 6. A carve-out that outlives its route. Reason: the line then excuses nothing while reading
#    as though it excuses something, and the next route at that path inherits an exemption
#    nobody granted.
Invoke-Probe -Number 6 `
  -What "a public-by-design carve-out names a route that no longer exists" `
  -Expect "every carve-out still exists, and still carries its reason" `
  -Path "tools/admin-routes/auth-inventory.ts" `
  -Find '"auth/login/route.ts":' -Replace '"auth/login-renamed/route.ts":'

# 7. An unexplained carve-out. Reason: indistinguishable from a route somebody could not be
#    bothered to guard, which is how a judgement list rots into a list of excuses.
Invoke-Probe -Number 7 `
  -What "a carve-out loses its reason" `
  -Expect "every carve-out still exists, and still carries its reason" `
  -Path "tools/admin-routes/auth-inventory.ts" `
  -Find '"Clears the caller''s own cookie. It can do nothing to anybody else.",' `
  -Replace '"ok",'

# 8. A carve-out kept after the route was guarded. Reason: several of these are arguable, so
#    the exemption must travel with the decision rather than outlast it.
Invoke-Probe -Number 8 `
  -What "a carved-out route is guarded and the carve-out is kept" `
  -Expect "refuses to excuse a carve-out that has since been guarded" `
  -Path "apps/admin/app/api/auth/check-session/route.ts" `
  -Find "export async function GET" `
  -Replace "const _unused = guardSection('overview');`nexport async function GET"

# 9. THE ASSET CARVE-OUT'S LOAD-BEARING HALF. Reason: those files each call writeFile, which is
#    a disk restore of something already in our database - safe only while the route cannot be
#    asked to do anything but read. A POST turns an unauthenticated reader into an
#    unauthenticated upload, and it reviews as a small addition to a file already marked public.
Invoke-Probe -Number 9 `
  -What "a write method is added to a public asset route" `
  -Expect "the asset and video routes are read-only" `
  -Path "apps/admin/app/api/assets/hero/[filename]/route.ts" `
  -Find "export async function GET" `
  -Replace "export async function POST() { return new Response(); }`nexport async function GET"

# 10. The assertion that outlives the lists. Reason: a route under a finished folder without a
#     grant is a regression rather than inherited debt, and it is the exact defect users/edit
#     shipped with.
#     THIS PROBE CAME BACK GREEN FIRST TIME and the test was the thing at fault, not the claim.
#     It compared the CLOSED_FOLDERS against the frozen lists, so taking a grant off a users/
#     route moved it in the scan while the hand-written list of course still did not mention
#     it - a tautology that could only fail if somebody hand-typed a users/ route into the
#     record. Re-pointed at the live scan, which is strictly stronger and fires immediately.
Invoke-Probe -Number 10 `
  -What "a route under a closed folder loses its grant" `
  -Expect "no route under a closed folder is anything but section-granted" `
  -Path "apps/admin/app/api/users/presence/route.ts" `
  -Find "guardSection(" -Replace "noGuardSection("

# 11. THE VACUITY MUTATION. Reason: every assertion here is a comparison against a scan that
#     lives in code the suite imports, so a classifier answering "section-granted" for
#     everything is the one change that would make the whole file meaningless.
#     AIMED AT A LIST TEST, NOT AT THE SUM TEST, and the first aim was wrong: the sum is a
#     PARTITION check and is invariant under moving routes between buckets - emptying three
#     lists and growing the fourth by the same amount leaves the total identical, so it passed.
#     The comment in the suite crediting it with catching this was corrected rather than the
#     probe being loosened, because an overstated comment on the one test everybody would
#     believe covers vacuity is worse than no test at all.
Invoke-Probe -Number 11 `
  -What "the classifier calls everything guarded, emptying every list" `
  -Expect "the routes that authenticate without a grant are exactly the recorded list" `
  -Path "__tests__/helpers/route-guard-audit.ts" `
  -Find 'if (anyAuthHelperPattern().test(code)) return "helper-no-grant";' `
  -Replace 'if (true) return "section-granted";'

# 12. The control on the control. Reason: the re-derivation test exists precisely because the
#     classifier is imported rather than reimplemented, so it must itself be able to fail.
Invoke-Probe -Number 12 `
  -What "the classifier stops recognising a section grant" `
  -Expect "reads the same answer from the classifier as from the files themselves" `
  -Path "__tests__/helpers/route-guard-audit.ts" `
  -Find "if (guardCallPattern().test(code) || /requireSectionAccess\s*\(/.test(code)) {" `
  -Replace "if (false) {"

Write-Host ""
Write-Host "Probes 1-12 complete." -ForegroundColor Cyan
Write-Host ""
