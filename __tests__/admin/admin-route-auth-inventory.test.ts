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
  HELPER_BY_DESIGN,
  READ_ONLY_PUBLIC,
  handlersAuthenticatingAfterAWrite,
  inventoryAdminRoutes,
  isAuthCarveOut,
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
 * 0 routes calling no authentication of any kind. Closed by R101m on 16 Sep 2026.
 * (Was 14 after R101l; the last fourteen singles and small clusters are now section-granted.)
 */
const NO_CHECK_OF_ANY_KIND = [] as const;

/**
 * 3 routes that verify a JWT by hand and then ask nothing about grants.
 */
// Reason: flipped empty 16 Sep 2026 (R101n). The three hand-verified routes are
// section-granted; keeping a non-empty list here would silently re-permit the class.
const HAND_VERIFIED_NO_GRANT = [] as const;

/**
 * 0 routes that authenticate with a helper and never ask which sections the caller
 * holds — as debt. (Was 9 after R101ac.) R101ad section-granted gamemaster/fix-purchases
 * and carved the remaining eight into HELPER_BY_DESIGN (3 admin-at-all + 5 Game Master
 * portal). Keeping a non-empty list here would silently re-permit real debt.
 */
const HELPER_BUT_NO_GRANT = [] as const;

/** Folders closed by R101a–R101aa. Nothing under these may appear in any debt list above. */
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
  "simulator",
  // Reason: nested under admin/; a bare "admin" entry would also demand grants on
  // badge-simulator / database / etc. which closed under different sections.
  "tests",
  "admin/end-logic-tests",
  "admin/trading-tests",
  // R101m. Singles and small clusters. admin/database for the same reason as the
  // admin/*-tests entries above. challenges/ covers the already-granted list route too.
  // (fraud/restrictions was listed here alone until R101r closed the whole fraud/ folder.)
  "check-database",
  "recover-stats",
  "test-badge-models",
  "admin/database",
  // R101r. Whole fraud/ folder - FraudMonitoringSection. user-status is dual-caller
  // (fraud|users) but still names fraud, so the folder walk holds.
  "fraud",
  "challenges",
  "market-status",
  "pexels",
  "action-terms",
  "server-monitor",
  "server-fleet",
  "diagnose-user",
  "sync-missing-users",
  "update-competition-status",
  // R101o. Money writers: FinancialDashboard → financial; PendingWithdrawalsSection →
  // pending-withdrawals. admin-bank-accounts deferred (dual company/pending-withdrawals callers).
  "admin-funds",
  "vat",
  "vendor-payments",
  "atlas",
  "withdrawals",
  // R101p. Clean money helpers. chargebacks/[id]/* closed in R101q (dual callers).
  "financial-dashboard",
  "financial-analytics",
  "deposits",
  "fee-settings",
  "complete-pending-payment",
  "withdrawal-settings",
  "credit-conversion",
  "chargebacks/lookup",
  // R101q. Dual-caller money + vendors. chargebacks/[id] covered by chargebacks/ prefix
  // after lookup; whole chargebacks/ tree is now section-granted.
  "admin-bank-accounts",
  "cancel-pending-payment",
  "vendors",
  "chargebacks",
  // R101s. Whole employees/ tree is section-granted (availability was already messaging;
  // GET /employees is dual-caller employees|users). reset-all is DatabaseSection.
  "employees",
  "admin/reset-all-employees",
  // R101t. invoices/ is financial|users (FinancialDashboard + UserFullDetailPanel /
  // TransactionDetailDialog). invoice-settings is invoices|financial (template section
  // + FinancialDashboard VAT preview).
  "invoices",
  "invoice-settings",
  // R101u. MarketplaceSection owns the whole marketplace/ tree (generate-cosmetic has no
  // UI caller today but shares the grant).
  "marketplace",
  // R101v. TutorialsSection owns the helpers; tutorials/videos/* stay public-by-design
  // (asset streamers) and are excluded from the closed-folder leak check below.
  "tutorials",
  // R101w. AIKnowledgeSection owns the whole ai-knowledge/ tree.
  "ai-knowledge",
  // R101x. SystemAnnouncementsSection → system-announcements (ADMIN_SECTIONS add-only).
  "announcements",
  // R101y. Settings cluster across seven top-level folders (see PROGRESS R101y).
  "settings",
  "challenge-settings",
  "company-settings",
  "hero-settings",
  "kyc-settings",
  "redis-settings",
  "mdb-cluster-settings",
  // R101aa. Ops / money / customer cluster. Dual-caller routes (assignments list,
  // reconciliation, transactions) use guardAnySection; the folder walk pins the shared
  // grant and the R101aa describe pins both. lockouts sits under fraud (FraudMonitoring
  // owns unlock/clear-all; GET/POST have no other caller).
  "customer-assignments",
  "customer-audit",
  "database",
  "email-templates",
  "incidents",
  "lockouts",
  "payment-providers",
  "platform-financials",
  "reconciliation",
  "transactions",
  // R101ab. Money leftovers + ops health + employee self. security/alerts is
  // dual-caller overview|fraud; employee/* is profile (self-service screen).
  "pending-payments",
  "payment-history",
  "live-ops",
  "health-overview",
  "price-health",
  "kyc-history",
  "notifications",
  "employee",
  "security",
  // R101ac. Clear helpers: ai-agent, settings leftovers, branding images (upload is
  // dual branding|landing-pages), server-options, data-cleanup/maintenance (ADMIN_SECTIONS
  // add-only), database resets, fraud debugger, users sync, challenges finalize, and
  // the two remaining Dev Zone helpers. Nested admin/backfill-ranks + admin/cleanup +
  // admin/reset-all-users listed explicitly so a bare "admin" entry is not required.
  "ai-agent",
  "audit-logs",
  "credentials",
  "environment",
  "cookie-consent",
  "images",
  "server-options",
  "admin/backfill-ranks",
  "admin/cleanup",
  "admin/reset-all-users",
  "reset-all-data",
  "debug-fraud",
  "gamification",
  "finalize-challenges",
  "dev-scripts",
  "dev-zone/dependency-check",
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
      Object.keys(PUBLIC_BY_DESIGN).length +
      Object.keys(HELPER_BY_DESIGN).length;

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

