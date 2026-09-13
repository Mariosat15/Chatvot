# 05 - Prizes and the Money Layer

The conclusion up front: **the money layer is already game-agnostic and should be reused essentially unchanged.** The work here is not building new payment logic - it is consolidating the duplicate paths that already exist, before we add more callers to them.

---

## 1. What is reused with zero change

| Component | File | Why it already works for any game |
|---|---|---|
| Credit balance debit/credit | `database/models/trading/credit-wallet.model.ts` | Atomic `$inc` on `creditBalance` |
| Ledger | `database/models/trading/wallet-transaction.model.ts` | `balanceBefore` / `balanceAfter` audit trail, contest-kind typed |
| Prize maths | `competition-ranking.service.ts` -> `distributePrizesWithTies()` | Takes ranks + percentages only |
| Platform fee | `lib/services/platform-financials.service.ts` -> `recordPlatformFee()` | Source-typed, amount-based |
| Unclaimed pool | same -> `recordUnclaimedPool()` | Triggered by "no qualified winners", which is game-neutral |
| Refund loop | `lib/actions/trading/competition-cancel.actions.ts` | Reverses entry fee per participant |
| Platform ledger | `database/models/platform-financials.model.ts` | 12 revenue/expense categories, none trading-specific |
| Game Master revenue share | `gamemaster-subscription.model.ts`, GM logic in `competition-end.actions.ts` | Percentage of **entry fees** from referred users |
| Deposits / withdrawals / KYC | Nuvei, Atlas, withdrawal settings, KYC gates | Entirely upstream of contests |

**Nothing about a Trivia contest changes how money moves.** A player pays 10 credits to enter, the pool is 10 x N, the platform takes its percentage, ranks 1-3 get their percentages, leftovers are redistributed or booked as unclaimed. Identical.

---

## 2. The one thing that must be fixed first (STAGE 0 - separate delivery)

> Fixed and signed off **before** the games work starts. Full spec: `00a-STAGE-0-prerequisite-fixes-DO-FIRST.md`.

> **BUILT 1 September 2026.** `lib/services/contest-entry.service.ts` exists and both gates
> call it. The remainder of this section is the record of what was wrong and why the shape of
> the fix is what it is - read it before adding a fifth entry path.

There were **two divergent competition join paths**, and they disagreed on both security and money.

| Behaviour | `enterCompetition` server action | `POST /api/competitions/[id]/join` | Unified |
|---|---|---|---|
| Email verified | Yes | **No** | Yes |
| User restrictions | Yes | **No** | Yes |
| Fraud gate | Yes | **No** | Yes |
| Level requirement | Yes | **No** | Yes |
| Market hours | No | Yes | **No** - only trading is gated |
| **`$inc prizePool`** | **Yes** | **No** | **Yes**, always |
| WriteConflict retry | No | Yes | Yes |
| Duplicate entry | Throws | Success | Success |
| Contest ref field | `referenceId` | `competitionId` | `competitionId` |

Files: `lib/actions/trading/competition.actions.ts` and `app/api/competitions/[id]/join/route.ts`. Both are now thin wrappers over the service.

### Why this blocks the games work

We are about to add more ways to enter a contest (a Trivia join, possibly a lobby join, possibly an admin-side test join). Adding callers to a forked, partially-guarded money path is how you get double charges and unpaid winners. Every hour spent consolidating now is repaid many times.

### The fix

Create **one** entry service that both callers delegate to:

```
lib/services/contest-entry.service.ts

enterContest({
  contestId, contestKind, userId,
  source: "web" | "api" | "simulator",
}) : Promise<{ success: boolean; error?: string; participantId?: string }>
```

Requirements, and what was actually built against each:

- The **union** of all gates from both paths. **Done.** The `source` parameter was **dropped**: it existed to express one legitimately different bit - the simulator skipping market hours - and the owner's market-hours ruling removed that difference entirely. What replaced it is a narrower flag, `trusted`, which skips only the three *person-level* gates a synthetic user cannot satisfy (email verification, restrictions, fraud) and skips no contest or money guard. Named for what it does rather than where the call came from, deliberately: `source === "simulator"` invites future code to hang unrelated behaviour off it, which is how the header bypass that Prerequisite A had to fix came to exist.
- `$inc prizePool` **always**, in the same transaction as the debit. **Done**, on all paths including the simulator batch route.
- One canonical contest-reference field on the ledger row. **Done** - `competitionId`. Nothing to backfill: the old `referenceId` value was never stored, because the schema does not declare it.
- Keep the WriteConflict retry from the API path. **Done**, and it turned out to be worth more than expected: concurrent joins went from **1 in 20 to 20 in 20** once Gate A inherited it.
- Calls `module.onParticipantJoin()` inside the transaction. **Not yet** - the module registry does not exist until Phase 1. The service is the single place it will hook into, which was the point.

Acceptance test: enter the same contest 20 times concurrently from both entry points and assert `prizePool === successfulJoins x entryFee` and `currentParticipants === successfulJoins`, with no wallet drift. **Written and passing** - `__tests__/services/competition-entry-concurrency.test.ts`.

One requirement that was missing from this list and had to be added during the build: **the read-then-insert seat check is not atomic.** Two joins by one player can both pass it, and the unique index on `(competitionId, userId)` is what actually stops the second seat. It reports **duplicate key 11000, not a write conflict**, so it sits outside the retry logic entirely. Any future entry path must handle it, and must handle it as *success* - the player is in, and charging them again for a seat they already have is the exact failure this whole section exists to prevent.

### Related items to clean up in the same pass

