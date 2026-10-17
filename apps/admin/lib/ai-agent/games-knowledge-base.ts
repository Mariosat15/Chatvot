/**
 * What the AI agent knows about administering GAMES (X6.5 A6, chapter 14 section 4).
 *
 * WHY THIS IS A SEPARATE MODULE AND NOT MORE LINES IN `knowledge-base.ts`. That file is
 * already 555 lines, so appending here would put it well past the 500-line limit, and the
 * split is along a real seam rather than at a convenient line number: everything here
 * describes surfaces that did not exist when that file was written, and every one of them
 * can be checked against `apps/admin/components/admin/games/` on its own.
 *
 * THE DEFECT THIS CLOSES IS WRONG GUIDANCE, NOT A MISSING TOPIC. The agent's knowledge base
 * opened "ChartVolt is a trading competition platform" and described competitions as
 * "trading events where multiple users compete using virtual trading capital". Asked how to
 * run a competition on a provider game, it did not decline - it answered confidently out of
 * the trading material, because that is the only material it had. An operator following it
 * would look for starting capital and leverage on a puzzle, and there is no error, no empty
 * state and no log line at any point. Same shape as the trading-shaped services in
 * `lib/services/matchmaking.service.ts`, one layer out: the system reports success while
 * describing the wrong thing.
 *
 * NOTHING HERE ENUMERATES A GAME. No game code, no provider key, no title name. The whole
 * architecture rests on a new title needing no developer, and a knowledge base that names
 * "Circuit Sprint" is a knowledge base that is wrong about the second title while every
 * existing test still passes. What it describes is the SHAPE of the administration - the
 * screens, the settings and the rules - which is identical for every title. A test forbids a
 * game code, a provider key or a `gameKey` literal anywhere in this file.
 *
 * IT USES THE DEFAULT NOUNS, DELIBERATELY, AND IS NOT INTERPOLATED WITH THE OPERATOR'S.
 * The operator's renamed words reach the model through the vocabulary clause appended to the
 * system prompt (`vocabularyRule`, X6.5 A3c), which is one mechanism for every prompt on the
 * platform. Substituting tokens into this text as well would be a second mechanism for the
 * same job - the "one rule, two copies" shape behind `referenceId`, `failedReason`,
 * `challengeId` and the Game Master `||` - and the copy that drifted would be this one, since
 * it is the one nobody re-reads.
 *
 * EVERY LOCATION HERE WAS READ OFF `menuGroups` IN `AdminDashboard.tsx`, NOT ASSUMED. Most of
 * the paths in the original knowledge base are wrong (see the NAVIGATION section there), and
 * a path is the one thing an operator cannot work around: they either find the screen or they
 * ask support.
 */

