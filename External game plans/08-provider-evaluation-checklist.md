# 08 - Provider Evaluation Checklist

Use this to assess any candidate provider **before** signing or building.

---

## 1. Gate 1 - the eliminators

Any single "no" here disqualifies the provider for paid contests. Ask these first;
they take one email and save weeks.

| # | Question | Required answer |
|---|---|---|
| 1 | Are game outcomes determined by **player skill**, not chance? | **Yes** |
| 2 | Do you send results **server-to-server**, never via the player's browser? | **Yes** |
| 3 | Are result callbacks **cryptographically signed**? | **Yes** |
| 4 | Can we **pull** a round's result on demand if a webhook is lost? | **Yes** |
| 5 | Are round creation and result delivery **idempotent**? | **Yes** |
| 6 | Can you guarantee **identical content** for all players via a seed we supply? | **Yes** |
| 7 | Is there a **sandbox** with test credentials? | **Yes** |
| 8 | Do you require access to player balances or handle money in any way? | **No** |
| 9 | Do you declare, per game, whether a **higher or lower score wins**? | **Yes** |
| 10 | Are `gameCode` values **stable and never reused**? | **Yes** |

> **Question 1 is the most important and the easiest to get wrong.** A provider can
> describe products as "games" while supplying chance-based products. Ask directly:
> *"Is the outcome determined by the player's decisions, or by a random number
> generator?"* If the catalogue mentions RTP, house edge, volatility or free spins,
> the answer is chance, and the entire regulatory position of the platform changes.

---

## 2. Gate 2 - scored assessment

Score each 0 to 5, multiply by the weight, and compare candidates on the total.
Maximum 250.

### 2.1 Result integrity - weight 10 (max 50)

| Criterion | 0 | 5 |
|---|---|---|
| Signing | None | HMAC over raw body + timestamp + replay protection |
| Pull endpoint | None | Full state, same shape as the callback |
| Idempotency | Not guaranteed | Documented, with stable event identifiers |
| Terminal states | Rounds can hang | Every round always terminates |
| Anti-cheat signals | None | Integrity flags with detail on every result |

### 2.2 Content fairness - weight 8 (max 40)

| Criterion | 0 | 5 |
|---|---|---|
| Seeding | Not supported | Deterministic, with shuffled presentation per player |
| Content volume | Small fixed set | Large pool, low repetition |
| Configurability | Fixed | Rich, exposed as a schema |
| Difficulty consistency | Unknown | Measured and stated |

### 2.3 Contest fit - weight 8 (max 40)

| Criterion | 0 | 5 |
|---|---|---|
| Independent-play games available | None | Several, in different categories |
| Challenge support | None | Native, both independent-play and head-to-head |
| Round length | > 15 min or unpredictable | 2-6 min, predictable |
| Practice mode | None | Free, unranked, fully supported |

### 2.4 Commercials - weight 7 (max 35)

| Criterion | 0 | 5 |
|---|---|---|
| Pricing model | Per round, expensive | Flat licence or revenue share |
| Cost per round | Material against entry fees | Negligible |
| Minimum commitment | Large upfront | None or small |
| Exit terms | Long lock-in | 30-90 day notice |

### 2.5 Reliability and operations - weight 7 (max 35)

| Criterion | 0 | 5 |
|---|---|---|
| Written SLA | None | >= 99.5%, with credits |
| Incident communication | Ad hoc | Status page and proactive notification |
| Support responsiveness | Email, days | Named contact, hours |
| API versioning | Breaking changes without notice | Versioned, 90 days notice |

### 2.6 Content quality and breadth - weight 5 (max 25)

Visual quality, mobile performance, localisation, catalogue size, release cadence.

### 2.7 Compliance and data - weight 5 (max 25)

Data processing agreement, hosting locations, sub-processors, breach notification,
whether they hold gaming certifications relevant to our jurisdictions.

### Scoring guide

| Total | Verdict |
|---|---|
| 200+ | Strong. Proceed to pilot |
| 160-199 | Workable. Negotiate the weak areas first |
| 120-159 | Significant gaps. Only with a clear remediation commitment |
| < 120 | Reject |

---

## 3. The commercial model - do the arithmetic early

Provider pricing decides whether cheap contests are viable, and it is easy to
discover this too late.

