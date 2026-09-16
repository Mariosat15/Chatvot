/**
 * R101d - the ratchet.
 *
 * The other guard suites here each defend a folder somebody has finished. This one defends the
 * whole admin API, and it is the difference between fixing a hundred endpoints and fixing the
 * reason there were a hundred: a `route.ts` added next month with no authorization lands in one
 * of the lists below and turns this red on the first run, before it is deployed rather than
 * during an audit a year later.
 *
 * WHY EXACT LISTS AND NOT A COUNT, given that `privileged-route-guards.test.ts` argues at
 * length against pinning a figure. That argument is right and this does not contradict it. The
 * number moved four times in two days - 100, 99, 97, 83 - and every move was the CLASSIFIER
 * learning rather than any code changing, so a pinned figure would fail on the day somebody
 * improved the scan and teach the next reader the suite is noise. A pinned LIST fails on the
 * same day and fails DIFFERENTLY: the diff names the routes that moved, so a reader can see in
 * one glance whether a route left because it was guarded, or merely moved bucket because the
 * scan got cleverer. A count cannot tell those apart, which is exactly how the arithmetic on
 * record came to be wrong twice.
 *
 * THE RATCHET TURNS BOTH WAYS, and that is deliberate. Guarding a route turns this red too,
 * and the fix is to delete its line - one word of diff, in the same commit as the guard, which
 * is the only moment anybody knows why. The alternative is a `toBeGreaterThan(0)` canary, and
 * the R60 rule says a test that states a known gap and passes is indistinguishable from the
 * gap having been closed.
 *
 * FOUR CLASSES, BECAUSE TWO WAS WRONG IN BOTH DIRECTIONS. Splitting "unguarded" into three
 * answers is the whole finding of R101d. Sixteen routes hand-verify a JWT, so they call no
 * helper and read as completely unguarded to a grep, while in fact refusing a forgery against
 * the real secret - more convincing than no check at all, and no better at the question that
 * matters. Ten more are meant to be public. So the figure on record, "78 files call no
 * authorization helper at all", was wrong in both directions at once: the honest statement is
 * 58 with no check of any kind, 15 that hand-verify without asking about grants, and 189 that
 * call a helper without asking about grants.
 *
 * TO REGENERATE: `npm run audit:admin-routes:list`. The tool imports the same classifier this
 * suite asserts against, so the two cannot drift - and a figure arrived at by a method nobody
 * can re-run is a figure nobody can check.
 */

import { readFileSync } from "fs";
import { join } from "path";

import { describe, expect, it } from "vitest";

import {
  ADMIN_API_ROOT,
  PUBLIC_BY_DESIGN,
  READ_ONLY_PUBLIC,
  handlersAuthenticatingAfterAWrite,
  inventoryAdminRoutes,
  routesOfClass,
} from "../../tools/admin-routes/auth-inventory";
import { classifyRouteAuth, stripComments } from "../helpers/route-guard-audit";

/**
 * 58 routes calling no authentication of any kind. R101c. Not one of them is
 * excused: each needs a decision about which grant owns the screen that calls it, which is an
 * owner question as much as a code one, and that is why they are frozen here rather than
 * swept in one commit.
 */
/**
 * 28 routes calling no authentication of any kind. Frozen rather than swept:
 * each needs a decision about which grant owns the screen that calls it.
 * (Was 33 after R101i; R101j moved the five pages/ no-check routes into section-granted.)
 */
const NO_CHECK_OF_ANY_KIND = [
  "action-terms/[slug]/route.ts",
  "admin/database/indexes/route.ts",
  "admin/end-logic-tests/cleanup/route.ts",
  "admin/end-logic-tests/run/route.ts",
  "admin/trading-tests/cleanup/route.ts",
  "admin/trading-tests/run/route.ts",
  "challenges/[id]/gm-info/route.ts",
  "check-database/route.ts",
  "diagnose-user/route.ts",
  "fraud/restrictions/route.ts",
  "market-status/route.ts",
  "pexels/route.ts",
  "recover-stats/route.ts",
  "server-fleet/route.ts",
  "server-monitor/route.ts",
  "simulator/ai/route.ts",
  "simulator/cleanup/route.ts",
  "simulator/config/route.ts",
  "simulator/run/[runId]/route.ts",
  "simulator/run/route.ts",
  "sync-missing-users/route.ts",
  "test-badge-models/route.ts",
  "tests/run/route.ts",
  "tests/runs/[runId]/route.ts",
  "tests/runs/route.ts",
  "tests/schedule/route.ts",
  "tests/suites/route.ts",
  "update-competition-status/route.ts",
] as const;

