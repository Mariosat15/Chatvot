# Probes the Global leaderboard guards: reintroduce each defect, prove a test catches it.
#
# Every probe must turn RED on the test named in -Expect, and only on it. Three outcomes are
# as bad as a passing probe and all three have happened in this repo, so the harness checks:
#
#   1. A probe that never applied. A pattern with the wrong indentation, or CRLF against an LF
#      file, silently matches nothing and the suite stays green - which reads exactly like a
#      broken test. DID NOT APPLY means the target moved, never that the run was quiet.
#   2. A probe that destroyed the file. The tell is the failure COUNT: one small change should
#      turn 1-3 tests red, not the whole suite.
#   3. A probe aimed at the wrong test. vitest prints a passing test's name as readily as a
#      failing one, so the harness runs the expected test ALONE with -t and reads the counts.
#
# Note `-t` is a REGULAR EXPRESSION, so every -Expect here is a plain ASCII substring with no
# metacharacters. A name containing an em dash or an apostrophe has matched nothing before now
# and reported a passing run over zero tests.
#
# Run from the repo root:  pwsh -File tools/probe-global-leaderboard.ps1

$ErrorActionPreference = 'Continue'

$Suite = '__tests__/services/global-leaderboard-score.test.ts'

$Utf8NoBom = New-Object System.Text.UTF8Encoding($false)

function Read-Source {
  param([string]$Path)
  $full = (Resolve-Path -LiteralPath $Path).Path
  $text = [System.IO.File]::ReadAllText($full, [System.Text.Encoding]::UTF8)
  if ([string]::IsNullOrEmpty($text)) {
    throw "ABORT: read '$Path' as empty. Refusing to write it back."
  }
  return $text
}

function Write-Source {
  param([string]$Path, [string]$Text)
  if ([string]::IsNullOrEmpty($Text)) {
    throw "ABORT: refusing to write empty content to '$Path'."
  }
  $full = (Resolve-Path -LiteralPath $Path).Path
  [System.IO.File]::WriteAllText($full, $Text, $Utf8NoBom)
}

# A probe that silently corrupts the file it restores is worse than one that fails, because the
# damage outlives the run and looks like somebody else's regression.
function Assert-RoundTrip {
  param([string]$Path)
  $before = Read-Source -Path $Path
  Write-Source -Path $Path -Text $before
  if ((Read-Source -Path $Path) -ne $before) {
    throw "ABORT: read/write round trip changed '$Path'. Fix the encoding before probing."
  }
}

function To-Relaxed-Regex {
  param([string]$Literal)
  return ([regex]::Escape($Literal) -replace '(\\r)?\\n', '\r?\n')
}

function Invoke-Probe {
  param(
    [string]$Name,
    [string]$File,
    [string]$Find,
    [string]$Replace,
    [string]$Expect
  )

  Write-Host ""
  Write-Host "=== PROBE: $Name" -ForegroundColor Cyan

  $original = Read-Source -Path $File
  $pattern = To-Relaxed-Regex -Literal $Find
  # `$` is a substitution marker in a .NET replacement string.
  $patched = [regex]::new($pattern).Replace($original, $Replace.Replace('$', '$$'), 1)

  if ($patched -eq $original) {
    Write-Host "  [PROBE DID NOT APPLY] pattern matched nothing - the probe is broken, not the test" -ForegroundColor Magenta
    return
  }

  Write-Source -Path $File -Text $patched
  try {
    $targeted = (& npx vitest run $Suite -t $Expect 2>&1 | Out-String) -replace '\s+', ' '
    $whole = (& npx vitest run $Suite 2>&1 | Out-String) -replace '\s+', ' '

    $expectedFailed = $targeted -match 'Tests\s+[1-9]\d*\s+failed'
    $expectedRan = $targeted -match 'Tests\s+\d'

    $totalFailed = 0
    if ($whole -match 'Tests\s+(\d+)\s+failed') { $totalFailed = [int]$Matches[1] }

    if (-not $expectedRan) {
      Write-Host "  [HARNESS BROKEN] no test matched -t '$Expect' - the name moved or contains a regex character" -ForegroundColor Magenta
    }
    elseif ($expectedFailed) {
      Write-Host "  [RED on the expected test] $Expect" -ForegroundColor Green
      Write-Host "  whole-suite failures: $totalFailed" -ForegroundColor DarkGray
      if ($totalFailed -gt 4) {
        Write-Host "  [SUSPICIOUS] $totalFailed failures for a one-line change - check the file survived" -ForegroundColor Yellow
      }
    }
    elseif ($totalFailed -eq 0) {
      Write-Host "  [STILL GREEN - THE GUARD IS NOT WORKING]" -ForegroundColor Red
    }
    else {
      Write-Host "  [RED, BUT NOT ON THE EXPECTED TEST] wanted: $Expect" -ForegroundColor Yellow
      Write-Host "  whole-suite failures: $totalFailed" -ForegroundColor DarkGray
    }
  }
  finally {
    Write-Source -Path $File -Text $original
  }
}

$Score = 'lib/services/leaderboard/global-score.ts'
$Board = 'lib/services/leaderboard/global-board.service.ts'
$Explainer = 'components/leaderboard/RankingsExplainer.tsx'
$Client = 'components/leaderboard/LeaderboardClient.tsx'

