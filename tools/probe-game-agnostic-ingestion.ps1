# Probes the task-13 guard: a round result carries no fact about its title.
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

$ErrorActionPreference = 'Continue'
$root = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $root

$enc = New-Object System.Text.UTF8Encoding $false

$CONTRACT   = "lib/services/game-providers/contract.ts"
$NORMALISE  = "lib/services/game-providers/adapters/chartvolt-games/normalise.ts"
$MOCK       = "lib/services/game-providers/adapters/mock.adapter.ts"
$INGESTION  = "lib/services/games/result-ingestion.service.ts"

$GUARD    = "__tests__/services/game-agnostic-result-ingestion.test.ts"
$ARRIVAL  = "__tests__/services/participant-score-arrival.test.ts"

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
    [string]$Suite,
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
    $out = & npx vitest run $Suite -t $ExpectTest --reporter=verbose 2>&1 | Out-String
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
Write-Host "Task 13 - a round result carries no fact about its title" -ForegroundColor Cyan
Write-Host ""

# 1. The contract grows the field back.
Invoke-Probe -Name "contract declares scoreDirection on a round result" `
  -File $CONTRACT `
  -Find  "  status: ProviderRoundStatus;`n  rawScore: number;" `
  -Replace "  status: ProviderRoundStatus;`n  rawScore: number;`n  scoreDirection: ProviderScoreDirection;" `
  -Suite $GUARD -ExpectTest "does not declare a score direction"

# 2. The positive half - somebody sweeps the CATALOGUE field away "for consistency".
Invoke-Probe -Name "catalogue entry loses its declared direction" `
  -File $CONTRACT `
  -Find  "  supportsContentSeed: boolean;`n  scoreDirection: ProviderScoreDirection;" `
  -Replace "  supportsContentSeed: boolean;" `
  -Suite $GUARD -ExpectTest "still lets the CATALOGUE entry declare one"

# 3. The per-title map comes back in the parser.
Invoke-Probe -Name "parser regains a per-title direction map" `
  -File $NORMALISE `
  -Find  "const TERMINAL_STATUSES" `
  -Replace "const TITLE_DIRECTIONS = new Map([['circuit-sprint', 'higher_is_better']]);`nconst TERMINAL_STATUSES" `
  -Suite $GUARD -ExpectTest "the result parser names no game code"

# 4. The mock puts a direction back on a round result.
Invoke-Probe -Name "mock round result carries a direction" `
  -File $MOCK `
  -Find  "      rawScore: this.resolveScore(roundId)," `
  -Replace "      rawScore: this.resolveScore(roundId),`n      scoreDirection: `"higher_is_better`"," `
  -Suite $GUARD -ExpectTest "the mock's round result declares no direction either"

# 5. Ingestion takes the payload's word for it again - the defect itself.
Invoke-Probe -Name "ingestion reads the direction off the payload" `
  -File $INGESTION `
  -Find  "    scoreDirection: await resolveScoreDirection(round.gameKey)," `
  -Replace "    scoreDirection: normalised.scoreDirection," `
  -Suite $GUARD -ExpectTest "never takes it from the payload"

# 6. The resolve is hoisted above the save, dragging the sync with it.
Invoke-Probe -Name "the sync runs before the round is saved" `
  -File $INGESTION `
  -Find  "  await round.save();" `
  -Replace "  await round.saved();" `
  -Suite $GUARD -ExpectTest "resolves it inside the sync call"

# 7. The mirror goes stale in the app that is not under test.
Invoke-Probe -Name "the admin copy of the parser drifts" `
  -File "apps/admin/$NORMALISE" `
  -Find  "const TERMINAL_STATUSES" `
  -Replace "const DRIFTED = true;`nconst TERMINAL_STATUSES" `
  -Suite $GUARD -ExpectTest "keeps both adapters identical across the apps"

# 8. THE BEHAVIOURAL ONE. Everything above is structural and would stay green if the resolver
#    were called and its answer discarded. This hard-codes the platform default, which is what
#    the deleted map returned for any title it did not know - so it reproduces the defect for a
#    third title exactly, and the contest scores the player's worse run.
Invoke-Probe -Name "the direction is hard-coded upward again (behavioural)" `
  -File $INGESTION `
  -Find  "    scoreDirection: await resolveScoreDirection(round.gameKey)," `
  -Replace "    scoreDirection: `"higher_is_better`"," `
  -Suite $ARRIVAL -ExpectTest "takes the LOWEST of two cut-short attempts"

Write-Host ""
