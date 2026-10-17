# Probe harness for X6.5 step A1 - the terminology layer.
#
# Each probe injects one defect, runs ONE named test, and expects it red. A probe that stays
# green has four known causes needing four different responses: a weak test, a wrong claim,
# an unreachable guard, or a mutation that changes no observable. Naming the expected test is
# what tells them apart - a bare "did the suite go red" reports a passing probe when the test
# it was aimed at does not exist.
#
# THE HARNESS RULES, every one of them learned by getting it wrong:
#   - -LiteralPath on the READ as well as the write. A path containing [brackets] is a
#     PowerShell wildcard, so Get-Content returns $null and Set-Content writes the file back
#     empty. It reports every probe red, on the expected test, for entirely the wrong reason.
#   - Refuse to write when the read came back empty.
#   - ASCII anchors only. PowerShell 5.1 decodes with the system codepage, so an em-dash or
#     an emoji in a pattern arrives as mojibake and reports PROBE DID NOT APPLY.
#   - Confirm the file actually changed before believing any outcome.
#   - No regex metacharacters in an expected test name. vitest treats -t as a regex, so a `$`
#     is an end-of-line anchor and the named test silently never runs.
#   - Collapse whitespace in captured output before matching. Out-String wraps at the console
#     width, so a long test name arrives split across two lines.
#
# ONE ADDITION TO THE USUAL SHAPE: -AlsoFile, for a mutation that must land in BOTH mirror
# copies. Almost every probe here edits `lib/constants/terminology.ts`, and the suite also
# asserts that file is byte-identical in apps/admin - so a one-sided edit turns the mirror
# test red as well, and every probe would report RED (x2) with the extra failure telling you
# nothing. Mirroring the edit isolates the intended failure, which is the whole point of
# naming an expected test.

$ErrorActionPreference = 'Continue'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$Suite = '__tests__/admin/terminology-tokens.test.ts'
$script:pass = 0
$script:fail = 0

function Relaxed([string]$literal) {
  [regex]::Escape($literal) -replace '\\r\\n|\\n', '\r?\n'
}

