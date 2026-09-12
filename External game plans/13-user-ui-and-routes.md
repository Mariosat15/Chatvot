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

> **Both closed since, and the paragraph above is kept as history rather than rewritten.** The
> dashboard cards on 10 September 2026 (s5.1b) and the play screen's sidebar on 11 September
> (**s4.1o**). Neither uses this component: the dashboard because a page re-read there is a
> seven-second rebuild, and the arena because **the prohibition higher up this section still
> stands** - it polls a narrow endpoint and swaps only its own panels, leaving the iframe's
> subtree untouched.

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

### 4.1l One clock, not two (owner instruction, 11 September 2026)

**BUILT.** `components/competitions/CountdownPanel.tsx` gained an optional `details` slot,
`components/games/ContestCountdown.tsx` passes it through, and the game lobby's "Play window"
card was folded into the four-cell countdown above it. 5 tests changed or added, **23 probes red
on exactly one failure**.

The owner's words, with the screen circled: *"since you make the timer more priority and big the
first one keep that but the second timer with the start and end and the info merge them with the
above timer no need to have 2 so merge them into the big one"*.

**THE DUPLICATION WAS OF A CLOCK, NOT OF A CARD, AND THAT IS WHY IT WAS REMOVED RATHER THAN
RESTYLED.** s4.1j put the large four-cell panel on the game lobby counting down to
`countdownTarget`. Directly beneath it sat a card headed "Play window" carrying `Opens`, `Closes`
and a row reading `Closes in` - and that row counted down to `countdownTarget` as well. Since
`12` s2.3 derives the window from the contest clock, `playWindowStart` **is** `startTime` and
`playWindowEnd` **is** `endTime`, so the screen stated one instant twice, in two sizes, one above
the other. A screen cannot disagree with itself about a value it renders twice from one
expression; it can look careless, and the next edit to either copy is where it starts disagreeing.
That is the same class as the dashboard card that could contradict the page which drew it.

**What survived the merge, and why exactly one countdown did.** `Last attempt can start in`
stayed, because it counts down to a *different* moment - the last instant a new round may open
under `reserve_full_round` - which is precisely the test the removed row failed. The lobby's
`InlineCountdown` count therefore moves from three to two, and the test asserting it was
**updated with the reasoning rather than relaxed**: if it falls, one of the two real clocks has
gone; if it rises, the merged one has crept back.

**THE SCHEDULE IS ONE NODE WITH TWO HOSTS, and the second host is not optional.** The countdown
is withheld from a finished or cancelled contest, and the window's open and close are still facts
on one - so something has to render them when there is no clock. The obvious way to write that is
to paste the rows into both places, which is the "one rule, two copies" shape behind
`referenceId`, `failedReason`, `challengeId` and the Game Master `||`. Instead `scheduleDetails`
is built once as a variable and handed either to the countdown or to a card headed `Schedule`,
and the test **counts** `label="Opens"` rather than merely finding it.

**The slot appears in all four of the panel's branches, and the test counts them.** A branch that
forgets it is a card which sheds half its content at the exact moment it changes state: the clock
reaches zero, the layout jumps, and the schedule disappears with no error. The branch most likely
to be forgotten is `ended`, which is the one a player is looking at when that happens.

**Three probes had to be re-aimed and the reason generalises.** The render guard was written
inline as `{countdownTarget && !isCompleted && !isCancelled && (` and is now the named
`showCountdown`, because two hosts have to agree about whether there is a clock. Left alone those
probes reported `DID NOT APPLY`, which reads like a broken harness rather than a moved target -
the trap the play-shape harness sat in for a day. The test that scanned the 200 characters before
`<ContestCountdown` was re-aimed at the constant's **definition**, with a second assertion that
the render actually reads it: a definition carrying both clauses beside a render that ignores it
is the silent half-fix, and every assertion about the constant passes.

**The trading lobby is untouched.** `details` is optional and trading passes nothing, so
`LiveCountdown` renders exactly the card it rendered before. Trading keeps its own schedule
accordion, which is a different shape for a screen with four operator-set dates.

**Never verified by eye** - the lobby is behind sign-in.

---

### 4.1m The arena on the owner's reference (11 September 2026)

The owner supplied `arena-target-full.png` with one line of verdict: *"the structure is very not
professional, redo the design, see image 3 as an example, I need that"*. All ten images are
committed to `External game plans/design-reference/` with a README labelling each one mock or
capture, because a mock mislabelled as a capture has already cost this programme a day.

**THE FIRST THING TO ESTABLISH IS THAT THE REFERENCE SPANS TWO REPOSITORIES, AND THE BOUNDARY
RUNS STRAIGHT DOWN THE MIDDLE OF IT.** `ProviderGameFrame` renders one lit frame around a bare
`<iframe>` and **nothing whatsoever inside it**. So the round header (`ROUND 2/5`, `TIME LEFT`,
`SCORE`), the board and its bezel, the `Hint / Undo / Clear` rail, the `LEVEL / Moves / Best
Time / Combo` column and `SUBMIT SOLUTION` are all drawn by `games-service/public/play/`, a
separate repository sharing no code with this one by design (`npm run check:isolation`). **A
document describing this slice as a redesign of the arena is describing about half of it**, and
one proposing to style the board from here is proposing something the isolation guard refuses.

