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
  $out = (& npm run test:play 2>&1 | Out-String) -replace '\s+', ' '
  Pop-Location

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
    }
    else {
      Write-Host "  $Name : RED but $failed failed, over the declared limit of $MaxRed - suspect the harness, not the guard"
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
#    Declared at 3: the list names three files and the surface now ships nine, so reinstating it
#    also stops the artwork and `presentation.js` being served. That is what the outage looked
#    like, so the extra failures are the defect rather than harness damage.
Invoke-Probe "1 hand-written list is back (R52)" $p1 "this checkout's own play surface agrees with this build" 3

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
Write-Host "Done. play-page.ts restored to its original $($Original.Length) chars."
