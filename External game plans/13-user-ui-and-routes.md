# 13 - User UI, Routes and Navigation (part of X7)

`09` section E6 covers the provider-specific player screens: the iframe host page, the
result screen, practice mode. This chapter covers the rest of the user-facing surface -
**37 routes** today, all of it written around trading.

The single most important fact in this chapter: **all trading providers are correctly
scoped to two `/trade` pages already.** That is why this work is tractable.

---

## 1. Routing

### Today

```
/competitions                       list
/competitions/[id]                  lobby
/competitions/[id]/trade            GAMEPLAY  <- trading terminal
/competitions/[id]/results          results
/challenges/[id]/trade              GAMEPLAY  <- trading terminal
```

### Target

```
/competitions/[id]/play             GAMEPLAY DISPATCHER  <- new
/competitions/[id]/trade            redirect to /play
/challenges/[id]/play               GAMEPLAY DISPATCHER  <- new
/games                              catalogue            <- see 16
/games/[slug]                       one game's page      <- see 16
```

**Keep `/trade` as a redirect, permanently.** It is linked from notification templates,
emails, the help centre, and every bookmark a player has made.

### The play dispatcher

`/play/page.tsx` resolves the contest, looks up the module, and renders that module's
gameplay component:

| Game type | Renders |
|---|---|
| `trading` | `<TradingGameplay />` - the existing `TradingPageContent` plus its six providers |
| `provider` | `<ProviderGameplay />` - the iframe host from `09` E6 |

---

## 1.1a What was built - the provider half of the dispatcher (5 Sep 2026)

**Status: the provider branch is code-complete. The trading branch is not, and the redirect
therefore runs the opposite way round from the target above.**

A player who has entered a provider contest can now start a round, play it in the frame, and see a
confirmed result, **by clicking**. Before this the whole play step was reachable by API and by test
only. 42 tests, 20 probes all red on the expected test.

### Files

| File | Role |
|---|---|
| `app/(root)/competitions/[id]/play/page.tsx` | The route. Reads state, renders the host. **Never launches a round.** |
| `components/games/ProviderRoundHost.tsx` | The state machine: preflight, launching, playing, confirming, settled |
| `components/games/ProviderGameFrame.tsx` | The iframe and the three checks on every inbound message |
| `components/games/provider-frame-messages.ts` | The four-message allowlist, the height clamp, the origin derivation. Model-free and framework-free |
| `components/games/RoundPreflight.tsx` | What a player is told before an attempt is spent |
| `components/games/RoundResultPanel.tsx` | The result, including the generic `scoreBreakdown` renderer |
| `components/games/play-state.ts` | The browser's copy of `PlayState`. Pinned field-for-field against the service |
| `lib/services/games/round-status.service.ts` | `getPlayState` - the caller's own attempts and rounds. **Not mirrored** |
| `app/api/competitions/[id]/rounds/route.ts` | Gained a `GET` beside the existing `POST` |

### The route is the one this chapter specifies, and it had to be corrected to get there

`09` E6 called it `/play/[contestId]`; this chapter called it `/competitions/[id]/play`. The build
follows this chapter. Getting it wrong would have meant renaming a URL players had bookmarked, or
running two play routes for ever.

**The redirect currently points outwards, which is the reverse of the target.** A trading contest
reaching `/play` is sent to `/trade`, not rendered here, because the trading branch needs
`TradingPageContent` and its six context providers moved - a change to the live trading path
carrying **R18** and **R19**. When X7 moves them, the redirect flips direction and no URL changes.
**No loop is possible in either arrangement**: the two guards are exact complements of
`isProviderContest`, and a test pins that, because an overlap produces an infinite redirect rather
than a wrong screen.

### Five things worth carrying

- **A GET must never consume an attempt, and a server component is a GET.** An attempt is spent
  when a round is *created*, deliberately, so a page that launched on render would burn a paying
  player's only attempt because **Next.js prefetches `<Link>` targets on hover**. The page renders
  a button; the POST happens on the click. This is the reason the play screen is a state machine
  rather than a redirect through the launch API, and it is easy to lose in a later "simplification".
- **The score has no route through the browser, which is stronger than remembering not to read
  one.** `ProviderFrameMessage` has no score field at all, so a `finished` message carrying
  `score`, `rawScore`, `points`, `prize` and `rank` yields an object with two keys. `finished`
  means "go ask the server", never "the player scored X". Proven behaviourally, not structurally.
- **The sandbox omission is the feature.** `allow-top-navigation` is absent, so a game cannot
  navigate the player's whole page away from ChartVolt - which a provider bug or a compromised game
  would otherwise do mid-contest, looking to the player exactly like our site crashing.
  `allow-popups` is absent for the same reason, matching the spec's "no external links out".
- **Three checks on every message, and the strongest is the one nobody writes first.**
  `event.source === frame.contentWindow` proves the message came from the window we opened and
  cannot be forged by an unrelated page; the origin check catches a frame that has navigated itself
  elsewhere; the allowlist catches the rest. The source check is silent because a page receives
  constant `postMessage` traffic from extensions and dev tools, while an origin mismatch on our own
  frame is logged, because that is a real integration fault.
- **"Resume" and "Play" are different promises.** Relaunching a live round returns the *same* round
  with a fresh launch URL, because `createRound` is idempotent on a live round - so resuming costs
  nothing. Labelling it "Play" would tell a player they were spending an attempt they are not, and
  some would decline and let a round expire instead.

### 1.1b The pre-flight now refuses what the server would refuse (6 September 2026)

`RoundPreflight` read attempts and the play window and **ignored the contest's own state**, so a
contest that had not started rendered a fully enabled **Play** button. Pressing it lost nothing -
the launch service refuses anything but `active` and consumes no attempt - but the player got a
red error box where they should have got an explanation, on the first screen a new entrant sees.
**A control that appears to work and does nothing** is the same failure as a provider enabled
with no adapter, or a `rankingMethod` a provider game ignores.

It mirrors `PLAYABLE_STATUSES` rather than inventing a rule, and `draft` is grouped with
`upcoming` because an unpublished contest is reachable by URL. Five refusals get five distinct
wordings, for the reason `LaunchRefusal` learned in X5: a generic message forces the player to
guess which of "come back later", "it's over" and "you're out of attempts" applies.

Three things about it are load-bearing and easy to undo:

- **Resume is blocked too.** `exhausted` deliberately excludes a live round, so resume survives a
  spent allowance - but the status gate in the launch service runs **before** the idempotent
  resume path, so a round in a finished contest cannot be reopened however harmless that looks.
  `blocked` is therefore independent of `resuming`, and a test asserts that appending
  `&& !resuming` to it turns red.
- **Not-yet-started is not an error, and must not be red.** The red panel reports a *rejected
  action*. Having just joined a contest that opens tomorrow is the normal case, and colouring it
  as a failure teaches a player something is broken. The test counts the red containers so a
  second one cannot appear unnoticed.
- **The attempt-cost hint is hidden while blocked.** "Starting uses one attempt" beside a
  disabled button reads as a warning about something the player cannot do.

`__tests__/games/provider-play-ui.test.ts` (28 tests) and `tools/probe-preflight-status.ps1`
(7 probes, all red).

### 1.1c The clock the screen runs on is the server's (7 September 2026)

The owner's report was two sentences: the play screen showed a bare UTC timestamp where a
countdown belonged, and **the Play button needed a page reload to appear.** Both are the same
underlying gap - the screen had no notion of time passing - but they need two different
mechanisms, and conflating them is how one of them ends up half-built.

**`hooks/useServerClock.ts` is a ticking clock anchored to the server's `serverNow`**, added to
the `PlayState` payload. Every gate on the pre-flight now compares against it.

**Why not `Date.now()`, which is the obvious version.** Every gate the pre-flight mirrors is
enforced on the server against the server's `new Date()`. Computed in the browser they disagree
on any machine whose clock is off, and **both directions of the disagreement are bad**: a Play
button offered against a closed window produces a refusal the player cannot act on, and one
withheld against an open window hides a paid attempt they are entitled to. Neither logs
anything, because neither is an error. A test bans `Date.now()` from the component outright,
because importing the hook is trivially satisfied by a file that then computes the comparison
the old way - which is exactly what it did.

**The honest limitation, and why the error is in the safe direction.** `serverNow` was produced
when the payload was generated, so transit and hydration have passed by the time the offset is
computed - the hook counts that transit as clock skew and can read up to about a second *ahead*
of the server. That is deliberate: a countdown running marginally early closes the window a
moment before the server does, so the player is never offered a button the server is about to
refuse. Re-anchoring on every fresh payload bounds the error to one round trip instead of
letting it accumulate across an hour-long wait, which is why `serverNow` is generated per
response rather than once per page.

**An unparseable anchor falls back to the browser's clock rather than propagating.** An offset
of `NaN` makes every comparison on the pre-flight false, so the countdown would freeze and
every gate would **silently open** - the wrong direction for a screen that spends attempts.

**A third gate came out of the same work: `tooLateToStart`.** `createRound` refuses when
`now + maxDurationSeconds > playWindowEnd`, and it is right to - a round cut short by the window
would be scored on a partial game. What was wrong was **where the player met it**: a red box
after the click, beside a fully enabled button, which is the screen in the owner's report.
`maxRoundSeconds` now travels on the payload, read from the catalogue title and **never from the
caller** - a client-supplied round length would let a player claim a one-second round and be
offered a button the server refuses, the same rule that keeps the market-hours gate off caller
input. An **absent** duration applies no gate rather than guessing, because a guess that
disables the button is worse than letting the server name the real reason.

**And the second mechanism, which the clock cannot provide.** `PREFLIGHT_REFRESH_MS` (20s) in
`ProviderRoundHost` re-reads the state while the player sits on the pre-flight, because three of
the facts it gates on are **not time at all** - the contest's status moving to `active`, an
operator pausing or resuming it, and a round of the player's own being resolved by the
reconciliation net. None of those reach an open page. It is scoped to the pre-flight phase:
during `playing` the iframe owns the screen, and during `confirming` the result poll is already
running against the same endpoint, so a second timer would double the load and race it. It is
deliberately **not** tied to the countdown reaching zero, because that would make the client's
clock decide when to refresh, and the client's clock is the thing we do not trust.

The generalisable sentence: **the host polls for the facts the clock cannot know; the clock
handles everything that is purely the passage of time.** A single mechanism would either
hammer the endpoint every second or leave the button stale for twenty of them.

`__tests__/games/provider-play-ui.test.ts` (68 tests, 9 added) and
`tools/probe-play-clock.ps1` (12 probes, **all red on exactly the expected test with exactly one
failure each**).

### 1.1d The gate above became the contest's choice, and the player is told (7 September 2026)

`tooLateToStart` as described in `1.1c` was **correct code enforcing a rule nobody had chosen**,
and the paragraph above understates when it fires. It reserves the **catalogue ceiling**, not
the length the operator configured, so a contest shorter than that ceiling withheld Play *for
its entire duration* - "there is not enough time left in this competition" above a countdown
reading fifty-nine minutes, which is the owner's second report on this screen. `12` section 2.7
is the authoritative account; three things belong here, on the player's side of it.

**The flag split into two, and the split is the point.** `fullRoundNoLongerFits` is the
arithmetic, unchanged, including the `!resuming` guard - a resume reopens the round the player
already has and needs no fresh room. `tooLateToStart` is that **and** the contest insisting on a
full round. Keeping them separate is what lets one contest refuse where another shortens; a
single flag could only ever do one.

**The disclosure is what makes the permissive branch defensible, and it is not decoration.** An
attempt is consumed when a round is *created* and cannot be handed back, so a player who starts a
four-minute game with ninety seconds left and is not told has paid for a game they could never
finish. `shortenedMs` is derived from the **window**, never from the round length, because
`resolveExpiry` clamps `expiresAt` to `playWindowEnd` - so it is the length the server will
actually grant rather than an estimate of it, and a figure computed the other way drifts from
the clamp the first time either side changes. It reaches the **button** as well as the panel
("Play a shortened round"), because the button is what gets pressed by somebody who skimmed the
panel.

**The policy comes from the normalised config, never off the contest document.** Both
`contest-config.ts` copies resolve an unrecognised or absent value to `reserve_full_round` -
failing closed, the same rule as the market-hours gate - and `round-status.service.ts` reads
that resolved value. Reading `contest.roundStartPolicy` straight off the document would let a
typo in a stored field offer a button `round.service.ts` refuses.

**42 tests in the suite, 17 probes in `tools/probe-play-clock.ps1`**, all red on the expected
test. Two of that harness's older probes were **re-aimed rather than left green**: the
`!resuming` guard moved onto the new flag, and aimed at the old name a probe reports "did not
apply", which reads exactly like a broken harness rather than a moved guard.

### 1.1e The two deadlines a player could not see (7 September 2026)

