# Ambiguity log - questions the specification did not answer

Every entry is a question this implementation had to answer by **guessing**, working only from
`External game plans/ChartVolt-Game-API-Requirements.html` v1.0 - the document a real provider
receives.

**This file is the point of building ChartVolt Games at all.** Each entry is something a real
provider will hit, and they will resolve it by guessing too, in their own direction. Finding
them now costs a search. Finding them after a partner has built against the issued version
costs a re-issued specification and a renegotiated integration.

**Status key:** `OPEN` - needs an owner or engineering decision. `RESOLVED` - the specification
and chapter `01` have been amended. Nothing here is closed by this service simply choosing a
behaviour; that choice is a guess until the document says so.

---

## A1 - The idempotency key is labelled on the wrong field `RESOLVED` (defect, not ambiguity)

**Where:** Endpoint 2, the request example.

```
"roundId":  "cv_rnd_01JAV3M7Q2XK8T",   // OUR id. Echo it back everywhere.
"gameCode": "trivia-blitz",             // Also your idempotency key.
```

The comment "Also your idempotency key" sat on the **`gameCode`** line. Section 11 is
unambiguous that the key is `roundId` ("We call `POST /v1/rounds` twice with the same
`roundId` - return the same round and the same launch URL").

**Why it mattered more than a typo.** An implementer working from the example rather than the
prose would key idempotency on `gameCode`, which would return **one shared round per title** -
so the second player to press Play receives the first player's round and launch URL. That is a
data-protection incident and a corrupted contest, and it would pass a naive integration test
because a single-player rehearsal never has a second player.

**Resolved 24 Sep 2026 in requirements HTML version 1.6:** comment moved onto the `roundId`
line; `gameCode` comment now says "which title this round is for". Chapter `01` already
stated `roundId` is the key — no prose change needed there. ChartVolt Games already keys on
`roundId`.

---

## A2 - There is nothing to sign on the two GET endpoints `RESOLVED` (security)

**Where:** Section 10, "Calls from us to you".

> `X-Signature: sha256={HMAC_SHA256(rawBody, API_SECRET)}`

Both `GET /v1/games` and `GET /v1/rounds/{roundId}` have **no body**. Signing an empty body
produces a constant for a given secret, which means the signature binds *nothing* about the
request - not the method, not the path, not the round being asked about, and not the timestamp.
An attacker who observes one such header can reuse it on any GET for ever.

Section 10 also asks the provider to "reject anything older than 5 minutes", but the timestamp
is only a header. **Unless the timestamp is inside the signed material, rejecting on it is not
a security control** - anyone replaying the request can simply send a current timestamp.

**Resolved 24 Sep 2026 in requirements HTML version 1.7 and chapter `01` s2.1:** outbound calls
sign `{timestamp}.{METHOD}.{path}.{rawBody}` (empty body for GET). ChartVolt Games and both
platform `transport.ts` copies ship the same formula. **Callbacks (provider → ChartVolt) stay
body-signed** — that direction always has a JSON body. A body-only GET signature is refused
by a dedicated API test.

---

## A3 - Idempotency and launch-URL expiry contradict each other `RESOLVED` (contradiction)

**Where:** Endpoint 2's field table against section 11.

- `launchUrlExpiresAt`: "Short-lived is correct and expected. Tell us when it dies **so we can
  request a fresh round** rather than showing a dead frame."
- Section 11: the same `roundId` must "return the same round **and the same launch URL**".

These cannot both hold. Once the launch URL has expired, requesting again with the same
`roundId` must return the same expired URL, so a fresh one is unobtainable; requesting with a
new `roundId` is "a fresh round", which consumes a second attempt from a paying player.

**Why it will actually happen:** a player opens the contest, is called away, and returns after
the launch URL's few minutes have lapsed. That is an ordinary Tuesday, not an edge case.

**Resolved 24 Sep 2026 in requirements HTML version 1.8 and chapter `01` s4.1:** idempotency
preserves the *round*; a re-request with the same `roundId` may mint a freshly signed launch
URL while the round is still live. No attempt consumed, no progress reset. ChartVolt Games
already implemented this in `create.ts` `reuse()` — the spec now matches the code rather than
the other way round.

---

## A4 - No `eventType` is defined for the three non-completed terminal states `RESOLVED` (gap)

**Where:** Endpoint 3 shows `"eventType": "round.completed"`. Section 13 defines four terminal
states: `completed`, `abandoned`, `expired`, `voided`.

The payload carries **both** `eventType` and `status`, and only one example value of
`eventType` is given. An implementer cannot tell whether to send
`eventType: "round.abandoned"` with `status: "abandoned"`, or to keep
`eventType: "round.completed"` as a generic "the round finished" event and let `status` carry
the detail.

**Resolved 24 Sep 2026 in requirements HTML version 1.9 and chapter `01` s5.1:** `eventType`
must be `round.{status}` — `round.completed`, `round.abandoned`, `round.expired`, or
`round.voided` — and must match `status` on the same message. ChartVolt ranks and settles on
`status` and `score`. ChartVolt Games already derives the four values in `eventTypeFor`
(`games-service/src/rounds/report.ts`).

---

## A5 - Whether a practice round must report a result `RESOLVED`

**Where:** Endpoint 2's `mode` row: "`ranked` counts towards a paid contest and **must produce
a result callback**. `practice` is free play and is never scored by us."

Silent on whether a practice round should report at all. Both readings are defensible: not
reporting saves both sides pointless traffic, but reporting keeps one code path and lets a
practice round appear in a player's own history.

Related and equally silent: is `contentSeed` sent for a practice round? If it is absent, the
determinism guarantee has nothing to apply to; if it is present, practice shares content with
the paid contest, which would let a player **rehearse the exact puzzles they are about to be
paid to solve.** That second reading is a fairness hole, so it is worth stating rather than
leaving to an implementer's taste.

**Resolved 24 Sep 2026 in requirements HTML version 1.10 and chapter `01` s4.2 / s4.3:**
practice **must not** produce a result callback (fetch still works); practice content comes
from a **per-round** seed and must never reuse a contest `contentSeed`. ChartVolt Games
already skipped practice callbacks in `deliver.ts` `isReportable` and seeded practice from
`providerRoundId` when no contest seed is present — the log's earlier guess ("report
normally") was wrong; the docs caught up to the code.

---

## A6 - Does an `expired` round consume the player's attempt? `RESOLVED`

**Where:** Section 13's table says `voided` means "attempt returned" and `abandoned` "counts as
an attempt". `expired` says only "Scored zero, or the partial score if you supply one".

By omission it presumably consumes the attempt, and for a player who started and ran out of
time that is clearly right. But the same state covers a player who **never opened the launch
URL at all** - and charging an attempt for a round that was never rendered will generate
support tickets, especially when the cause was a launch URL that expired first (see A3).

**Resolved 24 Sep 2026 in requirements HTML version 1.11 and chapter `01` s5.1:** `expired`
**counts as an attempt**, same as `completed` and `abandoned`. Only `voided` returns it. The
"never opened" case is intentional under attempt-on-creation (`03` s1.3); re-mint the launch
URL for the same live `roundId` after expiry (A3 / 1.8) rather than creating a second round.
The platform already counted non-`voided` rounds in `countConsumedAttempts` — the docs caught
up to the code. Providers cannot see attempts; this is ChartVolt policy stated for clarity.

---

## A7 - `scoreRange` is required in the table but optional in our own contract `RESOLVED` (drift)

Endpoint 1's field table marks `scoreRange` **Yes / required**, and explains it is used to
"reject scores outside this range as a safety check against both cheating and bugs". The
platform's internal adapter contract declared it `scoreRange?` - optional.

Minor in isolation, but it is exactly the class of drift the paired-document rule exists for: a
provider omitting it is within the internal contract and in breach of the issued specification,
and the two would disagree at runtime rather than at integration.

**Also unstated:** what happens when a reported score is *outside* the declared range. Rejected
as invalid, clamped, or accepted with an alert? "We reject scores" suggests the first, which
means a provider bug becomes an unresolved round rather than a wrong payout - the right
trade-off, but worth saying.

**Resolved 24 Sep 2026 in requirements HTML version 1.12 and chapter `01` field table:** both
`min` and `max` required; out-of-range results are **rejected** (not clamped). Platform
`ProviderCatalogueGame.scoreRange` is now required; both adapter copies refuse a title missing
either bound at catalogue parse. Ingestion already rejected out-of-range scores (gate 10).

---

## A8 - The `status: "created"` field in the create-round response is undocumented `RESOLVED` (minor)

**Resolved 24 Sep 2026** in requirements HTML **v1.13** and `01` section 4 response table.

Endpoint 2's response example included `"status": "created"` with no field-table row. From
v1.13: **required** on a successful create or idempotent reuse that hands back a launchable
round; **always the literal `"created"`**. Live round progress stays on the fetch endpoint
(section 13). ChartVolt Games already echoed that literal from `respond()` in
`src/rounds/create.ts`; no behaviour change.

---

## A9 - Which direction the duration tie-break runs `RESOLVED`

**Resolved 24 Sep 2026** in requirements HTML **v1.14**, `01` section 5, matching
`03` section 1.5 and ChartVolt Games' existing report.

**Rule:** when primary scores are equal, **shorter `durationMs` wins**, then earlier
`completedAt`; remaining ties share the prize.

**What to put in `durationMs`:**
- `higher_is_better`: time to achieve the reported score — **not** a fixed session length
  when every player would get the same figure (Circuit Sprint reports time to the last
  completed board for this reason).
- `lower_is_better` titles whose score is already a duration: set `durationMs` equal to
  `score`.

**Platform note (closed 24 Sep 2026):** `getProviderTieBreakerValue` now maps settlement's
`win_rate` / `join_time` slots onto shorter `durationMs` then earlier `scoreCompletedAt`.
Gate 11b syncs both onto the participant seat; provider settlement and resettle pass them
into `calculateRankings`. Equal scores with neither figure still share — that is intentional.

---

## A10 - Which subset of JSON Schema is actually supported `RESOLVED`

**Resolved 24 Sep 2026** in requirements HTML **v1.15** section **3.1b** and `01`
section **3.1b**. List matches `SUPPORTED_ROOT_KEYS` / `SUPPORTED_FIELD_KEYS` /
`SUPPORTED_TYPES` / `CONFIG_FIELD_FORMATS` in `lib/services/games/config-schema.ts`.

Fail-closed behaviour was already documented in v1.3; the **keyword list** was the
missing half. No parser change.

The secondary question in this entry (whether ChartVolt sends settings the schema does
not declare) remains: this service clamps out-of-range values rather than refusing the
round. That is operational detail for ChartVolt Games, not a gap in the published subset.

---

## A11 - The locale-map option has no defined shape `RESOLVED`

**Resolved 24 Sep 2026** in requirements HTML **v1.16** and `01` section 3
constraint 1.

**Rule:** catalogue text fields are **always flat strings**. Honour
`Accept-Language` on `GET /v1/games`; missing locale falls back to the first
entry in `locales`, then `en` if present. **Per-field locale maps are not
supported** — ChartVolt stores flat strings and will not unpack a map.

**Why the map option was removed rather than specified:** an adapter written
against flat strings cannot consume a map, so the two shapes were never
interchangeable in practice. Specifying the unused shape would have invited
providers to send something the sync silently drops.

**ChartVolt Games (X4a, 24 Sep 2026):** declares `en` and `el`. Greek catalogue
copy and board rules live in `src/games/content.ts`. `Accept-Language: el`
returns Greek flat strings; undeclared tags fall back per the rule above.
In-frame intro copy follows `player.locale` the same way. Platform catalogue
sync sends `Accept-Language: en` so first-sync content stays English-stable.

---

## A12 - Nothing says a title may declare fewer locales than the platform serves `RESOLVED`

**Resolved 24 Sep 2026** in requirements HTML **v1.17** and `01` section 3
constraint 1 (locale reach).

**Rule:** declaring fewer locales than ChartVolt's site languages is **allowed and
normal**. It does **not** hide the title, refuse catalogue sync, or fail
integration. Players whose preferred language is missing see the best available
copy via the existing `Accept-Language` fallback (requested → first declared →
`en`). The cost of a short `locales` list is English (or first-declared) copy on
those pages — never a silent sync failure and never a missing catalogue card.

**Why not hide or refuse:** a provider who ships `en` first while translations
catch up is doing the right thing; refusing them would push them to declare Greek
and ship English strings, which A11 already called out as confident wrong copy
with nothing raising an error.

---

## A13 - The provider is never told the origin it is embedded in `RESOLVED`

**Resolved 24 Sep 2026** in requirements HTML **v1.18** and `01` section 4
(`parentOrigin` on create-round).

**Rule:** ChartVolt **always sends** `parentOrigin` on `POST /v1/rounds` — the
exact origin of the page that hosts the iframe (scheme + host + port, no path).
Providers **must** use it as the `postMessage` target origin. It is **not** the
same fact as `returnUrl` (where the player goes afterwards); on a white-label
those can differ.

**Absent / pre-1.18 clients:** a provider may use `*` only while the frame
message type carries no score, rank or player field. ChartVolt Games prefers
`parentOrigin` when stored and falls back to `*` for older rounds.

**Platform:** both competition and challenge launch paths derive the value from
the public base URL origin and pass it through the adapter.

---

## A14 - `replayUrl` is required on every result and its behaviour is undefined `RESOLVED`

**Resolved 24 Sep 2026** in requirements HTML **v1.19**, `01` section 5, and
risk **R35** (closed for the contract; third-party compliance is still their
duty).

**Rule:**
1. Serve the **player's own submitted attempt** (paths drawn, boards finished,
   timing) — **never the puzzle content** of a contest that may still be live.
2. **Token-scoped** to that round (single-use query token or equivalent).
3. **Not available before the round is terminal.** For ranked rounds, also wait
   until the round's `expiresAt` has passed (or the contest play window has
   closed — whichever the provider uses as the hard stop), so a finisher cannot
   read live contest material via their own replay.
4. Stay reachable for **at least 90 days** (unchanged).

**ChartVolt Games:** `GET /replay/{providerRoundId}?t=…` verifies the HMAC token
and serves a summary page once the round is terminal; earlier requests get 403.

---

## Not ambiguities - two places the spec is better than expected

Recorded because a log of only complaints misrepresents the document.

- **Section 12 anticipates answer-sharing.** It not only requires identical content, it
  explicitly *permits and wants* per-player presentation shuffling to blunt collusion. That is
  the harder half of the fairness problem, thought about in advance. This service implements it
  as one of the eight symmetries of the grid.
- **Endpoint 4 is argued for, not just specified.** Stating plainly that a provider without it
  "cannot be used for paid contests, regardless of how good the games are" is what stops it
  being negotiated away as an optional extra, which is exactly what would happen to a
  reconciliation endpoint listed without a reason.
