# Probes the R63 guard: every content field the contract requires has somewhere to be stored.
#
# Each probe reintroduces one part of the defect, runs ONE named test, and expects it red with
# exactly one failure. A probe that turns five tests red is reporting harness damage rather than
# a working guard, which is why the failing test names are printed rather than counted.
#
# CONVENTIONS THAT HAVE EACH COST A FALSE RESULT HERE BEFORE:
#   - UTF-8 without a BOM on the read AND the write. PowerShell 5.1's `Get-Content -Raw` decodes
#     with the system codepage, so every emoji in a touched service comes back as mojibake and is
#     written back that way - probes pass, files are quietly mangled, and it surfaces two steps
#     later as unexplained typecheck errors.
#   - `-LiteralPath` on both, because a path containing `[id]` is a PowerShell wildcard class.
#   - Newlines relaxed to `\r?\n`, and a refusal to write when the replacement did not apply.
#     DID NOT APPLY means the target moved, never that the run was quiet.
#   - The expected test is named and run alone with `-t`. A probe aimed at the wrong test is
#     indistinguishable from a test that does not work.
#
# PROBE 12 IS THE ONE WORTH KEEPING. It adds a seventh required field to the ISSUED
# SPECIFICATION and touches no code at all. That is the exact shape of the defect - a contract
# demanding something the platform stores nowhere - so if it comes back green, the tripwire is
# decoration and the next forgotten field ships in silence.

$ErrorActionPreference = 'Continue'
$root = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $root

$enc = New-Object System.Text.UTF8Encoding $false

$CONTRACT  = "lib/services/game-providers/contract.ts"
$CATALOGUE = "lib/services/game-providers/catalogue.service.ts"
$ADAPTER   = "lib/services/game-providers/adapters/chartvolt-games.adapter.ts"
$FIELDS    = "apps/admin/lib/admin/game-content-fields.ts"
$DIALOG    = "apps/admin/components/admin/games/GameContentDialog.tsx"
$SPEC      = "External game plans/01-provider-contract-specification.md"
$ADMIN_CONTRACT = "apps/admin/lib/services/game-providers/contract.ts"

$GUARD = "__tests__/services/provider-content-fields.test.ts"

function Read-File([string]$rel) {
  return [System.IO.File]::ReadAllText((Join-Path $root $rel), $enc)
}

function Write-File([string]$rel, [string]$text) {
  [System.IO.File]::WriteAllText((Join-Path $root $rel), $text, $enc)
}

# Escapes the pattern, then relaxes every newline, so a CRLF pattern matches an LF file.
function To-Relaxed([string]$literal) {
  return ([regex]::Escape($literal) -replace '\\r\\n', '\r?\n') -replace '\\n', '\r?\n'
}

function Invoke-Probe {
  param(
    [string]$Name,
    [string]$File,
    [string]$Find,
    [string]$Replace,
    [string]$ExpectTest
  )

  $original = Read-File $File
  $pattern  = To-Relaxed $Find
  $mutated  = [regex]::Replace($original, $pattern, { param($m) $Replace }, 1)

  if ($mutated -eq $original) {
    Write-Host "  DID NOT APPLY  $Name" -ForegroundColor Magenta
    Write-Host "                 (the target moved - fix the probe, do not assume a pass)"
    return
  }

  Write-File $File $mutated
  try {
    $out = & npx vitest run $GUARD -t $ExpectTest --reporter=verbose 2>&1 | Out-String
  } finally {
    Write-File $File $original
  }

  # Collapse whitespace per line: `Out-String` wraps at the console width, so a long test name
  # arrives split across two lines and a literal match silently misses it.
  $flat = ($out -split "`n" | ForEach-Object { ($_ -replace '\s+', ' ').Trim() }) -join "`n"

  $failed = [regex]::Matches($flat, '(?m)^\s*(?:FAIL|×)\s+(.+)$') |
            ForEach-Object { $_.Groups[1].Value } |
            Sort-Object -Unique

  if ($flat -match 'Tests\s+(\d+)\s+failed') {
    $count = [int]$Matches[1]
    if ($count -eq 1) {
      Write-Host "  RED (1)        $Name" -ForegroundColor Green
    } else {
      Write-Host "  RED ($count)  $Name  <-- more than one; read the names" -ForegroundColor Yellow
      $failed | ForEach-Object { Write-Host "                 $_" }
    }
  } else {
    Write-Host "  GREEN          $Name  <-- THE GUARD DID NOT CATCH IT" -ForegroundColor Red
  }
}

Write-Host ""
Write-Host "R63 - the contract's required content has somewhere to be stored" -ForegroundColor Cyan
Write-Host ""

# 1-2. The defect itself: a required field left out of the sync allow-list. Two of them,
# because `tagline` had a model field waiting for it and `rulesSummary` did not, and those
# are the two halves of how this went unnoticed for as long as it did.
Invoke-Probe -Name "the sync drops tagline again" `
  -File $CATALOGUE `
  -Find  "    tagline: game.tagline,`n" `
  -Replace "" `
  -ExpectTest "stores every content field the issued specification marks required"

