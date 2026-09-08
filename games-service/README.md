# ChartVolt Games - a first-party game provider

This is **phase X4a** of `External game plans/21-reference-provider-and-mock-game.md`.

It is a game company. It happens to be ours, but it is registered in the platform the same
way any third party would be, it is reached over HTTP the same way, and it is authenticated
and signed the same way. The games it serves are real games that real players pay to enter.

It serves two purposes at once, and both depend on the same property:

1. **The reference implementation.** It proves the provider integration works end to end,
   with a human playing, before a real provider has been signed.
2. **The platform's hedge.** If the provider search or the pricing fails, this is a second
   real game rather than nothing. That is risk **X8**.

---

## The one rule that matters: nothing here may import from the ChartVolt repository

Not a type, not a constant, not a signing helper, not a model. **This service is built
strictly from `External game plans/ChartVolt-Game-API-Requirements.html`** - the document
real providers receive - and from nothing else.

**Why, because the temptation is constant and the reasoning is not obvious.** A harness that
shares our types cannot discover an ambiguity in the spec, because both sides are then
reading the author's intent rather than the author's words. It would agree with itself and
prove nothing. The same trap as seeding a test through the raw MongoDB driver: the fixture
is no longer bound by the rules the real thing obeys, so it can pass while the real thing
would fail.

It is enforced rather than trusted: **`npm run check:isolation`**.

### Two deliberate differences from `api-server/`, so nobody "fixes" them

- **`tsconfig.json` has no `paths` mapping.** `api-server/tsconfig.json` maps `@/*` to
  `../*`, so it can reach into the platform. That mapping is **deliberately absent here**,
  which is what makes an accidental import a compile error rather than a review comment.
  Adding it back for consistency would silently remove the guarantee this whole phase rests
  on.
- **Its own `package.json` and `node_modules`.** Shared with `api-server` as a pattern, but
  here it is load-bearing rather than incidental: module resolution, not discipline, is what
  keeps the two sides apart.

### And one deliberate entry in the platform's config

The platform's root `tsconfig.json` **excludes `games-service`**, alongside `apps`,
`api-server` and `worker` - every other separate process. It has to, because the two configs
disagree on purpose: the platform sets `allowJs: true` and this service does not.
`tools/test-board.ts` and `tools/test-presentation.ts` import the browser's `board.js` and
`presentation.js` to drive them headlessly, so under this config each import needs a
`@ts-expect-error` and under the platform's it is flagged as an unnecessary one. **The same file
cannot satisfy both**, and the service's own config is the one that should win, because this is
the config the service ships with.

Removing that exclusion is not silent - it surfaces immediately as one typecheck error - so
there is no guard, only this note.

---

## The games

One engine, one title. **Circuit** is a non-crossing path puzzle: connect each pair of
matching terminals so that no two paths cross. Chosen for reasons that are all constraints
from the spec or the plan rather than taste:

| Property | Why it was required |
|---|---|
| **Language-free** | Provider titles must be localised into every locale we serve. A word or trivia game is a content bill in every language, for ever - exactly the burden the external-only route was chosen to avoid. A grid of coloured terminals needs no translation beyond the UI chrome |
| **Deterministically seedable** | `contentSeed` is **required** for competitions: every player in a contest must face identical content, or the ranking is not a fair comparison and the skill argument collapses. Puzzles are generated from the seed by construction |
| **Server-verifiable** | The player has a developer console, so a score arriving from the browser is worthless. The server generated the puzzle, so it can check the submitted paths itself. **The score is derived here, never reported by the client** |
| **Skill, not chance** | No randomness during play. The puzzle is fixed before the first move, and every player gets the same one |
| **Mobile-native** | Drag to draw a path. Most players are on a phone |

### The title, and the one that was retired

| | `circuit-sprint` |
|---|---|
| Score | Points, **higher is better** |
| Format | Solve as many puzzles as you can inside the contest's playing time - **1 to 60 minutes**, chosen per contest, 10 by default |
| Play clock | `durationSeconds`, declared `format: "duration-seconds"` so the platform can reserve the right amount of time. `01` section 3.2 |

**Scoring is count and speed**, which is the whole point of the format: more boards is
worth more, and solving each one faster is worth more. A player is never required to finish
anything - the clock ends the round, and whatever they achieved is their score.