export const GAMES_KNOWLEDGE_BASE = `
## GAMES: THE TWO KINDS, AND WHAT A PROVIDER IS

This platform runs contests on more than one game. Trading is one game among them, not the
definition of the platform.

**Trading** is built in. The platform owns the prices, the positions and the profit and loss,
so a trading contest has starting capital, leverage, instruments and margin levels.

**Provider games** come from a third party. The provider runs the game and reports a SCORE.
They have no starting capital, no leverage, no positions and no profit and loss, and asking
about any of those on a provider contest is asking about a field that does not exist.

**A provider never touches money.** No wallet access, no balances, no payouts. They report a
result; this platform owns the entry fee, the ranking, the winners, the payouts and the
player's progression. If a question implies a provider paying a player, the answer is that it
cannot happen by design.

Only skill-based games are in scope. A chance-determined outcome would invert the platform's
regulatory position, so it is refused rather than configured.

---

## GAMES: REGISTERING A PROVIDER

**Location**: Games -> Game Providers

Register a provider with a key, a display name and a base URL. The key is permanent - a
provider that has run a contest is joined to that contest's history, so there is **no delete,
only disable**. Disable is the reversible operation.

**Credentials** are four values in two pairs, and the pairing is the point:
- **API key and API secret** are the provider's, and this platform sends them OUTBOUND.
- **Callback token and callback secret** are ours, and the provider sends them back INBOUND
  when reporting a result.

They are stored on the platform settings document and are never readable back. On the
credentials dialog, **a blank box means "keep the stored value"**, not "clear it" - because
the screen cannot show an operator what is already there. Removal is offered as its own
explicit action.

**A provider cannot be enabled until it can actually work.** Enabling demands an installed
adapter, a callback secret AND a callback token. The switch refuses with the reason rather
than being greyed out, because a provider enabled without an adapter would refuse every round
with a message no operator can act on, and one without a callback secret makes every incoming
result fail signature verification, which in the logs looks exactly like an attack.

**Base URL**: https everywhere, except plain http on loopback (localhost, 127.0.0.1, [::1]) so
a first-party provider sharing a machine never touches a network. A private LAN address is
refused.

---

## GAMES: THE CATALOGUE OF TITLES

**Location**: Games -> Game Providers -> [provider] -> Games

Titles are synced from the provider. **Syncing never deletes**: a title missing from a
response is reported, not removed, because a title with history cannot be removed without
orphaning the stats joined to its key - and an absent item is as likely to be a partial
failure upstream as a genuine withdrawal.

**Two switches per title, and they answer different questions:**
- **Provider status** is what the provider says about their own title.
- **Enabled on this platform** is what WE say, and it defaults to off.

One switch would let a third party put an untested game in front of paying players by editing
their own database. A supplier's opinion is an input, never a decision.

**Three kinds of field on a title, and which of them an operator may edit:**
- **The provider's, and re-synced every time**: how the game scores (up or down), the score
  type, the score range, the play style, the maximum round length. A control writing to one of
  these would save, show a success message and be silently reverted by the next sync.
- **Content, seeded on the first sync and then ours**: display name, tagline, description,
  rules summary, how to play, thumbnail and banner. An operator must be able to fix grammar,
  tone or language without the next sync reverting it.
- **Ours alone**: the genre, the play-style override, the eligibility rules below, the two
  page illustrations, the banner feature labels and the per-title challenge defaults.

**Genre** is free text with a suggested vocabulary. It is the key that analytics groups by, so
"Racing", "racing" and "race" become three rows that each look complete with totals that
still add up. Pick from the list where one fits. An unrecognised genre is kept and shown
verbatim, never rewritten.

**Scoring eligibility** (Games -> Game Providers -> [provider] -> Games -> Scoring):
- **Is zero a valid result?** By default it is not, so a player who scored nothing is not
  ranked and not paid.
- **Minimum eligible score** is DIRECTIONAL. On a game where higher is better it is a floor;
  on a game where lower is better - a time trial - it is a ceiling. The test is "at least as
  good as", so setting it the other way round would exclude the best players.
- A stored zero is a real setting and not an absent one: on an upward-scoring game a bar of
  zero deliberately ADMITS a score of zero.

---

## GAMES: CREATING A CONTEST ON A GAME

**Location**: Competitions -> Competitions -> New Competition

That opens a game picker. Trading goes to the trading wizard, unchanged. A provider game goes
to the game wizard, whose settings step is generated from what the title declares - which is
why a new title needs no developer.

**The contest clock is ONE clock.** An operator sets the start and the end; the play window
is derived from them. There are not four date fields to keep consistent. Registration closes
at the start time by default, and for a game contest the entry deadline is computed from when
playing is still possible.

**Attempts**: how many goes at the game a player gets. An attempt is consumed when a round is
CREATED, not when it finishes, so abandoning a bad round does not hand it back.

**Round start policy**: whether a player may start an attempt so late that the contest end
will cut it short.
- **Reserve a full round** refuses an attempt there is not time to finish. Note it reserves
  the title's MAXIMUM round length, not the length this contest configured, so it fails closed.
- **Until the window closes** allows a late start and shortens the round, which is the right
  answer now that a partial run counts.

**Play mode**: whether everybody plays at once.
- **Play any time** inside the window is the normal case.
- **Scheduled** means a synchronised start. It forces one attempt, closes entry at the start
  time, and is only offered on a title that supports it.

**Unresolved round policy**: what to do when the provider never reports a result.
- **Score zero** - the contest settles on time and the round counts as nothing.
- **Exclude** - the player is removed from the ranking and refunded, which shrinks the pot and
  re-splits the prizes in the same transaction.
- **Hold and alert** - the contest does NOT settle until an operator decides.

**Unscored contest policy**: what happens to the pot when NOBODY recorded a score.
- **Refund entry fees** (net of the platform fee, because the contest did run) - the default
  for new drafts.
- **Unclaimed pool** - the platform keeps it. This is what every contest created before the
  setting existed still does, deliberately.

**Prizes** are percentage shares that must total 100. An unfilled position is redistributed
upward, so the figures shown before a contest runs are a FLOOR, not a promise.

**A pre-flight checklist runs before the draft saves and again when it publishes**, against
the STORED record rather than the form - because a draft can outlive the switches that made it
valid. Hard refusals accumulate rather than stopping at the first. Three items are advisory
only: the platform master switch being off, a stale sandbox round, and acknowledging the
per-round cost.

**Publishing makes a contest visible and payable, and there is NO UNPUBLISH.** Hiding a
contest people have paid into would strand them. Cancel-with-refund is the reversible
operation.

**Editing a published game contest** is allowed, with a freeze that keys on PARTICIPANTS and
not on status: once anybody has entered, only the name, the description and a RAISING of the
maximum participants may change. Once settlement begins, nothing. The game itself can never
change - a contest that should be on another game is a new contest.

---

## GAMES: WHILE A CONTEST IS RUNNING

**Location**: Competitions -> Competitions -> [contest] -> view

**Pause** stops players starting OR resuming a round. **Resume** extends the play window by
the paused duration, so a pause does not silently cost players their playing time.

**Emergency cancel** on a game contest voids live rounds. It does not close positions or
record profit and loss - that is the trading wording and it does not apply.

**Location**: Games -> Round Inspector

Lists the rounds that need a decision and shows the raw deliveries the provider sent. An
operator can END a round, with a reason, which is what releases a contest held by the
hold-and-alert policy.

**An operator CANNOT enter or correct a score, and that is deliberate.** Scores enter the
system through exactly one function, in the player-facing application. A score box in the
admin panel would be a second door into the money layer, in the application with the widest
privileges and the least traffic. Ending the round is sufficient, because the settlement rules
read the round's status.

---

## GAMES: HOW A GAME CONTEST SETTLES

1. The provider reports each round's score, signed, through the single ingestion route.
2. The score is carried up to the player's contest record.
3. Which rounds count is decided by their status - a run cut short by the clock DOES count; a
   cancelled or unresolved round does not.
4. Several attempts are combined according to the contest's attempts policy.
5. Players with no result at all are not eligible for a prize. A flat trading account IS a
   result; a missing score is not.
6. Ranking sorts by score in the direction the TITLE declares. The raw score is stored, so a
   time trial's number is never stored negative.
7. Prizes are paid, the platform fee is booked net of any Game Master commission, and the
   contest completes.

A provider game reports one number, so the six trading ranking methods (profit and loss, ROI,
capital, win rate, wins, profit factor) do not apply to it and the platform does not offer
them. Minimum-trade requirements and liquidation disqualification likewise do not apply.

---

## GAMES: MONITORING

**Location**: Games -> Provider Health

Per PROVIDER, over the last 24 hours. This is the "who do I ring" screen. The verdict is
computed on request from recent rounds and deliveries; there is no stored health record and no
history table.

**Location**: Games -> Game Performance

Per TITLE, over weeks. This is the "which game should we keep running" screen: completion,
abandonment, rounds that expired on the clock, and whether the title produced results at all.
It deliberately carries NO money figures - revenue is granted by the Analytics and Finance
sections, and putting it here would quietly widen who can read the platform's earnings.

**Location**: Competitions -> Analytics

Revenue and entry fees broken down by game and, separately, by provider. Grouping is on the
game's permanent key, never on its display name, so renaming a title cannot split one game's
revenue into two rows. Trading appears as one of the groups rather than being excluded.

---

## GAMES: THINGS THE PLATFORM DELIBERATELY WILL NOT DO

Answer these as design decisions, not as missing features:

- **No score entry or correction in the admin panel.** One ingestion door.
- **No changing a contest's game**, not even on an empty draft. The game key is permanent.
- **No unpublish.** Cancel with refunds instead.
- **No deleting a provider or a title that has history.** Disable instead.
- **Nothing sold in the marketplace may improve a score or a ranking in a paid contest.** No
  extra time, retries, hints, skips or easier content. Cosmetics, titles, entry-fee vouchers
  and extra FREE practice are fine. Fairness, the regulatory position and chargeback exposure
  each require this on their own.
- **No random or mystery packs**, even cosmetic ones - paying for a randomised reward
  introduces the chance element the platform's regulatory position depends on being absent.
- **No paid single-player format.** A competition is two or more players; a challenge is
  exactly two; practice is the only one-player mode and it is free, unranked and prize-less.
- **Game Masters cannot yet create provider-game contests.** They can create trading
  contests, and they EARN from referred players' entry fees in any contest including provider
  ones. The block is because their revenue share is a percentage taken before the provider's
  per-round cost exists, so a low-fee provider contest could be loss-making while still paying
  commission. It refuses and names the reason.

---

## GAMES: WHEN A CONTEST WILL NOT BEHAVE

**Play button disabled for a player**: the contest has not started; the play window has not
opened; the contest is paused; attempts are exhausted; a round is already live; or the round
start policy will not admit an attempt this late.

**Every round refused for the whole contest**: the contest is shorter than the title's maximum
round length and the round start policy is set to reserve a full round. Set it to "until the
window closes", or lengthen the contest.

**A contest will not settle**: a round is unresolved and the policy is hold-and-alert. End the
round in the Round Inspector. Settlement also waits out a short grace period after the play
window closes, so a result arriving at the whistle is still counted.

**Results are not appearing**: check Provider Health first. A rotated callback secret, an
unreachable platform URL and a genuine provider outage all present as deliveries failing, and
the health screen distinguishes them.

**A title is not offered in the contest wizard**: it is not enabled on this platform, its
provider is disabled, the platform master switch for provider games is off, or the provider
status is not active.
`;

