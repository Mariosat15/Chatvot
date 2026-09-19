# Probes for the "wait for a frame that never starts is bounded" block in
# __tests__/games/provider-play-ui.test.ts
#
# THE DEFECT THESE GUARD: the platform waited for the frame's `ready` message with no bound at
# all. A play surface refused by a `frame-ancestors` policy, 404'd by a proxy that is not routing
# `/play`, or served by a service that is down renders something and fires `load` - so there is no
# error event to catch. The overlay stayed up for ever, nothing was logged, and the player had no
# way out, because the button that leaves a round lives inside the frame that failed.
#
# Each probe reintroduces one form of it and asserts the EXPECTED test goes red, on its own.
#
# Harness rules, every one of them learned by getting it wrong:
#   - Read via [System.IO.File] and refuse to write when the read came back empty. A probe that
#     empties the file reports far more damage than it caused, and the tell is the failure COUNT
#     rather than the failure.
#   - UTF-8 without a BOM on both sides. PowerShell 5.1 decodes with the system codepage, which
#     mangles the ellipsis and the emoji in these files and surfaces two steps later as an
#     unexplained diff.
#   - Confirm the replacement changed the file. A probe that fails to apply is indistinguishable
#     from a test that does not work.
#   - Run the expected test ALONE with `-t` and read the summary counts. Searching whole-suite
#     output for a test's name finds it whether it passed or failed.

$ErrorActionPreference = 'Continue'
$Root = Split-Path -Parent $PSScriptRoot
$Utf8 = New-Object System.Text.UTF8Encoding $false
$Suite = '__tests__/games/provider-play-ui.test.ts'

function Read-File([string]$Rel) {
  $text = [System.IO.File]::ReadAllText((Join-Path $Root $Rel), $Utf8)
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
  $mutated = [regex]::Replace($original, (Relaxed $From), { param($m) $To }, 1)

  if ($mutated -eq $original) {
    Write-Host "[$Name] PROBE DID NOT APPLY - pattern not found in $File" -ForegroundColor Magenta
    return
  }

  try {
    Write-File $File $mutated

    $out = & npx vitest run $Suite -t "$ExpectTest" 2>&1 | Out-String
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
    if ((Read-File $File) -ne $original) { Write-Host "[$Name] RESTORE FAILED" -ForegroundColor Red }
  }
}

$FRAME = 'components/games/ProviderGameFrame.tsx'

Write-Host '=== Probing the bounded wait on the game frame ===' -ForegroundColor Cyan

# 1. THE ORIGINAL DEFECT, verbatim: no timer at all, so the overlay only ever comes down on
#    `ready`. Everything else in this block is a partial reintroduction of this one.
Invoke-Probe -Name '1 no timer' -File $FRAME `
  -From 'const timer = setTimeout(() => setStalled(true), READY_TIMEOUT_MS);' `
  -To 'const timer = setTimeout(() => {}, READY_TIMEOUT_MS);' `
  -ExpectTest 'stands the loading overlay down on a timer, not only on ready'

# 2. The timer is never cleared. The opposite failure and easy to think harmless: a game that
#    starts normally flips to the notice a few seconds later, so a working title is accused of
#    being broken.
Invoke-Probe -Name '2 timer not cleared' -File $FRAME `
  -From 'return () => clearTimeout(timer);' `
  -To 'return;' `
  -ExpectTest 'stands the loading overlay down on a timer, not only on ready'

# 3. THE SUBTLE ONE, and the reason both conditions are asserted rather than just the notice's.
#    The notice appears while the overlay keeps its `!ready` condition, so it is still covering
#    the frame - the game's own explanation stays hidden and the fix reviews as correct.
Invoke-Probe -Name '3 overlay still covers' -File $FRAME `
  -From '{!ready && !stalled && (' `
  -To '{!ready && (' `
  -ExpectTest 'shows the spinner and the notice on complementary conditions'

# 4. The notice loses its own condition and renders over a running game.
Invoke-Probe -Name '4 notice always on' -File $FRAME `
  -From '{!ready && stalled && (' `
  -To '{!ready && (' `
  -ExpectTest 'shows the spinner and the notice on complementary conditions'

# 5. `load` stops being recorded, so the two failures collapse into one message: "could not be
#    reached" shown for a game that answered and crashed on boot sends support down the wrong path.
Invoke-Probe -Name '5 load not recorded' -File $FRAME `
  -From 'onLoad={() => setDocumentLoaded(true)}' `
  -To '' `
  -ExpectTest 'tells a game that could not be reached apart from one that did not start'

# 6. The retry stops remounting the frame. A button that appears to work and does nothing is the
#    shape this programme keeps finding, and here it is one line: without the `key` change the
#    iframe is never re-requested.
Invoke-Probe -Name '6 retry does not remount' -File $FRAME `
  -From 'key={attempt}' `
  -To '' `
  -ExpectTest 'offers a retry that remounts the frame, and an exit that is the real one'

# 7. The exit becomes a local no-op instead of the host's handler, which strands the round: the
#    player believes they have left, nothing polls for the result, and the attempt is spent.
Invoke-Probe -Name '7 exit is local' -File $FRAME `
  -From 'onClick={onExit}' `
  -To 'onClick={() => setStalled(false)}' `
  -ExpectTest 'offers a retry that remounts the frame, and an exit that is the real one'

# 8. The log goes. This is the whole class of failure becoming invisible to us again - the copy
#    names neither the origin nor the timeout on purpose, so without this line there is nothing
#    anywhere that says which of the two happened.
Invoke-Probe -Name '8 no diagnosis logged' -File $FRAME `
  -From 'console.error(' `
  -To 'void (' `
  -ExpectTest 'logs the diagnosis it deliberately does not show the player'

Write-Host '=== Done ===' -ForegroundColor Cyan
