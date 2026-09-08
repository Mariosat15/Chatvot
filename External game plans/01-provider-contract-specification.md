# 01 - Provider Contract Specification

> **This is the central document of the plan.**
>
> It defines exactly what ChartVolt requires from any external game provider.
> It serves three purposes:
>
> 1. The specification we send to candidate providers
> 2. The checklist we evaluate them against
> 3. The interface our adapter implements internally
>
> If a provider cannot meet the **non-negotiables** in section 8, they cannot be
> used for paid contests. No amount of engineering on our side compensates for a
> provider that cannot report a trustworthy score.

---

## 1. Integration principles

These are stated first because they constrain everything else.

| # | Principle | Why |
|---|---|---|
| 1 | **The provider never handles money.** No balances, no bets, no payouts, no wallet callbacks | ChartVolt owns the entry fee, the pool and the prizes. Any provider needing wallet access is rejected |
| 2 | **Scores arrive server-to-server only.** Never from the player's browser | A score that reaches us via the client can be forged, and it decides real prize money |
| 3 | **Every result is cryptographically signed** | We must be able to prove a score came from the provider |
| 4 | **Everything is idempotent** | Retries are normal. A duplicate result must never create a second score |
| 5 | **We always have a pull fallback** | Webhooks get lost. We must be able to ask "what was the result of round X" |
| 6 | **ChartVolt owns the identifiers** | We generate the round ID. The provider echoes it back. This keeps reconciliation ours |
| 7 | **The player is pseudonymous to the provider** | We send an opaque player ID and optionally a display name. No email, no real name, no personal data |
| 8 | **Contest fairness is provable** | All players in one competition must face identical content. See section 4.3 |

---

## 2. Transport, authentication and signing

### 2.1 Outbound (ChartVolt -> provider)

| Requirement | Value |
|---|---|
| Protocol | HTTPS only, TLS 1.2 minimum |
| Method | `POST` for actions, `GET` for reads |
| Content type | `application/json` |
| Authentication | `Authorization: Bearer {PROVIDER_API_KEY}` |
| Request signing | `X-Signature: sha256={HMAC_SHA256(rawBody, PROVIDER_API_SECRET)}` plus `X-Timestamp` |
| Timeout | ChartVolt aborts after **10 seconds** |
| Retries | ChartVolt retries idempotent calls up to 3 times with backoff |

### 2.2 Inbound (provider -> ChartVolt)

| Requirement | Value |
|---|---|
| Endpoint | `POST https://chartvolt.com/api/games/providers/{providerKey}/events` |
| Authentication | `Authorization: Bearer {CALLBACK_TOKEN}` issued by ChartVolt to the provider |
| Signature header | `X-Signature: sha256={HMAC_SHA256(rawBody, CALLBACK_SECRET)}` |
| Timestamp header | `X-Timestamp` - Unix seconds. ChartVolt rejects anything older than **5 minutes** |
| Signature basis | The **raw request body bytes**, not a re-serialised object |
| Success response | HTTP `200` with `{"received": true, "eventId": "..."}` |
| Retry policy | The provider must retry on non-2xx or timeout, with backoff, for at least **24 hours** |

> **Note on signature basis.** Signing must be over the raw body exactly as sent.
> Signing a re-serialised object breaks the moment either side changes key order or
> number formatting, and produces intermittent failures that are painful to debug.

---

## 3. Required endpoint - game catalogue

```
GET {PROVIDER_BASE}/v1/games
```

Returns every game available to us, with the capability metadata that lets
ChartVolt decide what contest formats each game can support.

### Response

