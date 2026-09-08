# 22. Contest shape — staggered play, simultaneous play, and the wizard

> **SECTIONS 1-6 WERE A PROPOSAL. THE COMPETITION HALF IS NOW BUILT — see section 8, which is
> the authoritative account of what exists. THE CHALLENGE HALF (section 5) IS NOT.**
>
> It answers **open question 18**, raised by the owner on 8 September 2026: every contest the
> platform can currently create assumes players turn up whenever they like, and an external
> race game will need them to start and finish together. It also covers the same question for
> challenges, which the owner asked to be held until the competition side is settled.
>
> The owner chose to build it rather than defer (**option B over the section 6 recommendation**,
> 8 September 2026), on the grounds that the shape has to exist before X4 brings a title that
> needs it. Sections 1-6 are kept as written, because the analysis is what the build was made
> from and rewriting a proposal to match its outcome loses the reasoning. **Where section 8
> disagrees with an earlier section, section 8 is right.**

---

## 1. The finding that reframes the question

The owner's instinct was that a game should declare its type and the wizard should follow.
**Half of that mechanism already exists, and it is the wrong half.**

`provider_game` carries a **required** `family` field:

```
family: "independent" | "head_to_head"
```

Its comment in `database/models/games/provider-game.model.ts` says exactly what the owner
asked for — *"These drive what contest formats the admin panel may offer, so they are required
rather than defaulted."* And it is real: the adapter validates it on ingest and **rejects an
unknown value** (`chartvolt-games.adapter.ts:119`), the catalogue service copies it, and
`StepChooseGame.tsx:108` renders it as a badge.

**Nothing branches on it.** There is no gate, no scheduling rule and no wizard difference
anywhere in either app. It is declared, validated, stored, transported, displayed — and never
consulted. That is the same shape as `isPaused` before **R41** and `lastSuccessfulRoundAt`
before **R38**.

**But adding a branch on `family` would not answer the owner's question, because `family` is
about a different thing.** `01` section 3 and `00-README.md` both define it as *interaction* —
whether the game **requires an opponent**:

| `family` | Meaning | Example |
|---|---|---|
| `independent` | Each player plays alone and receives a score. Ranked together | Trading, Circuit Sprint, a puzzle |
| `head_to_head` | The game **needs** an opponent and produces a winner, not a score | Chess, checkers |

A **race is `independent`.** Each runner runs their own track and gets their own time; nobody
interacts with anybody. What a race needs is for everyone to run **at the same moment** — and
that is a third property which no field describes.

**So the axis the owner is asking for is genuinely new, and it is orthogonal to the one that
already exists.** Both matter:

|  | Staggered | Simultaneous |
|---|---|---|
| **`independent`** | Circuit Sprint, a puzzle, **trading** | A race, a live quiz |
| **`head_to_head`** | *(impossible — an opponent implies a shared moment)* | Chess match |

The bottom-left cell being empty is the useful part: **`head_to_head` implies simultaneous**,
so the new axis only has to be asked of `independent` titles. That is what keeps this small.

---

## 2. What a simultaneous contest actually changes

Measured against the code, not against intuition. Seven concerns; **five are already
expressible with fields that exist.**

| Concern | Staggered (today) | Simultaneous | Already possible? |
|---|---|---|---|
| When entry closes | Last moment play is still possible (`12` s2.10) | **Before the start** — you cannot join a race that has begun | **Yes** — this is what `resolveContestEntryDeadline` did *before* s2.10. It is a policy value, not new machinery |
| Attempts | 1..n, `best_of_n` / `sum_of_n` | **Exactly one** — you cannot re-run a race | **Yes** — `attemptsPolicy: "single"` |
| Play window | Contest start to contest end | The gun, to the gun plus one attempt | **Yes** — `deriveWindow` derives the window from the contest clock, so an operator setting `endTime = startTime + attempt` gets it |
| Starting before the window | Refused | Refused | **Yes** — `round-launch.service.ts:236` already refuses before `playWindowStart` |
| A player who never turns up | Plays later, or `unresolvedRoundPolicy` decides | A **no-show**: no round exists at all | **Yes, and it is already right** — since **R45** and **R50** a participant with no score is not eligible and their rank is redistributed |
| **All boards opening at one instant** | Each player presses Play when they choose | **Everyone's board opens together** | **No. This is the one genuinely new mechanism** |
| **Nothing forces the above configuration** | — | An operator can set every field wrongly and the contest runs | **No** |

