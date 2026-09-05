# 09 - Implementation Phases (add-on scenario)

Sequenced so that each phase is independently testable and shippable, and so that
nothing touching money goes live until everything around it has been proven.

> ## SUPERSEDED - USE `10` SECTION 3
>
> **The owner decided external-only on 2 September 2026:** provider games are the only new
> games, and no in-house game is built. This chapter assumed the opposite - that the
> `New games plan` would also deliver Stage 0, the game-module foundation and all the
> platform-wide work, leaving external games as an addition to an already-generalised
> platform.
>
> **The operative plan is `10-external-only-programme.md` section 3** - a self-contained
> X0-X12 sequence of **23-30 weeks**, running **admin-first** at the owner's instruction.
>
> **Nothing below is wasted, and that is why the chapter is kept.** Every E-phase survives
> inside the X-phases - E1 becomes X2, E2 becomes X3, and so on - so the phase *contents*,
> the testing approach and the definition of done all still apply. They are re-sequenced,
> not replaced, and references to E-phase numbers elsewhere in `01`-`09` resolve here.
> **Do not plan a schedule from this chapter.**

---

## 1. Prerequisites - not part of this plan, but required by it

| Prerequisite | Source | Why |
|---|---|---|
| **Stage 0 defect fixes** | `New games plan/00a` | Two live defects - duplicate join paths and admin model mirror drift - both sit directly under the contest and money layer this plan depends on |
| **Phase 1 game-module foundation** | `New games plan` P1 | `gameType`, the general `score` field on participants, and the game registry. Without them there is nowhere for a provider game to plug in |
| **A signed provider** | Commercial | The adapter cannot be finished against a hypothetical API. Everything up to Phase 3 can be built against a mock |
| **Sandbox credentials** | Provider | Required from Phase 3 onward |
| **Data processing agreement** | Legal | Required before any real player identifier is sent |

**Do not start Phase 1 of this plan before Stage 0 is signed off.** Building a new
score path on top of two known contest-layer defects means debugging both at once,
with real money involved.

---

## 2. Phase overview

| Phase | Deliverable | Effort | Provider needed |
|---|---|---|---|
| **E1** | Provider abstraction and mock adapter | 1 week | No |
| **E2** | Round lifecycle and result ingestion | 1 week | No |
| **E3** | Real adapter against the sandbox | 1 week | Sandbox |
| **E4** | Contest integration and settlement | 1 week | Sandbox |
| **E5** | Admin panel | 1 week | Sandbox |
| **E6** | Player UI and rewards | 1 week | Sandbox |
| **E7** | Resilience, reconciliation, monitoring | 1 week | Sandbox |
| **E8** | Challenges | 0.5-1 week | Sandbox |
| **E9** | Pilot and launch | 2-4 weeks | Production |

**Engineering: 7.5-8 weeks. Calendar to public launch: 10-12 weeks**, including the
pilot and assuming the prerequisites are already done.

---

## 3. The phases

### E1 - Provider abstraction and mock adapter

Build the shape before the specifics. The mock adapter is not throwaway work: it
remains the basis of every automated test, and it lets seven of nine phases proceed
without waiting on a provider.

- [x] `GameProviderAdapter` interface and `ProviderRegistry`
- [x] `MockProviderAdapter` - configurable score, latency, and every failure mode from `07`
- [x] `game_provider` and `provider_game` collections, in **both** apps
- [x] Catalogue sync service and caching
- [x] Credentials wired through settings, in **both** apps

**Done when:** the mock catalogue syncs, appears in the database, and the registry
resolves an adapter by key.

#### BUILT 4 September 2026 - code-complete

`lib/services/game-providers/` - `contract.ts`, `registry.ts`,
`adapters/mock.adapter.ts`, `catalogue.service.ts` - mirrored into `apps/admin/lib/`.
44 tests in `__tests__/services/game-providers.test.ts`, seven probes all red. Nothing is
player-visible: `externalGamesEnabled` defaults to false.

**The location question is settled, and not where `11` s3 guessed.** That chapter sketched
the provider code at `lib/games/provider/adapters/`; section 9 of `02` put it at
`lib/services/game-providers/`. **Invariant 2 decides it** - the ESLint rule added in X1
step 6 bans anything inside a game module folder from importing a model, and the registry
reads settings while the catalogue service writes `provider_game`. The split that results
is the right one regardless:

