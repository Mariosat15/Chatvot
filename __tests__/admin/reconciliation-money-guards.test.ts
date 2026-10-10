/**
 * Guards for the four money defects the financial reconciliation screen exposed, and for
 * the screen's own ability to keep exposing them.
 *
 * The screen was doing its job. An operator opened it, saw four issues on one account, and
 * asked whether reconciliation was correct - and the answer was that three of the four
 * findings were real writer defects it had correctly detected, one was a stored counter it
 * could never report because the route masked it, and the Fix button for the largest issue
 * would have destroyed the player's credits.
 *
 * - **R78** - a challenge prize incremented `totalWonFromCompetitions`. Behaviourally
 *   pinned in `challenge-settlement.test.ts`; the structural half is here, because the
 *   field name is what regresses.
 * - **R79** - the admin challenge cancel credited a wallet and wrote no ledger row.
 * - **R80** - `force_complete` paid a prize with no ledger, no fee and no lock, on a route
 *   with no authorization at all. Deleted.
 * - **R81** - the balance Fix button confiscated credits when the wallet sat ABOVE the
 *   ledger, which is precisely the state R79 produced.
 * - **R82** - `totalGmEarnings` was incremented by nothing and masked by the route.
 *
 * Every assertion here is structural and every one of them reads a CODE slice with comments
 * stripped, because all five files now explain these defects at length in prose. A test that
 * reads prose fails in both directions: it flags a correct file for discussing the mistake,
 * and it passes a broken one whose only mention of the fix is the paragraph describing it.
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import CreditWallet from "../../apps/admin/database/models/trading/credit-wallet.model";
import {
  guardedSections,
  handlerSlices,
  stripComments,
} from "../helpers/route-guard-audit";

const ROOT = join(process.cwd());

function readCode(...segments: string[]): string {
  return stripComments(readFileSync(join(ROOT, ...segments), "utf8"));
}

const CHALLENGE_ROUTE = ["apps", "admin", "app", "api", "challenges", "route.ts"];
const RECONCILIATION_ROUTE = [
  "apps",
  "admin",
  "app",
  "api",
  "reconciliation",
  "route.ts",
];

/**
 * Both copies of every mirrored settlement file. `check:mirrors` compares MODELS, so it has
 * never had an opinion about these, and "one rule, two copies" has already produced five
 * defects here. R78 lived in both copies identically, which is why a fix to one is not a fix.
 */
const MIRRORED = [
  ["lib", "services", "settlement", "prize-payout.service.ts"],
  ["lib", "services", "settlement", "types.ts"],
  ["lib", "services", "settlement", "game-master-fees", "distribute.ts"],
];

function bothCopies(segments: string[]): { label: string; code: string }[] {
  return [
    { label: "main", code: readCode(...segments) },
    { label: "admin", code: readCode("apps", "admin", ...segments) },
  ];
}

describe("R78 - the shared prize stage must not name a competition counter", () => {
  it("increments the counter the vocabulary chooses, in both copies", () => {
    for (const { label, code } of bothCopies(MIRRORED[0])) {
      // Reason: scoped to the $inc, never the whole file. A file-wide ban fires on the
      // wallet-creation branch a few lines above, which legitimately seeds
      // `totalWonFromCompetitions: 0` among the other defaults - and a guard that fails on
      // correct code is the one the next reader deletes.
      const from = code.indexOf("$inc: {");
      const inc = code.slice(from, code.indexOf("}", from));

      expect(inc.length, label).toBeGreaterThan(20);
      // The defect in one assertion: the stage hard-coded `totalWonFromCompetitions`
      // while every other field in it came from `resolveContestVocabulary`.
      expect(inc, label).not.toContain("totalWonFrom");
      expect(inc, label).toMatch(/\[vocabulary\.walletWinField\]/);
    }
  });

  it("gives the two contest kinds two different counters", () => {
    // Reason: the assertion above is satisfied by a vocabulary in which both kinds name
    // the same field - which is the defect with an extra layer of indirection in front of
    // it. The two literals must appear exactly once each, and in different objects.
    for (const { label, code } of bothCopies(MIRRORED[1])) {
      // Reason: read the value out of EACH vocabulary object, never the file. Both
      // literals appear in the interface's own union type, so a file-wide presence check
      // is green against a CHALLENGE_VOCABULARY that names the competition counter -
      // which is R78 restored with `vocabulary.walletWinField` still in front of it,
      // reading exactly as the fix does. A probe proved that version passed.
      const valueIn = (constName: string): string | undefined => {
        const from = code.indexOf(`const ${constName}`);
        expect(from, `${label} ${constName}`).toBeGreaterThan(-1);
        return code
          .slice(from, code.indexOf("};", from))
          .match(/walletWinField: "(\w+)"/)?.[1];
      };

      expect(valueIn("COMPETITION_VOCABULARY"), label).toBe(
        "totalWonFromCompetitions",
      );
      expect(valueIn("CHALLENGE_VOCABULARY"), label).toBe(
        "totalWonFromChallenges",
      );

      // Three: the field on the interface, then one per contest kind. Two would mean a
      // kind had lost its own answer and was inheriting the other's.
      const walletWinFields = code.match(/walletWinField:/g) ?? [];
      expect(walletWinFields, label).toHaveLength(3);
    }
  });
});