**The honest conclusion, and it is the opposite of what the question implies:** a simultaneous
contest is *mostly* a configuration of the machinery that already exists. What is missing is a
**synchronised launch** and, more importantly, **anything that stops an operator configuring a
race as a staggered contest.**

### 2.1 Two things that must not be confused, because one of them is not a fairness problem

This distinction decides how much of section 2 is urgent.

**A staggered race with a fixed content seed is not unfair.** Every player gets the same track
and the same clock, so the scores are comparable. A player running at 10:00 and one running at
10:30 can be ranked against each other honestly. **What is lost is the event** — the drama, a
live leaderboard, spectating, the shared moment. That is a product requirement, and it is a
real one, but it is not a payout defect and must not be written up as one.

**The part that *is* a fairness question is smaller and sharper: a later player sees the
leaderboard first.** `12` s2.10 accepted that for a puzzle on the explicit grounds that **a
game score is not actionable intelligence** — knowing somebody scored 900 does not help you
solve boards faster. That reasoning is weaker for a game where the target changes your
strategy (knowing you need 950 makes you take risks you otherwise would not), and it fails
completely for trading, which is why trading closes registration at the start.

**So "should entry close before the start" is a per-title question about whether knowing the
target is worth anything** — not a consequence of synchronisation. Those two happen to
coincide for a race, which is exactly why they are easy to merge and wrong to.

---

## 3. Two defects found while mapping this

Neither is caused by the owner's question; both are in the area it points at.

### 3.1 `supportsContentSeed` is enforced by nothing — and three comments say it is

**Three separate files assert that this flag governs whether a paid competition may run:**

- `provider-game.model.ts:94` — *"required for competitions (chapter 01 section 3) — without a
  content seed every player gets different content and **the contest is not a fair
  comparison**."*
- `chartvolt-games.adapter.ts:89` — *"**`supportsContentSeed` decides whether a title may take
  entry fees**."*
- `games-service/src/http/catalogue.ts:13` — *"The capability flags decide which contest
  formats are offered, and `supportsContentSeed` …"*

`PreflightInput.title` carries `supportsCompetition` and `supportsOneVsOne` and **not**
`supportsContentSeed`. No code in either app reads it to decide anything.

**Its sibling is enforced properly, which is what hid this.** `supportsCompetition` is refused
by `contest-preflight.ts:171` *and* disables the option in `StepChooseGame.tsx:58` with the
reason named — the pattern this programme keeps arriving at. Reading that code leaves you
confident the capability flags are handled, because two of the three are.

**Latent, not live: every title that exists declares it `true`** (both `chartvolt-games` titles
and both mock titles). But it is precisely the flag a real provider will set `false` on some
titles at **X4**, and the failure is a paid competition in which every player gets different
content — ranked, settled and paid, with nothing in any log. **This is the fifth instance of a
comment asserting a check that does not run**, after Prerequisite A, the internal-secret
fallbacks, the unprotected suspicion-score route and `requireAdminAuth`.

**Fix regardless of which option is chosen below**, because it is four lines and a test:
carry it on `PreflightInput.title` and refuse a `competition` format without it.

### 3.2 `family` is validated and unread

Section 1. Worth a decision rather than a fix: either something branches on it, or the badge
in `StepChooseGame` is the only honest use of it and the model comment should stop claiming
more. **Do not leave the comment as it stands** — an unverified assertion about enforcement is
the exact thing 3.1 shows costs money later.

---

## 4. The proposal

**One declared property per title, resolved once, driving the wizard's defaults and one gate.**

### 4.1 The provider declares it

A new value on the existing `format` mechanism would not work — this is a property of the
title, not of one setting — so it is a new catalogue field beside `family`:

```
playMode: "anytime" | "scheduled"      // default "anytime"
```

Deliberately **not** named `synchronous`, `live` or `race`: the value has to be meaningful to a
provider writing a catalogue entry for a quiz, a race or a puzzle, and "does everybody play at
one appointed moment, or whenever they like" is the question being asked.