```json
{
  "games": [
    {
      "gameCode": "trivia-blitz",
      "displayName": "Trivia Blitz",
      "tagline": "Ten questions. Fifteen seconds each. No second guesses.",
      "description": "A fast general-knowledge quiz. Ten multiple-choice questions, fifteen seconds each, with a speed bonus for answering quickly. Every player in a contest receives the same questions in the same order.",
      "rulesSummary": "Correct answer: 100 points. Speed bonus: up to 50 points. Wrong or unanswered: 0. Highest total wins; ties broken by total time taken.",
      "howToPlay": "Read the question, tap an answer before the timer runs out. You cannot change an answer once submitted and you cannot go back.",
      "category": "trivia",
      "tags": ["quiz", "fast", "mobile-friendly"],
      "thumbnailUrl": "https://cdn.provider.com/trivia-blitz-400x300.jpg",
      "bannerUrl": "https://cdn.provider.com/trivia-blitz-1600x600.jpg",
      "iconUrl": "https://cdn.provider.com/trivia-blitz-icon-256.png",
      "screenshotUrls": [
        "https://cdn.provider.com/trivia-blitz-shot-1.jpg",
        "https://cdn.provider.com/trivia-blitz-shot-2.jpg"
      ],

      "family": "independent",
      "playMode": "anytime",
      "supportsCompetition": true,
      "supportsOneVsOne": true,
      "supportsPractice": true,
      "supportsContentSeed": true,

      "scoreDirection": "higher_is_better",
      "scoreType": "integer",
      "scoreRange": { "min": 0, "max": 10000 },

      "typicalDurationSeconds": 600,
      "maxDurationSeconds": 3600,

      "configSchema": {
        "type": "object",
        "properties": {
          "questionCount":     { "type": "integer", "minimum": 5,  "maximum": 30, "default": 10 },
          "playSeconds":       { "type": "integer", "minimum": 60, "maximum": 3600, "default": 600,
                                 "format": "duration-seconds" },
          "category":          { "type": "string",  "enum": ["general","sport","science","film"] },
          "difficulty":        { "type": "string",  "enum": ["easy","mixed","hard"], "default": "mixed" }
        },
        "required": ["questionCount", "playSeconds"]
      },

      "locales": ["en", "es", "de", "el"],
      "platforms": ["desktop", "mobile"],
      "status": "active"
    }
  ]
}
```

### Field requirements

| Field | Required | Notes |
|---|---|---|
| `gameCode` | Yes | Stable, permanent identifier. **Must never be reused or renamed** |
| `family` | Yes | `independent` or `head_to_head`. Determines which contest formats are possible - see `00-README.md` |
| `playMode` | No, defaults to `anytime` | `anytime` or `scheduled`. **A different question from `family`**: `family` asks whether the game needs an *opponent*, this asks whether everybody plays at *one appointed moment*. A race is `independent` and `scheduled`; a puzzle is `independent` and `anytime`. A `head_to_head` title is treated as `scheduled` whatever it declares, because an opponent implies a shared moment. Omitting it means `anytime`, which is why it is optional - see 3.2a |
| `supportsCompetition` / `supportsOneVsOne` | Yes | ChartVolt hides formats a game cannot support |
| `supportsContentSeed` | Yes | See 4.3. **Required for competitions.** A game without it cannot be used for a fair multi-player contest |
| `scoreDirection` | Yes | `higher_is_better` or `lower_is_better`. Speedruns and golf-style games are the latter. Getting this wrong ranks everyone backwards |
| `scoreType` | Yes | `integer`, `decimal` or `duration_ms` |
| `configSchema` | Yes | JSON Schema. **The admin panel renders its settings form directly from this**, so a new game needs no ChartVolt release. If the title's length is configurable, one property must carry `format: "duration-seconds"` - see 3.2 |
| `typicalDurationSeconds` / `maxDurationSeconds` | Yes | Drives contest scheduling and the result grace period |
| `status` | Yes | `active`, `deprecated` or `maintenance` |

> **`configSchema` is doing a lot of work here.** Because the admin settings form is
> generated from it, the provider can add a game and we can run contests on it
> without a code change. This is the difference between an integration that scales
> and one that needs a developer for every new title.

### 3.1 Presentation content - why it is a hard requirement

Added 30 August 2026, following the games-first platform direction recorded in
`../New games plan/15-platform-transformation-and-gaps.md`.

Every provider game is published on ChartVolt as a **catalogue entry with its own
page**, identical in kind to an in-house game. A player lands on that page before
deciding whether to pay an entry fee. A name and a thumbnail cannot fill that page.

| Field | Required | Purpose |
|---|---|---|
| `displayName` | Yes | Card title and page heading |
| `tagline` | Yes | One line, under 90 characters, for cards and search results |
| `description` | Yes | 2-4 sentences a player reads before entering. Must state what the player actually does |
| `rulesSummary` | Yes | How the score is produced and how ties break. Players **will** dispute prizes; this text is the first thing support quotes back |
| `howToPlay` | Yes | The controls and the constraints, in plain language |
| `category` | Yes | Drives catalogue grouping |
| `tags` | No | Search and related-games |
| `thumbnailUrl` | Yes | Catalogue card. 4:3, minimum 400x300 |
| `bannerUrl` | Yes | Game page header. Wide, minimum 1600x600 |
| `iconUrl` | No | Compact lists and notifications. Square, minimum 256x256 |
| `screenshotUrls` | No | Strongly wanted. Two or three, for the game page |
| `locales` | Yes | Which of the above are translated, and into what |