**`circuit-perfect` was retired on 8 September 2026**, on the owner's instruction that there
be no fixed board count and no per-round restriction. It solved a fixed set of five puzzles
as fast as possible, scored on total time (`lower_is_better`, `duration_ms`), and it existed
to make `scoreDirection` observable - getting the direction wrong ranks the whole field
backwards and pays the slowest player first.

**It is `status: "deprecated"`, still in `TITLES`, and that is deliberate.** `gameKey` is
the join key for every stat a title ever produced, so deleting the row orphans history
while every screen still renders a key it cannot resolve - the same rule the platform
applies to a provider it stops using. The platform's contest pre-flight refuses a
non-`active` title, so the deprecation *is* the enforcement: no new contest can be created
on it, and rounds already played still read and score correctly.

**Retiring it has a real cost, recorded rather than glossed:** there is now no
`lower_is_better` title anywhere, so that direction is covered by unit tests and the golden
ranking regression rather than by an end-to-end round. `External game plans/21` section 4.1g
carries the options for restoring it.

### Presentation is varied per player, and the spec asks for this

Section 12 of the spec permits - and wants - the *presentation* to be shuffled per player
while the underlying content stays identical, so that players cannot simply tell each other
the answer. For a grid, the natural form is one of the **eight symmetries** of the square:
each player sees the same puzzle rotated or mirrored. Identical difficulty, identical
solution structure, but a shared screenshot does not transfer directly.

**It is a mitigation, not a fix.** Identical content is a fairness requirement and a
collusion surface at the same time, and the real answer to collusion is a short contest play
window, which the platform already supports via `playWindowEnd`.

---

## Running it

```
npm install
npm run dev
```

The five `required` variables have no defaults and the process **refuses to boot** without them.
That is deliberate and the reasoning is in `src/config.ts`: a service that starts without its
secrets and then rejects every call looks identical, in a dashboard, to a service under attack,
and "absent configuration is permission to proceed" is the exact mistake that once let an
anonymous caller credit any wallet on the platform itself.

**Two variables are marked "in production" below, and the distinction is the point rather than a
compromise.** Their defaults are correct for local work and dangerous once real players arrive,
and both fail *invisibly* at the default: a localhost play origin sends every player's iframe to
their own machine, and no frame allowlist lets any site embed a live round and overlay it. Neither
produces an error, a log line, or anything a dashboard can show. Enforcing them unconditionally
would break the smoke tools and every suite here, all of which legitimately serve plain http on
loopback - so the check is gated on `NODE_ENV=production` instead. `tools/test-config.ts` pins both
halves, because a guard that fired in development would be reverted rather than fixed.

**`npm run setup:env` writes the whole file**, generating the four credentials and taking the
database string and the site address from the platform's `.env` one directory up. Add `--dev` for
a localhost file. Two things about it are deliberate. It **refuses to overwrite an existing
`.env`** without `--force`, because the admin panel cannot show a stored secret back, so new
credentials without a matching panel edit leave every result failing its signature check and the
old values unrecoverable. And it **applies the production origin rules itself**, so a bad play
origin is refused where the message can name the fix rather than in a PM2 restart loop.

Reading the platform's `.env` is not an isolation breach and `check:isolation` correctly says
nothing about it: the script imports no platform code and the running service still knows nothing
of the platform. A third-party provider would be handed the same two facts by email.

See `env.example` for the annotated template if you would rather edit it by hand.

