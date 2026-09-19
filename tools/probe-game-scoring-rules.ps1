# Probes for __tests__/admin/game-scoring-rules.test.ts
#
# WHAT THIS IS DEFENDING. Task document 14. Until 9 September 2026 "a score of zero wins
# nothing" was a hard-coded line inside `providerHasResult`, and there was no way at all to say
# "a score this bad is not worth paying". Both are now per-title fields with their own screen,
# route and audit line.
#
# THE DEFECT THIS FILE MOST NEEDS TO CATCH is probe 3: `minimumEligibleScore` compared with
# `>=` in BOTH directions. It reads perfectly - the field is called a minimum, so a minimum is
# what you compare it as - and on a lower-is-better game it refuses every finisher whose time is
# UNDER the bar. Not a partial failure: the better a player did, the more certainly they are
# excluded, the whole pot lands in the unclaimed pool, and there is no error and nothing in a
# log. Probe 3 is what turns that red.
#
# THE SECOND CLASS is the "missing has three shapes" family, probes 4 to 7. An absent bar and a
# stored `0` are different facts, and a `??` or a truthiness test at ANY layer - resolver, edge
# parser, service, dialog, row summary - silently turns a configured bar into an unset one. Each
# layer gets its own probe, because a guard at one layer masks a missing guard at the next.
#
# THE THIRD is probe 9: the eligibility fields added to the sync's allow-list, which is how
# somebody would "tidy up" fields that sit beside `scoreDirection` and look like it. The
# operator's prize decision then survives until the next catalogue pull and is silently
# reverted. Note 9b: the copy an operator's Sync button actually runs is the one in `apps/admin`,
# which no runtime assertion in the suite can reach.
#
# Harness rules, every one of them learned the hard way by an earlier probe file here: read and
# write through [System.IO.File] with UTF-8 and no BOM, refuse to write when the read came back
# empty, confirm the replacement actually changed the file, and run the expected test ALONE with
# `-t` reading the summary counts - searching whole-suite output for a name finds it whether the
# test passed or failed.

$ErrorActionPreference = 'Continue'
$Root = Split-Path -Parent $PSScriptRoot
$Utf8 = New-Object System.Text.UTF8Encoding $false
$Suite = '__tests__/admin/game-scoring-rules.test.ts'

$Gate = 'lib/games/provider/scoring.ts'
$Resolver = 'lib/services/games/score-direction.service.ts'
$Service = 'apps/admin/lib/services/game-providers/game-scoring-rules.service.ts'
$Route = 'apps/admin/app/api/games/providers/[providerKey]/games/scoring/route.ts'
$Copy = 'apps/admin/lib/admin/score-eligibility-copy.ts'
$Fields = 'apps/admin/lib/admin/game-content-fields.ts'
$Dialog = 'apps/admin/components/admin/games/GameScoringDialog.tsx'
$List = 'apps/admin/components/admin/games/ProviderCatalogueDialog.tsx'
$Sync = 'lib/services/game-providers/catalogue.service.ts'
$Settlement = 'lib/services/settlement/provider-settlement.service.ts'

function Read-File([string]$Rel) {
  # -LiteralPath semantics by construction: [System.IO.File] does no globbing, which is what a
  # path containing `[providerKey]` needs. PowerShell's own Get-Content reads that as a
  # character class, matches nothing and returns $null - and Set-Content then happily writes
  # the empty result back, emptying the file while every probe reports RED on the right test
  # for entirely the wrong reason. The tell is the failure COUNT, not the failure.
  $text = [System.IO.File]::ReadAllText((Join-Path $Root $Rel), $Utf8)
  if ([string]::IsNullOrEmpty($text)) { throw "PROBE ABORT: read $Rel came back empty" }
  return $text
}

function Write-File([string]$Rel, [string]$Text) {
  if ([string]::IsNullOrEmpty($Text)) { throw "PROBE ABORT: refusing to write empty $Rel" }
  [System.IO.File]::WriteAllText((Join-Path $Root $Rel), $Text, $Utf8)
}

function Relaxed([string]$Literal) {
  # Escape the literal, then relax every newline: a multi-line pattern with CRLF endings does
  # not match an LF file, and the run then reports PROBE DID NOT APPLY - indistinguishable at a
  # glance from a test that does not work.
  return ([regex]::Escape($Literal) -replace '\\r\\n|\\n', '\r?\n')
}