Three constraints on the content itself:

1. **Localised.** Text fields must be available in every locale the game declares
   in `locales`, either as a locale map or via an `Accept-Language` header on
   `GET /v1/games`. ChartVolt will not translate provider copy.
2. **No provider branding in the copy.** Descriptions must not contain the
   provider's name, logo or links. To the player, the game is a ChartVolt game -
   the provider is a supplier, not a co-brand. Attribution, where contractually
   required, is handled once in the site footer and legal pages.
3. **Assets served over HTTPS from a stable URL**, with a cache policy. ChartVolt
   caches and may re-host them; URLs that rotate break game pages.

> **Why this is in the contract and not a nice-to-have.** Writing page copy and
> sourcing artwork for every title, in every language, is cheap for the company
> that built the game and expensive for us. A provider who will not supply
> presentation content is quietly transferring their content cost onto us, per
> title, forever. Raise it during commercial discussion, not after signing.

**Any score-affecting purchase inside a game is out of scope entirely.** ChartVolt
does not sell, and will not permit a provider to sell, anything that improves a
score or ranking in a paid contest - no extra time, hints, retries, continues or
paid unlocks affecting results. See `../New games plan/15-platform-transformation-and-gaps.md`
section 3.2 for the reasoning. If a game's economics depend on such mechanics, it is
the wrong game for this platform. Ask before evaluating anything else.

### 3.2 One `format` keyword, and why it is required rather than optional

Added 8 September 2026. **Version 1.3 of the provider-facing document**
(`ChartVolt-Game-API-Requirements.html`), which is the version number to quote - this
`.md` carries no version of its own.

`configSchema` is rendered generically, which means ChartVolt reads a title's settings
without knowing what any of them mean. That is the property worth keeping - and there is
exactly one thing the platform must nevertheless understand: **which setting is the play
clock.**

**Declare it with `format: "duration-seconds"` on that property.**

```json
"configSchema": {
  "type": "object",
  "properties": {
    "durationSeconds": {
      "type": "integer",
      "format": "duration-seconds",
      "minimum": 60, "maximum": 3600, "default": 600
    },
    "difficulty": { "type": "string", "enum": ["easy", "hard"], "default": "easy" }
  },
  "required": ["durationSeconds"]
}
```

**Why the platform cannot manage without it.** A competition has to stop accepting new
attempts far enough before its end time that nobody's attempt is cut short - otherwise
two players are ranked against each other over different lengths of play. Computing that
moment needs one number: how long an attempt of *this contest* runs for. Without the
keyword the only available figure is `maxDurationSeconds`, the title's ceiling, and
reserving a ceiling of an hour against a contest configured for ten minutes of play means
**the contest refuses every attempt for its entire duration.** That was a live ChartVolt
defect, fixed on 8 September 2026, and it is the reason this keyword exists.

**Why not just name the field.** Because then it is your field name, in our code, for
ever - and the next provider's title, whose clock is called something else, needs a
ChartVolt release. That is precisely the outcome `configSchema` exists to avoid.

| Rule | Behaviour |
|---|---|
| Declared on an `integer` or `number` property | Required. On a `string` the schema is **refused** - the value is arithmetic, and a non-numeric clock produces `NaN`, which makes every comparison false and every gate silently open |
| At most **one** property per schema may declare it | Two would leave the reservation depending on property order. The schema is **refused** |
| Any other `format` value | **Refused.** ChartVolt fails closed on schema keywords it does not implement, so a format we silently ignored would leave a declared clock treated as an ordinary integer with nothing anywhere saying so |
| Not declared at all | **Permitted.** ChartVolt falls back to `maxDurationSeconds`. Correct but coarse: a contest shorter than your ceiling cannot be scheduled with the reserving policy, so declare it if your title's length is configurable |
| Units | **Seconds**, matching the keyword's name, and matching the `minimum` / `maximum` you declare |

**If your title's length is fixed rather than configurable**, declare nothing and set
`maxDurationSeconds` to that fixed length. The fallback is then exactly right.

### 3.2a `playMode` - does everybody play at once?