| Variable | Required | Purpose |
|---|---|---|
| `GAMES_MONGODB_URI` | **yes** | Its own database. A provider that reads the platform's database is not a provider |
| `GAMES_API_KEY` / `GAMES_API_SECRET` | **yes** | What the platform presents to us. We issue these |
| `GAMES_CALLBACK_TOKEN` / `GAMES_CALLBACK_SECRET` | **yes** | What we present to the platform when reporting a score |
| `PORT` | no, 4010 | Must be a **different origin** from the platform, or the iframe origin checks and the CSP question are never exercised |
| `GAMES_PUBLIC_URL` | **in production** | The **play** origin, used to build launch URLs. The spec treats this as a separate fact from the API host and its own example puts play on another subdomain. Defaults to `http://localhost:$PORT` in development; under `NODE_ENV=production` it is mandatory and must be a non-loopback https origin |
| `GAMES_DB_NAME` | no, `chartvolt_games` | Kept separate so one mistyped URI cannot land us in the platform's data |
| `GAMES_API_KEY_PREVIOUS` / `GAMES_API_SECRET_PREVIOUS` | no | The rotation window. Absent is the normal state, so unlike their live counterparts these must not refuse to boot |
| `GAMES_SANDBOX` | no, `false` | Enables force-score, force-status and suppress-callback. These decide prize money if they are ever reachable in production, so the safe value is the one you get by forgetting to set anything |
| `GAMES_FRAME_ANCESTORS` | **in production** | The CSP allowlist. Unset leaves the game embeddable anywhere, which is right for a service not yet told who its customer is and wrong once real players arrive, so it is mandatory under `NODE_ENV=production` |
| `GAMES_CALLBACK_HOST_ALLOWLIST` | no | Hostnames we will POST results to. Unset means any, so set it in production - the primary control is a shared secret, and shared secrets leak |
| `GAMES_ASSET_BASE_URL` | no, `GAMES_PUBLIC_URL` | Where catalogue artwork is served from, for a CDN in front of the service. **Required when the play surface is proxied through the platform app** rather than given its own subdomain: that app owns `public/assets`, so artwork is mounted at `/play/assets/` and this must be `<origin>/play` to match |
| `GAMES_SWEEP_MS` | no, 15000 | The sweeper interval. Lowered by the tests so they drive the real timer |

There is deliberately **no variable for where results are posted.** The callback address arrives
per round as `resultCallbackUrl` on `POST /v1/rounds`, because the platform owns it and a
provider holding its own copy is a provider that keeps posting to a decommissioned endpoint.

---

## The play surface

The launch URL the platform is handed points at `GET /play?t={token}`, served from
`public/play/` by `src/http/play-page.ts`. Five files, no build step and no framework: a phone on
a bad connection is the target, and a bundler here would buy nothing.

**`presentation.js` is where the layout numbers and every word of player-facing copy live, and
that separation is the reason the surface is testable at all.** `app.js` touches `document` at
module scope, so no test can import it; three real defects sat there unfindable until the
decisions moved out (`21` s4.1f). Anything that computes a size or chooses a sentence belongs in
`presentation.js`, which is pure and covered by `tools/test-presentation.ts` - `app.js` should
only be reading state, calling those functions and writing to the DOM.

**Adding a module means dropping the file in `public/play` and nothing else.** The served set is
read from that directory at boot by `readServableAssets`, so there is no list to forget. It used
to be a hand-maintained allowlist in TypeScript, and forgetting was not a partial failure: the 404
lands mid-graph, so the importer fails to evaluate too and the game does not boot. That is **R52**,
and the reason the list is gone rather than merely guarded is that the two halves shipped on
different schedules - the file with a `git pull`, its authorisation with `npm run build`.
`tools/test-play.ts` walks the import graph outward from `app.js` rather than listing the files,
and separately pins the directory-derived set, so a module added tomorrow is covered without
anybody remembering this paragraph.

**The path `/play` is not arbitrary and must not be changed casually.** `index.html` references
`/play/app.css` and `/play/app.js` **absolutely**, so anything that mounts the page at a different
prefix serves a working document whose stylesheet and script both 404 - a blank white frame with
nothing in any server log. It matters because the platform can expose this surface in two ways:
on the service's own subdomain, or proxied through the platform app at the same `/play` path
(`next.config.ts`, and `deploy/README.md` for which to choose). The proxy route works *because*
the prefix is the same on both sides.

**The client is an input device, not a source of truth.** It draws a board, it collects drags,
and it posts the cells the player joined. It never computes or transmits a score - the server
generated the puzzle, so the server checks the paths and derives the score. The frame message
type has **no score field at all**, deliberately, rather than a field nobody reads: the player
has a developer console, so removing it is stronger than remembering not to trust it.

Three details are load-bearing rather than cosmetic, and each has a test:

- **`touch-action: none` on the board.** Without it a drag scrolls the page on every touch
  device and the game is unplayable on a phone, which is where most players are.
- **`Referrer-Policy: no-referrer`, as a header and a meta tag.** The launch token is in the
  query string, so any outbound request would otherwise carry a single-use credential in its
  referrer.
- **The request string is only ever a `Map` key**, never a path join. The map is built at boot
  from the directory listing, so traversal is unreachable rather than defended against however
  the request is encoded - and a `Map` rather than an object, because an object lookup on a
  caller-supplied key walks the prototype chain and `"__proto__"` returns something truthy.
  What the caller-supplied name *can* no longer do is add a file, so the remaining protection is
  an **extension** allowlist: top-level regular files with a recognised content type, and never
  `index.html`, which has its own route.