function Invoke-Probe {
  param(
    [string]$Name,
    [string]$File,
    [string]$From,
    [string]$To,
    # The same edit applied to the mirror copy - see the header note.
    [string]$AlsoFile,
    [string]$ExpectRed
  )

  $paths = @(Join-Path $root $File)
  if ($AlsoFile) { $paths += (Join-Path $root $AlsoFile) }

  $originals = @{}
  $pattern = Relaxed $From

  foreach ($path in $paths) {
    $original = [IO.File]::ReadAllText($path)
    if ([string]::IsNullOrEmpty($original)) {
      Write-Host "HARNESS BROKEN  $Name - read returned nothing for $path" -ForegroundColor Magenta
      $script:fail++
      return
    }
    if (-not [regex]::IsMatch($original, $pattern)) {
      Write-Host "DID NOT APPLY   $Name - pattern not found in $path" -ForegroundColor Magenta
      $script:fail++
      return
    }
    $originals[$path] = $original
  }

  try {
    foreach ($path in $paths) {
      # A MatchEvaluator, not a replacement string: `$` and `\` in the replacement are
      # otherwise substitution syntax.
      $mutated = [regex]::Replace($originals[$path], $pattern, { param($m) $To }, 1)
      if ($mutated -eq $originals[$path]) {
        Write-Host "DID NOT APPLY   $Name - replacement changed nothing in $path" -ForegroundColor Magenta
        $script:fail++
        return
      }
      [IO.File]::WriteAllText($path, $mutated, (New-Object Text.UTF8Encoding $false))
    }

    $out = & cmd.exe /c "npx vitest run $Suite -t `"$ExpectRed`" --reporter=basic 2>&1" | Out-String
    $flat = ($out -replace '\s+', ' ')

    if ($flat -match 'Tests\s+(\d+)\s+failed') {
      $count = [int]$Matches[1]
      if ($count -eq 1) {
        Write-Host "RED             $Name" -ForegroundColor Green
        $script:pass++
      } else {
        Write-Host "RED (x$count)      $Name - more than the expected test broke" -ForegroundColor Yellow
        $script:pass++
      }
    } elseif (
      $flat -match 'No test files found' -or
      $flat -match 'Tests\s+no tests' -or
      # THE ONE THAT COST A FALSE PASS ELSEWHERE. A -t pattern matching nothing is not an
      # error to vitest: it reports a passing run over zero tests, which is indistinguishable
      # from a real green without this branch.
      $flat -match 'Tests\s+0\s+passed' -or
      $flat -notmatch 'Tests\s+\d+\s+passed'
    ) {
      Write-Host "NO TEST RAN     $Name - '$ExpectRed' matched nothing" -ForegroundColor Magenta
      $script:fail++
    } else {
      Write-Host "GREEN           $Name - the guard is not doing its job" -ForegroundColor Red
      $script:fail++
    }
  } finally {
    foreach ($path in $paths) {
      if ($originals.ContainsKey($path)) {
        [IO.File]::WriteAllText($path, $originals[$path], (New-Object Text.UTF8Encoding $false))
      }
    }
  }
}

$CAT = 'lib/constants/terminology.ts'
$CAT_ADMIN = 'apps/admin/lib/constants/terminology.ts'
$SVC = 'lib/services/terminology.service.ts'
$SVC_ADMIN = 'apps/admin/lib/services/terminology.service.ts'
$MODEL = 'database/models/whitelabel.model.ts'
$MODEL_ADMIN = 'apps/admin/database/models/whitelabel.model.ts'

Write-Host "`n=== the defaults are the TARGET words ===" -ForegroundColor Cyan

# 1. THE DEFECT THAT WOULD MAKE THE WHOLE PASS A NO-OP. A default of "Trader" satisfies every
#    structural assertion about the catalogue while leaving every screen reading exactly what
#    it read before - the pass ships, the documents say it shipped, and nothing moved.
Invoke-Probe -Name '1  the player default left as Trader' -File $CAT -AlsoFile $CAT_ADMIN `
  -From '  player: "Player",' -To '  player: "Trader",' `
  -ExpectRed 'says Player, because installing this file is not meant to be a no-op'

# 2. "Competition" is already neutral, so the default must MATCH it and nothing should move.
#    Renaming it in the catalogue is a platform-wide wording change nobody asked for.
Invoke-Probe -Name '2  the contest default changed out from under every screen' -File $CAT -AlsoFile $CAT_ADMIN `
  -From '  contest: "Competition",' -To '  contest: "Tournament",' `
  -ExpectRed 'says Competition, because that word is already neutral'

# 3. The banned word. There is a `Challenge` model, `/challenges` routes, a `challengesEnabled`
#    flag and `challenge_entry` / `challenge_refund` ledger values.
Invoke-Probe -Name '3  Duel reintroduced as a default' -File $CAT -AlsoFile $CAT_ADMIN `
  -From '  challenge: "Challenge",' -To '  challenge: "Duel",' `
  -ExpectRed 'says Challenge and never Duel'

Write-Host "`n=== boundary 1 - no trading vocabulary is a token ===" -ForegroundColor Cyan

# 4. The consistency edit this boundary exists to refuse. Adding `position` reads as
#    completeness and hands an operator a settings box that breaks chapter 14 section 5's
#    guarantee that a trader cannot tell this programme happened.
Invoke-Probe -Name '4  a position token added on consistency grounds' -File $CAT -AlsoFile $CAT_ADMIN `
  -From '  score: "Score",' -To '  position: "Position",
  score: "Score",' `
  -ExpectRed 'does not declare a position token'

# 5. The same edit with the word that would do the most damage - the sidebar, the dropdown and
#    every trading screen read it.
Invoke-Probe -Name '5  a trader token added' -File $CAT -AlsoFile $CAT_ADMIN `
  -From '  player: "Player",' -To '  trader: "Trader",
  player: "Player",' `
  -ExpectRed 'does not declare a trader token'

Write-Host "`n=== boundary 2 - no credit or currency token ===" -ForegroundColor Cyan

# 6. A SECOND DEFINITION OF A MONEY LABEL. `AppSettings.credits.symbol` already owns this
#    through format-volts.ts, and the copy that drifts is the one in front of a player
#    deciding whether to pay.
Invoke-Probe -Name '6  a credits token added' -File $CAT -AlsoFile $CAT_ADMIN `
  -From '  prize: "Prize",' -To '  credits: "Credits",
  prize: "Prize",' `
  -ExpectRed 'does not declare a credits token'

# 7. The POSITIVE half. Without it, "no money tokens" is satisfied by a catalogue that also
#    dropped the headings - at which point the pass cannot rename "Entry Fee" at all.
Invoke-Probe -Name '7  the money LABELS dropped along with the money tokens' -File $CAT -AlsoFile $CAT_ADMIN `
  -From '  entryFee: "Entry Fee",' -To '' `
  -ExpectRed 'keeps the money LABELS'

# 8. The catalogue reaching for the formatter, which is how the second definition arrives
#    without anybody adding a token.
Invoke-Probe -Name '8  the catalogue reaches for the credit formatter' -File $CAT -AlsoFile $CAT_ADMIN `
  -From 'export const TERMS = {' -To 'import { formatVolts } from "@/lib/utils/format-volts";

export const TERMS = {' `
  -ExpectRed 'does not reach for the credit formatter or the value resolver'

Write-Host "`n=== boundary 3 - nothing here is an identifier ===" -ForegroundColor Cyan

# 9. A stored key put into the dictionary. Renaming THIS reaches a ledger row, and `gameKey`
#    is immutable, so the damage is unrecoverable rather than a wrong screen (R13).
Invoke-Probe -Name '9  a ledger enum smuggled in as a default' -File $CAT -AlsoFile $CAT_ADMIN `
  -From '  entryFee: "Entry Fee",' -To '  entryFee: "competition_entry",' `
  -ExpectRed 'declares no token whose default LOOKS like an identifier'

# 10. A route named in the catalogue in a CODE position - the tell that somebody has started
#     treating a stored path as part of the display vocabulary.
#
#     RE-AIMED. The first version put `/api/competitions/` in a COMMENT and came back green,
#     because the test strips comments before matching - correctly, since a catalogue that
#     EXPLAINS why a route must never be renamed has to be allowed to name it. That green was the
#     fourth cause, a mutation with no observable, NOT a missing guard. The claim the test makes
#     is about code, so that is where the defect has to go.
Invoke-Probe -Name '10 a route named in the catalogue' -File $CAT -AlsoFile $CAT_ADMIN `
  -From 'export type TerminologyToken = keyof typeof TERMS;' `
  -To 'export const CONTEST_ROUTE = "/api/competitions";

export type TerminologyToken = keyof typeof TERMS;' `
  -ExpectRed 'names no route, no ledger enum, no model and no gameKey'

Write-Host "`n=== boundary 4 - singular and plural are separate ===" -ForegroundColor Cyan

# 11. A plural token dropped, so a screen wanting the plural either derives one or hard-codes
#     it - and a hard-coded plural is a word an operator cannot rename.
Invoke-Probe -Name '11 a plural token dropped' -File $CAT -AlsoFile $CAT_ADMIN `
  -From '  players: "Players",' -To '' `
  -ExpectRed 'declares player and players independently'

# 12. STRING SURGERY ON A CONFIGURED WORD. `replace(/s$/, "")` on a value an operator typed is
#     the mistake the credit-symbol work had to remove.
Invoke-Probe -Name '12 a plural derived by stripping an s' -File $CAT -AlsoFile $CAT_ADMIN `
  -From '    pack[token] = trimmed;' -To '    pack[token] = trimmed.replace(/s$/, "");' `
  -ExpectRed 'runs no string surgery on a configured word'

Write-Host "`n=== resolveTerms ===" -ForegroundColor Cyan

# 13. A BLANK TAKEN LITERALLY. This is what a cleared input, a half-run migration or a bad
#     edit leaves behind, and taking it at face value renders a heading with a word missing
#     out of the middle of it.
#
#     THREE FAILURES HERE ARE HONEST, not blast radius: the assertion is an `it.each` over the
#     three blank shapes ("", spaces, tabs and newlines), so -t matches all three cases of one
#     rule. Counting failures is how a probe harness spots damage it caused itself, so the
#     distinction between "three faces of one rule" and "three unrelated rules" has to be
#     checked rather than assumed - the shape that once emptied a route file reported five.
Invoke-Probe -Name '13 a blank override taken literally' -File $CAT -AlsoFile $CAT_ADMIN `
  -From '    if (!trimmed) continue;' -To '' `
  -ExpectRed 'treats a blank override'

# 14. No trim, so a word an operator typed with a trailing space renders with it.
Invoke-Probe -Name '14 the override not trimmed' -File $CAT -AlsoFile $CAT_ADMIN `
  -From '    const trimmed = value.trim();' -To '    const trimmed = value;' `
  -ExpectRed 'trims a configured word'

# 15. REFUSING ON THE READ PATH. This runs on every render of every screen, so a stored key
#     that is no longer a token would take a page down months after the catalogue was trimmed.
Invoke-Probe -Name '15 an unrecognised key throws on the read path' -File $CAT -AlsoFile $CAT_ADMIN `
  -From '    if (!isTerminologyToken(token)) continue;' `
  -To '    if (!isTerminologyToken(token)) throw new Error(`Unknown token ${token}`);' `
  -ExpectRed 'IGNORES an unrecognised key rather than refusing'

# 16. A non-string value reaching the pack, so a number renders where a word should.
Invoke-Probe -Name '16 a non-string override accepted' -File $CAT -AlsoFile $CAT_ADMIN `
  -From '    if (typeof value !== "string") continue;' -To '' `
  -ExpectRed 'ignores a non-string value'

# 17. THE PROTOTYPE CHAIN. `token in TERMS` admits "constructor" and "__proto__", and
#     `TERMS["__proto__"]` returns a truthy Object.prototype that survives a `!value` test
#     before failing somewhere unrelated. Fifth instance in this codebase.
Invoke-Probe -Name '17 the Set swapped for an object lookup' -File $CAT -AlsoFile $CAT_ADMIN `
  -From 'export function isTerminologyToken(token: string): token is TerminologyToken {
  return TOKEN_NAMES.has(token);
}' `
  -To 'export function isTerminologyToken(token: string): token is TerminologyToken {
  return token in TERMS;
}' `
  -ExpectRed 'does not admit __proto__, which an object lookup would'

