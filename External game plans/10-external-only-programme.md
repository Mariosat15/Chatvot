# 10 - The External-Only Programme

> **THIS IS THE CHOSEN SCENARIO.** Decided by the owner on **2 September 2026**:
> provider games are the only new games; no in-house game is built. Read this chapter
> **instead of** `09-implementation-phases.md`, which describes the add-on route that is
> no longer being pursued.
>
> Two owner instructions came with the decision and both are load-bearing:
> **build admin-first**, and **take one step at a time so the running application is
> never broken.** Section 3 reflects them.

Chapters `01`-`09` were written on an assumption: that the `New games plan` delivers
Stage 0 and the game-module foundation, builds Trivia in-house as the proof game, and
handles every platform-wide change (admin, navigation, wording, flags, catalogue).
External games were then an *addition* to a platform that had already been generalised.

This chapter covers the other decision: **provider games are the only new games. No
in-house game is built.** That changes the shape of the programme, and it changes it
more than it first appears.

---

## 1. The scenario, defined precisely

| | |
|---|---|
| **Trading** | Stays. Every feature it has today, unchanged. It is demoted in navigation, not degraded in function |
| **In-house games** | None built. No Trivia module, no question bank, no in-house content pipeline |
| **All new games** | Supplied by one or more external providers, under the contract in `01` |
| **Money, ranking, prizes, points, badges** | Ours, as in every other chapter. The provider never touches money |

Two things follow immediately, and they pull in opposite directions.

**The foundation work does not go away.** The game-module registry, the general `score`
field on participants, the four seams where trading is welded into the shared engine -
all of it is still needed. A provider game plugs into exactly the same socket an
in-house game would have. Chapters `01`-`09` listed that work as a prerequisite
belonging to another plan. **In this scenario this plan owns it.** See `11`.

**The platform-wide work does not go away either.** The admin panel still assumes
trading. So does the navigation, the dashboard, the leaderboard, the help centre and
roughly 150-250 user-visible strings in the shared shell. None of that cares whether
the second game is built in-house or bought in. Chapters `12` to `16` cover it.

---

## 2. What genuinely changes versus the in-house route

| | In-house first game (New games plan) | External-only (this chapter) |
|---|---|---|
| Proof of the abstraction | Trivia module, built and controlled by us | Provider adapter, dependent on their sandbox |
| First game available | ~week 8, entirely under our control | Gated on a signed contract and sandbox access |
| Content burden | Ours forever - questions, categories, refresh | Theirs. **This is the main prize** |
| Number of games at launch | One | Potentially their whole catalogue |
| Per-contest marginal cost | Effectively zero | Provider fee per round or revenue share |
| Failure mode if it goes wrong | A bug we can fix | A supplier we cannot fix, and may not be able to replace quickly |
| Work that disappears | - | Trivia module and question bank: **~3.5 weeks** |
| Work that appears | - | Provider integration E1-E8: **~7 weeks** |

### The finding that matters

**External-only is not the cheaper route. It is the broader one.**

Removing the in-house game saves about three and a half weeks of module and content
work. Adding a provider integration properly - signed callbacks, idempotency, round
reconciliation, unresolved-result policy, sandbox contract tests - costs about seven.
Everything else is identical because everything else is platform work that has nothing
to do with who supplies the gameplay.

| Route | To a second playable, payable game | To a full games platform |
|---|---|---|
| In-house Trivia first | ~8-10 weeks | **12-17 weeks** |
| External-only | ~11-14 weeks, and gated on a contract | **23-30 weeks** |

Both right-hand figures predate the owner's 2 September 2026 brief; the external-only one
has been updated for it, the in-house one has not, because that route is not being
pursued. **Comparing them is therefore no longer apples to apples** - the 12-17 week
figure excludes the profile work, the opponent picker and matchmaking, which are scope
rather than route. Do not quote the gap as though it were the cost of the decision.

The external route buys **breadth and zero content burden**, at the cost of roughly six
extra weeks, a per-round or revenue-share cost, and a supplier dependency on the
critical path. That is a reasonable trade - it is not a saving, and it should not be
sold internally as one.