function Invoke-Probe {
  param(
    [string]$Name,
    [string]$File,
    [string]$From,
    [string]$To,
    [string]$ExpectTest,
    [int]$MaxRed = 3,
    [string]$File2,
    [string]$From2,
    [string]$To2
  )

  # Two mutations in one probe, for the case where two guards mask each other: removing either
  # alone leaves the suite green because the other still refuses, so neither can be probed on
  # its own and a single-mutation probe would report the guard absent. Learned on the
  # divide-by-zero guard in `prize-shares.ts`.
  $files = @($File)
  $originals = @{ $File = (Read-File $File) }
  $mutated = [regex]::Replace($originals[$File], (Relaxed $From), { param($m) $To }, 1)
  if ($mutated -eq $originals[$File]) {
    Write-Host "[$Name] PROBE DID NOT APPLY - pattern not found in $File" -ForegroundColor Magenta
    return
  }
  $newText = @{ $File = $mutated }

  if ($File2) {
    if (-not $originals.ContainsKey($File2)) { $originals[$File2] = (Read-File $File2) }
    $base = if ($newText.ContainsKey($File2)) { $newText[$File2] } else { $originals[$File2] }
    $m2 = [regex]::Replace($base, (Relaxed $From2), { param($m) $To2 }, 1)
    if ($m2 -eq $base) {
      Write-Host "[$Name] PROBE DID NOT APPLY - second pattern not found in $File2" -ForegroundColor Magenta
      return
    }
    $newText[$File2] = $m2
    $files += $File2
  }

  try {
    foreach ($f in $newText.Keys) { Write-File $f $newText[$f] }

    $out = & npx vitest run $Suite -t "$ExpectTest" 2>&1 | Out-String
    $flat = ($out -replace '\s+', ' ')

    $failed = 0
    if ($flat -match 'Tests\s+(\d+)\s+failed') { $failed = [int]$Matches[1] }
    $ran = ($flat -match 'Tests\s+\d+')

    if (-not $ran) {
      Write-Host "[$Name] NO TEST RAN - '$ExpectTest' matches nothing in $Suite" -ForegroundColor Magenta
    } elseif ($failed -ge 1 -and $failed -le $MaxRed) {
      Write-Host "[$Name] RED ($failed failed) - '$ExpectTest'" -ForegroundColor Green
    } elseif ($failed -gt $MaxRed) {
      # A one-line change turning many tests red usually means the harness damaged the file
      # rather than that the guard is broad. Name them rather than counting them.
      Write-Host "[$Name] RED BUT BROADER THAN EXPECTED ($failed failed, expected <= $MaxRed)" -ForegroundColor Yellow
      ($flat | Select-String -Pattern '(?<=x )[^x]{10,120}' -AllMatches).Matches |
        ForEach-Object { $_.Value } | Select-Object -Unique |
        ForEach-Object { Write-Host "      $_" -ForegroundColor DarkYellow }
    } else {
      Write-Host "[$Name] GREEN - '$ExpectTest' did not fail. Guard absent, test weak, probe aimed wrong, or the mutation changes no observable." -ForegroundColor Red
    }
  } finally {
    foreach ($f in $originals.Keys) {
      Write-File $f $originals[$f]
      if ((Read-File $f) -ne $originals[$f]) { Write-Host "[$Name] RESTORE FAILED on $f" -ForegroundColor Red }
    }
  }
}

Write-Host "`n=== The gate: which scores are worth a prize ===`n" -ForegroundColor Cyan

# 1 - the world before this slice, and also what a later "simplification" looks like: the zero
#     rule hard-coded, so a title declaring that zero IS an achievement is ignored.
Invoke-Probe -Name '1 zero rule hard-coded again, title ignored' -File $Gate `
  -From '  if (score === 0 && participant.zeroIsValidResult !== true) return false;' `
  -To '  if (score === 0) return false;' `
  -ExpectTest 'admits a zero once the title says zero is a result'

# 2 - `=== false` instead of `!== true`. Reads as the stricter, more explicit spelling. It means
#     an ABSENT declaration - which is ~the whole catalogue - stops refusing zeros, so every
#     non-scorer in every existing contest becomes a winner. The exact inverse of the
#     `entryBlockThreshold` reading, and wrong in the expensive direction.
Invoke-Probe -Name '2 absent declaration read as permission (=== false)' -File $Gate `
  -From 'participant.zeroIsValidResult !== true' `
  -To 'participant.zeroIsValidResult === false' `
  -ExpectTest 'refuses a zero by default'