/**
 * 3 routes that verify a JWT by hand and then ask nothing about grants.
 */
const HAND_VERIFIED_NO_GRANT = [
  "employees/availability/route.ts",
  "trading-risk-settings/route.ts",
  "trigger-margin-check/route.ts",
] as const;

/**
 * 187 routes that authenticate with a helper and never ask which sections the caller
 * holds. (Was 189 after R101h; R101i moved market-settings/holidays and market-settings
 * into section-granted.)
 */
const HELPER_BUT_NO_GRANT = [
  "admin-bank-accounts/[id]/route.ts",
  "admin-bank-accounts/route.ts",
  "admin-funds/route.ts",
  "admin/backfill-ranks/route.ts",
  "admin/cleanup/run/route.ts",
  "admin/events/poll/route.ts",
  "admin/reset-all-employees/route.ts",
  "admin/reset-all-users/route.ts",
  "ai-agent/audit/route.ts",
  "ai-agent/chat/route.ts",
  "ai-agent/config/route.ts",
  "ai-knowledge/[id]/route.ts",
  "ai-knowledge/index-help/route.ts",
  "ai-knowledge/route.ts",
  "ai-knowledge/scrape/route.ts",
  "ai-knowledge/search/route.ts",
  "ai-knowledge/settings/route.ts",
  "ai-knowledge/upload/route.ts",
  "announcements/[id]/route.ts",
  "announcements/ai-generate/route.ts",
  "announcements/route.ts",
  "announcements/templates/[id]/route.ts",
  "announcements/templates/route.ts",
  "atlas/refund/clawback/route.ts",
  "atlas/refund/route.ts",
  "atlas/refunds/pending/route.ts",
  "audit-logs/route.ts",
  "auth/logout/route.ts",
  "cancel-pending-payment/route.ts",
  "challenge-settings/route.ts",
  "chargebacks/[id]/ai-narrative/route.ts",
  "chargebacks/[id]/attachments/[attachmentId]/route.ts",
  "chargebacks/[id]/attachments/route.ts",
  "chargebacks/[id]/complete/route.ts",
  "chargebacks/[id]/initiate/route.ts",
  "chargebacks/[id]/narrative/route.ts",
  "chargebacks/[id]/report/route.ts",
  "chargebacks/[id]/represented/route.ts",
  "chargebacks/[id]/route.ts",
  "chargebacks/[id]/withdrawn/route.ts",
  "chargebacks/[id]/won/route.ts",
  "chargebacks/lookup/route.ts",
  "chargebacks/route.ts",
  "company-settings/route.ts",
  "complete-pending-payment/route.ts",
  "cookie-consent/route.ts",
  "credentials/route.ts",
  "credit-conversion/route.ts",
  "customer-assignments/[customerId]/route.ts",
  "customer-assignments/route.ts",
  "customer-assignments/settings/route.ts",
  "customer-assignments/transfer/route.ts",
  "customer-audit/route.ts",
  "customer-audit/stats/route.ts",
  "database/backups/[id]/restore/route.ts",
  "database/backups/[id]/route.ts",
  "database/backups/route.ts",
  "debug-fraud/route.ts",
  "deposits/[id]/manual-complete/route.ts",
  "deposits/failed/route.ts",
  "dev-scripts/execute/route.ts",
  "dev-scripts/route.ts",
  "dev-zone/dependency-check/route.ts",
  "email-templates/route.ts",
  "employee/notifications/route.ts",
  "employee/profile/password/route.ts",
  "employee/profile/route.ts",
  "employees/[id]/route.ts",
  "employees/role-templates/route.ts",
  "employees/route.ts",
  "employees/upgrade-super-admin/route.ts",
  "environment/route.ts",
  "fee-settings/route.ts",
  "finalize-challenges/route.ts",
  "financial-analytics/route.ts",
  "financial-dashboard/route.ts",
  "fraud/ai-report/route.ts",
  "fraud/alerts/[id]/route.ts",
  "fraud/alerts/route.ts",
  "fraud/devices/actions/route.ts",
  "fraud/devices/route.ts",
  "fraud/history/route.ts",
  "fraud/history/user/[userId]/route.ts",
  "fraud/investigation/ban/route.ts",
  "fraud/investigation/dismiss/route.ts",
  "fraud/investigation/lift/route.ts",
  "fraud/investigation/open/route.ts",
  "fraud/investigation/suspend/route.ts",
  "fraud/manual-check/route.ts",
  "fraud/reset-alerts/route.ts",
  "fraud/resolve-users/route.ts",
  "fraud/settings/reset/route.ts",
  "fraud/settings/route.ts",
  "fraud/suspicion-score/route.ts",
  "fraud/unrestrict/route.ts",
  "fraud/update-restriction/route.ts",
  "fraud/user-status/route.ts",
  "gamemaster/competitions/route.ts",
  "gamemaster/dashboard/route.ts",
  "gamemaster/earnings/route.ts",
  "gamemaster/fix-purchases/route.ts",
  "gamemaster/link/route.ts",
  "gamemaster/referrals/route.ts",
  "gamification/sync-user/route.ts",
  "health-overview/route.ts",
  "hero-settings/route.ts",
  "hero-settings/upload/route.ts",
  "images/route.ts",
  "images/upload/route.ts",
  "incidents/[id]/compensate/route.ts",
  "incidents/[id]/resolve/route.ts",
  "incidents/[id]/route.ts",
  "incidents/route.ts",
  "invoice-settings/route.ts",
  "invoices/[id]/html/route.ts",
  "invoices/[id]/pdf/route.ts",
  "invoices/[id]/resend/route.ts",
  "invoices/[id]/route.ts",
  "invoices/[id]/view/route.ts",
  "invoices/by-transaction/route.ts",
  "invoices/export/route.ts",
  "invoices/route.ts",
  "kyc-history/route.ts",
  "kyc-settings/provider/route.ts",
  "kyc-settings/route.ts",
  "kyc-settings/scan-duplicates/route.ts",
  "kyc-settings/test/route.ts",
  "live-ops/route.ts",
  "lockouts/[email]/unlock/route.ts",
  "lockouts/clear-all/route.ts",
  "lockouts/route.ts",
  "marketplace/generate-content/route.ts",
  "marketplace/generate-cosmetic/route.ts",
  "marketplace/route.ts",
  "marketplace/save-defaults/route.ts",
  "marketplace/upload/route.ts",
  "mdb-cluster-settings/route.ts",
  "notifications/route.ts",
  "payment-history/route.ts",
  "payment-providers/[id]/route.ts",
  "payment-providers/auto-configure-webhook/route.ts",
  "payment-providers/regenerate-env/route.ts",
  "payment-providers/route.ts",
  "pending-payments/route.ts",
  "platform-financials/backfill/route.ts",
  "platform-financials/route.ts",
  "price-health/route.ts",
  "reconciliation/route.ts",
  "redis-settings/clear-cache/route.ts",
  "redis-settings/route.ts",
  "redis-settings/stats/route.ts",
  "redis-settings/test/route.ts",
  "redis-settings/websocket-reset/route.ts",
  "redis-settings/websocket-status/route.ts",
  "reset-all-data/route.ts",
  "security/alerts/route.ts",
  "server-options/apply-heap/route.ts",
  "server-options/heap-info/route.ts",
  "settings/route.ts",
  "settings/trading-risk/route.ts",
  "simulator/attack-tests/config/route.ts",
  "simulator/attack-tests/route.ts",
  "simulator/close-orphaned-positions/route.ts",
  "simulator/inspect-account/route.ts",
  "simulator/recompute-finished-stats/route.ts",
  "simulator/scan-duplicate-deposits/route.ts",
  "simulator/verify-win-loss/route.ts",
  "transactions/export/route.ts",
  "transactions/route.ts",
  "tutorials/[id]/route.ts",
  "tutorials/route.ts",
  "tutorials/upload/[sessionId]/chunk/route.ts",
  "tutorials/upload/[sessionId]/finalize/route.ts",
  "tutorials/upload/[sessionId]/route.ts",
  "tutorials/upload/init/route.ts",
  "tutorials/youtube/route.ts",
  "vat/route.ts",
  "vendor-payments/route.ts",
  "vendors/[id]/mark-paid/route.ts",
  "vendors/route.ts",
  "verify-password/route.ts",
  "withdrawal-settings/route.ts",
  "withdrawals/[id]/approve/route.ts",
  "withdrawals/[id]/complete/route.ts",
  "withdrawals/[id]/reject/route.ts",
  "withdrawals/[id]/route.ts",
  "withdrawals/route.ts",
] as const;

