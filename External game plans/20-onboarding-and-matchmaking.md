# 20 - Onboarding, Game Interests and Challenge Matchmaking (X11.5)

Added 2 September 2026 from the owner's brief. Nothing in chapters `01`-`19` covers this:
searching the folder for onboarding, matchmaking, game interest or player preference
returns no matches.

**What the owner asked for, in their words:** *"smart onboarding where the user gets
guided to pick games that want to be challenged in, and our system can match users that
are interested in those games as well with other prerequisites. If a user doesn't pick a
game, based on what he plays can match also users."*

Three requirements, and the third is the one that makes the feature work:

1. A player **declares** which games they are willing to be challenged in.
2. The system **matches** players by shared game interest **plus other prerequisites**.
3. For a player who declares nothing, interest is **inferred from what they actually
   play** - so the feature degrades to something useful rather than to nothing.

---

## 0. The correction that should be read before anything else

**A matchmaking service already exists, and it is trading-only.**

| What exists | Where |
|---|---|
| `getRankedMatches`, `findBestMatch`, `getMatchableTraders` | `lib/services/matchmaking.service.ts` |
| `GET /api/matchmaking` | `app/api/matchmaking/route.ts` |
| Opponent availability toggle | `UserPresence.acceptingChallenges` |
| User search | `GET /api/messaging/search/users` |
| Friends, requests, block list | `database/models/messaging/friend.model.ts`, `blocked-user.model.ts` |
| Rate limiting utility with named presets | `lib/utils/rate-limiter.ts` |
| First-run checklist | `components/dashboard/GettingStartedCard.tsx` |

So this chapter is **mostly a generalisation, not a green-field build**, which makes it
cheaper than it first looks. It also makes it **more dangerous than it looks**, and that
is the point of putting this section first:

> A trading-shaped matchmaker does not fail when a second game arrives. It keeps
> working, keeps returning matches, and keeps returning **trading** matches - ranking
> opponents by trading skill on a platform where most players may not trade. There is no
> error, no empty state and no log line. It is a silent product defect, and the only
> defence is to change the service rather than call it from a new place.

The same trap applies to `GettingStartedCard.tsx`, whose steps are *fund wallet, join
competition, **first trade**, milestone, challenge*. On a games-first platform, telling
every new player to place a trade is wrong, and it will keep rendering happily.

---

## 1. Declared game interests

### 1.1 Where the declaration lives

There is **no general player-preferences model** in the codebase. What exists is three
narrow stores: `UserNotificationPreferences`, `settings.privacy` on the Better Auth user
document, and `UserPresence.acceptingChallenges`.

`UserPresence.acceptingChallenges` is the closest existing concept - "am I open to being
challenged" - and it is a **single boolean for the whole platform**. The requirement is
per-game, so it needs a per-game dimension.

**Recommendation: a new `UserGamePreference` collection**, not an extension of
`UserPresence`.

| Field | Notes |
|---|---|
| `userId` | Indexed |
| `gameKey` | The immutable statistics key from `02`. Compound unique with `userId` |
| `willingToBeChallenged` | Explicit opt-in for challenges in this game |
| `interestLevel` | `declared` \| `inferred` - see section 3. **Never overwrite a declared value with an inferred one** |
| `declaredAt`, `inferredAt` | Separate timestamps, so a stale inference can be refreshed without touching a declaration |
| `skillBand` | Cached from `UserGameStats` for match filtering. Denormalised deliberately - a match query must not join per candidate |

Reasons for a separate collection rather than fields on `UserPresence`:

- `UserPresence` is **presence**, written on a heartbeat. Preferences are written rarely
  and read on every match query. Mixing a hot write path with a warm read path on one
  document invites lock contention for no benefit.
- `gameKey` is a per-row dimension. Putting a map on `UserPresence` reproduces the
  `brandingFiles` problem from Stage 0 - **Mongoose refuses map keys containing a dot**,
  and `gameKey` is `provider:{providerKey}:{gameCode}`, which contains colons today but
  is provider-supplied and must not be assumed dot-free. A row per game has no such trap.
- Both apps need to read it, so it is a **mirrored model** - `database/models/` and
  `apps/admin/database/models/`, same commit, per the sync rule.

