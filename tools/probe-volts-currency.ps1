# Probes for __tests__/admin/volts-currency.test.ts
#
# THE DEFECT THIS GUARDS. Entry fees, prize pools, prizes and refunds are credits. Around forty
# render sites prefixed them with `settings.currency.symbol`, the FIAT symbol configured for
# deposits and invoices, so a 50-credit entry fee read `EUR 50`. Two landing routes were worse,
# each carrying a private `formatCurrency` hard-coded to `$`.
#
# Every amount was correct and only its unit was a lie - no error, no log line, and the figure
# reconciles perfectly against the ledger. That is why forty sites survived, and it is why the
# guards here are structural rather than behavioural: there is no wrong number to assert on.
#
# Harness rules are the ones every earlier probe file here learned the hard way: read and write
# through [System.IO.File] with UTF-8 and no BOM, refuse to write when the read came back empty,
# confirm the replacement actually changed the file, and run the expected test ALONE with `-t`
# reading the summary counts - searching whole-suite output for a name finds it either way.
#
# One rule specific to this file: every multi-line pattern is a here-string. Written inline in
# single quotes the parser mis-terminated them and reported the error several probes further
# down, which reads exactly like a broken probe rather than a quoting mistake.

$ErrorActionPreference = 'Continue'
$Root = Split-Path -Parent $PSScriptRoot
$Utf8 = New-Object System.Text.UTF8Encoding $false
$Suite = '__tests__/admin/volts-currency.test.ts'

function Read-File([string]$Rel) {
  $text = [System.IO.File]::ReadAllText((Join-Path $Root $Rel), $Utf8)
  if ([string]::IsNullOrEmpty($text)) { throw "PROBE ABORT: read $Rel came back empty" }
  return $text
}

function Write-File([string]$Rel, [string]$Text) {
  if ([string]::IsNullOrEmpty($Text)) { throw "PROBE ABORT: refusing to write empty $Rel" }
  [System.IO.File]::WriteAllText((Join-Path $Root $Rel), $Text, $Utf8)
}

function Relaxed([string]$Literal) {
  return ([regex]::Escape($Literal) -replace '\\r\\n|\\n', '\r?\n')
}

function Invoke-Probe {
  param(
    [string]$Name,
    [string]$File,
    [string]$From,
    [string]$To,
    [string]$ExpectTest,
    [int]$MaxRed = 3
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

    if ($failed -ge 1 -and $failed -le $MaxRed) {
      Write-Host "[$Name] RED ($failed failed) - '$ExpectTest'" -ForegroundColor Green
    } elseif ($failed -gt $MaxRed) {
      # A one-line change turning many tests red usually means the harness damaged the file
      # rather than that the guard is broad. The honest number here is 1 or 2.
      Write-Host "[$Name] RED BUT TOO BROAD ($failed failed, expected <= $MaxRed) - check the file survived" -ForegroundColor Yellow
    } else {
      Write-Host "[$Name] GREEN - '$ExpectTest' did not fail. Guard absent, test weak, or probe aimed wrong." -ForegroundColor Red
      Write-Host $flat
    }
  } finally {
    Write-File $File $original
    if ((Read-File $File) -ne $original) { Write-Host "[$Name] RESTORE FAILED" -ForegroundColor Red }
  }
}

$Formatter = 'lib/utils/format-volts.ts'
$Vocabulary = 'apps/admin/lib/admin/ai-contest-vocabulary.ts'

Write-Host "`n=== Probing the formatter itself ===`n" -ForegroundColor Cyan

# 1 - the singular. `1 Volts` on an entry fee of one, which is an ordinary amount rather than
#     an edge case, so this is the cheapest real regression available.
Invoke-Probe -Name '1 singular dropped' -File $Formatter `
  -From @'
  const unit = options.unit?.trim() || DEFAULT_VOLTS_UNIT;
  return `${formatted} ${amount === 1 ? singularise(unit) : unit}`;
'@ -To @'
  const unit = options.unit?.trim() || DEFAULT_VOLTS_UNIT;
  return `${formatted} ${unit}`;
'@ -ExpectTest 'singularises exactly one'

# 2 - an absent amount rendered as a zero. Same rule as R45's unheld rank and R50's phantom
#     score: a missing amount and a zero amount are different facts. `NaN` is the one that
#     matters, being one `parseFloat` away on every admin form.
Invoke-Probe -Name '2 absent amount becomes zero' -File $Formatter `
  -From @'
  if (typeof amount !== "number" || !Number.isFinite(amount)) {
    return NO_AMOUNT;
  }

  const formatted = formatAmount(amount);