/** Folders closed by R101a–R101j. Nothing under these may appear in any debt list above. */
const CLOSED_FOLDERS = [
  "users",
  "ai",
  "badges",
  "journey-map",
  "journey",
  "trading-history",
  "messaging",
  "visitors",
  "landing-pages",
  "market-data",
  "symbols",
  "market-settings",
  "pages",
];

const findings = inventoryAdminRoutes();

describe("R101d - the admin API authorization inventory", () => {
  it("classifies every route into exactly one of the four classes", () => {
    /*
      A sanity check on the instrument, and the first line is the load-bearing half: a scan
      that silently found nothing - a moved API root, a `findRouteFiles` that stopped
      recursing - would leave every list "equal" to an empty result and the whole suite green
      over an unexamined tree. That is the shape that made the `native-select-legibility`
      guard pass over forty files it had never looked at.

      IT IS NOT A GUARD AGAINST MISCLASSIFICATION, and the comment here said it was until a
      probe disproved it. A classifier answering "section-granted" for every route empties the
      three debt lists and grows the fourth by exactly as much, so the total is unchanged and
      this assertion passes - it is a PARTITION check, which is invariant under moving routes
      between buckets. The property it was credited with lives in the re-derivation control at
      the foot of this file, which reads the answer back out of the source. Left overstated it
      would have been the worst kind of wrong fact: a test everybody believes covers the one
      failure that would make every other test here vacuous.
    */
    expect(findings.length).toBeGreaterThan(300);

    const total =
      routesOfClass(findings, "no-check").length +
      routesOfClass(findings, "hand-verified-no-grant").length +
      routesOfClass(findings, "helper-no-grant").length +
      routesOfClass(findings, "section-granted").length +
      Object.keys(PUBLIC_BY_DESIGN).length;

    expect(total).toBe(findings.length);
  });

  it("the routes with no check of any kind are exactly the recorded list", () => {
    expect(routesOfClass(findings, "no-check")).toEqual([
      ...NO_CHECK_OF_ANY_KIND,
    ]);
  });

  it("the routes that hand-verify a token are exactly the recorded list", () => {
    /*
      Kept separate from the list above rather than merged into it, because the remedy differs.
      A route with no check needs a decision about which grant owns it; these already know who
      the caller is and need only to ask what that caller may reach. Merging them would hide
      the cheaper half of R101c inside the harder one.
    */
    expect(routesOfClass(findings, "hand-verified-no-grant")).toEqual([
      ...HAND_VERIFIED_NO_GRANT,
    ]);
  });

  it("the routes that authenticate without a grant are exactly the recorded list", () => {
    expect(routesOfClass(findings, "helper-no-grant")).toEqual([
      ...HELPER_BUT_NO_GRANT,
    ]);
  });

  it("no handler authenticates only after it has written to the database", () => {
    /*
      THE ONE ASSERTION HERE THAT IS ABOUT SEVERITY RATHER THAN BOOKKEEPING. A helper called
      after the write has already let the write happen, so such a route is not weakly guarded -
      it is open, while sitting in the middle class and reviewing as careful. `users/edit` was
      exactly this, and it is why reading the classifier's output would never have found it.

      PROVEN ABLE TO FIRE, which matters more than it being green: run against `87d13897`, the
      revision before R101a, the same function reports three - `users/edit#PATCH`,
      `users/credit#POST` and `users/delete#DELETE`. So the ordering fault was never unique to
      the route that was reported; it was all three of the identity and money routes, and
      R101a and R101b together removed every instance in the tree.
    */
    expect(handlersAuthenticatingAfterAWrite()).toEqual([]);
  });
});