`UserPresence.acceptingChallenges` is **kept** as a global master switch. A player who
turns it off is unmatchable regardless of per-game rows. Do not delete it and do not
reinterpret it - existing rows carry real player intent.

> **AMENDED 14 September 2026 - three of the four fields above were NOT built, and the
> mirroring claim is reversed.** See section 1.1a, which is the authoritative account of
> what exists. `interestLevel`, `inferredAt` and `skillBand` all belong to the inference
> engine in section 3, which is X11.5 and unbuilt - declaring them now would produce the
> fifth declared-written-dead field after `requiresSyncPlay`, `isPaused`,
> `lastSuccessfulRoundAt` and `family`. And the model is **main-app only**: `apps/admin`
> reads nothing from this collection yet, and R42 is the case that shows why mirroring
> ahead of a caller is worse than not - two copies agreeing while only one of them runs.
> The recommendation for a separate collection, and both of its reasons, were correct and
> are what shipped.

### 1.1a What was built (14 September 2026)

X10's second item. A player can now say which games they are happy to be challenged at,
and - for the first time - can reach the master switch at all.

**The master switch existed, was enforced, and had no UI anywhere.**
`UserPresence.acceptingChallenges` has been read by `POST /api/challenges` since long
before this programme, and no screen in either app ever wrote it. It defaults to `true`,
which is exactly why nobody had noticed: the setting was unreachable and the platform
behaved as though everybody had opted in. So half of this slice is a control that was
already being obeyed, and a document describing the master switch as new is wrong.

**THE DEFAULT IS THE WHOLE EXPOSURE.** Every player on the platform has zero rows in the
new collection. Reading absence as "not willing" refuses **every challenge on the
platform**, and it does so silently - a refusal is a 400, not an error, so nothing is
thrown and nothing is logged - while every structural test stays green. The rule lives in
one place, `WILLING_TO_BE_CHALLENGED_BY_DEFAULT` in
`lib/services/games/challenge-willingness.ts`, and the schema default is asserted equal to
it by a test, because a schema default **is** a stored value as far as the next reader is
concerned (the R50 rule). Note the deliberate contrast with `entryBlockThreshold` and
`canEnterChallenges`, where a stored value and an absent one are different facts: there a
stored value was being over-trusted, and here the question is whether any legitimate
writer can produce the absent case. Every writer is a player pressing a switch, so
absence only ever means "nobody has said".

**TWO SWITCHES, AND THE ORDER THEY ARE ASKED IN IS LOAD-BEARING.** The master switch is
checked first and the per-game one second, with two different refusals. A player who has
switched challenges off entirely has not said anything about *games*, so the per-game
message - which names the game, precisely so the challenger knows to try a different one -
would be a false statement about why they were refused. A shared message makes the finer
setting indistinguishable from the master one, which is the failure the `creationDecidedBy`
work on Game Master limits was built to avoid. The ordering is pinned by a test, and a
probe deleting the master check turns it red.

**The rules module is model-free by requirement, not by preference.** The settings screen
is a `"use client"` component and the create route is a server route, and both have to
agree about what an absent row means - so the rule cannot live beside a Mongoose model.
**R58** is the case: a client component naming a driver-reaching module took the admin
app's build down, and a clean typecheck, a green suite and a working dev server are all
consistent with an app that cannot build at all. A probe adds a model import to the rules
module and the R58 guard turns red.

**Declarations are indexed in a `Map`, never an object.** The key is a stored `gameKey`,
and an object lookup walks the prototype chain, so a row keyed `"__proto__"` returns a
truthy `Object.prototype` that survives a `!row` test. Fourth instance of that trap after
the round-inspector action map, `competition-update-fields.ts` and
`UNSCORED_CONTEST_POLICY_COPY`.

**An unrecognised `gameKey` is REFUSED, never stored.** `gameKey` is immutable and is the
join key for every historical statistic, so a row under a key nothing resolves is a setting
the player can see, toggle and never have honoured - and it is indistinguishable from a game
that has been retired. Same rule as the contest-edit allow-list refusing an unknown field
rather than dropping it. A blank key is dropped at indexing rather than stored, or it
answers for a game nobody named.