| Model | Effect on us |
|---|---|
| **Flat monthly licence** | **Best.** Cost per round falls as volume rises. Free contests remain viable |
| **Revenue share on our fee** | **Good.** Aligned incentives, scales naturally, no risk on quiet days |
| **Per active player per month** | Workable. Predictable if churn is understood |
| **Per round** | **Dangerous.** Every attempt costs money whether or not the contest earns |

### 3.1 The per-round trap, with numbers

Assume a contest with a €1 entry fee, 20 players, and a 10% platform fee.

| | Value |
|---|---|
| Prize pool | €20.00 |
| ChartVolt revenue | €2.00 |
| Rounds played, `single` attempts | 20 |
| Rounds played, `best_of_3` | up to 60 |

| Provider price per round | Cost at `single` | Cost at `best_of_3` | Outcome |
|---|---|---|---|
| €0.01 | €0.20 | €0.60 | Fine |
| €0.05 | €1.00 | €3.00 | **`best_of_3` loses money** |
| €0.10 | €2.00 | €6.00 | **Break-even at best; heavy loss with retries** |

Two conclusions worth carrying into the negotiation:

1. **Per-round pricing above about €0.02 makes low-entry contests unviable**, which
   are exactly the contests needed to attract new players.
2. **Any per-round model must cap attempts.** `unlimited_in_window` with per-round
   pricing is an uncapped liability, and should simply not be offered.

Also confirm: **are practice rounds billed?** If they are, free practice - the thing
that converts new players - becomes a direct cost per curious visitor.

---

## 4. Questions to send a candidate provider

### Technical

1. Do results arrive server-to-server, signed, with a timestamp?
2. Can we pull a round's state at any time?
3. Are round creation and result delivery idempotent, and on which keys?
4. Can we supply a seed guaranteeing identical content across players?
5. Is presentation order shuffled per player while content stays identical?
6. Can a round be given an expiry we control?
7. Can we void or cancel a round?
8. What is the complete list of terminal states, and can a round ever hang?
9. Do you report partial scores for abandoned rounds?
10. Do you provide a per-round replay or audit URL?
11. Do you provide integrity or anti-cheat signals?
12. Is there a sandbox, and can we force arbitrary results in it?
13. How long are rounds and replays retained?
14. How do you version the API, and what notice is given for breaking changes?

### Product

15. Which games are independent-play, and which require an opponent?
16. Typical and maximum round duration per game?
17. Is there a practice mode, and is it billed?
18. Which languages and platforms are supported?
19. How large is the content pool per game, and how often does it refresh?
20. How often are new titles released?
21. Can we white-label the look to match ChartVolt?

### Fairness and integrity

22. How do you prevent client manipulation?
23. Have you had a cheating incident, and how was it handled?
24. Can two players collude within your games?
25. How do you confirm two players faced equivalent difficulty?

### Commercial and legal

26. What is the pricing model, exactly?
27. Are practice and abandoned rounds billed?
28. Minimum commitment, term, notice period?
29. What is the written SLA and what are the remedies?
30. Which jurisdictions do you already operate in?
31. Do you hold any gaming or fairness certifications?
32. Will you sign a data processing agreement, and where is data hosted?
33. Who is liable if a scoring defect causes an incorrect payout?

> **Question 33 is the one most often skipped.** If a provider bug pays €5,000 to the
> wrong player, who bears it? Settle that in the contract, not after the incident.

---

## 5. Pilot before committing

Never move to paid contests directly from a demo.

| Stage | Duration | Exit criteria |
|---|---|---|
| **Sandbox integration** | 1-2 weeks | Full round lifecycle works, including all the failure rehearsals in `07` |
| **Internal free contests** | 1 week | Staff play real contests with no entry fee. Scores, ranking, rewards all correct |
| **Internal paid contests** | 3-5 days | Real, tiny entry fees. Money verified to the cent |
| **Limited public** | 2 weeks | One game, low entry fee, capped players. Watch dispute and unresolved rates |
| **Full launch** | - | Only after the metrics below hold |

### Metrics that must hold before full launch

| Metric | Threshold |
|---|---|
| Rounds resolved by callback | > 99% |
| Rounds needing reconciliation | < 1% |
| Rounds never resolved | **0** |
| Invalid signatures | **0** |
| Contests settled late | < 1% |
| Payout discrepancies | **0** |
| Disputes | < 0.5% of rounds |
