# Probes for the game rules surface.
#
# WHAT THIS SLICE DID, 11 September 2026. The owner reported that "in the game providers we have
# rules that are not shown anywhere in game area or competition area". They were right and the
# cause was one line further back than it looks: R63 had fixed the parse bug that was discarding
# `rulesSummary` and `howToPlay` on every catalogue sync, so both are STORED - but
# `getGamePresentation` did not select either, so no player screen could read them. A contest
# could state the pot, the entry fee, the clock and the standings and never say what a winning
# score was.
#
# So the probes fall into four groups:
#
#   * THE READ - a field missing from the projection, the lean generic, or the return.
#   * THE ABSENT CASE - a panel that renders a heading over nothing. This is the COMMON case, not
#     an edge one: every title synced before R63 carries neither field.
#   * ONE DEFINITION - a screen that imports the panel and hand-rolls a rules block beside it.
#   * ONE PROJECTION - the lobby going back to its own `ProviderGame.findOne`, which is what it
#     had until this slice and is task 20.1's defect exactly.
#
# Conventions carried from the earlier harnesses in this folder, each of which cost a false
# result once:
#
#   * UTF-8 WITHOUT a BOM on the read AND the write. `Get-Content -Raw` decodes with the system
#     ANSI codepage under PowerShell 5.1 and writes the mojibake back.
#   * `-LiteralPath` semantics via `System.IO.File`. THIS HARNESS GENUINELY NEEDS IT: the play
#     page is `app/(root)/competitions/[id]/play/page.tsx`, and `[id]` is a PowerShell wildcard
#     character class, so `Get-Content` would match nothing, return `$null`, and the "restore"
#     would empty the route.
#   * Refuse to write when the read came back empty.
#   * Relax newlines - a CRLF pattern never matches an LF file, and a probe that fails to apply
#     is indistinguishable from a test that does not work.
#   * Run the expected test ALONE with `-t` and read the summary counts.
#   * DID NOT APPLY means the target moved, never that the run was quiet.

$ErrorActionPreference = 'Continue'
$Root = Split-Path -Parent $PSScriptRoot
$Suite = '__tests__/games/game-rules-panel.test.ts'

$Utf8NoBom = New-Object System.Text.UTF8Encoding($false)

function Read-Source([string]$Path) {
  [System.IO.File]::ReadAllText($Path, [System.Text.UTF8Encoding]::new($false))
}

function Write-Source([string]$Path, [string]$Text) {
  if ([string]::IsNullOrEmpty($Text)) {
    throw "refusing to write an empty file to $Path"
  }
  [System.IO.File]::WriteAllText($Path, $Text, $Utf8NoBom)
}

function To-Relaxed([string]$Literal) {
  [regex]::Escape($Literal) -replace '(\\r)?\\n', '\r?\n'
}

function Invoke-Probe {
  param(
    [string]$Name,
    [string]$File,
    [string]$Find,
    [string]$Replace,
    [string]$ExpectTest,
    [string]$Suite = $Script:Suite
  )

  $path = Join-Path $Root $File
  $original = Read-Source $path
  if ([string]::IsNullOrEmpty($original)) {
    Write-Host "[$Name] UNREADABLE - $File came back empty, refusing to probe" -ForegroundColor Magenta
    return
  }

  $mutated = [regex]::Replace($original, (To-Relaxed $Find), { param($m) $Replace }, 1)

  if ($mutated -eq $original) {
    Write-Host "[$Name] DID NOT APPLY - the target moved, so nothing was tested" -ForegroundColor Magenta
    return
  }
  Write-Source $path $mutated
  try {
    $out = & npx vitest run $Suite -t $ExpectTest 2>&1 | Out-String
    # Collapse whitespace: `Out-String` wraps at the console width, so a long line arrives split.
    $flat = ($out -replace '\s+', ' ')
    if ($flat -match 'Tests\s+(\d+)\s+failed') {
      $failed = [int]$Matches[1]
      if ($failed -eq 1) {
        Write-Host "[$Name] RED (1 failure, as expected)" -ForegroundColor Green
      } else {
        Write-Host "[$Name] RED but $failed failures - blast radius, check the probe" -ForegroundColor Yellow
      }
    } elseif ($flat -match 'No test found') {
      Write-Host "[$Name] NO TEST RAN - the expected test name is wrong" -ForegroundColor Magenta
    } else {
      Write-Host "[$Name] GREEN - the guard is absent, weak, unreachable, or changes no observable" -ForegroundColor Red
    }
  } finally {
    Write-Source $path $original
  }
}

$Presentation = 'lib/services/games/game-presentation.service.ts'
$Panel = 'components/games/GameRulesPanel.tsx'
$Lobby = 'components/games/ProviderContestLobby.tsx'
$Arena = 'components/games/arena/GameArenaLayout.tsx'
$PlayPage = 'app/(root)/competitions/[id]/play/page.tsx'

Write-Host ''
Write-Host '=== The read: three places, and all three are needed ===' -ForegroundColor Cyan

# THE ORIGINAL DEFECT, restored verbatim. The interface and the return can both name the field
# and it still arrives undefined, because Mongoose returns only what was projected - and an
# explicitly-typed `.lean<{...}>()` type-checks perfectly against a field that was never
# selected, which is why R32/R33 went unnoticed for a day.
Invoke-Probe -Name 'rulesSummary dropped from the projection' -File $Presentation `
  -Find '"displayName tagline description rulesSummary howToPlay category' `
  -Replace '"displayName tagline description howToPlay category' `
  -ExpectTest 'is selected by the shared projection'
Invoke-Probe -Name 'howToPlay dropped from the projection' -File $Presentation `
  -Find 'description rulesSummary howToPlay category' `
  -Replace 'description rulesSummary category' `
  -ExpectTest 'is selected by the shared projection'

