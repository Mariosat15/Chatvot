# 17 - Risk Register

Two classes of risk. **Platform risks (R-series)** are ways the existing application can
break while being generalised - they apply whoever supplies the games. **Scenario risks
(X-series)** exist only because a third party is on the critical path.

`07-failure-modes-and-edge-cases.md` covers runtime failures during a contest. This
chapter covers risks to the programme and to the application.

---

## 1. Summary

| ID | Risk | Severity | Likelihood | Phase |
|---|---|---|---|---|
| **R1** | Money paths refactored without tests first | Critical | High | **X0** |
| **R2** | Admin mirror drift | Critical | **ALREADY OCCURRED** | **X0** |
| **R3** | Trading settlement runs against a provider contest | Critical | High | X1, X5 - **CLOSED 4 Sep 2026** |
| **R4** | Double finalization pays twice | Critical | Medium | X0, X1 |
| **R5** | Dead Inngest crons re-registered | Critical | Low | X0, X1 |
| **R13** | Ledger enum renamed | Critical | Low | X1, X8 |
| **R26** | Admin-app finalization pays no Game Master earnings | Critical | **ALREADY OCCURRED** | X1 or X5 - **CLOSED 5 Sep 2026**, not retroactive |
| **X1** | Abstraction cannot be proven without the provider | **High** | **High** | X4 |
| **X2** | Single supplier on the critical path | **High** | Medium | All |
| **X3** | No cost floor - per-round fee kills cheap contests | **High** | Medium | Before X4 |
| **X7** | Game Master provider contest is net loss-making | **High** | **High** if ungated | Before X6 |
| **X8** | **No fallback game** now external-only is decided - X2 with its mitigation removed | **High** | Medium | Before X4 - **mitigation approved 5 Sep 2026 (X4a, `21`), STILL OPEN until it ships** |
| **X13** | Trading-only matchmaker silently returns trading matches on a games platform | **High** | **High** | X11.5 |
| **X14** | Inferred game interest read as consent to stranger invitations | **High** | Medium | X11.5 |
| **R29** | **Disabling a game retroactively demotes players** who earned levels, points or ranks in it | **High** | **High** | **X1** - the design decision is made there |
| **R30** | `distributePrizesWithTies` took a **fraction** from a parameter named `platformFeePercentage`; a caller passing `10` paid **negative prizes** | **High** | Medium | **CLOSED 4 Sep 2026** - renamed to `platformFeeFraction` and range-checked in both apps |
| R6 | Price infrastructure broken by gating | High | Medium | X8 |
| **R7** | Raw-driver contest inserts miss the game label | High | High | **CLOSED 4 Sep 2026** - **six** writers found, not one; all stamp `contestGameLabel()`, pinned by a test that counts labels against inserts |
| **R58** | **A client component importing one number from a service took the admin panel down** | High | **ALREADY OCCURRED** | **CLOSED 9 Sep 2026** |
| **R59** | **Every dialog that asked to be wide rendered at 32rem** - an unprefixed `max-w-*` never displaces the primitive's `sm:max-w-lg` | Medium | **ALREADY OCCURRED, 31 dialogs** | **CLOSED for the games surface 9 Sep 2026**; the other 29 are an owner decision |
| **R60** | **A native `<select>` on a translucent background renders white on white** - the *browser* paints the list, taking the background from the element and letting options inherit `color`. **Two instances found** | Low | **ALREADY OCCURRED, 2 controls** | **Genre picker CLOSED 9 Sep 2026**; `MessagingSection.tsx`'s employee picker is a **named, tested exception** - blocked by that file's lint debt |
| R8 | Bulk find-and-replace on wording | High | Medium | X8 |
| R9 | Fraud throttle blind to provider entries | High | High | X5 |
| R11 | Legal wording changed without review | High | Medium | X8 |
| R12 | Badge or milestone IDs renamed | High | Medium | X7 |
| R17 | Disabling trading strands active contests | High | Medium | X8 |
| X4 | We cannot fix the provider's game | Medium | High | X12 |
| X5 | Provider will not supply page content | Medium | Medium | Before X4 |
| X6 | Registry gets only one real implementation | Medium | High | X9 |
| R10 | Market-hours settings block provider contests | Medium | High | X1 |
| R14 | Leaderboard migration changes rankings | Medium | High | X7 |
| R18 | Trading providers hoisted to a shared layout | Medium | Medium | X7 |
| R19 | Component move breaks imports | Medium | Medium | X7 |
| R20 | `startingCapital` required blocks provider contests | Medium | Medium | X1 |
| R21 | Dashboard mega-action split | Medium | Medium | X7 |
| R22 | New admin sections invisible - RBAC | Low | High | X6 |
| R23 | Notification links point to `/trade` | Medium | High | X6 |
| R31 | A Game Master rate configured at 0% is treated as unset | Medium | **CLOSED 5 Sep 2026.** Latent, not occurred - the admin UI could not store a 0% rate | Fixed in its own commit |
| R32 | Provider scores never reached `participant.score`, so every player tied at zero and split the pool equally | **High** | **CLOSED 5 Sep 2026.** Latent - no provider contest has ever settled, so nothing to backfill and the fix is **not** retroactive | `lib/services/games/participant-score.service.ts`, gate 11b |
| R33 | `scoreDirection` was read from a field neither participant copy declared, so a lower-is-better game paid the slowest player first | **High** | **CLOSED 5 Sep 2026.** Latent, same reason as R32 | `resolveContestScoreDirection` reads the catalogue title once |
| R34 | **The platform cannot honour the callback authentication its own issued spec promises.** `01` s2.2 and the requirements HTML both promise `Bearer {CALLBACK_TOKEN}`, "a token we issue to you". No such field exists - `gameProviderCredentials` holds `apiKey`, `apiSecret` and `callbackSecret`, the credentials dialog offers three inputs, and `loadProviderSecrets` sets `callbackToken: credentials.apiKey`. So gate 3 expects a provider to authenticate **inbound** with the credential they issued us for **outbound** calls | Medium | **CLOSED 6 Sep 2026, found the same day by X4a.** Latent throughout - no real provider ever existed and the mock uses its own header, so **nothing was ever refused in production and there is nothing to backfill.** It was **not workaroundable by configuration**, because there was nowhere to type the value; a conforming provider was rejected and logged as "either credentials are wrong or someone is probing the endpoint", so a correct integration **read as an attack** | Additive `callbackToken` on both `whitelabel.model.ts` copies, `callbackToken \|\| apiKey` in `loadProviderSecrets` for backward compatibility, a fourth credentials input grouped by **which side issued it**, and a `setProviderEnabled` refusal that requires the **explicit** field so the fallback cannot become permanent. `__tests__/services/provider-callback-token.test.ts` (8 tests) + `tools/probe-callback-token.ps1` (14 probes). **Fixing it exposed a sibling defect that was already reachable:** a provider could be enabled with a callback secret and no token at all, which is a switch turned on into a configuration where every result fails at gate 3 |
| R35 | **A provider's `replayUrl` can leak a live contest's content.** Section 8 requires a `replayUrl` on every result and defines nothing about it - not what it serves, who may open it, whether it authenticates, or how long it lives. A contest's boards are **identical for every player** by design, because that is what makes the ranking a fair comparison. So a replay that shows *the puzzle* rather than *the player's own attempt* lets a player who has finished read the content of a contest still being played | Medium | **OPEN, found 6 Sep 2026 by X4a** as ambiguity A14. Latent on our side: `games-service` builds a `replayUrl` and **no route serves it**, so the platform is handed a URL answering `NOT_FOUND` - a promise made inside a signed payload. The risk is a **third party's** replay screen, which we do not control and cannot inspect | Specify it in `01` and the requirements HTML: the player's own submitted attempt, not the content; token-scoped to that round; and no earlier than the contest's `playWindowEnd`. Then either serve it or remove the field |
| R36 | **A plain-http `NEXT_PUBLIC_BASE_URL` gives the provider a result callback it cannot use.** `round-launch.service.ts:273` builds `resultCallbackUrl` from it, so it is where every score is POSTed. Two consequences, and the second is the one that would be mistaken for a provider fault: the callback token travels unencrypted, and **certbot installs an http → https redirect as a matter of course while the fetch specification converts a POST following a 301 into a GET** - so the result arrives as a GET, is rejected, and the round is written off as unresolved. The visible symptom is players reporting vanished scores days later | Medium | **CLOSED 6 Sep 2026. Found on the owner's live deployment**, which held `http://chartvolt.com/` against an https site - and found by the games setup script's origin check while doing something else entirely, not by analysis. Latent: no provider round has ever launched in production, so **nothing was backfilled and there is nothing to backfill.** The guard already refused an *absent* value while accepting an explicitly-set localhost - **the same failure reached by a value that looks configured** | `publicBaseUrl()` refuses plain http and loopback hosts under `NODE_ENV=production` only, failing closed on anything `URL` cannot parse. Five tests in `__tests__/services/provider-round-launch.test.ts` + `tools/probe-launch-base-url.ps1` (7 probes). **The development carve-out is pinned as firmly as the refusals**, because every local rehearsal serves plain http on loopback and a guard that fires there gets switched off rather than fixed. `resultCallbackUrl` appears at five call sites and **only one constructs it** - verified with `rg`, so the single guard covers all of them |
| R37 | **The provider leaderboard ranked on nothing.** Both `getCompetitionLeaderboard` copies were written for trading: the main app's projection listed only trading metrics so `score` was never selected, and neither app's `participantData` mapping carried `score` or `scoreDirection`. So every provider participant reached `calculateRankings` with `score` undefined, `getProviderRankingValue` read `score ?? 0`, **the whole field tied on zero, and the board rendered in whatever order the tie-breakers or the documents happened to give.** A lower-is-better title was worse than wrong - it was *reversed on the board and correct at settlement*, so a player could lead a race-time contest all week and be paid last | High | **CLOSED 6 Sep 2026, found by writing a test for something else** - a reproduction of the owner's live error page, which this was not. Latent for payouts: settlement resolves both fields itself (R32/R33), so **no prize has ever been misapplied and nothing was backfilled.** Not latent for players: the board is a live read, so any provider contest entered before this date displayed a meaningless order. **This is R32/R33 one layer out** - the write path was fixed on 5 Sep and the two READ paths were never examined, which is the "count the callers" rule applied to a seam rather than to a writer | `resolveScoreDirection` extracted to `lib/services/games/score-direction.service.ts` (mirrored) and now used by **settlement and both leaderboards**, so the live board and the payout cannot disagree. 11 tests in `__tests__/services/provider-contest-lobby-shape.test.ts`, `tools/probe-leaderboard-score.ps1` (5 probes, all red). **`scoreDirection` is still not stored per row** - `05` s2 forbids it, because per-row storage lets two rows in one board disagree, which is incoherent rather than merely wrong |
| R38 | **A warning no operator could ever clear.** `provider_game.lastSuccessfulRoundAt` was declared in X2 and **read** by the contest wizard's pre-flight checklist, which warns when a title's sandbox looks stale - but **nothing has ever written it.** So the field was `null` on every title however many rounds had scored, and every operator creating or publishing a provider contest was shown a stale-sandbox caution that no amount of successful play could remove. The harm is not the wording: an advisory that is always on is an advisory nobody reads, so the *next* warning in that list - one that matters - is skipped with it | Low | **CLOSED 6 Sep 2026, found while building the provider health panel** by grepping for the field's writer before displaying it. Latent for money and **live for operators** from the day the wizard shipped. **Nothing was backfilled**: the timestamp is a freshness signal, and inventing one from `game_round` history would assert a fact about a sandbox nobody observed | Stamped at the sibling of gate 11b in `result-ingestion.service.ts`, the single ingestion door, and **only for `completed`** - `abandoned`, `expired` and `voided` are terminal too, so stamping them would make the signal mean "a round ended recently", which is true of a provider failing every round. The write is wrapped so its failure cannot fail the ingestion: the score is money-bearing and a cosmetic timestamp must never be able to reject it. 3 tests in `__tests__/services/round-lifecycle.test.ts`, 2 probes in `tools/probe-provider-health.ps1`. **The sibling fields are worse and were handled differently** - `game_provider.healthStatus` and `lastHealthCheckAt` have the same no-writer defect *and* `healthStatus` defaults to `"down"`, so the provider list could render a working provider as down. They were removed from the admin DTOs rather than given a writer; see `12` s4.2b for why health is derived instead |
| R39 | **The trading lobby was completely unavailable in production**, for every trading contest, from the design-kit deploy until the fix. Not degraded - the error boundary, on the platform's busiest player screen. One prop caused it: the kit's accordion is the only `"use client"` file in it, and it took `icon: LucideIcon`, so a **React component - a function - was being passed across the server/client boundary**. The runtime error names `{$$typeof, render, displayName}`, a `forwardRef` object, which reads as nothing recognisable | High | **CLOSED 6 Sep 2026, reported by the owner from a live screen** - the only entry here found that way rather than by us. **Nothing was backfilled and nothing could be:** the page threw on render, so there is no bad data, only failed requests. The fix is a deploy, not a migration | The icon is now handed in already rendered, exactly as the sibling `content` prop always was. **Three things nothing in the pipeline could have caught:** `next build` was green twice through this bug, because a dynamic route is never prerendered and **a green build is not evidence that a dynamic page renders**; the typecheck is happy, because `LucideIcon` is a fine prop type and **no type in this codebase means "serialisable"**; and every other guard on this screen is structural, so none of them render anything. **The first guard written for it was green on the reintroduced bug** - `typeof !== "function"` and "has `$$typeof`" are both satisfied by a lucide icon, since a `forwardRef` is an object carrying `Symbol.for("react.forward_ref")`. `isValidElement` is the check. 2 tests, 2 probes |
| R40 | **An admin route with NO authentication at all.** `POST /api/finalize-old-competitions` checked nothing - not a weak check, not a token-validity check that should have been a section check. Any anonymous caller who knew the path could force-finalize every `completed` competition: closing `TradingPosition` rows at live prices, writing `TradeHistory`, recalculating PnL, and hitting an external forex API once per position | Critical | **CLOSED 7 Sep 2026. Unauthenticated and LIVE, so unlike almost everything else here it was reachable today** - but scoped to contests already `completed`, so no prize, no wallet movement, no running contest. The realistic harm is a corrupted trade history and audit trail plus an unmetered API bill. **Do not round that up to "anyone could pay themselves" or down to "it only touches completed contests".** No backfill, and **no way to know whether it was ever called** - a route with no guard also has no attribution | `guardSection("competitions")`, placed **before `connectToDatabase()`** so a refusal opens no connection and reaches no query. **Second unauthenticated route in this programme** after Prerequisite A's `/api/simulator/*`, and the general rule is why both are recorded: **the routes with NO guard are not found by reading the ones with weak guards.** Every sibling had *something*. Found by enumerating the lifecycle routes and **counting guards against exported handlers**, which is a different activity from reading each route. Pinned by position, not presence - a guard at the bottom of the handler satisfies any mention-based check after every write has landed. `__tests__/admin/live-contest-controls.test.ts`, `tools/probe-live-controls.ps1` |
| R41 | **Pausing a provider contest did nothing.** `isPaused` is a trading-era field honoured by `order.actions.ts`; `round-launch.service.ts` never read it. So an operator got a success toast, a PAUSED banner and a notification to every participant while **players carried on starting and finishing rounds.** Worse than a dead control because `IncidentsSection.tsx` pauses a contest when an operator raises an incident - the one moment they most need play to stop is the moment they were most confidently told it had | High | **CLOSED 7 Sep 2026.** Latent: no provider contest has run in production, so nobody has played through a pause and **nothing was backfilled** - the defect is an absent check, not a stored value. Two siblings found with it: **resume compensated `endTime`, which gates nothing a player plays inside**, so a two-hour pause silently ate two hours of playing time; and the operator's control panel said **seven trading-shaped things**, the worst being "All positions will be closed at current prices" above the emergency-cancel confirm on a contest with no positions | A gate in `round-launch.service.ts` before any seat lookup or round creation, with its own `contest_paused` refusal rather than a generic `contest_not_open` - the contest IS open, so the UI must offer "come back shortly". Resume extends `playWindowEnd` and, only while still future, `playWindowStart`. Panel wording moved to `apps/admin/lib/admin/contest-control-copy.ts`. **The general rule, and the reason this is R-series not X-series: a capability the platform already has does not extend to a new game by itself, and the way it fails is silence.** When adding a game, **enumerate the operator controls that already exist and ask which code path enforces each one** - not whether the field is set. 63 tests, 31 probes |
| R42 | **The admin cron refused to settle provider contests, so whether one paid out at all was a coin flip.** `apps/admin`'s `finalizeCompetition` had no provider dispatch - only `routeToTradingSettlement`, which answers "may *trading* settle this" - so a provider contest reaching it was refused and left `active`. **Both apps register `checkAndFinalizeCompetitions` on an every-minute cron**, so the contest settled correctly or never settled at all depending on which process claimed it first. Not a missing stage: **nobody was paid anything**, and the contest sat finished-looking and unsettled with no error a person sees | Critical | **CLOSED 7 Sep 2026.** Latent - no provider contest has settled in production, so **nothing was backfilled** and there is nothing to backfill, the defect being an absent branch rather than a stored value. **Do not describe it as "the admin app paid less"** - it paid nothing and completed nothing | The same six-line dispatch the main app has had since X5, placed **before `startSession()`**: `finalizeProviderCompetition` opens its own session and takes its own lock, so dispatching after would nest a transaction inside one the caller owns. **R26's shape one layer out, so the general rule replaces the two instances: the four finalize functions are not four copies of one function, and a capability added to one is not thereby added to the others.** Two silent instruments here - `provider-finalize.ts` and `provider-settlement.service.ts` were **already mirrored into `apps/admin` and imported by nothing**, so `check:mirrors` agreed and the file-size heuristic that found R26 raises nothing, because only the *call site* was absent. 3 tests in `__tests__/services/admin-finalize-gamemaster-parity.test.ts`, 4 probes in `tools/probe-admin-provider-dispatch.ps1` |
| R43 | **The undersubscribed sweep cancelled competitions and refunded nobody - and unlike almost everything else in this register, it was losing real money in production, on both game types, every day.** The every-minute cron in both apps set `status: "cancelled"` itself and *then* called `cancelCompetitionAndRefund`, whose claim is `status: { $ne: "cancelled" }` - the very lock added to fix the double-refund defect. The claim matched nothing, so the action returned `success: true` with `refundedCount: 0` and **every player's entry fee stayed with the platform**, against a competition showing `cancelled` | Critical | **CLOSED 7 Sep 2026.** **Not latent and not retroactive.** Unusually for this register the affected contests **can** be identified - cancelled, participants not `refunded`, no `competition_refund` rows - because all three facts are stored. **No backfill was written deliberately**: crediting wallets from inferred history is an unreviewed money writer and who to compensate is an owner decision. Do not summarise this as "refunds were delayed" - they never happened | Both crons stop writing a status; cancelling belongs to the refund action, which does it in the same transaction as the money. Because the failure is silent the action is **also** self-healing, which reopens live bug 5's door - so **idempotency moved off the status and onto the per-player `competition_refund` ledger rows**, the key `exclusion-refund.ts` already uses. **The general rule is the inverse of live bug 5's: a lock keyed on a field any caller can write is only as good as every caller's restraint, and the ones that break it report success.** Three silent instruments: the refund logged "refunds were already issued" as an *inference*, the caller logged `participantCount` rather than the returned count, and the correctly-behaving `getCompetitionById` backup path masked how often it failed. 8 tests, 5 probes in `tools/probe-cancel-refund.ps1` |
| R44 | **Settlement ran before the grace window opened, so a player who finished in the last minute was paid nothing for a round they completed.** `checkAndFinalizeCompetitions` claims any contest whose `endTime` has passed, every minute, and since `12` s2.3 the play window *is* the contest clock - so a provider contest settled within about sixty seconds of its cut-off. `resultGracePeriodSeconds` exists precisely to say a result posted after the window is still welcome; settling first refused it as `late_recorded_not_applied`, ranked the player on nothing and paid them nothing. **The sibling was worse: nothing in the running system ever wrote `unresolved`**, because the reconciliation net that was supposed to is unscheduled (E7) - so `exclude` and `hold_and_alert` were configured controls that could not fire, and a round that never reported sat `launched` for ever against a contest finished weeks earlier | Critical | **CLOSED 7 Sep 2026.** Latent - no provider contest has settled in production, so no score was discarded and **nothing was backfilled**; the defect is an absent wait, not a stored value. **Do not summarise it as "settlement was early"** - from the player's seat, being ranked on a round they finished is indistinguishable from being cheated, and the only trace is a critical audit row nobody is watching | `lib/services/settlement/round-cutoff.ts` (mirrored) defers settlement while any round is inside the grace window - refusing a **manual** admin finalize too, deliberately, because forcing it two minutes after the cut-off destroys those scores and names the time it can run instead. Then a new `cutoff` outcome on `endLiveRoundsForContest` marks what never reported **`unresolved`, not `voided`** - `voided` reads as housekeeping and would silently override all three policies with "score zero, nothing owed". **The ordering is the subtle half:** the mark is written outside the settlement transaction and before the hold gate, because a `hold_and_alert` abort would roll it back and every cron pass would re-mark, re-block and re-roll-back for ever with nobody paid. `DEFAULT_RESULT_GRACE_SECONDS` moved to `round-types.ts` so both apps share one definition - two copies would make whether a last-minute finisher is paid depend on which cron claimed the contest, which is R26's failure mode. 8 tests, 15 probes |
| R45 | **A player who never played was paid a prize.** Every qualification rule in `competition-ranking.service.ts` was trading-shaped, and provider settlement switches all of them off correctly - `minimumTrades: 0` and `disqualifyOnLiquidation: false`, because a puzzle has neither - so **nothing disqualified anybody** and a participant who never launched a round ranked on the `score ?? 0` fallback. On the owner's own 70/20/10 example with one real scorer, two players who never started **took 30% of the pot**; with nobody scoring at all, all three tied at rank 1 and **split the entire pot**, the exact inverse of "if no winner, all lose" | Critical | **CLOSED 7 Sep 2026.** Latent for money - no provider contest has settled in production, **nothing was backfilled**. **Do not summarise it as a prize-distribution bug**, which is how it presents on screen and is why the owner reported a confusing distribution; it is an eligibility one, and the distribution code was correct throughout | `hasResult(participant)` joins the two scoring methods on the game module: provider answers `Number.isFinite(participant.score)`, **trading answers `true`** because a flat account is a real result and `minimumTrades` is the existing operator-set way to say otherwise. Asked of the module rather than branched on, or the next game silently fails. **Scoped to a COMPLETED contest**, matching the two trading checks - unscoped, the live leaderboard stamps every player mid-round "No score recorded", which `13` s4.1b renders as a verdict. `Number.isFinite` rather than `!= null`, which admits `NaN` and pays from a position the comparator chose at random, or truthiness, which refuses a genuine zero. **The other half is that `competition-ranking.service.ts` is a divergent duplicate nothing guarded** - 77 lines apart, `check:mirrors` covers models only, reached by both apps' every-minute cron: third finding in this one file pair after R26 and R42. The runtime parity suite **cannot** see the admin copy, because vitest aliases `@` to the root, so a structural text comparison holds it and the suite's byte-identical claim was corrected. Money goes to the existing `all_disqualified` unclaimed pool; **whether it should be refunded instead is an owner decision not taken here**. 12 tests, 10 probes |
| R46 | **The screen that made a correct payout look broken.** `/competitions/view/[id]` rendered `pnl`, `pnlPercentage` and `totalTrades` unconditionally, and all three default to `0` on every seat regardless of game - so a provider contest showed `+0.00 / +0.00% / 0 trades` for every player while **`score`, the number it ranked on, was on the row and never displayed.** Rows in an order nothing on the page explains, with winner badges beside them. Four siblings: **Edit routed every contest to the trading editor** (the list learned this the same day - "count the writers" again), trading-only config rendered as `$0` and `1:1`, per-rank amounts labelled in credits while the pool and "Won:" used the currency symbol, and **`noWinners` read by no admin screen at all** | Medium | **CLOSED 7 Sep 2026.** **A LIVE reporting defect, never a wrong payment** - it affected every provider contest an operator has opened, and cost them the ability to reconcile. No money moved wrongly, **nothing to backfill**, nothing mirrored. **This is the screen behind the owner's "the distribution is a mess" report**, so do not read it as confirmation of a payout bug - R37 had already fixed the ranking metric and the payout was correct throughout | Presentation extracted to `apps/admin/lib/admin/contest-result-presentation.ts` **so it could be tested at all** - a structural test over JSX can assert a file mentions `score` and cannot assert which branch renders it, the weakness four earlier probes passed through. Provider rows show the score, with **`-` for an absent score and never `0`** (the read-side form of R45), and a `neutral` tone because a puzzle score is not a profit. Trading-only cards **withheld rather than zeroed**, since a printed `$0` makes a claim where withholding declines to. One shared string carries the caution that the per-rank figures are a **floor**, not the payout. Edit probed as a **swap** as well as a deletion, because a test naming one destination stays green when the two are exchanged. 12 tests, 13 probes |
| R47 | **The Game Master route that answered to nobody, and the one that answered to everybody.** `POST /api/gamemasters/sync-referrals` had **no authentication on either handler** while all four of its siblings under `/api/gamemasters` required section access - and `PATCH /api/gamemasters/[id]`'s `update_limits` did `{ ...subscription.limits, ...limits }`, writing every key the browser sent onto the document that decides a Game Master's daily cap, participant cap, revenue share and which games they may create, through a **raw-driver** update that runs no Mongoose validation, so the schema's own bounds never applied. Third sibling: the **admin** creation route read only the cached `subscription.limits` and never checked `canCreateCompetitions`, so a Game Master whose package withdrew creation could still create through it | Medium | **CLOSED 7 Sep 2026.** State the sync-referrals exposure in **both** directions or it gets triaged wrongly: the POST takes **no body**, so the mapping comes from `userreferrals` and a caller could **not** redirect commission to themselves - what they could do is apply a pending attribution change an operator had deliberately not applied, and drive an unbounded `findOne` + `updateOne` loop over every active referral on demand; the GET returned up to ten real user ids and names to anybody who asked. **There is no way to know whether either was ever called - a route with no guard writes no attribution.** Nothing backfilled, and there is nothing to backfill: the mass assignment stored whatever an operator actually sent | The unauthenticated route was found by **counting exported handlers against guards**, not by reading them - every neighbour having a guard is exactly what sends a reader past the file that has none, and it is the same technique that found R40. `update_limits` became an allow-list in `apps/admin/lib/admin/gamemaster-limits-update.ts` that **refuses an unknown field by name rather than dropping it**, because dropping means the edit appears to save and the operator concludes they misclicked; the allow-list is a `Set`, so `"constructor"` cannot pass a lookup that walks the prototype chain. Both creation routes now resolve through one shared gate. Found while adding `allowedGameTypes` to the same subdocument - **generalising code is a better bug-finding instrument than looking for bugs.** 59 tests, 18 probes |
| R48 | **The ending decided whether the play counted.** `syncParticipantScore` selected a player's rounds with `status: "completed"` alone, so a real partial score stored on `game_round` never reached `participant.score` and the player ranked on the seat default of nought. **Neither codebase ever had a rule about finishing** - `games-service` scores any board solved, and the provider spec asks twice for a partial score - so this was the platform discarding a correct result. **The row that made it urgent is `expired`**: `createRound` clamps a round's `expiresAt` to `playWindowEnd`, so under the universal cut-off it is the ORDINARY ending for anyone still playing at the final whistle, which means the better a contest was attended right to its end, the more of its players ranked at nought. Sibling on the read side: `findCountedAttempt` filtered on the presence of a score alone, already wrong for `voided`, whose rounds store `rawScore: 0` deliberately. Sibling in admin: **Game Performance counted every player caught by the cut-off as having abandoned the game**, on the screen an operator uses to decide whether to keep a title running | Medium | **CLOSED 7 Sep 2026.** **Latent - nothing backfilled**, because no provider contest has settled in production, so no prize was paid on the wrong ranking. Say it that way: the scores were never lost, they are on `game_round`, so a wrongly-settled contest could be recomputed - there simply is not one. A document describing this as a distribution bug is wrong; `distributePrizesWithTies` was correct throughout and the defect was upstream of it, in whether a score arrived at all | `SCORING_ROUND_STATUSES` is `completed`, `expired`, `abandoned`; `voided` and `unresolved` stay out for two DIFFERENT reasons - the first has no score by construction, the second is `unresolvedRoundPolicy`'s question and counting it here answers it twice. **The boundary is asserted in both directions**, because a widening with no upper bound is indistinguishable from having no rule. The read side **imports the predicate rather than restating it** and takes `status` as a REQUIRED parameter, so a caller cannot omit it and get a silent "nothing counted". Checked rather than assumed: an attempt is consumed on round **creation**, so there is no incentive to abandon deliberately, and every attempts policy makes a cut-short run helpful or neutral, never harmful |
| R49 | **The dead null check under a noisy log line.** The reported symptom was three stack traces for one junk URL, because `/competitions/[id]` matches any segment under `/competitions/` and both of the lobby's reads threw inside one `Promise.all`. **The defect the chase found is that `getCompetitionById` threw for BOTH kinds of absence** - a malformed id and a missing document - and its catch re-wrapped both as one message, so **every caller's `if (!competition)` was unreachable.** Three authors independently wrote one: `/results` and `/trade` redirected to `/competitions` for a deleted contest and instead showed a server-error boundary, and `GET /api/competitions/[id]/status` - which is **polled** - answered 500 where its own code carefully answered 404. A deleted contest and a database outage produced the same message, so a page could not tell "this does not exist" from "we are broken" | Low | **CLOSED 7 Sep 2026.** **Live, and split precisely: the noise was harmless and the dead guard was not.** The player already got a 404 from the lobby, so no wrong screen was ever shown there; the two sibling pages showed an error boundary for a contest that had merely been deleted. No money, no payout, **nothing to backfill** - the defect is an unreachable branch rather than a stored value. A document calling this a logging fix is describing the symptom | `null` means it does not exist, a throw means something failed. Six routes refuse a junk id before any read, each writing **one** `warn` line naming the route and the value - a silent guard makes a bad link inside the application indistinguishable from a crawler. The pages' catch had to widen from `NEXT_REDIRECT` to the whole **`NEXT_`** family, because `notFound()` also throws, so the new 404 was caught, logged as a failure and re-issued. The shape test is ours rather than `ObjectId.isValid`'s **because that is a dependency's opinion about a URL**, which has already widened once; a test asserts the two agree today |
| R50 | **The phantom zero that made every entrant a winner.** `providerHasResult` is `Number.isFinite(participant.score)`, and the module's own comment draws the distinction the fix rests on: a stored nought means "played and scored nothing" and is eligible, an absent score means no result and wins nothing. **Three writers each supplied a nought before the player had played** - `buildParticipantSeat` wrote `score: 0` into every seat at join, the schema declared the field `required: true, default: 0`, and the play state's `?? 0` did it again on the read. So every entrant held a finite score from the moment they paid, the "No score recorded" disqualification could not fire for anybody, and **R45's gate was dead on the day it shipped.** In the owner's own example - three ranks at 70/20/10, two players who played and one who never launched a round - the non-player ranked third on a phantom zero and was paid for it instead of the rank being redistributed | Medium | **CLOSED 7 Sep 2026.** **Latent for money, live for the screen.** No provider contest has settled in production, so no prize was paid on a phantom zero - but the lobby's hero tile has been showing `0` rather than a dash to every player who had not yet played, under a comment insisting it must show a dash. **A migration was needed even so, and that is the part a summary would drop:** a schema default fixes future rows only, so every seat already written holds a real `0` and an OPEN provider contest would still settle the old way. `tools/games/clear-phantom-participant-scores.ts` is report-only until `--apply` and **has not been run** | A default IS a stored value - the same rule that made `entryBlockThreshold` and `canEnterChallenges` defects. **Any one of the three writers is enough to reintroduce it**, so there is a probe per writer rather than a probe for the fix. R45's own suite passed throughout because it builds participants as plain objects and omits `score` to mean "never played" - **a shape no production writer could produce**, which is the third instance of a fixture testing the consumer instead of the producer and the first where the fixture supplied an *absence*. `ChallengeParticipant` deliberately still defaults, pinned by a test, because provider challenges are E8 |
| R51 | **Five AI routes that answered to nobody.** Every route under `apps/admin/app/api/ai/` had no authorization of **any** kind - not a weak check, none - and the admin app has no middleware, so any caller reaching the origin could post an arbitrary prompt and be answered with the platform's own OpenAI key. **Two of the five WRITE**: `evaluate-balance`'s `fix` action and the whole gamification wizard rebalance badge thresholds and journey milestones, which is the reward economy every player is progressing through. The folder is what hid it - `evaluate-balance`'s own header advertises a local engine with no AI calls, so it reads as harmless | **High** | **CLOSED 8 Sep 2026.** Live and unauthenticated, **but say the exposure in both directions**: no money moved, no prize was paid and no wallet was touched, while metered spend on our account was unbounded and player-facing thresholds were writable. **There is no way to know whether it was ever called**, because a route with no guard records no attribution, and **nothing was backfilled** - the two write actions leave ordinary documents indistinguishable from an operator's own edits | Found by **counting exported handlers against guards**, not by reading routes - third instance after R40 and R47, and the only method that works, because every *other* admin route having something is what sends a reader past the ones with nothing. Each route is guarded by the section owning its **calling screen**, never a general "AI" grant, which is why `journey-map` and `gamification-wizard` had to become section ids (add-only; they rendered screens no grant could name, so only super admins reached them, and nobody's access changed) |
| R52 | **A build and a static directory that must ship together, with nothing checking they did.** `games-service/public/play` arrives with a `git pull`; the allowlist authorising those files is TypeScript that only exists after `npm run build`. A 6 Sep build served a 7 Sep surface, so `presentation.js` 404'd - and an ES module that 404s takes its importer down with it, so **no script evaluated at all**: the page sat on its own boot spinner, never posted `ready`, and two players could not start a game. The same stale build is why the wizard still offered retired Circuit Perfect and a 300s Sprint ceiling, so **the picker had no defect** - it already filters on `providerStatus: "active"` and had nothing to filter | **High** | **CLOSED 8 Sep 2026.** Live and player-visible, **nothing to backfill** - no money moved and no stored value is wrong, the defect is an absent file on one side of an HTTP request. But the rounds it consumed are real: an attempt is spent when a round is **created**, so a player whose game never booted has still used it, and those rounds settle under `unresolvedRoundPolicy` like any other. Remedy is rebuild, restart, re-sync the catalogue - **and the owner must still rebuild once, because the fix is in the build** | **No test could have caught it**: the existing walk of the import graph passed all day, because it tests **one revision** and the fault is a disagreement **between** revisions. **The first fix - a boot audit - was WRONG and this row said it was the answer.** It could never fire: **a guard shipped inside the artifact whose staleness it reports is absent in exactly the state it was written for.** The coupling is now removed instead - the served set is read from the directory at boot, so **one thing cannot disagree with itself** - with the extension allowlist as the remaining protection and the audit reporting only that. General rule: **prefer deleting a coupling to detecting it**, and never let a detector ship on the same schedule as the thing it checks. **Third amendment: the game now SAYS why it did not start.** Two fixes had addressed the cause and neither made the fault audible, so the owner's only witness was a browser console - a classic script in front of the module graph now names the failing file and sends `ready`, or the panel is painted under the platform's opaque overlay where it cannot be read (`21` s4.1j). Its own first version named `app.js` while `presentation.js` was the 404, because the error event fires on the graph's entry script: **naming the wrong file is worse than naming none**, and it was found by looking rather than by testing. Found alongside: the sweeper printed `failed 1` and dropped the reason - **classify a failure, never merely count it** |
| R53 | **`supportsContentSeed` decided nothing, and three comments said it decided paid entry.** The flag guaranteeing every player in one contest faces identical content - *"the most important single field in the specification"*, `01` s4.3, and what preserves the skill-not-chance position - was declared, validated on ingest, stored, transported and badged, and read by **no gate in either app**. Its two siblings *are* enforced, in the pre-flight and in the wizard, which is what hid it: **a partially-implemented pattern is more dangerous than an absent one**, because the absent one prompts the question. Fifth instance of a comment asserting a check that does not run, and the first repeated in three files - **agreement between comments is not corroboration** | **High** | **CLOSED 8 Sep 2026. Latent, nothing to backfill** - every title that exists declares it `true`, so no unfair contest has run. It is the flag a real provider will set `false` at **X4**, and the failure then is a paid competition where every player faces different content, ranked, settled and paid, silently | One unconditional check in both mirrored pre-flight copies, the field **required** on the input so a caller cannot fail open again, both writers counted with `rg` first, and the wizard disabling the title with the capability named. **Not scoped to `competition`** despite the spec's wording - a challenge ranks two players for money on the same basis, so the challenge half is a tripwire for E8. 4 tests, 4 probes; the second test exists because all three format refusals share one block, so a fixture missing two things is refused either way |
| R54 | **An edge that rewrites `Cache-Control` turns a ten-minute fault into a four-hour outage.** Every response from `/play/*` arrives carrying `max-age=14400` - Cloudflare's default four-hour Browser Cache TTL - **on the 404s as well as the 200s**, replacing the `no-store` and `no-cache` the service sends. So R52's missing `presentation.js`, fixed on the server within minutes, stayed broken in every browser that had already asked, for four hours, **because a browser holding a fresh cache entry never asks again**. The owner held a `curl` returning 200 while the page named the file it could not load; both were true | **High** | **PARTLY CLOSED 8 Sep 2026.** The **refusal** half is cured in the page, which is the only place with standing to act: the boot watchdog re-fetches the recorded failures with `cache: "reload"` - which *replaces* the stored copy rather than reading round it - and reloads once, guarded by `sessionStorage` so a genuinely missing file cannot loop (`21` s4.1k). **The 200s carry the same four-hour lifetime and that half is an OWNER ACTION**: a stale success has nothing to detect because it looks healthy, so **assume a play-surface fix does not reach anybody who played in the previous four hours** until a Cloudflare cache rule for `/play*` respects origin headers (`deploy/README.md`) | Identified by **measuring from the player's browser** rather than the server - `curl` from the box bypasses the poisoned cache entirely, so it can only ever confirm the half that was already right. `deploy/nginx.conf` contains no such value anywhere, which is how the layer was pinned rather than guessed. **The instinct it defeats:** the more recently someone tried and failed, the longer they stay broken, which reads exactly like the fix not working. General form: a service cannot defend itself from a header-rewriting intermediary **with headers**. **The same asymmetry produced a second, worse defect within the hour** (`21` s4.1l): the document is never cached, its assets are, so today's markup loaded around a four-hour-old `app.js` that works but predates the boot flag - and the watchdog **wiped a live board mid-round**. Second witness added; **an absent signal is evidence only if the thing that would have sent it was definitely present**. **The 200 half is CLOSED by R55, and not by the Cloudflare rule** - the remedy was to stop the stale copy being addressable rather than to ask the edge to behave, so the `deploy/README.md` owner action is stale as a present fact for `/play*` |
| R55 | **Half a build from the cache and half from the server.** `board.js` was today's and `presentation.js` was four hours old, so the console said `does not provide an export named 'newlyJoined'` and the game stopped dead - **nothing missing, nothing 404ing, every response a 200**. This is precisely the half R54 recorded as undetectable, and it defeated the recovery built for R52: s4.1k re-fetches URLs that **failed**, and there were none. The third distinct cause of one reported symptom | **High** | **CLOSED 8 Sep 2026.** The assets are served under a fingerprint of their own contents, so a new build publishes URLs no browser has cached and the stale copy sits at an address nothing requests. `immutable` then says something true, so the surface is fetched once and never revalidated mid-contest. **Latent for money, nothing backfilled** - the burned attempts are real but were burned by R52 and R54 as much as by this. **One rebuild required**, after which the fingerprint is derived at boot from the directory, so a surface change still needs only pull and restart | **A path segment, never `?v=`** - `board.js` imports `./presentation.js` as a literal with nowhere to put a query string, so a query string leaves bare **exactly the file that broke**; the segment is inherited by ordinary URL resolution. **Content, not mtime**, or two servers publish different URLs for identical bytes. **An unrecognised fingerprint is served, not refused**: refusing manufactures 404s on a rolling deploy and R54's own finding is that the edge caches those for four hours too. The route shape invited its own outage - `/play/:version/:asset` has the shape of `/play/api/state`, which the board polls - so unrecognised segments fall through to the next route; **probe 12 removes that and turns five tests red, three of them unrelated round-state tests, against two expected** |
| R56 | **Every image the platform has ever uploaded shared one 16MB document, and it filled up.** Hero images, branding images and game artwork were base64-encoded into `WhiteLabel.brandingFiles` - a map on the single settings document - so the game-logo upload that reported `BSONObj size: 17070874 is invalid` was not a big picture or a bad route: the **document was already full**, and by then uploading *any* image anywhere in the admin panel was impossible. The failure arrives by success rather than by a bug, so there is no warning and every upload after it fails identically. The disk write succeeded, so the operator was told the file saved but could not be copied - accurate, unactionable, and repeated on every retry | **High** | **CLOSED 8 Sep 2026.** One document per file in a new `branding_asset` collection, which has no such ceiling; the remaining limit is 8MB **per file**, which an operator can act on. Reads try the collection then fall back to the legacy map, so nothing uploaded before today breaks. **Live and platform-wide, and `tools/branding/migrate-branding-files.ts` is report-only until `--apply`** - the map still holds ~16MB until it is run, and `WhiteLabel` cannot be saved by any writer while it does | The map was on the **hot path**: 67 files call `WhiteLabel.findOne()`, so reading any setting at all transferred every image ever uploaded, in both directions on every save. `select: false` closes that, and it is only safe because one service owns every read - **the write side and the read side disagreeing about where bytes live is the "one rule, two copies" shape**, so a test asserts no writer reaches past it. The `__DOT__` key encoding was **not** carried over: it exists solely because Mongoose refuses a dot in a *map* key, and a workaround outliving its cause is how somebody later "simplifies" it into a bug |
| R57 | **The Image Optimizer's route had no authorization on either handler, and its POST deletes files.** `apps/admin/app/api/dev-zone/optimize-images/route.ts` exported a `GET` that enumerated every upload directory on disk and a `POST` that re-encoded images in place and `unlink`ed the originals - across marketplace uploads, avatars, cosmetics, indicators and strategies - with **no session check, no admin check and no section check on either**. The *screen* was gated behind the `image-optimizer` grant, which is exactly what made it invisible: the guard was on the thing a reviewer can see. **Ninth route of this class**, and found the same way as R40 and R47 - by counting exported handlers against guards, never by reading routes, because every neighbouring route having *something* is what sends a reader straight past the one that has nothing | **High** | **CLOSED 8 Sep 2026.** `guardSection("image-optimizer")` on both handlers, before the body is parsed and before anything is written or deleted. **Live, and the exposure ran both ways** - an anonymous caller could enumerate the upload tree *and* destructively rewrite it, and an image whose only copy was on that disk is gone. **There is no way to know whether it was ever called, and nothing was backfilled**: a route with no guard has no attribution, and a converted file is indistinguishable from an operator's own optimisation | The section id is the one that **reveals the screen**, not an adjacent real one - `guardSection` is typed to `AdminSection`, so the compiler refuses an invented id but accepts a valid wrong one, which compiles, reviews as plausible and demands the wrong grant. The suite asserts the **weak** property folder-wide (every handler authenticates *somehow*) and the **strong** one on this route, because `dependency-check` still uses `verifyAdminAuth` and converting it is an owner decision about which employees keep the screen - recorded as a failing-if-fixed tripwire rather than permitted by an allow-list, since a per-file allow-list is green on the day a tenth route appears. **A guard whose refusal is discarded reads perfectly and authorizes nothing**, so refusals are *counted* against guard calls: a whole-file `toMatch` stayed green when the POST's was deleted, satisfied by the GET's |
| R58 | **One number imported across the server/client boundary took the admin panel off the air.** `GameScoringDialog.tsx` is `"use client"` and imported `SCORE_UNIT_MAX_LENGTH` from `game-scoring-rules.service.ts`, which imports `@/database/mongoose`, which imports `MongoClient` from `mongodb`. Turbopack traced the whole driver into the browser bundle, where `fs`, `net`, `tls`, `dns` and `child_process` do not exist, so **`next build` failed with 17 errors, `apps/admin` had no `.next` directory, and PM2 crash-looped it** - restarting it 283 times. The deploy reported the failure and then restarted the processes anyway, so the visible symptom was a boot loop rather than a build error | High | **CLOSED 9 Sep 2026. Already occurred, and it is the first entry in this register whose harm is that the application did not exist.** No money moved, no document is wrong and **nothing was backfilled** - a build either produces a bundle or it does not. The main app was unaffected and stayed up; the previous admin build was already gone, so there was no working version to fall back to | The constant moved to `apps/admin/lib/admin/score-eligibility-copy.ts`, which reaches no driver, and the service imports it back from there - so there is still exactly one definition. **The typecheck is structurally blind to this entire class**, the import being valid TypeScript for a value whose type is `number`, and nothing about a module's fitness for a browser bundle is expressible in the type system: it is caught by a full production build, which is to say by deploying. Guarded by `__tests__/admin/client-bundle-model-imports.test.ts`, which walks the **value**-import graph from every `"use client"` file in **both** apps, stopping at `"use server"` because Next replaces such a module with an RPC stub. Extending it to the main app found `MarketStatusBanner.tsx` one keystroke from the same outage - it built only because both its bindings are interfaces used in type positions, so **the safety was the bundler's unused-import elision and not a decision anyone had made**; now `import type`. The rule forbids `mongodb` and deliberately **not** `mongoose`, which has a browser build: the first draft banned both, flagged five files that build perfectly well, and would have been deleted by the first person it inconvenienced |
| R24 | Scope creep before anything ships | Medium | **High** | All |
| R25 | Round write contention under load | Medium | Medium | X12 |
| X15 | "Challenge any user" harassment surface - no report-user feature exists | Medium | Medium | X10 |
| X16 | Overall rank used instead of per-game rating when matching | Medium | Medium | X11.5 |
| X17 | Matchmaking creeps into a recommendation engine | Medium | Medium | X11.5 |
| X18 | Empty matchmaking at launch - nobody has declared interests | Medium | High | X11.5 |

---

## 2. Critical platform risks

### R1 - Money paths refactored without tests first - LARGELY CLOSED 1 September 2026

**Four** competition-entry writers existed and **they disagreed about money**.
`enterCompetition` in `lib/actions/trading/competition.actions.ts` incremented both
`currentParticipants` and `prizePool`. `app/api/competitions/[id]/join/route.ts` incremented
only `currentParticipants`. So did `app/api/simulator/competitions/join-batch/route.ts`. The
admin mirror of `enterCompetition` did update the pool but omitted the email check and the
fraud gate.

The API route also skipped **four** checks the action performed: email verification, user
restrictions, the fraud gate, and the level requirement.

**All four are now resolved.** `lib/services/contest-entry.service.ts` is the single entry
path; the two real gates are thin wrappers over it, the simulator batch route was fixed in
place, and the dead admin copy was deleted. The prize pool grows by every fee taken, in the
same transaction that takes it, on every path.

Re-verified 1 September 2026, with two corrections still worth carrying:

- The finalize-time safeguard that caps the pool to `currentParticipants x entryFee`
  **did not mask this**. It only fires when the pool is too *high*
  (`competition-end.actions.ts` 695-718), so an under-counted pool was under-distributed with
  no correction and no log line. **The under-count branch is still missing** - the safeguard
  has not been changed, so this remains true for any future writer that forgets the increment.
- The API route was reached **only by the simulator service**; both real join buttons called
  `enterCompetition`. So no paying customer was affected, which is why the fix needed no
  migration.

**Two things remain open, and neither should be assumed closed by the above.**

A related defect on a path real players **do** use: the challenge *accept* route
(`app/api/challenges/[id]/accept/route.ts`) skips account restrictions and the fraud gate,
and it is where both wallets are debited. **Proven by test on 1 September 2026 and NOT
fixed.** Sub-defect 1b, awaiting a decision on whether it ships inside X0.

A **new** finding of the same class surfaced in the fraud layer rather than the money layer -
read-then-create against a unique index on `SuspicionScore`, losing suspicion scores under
concurrency. It appeared only because coordination detection started running on both entry
paths. **Found and fixed the same day**; recorded as R28, which also corrects the site count
(five, not three) and records a second race the first fix exposed. It matters to this
programme because provider contests will multiply concurrent entries.

Building a new score path on top of the original mess would have meant debugging two problems
at once with real money involved. **Both halves are now done** - the competition gates were
unified first, then challenge accept was given the same restriction and fraud guards via the
shared `checkAccountStanding`. A third defect was found while documenting the second: the
ledger's `challengeId` was declared on **neither** app's `WalletTransaction`, so **nine**
writers spanning challenge entry, refunds and payouts had it silently discarded, leaving the
whole challenge money trail unattributable. Also fixed the same day.

### R2 - Admin mirror drift (a confirmed defect, not a prediction)

Counted on 1 September 2026: **75 model files** exist twice - once in the main app, once in
`apps/admin` - of which 38 are byte-identical and **11 have real schema drift**. The
original figure of "roughly 21" was an undercount. On top of the models, **19 action files
and 51 service files** are duplicated the same way.

| Model | Drift |
|---|---|
| `competition.model.ts` | Admin missing `gameMasterId`, `gameMasterName` |
| `wallet-transaction.model.ts` | Admin missing `provider`, `providerTransactionId` |
| `whitelabel.model.ts` | Admin missing `brandingFiles` |
| `hero-settings.model.ts` | Admin missing **42** marketing / Game Master / journey / enterprise fields |
| `user-bank-account.model.ts` | Admin missing 5 Nuvei UPO fields |
| `platform-financials.model.ts` | **Bidirectional** - each side has fields the other lacks, and the main app rejected two of the admin's enum values |
| `trading/challenge-settings.model.ts` | Admin missing `tiePrizeDistribution` |
| `trading/trading-position.model.ts` | Admin missing `metadata` |
| `user-notification-preferences.model.ts` | Admin missing `categoryPreferences.challenge`, `.social`, `.messaging` |
| `withdrawal-request.model.ts` | **Main** missing `failedAt`, `withdrawalMethod`, `originalCardDetails.userPaymentOptionId` |
| `trading/competition-participant.model.ts` | Fields match; admin lacks 4 compound indexes |

There were also **112 committed declaration files** (57 `.d.ts` + 55 `.d.ts.map`) that
looked like stale third copies. They turned out to be orphaned build output from February
2026 and provably inert - TypeScript resolves the sibling `.ts` first. **All deleted on
1 September 2026**, with a `.gitignore` rule. They are not a third copy to keep in step, and
provider-related models must not acquire one.

#### What drift actually does - measured, and not what these documents used to say

Both plans claimed the main harm was that "the admin app cannot see the field" and that "a
whole-document save strips it". Measured against a real MongoDB on 1 September 2026, both
claims were wrong. Evidence: `__tests__/helpers/mirror-drift-behaviour.test.ts`.

Drift is a **write-side** defect, in descending order of harm:

1. A **missing enum value rejects the entire write.** The record is never created.
2. The narrower app **cannot write the field** - `create`, assignment-then-`save` and `$set`
   all discard it silently while reporting success.
3. `replaceOne` / `findOneAndReplace` **do delete** undeclared fields.
4. An ordinary `save()` does **not** delete them. The old claim was wrong.
5. `.lean()` and `toObject()` do **not** hide them. The old claim was wrong.
6. **But ordinary `doc.field` access returns `undefined`** - Mongoose defines getters only
   for declared paths. Severe, and the subtlest of the six: the field survives a debug dump
   while the code beside it reads nothing. This is how `whitelabel.brandingFiles` disabled
   branding-image recovery in three admin routes without anyone noticing.
7. **A synced schema is not a working feature.** `brandingFiles` had a *second*, independent
   defect underneath the drift: the upload routes key the map by filename, and **Mongoose
   refuses map keys containing a dot**, so no entry had ever been stored in either app. The
   sync merely changed the failure mode - an undeclared field let a plain `Map` accept the key
   and discard the write; a declared one hands the route a `MongooseMap` that validates and
   throws. Both were silent. The guard proves two copies agree, not that either works, so a
   drift fix must be followed by a test that actually round-trips the data.

**Why this matters for a provider integration specifically:** the danger to a game label is
not that "an admin save strips it". It is that **the admin app cannot set it at all**. A
path that must write `gameType` - or a provider's `roundId`, or a score - fails silently and
reports success. An unlabelled contest reads as trading, and trading settlement then runs
against a provider contest: R3, silently, with prizes attached.

Harm 6 has a second edge that is specific to this programme. Callback-handling code will
naturally be written as `if (round.providerRoundId === payload.roundId)` or
`if (!round.contentSeed) { ... }`. If the field is missing from that app's copy, the read is
`undefined` and the branch inverts - a replayed callback passes an idempotency check it
should fail, or a seeded round is treated as unseeded. **Never gate provider logic on a
field without confirming the guard passes on the model that declares it.**

And point 1 is the reason the guard must compare **enum values**, not just field names. When
provider result statuses (`completed`, `abandoned`, `expired`, `voided`) become an enum, a
copy missing one of them will **reject** the result callback rather than mis-store it - so a
finished round is never recorded, and the contest never settles.

Fixed in X0 by **`tools/model-mirror/`** in CI and as a `pre-push` hook, so it cannot recur.
(It lives in `tools/`, not `scripts/`, because `.cursorignore` excludes `scripts/`.) Two
requirements held: it compares **enum values as well as field names**, and it carries an
**allowlist** - `admin.model.ts` legitimately differs by 26 staff fields, and a guard that
cries wolf gets switched off. In the end the allowlist needed exactly **one** entry; every
other difference was a real defect. Syncing is **add-only**; removing an enum value to
force a match orphans every document already carrying it.

### R3 - Trading settlement runs against a provider contest - **CLOSED 4 September 2026**

The highest-consequence risk in the programme.
`lib/actions/trading/competition-end.actions.ts` (~**1,500 lines** when this was written,
**1,174** since the X5 extraction); steps 2-4 close forex positions and recalculate PnL.
Pointed at a provider contest it finds no positions, computes zero for everyone, ranks
everyone equal, and **pays prizes to the wrong players without erroring**.

**Two facts in the original entry were wrong, and both are corrected in `11` section 2
seam 3, which is the authoritative count.** There are **ten** call sites in the main app,
not five - the list below missed both `early-end-check` calls, the `claim-early-end` route
and a finalize invoked from a **page component**, and `POST /api/finalize-old-competitions`
**does not exist at all**. The original list is kept here only so the correction is legible:

1. `worker/jobs/competition-end.job.ts`
2. `worker/jobs/challenge-finalize.job.ts`
3. Lazy auto-finalize inside `getCompetitionById`
4. `POST /api/finalize-old-competitions` - **this route does not exist**
5. The admin emergency-cancel route

**Mitigation as originally written:** dispatch at all five, plus an assertion in the trading
settle path that aborts if the game type is not trading. Loud failure is recoverable.

**What was actually built, and it is deliberately not the above.** Dispatching *at the call
sites* is only correct while the list is complete and stays complete, and this codebase adds
finalize callers. The dispatch went **inside** `finalizeCompetition` and `finalizeChallenge`
instead - four dispatch points across two apps rather than ten and counting - so every
caller is correct by construction, including the ones nobody has written yet. X1 built the
refusal (`routeToTradingSettlement`, 19 tests); **X5 built the provider path it refuses in
favour of** (`resolveSettlementPath` plus `lib/services/settlement/`).

**Why this is closed rather than reduced.** The dangerous outcome was a provider contest
being *paid out by trading logic*. That is now impossible in three independent ways: the
gate refuses before the optimistic lock is taken, a second gate inside the attempt function
refuses after it and restores `active`, and the provider path composes the shared money
stages rather than the trading ones. The five trading payout tests and the golden ranking
regression are byte-identical throughout, which is what makes the extraction credible.

**One related exposure is NOT closed by this and keeps its own entry:** the challenge path was
not extracted (`challenge-finalize.actions.ts`, 1,803 lines in the main app against 1,182 in
admin, its own copy of all three stages in each - X10). **R26 was the second, and it is now
closed** (5 Sep 2026) - the admin cron's finalize copy calls the shared fee-and-referral stage.
Correct as history, stale as a present fact, so say which.

### R4 - Double finalization

A contest stuck in `finalizing` resets to `active` after **5 minutes**, so double
invocation is a real path. `settleContest()` must be **idempotent** and must refuse to
write a second `competition_win` ledger entry for an already-settled contest.

### R5 - Dead Inngest crons

`lib/inngest/functions.ts` defines `updateCompetitionStatuses`, `monitorMarginLevels`,
`updatePriceCache` and `processTradeQueue` on `* * * * *`. They are **not registered** in
`app/api/inngest/route.ts`, so they do not run. Registering them later would start four
unguarded trading crons against contests that may not be trading contests. **Delete or
fence them.**

### R13 - Ledger enum renamed

`competition_entry`, `competition_win`, `challenge_entry` and siblings are stored values
in the financial ledger. Renaming one orphans financial history and breaks reconciliation.
Covered by the never-rename list in `14` section 6.

### R26 - Admin-app finalization pays no Game Master earnings (FIXED 5 Sep 2026)

**A live defect found while writing `19`, not a prediction.** An instance of R2, but severe
enough on its own to have an ID. **Unlike most entries here it was actively losing money**,
not latent: both apps run `checkAndFinalizeCompetitions` on an every-minute cron, so whether
a referrer was paid depended on nothing more than which cron claimed the contest first.

`lib/actions/trading/competition-end.actions.ts` contains roughly 500 lines of Game Master
earnings logic at lines 931-1459. The admin mirror,
`apps/admin/lib/actions/trading/competition-end.actions.ts`, contains **none of it** - only
`isGmCreated` on platform-fee recording at line 709.

A competition finalized through the admin app therefore pays **no Game Master earnings at
all**, and does not record a `retained_gm_fee` either. The money simply stays with the
platform, silently, with no ledger entry explaining why. A Game Master comparing their
dashboard against contests their referred players entered would find a gap they cannot
account for.

**Mitigation:** fix in X1 or X5. It is a prerequisite for the Game Master acceptance
criteria in `19` section 7, and the mirror-drift CI check from X0 should have caught it -
verify the check covers action files, not only models.

**Closed 5 September 2026.** `apps/admin/lib/actions/trading/competition-end.actions.ts` now
calls `settleFeesAndGameMasters` - the same shared stage the main app calls - in place of its
inline fee arithmetic. Pinned by `__tests__/services/admin-finalize-gamemaster-parity.test.ts`
(5 tests, 5 probes, `tools/probe-admin-gm-parity.ps1`), which runs **both apps' finalize
functions over identical fixtures and compares every ledger row**, rather than asserting that
the admin app pays *something*.

**The fix is not retroactive, and this is the part to state plainly rather than let a summary
round up.** Every competition already finalized by the admin cron paid its Game Masters
nothing, and there is no `retained_gm_fee` row marking those either - so the gap cannot be
found by querying for retained rows, only by reconciling referred players' entry fees against
earnings per contest. **No backfill was written.** Doing it correctly needs an owner decision
about which historical contests to compensate, and a script that credits wallets from
inferred history is a money writer nobody has reviewed.

**Two things the fix had to get right, both of which the caution below predicted.**

- **The platform-fee RECORD had to change with it, not just gain a payout beside it.** The
  Game Masters' share is carved *out* of the platform fee, so the figure booked as platform
  income must be net of the commission. Paying a referrer while still recording the gross fee
  counts the same credits twice in two different books - a reconciliation defect that would
  have looked exactly like a correct fix on review, which is why the parity suite asserts the
  net figure explicitly rather than only the earnings row.
- **It is genuinely not four copies of one function.** The admin `finalizeCompetition` has no
  retry wrapper and no optimistic lock, loading the competition inside the transaction
  instead, so its idempotency comes from a `status !== "active"` guard rather than from the
  lock. That matters for the test: the first idempotency probe was aimed at the duplicate
  check inside `distribute.ts` and **stayed green**, because a second finalize refuses at the
  status guard long before the referral stage runs. The probe was re-aimed at the guard that
  actually provides the property. **A probe that stays green is a question, not an answer** -
  here the claim in the test's comment was wrong, and the comment was corrected.

**And one claim this work disproved, recorded because it was written in three files.** The
comments on `PrizePayoutResult.walletMap` and `DistributeGmFeesInput.walletMap` asserted the
map "matters for correctness, not just query count" - that a Game Master who also won a prize
needed it so their commission's `balanceBefore` came out after the prize. The concern is real;
the map is not what answers it. Both stages read the post-credit balance back from
`findOneAndUpdate({ new: true })`, and neither reads a balance out of the map at all - it is
used only to decide whether a wallet must be created. **A control probe passing an empty map
moves identical money and must stay green.** Comments corrected in both copies.

**A note on the size heuristic that found R26 in the first place, because it has just become
much weaker.** The gap was the tell: `competition-end.actions.ts` was 72 KB in the main app
against 38 KB in the admin app, and a 34 KB difference between two files that are supposed to
be copies is worth reading. It is now **45 KB against 37 KB** - and *not* because the admin
copy gained the missing logic. The main app shed ~27 KB into
`lib/services/settlement/`, which both apps share. So the same heuristic applied to the same
pair today would raise no flag, while the identical defect in the **challenge** path is still
there to find: `challenge-finalize.actions.ts` is **70 KB against 42 KB**, and it still holds
its own copy of all three settlement stages in both apps. **Extracting shared code hides
divergence from a size comparison**, which is an argument for the parity test rather than
against the extraction. The duplicated **services and actions** remain the larger version of
R2, and a field-comparison script cannot help with either.

### R27 - Internal routes authenticated by a plain header (FIXED 1 Sep 2026)

**Was a live, exploitable defect in production.** Recorded because the *class* of mistake
will recur in this programme, which adds a provider webhook and internal round endpoints.

The `/api/simulator/*` routes guarded themselves with `if (!isSimulatorMode && !isDev)` - an
`AND` of two negatives that any caller satisfied by sending `X-Simulator-Mode: true`. There
is no `middleware.ts` in the repository, so nothing blocked the path at the edge. An
unauthenticated request to `POST /api/simulator/deposit` credited any wallet by user id and
raised `totalDeposited`, so the balance looked like a genuine funded deposit to withdrawal
eligibility. Two **money** routes - `competitions/[id]/join` and `challenges` - read the same
headers raw and acted as the named user. Three further internal routes fell back to
guessable default secrets (`"simulator-cleanup"`, `"internal-key"`).

Fixed in commit `d5d3a328`: fail-closed authentication requiring the header,
`ENABLE_SIMULATOR=true` and a constant-time `INTERNAL_API_SECRET` match, applied through one
shared guard, with 25 tests of which ten assert the real route handlers return 403.

**Why it stays in the register:** `06-trust-security-and-disputes.md` specifies HMAC signing
for the provider callback, and the same three mistakes are available there - a guard that
fails open when the secret is unset, a check that is never actually called by the route, and
a bypass header trusted because it is convenient in development. Two rules follow, and
X-phase acceptance should hold them: **never let an authentication helper accept a request
because configuration is missing**, and **test the route, not just the helper.**

A third rule, added 1 September 2026 while unifying the entry paths: **do not name a flag
after where the call came from.** The original design for the entry service took a
`source: "web" | "api" | "simulator"` parameter. It was replaced with `trusted`, which says
what it actually permits - skipping three person-level gates that a synthetic user cannot
satisfy, and nothing else. A `source` value is an open invitation for the next change to hang
unrelated behaviour off it, which is precisely how the bypass header above came to exist.

**Third occurrence, 2 September 2026, and it promotes this from an incident to a class.**
`app/api/fraud/suspicion-score/route.ts` in the **player** app carried `// Admin only` on
its GET, POST and DELETE handlers while every one of them checked only that *some* session
existed. Any signed-in player could read the entire high-risk list, **raise a rival's fraud
score to lock them out of a paid competition**, or clear their own. It was deleted rather
than guarded: nothing called it, and the admin app holds a `verifyAdminAuth`-protected copy.

The rule to carry into the X phases is therefore stronger than "test the route": **a comment
asserting an authorization check is not evidence that one runs, and a route nothing calls is
still reachable over HTTP.** Both provider-facing endpoints in `01` and `06` and every new
admin route must be tested by calling them as an ordinary player and asserting 403. Dead
routes get deleted, not left for a future reviewer to assume are guarded.

---

### R28 - Read-then-create races on unique-indexed fraud records (found and FIXED 1 Sep 2026)

**Closed.** Kept in the register because the defect class recurs and this programme
multiplies exactly the conditions that trigger it.

`SuspicionScore` carries a unique index on `userId`, and the code did `findOne` then `create`
against it. **Two corrections to the first record of this risk**, both found by measuring
rather than reading: there were **five** call sites, not three, and **two distinct races**,
not one.

The first race is the read-then-create. Measured with twenty detectors arriving together for
a user with no score yet: **seventeen threw duplicate-key 11000 and their contributions were
lost.** The second was only visible once the first was fixed - `updateScore` did a
read-modify-write of `totalScore`, so concurrent updates clobbered each other and the total
disagreed with the breakdown it was supposedly derived from.

**Fixed** with `findOneAndUpdate` + `upsert` + `$setOnInsert` for creation, and an
aggregation-pipeline update that recomputes `totalScore` and `riskLevel` **server-side** from
the persisted breakdown, so no read-modify-write window exists. The three ad-hoc call sites
now route through `SuspicionScoringService.updateScore` instead of reimplementing it. Proven
by `__tests__/services/suspicion-score-race.test.ts`, written before the fix.

**How it was found still matters more than the bug.** It appeared as duplicate-key noise in
test output only after coordination detection started running on *both* entry paths, which the
unification did. Before that, Gate B skipped the detector entirely - so the race was invisible,
and so was the fact that **a fraud control could be avoided by choosing an entrance.**

**The lesson to carry into provider work:** a read-then-insert behind a unique index is a bug
wherever it appears, and fixing the first race can expose a second in the same function. Do not
stop measuring at the first green test.

---

## 3. The scenario risks

Restated from `10` section 4 for the register, since this is the file a reviewer reads.

### X1 - The abstraction cannot be proven without the provider

**The most important risk in the external-only scenario.** With an in-house game the
registry is validated by code we control. Here, X4 onward is blocked on someone else's
sandbox. A provider slow to grant access stops the programme after roughly five weeks of
investment, with nothing player-visible to show.

**Mitigation:** the mock adapter in X2 is built first precisely so X2, X3 and much of X6
to X8 proceed without a provider. Get a **committed sandbox date** in the commercial
discussion, not a promise.

### X2 - Single supplier on the critical path

If the provider terminates, raises prices or fails commercially, the platform reverts to
trading only and every week of games work is stranded. There is no in-house fallback game.

**Mitigation:** the adapter boundary keeps replacement to one folder - but only if
exercised (X6 below). Evaluate a second provider before public launch even if only one goes
live. Consider the in-house insurance game in `10` section 5.

### X3 - No cost floor

An in-house game costs nothing per contest, so free and low-fee acquisition contests are
always viable. A per-round provider fee can make exactly those contests loss-making.

**Mitigation:** model pricing with `08` section 3 **before X4**, and measure it on the
Game Performance screen in `12` section 5. Launch with a low maximum concurrent contest
count and a maximum entry fee, per `09` section 5.

### X4 - We cannot fix their game

A dull game, a scoring quirk, a mobile defect or a bad translation is a support ticket to a
third party, not a sprint task.

**Mitigation:** the staged pilot in `08` section 5 measures repeat play before commitment.
Per-title enable switches mean one bad game is switched off in seconds.

### X5 - Provider will not supply page content

Each title needs a game page - description, rules, artwork, localised. `01` section 3.1
makes it contractual. A provider who declines is transferring that cost to us per title,
forever.

**Mitigation:** raise it during commercial discussion. It is in the provider-facing
requirements document and in the evaluation questions.

### X6 - The registry gets only one real implementation

The contract's whole promise is that a second game costs one folder. With trading plus one
provider module, that claim is never tested.

**Mitigation:** write a second adapter skeleton during X9 even if unused. It is already in
the definition of done in `09` section 7.

### X7 - A Game Master provider contest is net loss-making

A sharper, specific case of X3, and the one most likely to be missed because every
individual component behaves correctly.

A Game Master's referral share is a percentage of the **entry fee**, computed at
finalization before any provider cost exists, and the existing safety cap is against the
**gross** platform fee. Twenty players at 1.00 with a 10% tier and a 2c per-round provider
fee: platform fee 2.00, Game Master share 2.00, provider cost 0.40, **platform result
-0.40**. `best_of_n` attempts multiply the provider cost while the entry fee stays fixed.

Trading never exposed this because a trading round costs nothing to run.

**Mitigation:** `limits.allowedGameTypes` defaults to `["trading"]`, so Game Masters cannot
create provider contests until the share is computed on **net** platform fee after provider
cost. They still earn from referred players in admin-created provider contests from day
one, because earning follows referred players rather than created contests. Add a minimum
entry fee for Game Master provider contests, and assert non-negative platform margin by
test. Full analysis in `19` section 5.

### X8 - No fallback game now that external-only is decided

**Raised 2 September 2026**, when the scenario was decided. Not a new risk - it is X2 with
its mitigation removed. While the scenario was open, "build a small in-house game as
insurance" was a live option that could be taken at any point. The decision closes the
add-on route, and if the provider search or the pricing fails, the platform will have
funded the entire foundation, admin and player programme and still have exactly one game.

**Mitigation:** open question 10 in `PROGRESS.md` was moved forward to **before X4** -
the last point at which the answer is still cheap, since X4 is where spend starts going
against a specific provider's sandbox. Keeping a two-to-three week in-house game on the
backlog converts X2 and X8 from existential to inconvenient. `10` section 5.

**Mitigation APPROVED 5 September 2026, and the risk STAYS OPEN.** Open question 10 was
answered yes: phase **X4a** (`21`) builds a real in-house game to a player-facing standard,
which also serves as the reference implementation that proves the provider seam. **Do not
downgrade this entry on the strength of that.** Until the game is playable the exposure is
exactly what it was, and the whole failure mode of a risk register is entries marked mitigated
because a plan exists. Close it when a player can pay to enter the in-house game and be paid,
not when the chapter is written.

**Two notes for whoever closes it.** The mitigation is **cheaper than the 2-3 weeks estimated
above for a reason worth knowing**: because the game speaks the provider protocol rather than
being an in-house game *module*, it needs none of `New games plan` P1/P2's module architecture,
and it doubles as the reference implementation - so a single piece of work reduces X8, X1 (the
abstraction cannot be proven without the provider) and X6 (the registry gets only one real
implementation) at once. Against that, it **adds** the burden the external-only decision was
taken to avoid: the platform now owns a game's content, balance and support for ever. And note
what it does *not* touch - **X3, the per-round cost floor, is a commercial unknown about a
provider's pricing**, and a game of our own that costs nothing per round tells us nothing about
it. A summary implying X4a de-risks the commercial question is wrong.

### X13-X18 - onboarding and matchmaking

**Added 2 September 2026** with chapter `20`. Listed in full in `20` section 8; summarised
here because this is the file a reviewer reads.

| # | Risk | Severity |
|---|---|---|
| **X13** | The **existing trading-only matchmaker keeps working** after a second game arrives, silently returning trading matches on a games platform. No error, no empty state, no log line | **High** |
| **X14** | **Inferred interest read as consent** - a player who paid to enter a competition starts receiving stranger challenge invitations they never asked for | **High** |
| **X15** | **"Challenge any user" becomes a harassment surface.** Blocking exists; there is **no player-facing report-user feature** anywhere in the codebase | Medium |
| **X16** | **Overall rank used instead of per-game rating**, pairing mismatched opponents while appearing to work correctly | Medium |
| **X17** | **Scope creep into a recommendation engine.** R24 is already rated High likelihood | Medium |
| **X18** | **Empty matchmaking at launch**, because nobody has declared any interests yet | Medium |

**X13 is the one to read twice.** `lib/services/matchmaking.service.ts` already exists and
ranks opponents by *trading* skill. It will not fail when a second game arrives - it will
keep returning matches, and they will keep being trading matches. This is the same failure
shape as the mirror-drift and `canEnterChallenges` defects found in Stage 0: **the system
reports success while doing the wrong thing.** The only defence is to change the service
rather than call it from a new place, proven by a test that asserts a match in a
non-trading game and fails before the change.

---

## 4. High platform risks

### R29 - Disabling a game retroactively demotes players

**Severity High, likelihood High, and the decision that prevents it is made in X1** - not
in X7 where the symptom would appear. Recorded 2 September 2026 from the owner's
plug-and-play requirement; the full design is `05` section 11.3.

**It is an R-series risk, not an X-series one**, and the distinction is worth stating
because it was initially filed wrongly: this failure applies **whoever supplies the
games**, including an in-house game or trading itself. Nothing about it depends on a third
party being on the critical path.

The requirement is that a new game is included in stats and rankings with no extra code.
The consequence nobody asks about is the inverse: **if cross-game totals are computed as
sums over currently-*enabled* games, then turning a game off subtracts everything earned
in it.** A player who reached level 12 partly through a provider game drops to level 9
because an operator disabled that game for a commercial reason. Their rank falls, badges
tied to thresholds may stop qualifying, and nothing anywhere reports an error - the
queries run, the pages render, the numbers are simply smaller.

**Why the likelihood is High rather than Medium:** computing a total by summing the
enabled set is the *natural* implementation. It reads correctly, it passes review, and it
is only wrong on a day when someone toggles a flag - which is months after the code ships
and far from the person who wrote it.

| Mitigation | Where |
|---|---|
| Cross-game totals **accumulate on settlement**, never recompute from the enabled set on read | `05` s11.3 rule 2, `11` s5 invariant 9 |
| `getEnabledGameTypes()` gates **creation, discovery and entry only** - it must not appear in a stats or leaderboard read path | `05` s11.4 |
| A disabled game's history is **retired, not deleted**; `gameKey` is immutable precisely so a player's past stays explicable | `05` s11.3 rule 3 |
| In-flight contests finish normally, or cancel with full refunds - never strand a paid entry | `18` s6, matching existing `tradingEnabled` behaviour |

**The test that proves it:** award progression in a game, disable that game, and assert
the player's level, XP and total points are **unchanged**. It must fail before the fix.

### R30 - The platform fee parameter takes a fraction but is named a percentage

Found 4 September 2026 while building the X1 regression baseline - by walking into it.

`distributePrizesWithTies` in `lib/services/competition-ranking.service.ts` declares
`platformFeePercentage: number = 0` and computes `grossPrize * (1 - platformFeePercentage)`.
That requires a **fraction**. Pass `10` meaning 10% and the multiplier becomes `-9`, so
every winner is assigned a **negative prize**.

**This is a naming defect, not a live money defect, and the distinction should not be
blurred.** Both production callers - `lib/actions/trading/competition-end.actions.ts` and
its admin mirror - compute `competition.platformFeePercentage / 100` before calling, so
payouts today are correct. Nothing needs backfilling.

Why it is rated Medium likelihood rather than Low:

- The parameter's **own name instructs the mistake**. A caller reading the signature has
  every reason to pass a percentage.
- It **defaults to `0`**, so forgetting the argument is harmless. Only supplying a
  plausible-looking value is dangerous, which removes the usual prompt to check.
- **X5 introduces a third caller** - the provider settle path - and provider fee handling
  is being written fresh by someone who has not read the two existing call sites.
- The failure is loud in a test and silent in production: a negative credit adjustment on
  a payout is an increase in the platform's favour, not a crash.

| Mitigation | Status |
|---|---|
| An assertion in the regression suite that no scenario ever pays a negative prize | **Done** - `ranking-regression.test.ts` |
| Rename the parameter to `platformFeeFraction` in both apps | **Done 4 Sep 2026** |
| Range-check the unit rather than trusting it | **Done 4 Sep 2026** - rejects anything outside 0-1, naming the received value |
| 19 tests covering valid fractions, refused percentages, and the boundaries | **Done** - `__tests__/services/platform-fee-unit.test.ts` |

#### CLOSED 4 September 2026, and the rename found a second bug on its way

Done as a standalone change, not folded into a test commit, because it is a money path.

**The guard cannot reject valid data**, which is what made it safe to add. Both the
competition and challenge schemas cap `platformFeePercentage` at `max: 50`, so a correctly
converted fraction never exceeds 0.5. Anything above 1 is a unit error by construction. It
throws rather than clamping: aborting finalization is retryable, paying negative prizes is
not.

**The rename was not a find-and-replace, and assuming it was would have broken the build.**
The local variable in both `competition-end.actions.ts` copies was *also* called
`platformFeePercentage` while holding a fraction, and it was read in **two further places**
beyond the `distributePrizesWithTies` call - `actualPlatformFee = prizePool * fee` and
`unclaimedNet = prizePool * (1 - fee)`. Both were correct code wearing the wrong name.
Renaming only the declaration left two references pointing at a name that no longer
existed; `tsc` caught it as `TS2304: Cannot find name`. **The lesson is to sweep for the
old name after a rename and read every hit**, because the compiler catches the ones that
break and says nothing about the ones that still compile and now mean something else.

### R31 - A Game Master rate configured at 0% is treated as unset - **CLOSED, 5 September 2026**

**Found 4 September 2026 while extracting the settlement stages, deliberately NOT fixed in
that commit, and fixed on 5 September. The entry below has been rewritten, because checking
the risk against the code before fixing it showed the register had the wrong branch.**

#### What this entry used to claim, and why it was wrong

It said `calculate.ts` resolved the rate as `limits.referralFeePercentage || 5` at three
sites, so **a package configured at 0% was paid 5%**. The first half was true and the
conclusion was not. The function reads the **current package first**, and that branch tested
`!== undefined`:

```ts
if (currentPackage?.gameMasterConfig?.referralFeePercentage !== undefined) {
  return currentPackage.gameMasterConfig.referralFeePercentage;   // 0 returns 0. Correct.
}
```

So a package that exists and says 0 always yielded 0. The three `||` sites were the
**fallbacks onto the cached `subscription.limits`**, reached only when the package has been
**deleted** or the subscription carries **no `packageId`**. Proven by a test before any fix:
of six cases, the three cached-fallback ones failed with `expected 5 to be 0` and the
current-package one passed.

**The general rule, and the reason this correction is recorded rather than quietly fixed: a
risk register entry is a claim, not a fact.** A fix aimed at this entry's sentence would have
changed the one branch that was already right. **Correcting a risk downward while closing it
is the same documentation duty as raising one** - the second time this has been needed, after
R7.

#### The bigger half, which nothing had recorded

**Six writers copied a package's configuration onto a subscription with
`config.referralFeePercentage || 5`, so buying a 0% package STORED 5%.** The purchase route
twice (upgrade and first purchase), the admin `fix-purchases` repair route, `activate`,
`renew`, and `scripts/fix-existing-gm-purchases.ts`. **Count the writers**, again: the
tracked risk named one file and there were seven across two concerns.

That is the worse defect, for two reasons. It is **durable** - the wrong value is persisted,
and a stored 5 is indistinguishable from a deliberate 5. And it **reaches the challenge path
through the data**: `challenge-finalize.actions.ts` resolves the fallback with `??` and was
otherwise correct, so it faithfully paid the 5% that the purchase route had wrongly stored.
The two paths did disagree, as this entry said, but not for the reason it gave.

#### And the reason a 0% package was hard to find in the first place

`apps/admin/components/admin/MarketplaceSection.tsx` declared the input `min={0}` and then
made 0 unreachable: `value={...referralFeePercentage || 5}` rendered a stored 0 as **5**, so
an operator could not see their own configuration, and `onChange` wrote
`parseFloat(e.target.value) || 5`, so **typing 0 was immediately rewritten to 5**. A control
that advertises a value and silently refuses it - the same shape as enabling a provider with
no adapter. **A 0% package could only ever be created by calling the API directly**, which is
why "check whether any exists in production" was the right instinct and would probably have
returned none.

#### The fix

| Layer | Change |
|---|---|
| Settlement read | `lib/services/settlement/game-master-fees/calculate.ts` + admin mirror: the three fallbacks become one `cachedRateOrDefault()` helper |
| Cached-limits write | New `lib/services/gamemaster/subscription-limits.ts` (mirrored) - `buildSubscriptionLimits()` is now the only writer of the limits shape, used by purchase ×2, activate, renew and fix-purchases |
| Admin editor | The value and the handler both keep 0; the `>= 10` warning threshold too |
| Displays | `??` in the marketplace page, the arsenal card, the package summary, and the AI content prompt |
| Stored rows | `tools/gamemaster/report-stale-subscription-limits.ts`, report-only, lists subscriptions whose cache disagrees with their package |

**`Number.isFinite`, not a bare `??`.** These values arrive from `parseFloat` on an admin
form, so `NaN` is one keystroke away, and `??` passes it straight through onto a required
`Number` path. `NaN` percentages are worse than the bug being fixed: every multiplication
downstream becomes `NaN` and nothing checks. **`||` was wrong about 0 and accidentally right
about `NaN`; the fix has to keep the second half.**

**Why it was preserved verbatim through the extraction**, which is still the part worth
carrying forward: the entire value of moving ~900 lines of money code is that the five
trading payout tests and the golden ranking regression staying green *proves* nothing moved.
A behaviour change made in the same commit destroys that proof for the sake of one line.

| | |
|---|---|
| **Severity** | Medium - real money, but narrower on the payout path than this entry claimed and wider on the write path |
| **Likelihood** | **Latent, not an active loss.** The admin UI could not store a 0% rate, so a package configured at 0% was almost certainly never created. Say latent, not occurred |
| **Status** | **CLOSED 5 September 2026.** 14 tests in `__tests__/services/game-master-fee-percentage.test.ts`, 8 probes in `tools/probe-gm-fee.ps1` |
| **Not repaired retroactively** | A code fix changes future writes only. Existing subscriptions still hold whatever `\|\| 5` produced, and the report tool is report-only. Renewal re-copies from the package, so an auto-renewing subscription repairs itself within one period |
| **One writer left** | `scripts/fix-existing-gm-purchases.ts:240` still reads `config.referralFeePercentage \|\| 5`. It is a hand-run repair script with its own local types and no path aliases, so it cannot import the shared builder as written, and it was not editable from the environment this fix was made in. **Named here rather than left silent**, because it is the one path that can reintroduce a stored 5% over a 0% package. Anyone running it should change `\|\|` to `??` on the three limit fields first |

**Three sites deliberately unchanged**, so a later sweep does not "fix" them: `|| 0` in
`UserFullDetailPanel.tsx` (twice) and `GameMasterDetailView.tsx`. A stored 0 renders as 0
through a truthy check, because the fallback and the value are the same number - **the
expression is odd and the behaviour is right**, and changing it would be churn in a diff whose
whole purpose is provable behaviour.

**Swept and confirmed unaffected:** the challenge finalization path uses
`challenge.platformFeeAmount`, an absolute amount, and only ever renders
`platformFeePercentage` into a display string beside a `%` sign. No fraction confusion
exists there.

**Proof the fix changed no payout:** the golden baseline regenerated **byte-identical**
after both the rename and the guard. **Probed:** deleting the guard turned 8 of the 19 new
tests red.

### R7 - Raw-driver contest inserts bypass Mongoose defaults - CLOSED 4 September 2026

Fixed in X1 step 6. All raw-driver contest inserts now spread `contestGameLabel()` from
`lib/games/registry.ts`. This is also why Mongoose discriminators were rejected in `11`
section 6.

**There were six writers, not the one this risk named.** The two Game Master routes, two in
`apps/admin/app/api/admin/trading-tests/run/route.ts` and two in
`apps/admin/app/api/admin/end-logic-tests/run/route.ts`. The harness ones are not cosmetic:
**the end-logic harness drives finalization**, which dispatches on `gameType`, so seeding
contests unlabelled meant the harness exercised the absent-label fallback instead of the
path production takes - a test quietly checking something adjacent to the real thing. Carry
the general rule, which is now the third instance after Defect 1's four entry paths and
seam 3's ten call sites: **count the writers before fixing the one the plan names.**

**Correct the severity claim this entry used to make.** It said an unlabelled competition
"gets settled by trading code and pays the wrong players". That is wrong, and the reason
matters: `resolveGameType` treats an absent label as **trading** (invariant 5), which is
exactly right for these six writers because all six create trading contests. R7 was never a
live payout bug. What it actually breaks is later and quieter - the day an aggregate
**groups by `gameKey`**, an unlabelled row drops silently out of a total, long after the
commit that caused it, and **cannot be corrected in place because `gameKey` is immutable
once written.**

Pinned by `__tests__/services/game-guards.test.ts`, which counts `contestGameLabel()` calls
against raw `insertOne` calls per file rather than checking a hard-coded list - so a
**new** raw writer added to any of these files turns it red. Probed by removing the label
from two different inserts; each turned 2 tests red.

Still open, and deliberately not done here: replacing the raw inserts with the consolidated
creation path used by the admin wizard. Two divergent creation paths for the same object is
the defect class X0 exists to remove from the entry path, and leaving it in the creation
path invites the same bug again - but that is a refactor of Game Master contest creation,
not a label fix.

### R9 - Fraud throttle blind to provider entries

`entry-fraud-gate.service.ts` counts `CompetitionParticipant` documents per hour.
`CoordinationDetectionService` and `BehavioralAnalysisService.recordCompetitionEntry` are
wired only into the competition entry action.

Provider contests will be **cheaper and faster to enter than trading contests**, which
makes them the more attractive target for multi-accounting. Extend the fraud gate to
provider entries in X5, not later.

**Constraint added 2 September 2026, and it governs how that extension may refuse anyone.**
The same gate used to refuse entry on the suspicion score alone, above
`entryBlockThreshold`. That refusal created no `UserRestriction`, so it appeared on no admin
screen, notified nobody, could not be lifted, and **ignored `autoSuspendEnabled` entirely** -
an admin who had deliberately left automatic suspension off still got automatic, permanent
lockouts. It locked a real player out and was reported by the owner as a live incident. See
Prerequisite B in `New games plan/00a-STAGE-0-prerequisite-fixes-DO-FIRST.md`.

So when X5 widens the gate: **automatic enforcement must go through `UserRestriction`, never
through a bare refusal inside the gate.** A refusal a player cannot see and an admin cannot
reverse is worse than no enforcement, because the account is lost and nobody knows why.
Scores raise alerts; restrictions block. Provider entries make this sharper, not softer - a
cheap, fast contest will trip a throttle far more often than a trading contest does, so the
false-positive rate this rule protects against is higher there than anywhere it has been
tested.

### R11 - Legal wording changed without review

`SitePage` holds the terms of service. `legal/ChartVolt-Regulatory-Defence-Pack.html`
depends on specific characterisations of skill and money flow. **Neither is a wording
pass.** Route through legal review.

### R12 - Badge or milestone IDs renamed

Badge and milestone **IDs** are referenced by `UserBadge` and `UserJourneyProgress`.
Renaming one orphans user progress. Change display names, never IDs.

### R17 - Disabling trading strands active contests

Covered in `15` section 2. Preferred behaviour: **refuse to disable trading while active
trading contests exist**, naming them.

---

### R32 and R33 - The score seam and its direction - **BOTH CLOSED, 5 September 2026**

Two defects in the provider payout path, found while mapping the code for the round inspector.
Recorded together because they were one missing seam seen from two ends. Full detail in `05`
section 2.0a and the `PROGRESS.md` work log; the reason they belong in the register is what they
teach about *how* a money defect survives a green test suite.

**R32.** No code path wrote `participant.score`. `applyResult` wrote `game_round` and stopped,
and `buildParticipantSeat` seats every player at zero - so every participant in a provider
contest would have settled tied at rank 1 and taken an **equal share of the prize pool
regardless of how well they played.**

**R33.** Settlement read `scoreDirection` off each participant, a field declared on **neither**
`CompetitionParticipant` copy. The read was always `undefined`, so the fail-safe default beside
it was the only branch and **every lower-is-better contest paid the slowest player first.**

**Both are latent, not occurred**, and saying which matters: no provider contest has ever
settled. There is nothing to backfill and **the fix must not be described as retroactive.**

**Rate the likelihood High, not Medium**, for the same reason R29 is rated High: nothing about
either defect looks wrong on review. The seam's absence is invisible because the file that
consumes it *says* the seam exists, and the direction read is a plausible line of code against a
field name that reads as real.

Four mechanisms let them through, and each is worth carrying:

- **An aside in a comment is a claim, not a fact.** Fourth instance, after `challengeId`, this
  register's own R7 severity, and `billsPerRound`.
- **A fixture that supplies the value under test has tested the consumer, not the producer.**
  The settlement suites seed the scores they rank.
- **A raw-driver fixture is not bound by the schema the application writes through.**
  `db.collection(...).insertMany` bypasses Mongoose strict mode, so the test stored a field no
  production path could.
- **An explicitly-typed `.lean<{...}>()` hides a field that does not exist**, because the
  compiler checks the generic rather than the schema - which is why the usual "errors that
  disappear after a model sync" signal never appeared.

---

### R37 - The same seam, one layer out, on the READ path - **CLOSED, 6 September 2026**

R32 and R33 fixed the seam where a score is **written** and where settlement **reads** it. Neither
looked at the third consumer: `getCompetitionLeaderboard`, which both apps call to render a live
board. Both copies were written for trading, and both dropped the two fields a provider game
ranks on - the main app's projection never selected `score`, and neither app's `participantData`
mapping carried `score` or `scoreDirection`.

So every provider participant arrived at `calculateRankings` with `score` undefined,
`getProviderRankingValue` read `score ?? 0`, **the entire field tied on zero, and the board
rendered in whatever order the tie-breakers or the document order happened to produce.**

**The lower-is-better case is the one to state plainly, because it is worse than a wrong board.**
Settlement resolves the direction itself, so a race-time contest was **reversed on the
leaderboard and correct at the payout.** A player could watch themselves lead all week and be
paid last, and every screen they saw would have looked deliberate.

**Latent for money, live for players, and the distinction is the whole triage.** No prize has
ever been misapplied, because settlement never depended on these mappings - so **nothing was
backfilled and the fix is not retroactive.** But a leaderboard is a live read, so any provider
contest entered before 6 September displayed a meaningless order to whoever opened it. "Closed"
without that sentence would make somebody stop looking.

**Rate it High.** Same reason as R32: nothing looks wrong. A projection listing trading fields
reads as an optimisation, a mapping listing trading fields reads as complete, and the board
renders without an error, an empty state or a log line.

Three mechanisms, and the first two generalise beyond this defect:

- **"Count the callers" applies to a SEAM, not only to a writer.** The rule has now caught four
  competition entry paths, ten finalize sites, six raw inserts and seven subscription writers.
  This is its read-side form: fixing where a value is produced and where money consumes it left
  a third consumer nobody enumerated. `rg` for the ranking function found six call sites, of
  which **two were reads and both were broken.**
- **A shared decision must be moved, not copied - and not left private to its first caller.**
  `resolveContestScoreDirection` was a private helper inside `provider-settlement.service.ts`,
  which is exactly why the leaderboard had none. It is now
  `lib/services/games/score-direction.service.ts`, mirrored, used by settlement and both
  leaderboards, so **the live board and the payout cannot rank differently.** Fifth instance of
  "one rule, two copies" after `referenceId`, `failedReason`, `challengeId` and the Game Master
  `||`, none of which `check:mirrors` can see, because it compares models.
- **A green probe has a fourth cause: the property is held redundantly.** An unrecognised stored
  direction cannot invert a board, and two separate single-site probes proved nothing - the
  resolver narrows it, and `getProviderRankingValue` independently tests equality against the one
  downward value, so **either alone is sufficient and neither can express the property's
  absence.** Add it to weak test, wrong claim and missing test. The probe now breaks both files
  at once; both guards are kept, because the redundancy is cheap and a silently reversed
  leaderboard is not something a player can be compensated for.

**How it was found is worth recording, because it was not by analysis.** The owner reported a
generic error page after entering a provider contest. The reproduction seeded a provider contest
and exercised each of the lobby's reads in turn - and the crash was **not** among them. The
leaderboard test written along the way failed for an entirely different reason. **A reproduction
that disproves its own hypothesis is still the thing that found the defect.**

---

### R38 - A field declared, read, and written by nobody - **CLOSED, 6 September 2026**

`provider_game.lastSuccessfulRoundAt` was added in X2 and **read** in X6, by the contest wizard's
pre-flight checklist, which raises an advisory when a title's sandbox has not produced a scoring
round recently. Nothing ever wrote it. It was therefore `null` on every title, on every
provider, however many rounds had scored - so **every operator who created or published a
provider contest was shown a stale-sandbox caution that no amount of successful play could
clear.**

**The harm is not the wording, and stating it as a cosmetic bug is what would leave it open.**
An advisory that is always on is an advisory that gets read once. The pre-flight deliberately
keeps three items advisory rather than blocking - the platform master switch, sandbox freshness,
and the per-round cost acknowledgement - precisely so an operator scheduling ahead of a launch is
not forced to switch external games on platform-wide. A permanently-lit item trains that operator
to skip the list, which is the same failure as a badge that flags every unresolved round: **a
signal that is right in general is worthless in the case you are looking at.**

**Latent for money, live for operators.** No payout, ranking or entry ever read the field, so
there is nothing to compensate. **Nothing was backfilled**, and that is a decision rather than an
omission: the value is a *freshness* signal, and deriving one from historical `game_round` rows
would assert that somebody observed a sandbox round at a time nobody did. A fabricated freshness
timestamp is worse than a null one, because the null at least announced itself.

Three things generalise.

- **Before building a screen on a field, grep for its writer.** This was found while building the
  provider health panel, by checking what populated the fields the panel intended to display -
  not by analysis, and not by any test. It is the counting rule turned round: after four entry
  paths, ten finalize sites, six raw inserts and seven subscription writers, here the count was
  **zero**, and a declared, defaulted, read field with no writer looks completely finished on
  review. **A clean typecheck is evidence the read compiles, never that the value exists.**
- **Only a status that scored may stamp a success.** `abandoned`, `expired` and `voided` are
  terminal as well, and stamping them would quietly redefine the signal as "a round ended
  recently" - which is true of a provider that is failing every single round, so the check would
  be greenest exactly when it should be loudest.
- **A cosmetic write must not be able to reject a money-bearing one.** The stamp sits inside the
  single ingestion door, which is the only place that knows a round scored, so it has to be
  wrapped: a failure to record a timestamp cannot be allowed to fail the ingestion of the score
  itself. Pinned by a test that makes the stamp throw and asserts the ingestion still succeeds.

**The sibling fields are worse, and were deliberately handled the other way.**
`game_provider.healthStatus` and `lastHealthCheckAt` have the same no-writer defect, and
`healthStatus` **defaults to `"down"`** - so the provider list could render a fully working
first-party provider as down, with no error and no log line. They were not given a writer: a
poller replaces a permanently-stale value with a silently-ageing one. They were removed from the
admin DTOs and the health verdict is **derived on request** instead. See `12` s4.2b. The fields
stay on the model, because a Mongoose field is add-only in practice and removing them is a
mirrored migration for no gain.

### R39 - A component passed across the client boundary took the trading lobby down in production - **CLOSED, 6 September 2026**

**The only entry in this register that was reported by the owner from a live screen rather than
found by us**, and the only one whose harm was total: every request to
`/competitions/[id]` for a trading contest rendered the error boundary. Not degraded, not
subtly wrong - **unavailable**, for the platform's busiest player screen, for as long as the
build was deployed.

**The cause is one prop.** `components/neon/Accordion.tsx` is the only `"use client"` file in
the design kit, so it is the only server/client boundary on either lobby, and it took
`icon: LucideIcon` and built the tile itself. **A React component is a function, and a function
cannot cross that boundary.** The runtime error names
`{$$typeof: ..., render: function, displayName: ...}` - a `forwardRef` object - which is
recognisable as a lucide icon only once you already know. Fixed by taking the icon as
already-rendered output, exactly as the sibling `content` prop already did.

**Four things generalise, and the last two are the ones to keep.**

- **A green `next build` is not evidence that a dynamic page renders.** The lobby is `ƒ`, so it
  is never prerendered and the build never executed it. The build had been green through this
  bug twice.
- **The typecheck cannot help here, and that is structural rather than bad luck.**
  `icon: LucideIcon` is a perfectly good prop type; the rule it breaks is a React *runtime*
  serialisation rule. **There is no type in the codebase that means "serialisable".**
- **The first guard written for it stayed green when the bug was reintroduced, and the reason is
  the trap itself.** The obvious assertions - `typeof icon !== "function"` and
  `icon` has a `$$typeof` - are both **satisfied by a lucide icon**, because a `forwardRef` is an
  object and carries its own `$$typeof` of `Symbol.for("react.forward_ref")`. The error message
  had said exactly that and it was read past. `isValidElement` is the check. **Safe by accident
  is not safe** - the same shape as the prototype-chain lookup in the round-resolution action
  list.
- **The whole class is invisible to structural tests**, which is what every other guard on this
  screen is. The behavioural test now imports `buildTradingLobbySections` and asserts each
  section's `icon` and `content` are elements, and a structural test asserts `Accordion.tsx`
  mentions `LucideIcon` **nowhere** - not merely that it has no such prop - plus an enumeration
  that turns red if a **second** client component is ever added to the kit, so nobody adds one
  without meeting this paragraph.

**Nothing was backfilled and nothing could be:** the page threw on render, so there is no bad
data, only requests that failed. The fix is a deploy, not a migration.

### R40 - An admin money-adjacent route with no authentication at all - **CLOSED, 7 September 2026**

`POST /api/finalize-old-competitions` in `apps/admin` had **no authentication of any kind**. Not a
weak check, not a token-validity check that should have been a section check - nothing. Any
anonymous caller who knew the path could force-finalize every `completed` competition in the
database: the handler closes each contest's open `TradingPosition` rows at live prices, writes
`TradeHistory` rows, recalculates participant PnL, and fetches forex prices from an external API
once per position.

**This is the second unauthenticated route found in this programme**, after Prerequisite A's
`/api/simulator/*` accepting a plain `X-Simulator-Mode: true` header. The two together are why the
rule is stated as a class rather than as two incidents: **the routes with no guard are not found
by reading the ones with weak guards.** Every other route in this sweep - list, pause, cancel,
emergency-cancel, adjust-results - had *something*, and reviewing them would never have surfaced
this one. It was found by enumerating the lifecycle routes and counting guards against exported
handlers, which is a different activity from reading each route.

**Severity, stated precisely, because two facts pull in opposite directions.** It is
**unauthenticated and live**, which is as bad as this register gets. But it is scoped to contests
already in `completed`, so it cannot finalize a running contest, cannot pay a prize, and cannot
move wallet money - `settleFeesAndGameMasters` is not on this path. The realistic harm is a
corrupted trade history and audit trail on historical contests, plus an unmetered external API
bill, both triggerable by anyone. **Do not let a summary round that up to "anyone could pay
themselves", and do not let it round down to "it only touches completed contests" either.**

**Nothing was backfilled and there is no way to know whether it was ever called.** The route wrote
no audit entry, because it had no caller to attribute it to. Its writes are indistinguishable from
a legitimate operator sweep. That absence of evidence is itself the finding: **a route with no
guard also has no attribution, so the question "did this happen" cannot be answered afterwards.**

Fixed by `guardSection("competitions")`, placed **before `connectToDatabase()`** so a refusal
opens no connection and reaches no query - the same before-any-work ordering that
`checkAccountStanding` follows. Pinned by position, not by presence, because a guard added at the
bottom of the handler satisfies any mention-based check while every write has already landed.

### R41 - Pausing a provider contest did nothing - **CLOSED, 7 September 2026**

`Competition.isPaused` is a trading-era field, honoured by `order.actions.ts` since long before
games existed. `lib/services/games/round-launch.service.ts` never read it. So an operator pausing a
provider contest got a success toast, a PAUSED banner, a notification sent to every participant -
and **players carried on starting and finishing rounds throughout.**

**The failure shape is the one this programme keeps meeting: the control reported success while
doing nothing.** Same as the trading-shaped `matchmaking.service.ts`, a provider enabled with no
adapter, and a `rankingMethod` a provider game ignores. What makes this one worse than a dead
control is that it was used *during incidents*: `IncidentsSection.tsx` calls the pause route when
an operator raises an incident on a contest, so the one moment an operator most needs play to stop
is the moment they were most confidently told it had.

**Two things were wrong beyond the missing gate, and both would have survived a fix aimed only at
the launch service.**

- **Resume compensated the wrong field.** It extended `endTime` by the pause duration.
  `createRound` gates on `playWindowEnd` and the launch service gates on `playWindowStart`;
  `endTime` gates neither. So the contest ran longer while the window players actually play inside
  stayed exactly as short - a two-hour pause simply consumed two hours of their playing time. It
  reads as correct because the field being extended is the one called "end".
- **The operator's control panel described a different game.** `CompetitionAdminActions.tsx` said
  seven trading-shaped things, the worst being "All positions will be closed at current prices"
  above the emergency-cancel confirm button on a contest with no positions, and "Trading is now
  frozen" on a pause that was not being enforced. See `12` s3.2a.

**Latent, and say so.** No provider contest has run in production, so no player ever kept playing
through a pause and no operator has been misled by the panel yet. **Nothing was backfilled** -
there is nothing to backfill, since the defect is an absent check rather than a stored value.

**The general rule, which is the reason this is an R-series entry and not an X-series one:** a
capability the platform already has does not automatically extend to a new game, and the way it
fails is silence. `isPaused` was not missing, not undocumented and not broken - it was simply not
read by the new code path, and every screen above it kept saying it worked. **When adding a game,
enumerate the operator controls that already exist and ask of each one which code path enforces
it**, rather than asking whether the field is set.

---

### R42 - The admin cron refused to settle provider contests - **CLOSED, 7 September 2026**

`apps/admin/lib/actions/trading/competition-end.actions.ts` had no provider dispatch. Its only
game check was `routeToTradingSettlement`, which answers the narrow question *may trading settle
this* - so a provider contest reaching this function was refused outright and left `active`.

**Both apps register `checkAndFinalizeCompetitions` on an every-minute cron** (`lib/inngest/functions.ts`
and `apps/admin/lib/inngest/functions.ts`). Whether a provider contest settled therefore depended
on **which cron process claimed it first**. There is no flag, no alert and no log line a person
looks at on either branch.

**State the harm precisely, because the neighbouring entry invites the wrong summary.** R26 was a
*missing stage* on this same cron - the contest settled, the players were paid, and only the Game
Master's commission was skipped. This is not that. Here **nothing happened at all**: no ranking,
no prizes, no fees, no completion. The contest simply stayed `active` past its end time, looking
finished to every screen and to the operator.

**Latent, and nothing was backfilled.** No provider contest has settled in production. There is
also nothing that *could* be backfilled: the defect is an absent branch, not a stored value.

**The general rule, which now replaces both instances rather than sitting beside them.** After
R26, this is the second capability the main app had and the admin app did not, in the same pair of
files. So carry the form: **the four finalize functions are not four copies of one function, and a
capability added to one is not thereby added to the others.** The main app's dispatch was written
in X5 and the admin app's absence was not a regression - it had never been there.

**Two instruments were silent, and both are ones we would normally trust.**

- **`check:mirrors` agreed, correctly.** `provider-finalize.ts` and `provider-settlement.service.ts`
  were **already mirrored into `apps/admin`** during X5 and imported by nothing. The two copies did
  agree; only the call site was missing. The guard compares models and files, never callers.
- **The file-size heuristic that found R26 raises nothing here.** R26 surfaced because
  `competition-end.actions.ts` was 72 KB against 38 KB. The pair is now 45 KB against 37 KB, and a
  six-line dispatch does not move that needle. **A heuristic that found the last defect is not
  evidence about the next one.**

**Ordering is the load-bearing part of the fix.** The dispatch sits before `startSession()`.
`finalizeProviderCompetition` opens its own session and takes its own optimistic lock, so
dispatching after would nest a transaction inside one this function owns. It also has to precede
any lock for the reason the main app records: refusing early leaves the contest untouched, whereas
refusing after a lock strands it with nobody able to claim it again.

**And a note on what the probes could and could not establish**, because it changed what got
written. The two game gates - the new pre-session dispatch and the pre-existing in-transaction
`routeToTradingSettlement` - each cover the other's end state, so **neither can be probed by
removing it alone**; both had to be disabled in one edit, by stubbing the shared import. The
main app's equivalent situation was resolved by asserting `updatedAt` never moved, and that does
not transfer: **this path takes no optimistic lock**, so there is no `finalizing` state to strand a
contest in, and an aborted transaction is indistinguishable from a never-opened one. The
in-transaction gate is kept for a case this suite cannot construct - a label that changes between
the two reads - and `tools/probe-admin-provider-dispatch.ps1` **records that as unprobed rather
than carrying a fifth probe that reports green** and teaches the next reader it is decoration.

**One fixture lesson, the same one this programme keeps paying for.** The seeded participants used
`competitionId` as an ObjectId. `CompetitionParticipant.competitionId` is declared `String`, and
the raw driver does no casting, so settlement's query matched nothing. It did not crash: it logged
`Found 0 participants`, booked the whole pool as an unclaimed pool, recorded a platform fee, marked
the contest `completed` and **returned success**. Only the prize count disagreed. That is the
argument for asserting the money separately from the terminal status - **a status assertion passes
either way.**

### R43 - The undersubscribed sweep cancelled competitions and refunded nobody - **CLOSED, 7 September 2026**

**This is the one entry in this register that was losing real money on both game types, every
day, in production.** Almost everything else here is latent; this was not.

`updateCompetitionStatuses` runs on an **every-minute cron in both apps**. When a competition
reached `startTime` below `minParticipants` it did two things in this order:

1. `Competition.findByIdAndUpdate(comp._id, { $set: { status: "cancelled", ... } })`
2. `cancelCompetitionAndRefund(comp._id, ...)`

Step 1 is what cost the money. `cancelCompetitionAndRefund` claims its competition with
`findOneAndUpdate({ _id, status: { $ne: "cancelled" } })` - **the lock added to fix the
double-refund defect (live bug 5)**. Step 1 had already written that status, so the claim matched
nothing, the action took its already-cancelled branch, and returned
`{ success: true, refundedCount: 0, totalRefunded: 0 }`.

**Every player's entry fee stayed with the platform.** The competition showed `cancelled`, the
participants were never marked `refunded`, and `prizePool` kept its funded value because only the
refund path zeroes it.

**Three things conspired to make it unreportable**, and each is worth carrying separately.

- **The refund's own log asserted the opposite of what happened.** The branch printed
  `"is already cancelled; refunds were already issued"` - an inference, not an observation. It was
  written for a retried delivery, where it is true, and it reads as reassurance in the one case
  where it is false.
- **The caller's log reported its intention, not its outcome.** It printed
  `` `💰 Refunded ${participantCount} participants` `` unconditionally, ignoring the returned
  `refundedCount`. So the run that refunded nobody logged a full payout. **A success log computed
  from the request rather than the response cannot report a failure.**
- **The two paths that did work hid how often it failed.** `getCompetitionById` cancels
  undersubscribed competitions as a backup during render and does **not** pre-set the status, so it
  refunds correctly. Whether a player got their money back depended on whether the cron or a page
  load got there first - and the cron polls every minute, so it nearly always won.

**The fix is in two places, and the second one is the point.**

The root cause is the caller: both crons no longer write a status, because cancelling is the refund
action's job and it does it in the same transaction as the money, which is the only way the two
cannot disagree. But the failure is **silent**, so the action was also made self-healing: an
already-cancelled competition is now refunded rather than refused.

That widens the door live bug 5 relied on being shut, so **idempotency had to move off the status
and onto the per-player `competition_refund` ledger rows** - which is exactly what
`lib/services/settlement/exclusion-refund.ts` already does, and it states in its own comment that
the transaction is not what provides idempotency. The new key is strictly stronger: a player who
has been paid back has a row, one who has not does not, whatever any caller did to the status.

**The general rule, and it is the inverse of the one live bug 5 taught.** That defect produced
"setting the final status up front IS the lock", which is still true. R43 is what happens when a
**caller performs the lock's write for it**: the lock cannot tell a duplicate request from a
first one, and it fails in the direction that keeps the money. So - **a lock keyed on a field any
caller can write is only as good as every caller's restraint, and the ones that break it report
success.** Prefer a key derived from the work actually done.

**Not retroactive, and the affected players *can* be found**, which is unusual here and worth
stating plainly rather than defaulting to the usual "nothing to backfill". A cancelled competition
whose participants are not `refunded`, and which has no `competition_refund` rows against its
`competitionId`, is precisely an affected contest - all three facts are stored. **No backfill
script was written**: crediting wallets from inferred history is an unreviewed money writer, and
which players to compensate is an owner decision. The query to find them is the deliverable.

Pinned by 4 behavioural and 4 structural tests in
`__tests__/services/competition-cancel-refund.test.ts`, and 5 probes in
`tools/probe-cancel-refund.ps1`, **all red with exactly 1 failure each.** The structural half
matters because the root cause is a one-line *absence* in a file where `status: "cancelled"` also
appears legitimately, so the guard slices around the refund call rather than matching the file.

---

### R44 - Settlement ran before the grace window opened - **CLOSED, 7 September 2026**

The owner asked what happens when one player finishes and another is still going. **Half the
answer was already correct**: `createRound` clamps a round's `expiresAt` to `playWindowEnd`, and
since `12` s2.3 the play window *is* the contest clock, so there is one cut-off for everybody,
nobody waits for anybody, and a player who starts too late to finish is refused up front rather
than cut off mid-game.

**The missing half was the handover, not the clock.** `checkAndFinalizeCompetitions` claims any
contest whose `endTime` has passed, **every minute**. A provider does not report synchronously -
`resultGracePeriodSeconds` exists to say how long after the window a late result is still
welcome - so a contest settled within about sixty seconds of its cut-off, **before the grace
window had even opened.** A player finishing at 13:59:50 had their result refused as
`late_recorded_not_applied`, was ranked on nothing, and **was paid nothing for a round they had
actually finished.**

**A planned deferral had to be verified rather than assumed, and it changed the design.** `07`
s2.2 puts the `unresolved` write in the reconciliation net's stage 4. **The net is not
scheduled** - `reconcileRound` and `findRoundsNeedingReconciliation` are imported by their own
test and nothing else, because the schedule belongs to E7/X8. That is documented in the service,
so it is not itself a defect, but three consequences follow and none could be guessed: **nothing
polls**, so a lost webhook is a genuinely lost score today rather than a slow one; **nothing else
ever closed a live round**, so one sat `launched` for ever against a finished contest; and **no
alert fires**, so any document saying an operator is paged for an unreported round is describing
E7. Consequently `exclude` and `hold_and_alert` had never had an input, and this is the first time
either can fire.

**Three things about the fix that generalise.**

- **`unresolved`, not `voided`, and the tidy-looking option was the wrong one.** `voided` is what
  the cancellation path writes, it is one word shorter, and it reads as housekeeping. It would
  also **silently override all three configured policies with "score zero, nothing owed"** -
  including the ones set to refund the player or park the contest for a human. `unresolved` is the
  one persisted fact `assessUnresolvedRounds` reads. A configured control that cannot fire is the
  same failure as a `rankingMethod` a provider game ignores.
- **The mark must be durable BEFORE settlement is asked to run, and both orderings fail
  silently.** Inside the transaction, a `hold_and_alert` abort - the policy working - rolls the
  mark back, the pre-lock gate keeps seeing nothing unresolved, and **every cron pass re-marks,
  re-blocks and re-rolls-back for ever**: nobody paid, no round for an operator to resolve, no
  error anywhere. Assessing the hold *before* the mark always sees zero, so a held contest settles
  on its first pass.
- **A deferral must also refuse a human.** An operator forcing settlement two minutes after the
  cut-off would destroy the scores of everyone who finished in the last minute and never know, so
  the refusal names the time it can run instead of offering an override.

**One shared constant, for the reason R26 exists.** `DEFAULT_RESULT_GRACE_SECONDS` moved out of
the reconciliation service into `round-types.ts` because settlement waits on the same window and
settlement runs in **both** apps while that service exists only in the main one. A second copy
would be silent in the worst way: the app with the shorter default settles first, so **whether a
last-minute finisher is paid would depend on which cron claimed the contest.**

**Two probing lessons, and the second is a new one for this register.** Four of the fifteen probes
were green on the first run and **all four were mis-aimed rather than reporting a weak guard.**
One added its write immediately before the lock, which the deferral returns before ever reaching.
One widened an `if` whose body then assigned `undefined` over the value the probe had just set -
**the probe undid itself one line later.** And two hit the case R42 first recorded: **two guards
covering each other, where neither can be probed alone.** The query filter on
`LIVE_ROUND_STATUSES` and the transition check both refuse to touch a reported round, and the
pre-lock hold gate is duplicated inside the settlement transaction - so single edits left the
suite green while both guards worked. The harness gained a two-edit mode, and the observable for
both hold gates is **`updatedAt`**, because the two placements end at the same status with the
same error and differ only in whether the contest was ever claimed. **A probe aimed at the wrong
statement is indistinguishable from a guard that does nothing**, and the honest response to a
covered pair is to remove both, not to ship a green line teaching the next reader the gate is
decoration.

**Latent, and nothing was backfilled** - no provider contest has settled in production, and the
defect is an absent wait rather than a stored value. Pinned by 8 tests in
`__tests__/services/provider-round-cutoff.test.ts` and 15 probes in
`tools/probe-round-cutoff.ps1`. Design in `07` s2.3b.

---

### R45 - A player who never played was paid a prize - **CLOSED, 7 September 2026**

Every qualification rule in `competition-ranking.service.ts` was trading-shaped, and provider
settlement passes exactly the values that switch all of them off: `minimumTrades: 0` and
`disqualifyOnLiquidation: false`, correctly, because a puzzle has neither. So **nothing
disqualified anybody.** A participant who never launched a single round ranked on the
`score ?? 0` fallback and **was paid.**

Run against the owner's own 70/20/10 example: one real scorer, two players who never started.
The two took **30% of the pot** between them. And with nobody scoring at all, all three tied at
rank 1 and **split the entire pot** - the exact inverse of "if no winner, all lose", and it reads
on screen as a prize-distribution bug rather than an eligibility one, which is where the owner's
report of a confusing distribution came from.

**The fix is a question asked of the game module, not a branch here.** `hasResult(participant)`
joins `getRankingValue` and `getTieBreakerValue` on the module interface. Provider answers
`Number.isFinite(participant.score)`; **trading answers `true`**, because a flat account is a
real result and `minimumTrades` is the existing, operator-set way to say otherwise. Written as
`if (gameType === "provider")` this would have been the shape that makes the next game silently
fail - the same trap as the trading-shaped services in `matchmaking.service.ts`.

**Four things about it that generalise.**

- **The gate must be scoped to a COMPLETED contest, and dropping the scope reads as a
  tightening.** `getCompetitionLeaderboard` ranks with the contest's live status, so the same
  function draws the board during play. Unscoped, every player mid-round is stamped
  **disqualified** on a contest they are still playing - and since `13` s4.1b renders the reason,
  they would read "No score recorded" as a verdict. The two trading checks beside it are scoped
  for the same reason; matching them was right.
- **`Number.isFinite`, not `!= null`, and truthiness is the interesting wrong answer.** `!= null`
  admits `NaN`, which fails every comparison in the sort, so it does not land last - it lands
  wherever the comparator leaves it and is then **paid from a position nobody chose**, which is
  worse than a wrong order because it cannot be explained afterwards. Truthiness is shorter, reads
  correctly, and **refuses the player who attempted the game and genuinely scored zero.** Second
  instance after R31, where `??` would have passed a form's `NaN` onto a money path.
- **`competition-ranking.service.ts` is a divergent duplicate that NOTHING guarded**, and it is
  reached by both apps' every-minute finalize cron. `check:mirrors` compares **models**, and the
  two copies are 77 lines apart because the admin one carries its own logging, so they can never
  be byte-compared either. A rule in one copy only means the payout depends on which cron claimed
  the contest - which is R26 and R42 exactly, making this the **third finding in this one file
  pair**, and therefore a reason to look at the remaining pairs rather than to assume.
- **The runtime parity suite cannot see the admin copy, and its header said it could.** Vitest
  aliases `@` to the repository root, so both finalizers import the root ranking service; blanking
  the admin gate leaves the whole suite green. Two probes proved it. The property moved to a
  **structural** test comparing the two files as text - the only guard that can hold it - and the
  suite's justification, which claimed every dependency it touches is byte-identical, was
  corrected in place rather than reworded, because it is the reason the probes were expected to
  work.

**Where the money goes instead:** the fee stage's existing `all_disqualified` unclaimed pool, net
of the platform fee, exactly as a trading contest with no qualified winner does. **Whether an
all-unscored contest should instead refund its entrants is an owner decision this change did not
take**, and the tests assert what the platform does rather than what it should do.

**Live for any provider contest that had settled, and none has** - so latent for money, and
**nothing was backfilled**. Pinned by 9 tests in
`__tests__/services/provider-prize-eligibility.test.ts`, 3 in the parity suite, and 10 probes in
`tools/probe-prize-eligibility.ps1`. Two probes are recorded there as **unprobed with the
reason** rather than shipped green. Design in `05` s11.1.

### R46 - The screen that made a correct payout look broken - **CLOSED, 7 September 2026**

The owner's report was that on a contest named `newww` "the prizes, the distribution is a mess".
**No money was wrong.** `/competitions/view/[id]`, the screen an operator opens to find out what
happened, rendered `pnl`, `pnlPercentage` and `totalTrades` unconditionally.

**Why that is invisible rather than broken.** All three default to `0` on **every** seat
regardless of game (`participant-seat.ts`), so on a provider contest they are present, zero, and
render perfectly: `+0.00`, `+0.00%`, `0 trades` against every player. Meanwhile **`score` - the
number the contest ranked on - was on the row and was never displayed.** R37 had already fixed
what the board ranks *by*, so the order was right; there was simply no evidence for it on screen.

Rows in an order nothing explains, every metric identical, winner badges and prize amounts
beside them. **A reporting defect on top of a money screen gets reported as a money defect**, and
that is the general form worth carrying: when the numbers a screen shows cannot account for the
order it shows them in, the reader concludes the payout is wrong, because that is the only
explanation the screen offers.

**Rated as it actually was: a live reporting defect, never a wrong payment.** It affected every
provider contest an operator has ever opened, which is a real harm to their ability to
reconcile - and it is not a money loss. Saying which is the difference between a register entry
that gets believed and one that does not, the same duty as correcting R7 and R31 downward.

Four siblings found once the metric was understood, all on the same screen:

- **Edit routed every contest to the trading editor.** The competitions *list* learned to route
  by game in `12` s2.2 **on the same day**, and this page was missed - **"count the writers",
  now in its own next instance: the fix went to the call site somebody had noticed.** Not a
  corruption path, because `PUT /api/competitions/[id]` refuses a labelled provider contest, and
  that is what makes it worth fixing: the operator completed the whole trading form and was
  refused **on submit**, which is worse than never being offered the button.
- **Trading-only configuration rendered as `$0`, `1:1` and an empty list.** Inapplicable, not
  zero - and a printed value makes a claim where withholding declines to. `$0` starting capital
  reads as a misconfiguration to go and fix.
- **The per-rank amounts used the credit name while the pool stat, the "Won:" figure and the
  player-facing prize table used the currency symbol.** One quantity, two units, one screen.
- **`noWinners` was read by no admin screen at all.** Written at settlement, and the only signal
  was an empty winners table - indistinguishable from a page that failed to load.

**The sidebar's figures are a floor and nothing said so.** They are what the operator typed;
an unplaced rank's share is split among the players who did place, and since R45 a player with no
result holds no rank. An operator reconciling them against wallet credits concludes the payout is
wrong. One exported string, shared with `PrizeDistributionEditor`, so the editing and reading
screens cannot describe one payout two ways.

**Nothing here is mirrored and no money logic changed** - every fix is on a read path, so there
is nothing to backfill and nothing to be non-retroactive about. `apps/admin/lib/admin/` is
admin-only, so `check:mirrors` says nothing about it.

Pinned by `__tests__/admin/contest-result-presentation.test.ts` (12 tests) and
`tools/probe-admin-contest-view.ps1` (13 probes, all red with exactly 1 failure each). The logic
was extracted out of the JSX **so that it could be tested at all**: a structural test can assert
a file mentions `score` and cannot assert which branch renders it, which is the weakness four
earlier probes passed through. Design in `12` s2.4.

---

### R47 - The Game Master route that answered to nobody - **CLOSED, 7 September 2026**

Three findings in the Game Master surface, none of them what the work set out to do. The task was
to make the creation API game-aware; these turned up on the way, which is the general shape worth
keeping: **generalising code is a better bug-finding instrument than looking for bugs.**

**`POST /api/gamemasters/sync-referrals` had no authentication on either handler.** Its four
siblings under `/api/gamemasters` all called `requireSectionAccess("gamemaster-management")`. It
was found by **counting exported handlers against guards**, which is a different activity from
reading each route, and it is the only technique that finds this: every neighbour having a guard
is precisely what makes a reader's eye slide past the file that has none. The same count also
catches the subtler shape, a file whose `GET` is guarded and whose `POST` is not.

**The exposure has to be stated in both directions or it gets triaged wrongly.** The POST takes
**no body**. The mapping it writes comes from the `userreferrals` collection, so a caller could
**not** point commission at themselves - the "rewrite referral attribution" reading is wrong.
What they could do is real enough: apply a pending attribution change an operator had
deliberately not applied yet, and drive an unbounded `findOne` + `updateOne` loop across every
active referral record, unauthenticated, as often as they liked. The GET handed up to ten real
user ids and display names to anybody who asked. And **there is no way to find out whether either
was ever called**, because a route with no guard writes no attribution - so say that, rather than
letting the absence of evidence read as reassurance.

**`PATCH /api/gamemasters/[id]`'s `update_limits` was a mass assignment.** It did
`limits: { ...subscription.limits, ...limits }` - every key the browser sent, onto the subdocument
that decides a Game Master's daily contest cap, participant cap, revenue share, and now which
games they may create at all. The aggravating detail is that this route updates with the **raw
MongoDB driver**, so no Mongoose validation runs: the schema's `min: 2` on `maxUsersPerCompetition`
and its bounds on the fee percentage were never applied on this path. It is now an allow-list of
five fields in `apps/admin/lib/admin/gamemaster-limits-update.ts`, which **refuses an unknown
field by name rather than dropping it** - dropping is tidier and it means the edit appears to save
while doing nothing, which is this codebase's recurring failure mode. The allow-list is a `Set`,
so a request-supplied `"constructor"` cannot pass a lookup that walks the prototype chain; that is
the third instance of that rule after the round-inspector action map and the contest-edit field
list.

**The admin creation route was bypassing package limits.** It resolved from the cached
`subscription.limits` only and never read `canCreateCompetitions` at all, so a Game Master whose
package had creation withdrawn could still create contests through it. Both routes now resolve
through `lib/services/gamemaster/game-permissions.ts`, mirrored - one function, four sources of
truth, and a reported `creationDecidedBy` so a refusal names the administrator when an
administrator is the cause rather than sending the Game Master to buy an upgrade that cannot help.

**Nothing was backfilled and there is nothing to backfill.** The mass assignment stored whatever
an operator actually submitted, which is not distinguishable from intent, and the unauthenticated
route wrote values copied from a collection it did not modify.

Pinned by `__tests__/services/gamemaster-creation-permissions.test.ts` (59 tests) and
`tools/probe-gamemaster-creation.ps1` (18 probes, all red with exactly 1 failure each). One probe
came back **green for the third reason** - not a weak test and not a wrong claim, but **no test at
all**: restoring the blind spread left `resolveCreationLimits` in the file, so the badge test it
had been aimed at stayed satisfied. Naming the expected failing test is what exposed it.

---

### R48 - The ending decided whether the play counted - **CLOSED, 7 September 2026**

The owner's report was that only a player who finished every board seemed to win, and that this
was not what they wanted: **"the users with the best performance take the prizes, it doesn't
matter if they finish the boards."**

**Neither codebase ever had a rule about finishing.** `games-service` scores any board a player
solved and returns nothing at all only for `voided`, because the provider specification asks
twice for a partial score on the grounds that "a dropped mobile signal should not cost someone a
paid entry". So the provider - our own, in this case - did the right thing throughout.

**The platform then discarded it.** `syncParticipantScore` selected the player's rounds with
`status: "completed"` alone, so a genuine partial score sitting on `game_round` never reached
`participant.score`, and the player ranked on the seat default of nought. The effect was that
**the way a round ENDED decided whether the play counted at all**, which nothing in any chapter
had ever said it should:

| Ending | Status | Counted before | Counts now |
|---|---|---|---|
| The game's own clock reaching zero | `completed` | yes | yes |
| The **contest's** window closing over the player | `expired` | **no** | yes |
| The player leaving mid-round | `abandoned` | **no** | yes |
| An operator voiding the round | `voided` | no | no |
| Nobody ever reporting | `unresolved` | no | no |

**The second row is what made this urgent rather than tidy.** `expired` is not a player giving
up: `createRound` clamps a round's `expiresAt` to `playWindowEnd`, so under the universal
cut-off - every round closed at one moment so nobody waits for anybody - it is the **ordinary**
ending for anyone still playing at the final whistle. The better a contest was attended right up
to its end, the more of its players ranked at nought. No error, no log line, and a prize table
that looks deliberate.

**Two statuses stay out, for two different reasons.** A `voided` round has no score by
construction and the attempt is handed back, so any number arriving with that status is
bookkeeping rather than play - counting it would let a support action move a leaderboard. An
`unresolved` one is the contest's `unresolvedRoundPolicy` to decide, and counting it here would
answer that question twice.

**There is no incentive to abandon deliberately, and it was checked rather than assumed.** An
attempt is consumed when a round is **created** (chapter `03` s1.3), so walking out buys nothing
back. And under every attempts policy, counting a cut-short run can only help the player:
`best_of_n` discards it if it was worse, `sum_of_n` adds it, `single` means it was their one
attempt.

**Latent, and nothing was backfilled.** No provider contest has settled in production, so no
prize was ever paid on the wrong ranking. The scores themselves were never lost - they are
stored on `game_round` - so a contest that had already settled wrongly could in principle be
recomputed, but there is none.

**The read side had to move with the write side.** `findCountedAttempt` in
`contest-results.service.ts` decides which of a player's attempts the results screen labels as
the one that counted, and its own header already said it "must agree with
`participant-score.service.ts`". It filtered on the presence of a score alone, which was
**already wrong for one status before R48 widened anything**: a `voided` round is stored with
`rawScore: 0` deliberately, so the screen would have told a player a voided attempt was the one
that counted while the leaderboard beside it ignored the round. The status rule is now
**imported from the decider** rather than restated, and `status` is a **required** parameter, so
a caller cannot omit it and get a silent "nothing counted". Same reasoning as
`UNSCORED_REFUND_REASON` and the round-resolution action list - the "one rule, two copies" shape
behind `referenceId`, `failedReason`, `challengeId` and the Game Master `||`, none of which
`check:mirrors` can see.

**One sibling, found by applying the counting rule rather than by reading the fix.** The admin
**Game Performance** screen defined `SCORED = ["completed"]` under the comment "rounds that
finished having produced a score", and `GAVE_UP = ["abandoned", "expired"]` under "their own
doing, not a fault". Both sentences became false. The consequence was not cosmetic: the derived
`abandonmentRate` counted **every player caught by the universal cut-off as having abandoned the
game**, on the one screen an operator uses to decide whether to keep a title running - so a
well-attended contest made its game look like one people could not get on with. The buckets are
now split, `expired` has its **own** rate with its own threshold and its own verdict sentence
(the remedy is a longer play window or the `until_window_closes` policy, not a different game),
and the "did this produce results" count is taken **from the stored score rather than from any
status**, because no status can answer it - a player cut off after two boards ends `expired` with
a score that pays, and one who abandoned before solving anything ends `abandoned` with nothing to
rank.

Pinned by `__tests__/services/participant-score-arrival.test.ts`,
`__tests__/games/provider-results-screen.test.ts` and `__tests__/admin/game-performance.test.ts`.
The boundary is asserted in both directions - `expired` and `abandoned` count, `voided` and
`unresolved` do not - because a widening with no upper bound is indistinguishable from having no
rule.

---

### R49 - The dead null check under a noisy log line - **CLOSED, 7 September 2026**

**The report was noise; the finding was not, and keeping the two apart is the whole entry.** The
owner pasted three stack traces produced by a single request:

```
Error getting competition: Error: Invalid competition ID format
Error getting leaderboard: Error: Invalid competition ID format
Error loading competition: Error: Failed to get competition
```

`/competitions/[id]` matches **any** single segment under `/competitions/`, so it is handed
whatever a crawler, a stale bookmark or a link built out of an `undefined` asks for. The lobby
fetches the contest and its leaderboard in one `Promise.all`, both threw, and the page's catch
logged its own line on top. **The player already got a clean 404**, so nothing was ever displayed
wrongly there - the cost was three unactionable stack traces per bad URL, which is how a log stops
being read.

**What the chase found is that `getCompetitionById` threw for BOTH kinds of absence** - a
malformed id and a missing document - and its catch re-wrapped both as the single message "Failed
to get competition". Two live consequences:

- **Every caller's `if (!competition)` was unreachable.** Three authors independently wrote one,
 which is the strongest available evidence of what the contract was *meant* to be: `/results`
 and `/trade` redirect to `/competitions`, and `GET /api/competitions/[id]/status` returns a
 careful 404. None could run. So a **deleted** contest - an ordinary thing, from a bookmark or a
 shared link - gave the two pages a server-error boundary, and gave the status route a 500 where
 its own code says 404. That route is **polled**, so the stack trace repeated every few seconds.
- **A deleted contest and a database outage were the same message.** No caller could distinguish
 them, and the lobby turns both into a 404 - telling a player a contest never existed when the
 truth is that the database was unreachable.

**The contract now: `null` means it does not exist, a throw means something failed.** Nothing about
the returned document changed. Six routes refuse a junk id before any read - the four player
routes, the polled status route, and the admin contest view - and each writes exactly **one**
`warn` line naming the route and the value.

**The log line is not decoration.** A bad id in the log is the only way to tell a crawler probing
the site from a link inside the application building a URL out of an `undefined` or a slug. A
silent guard would make an in-app defect invisible, which is the same reasoning as R40's
observation that a route with no guard has no attribution.

**The noise arrived by a second route too, and the fix for that is the more surprising half.**
Both pages' catch re-threw only `NEXT_REDIRECT`. `notFound()` is *also* implemented by throwing,
marked `NEXT_HTTP_ERROR_FALLBACK`, so the new 404 was caught, logged as "Error loading
competition" with a stack trace, and then re-issued by the `notFound()` in the catch - the right
answer, reported as a fault. Widened to the whole **`NEXT_`** family.

**A stale claim was corrected rather than left in place, and the correction is the useful part.**
The shape helper's first comment justified itself by saying `ObjectId.isValid` accepts any
12-character string, so `isValid("competitions")` would be true. **That was true of bson v4 and is
false here** - bson 5 removed 12-length string support from the constructor and synced `isValid` to
match (NODE-4770). The test asserting the disagreement went red, and the answer was that the claim
was wrong rather than the test weak. The code was kept because the surviving reason is better than
the one first given: **the acceptable shape of a URL segment is our decision and `isValid` is a
dependency's**, it has already moved once in the direction of accepting more, and the test now
asserts the two agree **today** - so a future widening is a red test rather than a quietly wider
parser. Second reason, duller and just as real: one spelling shared by two apps and six routes,
where drift would mean one app 404s a URL the other renders, reading as a caching problem rather
than as two different rules.

**Live, and nothing to backfill** - the defect is an unreachable branch, not a stored value. No
money moved and no payout was affected.

Pinned by `__tests__/services/competition-id-guard.test.ts` (20 tests) with
`tools/probe-competition-id-guard.ps1` (**14 probes, all red on exactly the expected test**). One
probe reported a **weak test** rather than a missing guard: the non-string case asserted only
`null` and `undefined`, which a plain `!= null` check also refuses. What `typeof` actually buys is
that **`RegExp.test` coerces** - `String(["<24 hex>"])` is that hex string, so a one-element array
would pass the shape check, reach `findById`, and raise the CastError this change exists to stop.
And one harness lesson worth the line: `$RESULTS` silently aliased the `$results` accumulator,
because **PowerShell variable names are case-insensitive**, which surfaced as a "read as empty"
failure on an unrelated file and read exactly like the probe having destroyed a route.

---

### R50 - The phantom zero that made every entrant a winner - **CLOSED, 7 September 2026**

**R45 shipped on 7 September and was dead the same day.** Its gate is `providerHasResult`, and
the module comment beside it states the distinction the whole fix depends on:

> a stored zero orders last and is eligible, because the player attempted the game; an absent
> score orders last and wins nothing. **A stored value and an absent one are different facts.**

The module was written correctly. **Three other places then made the absent case unreachable**,
and any one of them is sufficient on its own:

| Writer | What it did |
|---|---|
| `buildParticipantSeat` | wrote `score: 0` into every seat at the moment of joining |
| `competition-participant.model.ts` (both copies) | declared the field `required: true, default: 0`, so even a writer that omitted it stored a nought |
| `round-status.service.ts` | `participant.score ?? 0`, which put one on the play screen as well |

So **every entrant held a finite score before they had played at all.** `Number.isFinite(0)` is
true, so every player qualified, and the "No score recorded" disqualification could not fire for
anybody in any contest.

**What it costs, in the owner's own words:** "if the admin sets more winners and we don't have
them then the prize goes to the available winners... each of the 2 gets its percentage and the
3rd is split between the 2 equally." Three ranks at 70/20/10, two players who played, one who
never launched a round. The third rank should be unclaimed and redistributed. Instead the
non-player ranked third on a phantom zero and was paid 10% of the pot. **No error, no log line,
and a prize table that looks deliberate** - which is this codebase's recurring failure shape.

**Why R45's own suite never noticed, and it is the most transferable part.**
`provider-prize-eligibility.test.ts` builds its participants as plain objects and omits `score`
to mean "never played" - **a shape no production writer could produce.** Third instance of *a
fixture that supplies the value under test has tested the consumer, not the producer*, after
trading finalization's `pnl` and the settlement suites that seeded the scores they ranked. The
new twist is worth naming: here the fixture supplied an **absence**, which is harder to spot
than a wrong value, because the assertion reads exactly like the intended behaviour and the
test's own name describes the case correctly.

**Two facts about the harm, and rounding either one is wrong.** **Latent for money:** no
provider contest has settled in production, so no prize has been paid on a phantom zero. **Live
for the screen:** the lobby's hero tile has shown `0` rather than a dash to every player who had
not yet played, directly beneath a comment insisting it must show a dash - the sixth instance of
*an aside in a comment is a claim, not a fact*, and the first where the comment was guarding the
very fact it violated.

**A migration was needed even though the schema is fixed, and a summary would drop this.** A
schema default fixes **future rows only**. Mongoose has already persisted a real `0` into every
seat ever written, so an **open** provider contest seated before the fix would still settle the
old way. Same shape as `canEnterChallenges`, where flipping the default fixed ten writers with
one line and the migration was still not optional.
`tools/games/clear-phantom-participant-scores.ts` is report-only until `--apply` and **has not
been run against any database**; it refuses trading participants, anybody holding a contributing
round, any score that is not exactly zero, settled contests, and seats mislabelled `trading` on
a provider contest - which it reports for a human, because `gameKey` is immutable (R7).

**`ChallengeParticipant` deliberately still defaults `score` to 0**, and that asymmetry is
pinned by its own test so it reads as a decision rather than as drift. Provider challenges do
not exist yet (E8 / X10), nothing reads a challenge participant's score, and the model is
touched by dozens of trading files - so widening its contract inside a commit whose whole claim
is a provider prize fix would buy nothing and put that claim at risk. **The trap it leaves is
real:** the first provider challenge will seat both players with a phantom zero and reproduce
this entry exactly.

Pinned by `__tests__/services/provider-score-presence.test.ts` (12 tests, every one driven
through the real seat builder, schema and `applyResult` rather than through an object literal)
and `__tests__/services/phantom-score-cleanup.test.ts` (11), with
`tools/probe-phantom-score.ps1` - **13 probes, one per writer plus one per migration refusal**,
because a probe for "the fix" would be satisfied while two of the three writers were still
supplying a nought.

**One probe stayed green, and the answer was the fifth cause: a second guard covered it.** The
exact `score: 0` appears twice in the migration - in the read that builds the report, and
re-asserted inside the `updateMany` so a score arriving between the two survives. Widening the
read alone left the suite green, because the write refused the row. The fix was to assert
**`totalClearable`**, the figure an operator reads *before* `--apply`, since a report offering to
clear a scored player is wrong however the write then behaves. The write copy is **recorded as
unprobed with the reason**, on the R42 precedent: widening it alone changes nothing any test can
observe, so a probe for it would be green on a correct file and a broken one alike.

**One fixture lesson from writing the proof.** Two tests first seeded the contest as
`completed`, since that is the state prizes are decided in - and **gate 9 of ingestion refuses a
result for a closed contest**, so no score ever landed and the players tied on nought. Both went
red, for a reason that had nothing to do with the defect. **A test failing for the wrong reason
is worth no more than one passing for the wrong reason**, and only reading the failure told them
apart.

---

### R51 - Five AI routes that answered to nobody - **CLOSED, 8 September 2026**

**Every route under `apps/admin/app/api/ai/` had no authorization of any kind.** Not a weak
check, not the wrong helper - nothing. The admin app has no middleware, so any caller able to
reach the origin could post an arbitrary prompt and have it answered with the platform's own
OpenAI key, and on two of the five have badge and journey configuration rewritten.

| Route | Called by | What an unauthenticated caller could do |
|---|---|---|
| `generate-competition` | the trading contest wizard | spend our OpenAI credit on any prompt |
| `generate-badges` | Badge & XP management | same, plus read the live badge configuration |
| `evaluate-balance` | Badge & XP management | **`action: "fix"` WRITES** - rebalance badge thresholds and journey milestones |
| `gamification-wizard` | Gamification Wizard | **writes** - create and rebalance badges and milestones |
| `generate-journey` | Journey Map editor | read and reshape the journey players progress through |

**Two of those are write routes, and the folder name is what hid it.** `evaluate-balance`'s own
header says "LOCAL ENGINE - no AI calls", which reads as harmless; its `fix` action changes the
reward economy every player is progressing through. **Classify a route by its exported handler
and what that handler does, never by the directory it sits in** - the same mistake in a new
shape as classifying an admin screen by the menu group it is filed under.

**How they were found, which is the transferable part and now the third instance.** Not by
reading routes. Every other route in the admin app has *something*, and that is exactly what
sends a reader straight past the ones that have nothing - the same reason R40's
`finalize-old-competitions` and R47's `sync-referrals` survived. All three surfaced from
**counting exported handlers against guards**, which is a different activity from reading each
file and which also catches the subtler shape: a route whose `POST` is guarded and whose `GET`
is not passes any check that merely asks whether the file mentions a guard.

**Say the exposure in both directions.** It moved no money, paid no prize and altered no wallet.
But it could drain metered spend on our account without limit, and it could change the badge and
milestone thresholds players are working towards - which is player-visible harm that no ledger
records. And **there is no way to know whether any of it was ever called**, because a route with
no guard writes no attribution. Do not let the absence of evidence read as reassurance.
**Nothing was backfilled**: the two write actions leave ordinary badge and milestone documents
behind, indistinguishable from an operator's own edits.

**The section is the one owning the calling screen, never a general "AI" grant.** An operator
trusted to write competition copy is not thereby trusted to rewrite the badge economy. That
forced a real decision: `journey-map` and `gamification-wizard` render screens in `menuGroups`
and **were not section ids at all**, so `hasAccessToSection` - `allowedSections.includes(id)`
for anybody but a super admin - could never return true for them. That failed closed, so it was
an inflexibility rather than a hole. Both were added to `ADMIN_SECTIONS`, **add-only**, because
guarding by an adjacent section would have issued a grant that does not correspond to the
screen - `12` s1.1's "a grant that maps to no screen" pointing the other way. **Nobody's access
changed:** a super admin passed before and passes now, an employee was refused before and is
refused now.

Pinned by `__tests__/admin/ai-route-guards.test.ts` (19 tests) with
`tools/probe-ai-route-guards.ps1` (6 probes, all red on exactly the expected test). **The test
reads the directory rather than naming the five files**, and the sixth probe is the point of it:
it creates a new unguarded route, which a hard-coded list of five would pass on the day it
appears.

**Two lessons from the test, both already paid for elsewhere and both re-earned here.** These
routes now explain their guard at length and **name `guardSection` in prose**, so the test
strips comments first - without it, commenting the call out leaves the file still mentioning the
helper and the probe reports green. And the position assertion is separate from the presence
one: a guard below `await request.json()` still refuses, but the route has already worked for an
unauthenticated caller.

**And one probe reported GREEN for the fourth cause - the mutation was a shape the assertion
could not see.** `guardSection("ai-generation" as never)` does not match a regex expecting the
closing paren after the string, so the loop over the matches ran zero times and passed
vacuously. Fixed on both sides: a bare wrong literal in the probe, and a `length > 0` assertion
in the test, because **an assertion inside a loop over an empty list is green**. Same family as
the slice that found nothing and the `indexOf` that matched an import.

---

### R52 - A build and a static directory that must ship together, with nothing checking they did - **CLOSED, 8 September 2026**

**Two players could not start a game at all, and every layer reported success.** The owner opened
Circuit Sprint, watched "Loading your round…" until it gave up, and saw the stall panel the
platform added the day before. The frame's document had loaded. Nothing had failed.

**The cause is a split deployment, not a bug in any revision.** `games-service/public/play` is
plain files that arrive with a `git pull`. The allowlist in `src/http/play-page.ts` that authorises
them is TypeScript, and only exists once `npm run build` has run. The server was running a
**6 September** build against a **7 September** surface, so `presentation.js` - added by the play-
surface rebuild and imported by both `app.js` and `board.js` - was answered with a JSON 404. An ES
module that 404s takes its importer down with it, so **no script evaluated at all**: the page sat
on its own boot spinner, never posted `ready`, and the platform's twelve-second stall panel was the
only thing in the entire stack that noticed.

**The same stale build explains the two symptoms that looked unrelated**, which is why they are one
entry. Circuit Perfect was still offered by the contest wizard although it was retired that
morning, and Circuit Sprint still advertised "Up to 300s an attempt" against a new ceiling of 3600
- because both facts are read from `provider_game` rows synced from a service that was still
reporting the 6 September catalogue. `listContestableTitles` already filters on
`providerStatus: "active"`, so **there was no defect in the picker**; there was nothing for it to
filter. Rebuild, restart, and re-sync the catalogue and both symptoms go with it.

**Why no test could have caught it, and this is the transferable part.**
`every module the play surface imports is served` walks the real import graph and would catch a
module committed without its allowlist line. It passed all day, because it can only ever test **one
revision**, and the fault is a disagreement **between** revisions. This is the rule this programme
already applies to `check:mirrors`, in a new place: **a green guard proves two copies agree in the
repository, never that the two halves of a running deployment agree with each other.** Only the
deployment can answer that, so it now answers at boot - `auditPlaySurface` compares the directory
against the served set in both directions and prints an error naming the files and the remedy.

**It logs and does not refuse to boot**, following `resolvePlayRoot`'s existing decision in the same
file: creating rounds and, above all, the sweeper delivering results for rounds already in flight
all work without these files. Refusing to start would convert a broken play surface into contests
that cannot settle, which is the worse failure.

**The second finding, found while reading the logs for the first.** The sweeper printed
`failed 1` every tick and nothing else. `attemptDelivery` computes exactly why - `HTTP 401`,
`HTTP 500`, a fetch error's own message - returns it, and the loop incremented a counter and
**dropped it**. A rotated callback secret, a platform that is down and a callback URL routed to
nothing produced the identical line, while the player sat on "Confirming your result" and the
contest could not settle behind them. **Classify a failure; never merely count it** - already a rule
here from the concurrency tests, and this is its cost in production. The reason and whether it will
be retried are now logged per round.

**CORRECTION, later on 8 September 2026: the boot audit above was not the fix, and this entry
said it was.** The owner rebuilt nothing, reopened the game, and it failed identically -
`/play/presentation.js` 404, no `ready`, the twelve-second stall panel. The audit detects this
drift and names the file, and **it could never have fired, because it lives in the build it exists
to warn about.** A guard shipped inside the artifact whose staleness it reports is absent in
precisely the state it was written for. That is the same class as a comment asserting a check that
does not run - except the code is real, correct, tested, probed, and unreachable.

**So the coupling was removed rather than monitored.** `readServableAssets` derives the served set
from the directory listing at boot, so a module arriving with a `git pull` is servable with no
build at all: **two things must ship together for a filename list, and one thing cannot disagree
with itself.** The security properties the old allowlist bought are unchanged and are the reason
`express.static` is still refused here - the request string is only ever a `Map` key, never a path
component, so traversal is impossible however it is encoded; top-level regular files only; and an
**extension** allowlist rather than a filename one, which is now the whole of the remaining
protection and the only way a file can still be present and unreachable. That is what the boot
audit reports now, and its other half (`missing`) is **structurally impossible and kept as a
tripwire**, documented as such, because it becomes reachable the moment anybody reintroduces a
hand-written list.

**The general rule, which is worth more than the incident:** when a guard's own correctness depends
on the deployment step it is warning you about, it is not a guard. **Prefer deleting the coupling
to detecting it** - and when you cannot, put the detector somewhere that ships on the *other*
schedule from the thing it checks.

4 new tests (213 in `games-service`, up from 209) and `tools/probe-play-assets.ps1`, 6 probes, all
red on exactly the expected test. **Probe 4 came back green and taught the third cause again**: the
explicit `index.html` skip is real and **unreachable**, because `.html` was never in the
content-type table, so the document was already refused a line later. The skip is kept as a
tripwire with the reason in the file, the probe was re-aimed at adding `.html` to the table - the
realistic change, since a rules page is how it would arrive - and the test gained a second
assertion pinning **where the guarantee actually lives**. A test asserting only the observable
behaviour would have credited the name check with a guarantee it does not provide.

**The owner must still rebuild once.** This change cannot fix the build that is running, because
the change is in the build. Say that plainly rather than letting "fixed" imply the server is well.

**One operational fault is the owner's to clear and no code can fix it:** the logs show
`4|chartvolt-games` and `5|chartvolt-games`, two processes, while `ecosystem.config.js` declares
`instances: 1, exec_mode: 'fork'` and its comment says exactly why - "the callback sweeper is a
singleton, and two copies would race to deliver the same result and double the provider's retry
traffic". That is visible in the logs as one instance reporting `delivered 1` while the other
reports `failed 1` on the same tick interval. `pm2 delete` the duplicate.

**Live, player-visible, and nothing to backfill.** No money moved, no prize was paid and no stored
value is wrong - the defect is an absent file on one side of an HTTP request. The rounds it consumed
are real, though: an attempt is spent when a round is **created**, so a player whose game never
booted has still used it, and those rounds settle under the contest's `unresolvedRoundPolicy` like
any other.

Pinned by five tests in `games-service/tools/test-play.ts` and
`tools/probe-deploy-drift.ps1` (7 probes, all red on exactly the expected test, blast radius one or
two). **A probe is what exposed the guard's own design flaw:** `auditPlaySurface` first read
`ASSETS` from module scope while taking the file list as a parameter, so removing one allowlist
entry turned **five** tests red and none of them could say which rule had broken. **A pure function
with one input injected and one read from module scope is only half pure, and the blast radius of a
probe is what reveals it.** Both inputs are now parameters and the three unit tests pass their own
served list.

**Third amendment, same day: the game now says why it did not start.** The owner reported the
spinner a third time, and the report is the finding - **two fixes had addressed the cause and
neither had made the fault audible**, so the only witness was a browser console the owner had to
read and forward, and every conversation about it became an argument about which machine was
stale. Removing the coupling fixes the cause we found; it cannot promise that every layer between
a player's browser and the service - a proxy, a CDN, a cache holding a 404 from before a fix -
hands the file over. A **classic script in front of the module graph** now watches for a boot that
never happens, names the failing file, and - the load-bearing part - sends `ready`, so the panel
is not painted underneath the platform's opaque overlay where nobody can read it or reach the
Leave button. It fires at 8 seconds, inside the platform's own 12-second timeout, or the platform
speaks first and the whole thing is dead code that still reads correctly. Design and the
verification in `21` s4.1j; **216 tests**, `probe-boot-watchdog.ps1`, 8 probes.

**And the defect inside that fix was found by looking at it, not by testing it.** The first
version named the file from the `error` event's target and said **`app.js`** while the file that
404'd was `presentation.js` - the event fires on the `<script>` that *started* the graph, and a
nested module has no element of its own. **Naming the wrong file is worse than naming none**,
because it points whoever investigates at correct code. The name now comes from
`performance.getEntriesByType("resource")` filtered to `responseStatus >= 400`.

### R53 - The fairness gate that three comments claimed and nothing performed - **CLOSED, 8 September 2026**

**`supportsContentSeed` decided nothing.** It is the flag that says a provider will give every
player in one contest identical content, and `01` s4.3 calls it *"the most important single field
in the specification"* - without it, two players are ranked against each other having faced
challenges of unknown relative difficulty, and **it is also what preserves the skill-not-chance
position** the regulatory defence pack rests on. It was declared on both `provider_game` copies,
**validated on ingest** by the ChartVolt Games adapter, copied by the catalogue sync, carried in
the admin DTO and rendered as a badge - and read by no gate, in either app.

**Three separate comments in three files asserted that it gated paid entry:**
`provider-game.model.ts` (*"required for competitions … the contest is not a fair comparison"*),
`chartvolt-games.adapter.ts` (*"`supportsContentSeed` decides whether a title may take entry
fees"*) and `games-service/src/http/catalogue.ts`. **This is the fifth instance of a comment
asserting a check that does not run**, after Prerequisite A, the internal-secret fallbacks, the
unprotected suspicion-score route and `requireAdminAuth` - and the first where the claim was
repeated in three places, which is worth noticing on its own: **agreement between comments is not
corroboration, because the second and third were written by reading the first.**

**What hid it is that its two siblings are enforced properly.** `supportsCompetition` is refused
by the pre-flight *and* disables the option in the wizard with the reason named - the pattern this
programme keeps arriving at. Reading that code leaves a reader confident the capability flags are
handled, because two of the three are. **A partially-implemented pattern is more dangerous than an
absent one**, since the absent one prompts the question.

**Latent, and nothing to backfill.** Every title that exists declares it `true` - both
`chartvolt-games` titles and both mock titles - so no unfair contest has run. It is precisely the
flag a real provider will set `false` on some titles at **X4**, and the failure then is a paid
competition in which every player faces different content, ranked, settled and paid, with nothing
in any log.

**Closed by one unconditional check in both mirrored copies of `contest-preflight.ts`**, the field
made **required** on `PreflightInput.title` so a caller cannot omit it and fail open again, both
writers updated (`preflightProviderContest`, shared by create and edit, and the publish service -
**counted with `rg` before changing anything**, per the rule that has now caught this seven times),
and the wizard's first step disables the title with the missing capability named. **Deliberately
not scoped to `competition`**, although that is the word both the spec and the model comment use: a
challenge ranks two players against each other for money on exactly the same basis, so the
reasoning does not narrow to the many-player case. The challenge half is a **tripwire** today,
since provider challenges are E8 and unbuilt.

Four tests in `__tests__/services/provider-contest-create.test.ts`, four probes red on exactly the
expected test. **The second test exists because of a trap the first cannot catch:** all three
format refusals live in one block, so a fixture lacking the seed *and* lacking a format capability
is refused either way - the test pins that a title supporting **both** formats and lacking only the
seed is still refused, and refused *for the seed*. Same shape as the `gameKey` allow-list probe in
`12` s2.2, where a probe stayed green because a second refusal covered for the one being tested.

**And the change immediately proved its own worth on a fixture**, which is the part to carry
forward: three tests in `provider-contest-edit.test.ts` went red because its seeded title omitted
the field, so the model's `default: false` refused the edit. The fixture's own comment, six lines
above, warns about exactly this class. **A gate added to a path with existing tests will fail them,
and that failure is the gate working** - the thing to check is that the fixture was wrong, not the
gate.

### R54 - An edge that rewrites `Cache-Control` turns a ten-minute fault into a four-hour outage - **PARTLY CLOSED, 8 September 2026**

**The fault this describes had already been fixed twice, and players stayed broken anyway.**
R52's missing `presentation.js` was corrected on the server within minutes. Hours later the owner
was still looking at a dead game, holding a `curl` that returned **200** from both machines while
the page named `presentation.js` as the file it could not load. Both observations were true.

**Measured from the player's browser, which is the step that resolved it:** every response from
`https://chartvolt.com/play/*` arrives carrying **`Cache-Control: max-age=14400`** - four hours -
and that is true of the **404s as well as the 200s**. The service sends `no-cache` on a served
asset and `no-store` on a refused one; neither survives. The value is exactly Cloudflare's default
Browser Cache TTL, `server: cloudflare` is on every response, and `deploy/nginx.conf` contains no
such number anywhere, which is how the layer was identified rather than guessed at.

**So a transient deployment fault becomes a durable one, silently, and it targets precisely the
players who tried during it.** Anyone who loaded the game while the file was missing holds that
refusal for four hours and **never asks again**, so no deploy can reach them. Every check
available to us reported success - files on disk, service serving them, `curl` 200, full suite
green - and the only witness that disagreed was the person who could not play. The debugging
instinct it defeats is the important part: **the more recently someone tried and failed, the
longer they remain broken**, which reads as the fix not working.

**Half of it is closed in code, because that half can be detected.** The boot watchdog now
re-fetches the URLs the resource timeline recorded as failing with `cache: "reload"` - which
replaces the browser's stored copy rather than merely reading round it - and reloads once if they
all succeed, guarded by a `sessionStorage` flag so a genuinely missing file cannot produce a
reload loop. `21` s4.1k. Verified by eye against a server that refuses the file once and then
serves it.

**The other half cannot be, and is an owner action.** The **200s** carry the same four-hour
lifetime, so a corrected play surface does not reach a player who loaded the game earlier that
afternoon - and a stale *success* has nothing to detect, because it looks completely healthy. The
remedy is a Cloudflare cache rule for `/play*` set to respect origin headers, recorded in
`deploy/README.md`. **Until that is done, a play-surface fix should be assumed not to reach
anybody who played in the previous four hours.**

**The rule that generalises past this platform:** an intermediary that replaces cache headers
makes every short-lived server fault long-lived, and a service cannot defend itself from it with
headers - only by acting from inside the page that was poisoned.

**And it produced a second, worse defect within the hour, from the same asymmetry.** The document
is never cached - its URL carries a single-use token - while `app.js` is. So a player who had
loaded the game earlier got **today's markup around a four-hour-old `app.js`**, which works but
predates `window.__circuitLoaded`; the watchdog saw an unset flag and **wiped a live board
mid-round**. Fixed with a second witness that does not depend on the module: the game hides
`#screen-loading` as soon as it renders, so a painted screen is proof of life whatever build
produced it, and the deadline returns early if either witness says the game is running. `21`
s4.1l. **The lesson is the transferable part - an absent signal is evidence only if the thing
that would have sent it was definitely present** - and note the arrangement that caused it: a
**fresh guard in front of a stale subject**, which no earlier version-skew lesson here covered.

**R54's remaining half is now closed by R55 below, and not by the Cloudflare rule.** The stale
*success* was never going to be detectable, so the answer was to stop it from being addressable:
the assets are served under a fingerprint of their own contents, and a new build publishes URLs
that no browser has ever cached. **The Cloudflare rule is no longer needed for `/play*`**, and the
`deploy/README.md` note recording it as an owner action is stale as a present fact though correct
as history. Anything else the edge caches is untouched by this.

---

### R55 - Half a build from the cache and half from the server - **CLOSED, 8 September 2026**

**The third distinct cause of one reported symptom, and the first that was neither a missing file
nor a stale detector.** The owner reported the game dead again. The console said:

```
board.js:23 Uncaught SyntaxError: The requested module './presentation.js'
            does not provide an export named 'newlyJoined'
```

Nothing was missing. **Nothing 404ed** - every response was a 200. The browser was holding a
four-hour-old `presentation.js` from R54's cache lifetime and running that morning's `board.js`
against it, and `newlyJoined` had been added to the newer file only hours earlier. A build split
down the middle, half from the cache and half from the server, with both halves individually
correct.

**This is exactly the half R54 recorded as undetectable**, and it defeated the recovery built for
it: `21` s4.1k re-fetches the URLs the resource timeline recorded as **failing**, and there were
none. A stale success has nothing to report.

**The fix is that a stale copy is no longer ADDRESSABLE.** Each asset is served under a segment
that is a fingerprint of the whole surface's contents - `/play/v-0f44604e3af5/app.js` - so a new
build publishes URLs no browser has cached, and the four-hour-old copy sits at an address nothing
asks for any more. It also means `immutable` can be sent honestly, so the surface is fetched once
and never revalidated again mid-contest.

**Three things about it are load-bearing and would each get "simplified" away.**

- **A path segment, never a query string.** `?v=<hash>` is the familiar spelling and it versions
  only the two files the *document* names. `board.js` reaches `presentation.js` through a literal
  `import ... from "./presentation.js"`, with nowhere to put a query string and no way to know the
  hash - **so the one file a query string leaves bare is precisely the file that broke.** A
  segment is inherited by ordinary URL resolution and needs no cooperation from any module.
- **The fingerprint is of the content, not the file dates.** A `git pull` gives identical bytes
  different timestamps on each server, so an mtime version would have two servers publish
  different URLs for the same files - and behind a balancer that alternates, a player re-downloads
  the surface almost every request.
- **A well-formed but unrecognised fingerprint is SERVED, not refused.** Refusing looks tighter
  and manufactures 404s during a rolling deploy and for anyone mid-round on the previous document
  - and R54's own finding is that **the edge caches a 404 for four hours exactly as it caches a
  200**, with the page's recovery holding only one attempt. The segment is a cache key, not a claim
  about which build you are entitled to.

**Latent for money and live for players.** No contest settled wrongly - a round that will not
start consumes an attempt on **creation**, so the burned attempts are real, and they were burned
by R52 and R54 as much as by this. **Nothing was backfilled.**

**The route shape invited an outage of its own, and the probe is what proved it.**
`/play/:version/:asset` has the same shape as `GET /play/api/state`, which the board polls
throughout a round, so the handler hands anything that is not a fingerprint back to the next route
rather than refusing it. Probe 12 in `games-service/tools/probe-play-assets.ps1` removes that
recognition and turns **five** tests red, three of them unrelated round-state tests - written
expecting two. That is the clearest evidence available that the fall-through is a requirement and
not defensiveness.

**One rebuild is required, and after it this class is self-maintaining.** The mechanism is
TypeScript, so the owner must `npm run build` once. From then on the fingerprint is derived at boot
from the directory, exactly as the served set has been since `21` s4.1i, so a play-surface change
still needs only **pull and restart**.

---

### R58 - One number imported across the server/client boundary took the admin panel off the air - **CLOSED, 9 September 2026**

`apps/admin/components/admin/games/GameScoringDialog.tsx` is a `"use client"` component. It
needed one constant - the maximum length of a score's unit label - and imported it from the
service that validates the same field:

```ts
import { SCORE_UNIT_MAX_LENGTH } from "@/lib/services/game-providers/game-scoring-rules.service";
```

That service's first import is `@/database/mongoose`, whose own first import is
`MongoClient` from `mongodb`. Turbopack followed the chain and traced **the entire MongoDB
driver into the Client Component Browser bundle**, where `fs`, `net`, `tls`, `dns`,
`fs/promises`, `timers/promises` and `child_process` do not exist. `next build` failed with
17 unresolvable-builtin errors, so `apps/admin` had no `.next` directory, so `next start`
refused with `Could not find a production build`, so PM2 restarted it - **283 times**.

**The harm here is of a kind nothing else in this register has: the application did not
exist.** Every other entry describes software that ran and was wrong - a wrong payout, a
wrong label, an open door. This one produced no artifact at all. No money moved, no stored
value is incorrect and there is **nothing to backfill**; a build either emits a bundle or it
does not. The main app was unaffected and stayed up throughout.

**Two things about how it presented are worth keeping, because both point away from the
cause.** The deploy script reported the build failure and then went on to restart the
processes regardless, so the last hundred lines of output - the part anybody reads - were a
boot loop, and the seventeen errors that caused it had scrolled away. And the errors
themselves all name files inside `node_modules/mongodb` and `node_modules/socks`, which reads
as a dependency problem. The single useful line is the bottom of each import trace, which
names the client component; everything above it is the driver's own internals.

#### Why nothing caught it, and two guards look as though they should have

`check:mirrors` compares models between the apps and has no opinion about who imports them.
The ESLint import boundary from X1 invariant 2 bans model imports from `lib/games/*`, which is
the game layer and not the component tree.

**But the important one is the typecheck, which is structurally blind to this entire class.**
The import is valid TypeScript: the value exists, its type is `number`, and both apps'
`tsc --noEmit` were clean. Nothing about a module's *fitness for a browser bundle* is
expressible in the type system. Nor did the dev server complain - it compiles per route on
demand and had no reason to build the dashboard's client bundle. **This class is only ever
caught by a full production build, which is to say by deploying**, which is exactly what
happened.

#### The fix keeps one definition of the constant

`SCORE_UNIT_MAX_LENGTH` moved to `apps/admin/lib/admin/score-eligibility-copy.ts`, which is
model-free and reaches no driver, and the service imports it back from there. The dialog and
the validator still agree by construction rather than by coincidence - the alternative, a
second literal in the component, is the "one rule, two copies" shape behind `referenceId`,
`failedReason`, `challengeId` and the Game Master `||`, and here the drift would let the form
accept a unit the server then refuses.

One detail that cost a test run: the service imports it by a **relative** path, not `@/`.
Vitest aliases `@` to the repository root rather than the admin root, so the aliased form
resolves in `next build` and fails in the test suite. Same trap as the `Model.base` note in
the rules file, from the opposite direction.

#### The guard, and what extending it to the main app found

`__tests__/admin/client-bundle-model-imports.test.ts` walks the **value**-import graph
outward from every `"use client"` file in **both** apps and fails if it reaches `mongodb`.
Five rules make it work, and each was necessary:

- **The walk stops at `"use server"`.** Next replaces such a module with an RPC stub, so
  nothing beyond it enters the client bundle. `CompetitionCreatorForm.tsx` imports a server
  action that reaches the driver two links later and is entirely correct. Without the
  exemption the guard fires on the framework's own pattern.
- **`import type` is erased and therefore safe**, so it is value imports that matter.
- **Strip comments first** - every module involved in this fix names the driver in prose to
  explain the hazard, and a test that reads prose fails in both directions.
- **Read the directory, never a list of files.** The component added next month is the whole
  point, and a hard-coded list is green on the day it appears.
- **Judge a module by its transitive imports, never by its name or folder.**
  `lib/services/games/play-shape.ts` is a service by name and model-free by construction;
  `game-scoring-rules.service.ts` sits beside it and is not. Both are imported by client
  components today and only one was ever a defect.

**Extending it to the main app is what turned this from a fixed bug into a finding.**
`components/trading/MarketStatusBanner.tsx` imported `MarketStatus` and `MarketHoliday` from
`real-forex-prices.service`, which reaches the driver three links on. **The main app built.**
It built because both bindings are `interface` exports used only in type positions, so the
bundler dropped the import and never entered the graph.

That reads like a false positive and is not one. **The safety was the bundler's unused-import
elision, not anything anyone had decided.** Promote either interface to a class, or import one
more binding from that module, and the *player* app fails exactly as admin did - with no
warning from any tool. So the rule is deliberately checkable without type analysis: **a client
component may not name a driver-reaching module in a value-import position.** The remedy is
one keyword, `verbatimModuleSyntax` would demand it anyway, and it turns an accident into a
statement. The alternative - resolving each binding to decide whether it is type-only - means
following re-exports and `export *` through the whole graph, and a guard that elaborate is one
nobody trusts.

#### The line the guard draws, and why it is narrower than "no models"

The first draft forbade reaching a Mongoose **model** and flagged five files that build
perfectly well. The real distinction is between two packages that read as one thing:

- **`mongoose` has a browser build**, and a bundler resolves it. This is why
  `SymbolsSection.tsx`, `CompanyDetailsSection.tsx` and `InvoiceTemplateSection.tsx` can
  value-import `DEFAULT_FOREX_PAIRS`, `EU_COUNTRIES` and `COUNTRY_NAMES` out of model files
  and always have.
- **`mongodb`, the driver underneath it, does not.** It reaches for Node builtins at module
  scope.

A model import is therefore *fragile* rather than broken - it breaks on the day somebody adds
a driver import to that model - and the guard deliberately does not forbid it. **Forbidding
what actually fails is what keeps a guard believed**; a guard that fires on correct code is
one the first person it inconveniences deletes, which is the same reasoning that narrowed the
`GameIcon` ban in `13` s4.1g.

Probed by `tools/probe-client-bundle-guard.ps1`: two probes, one restoring the admin defect
verbatim and one reverting the main app's `import type` to a plain import, each red on exactly
the expected test.

---

### R60 - A list the browser drew, in the theme's colours but not its background - **CLOSED 9 September 2026**

The owner reported the Genre drop-down on the game content dialog opening as a tall, almost
empty panel with a single word in it. **Nothing was missing.** All fifteen options were in the
list, correctly generated from `GAME_CATEGORIES`, and every one of them was rendering white on
white.

A browser paints a native `<select>`'s drop-down list **itself**. It takes the list background
from the element's own `background-color` and lets the options inherit `color`. This screen's
fields are themed `bg-white/5 text-white` - and `bg-white/5` is `rgba(255,255,255,0.05)`, a
*translucent* white, which composites over the browser's light list surface to something
indistinguishable from white. So the options were white text on a white panel. The one row that
was legible was the highlighted one, readable only because the operating system paints its own
selection band behind it.

**Two conditions are needed: a native `<select>` AND a translucent background.** The games admin
surface has **eleven** pickers on the shared `Select` primitive - which draws its own list in a
portal and never asks the browser for one - and this was the **twelfth and only native one left**
there. The **33 remaining native selects in the admin app and 11 in the player app** sit on an
opaque `bg-gray-*` or set no background at all, which the browser is perfectly happy to paint a
list with, and most set no `color` either, so they carry two independent protections.

That is why the guard bans **the combination and not the element**. Banning `<select>` outright
would fire on forty-odd files that work correctly and be deleted by the first person it
inconvenienced - the reasoning that narrowed the `GameIcon` ban in `13` s4.1g. Banning the
combination fires on nothing that works.

#### There were TWO instances, and the second one is not fixed

**Counting them is what corrected this entry.** It was first written claiming the genre picker
was the only place in either app with both conditions. It was not: the **"Transfer to" employee
picker in `MessagingSection.tsx:2110`** carries `bg-white/5 text-white` on a native select whose
options are employee names, so **every name in it is white on white too**. Found by grepping for
the *condition* after the fix, not before - the seventh instance of the counting rule, after four
entry paths, ten finalize sites, six raw inserts, seven lifecycle routes, seven writers of the
referral rate and two creation routes.

**It is deliberately not fixed, and the reason is mechanical rather than a judgement about
priority.** The fix is one token - `bg-white/5` to `bg-gray-800` - but that file carries about
thirty pre-existing lint warnings and this repository's pre-commit hook lints staged files at
`--max-warnings=0`. Touching it therefore requires an unrelated cleanup of a 2,180-line messaging
component in the same commit, which cannot be verified by eye from here and has nothing to do
with a drop-down. It is recorded as a **named exception inside the guard**, with a test asserting
**the exception is still an offender**, so the entry has to be deleted for the suite to stay
green once somebody does fix it. A stale exception is worse than none: it reads as a known
problem long after it was solved, and silently re-permits the defect in that file.

#### Severity, stated in both directions

**Low, and live.** It is an operator-facing legibility fault on two controls: no money moved, no
document is wrong, nothing was stored incorrectly, and **nothing was backfilled** because there
is nothing to backfill. But it made the genre unsettable in practice - an operator could only
land on a value by arrowing blindly through an invisible list - so `category` is the field most
likely to be stale on any title touched before today, and that field is the grouping key tasks
21-24 will join on.

#### The one non-obvious thing the fix had to solve

Radix reserves `""` for "nothing is selected" and **throws** on a `SelectItem` carrying it, so
`<option value="">No genre</option>` could not be ported across as it stood. "No genre" travels
as a sentinel and is mapped back to `""` at the boundary, so stored state is unchanged: absent is
still absent.

**The sentinel's spelling is load-bearing, not cosmetic.** `normaliseCategorySlug` strips every
run of non-alphanumeric characters, so `__no_genre__` is a value no operator can produce by
typing. A sentinel of `none` or `custom` is a genre somebody can legitimately type, and they
would then find their own word clearing the field or opening the custom box. The test asserts
this **behaviourally** - it reads the literals out of the file and feeds them to the real
normaliser - rather than asserting the spelling, which is what fails if anybody tidies the
underscores away.

Same sentinel shape as `GamePlayStyleControl`'s `__follow_provider__`.

#### Guard

`__tests__/admin/game-categories.test.ts`, four tests: the dialog uses the primitive and no
native `<select>`; **no other file on the surface has one either, read from the directory** rather
than from a list of filenames, so it is not green on the day a thirteenth picker appears; the
options are generated from the vocabulary rather than typed out, asserted by the **absence of
every one of the thirteen slugs as a literal**; and the sentinels are non-empty and outside the
slug namespace.

`__tests__/admin/native-select-legibility.test.ts`, eight tests, is the platform-wide half.
**The load-bearing part of it is a brace-aware scanner, and the first version was wrong in the
silent direction.** Written as `<select\b[^>]*>` it stops at the `>` inside
`onChange={(e) => ...}`, which every real call site has - so the captured tag ends before
`className`, no file can ever match, and **every assertion was green while the tree was
unexamined**. What caught it was the exception-still-offends test reporting the *known* offender
as clean. Two rules from that: **a rule that scans for a combination needs a fixture proving it
reaches the second half**, and **a deliberately-listed exception doubles as a canary for the scan
itself.**

`tools/probe-genre-picker.ps1`, **9 probes**, all red on exactly the expected test with a blast
radius of one. Three cover the platform-wide rule, including one that reverts the scanner to its
broken form and one that delists the known offender so the scan has to find it unaided.

**Never verified by eye** - the screen is behind an admin sign-in the automated browser has no
session for. The mechanism is proven, the pixels are not.

---

### R59 - A width class that is present, correct-looking and inert - **CLOSED for the games surface, 9 September 2026**

The owner reported the game catalogue dialog as too narrow: seven columns of controls clipped
at the fourth, the Prize eligibility heading cut to "PR". The dialog asks for room in the
obvious way, and had since it was written:

```tsx
<DialogContent className="max-h-[85vh] max-w-4xl overflow-y-auto">
```

`max-w-4xl` is 56rem. The dialog was rendering at **32rem**, and so was every other dialog in
the admin app that asked for width the same way. Two things have to line up for that, and both
do:

1. `DialogContent`'s own class list ends with **`sm:max-w-lg`**. `cn()` is `twMerge`, which
   keys a conflict on the utility group **and the modifier together** - so a bare `max-w-4xl`
   does not conflict with a `sm:`-prefixed cap, and **both reach the DOM**.
2. Tailwind emits `.sm\:max-w-lg` **after** `.max-w-4xl` in the stylesheet, at equal
   specificity. The cap wins at every width from 640px up.

Measured rather than reasoned about: compiling the two candidates with this app's own Tailwind
4.1.18 puts `.max-w-4xl` at byte 4541 and `.sm\:max-w-lg` at 4749, and `twMerge` on the real
base string returns `w-full sm:max-w-lg max-w-4xl`. **Both halves of the trap are observable
in about ten lines of Node**, which is worth doing before believing any explanation of a CSS
width, because the intuition - "the later class in `className` wins" - is wrong twice over.

**This is the codebase's most familiar failure mode in a new place: the control appears to
work and does nothing.** The class is present, the diff reads correctly, review passes, and
the author's stated intent is silently discarded. Same shape as enabling a provider with no
adapter, a `rankingMethod` a provider game ignores, `isPaused` on a provider contest, and
`playModeOverride` written to a provider-owned field.

#### The scope is platform-wide, and the arithmetic is the useful part

Across both apps, **55 `DialogContent`s carry an unprefixed `max-w-*` that has no effect**:

| What the author asked for | Count | What renders | Visible? |
|---|---|---|---|
| Wider than 32rem (`2xl`-`6xl`) | **31** | 32rem | **Yes - clipped content** |
| Narrower (`md`, 28rem) | 6 | 32rem | Mildly - too roomy |
| `lg`, which is what the cap already says | 16 | 32rem | No - accidentally correct |

Two more use `!max-w-none`, and the `!` is what makes those two work.

**16 of the 55 being accidentally correct is why this survived**: the pattern demonstrably
"works" on a third of its uses, so the first person to hit a clipped dialog has no reason to
suspect the mechanism rather than their own value. **Two of the 31 are in the PLAYER app** -
`components/trading/IndicatorSelector.tsx` and `components/profile/TradingArsenalSection.tsx` -
so this is not an admin-only defect.

#### The main app already had the answer, which is the finding worth carrying

`components/ui/dialog.tsx` in the main app grew a `size` prop - `sm | default | lg | xl | full`
- whose variants are **all `sm:`-prefixed**, which is exactly the mechanism that works. The
admin app's copy of the primitive never got it. So the platform's two clipped player dialogs
are not a missing capability, they are two call sites passing `className="max-w-4xl"` instead
of `size="xl"`, and the correct sweep for the remaining 29 admin dialogs is probably **to port
that prop** rather than to sprinkle a token across 24 files. **Before designing a mechanism a
screen needs, check whether the sibling app already has one** - the same rule that found the
deep-link and RBAC mechanisms already present in `12` s1.1.

#### What was fixed, and what was deliberately not

`apps/admin/lib/admin/dialog-widths.ts` holds three tokens - `DIALOG_WIDTH_WIDE` (90rem, data
tables), `_MEDIUM` (56rem, forms) and `_STANDARD` (32rem, short forms) - and all five game
dialogs take their width from it. The catalogue's table gains `min-w-[68rem]` inside an
`overflow-x-auto` wrapper, because seven columns of controls do not fit a small laptop at any
dialog width and a squeezed select is worse than a scrollbar.

**The other 29 admin dialogs were not swept, and that is recorded rather than quietly scoped.**
Each is a screen getting visibly wider, none can be verified by eye from here, and doing it in
the same commit as the reported fix destroys the only evidence the reported fix is safe - the
same reasoning that kept the Game Master `||` verbatim while settlement was extracted. It is
an owner decision, and the honest framing is that 29 admin dialogs are currently showing less
than their authors wrote.

#### The guard is behavioural, because the string is not the property

`__tests__/admin/dialog-widths.test.ts` (7 tests) runs the **real** `twMerge` against the base
class list **read out of `dialog.tsx`**, and asserts each token displaces `sm:max-w-lg`. Three
things about it are load-bearing:

- **The control test is what gives the others meaning.** It asserts that an unprefixed
  `max-w-4xl` *still* leaves the cap in place. Without it, a future version of `twMerge` that
  stopped conflicting at all would leave every assertion passing while nothing was measured.
- **The base string is read from the primitive, never restated.** A second copy is a test that
  keeps passing after the thing it describes has moved.
- **The token is asserted INSIDE the `DialogContent` opening**, not anywhere in the file. A
  file-wide match is satisfied by the import line, so a second dialog added later with no
  width at all would pass while inheriting the cap.

Probed by `tools/probe-dialog-widths.ps1`: **7 probes, each red on exactly the expected test
with exactly 1 failure.** The sixth mutates the **primitive** rather than the tokens, which is
what proves the control reads `dialog.tsx` instead of carrying its own copy of the cap.

**Never verified by eye** - the screen is behind an admin sign-in the automated browser has no
session for, so the width is proven by the merge and not by a screenshot.

---

### R57 - The Image Optimizer's route was unauthenticated, and it deletes files - **CLOSED, 8 September 2026**

`apps/admin/app/api/dev-zone/optimize-images/route.ts` exported two handlers and neither had any
authorization whatsoever. Not a weak guard, not the wrong guard - **nothing**. No session check,
no admin check, no section check.

The `GET` enumerated every upload directory on the server and returned the hundred largest files
with their paths and sizes. The `POST` re-encoded them in place with `sharp` and then:

```
await unlink(img.fullPath);
```

deleted the original. Across `public/uploads/marketplace`, `public/assets/avatars`,
`public/uploads/cosmetics`, `.../indicators`, `.../strategies`, `.../gamemaster` and
`public/uploads` itself. An image whose only copy was on that disk is gone.

**Why it was invisible, and this is the part that generalises: the guard was on the thing a
reviewer can see.** The Image Optimizer *screen* is properly gated - `image-optimizer` is a real
entry in `ADMIN_SECTIONS`, and `filteredMenuGroups` removes the tab from anybody without the
grant. So the feature reads as protected from every direction a person naturally looks. The route
behind it answered anyone who could address the admin app.

**It was not found by reading routes.** It was found by counting exported handlers against
guards - the same method that found R40's `finalize-old-competitions` and R47's `sync-referrals`,
and for the same reason: every neighbouring route in the admin app has *something*, and that is
exactly what carries a reader past the one that has nothing. `dev-zone`'s other route,
`dependency-check`, authenticates all three of its handlers, which is precisely the camouflage.

This is the **ninth** route of this class, after Prerequisite A, the internal-secret fallbacks,
the unprotected suspicion-score route, the provider admin routes, R40, R47, R51's five AI routes,
and the two `verifyAdminToken` cases. Carry the class rather than the instances.

**State the exposure in both directions.** It could pay nobody and move no money. It could hand
an anonymous caller the layout of the upload tree, and it could destroy or silently re-encode
every uploaded image on the platform. **There is no way to know whether it was ever called** -
a route with no guard has no attribution - and **nothing was backfilled**, because a converted
file is indistinguishable from an operator having optimised it on purpose.

#### The fix, and the four things about it worth keeping

`guardSection("image-optimizer")` on both handlers, positioned before the body is parsed and
before anything is written or deleted.

- **The section id is the one that reveals the screen**, never an adjacent real one.
  `guardSection` is typed to `AdminSection`, so the compiler refuses an invented id - but it
  accepts a *valid wrong* one, which compiles, reviews as plausible, and demands a grant that
  has nothing to do with this screen. A probe naming `database` proves the assertion catches it.
- **The folder-wide assertion is the WEAK one, deliberately.** `__tests__/admin/image-optimizer-route-guard.test.ts`
  asserts that every handler under `dev-zone` authenticates *somehow*, and asserts
  `guardSection` specifically on this route. The strong property is false for the folder today:
  `dependency-check` uses `verifyAdminAuth`, which is admin-at-all rather than section access,
  and converting it means choosing a section id and deciding which existing employees keep the
  screen - an owner decision, not a mechanical fix. It is recorded as a **tripwire that fails
  when somebody fixes it**, rather than permitted by a per-file allow-list, because an
  allow-list is green on the day a tenth route appears. What the weak form still buys is the
  thing that matters: a route added to that folder with no authorization at all turns it red.
- **A guard whose refusal is discarded reads perfectly and authorizes nothing**, so the
  refusals are **counted** against the guard calls. The first version of that assertion was a
  whole-file `toMatch`, and a probe deleting the POST's refusal came back **green** - satisfied
  by the GET's surviving copy. Fifth instance of one identifier defeating a structural test,
  after `!expectedOrigin`, the fixed-character Edit guard, `canTransitionRound` and
  `MIN_REASON_LENGTH`.
- **The comment stripper is not decoration.** This route now explains at length why the guard is
  there and names `guardSection` in prose, so a test that reads prose would pass a file whose
  only mention of the guard is the paragraph describing it. Probe 8 comments out both calls and
  must still go red.

The shared machinery - the stripper, the directory walk and the two patterns - was **extracted**
into `__tests__/helpers/route-guard-audit.ts` and the R51 suite rewired onto it, rather than
copied. Each of those rules was learned from a probe that came back green, and two suites
restating them means which folders are genuinely protected depends on which file a reader opens.

**A note on the sibling finding that is NOT closed.** The optimizer is also the wrong tool for
game artwork, and Tasks 15/16 of the owner's task document must not simply point it at another
directory: it converts in place, renames to `.webp` and deletes the source, while game artwork
filenames are stored in `provider_game.thumbnailUrl` / `bannerUrl` and duplicated into
`branding_asset` (R56). Pointing it at `public/assets/images` would leave both the database row
and the Mongo copy referring to a file that no longer exists - a broken image on every game
screen, with no error anywhere. It also cannot work by filesystem scan in the multi-server case
at all, because a logo that reached only one server's disk has no file on the other, which is
the whole reason the Mongo copy exists.

8 tests, 8 probes, all red on exactly the expected test with exactly one failure each. Admin
typecheck at the 223 baseline, main app at 198, with none in the changed file and none
disappearing.

---

### R56 - One document held every image the platform had ever uploaded - **CLOSED, 8 September 2026**

The owner tried to save a logo for the game and was told:

> The image saved on this server but could not be copied to the database, so other servers would
> not serve it. Please try again.

with `BSONObj size: 17070874 (0x1047B1A) is invalid. Size must be between 0 and 16793600(16MB)`
in the admin log, four times, on four different pictures.

**Nothing was wrong with the picture, the route or the encoding.** Every image the platform has
ever accepted - hero images, branding images, and now game artwork - was base64-encoded into
`WhiteLabel.brandingFiles`, a map on the **single settings document**, and MongoDB caps a document
at 16MB. The document had reached the ceiling, so **uploading any image anywhere in the admin
panel had already become impossible** and nobody had happened to try. The message is the second
half of the trap: the disk write succeeds, so the operator is told the file saved and to try
again, which is accurate, unactionable, and identical on every retry.

**The general form is worth more than the instance: a store that fills up by SUCCEEDING gives no
warning.** There is no bad input to find, no failing code path to bisect, and the first failure
looks like a problem with whatever was being uploaded at the time.

**The fix is one document per file**, in a `branding_asset` collection. A collection has no
ceiling; the limit that remains is 8MB per file, which is a limit an operator can do something
about ("this picture is too big") rather than one they cannot ("the platform has run out of
pictures"). `lib/services/branding-assets.service.ts`, mirrored, is the only module that knows
where the bytes live - three writers, four readers and one delete all go through it - and reads
try the collection first and the legacy map second, so nothing uploaded before today breaks.

**Three things about it are load-bearing.**

- **`brandingFiles` is now `select: false`, and that is not tidying.** 67 files call
  `WhiteLabel.findOne()`. Every one of them was transferring every image ever uploaded, and every
  `save()` was writing them all back. The old upload path was a read-modify-write of the whole
  map, so uploading one 2MB picture moved ~32MB over the wire. It is only safe to hide the field
  because a single service owns every access to it, which is why a test asserts that no writer
  reaches past that service.
- **The `__DOT__` key encoding was deliberately not carried over.** It exists solely because
  Mongoose refuses a dot in a **map** key; a plain `String` path has no such restriction.
  `branding-file-key.ts` survives for reading the legacy map and for nothing else. Carrying a
  workaround past its cause is how it lives long enough for somebody to "simplify" it back into
  the bug it was written for.
- **The migration clears the map one entry at a time with `$unset`, never by saving the
  document.** A `save()` of a 16MB document is refused by the same limit that caused the problem,
  so a migration written the obvious way cannot run at all.

**Live, platform-wide, and the migration has NOT been applied.**
`tools/branding/migrate-branding-files.ts` is report-only until `--apply`. New uploads work
immediately, because they no longer touch the settings document at all - but until the migration
runs, that document is still carrying the images and is still within a megabyte or two of the
ceiling. `select: false` means nothing pays to read them any more, so what remains is **headroom**:
any other field on that document is one growth spurt away from the same refusal, and the refusal
will name whatever field happened to grow. Nothing is lost by running it: it copies,
reads back, and only then clears, one `$unset` at a time - never by saving the document, which the
same limit would refuse.

---

## 5. Medium platform risks

| ID | Risk | Mitigation |
|---|---|---|
| R6 | Gating the price streamer breaks charts | Gate, never delete. One condition in `autoInitialize()`. Verify in logs |
| R10 | `blockCompetitionsOnHolidays` blocks a chess contest | Scope holiday gating to `needsMarketHours` |
| R14 | Leaderboard migration changes ranks | Run old and new in parallel; diff the top 100 before switching |
| R18 | Six trading providers hoisted to a shared `/play` layout | Keep them inside the trading branch. Verify in the browser |
| R19 | Moving ~20 components breaks imports | Standalone commit, no logic changes |
| R20 | `startingCapital` is `required: true, min: 100` | Make it conditional on the game, or default it for non-trading contests |
| R21 | Splitting the ~1,700-line dashboard action | Split by section, compare output before and after |
| R22 | New admin sections invisible | Add every ID to `ADMIN_SECTIONS`; fix the 8 existing omissions |
| R23 | Notification templates link to `/trade` | Resolve through the play dispatcher |
| R25 | Round write contention | Use `$inc`; load-test a 500-player contest |

### R24 - Scope creep, and why it is rated High likelihood

This programme is **26.5-35 weeks**, and every chapter contains something reasonable to
want. The failure mode is not a technical one: it is reaching week 20 with a broad,
half-finished platform and no provider contest that has ever taken a real entry fee.

**The rating went up on 2 September 2026, and the reason is instructive rather than
alarming.** The owner's brief added ~3 weeks of real scope - a profile specification, an
opponent picker, onboarding and matchmaking - and every item was individually well
justified. That is exactly what scope creep looks like from the inside: not a bad
decision, but a series of good ones with no stopping rule. The register's job here is to
hold the stopping rule, not to argue against the additions.

**Mitigation:** treat `X0-X5 plus a minimal slice of X6` - roughly 11-14 weeks - as the
first commitment, and review against real player behaviour before funding the rest. The
catalogue, marketplace and Game Master items are explicitly unscheduled for this reason,
and **X11.5 sits deliberately late** - matchmaking across one game is pointless, so it
cannot honestly be pulled forward.

---

## 6. Things that are safer than they look

| Assumption | Reality |
|---|---|
| Worker jobs will break | They already no-op when no active trading contests exist |
| Turning off trading breaks the app | The six trading providers are already scoped to two pages; the admin app already skips the streamer |
| Wording is 5,000 strings | The shared shell is ~150-250 |
| The money layer needs a rewrite | It is rank-based and game-agnostic already. It needs **consolidation**, not redesign |
| Journey maps need rebuilding | Database-driven; the deprecated constants file is not seeded |
| A provider integration needs new infrastructure | Database records and Next.js routes only. One CSP change |

---

## 7. Gates

### Gate 1 - before X1 begins

- [ ] All **8** money tests from `18` passing
- [ ] Exactly **one** contest entry path, and it increments `prizePool`
- [ ] The 4 bypassed security checks restored on that path
- [ ] All **5** drifted mirror fields synced
- [ ] Mirror CI check failing on deliberate divergence
- [ ] Production build succeeds
- [ ] **Owner sign-off recorded**

### Gate 2 - before X5 begins

- [ ] Gate 1 complete
- [ ] Trading regression: historical competitions recompute to **identical** rankings
- [x] Finalization dispatches on game type - **inside** the four finalize functions, not at the **ten** call sites (`11` s2 seam 3 corrects the "5" this line used to claim)
- [ ] Trading settle path asserts and aborts on a non-trading contest
- [ ] Dead Inngest crons deleted or fenced
- [x] Market-hours gating scoped to `needsMarketHours` - **done 4 Sep 2026**, at all three
      cross-game call sites (challenge create, challenge accept, admin competition create),
      failing **closed** on an unknown game type
- [x] **Every raw-driver contest insert sets the game label explicitly** - **done 4 Sep
      2026**. Note this was **six** inserts, not the two this line assumed (R7)
- [x] **Admin-app finalization pays Game Master earnings identically to the main app** (R26) -
      **done 5 Sep 2026**, proven by running *both* finalize functions over identical fixtures
      and comparing every ledger row, not by asserting the admin app pays something. **Existing
      contests were not backfilled**
- [ ] `minParticipants` cannot be set below 2 on any creation path, admin or Game Master
- [ ] Every failure rehearsal in `07` section 9 green **against the mock**

### Gate 3 - before X12 pilot begins

- [ ] Provider pricing modelled and a cost floor set
- [ ] **Game Master provider-cost treatment decided**: either the share is computed on net
      platform fee after provider cost, or `limits.allowedGameTypes` still excludes provider
      games (X7)
- [ ] Fraud gate covering provider entries
- [ ] Reconciliation job and unresolved-round policy live - **the logic is built and probed
      (X3, 4 Sep 2026), but "live" means running on the worker, which is X9.** The four
      stages, the polling schedule and all three policies exist and are tested; nothing
      calls them on a timer yet. Do not tick this until the worker does
- [ ] Every alert in `15` section 7 firing to a real destination
- [ ] Manual round resolution usable by an admin without a developer
- [ ] Rollback rehearsed: disable provider games and confirm the platform behaves exactly
      as it does today