# 3 - THE PROBE THIS FILE EXISTS FOR. The bar compared with `>=` in both directions, which is
#     what the word "minimum" invites. On a lower-is-better game it refuses every finisher whose
#     time is under the bar - the best players in the contest - and pays the slowest.
#
#     Two tests go red and both are honest: the downward gate, and the preview's direction
#     agreement, because the sentence then describes something the gate no longer does.
Invoke-Probe -Name '3 bar compared upward in BOTH directions' -File $Gate `
  -From @'
    return participant.scoreDirection === "lower_is_better"
      ? score <= (bar as number)
      : score >= (bar as number);
'@ -To @'
    return score >= (bar as number);
'@ -ExpectTest 'applies a minimum DOWNWARD' -MaxRed 2

# 4 - the bar tested BEFORE the zero rule and returning early. With a bar of 0 on a points game
#     a score of exactly 0 clears the bar, so `zeroIsValidResult: false` is bypassed and every
#     non-scorer is paid. Ordering, not redundancy - and a diff moving two blocks reads as tidying.
Invoke-Probe -Name '4 bar checked before the zero rule' -File $Gate `
  -From '  if (score === 0 && participant.zeroIsValidResult !== true) return false;' `
  -To '' `
  -ExpectTest 'checks the bar AFTER the zero rule' -MaxRed 3

# 5 - the non-finite guard on the bar removed. A NaN bar makes both comparisons false, so EVERY
#     participant is refused and the entire pot goes to the unclaimed pool. Nothing is logged.
Invoke-Probe -Name '5 non-finite bar no longer ignored' -File $Gate `
  -From '  if (Number.isFinite(bar)) {' `
  -To '  if (bar !== undefined) {' `
  -ExpectTest 'ignores a non-finite bar' -MaxRed 2

Write-Host "`n=== The resolver: one read per contest ===`n" -ForegroundColor Cyan

# 6 - `??` instead of `=== true` on the zero flag. A `.lean()` read applies no schema defaults,
#     so a pre-migration row arrives as `undefined` - and now that the schema carries no default
#     either, that is every row nobody has configured. `??` then has to name the fallback twice
#     and the two copies drift.
Invoke-Probe -Name '6 zero flag read with ?? rather than === true' -File $Resolver `
  -From 'zeroIsValidResult: title.zeroIsValidResult === true,' `
  -To 'zeroIsValidResult: title.zeroIsValidResult ?? true,' `
  -ExpectTest 'answers the platform rule for a title that carries none of the fields' -MaxRed 2

# 7 - the stored-non-finite strip removed from the resolver. This is NOT redundant with probe 5:
#     the edge parser refuses a bad bar, and the gate ignores one, but a row written straight in
#     the database - or before the route existed - reaches settlement through here.
Invoke-Probe -Name '7 stored null bar passed straight through' -File $Resolver `
  -From @'
    minimumEligibleScore: Number.isFinite(title.minimumEligibleScore)
      ? title.minimumEligibleScore
      : undefined,
'@ -To @'
    minimumEligibleScore: title.minimumEligibleScore,
'@ -ExpectTest 'strips a stored non-finite bar' -MaxRed 2

# 8 - the resolver failing towards PAYING rather than towards the platform rule, for a title that
#     no longer exists. An operator deleting a catalogue row would then retroactively make every
#     zero-scoring entrant of a live contest a winner.
Invoke-Probe -Name '8 missing title defaults to paying zeros' -File $Resolver `
  -From @'
const PLATFORM_DEFAULT_RULES: ContestScoringRules = {
  direction: "higher_is_better",
  zeroIsValidResult: false,
  minimumEligibleScore: undefined,
};
'@ -To @'
const PLATFORM_DEFAULT_RULES: ContestScoringRules = {
  direction: "higher_is_better",
  zeroIsValidResult: true,
  minimumEligibleScore: undefined,
};
'@ -ExpectTest 'answers the platform rule for a missing title' -MaxRed 2

