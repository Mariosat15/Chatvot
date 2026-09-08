# 21 - The reference provider and its game (phase X4a)

**Status: PLANNED, not started. Scope DECIDED 5 September 2026 - see section 8.**

**The owner's decision: it is BOTH.** The game is built to a real quality bar and becomes the
in-house hedge, closing open question 10 in the affirmative, while still serving as the
reference implementation that proves the provider seam. Estimate rises from 1-1.5 weeks to
**3.5-5 weeks**. Sequenced **before** provider health, so the health panel can be proven to go
red against something that can genuinely be switched off.

**This modifies a load-bearing decision and must not be read as a small change.** The 2
September external-only decision states "provider games are the only new games; **no in-house
game is built**". That sentence is now false. What survives of the decision is the important
part - the programme is still external-**first**, and the in-house Trivia game of
`New games plan` P2 is still not being built - but the platform is now deliberately funding one
game of its own as insurance. See the decision log entry of 5 September 2026 in `PROGRESS.md`.

A fake game company, registered through the real admin screens exactly as a real provider
would be, serving a **real playable skill game from its own origin**, reporting scores
through the **real signed callback**. Built so that the whole provider lifecycle can be
exercised by a human being, with real money moving, before any real provider exists.

It is a **test harness that behaves like a partner**, not a demo and not a stub.

---

## 1. Why this exists, and why now

Three facts put this work here rather than anywhere else.

**The plan's own review gate is currently impossible to hold.** `10` section 4 defines the
shortest useful path as `X0 + X1 + X2 + X3 + X4 + X5 + a minimal slice of X6`, and says it
"produces a provider contest a player can pay for and play, and that is the right place to
pause and review against real behaviour." Every part of that is now built **except X4** - and
X4 is blocked on a signed provider. So the review the whole programme is sequenced around
cannot happen, not for want of engineering but for want of something to play.

**There is nothing to play, and it is worse than it sounds.** `mock.adapter.ts` returns
`https://mock.provider.test/play/<roundId>` - a hostname that does not resolve. The player
play screen built on 5 September renders an iframe pointed at it, so today the last step of
the lifecycle terminates in a frame that fails to load. Everything up to that point is
proven by tests; the step a player actually cares about has never been performed by a person.

**It is the only work that meaningfully de-risks X4**, and X4 is where the programme's
largest scheduling risk lives (`17` risk X1: five weeks of work blocked on someone else's
sandbox). Every hour spent discovering our own integration's rough edges against a provider
we control is an hour not spent discovering them against a partner's clock.

### The uncomfortable adjacency: this is open question 10 wearing different clothes

Open question 10 - *is a small in-house insurance game worth keeping on the backlog as a
hedge?* - is marked **RAISED IN PRIORITY** and due **before X4**, "the last point at which
the answer is still cheap". That is the same slot this chapter wants, and it is not a
coincidence: **a reference provider with a real playable game is, mechanically, a small
in-house game.** The only difference is intent.

That must be decided deliberately rather than arrived at by scope creep, because the two
have different quality bars, different costs and different consequences. Section 8 puts the
decision in front of the owner. **Until it is answered, this chapter specifies the harness
only.**

---

## 2. What it must be built from, and what makes it worthless

Four rules. Break any one and the exercise proves nothing while appearing to prove
everything - the failure mode this programme has hit repeatedly.

**1. Implemented from the published specification alone.** The only input is
`ChartVolt-Game-API-Requirements.html`, the document real providers receive. **No imports
from this repository** - not a type, not a constant, not a signing helper. A harness that
shares our types cannot discover an ambiguity in the spec, because both sides are reading
the author's intent rather than the author's words. This is the same lesson as *a raw-driver
fixture can prove anything, because it is not bound by the schema the application writes
through*: shared internals let a test agree with itself.

Concretely, the deliverable is not just a working game. It is a **log of every question the
implementation had to answer by guessing**, because each one is an ambiguity a real provider
will hit, and finding them costs nothing now and a re-issued spec later.

**2. Its own origin and its own process.** Serving the game from the Next.js app on the same
origin silently skips the `event.origin` check, the `event.source === frame.contentWindow`
check, and every question about framing. A separate port is the minimum. A separate hostname
is better, because it is the only way to learn what a Content-Security-Policy `frame-src`
actually needs - which the play-screen work deferred *specifically* on the grounds that
**there was nothing to allowlist yet**. This gives us something.

**3. Its own state.** It stores its own rounds and scores. A "provider" that reads our
database is not a provider, and any shortcut here removes the very seam being tested.

**4. It must be incapable of touching money.** Not "does not" - *cannot*. The hard constraint
is that an external provider never touches money, and a harness that could is a harness that
will be copied.

---

## 3. What it must exercise

The value of this phase is the length of this list. Each line is something currently proven
only by a test that supplies its own inputs, or not proven at all.

### Registration and catalogue

- Registering the company through `GameProvidersSection`, with credentials stored write-only
  in `WhiteLabel.gameProviderCredentials`, including the **blank means keep** behaviour.
- A real catalogue sync: the named field allow-list, and **missing titles reported rather
  than deleted**.
- The **two switches** - the provider's `providerStatus` versus our `chartvoltEnabled` - by
  having the fake company disable a title on its own side and confirming we do not surface it.
- The refusals that exist to be helpful: enabling a provider with **no installed adapter**,
  and enabling one with **no callback secret**, which otherwise makes every result look
  identical to an attack in the logs.

### Contest lifecycle, by clicking

- Draft creation through the provider wizard, including the `configSchema`-generated settings
  form against a **real** schema written by someone building to the spec rather than by us.
- The pre-flight checklist against a stored draft, and publish.
- Entry, seat creation, and the idempotent duplicate entry.
- Round launch on click, **attempt consumed on creation**, the resume path for an
  already-live round, and a genuine double-click.

### Result ingestion, including the paths that must fail

- A valid signed callback, end to end, with a human playing.
- A **bad signature**, a **replayed delivery**, and a delivery arriving during `finalizing` -
  the window that is worse than a late result because it is a coin flip.
- The eleven ingestion gates and the four-stage reconciliation net, driven by a provider that
  can be told to go quiet.

### Scoring and money - the part with no real-world evidence at all

- Score arriving, reaching `participant.score`, ranking, and a real payout to a real wallet.
- **A lower-is-better title.** This is the sharpest single item in the chapter: the
  `scoreDirection` P0 fixed on 5 September was **latent and has never been exercised by an
  actual game**, and getting it wrong pays the slowest player first. A time-trial title makes
  it observable.
- **Two titles from one provider**, which simultaneously proves one adapter serves many
  titles and that the ranking direction travels on the data rather than the code.
- All three unresolved-round policies, by having the company simply not report.

### The content obligation, which is contractual and untested

Page content per title is contractual for providers: tagline, description, rules summary,
how-to-play, thumbnail, banner, localised. Nobody has yet had to actually supply that set and
render it. **Producing it for a fake company is how we find out whether the field list we are
about to demand from a real one is right** - and it is much cheaper to change our own mind
than to amend an issued requirement.

### The hostile player