/**
 * Game-administration entries for the agent's quick-answer table.
 *
 * Separate from the prose above because the lookup is a substring match on the operator's
 * question and returns one paragraph, so these have to stand alone. They are the questions
 * whose WRONG answer was most confident: each of them had a trading answer the agent would
 * have given happily.
 */
export const GAMES_QUICK_ANSWERS: Record<string, string> = {
  "how to add a game":
    "Games -> Game Providers. Register the provider, add its four credentials (API key and secret are theirs, callback token and secret are ours), then sync its catalogue and enable the individual titles you want. A title is off on this platform until you switch it on, whatever the provider says about it.",
  "how to create a game competition":
    "Competitions -> Competitions -> New Competition, then pick the game. Trading opens the trading wizard; a provider game opens the game wizard, whose settings step is generated from what that title declares. Set one start and one end - the play window is derived, there are no separate play dates.",
  "why is my game competition refusing rounds":
    "Most likely the contest is shorter than the title's maximum round length while the round start policy is set to reserve a full round, which fails closed and so refuses every attempt for the contest's whole duration. Change the policy to 'until the window closes' or lengthen the contest.",
  "why will my competition not settle":
    "A round is unresolved and the contest's unresolved-round policy is hold-and-alert, which deliberately blocks settlement until a human decides. End the round in Games -> Round Inspector. Settlement also waits a short grace period after the play window closes so a last-second result still counts.",
  "how to fix a wrong score":
    "You cannot, and that is deliberate: scores enter the system through exactly one function and there is no score box in the admin panel, because that would be a second door into the money layer. In Games -> Round Inspector you can END a round with a reason, which is what the settlement policies read.",
  "what happens if nobody scores":
    "It depends on the contest's unscored-contest policy. New drafts default to refunding entry fees, net of the platform fee because the contest did run. Contests created before that setting existed keep the old behaviour and route the pot to the unclaimed pool.",
  "can a provider touch player money":
    "No, by design. A provider reports a score and nothing else - no wallet access, no balances, no payouts. This platform owns the entry fee, the ranking, the winners and the payouts.",
  "why can a game master not create a game competition":
    "Their revenue share is a percentage of the entry fee taken before the provider's per-round cost exists, and the cap is against the gross platform fee, so a low-fee provider contest could be net loss-making while still paying commission. They still earn from referred players' entry fees in provider contests.",
  "where do i see if a game is working":
    "Two screens answering two questions. Games -> Provider Health is per provider over 24 hours - 'who do I ring'. Games -> Game Performance is per title over weeks - 'which game should we keep running'.",
};