**Five things on the reference have no data source on either side of that boundary**, and are
recorded rather than invented: **Hint** and **Undo** (both are changes to how the game is
played, and a *paid* hint is forbidden outright - nothing in the marketplace may improve a
player's score in a paid contest), **Moves / Best Time / Combo**, the **LEVEL 3** progress bar,
the **GLOBAL / FRIENDS / COUNTRY** leaderboard tabs, and the **RECENT PLAYERS** activity feed.
`13` s4.1d already records the live ticker as not built for the same reason.

> **AMENDED 11 September 2026, twice, and the amendments run in opposite directions - so a
> document citing this list as it stands is wrong in both.** The **RECENT PLAYERS feed had a
> source all along** and is built: `game_round.scoreBreakdown` has been stored since X3 and no
> board read it (`13` **s4.1n**). And the **in-frame half was authorised by the owner** and is
> built (`21` **s4.1q**) - the round header, the rail, the stats column and `SUBMIT SOLUTION` -
> which took **Undo** and **Moves** off this list as well, because Undo is strictly weaker than
> the Clear button that has always been there and Moves is a count of completed drags. **The
> remaining refusals are `SCORE`, `Hint`, `Combo`, the `LEVEL` number and the three leaderboard
> tabs**, and the first two are refusals of *principle* rather than of effort: `PlayState`
> carries no score by design, and a hint improves a score in a paid contest. Read `21` s4.1q
> before restating any of this.
>
> **A third amendment, same day (`13` s4.1y): the three leaderboard tabs are now DRAWN.** They
> still cannot be answered - there is no friends model anywhere, and publishing a player's country
> on a public board is a disclosure decision - so `GLOBAL` is lit and the other two are rendered
> as disabled labels with the reason in a title attribute. **Drawn and unanswerable is not the
> same as built**, and a document listing them as absent is stale while one listing them as
> working is wrong.

#### What the platform half actually lacked

Three things, and only the first is a matter of appearance.

**The prize amounts had no heading at all.** They rendered directly beneath the contest facts,
so `50%` beside a rank badge read as one more fact about the contest rather than as what a
winner is paid. The heading is now the **caller's**, in a `NeonHeadedPanel` titled *Prize
breakdown* with a `Top {n} win` pill, and `PrizeTable` still carries none of its own - **both
halves or neither**, because the component is rendered in three places and on both lobbies it
sits inside an accordion that already has a heading. A heading inside it reads as two headings
there, gets deleted, and the arena silently loses it again. The pill **counts** the paying
positions; the reference's "Top 3 win" is three because that mock pays three, and a literal is
a caption wrong for every contest but one.

**The player's own position was nowhere on the screen.** On a board of twenty-five rows that is
the one figure they are looking for. It is **read off the row the server already ranked**, never
worked out here: `calculateRankings` resolves the contest's score direction once from the
catalogue title, so a screen deciding its own order is a second place that decision is made -
**the exact shape of R37**, where the board and the payout disagreed because each had worked it
out separately. An absent rank renders a **dash**, never `#1`, which is the read-side form of
the phantom `score: 0` that R50 removed.

> **A guard that fired on correct code, and the narrowing is recorded rather than quietly
> applied.** The first version of that rule banned `scoreDirection` anywhere on the arena. It
> went red immediately, and the code was right: `scoringSummary` turns the direction into the
> sentence telling a player whether a high score or a low one wins, which the screen **must**
> say and cannot say without reading it. The rule is now that the panel's only use of it is as
> an argument, the page never sees it at all, and **two control probes must stay green** - the
> page reading a score for display, and the describing sentence being reworded. Same lesson as
> s4.1g's `GameIcon` ban: a guard that fires on correct code is the kind the first person it
> inconveniences deletes.

**The heading block put the genre, the title, the description and the facts in one flex row**,
so the contest's name competed with a badge and three lines of operator copy for a single line's
worth of attention. That is what "not professional" was describing. The genre badge now sits
**above** the heading (asserted by position, not presence, since both were in the same row
before), the title is larger, the facts became a right-hand column at `lg`, and the description
is **`line-clamp-3`** - it is an operator field with no practical length limit, and unclamped it
pushes the board below the fold on a screen the player is paying by the attempt to use.

#### The reference's three-panel bottom band was tried and reverted

This is the part worth keeping, because the reason is not visible in the mock. `GameRulesPanel`
and `ArenaHighlights` both return `null` when they have no content, and **rules text is absent
on every title until the catalogue is re-synced**, which is the common case today. **A layout
cannot see that its child rendered nothing**, so a two-thirds grid column holding a component
that returned `null` is still a two-thirds column: an empty gap beside a panel squeezed into a
third of the width. Stacked, an absent panel occupies nothing. A test pins the stacking so the
grid is not reintroduced by somebody comparing the screen against the mock.

> **Amended 11 September 2026 (s4.1r).** The owner compared the screen against the mock and
> asked for the band, so **the band is built** - and the diagnosis above is exactly why it could
> be. The slots are wrapped in `empty:hidden` on a wrapping flex line, so a wrapper whose child
> rendered nothing leaves the row: **`:empty` is how CSS sees what a layout cannot.** The test
> was flipped rather than deleted - the claim is still that the band survives an empty slot - so
> a document citing the stacking as the present shape is stale, though it is correct as history.
> **Say which.**

#### One definition of the hairline, which was not one definition

The standings rail went from 280px to 300px, because at 280 the board's three columns left the
name about eleven characters and the reference's readable board rendered as `M...` beside
`Andy...`.

And the seam colour had **escaped into three consumers** before anybody noticed: the pre-flight
and the arena panel each drew a divider with `border-[#16203C]` written out, and the arena panel
then drew a seam with `bg-[#16203C]` too. It is now `NEON_SEAM` and `NEON_DIVIDER` in
`components/neon/tokens.ts`, used by `NeonStatStrip` and by both consumers, with the literals
added to the kit guard's list and the arena files added to its consumer list. **Worth guarding
for a reason the panel shell is not:** the stat strip draws its internal separators with this
exact tone, so a divider beside them one shade off shows as a visible join - nothing fails,
nothing logs, and it reads as a rendering artefact rather than a colour somebody typed.

> **Two whole classes, not a bare colour**, because Tailwind compiles only classes it can see:
> `bg-[${NEON_SEAM_COLOUR}]` renders unstyled.

#### Two findings about the harness, both of which produced a false result first

**`readCode` strips comments before matching, which is correct and defeated a probe.** Injecting
`// Prize breakdown` into `PrizeTable` came back green - rightly, since that stripping is what
stops a file being flagged for discussing the anti-pattern it avoids. Inject real markup.

**vitest's `-t` argument is a REGULAR EXPRESSION.** Three probes aimed at `it.each` assertions
named `defines border-[#1B2540] bg-[#0A0F1F]/80 in the kit...` came back green because
`[#1B2540]` is a character class: the filter matched nothing while the run still reported no
failures, which is indistinguishable from a guard that does not work. The `it.each` names are
now **ASCII and regex-safe** (`owns kit literal 3 ...`), with the literal still printed in the
failure message. Related, and the fourth instance of the same family here: a PowerShell probe
pattern containing an **em dash** reported `DID NOT APPLY`, because PS 5.1 reads a BOM-less
UTF-8 script with the system ANSI codepage - **keep probe anchors ASCII.**

**One assertion was genuinely weak and a probe found it.** The dash rule allowed sixty
characters of slack between the `typeof` test and the dash, so widening the condition to
`typeof rank === "number" || true` left the branch dead and every assertion green. It now
requires **nothing between the test and the `?`**. Likewise the heading rule sliced *backwards*
from `<PrizeTable` to the nearest preceding `<NeonHeadedPanel`, which a panel that has already
**closed** satisfies - a probe sliding the table out past the closing tag left the heading over
an empty box and reported everything fine. It asserts **containment** now.

**16 probes, all red on exactly 1 failure, plus 2 controls green. 261 tests in `__tests__/games`.
Typecheck at the 194 baseline exactly. Never verified by eye** - the play screen is behind
sign-in and the automated browser has no session, so the owner is the first person who will see
it.

---

### 4.1n What each player solved (11 September 2026)

The owner rejected s4.1m outright: *"you didn't do anything I ask... this is unacceptable, do
exactly as image 2, if needed recreate the graphics items yourself to match exactly the image,
see image 3 how the live standings must look and also show what each player solved or progress
according to game."*

**The rejection was right and the reason is worth stating plainly rather than defended.** s4.1m
made three structural corrections and left the screen looking like the application's neutral
shell beside a bright, art-heavy mock. It had also answered a question the owner had not asked -
where the boundary runs - and the two things they named next are both squarely on **our** side
of it.

#### A player's progress was already arriving and nothing on a board read it

**This is the finding.** Every game reports a `scoreBreakdown` alongside its score -
`{ boardsCompleted: 3, boardsAttempted: 5, fastestBoardMs: 8100, ... }` for this catalogue - and
`game_round` has stored it since X3. It was read by exactly two screens: the player's own
results page and the admin per-user performance tab. **The contest board, which is where every
player looks, showed a rank, a name and a number.** So "show what each player solved" is not a
feature needing a provider change, a spec change or a version bump - it is a read that was never
written. `lib/services/games/contest-activity.service.ts` is that read and
`lib/utils/round-activity.ts` turns a row into words.

**THE PLATFORM MUST NOT CHOOSE AMONG A GAME'S METRICS, and that is the design rather than a
limitation.** `01` section 3.2 declares the breakdown display-only, free-form and **ordered by
the provider**. A table saying *for a puzzle show `boardsCompleted`* is a `switch` on game code
wearing a different hat: it makes the no-developer-needed claim false for the next title while
every existing test still passes. So the entries are handed over **in the order the game
declared them**, filtered only by whether a screen can render the value at all, and a structural
test forbids any metric name, game code or provider key in the service, the phrase builder, the
board or the feed. A probe reorders a breakdown to prove the order is honoured.

**Which rounds carry a number is decided once, in the service.** `roundContributesScore` is the
ingestion path's rule, and a component re-deciding it is the second copy this codebase keeps
finding. Two statuses matter and for different reasons: a **`voided`** round stores
`rawScore: 0` **deliberately**, so passing that zero through puts a number beside a cancelled
round and, on a lower-is-better title, **the best one on the board**; an **`unresolved`** round
is `unresolvedRoundPolicy`'s question and answering it here answers it twice. Guarded
positively on the service and **negatively on all three consumers**, which is the load-bearing
half - a service that computes it correctly is trivially satisfied by a component that then
decides for itself.

**`expired` wording describes the clock, never the player.** `createRound` clamps `expiresAt` to
`playWindowEnd`, so under the universal cut-off `expired` is the **ordinary** ending for anybody
still playing at the final whistle, and since R48 those runs count. "Gave up" would blame a
player for attending. A probe rewords it to prove the test can tell.

**An absent activity map renders no second line at all**, which is not the same as rendering
"not played". A caller that has not read the activity is saying *I do not know*; answering
*nobody has played* on its behalf is false for every row. The lobby and the arena both read it,
so the distinction only protects a future third caller - which is exactly when it would be got
wrong.

#### The feed is in the sidebar, and that is a recorded deviation

The reference puts **RECENT PLAYERS** in a three-panel bottom band. `ArenaActivityFeed` is in
the sidebar instead, for the reason s4.1m already learned the hard way: **a layout cannot see
that its child rendered nothing**, and the band's other two members return `null` until the
catalogue is re-synced. The sidebar already stacks.

> **Amended 11 September 2026 (s4.1r).** The owner asked for the reference's band, so the feed
> **moved into it** and the band now survives an empty slot through `empty:hidden`. A document
> placing the feed in the sidebar is correct as history and stale as a present fact - **say
> which.** The rule underneath is unchanged: it is still a consumer of the board's own fetch,
> never a second read.

**The score in the feed is printed plain, with no `+` sign.** The reference's `+240 ⚡` is right
for an upward game and exactly backwards for a time trial, where a *lower* number is the better
result - and the direction is resolved once, server-side, in `calculateRankings`. A `+` is a
screen forming its own opinion about which way a game scores.

#### What else changed, and what it is not

`NeonStatTiles` joins `NeonStatStrip` in the kit as a **second shape rather than a `variant`
flag** - a strip is a dense table-like run, tiles are the few figures a player should take in
without reading - and `ArenaContestPanel` adopts it with a real **state pill** derived from
`contestStatus` **and** `isPaused`, never from the fact that the page rendered: a paused contest
is still stored `active`, and a player can be standing here before the contest opens.
`PrizeTable` gained ordinal place labels and a larger amount - **markup only**, and the four
payout expressions in `lib/utils/prize-projection.ts` survive character for character, which the
existing text assertions prove. The hero is taller with the artwork at `opacity-60` behind two
gradients, and the three chips became the reference's icon-above-label row - **the words are not
copied**, because the mock's four chips are marketing claims (`BIG REWARDS`) while these three
are facts declared in `arena-facts.ts`. `GameRulesPanel`'s *How to play* renders as numbered
steps **from the operator's own paragraph breaks and nothing else**; splitting on sentences would
invent boundaries, and the common case today is a single paragraph, which renders as prose.

> **AMENDED 11 SEPTEMBER 2026 - s4.1w.** *"The hero is taller"* is correct as history and the
> opposite of the present fact: the owner rejected it as *"far too tall"* and it is now fixed at
> **118px**, with a `min-height` forbidden by a test. The artwork is no longer one full-bleed
> pass either - a 16:9 picture cannot fill a 118px strip under `object-cover` without becoming a
> sliver - so it is a dim wash plus a right-anchored piece. **The icon-above-label row survives
> and its reasoning is now enforced rather than merely recorded:** the mock's `BIG REWARDS` is
> still refused, and a probe puts it back.

**28 tests, 13 probes all red on exactly 1 failure. Typecheck at the 194 baseline. Never
verified by eye.** Two probes had to be re-aimed before the run could be believed: one searched
the service for `SCORE_PRODUCING_ROUND_STATUSES`, which is declared in `round-types.ts`, and one
matched a single-line literal against a file prettier had wrapped. **`DID NOT APPLY` means the
target moved, never that the run was quiet.**

#### The three hero banners were redrawn, which the owner asked for explicitly

*"If needed recreate the graphics items yourself to match exactly the image."* The two circuit
titles and the generic fallback are new artwork, composed to the reference's own layout - glowing
circuit terminals and paths at the left, a gold trophy with coins (or a neon stopwatch) at the
right, and **a deliberately near-black middle**.

**That empty middle is a functional requirement, not a stylistic one.** The hero's copy sits on
top of the picture, so previously the scrim had to be dark enough to rescue legibility over
*any* image an operator might upload, and at that strength the artwork was invisible - which is
the complaint. Art drawn with a dark centre lets the scrim drop to a wash, so the banner reads
at 90% on the arena. **The left edge is still fully opaque**, because that is the guarantee, and
it must not depend on which picture arrives: a provider's banner carries no such promise.

**The artwork carries no text at all, deliberately.** The reference's hero has `THINK FAST /
PLAY SMART / WIN BIG` painted into it; the platform renders the contest's own name, tagline and
description in that space, so lettering in the image would be a second, unrelated heading over
the first - and it would be wrong in every locale.

**`banner-trading.webp` was NOT touched**, and the lobby hero's scrim was left exactly as it
was. The trading lobby was not part of the request, its banner is a bright nebula that the
lighter wash would not survive, and changing how it looks in this commit would smuggle an
unasked-for change into a game fix - the same reasoning that kept a known one-character defect
verbatim while settlement was extracted.

**The filenames carry an `-r2` suffix.** A replacement written over the old name is answered
from a returning visitor's browser cache for as long as the edge's browser TTL says - four
hours, on R54's evidence, which is what it took to work out why a fixed game would not start. A
new name is fetched immediately by everybody. The superseded files are deleted, and the
exhaustive `allNeonBanners()` file-existence test - which exists because artwork committed to
the wrong directory is something no typecheck and no build can notice - passes on the new set.

---

### 4.1o The arena's board is live without the page being (owner instruction, 11 September 2026)

The owner rejected the arena a second time. Three things were named; this section is the second
of them: *"and have also not showing live the boards the user finished"*.

**Nothing was computed wrongly and there is no risk number.** The board was correct, the
activity line under each name was correct, and both were **server props rendered once**. A round
that landed while the player sat at the game - their own or a rival's - appeared only after a
reload. So there is nothing to backfill and no money was ever involved.

#### The obvious fix is forbidden here, and that is the whole design constraint

`LiveContestRefresher` is what every other contest surface uses, and
`__tests__/games/live-contest-refresh.test.ts` **forbids it on this page** - deliberately, since
`13` s1.1j: the arena hosts a live round in an iframe, and a `router.refresh()` timer underneath
an attempt somebody has **paid** for can disturb it, intermittently and unreproducibly.

So the rail polls a narrow endpoint and swaps only its own two panels:

| Piece | What it is |
|---|---|
| `lib/services/games/arena-standings.service.ts` | The **one producer**. Board, activity, feed and the player's own rank |
| `GET /api/competitions/[id]/standings` | Transport. Composes nothing of its own |
| `components/games/arena/ArenaLiveStandings.tsx` | One provider, one poll, three consumers |

**THE SAFETY PROPERTY IS A PROPERTY OF WHERE THE STATE LIVES, not of what it contains.** The
provider takes the rest of the arena as `children`, and a `children` element handed down from a
server component is the **same object** on every re-render - so React reconciles it by identity
and never descends into it. The frame cannot remount however often the board changes. That
guarantee is destroyed the moment `ProviderRoundHost` reads the context instead of being a child
of it, which is the natural next step for somebody adding a feature, so it is **asserted rather
than commented** and a probe injects exactly that mutation.

#### One producer, because agreement matters more than liveness

This is the `dashboard-live` rule in a new place (`13` s5.1b). The property engineered for is
**agreement with what the player was first shown**: any field where the poll and the server
render differ reads as *the value having changed*, which is a defect dressed as an improvement.
Two compositions - one in the page, one in the route - is precisely how they come to differ, so
both call `getArenaStandings` and **neither reads the board or the activity itself**. A test
pins both halves.

The two reads inside the service are **ordered, not parallel**, because the activity query is
scoped to the user ids the board returned.

**An endpoint is a second reader only if it composes an answer of its own.**
`LiveContestRefresher`'s header used to open its reasoning with "there is no player-facing JSON
API that returns a competition's ranking", and since this section that is false. The conclusion
still holds there - a lobby page is cheap to re-render, and one answer is better than two - but
the **reason is narrower**, and the correction is left visible in the file rather than tidied
into the present tense.

#### Three smaller rules, each of which has an inverse that looks correct

- **Liveness is read from the stored status, never computed from a clock.** A contest whose end
  time has passed is still `active` until a cron finalizes it, so a client deciding for itself
  freezes the board exactly while the last rounds are being scored. That reads as *more*
  accurate, which is why it is probed.
- **A bad response leaves the last good board on screen.** An error payload spread into state
  empties the rail, and an empty rail on this screen says *nobody has played* - a false
  statement about a contest in progress rather than a missing one. Same family as an absent
  score rendering `-` and never `0`.
- **The count pill became a consumer.** `GameArenaLayout`'s `standingsCount` is now a `ReactNode`
  rather than a number: a count rendered once on the server disagrees with the list beneath it
  the moment somebody joins, which is one panel with two answers - the failure the live rail
  exists to remove, reintroduced one heading higher.

  > **Amended 11 September 2026 by s4.1y.** The prop is **gone**, and the reasoning that produced
  > it is what survives: the count is now the second heading tab inside
  > `ArenaLeaderboardPanel`, which reads the live context itself, so it cannot disagree with the
  > list. The layout composes no part of the rail's chrome any more, and that split ownership is
  > exactly what left nothing owning the panel's height. A document describing a `standingsCount`
  > prop is correct as history and stale as a present fact - **say which**.

#### What this does NOT fix, and it is the third of the owner's three points

**It does not make a round in flight report its progress.** There is no mid-round reporting
anywhere on either side of the provider seam: a score exists only after `finishRound`, the
frame's `postMessage` carries no score by construction, and the games-service's own per-board
record never leaves that database. So a player still at the board reads **"Playing now"** until
their round is reported, however many boards they have solved. What this section fixes is the
moment **after** a round lands, which used to require a reload.

Closing that needs a signed progress callback writing only `game_round.scoreBreakdown` - and
that is a protocol change, so it is its own piece of work.

> **Amendment, 11 September 2026.** That piece of work was done the same day. The paragraph
> above is correct as history and **stale as a present fact**: a round in flight now reports its
> progress, so the board says what a player has solved while they are still solving it. See
> **s4.1p** below and `01` s5.5. The rest of this section is unchanged and still accurate.

**Never verified by eye**: the arena is behind sign-in and the automated browser has no session.

### 4.1p A round in flight now says what it has done (11 September 2026)

The third of the owner's three points, and the half s4.1o filed as a protocol change. A
player still at the board read **"Playing now"** however many boards they had solved,
because **there was no mid-round reporting anywhere on either side of the seam**: a score
exists only after `finishRound`, the frame's `postMessage` types carry no score field by
construction, and the games-service's per-board record never left that database.

**The live code.** Platform: `lib/services/games/round-progress.service.ts`,
`app/api/games/providers/[providerKey]/progress/route.ts`, `progressAt` on both
`game-round.model.ts` copies, `progressCallbackUrl` threaded through `round-types.ts`,
`round.service.ts`, `contract.ts`, `chartvolt-games.adapter.ts` and
`round-launch.service.ts`, and `activityAt` in `contest-activity.service.ts`.
games-service: `src/callback/progress.ts`, the one `void sendProgress(round)` in
`src/rounds/play.ts`, and `progressCallbackUrl` on `src/store/round.model.ts` and
`src/rounds/create.ts`. 22 platform tests, 20 probes red on exactly one failure; 11
games-service tests. **Protocol version 1.4 -> 1.5.**

Six things drift easily.

- **It is not a second scoring door, and every design decision here is that sentence.** The
  service writes `scoreBreakdown` and `progressAt` through an explicit two-path `$set` -
  never a spread of what the provider sent, because **a spread is how the next field
  arrives, and the field after that is `rawScore`.** It reads `status` to refuse a round
  that is not live and never writes one. It touches no participant. It is a **separate
  route** rather than a flag on `/events`, because a body claiming `final: false` reaching
  the scoring path is one plausible-looking branch away. `06` s2.2 is the authoritative
  account; a document describing this as an extension of the result callback is describing
  the design that was rejected.
- **The read side needed almost nothing, which is why this was affordable.**
  `getContestActivity` already passed a live round's breakdown through - only `voided` and
  `unresolved` withhold - so the board and the feed render progress with **no component
  change at all**. The one edit is `activityAt`, where `progressAt` sits **below**
  `completedAt` and **above** `startedAt`: without it every live player's feed entry is
  frozen at the moment they pressed Play, so a contest in which four people have each just
  solved a board orders them by who started first and never moves again.
- **`progressAt` is stored rather than derived from `updatedAt`**, which moves for any write
  at all - the result landing, a manual resolution - and therefore cannot answer whether a
  player's game has gone quiet. **Absent means no progress reports, never "reported long
  ago"**, which is true of every round predating this and every provider that declines the
  callback.
- **The game's half is the opposite of `deliver.ts` in every way, deliberately.** No retry,
  no queue, no delivery record, a three-second timeout, and `void` rather than `await`. A
  lost result is a contest nobody can settle; a lost progress report is one stale line for a
  few seconds, and **retrying would be strictly worse than not** - a queue of stale reports
  arriving out of order behind a finished round is a board that goes backwards. The `void`
  is the load-bearing half: this sits between a player solving a board and being handed the
  next one, in a round they **paid** for.
- **It is sent on the continuing branch only.** A round that has just finished is already
  being delivered as a result with the same figures and a score beside them, and the
  platform refuses progress for a round that is no longer live - so a send there is a
  guaranteed 200-with-nothing-stored at best and a race at worst. Pinned positionally with
  `lastIndexOf`, because the same finishing call appears earlier in `resumeRound` and
  measured from the first one the assertion is trivially true.
- **The address is always offered and the provider always chooses.** `progressCallbackUrl`
  is supplied unconditionally at launch and is optional in the contract, authenticated with
  the **same** credentials as the result callback - a second credential for a lower-value
  endpoint is a second thing to rotate and the first one somebody leaves behind. A provider
  who ignores it is fully conformant and their contests settle identically.

Two smaller rules worth carrying. The sanitiser keeps **primitives only, 24 at most**, drops
`__proto__` / `constructor` / `prototype` and writes through `Object.defineProperty` - a
breakdown is unbounded provider data written once per solved board, so this is **a store
that fills up by succeeding**, which is the `brandingFiles` failure in a new place. And
refusals on this route are **deliberately not logged**: it is the highest-rate provider route
by a wide margin, so a line per refusal turns one misconfigured game into a flood that buries
the warnings that matter.

**Two deploys, not one.** This is a TypeScript change on **both** sides, so the platform needs
its build and games-service needs `npm run build` plus `pm2 restart chartvolt-games` - R52 and
R66 were each reported twice for exactly this.

**Never verified by eye.**

### 4.1q The arena rejected a third time - size, standings, chrome, agnosticism (owner instruction, 11 September 2026)

The owner rejected the arena for the **third** time, with eight images and four files from an
unrelated reference project. That count is the most useful fact in this section: **three
rejections of one screen is not three misses, it is a signal that the thing being corrected
each time was not the thing being looked at.** The first pass corrected structure, the second
corrected the repository boundary, and neither addressed what the owner could see.

Six items, in the owner's own priority order.

**1. The size, which he asked for first.** The frame hosting the board had grown while the
board inside it had shrunk. The cause was in games-service and it was one line:
`.arena { align-items: center }` stopped `.board-wrap` stretching, so `fitBoard()` had no
height to converge on and settled at `MIN_CELL_PX`, which is **34 pixels**. Stretching the
row and centring the two rails instead fixed it, with the stacking breakpoint moved from 680
to 520 pixels so the rails stop stealing the board's width sooner. **The board was never
mis-measured - it was measured against a container that had stopped having a size**, which is
why every arithmetic review of `desiredFrameHeight` came back clean.

**2. The standings.** Names were squeezed into a narrow column and there were no avatars.
Rebuilt to the owner's leaderboard crop: a header strip with the trophy and a players pill,
`#  PLAYER  SCORE  TIME` columns, circular avatars with a cyan ring, a gold-framed leader row,
a crown for first and numbered blue plates for second and third, gold scores, and a
full-width exit to the full board. **The avatars are the part with a rule attached**, because
this is a public board: they come from the same `profileImage || image` path the global
leaderboard already publishes, and the service picks **only** `profileImage` out of
`getUsersByIds`, which also returns email, address and city. A test asserts the **whole** row
object rather than the fields it cares about, and a probe restores the spread - a field you
did not ask about is the only way to notice one you did not expect.

**3. The chrome, on both sides of the seam.** In-frame: the reference palette copied as
values (never imported - `check:isolation` forbids it), a red time-left box, blue tool rails,
a wide blue submit, and the three board artworks below. Platform: a navy grid backdrop, a lit
panel rim, brighter cyan headings. **`NEON_PANEL` was deliberately not touched.** It is what
the **trading** lobby renders, so turning it up would have made an unasked-for change to a
screen nobody mentioned, invisibly, through a shared token - so the arena's chrome is a
**second** shell, `NEON_PANEL_LIT`, and a test names the three new literals as kit-only
because they are exactly what a screen would type in to "look more like the arena".

**4. Three board artworks, one per grid size.** `DRAWN_BOARD_FRAMES` maps 4, 6 and 8 to their
own file with its own inset. The supplied art arrived on a black square; **keying the black
out to transparency is what made it art rather than a box**, because the surround was
covering the page's own glow. Verified by eye.

**5. Game-agnosticism, which he asked for explicitly** - *"a tetris game dont have board"*.
The audit found **no** player-visible game-specific copy on the platform arena: it was already
agnostic, having been built to render whatever the provider reports. **So the deliverable was
a guard rather than a fix**, which is worth stating plainly rather than reporting an
improvement nobody made: 15 tests ban nine game-shaped nouns across 13 files, matched
**inside quoted strings only**. An identifier may legitimately be `boardsCompleted` - that is
a provider metric name rendered by `humanizeMetric`, which is the mechanism that keeps this
agnostic - and a variable name is not something a player reads. The stripper carries a canary
in **both** directions, because `native-select-legibility.test.ts` established the precedent:
an over-broad strip leaves every assertion green over a tree nothing examined.

**6. The hero, and the defect found underneath it.** Comparing our arena with the reference
turned up something nobody was looking for: **`GameArenaLayout` called
`providerBanner(undefined)`**, so the arena drew the generic trophy for every title in the
catalogue, while the lobby and the results screen - which both pass the game code - drew the
game's own artwork. Three callers and one of them forgot. **It is the hardest kind of wrong to
see, because a fallback that works is indistinguishable from a title with no artwork**:
nothing failed, nothing logged, and the only symptom was the owner saying the page did not
look like his design.

**And the obvious repair was forbidden, which is the more useful half.** Passing the game code
into the layout fixes the picture and turns `game-content-editor.test.ts` red, because that
guard asserts nothing in the arena folder names a game code, a provider key or a game key -
the one way to lose "a new title needs no code" being a screen that *can* name a game. The
first attempt did exactly that and the guard caught it within one full-suite run. So the
resolution moved **out to the page**, which is the one place that legitimately knows which
game it is, and the layout is handed an already-chosen picture. **Item 4 of the owner's list
and item 6 turned out to be the same requirement pulling in opposite directions**, and the
guard is what settled it. Three assertions pin it - the page asks by game, the page hands the
answer over, and the layout has not quietly kept a copy of the decision - plus the pre-existing
folder guard from the other direction. The artwork itself was redrawn as `-r3`; the suffix
exists because a replacement written over an old filename is answered from a returning
visitor's cache for hours (R54).

**And seven probes in `tools/probe-lobby-theme.ps1` had been reporting nothing.** Four named a
test whose `it.each` label had been renumbered, so they said `PROBE BROKEN` against four
working guards; three named patterns that had moved with unrelated work - a rank badge that
gained props, a prop renamed from `unit` to `creditSymbol`, and an expression deliberately
deleted when prize redistribution became proportional. All seven are re-aimed, and the last of
them at a **surviving** assertion rather than re-pinned to new text, because re-pinning a
verbatim money assertion after a behaviour change looks identical to the test still working.
**Carry the general form: a probe naming something that no longer exists is indistinguishable
from a guard that does not work, and it fails in the quiet direction.**

**Never verified by eye** on the platform half - the arena is behind sign-in and the automated
browser has no session. The in-frame half **was** seen, through `tools/smoke-play.ts`.

### 4.1r The bottom band, on the reference after all (owner instruction, 11 September 2026)

The owner sent the arena's foot as built beside the reference's foot and asked for the second:
*"image 1 must look like image 2 recreate the graphics to look like that all the info there must
be the same do this fast"*.

**The band this asks for was tried and reverted the same day** (s4.1m), and the reason it was
reverted is the only interesting part of building it: all three slots render **nothing** when
their content is absent, and absent is the **common** case - no title carries rules text until
the catalogue is re-synced, the feature cards are written per title, and a contest nobody has
played has no activity. **A layout cannot see that its child returned `null`**, so a grid column
holding one is still a column, and the first attempt produced one panel adrift in an empty row.

**CSS can see what React cannot.** A wrapper whose child rendered nothing has no child nodes, so
`:empty` matches it and Tailwind's `empty:hidden` takes the slot out of the flex line entirely.
`flex-wrap` with a basis rather than `grid-cols-3` is the other half: a hidden **grid** item
leaves its track behind, so the panels that do have content would still huddle in the first two
columns. One panel reads as a full-width panel, three read as the reference.

| Reference panel | What it renders | Where the content comes from |
|---|---|---|
| `HOW IT WORKS` | `GameRulesPanel`, unchanged in content - the amber "How you win" block above the numbered instructions | `provider_game.rulesSummary` / `howToPlay` |
| `GAME TIPS` | `ArenaHighlights` in its new `list` layout - ticked lines rather than a strip of cards | the catalogue's feature cards |
| `RECENT PLAYERS` | `ArenaActivityFeed`, **moved out of the sidebar**, with the reference's `Live activity` label | `game_round.scoreBreakdown`, through the board's own fetch |

> **Amended 11 September 2026 (s4.1u).** The owner rejected the result as ~600px tall against a
> reference measuring 986 x 103, so **the band is now a fixed `sm:h-[104px]` row** and each card caps
> its items rather than growing. Two rows of this table are stale as present facts though
> correct as history - **say which**: `HOW IT WORKS` is no longer `GameRulesPanel` unchanged but
> a third `strip` layout **without** the amber scoring block, which stays on the lobby; and
> `GAME TIPS` no longer has a `list` layout, because the full-width `row` variant it was named
> against was deleted, leaving the component one shape. **`flex-wrap` over `grid-cols-3`
> survives unchanged and is now a recorded deviation from the owner's own CSS**, which asked
> for a grid - the empty-slot reasoning above is why.

**The heading names what the content is, not what the reference calls it.** The mock's middle
panel says `GAME TIPS` and these are not tips - they are the operator's "why this game is fun"
cards, so the panel is headed **What to expect**. A caption is a claim: heading marketing copy
as advice tells a player those lines will help them play, and **the catalogue has no field that
would**. The shape is copied; the word is not.

**Two things the mock shows were deliberately not copied.** Its numbered steps and ticked tips
are written out as game-specific sentences, and the arena may not contain those - a test bans
game-shaped nouns in quoted strings in this folder, because a screen that can name a game is how
"a new title needs no code" is lost. They arrive as data or not at all, which also means **the
numbered list appears the moment an operator writes line breaks** and reads as one paragraph
until then. And **the score in the feed still carries no `+` sign** (s4.1n): the mock's `+240` is
right for a game that counts upward and exactly backwards for a time trial, and the direction is
resolved once, server-side.

**The rules panel took the kit's headed shell**, which is the smallest form of "the graphics are
not like the design": every panel in the reference carries its heading in a tinted strip running
edge to edge, and the one panel a player most needs to read wore the quieter padded shell. The
title text is unchanged. **The lobby gets the same change**, because it renders the same panel -
which is the point of there being one.

The band test was **flipped, not deleted**: its claim is unchanged - the band must survive an
empty slot - and only the mechanism moved, so the comment explaining why it was once stacked
stays with it. Three slots, **counted**, because a bare match for `empty:hidden` is satisfied by
the rules slot alone while the activity panel renders an empty third of the page.

**Never verified by eye** - the arena is behind sign-in.

### 4.1s The leaderboard row, and the lookup that found nobody (owner instruction, 11 September 2026)

The owner sent a crop of the arena's leaderboard: *"our leaderboard first doesnt fit the wording,
the names are cut of and we dont have the avantars of the player"*. **Two separate defects wearing
one screenshot**, and merging them is the mistake a summary invites - one is a layout fault in this
folder, the other is a database query two layers down (**R68**).

**THE AVATARS WERE BUILT, WIRED AND TESTED, AND COULD NEVER HAVE APPEARED.**
`lib/utils/user-lookup.ts`'s batch lookup filtered on the `id` **field** alone, while Better Auth's
MongoDB adapter keeps an account's identity in `_id` - so the query matched nothing, the map came
back empty, every row correctly had no picture, and `NeonAvatar` correctly drew initials. No error,
no log line, every layer reporting success. `getUserById` ten lines above it has tried `id`, then
`_id` as an ObjectId, then `_id` as a string since it was written, which is the evidence that the
shape varies; the batch version had one of the three. See `17` R68 - including why no other screen
was affected, and why the guard has to be behavioural.

**The names were cut off by the row's own furniture, not by the rail.** The rail had already been
widened 280 → 300 → 360 (s4.1q), each time by counting characters, and the names were still
truncated. What was on the line beside the name was:

| Fixture | Why it went |
|---|---|
| A gold crown, from `NeonPlayerName`'s `isLeader` | `NeonRankBadge style="plates"` was **already** drawing a crown two columns to the left. The same fact twice, about 20px apart |
| A `= #1` tie chip | A statement about the **figure a player is ranked on**, so it belongs beside that figure - and it repeated the rank the plate states. Moved to the score cell as a bare `=`, with the long form on a `title` |
| The level badge | Already removed in s4.1q, for this reason |

**Nothing was hidden to make room**, which is the test for removing furniture rather than shrinking
it: the crown is in the plate, the tie is beside the score, both still on the row. Beside that, the
two numeric columns were cut to the width of a five-figure score and a `12:34` clock, the plate
column to the plate's own size, and the gaps from 8px to 6px - together about **40px handed back**
to the one column whose content has no upper bound.

**The tie marker is counted and its position asserted**, because a second copy left on the name
line satisfies any positional check aimed at the first - the shape that has defeated four
structural tests here. The numeric widths are counted too: the column template is written twice,
once for the heading and once for the rows, and a widening applied to one of them misaligns every
row while reading correctly in a diff.

**Never verified by eye** - the arena is behind sign-in, and the avatar half cannot be seen at all
until the fix runs against a real database.

---

### 4.1t The band's pictures, and the panels finally level (owner instruction, 11 September 2026)

The owner sent the band again with all three panels circled: *"still dont like these, first they
dont align, one bigger than the other, they must be the same"*, beside the reference showing a
small graphic against each block of copy - *"have images next to letters icons, recreate the
images and icons, or better create a place in the games add content in admin and when i put
images there will show them"* - and, last, *"when i have mouse over the buttons need to have the
hand"*.

**NOTHING HERE WAS COMPUTED WRONGLY AND THERE IS NO RISK NUMBER.** A short panel, an absent
picture and an arrow cursor all render perfectly and report success, so every guard in this slice
is structural and **nothing was backfilled**.

#### The heights: the wrappers were never the problem

`13` s4.1r's band is three flex items, and a flex item stretches by default - so the wrappers were
already the same height while the owner was looking at panels that were not. **What differs is the
panel inside each wrapper**, which sizes to its own text and leaves the rest of its stretched
wrapper empty. The fix is therefore `[&>*]:h-full` on each wrapper, reaching through to whatever
it was handed.

The obvious spelling, `h-full` on the wrapper itself, is a **no-op that reviews as correct**, and
a guard asserting the band "mentions `h-full`" is green against it. The probe restores it verbatim.

It belongs on the wrapper rather than in the three panels because **two of them are also rendered
in the lobby sidebar**, where a forced full height would stretch one card to the length of the
whole column. And `empty:hidden` and `flex-wrap` are asserted alongside it, because s4.1r's revert
is still the governing fact: all three slots render `null` when their content is absent, which is
the common case, and a hidden grid item leaves its track behind where a hidden flex item leaves
the line.

#### The pictures: `NeonIllustration`, and why the fallback is the component

Two new fields on `provider_game`, `howToPlayImageUrl` and `highlightsImageUrl`, uploaded through
the existing artwork route and edited in the game content dialog under their own heading.

**THEY ARE OURS, NOT THE PROVIDER'S, and that decides everything else about them.** A logo and a
hero banner identify a provider's *title*; these two illustrate **our** panels, at our size, in
our style. So they are in **no sync allow-list at all** - not even `firstSyncOnlyFields` - no
provider is asked for them, `ChartVolt-Game-API-Requirements.html` is unchanged and there is **no
version to bump**.

**The fallback is the point of the component rather than a courtesy.** No title in the catalogue
carries either image, so the natural implementation - render the `src`, render nothing otherwise -
is green against any test that supplies a URL and ships a band that is illustrated on nothing and
looks broken on everything. `NeonIllustration` draws a two-ring emblem with one of the kit's
lucide glyphs instead, so **an unset value is a deliberate look and an upload replaces it rather
than filling a hole** - the same arrangement as `bannerUrl` falling through to `banners.ts`.

**The glyph is chosen by the calling panel, never by the title**: the rules panel always draws the
rules glyph, whatever game it is describing. Drawing something that depicted the game would be
per-game code in the layer built to avoid it. The emblem therefore **carries no caption**, asserted
as "no text-bearing element and no default `alt`" rather than as a list of banned nouns - a noun
list here would have to permit `classes.tile` and `aspect-square`, which are class names rather
than anything a player reads, and a guard forced to make that exception will eventually make the
wrong one. Note this component lives in `components/neon/`, which the arena's own game-agnostic
guard does not read.

**The rules picture is drawn on both layouts, and the gate that would have looked careful is a
defect.** The arena passes `layout="column"`, not `"wide"` - so a condition reading
`layout === "wide"` around the illustration reviews as considered, passes any test that only
checks the picture exists in the file, and leaves it off the one screen it was asked for.

#### The hand cursor

Tailwind v4's preflight no longer sets `cursor: pointer` on a `<button>`, so **every button in
both apps lost its hand cursor on the upgrade** and `app/globals.css` had been putting it back one
component class at a time - which is why it kept reappearing. It is now on
`components/ui/button.tsx`, its admin copy, and `components/neon/Buttons.tsx`'s `BASE`, which the
kit's controls use instead of the primitive. `disabled:pointer-events-none` and
`cursor-not-allowed` are asserted with it: a hand over a disabled control promises a click that
does nothing.

**13 tests, 15 probes red on exactly one failure. Never verified by eye** - and for a second
reason on two of the three panels: they render nothing at all until the catalogue is re-synced.

Three probes came back green first time and the three causes were all different, which is worth
keeping. **A mutation with no observable:** the caption probe first replaced a comment. **An
import is not a use:** `indexOf("NeonIllustration")` found the import on line two, so the layout
gate's slice examined the file header and the exact injected defect passed - the
`canTransitionRound` and `MIN_REASON_LENGTH` trap again. **A weak test:** the projection guard
counted occurrences of the field name, and deleting it from the `.select(...)` left the interface,
the lean generic and the return still naming it, so the total never fell below the threshold -
and the projection is the one of the four that decides whether a value arrives at all.

> **Amended 11 September 2026 (s4.1u).** The owner rejected the band for a fourth time: it had
> grown to roughly 600px tall with the two pictures drawn large, one of them beneath its text at
> the panel's full width. Three facts above are correct as history and stale as a present fact.
> The band is now a **fixed-height strip**, so `[&>*]:h-full` sits beside an `sm:h-[104px]` on the row
> rather than on its own. **Both pictures are now fixed small squares beside the copy**, not
> flexible blocks under it. And **the rules panel has a third layout**, `strip`, which is a
> different component rather than a narrower one - so "the rules picture is drawn on both
> layouts" is now three, and the `layout === "wide"` warning is unchanged and still the reason.

---

### 4.1u The band as a thin information strip (owner rejection, 11 September 2026)

The owner sent the band beside the reference a fourth time and opened with *"STOP. The current
implementation is structurally wrong."* The measurement is the specification: the reference is
**986 x 103 pixels**, and *"your current implementation stretches the section to approximately
600px+ high. THIS IS WRONG."* He listed the spellings that produce that - `min-height: 400px`,
`flex: 1` vertically, `height: 100%`, `grid-auto-rows: 1fr` - and closed with a ten-point
acceptance test and *"Do not modify the rest of the Circuit Sprint page."*

**NOTHING WAS COMPUTED WRONGLY AND THERE IS NO RISK NUMBER.** A 600px band renders perfectly and
reports success; the only witness is a screenshot, which is why the owner found it three times
before a guard existed and why every assertion in `__tests__/games/arena-band.test.ts` is
structural. **Nothing was backfilled.**

#### A MEASUREMENT IS A SPECIFICATION, AND THREE MECHANISMS ENFORCE IT

`sm:h-[104px]` on the row - inside the owner's stated 95-115 maximum - is the fixed height. It is
not enough on its own, and the other two are what make it safe rather than merely true:

- **The banned spellings are asserted as absent**, because any one of them re-inflates the row
  while the fixed height stays in the file and reads as still governing it.
- **Each card caps its own items** - three steps, four tips, three feed rows - so the content
  fits the box rather than being hidden by it. `overflow-hidden` is a **backstop, not the
  mechanism**: a card that relies on it is a card silently dropping the operator's fourth tip
  with nothing on screen to say so.

The arithmetic is worth recording because it decides all three numbers, and because **104 was
arrived at rather than chosen - the first attempt at 96 was wrong in a way nothing would have
reported.** A card is the band less its 30px `dense` heading strip. At 96 that leaves 66px of
body, and the owner also specified the pictures at 65-75px; `NeonIllustration` takes its height
from its **width** through an aspect ratio, so a 66px-wide square is 66px tall in a body that,
after padding, had 49. It would have been cropped by the `overflow-hidden` backstop - silently,
on the two acceptance points that ask whether the pictures are there and small. At 104 the body
is 74px, which fits a 66px picture beside three lines, and three 24px feed rows exactly.

That 74px is also why the counts are the reference's own counts, which is not a coincidence - it
is what the owner measured. **Both halves of a row height must be asserted or neither is**: the
feed's 20px avatar and its `py-0.5` are 24px together, and one step up to `py-1` makes them 28,
at which the third row goes under `overflow-hidden` while `FEED_LIMIT` still reads 3 two lines
away. The same trap one field along is a picture given a hard height beside an aspect ratio -
two numbers that disagree the moment either moves - which is why the cards write a width and
never a height.

**`h-full` IS BANNED ON THE BAND WHILE `[&>*]:h-full` IS REQUIRED ON EACH WRAPPER**, so the guard
is a **count** rather than a word. Written as `not.toMatch(/h-full/)` it fires on the child
selector - it did, on correct code, the first time the suite ran - and a guard that fails on a
correct file is the kind the first person it inconveniences deletes. Same lesson as s4.1g's
narrowed `GameIcon` ban.

#### THE DEVIATION: FLEX, NOT THE GRID THE OWNER SPECIFIED

He supplied CSS: `grid-template-columns: 1.15fr 1.15fr 1fr`. The build uses
`flex-[1.15_1_0]` / `flex-[1.15_1_0]` / `flex-[1_1_0]`, which divides the row 34/34/32
**identically**, and the reason is s4.1r's governing trap: all three slots return `null` when
their content is absent, **a layout cannot see that its child rendered nothing**, and a hidden
grid item leaves its track behind where a hidden flex item leaves the line. A grid here puts one
panel adrift beside an empty third of the page in the common case. Recorded as a deviation rather
than absorbed, and probed in both directions.

#### TWO RECORDED DECISIONS WERE REVERSED, AND BOTH COST SOMETHING

- **`What to expect` became `Game tips`.** s4.1r kept the former deliberately, because the
  content is the operator's feature cards rather than advice and *a caption is a claim*. The
  owner overrode it twice and named the heading explicitly. The cost survives the rename: the
  seeded `circuit-sprint` highlights still read as marketing, so the card now promises tips and
  shows selling points until an operator rewrites them.
- **The scoring rule left the arena.** `13` s4.1k put it on screen on the owner's own earlier
  instruction; he has now named all five of its strings for removal. It is **not deleted** - the
  lobby renders the full panel at `layout="wide"`, and every route into the arena passes through
  the lobby. **The cost is that a player halfway through a contest cannot re-read the rule
  without leaving the board**, which is exactly the case s4.1k was built for. Stated rather than
  smoothed over, and the compact card falls back to the scoring rule when a title has one and no
  instructions.

#### WHAT THE GUARD STILL FORBIDS, AND WHY THE REFERENCE'S WORDS ARE NOT IN THE CODE

The owner listed the steps and tips verbatim - *"Connect matching numbers with a path"*,
*"Plan ahead before making moves"*. **None of them is in the codebase.** They are the operator's
`howToPlay` lines and `highlights` titles, read from the catalogue, and the arena's game-agnostic
guard forbids a game-shaped sentence in a quoted string in these files. A probe hard-codes the
reference's own steps to prove it. The only words these components write are the two headings,
and neither names a game.

**The heading drops the game's name.** `How Circuit Sprint: Fast and Fun Spatial Puzzles is
scored` is longer than the card is wide, and at this size a title that wraps costs a step.

> **AMENDED LATER THE SAME DAY BY s4.1v.** This paragraph read *"the heading drops the game's
> name **where the full panel keeps it**"*, and the owner's screenshot of the lobby is what
> disproved the second half: the full panel's heading ran the width of the page. **Both screens
> now read `How it works`** and the template appears nowhere, so the assertion pinning it was
> inverted rather than deleted. Correct as history, stale as a present fact.

#### TWO THINGS THE OPERATOR HAS TO DO, AND THE HINTS THAT SAY SO

Neither is a code fix, and both were invisible before this slice:

- **The two uploads are in the wrong slots in the live data** - the emblem is in the rules slot
  and the diagram beside the tips, which is the reverse of the reference. The labels said "rules"
  and "highlights" while the screen says "How it works" and "Game tips", so they now name the
  panel the player sees.
- **The strip numbers each LINE of `howToPlay`**, so the reference's three numbered instructions
  appear the moment somebody writes three lines. `circuit-sprint`'s seeded copy is one paragraph
  and therefore draws one line - correct, and not what the reference shows. The field accepts
  both and saves both, so **the alternative to saying it in the hint is a screen that looks wrong
  for a reason that is nowhere on the screen.** `ARENA_STEP_LIMIT` and `ARENA_HIGHLIGHT_LIMIT`
  are the numbers in those sentences, and a test reads the literals out of the admin and player
  files and asserts they agree - `apps/admin` cannot import from `components/games/`, and a
  number that drifts makes the hint a lie.

**`CONTENT_LIMITS.highlights` is 6 and the card draws 4**, and the full-width `row` layout that
used to show the rest was deleted, so the fifth and sixth are stored and rendered nowhere. That
is in the hint beside the field, which is the one place an operator can act on it.

#### A DEAD PROP, DELETED RATHER THAN LEFT

`ArenaHighlights` accepted `layout?: "strip"` for an afternoon: narrowed to one value,
destructured nowhere, read by nothing - the declared-written-dead shape after `requiresSyncPlay`,
`isPaused`, `lastSuccessfulRoundAt`, `family` and `playModeOverride`. Deleted from the props and
the call site on the `shouldBlockEntry` precedent, with two tests restated to assert the absence.

**29 tests, 32 probes red on exactly one failure.** Two probing lessons came with it. One came
back **GREEN on the fourth known cause** - adding `flex-col` puts the picture *under* the lines
while leaving document order untouched, so the positional assertion had no observable for it and
the flex **direction** is now asserted too. And six probes reported `PROBE BROKEN - no test
matched`, because vitest's `-t` is a **regular expression** and five test names carried
apostrophes: a fragment that matches nothing produces a passing run over zero tests, which reads
exactly like a guard that does not work. The names were made regex-safe rather than the probes
escaped.

**Never verified by eye** - the play screen is behind sign-in and the automated browser has no
session.

---

### 4.1v The same two faults on the lobby's panel (owner instruction, 11 September 2026)

Told that the scoring rule was *"not deleted - the lobby carries it in full"*, the owner went and
looked at the lobby, and replied with a screenshot of it: *"see image change also this How Circuit
Sprint: Fast and Fun Spatial Puzzles is scored and do it like the other you fixed"*.

**IT IS THE SAME TWO FAULTS ONE PAGE ALONG, and that is the fact worth carrying.** The heading ran
the width of the page; the operator's small graphic was drawn beneath the instructions at the
cell's full width, so a panel of two short paragraphs was a screen tall with a hero image in it.
Both are what s4.1u had just corrected on the band - and both were **left untouched in that
commit on purpose**, because the instruction said *"do not modify the rest of the Circuit Sprint
page"*. The general form: **a fault corrected on one screen is worth looking for on every other
screen that renders the same component**, because the reason it was scoped out is a reason about
the request rather than about the code.

**NOTHING WAS COMPUTED WRONGLY and there is no risk number.** A page-wide heading and an
oversized picture both render perfectly; **nothing was backfilled.**

#### THE HEADING FAULT IS NOT THE LENGTH OF ONE NAME

`How ${presentation.gameName} is scored` reads correctly against a short name and produced
`How Circuit Sprint: Fast and Fun Spatial Puzzles is scored` against the live one, because
`gameName` is **operator-editable free text of unbounded length** and this title carries its
tagline inside it. **Interpolating a field like that into a sentence is the fault**, so any title
with a subtitle in its name reproduces it, and shortening this one name would have fixed nothing.

Both screens now read **`How it works`**, which is also one fewer thing that can differ between
them. The name survives on the picture's `alt`, where a length is harmless. The assertions that
pinned the template - one in each of two suites - were **flipped to forbid it rather than
deleted**, with the reason left in place, because the sentence *"the lobby has the room and is
where a player is deciding whether to pay"* was believed for a day and is the reason nobody
looked.

#### A WIDTH AND A POSITION ARE TWO DEFECTS, AND ONE FIX IS NOT THE OTHER

`NeonIllustration` takes its **height from its width** through an aspect ratio, so uncapped in a
300px cell a 4/3 graphic is 225px tall. It is now `w-[132px]` - a width and never a height, the
rule s4.1u arrived at - which is 99px.

That alone is a half-fix that reads as complete: a 132px picture still **below** three lines of
text adds its own height to the panel. So the body became **one row** rather than a two-column
grid, and the picture sits beside the instructions. The grid was the other half of the emptiness
the owner drew: two columns make the panel as tall as its tallest cell, so the short one was a
column of nothing. `md:grid-cols-2` is asserted **absent** as well as the row being present,
because both can be in one file at once and an inner wrapper left behind restores the taller
shape while reading as harmless.

The position guard asserts the **flex direction**, not merely document order - a `flex-col`
puts the picture underneath while leaving the order untouched, which is the fourth known cause of
a green probe and has already cost one in the band's suite.

#### `contain`, AND A THIRD DEAD LAYOUT DELETED

The lobby's picture used the kit's default `cover` and now uses `contain`, for the band's reason:
these two uploads are graphics rather than photographs, so a crop takes the corners off a badge.
`cover` stays the default, because the slots that came first are a logo and a hero banner.

`layout` offered a third value, **`column`**, which was the default and which **no caller ever
passed** - a stacked layout nobody could see. Deleted, and the prop made **required**, because a
default is how a third unreachable branch arrives without a caller. Fourth instance in two days
after `ArenaHighlights`' `layout`, and the same `shouldBlockEntry` precedent.

**3 tests, 4 probes red on exactly one failure**, and the harness gained a **per-probe `Suite`**:
these guards live in `game-rules-panel.test.ts` rather than the band's own suite, and run against
the default one a probe reports "no test matched", which reads like a broken harness rather than a
moved target.

**Never verified by eye** - the lobby is behind sign-in.

### 4.1w The hero as one thin banner (owner instruction, 11 September 2026)

The owner sent the built hero beside a reference for it: *"the current banner is far too tall and
has unnecessary content/cards underneath... TARGET: a single compact horizontal banner,
approximately 110-125px high on desktop... the banner must stay visually SHORT."*

**This is the second rebuild of this component in a day and the fault was the same both times.**
The header kept growing until it was the largest thing on a page whose entire purpose is the
board below it, and the reason it grew is worth stating before anything else, because it is not a
mistake anybody made in one edit.

#### A MINIMUM HEIGHT IS A FLOOR CONTENT IS FREE TO EXCEED

The previous version set `min-h-[220px]` and then let its content decide. Everything added after
that was individually reasonable - a genre badge, a heading that wraps to two lines because the
catalogue's name carries its own subtitle, a three-line description, the contest's own name, and
three bordered feature cards across the foot - and the sum was the ~400px header in the
screenshot. **No rule was broken anywhere**, which is precisely why it needed a photograph to
find, and it is the same mechanism the bottom band was rejected four times for.

So the height is **fixed at 118px**, the middle of the owner's range, and the guard asserts
`min-h-`, `h-auto` and the old `p-5 sm:p-7` **absent** as well as the fixed height present. A
floor left beside a ceiling is the ceiling losing, with the ceiling still in the file reading as
though it governs.

`sm:` only. A phone has no room for a logo, five lines of copy and four features on one row, so
below that breakpoint the banner stacks and takes the height it needs - a fixed 118 there would
crop the heading rather than the hero.

#### THE STRUCTURE IS THE OWNER'S, WITH THE THIRD COLUMN HELD EMPTY

`| logo | title and copy | four features | artwork |`, which is a 132px track, a flexible middle
that itself splits into copy and features, and **a 330px track containing nothing**. The third
column exists so the copy stops before the artwork rather than running underneath it; the
alternative - shortening the copy - is a guess that is wrong at the next viewport width. It only
appears at `xl`, because below that there is not room for both and the copy takes the whole
banner.

**Every line of copy is clamped to one**, and the assertion **counts** the clamps rather than
finding one: four of the five lines are operator fields with no practical length limit, and at
this height a single wrap pushes the line below it out of the banner where `overflow-hidden`
hides it silently. A test asserting the file contains `truncate` somewhere is satisfied by the
heading while the tagline beneath it wraps.

**The features are icon and label with no box.** The previous version drew them as bordered,
padded, tinted cards, which is what made three small facts read as a second section underneath
the banner rather than as part of it - and a box needs padding, which is height. The labels are
8px, a **deliberate deviation** from the kit's `NEON_LABEL`: that token is 11px with wide
tracking, which wraps "Global leaderboard" to three lines in a 68px column and takes the banner
with it. Recorded here rather than treated as a kit candidate.

**The contest's own name is gone, and that is a removal rather than an omission.** It was a fifth
line repeating the `Back to {name}` link directly above the banner, so the page now states it
once. The guard runs in **both** directions, because deleting the link as well would take the
contest's name off the screen altogether.

#### THE ARTWORK DECISION IS ARITHMETIC, NOT TASTE

The banners are **1280x720**. `object-cover` across a 1350x118 panel shows a **16%-tall
horizontal slice** through the middle of the picture, so the trophy the owner asked to keep would
have been reduced to a band of glare. Under `cover`, a box wider than 1.78x its height never
crops horizontally at all - so there is no value of anything that makes a full-bleed 16:9
background work in a 118px strip.

Two passes instead. A dim full-width copy at 40% under a left-to-right scrim, so the background
is the game's rather than flat navy - the owner's *"one continuous graphic"*. Then the picture
again at **300px tall inside a 330px window anchored to the right edge**, which crops it
horizontally to roughly its right half, the part carrying the trophy and the pot, at a size a
player can read. Feathered from the left, because a hard seam between panel and picture is what
makes artwork look pasted on.

**The order of the two passes is load-bearing and is asserted by position.** They are absolutely
positioned siblings with no z-index between them, so they paint in document order: written the
other way round the full-width wash covers the right-hand piece and the trophy disappears behind
a 40%-opacity copy of itself. That looks like a dim banner rather than like two layers in the
wrong order, so nothing about the symptom points at the cause.

#### ONE OF THE FOUR REQUESTED LABELS WAS REFUSED

The owner named `FAST ROUNDS`, `REAL PLAYERS`, `BIG REWARDS` and `GLOBAL LEADERBOARD`. Three are
built and **"Big rewards" is deliberately not**, because **a caption is a claim**: what a contest
pays depends on its prize pool, the hero receives no prize figure, and a free contest would carry
the phrase too. The trophy position holds `Skill based` instead - the platform's own guarantee,
which is the strongest claim that is always true of every contest it will ever run.

The other three are derived rather than written:

- **Fast rounds** comes from `maxDurationSeconds`. That field is a **ceiling, not a length** - the
  contest's configured round can be shorter - so at or under five minutes the label claims
  shortness without a figure, above it the label says *"Up to n min"*, and an undeclared ceiling
  produces **nothing at all**. A guessed length is a deadline the platform never set.
- **Real players** prefers the contest's actual range, `2-100 players`. The same feature with
  figures in it, and a figure cannot be a promise.
- **Global leaderboard** is true of every contest: there is exactly one board and it is on this
  screen. It also survives the agnostic guard, which bans `board` inside quoted strings -
  `\bboard\b` does not match inside "leaderboard".

**Four is not padded to.** A title declaring no ceiling loses that slot and gains the interaction
chip; a title declaring neither renders **three**, because inventing a fourth is how a screen
starts making claims nothing backs.

#### THE TWO-LINE TITLE WITHOUT PER-GAME CODE

The reference shows a title with a subtitle under it and the catalogue stores **one** name field.
`splitGameTitle` splits at the **first colon** and nothing else, which is why it is not per-game
code: the live name is `Circuit Sprint: Fast and Fun Spatial Puzzles`, a title punctuated with
its own subtitle. Any name without a colon is a single heading; an empty half either side means
the colon was decorative and the whole name is the title. **Nothing is dropped either way** - the
same words, in a shape that fits. This is the fault s4.1v fixed on the rules panel, one field
along.

**15 tests, 18 probes red on exactly one failure.** Two of them were green first time round and
both were the test's fault rather than the claim's: `overflow-hidden` also sits on the artwork's
window, so a banner-wide match stayed green while the panel itself let the copy spill - the fifth
time one identifier has defeated a structural test on this screen - and a slice anchored on the
bare token `NEON_PANEL_LIT` opened at the **import** two hundred lines early and still satisfied
its own length assertion.

**Never verified by eye** - the arena is behind sign-in and the automated browser has no session.

> **AMENDED LATER THE SAME DAY by s4.1x, and four of this section's facts are correct as history
> only.** The owner replied to the 118px banner with *"the icons and info needs to be bigger and
> also the game logo bigger and also the info of the game must show - you may need to make the
> banner bigger"*. So: **the height is 150, not 118**; the **feature labels are 10px, not 8**,
> and their glyphs 24px; the **description is clamped to two lines, not one**; and the logo's
> track is **168px, not 132**. The mechanism is unchanged and is the part that must not drift -
> it is still a fixed ceiling with `min-h-`, `h-auto`, `p-5` and `p-7` asserted absent. The
> refusal of "Big rewards" also stands **as a derived claim** and no longer as an absolute: an
> operator may now write those words themselves. See s4.1x.

### 4.1x The strip an operator writes, and a banner sized for it (owner instruction, 11 September 2026)

The owner's reply to s4.1w, against a screenshot with the four features circled: *"the icons and
info needs to be bigger and also the game logo bigger and also the info of the game must show -
you may need to make the banner bigger - also the info and icons of the banner must be able to
change them from the games edit content in admin like the others."*

**Five requests, and the last one is the only structural change.** The first four are sizes; the
fifth turns the strip from something the platform works out into something an operator can write,
which is the half worth reading carefully.

#### RAISING A HEIGHT IS THE EXACT THING s4.1w WAS BUILT TO PREVENT, SO THE NUMBER IS ARRIVED AT

A second number is no better than the first unless it comes from somewhere. 150 is what the
requested sizes need: the genre badge at 9px, a 25px heading, the subtitle, the tagline and two
clamped description lines is about 112px, plus 16px of padding, with the logo at 120 inside the
same box. Nothing in it is a guess about the copy.

**What must never change is that it is a ceiling.** `min-h-`, `h-auto`, `p-5` and `p-7` stay
asserted absent, because the fault both rebuilds shared was not the number - it was a floor
content could exceed, sitting in the file reading as though it decided. A bigger banner is a
different measurement; a banner that can grow is the defect back.

#### THE DESCRIPTION WAS NOT SMALL, IT WAS CUT OFF

*"the info of the game must show"*. `line-clamp-1` clipped the live title's description at
*"...quick thinking and precision are key. Connect"*, which reads as a rendering fault rather
than as a summary. It is two lines now, and **three is still forbidden** - the budget does not
carry it and nothing on screen would say so. The test was **renamed rather than rewritten**,
because the claim is unchanged: every line is clamped to a number the height was measured for.

The logo's guard is the one worth copying. *"the game logo bigger"* is **two numbers** - the box
and the grid track it sits in - and asserting either alone passes a broken screen: a bigger box
in a 132px column is a bigger box that is clipped, and a wider track under the old box is a small
logo in a wide gap. The test reads both out of the file and compares them. The **monogram** is
checked too, because it is the fallback for a title with no uploaded artwork - which is every
title today - so leaving it at the old size is a shrunken initial on the common case.

#### THE STRIP BECOMES CATALOGUE CONTENT, AND ABSENT MEANS DERIVED

`provider_game.heroFeatures` is a list of `{ icon, label }`, **ours** and therefore in no sync
allow-list at all - not even `firstSyncOnlyFields`, which the six contractual presentation fields
use. The provider contract is unchanged and **there is no version to bump**, exactly as with the
two panel illustrations.

**An unset field means "work the four out", never "show none".** No title in the catalogue
carries authored features, so the opposite reading would have stripped four facts off every hero
the day this shipped, with nothing failing and nothing logged. This is the `resolveAllowedGameTypes`
reading of an empty stored value, and the *opposite* of `entryBlockThreshold`'s "a stored value
and an absent one are different facts" - the question that decides it is which way the failure
falls. It also comes free: `game-content.service.ts` already `$unset`s an empty array, so clearing
the list in the dialog restores the derived four.

**One authored row replaces all four, not two of theirs beside two of ours.** A merge reads as
generous and leaves an operator unable to tell which lines are theirs or to remove ours. The
dialog says so beside the field, because a rule an operator cannot see is one they cannot use.

**`resolveHeroFeatures` in `arena-facts.ts` is the only place that decision is taken.** A second
copy is the "one rule, two copies" shape behind `referenceId`, `failedReason`, `challengeId` and
the Game Master `||`, and here the two answers are "the operator's strip" and "the platform's",
on the screen a player reads immediately before paying.

#### THE ICON VOCABULARY IS MIRRORED, MODEL-FREE AND NOT AN ENUM

`lib/services/games/hero-features.ts`, copied byte for byte into
`apps/admin/lib/services/games/hero-features.ts` - the `game-categories.ts` precedent. Three
things about its shape are decisions rather than style:

- **Model-free by requirement.** The dialog is `"use client"`, and **R58** is that a client
  component naming a driver-reaching module in a value-import position cannot build - which no
  typecheck, no test and no dev server can see.
- **`icon` is a `String` on the schema and deliberately not an enum.** A missing enum value
  rejects the **whole write**, so a vocabulary on the model means a slug we have not foreseen
  costs the entire catalogue row on a scheduled sync, silently.
- **An unrecognised slug keeps its row and loses its picture.** The label is the operator's
  statement and the glyph is decoration beside it, so dropping the row to save the picture is the
  wrong way round - the same answer as showing an unrecognised genre verbatim.

**`check:mirrors` compares models, so it has no opinion about this file**; the guarantee is a
byte-for-byte test. Two copies disagreeing means a glyph the admin offers is one the banner
cannot draw - a control that appears to work and renders a blank space on a live page.

**The validator refuses an unknown icon, where the genre field normalises one.** That looks
inconsistent on the same screen and is the right answer to a different question: a genre arrives
as free text from provider syncs and from titles predating the vocabulary, so refusing it would
block an unrelated tagline edit in the same request. **Nothing but this dialog has ever written
an icon slug.**

**The assistant is barred from the field with a reason recorded**, not merely absent from the
writable list - a field missing from an allow-list is admitted the moment somebody widens it.
These read like marketing lines and each one occupies a **fact position**: the slot the platform
otherwise fills from the round ceiling, the declared family and the contest's player range. A
model writes *"3 minute rounds"* on a title whose ceiling is ten - right about the genre, wrong
about the number.

#### "BIG REWARDS" IS NOW AVAILABLE, AND THE REFUSAL IN s4.1w STILL STANDS

The two are not in tension and the distinction is the useful part. The platform still will not
**derive** a rewards claim: the hero receives no prize figure, and a free contest would carry the
phrase. But an operator typing it into their own catalogue row is a person making a claim about
their own contest, with a name and a timestamp against it - **the refusal was never about the
words.** `reward` is in the picker for that reason, and the guard on the derived set is unchanged
and still red when anything puts the phrase there automatically.

**30 tests, 30 probes red on exactly one failure.** Two of the new probes are worth keeping for
their shape: one asserts the **two**-line clamp is present rather than only forbidding three,
because a guard that bans three lines is equally happy with the one line the owner rejected; and
one exhausts the vocabulary against the component's glyph map, because a spot check passes while
the slug somebody adds next renders nothing.

**Never verified by eye** - the arena is behind sign-in, and there is nothing authored to render
until an operator writes a strip.

---

### 4.1y The standings rail as a competitive leaderboard (owner rejection, 11 September 2026)

The owner's fifth rejection in this area, against two images: *"STOP. The leaderboard
implementation is structurally wrong. The target is not a small player status card. It is a full
competitive leaderboard sidebar with tabs, filters, many rows, and a bottom CTA. Also make the
whole sidebar extend to the same bottom edge as the gameplay board so the layout is aligned and
symmetric."* Then, closing: *"Fix only the leaderboard panel. Do not redesign the rest of the
page."*

**The live code is `components/games/arena/ArenaLeaderboardPanel.tsx`, the `standings` slot in
`GameArenaLayout.tsx`, the `variant` prop on `components/games/ProviderLeaderboard.tsx`, and the
five `NEON_TAB*` tokens plus `NeonScopeStrip` in `components/neon/`.** Nothing here is mirrored.
**24 tests across two suites, 19 probes red on exactly one failure.**

#### MOST OF THE TARGET WAS ALREADY BUILT, AND SAYING SO IS WHAT MAKES THE REST CREDIBLE

The rail already had a Trophy-headed *Leaderboard* title, a `Players (N)` count, a scope strip, a
four-column table (`#` / `Player` / score / `Time`), 28px avatars, a gold leader row with a crown
plate and a full-width `View Full Leaderboard →` button. Four things were genuinely missing or
wrong: **the height**, **two heading tabs rather than a title and a pill**, **three filter tabs
rather than one**, and **room for about ten rows**. A document describing this as building a
leaderboard from nothing is describing a fifth of it.

#### THE HEIGHT WAS A SPLIT-OWNERSHIP FAULT, NOT AN ARITHMETIC ONE

`GameArenaLayout` composed the chrome - heading, scope strip, footer button - while a separate
consumer supplied the rows. **Nothing owned the panel's height**: a heading at its text height, a
rows box capped at `max-h-[460px]`, and a footer at its content height, sitting in a grid cell as
tall as the game board. The arena backdrop showed through underneath, which is the owner's
*"oversized empty dark area"* - **a fault in the layout, not in the board beside it.**

One component owning the whole panel is what makes the fix expressible, and the fix is two parts:

- **`h-full` on the wrapper is a no-op that reviews as correct.** A grid item already stretches to
  its row's height, so the wrapper was the right height all along - which is why every reading of
  the arithmetic came back clean. Only **`[&>*]:h-full`** reaches the panel inside it. The same
  mistake was already made once, on the bottom band (s4.1t), so carry the rule rather than the two
  instances.
- **`xl:` only.** Below that breakpoint the rail is full width beneath the board, and a forced
  height there stretches a short list down an empty column.

**`min-h-[400px]` is room, never a cap.** How many players a contest has is not ours to decide, so
what is guaranteed is space for about ten rows; the panel grows past it to fill the row and the
overflow scrolls. A `max-h` reads as a sensible precaution and **is** the defect. And **exactly
one child grows** - two `flex-1` children divide the slack, so the footer drifts up from the
bottom edge by whatever the rows area does not need, which is the same empty area wearing a
different cause.

#### THE FOUR REMOVALS ARE ONE SWITCH, AND NOT ONE OF THEM LOSES A FACT

The owner's removal list - *"Not played yet / Playing now / YOU badge / yellow = #1 pills"* - is
right about the **ranking table**, because each of them adds row height and ten compact rows is
the requirement. Each is honoured somewhere else instead, which is why they are one `variant`
prop rather than three booleans a caller can get half right:

- **The activity lines moved to a PLAYERS roster tab.** They are the only thing on the screen that
  says whether a rival is still playing, and they also remain in the recent-players feed.
- **The `YOU` badge is gone as a word and survives as a tint.** `isCurrentUser` still colours the
  name, and **a tint on the name is the one marker that survives on the leader's gold row**, where
  a row background cannot.
- **The `= #1` pill is suppressed and two rows sharing a rank plate is the statement.**

#### FRIENDS AND COUNTRY ARE DRAWN AND CANNOT BE ANSWERED, WHICH IS A LABELLED FACT

There is **no friends model anywhere in `database/models`**, and while `country` does exist on the
user card, publishing it per row on a public board is a disclosure decision rather than a
rendering one. So all three scopes are drawn, `GLOBAL` lit and the other two on `NEON_TAB_DEAD`
with `aria-disabled`, a title explaining that everyone in the contest is shown, no hover and no
handler - **rendered as a `<span>`, so there is no control that appears to work.**

**This reverses a decision recorded in s4.1q**, whose guard asserted the rail draws *no* dead
scope tabs. That test was **flipped rather than deleted**, keeping the original objection verbatim
as the reason for *how* they are drawn. It is the second time the owner has overridden a recorded
guard here, so a document citing the old rule as current is stale - **say which.**

#### THE POLLING CONTRACT IS UNTOUCHED, AND THAT IS THE CONSTRAINT THAT SHAPED THE REBUILD

s4.1o's rules all still hold and none of them was relaxed to fit a bigger panel:
`LiveContestRefresher` stays banned on this page by a test, the round host stays a **child** of
the live provider rather than a consumer of it, and `getArenaStandings` stays the single producer
for both the first render and the poll. The new panel is a second **consumer** of the same
context, which is why the consumer count is now asserted as a sum across two files rather than
one - and it **fetches nothing of its own**, asserted.

**Three structural guards had to be sliced rather than left file-wide**, and all three had begun
firing on correct code: the band's wrapper count could not tell its three selectors from the
rail's, the panel's `flex-1` count caught a legitimate one on a roster row, and a whole-file ban
on `Standings` was satisfied by an import path. **A guard that fires on correct code is the one
the next reader deletes**, so slice to the construct and count the construct. Related, and the
fourth instance: `describeRoundActivity`'s first occurrence in a file is its **import**, so a
position assertion measured from `indexOf` is trivially true - use `lastIndexOf`.

**Never verified by eye** - the play screen is behind sign-in and the automated browser has no
session.

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