**Trading is always first and is never fetched**, matching `ChallengeGamePicker`. It has no
catalogue row, so a list built from `listChallengeableTitles` alone silently offers no way
to opt out of the one game every player on the platform can already be challenged at. Both
halves are probed - dropping it, and listing it last.

**A title that cannot be played one against one is listed and disabled, not hidden.** A
control that vanishes reads as lost rather than as inapplicable, the same reasoning as the
game picker disabling a title instead of hiding it. The per-game rows are likewise dimmed
rather than removed when the master switch is off.

**A live defect was found and fixed on the way: the master switch could not be saved by a
new player.** `PUT /api/user/presence` did a plain `findOneAndUpdate` and 404ed on a
missing document - so the one player most likely to be setting this *before* they start
playing was the one it refused. Worse than a plain failure, because the create route reads
the **absence** of the presence row as "accepting": the refusal left them reachable while
the screen reported the switch had been saved. It now upserts, with `$setOnInsert` matching
the heartbeat's minus the status and timestamps, since changing a setting is not evidence of
activity. It also now refuses a non-boolean with `typeof` rather than a truthiness check -
switching challenges **off** is the entire point of the route, and
`$set: { acceptingChallenges: undefined }` is a no-op that still reports success (the R31
rule). This was reachable in production and **nothing was backfilled**, because there is
nothing to backfill: no row was written, so the affected set is "every player who tried",
which is unqueryable.

**The screen writes each field through the route that owns it.** The master switch goes to
`PUT /api/user/presence`; only the per-game rows go through the new
`/api/user/challenge-availability`, whose `PATCH` deliberately refuses to touch
`acceptingChallenges` at all. A second writer of one field is the "one rule, two copies"
shape in its smallest form, after `referenceId`, `failedReason`, `challengeId` and the Game
Master `||`. And it must be `PUT`, never `PATCH`: `PATCH` on the presence route is the
**heartbeat**, so using it would make changing a setting indistinguishable from playing.

**The read is withheld for an open challenge**, for the same reason as the three opponent
reads beside it - there is nobody to ask. An empty map rather than `null`, so the predicate
reads the default without a null branch. Unconditionally, it would be answered from the
*creator's own* declarations, and opting out of a game would stop you **offering** it.

**The opponent list still does not filter on willingness**, deliberately and unchanged from
`13` s4.1aa: the create route refuses and names the reason, where a list that quietly omits
people is indistinguishable from the person not existing.

| Piece | Where |
|---|---|
| The rules - default, index, predicate, refusal | `lib/services/games/challenge-willingness.ts` (model-free) |
| The rows | `database/models/games/user-game-preference.model.ts` (**main app only**) |
| The database half | `lib/services/games/challenge-availability.service.ts` |
| Read and write for the screen | `GET` / `PATCH /api/user/challenge-availability` |
| The enforcement | `POST /api/challenges`, after the master switch and **before any wallet read** |
| The screen | `components/profile/ChallengeAvailabilitySection.tsx`, mounted in `ProfileSettingsSection.tsx` |
| The master switch fix | `PUT /api/user/presence` |

30 tests in `__tests__/challenges/game-willingness.test.ts`, 23 probes in
`tools/probe-game-willingness.ps1`, every one red on exactly the expected test. **Never
verified by eye** - the profile screen is behind sign-in.

**Not built:** the interest inference of section 3, the onboarding step of section 1.2, and
matchmaking suggestions - all X11.5. The distinction section 3.2 draws is untouched and
still matters: **inference is not consent**, so inferred interest drives *suggestions* while
this explicit opt-in drives *invitations*.

### 1.2 The onboarding step itself

**Open question 16 is unresolved and this section does not pre-empt it:** whether
interests are collected during registration or prompted later is a product decision, and
adding steps to registration measurably costs completions.

What the design does guarantee is that **the answer does not matter to the engine**.
Section 3 means a player who never answers is still matchable. So the onboarding step can
be added, moved, or deferred entirely without the feature breaking - which is the reason
to build inference first and the picker second, not the other way round.