Write-Host "`n=== validateTerminologyOverrides ===" -ForegroundColor Cyan

# 18. DROPPING INSTEAD OF REFUSING. The save appears to succeed while doing nothing and the
#     operator concludes they misclicked - the failure mode this codebase keeps finding.
Invoke-Probe -Name '18 an unknown token dropped instead of refused' -File $SVC -AlsoFile $SVC_ADMIN `
  -From '    if (!isTerminologyToken(key)) {
      return {
        ok: false,
        error: `"${key}" is not a terminology token. Known tokens: ${Object.keys(TERMS).join(", ")}.`,
      };
    }' `
  -To '    if (!isTerminologyToken(key)) continue;' `
  -ExpectRed 'REFUSES an unknown token and names it'

# 19. A blank stored as "" rather than recorded as a clear. A stored empty string has to be
#     reinterpreted on every read, and a reinterpreted value is indistinguishable from an
#     operator who meant it.
Invoke-Probe -Name '19 a cleared field stored as an empty string' -File $SVC -AlsoFile $SVC_ADMIN `
  -From '    const trimmed = value.trim();
    overrides[key] = trimmed === "" ? undefined : trimmed;' `
  -To '    overrides[key] = value.trim();' `
  -ExpectRed 'records a blank as a CLEAR'

# 20. An array is an object as far as typeof is concerned, so without the explicit check it
#     walks the indices and refuses on "0" - the right OUTCOME by accident, with a message
#     naming a token the operator never typed.
#
#     THE TEST WAS TIGHTENED FOR THIS ONE. Asserting `ok: false` alone came back green, because
#     both spellings refuse: a numeric index is never a token. The only observable difference is
#     the sentence an operator reads, so the assertion had to move onto the message. Weak test,
#     not a wrong claim and not an unreachable guard.
Invoke-Probe -Name '20 an array accepted as an override payload' -File $SVC -AlsoFile $SVC_ADMIN `
  -From '  if (typeof input !== "object" || Array.isArray(input)) {' `
  -To '  if (typeof input !== "object") {' `
  -ExpectRed 'refuses an array AS an array, not as a token named 0'