The play screen deliberately has no score field in its message contract, because the player
has a developer console. The harness should try to inject one, and try to report a score for
somebody else's round.

---

## 4. Deliverables

| Deliverable | Notes |
|---|---|
| The game itself | A small **skill-based** game, now to a **player-facing quality bar**. Chance-determined outcomes invert the regulatory position and are out of scope entirely |
| A second title, lower-is-better | A time trial or similar, to make `scoreDirection` observable - and, as a product, a second real thing to play |
| A standalone service | Own port/hostname, own storage, own signing. Zero imports from this repo |
| Spec-ambiguity log | Every question the implementer had to answer by guessing. **The most valuable output for the external programme** |
| Content set | Tagline, description, rules, how-to-play, thumbnail, banner, per title, localised. **One title since s4.1g** |
| Mobile support | Now in scope, because real players will use it on a phone |
| A runbook | How to start it, register it, and drive each failure case on demand |

**Estimate: 3.5-5 weeks**, following the 5 September scope decision in section 8. It was
1-1.5 weeks as a harness; the increase is game design, art, mobile, localisation, content and
the QA that a paid game needs. **Not purely additive** - roughly half a week of it is X4 work
brought forward.

### 4.1a What has actually been built - 6 September 2026

Read this before the sections above, which describe the target. **The two halves exist and have
never spoken to each other**, so anything implying a working provider game is describing the plan.
The game is playable by a human, in a browser, on a phone-sized screen - but only against the
service's own smoke tool, never yet launched from a ChartVolt contest.