Extend the existing `GettingStartedCard.tsx` rather than adding a second first-run
surface. It already has a dismissal mechanism, it is already rendered from
`DashboardLayout.tsx`, and a platform with two competing "getting started" widgets is
worse than one imperfect one.

**Its steps must become game-aware in the same pass** - see section 5.

---

## 2. Challenge opponents - "challenge any user"

### 2.1 What exists, precisely

A challenge is created by `POST /api/challenges` with a **required `challengedId`**. It is
always a direct invitation to one named player. There is **no open challenge anyone can
accept**, and the help page (`app/(root)/help/page-content.tsx`) states that plainly.

`GET /api/landing/challenges` looks like a public challenge list but is not one - it is an
anonymised marketing feed of recent challenges and nothing can be joined from it. Do not
mistake it for the feature.

### 2.2 What "challenge any user" adds

| Piece | Status | Notes |
|---|---|---|
| Opponent search | **Exists**, needs wiring | `GET /api/messaging/search/users` already returns friend, block and pending flags |
| Game picker on challenge create | New, but designed | `03` section 2 covers the mechanics; only the opponent half was missing |
| **Open challenges** - post a challenge, first eligible player accepts | **New** | The genuinely new mechanic |
| Decline path | **Exists** | `POST /api/challenges/[id]/decline` |
| Block list | **Exists** | `BlockedUser`, `Friendship.blockedBy`; `isBlockedByEither` is the check to use |
| Rate limit | **Exists as a utility**, needs a preset | `lib/utils/rate-limiter.ts` has `RateLimiters` presets for deposits, withdrawals, login. A `challengeInvite` preset is a small addition |
| Per-game opt-in | **New** | Section 1 |

### 2.3 The three controls that are not optional

**Open question 15 must be answered by the owner before X10 starts:** may anyone challenge
anyone, only friends, or only players who opted in per game? The design below assumes
"anyone who opted in", because it is the only one of the three that satisfies the owner's
brief without creating an unmanaged harassment surface.

Whatever the answer, three controls ship with the feature or the feature does not ship:

1. **Honour the existing block list on both sides.** `BlockedUser.isBlockedByEither` -
   not `isBlocked`, which is directional and would let a blocked player still initiate.
2. **A rate limit on invitations sent.** Without it, one player can invite the entire
   platform. Reuse `checkRateLimit`; do not write a second limiter.
3. **A way to stop receiving them** that is not "block every individual". This is what
   per-game `willingToBeChallenged` and the global `acceptingChallenges` are for.

There is a fourth control the platform does **not** have: **there is no player-facing
report-user feature.** Blocking exists; reporting does not. Letting strangers initiate
paid contests against each other without a reporting path is a policy decision, and it
should be made deliberately rather than discovered after launch. It is raised here and
not designed here, because it is not a games problem.

**A note on a dead capability:** `Friendship.mute` and `.unmute` exist as model methods
and `isMuted` is returned by the friends endpoint, but **no HTTP route calls them**. If
mute is wanted for challenges, it is a route away, not a feature away - and if it is not
wanted, the methods should be deleted rather than left as an invitation, on the same
reasoning that deleted `shouldBlockEntry` in Prerequisite B.

---

## 3. Inferred interest - the part that makes it work

**Requirement 3 from the brief, and the one that determines whether the feature is
useful on day one.** A brand-new matchmaking feature on a platform where nobody has
declared anything returns nothing, and a feature that returns nothing gets removed.

### 3.1 The signal

Interest is inferred from participation, which the platform already records:

| Source | Signal |
|---|---|
| `CompetitionParticipant` rows by `gameType` / `gameKey` | The player paid to enter this game |
| `ChallengeParticipant` rows | The player accepted a challenge in this game |
| `UserGameStats` (from `18`) | Aggregate play counts per game, already being backfilled |

Prefer `UserGameStats`. It exists for exactly this shape of query, and counting
participant rows per candidate inside a match query does not scale.

### 3.2 The rules that keep it honest

- **A declaration always wins.** `interestLevel: "declared"` is never overwritten by an
  inference. A player who said "not chess" must not be offered chess because they played
  it once.
- **An explicit `willingToBeChallenged: false` is a declaration**, not an absence. This is
  the same distinction that made `canEnterChallenges` a live defect in Prerequisite B: a
  stored `false` and a missing row are different facts, and code that treats them alike
  silently overrides intent.
