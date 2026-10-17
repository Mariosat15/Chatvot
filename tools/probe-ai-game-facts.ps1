# Probes the task-20 guard: what the AI is told about a game, composed once.
#
# Each probe reintroduces one defect, runs ONE named test, and expects it red with exactly one
# failure. A probe that turns five tests red is reporting harness damage rather than a working
# guard, which is why the failing test names are printed rather than counted.
#
# CONVENTIONS THAT HAVE EACH COST A FALSE RESULT IN THIS REPOSITORY BEFORE:
#   - UTF-8 without a BOM on the read AND the write, `-LiteralPath` on both, newlines relaxed
#     to `\r?\n`, and a refusal to write when the replacement did not apply. DID NOT APPLY
#     means the target moved, never that the run was quiet.
#   - The expected test is named and run alone with `-t`. A probe aimed at the wrong test is
#     indistinguishable from a test that does not work.
#
# PROBES 8 AND 9 ARE THE ONES THAT MATTER, because they are the only two aimed at a defect
# that produces no visible symptom: a projection that stops fetching a field the prompt
# describes. Every other failure here changes what the model is told and could in principle be
# noticed by reading the copy. Those two just make it blander on one screen.

$ErrorActionPreference = 'Continue'
$root = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $root

$enc = New-Object System.Text.UTF8Encoding $false

$VOCAB   = "apps/admin/lib/admin/ai-contest-vocabulary.ts"
$GAME    = "apps/admin/lib/admin/ai-game-content-vocabulary.ts"
$CONTEST = "apps/admin/app/api/ai/generate-competition/route.ts"
$CONTENT = "apps/admin/app/api/ai/generate-game-content/route.ts"

$GUARD = "__tests__/admin/ai-game-facts.test.ts"

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
Write-Host "Task 20 - one description of the game, given to both assistants" -ForegroundColor Cyan
Write-Host ""

# ---- One definition, two consumers -----------------------------------------------------

Invoke-Probe -Name "the game-page prompt composes its own facts block" `
  -File $GAME `
  -Find  "`${describeGameFacts(title)}" `
  -Replace "WHAT THE GAME IS:`n- A skill game called `${title.displayName}." `
  -ExpectTest "is what both assistants send"

Invoke-Probe -Name "and the structural half notices the second copy" `
  -File $GAME `
  -Find  "`${describeGameFacts(title)}" `
  -Replace "WHAT THE GAME IS:`n- A skill game called `${title.displayName}." `
  -ExpectTest "is defined in one place and composed in no consumer"

Invoke-Probe -Name "the contest prompt drops the facts block" `
  -File $VOCAB `
  -Find  "`n`${describeGameFacts(title)}`n" `
  -Replace "`n" `
  -ExpectTest "is what both assistants send"

Invoke-Probe -Name "the facts branch on the game's identity" `
  -File $VOCAB `
  -Find  "  const lines = [`n    title.description?.trim()" `
  -Replace "  const lines = [`n    title.gameKey === `"x`" ? `"- A racing game.`" : title.description?.trim()" `
  -ExpectTest "reads the catalogue row and never a game's identity"

# ---- The provider's own account --------------------------------------------------------

Invoke-Probe -Name "the rules are fetched and then not sent" `
  -File $VOCAB `
  -Find  "  const rules = [title.rulesSummary?.trim(), title.howToPlay?.trim()].filter(" `
  -Replace "  const rules = [].filter(" `
  -ExpectTest "sends the provider's rules and how-to-play verbatim"

Invoke-Probe -Name "the bar on restating them is softened to a suggestion" `
  -File $VOCAB `
  -Find  "Do not reproduce it, paraphrase it, or turn it into instructions" `
  -Replace "Feel free to summarise it for players" `
  -ExpectTest "forbids reproducing them in the same breath"

Invoke-Probe -Name "the rules reach the game-page prompt without the bar" `
  -File $VOCAB `
  -Find  " Do not reproduce it, paraphrase it, or turn it into instructions - it is published to players separately and a second version of it would disagree with the first:" `
  -Replace ":" `
  -ExpectTest "carries the bar into both prompts, not just into the block"

# ---- An absent field states nothing ----------------------------------------------------

Invoke-Probe -Name "a missing rules summary produces an empty heading" `
  -File $VOCAB `
  -Find  "  const context = rules.length`n    ? ``" `
  -Replace "  const context = true`n    ? ``" `
  -ExpectTest "states no rules section when the provider supplied none"

Invoke-Probe -Name "a missing duration is guessed at" `
  -File $VOCAB `
  -Find  "  if (title.typicalDurationSeconds) {" `
  -Replace "  if (true) {" `
  -ExpectTest "invents no unit, no duration and no capability"

Invoke-Probe -Name "the score unit is never mentioned" `
  -File $VOCAB `
  -Find  "  if (unit) lines.push(``- A score is measured in `${unit}.``);" `
  -Replace "" `
  -ExpectTest "says a score is measured in the provider's own word"

# ---- The projection that fills the facts -----------------------------------------------

Invoke-Probe -Name "a described field is never fetched" `
  -File $VOCAB `
  -Find  " rulesSummary howToPlay scoreUnit supportsOneVsOne`";" `
  -Replace " howToPlay scoreUnit supportsOneVsOne`";" `
  -ExpectTest "covers every field on CatalogueVocabularySource"

Invoke-Probe -Name "the contest route keeps its own projection" `
  -File $CONTEST `
  -Find  ".select(VOCABULARY_SELECT)" `
  -Replace ".select(`"displayName category description scoreDirection scoreType`")" `
  -ExpectTest "is what both routes ask the database for"

Invoke-Probe -Name "the game-page route keeps its own lean type" `
  -File $CONTENT `
  -Find  ".lean<CatalogueVocabularySource>()" `
  -Replace ".lean<{ displayName: string }>()" `
  -ExpectTest "is what both routes ask the database for"

Write-Host ""