| | State |
|---|---|
| The standalone service | **Built.** `games-service/` - own process, own port (4010 by default), own database, own `node_modules`, **zero imports from this repository**, enforced by `tools/check-isolation.ts` |
| The engine | **Built.** A deterministic seeded non-crossing-path puzzle: `engine/{rng,puzzle,generate,verify}.ts`. Generation is reproducible from a `contentSeed` indefinitely, and the verifier validates a submission **against the rules**, not against the generator's own stored solution, because a board has several valid solutions |
| Two titles | **Built, then ONE.** `circuit-sprint` (higher-is-better, integer) and `circuit-perfect` (lower-is-better, `duration_ms`), from one engine; the second existed so a ranking sign error could not pass every test. **`circuit-perfect` was retired on 8 September 2026** per the owner - see **s4.1g**, including what the retirement costs. A document describing two titles is correct as history and stale as a present fact |
| The four spec endpoints | **Built.** Catalogue, create round, fetch round, void round, plus signed inbound auth with a rotation window, a retrying result callback, and a four-stage reconciliation sweeper |
| Spec-ambiguity log | **Built and open.** `games-service/AMBIGUITY-LOG.md`. **Not yet resolved back into `01` and the requirements HTML** |
| The platform adapter | **Built.** `chartvolt-games` registered in both registry copies, four files under `lib/services/game-providers/adapters/`, mirrored into `apps/admin` and verified byte-identical. 49 tests, 24 probes |
| **The playable board** | **Built.** `GET /play?t={token}` serves a real game: `public/play/` (4 files, no build step) behind `src/http/play-page.ts`. Dragging with a finger draws paths, the clock runs, a solved board advances, and the round settles into a signed result. Verified by a human-equivalent browser run on both titles. 11 headless tests drive the browser module against the server's verifier; 13 probes |
| **Provider registration** | **NOT DONE through the admin screens.** The service now has a local `.env` and has been started - including **from its production `dist` build**, not only under `tsx` - and answers signed catalogue calls. Registration was attempted in the admin UI on 6 Sep 2026 and **found a live defect**: the base-URL validator required `https://` unconditionally, so a loopback provider could not be registered at all. Fixed (see 4.1b) |
| **Any end-to-end round** | **DONE BY TEST, NOT BY CLICKING - 7 September 2026.** A round now travels between the two halves: `__tests__/games/end-to-end-round.test.ts` starts a real `games-service` process, syncs its catalogue over signed HTTP, launches a round, plays it to completion, receives the service's own signed callback and settles the contest for real money. See **4.1d**. What is still NOT done is the acceptance criterion itself, which says *by clicking, in a browser* - that needs two sessions this environment cannot create, so it is a runbook for the owner (**4.1e**) |
| **Production deployment** | **Prepared, not performed.** PM2 entry `chartvolt-games`, `games-service/env.example`, and a runbook in `deploy/README.md`. **Two exposure routes**: proxied through the platform app at `/play` (the default since 6 Sep 2026, owner's choice - no DNS, no nginx, no certificate) or its own `games.` subdomain (the nginx block is kept). Nothing has been deployed - see 4.1b for the two boot guards this work added and 4.1c for what the proxy route costs |
| Mobile support | **Built for the game screen, not yet for the catalogue.** The board is sized from the viewport, uses `100dvh`, and sets `touch-action: none` so a drag does not scroll the page - which is the one CSS rule in the file that decides whether the game works on a phone at all |
| Content set, localisation, runbook | **NOT STARTED.** The title declares `en` only, deliberately: declaring a locale and shipping English strings for it renders confident English copy on a Greek game page with nothing raising an error |

**Two claims to avoid making about what is built.** "Code-complete" for the service means its own
suites pass in-process against `mongodb-memory-server`; it has never run against the platform. And
the adapter's 49 tests run against a **stubbed `fetch`**, so they prove the adapter's half of the
protocol and not that the two sides agree - a stub returns what it is told. The single assertion
that spans both sides recomputes the HMAC from the stored secret over the exact bytes handed to
`fetch`, which is the construction the service's inbound guard uses.

**The phase produced its first real finding within a day, which is the point of it, and it is
now FIXED (R34, 6 September 2026).** The issued specification promises
`Authorization: Bearer {CALLBACK_TOKEN}` - "a token we issue to you" - and **the platform had no
such field**. `gameProviderCredentials` stored `apiKey`, `apiSecret` and `callbackSecret`; the
credentials dialog offered three inputs; and `loadProviderSecrets` set
`callbackToken: credentials.apiKey`. A provider implementing the document exactly was refused at
gate 3, and that log line says "either credentials are wrong or someone is probing the endpoint" -
so **a correct integration read as an attack**. Note it was found by building against the document
rather than by reading the code, which is exactly the mechanism section 2 says makes this phase
worth doing: a spec written by the same people as the platform is never tested by them re-reading
it.

**Four things about the fix that generalise.**

- **The spec was right and the code was wrong, so the code moved.** The tempting alternative was
  to amend `01` and re-issue the requirements HTML to describe what the platform actually did.
  That is the cheaper diff and it is the wrong direction: providers may already be building
  against the issued version, and a document that changes to match a defect teaches everyone that
  the document is not the contract.
- **Fixing it exposed a sibling hole that was already reachable.** A provider could be enabled
  with a callback secret and no token at all, so the screen could turn a switch on into a
  configuration where **every** result fails at gate 3 and is logged as an attack. That is
  precisely what the adapter and callback-secret refusals on the same screen exist to prevent;
  the third check was simply missing. Found by asking what else gate 3 needs, not by a test.
- **The compatibility fallback is deliberate, and it is fenced.** `loadProviderSecrets` still
  reads `apiKey` when no `callbackToken` is stored, because a schema default fixes future rows
  only and no migration can invent a value both sides already agree on. But `setProviderEnabled`
  demands the **explicit** field, so nothing new can rely on it - **a transitional path that new
  integrations may keep using is one nobody ever removes.**
- **`||` rather than `??`, and the reason is a live hole rather than style.** For a credential
  string every falsy value means absent, and `??` would hand gate 3 an empty token - where
  `safeEqual("", "")` is **true**, so a request carrying no `Authorization` header at all would
  authenticate. Gate 3 does guard this separately, which is exactly why it must not be the only
  place it is handled.

**The play surface found a live defect in the service and two more gaps in the issued spec.**

- **`stateFor` reported an unstarted round as finished**, because `finished` was derived from
  "there is no board to show" - and a round nobody has played has no board either. Every existing
  caller reached that function *after* starting, so nothing caught it; it became visible the moment
  a client existed that reads the state before offering a Start button, which would have shown a
  result screen for a round the player had not begun. It now derives from the terminal status, or
  from the **owed** status where a deadline has passed but no writer has recorded it yet - reporting
  the stored value there would leave a live board running against a dead clock for up to a minute.
- **A13: the provider is never told the origin it is embedded in**, so `postMessage` has no target
  origin to use. The strict-looking guess - derive it from `returnUrl` - fails **silently**: the
  browser drops the message, the platform never receives `ready`, and a spinner sits over a game
  that is running perfectly. Posting to `*` discloses nothing, because the message type has no
  score, rank or player field, and the platform already checks `event.origin` against the launch
  URL and `event.source` against the frame's own window. **Fix is one field on create-round**, and
  it is the same fact a CSP `frame-src` allowlist would need.
- **A14: `replayUrl` is required on every result and completely undefined.** This service builds
  one and **no route serves it**, so the platform is handed a URL that answers `NOT_FOUND`. Not a
  live defect - nothing follows the field yet - but it is a promise made inside a signed payload.
  It needs an owner decision rather than a guess, because a replay showing *the puzzle* is a
  content leak: a contest's boards are shared, so a losing player could read a live contest's
  content out of their own finished round.

**Four implementation decisions worth carrying forward:**

- **The frame message type has no score field, rather than a field nobody reads.** The client is
  an input device: it collects drags and posts the cells the player joined, and the server - which
  generated the puzzle - checks them and derives the score. The client does enforce the rules as
  you draw, but that is **feedback, not enforcement**, and `tools/test-board.ts` drives the browser
  module headlessly to assert its answers agree with `engine/verify.ts` on the same boards. Two of
  those tests first passed against a *generated* puzzle whose own shape made the guard redundant -
  a test can be structurally unable to fail while looking like coverage, so they were rewritten
  against a hand-built board.

- **`verifyCallback` cannot verify a signature for any provider whose secret is in the database.**
  The interface declares it synchronous; the secret is behind `select: false`. The mock passes only
  because its secret is a field on the instance. Gate 5 covers the HMAC, so nothing is unchecked -
  but the adapter must still not return `{ valid: true }` unchecked, so it asserts what is
  possible without a secret: three headers present, `sha256=` plus 64 hex characters, and the
  timestamp window through the shared helper.
- **The transport-header helpers moved into the mirrored folder.** `lib/services/game-providers/`
  is mirrored into `apps/admin` and `lib/services/games/` is not. Mirroring
  `callback-verification.ts` wholesale would have put `loadProviderSecrets` into the admin app
  with nothing calling it - a dead helper that hands out callback secrets - and a second copy of
  the five-minute window is the "one rule, two copies" failure this codebase has had four times.
- **The outbound credential loader must NOT check whether the provider is enabled**, even though
  the inbound `loadProviderSecrets` does. The sync route deliberately uses `getProviderAdapter`
  rather than `resolveEnabledProvider` so an operator can see a catalogue before enabling
  anything; a check there would make the first sync impossible, and the symptom would read as a
  credentials fault.

### 4.1b Preparing the deployment found three more defects - 6 September 2026

The service was made deployable: a PM2 entry, an nginx server block for a `games.` subdomain, an
annotated `env.example`, and a runbook in `deploy/README.md`. **Nothing was deployed.** But writing
the runbook meant stating precisely what an operator has to type, and three of the statements
turned out to be false - which is the same mechanism as R34 one level up. **Writing down what
somebody must do is a test of whether they can do it.**

- **The admin panel could not register a loopback provider at all.** `isHttpsUrl` required
  `https://` unconditionally, so `http://127.0.0.1:4010` was refused - and the refusal was
  correct-looking, because an external provider certainly must be https. What it missed is that
  the platform and a first-party provider share a machine, so **loopback is the safest possible
  base URL**, not a relaxed one: the traffic never touches a network. Now `isAcceptableProviderUrl`,
  permitting plain http **only** on `localhost`, `127.0.0.1` and `[::1]`. A private LAN address is
  still refused over http, which is the case worth naming: `http://10.0.0.5` looks internal and is
  not loopback, and a probe pins that distinction because widening the carve-out to "any http" is
  the natural way to break it. 7 probes.
- **The play origin defaulted to localhost and nothing would have said so.** `GAMES_PUBLIC_URL`
  was optional, falling back to `http://localhost:$PORT`, and **launch URLs are built from it** -
  so a deployment that forgot it would boot cleanly, sync a catalogue, publish a contest, and send
  every player's iframe to their own machine. No error, no log line; the player sees a blank
  rectangle. The same shape as the plain-http case, which browsers block as mixed content inside
  the platform's https page - again in the player's browser, so again invisible server-side.
- **`GAMES_FRAME_ANCESTORS` was documented rather than enforced**, so the game shipped embeddable
  by any site. An attacker who can frame a live round can overlay it, and the player cannot tell.

**The generalisable part is how the last two were fixed, because the earlier reasoning for leaving
them unenforced was sound.** `app.ts` said the check belonged in the README "because a service that
refused to boot without it could not be smoke-tested" - true of *unconditional* enforcement, and
the wrong conclusion. The smoke tools and all 167 service tests run without `NODE_ENV=production`,
so the two cases are separable and the trade-off was never necessary. Both are now boot refusals
**in production only**, with the play origin additionally required to be non-loopback https.

`tools/test-config.ts` (15 tests, 12 probes) pins **both halves, and the second is not padding**:
five tests assert that nothing is refused in development. A guard that fired locally would break
every suite here and be reverted within the day, and a reverted guard protects nobody - so the
carve-out is probed by widening `isProduction()` to `return true` and checking the development
tests catch it. Two further probes check the carve-out has not leaked onto the credentials, where
a production-only secret would restore the exact "absent configuration is permission to proceed"
class the config module exists to remove.

### 4.1c The play surface is proxied through the platform app, and that is a real trade

The owner rejected the subdomain route on 6 September 2026 on deployment-risk grounds: a DNS
record, an nginx server block and a certbot run on a server already carrying live traffic, none
of which they were willing to perform. **The service still runs as its own process on its own
port** - nothing about the separation the phase exists to prove has changed. What changed is how
the *player's browser* reaches it: three rewrites in `next.config.ts` mount the play surface on
the platform's own origin at `/play`.

**State the cost rather than burying it, because a summary would round it up to "same thing".**
The game frame is now **same-origin** with the platform. The provider *protocol* is entirely
unaffected - signed outbound calls, the round lifecycle, the signed inbound callback, score
ingestion and settlement all run exactly as before, because none of them involves a browser. What
is no longer rehearsed is the browser half:

- The play screen's `event.origin` check **passes trivially** instead of being tested against a
  genuinely different origin. The check still runs; it is simply no longer discriminating.
- The service's `frame-ancestors` policy is **not what permits the embed** - same-origin framing
  is allowed by the platform's existing `X-Frame-Options: SAMEORIGIN`. The policy is still set and
  still correct, just not load-bearing here.
- The absent platform-side CSP `frame-src` allowlist stays absent, and stays untested.

**All three close at X4 against a real provider and need no work here**, because an external
provider is cross-origin by construction and hosts its own play surface. That is also the answer
to the question the decision raised: **adding external providers requires no rewrite, no nginx
change and no DNS record** - the platform stores their address and nothing more.

**Four things about the implementation that generalise.**

- **Check what the app already owns before claiming a URL prefix.** The obvious mount for catalogue
  artwork was `/assets/`, and the platform has a `public/assets` directory. Under Next.js's
  `afterFiles` semantics that prefix would be **shadowed by the real folder for any file that
  exists and shadow the game for any that does not** - a half-working prefix, worse than either
  outcome alone, and it would have looked correct in every test that happened to request a
  missing file. Artwork is mounted at `/play/assets/` with `GAMES_ASSET_BASE_URL` set to match.
- **Returning a bare array is the safety property, not a shorthand.** Next.js treats it as
  `afterFiles`, so real pages and `public/` files match first and always win - which is what makes
  these rules unable to change the behaviour of any existing route. The `beforeFiles` form would
  invert exactly that. **A configuration shape can be a safety guarantee**, and it is worth a
  comment saying so, because "tidying" it into the object form silently removes the guarantee.
- **Rewrite order is behaviour, so a test must assert position and not contents.** `/play/:path*`
  placed before the artwork rule swallows it and forwards to a path the service does not serve.
  Both rules remain present and individually correct, so a contents assertion passes while every
  thumbnail 404s. Same class as the guard-position lesson from the admin Edit button.
- **A same-prefix constraint between two independent codebases needs writing down on both sides.**
  The proxy works only because `index.html` uses absolute `/play/...` paths and the platform mounts
  it at `/play`. Neither repository can see the other - `check:isolation` guarantees it - so the
  coupling exists only in prose, and it is now stated in `games-service/README.md` as well as here.

**What this does not change:** the service is still deployable on its own subdomain, the nginx
block and its runbook section are kept, and `GAMES_PUBLIC_URL` still decides which. Switching
later is two environment variables and a restart, with no code change.

**And the configuration was collapsed into one command the same day.** `npm run setup:env`
(`tools/setup-env.ts`) generates the four credentials, derives the play origin, the artwork prefix
and the frame allowlist from the platform's own `.env`, and prints the two pairs that go into the
admin panel. Three properties are the point of it rather than conveniences: it **refuses to
overwrite an existing `.env`** without `--force`, because the admin panel cannot show a stored
secret back and so the old values would be unrecoverable while every result failed its signature
check; it **applies the production origin rules itself**, duplicated from `assertPlayableOrigin`
because `loadConfig` needs the file being written; and `--dev` puts the development carve-out **in
the artifact, not in the enforcement** - the boot guard still refuses a loopback origin under
`NODE_ENV=production`, so a dev file copied to a server fails loudly instead of pointing every
player at their own machine.

---

### 4.1d The first round crossed the wall - 7 September 2026

**The two halves have spoken.** A round is now created by the platform, played by a person's
moves, scored by the service, delivered back signed, ingested through all eleven gates, written
onto a participant and **paid out as real prize money** - in one uninterrupted sequence, with a
real `games-service` process on a real port and real HTTP in both directions.

`__tests__/games/end-to-end-round.test.ts`, run by `npm run test:e2e-round`, three tests,
~75 seconds. Probed by `tools/probe-e2e-round.ps1`, three probes, all red on the expected test.

**The gap it closes is the one 4.1a names, and it is worth restating exactly.** The adapter's 49
tests run against a **stubbed `fetch`**, and the service's 167 run in-process against
`mongodb-memory-server`. Two green suites, neither of which can fail because the other side
disagrees. A stub returns what it is told. This is the first test in either repository whose
failure mode is *the two halves disagreeing*.

**What is substituted, stated precisely so nobody overclaims it.** Two things, and both are
named in the test's own header.

- **The Next.js routing layer.** There is no Next server in a vitest run, so the callback is
  received by a bare `node:http` server that hands the raw bytes and headers to
  `ingestProviderCallback` - which is *exactly and only* what
  `app/api/games/providers/[providerKey]/events/route.ts` does. The HMAC, the bytes, the socket
  and every gate are real; Next's own request plumbing is not exercised.
- **The browser.** The board is played by `games-service/tools/autoplay.ts` through the same four
  HTTP endpoints the browser uses. Whether a finger can draw a line on a phone is not something
  any test can answer, and `tools/smoke-play.ts` exists for that.

**Five acceptance criteria are now observed rather than asserted:** a catalogue synced from what
the service actually published; a round launched, played and scored with the score decided by the
service; a **lower-is-better** title where the faster player is **paid more**; a double-click that
does not consume a second attempt; and a byte-for-byte replayed delivery absorbed as a duplicate.

**Five things generalise from building it.**

- **A perfect player is a tool the service has to own, and none of the three that looked like it
  would do.** `smoke-play.ts`, `test-play.ts` and `test-board.ts` all play this game and **not one
  of them can play a round somebody else created** - each boots its own in-memory database and
  creates its own round inside it. That is the right shape for testing the service alone and
  exactly the wrong shape for the one thing this phase exists to prove, and it is why the sentence
  "the two halves have never spoken" survived three tools that each looked like a counterexample.
  `tools/autoplay.ts` is new, takes a `roundId` that already exists, and lives **inside the
  service** because `presentationSeed` is generated there and stored nowhere else - the platform
  could not compute a solution if it wanted to.
- **A map of an API is a hypothesis until a real response disagrees with it.** The play surface
  returns a **bare `PlayState` from `session`, `state` and `leave`, and a wrapped
  `{ accepted, refusal, state }` only from `submit`.** The first driver assumed all four were
  wrapped, and the symptom was `Session refused: unknown` - because reading `.state` off a bare
  state gives `undefined`, which is **indistinguishable from a refusal**. Same class as the
  aside-verification rule, one layer out: a summary of code is a claim about it.
- **The two titles end for different reasons and only one of them ends because you played well.**
  `circuit-perfect` asks for a fixed board count, so solving them finishes the round.
  `circuit-sprint` asks how many you can solve in a fixed time, so **a perfect player never
  finishes it** - the clock does, and the sweeper writes the terminal status up to a tick later.
  The first loop ignored `endsAt` and read as an infinite loop. It is also why this suite takes
  75 seconds and cannot be made faster: `durationSeconds` is clamped to a **60-second floor** by
  the title's own `configSchema`, so shortening it would test a contest no operator can create.
- **`spawn("npx.cmd")` fails with `EINVAL` on Node 20 and later**, which closed a Windows
  command-injection hole by refusing to launch batch files without an explicit shell. `shell: true`
  reopens it *and* breaks on a path containing a space. Spawning the service's own
  `node_modules/tsx/dist/cli.mjs` with `process.execPath` involves no shell at all - and using the
  service's copy rather than the platform's keeps the isolation honest.
- **A test this heavy must be opt-in, and the reason is not its runtime.** It needs
  `games-service/node_modules`, which is a **separate install by design**. Left in the default
  suite, a fresh clone fails on a missing module and it reads as *the platform* being broken. It
  binds a port, so two runs collide. And the pre-push hook runs the suite, so quadrupling it is how
  a team learns to reach for `--no-verify`. Hence `vitest.e2e.config.ts` and a named script.

**And the finding worth recording is that there was no finding.** Every earlier phase in this
programme produced live defects on contact - X4a's own first day produced R34, the play surface
produced three more. **The first real round found none in the product.** The three defects this
work did surface were in the new test driver and in the map it was written from, all corrected
above. That is a genuinely good result and it should be stated plainly rather than dressed up:
the protocol, the gates, the score seam and the settlement path did what the chapters said they
would, the first time they were asked to do it together.

---

### 4.1e What is still not done, and the runbook for it

**The acceptance criterion is "by clicking, in a browser, with no test harness involved", and this
is a test harness.** That distinction is the whole remaining gap, and it is not a technicality:
the two capabilities most recently found missing on this programme - a publish button and a play
screen - were both **complete by API and unreachable by clicking**, found only by grepping for a
caller. A passing end-to-end test is evidence about the protocol and says nothing about whether an
operator and a player can actually get there.

It cannot be closed from here: it needs an authenticated admin session and an authenticated player
session, and this environment has neither. So it is the owner's run, and the steps are:

1. **Deploy.** `games-service` on the server, `pm2 start ecosystem.config.js --only chartvolt-games`,
   with `npm run setup:env` having written the `.env`. The play surface arrives at
   `https://chartvolt.com/play` through the three rewrites - no DNS, no nginx, no certificate.
2. **Register the provider** in the admin panel as **ChartVolt Games**, first-party, base URL
   pointing at the service. Paste the four credentials `setup:env` printed. **Check the display
   name before the first contest settles** - a provider row joined to contest history can never be
   renamed away from it.
3. **Sync the catalogue**, and confirm the title appears. ~~**Enable `circuit-perfect` first**: it
   ends when the player finishes rather than when a clock does, so a full round takes under a
   minute rather than the sprint's 60-second floor.~~ **Stale since 8 September 2026** - there is
   only `circuit-sprint` now (s4.1g). **Set the contest's playing time to one minute**, which is
   the dropdown's shortest option, and the round ends in a minute.
4. **Create and publish a contest.** Draft first, then the Publish button - the checklist re-runs
   against the stored document.
5. **Enter it from two different player accounts and play both**, with different completion times.
6. **Confirm the money.** The faster player must be paid more. Then check the admin round inspector
   shows both rounds `completed` with their raw deliveries.

**Four acceptance criteria remain untouched by today's work and are not scheduled**: all three
unresolved-round policies observed by withholding a result; a score injected from the browser
console being rejected (the frame protocol has no score field, which is proven, but not by
attempting it from a console); the content set rendering on a game page, since
**there is no rules surface for a provider title yet**; and localisation, which is `en` only on
purpose. The **spec-ambiguity log is still 14 entries, all `OPEN`** - nothing there is closed by
this service choosing a behaviour, only by `01` and the requirements HTML being amended with a
version bump.

### 4.1f The play surface was unreadable, and two of its three defects were invisible to every test - 7 September 2026

The owner's report was blunt: the board is small and ugly, there are no instructions, and the result
screen's wording and graphics are bad. All three were true, and the interesting part is **why none
of them could have been found by anything in this repository.**

**The board was the size of a postage stamp for a reason nobody would guess, and it was a feedback
loop.** The frame reported `document.documentElement.scrollHeight` to the platform, and the
stylesheet sizes the page to `100dvh` - which inside an iframe is *the iframe's own height*. So the
game measured the frame, the platform sized the frame to the measurement, and the two agreed on
whatever the host had opened with: `MIN_FRAME_HEIGHT`, **320 pixels**. After the header and footer
that left about 180 for the grid, so `boardCellPx` hit its floor of 34 and **every player on every
screen got the smallest board the code can draw.** Nothing errored, no log line, and the arithmetic
is correct in isolation - it was the *input* that was circular.

The fix is that the height is now **derived from what the game needs and never from what it has**:
rows of grid at a comfortable cell size plus the measured chrome. Requests are 533, 605 and 677
pixels for a 5-, 6- and 7-row board, all comfortably inside the host's `[320, 2000]`. Measured in a
real browser at 980x620 the cells went from 34 to **75 pixels**, and on a 390-wide phone to 59.

**The property a test can hold is the one worth stating: the function ignores the current height
entirely.** Feed it a `currentHeight` and the answer must not move. A reintroduction has to add the
field back to the signature, and the assertion turns red the moment it is read.

**The wording defect was a string, and it was insulting.** `completed` covers two genuinely
different endings - a Sprint clock reaching zero and a Perfect player finishing the last of a fixed
set - and the heading was a lookup on the status, so both said **"Time!"**. Circuit Perfect has no
clock in its rules at all, so the one player who had done everything the game asked was
congratulated for running out of time. Only the board count can tell the two apart. Every ending
now has its own heading, and every branch says **what happens next**, because "your result is being
confirmed" answered none of the questions a player has - does this count, do I get my attempt back,
where do I see the score. A **void** in particular returns the attempt, which section 13 requires
and which is the difference between a player who tries again and a player who opens a ticket.

**The rules had two homes and had already drifted.** They were list items in `index.html` *and*
prose inside each title's `howToPlay`: the page said "the two circles that share a number", the
catalogue said "one terminal to its matching pair", and the page never mentioned that a path can be
redrawn at all. That is the **"one rule, two copies"** shape behind five defects in the platform
beside this service, and neither a typecheck nor `check:mirrors` can see a copy that lives in
markup. `src/games/instructions.ts` now owns the four sentences, the catalogue composes its prose
from them, and the play surface is **handed them in the round state** - so `PlayState` gained
`title`, `boardRules` and `scoring`.

**`scoring` was missing outright, and it is the most valuable of the three.** A player in a paid
contest had no way to find out *from inside the game* whether a fast board was worth more than a
finished one - which for a lower-is-better title is the difference between playing to win and
playing to lose.

Three things about how this was built are worth carrying:

- **A module that cannot be imported is a module whose logic cannot be asserted.** All three
  defects lived in `app.js`, which reaches for `document` at module scope, so no test could touch
  it. The numbers and the wording moved into **`public/play/presentation.js`** - no imports, no
  globals, plain values - and `tools/test-presentation.ts` runs it in Node with no DOM stub of any
  kind. **24 tests, and the fix is the extraction as much as the arithmetic.**
- **The page's own references are not its module graph.** The existing asset test walks `src` and
  `href` attributes, which is `app.js` and `app.css`. `board.js` and `presentation.js` are reached
  by `import` *inside* other scripts, so a module missing from the allowlist in `play-page.ts` is a
  404 in the middle of the graph - the importer then fails to evaluate too, **the game does not
  boot at all**, and the only evidence is a console message in a player's browser. A new test
  follows the imports rather than listing the files.
- **`aspect-ratio` and `flex: none` on an inline SVG are load-bearing, and leaving either out is
  not a broken layout.** The new how-to-play diagram collapsed to a **hairline** of blue, because
  an `<svg>` with `height: auto` has no definite height for a flex item to keep and a column flex
  container shrinks it to nothing - and being a graphic, nothing inside pushes back. The screen
  read perfectly well with no illustration on it. **Found by looking at it**, which is the point
  of the section below.

**Verified by eye, in a browser, on both titles**, at 980x620 and at 390x640: the intro with its
animated diagram, a 6x6 board at 75-pixel cells with two paths drawn, and both result variants.
That is a genuine difference from `13` s4.1d, where the platform's own lobbies are **behind
sign-in** and could not be seen. **196 tests and 19 probes**, all red on exactly the expected test,
with the two widest declaring their blast radius and the reason.

**What this did not touch:** the score still never reaches the browser - `resultCopy` destructures
the four fields it uses, so a score handed to it is ignored by construction, and the state carries
no score, rank or prize on any status. Both halves are asserted, because they fail differently.

---

### 4.1g Circuit Perfect retired, and the sprint declares its clock - 8 September 2026

The owner's instruction: **no fixed set of boards and no per-round restriction.** A player
gets a time budget, solves as many boards as they can inside it, and is scored on how many
and how fast. **204 tests in `games-service`** at the time, up from 196 - **209 since 4.1h**.

**The finding is that this was already Circuit Sprint**, exactly. It asks how many boards
you can solve in a fixed time, scores count and speed, and a perfect player never finishes
it - the clock does. So the change on the game's side is small and the platform side is
where the work was (`12` s2.9).

| Change | Why |
|---|---|
| **`circuit-perfect` retired** | It was the one title whose scoring depended on **finishing a fixed board count**, which is the model the instruction replaced. It existed so a ranking sign error could not pass every test, being lower-is-better on `duration_ms` - that value is real and is recorded as a gap below |
| It is **`status: "deprecated"`, not removed from `TITLES`** | The same rule the platform applies to a provider it stops using: `gameKey` is the join key for every stat a title ever produced, so deleting the row orphans history while every screen still renders a key it cannot resolve. `contest-preflight.ts` refuses a non-`active` title, so **no new contest can be created on it** while rounds already played still read and score correctly |
| **Sprint's play time widened to 60-3600 seconds**, default 600 | It was 60-300, which is what made the ceiling defect bite: a five-minute ceiling reserved against contests of any length. The owner's example is ten minutes |
| **Its score range widened** | More time means more boards, and a range that truncates the score of the best player is a payout defect wearing a validation message |
| **`format: "duration-seconds"` declared on `durationSeconds`** | So the platform can reserve the *configured* playing time. `01` section 3.2 is the provider-facing requirement, issued at **version 1.3** |
| Sprint's score clamp made visible | It clamps to its declared range and now says so, rather than silently reporting a lower number than the player earned |

**"Retired" means deprecated, and the difference is the whole reason it is still in the
file.** Deleting the row would orphan every stat joined to its `gameKey`, which is
immutable - the same reasoning that gives a provider a disable switch and no delete, and
that retires a disabled game's rows rather than removing them (R29). The pre-flight already
refuses a non-`active` title, so the deprecation *is* the enforcement: no new contest can
be created on it, and nothing that was already played changes. **A document saying the
title was deleted is describing data loss nobody caused.**

**What retiring a title costs, and it is not nothing.** `circuit-perfect` was the only
`lower_is_better` / `duration_ms` title in the catalogue, and it was built for that reason:
a sign error in the ranking direction cannot pass a suite where every title ranks the same
way. That coverage now rests on unit tests of `resolveScoreDirection` and the golden
ranking regression rather than on an end-to-end round. **Recorded rather than absorbed** -
the honest options are a second sprint variant scored on total time, or accepting the
narrower coverage until a real provider supplies a lower-is-better title. Neither is
scheduled.

**What did NOT change, because the instruction reads as though it should have.** Ties,
unclaimed shares, players who never scored and disqualification are all decided by
`05` s9.2 and s9.3 and the ranking engine, none of it per-title - so "ties apply the same,
and all the rest apply the same" required no change at all. **A document presenting any of
that as part of this work is describing something nobody built.**

> **Superseded later the same day, and only on the joining half.** This section originally
> said "registration closes at `startTime` and always did", which was true when it was
> written and is false now: `12` s2.10 moved entry to the last moment playing is still
> possible. Corrected here rather than deleted, because the sentence was the *reason* the
> owner's "join any time before it ends" instruction looked already-satisfied when it was
> not.

**And the runbook in 4.1e is now stale in one step.** Step 3 says to enable
`circuit-perfect` first, because it ends when the player finishes rather than when a clock
does, which made a full manual round quick. There is only one title now, so the sprint's
clock is the floor - **set the contest's playing time to one minute** for a manual run and
the round ends in a minute.

### 4.1h The service and its play surface were deployed apart - 8 September 2026

**R52.** The owner opened Circuit Sprint, watched a spinner, and gave up. So did the retry.
The platform's twelve-second stall panel - added the day before - was the only component in
the entire stack that noticed anything was wrong. **209 tests**, 7 probes in
`tools/probe-deploy-drift.ps1`, all red on exactly the expected test.

> **SUPERSEDED IN ITS CONCLUSION, later the same day - see 4.1i.** Everything below about the
> cause is right. The **fix** was not: a boot audit cannot report a stale build, because it ships
> **inside** the stale build. The owner reopened the game and it failed identically. The coupling
> was then removed rather than monitored, and **213 tests** is the current figure. This section is
> kept as written because the reasoning that produced the wrong fix is the useful part.

**There was no bug in any revision, which is why nothing found it.** `public/play` is plain
files that arrive with a `git pull`. The allowlist in `src/http/play-page.ts` authorising
them is TypeScript, and only exists once `npm run build` has run. The server was a
**6 September** build serving a **7 September** surface, so `presentation.js` - introduced by
4.1f and imported by both `app.js` and `board.js` - was answered with a JSON 404.

**An ES module that 404s takes its importer down with it.** That is the part worth carrying,
because it turns a missing file into a total failure rather than a degraded one: nothing
evaluated, so the page never got past its own boot markup, never posted `ready`, and the
player saw the loading state the document ships with. No request failed from the platform's
side. Nothing appeared in any log on either side.

| Symptom the owner reported | Cause |
|---|---|
| Neither title would start | `presentation.js` 404, module graph dead |
| Circuit Perfect still offered, a morning after being retired | The catalogue rows were synced from a service still reporting the 6 Sep catalogue |
| Sprint advertising "Up to 300s an attempt" against a 3600s ceiling | The same stale catalogue |
| "Confirming your result" for ever, and `failed 1` in the sweeper log | A real delivery failure whose reason was being discarded - see below |

**The picker had no defect, and checking that mattered.** `listContestableTitles` already
filters on `providerStatus: "active"`, so the obvious fix - "hide deprecated titles" - was
already the behaviour. There was simply nothing for it to filter, because no sync had brought
the deprecation across. **Do not build the guard a symptom suggests before checking whether
it exists**, or the real cause survives behind a change that reviews as correct.

**Why no test could have caught it.** `every module the play surface imports is served`
walks the real import graph and would catch a module committed without its allowlist line.
It passed all day. It can only ever test **one revision**, and this fault is a disagreement
**between** revisions - the same rule this programme already carries about `check:mirrors`:
**a green guard proves two copies agree in the repository, never that the two halves of a
running deployment agree with each other.** Only the deployment can answer that.

So `auditPlaySurface` runs at boot and compares the directory against the served set in both
directions, naming the files and the remedy. Four things about it are load-bearing:

- **Both directions.** Code newer than the files is the same deploy mistake with the halves
  swapped, and it produces the same dead page.
- **`index.html` is excluded**, because it has its own route and is deliberately not in the
  allowlist. An audit that diffed the whole directory would print an error on **every boot**,
  and a guard that cries wolf at every start is the line everyone learns to scroll past -
  including on the day it is right.
- **It logs and does not refuse to start**, following `resolvePlayRoot`'s existing decision in
  the same file. Creating rounds and, above all, the sweeper delivering results for rounds
  already in flight all work without these files; refusing to boot would turn a broken play
  surface into contests that cannot settle.
- **Both its inputs are parameters.** It first read `ASSETS` from module scope, and removing
  one entry turned **five** tests red - so no test could say which rule had broken. **A pure
  function with one input injected and one read from module scope is only half pure, and the
  blast radius of a probe is what reveals it.**

**The second finding, from reading the logs for the first.** The sweeper printed `failed 1`
every tick and nothing else, while `attemptDelivery` had already computed exactly why -
`HTTP 401`, `HTTP 500`, a fetch error's own message - returned it, and had it dropped on the
floor. A rotated callback secret, a platform that is down and a URL routed to nothing all
produce that identical line. **Classify a failure; never merely count it** - already a rule
here from the concurrency tests, and this is what it costs in production.

**One fault is operational and no code can fix it.** The logs show `4|chartvolt-games` and
`5|chartvolt-games` - two processes - while `ecosystem.config.js` declares `instances: 1`
and its comment says why: "the callback sweeper is a singleton, and two copies would race to
deliver the same result and double the provider's retry traffic." That race is visible in the
logs as one instance reporting `delivered 1` while the other reports `failed 1` on the same
interval. `pm2 delete` the duplicate.

**What it cost players, stated precisely.** No money moved, no prize was paid, no stored value
is wrong, and **nothing was backfilled**. But an attempt is spent when a round is **created**,
so a player whose game never booted has still used theirs, and those rounds settle under the
contest's `unresolvedRoundPolicy` like any other. The remedy is `npm run build` in
`games-service`, a restart, and a catalogue re-sync from the Game Providers screen.

### 4.1i The guard that shipped inside the thing it was guarding - 8 September 2026

**The owner reopened the game and it failed identically**, with the same
`/play/presentation.js` 404 in the console. The audit in 4.1h detects that drift precisely and
names the file. **It could never have fired, because it lives in the build it exists to warn
about.**

That is the whole lesson and it generalises well beyond this service. **A guard shipped inside
the artifact whose staleness it reports is absent in exactly the state it was written for.** The
code is real, correct, unit-tested and probed; it is simply not present on the machine where the
condition holds. It is the same shape as a comment asserting a check that does not run - and
harder to spot, because everything about it reviews as diligent.

**So the coupling was deleted rather than monitored.** `readServableAssets` builds the served set
from the directory listing at boot. A module arriving with a `git pull` is servable immediately,
with no build: **two things must ship together for a filename list, and one thing cannot disagree
with itself.**

| Rule | Why it is not the obvious alternative |
|---|---|
| The request string is only ever a **`Map` key** | The path handed to `sendFile` comes from `readdirSync`, so `../` and its encoded forms cannot become a path however they arrive. This is the property the old allowlist bought and it is unchanged - it is also why `express.static` is still refused on this route |
| Still a `Map`, never an object literal | `in` and object indexing walk the prototype chain, so `"__proto__"` returns something truthy. Found in the admin round inspector on 5 September and twice since |
| **Top-level regular files only** | No recursion, so nothing nested is reachable and a directory cannot be mistaken for a file. `/play/assets/...` is a real path a browser asks for, because the platform's own artwork rewrite uses it |
| An **extension** allowlist, not a filename one | The whole of the remaining protection, so a stray `.env`, `.ts` or editor backup is unservable. It is also the only way a file can still be present and unreachable, which is what the boot audit now reports |
| Read **once at boot**, not per request | A `readdirSync` on an unauthenticated route is a syscall an anonymous caller can repeat. Picking up a new file needs a restart, which every deploy does - the point is that it no longer needs a **build** |

**The audit is kept, with its scope corrected in the file.** `unserved` now means one thing: a
plausible asset whose extension is not recognised. `missing` is **structurally impossible** and is
kept as a **tripwire**, documented as such, because it becomes reachable the moment anybody
reintroduces a hand-written list - which is exactly the change this file now argues against. An
overstated guard is a wrong fact, the same duty as correcting a risk downward.

**Probe 4 came back green and taught the third cause of a green probe again.** The explicit
`index.html` skip is real and **unreachable**: `.html` was never in the content-type table, so the
document was already refused a line later. Three consequences, and the middle one is the
transferable part - the skip is kept as a tripwire with the reason in the file; **the test gained a
second assertion pinning where the guarantee actually lives**, because a test asserting only the
observable behaviour credits the name check with a guarantee it does not provide; and the probe was
re-aimed at adding `.html` to the table, which is the realistic mutation, since a rules page is how
`.html` would arrive.

**213 tests** (up from 209), `tools/probe-play-assets.ps1`, 6 probes, all red on exactly the
expected test with a blast radius of one or two.

**The owner must still rebuild once.** This change cannot repair the build that is running,
because the change is *in* the build. After that rebuild the class of fault is gone.

---

## 5. What this does NOT prove

Stating this matters, because a green harness invites the conclusion that X4 is a formality.

- **A real provider's authentication, error shapes, latency, downtime and rate limits.** We
  will have built the polite, well-behaved partner we wish existed.
- **Their content quality, localisation and support responsiveness** - outside our control,
  and `17` risk X4 is explicitly about not being able to fix their game.
- **The pricing model.** A per-round fee is a commercial unknown and the reason a low-fee
  contest can be net loss-making (risk X3). A free harness tells us nothing about it.
- **Spec ambiguity, if the same person writes both sides.** The mitigation is a different
  implementer where possible, and the ambiguity log where not.

**It shrinks X4, it does not replace it.** Any summary implying otherwise is wrong.

---

## 6. Risks specific to this phase

**The provider row is permanent, which is why it must be first-party.** `gameKey` is immutable
because it is the join key for every historical stat, providers joined to contest history
cannot be deleted, and a disabled game's rows are retired rather than removed. So the moment
this settles one real contest, **whatever name is on that provider row is in our production
data, financial reports and audit trail for ever.** Under the 5 September scope decision that
is fine, because the row represents ChartVolt - but it is precisely why a placeholder company
name must not be used even during development. **Get the name right before the first contest
settles, not after**, because there is no cleanup path.

**Being first-party removes a gate we would otherwise rely on.** The harness version was to be
kept away from players by `externalGamesEnabled`, the provider's `enabled` and the per-title
`chartvoltEnabled`. A product game is *meant* to be reachable, so those three stop being a
safety net and become ordinary launch controls. That makes the **pre-launch quality bar the
only thing standing between an unfinished game and a paying player**, which is an argument for
finishing it properly rather than shipping the harness and improving it in place.

**"It is our game" removes one risk and adds another.** Risk X4 - *we cannot fix their game* -
does not apply: a scoring quirk or a mobile bug is a sprint task, not a support ticket to a
third party. In exchange the platform now owns a game's content, balance, support and
lifecycle for ever, which is the burden the external-only decision was chosen to avoid. That
trade is deliberate; it should not be rediscovered later as a surprise.

**Designing the spec around our own implementation.** If the harness is awkward to build, the
temptation is to change the spec to suit it. Sometimes correct, sometimes exactly backwards:
the question is always whether the spec is *unclear* or merely *demanding*.

**Scope creep into a product game.** See section 8. The harness is 1-1.5 weeks; a game good
enough to put in front of paying players is not, and the slide from one to the other happens
one reasonable improvement at a time.

---

## 7. Where it sits in the programme

Immediately **before X4**, as **X4a**, and unblocked today:

```
X0 (signed off) -> X1 -> X2 -> X3 -> X5 -> [X6 slices]
                                             |
                                          X4a  (no external dependency)
                                             |
                                          X4   (needs a signed provider + sandbox)
```

It has **no commercial dependency**, which is the whole point: it is the only remaining work
on the shortest useful path that does not wait on a contract. It also shares open question
10's deadline of "before X4", for the reason in section 1.

**It does not reorder anything.** X4 still needs a real provider; X5 is already built.

---

## 8. Scope - decided 5 September 2026

**The question was: a throwaway harness, or also open question 10's in-house hedge game? The
owner chose both.** The recommendation in the first draft of this chapter was the harness
alone; it was **not** taken, and the reasoning for the choice made is stronger than the
recommendation it overruled, so it is recorded here rather than in a footnote.

| | Harness only (recommended, **not chosen**) | **Also the hedge game (CHOSEN)** |
|---|---|---|
| Quality bar | Good enough to drive every path | **Good enough for paying players** |
| Cost | 1-1.5 weeks | **3.5-5 weeks** - game design, art, mobile, localisation, content, QA |
| If the provider search fails | One game. Risk X8 stands untouched | **A second real game. X8 materially reduced** |
| Ongoing burden | Dev-only, no players | A product, with content and support cost |
| Risk | Scope creep into the right column | Distraction from the external programme |

**Why the more expensive answer is defensible.** The harness-only option leaves the platform
in the position risk X8 describes: the entire foundation and admin programme funded, and still
exactly one game if the provider search or the pricing fails. That is the single largest
exposure in the external-only route, it was raised rather than removed by the 2 September
decision, and no amount of test tooling touches it. Paying ~3 weeks to convert a throwaway
harness into a real second game buys down the programme's biggest risk with work that was
partly going to be done anyway.

### The consequence that changes the design, not just the estimate

**It is no longer a fake company. It is ChartVolt as a first-party provider.**

The harness version was going to register something like "Mock Games Ltd". For a game that
real players pay to enter, that is wrong in a way that cannot be undone later: a provider
joined to contest history **cannot be deleted**, `gameKey` is immutable, and a disabled game's
rows are retired rather than removed. A fake company name would therefore sit in production
data, on financial reports and in audit trails, for ever, attached to a real product. The
provider row must represent **ChartVolt itself**, honestly labelled as first-party.

### And the part that makes this cheaper than it looks

**Our game speaks the provider protocol, so the hedge costs no in-house game-module
architecture.** `New games plan` P1/P2 designed an entire in-house module path - registry,
module contract, per-game scoring - and that plan was dropped with the external-only decision.
This game does not resurrect it. It is a provider game that happens to be ours, so it arrives
through the seam that already exists and is already tested. One mechanism, two benefits.

**But the arm's-length rules in section 2 now matter more, not less.** As a product there will
be pressure to integrate it deeply - share types, call internal services, skip the signature.
Every such shortcut destroys both purposes at once: it stops being a valid reference
implementation, *and* it stops proving the seam can carry a real game. **The arm's length is
the hedge's value, not an inconvenience it inherits from the harness.**

### What is still true after the decision

Risk **X8 is not yet reduced** - it is reduced *when this ships*, and a plan is not a game.
Until it is playable, the exposure is unchanged and any summary implying otherwise is wrong.
Section 5 also stands in full: this still does not rehearse a real provider's authentication,
error shapes, latency or pricing. **X4a shrinks X4. It does not replace it, and it is not a
substitute for finding a provider.**

---

## 9. Acceptance criteria

- [ ] A person can register the fake company, sync its catalogue, enable a title, create and
      publish a contest, pay to enter, play a real game, and be paid a real prize - **by
      clicking, in a browser, with no test harness involved**
- [ ] A **lower-is-better** title ranks and pays correctly, observed rather than asserted
- [ ] A bad signature, a replay, and a delivery during `finalizing` are each refused, and the
      refusal is legible in the admin round inspector
- [ ] All three unresolved-round policies observed by withholding a result
- [ ] An attempt is consumed on creation and a double-click does not consume two
- [ ] A score injected from the browser console is rejected
- [ ] The content set renders on the game page for every title
- [ ] The spec-ambiguity log exists and every entry is resolved in
      `01-provider-contract-specification.md` **and** the HTML, with the version bumped
- [ ] The game service cannot move money, demonstrated rather than asserted
- [ ] The provider row is labelled as **ChartVolt first-party**, not a placeholder company -
      checked before the first contest settles, because the row cannot be renamed away from
      history afterwards
- [ ] **Zero imports from this repository** in the game service, asserted by a check rather
      than by review - this is what keeps it a valid reference implementation as it grows into
      a product

Added by the 5 September scope decision, because it is now a product:

- [ ] Playable on a phone
- [ ] Content localised into every locale the platform serves
- [ ] The game is **skill-based**, with a written argument for why, fit to sit alongside
      `legal/ChartVolt-Regulatory-Defence-Pack.html`
- [ ] Nothing about it improves a player's score for money - no paid retries, extra time,
      hints or easier content, per the marketplace constraint
- [ ] It is a **paid multi-player format**: contests of two or more, challenges of exactly
      two, and practice free and unranked. No paid single-player mode