| Location | Role | Touches the database |
|---|---|---|
| `lib/services/game-providers/` | Talks to the provider, caches the catalogue, resolves adapters | Yes |
| `lib/games/provider/` (**X5**) | Pure scoring and settlement for a provider contest | **No** |

**Three rules the catalogue sync enforces, each pinned by a test.** A sync never enables a
title (`chartvoltEnabled` is ours and defaults false); never rewrites `gameKey`, `gameCode`
or `providerKey`; and never overwrites operator-edited presentation copy. The third is
implemented as a **named allow-list of provider-owned fields rather than a spread of the
payload** - a spread means any field the provider adds, or any field an operator later
edits, is silently overwritten on the next sync, and that failure is invisible until
somebody notices their wording reverted.

Titles the provider stops listing are **reported, never deleted**. A title with historical
rounds cannot be removed without orphaning the stats joined to its `gameKey`, and a provider
omitting a game from one response is as likely to be a partial failure on their side as a
withdrawal.

**Credentials are out of `game_provider` and behind `select: false`.** They live in
`WhiteLabel.gameProviderCredentials`, excluded from queries by default, so a bare
`WhiteLabel.findOne()` - which dozens of call sites already do, several returning the result
to a client - cannot leak one. Copy the payment-provider **UX**, never its persistence
(`12` s4.1).

**The mock's default catalogue includes a `lower_is_better` / `duration_ms` title on
purpose.** A catalogue of only higher-is-better games lets a ranking sign error pass every
test, and that error pays the slowest player first.

> **The X2 gate in `11` section 4 was noted, not cleared.** The golden-fixture regression
> test is green; the replay against real stored `finalLeaderboard` data has never been run.
> X2 touches no ranking or settlement code, so it was built regardless - **but the replay
> must happen before X5.**

### E2 - Round lifecycle and result ingestion

The heart of the integration, and the part that must be flawless.

- `game_round` and `provider_event` collections, in **both** apps
- `RoundService` - creation, idempotency, attempts policy, one live round per player
- Signed callback endpoint, with store-before-process
- `ResultIngestionService` - verify, dedupe, normalise, persist
- Signature verification with raw-body handling and constant-time comparison

**Done when:** every rehearsal in `07` section 9 passes against the mock - lost
callbacks, duplicates, bad signatures, conflicting scores, late results.

> Do not move past E2 until those tests are green. Every later phase assumes results
> are trustworthy, and retrofitting that assumption is far more expensive than
> establishing it now.

#### BUILT 4 September 2026 - code-complete

All five deliverables exist, and **rehearsals 1-6 of `07` section 9 are green against the
mock** (`__tests__/services/round-lifecycle.test.ts`, 49 tests, all six central guards
probed by reintroducing the defect). Rehearsals 7-10 need contest settlement or a running
worker and belong to X5 and X8; they are listed as documented gaps at the foot of the test
file rather than left to look forgotten.

| Built | Where |
|---|---|
| `game_round` + `provider_event` | `database/models/games/`, mirrored (**79 pairs agree**) |
| `RoundService` | `lib/services/games/round.service.ts` + `round-types.ts` |
| Signed callback endpoint | `app/api/games/providers/[providerKey]/events/route.ts` |
| `ResultIngestionService` | `lib/services/games/result-ingestion.service.ts` |
| Signature verification | `lib/services/games/callback-verification.ts` |
| Reconciliation net | `lib/services/games/reconciliation.service.ts` |
| Contest acceptance (gate 9) | `lib/services/games/contest-state.ts` |

**Nothing is player-visible.** `externalGamesEnabled` still defaults to false, and no route
creates a provider contest.

**Chapter 04 left three gaps that had to be decided rather than guessed.** All three are now
recorded in `04` sections 3.3 and 3.4:

