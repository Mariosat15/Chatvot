# Probes for R50's challenge half: the phantom `score: 0` on a challenge seat.
#
# WHAT THIS SLICE DID, 12 September 2026: `ChallengeParticipant.score` stopped being
# `required: true, default: 0` in both apps, and the accept route's two inline seat objects
# became one named builder. Nothing else. The read path is untouched, because there is not one -
# neither copy of `challenge-finalize.actions.ts` mentions `score` at all.
#
# THE CLAIMS WORTH PROBING are the two ways the nought comes back. The competition half had
# three writers and any one of them re-armed the defect on its own; here there are two, because
# no read path applies yet:
#
#   1. the schema default is restored - one line, reads as a safe "keep existing rows valid"
#   2. the seat builder names the field - one line, reads as completeness
#
# Both are mutations that render perfectly, save perfectly and report success. Neither produces
# a typecheck error, because `IChallengeParticipant` is imported nowhere and the model export is
# widened to `any`, so the compiler has no opinion about either. That is the whole reason these
# guards are tests.
#
# THE MIRROR IS PROBED TOO. `check:mirrors` compares field paths and enum values, and a default
# is neither, so restoring the default in the ADMIN copy alone leaves that guard green. The test
# cannot see the admin copy either - vitest aliases `@` to the repository root - so probe 3
# records what actually holds that property, with the reason, rather than pretending otherwise.
#
# Conventions carried from the sibling harnesses, each of which cost a false result once:
#
#   * UTF-8 WITHOUT a BOM on the read AND the write. `Get-Content -Raw` decodes with the system
#     ANSI codepage and writes the mojibake back.
#   * `System.IO.File` rather than `Get-Content`, because one path here contains `[id]` and
#     PowerShell parses that as a wildcard character class - it would empty the route and
#     report success.
#   * Refuse to write when the read came back empty.
#   * Relax newlines in the pattern - a CRLF pattern never matches an LF file.
#   * Run the expected test ALONE with `-t` and read the summary counts.
#   * `-t` IS A REGULAR EXPRESSION. Every expected name below is plain ASCII, no brackets and
#     no apostrophes - a punctuated name matches nothing and reports a passing run over zero
#     tests, which is indistinguishable from a missing guard.
#   * PARAMETERISED ON THE SUITE, because these probes prove guards in two different files.
#   * DID NOT APPLY means the target moved, never that the run was quiet.