- **The frame asks for the height the puzzle needs, never the height it currently has.** The
  stylesheet sizes the page to `100dvh`, which inside an iframe is the iframe's own height, so
  measuring `scrollHeight` to request a resize is circular - the platform sized the frame to the
  measurement and both sides settled on the host's 320-pixel floor, giving every player the
  smallest board the code can draw. `desiredFrameHeight` derives the answer from the grid, and a
  test asserts it is unchanged for a current height of 320, 1000, 0 or -50.
- **The rules and the scoring rule come from the round state, and the markup has none of its
  own.** They are written once in `src/games/instructions.ts`, composed into each title's
  `howToPlay` for the catalogue and delivered to the frame as `boardRules` and `scoring`. A
  second copy in `index.html` had already drifted from the catalogue, and no typecheck or mirror
  check can see prose in markup.

The client enforces the puzzle's rules as it draws - no crossing, no routing through another
pair's terminal, retraction when you drag back - but that is **feedback, not enforcement**. Every
rule is checked again by `src/engine/verify.ts` against a submission the server does not trust,
and `tools/test-board.ts` drives the browser module headlessly to assert the two agree.

### Playing it by hand

```
npx tsx tools/smoke-play.ts                                  # circuit-sprint, medium
npx tsx tools/smoke-play.ts circuit-sprint small 3 --reveal
```

Boots the service against an in-memory MongoDB, creates one round, prints a launch URL to open,
and prints the signed result callback when it arrives. `--reveal` prints a valid covering of the
first board, which is what makes a full solve verifiable by hand - a puzzle you cannot solve
cannot be used to test the path that scores a solved one.

### Playing a round SOMEBODY ELSE created

```
npx tsx tools/autoplay.ts --round=cv_rnd_abc123 --base=http://127.0.0.1:4010
npx tsx tools/autoplay.ts --round=cv_rnd_abc123 --slow=1200   # lose on purpose
```

**Note what the three tools above cannot do**, because it is the reason this one exists.
`smoke-play.ts`, `test-play.ts` and `test-board.ts` all play this game, and every one of them
creates its own round in its own in-memory database. Not one can play a round the *platform*
opened - which is how "the two halves have never spoken" stayed true through three tools that
each looked like a counterexample.

This takes a `roundId` that already exists in whatever database the service is pointed at and
plays it through the same four HTTP endpoints the browser uses, solving each board from the
round's stored seeds. It is a **perfect player**, so it is useless for testing the verifier and
ideal for driving the money: a contest needs somebody to finish, and a run that sometimes loses
cannot assert a payout.

It is what the platform's `npm run test:e2e-round` drives. Two things it deliberately does not
do: it never prints a score, because the client is not told one - the score travels in the signed
callback and nowhere else; and **nothing here is reachable over HTTP**. Reading a seed is safe for
the same reason `--reveal` is, and for no other reason: it is a local tool run by somebody who
already holds the database credentials. If a change ever makes any of it answer a request, that is
the line being crossed.

---

## Tests

```
npm test                     # isolation, typecheck, then all seven suites
npm run probe:api            # break each guard, one at a time, and watch its test fail
npm run probe:board          # the same, for the browser module
npm run probe:presentation   # the same, for the play surface's sizing and wording
npm run probe:deploy-drift   # the same, for the boot audit and the sweeper's failure log
npm run probe:play-assets    # the same, for the disk-derived asset set - probe 1 reinjects R52
npm run probe:boot-watchdog  # the same, for the watchdog that names a module which never arrived
```

> **A new front-end file no longer needs a build**, and that is deliberate. Until 8 September 2026
> the files under `public/play` arrived with a `git pull` while the allowlist authorising them only
> existed once `npm run build` had run, so pulling without building left old code serving a new
> front end - a module 404s in the middle of the import graph, nothing evaluates, and the player
> watches a loading spinner for ever. That reached production (**R52**). The first fix was a boot
> audit comparing the two halves, and **it could not fire, because it shipped inside the stale
> build it was meant to report on.** The served set is now derived from the directory, so the two
> halves cannot disagree. The audit is kept for the narrower job of naming a file whose extension
> nothing recognises. **Still build when you change `src/`** - `pm2 deploy` does, a hand-rolled pull
> does not.

