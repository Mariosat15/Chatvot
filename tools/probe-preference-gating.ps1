# Probes `__tests__/notifications/preference-gating.test.ts` - the 14 September preference work:
# one resolver deciding store/push/email, a receipts switch that is not the notification switch,
# and account mail that nothing can turn off.
#
# Same harness shape as `probe-challenge-notifications.ps1` - see that file for the encoding
# notes (read/write UTF-8 without a BOM, ASCII-only anchors, and the rule that PROBE DID NOT
# APPLY means the target moved rather than that the run was quiet).

$ErrorActionPreference = 'Continue'
$env:NODE_OPTIONS = ''

$SUITE = '__tests__/notifications/preference-gating.test.ts'
$Utf8NoBom = New-Object System.Text.UTF8Encoding($false)

function Relax([string]$literal) { [regex]::Escape($literal) -replace '\r?\n', '\r?\n' }

function Probe {
  param([string]$Name, [string]$File, [string]$Find, [string]$Replace, [string]$ExpectRed, [string]$Suite = $SUITE)

  $path = Join-Path (Get-Location) $File
  $original = [System.IO.File]::ReadAllText($path, $Utf8NoBom)

  if ([string]::IsNullOrEmpty($original)) {
    Write-Host "  [READ FAILED - REFUSING TO WRITE] $Name" -ForegroundColor Magenta
    return
  }

  $patched = [regex]::Replace($original, (Relax $Find), $Replace.Replace('$', '$$'), 1)
  if ($patched -eq $original) {
    Write-Host "  [PROBE DID NOT APPLY] $Name" -ForegroundColor Magenta
    return
  }

  [System.IO.File]::WriteAllText($path, $patched, $Utf8NoBom)
  try {
    $alone = npx vitest run $Suite -t $ExpectRed --reporter=dot 2>&1 | Out-String
    $aloneFailed = 0
    if ($alone -match 'Tests\s+(\d+)\s+failed') { $aloneFailed = [int]$Matches[1] }
    $ran = ($alone -match 'Tests\s+') -and ($alone -notmatch 'No test found')

    $whole = npx vitest run $Suite --reporter=dot 2>&1 | Out-String
    $wholeFailed = 0
    if ($whole -match 'Tests\s+(\d+)\s+failed') { $wholeFailed = [int]$Matches[1] }

    if (-not $ran) {
      Write-Host "  [EXPECTED TEST DID NOT RUN - wrong name or wrong suite] $Name" -ForegroundColor Magenta
    } elseif ($aloneFailed -gt 0) {
      Write-Host ("  [RED: expected test failed, {0} red in suite] {1}" -f $wholeFailed, $Name) -ForegroundColor Green
    } else {
      Write-Host ("  [STILL GREEN - GUARD IS NOT WORKING, {0} red in suite] {1}" -f $wholeFailed, $Name) -ForegroundColor Red
    }
  } finally {
    [System.IO.File]::WriteAllText($path, $original, $Utf8NoBom)
    if ([System.IO.File]::ReadAllText($path, $Utf8NoBom) -ne $original) {
      Write-Host "  !! RESTORE FAILED for $File - check git diff" -ForegroundColor Red
    }
  }
}

$MODEL = 'database/models/user-notification-preferences.model.ts'
$ADMIN_MODEL = 'apps/admin/database/models/user-notification-preferences.model.ts'
$MAILER = 'lib/nodemailer/index.ts'
$ADMIN_MAILER = 'apps/admin/lib/nodemailer/index.ts'
$PREFS = 'lib/services/email-preferences.ts'
$SERVICE = 'lib/services/notification.service.ts'
$DELIVERY = 'lib/services/notifications/delivery.ts'
$BRIDGE = 'lib/services/email-notification-bridge.ts'
$SETTINGS = 'components/notifications/NotificationSettings.tsx'
$ROUTE = 'app/api/notifications/preferences/route.ts'