Two moments govern whether a player can act, and neither was on screen. The owner's report was
that "the user doesn't know the window he has to join". The second half is the same complaint one
step later: a player who *has* joined, in a contest that reserves a full round, has a cut-off for
opening a new attempt that is **earlier than the contest end** - and the only thing telling them
was the pre-flight refusing, after the moment had passed.

**Both are countdowns rather than timestamps, and that is not a style choice.** These pages are
server-rendered, so an open tab never learns that the door has shut; a printed deadline is a fact
the reader has to compare against a clock they may not share with the server. `InlineCountdown`
already existed for the trading hero and needed one addition - a `zeroLabel`, because its default
reads "Ended" when it lands, and the *contest* has not ended when *entry* closes. The prop is
optional and the default is pinned by a test, since an additive prop stops being additive the
moment somebody changes the fallback to suit the newest caller.

**The entry countdown is game-agnostic because it is in `CompetitionEntryButton`**, which both
lobbies render. It counts to `resolveRegistrationDeadline`, extracted from `isRegistrationClosed`
rather than reimplemented beside it: that function carries a clamp against `startTime` for
documents an old bug wrote with a deadline *before* the start, and a second copy forgetting the
clamp would count down to a moment already past while the gate beside it still admitted the
player. **A contest with no deadline says so** rather than rendering nothing, because a player who
saw a countdown on the previous competition otherwise assumes this one is hiding one.

**The attempt cut-off is the arithmetic from `1.1c`, moved so that two screens can share it.**
`components/games/round-window.ts` is the only producer of it - `fullRoundCutoffMs` and
`contestReservesFullRound` - and the **negative** assertion is the load-bearing half of the test,
because importing the module is trivially satisfied by a screen that then subtracts the round
length again a few lines down, which is exactly what the pre-flight did before the extraction.
Two properties of the producer are worth stating because the tidier version of each is wrong. It
**does not know the policy**: folding that in and returning `null` for a permissive contest reads
like a simplification and destroys the play screen's ability to say how much unshortened time is
left. And an **absent round length yields no cut-off rather than a guessed one** - treating it as
zero gives every contest a cut-off equal to its close, which reads correct on the screen and
gates nothing.

**The lobby's note is policy-aware, and the two branches make opposite promises.** Under
`reserve_full_round` an attempt has to begin early enough to finish, so nothing is running at the
close; under `until_window_closes` something is, and it is scored on what the player managed.
Stating the permissive sentence under both is the failure this replaces - a caution that is right
in general and wrong in the case being looked at.

**32 probes in `tools/probe-play-clock.ps1`**, all red on exactly the expected test. Three of the
older ones were **re-aimed rather than left green**, all three for the same reason: the arithmetic
they targeted moved into the shared module or the note they replaced was reworded. Aimed at the
old text a probe reports "did not apply", which is indistinguishable from a broken harness.

### 1.1f A junk id in the URL, and the dead null check under it (R49, 7 September 2026)

The owner reported three stack traces from one request:

```
Error getting competition: Error: Invalid competition ID format
Error getting leaderboard: Error: Invalid competition ID format
Error loading competition: Error: Failed to get competition
```

**`/competitions/[id]` matches any single segment under `/competitions/`,** so it is handed
whatever a crawler, a stale bookmark or a link built out of an `undefined` asks for. Both of the
lobby's reads threw inside one `Promise.all` and the page's catch logged its own line on top. The
player already got a 404, so the reported symptom was noise - **and it is the chase that mattered,
not the noise.**

**`getCompetitionById` threw for both kinds of absence** - a malformed id and a missing document -
and its catch re-wrapped both as one message. Two consequences, both live:

- **Every caller's `if (!competition)` was dead code.** Three authors independently wrote one -
 `/results`, `/trade` and `GET /api/competitions/[id]/status` - and not one could ever run. The
 status route's careful 404 answered **500**; the two pages' redirect to `/competitions` never
 fired, so **a deleted contest showed a server-error boundary** rather than the intended
 redirect. Nobody had noticed because the guard reads as covering the case.
- **A deleted contest and a database outage were the same message,** so no caller could tell "this
 does not exist" from "we are broken" - and a page that 404s an outage tells the player the
 contest never existed.

The contract now: **`null` means it does not exist, a throw means something failed.** Six routes
refuse a junk id before any read - the four player routes, the polled status route and the admin
contest view - each logging **one** `warn` line naming the route and the value, because a bad id in
the log is the only way to tell a crawler from a link inside the application building a URL
wrongly. A silent guard would make an in-app defect invisible.

**Two things worth carrying.** The shape test is spelled out rather than delegated to
`ObjectId.isValid`, and the first draft justified that with a claim that was **stale**: `isValid`
accepted any 12-character string in bson v4 and does not here, because bson 5 removed 12-length
string support and synced `isValid` to the constructor. The comment was corrected rather than the
code changed, because the surviving reason is better than the original one - **the acceptable shape
of a URL segment is our decision and `isValid` is a dependency's**, it has already moved once in
the direction of accepting more, and a test now asserts the two agree *today* so a version bump is
a red test instead of a wider parser. Second: the pages' catch had to widen from `NEXT_REDIRECT` to
the whole **`NEXT_`** family, because `notFound()` is also implemented by throwing - so the new 404
was caught, logged as a failure with a stack trace, and then re-issued. **The noise arriving by a
second route.**

20 tests in `__tests__/services/competition-id-guard.test.ts`, **14 probes red on exactly the
expected test**. One probe found a genuinely weak test rather than a missing guard: the non-string
case asserted only `null` and `undefined`, which a plain `!= null` check also refuses. The
difference `typeof` actually buys is that **`RegExp.test` coerces**, so `String(["<24 hex>"])` is
that hex string and a one-element array would pass the shape check and reach `findById`.

### 1.1g Leaving the game led to a spinner with no way out (8 September 2026)

The owner's words were **"when i try to leave game is stuck"**, and they were accurate.

`handleExit` moves the host to `confirming`, which is right - **leaving does not hand the attempt
back**, so a screen that returned straight to the contest would let a player believe it had. But
`confirming` polls `POLL_ATTEMPTS × POLL_INTERVAL_MS`, **sixty seconds**, before the amber
"still being confirmed" panel and its Back button replace it. For that minute the panel rendered a
spinner, two sentences and **no control of any kind** - to a player who had just pressed the one
button on the screen that means *get me out of here*.

**The wait was already bounded, which is why this hid.** `1.1c` and the frame's twelve-second stall
panel both fixed unbounded waits, and the review that produced them read this state as covered: it
*does* terminate, it *does* end somewhere honest. **A bound is not an escape hatch, and the
distinction is what the player experiences** - sixty seconds of no affordance is indistinguishable
from a hang, and the player's own conclusion had already been recorded when they hit the button.

**The second half is a false statement, and it is the worse of the two.** The panel said *"We are
waiting for the game to confirm your score with us."* The overwhelming reason to press "Leave the
game" is that **the game never started** - that button is the only affordance the stall panel
offers - so there is no score, and there never was one. So the two routes into `confirming` are
now two situations rather than one:

| Route in | What is true | What it says |
|---|---|---|
| The frame reported `finished` | A score is genuinely on its way | *Confirming your result* |
| The player pressed **Leave the game** | The round stays open and the contest's `unresolvedRoundPolicy` decides | *Checking how your round ended* |

**It still polls on the leaving path, deliberately.** Since **R48** a partial run counts, so a
game that had already computed a score may report it for a round the player walked out of. What
changed is what the player is told and whether they are held there.

**Three things worth carrying.**

- **Leaving early costs nothing, and saying so is part of the fix.** The result arrives by the
  provider's signed callback into our own database and is read back by the contest screens. Nothing
  about it depends on this page staying open - so both messages now say so explicitly, because a
  spinner beside a Back button is otherwise ambiguous about whether leaving abandons the result.
- **The guard is positional, and that is not pedantry.** The panel's other two branches have always
  had a Back link, so an assertion that the *file* contains one is green on exactly this defect.
  The test slices the confirming branch by index - `if (confirming)` to `if (!round)` - and asserts
  a length, because a slice that found nothing passes every assertion made of it.
- **The count is what pins the wording.** One shared message satisfies any assertion about either
  route, so the test counts the reassurance sentence and expects **two**, and separately asserts
  the *absence* of "your score" from the left branch - the negative half being load-bearing,
  since the file legitimately contains that phrase once.

**And the host must hand the reason over, not merely derive it.** A version that computes
`ConfirmReason` correctly and does not pass it to the panel satisfies every assertion about the
host's own states while silently showing the finished wording to everyone, so `confirmReason={`
is asserted at the call site.

95 tests in `__tests__/games/provider-play-ui.test.ts`, **7 probes red on exactly the expected
test with a blast radius of one** (`tools/probe-confirming-exit.ps1`).

### What it does not do