1. **"One live round per player per contest" was not actually enforced by any documented
 index.** `07` section 4 says it is "enforced in the database", but the only index `04`
 listed prevents a duplicate attempt *number* - and attempt 1 launched beside attempt 2
 launched satisfies that perfectly, which is exactly the abandon-and-peek the rule exists
 to stop. Closed with a **partial unique index** on `{ contestId, userId }` filtered to the
 live statuses.
2. **No transition table for `status`.** `04` lists seven values and says nothing about
 which moves are legal, so every call site would have decided for itself. Now
 `ROUND_TRANSITIONS` in the model.
3. **`provider_event.eventType` and `processingResult` had no enum.** Free-text outcomes
 drift into near-synonyms and the admin filter silently stops matching some of them, so
 `EVENT_PROCESSING_RESULTS` names the twelve.

**Two deliberate deferrals, recorded so nobody "fixes" the gap.** Contest-level round fields
(`attemptsPolicy`, `unresolvedRoundPolicy`, `resultGracePeriodSeconds`, `playWindowEnd`) are
**passed in** as `RoundContestConfig` rather than read from `Competition`, so X3 adds no
field to the contest models - X5 wires them without changing this service. And the
`exclude` policy's **refund is named, not paid**: `ReconciliationOutcome.refundOwed` is the
obligation, and settlement honours it. Paying it here would put a second money writer beside
settlement, and removing a player changes the prize pool, so the refund and the re-split are
one transaction that belongs to X5.

**Both deferrals are now closed** (4 September 2026, E4 third-half notes), and the second
was closed differently from how this paragraph implies: settlement does **not** consume
`refundOwed`. That flag is a return value in a worker process that has exited by the time a
contest settles, so settlement re-derives the obligation from `round.status = "unresolved"`,
the one thing stage 4 persists. The flags remain what a caller logs and alerts on.

### E3 - Real adapter against the sandbox

- Implement the real provider adapter
- Verify catalogue, round creation, callbacks and the pull endpoint against sandbox
- Confirm the launch URL renders in an iframe, including the CSP change
- Document every deviation between the provider's actual API and `01`

**Done when:** a full round completes end to end against the sandbox and the score
lands in `game_round`.

### E4 - Contest integration and settlement

- `ProviderGameModule` implementing the game-module contract
- `gameKey`, `contentSeed`, play windows and grace periods on contests
- Attempts policy applied to the counted score
- Settlement collects scores, waits out the grace period, hands results to the
  existing engine
- Unresolved-round policy

**Done when:** a sandbox contest runs end to end - entry fees in, scores collected,
ranked, prizes paid, ledger balanced to the cent.

#### E4 build notes - PARTIALLY BUILT, 4 September 2026

**This section describes the FIRST half only. Play and settlement landed later the same day
- see the second-half notes below for the current state.** As of this half: built were
publish, entry and ranking; not built were play, settlement and the refund. A provider
contest could be published, entered and correctly ordered, but nobody could play one and
nobody was paid.

`ProviderGameModule` exists at `lib/games/provider/`, mirrored into the admin app, and is
registered in both registries. One module serves every title from every provider - a new
title is a catalogue row, a new provider is an adapter, and neither is a new module. The
registry tripwire test was updated deliberately, and now asserts the list is exactly
`["trading", "provider"]` with a note that a third entry means the engine has learned
something game-specific.

**Two P0 defects sat between a created contest and an entered one**, and neither was
visible in the plan:

- **A provider participant could not be SAVED.** `startingCapital`, `currentCapital` and
  `availableCapital` were `required: true` with no default on `CompetitionParticipant`, and
  a provider contest has no starting capital to copy. Now conditional on
  `(this.gameKey || "trading") === "trading"`, mirrored, with the same load-bearing `||` as
  `Competition.startingCapital`.
- **A provider participant that did save was stamped `gameKey: "trading"`**, because the
  entry service left the field to its schema default. R7-class, and worse than R7 was: the
  row saves, nothing crashes, and `gameKey` is immutable so it cannot be corrected. The
  seat is now built by `buildParticipantSeat()`, extracted so a test can compare its keys
  against `schema.paths`.

Publishing re-runs the whole pre-flight checklist against the **stored** contest rather
than trusting creation-day validity, because a draft can outlive the switches that made it
valid. It also runs `contestRoundConfig` against the saved document, which asks a question
creation could not: whether the settings actually persisted.