Write-Host "`n=== the schema and the catalogue agree ===" -ForegroundColor Cyan

# 21. A TOKEN THE SCHEMA DOES NOT DECLARE IS DISCARDED BY STRICT MODE ON WRITE, silently,
#     while the operator's save reports success. check:mirrors cannot see this - both copies
#     would be equally wrong.
Invoke-Probe -Name '21 a token missing from the main model schema' -File $MODEL `
  -From '      leaderboard: { type: String, trim: true },' -To '' `
  -ExpectRed 'database/models/whitelabel.model.ts declares every token'

# 22. The ADMIN copy, which is the schema that runs when an operator saves from the settings
#     screen.
Invoke-Probe -Name '22 a token missing from the admin model schema' -File $MODEL_ADMIN `
  -From '      leaderboard: { type: String, trim: true },' -To '' `
  -ExpectRed 'apps/admin/database/models/whitelabel.model.ts declares every token'

# 23. THE OTHER DIRECTION. A path left behind after a token is retired is a stored value
#     nothing reads - so it looks configured on the settings screen and has no effect
#     anywhere. The "declares every token" half is green against this.
Invoke-Probe -Name '23 a schema path the catalogue does not declare' -File $MODEL `
  -From '      points: { type: String, trim: true },' -To '      points: { type: String, trim: true },
      pnl: { type: String, trim: true },' `
  -ExpectRed 'declares NOTHING the catalogue does not'

