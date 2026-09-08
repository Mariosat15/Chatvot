# Probes for the disk-derived play-surface asset set (R52's second fix, 8 September 2026).
#
# Each probe reintroduces one defect and expects exactly the named test to fail. The first one
# reintroduces R52 ITSELF - the hand-written filename list - which is the only probe here that
# proves the outage cannot recur.
#
# HARNESS RULES LEARNED THE HARD WAY, all of which have produced a false result in this repository:
#   - UTF-8 WITHOUT a BOM on the read *and* the write. `Get-Content -Raw` decodes with the system
#     ANSI codepage on PowerShell 5.1, so every emoji in this file came back as mojibake and was
#     written back that way - probes passed while the file was quietly mangled.
#   - `-LiteralPath` on the read as well as the write, and refuse to write an empty read.
#   - Confirm the file actually changed before believing any outcome. A pattern that fails to
#     apply is indistinguishable from a test that does not work.
#   - Judge by the SUITE's own pass/fail counts, not by searching output for a test name: the
#     runner prints the name for a passing test as readily as a failing one.
#   - Expect a blast radius of one. More than two means the probe broke something structural
#     rather than the rule it names.

$ErrorActionPreference = 'Continue'
$File = Join-Path $PSScriptRoot "..\src\http\play-page.ts"
$File = (Resolve-Path -LiteralPath $File).Path
$Enc = New-Object System.Text.UTF8Encoding($false)

$Original = [System.IO.File]::ReadAllText($File, $Enc)
if ([string]::IsNullOrWhiteSpace($Original)) {
  Write-Host "ABORT: could not read $File"
  exit 1
}
Write-Host "Read $($Original.Length) chars from play-page.ts"
Write-Host ""