**Deliberately not built, and each for a reason rather than for time:**

| Not built | Why |
|---|---|
| Round launch for players | **BUILT later the same day - see the E4 second-half notes below** |
| Provider settlement | **BUILT later the same day - see the E4 second-half notes below** |
| The `exclude` refund | **BUILT 4 September 2026 - see the E4 third-half notes below.** It was the last item on this list, and closing it turned up a sibling gap nothing had recorded |
| Unpublish | There is deliberately no unpublish. A visible contest can be paid into; hiding it would strand paid entrants. Cancel is the reversible operation, and it refunds |

Tests: `__tests__/services/provider-entry-and-ranking.test.ts` (23), all guards probed by
`tools/probe-provider-entry.ps1` (10 red on the expected test). Full suite 636 green,
including the golden ranking regression that pins trading.

**One probe stayed green and the claim was corrected rather than the test strengthened.**
The `isAtRisk` guard against dividing by absent capital changes no answer today, because
`NaN < 60` is false exactly as the guard's explicit `false` is. It is kept for readability
and because the accident holds only for `<`, and the code comment now says so instead of
claiming a fix.

#### E4 second-half build notes - ROUND LAUNCH AND SETTLEMENT, 4 September 2026

**The "Done when" above is now met apart from the `exclude` refund** - which was itself
closed hours later, so see the third-half notes. A sandbox contest runs entry fees in,
scores collected, ranked and prizes paid, with the ledger attributable to the contest. Read
the build-note sections together - the first half's warning that "entry works" is not "the
contest works" no longer applies, but its list of what was deferred does not describe the
current state either.

**Round launch.** `lib/services/games/round-launch.service.ts` and
`POST /api/competitions/[id]/rounds` sit over X3's round service. Two design points:

- **The lifecycle refusals are surfaced, not collapsed.** The first version folded
  "attempts exhausted", "a round is already live" and "the provider is down" into a generic
  `contest_not_open`, which *lied* - the contest is open, the player simply cannot start
  another round. The UI must react to all three differently: disable, offer to resume, offer
  to retry.
- **The per-title switch is re-checked at play time**, not only at publish. A title disabled
  after a contest opened must stop new rounds.

**Settlement was built as the extraction the plan called for**, and `11` seam 3 carries the
detail. In summary: `lib/services/settlement/` holds prize payout, fees/Game Master share
and completion as three shared stages; trading was rewired onto them
(`competition-end.actions.ts` 1,885 -> 1,174 lines); and a provider contest composes the
same three, skipping only the two that close positions and price them.

**Three of the four defects this turned up were TRADING defects**, which is the strongest
argument available for extracting rather than writing a parallel payout routine:
`finalLeaderboard` had never stored `isTied`, `qualificationStatus` or
`disqualificationReason` on any finalization ever run; `split_weighted` tie distribution
produced `NaN` prizes when tied participants' capital summed to zero; and the early-end
worker logged every finalization failure as the bare string "Failed to finalize", because
it read `message` where failures carry `error`.

Tests: `__tests__/services/provider-round-launch.test.ts` and
`__tests__/services/provider-settlement.test.ts`. Full suite **666 green**, `tools/probe-provider-entry.ps1`
now **27 probes, all red**.

#### E4 third-half build notes - THE UNRESOLVED-ROUND POLICIES, 4 September 2026

**E4 is code-complete.** The `exclude` refund is paid and the pool re-split in the
settlement transaction, and `hold_and_alert` blocks settlement. Chapter `07` section 2.3a is
the account of what was built; `11` seam 3 holds the seam-level findings. What belongs here
is what this phase's own planning got wrong.

**The phase list tracked one obligation and there were two.** `refundOwed` appears in four
documents, and every one of them presented it as the single remaining item. Nothing
consumed `blocksSettlement` either - a `hold_and_alert` contest settled on time and paid
out while the policy promised it would be held. It was invisible because it had never been
written down, not because anyone decided against it. **The generalisation: an obligation
recorded in four places is not more likely to be complete than one recorded nowhere - check
the siblings of the thing being closed.**