- **Inference implies willingness to *play*, not willingness to be *challenged*.** Paying
  to enter a competition is not consent to receive 1v1 invitations from strangers. So an
  inferred interest may drive **suggestions** - "you might like a chess challenge" - but
  the invitation itself needs the opt-in from section 1. Conflating the two is how a
  matchmaking feature becomes a spam feature.
- **Practice does not count.** Practice is free, unranked and prize-less (`03`). A player
  trying a game once in practice has expressed curiosity, not commitment.

### 3.3 Not a recommendation engine

State this explicitly, because scope creep here is the obvious failure mode and **R24 -
scope creep - is already rated High likelihood** in `17`. Inference is a **count of games
the player has actually played**, ordered by recency and volume. It is not collaborative
filtering, it is not a model, and it has no training step. If a later phase wants one,
that is a separate decision with its own record.

---

## 4. Matching - the "other prerequisites"

The owner's phrase "as well with other prerequisites" is the important half, because
shared interest alone produces bad matches.

`getRankedMatches` in the existing service already ranks by **trading** skill
compatibility. Generalising it means the compatibility input becomes per-game.

| Prerequisite | Source | Why it matters |
|---|---|---|
| Shared game interest | `UserGamePreference` (declared or inferred) | The owner's core requirement |
| Both opted in to challenges | `willingToBeChallenged` + `acceptingChallenges` | Consent |
| Comparable skill **in that game** | `UserGameStats` skill rating per `gameKey` (`05` section 4) | A chess expert against a first-timer is not a contest. **Per-game, not overall** - the two are unrelated |
| Neither blocks the other | `isBlockedByEither` | Safety |
| Account standing | `checkAccountStanding` from `lib/services/contest-entry/guards.ts` | Do not match a suspended account. Reuse the shared guard fixed in Stage 0 sub-defect 1b - do not write a second standing check |
| Affordability | Wallet balance against the intended entry fee | Matching two players who cannot both pay wastes the invitation |
| The game is enabled | `chartvoltEnabled` on `provider_game`, plus `assertGameEnabled` | A match into a disabled game is a dead end |
| Presence, if required | `ChallengeSettings.requireBothOnline` | Existing setting; respect it |

**The skill-rating trap, stated because it is easy to get backwards:** ranking by a
player's *overall* cross-game standing rather than their rating *in the matched game*
produces a matchmaker that pairs strong players with strong players across unrelated
games. It will look like it is working. `05` section 4 defines skill rating per game for
this reason; use it.

---

## 5. Onboarding steps must stop being trading steps

`GettingStartedCard.tsx` has a hard-coded step list: fund wallet, join competition, place
first trade, reach a milestone, send a challenge. Three of those five survive a
games-first platform unchanged; **"place first trade" does not**, and "join competition"
needs to point at a game the player might actually want.

This is a small change with a disproportionate effect, because the card is the first
thing a new player reads. It belongs in this phase rather than in the X8 wording pass,
because it is a **logic** change - which steps exist and when they are complete - not a
string change.

Gate the trading step on `tradingEnabled` (`15` section 2) so an operator who turns
trading off does not leave new players with an impossible checklist item.

> **BUILT 18 September 2026 (ahead of X11.5).** The live code is
> `lib/utils/getting-started-steps.ts`, `components/dashboard/GettingStartedCard.tsx`,
> `tradingEnabled` on `getComprehensiveDashboardData`, and
> `__tests__/dashboard/getting-started-game-aware.test.ts` (5 tests). **Five facts drift
> easily.** **"Place Your First Trade" is gone** — the play step is always
> `Play Your First Contest`, and when `tradingEnabled` is false its description never
> mentions a trade or a position (DoD in section 9). **Completion is either signal** —
> `hasPlacedTrade` OR any `gamePerformance` row with `rounds.started` / `rounds.scored`
> — so a games-only player is not stranded on an empty trade count. **`tradingEnabled`
> comes from `getEnabledGameTypes()` for creation/discovery only** and must not filter
> the game-performance fetch (R29). **The step list is built once** in the model-free
> helper; the card imports it and a test forbids restating titles beside the import.
> **Not built with this:** interest inference, the matchmaking generalisation, or a
> `/games` join href — join still points at `/competitions` until the catalogue browse
> surface is the default. Never verified by eye (sign-in).