**Most providers can ignore this section.** If your players can pick up your game whenever
they like, omit the field: `anytime` is the default and describes every title in the live
catalogue today.

Declare `"playMode": "scheduled"` when your title only makes sense played **simultaneously** -
a race, a live quiz, anything where the field runs one clock together.

**This is not the same question as `family`, and merging them is the mistake to avoid.**
`family` asks whether your game needs an **opponent**. A race does not: every runner runs
their own track and gets their own time, so a race is `independent`. What a race needs is for
everyone to run at the same **moment**, which is a separate property no other field carries.

| | `anytime` | `scheduled` |
|---|---|---|
| `independent` | A puzzle, a solo time trial | **A race, a live quiz** |
| `head_to_head` | *(impossible)* | Chess, checkers |

Three rules follow, and each is a consequence rather than a choice:

- **`head_to_head` is treated as `scheduled` whatever you declare**, because two people cannot
  play each other at different times. You do not need to declare both.
- **Omitting the field means `anytime`.** It is optional precisely so that a catalogue written
  against version 1.3 keeps working unchanged.
- **A value we do not recognise is treated as `anytime` and logged.** This is the one place
  ChartVolt deliberately fails towards the *less* constrained answer: a simultaneous title
  wrongly run as staggered still produces comparable, payable scores, whereas a staggered
  title wrongly run as simultaneous shuts entry at the start and turns away players who could
  have played and paid.

**What declaring `scheduled` changes on our side**, so you can see it is a shape and not a
feature you must implement:

| | `anytime` | `scheduled` |
|---|---|---|
| When entry closes | At the last moment an attempt still fits | **At the contest's start time** - you cannot join a race that has begun |
| Attempts | The operator's choice, 1..n | **Exactly one** |
| A player who opens their board late | Normal | Gets a **shortened** round, not a refusal. They paid, and starting late cannot help them |
| A player who never turns up | Their round is resolved by policy | A no-show: no round exists, and they are not eligible for a prize |

**Nothing in your API changes.** You still serve the same catalogue, create rounds the same
way and report results the same way. `playMode` tells ChartVolt how to *schedule* contests
around your title; it does not ask your service to do anything new.

---

## 4. Required endpoint - create a round

```
POST {PROVIDER_BASE}/v1/rounds
```

Called server-side when a player clicks Play. One round is one player playing once,
producing one score.

### Request

```json
{
  "roundId": "cv_rnd_01JAV3M7Q2XK8T",
  "gameCode": "trivia-blitz",
  "mode": "ranked",

  "player": {
    "playerId": "cv_p_8f21c0",
    "displayName": "Nikos",
    "locale": "en",
    "country": "GR"
  },

  "config": {
    "questionCount": 10,
    "secondsPerQuestion": 15,
    "category": "sport",
    "difficulty": "mixed"
  },

  "contentSeed": "cv_ctst_774219",

  "expiresAt": "2026-08-18T14:00:00Z",
  "resultCallbackUrl": "https://chartvolt.com/api/games/providers/acme/events",
  "returnUrl": "https://chartvolt.com/contests/774219"
}
```

### Response

```json
{
  "roundId": "cv_rnd_01JAV3M7Q2XK8T",
  "providerRoundId": "acme_r_9f2ab41",
  "launchUrl": "https://play.provider.com/launch?t=eyJhbGciOi...",
  "launchUrlExpiresAt": "2026-08-18T11:35:00Z",
  "status": "created"
}
```

### 4.1 Identifier ownership

`roundId` is **generated by ChartVolt** and acts as the idempotency key. Calling
create twice with the same `roundId` must return the **same** round and the **same**
launch URL, not create a second one. This matters because a player double-clicking
Play must not consume two attempts.

### 4.2 `mode`

| Value | Meaning |
|---|---|
| `ranked` | Counts towards a paid contest. Result callback required |
| `practice` | Free play, unranked. Result callback optional, never scored |

Practice mode matters commercially: players will not pay to enter a game they have
never tried. A provider without it forces us to make first contests free.

### 4.3 `contentSeed` - the fairness mechanism

**This is the most important single field in the specification.**

All players in one competition must face **identical content** - the same questions,
the same puzzles, the same board. ChartVolt passes the same `contentSeed` for every
round in a contest, and the provider must guarantee that the same seed plus the same
config yields the same content.