Write-Host "`n=== the resolver ===" -ForegroundColor Cyan

# The defect this whole split exists to prevent. Returning the old single boolean for quiet
# hours throws the stored row away as well, so a claimed open seat at 3am is lost permanently
# with nothing on any screen to explain the gap.
Probe -Name 'quiet hours discard the row as well as the buzz' `
  -File $MODEL `
  -Find '  const push = !isWithinQuietHours(prefs);

  return {
    store: true,
    push,' `
  -Replace '  const push = !isWithinQuietHours(prefs);
  if (!push) return { store: false, push: false, email: false };

  return {
    store: true,
    push,' `
  -ExpectRed 'KEEPS the row during quiet hours'

# Fails closed on a player who has never opened the screen - which is almost everybody.
Probe -Name 'an absent preferences document withholds everything' `
  -File $MODEL `
  -Find '  if (!prefs) return ALL;

  if (!prefs.notificationsEnabled) {' `
  -Replace '  if (!prefs) return { store: false, push: false, email: false };

  if (!prefs.notificationsEnabled) {' `
  -ExpectRed 'delivers everything to a player who has never opened'

# Security stops bypassing the category switch, so a player who muted "security" alerts stops
# being told their account was accessed from an unknown device.
Probe -Name 'security obeys the category switch' `
  -File $MODEL `
  -Find '  if (category !== "security") {' `
  -Replace '  if (true) {' `
  -ExpectRed 'delivers security whatever the category'

# The per-template override stops working while the category one still does, which is the
# half that would survive a test asserting only that something can be switched off.
Probe -Name 'a single muted template is delivered anyway' `
  -File $MODEL `
  -Find '    if (templateId && prefs.disabledNotifications?.includes(templateId)) {
      return { store: false, push: false, email: false };
    }' `
  -Replace '    if (false) {
      return { store: false, push: false, email: false };
    }' `
  -ExpectRed 'stops a single template the player switched off'

Write-Host "`n=== the two email groups ===" -ForegroundColor Cyan

# The collapse the owner's request most invites: one email switch for everything. It reads as
# a simplification and it means turning off competition alerts stops deposit receipts.
Probe -Name 'receipts are folded into the notification email switch' `
  -File $MODEL `
  -Find '      return prefs.transactionalEmailsEnabled !== false;' `
  -Replace '      return (
        prefs.emailNotificationsEnabled !== false &&
        prefs.transactionalEmailsEnabled !== false
      );' `
  -ExpectRed 'keeps sending receipts to a player who turned notification email off'

# The other direction, which the first probe cannot see.
Probe -Name 'the notification group is answered by the receipts flag' `
  -File $MODEL `
  -Find '    if (!prefs.notificationsEnabled) return false;
    return prefs.emailNotificationsEnabled !== false;' `
  -Replace '    if (!prefs.notificationsEnabled) return false;
    return prefs.transactionalEmailsEnabled !== false;' `
  -ExpectRed 'keeps sending notification email to a player who turned receipts off'

# A stored `null` read literally. Mongoose fills a default for `undefined` only, so this is
# the shape a bad edit or a half-run migration leaves behind - and the only shape the `!==`
# comparison genuinely answers.
#
# Aimed at the null test rather than the absent-field one: the first version expected the
# absent-field test to go red and it stayed green, because hydration had already applied the
# schema default and the comparison never saw an empty value at all. The claim was right and
# the test was naming the wrong mechanism.
Probe -Name 'a stored null reads as off' `
  -File $MODEL `
  -Find '      return prefs.transactionalEmailsEnabled !== false;' `
  -Replace '      return prefs.transactionalEmailsEnabled === true;' `
  -ExpectRed 'reads a stored null as receiving receipts'

# The schema default disappears, so every pre-existing document loses its receipts on deploy.
Probe -Name 'the receipts schema default is dropped' `
  -File $MODEL `
  -Find '      transactionalEmailsEnabled: {
        type: Boolean,
        default: true,' `
  -Replace '      transactionalEmailsEnabled: {
        type: Boolean,
        default: false,' `
  -ExpectRed 'defaults an existing document with no stored flag'

# Account mail becomes refusable, which is a lockout: the player cannot receive the code that
# proves the address is theirs in order to turn it back on.
Probe -Name 'account mail can be switched off' `
  -File $MODEL `
  -Find '    if (group === "account") return true;' `
  -Replace '    if (group === "account") { /* falls through */ }' `
  -ExpectRed 'sends account and security mail without reading anything'

Write-Host "`n=== the senders ===" -ForegroundColor Cyan

# Restoring the original defect one sender at a time: each was composing straight from an
# address with no preference reachable from any screen.
#
# The mutation removes the GUARD, not the export. Renaming `export const sendInvoiceEmail` to
# `...Unguarded` was the first attempt and it reported green on all five, because the test
# locates the body with `indexOf("export const sendInvoiceEmail")` and the old name is still a
# PREFIX of the new one - so the slice was unchanged and the guard inside it intact. A probe
# that leaves the subject in place is indistinguishable from a test that does not work.
#
# Each guard is addressed by the log tag inside it, which is unique per sender. Removing them
# one at a time is what proves the assertion is PER SENDER: a probe that killed all four at
# once would be equally red against a test asserting only that the file mentions the helper.
$GUARDS = @(
  @{ Tag = 'INVOICE'; Sender = 'sendInvoiceEmail'; File = $MAILER },
  @{ Tag = 'DEPOSIT'; Sender = 'sendDepositCompletedEmail'; File = $MAILER },
  @{ Tag = 'REFUND'; Sender = 'sendRefundCompletedEmail'; File = $MAILER },
  @{ Tag = 'WITHDRAWAL'; Sender = 'sendWithdrawalCompletedEmail'; File = $MAILER },
  @{ Tag = 'DEPOSIT'; Sender = 'sendDepositCompletedEmail (admin copy)'; File = $ADMIN_MAILER }
)

foreach ($g in $GUARDS) {
  $path = Join-Path (Get-Location) $g.File
  $text = [System.IO.File]::ReadAllText($path, $Utf8NoBom)

  # Anchor on the log line, then widen to the whole `if` around it, so the replacement is
  # exactly the guard and nothing either side of it.
  $anchor = [regex]::Match($text, '(?s)if \(!\(await mayEmailAddress\([^)]*"transactional"\)\)\) \{\s*console\.log\(\s*`[^`]*\[' + $g.Tag + '\][^`]*`,\s*\);\s*return;\s*\}')
  if (-not $anchor.Success) {
    Write-Host ("  [PROBE DID NOT APPLY] {0} stops asking" -f $g.Sender) -ForegroundColor Magenta
    continue
  }

  Probe -Name ("{0} stops asking" -f $g.Sender) `
    -File $g.File `
    -Find $anchor.Value `
    -Replace '' `
    -ExpectRed 'asks mayEmailAddress before composing'
}

# The group becomes optional, so a sender that forgets to name one is silently treated as
# something. The grep for who bypasses the switches then returns nothing while senders bypass.
Probe -Name 'the email group gets a default' `
  -File $PREFS `
  -Find '  group: EmailGroup,' `
  -Replace '  group: EmailGroup = "account",' `
  -ExpectRed 'names the group at the call site'

# An unresolvable address refuses, withholding a receipt for money that has already moved.
Probe -Name 'an unknown address is refused rather than sent to' `
  -File $PREFS `
  -Find '    if (!userId) return true;' `
  -Replace '    if (!userId) return false;' `
  -ExpectRed 'fails open when the address cannot be resolved'

Write-Host "`n=== the pipeline ===" -ForegroundColor Cyan

# The order matters: resolving after the write means the row is stored for somebody who
# switched the category off, and only the push and the email are withheld.
Probe -Name 'delivery is resolved after the row is written' `
  -File $SERVICE `
  -Find '    const delivery = await UserNotificationPreferences.resolveDelivery(' `
  -Replace '    const deliveryLater = async () => UserNotificationPreferences.resolveDeliveryMoved(' `
  -ExpectRed 'resolves delivery before writing anything'

# The delivery layer ignores the push flag, so quiet hours are honoured in the model and
# defeated one file along - green against every behavioural test above.
Probe -Name 'the delivery layer pushes regardless' `
  -File $DELIVERY `
  -Find 'channels.push !== false' `
  -Replace 'true' `
  -ExpectRed 'the push is the flag that quiet hours can withhold'

# The bridge grows its own copy of the precedence back.
Probe -Name 'the email bridge reimplements the rule' `
  -File $BRIDGE `
  -Find 'resolveDelivery(' `
  -Replace 'resolveDeliveryRenamed(' `
  -ExpectRed 'the email bridge delegates rather than carrying'

Write-Host "`n=== the settings screen ===" -ForegroundColor Cyan

# The defect the screen guard exists for: the receipts switch nested inside the master
# notifications conditional, so it is reachable only while notifications are on.
#
# Injected by opening the conditional ABOVE the Email card, which is precisely what nesting
# it would look like. The first attempt instead swapped the `checked` binding, which left the
# name in place at the interface declaration near the top of the file and reported green - the
# same one-identifier-two-places trap as `!expectedOrigin` and `MIN_REASON_LENGTH`.
Probe -Name 'the receipts switch moves inside the master conditional' `
  -File $SETTINGS `
  -Find '      <Card className="bg-gray-900/50 border-gray-800">
        <CardHeader>
          <CardTitle className="text-white text-lg">Email</CardTitle>' `
  -Replace '      {preferences.notificationsEnabled && (
      <Card className="bg-gray-900/50 border-gray-800">
        <CardHeader>
          <CardTitle className="text-white text-lg">Email</CardTitle>' `
  -ExpectRed 'puts the receipts switch OUTSIDE'

# An uncontrolled switch that renders off for every pre-existing account.
Probe -Name 'an absent flag renders the switch off' `
  -File $SETTINGS `
  -Find 'checked={preferences.transactionalEmailsEnabled !== false}' `
  -Replace 'checked={preferences.transactionalEmailsEnabled === true}' `
  -ExpectRed 'reads an absent stored flag as on'

# The always-on group is dropped, so a player looking for "no email at all" finds no answer.
Probe -Name 'the always-on group is not mentioned' `
  -File $SETTINGS `
  -Find '<Badge className="bg-red-500/20 text-red-400">Always On</Badge>' `
  -Replace '<span />' `
  -ExpectRed 'says the account group cannot be switched off'

# The switch renders and saves nothing, which is the quietest possible failure: the player
# flips it, sees a success toast, and keeps receiving the email.
Probe -Name 'the route drops the field' `
  -File $ROUTE `
  -Find '      updates.transactionalEmailsEnabled = transactionalEmailsEnabled;' `
  -Replace '      // dropped' `
  -ExpectRed 'is writable through the preferences route'

Write-Host "`n=== the mirrors ===" -ForegroundColor Cyan

Probe -Name 'the admin model drifts' `
  -File $ADMIN_MODEL `
  -Find '    if (group === "account") return true;' `
  -Replace '    if (group === "account") return true; // admin' `
  -ExpectRed 'both copies of the preferences model agree'

Probe -Name 'the admin email-preferences service drifts' `
  -File 'apps/admin/lib/services/email-preferences.ts' `
  -Find '  if (group === "account") return true;' `
  -Replace '  if (group === "account") return true; // admin' `
  -ExpectRed 'both copies of the email-preferences service agree'

Write-Host "`nDone.`n" -ForegroundColor Cyan
