# 21 - The reference provider and its game (phase X4a)

**Status: PLANNED, not started. Owner decision outstanding on scope - see section 8.**

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
| The game itself | A small **skill-based** game. Chance-determined outcomes invert the regulatory position and are out of scope entirely |
| A second title, lower-is-better | A time trial or similar, purely to make `scoreDirection` observable |
| A standalone service | Own port/hostname, own storage, own signing. Zero imports from this repo |
| Spec-ambiguity log | Every question the implementer had to answer by guessing. **The most valuable output** |
| Content set | Tagline, description, rules, how-to-play, thumbnail, banner, for both titles |
| A runbook | How to start it, register it, and drive each failure case on demand |

**Estimate: 1-1.5 weeks** as a harness. Materially more if it becomes a product game, which
is the section 8 decision.

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

**A fake company in production data is permanent.** `gameKey` is immutable because it is the
join key for every historical stat, providers joined to history cannot be deleted, and a
disabled game's rows are retired rather than removed. So **if this harness ever settles a
real contest in production, the fake company is in our data for ever.** Two acceptable
answers, and they must be chosen rather than defaulted into: run it in staging and dev only,
or accept a permanently retired provider row knowingly. There is no third option that
involves cleaning up afterwards.

**It must never be reachable by a player in production.** Three gates already exist -
`externalGamesEnabled`, the provider's `enabled`, and the per-title `chartvoltEnabled` - and
a harness should not rely on all three being remembered. Name the provider row so plainly
that nobody mistakes it for a signed partner.

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

## 8. The decision the owner must make first

**Is this a throwaway harness, or is it open question 10's in-house hedge game?**

The answer changes the quality bar, the cost, the ownership and the risk position, and it
cannot be deferred until after the work, because building a harness and building a product
game diverge on day one.

| | Harness only | Also the hedge game |
|---|---|---|
| Quality bar | Good enough to drive every path | Good enough for paying players |
| Cost | 1-1.5 weeks | Materially more - art, mobile, localisation, content, support |
| If the provider search fails | We still have one game (risk X8 stands) | We have a second real game; X8 is materially reduced |
| Ongoing burden | Dev-only, no players | A product with a content and support cost |
| Risk | Scope creep into the right column | Distraction from the external programme |

**Recommendation: build the harness now, decide the hedge separately.** The harness is cheap,
unblocks the review gate, and de-risks X4 regardless of the hedge answer - and if the hedge is
later approved, everything learned here transfers. Deciding the hedge *first* risks spending
weeks on a product game while the actual blocker is still commercial.

**But note what that recommendation does not do:** it leaves risk X8 exactly where it is. The
platform would have funded the entire foundation and admin programme and still have one game
if the provider search fails. The harness does not change that, and it must not be allowed to
*feel* as though it has, which is the likeliest misreading of this whole phase.

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
- [ ] The harness cannot move money, demonstrated rather than asserted
- [ ] Nothing in this phase is reachable by a player in production