Write-Host "`n=== The sync must not own our fields ===`n" -ForegroundColor Cyan

# 9 - THE SECOND PROBE THIS FILE EXISTS FOR. The eligibility fields added to
#     `providerOwnedFields`, which is how a later reader would "tidy up" fields that sit beside
#     `scoreDirection` and look exactly like it. The operator's prize decision then survives
#     until the next catalogue pull and is silently reverted.
Invoke-Probe -Name '9 eligibility added to the sync allow-list' -File $Sync `
  -From '    scoreDirection: game.scoreDirection,' `
  -To @'
    scoreDirection: game.scoreDirection,
    zeroIsValidResult: false,
'@ -ExpectTest 'survives a catalogue sync' -MaxRed 3

# 9b - THE COPY THAT ACTUALLY RUNS. `catalogue.service.ts` exists twice and an operator's Sync
#      catalogue button runs the one in `apps/admin`, reached through that app's own `@` alias -
#      which no runtime assertion in the suite can see, because vitest aliases `@` to the
#      repository root. Adding the fields to the admin allow-list alone reverts every operator's
#      decision on the next sync with every behavioural test above still green. Only the
#      byte-for-byte comparison catches it.
Invoke-Probe -Name '9b eligibility added to the ADMIN allow-list only' `
  -File 'apps/admin/lib/services/game-providers/catalogue.service.ts' `
  -From '    scoreDirection: game.scoreDirection,' `
  -To @'
    scoreDirection: game.scoreDirection,
    zeroIsValidResult: false,
'@ -ExpectTest 'keeps all three out of BOTH copies of the sync allow-list' -MaxRed 2

# 10 - the fields accepted by the content editor, so a prize rule changes as a side effect of
#      fixing a typo in a tagline and the audit trail records a content edit.
Invoke-Probe -Name '10 eligibility editable through the content dialog' -File $Fields `
  -From '  ["minimumEligibleScore", "changed with the Prize eligibility control, which has its own audit line"],' `
  -To '' `
  -ExpectTest 'refuses a content save that carries one of them' -MaxRed 3

Write-Host "`n=== The edge parser ===`n" -ForegroundColor Cyan

# 11 - a bar of zero read as cleared. `!== null` collapsed to a truthiness test is one
#      character, reads as a tidy-up, and silently deletes a rule an operator deliberately set.
Invoke-Probe -Name '11 a bar of zero read as cleared' -File $Service `
  -From '  if (raw.minimumEligibleScore !== null) {' `
  -To '  if (raw.minimumEligibleScore) {' `
  -ExpectTest 'keeps a bar of zero rather than reading it as cleared' -MaxRed 2

# 12 - a NaN bar accepted and stored. `typeof === "number"` is true of `NaN`, so this is the
#      spelling that looks like a type check and is not one. Stored, the bar refuses every
#      participant in every future contest on that title and pays the whole pot to the
#      unclaimed pool.
Invoke-Probe -Name '12 non-finite bar accepted at the edge' -File $Service `
  -From '    if (!Number.isFinite(raw.minimumEligibleScore)) {' `
  -To '    if (typeof raw.minimumEligibleScore !== "number") {' `
  -ExpectTest 'refuses a non-finite bar instead of storing it' -MaxRed 2

# 13 - a missing zero flag defaulted rather than refused, so a malformed request silently
#      records a decision nobody took.
Invoke-Probe -Name '13 missing zero flag defaulted' -File $Service `
  -From '  if (typeof raw.zeroIsValidResult !== "boolean") {' `
  -To '  if (false) {' `
  -ExpectTest 'refuses a missing zero flag rather than defaulting it' -MaxRed 2

# 14 - clearing written as a stored value rather than `$unset`. A stored `null` satisfies "the
#      field is present" while meaning nothing, and every reader then has to guess - the
#      `entryBlockThreshold` distinction, and the reason the resolver needs probe 7's guard.
Invoke-Probe -Name '14 clearing stores null instead of $unset' -File $Service `
  -From '  if (input.minimumEligibleScore === null) unset.minimumEligibleScore = "";' `
  -To '  if (input.minimumEligibleScore === null) set.minimumEligibleScore = null;' `
  -ExpectTest 'so the field is absent rather than empty' -MaxRed 2

