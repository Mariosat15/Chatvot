# 10 - Trivia Module Specification

The first new game, specified end to end. It is deliberately the **reference implementation** of the Game Module contract: if Trivia needs a change outside `lib/games/trivia/` and its own models/routes/components, the contract is wrong.

---

## 1. Product definition

**Format:** A timed quiz competition. Players pay an entry fee, answer a fixed set of multiple-choice questions, and are ranked by score. Top ranks share the prize pool by the same percentage table trading competitions already use.

**Play mode for v1: asynchronous within a window.** The contest is open from `startTime` to `endTime`; each player starts when they choose and gets their own per-question timer. Simpler to build, no presence requirement, no synchronisation bugs, and it works across time zones.

**Deferred to v2:** synchronised live rounds (everyone answers question 5 at the same moment). Better spectacle, materially harder - needs websocket push, presence handling, and a policy for players who join late or drop.

**Scoring:** correctness + speed + streak. Speed matters, so answering fast is rewarded, which keeps the game tense and discourages looking answers up.

---

## 2. Capabilities declaration

```ts
capabilities: {
  needsPriceFeed:     false,      // no market data at all
  needsMarketHours:   false,      // must NOT be blocked by forex holidays
  supportsElimination: false,     // no liquidation analogue
  scoreUpdates:       "discrete", // score changes per answer, already persisted
  supportsChallenges: true,       // 1v1 quiz challenges work well
  requiresSyncPlay:   false,      // v1 is asynchronous
}
```

The `needsMarketHours: false` line is load-bearing: without it, the existing `blockCompetitionsOnHolidays` setting would block Trivia entry on forex holidays, which would be a baffling bug.

---

## 3. Data model

### `TriviaQuestion`

`database/models/games/trivia/trivia-question.model.ts` (+ admin mirror)

| Field | Type | Notes |
|---|---|---|
| `prompt` | String, required | The question text |
| `options` | [String], required | 2-6 options |
| `correctIndex` | Number, required | **Never sent to the client** |
| `explanation` | String | Shown in post-contest review |
| `categoryId` | String, required, indexed | |
| `difficulty` | Number 1-5, required, indexed | Drives difficulty mix |
| `mediaUrl` | String | Optional image |
| `tags` | [String] | |
| `active` | Boolean, default true, indexed | Soft retire |
| `timesServed` | Number, default 0 | Quality stats |
| `timesCorrect` | Number, default 0 | Quality stats |
| `source` | String | `manual` \| `ai` \| `import` |
| `approvedBy` | String | Required before `active` if `source === "ai"` |

Indexes: `{ active, categoryId, difficulty }` for selection; text index on `prompt` for duplicate detection.

### `TriviaCategory`

`name`, `slug` (unique), `description`, `icon`, `active`, `questionCount` (denormalised).

### `TriviaContestSet`

The **locked** question list for one contest, generated when the contest starts.

| Field | Notes |
|---|---|
| `contestId` | unique, indexed |
| `contestKind` | `competition` \| `challenge` |
| `questionIds` | [String], ordered |
| `generatedAt` | Date |
| `config` | snapshot of the `gameConfig` used |

Why this exists: (a) every player gets the same questions, so the contest is fair and comparable; (b) settlement is deterministic and re-runnable; (c) a disputed result can be audited. Selecting questions per player on the fly would make all three impossible.

### `TriviaAnswer`

| Field | Notes |
|---|---|
| `contestId`, `contestKind`, `userId`, `questionId` | identity |
| `questionIndex` | position in the set |
| `selectedIndex` | Number, null if timed out |
| `isCorrect` | Boolean |
| `elapsedMs` | **server-computed** from `servedAt` to receive time |
| `pointsAwarded` | Number |
| `streakAtAnswer` | Number |
| `servedAt`, `answeredAt` | Dates |

**Unique compound index `{ contestId, userId, questionId }`** - this is what makes answer submission idempotent and blocks double-scoring from a double-click, a retry or a replay attempt. Without it, the scoring is exploitable.

Growth: participants x questions per contest. Add an archival/TTL policy, and consider not keeping answers for cancelled contests.

---

## 4. Game config (admin-set per contest)

