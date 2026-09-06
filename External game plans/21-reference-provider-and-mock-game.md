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
| Content set | Tagline, description, rules, how-to-play, thumbnail, banner, for both titles, localised |
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
| Two titles | **Built.** `circuit-sprint` (higher-is-better, integer) and `circuit-perfect` (lower-is-better, `duration_ms`), from one engine. The second exists so a ranking sign error cannot pass every test |
| The four spec endpoints | **Built.** Catalogue, create round, fetch round, void round, plus signed inbound auth with a rotation window, a retrying result callback, and a four-stage reconciliation sweeper |
| Spec-ambiguity log | **Built and open.** `games-service/AMBIGUITY-LOG.md`. **Not yet resolved back into `01` and the requirements HTML** |
| The platform adapter | **Built.** `chartvolt-games` registered in both registry copies, four files under `lib/services/game-providers/adapters/`, mirrored into `apps/admin` and verified byte-identical. 49 tests, 24 probes |
| **The playable board** | **Built.** `GET /play?t={token}` serves a real game: `public/play/` (4 files, no build step) behind `src/http/play-page.ts`. Dragging with a finger draws paths, the clock runs, a solved board advances, and the round settles into a signed result. Verified by a human-equivalent browser run on both titles. 11 headless tests drive the browser module against the server's verifier; 13 probes |
| **Provider registration** | **NOT DONE through the admin screens.** The service now has a local `.env` and has been started - including **from its production `dist` build**, not only under `tsx` - and answers signed catalogue calls. Registration was attempted in the admin UI on 6 Sep 2026 and **found a live defect**: the base-URL validator required `https://` unconditionally, so a loopback provider could not be registered at all. Fixed (see 4.1b) |
| **Any end-to-end round** | **NOT DONE.** No round has travelled between the two halves |
| **Production deployment** | **Prepared, not performed.** PM2 entry `chartvolt-games`, `games-service/env.example`, and a runbook in `deploy/README.md`. **Two exposure routes**: proxied through the platform app at `/play` (the default since 6 Sep 2026, owner's choice - no DNS, no nginx, no certificate) or its own `games.` subdomain (the nginx block is kept). Nothing has been deployed - see 4.1b for the two boot guards this work added and 4.1c for what the proxy route costs |
| Mobile support | **Built for the game screen, not yet for the catalogue.** The board is sized from the viewport, uses `100dvh`, and sets `touch-action: none` so a drag does not scroll the page - which is the one CSS rule in the file that decides whether the game works on a phone at all |
| Content set, localisation, runbook | **NOT STARTED.** Both titles declare `en` only, deliberately: declaring a locale and shipping English strings for it renders confident English copy on a Greek game page with nothing raising an error |

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
- [ ] The content set renders on the game page for both titles
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