---

## 3. The self-contained phase plan

Phases are prefixed `X` to distinguish them from the `New games plan` P-phases and the
add-on E-phases in `09`. Where a phase is an existing one absorbed, the source is named
so nothing is written twice.

| Phase | Deliverable | Source | Effort | Provider needed |
|---|---|---|---|---|
| **X0** | Prerequisite defect fixes, owner sign-off | `New games plan/00a` | 6-9 days | No |
| **X1** | Foundation: game label, general score, registry, the four seams, trading wrapped as a module, **and the game label on both Game Master competition inserts** | `11`, `19` s3.1, was `New games plan` P1 | 2.5-3.5 weeks | No |
| **X2** | Provider abstraction and mock adapter | `09` E1 | 1 week | No |
| **X3** | Round lifecycle and result ingestion | `09` E2 | 1 week | No |
| **X4** | Real adapter against the sandbox | `09` E3 | 1 week | **Sandbox** |
| **X5** | Contest integration and settlement | `09` E4 | 1 week | Sandbox |
| **X6** | Admin: provider screens **plus** navigation restructure including **the single Trading section**, RBAC, game-aware create wizard, provider registration, analytics, settings, **and the Game Master creation API and wizard** | `09` E5 + `12` + `19` | 3-3.5 weeks | Sandbox |
| **X6.5** | **Admin wording pass** and the terminology layer itself | `14` s3.1 | 0.5-1 week | No |
| **X7** | Player UI **plus** points, leaderboards, **profile and cross-game stats**, badges, levels, journeys, **Game Master and admin per-game analytics** | `09` E6 + `13` + `05` + `19` | 3-4 weeks | Sandbox |
| **X8** | Player wording passes, `tradingEnabled` master switch, infrastructure gating | `14` s3.2 + `15` | 1-1.5 weeks | No |
| **X9** | Resilience, reconciliation, monitoring | `09` E7 | 1 week | Sandbox |
| **X10** | Challenges - any game, **and any opponent** | `09` E8 + `20` s2 | 1-1.5 weeks | Sandbox |
| **X11** | Games catalogue and games-first navigation | `16` | ~2 weeks | No |
| **X11.5** | **Smart onboarding, game interests and challenge matchmaking** | `20` | 2-3 weeks | No |
| **X12** | Hardening, staged pilot, public launch | `09` E9 + `18` | 3-5 weeks | **Production** |

**X1-X12: 23-30 weeks.** Plus X0 at 6-9 days, delivered and signed off separately. X0 started 1 September 2026; its first item, a simulator authentication fix, has already shipped as commit `d5d3a328`.
One experienced developer on this codebase, testing included.

### 3.1 What changed on 2 September 2026, and why

The table was **20-26 weeks** before the owner's brief. The increase is ~3 weeks of
genuinely new scope, not a re-estimate of the same work, and the distinction matters
enough to itemise:

| Change | Effect | Why it is real |
|---|---|---|
| **X6.5 split out of X8** | Neutral on total | The wording pass sat *after* the player UI, which would have had operators running a multi-game platform through screens labelled "trading" for two phases. The engineering total in `14` is unchanged at ~10 days; only its position moved |
| **X10: 0.5-1 week → 1-1.5** | +0.5 week | "Challenge any user" was never specified. `03` designed the challenge *mechanics* and described the opponent as "invited or matched". An opponent picker, open challenges and the abuse controls that come with them are new - see `20` s2 |
| **X11.5 added** | +2-3 weeks | Smart onboarding and interest matchmaking appear nowhere in `01`-`19`. New chapter `20` |
| **X7 gains the profile** | +3 days, inside the existing 3-4 week range | The profile existed in this plan only as "terminology pass 6 - profile tabs", treating a structural change as a labelling one. `13` s7.2 |

**X11.5 is cheaper than it looks, and that is itself a risk.** A matchmaking service
already exists - `lib/services/matchmaking.service.ts` with `GET /api/matchmaking` - along
with friends, a block list, user search and a rate-limit utility. So the phase is mostly
generalisation. Generalising a service is routinely under-scoped, because the new
behaviour is small while the existing call sites are many; Stage 0 learned this by
counting the competition-entry writers and finding four where the plan said two. Count the
callers before committing to the estimate.

