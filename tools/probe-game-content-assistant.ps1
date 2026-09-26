# Probes the task-19 guard: the content assistant writes marketing copy and never the rules.
#
# Each probe reintroduces one defect, runs ONE named test, and expects it red with exactly one
# failure. A probe that turns five tests red is reporting harness damage rather than a working
# guard, which is why the failing test names are printed rather than counted.
#
# CONVENTIONS THAT HAVE EACH COST A FALSE RESULT IN THIS REPOSITORY BEFORE:
#   - UTF-8 without a BOM on the read AND the write. PowerShell 5.1's `Get-Content -Raw` decodes
#     with the system codepage, so an emoji in a touched file comes back as mojibake and is
#     written back that way - probes pass, files are quietly mangled, and it surfaces two steps
#     later as unexplained typecheck errors.
#   - `-LiteralPath` on both, because a path containing `[id]` is a PowerShell wildcard class.
#   - Newlines relaxed to `\r?\n`, and a refusal to write when the replacement did not apply.
#     DID NOT APPLY means the target moved, never that the run was quiet.
#   - The expected test is named and run alone with `-t`. A probe aimed at the wrong test is
#     indistinguishable from a test that does not work.
#
# PROBE 1 IS THE ONE THAT MATTERS. It makes the parser spread the model's own payload, which is
# the single change that would let `rulesSummary` and `howToPlay` back onto the screen - and it
# is the change somebody makes while adding a fifth permitted field, in good faith, because
# spreading is shorter. Everything else here is a fence around that.

$ErrorActionPreference = 'Continue'
$root = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $root

$enc = New-Object System.Text.UTF8Encoding $false

$SUGGEST = "apps/admin/lib/admin/ai-game-content-suggestion.ts"
$VOCAB   = "apps/admin/lib/admin/ai-game-content-vocabulary.ts"
$FIELDS  = "apps/admin/lib/admin/game-content-fields.ts"
$ROUTE   = "apps/admin/app/api/ai/generate-game-content/route.ts"
$PANEL   = "apps/admin/components/admin/games/GameContentAiPanel.tsx"
$DIALOG  = "apps/admin/components/admin/games/GameContentDialog.tsx"

$GUARD = "__tests__/admin/game-content-assistant.test.ts"

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
Write-Host "Task 19 - the assistant writes marketing copy, never the rules" -ForegroundColor Cyan
Write-Host ""

# ---- What it is allowed to write -------------------------------------------------------

Invoke-Probe -Name "the parser spreads the model's payload" `
  -File $SUGGEST `
  -Find  "  return {`n    displayName: text(body.displayName" `
  -Replace "  return {`n    ...body,`n    displayName: text(body.displayName" `
  -ExpectTest "cannot carry the rules summary or how to play"

Invoke-Probe -Name "the spread is not noticed structurally either" `
  -File $SUGGEST `
  -Find  "  return {`n    displayName: text(body.displayName" `
  -Replace "  return {`n    ...body,`n    displayName: text(body.displayName" `
  -ExpectTest "builds its object field by field"

Invoke-Probe -Name "rulesSummary is added to what the assistant may write" `
  -File $FIELDS `
  -Find  "export const AI_WRITABLE_CONTENT_FIELDS = [`n  `"displayName`"," `
  -Replace "export const AI_WRITABLE_CONTENT_FIELDS = [`n  `"rulesSummary`",`n  `"displayName`"," `
  -ExpectTest "nothing is both writable by the assistant and barred from it"

Invoke-Probe -Name "the bar on rulesSummary is dropped from the policy" `
  -File $FIELDS `
  -Find  "  [`"rulesSummary`", `"the provider's account of how their game scores, and the text support quotes back in a prize dispute`"],`n" `
  -Replace "" `
  -ExpectTest "bars the two provider fields by name and says why"