Write-Host "`n=== The route ===`n" -ForegroundColor Cyan

# 15 - the section guard downgraded to admin-at-all, so an employee granted one unrelated
#      section can move the bar deciding who is paid. Ninth-instance class: R40, R51, R57.
Invoke-Probe -Name '15 guard downgraded to admin-at-all' -File $Route `
  -From '  const guard = await guardSection("game-providers");' `
  -To '  const guard = { ok: true as const, admin: await verifyAdminToken() };' `
  -ExpectTest 'guards on the games section, not on admin-at-all' -MaxRed 3

# 16 - the audit line reduced to "scoring updated". An operator reconciling a contest that paid
#      nobody needs to know the bar was moved AND to what; a bare verb answers neither.
Invoke-Probe -Name '16 audit line no longer records the values' -File $Route `
  -From @'
      newValue: {
        zeroIsValidResult: result.zeroIsValidResult,
        minimumEligibleScore: result.minimumEligibleScore ?? null,
        scoreUnit: result.scoreUnit ?? null,
      },
'@ -To '' `
  -ExpectTest 'writes an audit line saying what the rule now is' -MaxRed 2

Write-Host "`n=== The preview must not drift from the gate ===`n" -ForegroundColor Cyan

# 17 - THE THIRD IMPORTANT ONE. The bar sentence written one way round for both directions, so a
#      lower-is-better title tells the operator "a score below 60000 wins nothing" while the gate
#      refuses everything ABOVE it. An operator sets a money rule from that sentence.
#
#      This is why the copy is asserted BEHAVIOURALLY against `providerHasResult` and not against
#      expected strings: a copy test would pass forever while the wording described the opposite
#      of what settlement does.
#      ANCHORED ON THE CONDITION, NOT ON THE SENTENCES. The first version of this probe quoted
#      both branches, which carry an em-dash, and reported PROBE DID NOT APPLY: this script is
#      UTF-8 with no BOM, PowerShell 5.1 decodes it with the system codepage, and the dash in the
#      pattern arrives as mojibake that cannot match the file. Keep probe anchors ASCII - a probe
#      that fails to apply is indistinguishable from a test that does not work.
#
#      Collapsing the condition to `false` gives BOTH directions the "below" wording, which is
#      the real defect: one sentence, written for the common case, left pointing the wrong way on
#      the games where it decides who is paid.
Invoke-Probe -Name '17 bar sentence points the wrong way downward' -File $Copy `
  -From '      input.scoreDirection === "lower_is_better"' `
  -To '      false' `
  -ExpectTest 'the bar sentence points the right way' -MaxRed 3

# 18 - the zero sentence inverted, so the screen promises payment the gate refuses. Five of the
#      matrix's zero-sentence cases go red, and every one is an honest second face of one rule.
Invoke-Probe -Name '18 zero sentence inverted' -File $Copy `
  -From '    input.zeroIsValidResult' `
  -To '    !input.zeroIsValidResult' `
  -ExpectTest 'the zero sentence matches the gate' -MaxRed 6

# 19 - the redistribution consequence dropped. It is the one thing an operator would never guess:
#      a refusal does not shrink the pot, it moves money to the other winners. Anchored on the
#      sentence's own final `lines.push(`, not the first one in the file - `lines.push(` appears
#      four times, and a leftmost-first replacement would silently disable the zero sentence and
#      report the wrong guard missing.
Invoke-Probe -Name '19 redistribution consequence dropped' -File $Copy `
  -From @'
  lines.push(
    "A player refused here keeps their place on the leaderboard; their prize is shared out among the players who did score.",
  );
'@ -To '' `
  -ExpectTest 'always says what happens to a refused player' -MaxRed 3

Write-Host "`n=== The screens ===`n" -ForegroundColor Cyan

