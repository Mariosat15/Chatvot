# Probes for X6.5 A3c - the operator's nouns inside the AI prompts.
#
# Each probe reintroduces one defect the guard exists to catch and asserts the EXPECTED test
# goes red, alone. Two harness rules learned the hard way and applied here:
#   - Read AND write with -LiteralPath, and refuse to write when the read came back empty.
#     A probe that destroys the file it is probing reports every test red on the right name
#     for entirely the wrong reason, and the tell is the failure COUNT, not the failure.
#   - Name the expected failing test and run it ALONE with -t. Searching whole-suite output
#     for a test's name finds it whether it passed or failed.

$ErrorActionPreference = 'Continue'
Set-Location (Join-Path $PSScriptRoot '..')

$Enc = New-Object System.Text.UTF8Encoding($false)

function Read-Source([string]$Path) {
  $text = [System.IO.File]::ReadAllText((Resolve-Path -LiteralPath $Path), $Enc)
  if ([string]::IsNullOrWhiteSpace($text)) {
    throw "Read of $Path came back empty - refusing to probe."
  }
  return $text
}

function Write-Source([string]$Path, [string]$Text) {
  if ([string]::IsNullOrWhiteSpace($Text)) {
    throw "Refusing to write an empty $Path."
  }
  [System.IO.File]::WriteAllText((Resolve-Path -LiteralPath $Path), $Text, $Enc)
}

function Invoke-Probe {
  param(
    [string]$Name,
    [string]$File,
    [string]$Find,
    [string]$Replace,
    [string]$ExpectTest,
    [string]$Suite = '__tests__/admin/ai-vocabulary-terminology.test.ts'
  )

  $original = Read-Source $File
  if (-not $original.Contains($Find)) {
    Write-Host "[$Name] PROBE DID NOT APPLY - pattern not found. The target moved; re-aim it." -ForegroundColor Yellow
    return
  }

  Write-Source $File $original.Replace($Find, $Replace)
  try {
    $out = (& npx vitest run $Suite -t $ExpectTest 2>&1 | Out-String) -replace '\s+', ' '
    # Checked BEFORE the failure count, and deliberately: a run that matched no test prints
    # no "failed" line at all, so a bare fall-through to GREEN reports a moved or mis-spelled
    # -t pattern as an unprotected guard. That happened here on the first run.
    if ($out -match 'No test files found' -or $out -match 'Tests\s+no tests' -or $out -notmatch 'Tests\s+\d') {
      Write-Host "[$Name] NO TEST RAN - the -t pattern matched nothing (vitest -t is a REGEX)" -ForegroundColor Red
      return
    }
    if ($out -match 'Tests\s+(\d+)\s+failed\s*\|\s*(\d+)\s+passed') {
      $failed = [int]$Matches[1]
      if ($failed -eq 1) {
        Write-Host "[$Name] RED on exactly 1 test - OK" -ForegroundColor Green
      } else {
        Write-Host "[$Name] RED on $failed tests - too wide, re-scope the assertion" -ForegroundColor Yellow
      }
    } elseif ($out -match 'Tests\s+(\d+)\s+failed') {
      Write-Host "[$Name] RED on $($Matches[1]) test(s) - OK" -ForegroundColor Green
    } else {
      Write-Host "[$Name] GREEN - the guard did not catch this. Ask which of the four causes." -ForegroundColor Red
    }
  } finally {
    Write-Source $File $original
  }
}

$VOCAB = 'apps/admin/lib/admin/ai-contest-vocabulary.ts'
$GAME_VOCAB = 'apps/admin/lib/admin/ai-game-content-vocabulary.ts'
$CONTEST_ROUTE = 'apps/admin/app/api/ai/generate-competition/route.ts'
$GAME_ROUTE = 'apps/admin/app/api/ai/generate-game-content/route.ts'

Write-Host "`n=== X6.5 A3c probes ===`n"

