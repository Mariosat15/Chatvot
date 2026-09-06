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

---

## The games

One engine, two titles. **Circuit** is a non-crossing path puzzle: connect each pair of
matching terminals so that no two paths cross. Chosen for reasons that are all constraints
from the spec or the plan rather than taste:

| Property | Why it was required |
|---|---|
| **Language-free** | Provider titles must be localised into every locale we serve. A word or trivia game is a content bill in every language, for ever - exactly the burden the external-only route was chosen to avoid. A grid of coloured terminals needs no translation beyond the UI chrome |
| **Deterministically seedable** | `contentSeed` is **required** for competitions: every player in a contest must face identical content, or the ranking is not a fair comparison and the skill argument collapses. Puzzles are generated from the seed by construction |
| **Server-verifiable** | The player has a developer console, so a score arriving from the browser is worthless. The server generated the puzzle, so it can check the submitted paths itself. **The score is derived here, never reported by the client** |
| **Skill, not chance** | No randomness during play. The puzzle is fixed before the first move, and every player gets the same one |
| **Mobile-native** | Drag to draw a path. Most players are on a phone |

### The two titles, and why there are two

| | `circuit-sprint` | `circuit-perfect` |
|---|---|---|
| Score | Points, **higher is better** | Total time, **lower is better** (`duration_ms`) |
| Format | Solve as many puzzles as possible in 120 seconds | Solve a fixed set of 5 puzzles as fast as possible |

**The second title exists to make `scoreDirection` observable.** A `lower_is_better` game
had never been exercised by anything real, and getting the direction wrong ranks the entire
field backwards and pays the slowest player first. One engine serves both, which also
demonstrates the thing the abstraction claims: one adapter, many titles.

**The rule that stops `circuit-perfect` being nonsense:** an unsolved puzzle adds a fixed
penalty rather than being skipped. Without it, a player who solved two puzzles quickly would
beat one who solved all five, because their total time is lower. This is stated in the
title's `rulesSummary`, since it is exactly the kind of thing a player disputes a prize over.

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

| Variable | Required | Purpose |
|---|---|---|
| `GAMES_MONGODB_URI` | **yes** | Its own database. A provider that reads the platform's database is not a provider |
| `GAMES_API_KEY` / `GAMES_API_SECRET` | **yes** | What the platform presents to us. We issue these |
| `GAMES_CALLBACK_TOKEN` / `GAMES_CALLBACK_SECRET` | **yes** | What we present to the platform when reporting a score |
| `PORT` | no, 4010 | Must be a **different origin** from the platform, or the iframe origin checks and the CSP question are never exercised |
| `GAMES_PUBLIC_URL` | no, `http://localhost:$PORT` | The **play** origin, used to build launch URLs. The spec treats this as a separate fact from the API host and its own example puts play on another subdomain |
| `GAMES_DB_NAME` | no, `chartvolt_games` | Kept separate so one mistyped URI cannot land us in the platform's data |
| `GAMES_API_KEY_PREVIOUS` / `GAMES_API_SECRET_PREVIOUS` | no | The rotation window. Absent is the normal state, so unlike their live counterparts these must not refuse to boot |
| `GAMES_SANDBOX` | no, `false` | Enables force-score, force-status and suppress-callback. These decide prize money if they are ever reachable in production, so the safe value is the one you get by forgetting to set anything |
| `GAMES_FRAME_ANCESTORS` | no | The CSP allowlist. Unset leaves the game embeddable anywhere, which is right for a service not yet told who its customer is and **wrong for production** |
| `GAMES_CALLBACK_HOST_ALLOWLIST` | no | Hostnames we will POST results to. Unset means any, so set it in production - the primary control is a shared secret, and shared secrets leak |
| `GAMES_ASSET_BASE_URL` | no, `GAMES_PUBLIC_URL` | Where catalogue artwork is served from, for a CDN in front of the service |
| `GAMES_SWEEP_MS` | no, 15000 | The sweeper interval. Lowered by the tests so they drive the real timer |

There is deliberately **no variable for where results are posted.** The callback address arrives
per round as `resultCallbackUrl` on `POST /v1/rounds`, because the platform owns it and a
provider holding its own copy is a provider that keeps posting to a decommissioned endpoint.

---

## The play surface

The launch URL the platform is handed points at `GET /play?t={token}`, served from
`public/play/` by `src/http/play-page.ts`. Four files, no build step and no framework: a phone on
a bad connection is the target, and a bundler here would buy nothing.

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
- **An explicit three-entry allowlist of servable filenames**, not a path join. There is no
  arithmetic to get wrong, so traversal is unreachable rather than defended against.

The client enforces the puzzle's rules as it draws - no crossing, no routing through another
pair's terminal, retraction when you drag back - but that is **feedback, not enforcement**. Every
rule is checked again by `src/engine/verify.ts` against a submission the server does not trust,
and `tools/test-board.ts` drives the browser module headlessly to assert the two agree.

### Playing it by hand

```
npx tsx tools/smoke-play.ts                                  # circuit-sprint, medium
npx tsx tools/smoke-play.ts circuit-perfect small 3 --reveal
```

Boots the service against an in-memory MongoDB, creates one round, prints a launch URL to open,
and prints the signed result callback when it arrives. `--reveal` prints a valid covering of the
first board, which is what makes a full solve verifiable by hand - a puzzle you cannot solve
cannot be used to test the path that scores a solved one.

---

## Tests

```
npm test              # isolation, typecheck, then all five suites
npm run probe:api     # break each guard, one at a time, and watch its test fail
npm run probe:board   # the same, for the play surface and the browser module
```

`npm test` runs **152 tests**: 42 engine, 21 scoring, 40 API, 38 play and delivery, 11 board
client. The probe scripts are the more important half: a green suite proves nothing until each
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
