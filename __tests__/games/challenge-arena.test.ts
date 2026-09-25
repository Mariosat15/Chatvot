import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  CHALLENGE_ROUND_START_POLICY,
  challengeRoundConfig,
  type ChallengeContestFields,
} from "@/lib/services/games/challenge-round-config";

/**
 * The two things the owner asked for on 13 September 2026 about playing a challenge:
 *
 *   1. "remove the restriction to join a round - all users can join anytime, any game; if they
 *      are late that is their problem" - so a late press of Play gets a SHORTENED round, never a
 *      refusal.
 *   2. "the game screen doesn't have all the elements on like when we play in competitions - use
 *      the same layout" - so the challenge play screen is the competition arena.
 *
 * The first half is behavioural and lives in `challengeRoundConfig`, which is pure and needs no
 * database. The second is structural, because what shipped is a composition: the guards below
 * are about which slots are filled, which component fills the one slot that genuinely differs,
 * and the two prohibitions that are easy to undo by accident.
 *
 * The creation side of the first half is pinned separately, in
 * `__tests__/services/challenge-provider-resolution.test.ts`, where the flipped refusal test
 * records why the rule changed.
 */

const ROOT = process.cwd();
const PLAY_PAGE = join(ROOT, "app", "(root)", "challenges", "[id]", "play", "page.tsx");
const LAYOUT = join(ROOT, "components", "games", "arena", "GameArenaLayout.tsx");
const STANDINGS = join(
  ROOT,
  "components",
  "games",
  "arena",
  "ChallengeStandingsPanel.tsx",
);
const STATUS_SERVICE = join(
  ROOT,
  "lib",
  "services",
  "games",
  "challenge-round-status.service.ts",
);
const CONFIG = join(ROOT, "lib", "services", "games", "challenge-round-config.ts");
const DEFAULTS = join(ROOT, "lib", "services", "games", "challenge-defaults.ts");
const COMPETITION_PAGE = join(
  ROOT,
  "app",
  "(root)",
  "competitions",
  "[id]",
  "play",
  "page.tsx",
);

/**
 * Comments stripped before matching, always.
 *
 * Every file here argues about the old behaviour in prose - the page explains why the rail is
 * different, the config module explains why an absent policy is permissive, and both name
 * `reserve_full_round` while no longer producing it. A bare match reads the explanation as the
 * code: it would pass a file whose only mention of the right thing is a comment, and fail a
 * correct one for discussing the mistake.
 */