### 3.2 Admin-first, and what it does not mean

The owner's instruction is to start with admin and proceed in steps that cannot break the
running application. Two reasons, the second operational:

- **Admin is where a game becomes addable at all.** Until an operator can register a
  provider, sync a catalogue and create a non-trading contest, every player screen has
  nothing real to render.
- **The admin app is the safe place to be wrong.** Separate Next.js process, no player
  traffic. A broken admin screen inconveniences an operator; a broken player screen costs
  money and trust.

**It does not mean X6 moves in front of X1-X5.** A provider contest must exist before
there is anything to administer, so the foundation still comes first. Within the ordering
below, admin-first means: X6 and X6.5 complete before X7 begins, rather than overlapping
it; and the player UI is built against data produced by real operator actions rather than
fixtures.

**"One step at a time" has a concrete meaning here**, and it is already how the plan is
built: every phase is additive and shipped behind a flag, trading behaviour is pinned by
the regression test in `11`, and `tradingEnabled` defaults to on. The rule to keep is that
**no phase may require a simultaneous change to trading to be correct.** If one appears to,
the seam in `11` is wrong and that is the thing to fix.

**Game Master work (~2.5 weeks, chapter `19`) is not a phase of its own.** It is
distributed through X1, X6, X7 and X8 and is already inside the figures above. One item
inside it is a **gate rather than a task**: `app/api/gamemaster/competitions/route.ts`
inserts with the raw MongoDB driver and sets no game label, so until X1 fixes it a Game
Master-created provider contest would be settled by trading code.

### Hard ordering

```
X0 (signed off) -> X1 -> X2 -> X3 -> X5 -> X12
                          \
                           X4 (needs sandbox) ---> X5
```

`X3` before `X5` is not negotiable: settlement must never be built on a result path
that has not been proven against lost callbacks, duplicates, bad signatures and late
arrivals.

**Revised 2 September 2026 for admin-first:** `X6` and `X6.5` **complete before** `X7`
begins, rather than overlapping it. That is the whole practical content of the admin-first
instruction, and it costs a little parallelism in exchange for a player UI built against
real operator-produced data. `X8` can still overlap `X7`. `X10`, `X11` and `X11.5` are
independent of everything after `X7`, and `X11.5` should follow `X11` because matchmaking
across one game is pointless.

### The shortest useful path

**X0 + X1 + X2 + X3 + X4 + X5 + a minimal slice of X6** - roughly **nine to eleven weeks
of engineering, 11-14 weeks in calendar terms** because X4 onward waits on sandbox
access - produces a provider contest that an admin can create and a player can pay for
and play. That is the first point at which the decision can be reviewed against real
player behaviour rather than assumption, and it is the right place to pause.

---

## 4. The risks that only exist in this scenario

These are additions to `17-risk-register.md`, and they are the reason this decision
deserves more scrutiny than the in-house route.

| # | Risk | Severity | Why it is specific to external-only |
|---|---|---|---|
| **X1** | **The abstraction cannot be proven without the provider.** | High | With an in-house game, the registry is validated by code we control. Here, `X4` onward is blocked on someone else's sandbox. A provider who is slow to grant access stops the programme dead, after ~5 weeks of investment |
| **X2** | **Single supplier on the critical path.** | High | If the provider terminates, raises prices, or fails commercially, the platform reverts to trading only - and every week spent on games work is stranded. There is no in-house fallback game |
| **X3** | **No cost floor.** | High | An in-house game costs nothing per contest, so free and low-fee contests are always viable for acquisition. A per-round fee can make the cheapest and most valuable acquisition contests loss-making. Model this with `08` section 3 **before** X4 |
| **X4** | **We cannot fix their game.** | Medium | A dull game, a scoring quirk, a mobile bug or a bad translation is a support ticket to a third party, not a sprint task. Player-visible quality is outside our control |
| **X5** | **Content and presentation dependency.** | Medium | Each provider title needs a game page - description, rules, artwork, localised. `01` section 3.1 makes this contractual. A provider who will not supply it transfers that cost to us, per title, forever |
| **X6** | **The registry gets exactly one real implementation.** | Medium | The whole point of the contract is that a second game costs one folder. With one provider module and trading, that claim is never actually tested. Mitigation: write a second adapter skeleton in X9, even unused - it is in the definition of done in `09` section 7 |