# 20 - `?? ""` on the stored bar when the form loads. A configured bar of ZERO renders as an
#      empty box, so opening the dialog and pressing Save deletes it. Reads as a tidy-up of an
#      awkward two-clause guard.
Invoke-Probe -Name '20 stored zero rendered as an empty box' -File $Dialog `
  -From @'
    title.minimumEligibleScore === undefined || title.minimumEligibleScore === null
        ? ""
        : String(title.minimumEligibleScore),
'@ -To @'
    title.minimumEligibleScore ? String(title.minimumEligibleScore) : "",
'@ -ExpectTest 'distinguishes a stored zero from an absent bar' -MaxRed 2

# 21 - a hand-rolled sentence added beside the mapped preview lines, which is how the preview
#      starts drifting from the gate while still importing the module. The negative assertion is
#      the load-bearing half.
Invoke-Probe -Name '21 hand-rolled sentence beside the preview' -File $Dialog `
  -From '              {preview.map((line) => (' `
  -To @'
              <li>A score of exactly 0 wins nothing on this game.</li>
              {preview.map((line) => (
'@ -ExpectTest 'hand-rolls no line inside it' -MaxRed 2

# 22 - the row summary collapsing a bar of zero with no bar. This is the one screen an operator
#      uses to CHECK what they set, so a configured bar becoming invisible here is worse than it
#      being invisible anywhere else.
Invoke-Probe -Name '22 row summary hides a bar of zero' -File $List `
  -From '  if (bar !== undefined && bar !== null) {' `
  -To '  if (bar) {' `
  -ExpectTest 'summarises the rule and distinguishes a bar of zero' -MaxRed 2

# 23 - the merge given a `??` fallback, so clearing the bar leaves the row still claiming one.
#      Reads as defensive.
Invoke-Probe -Name '23 merge restores a bar that was just cleared' -File $List `
  -From '                      minimumEligibleScore: rules.minimumEligibleScore,' `
  -To '                      minimumEligibleScore: rules.minimumEligibleScore ?? row.minimumEligibleScore,' `
  -ExpectTest 'merges its answer without a fallback' -MaxRed 2

# 24 - the control gated on the provider's status, like the enable switch beside it. A deprecated
#      title keeps its history and its contest pages, so being unable to correct how it was run
#      is a real loss - and this is the guard whose FIRST version failed on correct code by
#      slicing to the end of the file and swallowing the enable switch's own legitimate
#      `disabled`. Locate the construct; do not scan past it.
Invoke-Probe -Name '24 control gated on provider status' -File $List `
  -From @'
                        onClick={() => setScoring(title)}
                      >
'@ -To @'
                        onClick={() => setScoring(title)}
                        disabled={title.providerStatus !== "active"}
                      >
'@ -ExpectTest 'offers the control at any provider status' -MaxRed 2

Write-Host "`n=== Settlement threads the rules in ===`n" -ForegroundColor Cyan

# 25 - the rules resolved and then not put on the rows, so the module falls back to the platform
#      rule for every participant and an operator's configuration is silently ignored. The
#      resolver still runs, so any test asserting only that it is CALLED stays green.
Invoke-Probe -Name '25 rules resolved but never threaded onto the rows' -File $Settlement `
  -From '      zeroIsValidResult: scoringRules.zeroIsValidResult,' `
  -To '' `
  -ExpectTest 'resolves the rules once and puts them on every row' -MaxRed 3

# 26 - the resolver called per participant instead of once per contest. R32/R33: a per-row read
#      lets two rows in one leaderboard disagree, and a half-negated board is incoherent rather
#      than merely wrong. It also multiplies a database read by the entrant count inside a
#      settlement transaction.
Invoke-Probe -Name '26 resolver called twice' -File $Settlement `
  -From '      zeroIsValidResult: scoringRules.zeroIsValidResult,' `
  -To '      zeroIsValidResult: (await resolveScoringRules(competition.gameKey)).zeroIsValidResult,' `
  -ExpectTest 'resolves the rules once and puts them on every row' -MaxRed 3

# 27 - the two settlement copies allowed to drift. `check:mirrors` compares MODELS, so it has
#      never had an opinion about this file, and R42 is the standing proof that a mirrored file
#      can be present, agreeing and unreachable. A text comparison is the only guard.
Invoke-Probe -Name '27 settlement copies drift' `
  -File 'apps/admin/lib/services/settlement/provider-settlement.service.ts' `
  -From '      zeroIsValidResult: scoringRules.zeroIsValidResult,' `
  -To '      zeroIsValidResult: false,' `
  -ExpectTest 'agree byte for byte' -MaxRed 3

Write-Host "`nAll probes complete. Every line above should read RED.`n" -ForegroundColor Cyan