- **No live leaderboard during play** (section 11's polling recommendation is unimplemented). A
  player sees their standing when they return to the contest page. When they do, **the board is
  now ranked correctly** - it was not until 6 September 2026, when **R37** found that neither
  app's `getCompetitionLeaderboard` passed `score` or `scoreDirection` to the ranking engine, so
  every provider participant tied on zero. See `05` section 2.0b; a document implying the
  provider board has always ranked on score is wrong.
- **No practice mode.** Needs `supportsPractice` and a free, unranked path.
- ~~**No game-aware dashboard.**~~ **Built 6 September 2026 - see section 5.1a.** The sentence
  this replaced named `ActiveCompetitionCard` and `CompetitionsTable` as the screens at fault,
  and **both are orphaned** - nothing renders either. The live one is `ContestsSidebar`. Correct
  as a description of what the plan believed, wrong as a description of the platform.
- **No CSP `frame-src` allowlist.** There is no Content-Security-Policy in `next.config.ts` at all,
  so adding one is a platform-wide change that would also have to account for the Nuvei payment
  flow and the tutorial embeds. There is also **nothing to allowlist yet** - `game_provider` stores
  `baseUrl`, the provider's *API* host, and the spec's own example puts play on a different
  subdomain, so the play domain is a fact we collect from a real provider at X4. Until then the
  message origin is derived from the launch URL we actually loaded, which is the check that
  matters. **Do not record this as done.**

---

### 1.1h The standings scrolled sideways, and the board was in the wrong column (8 September 2026)

The owner's words were **"the standings are not showing correctly"**, with a screenshot of the
arena's left-hand rail: player names cut off, a horizontal scrollbar under the rows, and no score
visible on any of them. Two separate faults, one of which is worse than it looks.

**Fault one: a board with a fixed minimum width inside a narrower column.**
`ProviderLeaderboard` declared `min-w-[320px]` inside an `overflow-x-auto` wrapper - a sensible
pattern for a table on a phone, written when the only place that rendered it was the lobby's main
column. The arena gives it a 260px rail. So the board overflowed by sixty-odd pixels and offered a
scrollbar, and **what fell off the right-hand edge was the score column** - the one number the
board exists to show, on a screen a player refreshes to see exactly that. The row also carried
`flex-wrap`, so each entry became three stacked lines with the avatar on its own.

It now compresses instead. The rank marker and the score are fixed, the name column is
`minmax(0,1fr)` and truncates, and the row does not wrap. **`minmax(0,1fr)` rather than `1fr` is
load-bearing**: a bare `1fr` track is floored by its content's minimum size, so a long name widens
the grid and the row overflows again with no `min-w-` anywhere to blame. The rail went to 280px in
the same edit, because the rail and the board are two halves of one bargain and only one of them
had been stated.

**Fault two, and the general rule is worth more than the instance: grid auto-placement follows
ORDER-MODIFIED document order, so an `order` rule that fires at one breakpoint only leaves every
narrower layout arranged by DOM order alone.** `GameArenaLayout` set `xl:order-1/2/3` and nothing
else, with the standings first in the DOM. The comment beside it said the ordering existed so that
"on a phone the board must come first" - and on a phone it did the exact opposite, because below
`xl` the order classes are not applied at all. Worse at `lg`, where the grid is two columns: the
standings took the wide one and **the board was placed in the 320px sidebar column**.

All three children now carry an order at all three widths. Board first everywhere - phone: board,
standings, facts; laptop: board beside the facts with the standings full width beneath; desktop:
standings, board, facts.

**Three things about the guards.**

- **The order test COUNTS.** A test that merely finds `order-1` somewhere is green on a file where
  two of the three children still rely on DOM order, which is precisely the state that shipped.
- **The column-template test counts too, and a probe is what proved it had to.** The template is
  written twice, once for the heading row and once for the player rows, so restoring the bare
  `1fr` on the heading alone left `toMatch` satisfied and the probe came back **green**. Fifth
  instance of *the same identifier appearing twice defeats a structural test*.
- **The positional test is not redundant with the counting one.** A file can give every child an
  order and still put the board second at `lg`; only slicing back from `{stage}` to the tag that
  renders it can see that. Probe 6 exists for exactly that mutation.

7 probes in `tools/probe-arena-layout.ps1`, all red on exactly the expected test. **Never verified
by eye** - the play screen is behind sign-in and the automated browser has no session.

**A dead guard was repaired alongside it.** `tools/probe-lobby-theme.ps1` still aimed its two
money probes at `components/competitions/PrizeTable.tsx`, and the arithmetic had moved into
`lib/utils/prize-projection.ts` the previous day; the test name it passed to `-t` was stale too.
Both reported `DID NOT APPLY`, **which is indistinguishable from a test that does not work**. Now
23 of 23 red.

---

### 1.1i The entry panel told a game player two untrue things (R65, 10 September 2026)

The owner's report was the wording on the entry countdown. The second defect was found while
reading the file in order to change it.

**What was built.**

| | |
|---|---|
| `describeEntryClose` in `lib/utils/registration-deadline.ts` | One answer to *why* entry closes when it does, and how much time is held back. Three kinds: `reserves_round`, `runs_to_the_end`, `operator_chosen` |
| The entry countdown in `components/trading/CompetitionEntryButton.tsx` | Three sentences for the three rules, replacing one unconditional claim |
| The same panel's closing note | The trading-capital promise is **withheld** from a game contest; the non-refundable warning is not |
| `__tests__/games/entry-close-explanation.test.ts` | 16 tests |
| `tools/probe-entry-close-explanation.ps1` | 12 probes, all red on exactly one failure, plus one deliberately absent with its reason |

**The sentence that was wrong in both directions.** The panel said *"After that no new entries
are accepted, whether or not the competition is still running"* on **every** contest. Under
`until_window_closes` the deadline **is** the moment play stops, so the clause describes a gap
that does not exist. Under `reserve_full_round` the gap is real and the sentence never gives the
reason - so a player who can see time left reads an arbitrary lock-out rather than the rule that
protects them.

**The rule was already right, and that is the finding.** Entry has closed one whole attempt
before play ends since `12` s2.10, and `contest-entry.service.ts` refuses past it. Proven end to
end before a line was written, because a report is a claim about the code rather than a fact
about it - and this claim was about the *surface*. A fix aimed at the deadline would have changed
the one thing that was correct.

**Six things worth carrying.**

- **The explanation lives beside the deadline, not beside the screen.** The span it reports is
  measured from the instant `resolveRegistrationDeadline` returns, including the **legacy clamp**
  against `startTime` - which widens the reserved span past one round on a contest shorter than a
  round. A module recomputing the deadline to describe it is the "one rule, two copies" shape this
  file was extracted to prevent, and here the two sit millimetres apart on screen.
- **It reads the stored policy and never infers one from the arithmetic.** A reserving contest is
  exactly the one whose deadline sits before its end - but the two also coincide whenever nothing
  declares an attempt length, and such a contest behaves **permissively**, because the round-start
  gate reserves `attemptSeconds ?? maxDurationSeconds ?? 0` as well. Calling that a reservation is
  a promise no gate keeps.
- **The trading-capital line was withheld, not relabelled, and it was a live defect.**
  `startingCapital` is `required` only while the contest is trading, and the model says why in as
  many words - *"an invented number is worse than an absent one: it renders in any summary that
  has not yet learned about games."* This panel was such a summary: `|| 0` turned the absent field
  into **"You will receive $0 in trading capital to compete"**, in front of every player about to
  pay to enter a puzzle.
- **The guard wraps the capital clause alone, and the negative half is load-bearing.** Guarding
  the whole info box is the smaller diff and takes the non-refundable warning off every game
  contest with it - and that sentence is true of every game. A test asserts the fee warning
  survives.
- **The misleading clause is COUNTED, not banned.** It is correct for a trading contest whose
  operator chose a deadline, so a test forbidding it outright would fail on correct code and be
  deleted by the first person it inconvenienced. The guard asserts exactly one occurrence and that
  it sits after the last branch test.
- **One probe is deliberately absent with its reason recorded.** Deleting the
  `until_window_closes` early return leaves the suite green - the fourth cause of a green probe, a
  mutation that changes no observable. The branch still earns its place: it is the only thing that
  answers correctly when a permissive contest's deadline sits before its end. A green line in a
  probe list teaches the next reader the branch is decoration.

**Not built.** The countdowns on these screens are still inline text rather than the trading
page's four-cell clock, which is the owner's other request and is its own slice - `LiveCountdown`
computes from `new Date()`, so it cannot simply be dropped onto a game screen that deliberately
runs on `useServerClock`. **Never verified by eye**: the screen is behind sign-in.

---

### 4.1i The arena was dressed in the kit and the game inside it was not (8 September 2026)

The owner's words were **"these graphics are basic, reproduce the graphics"**, beside their
reference mock and a screenshot of the live arena. It reads as a matter of taste and it is not.

**What was actually wrong.** `13` s4.1d built the neon kit and dressed the two lobbies in it.
`4.1?` - the arena slice - dressed the arena's own chrome: the header, the standings rail, the
contest panel. **The three components inside the arena were never touched.** `RoundPreflight`,
`ProviderGameFrame` and `RoundResultPanel` were still wearing `border-gray-700 bg-gray-800/50`,
the application's neutral shell - a flat charcoal card with a grey hairline - and between them
they are the entire centre column. So the biggest thing on the screen, the one the player is
looking at, was the only unstyled element on a page whose every edge had been designed.

**Nothing failed, and nothing could have.** Every structural test in
`__tests__/games/provider-play-ui.test.ts` passed throughout, because none of them had an
opinion about appearance. This was found by a screenshot, which is the honest way to record it.

**What was added, all of it in the kit.**

| Token or component | What the reference draws |
|---|---|
| `NEON_STAGE_FRAME` | The glowing cyan bezel around the board |
| `NEON_STAGE_PANEL` | A lit panel for something the player is acting on - the pre-flight, the result |
| `NEON_HEAD_STRIP` + `NEON_HEADING` | The tinted heading bar every panel in the reference wears |
| `NEON_INSET` | A note box one shade darker than the panel holding it |
| `NeonHeadedPanel` | Panel with that strip, edge to edge |
| `NeonStatStrip` | The reference's figure row, hairline-separated |
| `neonButtonClasses("action")` | The cyan act-now gradient |

**Five things about the shape of it.**

- **Every one of these is ADDITIVE. `NEON_PANEL` was not touched, and that was the decision
  rather than an omission.** The obvious response to "it looks flat" is to turn the base panel
  up, and it is wrong: the reference lights *the things a player is looking at* and leaves
  everything else quiet, so a screen where the quiet card also glows has no focus and reads as
  uniformly loud. It also means **the trading lobby is byte-for-byte unaffected**, so this pass
  cannot have changed a screen nobody reviewed.
- **The lit frame is counted, not merely found.** One frame, on the board. A second one - on
  the pre-flight, which is where somebody would naturally add it - looks correct in a diff and
  destroys the only thing the frame is for. Probe 12 injects exactly that.
- **The act-now button is a second tone rather than a change to `primary`.** `primary` is
  violet because the component sheet says so and both lobbies' navigation already wears it; the
  reference's cyan belongs to the single Play / Resume / Play-again control. And it is exported
  as a **class string** (`neonButtonClasses`) rather than as a component, because that control
  must be a real `<button>` with a handler - creating a round spends a paying player's attempt,
  so it has to be a click and not a navigation, which is the one thing `NeonButton` refuses to
  be.
- **The guard is NEGATIVE, and the positive version would have been green throughout.**
  Asserting the stage imports the kit is satisfied by a file that imports it and hand-rolls a
  grey card beside it - which is literally the state that shipped, since `RoundResultPanel`
  already imported kit colours for its amber panel. The rule names the shell that must *not*
  appear: `bg-` or `border-gray-700/800/900` anywhere in the four stage files. It is scoped to
  surfaces and borders on purpose, because grey **text** is correct and used throughout.
- **The banner is no longer washed out to 20% under a black scrim.** Every game's header looked
  the same shade of empty, so an operator who uploaded artwork could not see that they had. The
  gradient still runs opaque behind the text, which is the only thing it must guarantee.

7 probes added to `tools/probe-arena-layout.ps1`, taking it to 14, **all red on exactly the
expected test**. Typecheck at the 198 baseline exactly, with none in the changed files and none
disappearing. **Never verified by eye** - the play screen is behind sign-in and the automated
browser has no session, so the owner is the first person who will see it.

**What this does NOT close.** The reference also shows a live event ticker, a knockout
"qualified 8/16" count, an up-next bracket and a credits balance. Each needs a data source that
does not exist, and `ArenaContestPanel`'s header already records why inventing one is worse than
omitting it. **Do not let a summary imply the reference is fully reproduced.**

---

### 1.1j The lobby was a photograph (R67, 10 September 2026)

Two owner reports on one screen, and one cause under both: *"while the user see the time and
waiting the competition to start he must refresh the page to see the play button"*, and *"during
the competition the data are not updated live, we must refresh the page"*.

**The cause is the branch being the whole page.** Section 1.1a's game branch returns a complete
screen for a provider contest before the trading markup begins, which is right and is argued for
in the file. The consequence is that **anything mounted above that markup is not mounted for a
game** - and `CompetitionStatusMonitor` was. It is entirely game-agnostic, reading a status, a
cancellation reason, a rank and a prize, none of which are trading concepts. The game lobby simply
never had it, so `CompetitionEntryButton` went on deciding from `competition.status`, a prop frozen
at render, and a player who had already paid watched the countdown reach zero in front of a screen
that had stopped being true several minutes earlier. Nothing errored and nothing was logged.

**Mounting it does not fix the second half**, and merging the two is the mistake a summary
invites. The monitor refreshes on a status *change*; a running contest sits at `active` for its
whole duration, so it never fires. That left **both** lobbies - trading as well as game - showing
the standings that existed when the page loaded, which on the trading lobby is arguably worse,
because a rank there moves with the price rather than only when somebody finishes a round.

#### What was built

| Piece | What it does |
|---|---|
| `components/competitions/LiveContestRefresher.tsx` | Calls `router.refresh()` on a 15-second cadence while the contest is running. Visibility-gated, and refreshes immediately on the way back to the tab |
| The game branch of `app/(root)/competitions/[id]/page.tsx` | Now mounts `CompetitionStatusMonitor` **and** the refresher, above the lobby |
| The trading branch of the same file | Gains the refresher beside the monitor it already had |

**It re-reads the page rather than polling an endpoint, and that is a decision.** There is no
player-facing JSON API that returns a competition's ranking: `getCompetitionLeaderboard` is a
**server action**, and it is where the whole rule lives - the score direction resolved from the
catalogue, the R45 eligibility gate, the tie handling. An endpoint would be a second reader that
can drift from it, the shape behind `referenceId`, `failedReason`, `challengeId` and the Game
Master `||`, **none of which `check:mirrors` can see**. A refresh re-runs the page that already
calls the action, so there is one answer to "who is winning". The cost is a whole server render
rather than one query, taken knowingly: a lobby is not a hot path, and React preserves client
state across a refresh, so an open dialog stays open and a half-typed field keeps its text.

**It must not be mounted on the play screen, and that negative is the load-bearing guard.** That
page hosts the game in an iframe and owns a 20-second poll of `/rounds` which updates the player's
state without re-rendering the frame. A timer calling `router.refresh()` underneath a live round
is a way to disturb an attempt somebody has **paid** for, failing intermittently and
unreproducibly. It is the obvious next step for anybody fixing that screen's own stale sidebar, so
the test is what stops it being fixed the easy and wrong way.

**Running is read from the stored status, never computed from a clock.** A contest whose end time
has passed is still `active` until a cron finalizes it, so a client deciding for itself stops
refreshing exactly while the last rounds are being scored. This is the mutation most likely to be
made deliberately, because it reads as more accurate, and it is probed.

**The trading lobby was included deliberately** rather than scoped to games: the owner's
instruction was *"all pages related to live data like scoring standings"*, and a live board on one
lobby beside a photograph on the other is the inconsistency this programme keeps finding. It is
safe here because this is the **lobby** - the trading workspace at `/trade` is a separate route
with its own 15-second live-ranking poll, and nothing is re-rendered underneath an open position.

13 tests in `__tests__/games/live-contest-refresh.test.ts`, 12 probes in
`tools/probe-live-contest-refresh.ps1`, **all red on exactly the named test**. Typecheck error
lists identical before and after - nothing added and nothing disappeared. **Never verified by
eye**: both lobbies are behind sign-in and the automated browser has no session.

**Two surfaces are deliberately still stale and must not be summarised as done**: the play
screen's own standings sidebar, and the dashboard contest cards, where `ContestsSidebar` polls
challenges every ten seconds and reads competitions from static props.

---

## 2. Provider scoping - the mistake that must not be made

Six React context providers are mounted on the two trade pages today:

`PriceProvider`, `SymbolConfigProvider`, `ChartSymbolProvider`,
`TradingArsenalProvider`, `PositionEventsProvider`, `TradingModeProvider`

**They must be mounted inside the trading branch of the dispatcher, never in a shared
`/play` layout.** Hoisting them to a shared layout would open a price-feed subscription
and a position-event stream for every player in a chess contest. This is risk **R18** in
`17`, and it is the most likely way to accidentally make provider contests expensive and
slow.

These stay mounted globally and are unaffected: `AppSettingsProvider`,
`FingerprintProvider`, `GlobalPresenceTracker`, `ChallengePopup`, `AnnouncementBanner`.

---

## 3. Shared components versus trading components

`components/trading/` holds **63 files**. Roughly 40 are genuinely trading-only - charts,
order entry, positions, market watch, indicators. Roughly 20 are the **contest shell**,
which every game needs and which is currently misfiled.

**Move to `components/contest/`:** `CompetitionCard`, `ChallengeCard`,
`CompetitionLeaderboard`, `LiveRankingPanel`, `CompetitionInfoHeader`,
`ChallengeInfoHeader`, `CompetitionEntryButton`, `ChallengeEntryActions`,
`LiveCountdown`, `InlineCountdown`, `UTCClock`, `CompetitionStatusMonitor`,
`ChallengeStatusMonitor`, `ParticipantStatusMonitor`, `CompetitionStatusWrapper`,
`WalletContent`, `DepositModal`, `WithdrawalModal`, `WalletBalanceDisplay`.

Do this as a **standalone commit with no logic changes**, so that if an import breaks it
is obvious what caused it - risk **R19**.

---

## 4. Contest lists, cards and the lobby

| Surface | Change |
|---|---|
| Cards | Game badge, game artwork, provider-neutral labels. No provider branding - the player sees a ChartVolt game |
| List filters | Filter by game; retain sort by start time and pot size |
| Lobby - `app/(root)/competitions/[id]/page.tsx` | Rules from the game's catalogue entry, a **Play** button instead of Enter Terminal, the play window and grace period, attempts used and remaining |
| Ranking labels | `lib/services/ranking-config.service.ts` - per-game labels, so a chess contest does not say "PnL" |

For provider contests the lobby must show three things the trading lobby never needed:
**when the play window opens and closes**, **how many attempts remain**, and **what
happens if a round does not finish**. Players will hit all three, and a lobby that does
not answer them generates support tickets.

### 4.1a What is built of this row, and what is not (6 September 2026)

Three parts done, the lobby itself outstanding. Stating the split matters because "the play
screen works" has been read as "the lobby is game-aware", and it is not.

| Part | State |
|---|---|
| The CTA's destination | **Built.** `CompetitionEntryButton` sends a provider contest to `/play` and a trading contest to `/trade`, using the strict `isProviderContest` because a destination needs the keys, not just the label. Both trade-history links are withheld and **counted** in a test, so a third unguarded one cannot hide behind them |
| The play window, attempts and refusals | **Built, on the play screen** - section 1.1b. The pre-flight now reads `contestStatus` as well, so it refuses what the server would refuse instead of offering a button that errors |
| The leaderboard's ranking metric | **Built.** R37, `05` s2.0b |
| The lobby page itself | **Built 6 Sep 2026** - see 4.1b |
| Ranking labels per game | **Partly built.** The score column's heading comes from the title's `scoreType`, so a time trial says "Time" rather than "Score". The full `ranking-config.service.ts` pass is still outstanding |
| Filter by game | **NOT built**, and deliberately deferred: there is one provider game, so a filter with one option is friction on a page players use daily. Revisit when the catalogue has a second title |

### 4.1b The lobby, built as a branch rather than as guards (6 September 2026)

`app/(root)/competitions/[id]/page.tsx` renders `ProviderContestLobby` and returns, and the
trading path below it is **byte-identical**. Everything below the branch is the forex lobby -
difficulty computed from leverage and starting capital, an asset-class list, a margin explainer,
"Enter Terminal", and a leaderboard whose columns are profit and loss - and for a puzzle contest
it rendered all of it **without an error.** Nothing crashed because the fields a provider contest
lacks are either guarded or filled by schema defaults, which was **measured against a real
MongoDB** (`__tests__/services/provider-contest-lobby-shape.test.ts`) rather than assumed. A
paying player simply read a trading screen for a game with no market.

**Why one branch and not conditionals.** Threading guards through 1,100 lines of trading layout
touches every line the live trading lobby depends on, to serve a contest type that has never had
a player. Branching once leaves the trading path unchanged, and that is the only thing which
makes the existing lobby behaviour trustworthy evidence that nothing moved - the same argument
that kept a known one-character defect verbatim while the settlement stages were extracted.

Six facts about it drift easily:

- **It branches on the LABEL, via `hasProviderGameLabel`, not on the strict
  `isProviderContest`.** A contest labelled provider but missing its provider key cannot launch a
  round, so the strict helper is right to refuse it - and it is **still not a trading contest**,
  so showing it the trading lobby would hand a puzzle player an Enter Terminal button. The lobby
  answers *what kind of screen is this*; whether Play can work is a separate question the
  component asks with the strict helper and **refuses with a stated reason**. Reusing the strict
  helper here compiles and reviews as correct.
- **The branch must sit ABOVE the trading computation**, and a test asserts its position rather
  than its presence. Placed after `getDifficultyData()` it would still render the right screen
  while computing leverage and starting capital for a contest that has neither.
- **The leaderboard is a different component, not a restyled one.**
  `CompetitionLeaderboard`'s row type declares `currentCapital`, `pnl`, `pnlPercentage` and the
  trade counts, and its props demand a `prizeDistribution` and a `minimumTrades`. Rendering it
  would put zeroed profit and loss, and a "minimum trades" qualification note, in front of a
  player who has never traded - `05` section 10's binding rule broken in the most visible place
  available. `ProviderLeaderboard` shows rank, player and one score.
- **An absent score is not zero.** A player mid-contest has no score, and rendering that as 0
  puts them level with someone who genuinely scored nothing. This is the read-side form of the
  `score ?? 0` that made every provider participant tie in R37.
- **The board must not decide the ranking direction.** Rows arrive already ordered by
  `calculateRankings`, which resolves the direction once from the catalogue. A `.sort()` here
  would be a second place for the direction to be decided, which **is** R37.
- **`isRegistrationClosed` was extracted, not copied.** The trading lobby held it inline with a
  clamp against `startTime` that exists for documents an old bug wrote with a deadline an hour
  *before* the start. A second copy forgetting the clamp would silently refuse entry to those
  contests, with the contest visibly upcoming. Sixth "one rule, two copies" avoided.

`__tests__/games/provider-play-ui.test.ts` (**43 tests**, up from 28) and
`tools/probe-provider-lobby.ps1` (11 probes, all red). The figure was written as 54 before being
checked - **run the suite rather than adding up the diff**, which is the same duty as verifying a
throwaway aside.

**A harness lesson came with it, and it produced a false result first.** One probe reported GREEN
because its `Test` string was missing an apostrophe, so vitest's `-t` matched nothing, ran zero
tests, and the absence of a failure line read as "the guard did not fire". **A `-t` filter
matching no test is a fault in the probe, never in the code**, and all three harnesses now report
it as `PROBE BROKEN` in its own colour rather than as a green.

### 4.1c The theme pass - one product, two games (owner requirement, 6 September 2026)

> **SUPERSEDED THE SAME DAY BY 4.1d, AND KEPT AS HISTORY RATHER THAN REWRITTEN.** Read 4.1d for
> what is built now. Four claims below are stale as *present* facts and each one is worth knowing
> was once true: `components/games/lobby-ui.tsx` **no longer exists**; the 3D `GameIcon` set and
> the rank medals are **no longer used on either lobby**; the trading page is **no longer
> byte-identical**, because the owner decided it should be restyled too; and the class-string
> comparison tests described here **have been replaced**, for the reason given in 4.1d. What
> survives intact is the *argument* - why a game lobby wearing a stranger's chrome is a trust
> problem rather than a taste problem - and the rule that sharing the chrome must never become
> sharing the content.

The lobby built in 4.1b was **correct and looked like a different application.** It answered all
three of section 4's questions, showed no trading figure, and used flat lucide glyphs, its own
narrower container, its own small plain headings and its own card shells. The owner's instruction
is short and worth quoting as the acceptance criterion: *"make the games lobby identical like the
trading lobby theme we need consistency, the game lobby however will not show any trading related
content or stats but the theme must be the same."*

**Why this is not a cosmetic ticket.** A player reaches both lobbies from the same
`/competitions` list, one click apart. A different corner radius, border tone, heading size or
icon style is not read as *a different game* - it is read as *a different website*, and on a
platform that takes entry fees that is a trust problem rather than a taste problem. It is also
the mirror image of the defect this whole chapter exists for: 4.1b stopped a game contest wearing
trading **content**, and this stops it wearing a **stranger's chrome**.

**What is shared, and what is emphatically not.** The chrome is shared: the page shell, the
back-button-and-UTC-clock header, the gradient hero with an icon watermark behind it, the
uppercase hero figures, the two-thirds/one-third grid, the panel shells, the 3D `GameIcon` set,
the rank medals, the tinted row cards and the blue "You" chip. The content is not, and `05`
section 10 makes that binding rather than stylistic: no capital, no margin, no leverage, no asset
classes, no profit and loss, no trade counts.

Five facts drift easily:

- **The live code is `components/games/lobby-ui.tsx`** (`HeroFigure`, `SidePanel`, `PanelRow`,
  `PanelNote`, `StatusBadge`), plus the rebuilt `ProviderContestLobby.tsx` and
  `ProviderLeaderboard.tsx`. None of the three is mirrored, so `check:mirrors` says nothing about
  any of them. Read those, not this prose.
- **`lobby-ui.tsx` is NOT an abstraction over the trading lobby and must not become one.** The
  trading page keeps its own copies of every class string and is still byte-identical.
  Refactoring it to import from here would destroy the guarantee that makes the trading lobby's
  behaviour trustworthy evidence that nothing moved - the same trade that kept a known
  one-character fee defect verbatim during the settlement extraction. A document describing this
  file as shared UI *between* the two lobbies is describing a change that has not happened and
  should not.
- **The consistency is pinned by tests that read BOTH lobbies and compare them**, not by
  hard-coded class strings. Seven `it.each` cases assert the same string appears in the trading
  page *and* in the game lobby, so restyling the trading hero turns them red and points at the
  game lobby that has to follow. A snapshot of today's design would have stayed green while the
  two screens drifted apart, which is the failure the guard exists for. **The paired-document
  drift rule, applied to code.**
- **The hero keeps trading's GOLD gradient**, with the game identity carried by a `joystick1`
  watermark and a violet catalogue-name pill. The style sheet below is drawn in violet, and a
  violet hero would have been the mock-accurate choice and the inconsistent one. Consistency was
  the instruction; the mock is the future direction.
- **The count pill says "players", never "traders".** The trading lobby's identical pill says
  traders, and copying the shell wholesale is the trading-shaped-label problem in the one place
  on the page a player is certain to read. Same class as `matchmaking.service.ts`: **the label
  agrees with the old world and keeps agreeing after it ends.**

**The accent lookup is a `Map`, and the comment beside it is load-bearing.** Tailwind compiles
the classes it can *see* in the source, so `border-${accent}-500/30` names a class that exists in
the TypeScript and in no stylesheet - the panel renders completely unstyled, which reads as a
broken CSS build rather than as a bug in that file. A test asserts no partial class is ever built
by interpolation. It is a `Map` rather than an object for the reason the round-resolution action
list is one: object indexing walks the prototype chain, and *safe by accident is not safe*.

`__tests__/games/provider-play-ui.test.ts` is now **55 tests**, up from 43, and
`tools/probe-lobby-theme.ps1` is **15 probes, every one red on the expected test with a blast
radius of exactly 1**. Full suite 966 tests green, typecheck at the 15-error baseline, lint clean.

**Not verified by eye, and saying so is part of the deliverable.** The automated browser has no
session and the page is behind sign-in, so this was proven by comparison against the trading
lobby's own source and by the suite - **not by a screenshot.** Owner review is the remaining step.

#### The saved design reference

`External game plans/design-reference/` holds the two images the owner supplied, deliberately
committed rather than left in a chat. **There are now seven, catalogued in that folder's own
`README.md`, which is the file to read** - the table below is left as it was written, with one
correction inline because it is a wrong *fact* rather than a superseded *decision*:

| File | What it is |
|---|---|
| ~~`trading-lobby-as-built.png`~~ → `trading-lobby-target.png` | Described here as "the live trading lobby, the theme being matched". **It was a mock, not a capture, and the filename was wrong.** Proven when the owner re-supplied the same picture as a *target* and the two files came back **byte-identical**. Renamed, and the folder's `README.md` now labels every image mock or capture so the mistake cannot repeat |
| `game-lobby-target-and-style-sheet.png` | A game lobby mock-up (*Circuit Perfect*) beside a **ChartVolt style sheet** - background and header art, an icon set, stat cards, four status cards, four button styles, a leaderboard row, avatars, panels and glow elements |

The owner's framing: *"see the image how the app will have the theme in the future, just save
that for reference, modify as needed, the images data are just examples."* So the numbers,
names and artwork in them are illustrative, and **the style sheet is a direction of travel, not
an acceptance criterion for this slice.** Three things in it are genuinely not built and must not
be summarised as done: the **hero artwork** per game (the mock's car; we render an icon
watermark), the **four stat cards as bordered tiles** (the trading lobby renders plain figures on
the gradient, and trading is the reference the instruction named), and the **footer help strip
with a View Rules button** - a rules surface for a provider title is real outstanding work, since
the trading lobby's rules accordion is entirely trading content and a game has nothing to put in
it yet.

> **Amended 11 September 2026.** The last sentence is now false and is kept rather than rewritten,
> because the reason nobody looked is the useful part: a game *did* have something to put in it.
> R63 found on 10 September that `rulesSummary` and `howToPlay` had been demanded of providers,
> validated on arrival and then discarded by a parse bug. Both are stored now, and **`13` s4.1k
> renders them on the lobby and on the play screen.** The footer strip stays a help link, which
> is a different thing from the rules of one game.

### 4.1d Both lobbies rebuilt on one design kit (owner requirement, 6 September 2026)

**The instruction reversed the direction of 4.1c.** That slice made the game lobby match the
trading lobby, because consistency was the ask and the trading lobby was the thing to be
consistent with. The owner then supplied a full component sheet and five screen mocks and said:
*"remake the lobby for all games and trading to match the images exactly with the icons images
colours etc, we will start making the app look more game themed."* So the reference moved. The
trading lobby is no longer the standard - **the sheet is**, and the trading lobby is one of the
two screens that had to change to meet it.

Saying that plainly matters because 4.1c's central engineering decision - keep the trading page
byte-identical, so its unchanged behaviour is evidence nothing moved - **is exactly what this
slice had to give up.** That guarantee was not traded away casually and section 4.1e below says
what replaced it.

#### What was built

| Piece | Files | Notes |
|---|---|---|
| The kit | `components/neon/tokens.ts`, `Cards.tsx`, `Hero.tsx`, `Buttons.tsx`, `Accordion.tsx`, `LeaderboardRow.tsx`, `banners.ts` | **None of it is mirrored.** `check:mirrors` says nothing about any of it |
| The artwork | `public/assets/neon/banner-{circuit-sprint,circuit-perfect,trading,championship}.webp` | Generated, then converted PNG → WebP: **8.0 MB → 564 KB** |
| The game lobby | `components/games/ProviderContestLobby.tsx`, `ProviderLeaderboard.tsx` | Rebuilt on the kit. `lobby-ui.tsx` **deleted** |
| The trading lobby | `app/(root)/competitions/[id]/page.tsx` plus `components/trading/lobby/{TradingLobbyHero,TradingLobbySidebar,trading-lobby-accordions}.tsx` | The page went from **1,224 lines to 377**. The prize table was here as `TradingPrizeTable.tsx` until 7 Sep 2026 and is now `components/competitions/PrizeTable.tsx`, shared with the game lobby - s4.1h |
| The trading board | `components/trading/CompetitionLeaderboard.tsx` | Row shell and column headings now come from the kit; its columns are unchanged |

#### Six facts that drift easily

- **`components/neon/` is not `components/arena/`, and the near-miss is worth recording.** The
  kit was first written into `components/arena/`, which already holds the **Live Arena broadcast
  dashboard** - an unrelated, existing feature. Nothing collided at build time; the two would
  simply have shared a folder and a naming prefix for ever, and the next reader would have had no
  way to tell which `Arena*` component belonged to which feature. **Check what a plausible folder
  name already means before taking it.**
- **The accordion is the only `"use client"` file in the kit, so it is the only boundary - and it
  took the trading lobby down in production.** It accepted `icon: LucideIcon` and built the tile
  itself; a React component is a *function*, which cannot cross a server/client boundary, so
  every request to a trading contest's lobby rendered the error boundary. It is now handed the
  icon **already rendered**, exactly as the sibling `content` prop always was. Three things
  nothing in the pipeline could catch, all worth carrying: **a green `next build` is not evidence
  that a dynamic page renders**, because `ƒ` routes are never prerendered; the typecheck is happy
  because **no type in this codebase means "serialisable"**; and the guard written for it was
  itself green on the reintroduced bug, because `typeof !== "function"` and "has `$$typeof`" are
  **both satisfied by a lucide icon** - a `forwardRef` is an object carrying
  `Symbol.for("react.forward_ref")`. `isValidElement` is the check. Recorded as **R39**.
- **An asset path is unverifiable by the compiler, so a test asserts every banner file exists.**
  The artwork was first committed to `public/assets/arena/` while the kit had moved to
  `components/neon/` - four string literals pointing at nothing. Nothing would have failed: no
  type error, no build error, no log line, just a broken image on every lobby on the platform.
  `allNeonBanners()` exists so the test exhausts the map rather than sampling it, and a probe
  restoring the wrong path turns it red. **Any string that names a file rather than a symbol needs
  an assertion, because the compiler has no opinion about it.**
- **The icon set is a deliberate REVERSAL, not a drift.** 4.1c required the 3D `GameIcon` PNGs
  and banned lucide glyphs; this slice requires the opposite on both lobbies. The sheet specifies
  flat line glyphs in tinted rounded tiles, and since the trading lobby moved too, the platform
  moved rather than one screen diverging. A document citing 4.1c's icon rule as current is stale.
- **The hero is violet-family now, not trading's gold.** 4.1c's reasoning - consistency beats
  mock-accuracy - was correct *while the mock was the future*. The owner has made the mock the
  present, so the gold hero is gone from both screens.
- **Each contest type gets its own hero banner, resolved from `banners.ts`, and a game we have no
  art for falls through to a generic trophy.** A visibly generic fallback is acceptable here in a
  way it never is for a number: an operator sees a wrong-looking banner immediately, whereas a
  defaulted figure is believed. The map is local rather than a `provider_game` field because
  artwork per title is a catalogue-content question that belongs with the game pages, and adding
  a field now would put a URL nothing maintains in front of players.
- **The trading sidebar's nine always-open cards became four open items and six accordions**, and
  which stayed open is pinned by a test rather than left to judgement. Open: the entry control,
  the countdown, the schedule, the prize table - everything a trader *decides* on. Collapsed:
  eligible assets, trading rules, scoring, risk management, disqualification, prizes detail -
  reference material. Burying a decision would be the same class of error as an aggregate that
  quietly means trading only: correct-looking, and wrong exactly where it matters.
- **The count pill wording is still per-screen on purpose.** `NeonCountPill` exists because both
  lobbies had hand-written the same seven-class string - the "one rule, two copies" shape behind
  `referenceId`, `failedReason`, `challengeId` and the Game Master `||`. But the *words* stay
  with the caller: a game has **players**, a trading contest has **traders**, and a shared label
  would be wrong on one of the two screens.

#### What is still not built, and must not be summarised as done

- **A rules surface for a provider title.** The sheet's footer strip has a **View Rules** button;
  the game lobby renders a link to `/help/competitions` instead, because the catalogue stores a
  `description` and no rules summary or how-to-play. A button that opens nothing is worse than an
  honest destination.
  > **BUILT 11 September 2026, `13` s4.1k.** The stated reason was already false when this was
  > written: the catalogue *had* been given `rulesSummary` and `howToPlay`, and a parse bug was
  > discarding them (R63). Both are now rendered on the lobby and on the play screen by
  > `GameRulesPanel`. The footer strip deliberately stays a help link.
- **The equity chart on the trading hero** is unchanged from the existing dashboard component;
  the sheet's styling of it was not applied.
- **The announcements panel and the "Share Event" button** in `trading-lobby-target.png` are not
  features that exist.
- **The four `future-*.png` mocks** - dashboard, competitions hub, game arena, leaderboards - are
  a later phase by owner decision, and most of what they show is missing **data**, not styling.
  See `design-reference/README.md`.
- **Never verified by eye.** Both pages are behind sign-in and the automated browser has no
  session, so this was proven by the suite and by reading the source. **Owner review is the
  remaining step**, and any claim of visual sign-off before that is wrong.

### 4.1e What replaced the byte-identical guarantee

4.1c kept the trading page untouched so that its behaviour was evidence nothing had moved. Once
the owner asked for it to be restyled, that evidence was unavailable, so three things were put in
its place - and the reasoning generalises to any restyle of a screen that computes money.

- **The money computation was extracted whole and is asserted character for character.**
  `TradingPrizeTable.tsx` carries the unclaimed-position redistribution, the bonus split and the
  platform-fee deduction exactly as the page had them. A test pins four expressions verbatim,
  and two probes - changing the denominator, and dropping the fee - go red. **Extracting and
  restyling in one commit is normally forbidden**; where it is unavoidable, the calculation needs
  an assertion that cannot pass a rewrite. (**The file is `components/competitions/PrizeTable.tsx`
  since 7 Sep 2026**, and those same four assertions are what proved the move behaviour-free -
  see s4.1h.)
- **The consistency guard changed shape, because the old one could not survive this.** Comparing
  class strings between two files works for two files. The sheet covers **seven** screens, and
  pairwise comparison of seven is twenty-one comparisons, the first missing one of which is
  silent. The property is now **one definition, and no screen has chrome of its own**: the
  kit-owned literals are asserted to appear in the token file and in *no* consumer, so
  re-introducing a bespoke panel to either lobby turns a test red and names the file. **This is a
  stronger claim than the old one and it does not grow with the number of screens.**
- **The negative assertion is the one that matters.** "Both lobbies import the kit" is trivially
  satisfiable - a file can import the kit and hand-roll a panel beside it, which is precisely how
  the drift starts.

`__tests__/games/provider-play-ui.test.ts` is **56 tests**; `tools/probe-lobby-theme.ps1` is
**23 probes**. Two of them exposed defects in the guards rather than in the code, both from
families already recorded here: a `/<NeonHero/` match **passed while the component had been
swapped for `<NeonHeroReplacement`**, because a prefix match cannot distinguish a component from
one whose name starts the same way; and `/neonRowClasses\(/` was satisfiable by the **import
line** alone. Assert the call with an argument, and put a boundary character after a tag name.

### 4.1f The lobby shows a joined player the clock (7 September 2026)

The lobby *had* a countdown, and it was in the one place it could not be seen by the person who
needed it. The hero's fourth tile counts down - but only for a player who has **not** entered.
Once they do, it is replaced by "Your score". **So the countdown vanished at exactly the moment
it started to matter**, and the player with the most reason to watch the clock was shown no
clock at all.

Fixed by a second `InlineCountdown` in the play-window panel, the same component the trading
lobby and the hero tile use. A third implementation of "2d 4h" would be a third place for the
wording to drift, which is the shape behind several defects here. **The test counts the
countdowns rather than matching one**, because the hero's has been there all along and a bare
`<InlineCountdown` match is green on the bug - and a probe removing the new one proves the count
is what holds the property.

**And a note that had become false was rewritten, not deleted.** The panel told players "the
play window can be narrower than the competition itself, so check both." That was true when an
operator set four separate dates; since `12` s2.3 derived the window from the contest clock it
is false. **A player-facing caution that has become false is worse than none** - it sends
somebody looking for a second pair of times that no longer exists, and it reads as though
someone checked. Same duty as rewriting the operator's `exclude`-refund warning once the refund
became automatic.

It was replaced rather than removed because the fact players actually need in its place is the
one the owner asked about: **every player gets the same window, and a round still open when it
closes is closed with the competition.** See `11` seam 3 for the settlement half of that
sentence.

### 4.1g A design guard that had started failing correct code (7 September 2026)

Worth recording because the failure was in the **guard**, not the code, and the fix narrowed a
rule rather than deleting it.

4.1d's rule banned the 3D `GameIcon` set from both lobbies, which was right about the screens'
own iconography. Written as a blanket ban on the identifier it also forbade the provider
leaderboard the **level badge** that `CompetitionLeaderboard` - the trading board this kit
exists to match - has always rendered. A `userTitleIcon` is a piece of **user data**, no more
chrome than the avatar or the username beside it.

So the guard would have enforced exactly the inconsistency it was written to prevent. **The
distinction that carries the rule is the `name` prop**: a literal (`name="trophy"`) is the
screen choosing a glyph, which the sheet specifies as a flat lucide glyph in a tinted
`IconTile`; a bound one (`name={row.userTitleIcon}`) is rendering data. Rank medals stay banned
outright, because the kit draws ranks with `NeonRankBadge`.

The general form: **a guard that fails on correct code is the fastest way to have it deleted
wholesale**, which here would have cost the rank-medal half too. Narrow it to the property it
actually holds.

**And the half this section originally missed, found the same day by re-running the harness.**
Narrowing the rule left its probe in `tools/probe-lobby-theme.ps1` aimed at the *old* property,
so it reported **green** and read as a hole in the icon guard. The mutation it injected -
`icon={Trophy}` becoming `icon={GameIcon}` - is a component reference in a **prop**, which
`<GameIcon name="` cannot match by construction. It is still refused, just **by the compiler**:
every `icon` prop in the kit is typed `LucideIcon` and `GameIcon` requires a `name`. Re-aimed at
an injected `<GameIcon name="trophy" />` **element**, which is the screen choosing its own
chrome and exactly what the narrowed rule claims, it goes red on the expected test.

Two rules, the first general: **when you narrow a guard, re-aim its probe in the same edit**, or
the two quietly describe different properties and the probe is the half that looks broken. The
second joins the four causes of a green probe already on record - weak test, wrong claim, missing
test, unreachable guard - with a fifth: **a structural probe aimed at a defect the compiler
already refuses reports green and is indistinguishable from a guard that has stopped working.**

### 4.1h The game lobby shows what each place is worth (7 September 2026)

**Owner request**, from the trading lobby's sidebar: the prize-distribution panel. The game
lobby showed a prize pool and an entry fee and **never said what second place was worth**.

**The live code is `components/competitions/PrizeTable.tsx`**, rendered by
`TradingLobbySidebar.tsx` and `ProviderContestLobby.tsx`. **Not mirrored.**

#### Five facts that drift easily

- **It was MOVED out of `components/trading/lobby/TradingPrizeTable.tsx`, not copied**, and the
  move is the deliverable. A second copy of a payout calculation is the "one rule, two copies"
  shape behind `referenceId`, `failedReason`, `challengeId` and the Game Master `||` - none of
  which `check:mirrors` can see, since it compares models. A document naming the old path is
  stale as a present fact though correct as history, so **say which**.
- **Nothing in the calculation was ever about trading**, which is why the move needed no
  generalisation: it reads the prize pool, the configured shares, the participant count and the
  platform fee, and a provider contest carries all four in the same fields. The **four
  expressions asserted character for character in `provider-play-ui.test.ts` moved with it
  unchanged**, and that is what makes the move provably behaviour-free - a document describing
  the move as a refactor with the tests rewritten is describing something else.
- **The panel says the figures are a FLOOR, and that sentence is load-bearing rather than
  cautious.** The table redistributes an unfilled *position*, which is a question about how many
  people entered. It cannot see a player who entered and recorded **no result** - eligibility is
  settled at finalization by `hasResult` (R45) - so a contest with three entrants and one score
  pays differently from what the panel shows. Teaching the table to predict a result is not
  possible before the contest ends, so the caution is the honest fix. It is the same caution the
  admin sidebar carries.
- **It is hidden when no shares are configured**, because a free or practice contest has none and
  an empty panel headed "Prize distribution" reads as data that failed to load rather than as a
  contest without prizes.
- **One pre-existing quirk was deliberately left.** `bonusPerWinner` divides the unclaimed share
  by the number of *filled* positions, so a contest with paid positions and no entrants at all
  shows every row at its base percentage - correct - while the banner above still quotes the
  whole unclaimed figure. Changing it during a move would be a payout-facing change smuggled
  into a commit whose whole claim is that nothing moved.

### 4.1j The game lobby got the trading lobby's clock (owner requirement, 10 September 2026)

The owner's words: **"the timer must be the same graphics as the counter in trading competition
countdown"**. It is the fourth and last item of the 10 September report, after R65, R66 and R67.

**This is presentation work and no defect was found**, which is worth stating plainly because
every other entry from that report carries a risk number. The game lobby's clocks were correct,
they were simply small: three lines of `InlineCountdown` text where the trading lobby has a panel
of four large cells - days, hours, minutes, seconds - that a player can read across a room. So
there is **no risk register entry, nothing was backfilled and no money was ever involved.**

#### What was built

| Piece | Where | Mirrored |
|---|---|---|
| The four-cell panel, one definition | `components/competitions/CountdownPanel.tsx` | No |
| Trading's countdown, now rendering it | `components/trading/LiveCountdown.tsx` | No |
| The game lobby's countdown, on the server's clock | `components/games/ContestCountdown.tsx` | No |
| The mount, under the entry control | `components/games/ProviderContestLobby.tsx` | No |

18 tests in `__tests__/games/contest-countdown.test.ts`, 16 probes in
`tools/probe-contest-countdown.ps1`, **all red on exactly one failure**. Full suite 2091 passing,
typecheck error **lists** identical before and after, `check:mirrors` 80 agree / 0 drifted -
correctly silent, since nothing here exists in `apps/admin`.

#### The five things worth carrying

- **The appearance was extracted and the CLOCK deliberately was not, and that is the whole
  reason this is two components rather than one reused twice.** The two callers disagree about
  what time it is, on purpose. Trading reads the browser's clock, as it always has. The game
  screens read the **server's**, because every rule about when a contest opens, when an attempt
  may start and when entry shuts is enforced on our servers against our time - and a clock
  working from a visitor's own computer is wrong in both of the directions that cost something:
  a button offered when the window has shut, or withheld while it is genuinely open. Neither
  records an error, because neither *is* one. `CountdownPanel` is therefore handed a number of
  milliseconds and knows nothing about clocks at all. **A later "consistency" pass that unifies
  the two clocks is a behaviour change to a screen nobody was asked to touch**, and there is a
  probe in each direction because both read as tidying up.
- **`LiveCountdown` renders nothing for a `type`/`status` pair it does not recognise - including
  `status: "completed"`, which its own props admit and nothing handles.** That is the second
  reason the game lobby does not simply render it: a mismatch produces an empty space and no
  error, which is exactly how a countdown goes missing without anybody being told. It is
  **latent, not live** - both existing callers (the trading sidebar and the challenge page) always
  pass matched pairs, verified rather than assumed - so it is **pinned by a test and deliberately
  left alone**, because changing it in the same edit as the move would destroy the only evidence
  that nothing moved. `ContestCountdown` has no such gate: the caller decides whether a clock
  belongs on the screen, in the open.
- **The negative assertion is the load-bearing half.** "Does the screen import the shared panel"
  is trivially satisfied by a screen that imports it *and* hand-rolls its own cells beside it,
  which is how "the same graphics" becomes two panels that drift on the first edit. So the guard
  checks six of the panel's own literals - the grid, the large digits, the `Mins`/`Secs`
  captions, the ending-soon badge and both gradients - and requires them to appear in
  `CountdownPanel.tsx` and in **no consumer**. Picking those markers needed a grep first:
  `grid-cols-4` alone appears in the lobby's own hero, and `uppercase tracking-wider` appears in
  about forty files, so a guard built on either would have failed on correct code and been
  deleted by the first person it inconvenienced.
- **An unparseable target must refuse rather than clamp.** `splitDuration` treats anything
  non-finite or negative as zero, and **zero is the FINISHED state** - so without the
  `Number.isNaN` guard in `ContestCountdown` one bad stored date renders "Competition has ended!"
  over a contest that is running. A missing clock is recoverable by reading the schedule panel; a
  confident wrong one is not. The same reasoning keeps the target prop as `string | number | Date`
  rather than a narrowed ISO string: `new Date(x).toISOString()` **throws** on a bad value, and
  converting at the call site would put that throw inside the lobby's render, where one stored
  date takes the whole page down instead of one panel.
- **It is mounted once, not once per contest state, and reuses `countdownTarget`.** The trading
  sidebar writes two blocks, one for upcoming and one for active; here a single block switches on
  `isActive`, because `countdownTarget` is already the answer to "which clock matters now" and is
  what the hero tile and the play-window row count down to. A second block, or a date resolved
  separately, is a third chance for this one screen to contradict itself. Position is asserted
  rather than presence - entry control, then the clock, then the details, the same order as the
  trading sidebar - because a player comparing the two screens should not have to look in two
  different places.

#### Deliberately not changed

- **`RoundPreflight`'s four time readouts stay inline text.** They are clocks embedded in
  sentences - "Play closes in 4m 12s", "Less than a full round is left. Start now and you get
  2m 30s of play" - and they explain a *gate*, not the contest. Four-cell grids would destroy the
  sentences, and trading has no large-panel equivalent for them either.
- **The hero tile's `InlineCountdown` stays small**, because the trading lobby's hero tile is
  small too. The test pinning **exactly three** `InlineCountdown` instances in
  `ProviderContestLobby.tsx` is therefore still green and unmodified: this slice **added** a
  clock rather than replacing one.
- **Never verified by eye.** Both lobbies are behind sign-in and the automated browser has no
  session, so the owner's review is the first time this is seen.

### 4.1k The rules an operator wrote were shown to nobody (11 September 2026)

The owner's words: **"in the game providers we have rules that are not shown anywhere in game
area or competition area fix a place to have the rules the admin set in woding that stants
out"**.

They were right, and the cause sits one step further back than the report suggests. **R63, on
10 September, fixed a parse bug that had been discarding `rulesSummary` and `howToPlay` on every
catalogue sync**, so both are now stored and both are editable by an operator in the Game Content
dialog. What nobody then checked is whether anything *read* them. Nothing did:
`getGamePresentation` - the one reader every player-facing game screen goes through - did not
name either field in its projection. So a paying player could see the pot, the entry fee, the
clock, the prize split and the standings, and **never be told what a winning score was.**

On a lower-is-better title that is not a gap in the copy, it is the difference between playing
the game and playing it backwards.

**The live code is `components/games/GameRulesPanel.tsx`, the three additions to
`lib/services/games/game-presentation.service.ts`, the mount in `ProviderContestLobby.tsx`, and
the `rules` slot on `components/games/arena/GameArenaLayout.tsx` filled by
`app/(root)/competitions/[id]/play/page.tsx`.** None of it is mirrored - `apps/admin` has no
player lobby and no play screen - so `check:mirrors` says nothing about any of it.
13 probes, all red on exactly one failure.

#### Six facts that drift easily

- **The field was stored and unread, which is a different defect from the one R63 fixed and was
  invisible for the same reason.** A document describing this slice as fixing the sync, or as
  making the fields editable, is describing 10 September's work; a document implying R63 put the
  rules in front of a player is wrong. Say which half.
- **One panel, two screens, and the NEGATIVE assertion is the load-bearing half.** Importing
  `GameRulesPanel` is trivially satisfied by a screen that then writes its own rules block beside
  it, which is how the lobby and the arena end up describing one game's scoring differently. The
  guard is that the two headings - "How you win" and "How to play" - appear in the panel and in
  **no** consumer. A document describing the guard as "both screens import the panel" is
  describing the half that cannot catch a disagreement.
- **The heading negative had to be narrowed, for the `s4.1g` reason.** The first version forbade
  the phrase "is scored" anywhere in a consumer and **failed on correct code**: the lobby's
  `UNRESOLVED_POLICY_COPY.score_zero` legitimately says "it is scored zero and the competition
  still settles on time". A guard that fires on correct code is the kind the first person it
  inconveniences deletes, so it names the two block headings and nothing else.
- **Only the SCORING rule gets the emphasis, and that asymmetry is deliberate.** `rulesSummary`
  sits in an amber-bordered block; `howToPlay` is plain. A player can discover the controls by
  trying them and cannot discover the direction - whether a lower time beats a higher one - by
  any amount of playing. Emphasising both is how a page ends up with no emphasis at all, and a
  test asserts the amber treatment appears **exactly once** and **before** "How to play".
- **An absent field renders NOTHING, not a heading over an empty box**, and this is the common
  case rather than an edge one: every title synced before R63 carries neither value, so until
  task 17's catalogue re-sync runs, **this panel is invisible on every contest**. The service
  normalises a stored `""` to `undefined` and the panel trims before deciding, because a cleared
  field can legitimately hold an empty string. A heading reading "How Circuit Sprint is scored"
  above nothing tells a player the game has no rules.
- **The lobby's own `ProviderGame.findOne` was collapsed onto the shared reader, and that is part
  of the deliverable rather than tidying.** It had its own projection and its own hand-written
  `.lean<{...}>` generic, so adding a field to `GamePresentation` would have shown the rules on
  the play screen and silently not on the lobby - task 20.1's defect exactly, where two
  hand-written projections of one document mean a new field arrives `undefined` at whichever
  caller nobody remembered, with nothing failing. Two pre-existing tests that pinned the old
  projection were **flipped rather than deleted.**

#### Deliberately not changed

- **The footer help strip still points at `/help/competitions`.** How competitions work is a
  different thing from the rules of one game, and the trading lobby's link goes to the same
  place. The stale comment beside it - which said a provider title had no rules surface because
  the catalogue stored only a `description` - is **corrected in place with the old wording
  quoted**, because it was believed for five days and is the reason nobody looked.
- **`ArenaContestPanel`'s "Round time" tile still states the title's nominal length.** It is
  recorded rather than built: `RoundPreflight` already discloses the shortened figure on the
  server clock, and the game's own countdown is authoritative once `games-service` is rebuilt, so
  a third server-rendered statement of the same clock would be stale the instant it was drawn.
- **The in-frame board rules in `games-service/src/games/instructions.ts` are a separate thing**
  and were not touched. Those are the service's own instructions, shown inside the iframe; this
  panel is the platform's copy of what the operator published in the catalogue.
- **Never verified by eye**, and there is a second reason here: until the catalogue is re-synced
  there is nothing for the panel to render, so even a session would show an empty result.

---

## 5. Dashboard

`components/dashboard/` is about **15 components** backed by
`comprehensive-dashboard.actions.ts`, a single action of roughly **1,700 lines**.

| Change | Note |
|---|---|
| Split the mega-action into per-section loaders | Risk **R21**. Do it because trading data must not be fetched for a player who has never traded |
| Hide the trading section entirely when `tradingEnabled === false` | Not an empty panel - absent |
| Hide the trading section for a player with no trading history | Their dashboard should be about the games they play |
| Add per-game summary cards | Contests entered, best finish, current rating per game |

**A player who only plays provider games must never see an empty trading panel.** In the
external-only scenario this is the majority of new players, not an edge case.

### 5.1a The contest cards, made game-aware - BUILT 6 September 2026

`lib/actions/comprehensive-dashboard.actions.ts`, `components/dashboard/ContestsSidebar.tsx`,
`components/dashboard/ActiveCompetitionCard.tsx` and `components/dashboard/CompetitionsTable.tsx`.
18 tests in `__tests__/games/provider-dashboard-cards.test.ts`, 17 probes in
`tools/probe-dashboard-cards.ps1`, all red on the expected test. **None of it is mirrored.**

**The first thing to get right is that the plan named the wrong components.** Section 1's
deferral note - and every summary built on it - said the offending screens were
`ActiveCompetitionCard` and `CompetitionsTable`. Both are **orphaned**: `rg` finds no importer
for either. The component the dashboard actually renders is **`ContestsSidebar`**, which nothing
in this chapter mentioned. Fixing only what the plan named would have produced a green suite, a
closed to-do item and a dashboard still showing "P&L" against a puzzle score. The two orphans
were made game-aware anyway, because the plan names them and a future reader restoring one would
otherwise restore the defect - but **the live fix is the one the plan did not ask for.** General
form, and it is the counting rule in a new shape: **before fixing the component a document names,
grep for its importer.**

- **The data layer was the real defect; the components could only render what they were given.**
  `comprehensive-dashboard.actions.ts` selected neither `gameType` nor `score`, so no card could
  have branched even if it wanted to, and `getDashboardRankingValue` computed a **trading**
  ranking value for every contest. That is the trading-shaped-service failure again: it returned
  a number, the sort ran, the page rendered, and provider participants were ordered by a PnL
  none of them has. Fixed by dispatching to the game registry and resolving the direction through
  the shared `resolveScoreDirection`, so the dashboard, the contest leaderboard and settlement
  now answer the direction question from one place.
- **A score of zero and no score at all must render differently.** The action previously read
  `participation.score || 0`, which is the read-side twin of the write-side hole behind R37 - a
  player whose round has not reported yet is shown a hard `0`, indistinguishable from having
  played and scored nothing. The value is passed through undefined and the card renders `–`.
- **Three parallel switches on game type is three chances to add a game and update two of them.**
  `ContestsSidebar` had `formatCompMetric`, `getCompMetricLabel` and `isCompMetricPositive`, each
  switching separately, so the next game could easily be formatted as a score, labelled "P&L" and
  coloured red for a good result. Collapsed into one `describeCompMetric` returning value, label
  and tone together. The tone needed a third state: **a score is neither profit nor loss**, and
  without a `neutral` case every provider score inherits green-or-red, which reads as a judgement
  the platform has not made.
- **The provider card must not link at `/play`.** Launching a round consumes an attempt and
  Next.js prefetches `<Link>` targets on hover, so a dashboard card pointed at the play route
  could spend a paying player's only attempt without them clicking. Both provider cards link at
  the contest page, which is the safe landing - the same reasoning that made the play screen a
  state machine rather than a redirect.
- **Type the new component to the fields it actually reads.** The provider card's props are a
  narrow structural type rather than the outer component's `any`, so a future edit reaching for
  `pnl` fails to compile. It earned that immediately: the narrow type caught an unguarded
  `currentRank > 0` comparison that `any` had been hiding.

**Still trading-shaped, and deliberately not touched:** the trading panels themselves, the
per-game summary cards, and the mega-action split (R21). Those are the rest of this section.

### 5.1b The contest cards, made live - BUILT 11 September 2026

The last stale surface from the owner's "all pages related to live data" instruction. The cards
were game-aware from s5.1a and still read their competitions from props frozen at page load,
with a countdown computed once, at render, from a clock nothing re-read.

Built in **two commits, deliberately**. The first extracted the rank calculation and changed no
behaviour; the second added the polling. `lib/services/games/dashboard-contest-rank.service.ts`,
`app/api/competitions/dashboard-live/route.ts`, `COMPETITION_LIVE_DATA` in
`lib/utils/performance.ts`, and `components/dashboard/ContestsSidebar.tsx`. 21 tests in
`__tests__/games/provider-dashboard-cards.test.ts` and 15 in
`__tests__/games/dashboard-live-refresh.test.ts`; 7 probes in `tools/probe-dashboard-rank.ps1`
and 14 in `tools/probe-dashboard-live.ps1`, every one red on exactly one failure. **None of it
is mirrored** - `apps/admin` has no player dashboard.

**The reason for two commits is that the extraction's only guarantee is that nothing moved, and
that guarantee is destroyed by any behaviour change in the same diff.** The comparator was moved
character for character, the four pre-existing ranking guards were re-pointed at its new home
with a note that the claims are unchanged and only the location moved, and the typecheck sat at
the 194-error baseline on both sides of the move. Same reasoning as extracting the settlement
stages while a known one-character defect was preserved verbatim.

- **COUNT THE WRITERS, and the count was wrong again.** The plan for this slice said "the
  dashboard sorts its own ranks", which reads as one copy. There are **four**: the dashboard
  action, and **two more in `app/api/dashboard/competitions/route.ts`** at lines 366 and 439.
  That route is the **public, unauthenticated broadcast display** behind `/arena`,
  `TraderChampionshipClient.tsx` and `deploy/competition-dashboard.html`, and it is
  trading-shaped - it selects neither `score` nor `gameType`, so it would rank a provider contest
  on `pnl` and tie every player at zero **on a screen with no sign-in in front of it**. It is
  **recorded as a named exception with a test asserting it is STILL an offender**, not fixed: it
  is its own finding and its own commit, and a stale exception reads as a known problem long after
  it is solved while silently re-permitting the defect (the R60 rule). When it is fixed the canary
  goes red, which is the signal to delete the exception.
- **The cards could not use the lobbies' answer, and that is a measurement rather than a
  preference.** Both lobbies re-read their own page on a timer (`LiveContestRefresher`, s1.1j)
  because a server action holds the direction, the R45 eligibility gate and the tie handling, so
  an endpoint would be a second reader that can drift. `getComprehensiveDashboardData` cannot be
  polled at all: upwards of twenty database round trips, unbounded `TradeHistory` and
  `WalletTransaction` reads, a ten-thousand-row participant fetch, and
  `getUserGlobalRank` calling `getGlobalLeaderboard(999999)`, which takes seconds cold. **A
  cheap page is refreshed; an expensive one needs a narrow endpoint** - and a narrow endpoint is
  exactly the second reader the lobbies avoided, which is why the rank came out first.
- **The property that matters is AGREEMENT with the action, not liveness, and the strongest
  guard is a text comparison of the two select strings token for token.** The player sees a
  figure on load and this endpoint's figure in the same place fifteen seconds later, so any
  field where the two disagree *looks like the value changed*. The clearest casualty is `pnl`:
  the endpoint reports the **stored** participant value exactly as the action reads it, and
  deliberately does **not** recompute unrealized profit from open positions and live forex
  prices. The challenge endpoint next door does recompute and is right to - a 1v1 is two numbers
  against each other - but here it would make the number jump on first refresh for every trading
  contest, **a defect dressed as an improvement**. Making both live is one commit touching the
  action and the route together.
- **An absent score stays absent.** `score ?? 0` in the endpoint would claim a score the player
  has not been given, the read-side form of R50, and it would contradict the card beside it,
  which renders `-`.
- **The countdown ticks on the BROWSER clock, and that is the policy rather than an oversight.**
  s4.1j settled it: trading surfaces read the browser's clock as they always have, the game lobby
  reads the server's through `useServerClock`, and the dashboard is a trading surface. **Adding a
  tick is additive; changing the clock is a behaviour change to a screen nobody asked to touch.**
  The tick also re-reads on `visibilitychange`, because a laptop closed for two hours returns to
  a card whose next interval has not fired yet.
- **The asymmetry is why this was missed, and it is the R67 shape one screen along.**
  `/api/challenges/dashboard-live` has existed since long before games did, and `ContestsSidebar`
  opens on the challenges tab by default - so refreshing worked on the path everybody tests and
  the competitions tab was a photograph of page load. **A feature that works on the default tab
  is not a feature that works.**
- **The render assertion is the load-bearing half.** A version that fetches correctly, merges
  correctly and still renders the props it was given satisfies every assertion about the fetch,
  so a test pins `const activeComps = liveComps;` *and* the absence of
  `const activeComps = competitions.active`. Same class as importing a shared module and then
  recomputing beside it.
- **Three smaller things, each of which fails silently.** A malformed response is ignored rather
  than rendered - `if (!Array.isArray(data.competitions)) return;` before the setter, or one bad
  reply empties the sidebar. The merge is order-preserving and **drops a contest the endpoint
  stops reporting**, or a finished contest sits on the dashboard for ever. And the poll keeps its
  **own** mounted flag: sharing the challenge poll's would let that effect's cleanup silence this
  one, with no error and nothing in a log.

**Two incidentals, recorded rather than absorbed.** The new service and the new route each carry
a **rule-scoped** `no-explicit-any` disable with its reason, not the blanket
`/* eslint-disable */` the dashboard action opens with - and typing the `.lean()` rows was
deliberately **not** done, because a hand-written lean generic makes the compiler check an
invented interface instead of the schema, which is precisely where the missing
`participant.score` read hid for a day (R32/R33). The select-string comparison is the guard that
can actually catch divergence. And `lib/utils/performance.ts` carried two pre-existing
object-injection warnings which the pre-commit hook's `--max-warnings=0` turns into a block on
any edit to the file; they are silenced in place with a reason, the key coming from
`Object.keys` of the object being read.

**Never verified by eye** - the dashboard is behind sign-in and the automated browser has no
session.

---

## 6. Results page

`app/(root)/competitions/[id]/results/page.tsx`.

| Change | Note |
|---|---|
| Dispatch the performance breakdown to the module | Trading shows trades and PnL; a provider game shows the generic `scoreBreakdown` from `01` |
| Show the replay link where the provider supplies one | This is what support quotes when a player disputes a prize - `06` |
| Handle unresolved rounds honestly | If a round never reported, say so and say what the policy did. Silence here reads as theft |

### 6.1a What was built - a player's own record of a game contest (7 September 2026)

**Owner request:** the game equivalent of the trading "see details" screen, which is what a
player who entered sees once the contest has ended.

The three rows above are honoured, and the dispatch is a **branch to a separate screen** rather
than a generalised page. That is the deliberate part: this page is the trading post-mortem and
nothing else - capital, ROI, win rate, profit factor, trade-by-trade - and `05` s10's rule
applies to a whole screen as readily as to one figure. Generalised, explicitly scoped, or
absent; there is no fourth option.

#### Files

| Piece | File | Mirrored? |
|---|---|---|
| The screen | `components/games/ProviderResultsScreen.tsx` | No |
| The reads | `lib/services/games/contest-results.service.ts` | No |
| The refund read | `findUnscoredRefund` in `lib/services/settlement/unscored-refund.ts` | **Yes** |
| The branch | `app/(root)/competitions/[id]/results/page.tsx` | No |

#### How it maps onto the trading screen

Kept deliberately parallel, so a player with one of each does not have to learn two products.

| Trading | Here |
|---|---|
| Final Rank | Final rank, plus whether it is shared |
| Total P&L | Final score, labelled with the contest's direction |
| Win Rate | Rounds played, and how many scored |
| Total Trades | Prize won |
| Account Summary | How your score was worked out - the attempts policy, in words |
| Trading Statistics | The counted round's own `scoreBreakdown`, humanized |
| Trade History | Round history, with each attempt's outcome and time |

#### Five facts that drift easily

- **A redirect that stops a crash is not a feature.** This branch redirected a provider player
  to the lobby for two days. That stopped the throw and left them with no record of their own
  rounds - the lobby shows the *public* leaderboard. A document describing the guard as
  sufficient is describing the crash fix, not this screen.
- **The refund read is NOT in the results service, and cannot be.** Chapter 11 seam 4 bans every
  money import from `lib/services/games/` blocked-by-default, and invariant 6 of
  `__tests__/services/round-lifecycle.test.ts` enforces it by scanning import strings. It caught
  this on the first run. The read lives beside its writer and the **page** composes the two. A
  document showing `refundedAmount` on `ProviderContestResults` is describing the version the
  guard rejected, and **"reads are fine" is not a property a rule about imports can express.**
- **`"no_score_recorded"` is one exported constant**, `UNSCORED_REFUND_REASON`, because it is now
  read as well as written. Two literals would drift in the worst direction available: refunds
  keep being written correctly while the screen stops finding the row, so a player who **was**
  refunded is told nothing.
- **The refund explanation is driven by the ledger row, never by `unscoredContestPolicy`.** The
  policy says what was configured; the row says what happened to this player. A contest
  configured to refund whose players were paid a prize has no row.
- **An absent score renders `-`, never `0`** - the read-side form of R45, for the fourth screen
  in a row. And **a `sum_of_n` contest shows every scored round rather than one breakdown**,
  because that policy marks nothing as counted and picking one would misstate how the total was
  reached.

---

### 6.1b The button that went back to the page it was on (8 September 2026)

**Owner report:** pressing **View Competition Details** on a finished game contest must open the
competition details page - the lobby a player sees when they join - the way it does for trading.

It did not. It did nothing at all, and the mechanism is worth stating precisely because the
symptom was invisible.

`/competitions/[id]` redirects a **participant of a completed contest** to `/results`, which is
right: that is what they came back for. `?view=details` switches the redirect off so they can
return to the lobby. The game results screen had **two** links to the lobby - the header button
and the **Full leaderboard** button - and both were written **without the query string**. So the
lobby redirected the player straight back to the results screen they were standing on. No error,
no log line, no navigation they could perceive. The button looked broken because it was.

**Trading's three links carried the query string, which is exactly why this survived** - the
feature worked on the path everybody tests, and the string was composed by hand at each call
site, so a new screen had no way to inherit it.

#### Files

| Piece | File | Mirrored? |
|---|---|---|
| The one definition | `lib/utils/competition-details-view.ts` | No |
| The gate | `app/(root)/competitions/[id]/page.tsx` | No |
| The two results links | `app/(root)/competitions/[id]/results/page.tsx` | No |
| The Full leaderboard button | `components/games/ProviderResultsScreen.tsx` | No |

`apps/admin` has no results screen and no such redirect, so there is nothing to mirror and
`check:mirrors` correctly says nothing about it.

#### Five facts that drift easily

- **This is the "one rule, two copies" shape in its smallest form**, after `referenceId`,
  `failedReason`, `challengeId` and the Game Master `||`. The gate read a literal and the links
  wrote a literal, so they *could* disagree - and the failure mode when they did was a control
  that silently does nothing, which is this codebase's recurring worst case. One module,
  imported by both sides, cannot drift.
- **The round trip is the load-bearing assertion, and neither half can substitute for it.** A
  test on the gate passes against its own copy of the format; a test on a link passes because
  the URL is valid. Only feeding what `competitionDetailsHref` produces into
  `wantsCompetitionDetailsView` can fail - and it is the only probe of the six that no
  single-sided assertion catches.
- **The links are COUNTED, not merely found.** The results page has one in each branch, and a
  test proving "a link through the helper exists" is green on precisely the bug that was here:
  the trading branch correct and the provider branch dead.
- **One bare `/competitions/[id]` link in that file is CORRECT and must not be forbidden.** A
  visitor with no seat is redirected to the lobby, and the gate requires a seat, so that path
  must not carry the override. A blanket structural ban would fail on correct code, which is
  the fastest way to have a guard deleted.
- **A repeated parameter now reads as a request for the details view.** Next.js types it as an
  array, so `?view=details&view=x` was `["details", "x"]` and `=== "details"` was `false` - the
  safe direction, but nobody chose it, and it silently loses the button on a malformed link.

Pinned by `__tests__/games/competition-details-link.test.ts` (8 tests) and
`tools/probe-competition-details-link.ps1` (**6 probes, all red with exactly 1 failure each**).
Nothing about the lobby itself changed, so the game-agnostic lobby of s4.1b and s4.1d is what a
player now actually reaches.

---

## 7. Leaderboard, profile and cross-game stats

### 7.1 Leaderboard

`app/(root)/leaderboard/page.tsx` with `LeaderboardClient.tsx` and
`LeaderboardContent.tsx`. Today the global leaderboard is computed by
`lib/actions/leaderboard/global-leaderboard.actions.ts`: an `overallScore` formula with
**nine terms, five of them trading-specific**, roughly **7 seconds** to rebuild, cached
**5 minutes**, capped at **5,000 users**.

| Change | Note |
|---|---|
| Back it with `UserGameStats` | Per-game rows plus an `"_overall"` rollup - `04` |
| Tabs: Overall, per game, seasonal | Per `05` |
| Per-game rating column | Provider games support a per-game skill rating - `05` |

**Run the new and old leaderboards in parallel and diff the top 100 before switching.**
Players notice rank changes immediately and read them as unfair - risk **R14**.

### 7.2 The profile page

**Added 2 September 2026.** Until now the profile appeared in this plan only as
"terminology pass 6 - profile tabs and headings", which treats a structural change as a
labelling one. The owner's brief lists the profile alongside stats and the leaderboard,
and it is the screen where a player checks whether the platform has understood what they
did.

| Change | Note |
|---|---|
| A **cross-game summary** at the top | Contests entered, contests won, total winnings, level, XP. All defined for every game per `05` section 10 |
| A **per-game breakdown** below it | One row or card per game the player has actually played, with that game's own metrics and skill rating |
| Trading becomes **one entry** in that breakdown | Not the page. Its own metrics - PnL, win rate, trade count - live inside its card, where they are correctly scoped |
| Hide games the player has never played | An external-only platform may carry twenty titles. Twenty empty cards is not a profile |
| Badges and journey progress stay | Generalised per `05` section 10; a trading-only journey is gated on `tradingEnabled` |

**The naming problem is on this page more than anywhere else.** A profile header that reads
"Total Profit" is a trading metric presented as a life-time total. It has to become either
an explicitly trading-scoped figure inside the trading card, or a genuinely cross-game one
such as total winnings. Which of the two is open question 13; what is *not* open is that it
cannot stay ambiguous, because the number will be wrong for every player who plays anything
else - and it will be wrong silently, since the calculation keeps working.

**Two things to check before building it**, both of which decide the layout rather than
following from it:

1. **Open question 14 - does historical trading performance enter the cross-game
   aggregates?** If it does, long-standing traders dominate every rollup on a games
   platform. If it does not, their profile appears to lose history, which reads as a bug
   and generates support load. The answer belongs in `18`'s backfill, and this page is
   where players will see whichever answer was chosen.
2. **The public profile is a different surface.** `GET /api/user/profile/public` already
   exists and exposes a limited field set. Whatever is added to the private profile must
   be decided separately for the public one, or a per-game statistic leaks by default -
   which matters more once matchmaking (`20`) makes other players' profiles worth looking
   at.

### 7.3 Where the stats come from

`UserGameStats` is the single source for both surfaces - per-game rows plus an `"_overall"`
rollup (`04`). Two rules follow, and both exist because the alternative fails quietly:

- **The profile must not compute aggregates of its own.** If the profile derives a total
  its own way, it will disagree with the leaderboard, and the disagreement will be reported
  as a prize bug rather than a display bug.
- **Never present a rollup that only some games contribute to.** Either the rollup covers
  every game or it is labelled as covering one. `05` section 10 is the binding rule.

---

## 8. Arena

`/arena` is a spectator broadcast of live trading, gated on `arenaEnabled` plus
`redirectIfRestricted("trade")`.

**Leave it trading-only.** Add a `tradingEnabled` check so it disappears with the rest of
trading. A spectator broadcast of a provider game is a genuinely good idea and entirely
new work with no dependency on this programme - and in the external-only scenario it
would also depend on the provider exposing live round state, which `01` does not require.

---

## 9. Help and static content

`app/(root)/help/page-content.tsx` is roughly **10,700 lines**.

| Change | Note |
|---|---|
| Restructure into per-game sections | Do **not** rewrite the trading guide - it is correct and valuable |
| Add a games section | How a provider contest works, play windows, attempts, what happens if a round fails |
| `/api/help-settings` | Reads `TradingRiskSettings`. **Must not fail when trading is disabled** |
| Legal pages - `SitePage`, seeded from `lib/constants/default-pages.ts` | Legal review track, not a wording pass - risk **R11** |

The help article on **what happens when a round does not finish** carries real weight
here. With an in-house game, failures are rare and ours. With a provider, they are
someone else's and will happen. Explaining the policy in advance is far cheaper than
arguing it afterwards.

---

## 10. Navigation and landing

| Surface | Change |
|---|---|
| `components/UserSidebar.tsx` | Rename the "Trading" section via a terminology token (`14`). Add **Games**. Gate Marketplace and Live Arena on trading |
| `MobileBottomNav.tsx` - **7 tabs** | Games replaces or joins the trading entry, per `16` |
| `/api/settings` | Already carries `arenaEnabled`. Extend with `tradingEnabled`, `enabledGameTypes`, `externalGamesEnabled` |
| Landing - `HeroSettings`, `LiveCompetitions`, `LiveChallenges`, `LiveStatsBar` | Game-neutral copy; `lib/constants/landing-page-templates-*.ts` has ~**230** trading matches |

---

## 11. Realtime during play

A provider round runs inside an iframe, so ChartVolt does not own the in-round loop. Two
things still need updating live: **the contest leaderboard** and **the player's own
round status**.

| Approach | Verdict |
|---|---|
| Poll a contest state endpoint every 2-5 seconds | **Recommended.** Simple, and provider callbacks arrive at unpredictable intervals anyway |
| Reuse the websocket server on port **3003** | Later, if polling load justifies it |
| Server-sent events, following the `PositionEventsProvider` precedent | Viable middle ground |

Start with polling. Provider scores arrive by webhook, not continuously, so a live
push channel adds infrastructure for very little perceived gain.

---

## 12. Effort

| Task | Estimate |
|---|---|
| `/play` dispatcher, `/trade` redirect, provider scoping | 3 days |
| Move shared components to `components/contest/` | 2 days |
| Game badges and filters on lists and cards | 2 days |
| Lobby game-awareness - windows, attempts, rules | 3 days |
| Dashboard restructure and mega-action split | 5 days |
| Leaderboard tabs on `UserGameStats`, parallel diff | 4 days |
| **Profile: cross-game summary, per-game breakdown, trading demoted to one card** | **3 days** |
| Results page dispatch, replay link, unresolved handling | 3 days |
| Navigation and conditional visibility | 2 days |
| Help restructure and the round-failure article | 4 days |
| Landing and marketing copy | 2 days |
| **Total** | **~33 days (~6.5 weeks)** |

Split across **X7** and **X8**; the provider-specific play and result screens from
`09` E6 are counted separately.

---

## 13. Acceptance criteria

- [ ] A player can browse, join, play and collect prizes for a provider game **without
      seeing a trading screen** — **play and results done** (5 Sep 2026, s1.1a); browsing is
      not, so the contest is still found in the trading-shaped `/competitions` list
- [ ] The six trading providers do **not** mount for a provider contest - verified in the
      browser, not assumed — **structurally true** since `/competitions/[id]/play` is a
      separate route that mounts none of them, but **not yet verified in a browser**, which is
      the half of this criterion that catches a provider hoisted into a shared layout
- [x] `/trade` still resolves for every existing link — it renders trading as before and
      redirects **only** a provider contest, which nothing could previously reach through it
- [ ] A player with no trading history sees no trading panel anywhere
- [ ] `tradingEnabled = false` produces a coherent product with no dead links and no
      empty panels
- [ ] The leaderboard top 100 is unchanged on the day of the switch
- [ ] Help explains play windows, attempts and unresolved rounds before a player meets
      them
- [ ] The profile shows a **cross-game** summary plus a per-game breakdown, with trading
      as one card rather than the page
- [ ] **No figure on the profile is a platform-wide label over a trading-only
      calculation** - `05` section 10
- [ ] The profile and the leaderboard agree, because both read `UserGameStats` and neither
      computes its own aggregate
- [ ] The **public** profile's field set was decided deliberately, not inherited