Invoke-Probe -Name 'selected but never returned' -File $Presentation `
  -Find '    rulesSummary: title.rulesSummary || undefined,' `
  -Replace '' `
  -ExpectTest 'is selected by the shared projection'
# A stored "" is a real state - `game-content.service.ts` learned to `$unset` a cleared field
# only later, so an older document can hold one. Passed through, it is a present string, and the
# panel renders an amber block with nothing in it.
Invoke-Probe -Name 'a stored empty string passed through as content' -File $Presentation `
  -Find 'rulesSummary: title.rulesSummary || undefined,' `
  -Replace 'rulesSummary: title.rulesSummary,' `
  -ExpectTest 'normalises a stored empty string to absent'

Write-Host ''
Write-Host '=== The absent case, which is the common one ===' -ForegroundColor Cyan

# Every title synced before R63 carries neither field, and so does every provider registered and
# not yet re-synced. Without this the lobby grows a heading reading "How Circuit Sprint is
# scored" above an empty box, which tells a player the game has no rules.
Invoke-Probe -Name 'renders an empty panel instead of nothing' -File $Panel `
  -Find '  if (!scoring && !playing) return null;' `
  -Replace '' `
  -ExpectTest 'renders nothing at all when the catalogue holds neither field'

Invoke-Probe -Name 'treats whitespace as content' -File $Panel `
  -Find '  const scoring = presentation.rulesSummary?.trim();' `
  -Replace '  const scoring = presentation.rulesSummary;' `
  -ExpectTest 'trims before deciding, so whitespace is not content'

# Emphasising both blocks is how a page ends up with no emphasis at all - and it is the scoring
# rule, not the controls, that a player cannot discover by trying.
Invoke-Probe -Name 'the how-to-play block takes the emphasis too' -File $Panel `
  -Find '            <h3 className="mb-2 text-sm font-semibold text-gray-200">' `
  -Replace '            <h3 className="mb-2 border-amber-400/70 text-sm font-semibold text-gray-200">' `
  -ExpectTest 'gives the scoring rule the emphasis, and only the scoring rule' -Suite $Suite

Write-Host ''
Write-Host '=== One definition, two screens ===' -ForegroundColor Cyan

# THE LOAD-BEARING NEGATIVE. Importing the panel is trivially satisfied by a screen that then
# writes its own rules block beside it, which is how two screens end up describing the scoring
# differently. The positive assertion is green throughout this probe.
Invoke-Probe -Name 'the lobby hand-rolls a rules block beside the panel' -File $Lobby `
  -Find '          <GameRulesPanel presentation={presentation} layout="wide" />' `
  -Replace '          <GameRulesPanel presentation={presentation} layout="wide" />
          <p>How you win</p>' `
  -ExpectTest 'has its headings in the panel and in NO consumer'

Invoke-Probe -Name 'the arena never renders it' -File $PlayPage `
  -Find '      rules={<GameRulesPanel presentation={presentation} layout="wide" />}' `
  -Replace '      rules={null}' `
  -ExpectTest 'is rendered by the lobby and by the arena'

# Position, never presence. Moved above the board it competes with the reason the player is
# here; moved below the highlights it sits under three marketing phrases.
Invoke-Probe -Name 'the rules slot moves below the highlights' -File $Arena `
  -Find '        {rules}
        {highlights}' `
  -Replace '        {highlights}
        {rules}' `
  -ExpectTest 'sits below the board and above the highlights in the arena'

# An optional slot lets the next screen built on this layout drop the rules with no failure
# anywhere - the shape behind every declared-written-read-by-nothing field in this programme.
Invoke-Probe -Name 'the slot becomes optional' -File $Arena `
  -Find '  rules: ReactNode;' `
  -Replace '  rules?: ReactNode;' `
  -ExpectTest 'makes the slot required, so a second arena caller cannot omit it'

Write-Host ''
Write-Host '=== One projection of the catalogue ===' -ForegroundColor Cyan

# What the lobby had until this slice. It is not a style point: with its own projection, the
# rules render on the play screen and silently not on the lobby, because a field added to the
# shared shape arrives `undefined` at whichever caller nobody remembered. Task 20.1 exactly.
Invoke-Probe -Name 'the lobby goes back to its own read' -File $Lobby `
  -Find '  const presentation = await getGamePresentation(' `
  -Replace '  const presentation = await ProviderGame.findOne({}).lean<{ gameName: string }>();
  void getGamePresentation(' `
  -ExpectTest 'reads the catalogue through the shared projection, never its own' `
  -Suite '__tests__/games/provider-play-ui.test.ts'

Invoke-Probe -Name 'the name is taken from the key instead of the catalogue' -File $Lobby `
  -Find '    presentation.gameName === UNKNOWN_GAME_NAME ? "Game" : presentation.gameName;' `
  -Replace '    String(competition.gameKey ?? "Game");' `
  -ExpectTest "takes the game's name from the catalogue, never from the keys" `
  -Suite '__tests__/games/provider-play-ui.test.ts'

Write-Host ''
Write-Host 'Done.' -ForegroundColor Cyan
