# Probes for the entry-close explanation and the withheld trading-capital line.
#
# Each probe reintroduces one defect and asserts the suite turns red ON THE EXPECTED TEST.
# Conventions carried from the earlier harnesses in this folder, each of which cost a false
# result once:
#
#   * UTF-8 WITHOUT a BOM on the read AND the write. PowerShell 5.1's `Get-Content -Raw`
#     decodes with the system ANSI codepage, which mangles every emoji in the touched file and
#     writes the mojibake back - it surfaces two steps later as unexplained typecheck errors.
#   * `-LiteralPath` on both, because a path can contain `[` and `]`, which PowerShell parses
#     as a wildcard character class. A read that silently matches nothing plus a write that
#     does not is how a route file gets emptied and "restored" to nothing.
#   * Refuse to write when the read came back empty.
#   * Relax newlines in the pattern, because a CRLF pattern never matches an LF file - and a
#     probe that fails to apply is indistinguishable from a test that does not work.
#   * Run the expected test ALONE with `-t` and read the summary counts. Searching whole-suite
#     output for a test's name reports RED for a passing test just as readily.

$ErrorActionPreference = 'Continue'
$Root = Split-Path -Parent $PSScriptRoot
$Suite = '__tests__/games/entry-close-explanation.test.ts'

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
  # Escape the pattern, then let any newline match any newline.
  [regex]::Escape($Literal) -replace '(\\r)?\\n', '\r?\n'
}