$ErrorActionPreference = 'Continue'
$Root = Split-Path -Parent $PSScriptRoot
$DefaultSuite = '__tests__/services/challenge-participant-seat.test.ts'
$SchemaSuite = '__tests__/services/game-label-and-score.test.ts'

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
    [string]$Suite = $DefaultSuite
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
      if ($failed -eq 1) {
        Write-Host "[$Name] RED (1 failure, as expected)" -ForegroundColor Green
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

$Model = 'database/models/trading/challenge-participant.model.ts'
$Seat = 'lib/services/challenges/challenge-participant-seat.ts'
$Route = 'app/api/challenges/[id]/accept/route.ts'

Write-Host ''
Write-Host '=== The two ways the phantom nought comes back ===' -ForegroundColor Cyan

# WRITER 1, THE SCHEMA. This is R50 verbatim, restored: it is the exact declaration the field
# carried from X1 until today, and it reads as the careful choice - existing rows and every
# current writer stay valid. It is also the one a rolling deploy makes tempting.
Invoke-Probe -Name 'the schema default is restored' -File $Model `
  -Find @'
    score: {
      type: Number,
      required: false,
    },
'@ `
  -Replace @'
    score: {
      type: Number,
      required: true,
      default: 0,
    },
'@ `
  -ExpectTest 'ChallengeParticipant does NOT default score either' `
  -Suite $SchemaSuite

# The same mutation against the round-trip test, which is the assertion that catches either
# writer, because it puts the builder's own output through the real model.
Invoke-Probe -Name 'the schema default is restored, seen through the builder' -File $Model `
  -Find @'
    score: {
      type: Number,
      required: false,
    },
'@ `
  -Replace @'
    score: {
      type: Number,
      required: true,
      default: 0,
    },
'@ `
  -ExpectTest 'survives the round trip through the real model with no score'

# WRITER 2, THE SEAT. `score: 0` beside the other initialised counters reads as completeness -
# every neighbouring field is zeroed, so a reviewer's eye passes straight over it. This is the
# line that was there before the extraction.
Invoke-Probe -Name 'the seat names the field again' -File $Seat `
  -Find '    // NO `score`. See the header, and the schema path that used to default it.' `
  -Replace '    score: 0,' `
  -ExpectTest 'names no score at all'

# And the same, seen through the model, which is the assertion that does not care which file
# put the nought there.
Invoke-Probe -Name 'the seat names the field again, seen through the model' -File $Seat `
  -Find '    // NO `score`. See the header, and the schema path that used to default it.' `
  -Replace '    score: 0,' `
  -ExpectTest 'survives the round trip through the real model with no score'

Write-Host ''
Write-Host '=== The label, which a defaulted seat gets wrong in silence ===' -ForegroundColor Cyan

# A seat that omits the `gameKey` KEY is stamped "trading" by the schema default when saved.
# Nothing throws, the row saves, and because `gameKey` is immutable the player is filed under
# the wrong game for ever. Targets the shorthand property in the object literal rather than the
# `const gameKey = ...` computation above it (extracted since this probe was last verified, to
# feed `isTrading` too) - deleting the whole computation would throw a ReferenceError at every
# call site instead of producing the single, specific wrong value this probe is about.
Invoke-Probe -Name 'the label falls back to the schema default' -File $Seat `
  -Find '    gameKey,' `
  -Replace '' `
  -ExpectTest 'copies the game label from the challenge rather than letting it default'

# The `||` catches three shapes of missing - absent, null and empty string - and `??` catches
# one. An empty label is what a half-run migration and a form submitting nothing both leave.
Invoke-Probe -Name 'the fallback stops catching an empty label' -File $Seat `
  -Find '  const gameKey = input.gameKey || TRADING_GAME_TYPE;' `
  -Replace '  const gameKey = input.gameKey ?? TRADING_GAME_TYPE;' `
  -ExpectTest 'falls back to trading for an absent or empty label'

Write-Host ''
Write-Host '=== The route, which seats both players in one call ===' -ForegroundColor Cyan

# THE MUTATION THAT MATTERS HERE IS ONE-SIDED. Converting the challenger and leaving the
# challenged side inline is what a half-finished refactor looks like, and the inline copy is
# exactly where a `score: 0` survives - so the guard counts the call sites rather than asking
# whether the builder is mentioned.
Invoke-Probe -Name 'only one of the two seats goes through the builder' -File $Route `
  -Find @'
        buildChallengeParticipantSeat({
          challengeId: challenge._id.toString(),
          userId: challenge.challengedId,
          username: challenge.challengedName,
          email: challenge.challengedEmail,
          role: "challenged",
          gameKey: challenge.gameKey,
          startingCapital: challenge.startingCapital,
          joinedAt: now,
        }),
'@ `
  -Replace @'
        {
          challengeId: challenge._id.toString(),
          userId: challenge.challengedId,
          username: challenge.challengedName,
          email: challenge.challengedEmail,
          role: "challenged",
          gameKey: challenge.gameKey,
          startingCapital: challenge.startingCapital,
          currentCapital: challenge.startingCapital,
          availableCapital: challenge.startingCapital,
          joinedAt: now,
        },
'@ `
  -ExpectTest 'builds both seats with the shared builder'

# The route's own mention of a score, which is what the inline object above used to carry.
Invoke-Probe -Name 'the route writes a score of its own' -File $Route `
  -Find '          role: "challenger",' `
  -Replace @'
          role: "challenger",
          score: 0,
'@ `
  -ExpectTest 'mentions no score of its own'

Write-Host ''
Write-Host '=== The admin copy, which check:mirrors cannot see a default on ===' -ForegroundColor Cyan

# A text comparison after comments, never a second model import. Restoring the default in the
# admin file alone leaves check:mirrors green (a default is neither a path nor an enum) and
# every runtime assertion here green (vitest aliases @ to the root). The comments in both
# files quote the old declaration, so a whole-file search is green on the defect.
Invoke-Probe -Name 'the admin schema default is restored' `
  -File 'apps/admin/database/models/trading/challenge-participant.model.ts' `
  -Find @'
    score: {
      type: Number,
      required: false,
    },
'@ `
  -Replace @'
    score: {
      type: Number,
      required: true,
      default: 0,
    },
'@ `
  -ExpectTest 'the admin copy matches the main copy after comments'

Write-Host ''
Write-Host '=== The capital fields, conditional on gameKey since the step that seated a provider challenge ===' -ForegroundColor Cyan

# THE BUILDER'S OWN GUARD. Deleting the early return makes every seat, provider included, fall
# through to the trading branch and pick up all three capital fields - a control that appears
# to work (the fields still read as numbers) and silently costs the "provider participant has
# no capital" guarantee `CompetitionParticipant`'s own builder carries.
Invoke-Probe -Name 'the isTrading early return is removed, so a provider seat gets capital fields anyway' -File $Seat `
  -Find '  if (!isTrading) return seat;' `
  -Replace '' `
  -ExpectTest 'omits all three capital fields entirely for a provider participant'

# THE SCHEMA'S OWN GUARD, MAIN COPY. Reverting the predicate to an unconditional `required: true`
# is the direct sibling of the score-default mutation above, on the field that was ALREADY
# conditional before this step and is the reason a provider participant can be saved at all.
Invoke-Probe -Name 'startingCapital reverts to unconditionally required on the main model' -File $Model `
  -Find @'
    startingCapital: {
      type: Number,
      required: function (this: { gameKey?: string }) {
        return (this.gameKey || "trading") === "trading";
      },
      min: 0,
    },
'@ `
  -Replace @'
    startingCapital: {
      type: Number,
      required: true,
      min: 0,
    },
'@ `
  -ExpectTest 'a provider participant validates cleanly with no capital fields at all'

# THE SAME MUTATION, ADMIN COPY. `check:mirrors` compares field paths and enum values, never a
# predicate body, so this would leave that guard green - it is caught only by the byte-for-byte
# text comparison, which is why that test counts three matches in EACH file rather than merely
# asserting the pattern exists once somewhere.
Invoke-Probe -Name 'startingCapital reverts to unconditionally required on the admin model' `
  -File 'apps/admin/database/models/trading/challenge-participant.model.ts' `
  -Find @'
    startingCapital: {
      type: Number,
      required: function (this: { gameKey?: string }) {
        return (this.gameKey || "trading") === "trading";
      },
      min: 0,
    },
'@ `
  -Replace @'
    startingCapital: {
      type: Number,
      required: true,
      min: 0,
    },
'@ `
  -ExpectTest "the admin copy's capital-field REQUIRED PREDICATE matches the main copy byte-for-byte"

# THE FALLBACK THAT KEEPS A TRADING SEAT NUMERIC. `input.startingCapital ?? 0` is what stops an
# unsupplied figure from reaching the model as `undefined` - dropping it to a bare pass-through
# would not fail loudly, since `undefined` still satisfies "a number was requested" right up
# until the schema's OWN required check fires, at which point the failure reads as a missing
# challenge field rather than a builder regression.
Invoke-Probe -Name 'the ?? 0 fallback on startingCapital is removed' -File $Seat `
  -Find '  const capital = input.startingCapital ?? 0;' `
  -Replace '  const capital = input.startingCapital;' `
  -ExpectTest 'defaults an unsupplied startingCapital to 0 for a trading participant, never to undefined'

Write-Host ''
