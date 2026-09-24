# Next tasks — ChartVolt external-first programme

> **Saved 24 September 2026.** One bullet per task, priority order.
> Closed / stale-as-open items are listed so a pasted older list is not re-opened by accident.
> Authoritative phase detail stays in `PROGRESS.md` and the chapter BUILT notes.

---

## P0 — Do next (eng, no owner blockers)

1. **X10 polish — challenge result page still trading metrics** — player's own `/challenges/[id]` result still shows PnL / trades for provider games; last named X7/X10 reader after R90/R92 sweeps.
2. **X10 polish — arena FRIENDS / COUNTRY tabs** — drawn `aria-disabled`; FRIENDS has `Friendship` / `getUserFriends` available; COUNTRY still needs a data source or stays decorative with reason.
3. **Player dashboard twin of R64** — games-only player performance on the *player* dashboard (admin twin exists; deliberately unmirrored — R42).
4. **Public unauth arena broadcast leaderboard** — still trading-shaped; named canary in dashboard-live tests; fix or keep canary until deliberate rewrite.
5. **X4a content + localisation** — catalogue content set beyond `en`; mobile catalogue support.
6. **games-service `AMBIGUITY-LOG`** — 14 OPEN; each needs `01` + requirements HTML version bump, not a service-only choice.
7. **R1 residual** — under-count prize-pool safeguard for writers that skip the increment.
8. **Trading create form monolith** (~2716 lines) + trading editor thinner than create — UI debt, not a games gate.
9. **Nine `duel` vocabulary sites** outside help (landing / admin seeds) — migration question, not a wording-only pass.
10. **Full `ranking-config.service` pass** — only if still incomplete after recent sweeps; verify before scheduling.

---

## P1 — Owner / Legal (eng waits)

11. **A5 wiki bodies** — ten Game Administration skeletons; **LAST OF ALL** (owner 19 Sep).
12. **R11 — legal ToS / action-terms bodies** — counsel; last with A5.
13. **R99 — JSON 134 vs constants 128 badge catalogue merge** — owner if still wanted.
14. **R93 — credit EUR rate UI** — screen was unreachable (R93); owner scope for rebuild.
15. **R96b — game-specific badge *content*** — authoring machinery built; catalogue still needs owner-authored / generated rows.
16. **Q16 — registration-time interest picker** — product; X11.5 eng works without it.
17. **Ops backfills (report-only until `--apply`)** — X1 game-label backfill; GM earning `gameKey` backfill; phantom participant scores clear — owner decides when real production data exists.

---

## P2 — Blocked (do not schedule)

18. **X4 — real outside-provider adapter** — blocked on signed sandbox; **X4a does not replace it**.
19. **Per-round provider cost analytics + CSP `frame-src`** — need real X4 contract / play domain.
20. **GM net-of-cost economics for paying third parties** (`19` s5) — re-apply when X4 pricing exists; **first-party / zero-cost creation already shipped 23 Sep**.
21. **Turn-based / heat contests (task 10.2)**; check-in / lobby / countdown trio — blocked, not deferred by effort.
22. **Task 22 per-metric performance schema** — deliberate deviation; do not “finish”.
23. **Paid Hint / invent mid-round SCORE / Combo / XP LEVEL in arena** — fairness / protocol.
24. **Remaining `ADMIN_SECTIONS` grants** — owner “do later”.
25. **Sidebar clicks don’t write URL** — ~60 sections; with X6.5 leftovers.
26. **`closePosition` on completed/finalizing** — needs own evidence before changing.

---

## P3 — 35-task leftovers still accurate

27. **Task 8** — large game admin redesign — blocked on reference image.
28. **Tasks 15–16** — artwork optimize on upload only; do not point existing optimizer at `public/assets`.
29. **Task 17** — remove legacy game — half done (needs catalogue re-sync).
30. **Task 18** — redesign other screen — not started.
31. **Tasks 25–27, 31–35** — consistency / reviews / final audit — not started.
32. **Task 28** — settlement server-side — checked for four payout paths; guard still useful.
33. **Per-game marketplace** — not scheduled (~2 weeks after catalogue).
34. **X12** — hardening, staged pilot, public launch — not started (after X4 + polish).

---

## Do not treat as open (closed / stale on older lists)

- **X11 catalogue + games-first nav** — Slice 1 + admin workspace + themes + thin `GameCatalogueEntry` **CODE-COMPLETE** 21–22 Sep (eng). Marketplace-by-game still out of scope.
- **X11.5 interest / matchmaking** — **CODE-COMPLETE 23 Sep (eng)**; Q16 registration picker still open.
- **X10 core + X15 abuse controls** — any-game challenges, opponent picker, open challenges, notifications, expiry clocks, willingness, block list + invite rate limit — **built**; Q15 closed 22 Sep (create is not friends-only).
- **`/play` ↔ `/trade` dispatcher** — **COMPLETE 23 Sep** (provider→play and reverse).
- **Task 9 leftovers** (analytics by category + discovery filter) — **CLOSED 23 Sep**.
- **GM provider construction UI** — **CODE-COMPLETE 23 Sep**; s5 suspended for first-party / zero-cost.
- **AppSettingsProvider unmounted / credit symbol in admin** — **R110** (18 Sep).
- **X9 / dedicated re-settle / incident hub** — X9 **CODE-COMPLETE** 20 Sep; incident hub **BUILT** 21 Sep.
- **X8 player wording** — eng shell + owner content passes **DONE** 20 Sep; only R11 + A5 remain.
- **X6.5 eng** — **CLOSED**; A5 bodies = owner last.
- **X4a** — **OWNER CLICK-ACCEPTED** 20 Sep; Risk X8 closed.
- **X0–X3, X5, X7 steps 1–5** — code-complete (ops backfills / R96b content / Q14 default board as noted above).
- **Friday catalogue auto-sync + 7-day stale banner** — **shipped 24 Sep** (`ff2e4b04`).
- **GM Active comps X/max + min-entrants rule** — **shipped 24 Sep** (`b215efe5` + `46b1a868`).

---

## X-phase snapshot (24 Sep 2026)

| Phase | Status |
|---|---|
| X0–X3, X5 | CODE-COMPLETE (X1 backfill not `--apply`’d; X3 rehearsals 7–10 need later phases) |
| X4a | OWNER CLICK-ACCEPTED |
| X4 | NOT STARTED — blocked on signed outside provider |
| X6 | PARTIAL — admin destinations + GM create done; per-round cost waits on X4 |
| X6.5 | Eng CLOSED; A5 wiki bodies owner / last |
| X7 | Steps 1–5 code-complete; R96b content + backfill ops open; default board still legacy (Q14) |
| X8 | Eng + owner content DONE; R11 + A5 left |
| X9 | CODE-COMPLETE |
| X10 | Core + X15 done; polish items 1–2 above |
| X11 | CODE-COMPLETE (eng) for catalogue / nav / merchandising |
| X11.5 | CODE-COMPLETE (eng); Q16 open |
| X12 | NOT STARTED |
| Per-game marketplace | NOT SCHEDULED |

---

## Preferred next eng session

**Start with P0 #1 or #2** (challenge result page metrics, or arena FRIENDS wiring).  
Do **not** re-open X11 / X11.5 as greenfield.  
Do **not** schedule X4 until a signed sandbox exists.  
Keep A5 wiki and R11 for the end.