describe("R101d - the public-by-design carve-outs", () => {
  it("every carve-out still exists, and still carries its reason", () => {
    /*
      A carve-out whose route has been deleted is a line that excuses nothing and reads as
      though it excuses something, and the next person to add a route at that path inherits an
      exemption nobody granted. The reason is asserted because an unexplained carve-out is
      indistinguishable from a route somebody could not be bothered to guard.
    */
    for (const [route, reason] of Object.entries(PUBLIC_BY_DESIGN)) {
      const found = findings.find((finding) => finding.route === route);
      expect(found, `${route} is carved out but no longer exists`).toBeDefined();
      expect(reason.length, `${route} has no reason`).toBeGreaterThan(30);
    }
  });

  it("refuses to excuse a carve-out that has since been guarded", () => {
    /*
      The ratchet applied to the judgement list. If somebody guards one of these - and several
      are arguable - the exemption must go with it, or the list slowly becomes a record of
      opinions held in September rather than of what the code does.
    */
    const guarded = Object.keys(PUBLIC_BY_DESIGN).filter((route) => {
      const finding = findings.find((entry) => entry.route === route);
      return finding?.klass === "section-granted";
    });

    expect(guarded).toEqual([]);
  });

  it("the asset and video routes are read-only", () => {
    /*
      The load-bearing half of the asset carve-out. Those files serve bytes we already store
      and each of them also calls `writeFile`, which is a disk restore of something already in
      our own database - safe only while the route cannot be asked to do anything but read. A
      `POST` or `PUT` added to one turns an unauthenticated reader into an unauthenticated
      upload, and it would review as a small addition to a file already marked public.
    */
    for (const route of READ_ONLY_PUBLIC) {
      const finding = findings.find((entry) => entry.route === route);
      expect(finding?.methods, route).toEqual(["GET"]);
    }
  });
});

