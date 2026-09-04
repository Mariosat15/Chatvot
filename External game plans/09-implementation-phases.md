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

### E5 - Admin panel

- Provider list, health, enable/disable, catalogue sync
- Game list with our own enable switch, independent of the provider's
- Contest creation with a **settings form generated from `configSchema`**
- Pre-flight validation from `03` section 4.1, including the sandbox smoke round
- Round inspector - status, score, raw event, replay link
- Manual round resolution, with a mandatory reason and an audit entry
- Pause, extend and cancel controls on a live contest

**Done when:** an admin can create, run, monitor and if necessary rescue a contest
without a developer.

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
