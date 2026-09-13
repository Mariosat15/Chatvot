# ChartVolt — Executive Summary (One Page)

*Reflects the platform as it actually exists in the product today. Roadmap items are
labeled. Default fees/limits are operator-configurable in the admin panel.*

---

### What it is
**ChartVolt is a gamified trading competition platform** — "fantasy sports for traders."
Users trade **live forex prices** with **virtual capital** (zero market risk), and compete
for real prize pools in **tournaments** and **1v1 challenges**. Engagement is driven by
leaderboards, badges, 20 trader levels, a marketplace, and a creator program. The platform
is **white-label** — partners can run it under their own brand.

### What is REAL today (live in the product)
- **Live trading simulator** — real-time forex prices (bid/ask), leverage, stop-loss/take-profit,
  margin and liquidation. Engine is **forex-focused** (~28 pairs).
- **Competitions** — entry fee, shared prize pool, live leaderboard, automated lifecycle.
- **1v1 Challenges** — head-to-head, winner takes the pool minus platform fee.
- **Volt Credits wallet** — deposits → credits → play → winnings → withdrawals, fully ledgered.
- **Marketplace** — indicators, strategies, cosmetics, Game Master packages (prices set by operator).
- **Game Master program** — users host their own competitions and earn referral income.
- **Progression** — badges, levels/titles, journey map; tutorials + Help Center.
- **Payments** — card deposits via **Nuvei (primary)**; Stripe path also present.
- **Protection** — KYC (Veriff), fraud/anti-cheat, signed & idempotent payment webhooks,
  automated chargeback evidence reports, withdrawal limits, reconciliation, audit logs.
- **Infrastructure** — multi-server (primary price engine + scalable secondaries via Redis),
  MongoDB, real-time streaming. Built to scale horizontally.

### On the roadmap (NOT fully live yet — stated honestly)
- **Additional asset classes** (indices, crypto, stocks) — supported in data schema/UI, but the
  live price/trading engine is **forex-only** today.
- **Stripe/Paddle** as full equals to Nuvei (Nuvei is the complete, primary integration).

### Who it's for
Aspiring & retail traders, competitive gamers, and trading-content creators — plus **B2B
white-label partners** (brokers, educators, fintech brands) who want a branded competition product.

### The opportunity
Retail trading is booming but most users lose money and churn. ChartVolt delivers the
**thrill and skill of trading with a small, fixed, known cost** instead of uncapped losses —
better retention, lower regulatory weight (simulated trading), and a licensable platform.

### How it makes money (fees & sales — never from user losses)

| Source | Default |
|--------|---------|
| Deposit fee | **2%** |
| Withdrawal fee | **2%** |
| Competition fee | **20%** of prize pool |
| 1v1 challenge fee | **10%** of prize pool |
| Marketplace & Game Master sales | item / package price |
| Unclaimed pools & lapsed creator fees | retained by platform |

**Key real figures:** 100 Volt Credits = **€1** · min deposit **€10** · min withdrawal **€20** ·
VAT **21%** where applicable · GM referral share **5%** (defaults; configurable).

### Fund flow (one line)
Card deposit (+2% fee, +VAT) → Volt Credits (100 = €1) → entry fees / purchases → prizes
(minus 10–20% platform fee) → withdrawal (−2% fee) to bank. Customer wallet and platform
revenue are separately ledgered and auto-reconciled.

### Growth plan
1. **Launch & prove** — one core market, forex contests, first Game Masters, flagship tournaments.
2. **Scale** — creator-led + paid acquisition, more regions/languages, broader marketplace.
3. **Platform** — white-label/B2B partners, each bringing their own audience.

### Turnover forecast — *illustrative model (assumptions, not a promise)*
Assumes ~**€8 blended revenue per active user / month**.

| Year | Avg. monthly active users | Annualized platform revenue |
|------|---------------------------|------------------------------|
| Year 1 | 2,000 | **~€190K** |
| Year 2 | 10,000 | **~€960K** |
| Year 3 | 30,000 | **~€2.9M** |

Biggest levers: **active users** (creator network), **engagement per user**, **deposit
frequency**, and **white-label partners**. Main variable cost is payment processing
(~2.9% + €0.30/deposit), partly offset by platform fees.

---

> **In one sentence:** ChartVolt makes trading a fair, fun, capped-risk competition —
> earning from transparent fees, protecting company, bank, and customer at every layer, and
> built white-label on scalable infrastructure to grow from a focused launch into the engine
> behind many branded trading-competition products.