describe("R101d - the folders already closed stay closed", () => {
  it("no route under a closed folder is anything but section-granted", () => {
    /*
      The assertion that outlives the lists. Those folders are finished, so a route under any
      of them without a grant is a regression rather than inherited debt - and it is the exact
      defect `users/edit` shipped with, which a per-file allow-list would have let through on
      the day it appeared.

      IT READS THE LIVE SCAN AND DELIBERATELY NOT THE FROZEN LISTS ABOVE, and that distinction
      was found by a green probe rather than by review. Written against the constants it is a
      tautology at every commit: taking the grant off `users/presence` moves it in the SCAN,
      while the hand-written list it was being compared against of course still does not
      mention it - so the regression is invisible until somebody regenerates, which is the one
      moment they were going to look anyway. The general form is that a ratchet's frozen list
      can only ever report debt somebody has already written down, so anything asserting a
      property of the code rather than of the record has to go round it.
    */
    const leaked = findings
      .filter((finding) =>
        CLOSED_FOLDERS.some((folder) => finding.route.startsWith(`${folder}/`)),
      )
      .filter((finding) => finding.klass !== "section-granted")
      .map((finding) => `${finding.route} [${finding.klass}]`);

    expect(leaked).toEqual([]);
  });

  it("reads the same answer from the classifier as from the files themselves", () => {
    /*
      A control on the shared classifier, aimed at the one way this whole suite could be
      vacuous: `inventoryAdminRoutes` and `classifyRouteAuth` both live in code this suite
      imports, so a classifier that answered "section-granted" for everything would make every
      list empty and every assertion trivially true. Re-deriving a handful of known answers
      from the source keeps that honest.
    */
    const read = (route: string) =>
      classifyRouteAuth(
        stripComments(readFileSync(join(ADMIN_API_ROOT, route), "utf8")),
      );

    expect(read("users/edit/route.ts")).toBe("section-granted");
    expect(read("badges/route.ts")).toBe("section-granted");
    expect(read("check-database/route.ts")).toBe("no-check");
    expect(read("messaging/settings/route.ts")).toBe("section-granted");
    expect(read("trading-history/export/route.ts")).toBe("section-granted");
    expect(read("trading-risk-settings/route.ts")).toBe("hand-verified-no-grant");
    expect(read("withdrawals/route.ts")).toBe("helper-no-grant");
  });
});
