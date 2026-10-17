# Probes for the "waiting for a result is never a dead end" block in
# __tests__/games/provider-play-ui.test.ts
#
# THE DEFECT THESE GUARD, which the owner reported as "when i try to leave game is stuck":
# `handleExit` moves to `confirming`, and `confirming` polls for POLL_ATTEMPTS * POLL_INTERVAL_MS
# - sixty seconds - before the amber panel with its Back button replaces it. For that minute the
# confirming panel rendered a spinner and NO control of any kind, to a player who had just pressed
# the one button that means "get me out of here". Worse, it told them we were confirming "your
# score" when the overwhelming reason to press it is that the game never started, so there is no
# score coming at all.
#
# Harness rules, every one of them learned by getting it wrong:
#   - Read via [System.IO.File] and refuse to write when the read came back empty. A probe that
#     empties the file reports far more damage than it caused, and the tell is the failure COUNT
#     rather than the failure.
#   - UTF-8 without a BOM on both sides. PowerShell 5.1 decodes with the system codepage.
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

$RESULT = 'components/games/RoundResultPanel.tsx'
$HOSTFILE = 'components/games/ProviderRoundHost.tsx'

Write-Host '=== Probing the exit from the confirming state ===' -ForegroundColor Cyan

# 1. THE ORIGINAL DEFECT, verbatim: the confirming branch has no control at all.
#    This is also what proves the assertion is POSITIONAL rather than a bare search - the file
#    still contains two other links to the same route after this mutation, so a test matching the
#    bare pattern over the whole file stays green.
Invoke-Probe -Name '1 no way out (the real defect)' -File $RESULT `
  -From '<Link href={`/competitions/${competitionId}`} className="inline-block pt-2">
          <Button variant="outline">Back to {competitionName}</Button>
        </Link>' `
  -To '' `
  -ExpectTest 'the confirming panel offers a way back to the contest'

# 2. The link survives inside the branch but stops pointing at the contest. Reviews as harmless
#    and restores the dead end, because a player who clicks it goes nowhere.
Invoke-Probe -Name '2 link points nowhere' -File $RESULT `
  -From 'href={`/competitions/${competitionId}`} className="inline-block pt-2"' `
  -To 'href="#" className="inline-block pt-2"' `
  -ExpectTest 'the confirming panel offers a way back to the contest'

# 3. One of the two messages stops saying the player may leave. A spinner beside a Back button is
#    ambiguous about whether leaving abandons the result, so the sentence is load-bearing rather
#    than reassurance - and the COUNT is what catches one message losing it while the other keeps
#    it, which any assertion on the phrase alone would pass.
Invoke-Probe -Name '3 one message drops the reassurance' -File $RESULT `
  -From 'and you do not need to wait here for it.' `
  -To '.' `
  -ExpectTest 'the wait does not tell the player they have to stay'

# 4. The two reasons collapse into one message. The tidiest-looking change in the file and the
#    one that puts the false promise back in front of a player whose game never started.
Invoke-Probe -Name '4 one shared message' -File $RESULT `
  -From 'if (reason === "left") {' `
  -To 'if (false) {' `
  -ExpectTest 'leaving and finishing are told apart, and worded apart'

# 5. The left branch promises a score again - the exact wording defect, with the two states
#    still correctly distinguished everywhere else. Only the negative assertion catches it.
Invoke-Probe -Name '5 left branch promises a score' -File $RESULT `
  -From 'You have left the game. Your attempt was already open' `
  -To 'We are waiting for the game to confirm your score with us. Your attempt was already open' `
  -ExpectTest 'leaving and finishing are told apart, and worded apart'

# 6. The host stops passing the reason on. It still computes it, so every assertion about the
#    host's own states passes, and the panel silently falls back to the finished wording for
#    everyone. This is why the test asserts the prop is handed over, not merely derived.
Invoke-Probe -Name '6 reason computed but not passed' -File $HOSTFILE `
  -From 'confirmReason={phase.name === "confirming" ? phase.reason : null}' `
  -To '' `
  -ExpectTest 'leaving and finishing are told apart, and worded apart'

# 7. Leaving is recorded as finishing. A one-word change, and the two states are indistinguishable
#    from that point on while the type still checks and the panel still renders.
Invoke-Probe -Name '7 exit recorded as finished' -File $HOSTFILE `
  -From 'roundId: phase.roundId, reason: "left"' `
  -To 'roundId: phase.roundId, reason: "finished"' `
  -ExpectTest 'leaving and finishing are told apart, and worded apart'

Write-Host '=== Done ===' -ForegroundColor Cyan