Without it there is no fair competition, because two players would be ranked against
each other having faced different challenges of unknown relative difficulty. It is
also what preserves ChartVolt's regulatory position: **identical conditions are what
make relative skill, rather than luck of the draw, the ranking factor.**

Requirements:

- Same `contentSeed` + same `config` => identical content, every time
- Different `contentSeed` => different content
- Presentation order **may** be shuffled per player (this is desirable - it stops
  players sharing "the answer is B") as long as the underlying content is the same
- The seed must not be discoverable or predictable by the player

### 4.4 `expiresAt`

The round must be unplayable after this time and should report `expired`. It stops a
player starting a round seconds before a contest closes and finishing long after
prizes have been paid.

---

## 5. Required - the result callback

The provider POSTs to `resultCallbackUrl` when a round reaches a terminal state.

```json
{
  "eventId": "acme_ev_01JAV4T8",
  "eventType": "round.completed",
  "occurredAt": "2026-08-18T11:34:02Z",

  "roundId": "cv_rnd_01JAV3M7Q2XK8T",
  "providerRoundId": "acme_r_9f2ab41",
  "playerId": "cv_p_8f21c0",
  "gameCode": "trivia-blitz",

  "status": "completed",
  "score": 8730,
  "scoreBreakdown": {
    "correctAnswers": 9,
    "wrongAnswers": 1,
    "averageAnswerMs": 2140,
    "longestStreak": 7,
    "speedBonus": 730
  },

  "startedAt": "2026-08-18T11:31:50Z",
  "completedAt": "2026-08-18T11:34:02Z",
  "durationMs": 132400,

  "replayUrl": "https://play.provider.com/replay/acme_r_9f2ab41?t=...",

  "integrity": {
    "suspicious": false,
    "flags": []
  }
}
```

### 5.1 Terminal statuses

| `status` | Meaning | ChartVolt behaviour |
|---|---|---|
| `completed` | Played to the end | Score recorded and ranked |
| `abandoned` | Player quit or disconnected and did not return | Score recorded as reported, usually partial. Counts as an attempt |
| `expired` | `expiresAt` passed before completion | Scored zero, or the partial score if the provider can supply one |
| `voided` | Provider invalidated the round (fault, bug, confirmed cheating) | Not scored. The attempt is returned to the player |

**A round must always reach a terminal state.** A round that simply stops reporting
is the single worst failure mode in this integration, because real prize money waits
on it. See `07-failure-modes-and-edge-cases.md`.

### 5.2 Required timing

The callback must be sent within **60 seconds** of the round reaching a terminal
state, and the provider must retry for at least 24 hours until it receives a 2xx.

### 5.3 `integrity`

Optional but strongly preferred. The provider knows things we cannot see - impossible
reaction times, automation signatures, identical input patterns across accounts. Any
flag raised here suspends the payout for that contest pending review rather than
blocking it silently.

### 5.4 `scoreBreakdown`

Free-form, game-specific. ChartVolt **never ranks on it** - ranking uses `score` only.
It is stored and displayed to players on the results screen, which is what makes a
result feel transparent rather than arbitrary.

---

## 6. Required endpoint - fetch a round

```
GET {PROVIDER_BASE}/v1/rounds/{roundId}
```

Returns the current state of a round in exactly the same shape as the callback body.

**This endpoint is non-negotiable.** Webhooks are lost - to deploys, outages,
misconfiguration and network faults. Without a pull fallback, a lost webhook means a
contest that can never settle and a support incident involving real money. ChartVolt
polls this endpoint for any round still unresolved as a contest approaches
settlement.

---

## 6a. Error responses

Every failing call must return a machine-readable error with a stable code, so our
adapter can decide whether to retry, fail the round, or surface a message to the
player. A bare `500` with an HTML body forces us to guess, and guessing wrong either
consumes a player's paid attempt or retries something that should not be retried.

```json
{
  "error": {
    "code": "GAME_UNAVAILABLE",
    "message": "Game is in maintenance until 14:00 UTC.",
    "retryable": false
  }
}
```

| HTTP | Meaning | ChartVolt behaviour |
|---|---|---|
| `400` | Invalid request or config failing `configSchema` | Fail immediately, do not retry, alert |
| `401` / `403` | Auth or signature rejected | Fail immediately, **critical** alert |
| `404` | Unknown `roundId` or `gameCode` | Fail immediately |
| `409` | `roundId` already exists with different parameters | Fail immediately, alert - indicates an ID collision |
| `422` | Valid shape, rejected by business rules | Fail, show the player a message |
| `429` | Rate limited | Retry with backoff, honour `Retry-After` |
| `5xx` | Provider fault | Retry up to 3 times, then fail the round without consuming the attempt |