Invoke-Probe -Name "the assistant offers a field the save route refuses" `
  -File $FIELDS `
  -Find  "export const AI_WRITABLE_CONTENT_FIELDS = [`n  `"displayName`"," `
  -Replace "export const AI_WRITABLE_CONTENT_FIELDS = [`n  `"chartvoltEnabled`",`n  `"displayName`"," `
  -ExpectTest "every field it may write is one an operator may save"

# ---- What the model is told ------------------------------------------------------------

Invoke-Probe -Name "the prompt stops forbidding rules claims" `
  -File $VOCAB `
  -Find  "`${NO_RULES_CLAIMS_RULE}`${NO_FIAT_RULE}" `
  -Replace "`${NO_FIAT_RULE}" `
  -ExpectTest "forbids stating how the game is played"

Invoke-Probe -Name "the banned-word list is written out again locally" `
  -File $VOCAB `
  -Find  "- Never use these words: `${TRADING_WORDS.join(`", `")}" `
  -Replace "- Never use these words: trade, trading, forex, pips" `
  -ExpectTest "bans trading vocabulary from the shared list"

Invoke-Probe -Name "a length is typed into the prompt instead of imported" `
  -File $VOCAB `
  -Find  "max `${CONTENT_LIMITS.tagline} characters" `
  -Replace "max 120 characters" `
  -ExpectTest "takes its lengths from the content limits"

Invoke-Probe -Name "the prompt grows a special case for one game" `
  -File $VOCAB `
  -Find  "  const subject = describeSubject(title);" `
  -Replace "  const gameCode = title.displayName.toLowerCase();`n  const subject = gameCode.includes(`"sprint`") ? `"a racing game`" : describeSubject(title);" `
  -ExpectTest "names no game, provider or game code anywhere"

Invoke-Probe -Name "an absent round length is guessed" `
  -File $VOCAB `
  -Find  "`${duration ? ``- `${duration}`` : `"`"}" `
  -Replace "`${duration ? ``- `${duration}`` : `"- A round takes about a minute.`"}" `
  -ExpectTest "degrades rather than inventing"

# ---- Reading the reply -----------------------------------------------------------------

Invoke-Probe -Name "an over-long line is offered whole" `
  -File $SUGGEST `
  -Find  "  return trimmed.length > limit ? trimmed.slice(0, limit).trim() : trimmed;" `
  -Replace "  return trimmed;" `
  -ExpectTest "offers an over-long line shortened rather than dropping it"

Invoke-Probe -Name "an over-long highlight is truncated rather than dropped" `
  -File $SUGGEST `
  -Find  "    if (detail.length > CONTENT_LIMITS.highlightDetail) continue;" `
  -Replace "    if (detail.length > CONTENT_LIMITS.highlightDetail) { rows.push({ title, detail: detail.slice(0, CONTENT_LIMITS.highlightDetail) }); continue; }" `
  -ExpectTest "drops a half-filled or over-long highlight"

Invoke-Probe -Name "the highlight cap is removed" `
  -File $SUGGEST `
  -Find  "    if (rows.length >= MAX_SUGGESTED_HIGHLIGHTS) break;`n" `
  -Replace "" `
  -ExpectTest "never offers more highlights than the form accepts"

Invoke-Probe -Name "a malformed reply throws instead of answering empty" `
  -File $SUGGEST `
  -Find  "  try {`n    payload = JSON.parse(match[0]);`n  } catch {`n    return empty;`n  }" `
  -Replace "  payload = JSON.parse(match[0]);" `
  -ExpectTest "answers empty rather than throwing"

# ---- The route ---------------------------------------------------------------------------

Invoke-Probe -Name "the route is granted by the wrong section" `
  -File $ROUTE `
  -Find  "guardSection(`"game-providers`")" `
  -Replace "guardSection(`"competitions`")" `
  -ExpectTest "guards every handler with the section that owns the calling screen"

Invoke-Probe -Name "the route loses its guard entirely" `
  -File $ROUTE `
  -Find  "  const guard = await guardSection(`"game-providers`");`n  if (!guard.ok) return guard.response;`n" `
  -Replace "" `
  -ExpectTest "guards every handler with the section that owns the calling screen"

Invoke-Probe -Name "the operator's words reach the system message" `
  -File $ROUTE `
  -Find  "{ role: `"system`", content: vocabulary.systemPrompt }," `
  -Replace "{ role: `"system`", content: vocabulary.systemPrompt + steer }," `
  -ExpectTest "puts the operator's own words in the user message"

Invoke-Probe -Name "an unknown game is answered generically" `
  -File $ROUTE `
  -Find  "    if (!title) {" `
  -Replace "    if (false) {" `
  -ExpectTest "refuses a game the catalogue does not hold"

# ---- The screen ---------------------------------------------------------------------------

# The panel keeps the IMPORT, which is the point: `toContain("AI_NEVER_WRITABLE_CONTENT_FIELDS")`
# stays true on the import line alone, so this probe only goes red because the assertion pins
# the CALL and the absence of the sentence. An import is not a use.
Invoke-Probe -Name "the panel restates the reason instead of reading it" `
  -File $PANEL `
  -Find  "{AI_NEVER_WRITABLE_CONTENT_FIELDS.get(`"rulesSummary`")}" `
  -Replace "the text support quotes back in a prize dispute" `
  -ExpectTest "explains the bar from the shared policy rather than restating it"

Invoke-Probe -Name "the panel writes content directly, bypassing Save" `
  -File $PANEL `
  -Find  "`"/api/ai/generate-game-content`"" `
  -Replace "``/api/games/providers/`${gameKey}/games/content``" `
  -ExpectTest "proposes into the form and never writes to the content route itself"

Invoke-Probe -Name "the browser sends the game's name into the prompt" `
  -File $PANEL `
  -Find  "JSON.stringify({ gameKey, steer })" `
  -Replace "JSON.stringify({ gameKey, steer, displayName: `"x`" })" `
  -ExpectTest "sends the game key and nothing else about the game"

# The regression this one guards is real: both fields were missing from `onSaved` on the day
# they were added, so a saved edit was reverted the next time the dialog was opened.
Invoke-Probe -Name "a saved field is not handed back to the list" `
  -File $DIALOG `
  -Find  "        rulesSummary: draft.rulesSummary,`n" `
  -Replace "" `
  -ExpectTest "hands every edited field back to the list after a save"

Write-Host ""