# 1. THE DEFECT ITSELF: no clause at all, which is the state before this slice. Every prompt
#    reads perfectly and says Competition on a platform whose screens all say Tournament.
Invoke-Probe -Name 'no clause on trading' -File $VOCAB `
  -Find 'systemPrompt: TRADING_SYSTEM_PROMPT + vocabularyRule(terms),' `
  -Replace 'systemPrompt: TRADING_SYSTEM_PROMPT,' `
  -ExpectTest 'includes trading, whose nouns an operator renamed too'

# 2. The clause emitted unconditionally, with a heading and no lines. Reads as harmless
#    tidiness and changes every prompt on the platform in order to change none of them -
#    which destroys the character-for-character trading guarantee.
Invoke-Probe -Name 'never empty' -File $VOCAB `
  -Find '  if (renamed.length === 0) return "";' `
  -Replace '  if (false) return "";' `
  -ExpectTest 'is the empty string when no override is stored'

# 3. A token listed even when the operator stored its own default - noise in a prompt
#    telling the model to write "competition instead of competition".
Invoke-Probe -Name 'no-op override listed' -File $VOCAB `
  -Find '(token) => terms[token] !== TERMS[token],' `
  -Replace '() => true,' `
  -ExpectTest 'lists only the tokens that actually differ'

# 4. Interpolated into the historical prompt rather than appended. The behavioural test
#    passes; the structural one is what catches this.
Invoke-Probe -Name 'spliced into the historical prompt' -File $VOCAB `
  -Find '- Focus on the competitive/gaming aspect`;' `
  -Replace '- Focus on the competitive/gaming aspect${vocabularyRule(resolveTerms(null))}`;' `
  -ExpectTest 'never spliced into the string'

# 5. The clause reaches the contest assistant but not the game-page one - exactly the shape
#    of the two hand-written projections that made one assistant blander than the other.
Invoke-Probe -Name 'game page assistant missed' -File $GAME_VOCAB `
  -Find 'Return 3 highlights. Return nothing outside the JSON.${vocabularyRule(terms)}`;' `
  -Replace 'Return 3 highlights. Return nothing outside the JSON.`;' `
  -ExpectTest 'includes trading, whose nouns an operator renamed too'

# 6. `terms` given a default value. The call sites all still compile, a forgotten one is
#    silently answered in the old vocabulary, and nothing is thrown or logged.
Invoke-Probe -Name 'optional terms parameter' -File $VOCAB `
  -Find 'export function tradingVocabulary(terms: TerminologyPack): ContestVocabulary {' `
  -Replace 'export function tradingVocabulary(terms: TerminologyPack = resolveTerms(null)): ContestVocabulary {' `
  -ExpectTest 'has no default value on any of the three functions'

# 7. A hand-picked list of "the tokens that matter", which is a second place to forget one -
#    and the forgotten one is whichever somebody has just renamed.
Invoke-Probe -Name 'tokens enumerated' -File $VOCAB `
  -Find '  const renamed = TERMINOLOGY_TOKENS.filter(' `
  -Replace '  const renamed = (["contest", "contests"] as typeof TERMINOLOGY_TOKENS).filter(' `
  -ExpectTest 'enumerates no token anywhere in the clause'

# 8. The vocabulary taken off the request body instead of read server-side - arbitrary text
#    inside a system prompt, and a stale wizard tab contradicting a rename since made.
Invoke-Probe -Name 'terms off the body' -File $CONTEST_ROUTE `
  -Find 'await resolveVocabulary(gameKey, await getTerms())' `
  -Replace 'await resolveVocabulary(gameKey, resolveTerms(null))' `
  -ExpectTest 'is reached from both routes with the terms read server-side'

# 9. Same, one route along.
Invoke-Probe -Name 'game route stops reading terms' -File $GAME_ROUTE `
  -Find 'gameContentVocabulary(title, await getTerms())' `
  -Replace 'gameContentVocabulary(title, resolveTerms(null))' `
  -ExpectTest 'is reached from both routes with the terms read server-side'

# 10. The clause MOVED off the end of the provider prompt rather than added a second time.
#     The first version of this probe appended a duplicate and came back green, because the
#     real clause was still last - the fourth cause of a green probe, a mutation with no
#     observable. The interesting defect is a rename an earlier rule can override.
Invoke-Probe -Name 'clause no longer last' -File $VOCAB `
  -Find 'the operator sets those${NO_FIAT_RULE}${vocabularyRule(terms)}`;' `
  -Replace 'the operator sets those${vocabularyRule(terms)}${NO_FIAT_RULE}`;' `
  -ExpectTest 'is last in all three prompts'

Write-Host "`n=== done ===`n"
