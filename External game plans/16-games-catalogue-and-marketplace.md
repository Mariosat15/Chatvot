# 16 - Games Catalogue, Marketplace and Game Masters (X11 and later)

Three pieces of platform work that the external-only scenario makes **more** important
than the in-house route, not less. A provider gives us many titles at once, and many
titles is precisely the situation a games catalogue exists to handle.

Owner direction of 30 August 2026: the platform becomes **games-first**. Players browse
games, open a game's page, and join a contest from there. Trading becomes one game among
several - demoted in navigation, not degraded in function.

---

## 1. The games catalogue (X11)

### The distinction that matters

A provider game arrives as a **catalogue record synced from their API** - `provider_game`
in `04-data-model.md`. That is a technical record: game code, capabilities, score
direction, config schema. It is not a page a player wants to read.

Three concepts, and collapsing any two of them is a mistake that gets expensive later:

| Concept | What it is | Who changes it | Where |
|---|---|---|---|
| **Game module** | Code. How a contest of this kind is run and settled | Developers, via release | `lib/games/` - `11` |
| **Provider game** | Technical metadata synced from the provider | The sync job, automatically | `provider_game` - `04` |
| **Catalogue entry** | Content. The page a player reads before paying | Admin, live, no release | New - below |

**One provider game can back several catalogue entries.** "Trivia Blitz: Sport" and
"Trivia Blitz: Film" can be two entries over the same provider title with different
`config` defaults, each with its own page, artwork and league table. That flexibility is
free if the split is made now.

Equally, **one module backs every provider game**, so the module count stays at two -
trading and provider - however large the catalogue grows.

### New model - `GameCatalogueEntry`

Mirrored to `apps/admin/database/models/` in the same commit.

| Field group | Fields |
|---|---|
| Identity | `slug` (**permanent**), `gameType`, `gameKey` (**immutable**), `providerKey`, `gameCode` |
| Content | `displayName`, `tagline`, `shortDescription`, `longDescription`, `howToPlay`, `rulesContent` |
| Artwork | `heroImage`, `thumbnail`, `iconUrl`, `screenshots` |
| Merchandising | `category`, `tags`, `sortOrder`, `isFeatured`, `isVisible`, `comingSoon` |
| Defaults | `defaultConfig` - pre-filled contest settings for this entry |
| Search | `seoTitle`, `seoDescription` |

Content is **seeded from the provider catalogue** on first sync - which is exactly why
`01` section 3.1 makes tagline, description, rules summary, how-to-play and banner
artwork contractual requirements. Admin can then edit freely; a later provider sync must
**never overwrite admin-edited content**.

That last point is a real trap. Get the sync semantics right at the start: the provider
owns technical metadata, admin owns presentation, and a sync updates the first without
touching the second.

### New routes

| Route | Contents |
|---|---|
| `/games` | The catalogue. Cards, categories, featured entries, coming-soon entries |
| `/games/[slug]` | The game page: description, how to play, rules, **live and upcoming contests for this game**, its league table, the player's own record |
| `/competitions` | **Retained.** Still the best view of everything open right now |

Keep both. Some players browse by game, others by what starts soonest or has the biggest
pot. Replacing one with the other loses half the audience.

### New admin section - Game Catalogue

Full editing with live preview, artwork upload, drag to reorder, feature, hide, mark
coming-soon. **Separate from the Game Types registry** in `12` section 1 - that screen is
technical, this one is merchandising, and the people who use them are different.

### States that must be designed, not discovered

| Situation | Required behaviour |
|---|---|
| A game page with **no live contests** | Never an empty page. Show upcoming contests, offer practice, offer notify-me, show the league table. **This is the normal state early on** |
| Entry hidden while its contests are live | Running contests keep working and stay reachable by direct link. Hiding removes it from **discovery** only - it cancels nothing |
| The **provider** disabled but entries visible | Entries must follow automatically, or players click into something unplayable |
| A provider **withdraws a title** mid-contest | Contest finishes on cached config; the entry goes coming-soon or hidden; **never delete the entry** - `gameKey` is the join key for historical stats |
| Coming-soon entry | Not joinable, and must not leak into `/competitions` |

The fourth row is specific to the external scenario and worth planning for. Providers
deprecate titles. `provider_game.status` moving to `deprecated` must degrade discovery
gracefully rather than break a live contest or orphan a leaderboard.

### Effort

**~2 weeks.** Model and admin CRUD 5 days, the two routes 4 days, merchandising and empty
states 2 days.

### Why it is X11 and not X1

It is tempting to start here because it is the visible part. That is the wrong order:
**a catalogue holding trading and nothing else advertises an empty platform.** It is also
the cheapest and lowest-risk piece, while the expensive and dangerous work sits beneath
it. Build the machinery, get real provider games running, then build the window.

