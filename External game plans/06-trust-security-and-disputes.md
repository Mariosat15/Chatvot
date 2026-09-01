# 06 - Trust, Security and Disputes

A number arrives from a third party over the internet and decides who receives real
money. This document is about making that trustworthy.

---

## 1. The threat model

| # | Threat | Consequence |
|---|---|---|
| T1 | Forged result posted to our callback endpoint | Attacker awards themselves any score and takes the pot |
| T2 | Genuine result replayed | A good score counted repeatedly, or an old score applied to a new contest |
| T3 | Score injected from the player's browser | Trivially forged with dev tools |
| T4 | Player manipulates the game client | Inflated scores that the provider believes are real |
| T5 | Multiple accounts entering one contest | One person occupies several prize positions |
| T6 | Collusion in challenges | Two accounts trade wins to farm points and drain a pool |
| T7 | Provider compromised or dishonest | Every score becomes untrustworthy |
| T8 | Result arrives after settlement | Prizes already paid; the score cannot be honoured |
| T9 | Round replayed with a known content seed | Player sees the questions first, then plays for real |
| T10 | Player disputes a score | No evidence with which to answer |

---

## 2. Verifying an inbound result

Every callback passes the same gate, in this order. **Any failure stops
processing** - but the raw event is stored regardless.

```
1. Store the raw event first          (evidence before logic)
2. Provider known and enabled?
3. Bearer token matches?
4. X-Timestamp present and within 5 minutes?      -> blocks T2
5. HMAC over the RAW BODY BYTES matches?          -> blocks T1
6. eventId not already processed?                 -> blocks T2, idempotency
7. roundId exists and belongs to this provider?
8. Round is in a state that can accept a result?
9. Contest still open, or inside its grace period? -> handles T8
10. Score within the game's declared scoreRange?
11. Process, then mark the event processed
```

### 2.1 Points that are easy to get wrong

**Sign the raw bytes, not a parsed object.** Re-serialising JSON before verifying
changes key order and number formatting, and produces failures that appear
intermittent and cost days to diagnose. The endpoint must read the raw body before
any framework parses it.

**Use constant-time comparison** for signatures. A plain string comparison leaks
timing information.

**Return 200 as soon as the event is stored and queued**, not after all downstream
work. Providers retry on timeouts, and slow badge or leaderboard recomputation
should never cause a duplicate delivery.

**Never trust `occurredAt` for security.** It is provider-supplied data. Use our own
`X-Timestamp` check for replay protection and our own clock for ordering.

**Rate-limit the endpoint per provider.** A compromised or malfunctioning provider
should not be able to flood it.

**Allowlist source IPs** if the provider can supply a stable range. Useful defence
in depth, but never the only control - IPs change.

---

## 3. Never trust the client

| What the browser may tell us | Trusted? |
|---|---|
| "The game finished, refresh the screen" | Yes - a UI hint only |
| "Close the iframe" | Yes |
| "Resize to N pixels" | Yes |
| **"My score was 9,800"** | **Never** |
| "I completed the round" | No - only the provider's callback confirms this |

Every `postMessage` is checked against the provider's declared origin and matched
against a small allowlist of message types. Anything else is discarded silently.

This is the same principle already applied in the trading engine, where a price sent
from a browser is never accepted.

---

## 4. Content seed integrity - blocking T9

The seed guarantees fairness but creates a risk: a player who learns the content in
advance has an enormous advantage.

| Control | Detail |
|---|---|
| Seed is opaque | A random value with no relationship to the contest ID, so it cannot be guessed |
| Seed is never sent to the client | It goes only in the server-to-server round creation call |
| Practice never shares a ranked seed | A practice round must use a different seed, or practice becomes a preview |
| One live round per player per contest | Stops opening a round to view content, abandoning, and reopening |
| Attempts consumed on creation | Removes the value of abandoning a round after seeing the content |
| Provider must not expose content by seed | Explicitly required - no public endpoint that returns content for a given seed |

> **The abandon-and-peek attack is the one most likely to be missed.** Without
> attempts being consumed at creation, a player opens a round, reads the questions,
> abandons, looks up the answers and starts again. Consuming the attempt at creation
> closes it completely.

---

## 5. Multiple accounts and collusion

Reuses ChartVolt's existing fraud infrastructure, which already covers device
fingerprinting, IP intelligence, suspicion scoring and entry limits.