Four rules, each with the reason it is not the obvious alternative:

- **`anytime` is the default**, because every title that exists today is one and a required
  field would refuse the whole live catalogue on the next sync. Contrast `family`, which is
  required — that was affordable when nothing had been synced yet.
- **`head_to_head` implies `scheduled`** and the resolver enforces it rather than trusting the
  declaration, so a provider cannot declare a combination that cannot work.
- **It fails towards `anytime`**, which is the *less* constrained shape. That is the opposite
  of this codebase's usual fail-closed instinct and needs saying: a title wrongly treated as
  `anytime` runs a staggered contest that is comparable and payable, where one wrongly treated
  as `scheduled` shuts entry early and refuses players who could have played. Neither is
  silent, and the first is recoverable.
- **It is a property of the title and never of caller input**, the same rule as the
  market-hours gate and `maxRoundSeconds` — an operator- or client-supplied shape is a way to
  turn off whichever rule is inconvenient.

**Consequence: `01` section 3 and `ChartVolt-Game-API-Requirements.html` change, so the HTML
needs a version bump to 1.4 and a document-history row.** Providers may already be building
against 1.3. This is the single largest cost of the proposal and it is a documentation cost.

### 4.2 The wizard changes its defaults, not its fields

**The one thing that must not happen is a second wizard**, and the one property that must
survive is that a new title needs no release. So `playMode` decides **defaults and
validation**, never which controls exist:

| Control | `anytime` | `scheduled` |
|---|---|---|
| `attemptsPolicy` | operator's choice | **forced to `single`**, with the reason shown |
| `roundStartPolicy` | operator's choice (default `reserve_full_round`) | **not offered** — irrelevant when everyone starts at the gun |
| Entry closes | last playable moment (`12` s2.10) | **at `startTime`**, stated on the form |
| Contest end | operator's choice | **defaulted** to start plus one attempt plus grace, editable upward |
| Wording | "Play opens / play closes" | "Starts at" / "Race length" |

A test must forbid `gameCode`, `gameKey` and `providerKey` from the wizard exactly as it does
today, so this is a branch on a **declared property**, never on a game's identity.

### 4.3 The synchronised launch is the only new machinery

The minimum honest version, and each rejected alternative is rejected for a reason:

- **The lobby holds a countdown to `playWindowStart`** and the Play button enables itself when
  it reaches zero — `useServerClock` and the 20-second pre-flight poll already do both halves
  of this, so no new mechanism is needed on the player's side.
- **The player still presses Play.** Creating rounds server-side at the gun is the tempting
  design and it is wrong twice: **an attempt is consumed on creation** (`03` s1.3), so
  pre-creating rounds spends the attempt of every entrant who did not turn up and turns a
  no-show into a scored zero; and it would be a **side effect on a timer** with no request and
  no player, which is the shape that made the launch-on-render defect (`13` s1.1a) so
  expensive.
- **A late presser gets a shortened round, not a refusal**, because `resolveExpiry` already
  clamps `expiresAt` to `playWindowEnd`. Refusing them is the harsher option and buys nothing:
  they cannot gain from starting late, and a race is exactly where a shortened round is
  visibly, honestly worse.
- **A grace period at the start is a per-contest number, not a law.** How late is too late is a
  product question about the specific game.

**What this deliberately does not build:** a live leaderboard during play. It is the whole
point of a simultaneous event and it is not in scope here — `13` section 11's polling
recommendation is still unimplemented for *any* game, so it is its own piece of work and
belongs with X7 rather than smuggled in.

---

## 5. Challenges (X10 / E8) — the same axis, one extra problem

The owner asked for challenges to be held until this is settled, and the reason to keep them
separate is sharper than sequencing: **a challenge has a scheduling problem a competition does
not.**

A competition has an operator who picks a start time. A challenge is created by one player and
accepted by another **at an unknown later moment**, so there is nobody to choose the gun. Three
ways out, and the choice is a product decision:

