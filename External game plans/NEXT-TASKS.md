# Next tasks — ChartVolt external-first programme

> **Updated 24 September 2026 (owner P1 decisions).** One bullet per task. Closed
> items stay listed so an older paste-list is not re-opened by accident. Detail
> lives in `PROGRESS.md`.

---

## P0 — Do next (eng)

**Preferred eng queue (owner, 24 Sep — start when you say “start”):**

1. **`AMBIGUITY-LOG` A12+** — **CLOSED 24 Sep 2026.** A12–A14 → HTML **v1.17–v1.19**; `parentOrigin` on create; `GET /replay/...` attempt summary.
2. **X4a localisation / mobile catalogue** — **CLOSED 24 Sep 2026.** `en`+`el` catalogue copy; Accept-Language; mobile hub/tabs.
3. **Nine `duel` vocabulary sites** — **CLOSED 24 Sep 2026 (source).** Seven paths rewritten; ban test; report-only `tools/vocabulary/rewrite-duel-seeds.ts` (no `--apply` scheduled, P1 #17).
4. **Trading create-form monolith** (~2716 lines) + thinner trading editor — **SKIPPED / NEVER (owner, 24 Sep).** Do not schedule. Leave `CompetitionCreatorForm.tsx` alone.
5. **Verify `ranking-config.service`** — **CLOSED 24 Sep 2026 (verify only).** Service is correctly **trading-only** (P&L / ROI / …). Provider headings already use catalogue `scoreType` on the lobby; dashboard cards say “Score”. **Do not schedule a “full pass”** that stuffs game labels into this file — that would enumerate games. **← was NEXT; done.**

**Also still open (schedule after the five above, or when relevant):**

6. **Task 17** — remove legacy game — **CLOSED 18 Sep 2026 (ops) / verified 24 Sep.** Circuit Perfect deprecated; pickers filter `active`; owner re-sync done.
7. **Task 18** — redesign other screen — **← NEXT** when owner supplies a reference image.

**Do not put these back in P0 as open (CLOSED — older lists are stale):**

- ~~X10 polish — challenge result page trading metrics~~ → **R92 CLOSED 18 Sep**
- ~~X10 polish — arena FRIENDS / COUNTRY tabs~~ → **WIRED 22 Sep**
- ~~Player dashboard twin of R64~~ → **CLOSED 18 Sep**
- ~~Public unauth arena broadcast leaderboard~~ → **CLOSED 18 Sep**
- ~~R1 residual under-count prize-pool~~ → **CLOSED** (`prize-pool-integrity.ts`)

---

## P1 — Owner / legal

11. **A5 wiki bodies** — ten Game Administration wiki pages. **LAST OF ALL — eng builds only when owner asks at the end.**
12. **R11 — legal ToS / action-terms** — **owner / lawyers rewrite** (same window as A5). Eng does not draft legal text.
13. **R99 — JSON 134 vs constants 128** — **optional / owner decide**. Two lists of badges (a JSON file and a TypeScript constants file) disagree on count; merge only if you still want one source of truth. Overwrite-on-seed was already fixed 16 Sep.
14. **R93 — credit EUR rate UI** — **CLOSED 18 Sep** (and confirmed 24 Sep). Settings → Currency already hosts `CreditConversionSection`; `valueInEUR` is derived from that rate. Do not rebuild.
15. **R96b — game-specific badge *content*** — **DONE (owner, 24 Sep).** Authoring tools shipped earlier; content is owner’s.
16. **Q16 — registration interest picker** — **BUILT 24 Sep 2026.** Sign-up asks Trading / Games / Both; stored on `user.signupInterest` (informational only).
17. **Ops backfills (`--apply`)** — **CLOSED / not needed (owner, 24 Sep).** Scripts stay report-only; no production `--apply` scheduled.

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
28. ~~**Tasks 15–16** — artwork optimize on upload~~ → **CLOSED 24 Sep** (`15.1`).
29. ~~**Task 17** — remove legacy game~~ → **CLOSED** (also under P0 #6).
30. **Task 18** — redesign other screen — also under P0 #7 (needs owner reference).
31. ~~**Tasks 25–27, 31–35** — consistency / audit~~ → **CLOSED 24 Sep** (audit; see task doc).
32. ~~**Task 28** — settlement guard~~ → **CLOSED 24 Sep** (`28.1` standing test).
33. **Per-game marketplace** — not scheduled.
34. **X12** — hardening / pilot / launch.

---

## Also shipped recently (do not re-open)

- **Command Alerts** — acknowledge / drawer / CSV / Fraud links (`3a84d1ec`). Prefer **Acknowledge** over Delete (Delete comes back — monitors recreate the episode).
- **Friday catalogue auto-sync + 7-day stale banner** (`ff2e4b04`).
- **GM Active comps `X/max` + min-entrants rule**.
- **P3 Tasks 15–16 / 25–28 / 31–35** — artwork WebP-on-upload + settlement client guard + audits (24 Sep).
- **R114** — `prize_pool_mismatch` false alerts from GM earnings counting.
- X11 / X11.5 / X10 core / X15 / `/play`↔`/trade` / GM provider create / X4a click-accepted / X9 / X8 eng+owner content.

---

## Preferred next eng session

**Wait for owner to say “start”, then:**

1. ~~AMBIGUITY-LOG A12+~~ **CLOSED**
2. ~~X4a localisation / mobile catalogue~~ **CLOSED**
3. ~~Nine duel vocabulary sites (seeds)~~ **CLOSED (source; DB report-only)**
4. ~~Trading create-form monolith~~ **NEVER — leave alone (owner)**
5. ~~Verify `ranking-config.service`~~ **CLOSED 24 Sep — no full pass; trading-only by design**

**Next when ready:** Task 18 (needs owner reference image). Tasks 15–16 / 25–28 / 31–35
closed 24 Sep. Task 17 closed. Task 8 still needs a reference too.
