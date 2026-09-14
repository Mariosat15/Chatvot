# Probes `__tests__/challenges/challenge-notifications.test.ts` - the notification half of the
# 14 September challenge work: one push seam for the whole lifecycle, a banner per state with a
# click target on it, and an open challenge that expires on its own schedule.
#
# Same harness shape as `probe-opponent-picker.ps1` - see that file for the encoding notes
# (read/write UTF-8 without a BOM, ASCII-only anchors, and the rule that PROBE DID NOT APPLY
# means the target moved rather than that the run was quiet).

$ErrorActionPreference = 'Continue'
$env:NODE_OPTIONS = ''

$SUITE = '__tests__/challenges/challenge-notifications.test.ts'
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

$TEMPLATES = 'database/models/notification-template.model.ts'
$SERVICE = 'lib/services/notification.service.ts'
$ADMIN_SERVICE = 'apps/admin/lib/services/notification.service.ts'
$PUSH = 'lib/services/notifications/notification-push.ts'
$CARD = 'components/notifications/NotificationPopupCard.tsx'
$POPUP = 'components/challenges/ChallengePopup.tsx'
$BELL = 'components/notifications/NotificationDropdown.tsx'
$WS = 'websocket-server/index.ts'
$DEADLINE = 'lib/services/challenges/accept-deadline.ts'
$CREATE_ROUTE = 'app/api/challenges/route.ts'

Write-Host "`n=== the templates ===" -ForegroundColor Cyan

