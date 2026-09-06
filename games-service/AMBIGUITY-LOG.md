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

## A1 - The idempotency key is labelled on the wrong field `OPEN` (defect, not ambiguity)

**Where:** Endpoint 2, the request example.

```
"roundId":  "cv_rnd_01JAV3M7Q2XK8T",   // OUR id. Echo it back everywhere.
"gameCode": "trivia-blitz",             // Also your idempotency key.
```

The comment "Also your idempotency key" sits on the **`gameCode`** line. Section 11 is
unambiguous that the key is `roundId` ("We call `POST /v1/rounds` twice with the same
`roundId` - return the same round and the same launch URL").

**Why it matters more than a typo.** An implementer working from the example rather than the
prose would key idempotency on `gameCode`, which would return **one shared round per title** -
so the second player to press Play receives the first player's round and launch URL. That is a
data-protection incident and a corrupted contest, and it would pass a naive integration test
because a single-player rehearsal never has a second player.

**Guessed:** `roundId`. **Fix:** move the comment up one line.

---

## A2 - There is nothing to sign on the two GET endpoints `OPEN` (security)

**Where:** Section 10, "Calls from us to you".

> `X-Signature: sha256={HMAC_SHA256(rawBody, API_SECRET)}`

Both `GET /v1/games` and `GET /v1/rounds/{roundId}` have **no body**. Signing an empty body
produces a constant for a given secret, which means the signature binds *nothing* about the
request - not the method, not the path, not the round being asked about, and not the timestamp.
An attacker who observes one such header can reuse it on any GET for ever.

Section 10 also asks the provider to "reject anything older than 5 minutes", but the timestamp
is only a header. **Unless the timestamp is inside the signed material, rejecting on it is not
a security control** - anyone replaying the request can simply send a current timestamp.

**Guessed:** sign `{timestamp}.{method}.{path}.{rawBody}`, with `rawBody` empty for a GET, and
reject on skew. This is the common convention and it makes the timestamp meaningful.

**This one needs a decision before a provider integration is signed**, because it is the kind
of thing each side implements differently and then debugs for a day - which the specification
itself warns about, one paragraph below, for a different reason.

---

## A3 - Idempotency and launch-URL expiry contradict each other `OPEN` (contradiction)

**Where:** Endpoint 2's field table against section 11.

- `launchUrlExpiresAt`: "Short-lived is correct and expected. Tell us when it dies **so we can
  request a fresh round** rather than showing a dead frame."
- Section 11: the same `roundId` must "return the same round **and the same launch URL**".

These cannot both hold. Once the launch URL has expired, requesting again with the same
`roundId` must return the same expired URL, so a fresh one is unobtainable; requesting with a
new `roundId` is "a fresh round", which consumes a second attempt from a paying player.

**Why it will actually happen:** a player opens the contest, is called away, and returns after
the launch URL's few minutes have lapsed. That is an ordinary Tuesday, not an edge case.

**Guessed:** idempotency preserves the *round*, and a re-request re-mints the *launch URL*
while the round is still live. So `POST /v1/rounds` with a known `roundId` returns the same
`providerRoundId`, the same puzzle content and a **freshly signed** launch URL. No attempt is
consumed, and nothing about the player's progress resets.

**This is the single most consequential guess in this log**, because the alternative reading
costs a real player a paid attempt.

---

## A4 - No `eventType` is defined for the three non-completed terminal states `OPEN` (gap)

**Where:** Endpoint 3 shows `"eventType": "round.completed"`. Section 13 defines four terminal
states: `completed`, `abandoned`, `expired`, `voided`.

The payload carries **both** `eventType` and `status`, and only one example value of
`eventType` is given. An implementer cannot tell whether to send
`eventType: "round.abandoned"` with `status: "abandoned"`, or to keep
`eventType: "round.completed"` as a generic "the round finished" event and let `status` carry
the detail.

**Guessed:** `eventType` mirrors the status - `round.completed`, `round.abandoned`,
`round.expired`, `round.voided`. **Recommendation for the spec:** say so explicitly, or drop
`eventType` altogether, since `status` already carries the information and two fields that must
agree are two fields that will eventually disagree.

---

## A5 - Whether a practice round must report a result `OPEN`

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

**Guessed:** practice rounds report normally (one code path, and it exercises the same
plumbing), and practice content is generated from a **per-round** seed that is never a contest
seed.

---

## A6 - Does an `expired` round consume the player's attempt? `OPEN`

**Where:** Section 13's table says `voided` means "attempt returned" and `abandoned` "counts as
an attempt". `expired` says only "Scored zero, or the partial score if you supply one".

By omission it presumably consumes the attempt, and for a player who started and ran out of
time that is clearly right. But the same state covers a player who **never opened the launch
URL at all** - and charging an attempt for a round that was never rendered will generate
support tickets, especially when the cause was a launch URL that expired first (see A3).

**Not this service's decision to make**, since attempts are the platform's concept and no
provider can see them. Flagged because the spec's own table invites the question.

---

## A7 - `scoreRange` is required in the table but optional in our own contract `OPEN` (drift)

Endpoint 1's field table marks `scoreRange` **Yes / required**, and explains it is used to
"reject scores outside this range as a safety check against both cheating and bugs". The
platform's internal adapter contract declares it `scoreRange?` - optional.

Minor in isolation, but it is exactly the class of drift the paired-document rule exists for: a
provider omitting it is within the internal contract and in breach of the issued specification,
and the two would disagree at runtime rather than at integration.

**Also unstated:** what happens when a reported score is *outside* the declared range. Rejected
as invalid, clamped, or accepted with an alert? "We reject scores" suggests the first, which
means a provider bug becomes an unresolved round rather than a wrong payout - the right
trade-off, but worth saying.

---

## A8 - The `status: "created"` field in the create-round response is undocumented `OPEN` (minor)

Endpoint 2's response example includes `"status": "created"`. It appears in no field table and
in no state list - section 13's diagram has a `created` box, but as a round state rather than a
response field. An implementer cannot tell whether it is required, what other values are legal,
or whether returning a round already `in progress` is meaningful.

**Guessed:** echo `"created"` always. Harmless either way, which is why it is filed as minor
rather than dropped - an undocumented field in an example is still a field somebody will
validate against.

---

## A9 - Which direction the duration tie-break runs `OPEN`

**Where:** Endpoint 3, the `startedAt, completedAt, durationMs` row: "We use duration as a
tie-break, and ties are common."

It does not say **which way**. For a `higher_is_better` points game, the intended reading is
surely that the faster of two equal scores wins - but for a `lower_is_better` duration game the
score *is* the duration, so the tie-break is either meaningless or means something else
entirely.

**Why a provider cannot ignore this.** It changes what `durationMs` should contain. Every
Circuit Sprint session lasts exactly the configured clock, so reporting session length would
give the whole field an identical tie-break and quietly make it useless - no error, no warning,
just a tie that never breaks. This service reports **time to the last completed board** instead,
which is only the right answer if lower is better.

**Guessed:** lower duration wins. **Recommendation:** say so, and say what a
`lower_is_better` title should put in `durationMs`, since for those the tie-break needs a
different field (Circuit Perfect ties break on boards completed, which the platform cannot see).

---

## A10 - Which subset of JSON Schema is actually supported `OPEN` (gap)

**Where:** Endpoint 1, the `configSchema` row: "Valid JSON Schema describing every setting we
may send in `config`."

The specification asks for valid JSON Schema and never says which keywords the platform
understands. That matters because the platform's form generator **fails closed** on keywords it
cannot render - so a provider writing entirely valid JSON Schema using `pattern`, `oneOf` or
`allOf` can have a whole title refused, having done exactly what the document asked.

Failing closed is the right behaviour - a partially-understood schema would render a form
missing half the real constraints and then validate against the half it understood - but it
turns an unstated assumption into a rejected integration.

**Guessed:** the most conservative subset possible - `type`, `properties`, `integer`, `string`,
`boolean`, `minimum`, `maximum`, `enum`, `default`, `required`. **Recommendation:** publish the
supported keyword list in the spec, and say plainly that anything else refuses the title rather
than being ignored. This is cheap to document and expensive to discover.

Related, and unstated: `configSchema` is described as required, but nothing says whether the
platform will send settings the schema does not declare, or omit ones it does. This service
clamps out-of-range values rather than refusing the round - reaching that state means the two
sides disagree about the schema, and refusing a paid round mid-contest is worse than playing a
300-second board when 400 was asked for - and reports which settings it had to correct.

---

## A11 - The locale-map option has no defined shape `OPEN` (gap)

**Where:** Endpoint 1, the "Localised" constraint: "Either return a locale map, or honour an
`Accept-Language` header on this endpoint."

Two options are offered and only one is specified. If a provider chooses the locale map, no
field name, nesting or fallback rule is given - `"description": {"en": "...", "el": "..."}`
alongside a flat `"displayName"`? A parallel `"translations"` object? What happens when a
requested locale is missing from the map?

**Guessed:** honour `Accept-Language` and return flat strings, because that is the option the
document actually describes.

**Worth noting for the platform side too:** an adapter written against flat strings will not
consume a locale map at all, so the two options are not interchangeable in practice. Either
specify the map's shape or remove the choice.

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
