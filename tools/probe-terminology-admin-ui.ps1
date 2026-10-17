# Probe harness for X6.5 step A1b - the operator's wording screen and the writer behind it.
#
# Same rules as tools/probe-terminology-tokens.ps1 and probe-terminology-delivery.ps1: one
# defect, one named expected test, and a green probe is a question with four known answers
# (weak test, wrong claim, unreachable guard, mutation with no observable).
#
# THIS SUITE IS PART BEHAVIOURAL, so three probes mutate the SERVICE and are aimed at tests
# that talk to a real MongoDB. That matters for reading the output: a behavioural probe can
# legitimately turn more than one test red, because a broken writer breaks every test that
# stores something. Where that happens the count is noted against the probe rather than
# treated as harness damage.
#
# ONE PROBE IS DELIBERATELY ABSENT and the reason is in place at the bottom of the file.

$ErrorActionPreference = 'Continue'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$Suite = '__tests__/admin/terminology-admin-ui.test.ts'
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
    [string]$ExpectRed,
    [string]$AlsoFile,
    [string]$File2,
    [string]$From2,
    [string]$To2,
    [int]$AllowRed = 1
  )

  # Reason: an edit list rather than one pattern over several files, because two guards can
  # cover each other (R42's shape) and then neither is probeable alone - the trim rule lives
  # both in the writer and in `trim: true` on the schema, so the mutation has to hit both,
  # and those two files need different patterns.
  $edits = @(@{ Path = (Join-Path $root $File); From = (Relaxed $From); To = $To })
  if ($AlsoFile) {
    $edits += @{ Path = (Join-Path $root $AlsoFile); From = (Relaxed $From); To = $To }
  }
  if ($File2) {
    $edits += @{ Path = (Join-Path $root $File2); From = (Relaxed $From2); To = $To2 }
  }

  $originals = @{}

  foreach ($edit in $edits) {
    $path = $edit.Path
    # Reason: [IO.File]::ReadAllText, never Get-Content, and UTF-8 without a BOM on the
    # write. PowerShell 5.1 decodes with the system ANSI codepage, so every emoji in a
    # touched file comes back as mojibake and is written back that way - probes pass, files
    # are quietly mangled, and it surfaces two steps later as unexplained typecheck errors.
    $text = [IO.File]::ReadAllText($path)
    if ([string]::IsNullOrEmpty($text)) {
      Write-Host "HARNESS BROKEN  $Name - read returned nothing for $path" -ForegroundColor Magenta
      $script:fail++
      return
    }
    if (-not [regex]::IsMatch($text, $edit.From)) {
      Write-Host "DID NOT APPLY   $Name - pattern not found in $path" -ForegroundColor Magenta
      $script:fail++
      return
    }
    if (-not $originals.ContainsKey($path)) { $originals[$path] = $text }
  }

  try {
    foreach ($edit in $edits) {
      $path = $edit.Path
      $current = [IO.File]::ReadAllText($path)
      $mutated = [regex]::Replace($current, $edit.From, { param($m) $edit.To }, 1)
      if ($mutated -eq $current) {
        Write-Host "DID NOT APPLY   $Name - replacement changed nothing in $path" -ForegroundColor Magenta
        $script:fail++
        return
      }
      [IO.File]::WriteAllText($path, $mutated, (New-Object Text.UTF8Encoding $false))
    }

    $out = & cmd.exe /c "npx vitest run $Suite -t `"$ExpectRed`" --reporter=basic 2>&1" | Out-String
    $flat = ($out -replace '\s+', ' ')

    if ($flat -match 'Tests\s+(\d+)\s+failed') {
      $count = [int]$Matches[1]
      if ($count -le $AllowRed) {
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
    foreach ($path in $originals.Keys) {
      [IO.File]::WriteAllText($path, $originals[$path], (New-Object Text.UTF8Encoding $false))
    }
  }
}

$ROUTE = 'apps/admin/app/api/terminology/route.ts'
$PANEL = 'apps/admin/components/admin/TerminologySettingsSection.tsx'
$DASHBOARD = 'apps/admin/components/admin/AdminDashboard.tsx'
$SECTIONS = 'apps/admin/database/models/admin-employee.model.ts'
$SERVICE = 'lib/services/terminology.service.ts'
$SERVICE_ADMIN = 'apps/admin/lib/services/terminology.service.ts'
$MODEL = 'database/models/whitelabel.model.ts'

Write-Host "`n=== the route's authorization ===" -ForegroundColor Cyan

# 1. THE GUARD ON THE MUTATION ONLY REMOVED. The GET keeps its guard, which is what makes
#    this the interesting shape rather than the obvious one: every mention-based check still
#    passes while the PUT - the handler that rewrites every word on the platform - is open.
Invoke-Probe -Name '1  the PUT unguarded while the GET is not' -File $ROUTE `
  -From '  const guard = await guardSection("terminology");
  if (!guard.ok) return guard.response;

  try {
    const body = await request.json();' `
  -To '  const guard = { ok: true, admin: { email: "" } } as never;

  try {
    const body = await request.json();' `
  -ExpectRed 'every exported handler is matched by a guardSection call'

# 2. ADMIN-AT-ALL RATHER THAN THE GRANT. Ninth instance of this class in this codebase, so
#    the probe exists to prove the ban is enforced and not merely written down.
Invoke-Probe -Name '2  verifyAdminToken instead of the section grant' -File $ROUTE `
  -From 'import { guardSection } from "@/lib/admin/section-route-guard";' `
  -To 'import { verifyAdminToken } from "@/lib/admin/auth";' `
  -ExpectRed 'does not use a helper that only asks whether the caller is an admin at all'

# 3. THE SECTION ID REMOVED from the enum, which is what makes the grant ungrantable - so
#    only a super admin could ever reach the screen, and it reviews as a tidy-up.
Invoke-Probe -Name '3  terminology dropped from ADMIN_SECTIONS' -File $SECTIONS `
  -From '  "terminology",' -To '' `
  -ExpectRed 'terminology is a declared admin section, so the grant can be given'

Write-Host "`n=== overrides and defaults stay separate ===" -ForegroundColor Cyan

# 4. THE DEFECT THE WHOLE SCREEN IS SHAPED AROUND. Handing the form a resolved pack is the
#    obvious thing to do and it is unrecoverable: every default becomes an explicit override
#    on the first Save, and the platform can never correct a default word again here.
Invoke-Probe -Name '4  the route returns a merged pack' -File $ROUTE `
  -From '    const overrides = await getStoredTerminologyOverrides();
    return NextResponse.json({ success: true, overrides, defaults: TERMS });' `
  -To '    const overrides = await getTerms();
    return NextResponse.json({ success: true, overrides });' `
  -ExpectRed 'never resolves a merged pack in the route' -AllowRed 2

# 5. THE DEFAULTS WITHHELD. The form then has no placeholder source at all, so an untouched
#    box is blank with nothing to say what the word would be - and an operator fills it in,
#    which is defect 4 arriving by the operator's hand instead of the code's.
Invoke-Probe -Name '5  defaults left out of the response' -File $ROUTE `
  -From 'return NextResponse.json({ success: true, overrides, defaults: TERMS });' `
  -To 'return NextResponse.json({ success: true, overrides });' `
  -ExpectRed 'returns the stored overrides and the defaults under separate keys'

Write-Host "`n=== the PUT validates first ===" -ForegroundColor Cyan

# 6. VALIDATED AND THEN WRITTEN REGARDLESS. Note this is the defect a presence check cannot
#    see: the validator is still called, its result is still computed, and the refusal is
#    still in the file - it simply happens after the write.
Invoke-Probe -Name '6  the refusal moved below the write' -File $ROUTE `
  -From '    const validated = validateTerminologyOverrides(body?.overrides);
    if (!validated.ok) {
      return NextResponse.json({ error: validated.error }, { status: 400 });
    }

    await saveTerminologyOverrides(validated.overrides);' `
  -To '    const validated = validateTerminologyOverrides(body?.overrides);

    await saveTerminologyOverrides(validated.ok ? validated.overrides : {});
    if (!validated.ok) {
      return NextResponse.json({ error: validated.error }, { status: 400 });
    }' `
  -ExpectRed 'refuses before saving, not after'

# 7. THE UNKNOWN TOKEN DROPPED RATHER THAN REFUSED - a 200 on a save that did nothing, which
#    is this codebase's recurring failure mode and the one the operator blames themselves for.
Invoke-Probe -Name '7  an unknown token answered 200' -File $ROUTE `
  -From '      return NextResponse.json({ error: validated.error }, { status: 400 });' `
  -To '      return NextResponse.json({ success: true, overrides: {} });' `
  -ExpectRed 'refuses an unknown token with a 400 rather than dropping it'

Write-Host "`n=== the default is a placeholder, not a value ===" -ForegroundColor Cyan

# 8. THE RESOLVED PACK SEEDING THE FORM, from the browser side this time. `useTerms()` is
#    mounted and hands one over, so this is a two-line change that reads as an improvement.
Invoke-Probe -Name '8  the panel seeds its boxes from useTerms' -File $PANEL `
  -From 'const DEFAULTS = new Map<string, string>(Object.entries(TERMS));' `
  -To 'import { useTerms } from "@/contexts/TerminologyContext";

const DEFAULTS = new Map<string, string>(Object.entries(TERMS));' `
  -ExpectRed 'does not call useTerms - the resolved pack must not seed the form'

# 9. THE DEFAULT AS THE VALUE. One `??` away, renders identically until Save, and then
#    freezes all twenty-three words into the database.
Invoke-Probe -Name '9  the box pre-filled with the default' -File $PANEL `
  -From '                      value={draft.get(token) ?? ""}' `
  -To '                      value={draft.get(token) ?? DEFAULTS.get(token) ?? ""}' `
  -ExpectRed 'the input value is the stored override and the placeholder is the default'

# 10. ONLY THE FILLED BOXES SENT. The screen shows the override gone, the database still
#     holds it, and the next page load brings it back - so it reads as a caching problem.
Invoke-Probe -Name '10 cleared boxes omitted from the payload' -File $PANEL `
  -From '      const overrides = Object.fromEntries(
        TERMINOLOGY_TOKENS.map((token) => [token, draft.get(token) ?? ""]),
      );' `
  -To '      const overrides = Object.fromEntries([...draft].filter(([, v]) => v !== ""));' `
  -ExpectRed 'sends every token on save, including the emptied ones'

# 11. A TOKEN MISSING FROM THE GROUPS - a word no operator can ever change, on a screen that
#     looks complete. This is the one that fires on the day a token is added to the catalogue.
Invoke-Probe -Name '11 a token in no field group' -File $PANEL `
  -From '    tokens: ["level", "levels", "points"],' -To '    tokens: ["level", "levels"],' `
  -ExpectRed 'every token appears in exactly one field group'

# 12. A TOKEN IN TWO GROUPS, which is the same guard from the other side: two boxes for one
#     word, whose values silently disagree and whose last render wins.
Invoke-Probe -Name '12 a token in two field groups' -File $PANEL `
  -From '    tokens: ["game", "games"],' -To '    tokens: ["game", "games", "score"],' `
  -ExpectRed 'every token appears in exactly one field group'

Write-Host "`n=== the screen is reachable ===" -ForegroundColor Cyan

# 13. THE MENU ITEM REMOVED, so the whole feature exists and nobody can find it - the shape
#     of the help page telling players there is no open-challenge lobby.
Invoke-Probe -Name '13 no menu entry' -File $DASHBOARD `
  -From '          id: "terminology",' -To '          id: "terminology-disabled",' `
  -ExpectRed 'the settings menu carries a terminology child'

# 14. THE SECTION ID RENDERING NOTHING. Sections are driven by ?activeTab=<sectionId>, so a
#     case label that drifts from the id is a menu item that opens a blank pane.
Invoke-Probe -Name '14 the section id renders nothing' -File $DASHBOARD `
  -From '      case "terminology":' -To '      case "terminology-unused":' `
  -ExpectRed 'the section id renders the panel'

Write-Host "`n=== the writer ===" -ForegroundColor Cyan

# 15. THE WHOLE SUBDOCUMENT ASSIGNED. Every token the form did not send is silently cleared,
#     and the loss reads as the save having worked. Applied to BOTH copies, or the
#     byte-identical test fires too and the output stops being about one rule.
Invoke-Probe -Name '15 the whole subdocument written at once' -File $SERVICE -AlsoFile $SERVICE_ADMIN `
  -From '  const update: Record<string, unknown> = {};
  if (set.size > 0) update.$set = Object.fromEntries(set);
  if (unset.size > 0) update.$unset = Object.fromEntries(unset);' `
  -To '  const update: Record<string, unknown> = {
    $set: { terminologyOverrides: Object.fromEntries(set) },
  };' `
  -ExpectRed 'writes dotted paths rather than the whole subdocument' -AllowRed 2