| Approach | What it means | Cost |
|---|---|---|
| **Accept starts the clock** | The gun is *N* minutes after acceptance | Simplest. Requires the accepter to be present, which they are — they just clicked |
| **The challenger proposes a time** | A fixture, both players notified | Needs reminders, a no-show rule and a refund rule |
| **`scheduled` titles cannot be challenged** | `supportsOneVsOne` is already per-title | Free, and honest until there is demand |

**The third is worth taking seriously rather than dismissing**, because it costs nothing and
`supportsOneVsOne` already exists to express it — and a provider whose race cannot be
meaningfully played one-against-one will say so.

Everything else the owner listed for challenges — **pick trading or a game, then a title, then
adapt the page** — is independent of this axis and can proceed once the competition side is
decided. Note it inherits **R50's warning**: `ChallengeParticipant.score` still defaults to
`0`, so **the first provider challenge reproduces R50 exactly** unless that default is dealt
with in the same work.

---

## 6. What needs deciding

| # | Question | Why it cannot be defaulted |
|---|---|---|
| **A** | Build `playMode` now, or wait until a real `scheduled` title exists? | No title needs it today. Building early means a spec bump providers may already have implemented; waiting means X4 arrives with a title we cannot schedule |
| **B** | Does entry close before the start because a contest is `scheduled`, or because knowing the target is worth something? | Section 2.1. Merging them is convenient and wrong, and it is the decision most likely to be regretted |
| **C** | Challenges: accept-starts-the-clock, a proposed fixture, or `scheduled` titles are not challengeable? | Section 5 |

### Recommendation

**Option A: do 3.1 now, and defer the rest to X4 — with the axis recorded.**

The reasoning is that section 2 found `scheduled` to be mostly a *configuration* of existing
machinery, so the cost of waiting is small and specific: one new field, one gate, one set of
wizard defaults. Against that, building it now means issuing spec version 1.4 describing a
field no title populates and no code needs, to providers who may be mid-implementation — and
**a shape declared by nobody and read by one branch is how `family` got into the state
section 1 describes.**

What should happen immediately is the four-line fix in **3.1**, because it is a fairness gate
whose absence three comments deny, and the **correction to `family`'s comment** in 3.2.

**The estimate if the owner wants it built now** rather than deferred: **1–1.5 weeks**, of
which roughly a third is the spec, the requirements HTML and the paired-document sync rather
than code. It does **not** include the live leaderboard, which is X7.

---

## 7. Documents this would touch if approved

Listed now so the estimate above is honest, per the docs-sync rule.

| Document | Change |
|---|---|
| `01-provider-contract-specification.md` s3.2 | The new field |
| `ChartVolt-Game-API-Requirements.html` | **Version bump to 1.4** plus a document-history row |
| `04-data-model.md` | `provider_game.playMode`, mirrored both apps |
| `07-rounds-and-results.md` | The synchronised launch and the start grace |
| `12-admin-panel-plan.md` s2 | The wizard's defaults per shape |
| `13-user-ui-and-routes.md` | The lobby countdown to the gun |
| `03-competition-and-challenge-flows.md` s1.2 | A **fourth** amendment to the registration row |
| `17-risk-register.md` | 3.1 as a new R-number; check the next free one with `rg -o "R\d+"` |
| `PROGRESS.md`, `00-README.md`, `10` s3, the internal HTML | Phase list and effort, if this becomes a phase |

---

## 8. What was built (8 September 2026) — the authoritative account

**Code-complete for competitions.** `playMode` is declared by the provider, resolved once, and
forces three stored values at write time. **Challenges are untouched** (section 5), and there
is **no live leaderboard during play** (X7). 27 tests in
`__tests__/services/play-shape.test.ts`, 27 probes in `tools/probe-play-shape.ps1`, every one
red on exactly the expected test with exactly one failure.

### 8.1 The live code

