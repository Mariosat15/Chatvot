# Probes for the contest entry deadline (12 s2.10 / 13 s1.1g).
#
# Each probe reinstates a defect, runs ONLY the test that is supposed to catch it, and reports
# RED or GREEN from the summary counts. Two harness lessons are baked in and both have produced
# a false result on this programme before:
#
#   - Read AND write with -LiteralPath and pinned UTF-8 without a BOM. PowerShell 5.1's
#     Get-Content -Raw decodes with the system ANSI codepage, which mangles emoji, and a path
#     containing [brackets] is a wildcard to the non-literal form.
#   - Refuse to write when the read came back empty, and assert the file actually CHANGED.
#     A probe that fails to apply is indistinguishable from a test that does not work.

$ErrorActionPreference = 'Continue'
$Root = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $Root

$Utf8 = New-Object System.Text.UTF8Encoding $false
$DefaultSuite = '__tests__/services/contest-entry-deadline.test.ts'

function Read-File([string]$Path) {
  [System.IO.File]::ReadAllText((Join-Path $Root $Path), $Utf8)
}

function Write-File([string]$Path, [string]$Text) {
  if ([string]::IsNullOrEmpty($Text)) { throw "refusing to write empty content to $Path" }
  [System.IO.File]::WriteAllText((Join-Path $Root $Path), $Text, $Utf8)
}

# Escape the literal, then relax every newline, so a CRLF pattern still matches an LF file.
function To-Pattern([string]$Literal) {
  [regex]::Escape($Literal) -replace '(\\r)?\\n', '\r?\n'
}

function Invoke-Probe {
  param(
    [string]$Name,
    [string]$File,
    [string]$From,
    [string]$To,
    [string]$ExpectTest,
    # Parameterised on the SUITE, not just the test name. Three of these probes pin guards that
    # live in other files, and run against the default suite they report "no test ran" - which
    # reads exactly like a broken harness rather than a missing guard.
    [string]$Suite = $script:DefaultSuite
  )

  $original = Read-File $File
  $mutated = [regex]::Replace($original, (To-Pattern $From), { param($m) $To }, 1)

  if ($mutated -eq $original) {
    Write-Host "[$Name] PROBE DID NOT APPLY - pattern not found in $File" -ForegroundColor Magenta
    return
  }

  Write-File $File $mutated
  try {
    $out = & npx vitest run $Suite -t $ExpectTest 2>&1 | Out-String
    # Collapse whitespace: Out-String wraps at the console width, so a long test name arrives
    # split across two lines and a literal match silently misses it.
    $flat = ($out -replace '\s+', ' ')

    if ($flat -match 'Tests\s+(\d+)\s+failed') {
      Write-Host "[$Name] RED ($($Matches[1]) failed) - $ExpectTest" -ForegroundColor Green
    }
    elseif ($flat -match 'No test files found' -or $flat -match 'Tests\s+no tests') {
      Write-Host "[$Name] NO TEST RAN - check the -t pattern" -ForegroundColor Magenta
    }
    else {
      Write-Host "[$Name] GREEN - the guard did not catch it" -ForegroundColor Red
    }
  }
  finally {
    Write-File $File $original
  }
}

$CREATE = 'apps/admin/lib/services/game-providers/provider-contest.service.ts'
$EDIT = 'apps/admin/lib/services/game-providers/provider-contest-edit.service.ts'
$MODULE = 'lib/services/games/entry-deadline.ts'
$ADMIN_MODULE = 'apps/admin/lib/services/games/entry-deadline.ts'
$PLAYER = 'components/games/round-window.ts'
$DRAFT = 'apps/admin/components/admin/games/contest-draft.ts'

Write-Host "`n=== the arithmetic ===" -ForegroundColor Cyan

# NOTE: this mutation must stay syntactically valid. Written as `: 0 * 1000` it left two
# `:` arms on one ternary, vitest reported a collection error rather than a failing test, and
# the harness printed NO TEST RAN - which reads exactly like a broken -t pattern.
Invoke-Probe -Name 'reserves nothing at all' -File $MODULE `
  -From '? input.attemptSeconds * 1000' -To '? 0' `
  -ExpectTest 'holds back exactly one attempt'

Invoke-Probe -Name 'reserves under until_window_closes too' -File $MODULE `
  -From 'const reserves = input.roundStartPolicy !== "until_window_closes";' `
  -To 'const reserves = true;' `
  -ExpectTest 'runs to the window end under until_window_closes'

Invoke-Probe -Name 'an absent policy reads as permissive' -File $MODULE `
  -From 'input.roundStartPolicy !== "until_window_closes"' `
  -To 'input.roundStartPolicy === "reserve_full_round"' `
  -ExpectTest 'treats an absent policy as reserving'

Invoke-Probe -Name 'an unknown clock is guessed' -File $MODULE `
  -From 'typeof input.attemptSeconds === "number"' -To 'true' `
  -ExpectTest 'reserves nothing when no attempt length is known'