### The mitigation worth paying for

**Do not sign a single provider and stop looking.** The adapter boundary makes a second
provider cheap only if it is exercised. Aim to have a second provider evaluated and
contractually possible before public launch, even if only one is live. The cost is a
few days of commercial time; the alternative is a platform whose entire games offering
sits behind one supplier's uptime and pricing decisions.

---

## 5. What is lost by not building one game in-house

Stated plainly, because it is easy to overlook when the appeal of "no content work" is
in front of you.

- **A game we can change.** Tuning difficulty, adding a seasonal category, fixing a
  scoring complaint or running a branded event is a code change we control, not a
  negotiation.
- **A zero-marginal-cost contest.** Free entry, high participation acquisition
  contests are always viable with an in-house game.
- **A working reference implementation.** The second implementation of any interface is
  what proves the interface. Trading plus one provider module is a weaker proof than
  trading plus an in-house game plus a provider module.
- **Independence from a contract.** No renewal, no notice period, no counterparty.

### The recommendation

If external games are the strategic direction, they are still worth doing. But consider
a **middle path**: build the foundation (X1), integrate the provider (X2-X5), and keep
**one small in-house game** on the backlog as an insurance policy - not as the launch
game, but as a two-to-three week project that can be pulled forward if the provider
relationship goes wrong. It converts risk X2 from existential to inconvenient for a
modest cost, and it gives the registry the second real implementation it needs.

This is a recommendation, not a decision. Record whichever way it goes in
`PROGRESS.md`, with the reason.

**Status after 2 September 2026: still open, and now more urgent rather than less.** The
external-only decision is made, which removes the fallback that made this recommendation
comfortable to defer. It is open question 10 in `PROGRESS.md`, and its deadline was moved
forward to **before X4** - the last point at which the answer is still cheap, because X4
is where the programme starts spending against a specific provider's sandbox.

---

## 6. What must be true before X1 starts

- [ ] **X0 signed off by the owner** in production - see
      `New games plan/00a-STAGE-0-prerequisite-fixes-DO-FIRST.md`. Not negotiable, and
      unchanged by this scenario
- [ ] The **skill-or-chance question answered in writing** by every candidate provider
      (`08` Gate 1). One line ends an unsuitable conversation before any engineering
- [ ] **Pricing modelled** against realistic contest sizes using `08` section 3,
      including free and low-fee contests
- [ ] **Sandbox access committed to a date** in the commercial discussion, since X4
      onward is blocked on it
- [ ] **Data processing agreement** drafted, since pseudonymous player identifiers
      cross the boundary from X4
- [ ] A decision recorded on the **in-house insurance game** in section 5
- [ ] A decision recorded on whether a **second provider** will be evaluated before
      launch

---

## 7. How this chapter relates to the rest of the folder

| Chapters | Role in the external-only scenario |
|---|---|
| `01`-`08` | **Unchanged and fully applicable.** The provider contract, architecture, flows, data model, scoring, trust, failure modes and evaluation are identical either way |
| `09` | The add-on phase plan. **Superseded by section 3** - the add-on route is not being pursued. Kept so that E-phase references in `01`-`09` remain resolvable |
| `10` | **This chapter.** Scenario, absorbed foundation, programme plan, scenario-specific risks |
| `11`-`16` | The platform-wide work this folder previously delegated to the `New games plan` |
| `17` | Risk register, including the six risks in section 4 and the six in `20` section 8 |
| `18` | Migration, testing, rollout and rollback |
| `19` | Game Masters on provider games |
| `20` | **New 2 Sep 2026.** Game interests, challenge matchmaking, opponent selection, onboarding - X10 and X11.5 |
