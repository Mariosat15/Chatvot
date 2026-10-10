import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  challengeOpponentLabel,
  isOpenChallenge,
  isUnclaimedOpenChallenge,
  OPEN_CHALLENGE_OPPONENT_LABEL,
} from "@/lib/utils/open-challenge";
import {
  readChallengeCode,
  readChallengeCreateScreen,
} from "../helpers/challenge-create-screen";

/**
 * A challenge nobody is named on.
 *
 * The rule under test is one sentence - openness is a STORED FLAG, never inferred from an
 * absent `challengedId` - and almost everything here exists to stop the inferred reading
 * coming back. The two fail in opposite directions: inferred, a bug that drops the opponent
 * off a directed challenge offers a named friend's seat to a stranger and debits a real
 * entry fee; with the flag, the same bug produces a challenge nobody can accept, which is
 * visible and refundable.
 *
 * Most of these are structural because there is no wrong number to assert on. A dialog that
 * sent `openToAnyone` beside a `challengedId`, a list that showed a player their own open
 * seat, or a second accepter debited for a challenge they are not in would each render
 * perfectly and report success.
 */

const ROOT = process.cwd();
const DIALOG = "components/challenges/ChallengeCreateDialog.tsx";
const PICKER = "components/challenges/create/OpponentPicker.tsx";
const CREATE_ROUTE = "app/api/challenges/route.ts";
const ACCEPT_ROUTE = "app/api/challenges/[id]/accept/route.ts";
const DECLINE_ROUTE = "app/api/challenges/[id]/decline/route.ts";
const CARD = "components/trading/ChallengeCard.tsx";
const ENTRY_ACTIONS = "components/trading/ChallengeEntryActions.tsx";
const PROVIDER_LOBBY = "components/games/ProviderChallengeLobby.tsx";
const CHALLENGES_PAGE = "app/(root)/challenges/page-content.tsx";
const DETAIL_PAGE = "app/(root)/challenges/[id]/page.tsx";
const LANDING_ROUTE = "app/api/landing/challenges/route.ts";
const MODEL = "database/models/trading/challenge.model.ts";
const ADMIN_MODEL = "apps/admin/database/models/trading/challenge.model.ts";

/**
 * Reason: `readChallengeCode` resolves against `process.cwd()` and strips comments, which is
 * what every file here needs - all of them argue in prose about the inferred reading and
 * name it to explain why it is wrong, so a bare match reads the warning as the offence.
 */
const read = (path: string) => readChallengeCode(path);

