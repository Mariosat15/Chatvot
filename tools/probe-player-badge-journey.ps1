# Probes for __tests__/profile/player-badge-and-journey-surfaces.test.ts
#
# Reason: every guard in that suite is structural or reads a value the fix produces, and a
# structural guard that can never fail is indistinguishable from one that works. Each probe
# reintroduces exactly one defect, runs the ONE test that should notice, and asserts a single
# failure. A probe reporting more damage than it caused is not reporting on the guard.
#
# Two harness rules, both learned the hard way in this repository:
#   * read AND write with -LiteralPath and UTF-8 without a BOM, then assert the file actually
#     changed - a replacement that did not apply looks exactly like a test that does not work;
#   * run the expected test alone with -t and read the summary counts, because vitest prints a
#     passing test's name as readily as a failing one.

$ErrorActionPreference = 'Continue'
$Root = Split-Path -Parent $PSScriptRoot
$Suite = '__tests__/profile/player-badge-and-journey-surfaces.test.ts'
$Enc = New-Object System.Text.UTF8Encoding($false)

function Read-Text([string]$Path) {
  return [System.IO.File]::ReadAllText($Path, $Enc)
}

function Write-Text([string]$Path, [string]$Text) {
  [System.IO.File]::WriteAllText($Path, $Text, $Enc)
}

function Invoke-Probe {
  param(
    [string]$Name,
    [string]$File,
    [string]$Find,
    [string]$Replace,
    [string]$Test
  )

  $path = Join-Path $Root $File
  $original = Read-Text $path
  if (-not $original.Contains($Find)) {
    Write-Host "[$Name] PROBE DID NOT APPLY - anchor not found" -ForegroundColor Yellow
    return
  }

  $mutated = $original.Replace($Find, $Replace)
  if ($mutated -eq $original) {
    Write-Host "[$Name] PROBE DID NOT APPLY - replacement changed nothing" -ForegroundColor Yellow
    return
  }

  Write-Text $path $mutated
  try {
    $out = & npx vitest run $Suite -t $Test 2>&1 | Out-String
    $out = ($out -replace '\s+', ' ')
    # Reason: with -t the untargeted tests are reported as "skipped", not "passed", so a summary
    # pattern demanding "passed" matches nothing and every probe reports UNKNOWN.
    if ($out -match 'Tests\s+(\d+)\s+failed') {
      $failed = [int]$Matches[1]
      if ($failed -eq 1) {
        Write-Host "[$Name] RED (1 failure) - guard works" -ForegroundColor Green
      } else {
        Write-Host "[$Name] RED but $failed failures - probe is too broad" -ForegroundColor Yellow
      }
    } elseif ($out -match 'Tests\s+(\d+)\s+passed') {
      Write-Host "[$Name] GREEN - the guard does not hold" -ForegroundColor Red
    } elseif ($out -match 'No test files found|matched') {
      Write-Host "[$Name] NO TEST RAN - probe aimed at the wrong test" -ForegroundColor Red
    } else {
      Write-Host "[$Name] UNKNOWN outcome" -ForegroundColor Yellow
    }
  } finally {
    Write-Text $path $original
    if ((Read-Text $path) -ne $original) {
      Write-Host "[$Name] RESTORE FAILED - check $File by hand" -ForegroundColor Red
    }
  }
}

Invoke-Probe -Name 'category filter drops Volume' `
  -File 'components/profile/BadgesDisplay.tsx' `
  -Find '"Volume",' -Replace '' `
  -Test 'offers every declared BadgeCategory'

# Note: `getCategoryIcon` in BadgesDisplay.tsx is GONE as of 17 Sep 2026. It was dead (defined,
# never called) and had no Games arm, so there is no probe for it and never can be. It was deleted
# rather than given an arm: a guard over a dead branch pins it in place, while leaving it is the
# `shouldBlockEntry` shape - reintroducing the defect becomes one line that reads like using an
# existing API. This note is kept so the next reader does not "restore" it.
Invoke-Probe -Name 'percentage divides by zero again' `
  -File 'lib/actions/badges/user-badges.actions.ts' `
  -Find 'totalBadges > 0 ? (earnedCount / totalBadges) * 100 : 0' `
  -Replace '(earnedCount / totalBadges) * 100' `
  -Test 'reports 0 percent'

Invoke-Probe -Name 'Games leaves the category count' `
  -File 'lib/actions/badges/user-badges.actions.ts' `
  -Find 'Games: tally.get("Games") ?? 0,' -Replace '' `
  -Test 'counts every declared category'

Invoke-Probe -Name 'sequence flag never settles' `
  -File 'app/(root)/journey/JourneyClient.tsx' `
  -Find 'setMapsResolved(true);' -Replace '' `
  -Test 'clears the sequence flag'

Invoke-Probe -Name 'skeleton gated on the loading flag again' `
  -File 'app/(root)/journey/JourneyClient.tsx' `
  -Find 'if (!mapsResolved && maps.length === 0) {' `
  -Replace 'if (loading && maps.length === 0) {' `
  -Test 'gates the skeleton'

Invoke-Probe -Name 'empty state removed' `
  -File 'app/(root)/journey/JourneyClient.tsx' `
  -Find 'No journey maps found' -Replace 'Loading' `
  -Test 'renders an empty state'

Invoke-Probe -Name 'write-only loading flag reinstated' `
  -File 'app/(root)/journey/JourneyClient.tsx' `
  -Find 'const [mapsResolved, setMapsResolved] = useState(false);' `
  -Replace "const [loading, setLoading] = useState(true);`r`n  const [mapsResolved, setMapsResolved] = useState(false);" `
  -Test 'no write-only loading flag'