| Threat | Control |
|---|---|
| T5 - multiple accounts | Existing fraud gate at contest entry, extended to count entries across **all** game types rather than trading alone |
| T5 - same device, one contest | Flag when several accounts on one device or IP enter the same contest. Review before paying |
| T6 - challenge collusion | Detect repeated pairings between the same two accounts. Steeply reduce points, and review if credits flow consistently one way |
| T6 - pool draining | Alert when a small group repeatedly occupies the top positions of the same contests |

The entry-limit change is easy to overlook and important: a limit counting only
trading entries becomes meaningless the moment most contests are provider games.

---

## 6. Provider-side cheating - T4

Client manipulation is the provider's problem, but it is **our money**. So:

1. **Require the `integrity` block** in results. The provider sees things we cannot -
   impossible reaction times, automation signatures, identical input patterns.
2. **Hold, do not block.** A flagged result still settles the contest, but payment
   for that contest is suspended pending review. Blocking silently is worse than
   paying and clawing back, because the player never learns why.
3. **Statistical monitoring on our side.** Watch for scores far outside the historical
   distribution for a game, sudden step changes in a player's performance, and
   improbable consistency.
4. **A per-game score ceiling.** Reject anything outside the declared `scoreRange` -
   this catches both cheating and provider bugs.

---

## 7. Disputes

Real prize money means real disputes. They need an answer that is not "the provider
says so".

### 7.1 What we must be able to show

| Question | Evidence |
|---|---|
| "What was my score?" | `game_round.rawScore` and `scoreBreakdown` |
| "What did I actually play?" | `configSnapshot` and `replayUrl` |
| "Did everyone get the same content?" | The shared `contentSeed` on every round in the contest |
| "When did I finish?" | `startedAt`, `completedAt`, `durationMs` |
| "Why was I not scored?" | Round status and the reason it reached it |
| "Is this really what the provider sent?" | The raw event in `provider_event`, with a valid signature |

That last row is why raw events are stored before processing. It converts a dispute
from an argument into a lookup.

### 7.2 The process

```
Player raises a dispute
   -> support opens the round record and the raw event
   -> signature valid and score matches?  ->  explain, with the replay link
   -> discrepancy found?                  ->  escalate to the provider with roundId
   -> provider confirms an error          ->  void the round, re-settle the contest,
                                              adjust credits, notify everyone affected
```

**Re-settlement must be a supported operation, not an emergency.** A contest that has
already paid out sometimes has to be corrected. Design for it: settlement must be
idempotent and reversible, with a full audit trail of both the original and the
corrected outcome. Discovering this requirement during a live dispute is the worst
possible time.

---

## 8. Secrets and access

| Secret | Handling |
|---|---|
| Provider API key and secret | Environment variables, mirrored into settings like existing keys. **Never sent to the client** |
| Callback secret | Same. Rotatable without downtime by accepting both old and new during a rotation window |
| Launch URLs | Contain a short-lived token. Never logged, never stored beyond the round record |
| Player identifiers | Pseudonymous and opaque. Not the Mongo `_id`, so provider logs cannot be joined to our records if leaked |

**Rotation must be possible without downtime.** A provider secret leaked at 2am is a
much smaller problem if rotation is a settings change rather than a deployment.

---

## 9. Audit trail

Every score that moves money must be traceable end to end:

```
provider_event (raw bytes + signature)
    -> game_round (configSnapshot, seed, score, timings)
        -> participant.score
            -> final ranking
                -> wallet_transaction (prize credited)
```

Each link is queryable in both directions. Given a credit in a player's wallet, we
can reach the exact bytes the provider sent that justified it - which is the standard
the existing financial reconciliation already sets.

---

## 10. Monitoring and alerts

| Alert | Threshold | Severity |
|---|---|---|
| Invalid signature received | Any occurrence | **Critical** - either an attack or a broken deployment |
| Round unresolved past its grace period | Any occurrence | **Critical** - money is waiting |
| Contest stuck in settling | > 10 minutes | **Critical** |
| Prizes paid + fee != prize pool | Any discrepancy | **Critical** |
| Callback failure rate | > 1% in an hour | High |
| Provider latency | p95 > 5s | High |
| Score outside declared range | Any occurrence | High |
| Integrity flag raised | Any occurrence | Medium - queue for review |
| Repeat challenge pairing | Above threshold | Medium |
| Catalogue sync failing | > 24h stale | Low |

The first four are the ones worth waking someone for, because each one means money
is either at risk or already wrong.
