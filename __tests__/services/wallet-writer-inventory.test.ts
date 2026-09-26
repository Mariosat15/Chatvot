/**
 * WALLET-BALANCE WRITER INVENTORY
 *
 * The R78-R86 sweep found the same defect nine separate times, in nine different
 * files, written by different people at different times: **a balance moved and the
 * ledger row explaining it did not get written.** R79 (admin challenge cancel),
 * R80 (`force_complete`), R83 (the early-end worker) and R85 (the Game Master fee
 * retry) are four faces of one mistake, and none of them was found by a test —
 * they were found by a human enumerating writers with ripgrep.
 *
 * That enumeration is what this file automates. It is deliberately NOT a
 * correctness test: no assertion here can tell a right amount from a wrong one.
 * It is a tripwire. Adding a wallet-balance writer anywhere in either app or the
 * worker turns it red, and the failure message says what the reviewer has to
 * check. The cost is that a legitimate new writer costs one line in the table
 * below; the alternative is that the tenth instance of this defect is found the
 * way the first nine were.
 *
 * WHY A COUNT RATHER THAN A FILE LIST. A file list is satisfied the day somebody
 * adds a second, unledgered `$inc` to a file that already had one — which is
 * exactly R85's shape, a new write landing beside an existing correct one. The
 * count is what makes a new site inside an existing file visible.
 *
 * WHY "MENTIONS A LEDGER" IS THE WEAK HALF. Every one of the 40 files below
 * mentions `WalletTransaction` today, so that clause proves nothing about the
 * code as it stands. It is here for the brand-new file that credits a wallet and
 * never mentions a transaction at all, where it turns a bare count mismatch into
 * a message naming the actual problem.
 */

import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "..", "..");

/** Directories scanned for wallet writers. */
const SCAN_ROOTS = ["app", "apps", "lib", "worker", "database", "api-server"];

const SKIP_DIRS = new Set([
  "node_modules",
  ".next",
  "dist",
  "build",
  ".git",
  "__tests__",
]);

/**
 * The two shapes a balance change takes in this codebase.
 *
 * `creditBalance: 0` on wallet CREATION is deliberately not one of them — it
 * moves no money and appears in half a dozen upsert paths. Pattern B requires an
 * assignment operator, and pattern A requires a `$inc`/`$set`, so a `{ userId,
 * creditBalance: 0 }` document literal matches neither.
 */