```ts
{
  categoryIds: string[];          // one or more; [] = all active
  questionCount: number;          // default 20, range 5-100
  secondsPerQuestion: number;     // default 15, range 5-120
  difficultyMix: {                // must sum to questionCount, or use "auto"
    mode: "auto" | "manual";
    easy?: number; medium?: number; hard?: number;
  };
  basePoints: number;             // default 100 per correct answer
  maxSpeedBonus: number;          // default 50
  streakBonusPerLevel: number;    // default 10
  streakBonusCap: number;         // default 50
  minQuestionsToQualify: number;  // default = ceil(questionCount / 2)
  shuffleOptions: boolean;        // default true - per participant
  allowSkip: boolean;             // default false
  reviewAnswersAfterContest: boolean; // default true
  singleAttempt: boolean;         // default true
}
```

`validateConfig()` must check: at least one active category exists with enough active questions for `questionCount` at the requested difficulty mix. **Failing this at creation time rather than at contest start is essential** - discovering at start that there are only 12 questions for a 20-question contest means either cancelling with refunds or degrading the contest, both bad.

---

## 5. Scoring

```
perQuestion:
  if incorrect or timed out -> 0
  if correct:
      base       = basePoints
      speedRatio = max(0, (allowedMs - elapsedMs) / allowedMs)
      speed      = round(maxSpeedBonus * speedRatio)
      streak     = min(streakBonusCap, streakBonusPerLevel * (consecutiveCorrect - 1))
      points     = base + speed + streak

score = sum(perQuestion points)
completionTimeMs = sum(elapsedMs)          // tie-breaker
```

`elapsedMs` is **always** computed server-side as `answeredAt - servedAt`, both server clocks. A client-supplied elapsed time is not trusted for the same reason client-supplied prices are not trusted in the trading engine.

If `answeredAt - servedAt > allowedMs + grace`, the answer is scored as a timeout regardless of correctness. Grace of ~1500ms absorbs network latency without opening a meaningful cheating window.

Ranking methods offered: `score` (default), `score_then_time`, `accuracy`.

`computeScore()` returns raw score. `normalizedPoints` comes from the shared rank-based formula in `04` - Trivia does not compute it.

---

## 6. Lifecycle implementation

### `onContestStart(ctx)`

1. Select questions: filter `active` by `categoryIds` and difficulty mix, sample randomly, weighted to prefer lower `timesServed` so the bank rotates.
2. Create `TriviaContestSet`.
3. If insufficient questions: return an error that the engine surfaces as a **cancel-and-refund** (reuse the existing "min participants not met" cancellation path - it already refunds correctly). Do not start a degraded contest.

### `onParticipantJoin(ctx)`

Returns initial `gameState`:

```ts
{ currentIndex: 0, answered: 0, correct: 0, currentStreak: 0,
  bestStreak: 0, startedAt: null, finishedAt: null,
  optionOrder: {} /* per-question shuffle seed */ }
```

Plus `score: 0`. No wallet or capital fields are touched.

### Gameplay (not a contract method - the module's own API routes)

| Route | Purpose |
|---|---|
| `GET /api/games/trivia/[contestId]/state` | Current question (prompt + shuffled options, **no correct index**), index, remaining time, score so far |
| `POST /api/games/trivia/[contestId]/answer` | `{ questionId, selectedIndex }` -> grades server-side, writes `TriviaAnswer`, updates participant score/streak/gameState, returns correctness (+ explanation if configured) and next question |
| `POST /api/games/trivia/[contestId]/start` | Marks `startedAt`, serves question 1 |

Guards on every call: contest is `active`, participant exists and is `active`, contest not paused, `singleAttempt` not already consumed, question matches the expected index (prevents skipping ahead), and the idempotency index catches replays.

`servedAt` must be written when a question is served, not trusted from the client - otherwise the speed bonus is forgeable.

### `settleContest(ctx)`

Idempotent:
1. For every participant, mark unanswered questions as timed-out zero-score rows (so the record is complete for review).
2. Recompute score from `TriviaAnswer` rows - **the answers are the source of truth**, not the running counter. This makes settlement self-correcting if a live update was ever lost, mirroring how trading finalization reconciles from `TradeHistory`.
3. Set `status`: `completed` if `answered >= minQuestionsToQualify`, else `forfeited`.
4. Set `completionTimeMs`.
5. Return `updated[]` for the engine to persist and rank.

