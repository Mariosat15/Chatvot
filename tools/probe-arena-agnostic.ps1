# Probes for the arena's game-agnostic guard (owner requirement, 11 September 2026:
# "make sure that this page is game agnostic because for example a tetris game dont have
# board").
#
# THE CLAIMS WORTH PROBING, and the reason there are two kinds:
#
#   1. The rule itself catches a game-specific word written as copy into a real arena file.
#      Without this, the whole suite could be scanning nothing and reporting clean.
#   2. THE STRIPPER'S CANARY catches both directions of a broken stripper - one that keeps
#      Tailwind classes (so the rule fires on `grid-cols-3` and gets deleted by whoever it
#      stops) and one that strips everything (so the rule scans an empty string and passes on
#      any file at all). The second is the failure mode that shipped in
#      `native-select-legibility.test.ts` on 9 September 2026 and was caught only by accident.
#
# Conventions carried from the other harnesses here, each of which cost a false result once:
# UTF-8 without a BOM on read and write; refuse to write an empty file; relax newlines in the
# pattern; run the expected test ALONE with `-t`, which is a REGULAR EXPRESSION, so every name
# below is plain ASCII; DID NOT APPLY means the target moved, never that the run was quiet.

$ErrorActionPreference = 'Continue'
$Root = Split-Path -Parent $PSScriptRoot
$Suite = '__tests__/games/arena-game-agnostic.test.ts'

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
    # Some mutations legitimately break more than one assertion - a stripper that keeps
    # everything fails the canary AND every file scan. Where that is honest, the probe says so
    # rather than the test being weakened.
    [int]$MaxRed = 1
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
    $flat = ($out -replace '\s+', ' ')
    if ($flat -match 'Tests\s+(\d+)\s+failed') {
      $failed = [int]$Matches[1]
      if ($failed -le $MaxRed) {
        Write-Host "[$Name] RED ($failed failure(s), within the expected $MaxRed)" -ForegroundColor Green
      } else {
        Write-Host "[$Name] RED but $failed failures - blast radius, check the probe" -ForegroundColor Yellow
      }
    } elseif ($flat -match 'No test found' -or $flat -match 'Tests\s+no tests') {
      Write-Host "[$Name] NO TEST RAN - wrong test name, or wrong suite" -ForegroundColor Magenta
    } else {
      Write-Host "[$Name] GREEN - the guard is absent, weak, unreachable, or changes no observable" -ForegroundColor Red
    }
  } finally {
    Write-Source $path $original
  }
}

$Layout = 'components/games/arena/GameArenaLayout.tsx'
$Panel = 'components/games/arena/ArenaContestPanel.tsx'
$Test = '__tests__/games/arena-game-agnostic.test.ts'

Write-Host ''
Write-Host '=== The rule catches a game-specific word in real copy ===' -ForegroundColor Cyan

# The exact regression the owner is guarding against: a heading written while one grid puzzle
# was the only title in the catalogue.
Invoke-Probe -Name 'the leaderboard heading names a board' -File $Layout `
  -Find '            title="Leaderboard"' `
  -Replace '            title="Board standings"' `
  -ExpectTest 'GameArenaLayout.tsx says nothing a Tetris player would not recognise'

# A different file and a different noun, because a rule that only reaches the file it was
# written against is a rule with one user.
Invoke-Probe -Name 'the contest panel names a puzzle' -File $Panel `
  -Find '      title="Contest info"' `
  -Replace '      title="Puzzle info"' `
  -ExpectTest 'ArenaContestPanel.tsx says nothing a Tetris player would not recognise'

Write-Host ''
Write-Host '=== The stripper cannot be broken in either direction ===' -ForegroundColor Cyan

# Over-stripping is the dangerous one: every file scan then passes over an empty string, which
# reads exactly like a clean codebase. Expect the canary to be the thing that notices.
Invoke-Probe -Name 'the stripper removes everything' -File $Test `
  -Find '      .replace(/\/\*[\s\S]*?\*\//g, " ")' `
  -Replace '      .replace(/[\s\S]*/g, " ")' `
  -ExpectTest 'keeps the copy and drops the classes and the comments'

# Under-stripping fires the rule on `grid-cols-3`, which is layout rather than vocabulary. A
# guard that fails on correct code is deleted by the first person it inconveniences - so this
# one legitimately reddens the canary and the file scans together, and the limit says so.
Invoke-Probe -Name 'class names are left in' -File $Test `
  -Find '      .replace(/className="[^"]*"/g, " ")' `
  -Replace '      .replace(/className="[^"]*THIS_NEVER_MATCHES"/g, " ")' `
  -ExpectTest 'drops the classes' -MaxRed 1

Write-Host ''
Write-Host 'Done. Every probe above must read RED.' -ForegroundColor Cyan
Write-Host 'GREEN means the guard is absent, weak, unreachable, or the mutation changed no observable.'
