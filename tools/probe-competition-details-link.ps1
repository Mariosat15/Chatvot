# Probes for __tests__/games/competition-details-link.test.ts
#
# Each probe reintroduces one real defect and asserts the EXPECTED test goes red, on its own.
#
# Harness rules, every one of them learned by getting it wrong:
#   - `-LiteralPath` on the READ as well as the write. These paths contain `[id]`, which
#     PowerShell parses as a wildcard character class: `Get-Content` returns $null, the write
#     succeeds, and the file is emptied. Every probe then goes red for the wrong reason and the
#     tell is the failure COUNT, not the failure.
#   - Refuse to write when the read came back empty, for the same reason.
#   - UTF-8 without a BOM on both sides, asserted by a lossless round trip. PowerShell 5.1
#     decodes with the system codepage, which mangles emoji and surfaces two steps later as
#     unexplained typecheck errors.
#   - Confirm the replacement actually changed the file. A probe that fails to apply is
#     indistinguishable from a test that does not work.
#   - Run the expected test ALONE with `-t` and read the summary counts. Searching whole-suite
#     output for a test's name finds it whether it passed or failed.

$ErrorActionPreference = 'Continue'
$Root = Split-Path -Parent $PSScriptRoot
$Utf8 = New-Object System.Text.UTF8Encoding $false

function Read-File([string]$Rel) {
  $full = Join-Path $Root $Rel
  $text = [System.IO.File]::ReadAllText($full, $Utf8)
  if ([string]::IsNullOrEmpty($text)) { throw "PROBE ABORT: read $Rel came back empty" }
  return $text
}

function Write-File([string]$Rel, [string]$Text) {
  if ([string]::IsNullOrEmpty($Text)) { throw "PROBE ABORT: refusing to write empty $Rel" }
  [System.IO.File]::WriteAllText((Join-Path $Root $Rel), $Text, $Utf8)
}

# Escapes the literal then relaxes every newline, so a CRLF pattern matches an LF file.
function Relaxed([string]$Literal) {
  return ([regex]::Escape($Literal) -replace '\\r\\n|\\n', '\r?\n')
}

function Invoke-Probe {
  param(
    [string]$Name,
    [string]$File,
    [string]$From,
    [string]$To,
    [string]$ExpectTest
  )

  $original = Read-File $File
  $pattern = Relaxed $From
  $mutated = [regex]::Replace($original, $pattern, { param($m) $To }, 1)

  if ($mutated -eq $original) {
    Write-Host "[$Name] PROBE DID NOT APPLY - pattern not found in $File" -ForegroundColor Magenta
    return
  }

  try {
    Write-File $File $mutated

    $out = & npx vitest run __tests__/games/competition-details-link.test.ts -t "$ExpectTest" 2>&1 |
      Out-String
    $flat = ($out -replace '\s+', ' ')

    $failed = 0
    if ($flat -match 'Tests\s+(\d+)\s+failed') { $failed = [int]$Matches[1] }

    if ($failed -ge 1) {
      Write-Host "[$Name] RED ($failed failed) - '$ExpectTest'" -ForegroundColor Green
    } else {
      Write-Host "[$Name] GREEN - '$ExpectTest' did not fail. Guard absent, test weak, or probe aimed wrong." -ForegroundColor Red
      Write-Host $flat
    }
  } finally {
    Write-File $File $original
    $restored = Read-File $File
    if ($restored -ne $original) { Write-Host "[$Name] RESTORE FAILED" -ForegroundColor Red }
  }
}

$HELPER = "lib/utils/competition-details-view.ts"
$LOBBY = "app/(root)/competitions/[id]/page.tsx"
$RESULTS = "app/(root)/competitions/[id]/results/page.tsx"
$SCREEN = "components/games/ProviderResultsScreen.tsx"

Write-Host "=== Probing the details-link guards ===" -ForegroundColor Cyan

# 1. The original defect, verbatim: the game screen's lobby button loses the query string.
Invoke-Probe -Name "1 provider button bare" -File $SCREEN `
  -From 'href={competitionDetailsHref(contestId)}' `
  -To 'href={`/competitions/${contestId}`}' `
  -ExpectTest "the provider results screen links through the helper"

# 2. The same defect on the results page header, which is the provider branch's own link.
#    Counted rather than found, so removing ONE of the two must still go red.
Invoke-Probe -Name "2 one branch bare" -File $RESULTS `
  -From 'href={competitionDetailsHref(competitionId)}' `
  -To 'href={`/competitions/${competitionId}`}' `
  -ExpectTest "both results branches link through the helper"

# 3. The gate reads a literal again, which is the other half of the drift.
Invoke-Probe -Name "3 gate reads literal" -File $LOBBY `
  -From '!wantsCompetitionDetailsView(query)' `
  -To 'query.view !== "details"' `
  -ExpectTest "the lobby gate asks the module whether the details view was requested"

# 4. A repeated parameter silently loses the button.
Invoke-Probe -Name "4 array not handled" -File $HELPER `
  -From 'return value.includes(COMPETITION_DETAILS_VIEW);' `
  -To 'return false;' `
  -ExpectTest "a repeated parameter is still a request for the details view"

# 5. The link and the gate stop agreeing. This is the round trip, and it is the one probe that
#    no assertion on either half alone can catch.
Invoke-Probe -Name "5 link and gate disagree" -File $HELPER `
  -From 'return `/competitions/${competitionId}?${COMPETITION_VIEW_PARAM}=${COMPETITION_DETAILS_VIEW}`;' `
  -To 'return `/competitions/${competitionId}?mode=${COMPETITION_DETAILS_VIEW}`;' `
  -ExpectTest "a href the helper builds opens the gate that reads it"

# 6. A new call site hand-composes the query string beside the import, which is the shape the
#    negative assertion exists for.
Invoke-Probe -Name "6 hand-composed string" -File $SCREEN `
  -From 'href={competitionDetailsHref(contestId)}' `
  -To 'href={`/competitions/${contestId}?view=details`}' `
  -ExpectTest "no screen composes the query string by hand"

Write-Host "=== Done ===" -ForegroundColor Cyan