describe("R79 - an admin challenge cancel must write the ledger row it implies", () => {
  const code = readCode(...CHALLENGE_ROUTE);

  it("writes a challenge_refund transaction beside the wallet credit", () => {
    // Reason: position INSIDE the helper, not presence in the file. The wallet credit and
    // the transaction are one logical write, and a version that credits the wallet in the
    // helper and writes the row somewhere else is the defect wearing a refactor.
    // Reason: these files are CRLF, so a `\n}\n` marker matches nothing and the slice
    // comes back empty - a test examining nothing passes everything asked of it, which is
    // why the length is asserted below rather than assumed.
    const helper = code.slice(code.indexOf("async function refundChallengeSeat"));
    const end = helper.search(/\r?\n\}\r?\n/);
    const body = helper.slice(0, end === -1 ? 0 : end);

    expect(body.length).toBeGreaterThan(200);
    expect(body).toMatch(/creditBalance: entryFee/);
    // Reason: the CALL, not the fields it is given. A probe swapping
    // `WalletTransaction.create(` for `Promise.resolve(` left every field literal in
    // place - transaction type, attribution, amount - so an object that is built,
    // handed to nothing and discarded satisfied all of them. The row is only written
    // if this line exists.
    expect(body).toMatch(/await WalletTransaction\.create\(/);
    expect(body).toMatch(/transactionType: "challenge_refund"/);
    // `challengeId`, never `referenceId` - Stage 0 found the whole challenge money trail
    // unattributable because nine writers chose the undeclared name and strict mode
    // discarded it while reporting success.
    expect(body).toMatch(/^\s+challengeId,$/m);
    expect(body).toMatch(/totalRefunded: entryFee/);
  });

  it("refunds both seats through the one helper", () => {
    // Two near-identical blocks is how the challenger got a ledger row and the challenged
    // user did not, in the first draft of this fix. One call site inside a loop over both
    // ids is the guarantee - so the CALL is counted, and a second one means the loop was
    // unrolled again.
    const calls = code.match(/await refundChallengeSeat\(/g) ?? [];
    expect(calls).toHaveLength(1);
    expect(code).toMatch(
      /for \(const userId of \[\s*challenge\.challengerId,\s*challenge\.challengedId,?\s*\]\)/,
    );
  });
});

describe("R80 - the unauthenticated second money writer is gone", () => {
  const code = readCode(...CHALLENGE_ROUTE);

  it("has no force_complete action of any kind", () => {
    // Comments stripped, so the paragraph above the deletion explaining what used to be
    // there does not satisfy this - which is the whole reason for stripping them.
    expect(code).not.toContain("force_complete");
    expect(code).not.toContain("winnerPrize");
    expect(code).not.toContain("totalWonFromChallenges");
  });

  it("guards every exported handler with the challenges section", () => {
    // Counted per handler rather than per file: a route whose POST is guarded and whose
    // GET is not passes any check that merely asks whether the file mentions a guard, and
    // this file's GET hands out every challenge on the platform.
    const handlers = handlerSlices(code);
    expect(handlers.length).toBeGreaterThanOrEqual(2);

    for (const handler of handlers) {
      expect(
        guardedSections(handler.body),
        `${handler.method} is not guarded`,
      ).toEqual(["challenges"]);
    }
  });

  it("guards before it reads the request body", () => {
    for (const handler of handlerSlices(code)) {
      const guard = handler.body.indexOf("guardSection(");
      const body = handler.body.search(/request\.(json|nextUrl|url)/);
      if (body === -1) continue;
      expect(guard, `${handler.method} reads the request before guarding`).
        toBeLessThan(body);
    }
  });
});

describe("R81 - the balance Fix button must refuse to delete a player's credits", () => {
  const code = readCode(...RECONCILIATION_ROUTE);
  const fix = (() => {
    const from = code.indexOf('case "balance_mismatch"');
    const to = code.indexOf('case "deposit_total_mismatch"');
    return code.slice(from, to);
  })();

  it("found the fix it is asserting about", () => {
    // Reason: a slice whose markers moved returns nothing or almost everything, and a test
    // examining nothing passes. Both ends are proven before anything is read from it.
    expect(fix.length).toBeGreaterThan(500);
    expect(fix.length).toBeLessThan(code.length);
  });

  it("aborts and returns 409 when the correction would reduce the balance", () => {
    // The direction matters and only one of them is dangerous. Asserting merely that the
    // fix "has a guard" is green against `rounded > previousBalance`, which refuses every
    // safe repair and applies every destructive one.
    const guard = fix.search(/if \(rounded < previousBalance - 0\.01\)/);
    const update = fix.search(/CreditWallet\.updateOne/);

    expect(guard).toBeGreaterThan(-1);
    expect(update).toBeGreaterThan(-1);
    // Before the write, or the refusal is an audit note on a change already made.
    expect(guard).toBeLessThan(update);

    const refusal = fix.slice(guard, update);
    expect(refusal).toMatch(/abortTransaction\(\)/);
    expect(refusal).toMatch(/status: 409/);
    expect(refusal).toMatch(/success: false/);
  });

  it("names the real repair rather than only refusing", () => {
    // An operator who cannot act on a refusal presses the other buttons. The message has
    // to say that the missing thing is a ledger row, and that an intentional removal is an
    // explicit debit - otherwise the next step is a manual balance edit in the database.
    expect(fix).toMatch(/without a transaction row/);
    expect(fix).toMatch(/admin debit/);
  });
});

describe("R82 - the Game Master lifetime counter is maintained and reported", () => {
  // Reason: the name is ASCII and regex-safe on purpose. Vitest's `-t` is a REGULAR
  // EXPRESSION, so a name containing `$inc` matches nothing, the probe harness runs zero
  // tests, and a passing run over an empty set reads exactly like a guard that does not
  // work. Two probes reported STILL GREEN for that reason alone.
  it("increments totalGmEarnings in the same update as the balance, in both copies", () => {
    for (const { label, code } of bothCopies(MIRRORED[2])) {
      // One $inc, not two updates: separate writes can diverge, and the divergence is
      // invisible because each one is individually correct.
      expect(code, label).toMatch(
        /\$inc: \{ creditBalance: totalEarning, totalGmEarnings: totalEarning \}/,
      );
    }
  });

  it("reports the STORED counter rather than substituting the calculated one", () => {
    const code = readCode(...RECONCILIATION_ROUTE);

    // The defect in one assertion. `walletData.totalGmEarnings || gmEarningsTotal` meant
    // a zero counter rendered as the calculated figure, so the row could never disagree
    // with itself and the field that nothing incremented looked correct on every account.
    expect(code).not.toMatch(/totalGmEarnings:\s*walletData\.totalGmEarnings\s*\|\|/);
  });

  it("raises an issue only for a user who has GM payout rows", () => {
    const code = readCode(...RECONCILIATION_ROUTE);
    const check = code.slice(
      code.indexOf("const gmEarningsDiff"),
      code.indexOf('type: "gm_earnings_mismatch"'),
    );

    expect(check.length).toBeGreaterThan(50);
    // Without the `gmEarningsTotal > 0` half this is a warning on every player who has
    // never been a Game Master - which is nearly all of them, and a screen that warns
    // about everybody is one nobody reads.
    expect(check).toMatch(/gmEarningsTotal > 0/);
  });

  it("sums BOTH payout row types when it repairs the counter", () => {
    const code = readCode(...RECONCILIATION_ROUTE);
    // It is the last case in the switch, so the end marker is the default arm - taken
    // from after the case's own position, never from the start of the file.
    const from = code.indexOf('case "gm_earnings_mismatch"');
    const fix = code.slice(from, code.indexOf("default:", from));

    expect(fix.length).toBeGreaterThan(200);
    // A Game Master earns from referred players' entry fees in competitions AND
    // challenges. Summing one silently halves a partner's recorded lifetime earnings -
    // and the repaired figure then looks authoritative.
    expect(fix).toMatch(/"gamemaster_earning"/);
    expect(fix).toMatch(/"gamemaster_challenge_referral"/);
    expect(fix).toMatch(/totalGmEarnings:/);
  });
});

describe("the reconciliation screen can render the counters the route now reports", () => {
  const screen = readCode(
    "apps",
    "admin",
    "components",
    "admin",
    "ReconciliationSection.tsx",
  );
  const route = readCode(...RECONCILIATION_ROUTE);

  it("offers a Fix for each new issue type", () => {
    // An issue type absent from this map renders with no label and no button, so the route
    // reports a real discrepancy that an operator cannot act on - which is how a fixable
    // problem becomes a permanent red badge.
    for (const type of [
      "incident_compensation_mismatch",
      "gm_earnings_mismatch",
    ]) {
      expect(route, `route does not raise ${type}`).toContain(`type: "${type}"`);
      expect(screen, `screen does not list ${type}`).toContain(`${type}: {`);
      expect(route, `route cannot fix ${type}`).toContain(`case "${type}"`);
    }
  });

  it("gives the GM row a verdict rather than a fixed icon", () => {
    // Reason: "Incident Compensation" appears first in the issue-label map near the top of
    // the file, so a slice between two bare `indexOf` calls runs BACKWARDS and returns
    // nothing. Search for the end marker from the start marker onwards.
    const from = screen.indexOf("GM Referral Earnings");
    const row = screen.slice(from, screen.indexOf("Incident Compensation", from));

    expect(row.length).toBeGreaterThan(200);
    // Reason: this cell printed 💰 unconditionally, so the row could not report a
    // discrepancy however far apart the two figures were - the display half of the
    // route's `|| calculated` mask. Every other row answers ✓ or ⚠.
    expect(row).toMatch(/totalGmEarnings/);
    expect(row).toMatch(/gmEarningsTotal/);
    expect(row).toMatch(/< 0\.01/);
  });
});

/**
 * R86 - the reset that manufactured reconciliation issues.
 *
 * "Reset All Data" deletes `wallettransactions`, `gamemasterearnings` and `incidents`, then
 * zeroes the wallet. It zeroed seven of the twelve lifetime counters, and the five it missed
 * are exactly the five declared on the model WITHOUT `required: true` - they were added after
 * this list was written and nobody extended it.
 *
 * Two of those five are equality-checked by the reconciliation route, so every reset left an
 * `incident_compensation_mismatch` and a `gm_earnings_mismatch` on every affected wallet, for
 * activity that no longer existed in any collection. A reset that produces reconciliation
 * issues is worse than one that refuses, because the issues look real.
 *
 * The guard reads the MODEL'S OWN numeric paths rather than a list of field names, because a
 * list is a third place to forget and would be green on the day a thirteenth counter is added.
 */
describe("R86: the wallet reset zeroes every counter the model declares", () => {
  const RESET_SERVICE = [
    "apps",
    "admin",
    "lib",
    "services",
    "user-data-reset.service.ts",
  ];

  /** The `$set` handed to `CreditWallet.updateMany`, and nothing else in the file. */
  function walletResetSet(source: string): string {
    const from = source.indexOf("CreditWallet.updateMany");
    expect(from, "the reset no longer calls CreditWallet.updateMany").toBeGreaterThan(-1);
    const to = source.indexOf("$unset", from);
    expect(to, "the reset $set is no longer followed by a $unset").toBeGreaterThan(from);
    const slice = source.slice(from, to);
    // A slice that found nothing passes everything asked of it.
    expect(slice.length).toBeGreaterThan(200);
    return slice;
  }

  it("zeroes every Number path on CreditWallet", () => {
    const set = walletResetSet(readCode(...RESET_SERVICE));

    const numericPaths = Object.entries(CreditWallet.schema.paths)
      .filter(([name, path]) => path.instance === "Number" && name !== "__v")
      .map(([name]) => name);

    // Sanity: if this drops to a handful the filter has stopped working and every
    // assertion below becomes trivially true.
    expect(numericPaths.length).toBeGreaterThanOrEqual(13);

    for (const path of numericPaths) {
      // Reason: the pattern is built from the field names the Mongoose schema itself
      // declares, which is the whole point - a hard-coded list is a third place to forget
      // a counter. Rule-scoped rather than the blanket disable, so anything else in this
      // file still gets linted.
      // eslint-disable-next-line security/detect-non-literal-regexp
      const zeroed = new RegExp(`\\b${path}:\\s*0\\b`);
      expect(set, `the reset leaves ${path} at its old value`).toMatch(zeroed);
    }
  });

  it("does not delete the wallets on the branch that zeroes them", () => {
    // The two branches are not interchangeable: "Reset All Users" removes wallets outright,
    // so it needs no counter list at all. A guard that cannot tell them apart would be
    // satisfied by the delete branch and say nothing about the one that resets.
    const source = readCode(...RESET_SERVICE);
    const from = source.indexOf("CreditWallet.updateMany");
    const before = source.slice(0, from);

    expect(before).toContain("opts.deleteAccounts");
    expect(walletResetSet(source)).not.toContain("deleteMany");
  });
});