**Two defects were found under it, both worse than the gap being closed.** `exclude` did not
merely fail to refund: because `calculateRankings` never filters on participant status, an
excluded player stayed ranked and could be **paid a prize as well as being owed their fee
back**. And `provider-finalize.ts` committed a `success: false` return and never released
the claim, so the first refusal it ever produced would have parked the contest at
`finalizing` permanently - unclaimable by any caller, cron or human.

**Two probes stayed green for two different reasons, and the distinction is the useful
part.** Deleting the pool reduction left the suite passing, because the integrity cap
recomputes the same figure from the already-reduced participant count - so a *new* test was
needed, seeding a pool below the fees collected, where the cap has headroom and cannot
mask it. Passing `contestId` as a string also left the suite passing, and there the **claim
was wrong**: Mongoose casts a string to ObjectId when the query runs, verified directly. One
was a weak test, one was a false comment, and only running the probe separates them.

Tests: 15 new in `provider-settlement.test.ts`, 2 in `provider-settlement-late-hold.test.ts`
(a mocked race, because the pre-lock gate makes the in-transaction one otherwise
unreachable). Full suite **683 green**, mirrors 79/0, both typechecks at baseline.

**Still not built after E4:** ~~no admin button publishes a contest~~ - **the publish control
was built 5 September 2026 as an E5 slice, see below** - and no player screen launches a round,
so the player half of the lifecycle is still reachable by API and by test only. The `exclude`
refund is on the **provider** settlement path; trading has no rounds to be unresolved, which is
correct rather than a gap.

### E5 - Admin panel

**`PARTIALLY BUILT` 4 September 2026** - provider registration, credentials, the per-title
enable switch (`12` s4.1a), and now contest creation with pre-flight validation (`12` s2.1)
are code-complete. Taken out of order because E3 cannot start without a signed provider, and
the owner's "admin first" instruction puts these screens ahead of any player screen. The
remaining items are held back on purpose: **health** wants the `provider_health_check` time
series from `04` s3.5, and the **round inspector**, **manual resolution** and the **live
contest controls** are most useful once E3 has produced real rounds to inspect. Building
them against the mock now would ship screens whose only content is fixtures.

- [x] Provider list, enable/disable, catalogue sync
- [ ] Provider health
- [x] Game list with our own enable switch, independent of the provider's
- [x] Contest creation with a **settings form generated from `configSchema`**
- [x] Pre-flight validation from `03` section 4.1, including the sandbox smoke round
- [x] **Publish control on a draft provider contest** (5 Sep 2026, `12` s3.1a)
- [ ] Round inspector - status, score, raw event, replay link
- [ ] Manual round resolution, with a mandatory reason and an audit entry
- [ ] Pause, extend and cancel controls on a live contest

**Done when:** an admin can create, run, monitor and if necessary rescue a contest
without a developer. **Not yet met, and the gap is now narrower and more precisely
stated:** an operator can register a provider, choose which titles are live, create a
contest on one with settings drawn from the game's own schema, **and publish it so players
can see and enter it.** What remains is the *monitor and rescue* half - the three unticked
items above.

**What "publishing works" excludes, said explicitly so no later summary reads it as
finished.** A published contest can be entered and settled, but **no player screen starts a
round**, so the play step is still API-only and E6 owns it. The wizard covers competitions
only; challenges on a provider game are **E8**.

**And editing is still not built, which the publish control makes more visible rather than
less.** `/competitions/edit/[id]` renders the trading editor and `PUT
/api/competitions/[id]` does a blind `Object.assign` of whatever that form submits, so
opening a provider contest in it writes trading fields onto it. The list therefore
**withholds the Edit button from provider contests and says why**, rather than greying it
out - the same reasoning as a provider switch that cannot work refusing with a reason. Until
a provider editor exists, cancel and recreate is the honest instruction, and
`CompetitionEditorForm.tsx`'s field gap - noted in `12` s2 - stays load-bearing.

Remember the mirror: every model touched here exists twice.

### E6 - Player UI and rewards

- Contest browse and lobby, showing game thumbnails and rules
- `/play/[contestId]` iframe host, with origin checks and a strict message allowlist
- Live leaderboard during play
- Result screen with the generic `scoreBreakdown` renderer
- Practice mode, if supported
- Points, ratings, badges and milestones wired to `gameKey`
- Notifications and journey entries