# 24. A default on a token path stores a real empty string on every row, which then has to be
#     reinterpreted on every read.
Invoke-Probe -Name '24 a default on a token path' -File $MODEL `
  -From '      rank: { type: String, trim: true },' -To '      rank: { type: String, trim: true, default: "" },' `
  -ExpectRed 'stores no default on any token path'

Write-Host "`n=== the two mirrors ===" -ForegroundColor Cyan

# 25. The catalogue copies drift by one word, so one app's default is the other's. The admin
#     copy is the one an operator's save runs through.
Invoke-Probe -Name '25 the catalogue mirror drifts' -File $CAT_ADMIN `
  -From '  leaderboard: "Leaderboard",' -To '  leaderboard: "Rankings",' `
  -ExpectRed 'lib/constants/terminology.ts is byte-identical in apps/admin'

# 26. The service copies drift on the validator, so one app refuses what the other stores.
Invoke-Probe -Name '26 the service mirror drifts' -File $SVC_ADMIN `
  -From '  if (input === null || input === undefined) {' -To '  if (input == null) {' `
  -ExpectRed 'lib/services/terminology.service.ts is byte-identical in apps/admin'

# 27. R58 - THE ADMIN PANEL WAS DOWN FOR EXACTLY THIS. A `"use client"` file may not name a
#     driver-reaching module in a value-import position, and the catalogue is imported by the
#     browser through AppSettingsProvider. The typecheck cannot see it, nor can a dev server.
Invoke-Probe -Name '27 the catalogue imports a Mongoose model' -File $CAT -AlsoFile $CAT_ADMIN `
  -From 'export const TERMS = {' -To 'import { WhiteLabel } from "@/database/models/whitelabel.model";

export const TERMS = {' `
  -ExpectRed 'keeps the catalogue MODEL-FREE'

# 28. The projection dropped. `WhiteLabel` is one fat settings document, so an unprojected
#     findOne on a path that runs on every screen transfers every branding URL and every
#     price-feed setting with it.
Invoke-Probe -Name '28 the settings read loses its projection' -File $SVC -AlsoFile $SVC_ADMIN `
  -From '      .select("terminologyOverrides")
' -To '' `
  -ExpectRed 'keeps the database read OUT of the catalogue and IN the service'

Write-Host ""
Write-Host "red: $($script:pass)   green or broken: $($script:fail)" -ForegroundColor Cyan
if ($script:fail -gt 0) { exit 1 }