const WRITER_PATTERNS: readonly RegExp[] = [
  // $inc / $set blocks naming the balance. Non-greedy, brace-free body so it
  // cannot run past the end of the update object into an unrelated one.
  /\$(?:inc|set)\s*:\s*\{[^{}]*\bcreditBalance\b/g,
  // Direct assignment. `[^=>]` after `=` keeps `==`, `===` and `=>` out, and a
  // leading `\b` keeps `totalCreditBalance` out.
  /\bcreditBalance\s*(?:\+=|-=|=[^=>])/g,
];

/** Whether the file is in the ledger business at all. */
type LedgerClaim = "writes-ledger" | "no-ledger";

interface InventoryEntry {
  /** Repository-relative path, forward slashes. */
  readonly file: string;
  /** How many balance-writing sites the file holds today. */
  readonly writers: number;
  readonly ledger: LedgerClaim;
  /** Required when `ledger` is "no-ledger". Why this file legitimately has none. */
  readonly reason?: string;
}

/**
 * Every file in the platform that moves a credit balance.
 *
 * Adding a row is a normal part of building a money feature. What is not normal
 * is adding one without answering the question the R78-R86 sweep kept finding
 * unanswered: does this write also record a `WalletTransaction`, and does it
 * update the lifetime counter the reconciliation screen checks?
 */
const INVENTORY: readonly InventoryEntry[] = [
  // --- player app: entry, purchase, deposit, withdrawal ------------------------
  { file: "app/api/challenges/[id]/accept/route.ts", writers: 2, ledger: "writes-ledger" },
  { file: "app/api/gamemaster/renew/route.ts", writers: 1, ledger: "writes-ledger" },
  { file: "app/api/marketplace/purchase/route.ts", writers: 1, ledger: "writes-ledger" },
  { file: "app/api/nuvei/webhook/route.ts", writers: 2, ledger: "writes-ledger" },
  { file: "app/api/nuvei/withdrawal/route.ts", writers: 8, ledger: "writes-ledger" },
  { file: "app/api/wallet/withdraw/route.ts", writers: 1, ledger: "writes-ledger" },
  { file: "app/api/wallet/withdraw/[id]/cancel/route.ts", writers: 1, ledger: "writes-ledger" },

  // --- player app: simulator ---------------------------------------------------
  // Test-data seeding. It still writes ledger rows, because the reconciliation
  // screen is one of the things the simulator exists to exercise.
  { file: "app/api/simulator/competitions/join-batch/route.ts", writers: 1, ledger: "writes-ledger" },
  { file: "app/api/simulator/deposit/route.ts", writers: 1, ledger: "writes-ledger" },
  { file: "app/api/simulator/deposit-batch/route.ts", writers: 2, ledger: "writes-ledger" },
  { file: "app/api/simulator/payments/approve/route.ts", writers: 3, ledger: "writes-ledger" },

  // --- shared services: the settlement stages ---------------------------------
  { file: "lib/services/contest-entry.service.ts", writers: 1, ledger: "writes-ledger" },
  { file: "lib/services/settlement/prize-payout.service.ts", writers: 1, ledger: "writes-ledger" },
  { file: "lib/services/settlement/game-master-fees/distribute.ts", writers: 1, ledger: "writes-ledger" },
  { file: "lib/services/settlement/exclusion-refund.ts", writers: 1, ledger: "writes-ledger" },
  { file: "lib/services/settlement/unscored-refund.ts", writers: 1, ledger: "writes-ledger" },
  { file: "lib/services/withdrawal.service.ts", writers: 1, ledger: "writes-ledger" },
  { file: "lib/services/security/chargeback-case.writers.ts", writers: 1, ledger: "writes-ledger" },
  { file: "lib/actions/trading/competition-cancel.actions.ts", writers: 1, ledger: "writes-ledger" },
  { file: "lib/actions/trading/wallet.actions.ts", writers: 1, ledger: "writes-ledger" },

  // --- admin app: mirrored settlement stages ----------------------------------
  { file: "apps/admin/lib/services/settlement/prize-payout.service.ts", writers: 1, ledger: "writes-ledger" },
  { file: "apps/admin/lib/services/settlement/game-master-fees/distribute.ts", writers: 1, ledger: "writes-ledger" },
  { file: "apps/admin/lib/services/settlement/exclusion-refund.ts", writers: 1, ledger: "writes-ledger" },
  { file: "apps/admin/lib/services/settlement/unscored-refund.ts", writers: 1, ledger: "writes-ledger" },
  { file: "apps/admin/lib/services/withdrawal.service.ts", writers: 1, ledger: "writes-ledger" },
  // Two refund sites against the main app's one: the admin copy carries an
  // emergency-cancel path the player app has no route to. Recorded rather than
  // "fixed" - it is an extra capability, not drift in a shared rule.
  { file: "apps/admin/lib/actions/trading/competition-cancel.actions.ts", writers: 2, ledger: "writes-ledger" },
  { file: "apps/admin/lib/actions/trading/competition-end.actions.ts", writers: 1, ledger: "writes-ledger" },
  { file: "apps/admin/lib/actions/trading/wallet.actions.ts", writers: 1, ledger: "writes-ledger" },

  // --- admin app: operator-driven money -------------------------------------
  { file: "apps/admin/app/api/users/credit/route.ts", writers: 1, ledger: "writes-ledger" },
  { file: "apps/admin/app/api/challenges/route.ts", writers: 1, ledger: "writes-ledger" },
  { file: "apps/admin/app/api/competitions/[id]/adjust-results/route.ts", writers: 2, ledger: "writes-ledger" },
  { file: "apps/admin/app/api/complete-pending-payment/route.ts", writers: 1, ledger: "writes-ledger" },
  { file: "apps/admin/app/api/deposits/[id]/manual-complete/route.ts", writers: 1, ledger: "writes-ledger" },
  { file: "apps/admin/app/api/withdrawals/[id]/route.ts", writers: 2, ledger: "writes-ledger" },
  { file: "apps/admin/app/api/incidents/[id]/compensate/route.ts", writers: 1, ledger: "writes-ledger" },
  { file: "apps/admin/app/api/incidents/[id]/resolve/route.ts", writers: 1, ledger: "writes-ledger" },
  { file: "apps/admin/app/api/atlas/refund/clawback/route.ts", writers: 1, ledger: "writes-ledger" },

  // --- the two that legitimately write no ledger row --------------------------
  {
    file: "apps/admin/app/api/reconciliation/route.ts",
    writers: 1,
    ledger: "no-ledger",
    reason:
      "It repairs a wallet to agree with the ledger. A transaction row here would " +
      "change the figure it is reconciling against, so the repair could never converge. " +
      "R81 is why it may only ever raise a balance.",
  },
  {
    file: "apps/admin/lib/services/user-data-reset.service.ts",
    writers: 1,
    ledger: "no-ledger",
    reason:
      "Teardown of test data. It empties the ledger collections in the same call, so " +
      "there is nothing for a row to explain. R86 is why it must zero every numeric " +
      "path the model declares.",
  },
  {
    file: "worker/jobs/gamemaster-renewal.job.ts",
    writers: 1,
    ledger: "writes-ledger",
  },
];

// ---------------------------------------------------------------------------

function walk(dir: string, out: string[]): void {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = path.join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      walk(full, out);
    } else if (/\.(ts|tsx)$/.test(entry) && !entry.endsWith(".d.ts")) {
      out.push(full);
    }
  }
}