- **`challenge_refund` is in the enum with no writer.** Either implement active-challenge cancellation with refund, or add a comment that it is reserved. Leaving an unimplemented money type in an enum invites someone to assume it works.
- **`competition_refunded` notification is only sent from the admin service**, not from the main cancel path, so users refunded by the automatic "min participants not met" flow may not be told. Worth fixing - a silent refund generates support tickets.
- The finalize-time safeguard caps the stored pool to `currentParticipants x entryFee`, but **only when the pool is too high**. An under-counted pool - the actual symptom of the duplicate join paths - is not corrected, not capped and not logged; it is simply under-distributed. Once the join path is unified, turn that cap into a **loud warning** (log + admin alert) rather than a silent correction, and add the missing branch for the under-count case, so drift is visible in both directions.

---

## 3. Prize distribution for new games

No new logic. The existing model already supports what Trivia needs:

- `prizeDistribution: [{ rank, percentage }]` - must sum to 100, already validated in the admin form.
- `platformFeePercentage` - 0-50, default 20.
- Ties handled by `tiePrizeDistribution`: `split_equally` | `split_weighted` | `first_gets_all`.
- Unfilled ranks are redistributed to existing winners (not kept by the platform).
- Zero qualified winners -> whole net pool booked as `unclaimed_pool`.

Two Trivia-specific notes:

1. **Ties are far more likely.** On a 10-question quiz, many players will score identically. `split_equally` should be the default for Trivia, and the admin UI should warn if `first_gets_all` is chosen for a game with a low-cardinality score space. Without this, a 10-way tie for first with `first_gets_all` is an arbitrary payout and a support incident.
2. **Qualification thresholds need a game-appropriate analogue.** Trading uses `rules.minimumTrades` to stop someone entering and doing nothing. Trivia's equivalent is `minimumQuestionsAnswered`. This lives in `gameConfig`, and the module's settle step marks non-qualifiers `forfeited` so they are excluded from prizes exactly as `disqualified` traders are today.

---

## 4. Game Master implications

GMs currently earn a percentage of entry fees from users they referred into a competition, computed at finalization. Because it keys on `entryFee` and participant user IDs, **it works unchanged for any game**.

Decisions needed:

| Question | Recommendation |
|---|---|
| Can GMs create Trivia contests? | Yes eventually, but **not in the first release**. Gate with a new `limits.allowedGameTypes: string[]` on the subscription, defaulting to `["trading"]`. |
| Different referral % per game? | Support it via `limits.referralFeePercentageByGame`, defaulting to the existing flat rate. Lower-margin games may warrant a different share. |
| Does the GM competition creation route need changes? | Yes - `app/api/gamemaster/competitions/route.ts` inserts via **raw MongoDB**, bypassing Mongoose defaults. It must explicitly set `gameType` or documents will lack it. Flagged as risk R7. |

That raw-insert detail is exactly the kind of thing that makes a "just add a default" assumption wrong, which is why it is called out here rather than left to discovery.

---

## 5. Financial reporting by game type

Once `gameType` is on the wallet transaction and the contest, the admin financial dashboard can break revenue down by vertical - which is a genuine business capability, not just a refactor artefact. It answers "is Trivia actually profitable, or is it just cheap acquisition?", which is precisely the question the strategic review said was unanswered.

Additions to `getFinancialStats()` in `platform-financials.service.ts`:

- Entry-fee volume (GMV) by game type
- Platform fee revenue by game type
- Average entry fee, average pool size, fill rate by game type
- Prize payout ratio by game type
- Unclaimed pool by game type

`PlatformTransaction.sourceType` already has `competition` / `challenge`; add the game dimension via a `gameType` field rather than by multiplying `sourceType` values (`trivia_competition` etc.), which would break existing dashboard filters.

---

## 6. Regulatory and accounting notes

Relevant because the platform maintains a regulatory defence position, and this project touches the thing regulators care about most.

- **The money loop must stay structurally identical across games**: fixed entry fee -> pooled prize -> rank-based fixed prize. The defence rests on `performance -> score -> rank -> fixed prize`, with no monetary return tied to market movement. Adding games with the same structure **strengthens** that position, because it demonstrates the platform monetises competitive skill generally rather than leveraged market exposure.
- **Do not introduce per-game payout mechanics** that vary with a continuous variable (e.g. "win 2x your stake if you score above X"). That is a materially different legal object. Rank-based fixed prizes only.
- **Skill predominance is per game and must be assessed per game.** Trivia is defensible on knowledge; a game with a significant chance element would need its own analysis before launch. The `GameCapabilities` block is a good place to also record a `skillAssessmentRef` pointing at the legal memo for that module, so the technical registry and the legal file stay coupled.
- Keep the ledger enum stable (see `03` section 8) - historical financial records should not be retyped.

---

## 7. Testing the money layer (non-negotiable before P1)

These tests should exist **before** any game abstraction is introduced, because they are the safety net that lets everything else move fast:

1. Concurrent join: 20 parallel joins, assert pool/participants/wallet consistency.
2. Insufficient balance: assert no partial state (no participant without a debit, no debit without a participant).
3. Full payout: 10 participants, 3 prize ranks, assert sum of credits + platform fee == pool, to the cent.
4. Tie payout: 3-way tie for first under each of the three tie modes.
5. Zero qualified winners: assert whole net pool lands in `unclaimed_pool`.
6. Cancel and refund: assert every participant is made whole and `prizePool` is zeroed.
7. Double finalization: run the finalizer twice, assert winners are paid **once** (idempotency).
8. GM share: assert GM fee never exceeds the platform fee and is not paid when the subscription is inactive.

Test 7 is the one most likely to reveal a real bug, because the stuck-`finalizing` recovery path can genuinely re-run finalization after 5 minutes.