The `retryable` flag is authoritative when present, overriding the status-code
default. It lets a provider tell us "this 500 is transient" or "this 500 is fatal"
rather than leaving us to infer it.

---

## 7. Optional endpoints, in order of value

| Endpoint | Value | Notes |
|---|---|---|
| `POST /v1/rounds/{roundId}/void` | **High** | Lets us cancel a round when a contest is cancelled, so the player is not left with a live round for a dead contest |
| `POST /v1/matches` | **High for Family B** | Creates a head-to-head match between two players. Required for real-time challenges in chess-style games |
| `GET /v1/games/{gameCode}/leaderboard` | Low | We keep our own leaderboards. Useful only for cross-checking |
| Webhook for `round.started` | Medium | Confirms the player actually began, which distinguishes "never played" from "played and scored zero" |
| Sandbox score injection | **High** | The ability to force an arbitrary score in the sandbox makes automated testing of settlement possible |

---

## 8. Non-negotiables

A provider failing **any** of these cannot be used for paid contests.

| # | Requirement |
|---|---|
| 1 | Results delivered **server-to-server**, never through the player's browser |
| 2 | Results **cryptographically signed**, with a timestamp we can use to reject replays |
| 3 | A **pull endpoint** to fetch a round's state on demand |
| 4 | **Idempotency** on round creation and on result delivery |
| 5 | Every round reaches a **terminal state**, always |
| 6 | **Content seeding** so all competitors face identical content |
| 7 | A **sandbox** environment, separate from production, with test credentials |
| 8 | **No money handling** of any kind |
| 9 | `scoreDirection` declared per game |
| 10 | A stable, permanent `gameCode` per game |
| 11 | A written **SLA** - see section 9 |
| 12 | A **replay or audit URL** per round, for dispute resolution |

---

## 9. Service levels required

| Metric | Requirement |
|---|---|
| Game availability | >= 99.5% monthly |
| Round creation response time | p95 < 2s, p99 < 5s |
| Result callback delivery | Within 60s of terminal state, >= 99.9% within 24h including retries |
| Fetch-round endpoint | p95 < 1s |
| Incident notification | Within 30 minutes of a production incident affecting rounds |
| Breaking API changes | 90 days written notice, with versioned endpoints |
| Support response | Within 4 business hours for anything affecting live contests |
| Data retention | Round records and replays retained >= 90 days |

---

## 10. Data protection

ChartVolt sends the provider a **pseudonymous** player identifier and, optionally, a
display name and locale. It never sends email addresses, real names, dates of birth,
payment details or identity documents.

| Item | Sent? |
|---|---|
| Opaque player ID | Yes |
| Display name | Optional - configurable, since it appears in the game UI |
| Locale, country | Optional |
| IP address | Only if the provider requires it for their own fraud checks. To be documented in the data processing agreement |
| Anything else | **No** |

A data processing agreement is required before production use, covering the provider
as a processor, sub-processor disclosure, hosting locations and breach notification
timelines.

---

## 11. Summary of the interface

```
ChartVolt  ->  Provider
    GET  /v1/games                      list games + capabilities
    POST /v1/rounds                     create a round, get a launch URL
    GET  /v1/rounds/{roundId}           fetch state (fallback + reconciliation)
    POST /v1/rounds/{roundId}/void      cancel a round            [optional]
    POST /v1/matches                    head-to-head match        [optional]

Provider  ->  ChartVolt
    POST /api/games/providers/{key}/events    signed result callback
```

Three required calls out, one required call in. The narrowness of this interface is
deliberate: it is what makes a second provider cheap to add and any single provider
cheap to drop.

---

## 12. The provider-facing version of this document

`ChartVolt-Game-API-Requirements.html` is the same specification rewritten for an
external audience - second person, no internal reasoning, no evaluation criteria, no
reference to our architecture or our commercial modelling. **That is the file we send
to game developers.**

> **The two must be kept in step.** If a requirement changes here, it changes there.
> If a provider negotiates a deviation, it is recorded in both. A spec that has
> drifted from the document the provider is building against is worse than no spec at
> all, because both sides believe they agree.