---

## 6. Data model summary

All additive. Both apps, same commit, per the sync rule.

| Collection | Status | Purpose |
|---|---|---|
| `UserGamePreference` | **New**, mirrored | Declared and inferred interest per game, per player |
| `UserGameStats` | Already in `18` | Per-game play counts and skill rating - the inference and matching input |
| `UserPresence` | Existing, unchanged | Global challenge availability master switch |
| `Challenge` | Existing, extended in `04` | Gains `gameKey`. Open challenges need a nullable `challengedId` - see below |
| `BlockedUser`, `Friendship` | Existing, unchanged | Safety checks |

**One schema consequence worth flagging early:** `Challenge.challengedId` is currently
required, because every challenge is a direct invitation. An **open** challenge has no
opponent until someone accepts. Making that field optional is a real schema change with a
real risk - every reader that assumes `challengedId` is present must be found first. The
alternative is a separate `OpenChallenge` collection that materialises a `Challenge` on
acceptance, which keeps the money path untouched at the cost of a second model.

**Recommendation: the separate collection.** `Challenge` is on the money path, it is
mirrored, and Stage 0 spent significant effort proving how easily that path breaks.
Loosening a required field there to add a browsing feature is the wrong trade.

> **BUILT 14 September 2026, AND THIS RECOMMENDATION WAS REVERSED.** The three opponent fields
> are **conditionally** required on `Challenge` itself, keyed on an explicit stored
> `openToAnyone` flag, and there is **no `OpenChallenge` collection**. `03` s2.4a is the
> authoritative account; a document proposing the collection is describing the plan rather
> than the code. The reasoning above is not wrong about `Challenge` being fragile - it is
> wrong about which option is riskier. **Materialising a `Challenge` on acceptance makes the
> materialising step a second writer of a money document**, which is precisely the shape this
> programme has spent weeks removing (four competition entry paths, ten finalize sites, two
> copies of the challenge payout). The conditional-field version has one writer and one atomic
> claim. What survives of the caution is the part that was actually load-bearing: **every
> reader assuming `challengedId` is present had to be found first**, which is why that count
> was the first step of the build, and why a runtime tripwire narrows the field back before
> any money moves. Two consequences follow. `check:mirrors` compares field paths and enum
> values and **cannot see a `required` predicate**, so the two copies are held by a
> byte-for-byte test instead. And the acceptance criterion in section 9 - *"open challenges
> cannot loosen a required field on `Challenge`"* - is **deliberately not met**, and should be
> read as the question it was raised to ask rather than as a rule that was broken.

### 6.1 Nothing here changes what we ask of a provider

Checked deliberately, because it decides whether this chapter is gated on a commercial
negotiation. **It is not.** Everything in this chapter is ours:

- Interests, matching and onboarding never leave ChartVolt.
- An **open** challenge still creates one round per player when each plays, so a provider
  never needs to know that the opponent was unknown when the challenge was posted.
- The `contentSeed` is set by us at challenge creation and is already required to be
  identical for both players (`03` section 2.1). An unknown second player does not change
  that - the seed is fixed before either round exists.
- Per-game skill comparison uses `scoreType`, `scoreDirection` and `scoreRange`, all
  already required by `01`.

So `01-provider-contract-specification.md` and `ChartVolt-Game-API-Requirements.html`
**need no change for this chapter**, and X10 and X11.5 are not blocked on a contract
amendment. Worth stating because the provider-facing document carries a version number
that providers may already be building against, and bumping it without cause is a cost of
its own.

---

## 7. Effort and sequencing

**X11.5, 2-3 weeks.** Placed after X11 (games catalogue) because matchmaking with one
game is pointless, and the catalogue is what makes several games visible.

