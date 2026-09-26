import { describe, expect, it } from "vitest";
import {
  readChallengeCode,
  readChallengeCreateScreen,
} from "../helpers/challenge-create-screen";

/**
 * The opponent picker, and the one thing it must never do: decide the opponent when the
 * caller already named one.
 *
 * Structural, because the value under test is which of two sources a component reads. There
 * is no wrong number here - a dialog that sent the challenge to the picked player instead of
 * the profile the player opened it from would render perfectly, report success and debit two
 * wallets.
 */

const DIALOG = "components/challenges/ChallengeCreateDialog.tsx";
const PICKER = "components/challenges/create/OpponentPicker.tsx";
const OPPONENTS_ROUTE = "app/api/challenges/opponents/route.ts";
const CHALLENGES_PAGE = "app/(root)/challenges/page-content.tsx";

describe("a named opponent always wins over the picker", () => {
  it("resolves the opponent from the prop first", () => {
    const screen = readChallengeCreateScreen();
    expect(screen).toMatch(
      /const\s+opponent\s*=\s*challengedUser\s*\?\?\s*pickedOpponent/,
    );
  });

  it("never resolves it the other way round", () => {
    const screen = readChallengeCreateScreen();
    expect(screen).not.toMatch(
      /const\s+opponent\s*=\s*pickedOpponent\s*\?\?\s*challengedUser/,
    );
  });

  it("withholds the picker entirely when the caller named somebody", () => {
    const dialog = readChallengeCode(DIALOG);
    const mount = dialog.indexOf("<OpponentPicker");
    expect(mount).toBeGreaterThan(-1);

    // Reason: position within the construct, not a bare search for the condition. The file
    // legitimately tests `challengedUser` elsewhere, so asserting the negation appears
    // somewhere is satisfied by a dialog that mounts the picker unconditionally.
    const before = dialog.slice(0, mount);
    expect(before).toMatch(/\{!challengedUser\s*&&\s*\($/m);
  });

  it("sends the resolved opponent, never the prop and never the pick", () => {
    const dialog = readChallengeCode(DIALOG);
    expect(dialog).toMatch(/challengedId:\s*opponent!?\.userId/);
    expect(dialog).not.toMatch(/challengedId:\s*challengedUser\./);
    expect(dialog).not.toMatch(/challengedId:\s*pickedOpponent\./);
  });

  it("refuses to submit without a recipient of either kind", () => {
    const dialog = readChallengeCode(DIALOG);
    const submit = dialog.indexOf("const handleSubmit");
    const proceed = dialog.indexOf("const proceedAfterTerms");
    expect(submit).toBeGreaterThan(-1);
    expect(proceed).toBeGreaterThan(submit);
    /*
      Reason: this asserted `!opponent` until open challenges arrived on 14 September 2026.
      The claim is unchanged - a challenge must have somebody to be against - but there are
      now two ways to satisfy it, and the old spelling would refuse every open seat while
      reading as a correct guard. Flipped rather than deleted, because the reason the gate
      exists is the valuable part.

      There are TWO gates, a few lines apart, and they are asserted separately: a probe that
      restored `!opponent` in `handleSubmit` alone came back green against a fixed-width
      slice, because `proceedAfterTerms`'s copy sat inside it and satisfied the match. Bound
      each slice by the construct that follows it, never by a character count.
    */
    expect(dialog.slice(submit, proceed)).toMatch(/if\s*\(!hasRecipient\)/);
    // And the second gate, which is the one the terms dialog actually returns through.
    expect(dialog.slice(proceed, proceed + 200)).toMatch(/if\s*\(!hasRecipient\)/);
    // Neither may fall back to the named-opponent spelling.
    expect(dialog).not.toMatch(/if\s*\(!opponent\)/);

    // And the button cannot be pressed in the first place.
    expect(dialog).toMatch(/disabled=\{[\s\S]{0,120}?!hasRecipient/);
  });

  it("clears the pick when the dialog reopens", () => {
    const dialog = readChallengeCode(DIALOG);
    // Reason: a player who cancels after choosing somebody must not find them still chosen.
    // Asserted beside the other reopen resets so it cannot drift into a different effect.
    const reset = dialog.indexOf('setSelection({ type: "trading" })');
    expect(reset).toBeGreaterThan(-1);
    const after = dialog.slice(reset, reset + 260);
    expect(after).toContain("setPickedOpponent(null)");
    // And the open seat with it - a reopened dialog that is still "open to anyone" sends
    // the opposite of what the next player picks, with no control showing them why.
    expect(after).toContain("setOpenToAnyone(false)");
  });

  it("keeps the prop optional so a caller may omit it", () => {
    const dialog = readChallengeCode(DIALOG);
    expect(dialog).toMatch(/challengedUser\?:\s*\{/);
  });
});

describe("the picker's two sources", () => {
  it("reads friends from the challenge opponents route", () => {
    expect(readChallengeCode(PICKER)).toContain("/api/challenges/opponents");
  });

  it("reuses the messaging search rather than a second one", () => {
    const picker = readChallengeCode(PICKER);
    expect(picker).toContain("/api/messaging/search/users");
    // Reason: that endpoint already filters both directions of the block list. A second
    // search written for this screen would have to reimplement it, and the copy that forgets
    // shows a player somebody who has blocked them.
    expect(picker).not.toMatch(/\/api\/(users|players)\/search/);
  });

  it("does not search before the endpoint would accept the query", () => {
    const picker = readChallengeCode(PICKER);
    expect(picker).toMatch(/MIN_QUERY_LENGTH\s*=\s*2/);
    expect(picker).toMatch(
      /trimmed\.length\s*<\s*MIN_QUERY_LENGTH[\s\S]{0,200}?return/,
    );
  });

  it("discards a late response instead of letting it overwrite a newer one", () => {
    const picker = readChallengeCode(PICKER);
    // Reason: the operator, not the operand. A version that increments the counter and never
    // compares it satisfies a search for the identifier alone.
    expect(picker).toMatch(/id\s*!==\s*requestId\.current/);
  });
});

describe("the opponents route", () => {
  it("refuses an unauthenticated caller", () => {
    const route = readChallengeCode(OPPONENTS_ROUTE);
    expect(route).toMatch(/if\s*\(!session\?\.user\?\.id\)/);
    expect(route).toMatch(/status:\s*401/);
  });

  it("reads the friendship model rather than inventing a list", () => {
    const route = readChallengeCode(OPPONENTS_ROUTE);
    // Reason: the call is made through a locally narrowed alias, because
    // `models.Friendship || model(...)` hides the statics from a caller - so matching
    // `Friendship.getUserFriends` would fail on correct code. Assert the two halves the
    // alias sits between instead: the model is imported from the friend model, and the
    // static is the thing called. A version that queried the collection by hand, or reached
    // for `matchmaking.service`, fails one of the two.
    expect(route).toMatch(
      /import\s*\{[^}]*\bFriendship\b[^}]*\}\s*from\s*["']@\/database\/models\/messaging\/friend\.model["']/,
    );
    expect(route).toMatch(/=\s*Friendship\s+as\s+unknown\s+as/);
    expect(route).toMatch(/\.getUserFriends\(\s*session\.user\.id\s*\)/);
    expect(route).not.toContain("matchmaking");
  });

  it("returns the OTHER user of each friendship, never the caller", () => {
    const route = readChallengeCode(OPPONENTS_ROUTE);
    // Reason: `userDetails` holds both parties, so picking the first entry puts the player
    // in their own opponent list - which reads as a rendering oddity and is a way to send a
    // challenge to yourself.
    expect(route).toMatch(/detail\.userId\s*!==\s*session\.user\.id/);
  });
});

describe("the entry point", () => {
  it("opens the dialog with no opponent from the challenges page", () => {
    const page = readChallengeCode(CHALLENGES_PAGE);
    const mount = page.indexOf("<ChallengeCreateDialog");
    expect(mount).toBeGreaterThan(-1);

    const tag = page.slice(mount, page.indexOf("/>", mount) + 2);
    expect(tag.length).toBeGreaterThan(20);
    // Reason: the whole point of the slice. Passing a `challengedUser` here would withhold
    // the picker and leave the button opening a dialog nobody can submit.
    expect(tag).not.toContain("challengedUser");
  });
});