describe("the shared rule", () => {
  it("reads the flag and never the absent opponent", () => {
    expect(isOpenChallenge({ openToAnyone: true })).toBe(true);
    // The whole point: no opponent is not the same fact as open.
    expect(isOpenChallenge({ challengedId: undefined })).toBe(false);
    expect(isOpenChallenge({ challengedId: null })).toBe(false);
    expect(isOpenChallenge({})).toBe(false);
  });

  it("treats all three shapes of an empty seat as unclaimed", () => {
    // Reason: "missing" is absent, `null` or `""`, and only the first is obvious. A check
    // written `=== undefined` reads a stored empty string as taken - a seat nobody can
    // claim, on a document that looks correct in a dump.
    expect(isUnclaimedOpenChallenge({ openToAnyone: true })).toBe(true);
    expect(
      isUnclaimedOpenChallenge({ openToAnyone: true, challengedId: null }),
    ).toBe(true);
    expect(
      isUnclaimedOpenChallenge({ openToAnyone: true, challengedId: "" }),
    ).toBe(true);
  });

  it("stops being unclaimed once somebody takes the seat", () => {
    const claimed = { openToAnyone: true, challengedId: "u2" };
    // Still an open challenge - that is how it was created, which is what explains to a
    // viewer why a stranger is in it - but no longer an empty seat.
    expect(isOpenChallenge(claimed)).toBe(true);
    expect(isUnclaimedOpenChallenge(claimed)).toBe(false);
  });

  it("names an empty seat rather than rendering nothing", () => {
    expect(challengeOpponentLabel(undefined, { openToAnyone: true })).toBe(
      OPEN_CHALLENGE_OPPONENT_LABEL,
    );
    // A real name always wins, whatever the flag says.
    expect(challengeOpponentLabel("Ada", { openToAnyone: true })).toBe("Ada");
    // And a directed challenge with no name is a fault, not an invitation - calling it
    // "Open to anyone" would tell a player their private challenge is public.
    expect(challengeOpponentLabel(undefined, { openToAnyone: false })).toBe(
      "Unknown",
    );
  });

  it("imports no model, so a client component may use it", () => {
    // Reason: R58. `ChallengeCard.tsx` and the challenges page are `"use client"`, and a
    // module reaching a Mongoose model from one of them fails `next build` while the
    // typecheck, the suite and the dev server all stay green.
    const source = readFileSync(join(ROOT, "lib/utils/open-challenge.ts"), "utf8");
    expect(source).not.toMatch(/from\s+["'][^"']*models\//);
    expect(source).not.toContain("mongoose");
  });
});

describe("both model copies", () => {
  const copies = [
    ["main", MODEL],
    ["admin", ADMIN_MODEL],
  ] as const;

  it.each(copies)("declares openToAnyone on the %s copy", (_app, path) => {
    expect(read(path)).toMatch(/openToAnyone:\s*\{/);
  });

  it.each(copies)(
    "stops requiring the three opponent fields on the %s copy",
    (_app, path) => {
      const source = read(path);
      /*
        Reason: `required: true` on any of the three makes an open challenge unsaveable -
        and the failure is a validation error at create time, so the feature simply cannot
        ship. Asserted per field rather than by counting, because two of the three being
        right is indistinguishable from all three when the count is what is checked.
      */
      for (const field of ["challengedId", "challengedName", "challengedEmail"]) {
        const at = source.indexOf(`${field}:`);
        expect(at).toBeGreaterThan(-1);
        expect(source.slice(at, at + 200)).not.toMatch(/required:\s*true/);
      }
    },
  );
});

describe("creating one", () => {
  it("offers the seat from the picker only while nothing is typed", () => {
    const picker = read(PICKER);
    // Reason: once a player is searching they have named a person, and an "anyone" row
    // that stays put under a search is one click from sending the opposite.
    expect(picker).toMatch(
      /query\.trim\(\)\.length\s*===\s*0\s*&&[\s\S]{0,400}?onOpenToAnyoneChange\(true\)/,
    );
  });

  it("clears any earlier pick when the seat is opened", () => {
    const dialog = read(DIALOG);
    // Reason: both facts held at once means the request body depends on which state was
    // written last rather than on what the player chose.
    expect(dialog).toMatch(
      /onOpenToAnyoneChange=\{[\s\S]{0,240}?setPickedOpponent\(null\)/,
    );
  });

  it("sends exactly one of the two, never both", () => {
    const screen = readChallengeCreateScreen();
    expect(screen).toMatch(
      /isOpen[\s\S]{0,120}?openToAnyone:\s*true[\s\S]{0,120}?challengedId:/,
    );
  });

  it("ignores the flag when the caller named somebody", () => {
    const dialog = read(DIALOG);
    /*
      Reason: the same rule as the picker's own withholding. A screen opened about one
      person is not offering a choice, so a stale flag must not be able to turn that
      challenge into one any stranger may take.
    */
    expect(dialog).toMatch(/const\s+isOpen\s*=\s*!challengedUser\s*&&\s*openToAnyone/);
  });

  it("refuses both facts server-side rather than guessing", () => {
    const route = read(CREATE_ROUTE);
    /*
      Guessing is the failure worth naming: reading it as directed quietly makes an open
      challenge private, reading it as open offers a named friend's seat to a stranger.
      Either way a real entry fee is debited by somebody nobody chose.
    */
    expect(route).toMatch(/if\s*\(isOpenChallenge\s*&&\s*challengedId\)/);
    expect(route).toMatch(/if\s*\(!isOpenChallenge\s*&&\s*!challengedId\)/);
  });

  it("omits the three opponent fields rather than storing empty ones", () => {
    const route = read(CREATE_ROUTE);
    // Reason: the accept-time claim filter is why this must be exact. A stored `""` is
    // what a later `$exists` reading treats as taken.
    expect(route).toMatch(
      /isOpenChallenge\s*\?\s*\{\}\s*:\s*\{\s*challengedId,\s*challengedName,\s*challengedEmail\s*\}/,
    );
  });

  it("tells nobody about a challenge addressed to nobody", () => {
    const route = read(CREATE_ROUTE);
    /*
      Reason: `notificationService.send` with an undefined recipient either throws into the
      catch and logs a false error, or writes a row addressed to nobody. Asserted by
      POSITION against the notification block, because the file tests `isOpenChallenge` in
      several places and a bare search is satisfied by any of them.
    */
    const gate = route.indexOf("if (!isInSimulatorMode && !isOpenChallenge)");
    expect(gate).toBeGreaterThan(-1);
    expect(route.indexOf("challenge_received")).toBeGreaterThan(gate);
    expect(route.indexOf("notifyChallengeReceived")).toBeGreaterThan(gate);
  });
});

describe("taking the seat", () => {
  it("claims it atomically, so the second accepter is refused", () => {
    const route = read(ACCEPT_ROUTE);
    const claim = route.indexOf("Challenge.findOneAndUpdate");
    expect(claim).toBeGreaterThan(-1);
    const filter = route.slice(claim, claim + 700);
    /*
      The filter IS the lock. Two players pressing Accept together both read a pending
      challenge and an empty seat; without demanding the seat still be empty in the same
      instruction, both are debited a real entry fee for a challenge one of them is not in.
    */
    expect(filter).toMatch(/status:\s*"pending"/);
    expect(filter).toMatch(/openToAnyone:\s*true/);
    // All three shapes again - and here the consequence of getting it wrong is a seat that
    // can be claimed twice or not at all.
    expect(filter).toMatch(/challengedId:\s*\{\s*\$exists:\s*false\s*\}/);
    expect(filter).toMatch(/challengedId:\s*null/);
    expect(filter).toMatch(/challengedId:\s*""/);
  });

  it("claims inside the transaction, before any wallet is read", () => {
    const route = read(ACCEPT_ROUTE);
    const claim = route.indexOf("Challenge.findOneAndUpdate");
    const debit = route.indexOf("CreditWallet.findOneAndUpdate");
    expect(claim).toBeGreaterThan(-1);
    expect(debit).toBeGreaterThan(-1);
    // Reason: the same ordering as `checkAccountStanding`. A later refusal aborts the
    // transaction and rolls the claim back, so a player turned away for an empty wallet has
    // not silently consumed somebody else's opportunity.
    expect(claim).toBeLessThan(debit);
  });

  it("continues from the claimed document, not the stale read", () => {
    const route = read(ACCEPT_ROUTE);
    // Reason: everything below the claim reads `challenge.challengedId` to debit a wallet,
    // write a ledger row and build a seat. The copy read before the claim still has none.
    expect(route).toMatch(/challenge\s*=\s*claimed/);
  });

  it("keeps a tripwire in front of the debit", () => {
    const route = read(ACCEPT_ROUTE);
    const guard = route.indexOf("if (!challengedId || !challengedName)");
    const debit = route.indexOf("CreditWallet.findOneAndUpdate");
    expect(guard).toBeGreaterThan(-1);
    /*
      Recorded as UNREACHABLE today, and kept: every path either matched the caller against
      a stored `challengedId` or has just written one. It exists because the three fields
      became optional on the model, and without it a future branch reaching the debit with
      an empty seat would satisfy the compiler.
    */
    expect(guard).toBeLessThan(debit);
  });

  it("refuses a directed challenge whose opponent went missing", () => {
    const route = read(ACCEPT_ROUTE);
    // Reason: this is what the explicit flag buys. `undefined !== id` for every caller, so
    // a damaged document fails closed instead of opening the seat to the platform.
    expect(route).toMatch(/challenge\.challengedId\s*!==\s*session\.user\.id/);
  });

  it("leaves decline refusing an open seat", () => {
    const route = read(DECLINE_ROUTE);
    // Nobody was invited, so there is nothing to refuse - and the same comparison does it
    // for free, which is why the card withholds the button rather than the route learning
    // a new rule.
    expect(route).toMatch(/challenge\.challengedId\s*!==\s*session\.user\.id/);
    expect(route).not.toContain("openToAnyone");
  });
});

describe("finding one", () => {
  it("lists only unclaimed seats that are not the caller's own", () => {
    const route = read(CREATE_ROUTE);
    const branch = route.indexOf('type === "open"');
    expect(branch).toBeGreaterThan(-1);
    const body = route.slice(branch, branch + 500);
    /*
      Four clauses and dropping any one shows a challenge that cannot be accepted: a
      directed one, a seat already taken, the caller's own (a button the accept route
      refuses), or one that has already started.
    */
    expect(body).toMatch(/query\.openToAnyone\s*=\s*true/);
    expect(body).toMatch(/query\.challengedId\s*=\s*\{\s*\$in:\s*\[null,\s*""\]\s*\}/);
    expect(body).toMatch(/query\.challengerId\s*=\s*\{\s*\$ne:\s*session\.user\.id\s*\}/);
    expect(body).toMatch(/query\.status\s*=\s*"pending"/);
  });

  it("gives the open list its own tab rather than mixing it into the caller's", () => {
    const page = read(CHALLENGES_PAGE);
    expect(page).toContain("/api/challenges?type=open");
    // Reason: two sources, so the tab must read the right one. A version that filtered the
    // caller's own list by `openToAnyone` shows an empty tab and nothing fails.
    expect(page).toMatch(/activeTab\s*===\s*"open"\s*\?\s*openChallenges/);
  });

  it("lets any signed-in player read an unclaimed seat's detail page", () => {
    const page = read(DETAIL_PAGE);
    // Reason: without this the accepter meets a 404 on the one screen that would tell them
    // what they are paying to enter.
    expect(page).toMatch(/!isUnclaimedOpenChallenge\(challenge\)/);
  });
});

describe("the screens that assumed two named players", () => {
  const screens = [
    ["the card", CARD],
    ["the provider lobby", PROVIDER_LOBBY],
  ] as const;

  it.each(screens)("names the empty seat on %s", (_name, path) => {
    const source = read(path);
    // Reason: "vs undefined" reads as a rendering fault rather than as an invitation. The
    // label is shared so two screens cannot disagree about what an empty seat is called.
    expect(source).toContain("challengeOpponentLabel");
  });

  it("withholds decline on an open seat", () => {
    const card = read(CARD);
    /*
      Declining is refusing an invitation addressed to you, and nobody is addressed - the
      route answers 403. Offering the button is a control that appears to work and does
      nothing. Asserted on the derivation rather than on the markup, because the file
      legitimately mentions Decline in the branch that is still correct.
    */
    expect(card).toMatch(/const\s+canDecline\s*=\s*canRespond\s*&&\s*!isOpenSeat/);
  });

  it("does not tell a browsing player they were singled out", () => {
    const card = read(CARD);
    // Reason: deciding this from `isChallenger` alone renders "Challenged you" to every
    // player looking at a seat nobody was named on.
    expect(card).toMatch(/isOpenSeat[\s\S]{0,120}?"Open to anyone"/);
  });

  it("resolves the provider lobby's recipient from the stored id", () => {
    const lobby = read(PROVIDER_LOBBY);
    /*
      `isChallenged` was `!isChallenger`, which is the same question only while a challenge
      names two players. On an open one a browsing player satisfied it and was shown
      "Challenge Received!" with a Decline button the route refuses.
    */
    expect(lobby).toMatch(/challenge\.challengedId\s*\?\?\s*""\)\s*===\s*String\(userId\)/);
    expect(lobby).not.toMatch(/const\s+isChallenged\s*=\s*!isChallenger\s*;/);
  });

  it("offers the seat on the detail page instead of a dead panel", () => {
    const actions = read(ENTRY_ACTIONS);
    // Reason: a visitor to an unclaimed seat fell through to "no longer active" - the one
    // screen with room to explain the challenge had no way to take it.
    expect(actions).toMatch(/status\s*===\s*"pending"\s*&&\s*openSeat/);
    expect(read(DETAIL_PAGE)).toMatch(/openSeat=\{isUnclaimedOpenChallenge\(challenge\)\}/);
  });

  it("does not invent a second player on the public landing feed", () => {
    const route = read(LANDING_ROUTE);
    // Reason: the fallback was "Player 2", which on an open challenge states there is an
    // opponent when the whole point of the row is that the seat is free.
    //
    // The argument is a picked object literal rather than the row itself: this route reads
    // with the raw driver, so a document arrives as `WithId<Document>`, which shares no
    // declared property with the helper's input type. Both field reads are named here, so a
    // literal that picks the wrong two cannot satisfy this while still compiling.
    expect(route).toMatch(
      /isUnclaimedOpenChallenge\(\{[\s\S]{0,200}?openToAnyone:\s*challenge\.openToAnyone[\s\S]{0,120}?challengedId:\s*challenge\.challengedId[\s\S]{0,40}?\}\)[\s\S]{0,60}?\?\s*OPEN_CHALLENGE_OPPONENT_LABEL/,
    );
  });
});