| File | What it holds |
|---|---|
| `lib/services/games/play-shape.ts` **(mirrored)** | `resolvePlayMode`, `playShapeRules`, `resolvePlayShape`, `PlayShapeRules`. **The only place a mode becomes a set of rules** |
| `lib/services/games/entry-deadline.ts` **(mirrored)** | Gained `entryClosesAtStart`, checked **before** the policy |
| `database/models/games/provider-game.model.ts` **(mirrored)** | `playMode`, defaulting to `anytime` |
| `lib/services/game-providers/contract.ts` **(mirrored)** | `ProviderPlayMode` on `ProviderCatalogueGame` |
| `lib/services/game-providers/adapters/chartvolt-games.adapter.ts` | Normalises the declaration; an unrecognised value warns and reads `anytime` |
| `lib/services/game-providers/catalogue.service.ts` **(mirrored)** | Provider-owned, rewritten by every sync |
| `apps/admin/lib/admin/game-content-fields.ts` | `playMode` on `NEVER_EDITABLE_CONTENT_FIELDS` |
| `apps/admin/lib/services/game-providers/provider-contest.service.ts` | Forces the three values on create; `listContestableTitles` returns the **resolved** mode |
| `apps/admin/lib/services/game-providers/provider-contest-edit.service.ts` | **Re-forces** them on every edit |
| `apps/admin/components/admin/games/wizard/StepSchedule.tsx`, `StepPrizes.tsx`, `ProviderContestWizard.tsx` | Wording and withheld controls, from the same rules object |
| `games-service/src/games/titles.ts`, `src/http/catalogue.ts` | Both titles declare `anytime` explicitly |

**`check:mirrors` compares models**, so it has an opinion about `provider-game.model.ts` and
about **none** of the rest. `play-shape.ts` and `entry-deadline.ts` are held byte-identical by
tests instead. `apps/admin/lib/admin/` and the wizard components are admin-only.

### 8.2 What the shape decides, as built

| | `anytime` | `scheduled` |
|---|---|---|
| Entry closes | Last playable moment (`12` s2.10) | **`startTime`** |
| `attemptsPolicy` | Operator's choice | **Forced `single`**, `attemptsAllowed` cleared |
| `roundStartPolicy` | Operator's choice | **Forced `until_window_closes`**, control withheld with the reason |
| Date wording | "Contest starts / ends" | "Everyone starts at / finishes by" |

### 8.3 Eight things from the build that generalise

- **`requiresSyncPlay` already existed, and finding it was worth more than the field it
  replaced.** `GameCapabilities` carried exactly the flag this work needed, declared, set to
  `false` twice and **read by nothing** — the fourth instance of that shape after `isPaused`
  (R41), `lastSuccessfulRoundAt` (R38) and `family`. It is **deleted rather than wired up**,
  and the reason is the whole design: a capability is **module-level**, and one provider
  module backs the entire catalogue, so the flag can only ever give **one answer for a race, a
  puzzle and a quiz at once**. Same lesson as `scoreDirection` in X5 — **the thing that varies
  per title travels on the data, never in the module.** A tripwire test now asserts no module
  carries it, because reintroducing it reads like using an existing API (the `shouldBlockEntry`
  precedent).
- **This gate deliberately fails towards the LESS constrained answer, which is the opposite of
  every other gate here, and the reason has to be stated or somebody will "fix" it.** A race
  wrongly run as `anytime` still produces comparable, payable scores, because
  `supportsContentSeed` guarantees identical content; a puzzle wrongly run as `scheduled`
  **shuts entry at the start and turns away players who would have paid**. The first is
  recoverable and visible, the second is lost revenue. Fail-closed is a default, not a law —
  ask which failure you are choosing.
- **Forcing at WRITE time meant not one runtime gate had to learn about play modes.**
  `roundFitsInWindow`, `RoundPreflight`'s `tooLateToStart` and `fullRoundCutoffMs` all already
  read the **stored** policy, so storing `until_window_closes` makes every one of them correct
  for free. The alternative — a branch in each — is five places to forget, and the fifth is
  found by a player. **When a rule can be expressed as a stored value the existing code already
  reads, that is not a shortcut, it is the smaller change.**
- **The forcing must sit OUTSIDE the "did the operator send this field" branch, and inside it
  reads perfectly correctly.** An ordinary edit sends `name` alone. Written as
  `if (input.roundStartPolicy !== undefined) { ...force... }`, a contest whose title has
  **since** become `scheduled` keeps a policy the shape forbids until somebody happens to touch
  that one control. The probe for it is the load-bearing one in the file, and it fails only on
  the edit that mentions nothing.