# 16. A CLEARED TOKEN STORED AS "" RATHER THAN UNSET. Reads correctly everywhere, because
#     `resolveTerms` treats a blank as absent - so the only witness is the stored document,
#     and the value is then indistinguishable from an operator who typed a space.
Invoke-Probe -Name '16 a cleared token stored as an empty string' -File $SERVICE -AlsoFile $SERVICE_ADMIN `
  -From '    } else {
      unset.set(path, "");
    }' `
  -To '    } else {
      set.set(path, "");
    }' `
  -ExpectRed 'a blank value unsets the token rather than storing an empty string'

# 17. THE UPSERT REMOVED, so a fresh deployment with no WhiteLabel document matches nothing.
#     `findOneAndUpdate` reports no error on a miss, so the save appears to succeed.
Invoke-Probe -Name '17 no upsert, so a fresh deployment saves nothing' -File $SERVICE -AlsoFile $SERVICE_ADMIN `
  -From '{ upsert: true, new: false }' -To '{ upsert: false, new: false }' `
  -ExpectRed 'creates the settings document when none exists yet' -AllowRed 6

# 18. THE TOKEN GUARD REMOVED FROM THE WRITER, so a caller-named path reaches `$unset` -
#     which is how an unrelated part of the settings document gets deleted.
#
#     RE-AIMED. It first pointed at 'ignores a key that is not a token rather than writing
#     it' and came back GREEN, because Mongoose strict mode over twenty-three declared
#     fields strips the junk path whatever the service does - the guard is real and its
#     effect on the stored WORDING is nil. The observable is the document's EXISTENCE: with
#     the guard gone the update is non-empty, so the upsert creates a settings document on a
#     payload that named no token at all. Same class as R26's re-aim, and the test's comment
#     was corrected rather than quietly left crediting the wrong layer.
Invoke-Probe -Name '18 an unknown key written as a path' -File $SERVICE -AlsoFile $SERVICE_ADMIN `
  -From '    if (!isTerminologyToken(token)) continue;' -To '' `
  -ExpectRed 'an unknown key on its own causes no write at all'