| Item | Estimate | Notes |
|---|---|---|
| `UserGamePreference` model, both apps, plus read/write routes | 2-3 days | |
| Generalise `matchmaking.service.ts` from trading-only to per-game | 3-5 days | The core work. Includes the per-game skill-rating fix from section 4 |
| Inference from `UserGameStats` | 2-3 days | Cheap because `UserGameStats` already exists |
| Opponent picker on challenge create | 2-3 days | Search endpoint already exists |
| ~~Open challenges - `OpenChallenge` collection, list, accept~~ **BUILT 14 Sep 2026, and with no such collection** - see the amendment in section 6 | ~~4-5 days~~ done | The only genuinely new mechanic. Counted in X10, not here |
| Abuse controls - rate-limit preset, block checks, opt-out surface | 1-2 days | Utilities exist |
| Onboarding card made game-aware | 1-2 days | |

**Why this is not longer, and why that should be double-checked rather than trusted:**
almost every dependency already exists, so the estimate is dominated by generalisation
rather than construction. The risk in that is the usual one - generalising a service is
easy to under-scope because the *new* behaviour is small while the *existing* call sites
are many. Before committing to it, count the callers of
`matchmaking.service.ts` and `GET /api/matchmaking`, exactly as Stage 0 learned to count
the entry-path writers before unifying them and found four instead of two.

---

## 8. Risks specific to this chapter

| # | Risk | Severity | Mitigation |
|---|---|---|---|
| **X13** | The **trading-only matchmaker keeps working** after a second game arrives, silently returning trading matches on a games platform. No error, no empty state | **High** | Change the service, do not call it from a new place. A test that asserts a match in a non-trading game, which must fail before the change |
| **X14** | **Inference read as consent.** A player who paid to enter a competition starts receiving stranger invitations they never asked for | **High** | Section 3.2 - inference drives suggestions, the opt-in drives invitations. Never one from the other |
| **X15** | **"Challenge any user" becomes a harassment surface.** No player-facing report feature exists | Medium | Rate limit, block checks on both sides, per-game opt-out. Reporting is an owner policy decision, raised in section 2.3 |
| **X16** | **Overall rank used instead of per-game rating**, pairing mismatched opponents while appearing correct | Medium | `05` section 4 rating per `gameKey`. A test with a player strong in one game and weak in another |
| **X17** | **Scope creep into a recommendation engine.** R24 is already High | Medium | Section 3.3 - counts, not models. A change of approach needs its own decision record |
| **X18** | **Empty matchmaking at launch**, because nobody has declared anything | Medium | Inference ships **before** the picker, not after. That ordering is the mitigation |

---

## 9. Definition of done

- [x] A player can declare, per game, whether they are willing to be challenged, and an
      explicit "no" is distinguishable from never having answered. **Done 14 September 2026,
      section 1.1a.** Note the second clause is satisfied by an **opt-out**: the stored
      `false` is the declaration and absence is the default, which is the right way round
      here because reading absence as "not willing" would refuse every challenge on the
      platform the moment the collection existed.
- [ ] Matchmaking returns opponents for a **non-trading** game, proven by a test that
      fails against the current trading-only service.
- [ ] A player who has declared nothing still receives sensible suggestions, derived from
      games they have actually played and paid for.
- [ ] An inferred interest never produces an invitation from a stranger without an
      explicit opt-in.
- [ ] Skill comparison uses the rating **for the matched game**, proven by a player who is
      strong in one game and weak in another.
- [ ] Blocks are honoured in both directions; invitations are rate-limited; a player can
      stop receiving invitations without blocking individuals.
- [ ] Suspended and restricted accounts are never matched, via the shared
      `checkAccountStanding` guard rather than a second implementation.
- [x] The getting-started card contains no trading-only step when `tradingEnabled` is
      false. **Done 18 September 2026, section 5 BUILT.** A games-only first play
      (rounds) also completes the play step without a trade.
- [x] ~~Open challenges cannot loosen a required field on `Challenge`, per section 6.~~
      **Deliberately not met, 14 September 2026** - the three opponent fields are
      conditionally required on `Challenge` and there is no `OpenChallenge` collection. See
      the amendment in section 6 for why the separate collection was the riskier option, and
      what the caution is replaced by: a counted sweep of every reader that assumed a named
      opponent, a runtime tripwire before any money moves, and a byte-for-byte mirror test,
      since `check:mirrors` cannot see a `required` predicate.