- **Checking a new flag after the old logic is an ordering bug that returns a plausible date.**
  A scheduled contest stores `until_window_closes`, so `resolveContestEntryDeadline` reading
  the policy first returns the window end — entry open for the contest's whole duration, no
  error, and a date that renders correctly on every screen. The flag is checked **first**, and
  a probe moving it below the policy is red.
- **Every forced value needs its mirror-image probe, or a rule applied to EVERY contest passes
  the whole suite.** Forcing `single` unconditionally satisfies each scheduled assertion and
  silently takes the attempts setting away from the entire live catalogue — which is every
  contest that exists. There is a paired "leaves an anytime contest exactly as the operator
  asked" test for each one.
- **The wizard must be handed the RESOLVED shape, not the stored field.** A `head_to_head`
  title declaring nothing is `scheduled`; giving the wizard the raw value has it render
  controls the create service is about to override — a control that appears to work and does
  nothing, after a provider with no adapter and a `rankingMethod` a provider game ignores.
  `listContestableTitles` therefore returns `resolvePlayMode(title)`, and a test pins it.
- **An unverified aside in a comment, the sixth instance, and this one had a real gap under
  it.** `catalogue.service.ts` asserted that `playMode` was in `NEVER_EDITABLE_CONTENT_FIELDS`
  "for the same reason `family` is". It was not. It *was* refused — by the unknown-field
  branch — which is exactly the fragile state that file's own test describes: the day somebody
  adds it to the allow-list, because it reads like a title property an operator might set, a
  **puzzle becomes a race from a content form**, changing when entry closes and how many
  attempts every subsequent contest grants, and the next catalogue sync reverts it silently.
  Added to the map and to the capability-flag test. **Never latent in production**, because
  the field did not exist before this slice.

### 8.4 What is deliberately not built

- **No synchronised launch was written, because the machinery already existed** — and this was
  verified rather than assumed. `round-launch.service.ts:236` already refuses before
  `playWindowStart`, the pre-flight already reads `contestStatus` (`13` s1.1b), the lobby
  already counts down to the start (`13` s1.1e / s4.1f), and `resolveExpiry` already clamps a
  late starter's round to the window end. Section 2's conclusion held: **`scheduled` is mostly
  a configuration of machinery that exists.** A document describing a new launch mechanism is
  describing something nobody wrote.
- **Rounds are still created when the player presses Play**, never pre-created at the gun. An
  attempt is consumed on creation (`03` s1.3), so pre-creating spends the attempt of every
  no-show and turns them into scored zeros — and it is a side effect on a timer with no
  request and no player, the shape behind `13` s1.1a.
- **The contest end is NOT defaulted to start plus one attempt plus grace**, which section 4.2
  asks for. The operator sets it, and `describeRoundFit` plus the pre-flight already refuse a
  window too short for a round, so the gap is a convenience rather than a hole. Recorded rather
  than absorbed.
- **No live leaderboard during play.** It is the point of a simultaneous event and it is X7 —
  `13` section 11's polling recommendation is unimplemented for *any* game.
- **Challenges are untouched.** Section 5's three options remain a product decision, and the
  scheduling problem there is genuinely different: nobody chooses the gun, because a challenge
  is accepted at an unknown later moment. It also inherits **R50's warning** —
  `ChallengeParticipant.score` still defaults to `0`, so the first provider challenge
  reproduces R50 exactly unless that is dealt with in the same work.
- **No title declares `scheduled`.** Both `games-service` titles are `anytime`, so the whole
  scheduled path is **exercised only by tests** until X4 brings a real one. Say that rather
  than implying a race has run.

### 8.5 The section 6 questions, answered

| # | Answer |
|---|---|
| **A** | **Built now.** The owner's call, 8 Sep 2026. Cost paid: spec version **1.4**, an optional field with a default, so nothing a provider has built against 1.3 is invalidated |
| **B** | **Not merged, and the distinction in section 2.1 survives.** A scheduled contest closes entry at the start for a *physical* reason — you cannot join a race that has begun — and **not** because knowing the target is worth something. The informational question stays open and stays per-title for `anytime` games, exactly as `12` s2.10 decided it |
| **C** | **Deferred with challenges.** Nothing was built either way, so no option has been foreclosed |