'@ -To @'
  if (typeof amount !== "number" || !Number.isFinite(amount)) {
    amount = 0;
  }

  const formatted = formatAmount(amount);
'@ -ExpectTest 'renders a dash for an absent amount, never a zero'

# 3 - two decimals on everything. `50.00 Volts` on a lobby hero is the tidy-looking choice.
Invoke-Probe -Name '3 decimals on a whole amount' -File $Formatter `
  -From '  const isWhole = Number.isInteger(amount);' `
  -To '  const isWhole = false;' `
  -ExpectTest 'carries no decimals on a whole amount and two on a fraction'

# 4 - the configured unit ignored. Reads correctly and silently overrides an operator who
#     renamed the unit, on every screen at once.
Invoke-Probe -Name '4 configured unit ignored' -File $Formatter `
  -From @'
  const unit = options.unit?.trim() || DEFAULT_VOLTS_UNIT;
  return `${formatted} ${amount === 1 ? singularise(unit) : unit}`;
'@ -To @'
  const unit = DEFAULT_VOLTS_UNIT;
  return `${formatted} ${amount === 1 ? singularise(unit) : unit}`;
'@ -ExpectTest "takes the operator's configured unit name"

# 5 - a blank configured name taken literally. An operator who clears the field, or a settings
#     read that has not resolved, then gets `50 ` with no unit at all.
Invoke-Probe -Name '5 blank unit taken literally' -File $Formatter `
  -From @'
  const unit = options.unit?.trim() || DEFAULT_VOLTS_UNIT;
  return `${formatted} ${amount === 1 ? singularise(unit) : unit}`;
'@ -To @'
  const unit = options.unit ?? DEFAULT_VOLTS_UNIT;
  return `${formatted} ${amount === 1 ? singularise(unit) : unit}`;
'@ -ExpectTest 'falls back to the default when the configured name is blank'

# 6 - the thousands separator. A four-figure prize pool is the normal case, not a large one.
Invoke-Probe -Name '6 thousands separator dropped' -File $Formatter `
  -From @'
  const isWhole = Number.isInteger(amount);
  return amount.toLocaleString("en-US", {
    minimumFractionDigits: isWhole ? 0 : 2,
    maximumFractionDigits: isWhole ? 0 : 2,
  });
'@ -To @'
  const isWhole = Number.isInteger(amount);
  return amount.toFixed(isWhole ? 0 : 2);
'@ -ExpectTest 'separates thousands, because a prize pool is often four figures'

# 7 - conversion smuggled back in. The reason this matters is that the platform stores what a
#     credit is worth TWICE and the two defaults disagree by a factor of a hundred, so a
#     formatter that can convert is a formatter that can quietly pick the wrong rate.
Invoke-Probe -Name '7 a conversion rate reintroduced' -File $Formatter `
  -From @'
  const formatted = formatAmount(amount);
  if (options.bare) return formatted;
'@ -To @'
  const valueInEUR = 1;
  const formatted = formatAmount(amount * valueInEUR);
  if (options.bare) return formatted;
'@ -ExpectTest 'never converts to a national currency'

# 8 - the mirror. `check:mirrors` compares models and has no opinion about this file, so a
#     text comparison is the only thing standing between the two apps and a drifted formatter.
Invoke-Probe -Name '8 admin mirror drifted' -File 'apps/admin/lib/utils/format-volts.ts' `
  -From 'export const DEFAULT_VOLTS_UNIT = "Volts";' `
  -To 'export const DEFAULT_VOLTS_UNIT = "Credits";' `
  -ExpectTest 'the admin copy is identical'

# 9 - the compact form's singular. This one is here because the FIRST draft of the module was
#     wrong in exactly this way: a comment asserted an abbreviated amount is never exactly one,
#     which is false below 1000, where nothing is abbreviated.
Invoke-Probe -Name '9 compact singular dropped' -File $Formatter `
  -From @'
  if (options.bare) return magnitude;

  const unit = options.unit?.trim() || DEFAULT_VOLTS_UNIT;
  return `${magnitude} ${amount === 1 ? singularise(unit) : unit}`;
'@ -To @'
  if (options.bare) return magnitude;

  const unit = options.unit?.trim() || DEFAULT_VOLTS_UNIT;
  return `${magnitude} ${unit}`;
'@ -ExpectTest 'still singularises one'

Write-Host "`n=== Probing the render sites ===`n" -ForegroundColor Cyan

# 10 - the shared prize table's prop reverted. Both lobbies render this component, so one
#      revert here is two wrong screens from one edit.
Invoke-Probe -Name '10 the prize table prop renamed back' -File 'components/competitions/PrizeTable.tsx' `
  -From @'