# The click target dropped off one template. This is the owner's own requirement - "all must have
# the proper clicks to send to specific places" - and it fails in the quiet direction: the banner
# still renders, still reads correctly, and lands on the category fallback instead of the
# challenge it is about.
Probe -Name 'a settled challenge loses its results link' `
  -File $TEMPLATES `
  -Find '      channels: { inApp: true, email: true, push: false },
      actionUrl: "/challenges/{{challengeId}}",
      actionText: "View Results",
    },
    {
      templateId: "challenge_lost",' `
  -Replace '      channels: { inApp: true, email: true, push: false },
      actionText: "View Results",
    },
    {
      templateId: "challenge_lost",' `
  -ExpectRed 'challenge_won is clickable'

# A template filed under another category. It is stored, pushed and counted by the bell, and
# silently never becomes a banner - which is the exact symptom that was reported.
Probe -Name 'the claimed-seat template leaves the challenge category' `
  -File $TEMPLATES `
  -Find '      category: "challenge",
      type: "challenge_seat_taken",' `
  -Replace '      category: "trading",
      type: "challenge_seat_taken",' `
  -ExpectRed 'challenge_seat_taken is filed under challenge'

# The new template removed altogether, which is what "reuse challenge_accepted for both" looks
# like in a diff. The creator of an open challenge is then told Maria "accepted your challenge",
# implying they invited her.
Probe -Name 'the open-seat template is dropped' `
  -File $TEMPLATES `
  -Find '      templateId: "challenge_seat_taken",' `
  -Replace '      templateId: "challenge_seat_taken_unused",' `
  -ExpectRed 'challenge_seat_taken is seeded'

# The admin mirror left behind. `check:mirrors` compares field paths and enum values, so it has
# no opinion about the seeded default list at all - two apps can disagree about what a player is
# told, and which message arrives depends on which process wrote it.
#
# The anchor is the description rather than the title, which carries an emoji: an anchor has to
# survive the shell, and a non-ASCII one reports DID NOT APPLY while reading as a moved target.
Probe -Name 'the admin copy of a template drifts' `
  -File 'apps/admin/database/models/notification-template.model.ts' `
  -Find '        "Sent when a challenge is cancelled before it was played and the entry fee returned",' `
  -Replace '        "Sent when a challenge is cancelled and the entry fee returned",' `
  -ExpectRed 'challenge_cancelled is seeded identically in both apps'

Write-Host "`n=== the push seam ===" -ForegroundColor Cyan

# The email flag ignored again. This is the state the code was in before: `channels` declared on
# every template, read by nothing, so an operator toggling email changed no behaviour.
Probe -Name 'the channels.email flag goes back to being dead' `
  -File $SERVICE `
  -Find '        { email: template.channels?.email === true },' `
  -Replace '        { email: false },' `
  -ExpectRed 'honours the channels.email flag'

# The on-demand seed removed. Seeding is `$setOnInsert` and nothing on the send path ran it, so a
# newly added templateId found no row and the notification was discarded in silence - the
# reported defect surviving its own fix.
Probe -Name 'a newly added template is dropped instead of seeded' `
  -File $SERVICE `
  -Find '        await checkAndSeedTemplates();' `
  -Replace '' `
  -ExpectRed 'seeds on demand'

# The click target stripped off the push. The row in the bell still has it, so the bell works and
# only the banner is inert - a difference nobody would look for.
Probe -Name 'the push drops the click target' `
  -File $PUSH `
  -Find '          actionUrl: notification.actionUrl,' `
  -Replace '' `
  -ExpectRed 'carries the click target on the push'

# The push awaited. It sits between a player pressing Accept and the response they are waiting
# for, so a slow or absent socket server delays - or fails - a write that has already committed.
Probe -Name 'the route waits on the socket server' `
  -File $PUSH `
  -Find '  void pushNotification(notification).catch((error) => {' `
  -Replace '  await pushNotification(notification).catch((error) => {' `
  -ExpectRed 'does not make a route wait on the socket server'

# The generic socket case replaced by a per-event one. The WebSocket server deploys separately,
# so every template added afterwards is live in the app and dead on the wire.
Probe -Name 'the socket server learns individual event names' `
  -File $WS `
  -Find '          case "user-notification":' `
  -Replace '          case "challenge_accepted":' `
  -ExpectRed 'keeps the socket server generic'

# The admin service's push removed. An operator cancelling a challenge writes through that copy,
# so the notification is stored and never delivered - which is how this class of defect started.
Probe -Name 'an operator-caused notification is never pushed' `
  -File $ADMIN_SERVICE `
  -Find '    deliverPush({' `
  -Replace '    void ({' `
  -ExpectRed 'pushes admin-caused notifications too'

# The email bridge imported into the pushable module. It compiles, and it makes the file
# unmirrorable - `apps/admin` has no copy of either dependency, so the admin build breaks (R58)
# or, worse, somebody "fixes" the mirror test by deleting it.
Probe -Name 'the pushable module reaches for the email bridge' `
  -File $PUSH `
  -Find 'export interface PushableNotification {' `
  -Replace 'import { emailNotificationBridge } from "@/lib/services/email-notification-bridge";

export interface PushableNotification {' `
  -ExpectRed 'keeps the pushable module free of anything the admin app lacks'

Write-Host "`n=== the banner ===" -ForegroundColor Cyan

# The filter turned into a list of template ids. That puts the decision back in the browser,
# where the next template is forgotten silently - the whole reason the push is one seam.
Probe -Name 'the banner filters on template ids rather than the category' `
  -File $POPUP `
  -Find '        if (!n.category || !POPUP_CATEGORIES.has(n.category)) return;' `
  -Replace '        if (n.templateId === "challenge_accepted") return;' `
  -ExpectRed 'admits a category rather than a list of templates'

# Every category popped up. `position_closed` and `order_filled` fire continuously while
# somebody trades, so the cards a player has to act on are buried under ones they do not.
Probe -Name 'every notification becomes a banner' `
  -File $POPUP `
  -Find 'const POPUP_CATEGORIES = new Set(["challenge"]);' `
  -Replace 'const POPUP_CATEGORIES = new Set(["challenge", "trading", "purchase"]);' `
  -ExpectRed 'does not pop up the continuous trading events'

# The banner computing its own destination. A second answer to "where does this event live",
# which diverges on the one template somebody forgets - and the two are millimetres apart on
# screen, the bell's row and the banner about the same event.
Probe -Name 'the banner works out its own destination' `
  -File $POPUP `
  -Find '      const href = popupHref(notification);' `
  -Replace '      const href = `/challenges/${notification.templateId}`;' `
  -ExpectRed "sends the click through the same helper"

# The relay dropped. The badge then only moves on the next poll, which is the "no badge" half of
# the original report reintroduced while the banner still appears - so it looks fixed.
Probe -Name 'the bell is no longer told' `
  -File $POPUP `
  -Find '        broadcastNotificationPush(n);' `
  -Replace '' `
  -ExpectRed 'relays to the bell instead of opening a second socket'

# The relay moved below the popup filter. The badge then updates for challenge notifications
# only, so every other category silently stops counting - correct-looking on the one screen
# anybody tests.
Probe -Name 'the relay happens after the popup filter' `
  -File $POPUP `
  -Find '        broadcastNotificationPush(n);

        if (!n.category || !POPUP_CATEGORIES.has(n.category)) return;' `
  -Replace '        if (!n.category || !POPUP_CATEGORIES.has(n.category)) return;
        broadcastNotificationPush(n);' `
  -ExpectRed 'relays before the popup filter'

# A second socket opened for the badge. `useWebSocket` connects per call, so this doubles every
# signed-in client's connection count for one number.
Probe -Name 'the bell opens its own socket' `
  -File $BELL `
  -Find 'import { NOTIFICATION_PUSH_EVENT } from "@/lib/utils/notification-events";' `
  -Replace 'import { NOTIFICATION_PUSH_EVENT } from "@/lib/utils/notification-events";
import useWebSocket from "@/hooks/useWebSocket";' `
  -ExpectRed 'relays to the bell instead of opening a second socket'

# The card branching on what a challenge is. One card per event type is how a new template
# silently gets no popup, and how the popup, the bell and the email end up disagreeing.
Probe -Name 'the card special-cases a challenge template' `
  -File $CARD `
  -Find '  const accent = notification.color || "#FDD458";' `
  -Replace '  const accent =
    notification.templateId === "challenge_seat_taken"
      ? "#10B981"
      : notification.color || "#FDD458";' `
  -ExpectRed 'keeps the card ignorant of what a challenge is'

Write-Host "`n=== the fallback destination ===" -ForegroundColor Cyan

# The category fallback removed. Seeding is `$setOnInsert`, so a template gaining an actionUrl
# never reaches a row that already exists - every older card becomes unclickable, which is
# indistinguishable from a broken popup.
Probe -Name 'a card with no stored actionUrl is unclickable' `
  -File $CARD `
  -Find '    const fallback = Reflect.get(CATEGORY_FALLBACK_URL, category);' `
  -Replace '    const fallback = undefined as string | undefined;' `
  -ExpectRed 'falls back per category'

# The lookup written as an object index. `Reflect.get` and `[]` both walk the prototype chain,
# so a stored `"__proto__"` returns `Object.prototype` - truthy, survives the guard, and only
# fails somewhere unrelated later. The typeof check is what actually holds this, so the probe
# removes that instead.
Probe -Name 'the fallback trusts whatever the lookup returns' `
  -File $CARD `
  -Find '    if (typeof fallback === "string") return fallback;' `
  -Replace '    if (fallback) return fallback as string;' `
  -ExpectRed 'is not fooled by an inherited key'

Write-Host "`n=== the open-challenge lifetime ===" -ForegroundColor Cyan

# The open branch removed, which is the state this work replaced: an open challenge inherits the
# number chosen for "waiting on one specific friend". Nothing errors; the notice board just
# comes down after half an hour.
Probe -Name 'an open challenge inherits the directed deadline' `
  -File $DEADLINE `
  -Find '  if (openToAnyone) {' `
  -Replace '  if (false) {' `
  -ExpectRed 'uses its own setting'

# The fallback pointed at the directed default. Every existing platform holds no configured
# value, so the change would be invisible on all of them with every structural test still green.
Probe -Name 'the open fallback borrows the directed default' `
  -File $DEADLINE `
  -Find '      DEFAULT_OPEN_CHALLENGE_EXPIRY_MINUTES' `
  -Replace '      (positiveMinutes(settings.acceptDeadlineMinutes) ?? 30)' `
  -ExpectRed 'falls back to its own default and never to the directed one'

# The positive check collapsed to truthiness plus a null test, which admits NaN. These arrive
# from parseFloat on an admin form, and a NaN deadline makes every comparison false - so an open
# challenge either never expires or expires instantly, depending on which side reads it.
Probe -Name 'a NaN from the admin form is treated as a real number' `
  -File $DEADLINE `
  -Find '  return typeof value === "number" && Number.isFinite(value) && value > 0' `
  -Replace '  return typeof value === "number" && value !== null' `
  -ExpectRed 'treats a non-positive or absent stored value as unset'

# The arithmetic inlined at a writer. Two copies let a challenge be created under one rule and
# expired under the other, and a probe aimed at either one stays green.
Probe -Name 'the create route works the deadline out for itself' `
  -File $CREATE_ROUTE `
  -Find '      acceptDeadline: resolveAcceptDeadline(settings, isOpenChallenge),' `
  -Replace '      acceptDeadline: new Date(
        Date.now() + (settings.acceptDeadlineMinutes || 30) * 60 * 1000,
      ),' `
  -ExpectRed 'is resolved once, by the shared helper, at every writer'

Write-Host "`n=== nobody came ===" -ForegroundColor Cyan

# The open-seat wording replaced by the directed one. The creator of a challenge nobody was
# invited to is told a named opponent "did not respond in time" - a false statement that reads
# perfectly, and one that seeding could never correct afterwards.
Probe -Name 'an unclaimed open challenge reports the directed wording' `
  -File 'lib/services/challenges/expiry-notifications.ts' `
  -Find '            challenge.openToAnyone === true
              ? "challenge_open_expired"
              : "challenge_expired",' `
  -Replace '            "challenge_expired",' `
  -ExpectRed 'uses wording written for an open seat'

# One writer left out. Three of them expire challenges - the main app's action, the worker job
# and the admin action - and the worker is the one that runs in production, so dropping it is
# the version where nothing fires and every test about the others passes.
Probe -Name 'the worker expires challenges without telling anybody' `
  -File 'worker/jobs/challenge-finalize.job.ts' `
  -Find '      const { notifyChallengesExpired } = await import(
        "../../lib/services/challenges/expiry-notifications"
      );
      await notifyChallengesExpired(notifiedExpired);' `
  -Replace '      void notifiedExpired;' `
  -ExpectRed 'is shared by all three writers rather than copied'

Write-Host "`n=== done ===`n" -ForegroundColor Cyan