# 19. THE TRIM DROPPED. A padded word is a different noun everywhere it is compared, and it
#     renders indistinguishably from the unpadded one.
#
#     TWO GUARDS COVER EACH OTHER HERE, which is why this probe mutates the SCHEMA as well:
#     the writer calls `.trim()` and every one of the twenty-three schema fields carries
#     `trim: true`, so removing either alone leaves the test green and neither is probeable
#     on its own (R42's shape). Both, in one edit, or the probe reports a guard that is not
#     doing its job when in fact its sibling is.
Invoke-Probe -Name '19 a padded word stored as typed' -File $SERVICE -AlsoFile $SERVICE_ADMIN `
  -From '      set.set(path, value.trim());' -To '      set.set(path, value);' `
  -File2 $MODEL -From2 '      contest: { type: String, trim: true },' `
  -To2 '      contest: { type: String },' `
  -ExpectRed 'trims a padded word, so an accidental space is not a different noun'

# 20. THE TWO COPIES DRIFTED. `check:mirrors` compares MODELS, so it has never had an opinion
#     about this file - and the admin copy is the one that runs when an operator saves.
Invoke-Probe -Name '20 the mirror drifted' -File $SERVICE_ADMIN `
  -From 'export async function saveTerminologyOverrides(' `
  -To '// drifted
export async function saveTerminologyOverrides(' `
  -ExpectRed 'the two service copies stay byte-identical'

# NO PROBE FOR 'asks for the terminology section specifically', and the reason rather than the
# omission: the only mutation that turns it red without also turning probe 1 or 2 red is
# changing the string to another section id - which is a real defect, but one probe 2's
# assertion cannot distinguish from the correct code, since both are section guards. The
# property is carried behaviourally the moment an employee without the grant is refused, and
# that needs a session the harness has no way to supply.

Write-Host ""
Write-Host "red: $($script:pass)   green or broken: $($script:fail)" -ForegroundColor Cyan
if ($script:fail -gt 0) { exit 1 }