Invoke-Probe -Name 'the start floor is removed' -File $MODULE `
  -From 'return new Date(Math.max(deadline, input.startTime.getTime()));' `
  -To 'return new Date(deadline);' `
  -ExpectTest 'never lands before the contest starts'

Invoke-Probe -Name 'the screen guesses instead of staying silent' -File $MODULE `
  -From '  if (typeof attemptSeconds !== "number" || !Number.isFinite(attemptSeconds)) {
    return null;
  }' `
  -To '  if (typeof attemptSeconds !== "number") { attemptSeconds = 0; }' `
  -ExpectTest 'says nothing rather than guessing'

Write-Host "`n=== one producer ===" -ForegroundColor Cyan

Invoke-Probe -Name 'the mirror drifts' -File $ADMIN_MODULE `
  -From 'const reserves = input.roundStartPolicy !== "until_window_closes";' `
  -To 'const reserves = input.roundStartPolicy === "reserve_full_round";' `
  -ExpectTest 'byte-identical'

Invoke-Probe -Name 'the play screen does the sum again' -File $PLAYER `
  -From 'return entryDeadlineMs(playWindowEndMs, maxRoundSeconds);' `
  -To 'return playWindowEndMs - (maxRoundSeconds ?? 0) * 1000;' `
  -ExpectTest 'the play screen'

Invoke-Probe -Name 'the wizard does the sum again' -File $DRAFT `
  -From '? resolveContestEntryDeadline({' `
  -To '? new Date(end.getTime() - attemptSeconds * 1000) ?? resolveContestEntryDeadline({' `
  -ExpectTest 'the wizard'

Write-Host "`n=== the writers ===" -ForegroundColor Cyan

Invoke-Probe -Name 'create pins the deadline to the start' -File $CREATE `
  -From 'registrationDeadline: resolveContestEntryDeadline({' `
  -To 'registrationDeadline: new Date(input.startTime), unusedDeadline: resolveContestEntryDeadline({' `
  -ExpectTest 'create derives the deadline'

Invoke-Probe -Name "create's fallback policy goes stale again" -File $CREATE `
  -From 'const roundStartPolicy = input.roundStartPolicy ?? "reserve_full_round";' `
  -To 'const roundStartPolicy = input.roundStartPolicy ?? "until_window_closes";' `
  -ExpectTest 'resolves the fallback policy ONCE'

# The shape that made the first version of that test useless: the fallback written twice, so
# an assertion looking for the right one finds it while the wrong one decides the deadline.
Invoke-Probe -Name "create's fallback is written twice again" -File $CREATE `
  -From '        roundStartPolicy,
        startTime: input.startTime,' `
  -To '        roundStartPolicy: input.roundStartPolicy ?? "until_window_closes",
        startTime: input.startTime,' `
  -ExpectTest 'resolves the fallback policy ONCE'

Invoke-Probe -Name 'edit computes the deadline in the start branch' -File $EDIT `
  -From 'if (input.startTime !== undefined) competition.startTime = input.startTime;' `
  -To 'if (input.startTime !== undefined) { competition.startTime = input.startTime; competition.registrationDeadline = resolveContestEntryDeadline({ playWindowEnd: competition.playWindowEnd ?? competition.endTime, attemptSeconds: undefined, roundStartPolicy: competition.roundStartPolicy, startTime: competition.startTime }); }' `
  -ExpectTest 'AFTER every other field'

Invoke-Probe -Name 'edit reads the request instead of the document' -File $EDIT `
  -From 'playWindowEnd: competition.playWindowEnd ?? competition.endTime,
    attemptSeconds: resolveAttemptSeconds(' `
  -To 'playWindowEnd: input.playWindowEnd ?? competition.endTime,
    attemptSeconds: resolveAttemptSeconds(' `
  -ExpectTest 'reads the document rather than the request'

Invoke-Probe -Name 'edit loads the title only for a settings change' -File $EDIT `
  -From '  const title =
    providerKey && gameCode
      ? await ProviderGame.findOne({ providerKey, gameCode }).lean()
      : null;' `
  -To '  let title = null;' `
  -ExpectTest 'unconditionally'

Write-Host "`n=== the two flipped tests, and the purity guard ===" -ForegroundColor Cyan

# The defect the edit test used to ASSERT, restored verbatim. A flipped test that cannot catch
# the behaviour it now forbids is a test that records history and guards nothing.
Invoke-Probe -Name 'edit pins the deadline to the start again' -File $EDIT `
  -From 'competition.registrationDeadline = resolveContestEntryDeadline({' `
  -To 'competition.registrationDeadline = new Date(competition.startTime); const unused = ({' `
  -ExpectTest 'instead of pinning it to the start time' `
  -Suite '__tests__/admin/provider-contest-edit.test.ts'

Invoke-Probe -Name 'the play screen reaches for a model' -File $PLAYER `
  -From 'import { entryDeadlineMs } from "@/lib/services/games/entry-deadline";' `
  -To 'import { entryDeadlineMs } from "@/lib/services/games/entry-deadline";
import Competition from "@/database/models/competition.model";' `
  -ExpectTest 'recomputed by neither' `
  -Suite '__tests__/games/provider-play-ui.test.ts'

Invoke-Probe -Name 'the producer reaches for a model' -File $MODULE `
  -From 'import type { RoundStartPolicy } from "./round-types";' `
  -To 'import type { RoundStartPolicy } from "./round-types";
import Competition from "@/database/models/competition.model";' `
  -ExpectTest 'importable by a client component'

Write-Host "`nDone.`n" -ForegroundColor Cyan
