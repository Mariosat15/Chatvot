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

**ChartVolt Games today:** declares only `en` and returns flat English strings,
so `Accept-Language` is a no-op until further locales ship (X4a content).

---

## A12 - Nothing says a title may declare fewer locales than the platform serves `OPEN` (minor)

The spec requires text fields to exist "in every locale you declare", which is the right
constraint and is the one this service is honouring by declaring **only `en`** until real
translations exist - declaring a locale and shipping English strings for it would render
confident English copy on a Greek game page with nothing raising an error.

What is unstated is the consequence: is a title that declares only `en` hidden from players in
other locales, shown with English copy, or refused at catalogue sync? A provider needs to know
whether declaring fewer locales costs them reach or costs them the integration.

---

## A13 - The provider is never told the origin it is embedded in `OPEN` (gap, found building the play surface)

**Where:** Section 7, the frame messages, and endpoint 2's request fields.

The game is required to talk to the platform with `postMessage`, and `postMessage` takes a
**target origin**. Nothing in the specification supplies one. `POST /v1/rounds` sends
`returnUrl`, but that is where to send the player *afterwards*, which is not the same fact - on
a white-labelled deployment the page hosting the frame and the page the player returns to can be
different origins, and the document never says they agree.

**Why the safe-looking guess is the dangerous one.** Deriving the target origin from `returnUrl`
looks stricter and fails **silently**: the browser drops the message with no error the page can
see, so the platform never receives `ready` and shows a loading spinner over a game that is
running perfectly. There is no log line on either side.

**Guessed:** post to `*`, and say why in the file. It discloses nothing, because the platform's
own message type has no score, rank or player field - `height` is the only number that crosses
the boundary. The check that matters is on the receiving side and the platform already makes it:
it compares `event.origin` against the launch URL it loaded **and** `event.source` against the
frame's own window, which no unrelated page can satisfy.

**Fix:** add a `parentOrigin` to the create-round request. It costs one field and it lets a
provider be strict without guessing. Note this is also the field a **CSP `frame-src`** allowlist
would need on the platform side, which is still unwritten - see `13` s1.1a.

---

## A14 - `replayUrl` is required on every result and its behaviour is undefined `OPEN` (gap)

**Where:** Section 8's result body.

Every terminal result carries a `replayUrl`, and the specification says nothing about what it
must serve, who may open it, whether it needs to authenticate, or how long it must keep working.
A dispute over prize money is exactly when someone follows it, which is also the point at which
"it 404s" is the worst possible answer.

**What this service does today, stated plainly because it is a known gap rather than a
decision:** it builds `{publicUrl}/replay/{providerRoundId}?t={token}` from a hash of the round,
and **no route serves that path.** So the platform is being handed a URL that answers
`NOT_FOUND`. It is not a live defect - nothing on the platform side renders or follows the field
yet, and the admin round inspector shows the raw delivery rather than linking out of it - but it
is a promise made in a signed payload and it must not be left implied.

**Needs an owner decision, not a guess:** a replay that shows the player's own paths is a
support and dispute tool worth having; a replay that shows *the puzzle* is a content leak, since
a contest's boards are shared and a losing player could read a live contest's content from their
own finished round. The safe form is almost certainly "the player's submitted paths, after the
contest's play window has closed, behind the single-use token" - which is a scoping question the
specification should answer for every provider rather than leaving each to invent.

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