function readCode(path: string): string {
  return readFileSync(path, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

/** A stored provider challenge with a window open for another hour. */
function challenge(
  overrides: Partial<ChallengeContestFields> = {},
): ChallengeContestFields {
  const startTime = new Date(Date.now() - 60_000);
  return {
    gameType: "provider",
    gameConfig: { providerKey: "chartvolt-games", gameCode: "circuit-sprint" },
    attemptsPolicy: "single",
    status: "active",
    startTime,
    endTime: new Date(startTime.getTime() + 60 * 60_000),
    ...overrides,
  } as ChallengeContestFields;
}

describe("how late a player may start a challenge round", () => {
  it("is the one definition, and it is the permissive one", () => {
    // Reason: the whole point of the constant is that three writers - this resolver, the
    // creation pre-flight and the create route - cannot disagree. Pinning its VALUE is what
    // stops it being quietly pointed back at the reservation, which no other assertion here
    // would notice: every one of them would still pass, describing the wrong rule.
    expect(CHALLENGE_ROUND_START_POLICY).toBe("until_window_closes");
  });

  it("reads an ABSENT stored policy as permissive - the opposite of a competition's reading of the same field name", () => {
    /*
      Reason: `contest-config.ts` treats an absent `roundStartPolicy` as `reserve_full_round`,
      matching `competition.model.ts`'s schema default, and that is right there - an operator
      chose the contest's settings, so the schema's answer is the one they were given. A
      challenge has no operator. An unset value on one is a challenge created before the field
      existed, not two players who chose the strict rule, so taking the schema's reading here
      would apply a rule to a pair who were never offered it.
    */
    const result = challengeRoundConfig(challenge({ roundStartPolicy: undefined }));

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error);
    expect(result.config.roundStartPolicy).toBe("until_window_closes");
  });

  it("reads a stored empty string as permissive too, because that is a missing value wearing a different shape", () => {
    // Reason: "missing" has three shapes - absent, null and "" - and only the first is
    // obvious. A half-written document is exactly what an interrupted write leaves behind,
    // and `""` is the one that looks correct in a document dump.
    const result = challengeRoundConfig(challenge({ roundStartPolicy: "" }));

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error);
    expect(result.config.roundStartPolicy).toBe("until_window_closes");
  });

  it("STILL honours an explicit `reserve_full_round`, so the new default and a stored intent stay two separate facts", () => {
    /*
      Reason: a test pinning a new default must be accompanied by one pinning the explicit
      override, or the two behaviours collapse into a single assertion and a fix that ignores
      the stored value entirely passes. Nothing writes `reserve_full_round` to a challenge
      today - which is why the field is kept rather than the policy hard-coded at the read: a
      per-title challenge default can narrow it later, and this is the assertion that says the
      narrowing will be obeyed.
    */
    const result = challengeRoundConfig(
      challenge({ roundStartPolicy: "reserve_full_round" }),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error);
    expect(result.config.roundStartPolicy).toBe("reserve_full_round");
  });

  it("names the constant in the play-state fallback rather than a literal", () => {
    /*
      Reason: the fallback in `getChallengePlayState` is unreachable - `challengeRoundConfig`
      always resolves the field - and it read `reserve_full_round` while the resolver had
      stopped producing it. An unreachable branch describing the opposite rule is the kind of
      thing a later reader trusts, and if it ever became reachable it would refuse a player
      for a reason nothing else on the platform still believes.
    */
    const code = readCode(STATUS_SERVICE);
    expect(code).toMatch(/roundStartPolicy:\s*[\s\S]{0,80}?CHALLENGE_ROUND_START_POLICY/);
    // NARROWED TO THE FALLBACK, not to the string: the file legitimately names both policies
    // in the `PlayState`-shaped union it declares, and a whole-file ban fired on correct code
    // the first time this suite ran. A guard that fails on a correct file is the one the next
    // reader deletes.
    expect(code).not.toMatch(/\?\?\s*"reserve_full_round"/);
  });

  it("keeps `reserve_full_round` as a comparison in the resolver and never as a value it produces", () => {
    /*
      Reason: the string legitimately appears in the resolver - it is the value being recognised.
      What must not appear is the module handing it back as its own answer, which is exactly what
      the code did before the owner's decision and is a one-word edit away.

      RE-POINTED, CLAIM UNCHANGED: the ternary lived in `challenge-round-config.ts` until the
      per-title defaults arrived (13 Sep 2026), when a THIRD reader of the same stored field
      appeared and all three were collapsed onto `resolveChallengeStartPolicy`. Only the location
      moved - and the assertion below is now stronger, because the one definition it examines is
      the one every reader goes through.
    */
    const code = readCode(DEFAULTS);
    expect(code).toMatch(/roundStartPolicy === "reserve_full_round"/);
    expect(code).toMatch(/\?\s*"reserve_full_round"\s*:\s*CHALLENGE_ROUND_START_POLICY/);
    // And the config module must go THROUGH it rather than asking the question again.
    const config = readCode(CONFIG);
    expect(config).toMatch(/resolveChallengeStartPolicy\s*\(/);
    expect(config).not.toMatch(/roundStartPolicy === "reserve_full_round"/);
  });
});

describe("the challenge play screen is the competition arena", () => {
  it("renders `GameArenaLayout` and fills every slot the competition page fills", () => {
    /*
      COUNTED AGAINST THE COMPETITION PAGE RATHER THAN AGAINST A LIST, because a list is a
      second place to forget. The owner's report was that the challenge screen was missing
      things the competition screen has, so the assertion that answers it is that the two pass
      the same slots - and a slot added to the competition arena later fails this rather than
      silently skipping the challenge.
    */
    const challengePage = readCode(PLAY_PAGE);
    const competitionPage = readCode(COMPETITION_PAGE);

    expect(challengePage).toMatch(/<GameArenaLayout/);

    // `activity` left the list on 25 Sep 2026 when the owner removed Recent players.
    for (const slot of ["stage", "standings", "sidebar", "rules", "highlights"]) {
      // Reason: the rule-scoped disable rather than the blanket one. `slot` comes from the
      // literal list above and never from input, so there is nothing to inject - and the
      // alternative, six hand-written patterns, is the second place to forget a slot that this
      // loop exists to remove.
      /* eslint-disable-next-line security/detect-non-literal-regexp */
      const passesSlot = new RegExp(`\\s${slot}=\\{`);
      expect(competitionPage, `competition page no longer passes ${slot}`).toMatch(passesSlot);
      expect(challengePage, `challenge page does not pass ${slot}`).toMatch(passesSlot);
    }
  });

  it("takes a back HREF rather than a contest id, and the layout names neither kind of contest in a path", () => {
    /*
      THE NEGATIVE IS THE LOAD-BEARING HALF. The layout used to build `/competitions/${id}`
      itself, so reusing it for a challenge sent the back link to a competition that does not
      exist - a link that resolves to a 404 rather than an error, on the one control a player
      uses to leave the board. Passing a HREF is trivially satisfied by a layout that still
      has the old literal behind a branch, so the absence is what is asserted.
    */
    const layout = readCode(LAYOUT);
    expect(layout).toMatch(/backHref/);
    expect(layout).not.toMatch(/\/competitions\//);
    expect(layout).not.toMatch(/\/challenges\//);

    expect(readCode(PLAY_PAGE)).toMatch(/backHref=\{`\/challenges\/\$\{challengeId\}`\}/);
  });

  it("fills the standings rail with the challenge panel and NOT with either competition board", () => {
    /*
      Reason: `ArenaLeaderboardPanel` and `ProviderLeaderboard` are both built around a rank -
      a plate, a crown, tie markers - and a challenge has no rank until it settles, when
      finalization decides the winner from the two scores and the catalogue's score direction.
      A rail that ordered the pair itself would be a second place that direction is decided,
      which is R37 exactly: the board and the payout each worked it out and disagreed.
    */
    const code = readCode(PLAY_PAGE);
    expect(code).toMatch(/standings=\{[\s\S]{0,120}?<ChallengeStandingsPanel/);
    expect(code).not.toMatch(/ArenaLeaderboardPanel/);
    expect(code).not.toMatch(/ProviderLeaderboard/);
  });

  it("reports the two seats without ordering them or giving either a position", () => {
    // Reason: the panel exists because of the previous test's reasoning, so the property to
    // pin is the one that made it necessary - it must not sort, and it must not render a rank.
    const code = readCode(STANDINGS);
    expect(code).not.toMatch(/\.sort\(/);
    expect(code).not.toMatch(/scoreDirection/);
    expect(code).not.toMatch(/rank/i);
  });

  it("renders an absent score as a dash, never as a nought", () => {
    /*
      R50's read side. A seat exists from the moment a challenge is accepted, and a player who
      has not finished a round holds no score at all - `ChallengeParticipant.score` no longer
      defaults. Rendering that as `0` says they played and scored nothing, which on a
      lower-is-better title also reads as the best result on the board.
    */
    const code = readCode(STANDINGS);
    expect(code).toMatch(/typeof seat\.score === "number"[\s\S]{0,80}?:\s*"—"/);
    expect(code).not.toMatch(/seat\.score\s*\?\?\s*0/);
  });

  it("does not mount the live refresher, which would reload the page under a paid attempt", () => {
    /*
      Reason: the same prohibition `13` s1.1j records for the competition arena, and it applies
      here for the identical reason - this page hosts a live round in an iframe, so a timer
      calling `router.refresh()` underneath an attempt somebody has PAID for can disturb it,
      intermittently and unreproducibly. It is the obvious next step for anybody fixing a stale
      figure on this screen, which is why it is a test rather than a comment.
    */
    expect(readCode(PLAY_PAGE)).not.toMatch(/LiveContestRefresher/);
  });

  it("starts no round on render", () => {
    /*
      Reason: an attempt is consumed on round CREATION, deliberately, and a server component is
      a GET - which browsers prefetch on hover. Launching from the render would spend a paying
      player's only attempt without them ever clicking. The POST belongs to the button inside
      `ChallengeRoundHost`.
    */
    const code = readCode(PLAY_PAGE);
    expect(code).not.toMatch(/createChallengeRound|launchChallengeRound|method:\s*"POST"/);
  });
});