**Done when:** a player can browse, join, practise, play, see their position and
receive prizes and rewards without touching a trading screen.

### E7 - Resilience, reconciliation and monitoring

- Reconciliation job on the worker
- Provider health checks and automatic degradation
- Automatic kill switch after sustained downtime
- Pause and extend on outage
- Every alert from `06` section 10
- Admin health dashboard
- Re-settlement capability

**Done when:** the provider can be taken offline mid-contest and the contest still
completes correctly, late, with players correctly informed.

### E8 - Challenges

- Challenge creation with a game and stake
- Shared `contentSeed` for both players
- Acceptance and play windows with automatic expiry and refund
- No-show, tie and both-abandoned resolution
- Head-to-head match support, only if the provider offers it

**Done when:** a challenge runs end to end and every case in `03` section 2 resolves
correctly.

### E9 - Pilot and launch

Follow the staged pilot in `08` section 5. Do not compress it. The metrics in that
section are the gate.

---

## 4. Testing strategy

Extends the `vitest` suite and CI already in the repository.

| Level | Coverage |
|---|---|
| **Unit** | Signature verification, score normalisation, `scoreDirection`, attempts policy, tie-breaks, points conversion, window arithmetic |
| **Integration** | Full round lifecycle against the mock, including every failure mode |
| **Money invariants** | All eight from `07` section 6, as explicit tests |
| **Idempotency** | Duplicate creation, duplicate callbacks, double settlement |
| **Concurrency** | Simultaneous joins, simultaneous callbacks, settlement racing a late result |
| **Contract** | Recorded sandbox responses replayed, so a provider change is caught by CI rather than by players |

The mock adapter is what makes all of this possible without a provider, which is why
E1 comes first.

---

## 5. Rollout controls

Every one of these must work without a deployment.

| Control | Scope |
|---|---|
| `externalGamesEnabled` | Master switch for all provider games |
| Per-provider enabled flag | One provider off, others unaffected |
| Per-game enabled flag | One title off |
| Contest pause | One contest |
| Maximum entry fee for provider contests | Caps exposure during the pilot |
| Maximum concurrent provider contests | Caps blast radius |

Launch with the last two set low and raise them as confidence builds.

---

## 6. What can go wrong, and the response

| Risk | Likelihood | Impact | Response |
|---|---|---|---|
| Provider API differs materially from `01` | **High** | Medium | The adapter absorbs it. This is exactly why the adapter exists |
| Results occasionally never arrive | Medium | **High** | Reconciliation plus the unresolved policy. Built in E2 and E7, not later |
| Per-round cost makes contests unviable | Medium | **High** | Settle pricing before E3. Model it with the numbers in `08` section 3 |
| Players find the games dull | Medium | **High** | Pilot with a small catalogue and measure repeat play before committing further |
| Provider outage during a paid contest | Medium | Medium | Pause and extend, built in E7 |
| Provider changes the API without notice | Low | **High** | 90-day notice in the contract; contract tests in CI |
| Provider terminates | Low | **High** | The adapter boundary keeps replacement to one folder. Never let provider concepts leak |
| Admin mirror drift reintroduced | Medium | **High** | Stage 0's mirror guard, and reviewing every model change as a pair |

---

## 7. Definition of done for the whole project

- [ ] Stage 0 and Phase 1 signed off beforehand
- [ ] Every failure rehearsal in `07` section 9 passes
- [ ] All eight money invariants asserted by automated tests
- [ ] Zero unresolved rounds across the entire pilot
- [ ] Zero payout discrepancies across the entire pilot
- [ ] Admin can create, monitor, pause, extend, cancel and re-settle without a developer
- [ ] Support can explain any score from stored evidence alone
- [ ] Every model change present and identical in **both** apps
- [ ] Every alert from `06` section 10 firing to a real destination
- [ ] Adding a second provider is scoped as one folder plus one registry entry -
      confirmed by writing the second adapter's skeleton, even if unused
- [ ] Rollback plan tested: disable provider games and confirm the platform behaves
      exactly as it does today
