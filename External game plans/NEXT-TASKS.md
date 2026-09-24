# Next tasks — ChartVolt external-first programme

> **Updated 24 September 2026.** One bullet per task. Closed items stay listed so an
> older paste-list is not re-opened by accident. Detail lives in `PROGRESS.md`.

---

## P0 — Do next (eng)

**Preferred eng queue (owner, 24 Sep — start when you say “start”):**

1. **`AMBIGUITY-LOG` A12+** (preferred) — A1–A11 done (HTML v1.6–v1.16); next OPEN entries need `01` + requirements HTML bump.
2. **X4a localisation / mobile catalogue** — beyond `en`; mobile catalogue support.
3. **Nine `duel` vocabulary sites** (landing / admin seeds) — seeded defaults need a migration decision, not wording alone.
4. **Trading create-form monolith** (~2716 lines) + thinner trading editor.
5. **Verify `ranking-config.service`** before scheduling a full pass (may already be largely done).

**Also still open (schedule after the five above, or when relevant):**

6. **Task 17** — remove legacy game — half done; needs catalogue re-sync (ops).
7. **Task 18** — redesign other screen — not started (needs owner reference if any).

**Do not put these back in P0 as open (CLOSED — older lists are stale):**

- ~~X10 polish — challenge result page trading metrics~~ → **R92 CLOSED 18 Sep**
- ~~X10 polish — arena FRIENDS / COUNTRY tabs~~ → **WIRED 22 Sep**
- ~~Player dashboard twin of R64~~ → **CLOSED 18 Sep**
- ~~Public unauth arena broadcast leaderboard~~ → **CLOSED 18 Sep**
- ~~R1 residual under-count prize-pool~~ → **CLOSED** (`prize-pool-integrity.ts`)

---

## P1 — Owner / legal (eng waits)

11. **A5 wiki bodies** — ten Game Administration wiki pages; **LAST OF ALL**.
12. **R11 — legal ToS / action-terms** — lawyer / counsel with A5.
13. **R99 — JSON 134 vs constants 128** badge catalogue merge — only if you still want it.
14. **R93 — credit EUR rate UI** — settings screen was missing; rebuild when you want it.
15. **R96b — game-specific badge *content*** — code can author badges; you still need real badge text/rows.
16. **Q16 — registration interest picker** — ask new players which games they like at sign-up.
17. **Ops backfills (`--apply` when ready)** — X1 game labels; GM earning `gameKey`; phantom scores — only when real production data exists.

---

## P2 — Blocked / do not schedule

18. **X4 outside-provider sandbox** — need a signed real provider; X4a does not replace this.
19. **Per-round provider cost + CSP `frame-src`** — need X4 contract / play domain.
20. **GM net-of-cost economics for third parties** (`19` s5) — when X4 pricing exists.
21. **Turn-based / heat + check-in / lobby / countdown** — blocked, not “later by effort”.
22. **Task 22 per-metric schema** — deliberate deviation; do not “finish”.
23. **Paid Hint / invent mid-round SCORE / Combo / XP LEVEL** — fairness / protocol forbid.
24. **Remaining `ADMIN_SECTIONS` grants** — owner “do later”.
25. **Sidebar URL sync** (~60 sections).
26. **`closePosition` on completed/finalizing** — needs own evidence first.

---

## P3 — 35-task leftovers / later

27. **Task 8** — large admin redesign (needs reference).
28. **Tasks 15–16** — artwork optimize on upload only.
29. **Task 17** — remove legacy game (needs re-sync) — also under P0 #6.
30. **Task 18** — redesign other screen — also under P0 #7.
31. **Tasks 25–27, 31–35** — consistency / audit.
32. **Task 28** — settlement guard still useful.
33. **Per-game marketplace** — not scheduled.
34. **X12** — hardening / pilot / launch.

---

## Also shipped recently (do not re-open)

- **Command Alerts** — acknowledge / drawer / CSV / Fraud links (`3a84d1ec`). Prefer **Acknowledge** over Delete (Delete comes back — monitors recreate the episode).
- **Friday catalogue auto-sync + 7-day stale banner** (`ff2e4b04`).
- **GM Active comps `X/max` + min-entrants rule**.
- **R114** — `prize_pool_mismatch` false alerts from GM earnings counting.
- X11 / X11.5 / X10 core / X15 / `/play`↔`/trade` / GM provider create / X4a click-accepted / X9 / X8 eng+owner content.

---

## Preferred next eng session

**Wait for owner to say “start”, then:**

1. AMBIGUITY-LOG A12+  
2. X4a localisation / mobile catalogue  
3. Nine duel vocabulary sites (seeds)  
4. Trading create-form monolith  
5. Verify `ranking-config.service` before scheduling  

Do **not** schedule X4 until a signed sandbox exists.  
Keep A5 wiki and R11 for the end.
