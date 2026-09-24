# Next tasks — ChartVolt external-first programme

> **Updated 24 September 2026 (afternoon).** One bullet per task, priority order.
> Closed / stale-as-open items are listed so a pasted older list is not re-opened by accident.
> Authoritative phase detail stays in `PROGRESS.md` and the chapter BUILT notes.

---

## P0 — Do next (eng, no owner blockers)

1. **games-service `AMBIGUITY-LOG`** — A1–A11 RESOLVED (24 Sep, HTML v1.6–v1.16); remaining OPEN (A12+) need `01` + requirements HTML version bump. Continue from next OPEN entry in the log. **A9 platform wiring closed** the same day — `durationMs` / `scoreCompletedAt` thread through seat sync → settlement → `getProviderTieBreakerValue`.
2. **X4a content + localisation** — catalogue beyond `en`; mobile catalogue support.
3. **Nine `duel` vocabulary sites** outside help (landing / admin seeds) — migration question for seeded defaults, not a wording-only pass.
4. **Trading create form monolith** (~2716 lines) + trading editor thinner than create — UI debt, not a games gate.
5. **Full `ranking-config.service` pass** — verify against recent sweeps before scheduling; may already be largely done.
6. **Task 17** — remove legacy game — half done; needs catalogue re-sync (ops).
7. **Task 18** — redesign other screen — not started (needs owner reference if any).

---

## P1 — Owner / Legal (eng waits)

8. **A5 wiki bodies** — ten Game Administration skeletons; **LAST OF ALL** (owner 19 Sep).
9. **R11 — legal ToS / action-terms bodies** — counsel; last with A5.
10. **R99 — JSON 134 vs constants 128 badge catalogue merge** — owner if still wanted.
11. **R93 — credit EUR rate UI** — screen was unreachable; owner scope for rebuild.
12. **R96b — game-specific badge *content*** — authoring machinery built; catalogue still needs owner-authored / generated rows.
13. **Q16 — registration-time interest picker** — product; X11.5 eng works without it.
14. **Ops backfills (report-only until `--apply`)** — X1 game-label; GM earning `gameKey`; phantom participant scores — owner decides when production data exists.

---

## P2 — Blocked (do not schedule)

15. **X4 — real outside-provider adapter** — blocked on signed sandbox; **X4a does not replace it**.
16. **Per-round provider cost analytics + CSP `frame-src`** — need real X4 contract / play domain.
17. **GM net-of-cost economics for paying third parties** (`19` s5) — re-apply when X4 pricing exists; first-party / zero-cost creation already shipped 23 Sep.
18. **Turn-based / heat contests (task 10.2)**; check-in / lobby / countdown trio — blocked, not deferred by effort.
19. **Task 22 per-metric performance schema** — deliberate deviation; do not “finish”.
20. **Paid Hint / invent mid-round SCORE / Combo / XP LEVEL in arena** — fairness / protocol.
21. **Remaining `ADMIN_SECTIONS` grants** — owner “do later”.
22. **Sidebar clicks don’t write URL** — ~60 sections; with X6.5 leftovers.
23. **`closePosition` on completed/finalizing** — needs own evidence before changing.
24. **Task 8** — large game admin redesign — blocked on reference image.
25. **Tasks 15–16** — artwork optimize on upload only; do not point existing optimizer at `public/assets`.
26. **Tasks 25–27, 31–35** — consistency / reviews / final audit — not started.
27. **Task 28** — settlement server-side guard still useful (four payout paths checked).
28. **Per-game marketplace** — not scheduled (~2 weeks after catalogue).
29. **X12** — hardening, staged pilot, public launch — after X4 + polish.

---

## Do not treat as open (closed / stale on older lists)

- **P0 challenge result page trading metrics** — **R92 CLOSED 18 Sep**; `/challenges/[id]` early-returns to `ProviderChallengeLobby` before any `myStats.pnl` (canary in `__tests__/admin/analytics-terminology.test.ts`).
- **P0 arena FRIENDS / COUNTRY tabs** — **WIRED 22 Sep** (`13` s4.1y amendment); `listFriendUserIds` + country map + `filterRowsForScope`.
- **P0 player dashboard twin of R64** — **CLOSED 18 Sep**.
- **P0 public unauth arena broadcast leaderboard** — **CLOSED 18 Sep** (`13` s5.1c).
- **P0 R1 residual under-count prize-pool** — **CLOSED**; `prize-pool-integrity.ts` raises under-count (mirrored) + tests.
- **X11 catalogue + games-first nav** — CODE-COMPLETE 21–22 Sep (eng).
- **X11.5 interest / matchmaking** — CODE-COMPLETE 23 Sep (eng); Q16 open.
- **X10 core + X15 abuse controls** — built; Q15 closed 22 Sep.
- **`/play` ↔ `/trade` dispatcher** — COMPLETE 23 Sep.
- **Task 9 leftovers** (analytics by category + discovery filter) — CLOSED 23 Sep.
- **GM provider construction UI** — CODE-COMPLETE 23 Sep; s5 suspended for first-party / zero-cost.
- **AppSettingsProvider / credit symbol in admin** — R110 (18 Sep).
- **X9 / re-settle / incident hub** — X9 CODE-COMPLETE 20 Sep; hub BUILT 21 Sep.
- **X8 player wording** — eng + owner content DONE; only R11 + A5 remain.
- **X6.5 eng** — CLOSED; A5 bodies = owner last.
- **X4a** — OWNER CLICK-ACCEPTED 20 Sep; Risk X8 closed.
- **X0–X3, X5, X7 steps 1–5** — code-complete (ops backfills / R96b content / Q14 as noted).
- **Friday catalogue auto-sync + 7-day stale banner** — shipped 24 Sep (`ff2e4b04`).
- **GM Active comps X/max + min-entrants rule** — shipped 24 Sep (`b215efe5` + `46b1a868`).

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
| X10 | Core + X15 + result-page/FRIENDS polish done |
| X11 | CODE-COMPLETE (eng) for catalogue / nav / merchandising |
| X11.5 | CODE-COMPLETE (eng); Q16 open |
| X12 | NOT STARTED |
| Per-game marketplace | NOT SCHEDULED |

---

## Preferred next eng session

**Continue P0 #1 — `AMBIGUITY-LOG`.** A1–A10 closed 24 Sep (HTML v1.6–v1.15).  
Next: A11 (locale-map shape) or later OPEN entries.  

Do **not** re-open X11 / X11.5 / challenge-result / FRIENDS / R64 twin / arena broadcast as greenfield.  
Do **not** schedule X4 until a signed sandbox exists.  
Keep A5 wiki and R11 for the end.
