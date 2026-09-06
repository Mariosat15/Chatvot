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

| Variable | Purpose |
|---|---|
| `PORT` | Default 3010. Must be a **different origin** from the platform, or the iframe origin checks and the CSP question are never exercised |
| `MONGODB_URI` | Its own database. A provider that reads the platform's database is not a provider |
| `INBOUND_API_KEY` / `INBOUND_API_SECRET` | What the platform presents to us. We issue these |
| `CALLBACK_TOKEN` / `CALLBACK_SECRET` | What we present to the platform when reporting a score |
| `CHARTVOLT_EVENTS_URL` | Where results are posted |
| `PUBLIC_BASE_URL` | How the platform reaches us, used to build launch URLs |

---

## The most valuable output of this phase is not the game

It is **`AMBIGUITY-LOG.md`**: every question this implementation had to answer by guessing.
Each entry is something a real provider will hit. Finding them now costs a search; finding
them later costs a re-issued specification that providers may already be building against.