Running it twice must produce identical results - guaranteed by recomputing from answers rather than incrementing.

### `checkEarlyEnd(ctx)`

Optional: if every participant has `finishedAt` set, the contest can finalize before `endTime`. A nice touch - nobody wants to wait 6 hours for a prize when everyone finished in 10 minutes. Must be careful with contests still open for registration.

---

## 7. UI

New under `components/games/trivia/`:

| Component | Purpose |
|---|---|
| `TriviaGameplay.tsx` | Container: fetches state, manages the timer, submits answers |
| `QuestionCard.tsx` | Prompt, optional media, option buttons, per-question countdown ring |
| `AnswerFeedback.tsx` | Correct/incorrect flash, points earned, streak indicator, explanation |
| `TriviaProgressBar.tsx` | Question X of N, running score |
| `TriviaLiveRanking.tsx` | Thin wrapper over the shared ranking panel |
| `TriviaResultsReview.tsx` | Post-contest question-by-question review |
| `TriviaLobbyInfo.tsx` | How to play, category, question count, timing, scoring explanation |

UX requirements that matter for fairness and trust:
- The timer must be **server-authoritative**; the client displays a countdown derived from the server's `servedAt` and reconciles on each response. A purely client-side timer drifts and can be paused by tabbing away.
- Handle refresh/disconnect gracefully: on reload, `GET state` returns the same current question with correctly reduced remaining time. Losing a question to a dropped connection in a paid contest is a refund request.
- Disable option buttons immediately on click to prevent double submission (belt and braces alongside the unique index).
- No back navigation to previous questions when `allowSkip` is false.

---

## 8. Fairness and anti-cheat

| Vector | Mitigation |
|---|---|
| Looking up answers | Tight `secondsPerQuestion`, speed bonus rewards instant recall |
| Sharing answers between players | Per-participant option shuffling means "the answer is B" is useless; same question set but different order per player |
| Multi-accounting | Existing fraud gate, device fingerprint, `maxEntriesPerHour` - **must be extended to count non-trading entries** (see `12`, R9) |
| Automated solving (bots) | Existing device fingerprinting; per-question minimum answer time (e.g. reject sub-300ms as suspicious); flag statistically improbable accuracy+speed for review |
| Client clock manipulation | Server-side timing only |
| Replay / double submit | Unique index + expected-index guard |
| Question bank leakage | Rotate by `timesServed`, retire questions with anomalous correct rates, keep the bank large relative to `questionCount` |

Recommended minimum bank size: at least 10x `questionCount` per category to make memorisation impractical. Worth stating as an operational rule in the admin.

---

## 9. Terminology pack

```ts
terminology: {
  player: "Player", players: "Players",
  score: "Score", contest: "Quiz", contests: "Quizzes",
}
```

---

## 10. Build order and estimate

| Step | Estimate |
|---|---|
| Models + indexes (+ admin mirrors) | 2 days |
| Module skeleton implementing the contract | 2 days |
| Question selection + contest set generation | 2 days |
| Gameplay API (state / start / answer) with guards and idempotency | 4 days |
| Scoring + settlement (idempotent, recompute from answers) | 3 days |
| Gameplay UI | 5 days |
| Lobby + results review | 3 days |
| Admin question bank + categories + settings | 7 days (counted in `07`) |
| Tests (scoring, idempotency, timing, fairness) | 3 days |
| **Total** | **~24 days excluding admin, ~31 including** |

---

## 11. Acceptance criteria

- An admin creates a Trivia competition with an entry fee, sets prize ranks, and launches it.
- Players join through the **same** entry service, wallet debit and ledger row as a trading competition.
- Players answer questions; scores update live; the leaderboard ranks by score with time as tie-break.
- At `endTime` the contest finalizes: unanswered questions are zeroed, non-qualifiers forfeited, ranks computed, prizes paid, platform fee and unclaimed pool recorded, notifications sent, XP and points awarded.
- Cancelling before start refunds every participant.
- Running the finalizer twice pays winners exactly once.
- **No trading code executes at any point** in the above, and no price feed request is made.
- Turning trading off entirely leaves the whole flow working.