export default function PrizeTable({
  competition,
  unit,
}: {
'@ -To @'
export default function PrizeTable({
  competition,
  currSymbol,
}: {
'@ -ExpectTest 'its prop is named for what it now carries'

# 11 - a card reaching for `currency.symbol` again. Aimed at a DIFFERENT test from probe 10 on
#      purpose: one asserts the prop's name, the other that no contest screen reads the fiat
#      symbol at all, and a half-done sweep satisfies whichever one you only wrote.
#
#      Two earlier aims failed for reasons worth recording, because both read exactly like a
#      missing guard. Aimed at `ProviderContestLobby` it reported DID NOT APPLY - that component
#      takes `unit` as a prop and never reads settings, so there was no fiat read to restore.
#      Aimed at the contest PAGE it reported GREEN with nothing having run, because vitest's
#      `-t` is a REGEX and the test's name is the file path: `(root)` is a capture group and
#      `[id]` is a character class, so the filter matched no test at all.
Invoke-Probe -Name '11 a card reads currency.symbol again' -File 'components/trading/CompetitionCard.tsx' `
  -From 'formatVolts(getPrizePool(), { unit: settings?.credits?.name })' `
  -To 'formatVolts(getPrizePool(), { unit: settings?.currency?.symbol })' `
  -ExpectTest 'components/trading/CompetitionCard.tsx'

# 12 - a hard-coded symbol, which is the half a `currency.symbol` check cannot see. This is
#      what the two landing routes actually did.
Invoke-Probe -Name '12 a hard-coded dollar sign' -File 'components/trading/CompetitionCard.tsx' `
  -From 'formatVolts(getEntryFee(), { unit: settings?.credits?.name })' `
  -To '"$" + getEntryFee()' `
  -ExpectTest 'no contest screen hard-codes a currency symbol either'

# 13 - ONE of a landing route's two amounts reverted, the other left correct.
#
#      THIS PROBE CAME BACK GREEN FIRST TIME and the test was the weak one, not the claim. The
#      assertion was `toContain("formatVoltsCompact")`, satisfied by the surviving import line
#      while a real amount had gone back to the private helper - an import is not a use, the
#      fourth time that has defeated a structural test here. Fixed by counting the call sites.
Invoke-Probe -Name '13 one landing amount reverted to the private helper' -File 'app/api/landing/stats/route.ts' `
  -From 'activePrizePool: formatVoltsCompact(activePrizePool[0]?.total || 0),' `
  -To 'activePrizePool: formatCurrency(activePrizePool[0]?.total || 0),' `
  -ExpectTest 'formats every amount through it'

# 13b - and the other half of the same claim: the helper reappearing in the file. Needs its own
#       probe because the counting assertion above is green on a file that both calls the
#       shared formatter twice AND declares a private one for something else.
Invoke-Probe -Name '13b the private formatter declared again' -File 'app/api/landing/stats/route.ts' `
  -From 'function formatNumber(num: number): string {' `
  -To 'function formatCurrency(n: number): string { return "$" + n; }

function formatNumber(num: number): string {' `
  -ExpectTest 'carries no formatter of its own'

Write-Host "`n=== Probing the two-units boundary ===`n" -ForegroundColor Cyan

# 14 - the sweep "finished" on the ranking panel. This is the mirror-image probe, and the one
#      most likely to be missed: relabelling the ranking metric as Volts is not a completion,
#      it is a NEW lie, because that figure is simulated trading capital rather than credits.
#
#      THIS PROBE CAME BACK GREEN FIRST TIME against a bare `toMatch(/currSymbol/)`, because
#      renaming the declaration leaves the name on the prop, the parameter and the type. It now
#      mutates one of the two metric formatters, which is the thing the claim is actually about.
Invoke-Probe -Name '14 the ranking metric relabelled as credits' -File 'components/trading/LiveRankingPanel.tsx' `
  -From 'return `${currSymbol}${Math.abs(value).toFixed(0)}`;' `
  -To 'return formatVolts(Math.abs(value), { unit });' `
  -ExpectTest 'still writes the metric in its own symbol'

# 14b - the same mutation on the sibling panel. Two files, one rule, and a test written over
#       either alone is green on the other.
Invoke-Probe -Name '14b the sibling panel relabelled too' -File 'components/trading/GameLiveRankingPanel.tsx' `
  -From 'return `${currSymbol}${Math.abs(value).toFixed(0)}`;' `
  -To 'return formatVolts(Math.abs(value), { unit });' `
  -ExpectTest 'still writes the metric in its own symbol'

# 15 - and the forward direction on the same file: the pool reverting while the metric stays
#      right. Both halves need their own probe or one covers for the other.
Invoke-Probe -Name '15 the prize pool reverted, metric untouched' -File 'components/trading/LiveRankingPanel.tsx' `
  -From '{formatVolts(prizePool, { unit })}' `
  -To '{prizePool.toLocaleString()}' `
  -ExpectTest 'components/trading/LiveRankingPanel.tsx writes the prize pool and the reward in Volts'

Write-Host "`n=== Probing the strings the server composes ===`n" -ForegroundColor Cyan

# THE EURO SIGN IS BUILT FROM A CHAR CODE, NEVER WRITTEN AS A LITERAL.
#
# PowerShell 5.1 decodes a .ps1 with the system ANSI codepage, so a euro sign typed into this file
# arrives as mojibake - and the harness would then write that mojibake into the source file it
# is probing, restore it faithfully, and report a red probe for entirely the wrong reason. The
# same trap corrupted the emoji in the settlement services during R26.
$Euro = [string][char]0x20AC

# 19 - the shipped defect, verbatim, on the one place the wrong unit reached a player by email
#      as well as on screen: a winner told their prize in euros.
Invoke-Probe -Name '19 a prize notification reverted to euros' -File 'lib/services/notification.service.ts' `
  -From 'prize: formatVolts(prize),' `
  -To ('prize: `' + $Euro + '${prize.toFixed(2)}`,') `
  -ExpectTest 'lib/services/notification.service.ts'

# 19b - the positive half. A notification that stops naming the amount at all satisfies the
#       negative assertion perfectly, so the count of formatted prizes is asserted separately.
Invoke-Probe -Name '19b a prize notification stops naming the amount' -File 'lib/services/notification.service.ts' `
  -From 'prize: formatVolts(prize),' `
  -To 'prize: "your prize",' `
  -ExpectTest 'the prize notifications go through the formatter'

# 20 - the refund notification. Its own test, because it is the sentence a player reads at the
#      one moment they are most likely to check the number: a contest cancelled under them.
Invoke-Probe -Name '20 the refund notification reverted' -File 'apps/admin/lib/actions/trading/competition-cancel.actions.ts' `
  -From 'Your full entry fee of ${formatVolts(entryFee)} has been refunded.' `
  -To ('Your full entry fee of ' + $Euro + '${entryFee.toFixed(2)} has been refunded.') `
  -ExpectTest 'the refund notification names what the player actually gets back'

# 21 - the settlement reconciliation lines. Operator-facing rather than player-facing, and the
#      mirrored copy is probed rather than the main one, because a defect reintroduced on the
#      side nobody reads is the one that survives.
Invoke-Probe -Name '21 the admin settlement log reverted' -File 'apps/admin/lib/services/settlement/fees.service.ts' `
  -From '`   NET platform fee:   ${formatVolts(netPlatformFee)}`' `
  -To ('`   NET platform fee:   ' + $Euro + '${netPlatformFee.toFixed(2)}`') `
  -ExpectTest 'apps/admin/lib/services/settlement/fees.service.ts'

# 22 - the deposit carve-out, from the other direction. This file also composes deposit and
#      withdrawal strings where the euro sign is CORRECT, so the guard is scoped to lines
#      mentioning contest money. A probe adding a fiat deposit line must stay GREEN, and that
#      is the whole point of it - a guard that fires on correct code gets deleted.
$Notif = 'lib/services/notification.service.ts'
$DepositLine = @'
  async probeDepositLine(amount: number) {
    return this.send({ userId: "x", templateId: "deposit", variables: { amount: `EURO_SIGN${amount.toFixed(2)}` } });
  }

  async notifyCompetitionWon(
'@ -replace 'EURO_SIGN', $Euro
$orig = Read-File $Notif
$mut = [regex]::Replace($orig, (Relaxed "  async notifyCompetitionWon(`r`n"), { param($m) $DepositLine }, 1)
if ($mut -eq $orig) {
  Write-Host '[22 control: a legitimate fiat deposit line] PROBE DID NOT APPLY' -ForegroundColor Magenta
} else {
  try {
    Write-File $Notif $mut
    $out = & npx vitest run $Suite -t 'lib/services/notification.service.ts' 2>&1 | Out-String
    $flat = ($out -replace '\s+', ' ')
    $failed = 0
    if ($flat -match 'Tests\s+(\d+)\s+failed') { $failed = [int]$Matches[1] }
    if ($failed -eq 0) {
      Write-Host '[22 control: a legitimate fiat deposit line] GREEN as intended - the guard does not fire on correct code' -ForegroundColor Green
    } else {
      Write-Host "[22 control: a legitimate fiat deposit line] RED ($failed failed) - the guard is too broad and will be deleted by the first person it inconveniences" -ForegroundColor Red
    }
  } finally {
    Write-File $Notif $orig
    if ((Read-File $Notif) -ne $orig) { Write-Host '[22] RESTORE FAILED' -ForegroundColor Red }
  }
}

Write-Host "`n=== Probing the pre-formatting guard ===`n" -ForegroundColor Cyan

# 23 - the defect verbatim, on one of the three sites the admin typecheck could NOT see, since
#      that page's challenge object is loosely typed and `?.toLocaleString()` widens to `any`.
#      A probe on one of the two the compiler did catch would prove nothing this test owns.
Invoke-Probe -Name '23 a caller pre-formats with toLocaleString' -File 'apps/admin/app/challenges/view/[id]/page.tsx' `
  -From 'formatVolts(challenge.prizePool, { unit })' `
  -To 'formatVolts(challenge.prizePool?.toLocaleString(), { unit })' `
  -ExpectTest 'no call site hands it a string'

# 23b - the behavioural half. Without it the scan is a rule whose cost nobody can see, and the
#       first person it inconveniences deletes it. Probed by making the formatter accept a
#       string, which is the "fix" somebody reaches for when the scan blocks them.
Invoke-Probe -Name '23b the formatter starts accepting a string' -File $Formatter `
  -From @'
  if (typeof amount !== "number" || !Number.isFinite(amount)) {
    return NO_AMOUNT;
  }

  const formatted = formatAmount(amount);
'@ -To @'
  if (typeof amount === "string") {
    return `${amount} ${DEFAULT_VOLTS_UNIT}`;
  }
  if (typeof amount !== "number" || !Number.isFinite(amount)) {
    return NO_AMOUNT;
  }

  const formatted = formatAmount(amount);
'@ -ExpectTest 'a pre-formatted amount really does render as a dash'

Write-Host "`n=== Probing the assistant ===`n" -ForegroundColor Cyan

# 16 - the rule dropped from the provider prompt only. Trading's keeps it, so an assertion
#      written over either prompt alone is green here.
Invoke-Probe -Name '16 rule dropped from the provider prompt' -File $Vocabulary `
  -From 'the operator sets those${NO_FIAT_RULE}`;' `
  -To 'the operator sets those`;' `
  -ExpectTest 'the rule reaches both prompts'

# 17 - the rule naming the unit. Reads as an improvement and is wrong the day an operator
#      renames the unit, because the prompt is the one place that cannot read settings.
Invoke-Probe -Name '17 the rule hard-codes the unit name' -File $Vocabulary `
  -From 'prizes are denominated in platform credits' `
  -To 'prizes are denominated in Volts' `
  -ExpectTest 'the rule forbids the symbol without naming the unit'

# 18 - trading's prompt gaining something other than the shared rule. The composition assertion
#      is what makes the guarantee "the historical string PLUS one rule" rather than "contains
#      an old sentence" - a `toContain` on the opening line stays green against a prompt
#      somebody has rewritten around it.
Invoke-Probe -Name "18 trading's prompt gains an extra instruction" -File $Vocabulary `
  -From @'
export const TRADING_SYSTEM_PROMPT =
  TRADING_SYSTEM_PROMPT_HISTORICAL + NO_FIAT_RULE;
'@ -To @'
export const TRADING_SYSTEM_PROMPT =
  TRADING_SYSTEM_PROMPT_HISTORICAL + NO_FIAT_RULE + "\n- Be brief";
'@ -ExpectTest 'character for character'

Write-Host "`nDone. Every probe should read RED. A GREEN line means that guard is not holding.`n" -ForegroundColor Cyan