function Invoke-Probe {
  param(
    [string]$Name,
    [string]$Mutated,
    [string]$ExpectedTest,
    # Declared per probe rather than fixed at 2, because a wide blast radius is sometimes the
    # honest consequence of the mutation - see probe 1, which refuses six real files at once.
    [int]$MaxRed = 2
  )

  if ($Mutated -eq $Original) {
    Write-Host "  $Name : PROBE DID NOT APPLY - pattern did not match, outcome means nothing"
    return
  }

  [System.IO.File]::WriteAllText($File, $Mutated, $Enc)
  $check = [System.IO.File]::ReadAllText($File, $Enc)
  if ($check -eq $Original) {
    Write-Host "  $Name : WRITE DID NOT LAND"
    return
  }

  Push-Location (Join-Path $PSScriptRoot "..")
  $raw = (& npm run test:play 2>&1 | Out-String)
  Pop-Location

  $out = $raw -replace '\s+', ' '
  # NAME the failures, do not merely count them. A probe over its declared limit is either honest
  # (one mutation, several faces of one rule) or harness damage, and a count cannot tell the two
  # apart - which left four probes here reading as suspect when every extra failure was real.
  # Collapsed per LINE rather than over the whole output, because `Out-String` wraps at the console
  # width and a single collapse glues each failure's message onto the next test's name.
  $red = ($raw -split "`r?`n" | ForEach-Object { ($_ -replace '\s+', ' ').Trim() } |
    Where-Object { $_ -like 'FAIL *' }) -join ' / '

  [System.IO.File]::WriteAllText($File, $Original, $Enc)
  $restored = [System.IO.File]::ReadAllText($File, $Enc)
  if ($restored -ne $Original) {
    Write-Host "  $Name : RESTORE FAILED - fix the file before continuing"
    exit 1
  }

  if ($out -match 'Play and delivery tests: (\d+) passed, (\d+) failed') {
    $failed = [int]$Matches[2]
    if ($failed -eq 0) {
      Write-Host "  $Name : GREEN - the guard is missing or the test cannot see this"
    }
    elseif ($failed -le $MaxRed) {
      Write-Host "  $Name : RED ($failed failed) - expected `"$ExpectedTest`""
      if ($red -notmatch [regex]::Escape($ExpectedTest.Substring(0, [Math]::Min(40, $ExpectedTest.Length)))) {
        Write-Host "         BUT NOT THE EXPECTED TEST. Red: $red"
      }
    }
    else {
      Write-Host "  $Name : RED but $failed failed, over the declared limit of $MaxRed"
      Write-Host "         Red: $red"
    }
  }
  else {
    Write-Host "  $Name : NO RESULT LINE - the suite did not run to completion"
  }
}

Write-Host "Probing the disk-derived asset set"
Write-Host ""

# 1. R52 itself: go back to a hand-written filename list. This is the defect that took the game
#    down - a file on disk that the compiled code refuses.
$p1 = $Original.Replace(
  'const ASSETS: Map<string, { file: string; type: string }> = PLAY_ROOT
  ? readServableAssets(fs.readdirSync(PLAY_ROOT, { withFileTypes: true }))
  : new Map();',
  'const ASSETS: Map<string, { file: string; type: string }> = new Map([
  ["app.js", { file: "app.js", type: "text/javascript; charset=utf-8" }],
  ["app.css", { file: "app.css", type: "text/css; charset=utf-8" }],
  ["board.js", { file: "board.js", type: "text/javascript; charset=utf-8" }],
]);')
#
#    Declared at 4: the list names three files and the surface now ships nine, so reinstating it
#    also stops the artwork and `presentation.js` being served. That is what the outage looked
#    like, so the extra failures are the defect rather than harness damage. It rose from 3 to 4
#    when the fingerprinted walk was added - a second module walk, so a second honest face.
Invoke-Probe "1 hand-written list is back (R52)" $p1 "this checkout's own play surface agrees with this build" 4

# 2. The derived set stops reading the directory and returns a fixed set, so a file added
#    tomorrow is refused. Same defect, aimed at the regression test rather than the repo check.
$p2 = $Original.Replace(
  '    assets.set(entry.name, { file: entry.name, type });',
  '    if (entry.name === "somethingaddedtomorrow.js") continue;
    assets.set(entry.name, { file: entry.name, type });')
Invoke-Probe "2 a new file is refused" $p2 "a new module needs no code change to be served"

# 3. The extension allowlist becomes permissive - the whole of the remaining protection.
$p3 = $Original.Replace(
  '    const type = CONTENT_TYPES.get(path.extname(entry.name).toLowerCase());
    if (!type) continue;',
  '    const type =
      CONTENT_TYPES.get(path.extname(entry.name).toLowerCase()) ?? "application/octet-stream";')
Invoke-Probe "3 unknown file types are served" $p3 "the served set refuses everything except a recognised file type"

# 4. The document gains a second route through the asset table.
#
# RE-AIMED, and the first version is worth recording. It mutated the explicit `index.html` skip
# and came back GREEN - the third cause of a green probe, after a weak test and a wrong claim:
# THE GUARD IS REAL AND UNREACHABLE. `.html` is not in `CONTENT_TYPES`, so the document is already
# refused one line later and the name check decides nothing today. The property lives in the
# extension table, so that is what this now mutates - which is also the realistic change, since
# somebody adding a rules page is how `.html` would arrive.
$p4 = $Original.Replace(
  '  [".svg", "image/svg+xml"],',
  '  [".svg", "image/svg+xml"],
  [".html", "text/html; charset=utf-8"],')
Invoke-Probe "4 html becomes a servable type" $p4 "index.html is not in the served set"

# 5. Directories are treated as files.
$p5 = $Original.Replace(
  '    if (!entry.isFile()) continue;',
  '    if (false) continue;')
Invoke-Probe "5 a directory is served" $p5 "a directory is never served, however plausibly it is named"

# 6. The boot audit stops reporting a file type it cannot serve - the one thing the audit still
#    catches now that the filename half is structurally impossible.
$p6 = $Original.Replace(
  '      .filter((file) => PLAUSIBLE_ASSET.test(file) && !servable.has(file))',
  '      .filter((file) => false && PLAUSIBLE_ASSET.test(file) && !servable.has(file))')
Invoke-Probe "6 the audit reports nothing unserved" $p6 "a file this build will not serve is reported, and named"

Write-Host ""
Write-Host "Probing the fingerprinted asset URLs (the 8 Sep stale-module outage)"
Write-Host ""

# 7. THE OUTAGE ITSELF: the document goes back to naming the bare assets, so a four-hour-old
#    `presentation.js` is addressable again and can be loaded against a newer `board.js`.
$p7 = $Original.Replace(
  '  const result = versionPlayDocument(raw, ASSET_VERSION);',
  '  const result = { html: raw, rewritten: [], missing: [] as string[] };')
#    Declared at 3, all three honest faces of one rule: the reference check, the relative-import
#    walk, and the cache-header test, which locates the versioned entry point by reading the
#    document and therefore cannot find one either.
Invoke-Probe "7 the document names the bare assets again" $p7 "the document points at fingerprinted assets, and never at the bare ones" 3

# 8. The obvious "simplification" - a query string instead of a path segment. It versions the two
#    files the document names and leaves every nested module bare, which is precisely the file
#    that broke: `board.js` imports `./presentation.js` as a literal with nowhere to put a `?v=`.
#
#    This is the probe worth keeping above all the others here, because the mutation reads as
#    equivalent and the test that catches it is the relative-import walk, not the reference check.
$p8 = $Original.Replace(
  '    const versioned = `/play/${version}${reference.slice("/play".length)}`;',
  '    const versioned = `${reference}?${version}`;')
#    Declared at 4: probe 7's three, plus the unit test on `versionPlayDocument` itself, which
#    asserts the rewritten form. Wide because the mutation is at the one point every face passes
#    through - which is also why it is the mutation most worth having a probe for.
Invoke-Probe "8 the version becomes a query string" $p8 "a module reached by relative import inherits the fingerprint" 4

# 9. The fingerprint stops depending on the bytes, so a deploy publishes the same URLs and the
#    stale copy is served straight back out of the browser's cache.
$p9 = $Original.Replace(
  '    digest.update(crypto.createHash("sha256").update(file.bytes).digest());',
  '    digest.update("constant");')
Invoke-Probe "9 the fingerprint ignores the content" $p9 "the fingerprint follows the bytes, not the file dates or the listing order"

# 10. The listing order leaks into the fingerprint, so two servers with the same files publish
#     different URLs and a balancer alternating between them re-downloads the surface.
$p10 = $Original.Replace(
  '  for (const file of [...files].sort((a, b) => a.name.localeCompare(b.name))) {',
  '  for (const file of files) {')
Invoke-Probe "10 the fingerprint depends on the listing order" $p10 "the fingerprint follows the bytes, not the file dates or the listing order"

# 11. A failed rewrite stops being reported, so the guarantee is lost in silence - the whole
#     reason `missing` is returned rather than inferred from the document being unchanged.
$p11 = $Original.Replace(
  '      missing.push(reference);',
  '      /* swallowed */')
Invoke-Probe "11 a failed rewrite is not reported" $p11 "a document that stops naming an asset says so instead of failing quietly"

# 12. THE REGRESSION THE ROUTE SHAPE INVITES, and it would be a total outage: the version segment
#     stops being recognised by shape, so `/play/api/state` is captured by the asset route and the
#     board's poll answers 404 for the whole round.
$p12 = $Original.Replace(
  '  return /^v-[0-9a-f]{12}$/.test(segment);',
  '  return segment.length > 0;')
#     Declared at 5, AND THE THREE EXTRA FAILURES ARE THE FINDING RATHER THAN NOISE: three
#     unrelated round-state tests go red, because the state poll really is answered by the asset
#     route once the shape check is gone. The probe was written expecting two failures and the
#     honest number is five - which is the clearest evidence available that this is an outage
#     rather than a tidy-up, and it is why the handler hands unrecognised segments back.
Invoke-Probe "12 any segment counts as a version" $p12 "the versioned route does not swallow the API the board polls" 5

# 13. The version stops handing an unrecognised segment back and refuses it instead, which is the
#     ordering-dependent version of probe 12 - correct today only because of where the route sits.
$p13 = $Original.Replace(
  '    if (next) next();
    else sendError(res, 404, "NOT_FOUND", "No such asset.");
    return;',
  '    sendError(res, 404, "NOT_FOUND", "No such asset.");
    return;')
#     Declared at 4, the same three round-state tests as probe 12. Worth keeping separately from
#     it: probe 12 breaks the recognition, this one keeps it and removes only the fall-through, so
#     it isolates the half that a reader would call defensive.
Invoke-Probe "13 an unknown segment is refused rather than passed on" $p13 "the versioned route does not swallow the API the board polls" 4

# 14. `immutable` is dropped, so every load pays a revalidation round trip mid-contest - the payoff
#     rather than a header detail, on a phone, against a clock the player is scored on.
$p14 = $Original.Replace(
  '    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");',
  '    /* dropped */')
Invoke-Probe "14 a fingerprinted asset is not immutable" $p14 "a fingerprinted asset is immutable and a bare one still revalidates"

Write-Host ""
Write-Host "Done. play-page.ts restored to its original $($Original.Length) chars."