describe("R101ad - the helper-by-design carve-outs", () => {
  it("every carve-out still exists, and still carries its reason", () => {
    for (const [route, reason] of Object.entries(HELPER_BY_DESIGN)) {
      const found = findings.find((finding) => finding.route === route);
      expect(found, `${route} is carved out but no longer exists`).toBeDefined();
      expect(reason.length, `${route} has no reason`).toBeGreaterThan(30);
    }
  });

  it("refuses to excuse a carve-out that has since been section-granted", () => {
    // Reason: same ratchet as PUBLIC_BY_DESIGN — an exemption that outlives a grant is a lie.
    const guarded = Object.keys(HELPER_BY_DESIGN).filter((route) => {
      const finding = findings.find((entry) => entry.route === route);
      return finding?.klass === "section-granted";
    });

    expect(guarded).toEqual([]);
  });

  it("names exactly eight intentional leftovers and never fix-purchases", () => {
    // Reason: fix-purchases was the one of the nine that was real debt (admin repair under
    // a Game Master path). A carve-out that re-includes it undoes R101ad.
    expect(Object.keys(HELPER_BY_DESIGN).sort()).toEqual([
      "admin/events/poll/route.ts",
      "auth/logout/route.ts",
      "gamemaster/competitions/route.ts",
      "gamemaster/dashboard/route.ts",
      "gamemaster/earnings/route.ts",
      "gamemaster/link/route.ts",
      "gamemaster/referrals/route.ts",
      "verify-password/route.ts",
    ]);
    expect("gamemaster/fix-purchases/route.ts" in HELPER_BY_DESIGN).toBe(false);
  });

  it("fix-purchases is section-granted, not carved out", () => {
    expect(isAuthCarveOut("gamemaster/fix-purchases/route.ts")).toBe(false);
    expect(
      classifyRouteAuth(
        stripComments(
          readFileSync(
            join(ADMIN_API_ROOT, "gamemaster/fix-purchases/route.ts"),
            "utf8",
          ),
        ),
      ),
    ).toBe("section-granted");
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
      // Reason: closed folders may still hold PUBLIC_BY_DESIGN or HELPER_BY_DESIGN carve-outs.
      .filter((finding) => !isAuthCarveOut(finding.route))
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
    expect(read("check-database/route.ts")).toBe("section-granted");
    expect(read("messaging/settings/route.ts")).toBe("section-granted");
    expect(read("trading-history/export/route.ts")).toBe("section-granted");
    expect(read("trading-risk-settings/route.ts")).toBe("section-granted");
    expect(read("employees/availability/route.ts")).toBe("section-granted");
    expect(read("trigger-margin-check/route.ts")).toBe("section-granted");
    expect(read("withdrawals/route.ts")).toBe("section-granted");
    expect(read("admin-funds/route.ts")).toBe("section-granted");
    expect(read("atlas/refund/clawback/route.ts")).toBe("section-granted");
    expect(read("financial-dashboard/route.ts")).toBe("section-granted");
    expect(read("fee-settings/route.ts")).toBe("section-granted");
    expect(read("deposits/failed/route.ts")).toBe("section-granted");
    expect(read("chargebacks/route.ts")).toBe("section-granted");
    expect(read("chargebacks/lookup/route.ts")).toBe("section-granted");
    expect(read("fraud/alerts/route.ts")).toBe("section-granted");
    expect(read("fraud/user-status/route.ts")).toBe("section-granted");
    expect(read("fraud/suspicion-score/route.ts")).toBe("section-granted");
    expect(read("settings/route.ts")).toBe("section-granted");
    expect(read("settings/trading-risk/route.ts")).toBe("section-granted");
    expect(read("challenge-settings/route.ts")).toBe("section-granted");
    expect(read("company-settings/route.ts")).toBe("section-granted");
    expect(read("hero-settings/route.ts")).toBe("section-granted");
    expect(read("kyc-settings/route.ts")).toBe("section-granted");
    expect(read("redis-settings/route.ts")).toBe("section-granted");
    expect(read("mdb-cluster-settings/route.ts")).toBe("section-granted");
    expect(read("customer-assignments/route.ts")).toBe("section-granted");
    expect(read("customer-assignments/settings/route.ts")).toBe("section-granted");
    expect(read("database/backups/route.ts")).toBe("section-granted");
    expect(read("incidents/route.ts")).toBe("section-granted");
    expect(read("lockouts/route.ts")).toBe("section-granted");
    expect(read("payment-providers/route.ts")).toBe("section-granted");
    expect(read("platform-financials/backfill/route.ts")).toBe("section-granted");
    expect(read("reconciliation/route.ts")).toBe("section-granted");
    expect(read("transactions/export/route.ts")).toBe("section-granted");
    expect(read("gamemaster/fix-purchases/route.ts")).toBe("section-granted");
    expect(read("auth/logout/route.ts")).toBe("helper-no-grant");
    expect(read("gamemaster/dashboard/route.ts")).toBe("helper-no-grant");
  });
});