/**
 * Comments removed before matching.
 *
 * These files explain the defects in prose, so a comment quoting an `$inc` would
 * otherwise be counted as a writer - and worse, a real writer commented out
 * would still satisfy the count.
 */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

function countWriters(source: string): number {
  const code = stripComments(source);
  let total = 0;
  for (const pattern of WRITER_PATTERNS) {
    // Reason: the source comes from WRITER_PATTERNS, a literal array at the top of this
    // file; it is re-compiled only to add the global flag so every writer in a file is
    // counted rather than just the first. Rule-scoped, so the rest of the file still
    // gets linted.
    // eslint-disable-next-line security/detect-non-literal-regexp
    const global = new RegExp(pattern.source, "g");
    total += (code.match(global) || []).length;
  }
  return total;
}

/** file -> writer count, for every scanned file that has at least one. */
function scan(): Map<string, number> {
  const files: string[] = [];
  for (const root of SCAN_ROOTS) {
    const full = path.join(ROOT, root);
    try {
      if (statSync(full).isDirectory()) walk(full, files);
    } catch {
      // A root that does not exist in this checkout is not a failure.
    }
  }

  const found = new Map<string, number>();
  for (const file of files) {
    const count = countWriters(readFileSync(file, "utf8"));
    if (count > 0) {
      found.set(path.relative(ROOT, file).split(path.sep).join("/"), count);
    }
  }
  return found;
}

function mentionsLedger(file: string): boolean {
  const source = stripComments(readFileSync(path.join(ROOT, file), "utf8"));
  return /WalletTransaction|wallettransactions/i.test(source);
}

describe("wallet-balance writer inventory", () => {
  const found = scan();
  const inventory = new Map(INVENTORY.map((e) => [e.file, e]));

  it("finds the writers at all", () => {
    // Sanity, and it is not decoration: if a pattern stops matching or a scan
    // root is renamed, `found` empties and every assertion below passes
    // vacuously while the tripwire is switched off.
    expect(found.size).toBeGreaterThanOrEqual(35);
    let total = 0;
    for (const n of found.values()) total += n;
    expect(total).toBeGreaterThanOrEqual(40);
  });

  it("has no wallet-balance writer outside the inventory", () => {
    const unlisted = [...found.keys()].filter((f) => !inventory.has(f)).sort();

    expect(
      unlisted,
      [
        "These files move a credit balance and are not in the inventory in",
        "__tests__/services/wallet-writer-inventory.test.ts.",
        "",
        "Before adding them, answer the question the R78-R86 sweep kept finding",
        "unanswered nine times over:",
        "  1. does every balance change here also write a WalletTransaction row?",
        "  2. does it update the lifetime counter the reconciliation screen checks",
        "     (totalDeposited / totalWonFrom* / totalSpentOn* / totalRefunded / ...)?",
        "  3. if it can be retried, is the idempotency guard on the far side of the",
        "     money rather than in front of one artefact (R85)?",
        "",
        "Then add a row with the count, and a reason if it writes no ledger row.",
      ].join("\n"),
    ).toEqual([]);
  });

  it("has no stale inventory entry", () => {
    // A listed file that no longer writes a balance is worse than a missing one:
    // it reads as a reviewed, known writer for ever, and its count silently
    // stops protecting anything. Same reasoning as R60's offender canary.
    const gone = INVENTORY.map((e) => e.file)
      .filter((f) => !found.has(f))
      .sort();

    expect(
      gone,
      "These inventory entries no longer write a credit balance - delete the rows.",
    ).toEqual([]);
  });

  it("agrees with the codebase on how many writers each file has", () => {
    const drifted: string[] = [];
    for (const [file, count] of [...found.entries()].sort()) {
      const entry = inventory.get(file);
      if (entry && entry.writers !== count) {
        drifted.push(`${file}: inventory says ${entry.writers}, found ${count}`);
      }
    }

    expect(
      drifted,
      [
        "The number of balance-writing sites changed.",
        "",
        "A NEW site in a file that already had one is R85's exact shape - a write",
        "landing beside an existing correct one, inheriting none of its guards.",
        "Check the ledger row, the lifetime counter and the idempotency guard,",
        "then update the count.",
      ].join("\n"),
    ).toEqual([]);
  });

  it("only claims to write a ledger row where one is written", () => {
    const lying = INVENTORY.filter(
      (e) => e.ledger === "writes-ledger" && !mentionsLedger(e.file),
    ).map((e) => e.file);

    expect(
      lying,
      "These files move a balance and never name WalletTransaction - that is the R78-R86 defect.",
    ).toEqual([]);
  });

  it("gives a reason for every file that writes no ledger row", () => {
    for (const entry of INVENTORY) {
      if (entry.ledger === "no-ledger") {
        expect(
          entry.reason?.trim(),
          `${entry.file} is exempted from the ledger rule with no reason given`,
        ).toBeTruthy();
        expect((entry.reason ?? "").length).toBeGreaterThan(40);
      }
    }
  });
});