function Invoke-Probe {
  param(
    [string]$Name,
    [string]$File,
    [string]$Find,
    [string]$Replace,
    [string]$ExpectTest
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

Write-Host "`n=== describeEntryClose ===" -ForegroundColor Cyan

# 1. The original defect at the source: one answer for every contest.
Invoke-Probe -Name 'collapse to one kind' `
  -File 'lib/utils/registration-deadline.ts' `
  -Find '  const policy = contest.roundStartPolicy;
  if (!policy) return none;' `
  -Replace '  const policy = contest.roundStartPolicy;
  if (true) return none;' `
  -ExpectTest 'under ''players can start any time'' entry runs to the end'

# 2. DELIBERATELY NOT PROBED, and the reason is worth more than the probe would be.
#
# Deleting the `until_window_closes` early return leaves the suite GREEN, and it is the fourth
# cause of a green probe: the mutation changes no observable. A permissive contest's stored
# deadline IS its window end, so the reserving arithmetic below falls through to
# `reservedMs = 0` and returns exactly the same answer by a different route.
#
# The early return is NOT decoration - it is the only thing that answers correctly when a
# permissive contest's deadline sits before its end, which is an operator's decision rather
# than an inferred one. That case is probe 5, which is red. A probe here would report on the
# arithmetic's coincidence rather than on the branch, and a green line in this list teaches the
# next reader the branch can be removed.

# 3. The legacy clamp dropped - the reason this lives beside resolveRegistrationDeadline.
Invoke-Probe -Name 'raw deadline instead of clamped' `
  -File 'lib/utils/registration-deadline.ts' `
  -Find '  const deadline = resolveRegistrationDeadline(contest);
  const endSource' `
  -Replace '  const deadline = contest.registrationDeadline
    ? new Date(contest.registrationDeadline)
    : null;
  const endSource' `
  -ExpectTest 'the reserved span is measured from the CLAMPED deadline, not the stored one'

# 4. Zero reservation described as a reservation - a promise no gate keeps.
Invoke-Probe -Name 'zero reservation still claims a round' `
  -File 'lib/utils/registration-deadline.ts' `
  -Find '  return reservedMs > 0
    ? { kind: "reserves_round", reservedMs }
    : { kind: "runs_to_the_end", reservedMs: 0 };' `
  -Replace '  return { kind: "reserves_round", reservedMs };' `
  -ExpectTest 'reserving nothing is described permissively, because that is how it behaves'

# 5. Inferring the policy from the arithmetic instead of reading it.
Invoke-Probe -Name 'infer policy from the dates' `
  -File 'lib/utils/registration-deadline.ts' `
  -Find '  if (policy === "until_window_closes") {' `
  -Replace '  if (false && policy === "until_window_closes") {' `
  -ExpectTest 'reads the stored policy and never infers one from the arithmetic'

# 6. The endTime fallback removed.
Invoke-Probe -Name 'no endTime fallback' `
  -File 'lib/utils/registration-deadline.ts' `
  -Find '  const endSource = contest.playWindowEnd ?? contest.endTime;' `
  -Replace '  const endSource = contest.playWindowEnd;' `
  -ExpectTest 'falls back to endTime when the play window is absent'

# 7. An unparseable end silently produces a nonsense span.
Invoke-Probe -Name 'unparseable end not rejected' `
  -File 'lib/utils/registration-deadline.ts' `
  -Find '  if (Number.isNaN(end.getTime())) return none;' `
  -Replace '  if (false) return none;' `
  -ExpectTest 'an unparseable end is not treated as a reservation'

Write-Host "`n=== the panel ===" -ForegroundColor Cyan

# 8. THE ACTUAL DEFECT: the misleading clause back on every contest.
Invoke-Probe -Name 'restore the unconditional clause' `
  -File 'components/trading/CompetitionEntryButton.tsx' `
  -Find '                  {entryClose.kind === "reserves_round" ? (' `
  -Replace '                  {false ? (' `
  -ExpectTest 'branches on all three kinds'

# 9. The span computed and then not shown.
Invoke-Probe -Name 'span computed but not rendered' `
  -File 'components/trading/CompetitionEntryButton.tsx' `
  -Find '                        {formatRemaining(entryClose.reservedMs)}' `
  -Replace '                        a few minutes' `
  -ExpectTest 'the reserved span is rendered, not merely computed'

# 10. A second copy of the clause leaking onto a game branch.
Invoke-Probe -Name 'clause duplicated onto a game branch' `
  -File 'components/trading/CompetitionEntryButton.tsx' `
  -Find '                      You can join right up to the end. Joining late leaves you
                      less time, and a round still running when the competition
                      closes is scored on what you managed.' `
  -Replace '                      After that no new entries are accepted, whether or not the
                      competition is still running.' `
  -ExpectTest 'the misleading clause is reachable only on the operator-chosen branch'

# 11. The deadline recomputed in the component rather than shared.
Invoke-Probe -Name 'second producer in the panel' `
  -File 'components/trading/CompetitionEntryButton.tsx' `
  -Find 'import {
  describeEntryClose,
  resolveRegistrationDeadline,
} from "@/lib/utils/registration-deadline";' `
  -Replace 'import { resolveRegistrationDeadline } from "@/lib/utils/registration-deadline";
const describeEntryClose = () => ({ kind: "operator_chosen", reservedMs: 0 });' `
  -ExpectTest 'the deadline and the explanation come from one module' `

Write-Host "`n=== the trading-capital line ===" -ForegroundColor Cyan

# 12. THE SECOND DEFECT: "$0 in trading capital" back in front of every game player.
Invoke-Probe -Name 'capital promise unguarded' `
  -File 'components/trading/CompetitionEntryButton.tsx' `
  -Find '              {!isProviderGame && (' `
  -Replace '              {true && (' `
  -ExpectTest 'is guarded, and the guard is the game test'

# 13. Guarding the whole box, which takes the fee warning off every game with it.
Invoke-Probe -Name 'fee warning withheld too' `
  -File 'components/trading/CompetitionEntryButton.tsx' `
  -Find ' Entry fee is non-refundable.
              {!isProviderGame && (' `
  -Replace '
              {!isProviderGame && (' `
  -ExpectTest 'the non-refundable half is NOT withheld'

Write-Host "`nDone. Every line above should read RED (1 failure).`n" -ForegroundColor Cyan