Invoke-Probe -Name "the sync drops rulesSummary again" `
  -File $CATALOGUE `
  -Find  "    rulesSummary: game.rulesSummary,`n" `
  -Replace "" `
  -ExpectTest "stores every content field the issued specification marks required"

# 3. An absent value stored as "" - the shape every consumer's fallback stops firing on.
Invoke-Probe -Name "an omitted field is stored as an empty string" `
  -File $CATALOGUE `
  -Find  "    tagline: game.tagline," `
  -Replace "    tagline: game.tagline ?? `"`"," `
  -ExpectTest "leaves a content field the provider omitted UNSET"

# 4. The tidy-looking mistake: move content to provider-owned "for consistency" with the
# capability fields, which silently reverts every operator edit on the next scheduled sync.
Invoke-Probe -Name "content becomes provider-owned, reverting operator edits" `
  -File $CATALOGUE `
  -Find  "    providerStatus: game.status,`n  };" `
  -Replace "    providerStatus: game.status,`n    tagline: game.tagline,`n    rulesSummary: game.rulesSummary,`n    howToPlay: game.howToPlay,`n    bannerUrl: game.bannerUrl,`n  };" `
  -ExpectTest "does NOT revert an operator's edit to content on the next sync"

# 5. The mirror image, and the reason test 5 is not decoration: the same edit made in the
# other direction leaves every content assertion green while a provider correcting how their
# own game ranks is ignored for ever.
Invoke-Probe -Name "scoreDirection becomes first-sync-only" `
  -File $CATALOGUE `
  -Find  "    scoreDirection: game.scoreDirection,`n" `
  -Replace "" `
  -ExpectTest "still honours the provider for fields that are THEIRS to declare"

# 6. Where the four fields were actually lost: the shape the adapter returns.
Invoke-Probe -Name "the contract type loses rulesSummary" `
  -File $CONTRACT `
  -Find  "  rulesSummary?: string;" `
  -Replace "" `
  -ExpectTest "declares all six on the catalogue contract"

# 7. Read but never assigned - the failure a payload-interface check cannot see, because the
# field is named in the file either way.
Invoke-Probe -Name "howToPlay is read and then never assigned" `
  -File $ADAPTER `
  -Find  "  if (howToPlay) game.howToPlay = howToPlay;" `
  -Replace "  if (howToPlay) void howToPlay;" `
  -ExpectTest "parses all six in the ChartVolt Games adapter"

# 8. Both apps sync catalogues, so a drifted copy means what a title stores depends on which
# process ran the sync. `check:mirrors` compares models and has no opinion about this file.
Invoke-Probe -Name "the admin copy of the contract drifts" `
  -File $ADMIN_CONTRACT `
  -Find  "  howToPlay?: string;" `
  -Replace "" `
  -ExpectTest "keeps the two apps' copies of the whole path identical"

# 9-10. The operator half. A field the allow-list admits and the validation loop ignores is
# accepted, never trimmed and never length-checked, so it saves and then fails at the schema
# for a reason no operator can read - which is why both halves are asserted.
Invoke-Probe -Name "rulesSummary is not editable by an operator" `
  -File $FIELDS `
  -Find  "  `"rulesSummary`",`n" `
  -Replace "" `
  -ExpectTest "lets an operator edit the provider's rules text without a second door"

Invoke-Probe -Name "howToPlay skips validation while staying editable" `
  -File $FIELDS `
  -Find  "[`"tagline`", `"description`", `"rulesSummary`", `"howToPlay`"]" `
  -Replace "[`"tagline`", `"description`", `"rulesSummary`"]" `
  -ExpectTest "lets an operator edit the provider's rules text without a second door"

# 11. A limit typed into the markup instead of shared: the counter says one number, the
# server enforces another, and the operator reads the 400 as a permissions problem.
Invoke-Probe -Name "the dialog hard-codes a limit instead of sharing one" `
  -File $DIALOG `
  -Find  "              maxLength={CONTENT_LIMITS.howToPlay}" `
  -Replace "              maxLength={2000}" `
  -ExpectTest "offers both on the content screen, bound to the shared limits" `

# 12. THE TRIPWIRE. A seventh required field added to the issued specification, with no code
# change at all - exactly what happened here. If this is green, nothing connects the contract
# to the platform and the next forgotten field ships in silence.
Invoke-Probe -Name "a SEVENTH required field appears in the issued spec" `
  -File $SPEC `
  -Find  "| ``bannerUrl`` | Yes |" `
  -Replace "| ``victoryBlurb`` | Yes | What the winner is told |`n| ``bannerUrl`` | Yes |" `
  -ExpectTest "stores every content field the issued specification marks required"

Write-Host ""