> **And the surface now says so itself, whoever the 404 came from.** Removing the coupling fixes
> the cause we found; it cannot promise that every layer between a player's browser and this
> service - a proxy, a CDN, a cache still holding a 404 from before a fix - hands the file over.
> So a **classic script in front of the module graph** watches for a boot that never happens,
> names the failing file from the resource timeline, and sends `ready` so the platform drops its
> opaque overlay and the player can read the message and leave. It is the only script on the page
> that is not a module, which is the whole point: a classic script cannot be taken down by a
> module that 404s. It fires at 8 seconds, inside the platform's own 12-second timeout, or the
> platform speaks first and this is dead code that still reads correctly.

> **Before it gives up it tries to cure the fault, because the commonest cause is a cached 404 in
> the player's own browser.** Cloudflare rewrites `Cache-Control` on everything under `/play` to
> `max-age=14400`, **including the 404s** - the `no-store` this service sends does not survive the
> edge - so a file that was missing for ten minutes is remembered as missing for four hours by
> every browser that asked, and no deploy can reach them. That is exactly how R52 outlived its own
> fix. The watchdog re-fetches the recorded failures with `cache: "reload"`, which *replaces* the
> stored copy rather than reading round it, and reloads once if they all now succeed. One attempt
> only, recorded in `sessionStorage` so a genuinely missing file cannot produce a reload loop, and
> failing closed if storage throws. **A stale 200 is not covered and cannot be** - it looks
> healthy - which is why `deploy/README.md` asks for a Cloudflare cache rule on `/play*`.

> **And it takes TWO witnesses to declare the game dead, because the first one took down a working
> game.** This document is never cached - its URL carries a single-use token - while `app.js` is
> cached for four hours, so a player can load today's markup around a four-hour-old script that
> works perfectly but predates the boot flag. The watchdog saw an unset flag and wiped a live
> board mid-round. It now also checks whether the game has **painted**: `#screen-loading` is
> hidden the instant anything renders, which is proof of life whatever build produced it. Each
> witness covers the other's blind spot - the flag for a round that is merely slow to fetch, the
> painted screen for a build too old to set it. **An absent signal is evidence only if the thing
> that would have sent it was definitely present.** A test pins the markup's side of that bargain:
> exactly one screen ships visible, and it is the loading screen.

`npm test` runs **219 tests**: 15 config, 42 engine, 28 scoring, 41 API, 58 play and delivery,
11 board client, 24 presentation. (Any figure of 217 predates the watchdog's second witness, 216
predates the stale-cache recovery, 213
predates the boot watchdog, 209 predates the directory-derived asset set, 204 predates the
deploy-drift audit, 167 predates the presentation suite, and 152 predates the config suite; all
six are stale.)

**Every one of them runs in-process against an in-memory MongoDB, so none can fail because the
PLATFORM disagrees with this service.** That check lives on the other side, in the platform's
`npm run test:e2e-round`, which starts this service for real and drives a round from catalogue
sync to prize payout. Run it before believing any claim that the integration works.

The probe scripts are the more important half: a green suite proves nothing until each
guard has been watched failing, so every probe removes exactly one guard and asserts that the
test written for it goes red **and that the blast radius is small** - a one-line change turning
many tests red usually means the harness damaged the file rather than removed the guard.

Four things the probes found that the green suite could not, all recorded in the scripts
themselves. The sweeper chose its own terminal status while `playability` already decided the
same rule, so the only test of "a run-out clock completes rather than expires" went through the
copy nobody was probing. The suppressed-callback test read the delivery record before any sweeper
tick had touched it, so "still pending" was true because nothing had run yet. And two board tests
passed against a *generated* puzzle whose own shape made the guard redundant - rewritten against
a hand-built board where removing the guard cannot help but change the answer.

Two things the probes found that the green suite could not, both recorded in the scripts
themselves. The sweeper chose its own terminal status while `playability` already decided the
same rule, so the only test of "a run-out clock completes rather than expires" went through the
copy nobody was probing. And the suppressed-callback test read the delivery record before any
sweeper tick had touched it, so "still pending" was true because nothing had run yet.

---

## The most valuable output of this phase is not the game

It is **`AMBIGUITY-LOG.md`**: every question this implementation had to answer by guessing.
Each entry is something a real provider will hit. Finding them now costs a search; finding
them later costs a re-issued specification that providers may already be building against.