The one nuance in the external scenario: a provider may deliver **ten titles at once**,
so the catalogue becomes worth building sooner than it would with a single in-house game.
If the first sync brings a genuinely broad catalogue, X11 can be pulled forward to sit
immediately after X7. It still must not come before a provider game actually works.

---

## 2. The marketplace, and the rule to set before anything is built

Today's marketplace is the Trading Arsenal - indicators and bots. Making it work for
other games means scoping every item to a game, tracking ownership per game, and giving
admin a game selector. About **two weeks**, and best kept off the critical path since it
earns very little until several games have a population playing them.

### The rule

> **Nothing sold may improve a player's score or ranking in a paid contest.**

Three independent reasons, and any one is sufficient:

**Fairness.** In a contest with real prize money, a player who discovers a paying rival
had an advantage does not complain - they leave, and they tell others.

**Regulation.** The position in `legal/ChartVolt-Regulatory-Defence-Pack.html` rests on
outcomes being decided by **skill**. If money measurably improves results, outcomes are
partly decided by spending.

**Payments.** "I paid for the advantage and still lost" is a chargeback narrative, and
chargeback ratios are what put a merchant account at risk.

| Safe to sell | Never sell |
|---|---|
| Cosmetics - avatars, frames, name colours, themes | Anything adding points or score |
| Titles and display badges with no scoring effect | Extra time, lives, retries, hints, skips |
| Entry-fee vouchers and discounts | Extra attempts in a one-attempt contest |
| Extra **practice** rounds, outside ranked play | Easier content inside a ranked contest |
| Richer profile statistics and history | **Random or mystery packs, even cosmetic ones** |

### Why random packs specifically

Paying real money for a randomised reward is exactly the **element of chance** the
regulatory position depends on being absent. It makes no difference that the reward is
decorative - the structure of the transaction is the problem. Where packs are
commercially attractive, sell **known contents at a known price**.

### The consequence for provider selection

This rule reaches into the provider contract. **No provider mechanic that sells advantage
may be enabled inside a ranked contest** - extra time, continues, hints, retries, paid
unlocks affecting results - regardless of who takes the payment. Many casual-game
providers depend on exactly those mechanics for their economics.

**Ask in the first conversation.** It is in `01` section 3.1 and in the questions in the
provider-facing requirements document. A provider whose games cannot run without
monetised advantage is the wrong provider, and finding that out after an integration is
scoped is an expensive way to learn it.

### One nuance about the existing trading items

Indicators and bots are defensible because they are analytical tools rather than score
modifiers, and because anyone can buy them. **Do not treat that as a precedent** for
score-affecting items in new games, and do not extend the reasoning without thinking it
through again.

---

## 3. Game Masters

**Moved to its own chapter: `19-game-masters.md`.**

An earlier draft of this chapter described Game Masters as "four smaller items,
roughly three to four days". That was wrong, and the correction matters. The Game Master
system is three dedicated collections, 28 API routes, a tier and subscription economy, a
referral attribution chain, its own renewal worker job, and two separate earning paths.
The real figure is **around two and a half weeks**, and it contains one item that is a
**gate rather than a task**: the Game Master competition route inserts with the raw
MongoDB driver and sets no game label, so a Game Master-created provider contest would be
settled by trading code.

`19` also covers the commercial problem trading never had - a provider charges per round,
and the Game Master's share is a percentage of the entry fee calculated before that cost
exists, which can make a popular low-fee contest **net loss-making for the platform while
still paying the Game Master**.

---

## 4. Sequencing

| Item | When | Effort |
|---|---|---|
| Games catalogue and games-first navigation | **X11** - after a provider game genuinely works. May move earlier if the first sync brings a broad catalogue | ~2 weeks |
| Per-game marketplace | **Unscheduled.** Off the critical path | ~2 weeks |
| Game Masters - see `19` | Game label in **X1** (a gate), the rest across X6-X8 | ~2.5 weeks |

---

## 5. Acceptance criteria

- [ ] A provider title appears at `/games/[slug]` with real content, and an admin can edit
      every part of that page **without a deploy**
- [ ] A provider sync updates technical metadata and **does not overwrite** admin-edited
      content
- [ ] A game page with no live contests is useful rather than empty
- [ ] Hiding an entry cancels nothing
- [ ] Disabling a provider automatically suppresses its entries
- [ ] A deprecated provider title degrades discovery without breaking a live contest or
      orphaning its leaderboard
- [ ] `/competitions` still works exactly as it does today
- [ ] No marketplace item can affect score or ranking in a paid contest - asserted by test,
      not by policy
- [ ] Game Master criteria are in `19` section 7