foreach ($f in @($Score, $Board, $Explainer, $Client)) { Assert-RoundTrip -Path $f }
Write-Host "Round-trip check passed for all probe targets." -ForegroundColor DarkGray

# 1. The published split stops being the owner's split.
Invoke-Probe -Name 'trading share moved off 25' -File $Score `
  -Find @'
    label: "Trading performance",
    description: "Your position on the Trading board.",
    defaultWeight: 25,
'@ `
  -Replace @'
    label: "Trading performance",
    description: "Your position on the Trading board.",
    defaultWeight: 40,
'@ `
  -Expect 'ships the owner-approved split'

# 2. A zero share vanishes from the explanation instead of being published as zero.
#    This is the quiet one: the list still adds to 100 and still reads correctly.
Invoke-Probe -Name 'zero-weight components dropped from the published list' -File $Score `
  -Find @'
  if (drift !== 0 && largest) largest.percent += drift;

  return rows;
'@ `
  -Replace @'
  if (drift !== 0 && largest) largest.percent += drift;

  return rows.filter((r) => r.percent > 0);
'@ `
  -Expect 'publishes every component'

# 3. Rounding drift left uncorrected - a list of percentages that sums to 99.
Invoke-Probe -Name 'rounding drift not pushed onto the largest row' -File $Score `
  -Find 'if (drift !== 0 && largest) largest.percent += drift;' `
  -Replace 'if (false && largest) largest.percent += drift;' `
  -Expect 'rounding drift'

# 4. An all-zero or NaN set divides by nothing and poisons every score (R31).
Invoke-Probe -Name 'empty weight set no longer falls back to the defaults' -File $Score `
  -Find 'if (sum <= 0) return { ...DEFAULT_GLOBAL_WEIGHTS };' `
  -Replace 'if (sum < 0) return { ...DEFAULT_GLOBAL_WEIGHTS };' `
  -Expect 'falls back to the defaults'

# 5. Ties resolved to the WORSE rank - reads correctly, pays the wrong order.
Invoke-Probe -Name 'tied values no longer share the better position' -File $Score `
  -Find 'if (!rankOfValue.has(value)) rankOfValue.set(value, index + 1);' `
  -Replace 'rankOfValue.set(value, index + 1);' `
  -Expect 'ties share the better position'

# 6. THE OWNER DECISION ITSELF: redistribution removed, so a games-only player is
#    capped by the 25% they cannot earn and can never reach #1.
Invoke-Probe -Name 'redistribution removed - the declared weight is used raw' -File $Score `
  -Find @'
      const appliedWeight =
        participates && participatingWeight > 0
          ? (declared / participatingWeight) * GLOBAL_WEIGHT_TOTAL
          : 0;
'@ `
  -Replace @'
      const appliedWeight = participates ? declared : 0;
'@ `
  -Expect 'applied weights of a partial player'

# 7. Participation inferred from the value, so zero wins and never having entered
#    collapse into one fact and a real zero is redistributed away.
Invoke-Probe -Name 'participation derived from the value' -File $Score `
  -Find 'const participates = Boolean(entry?.participates);' `
  -Replace 'const participates = Boolean(entry?.value);' `
  -Expect 'taking part with a zero'

# 8. The operator's weights are read and then ignored - the screen says one thing,
#    the arithmetic does another, and nothing fails.
Invoke-Probe -Name 'operator weights ignored in favour of the defaults' -File $Score `
  -Find @'
): GlobalScoredRow[] {
  const weightMap = weightsToMap(weights);
'@ `
  -Replace @'
): GlobalScoredRow[] {
  const weightMap = weightsToMap(DEFAULT_GLOBAL_WEIGHTS);
'@ `
  -Expect 'weights change the order'

# 9. R29: a game switched off retroactively subtracts everything earned in it.
Invoke-Probe -Name 'game totals scoped to a positive list of keys' -File $Board `
  -Find '$nin: [OVERALL_GAME_KEY, TRADING_GAME_TYPE]' `
  -Replace '$in: [TRADING_GAME_TYPE]' `
  -Expect 'counts stored game keys'

# 10. The explanation carries its own copy of the percentages, so an operator's
#     change moves the ranking and not the sentence describing it.
Invoke-Probe -Name 'explainer hard-codes a percentage' -File $Explainer `
  -Find '{intro}' `
  -Replace '{intro} Trading is worth 25% of your place.' `
  -Expect 'explanation is built from the weights'

# 11. The client stops taking the weights the server actually used.
Invoke-Probe -Name 'client drops the server weights' -File $Client `
  -Find 'setGlobalWeights(data.weights ?? []);' `
  -Replace 'setGlobalWeights([]);' `
  -Expect 'explanation is built from the weights'

# 12. R58: a model import here takes the whole player app down at build time, and
#     neither the typecheck nor the dev server can see it.
Invoke-Probe -Name 'weights module reaches for mongoose' -File $Score `
  -Find '/** The seven things that decide a global rank. */' `
  -Replace @'
import type { Model } from "mongoose";

/** The seven things that decide a global rank. */
'@ `
  -Expect 'stays client-safe'

Write-Host ""
Write-Host "Done. Every probe above must read [RED on the expected test]." -ForegroundColor DarkGray
