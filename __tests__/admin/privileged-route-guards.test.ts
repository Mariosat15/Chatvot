/**
 * The admin routes that grant privilege or decide what a player can achieve must refuse an
 * unauthenticated caller BEFORE they write.
 *
 * WHAT WAS WRONG (R101a). `PATCH /api/users/edit` had no authorization of any kind and `role`
 * is one of the fields it sets, with `"admin"` a valid value - so anybody who could reach the
 * admin app's origin could promote themselves. The file's only mention of a session was
 * `getAdminSession()` for the audit log, called AFTER the update, inside a `try/catch` that
 * swallowed the failure, under an `if (admin)` that skipped the entry when there was no
 * session. So the one artefact an operator would look at for evidence was suppressed by
 * exactly the condition that made the request illegitimate. That is worse than no logging:
 * an unauthorized edit left less trace than an authorized one.
 *
 * WHY THE GAMIFICATION CLUSTER IS IN THE SAME SUITE. `POST /api/badges` writes a badge's
 * `condition`, which is the rule deciding who earns it, and the journey routes write the
 * milestone map. None of it moves money, and that is the point worth stating: an anonymous
 * caller could not pay themselves, but they could change what every player on the platform is
 * working towards, and nothing about the resulting documents distinguishes them from an
 * operator's own edits. It is also the data R96 is about to widen, so leaving it anonymously
 * writable while carefully making the gate game-aware would have been fixing the lock on an
 * open door.
 *
 * HOW IT WAS FOUND, which is the part that generalises and is now the tenth instance:
 * **counting exported handlers against guards** across the whole `apps/admin/app/api` tree,
 * never by reading routes. Every neighbour having *something* is precisely what carries a
 * reader past the file that has nothing - the same method as R40's `finalize-old-competitions`,
 * R47's `sync-referrals`, R51's five AI routes and R57's image optimizer.
 *
 * NO ATTRIBUTION EXISTS. A route with no guard records no actor, so whether any of this was
 * ever called is unanswerable. Nothing was backfilled, and the absence of evidence is not
 * reassurance.
 *
 * The rules these assertions rest on live in `__tests__/helpers/route-guard-audit.ts` and are
 * imported rather than restated - see that file's header for why.
 */

import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { ADMIN_SECTIONS } from "../../apps/admin/database/models/admin-employee.model";
import {
  inventoryAdminRoutes,
  routesOfClass,
} from "../../tools/admin-routes/auth-inventory";
import {
  findRouteFiles,
  guardCallPattern,
  guardedSections,
  handlerPattern,
  handlerSlices,
  stripComments,
} from "../helpers/route-guard-audit";

const API = join(process.cwd(), "apps", "admin", "app", "api");

/** One refusal per guard. A guard whose result is discarded reads perfectly and authorizes nothing. */
function refusalPattern(): RegExp {
  return /if\s*\(\s*!\s*\w+\.ok\s*\)\s*return\s+\w+\.response/g;
}

function read(...segments: string[]): string {
  return stripComments(readFileSync(join(API, ...segments), "utf8"));
}

/**
 * Every folder closed by R101a, with the section each is granted by.
 *
 * Listed as folders rather than files on purpose: `findRouteFiles` walks each one, so a
 * `route.ts` added under any of them - a new dynamic segment, a new sub-action - is covered on
 * the day it appears rather than on the day somebody remembers to extend a list. That is the
 * read-the-directory rule applied at the only level where it still leaves the *section*
 * assertable, which a whole-tree walk cannot do.
 */
const CLOSED_FOLDERS: { folder: string[]; section: string }[] = [
  /*
    R101b widened this from `users/edit` to the whole `users` tree, and the widening rather
    than the addition is the point: every one of the nineteen `route.ts` files under it is
    fetched from `UsersSection` or `UserFullDetailPanel`, so `users` is the section that owns
    the calling screen for all of them, and a folder entry covers a twentieth on the day it
    appears. Listing `users/edit` separately would now be the weaker statement.
  */
  { folder: ["users"], section: "users" },
  { folder: ["badges"], section: "badges" },
  { folder: ["trigger-badge-evaluation"], section: "badges" },
  { folder: ["journey-map"], section: "journey-map" },
  { folder: ["journey-milestones"], section: "journey-map" },
  { folder: ["journey-progress"], section: "journey-map" },
  { folder: ["journey"], section: "journey-map" },
  { folder: ["admin", "whitelabel-defaults"], section: "settings" },
  { folder: ["admin", "badge-simulator"], section: "badges" },
  { folder: ["admin", "milestone-simulator"], section: "journey-map" },
  /*
    R101c. Grants come from the calling screen, never from a guess about the data:
    TradingHistorySection → trading-history; MessagingSection → messaging;
    MessagingSettingsSection → messaging-settings. Settings is listed as its own folder
    entry because a walk of `messaging/` would otherwise demand the inbox grant on the
    settings route and fail on correct code. Conversations / employees / assigned-customers
    are the three subtrees the inbox owns; listing them separately is the same unit as
    the folder - a new route.ts under any of them is covered.
  */
  { folder: ["trading-history"], section: "trading-history" },
  { folder: ["messaging", "settings"], section: "messaging-settings" },
  { folder: ["messaging", "assigned-customers"], section: "messaging" },
  { folder: ["messaging", "employees"], section: "messaging" },
  { folder: ["messaging", "conversations"], section: "messaging" },
  /*
    R101e. VisitorAnalyticsSection → visitors. Four files, six handlers: the list/live reads
    and the block / clear writers. The writers are why the folder went first among the
    remaining no-check debt - block and clear destroy or create records anonymously.
  */
  { folder: ["visitors"], section: "visitors" },
  /*
    R101f. LandingPagesSection → landing-pages. Seven files, ten handlers: CRUD, templates,
    AI generation, analytics, export and the clear writer. Clear deletes every visit record
    and zeroes counters, which is why the folder went next among the remaining writers.
  */
  { folder: ["landing-pages"], section: "landing-pages" },
  /*
    R101g. MarketDataSection → market-data. Six files, eleven handlers: settings, stats,
    cleanup, seed, gap-fill and download-history. Cleanup / seed / gap-fill / download are
    the writers that put the folder next - they delete or rewrite candle collections.
  */
  { folder: ["market-data"], section: "market-data" },
  /*
    R101h. SymbolsSection → symbols. Three files, seven handlers: list/create/bulk-update,
    sync, and per-symbol GET/PUT/DELETE. Sync and the writers rewrite the live symbol
    catalogue anonymously.
  */
  { folder: ["symbols"], section: "symbols" },
  /*
    R101i. MarketSettingsSection → market. Four files, nine handlers: settings GET/PUT,
    holidays GET/POST/DELETE, template-holidays GET/POST/DELETE, and automatic-holidays GET.
    The writers rewrite holiday calendars and trading-hours settings anonymously.
  */
  { folder: ["market-settings"], section: "market" },
  /*
    R101j. SitePagesSection → site-pages. Five files, eight handlers: list/create,
    per-slug GET/PUT/DELETE, generate, generate-risk-disclaimer, and save-defaults.
    LandingPageBuilder and FooterSectionEditor also call these routes; that is reaching
    into site-pages data, so the grant stays site-pages rather than hero-page.
  */
  { folder: ["pages"], section: "site-pages" },
  /*
    R101k. PerformanceSimulatorSection → performance-simulator. Twelve files, twenty-one
    handlers across the whole simulator/ tree: run control, cleanup, config, AI, attack
    suite, and the data-integrity tools (AttackSuitePanel and DataIntegrityTab mount on
    the same screen, so they share the grant).
  */
  { folder: ["simulator"], section: "performance-simulator" },
  /*
    R101l. Same screen, three more folders: UnitTestsTab → tests/, EndLogicTestsTab →
    admin/end-logic-tests/, TradingTestsTab → admin/trading-tests/. Nine files, twelve
    handlers. test-badge-models is a different caller and stays outside this slice.
  */
  { folder: ["tests"], section: "performance-simulator" },
  { folder: ["admin", "end-logic-tests"], section: "performance-simulator" },
  { folder: ["admin", "trading-tests"], section: "performance-simulator" },
  /*
    R101m. The last fourteen no-check routes, each granted from its calling screen (or the
    closest screen when the route is an orphan diagnostic). admin/database/indexes mounts
    inside PerformanceSimulatorSection, not DatabaseSection - calling-screen rule, not
    folder-name rule. server-fleet needed an ADMIN_SECTIONS entry before its guard could
    name the screen. challenges/ covers both the already-granted list route and gm-info.
  */
  { folder: ["check-database"], section: "database" },
  { folder: ["recover-stats"], section: "database" },
  { folder: ["test-badge-models"], section: "database" },
  { folder: ["admin", "database"], section: "performance-simulator" },
  { folder: ["fraud"], section: "fraud" },
  { folder: ["challenges"], section: "challenges" },
  { folder: ["market-status"], section: "competitions" },
  { folder: ["pexels"], section: "landing-pages" },
  { folder: ["action-terms"], section: "users" },
  { folder: ["server-monitor"], section: "server-monitor" },
  { folder: ["server-fleet"], section: "server-fleet" },
  { folder: ["diagnose-user"], section: "users" },
  { folder: ["sync-missing-users"], section: "users" },
  { folder: ["update-competition-status"], section: "competitions" },
  /*
    R101n. The three hand-verified-token routes. Availability is under MessagingSection
    (messaging grant) - scoped to employees/availability so the rest of employees/ could
    close separately. Risk settings and the orphan margin-check trigger share
    TradingRiskSection's trading-risk grant.
  */
  { folder: ["employees", "availability"], section: "messaging" },
  { folder: ["trading-risk-settings"], section: "trading-risk" },
  { folder: ["trigger-margin-check"], section: "trading-risk" },
  /*
    R101s. EmployeesSection → employees for [id], role-templates, upgrade-super-admin.
    employees/route.ts is dual-caller (GET also from UsersSection / TransferCustomerDialog)
    so it is asserted in the R101s describe rather than here. DatabaseSection → database
    for the destructive reset-all-employees control.
  */
  { folder: ["employees", "[id]"], section: "employees" },
  { folder: ["employees", "role-templates"], section: "employees" },
  { folder: ["employees", "upgrade-super-admin"], section: "employees" },
  { folder: ["admin", "reset-all-employees"], section: "database" },
  /*
    R101t. Invoice data is dual-caller financial|users (FinancialDashboard +
    UserFullDetailPanel / TransactionDetailDialog). CLOSED_FOLDERS demands one section
    per walk — financial is the shared half; users is asserted in the R101t describe.
    invoice-settings is invoices|financial (InvoiceTemplateSection + FinancialDashboard).
  */
  { folder: ["invoices"], section: "financial" },
  { folder: ["invoice-settings"], section: "invoices" },
  /*
    R101u. MarketplaceSection → marketplace for the whole tree. generate-cosmetic has no
    UI caller today; still section-granted so an unguarded sibling cannot reappear.
  */
  { folder: ["marketplace"], section: "marketplace" },
  /*
    R101o. Money writers first among helper-but-no-grant. FinancialDashboard → financial
    (admin-funds, vat, vendor-payments, atlas/*); PendingWithdrawalsSection →
    pending-withdrawals (withdrawals/). admin-bank-accounts deferred - dual callers on
    company-settings and pending-withdrawals, grant decision needed.
  */
  { folder: ["admin-funds"], section: "financial" },
  { folder: ["vat"], section: "financial" },
  { folder: ["vendor-payments"], section: "financial" },
  { folder: ["atlas"], section: "financial" },
  { folder: ["withdrawals"], section: "pending-withdrawals" },
  /*
    R101p. Clean single-caller money helpers. chargebacks/[id]/* closed in R101q
    (guardAnySection) — not listed here because the folder mixes users-only lookup
    with dual-caller case routes and CLOSED_FOLDERS demands one section per walk.
  */
  { folder: ["financial-dashboard"], section: "financial" },
  { folder: ["financial-analytics"], section: "financial" },
  { folder: ["deposits"], section: "failed-deposits" },
  { folder: ["fee-settings"], section: "fees" },
  { folder: ["complete-pending-payment"], section: "payments" },
  { folder: ["withdrawal-settings"], section: "withdrawals" },
  { folder: ["credit-conversion"], section: "currency" },
  { folder: ["chargebacks", "lookup"], section: "users" },
  /*
    R101q. Dual-caller money + vendors section. Bank accounts: CompanyDetailsSection
    (company) OR PendingWithdrawalsSection (pending-withdrawals). Cancel: FailedDeposits
    OR PendingPayments. Vendors needed an ADMIN_SECTIONS entry before it could be named.
    chargebacks/[id] is asserted in the R101q describe (both grants required).
  */
  { folder: ["admin-bank-accounts"], section: "company" },
  { folder: ["cancel-pending-payment"], section: "failed-deposits" },
  { folder: ["vendors"], section: "vendors" },
];

describe("R101a - every handler in the closed folders is guarded, per handler", () => {
  for (const { folder, section } of CLOSED_FOLDERS) {
    const dir = join(API, ...folder);
    const files = findRouteFiles(dir);
    const label = folder.join("/");

    it(`${label}: the walk finds routes at all`, () => {
      // A directory walk returning [] is indistinguishable from every file being correct, and
      // a test that examines nothing passes.
      expect(files.length).toBeGreaterThan(0);
    });

    for (const file of files) {
      const name = file.slice(API.length + 1).replace(/\\/g, "/");
      const code = stripComments(readFileSync(file, "utf8"));

      it(`${name}: one guard and one refusal for every exported handler`, () => {
        /*
          Counted per handler, and the refusals counted against the guards rather than merely
          matched. Both halves cost a green probe elsewhere in these suites: a file whose POST
          is guarded and whose GET is not passes any check that asks whether the FILE mentions
          a guard, and a whole-file `toMatch` for the refusal stays green when one handler's is
          deleted because a sibling still has one.
        */
        const handlers = code.match(handlerPattern()) ?? [];
        const guards = code.match(guardCallPattern()) ?? [];
        const refusals = code.match(refusalPattern()) ?? [];

        expect(handlers.length).toBeGreaterThan(0);
        expect(guards.length).toBeGreaterThanOrEqual(handlers.length);
        expect(refusals.length).toBeGreaterThanOrEqual(guards.length);
      });

      it(`${name}: guards every handler with the section that reveals its screen`, () => {
        /*
          `guardSection` is typed to `AdminSection`, so the compiler already refuses an invented
          id. What it cannot see is an id that exists and is WRONG - naming `settings` on the
          badge routes would compile, review as plausible, and issue a grant to the wrong set
          of employees. Asserted per handler slice rather than as a set over the file, so a
          route that guards three handlers correctly and the fourth with a neighbouring section
          cannot hide behind its siblings.
        */
        for (const { method, body } of handlerSlices(code)) {
          expect(
            guardedSections(body),
            `${name} ${method} does not name ${section}`,
          ).toContain(section);
        }
      });

      it(`${name}: refuses before it reads the request body`, () => {
        /*
          Position, not presence. A guard below `await request.json()` still refuses, but the
          route has parsed an unauthenticated caller's body by then. Sliced per handler because
          a file-wide `search` returns the first match anywhere: a file whose GET guards first
          and whose PATCH reads its body before guarding passes the whole-file form while being
          exactly the defect this forbids.
        */
        for (const { method, body } of handlerSlices(code)) {
          const bodyAt = body.search(/await\s+request\.json\(\)/);
          if (bodyAt === -1) continue;

          const guardAt = body.search(guardCallPattern());
          expect(guardAt, `${name} ${method} has no guard`).toBeGreaterThan(-1);
          expect(guardAt, `${name} ${method} guards after the body`).toBeLessThan(bodyAt);
        }
      });
    }
  }

  it("names only real sections", () => {
    for (const { section } of CLOSED_FOLDERS) {
      expect(ADMIN_SECTIONS as readonly string[]).toContain(section);
    }
  });
});

describe("R101a - the privilege-escalation route", () => {
  const code = read("users", "edit", "route.ts");

  it("guards the PATCH before the database update, not merely before the response", () => {
    /*
      THE ASSERTION THAT ACTUALLY MATTERS, and it is stated separately from the body check
      above because a guard could sit after `request.json()` and still be before the update -
      a real but far smaller defect than the one this pins. `role` is settable here and
      "admin" is a valid value, so an unguarded write is a grant of administrator.
    */
    const patchAt = code.indexOf("export async function PATCH");
    expect(patchAt).toBeGreaterThan(-1);

    const patch = code.slice(patchAt);
    // A slice that found the wrong thing passes everything asked of it.
    expect(patch.length).toBeGreaterThan(400);

    const guardAt = patch.search(guardCallPattern());
    expect(guardAt).toBeGreaterThan(-1);

    for (const write of ["updateOne(", "updateData"]) {
      const at = patch.indexOf(write);
      expect(at, `${write} not found in the PATCH handler`).toBeGreaterThan(-1);
      expect(guardAt).toBeLessThan(at);
    }
  });

  it("no longer treats the audit-log session lookup as its authorization", () => {
    /*
      `getAdminSession` is gone from this file entirely, and its ABSENCE is the load-bearing
      half. Left in place beside the new guard it would be harmless and would also be the
      shape the defect wore: a session read whose failure is swallowed, which reads to a
      reviewer as an authorization check and performs none. Fifth instance of a comment or a
      call asserting authorization that never ran, after Prerequisite A, the internal-secret
      fallbacks, the suspicion-score route and `requireAdminAuth`.
    */
    expect(code).not.toMatch(/getAdminSession\s*\(/);
  });

  it("attributes the audit entry to the guard's admin, unconditionally", () => {
    /*
      The audit entry used to sit under `if (admin)`, so the one request that most needed
      recording was the one that recorded nothing. The actor now comes from the guard, which
      has already refused every caller without a session - so there is no longer a path on
      which the update succeeds and the entry is silently skipped.

      Asserted as the guard's admin reaching the logger rather than as the absence of the
      `if`, because the absence is satisfied by a file that logs nothing at all.
    */
    expect(code).toMatch(/logUserUpdated\s*\(/);
    expect(code).toMatch(/guard\.admin\.id/);
    expect(code).toMatch(/guard\.admin\.email/);
  });

  it("refuses a non-string userId rather than merely a missing one", () => {
    /*
      `{ id: userId }` with an OBJECT value is a query operator rather than a value, so
      `{"$ne":null}` matches the first user in the collection - and `!userId` is true for no
      object, so the presence check this route already had cannot stand in for the type check.
      Fourth instance of a request-supplied value reaching a query or a lookup unchecked,
      after the round-inspector action map, the contest-edit field list and the Game Master
      allow-list.
    */
    expect(code).toMatch(/typeof\s+userId\s*!==\s*["'`]string["'`]/);
  });
});

describe("R101b - the five live bypasses under users/", () => {
  /*
    WHAT WAS WRONG. Four of these had no authorization of any kind and the fifth had a
    hand-rolled one. `POST /api/users/credit` created a wallet if absent, moved its balance by
    any amount and wrote the matching `WalletTransaction` - so an anonymous caller could credit
    or debit any player, with a full ledger trail and no real actor on it. `DELETE
    /api/users/delete` erased an account across some twenty collections and then POSTed to the
    player app's leaderboard cache invalidation with `INTERNAL_API_SECRET || "simulator-cleanup"`,
    so the erasure reached across the process boundary too. `GET /api/users` returned the whole
    player base with wallet balances, transaction aggregates, marketplace purchases and
    restrictions attached, and `GET /api/users/[userId]/history` assembled one player's entire
    life on the platform from an id in the URL - the two widest anonymous reads in the app.

    `GET /api/users/[userId]/conversations` is the one worth stating separately, because it did
    not look like a gap: it verified the `admin_token` signature with a bare `jsonwebtoken`
    `verify()`. That authenticates the token and nothing else - no employee lookup, so a token
    belonging to a deactivated employee passed until it expired, and no section grant was
    consulted at all. A FIFTH auth pattern, and the one that would survive any audit that
    greps for the four known helper names.

    HOW THEY WERE FOUND: counting exported handlers against guards, folder by folder, which is
    also how R40, R47, R51, R57 and R101a surfaced. Reading the routes would not have done it -
    the folder's other fourteen files all authenticate somehow, and that is precisely what
    carries a reader past the ones that do not.

    NO ATTRIBUTION EXISTS for any of them, so whether they were ever called is unanswerable.
    Nothing was backfilled: for the reads there is nothing to backfill, and for the two writers
    the resulting documents are indistinguishable from an operator's own.
  */

  it("credit refuses before it touches a wallet", () => {
    /*
      Position against the writes, not presence of a guard. The handler reaches for the wallet
      three ways - find, create, save - and the transaction after that, so each is asserted
      rather than the first one found.
    */
    const code = read("users", "credit", "route.ts");
    const guardAt = code.search(guardCallPattern());
    expect(guardAt).toBeGreaterThan(-1);

    for (const write of ["CreditWallet", "WalletTransaction"]) {
      const at = code.indexOf(write, guardAt);
      expect(at, `${write} not found after the guard`).toBeGreaterThan(-1);
    }
    // The guard must precede the FIRST mention of either, not merely some mention.
    for (const write of ["CreditWallet.findOne", "new WalletTransaction"]) {
      const at = code.indexOf(write);
      if (at === -1) continue;
      expect(guardAt, `credit writes ${write} before guarding`).toBeLessThan(at);
    }
  });

  it("credit refuses a non-finite amount, not merely a zero one", () => {
    /*
      `!amount || amount === 0` was the whole check, so a string "50" reached the arithmetic
      and `NaN` or `Infinity` reached a required Number path - and a wallet balance that has
      become NaN fails every comparison downstream while nothing checks. R31's rule one field
      along: when replacing a truthy guard, enumerate everything it was catching.
    */
    const code = read("users", "credit", "route.ts");
    expect(code).toMatch(/typeof\s+amount\s*!==\s*["'`]number["'`]/);
    expect(code).toMatch(/Number\.isFinite\s*\(\s*amount\s*\)/);
  });

  it("delete refuses before the first deletion, and refuses a non-string userId", () => {
    /*
      `deleteOne({ id: userId })` with an OBJECT value is a query operator rather than a value,
      so `{"$ne":null}` deletes the first user in the collection - and this route's original
      `!userId` presence check is true for no object. Fifth instance of a request-supplied
      value reaching a query unchecked.
    */
    const code = read("users", "delete", "route.ts");
    const guardAt = code.search(guardCallPattern());
    expect(guardAt).toBeGreaterThan(-1);

    const firstDelete = code.search(/\.delete(One|Many)\s*\(/);
    expect(firstDelete).toBeGreaterThan(-1);
    expect(guardAt).toBeLessThan(firstDelete);

    expect(code).toMatch(/typeof\s+userId\s*!==\s*["'`]string["'`]/);
  });

  it("the user list and the history read both guard before connecting", () => {
    for (const segments of [
      ["users", "route.ts"],
      ["users", "[userId]", "history", "route.ts"],
    ]) {
      const code = read(...segments);
      const label = segments.join("/");
      const guardAt = code.search(guardCallPattern());
      expect(guardAt, `${label} has no guard`).toBeGreaterThan(-1);

      const connectAt = code.search(/await\s+connectToDatabase\s*\(/);
      expect(connectAt, `${label} never connects`).toBeGreaterThan(-1);
      expect(guardAt, `${label} connects before guarding`).toBeLessThan(connectAt);
    }
  });

  it("conversations no longer verifies a token by hand", () => {
    /*
      THE ABSENCE IS THE LOAD-BEARING HALF. Left in place beside the new guard, the bare
      `verify()` would be harmless and would also be the shape the defect wore - an
      authorization-looking call that authorizes nothing - and the next reader would take it
      for the check. Same reasoning as removing `getAdminSession` from `users/edit` outright.
    */
    const code = read("users", "[userId]", "conversations", "route.ts");
    expect(code).not.toMatch(/jsonwebtoken/);
    expect(code).not.toMatch(/\bverify\s*\(\s*token/);
    expect(code).not.toMatch(/getAdminJwtSecret/);
    expect(guardedSections(code)).toContain("users");
  });
});

describe("R101b - no weaker helper survives anywhere under users/", () => {
  /*
    A DIRECTORY-WIDE NEGATIVE, counted rather than sampled. The folder previously held five
    different answers to "is this caller allowed" - nothing at all, a hand-rolled `verify`,
    `getAdminSession` as authentication, `requireAdminAuth` as admin-at-all, and
    `verifyAdminAuth` likewise - and one rule with five spellings is the shape behind
    `referenceId`, `failedReason`, `challengeId` and the Game Master `||`, none of which
    `check:mirrors` can see. The value of asserting the absence over the whole tree rather
    than per file is that it covers the file somebody adds next, which is the only kind that
    reintroduces this.

    `guardSection` calls `requireSectionAccess` and `getAdminSession` internally, in
    `apps/admin/lib/admin/section-route-guard.ts`. That is the ONE place either may appear,
    which is exactly why this walk is scoped to the routes and not to the app.
  */
  const WEAKER =
    /(getAdminSession|requireAdminAuth|verifyAdminAuth|verifyAdminToken|verifyAnyAuth)\s*\(/;

  const files = findRouteFiles(join(API, "users"));

  it("the walk finds the whole folder", () => {
    // Nineteen today. A floor, so adding one does not fail here instead of in the per-handler
    // suite above, which is where a new unguarded handler should surface.
    expect(files.length).toBeGreaterThanOrEqual(19);
  });

  it("every file names guardSection and no weaker helper", () => {
    const offenders: string[] = [];
    let handlers = 0;
    let guards = 0;

    for (const file of files) {
      const code = stripComments(readFileSync(file, "utf8"));
      const name = file.slice(API.length + 1).replace(/\\/g, "/");

      if (WEAKER.test(code)) offenders.push(name);
      handlers += (code.match(handlerPattern()) ?? []).length;
      guards += (code.match(guardCallPattern()) ?? []).length;
    }

    expect(offenders).toEqual([]);
    // Twenty-seven handlers today. Compared against each other rather than against a literal,
    // so the claim survives the folder growing and still fails if a handler arrives unguarded.
    expect(handlers).toBeGreaterThanOrEqual(19);
    expect(guards).toBeGreaterThanOrEqual(handlers);
  });
});

describe("R101c - no weaker helper and no hand-rolled JWT under trading-history/ or messaging/", () => {
  /*
    Messaging was the hand-verified class: every route called `verify` against the real
    secret and then asked nothing about grants. Trading-history called nothing at all.
    Both now use guardSection; both must refuse a return of either defect.
  */
  const WEAKER =
    /(getAdminSession|requireAdminAuth|verifyAdminAuth|verifyAdminToken|verifyAnyAuth|jwtVerify|getAdminJwtSecret)\s*\(/;
  // Reason: bare `verify(` is too wide (mongoose etc.); the import of jsonwebtoken's verify
  // is the tell that the hand-rolled path is back.
  const HAND_ROLLED_JWT = /from\s+["']jsonwebtoken["']/;

  const folders = [
    join(API, "trading-history"),
    join(API, "messaging"),
  ];
  const files = folders.flatMap((dir) => findRouteFiles(dir));

  it("the walk finds both folders", () => {
    expect(files.length).toBeGreaterThanOrEqual(15);
  });

  it("every file names guardSection, no weaker helper, and no jsonwebtoken import", () => {
    const weaker: string[] = [];
    const handRolled: string[] = [];
    let handlers = 0;
    let guards = 0;

    for (const file of files) {
      const raw = readFileSync(file, "utf8");
      const code = stripComments(raw);
      const name = file.slice(API.length + 1).replace(/\\/g, "/");

      if (WEAKER.test(code)) weaker.push(name);
      if (HAND_ROLLED_JWT.test(code)) handRolled.push(name);
      handlers += (code.match(handlerPattern()) ?? []).length;
      guards += (code.match(guardCallPattern()) ?? []).length;
    }

    expect(weaker).toEqual([]);
    expect(handRolled).toEqual([]);
    expect(handlers).toBeGreaterThanOrEqual(18);
    expect(guards).toBeGreaterThanOrEqual(handlers);
  });

  it("messaging/settings is the only file under messaging/ that names messaging-settings", () => {
    /*
      The two grants must not collapse: an employee granted only the inbox must not reach
      settings, and one granted only settings must not reach the inbox. Asserted by counting
      which files name which section, so a copy-paste that puts messaging-settings on a
      conversation route (or messaging on settings) turns this red.
    */
    const settingsFiles: string[] = [];
    const inboxFiles: string[] = [];

    for (const file of files.filter((f) =>
      f.replace(/\\/g, "/").includes("/messaging/"),
    )) {
      const code = stripComments(readFileSync(file, "utf8"));
      const name = file.slice(API.length + 1).replace(/\\/g, "/");
      const sections = [...code.matchAll(/guardSection\(\s*["']([^"']+)["']\s*\)/g)].map(
        (m) => m[1],
      );

      if (sections.includes("messaging-settings")) settingsFiles.push(name);
      if (sections.includes("messaging")) inboxFiles.push(name);
    }

    expect(settingsFiles).toEqual(["messaging/settings/route.ts"]);
    expect(inboxFiles.length).toBeGreaterThanOrEqual(11);
    expect(inboxFiles).not.toContain("messaging/settings/route.ts");
  });
});

describe("R101e - visitors/ is section-granted and nothing weaker", () => {
  /*
    Four files, six handlers. block POST/DELETE and clear DELETE were the writers that put
    this folder first among the remaining no-check debt. VisitorAnalyticsSection owns every
    fetch, so the grant is `visitors` rather than a neighbouring content section.
  */
  const WEAKER =
    /(getAdminSession|requireAdminAuth|verifyAdminAuth|verifyAdminToken|verifyAnyAuth|jwtVerify|getAdminJwtSecret)\s*\(/;

  const dir = join(API, "visitors");
  const files = findRouteFiles(dir);

  it("the walk finds the four visitor routes", () => {
    expect(files.length).toBe(4);
  });

  it("every visitors file names guardSection(visitors) and no weaker helper", () => {
    const weaker: string[] = [];
    const wrongSection: string[] = [];
    let handlers = 0;
    let guards = 0;

    for (const file of files) {
      const code = stripComments(readFileSync(file, "utf8"));
      const name = file.slice(API.length + 1).replace(/\\/g, "/");
      const sections = [...code.matchAll(/guardSection\(\s*["']([^"']+)["']\s*\)/g)].map(
        (m) => m[1],
      );

      if (WEAKER.test(code)) weaker.push(name);
      if (sections.some((s) => s !== "visitors")) wrongSection.push(name);
      handlers += (code.match(handlerPattern()) ?? []).length;
      guards += (code.match(guardCallPattern()) ?? []).length;
    }

    expect(weaker).toEqual([]);
    expect(wrongSection).toEqual([]);
    expect(handlers).toBe(6);
    expect(guards).toBeGreaterThanOrEqual(handlers);
  });
});

describe("R101f - landing-pages/ is section-granted and nothing weaker", () => {
  /*
    Seven files, ten handlers. LandingPagesSection owns every fetch (list, editor, templates,
    AI, analytics, export, clear), so the grant is `landing-pages` rather than a neighbouring
    content or AI section. analytics/clear is the writer that put the folder next after
    visitors - it zeroes every counter and deletes every visit record anonymously.
  */
  const WEAKER =
    /(getAdminSession|requireAdminAuth|verifyAdminAuth|verifyAdminToken|verifyAnyAuth|jwtVerify|getAdminJwtSecret)\s*\(/;

  const dir = join(API, "landing-pages");
  const files = findRouteFiles(dir);

  it("the walk finds the seven landing-pages routes", () => {
    expect(files.length).toBe(7);
  });

  it("every landing-pages file names guardSection(landing-pages) and no weaker helper", () => {
    const weaker: string[] = [];
    const wrongSection: string[] = [];
    let handlers = 0;
    let guards = 0;

    for (const file of files) {
      const code = stripComments(readFileSync(file, "utf8"));
      const name = file.slice(API.length + 1).replace(/\\/g, "/");
      const sections = [...code.matchAll(/guardSection\(\s*["']([^"']+)["']\s*\)/g)].map(
        (m) => m[1],
      );

      if (WEAKER.test(code)) weaker.push(name);
      if (sections.some((s) => s !== "landing-pages")) wrongSection.push(name);
      handlers += (code.match(handlerPattern()) ?? []).length;
      guards += (code.match(guardCallPattern()) ?? []).length;
    }

    expect(weaker).toEqual([]);
    expect(wrongSection).toEqual([]);
    expect(handlers).toBe(10);
    expect(guards).toBeGreaterThanOrEqual(handlers);
  });
});

describe("R101g - market-data/ is section-granted and nothing weaker", () => {
  /*
    Six files, eleven handlers. MarketDataSection owns every fetch, so the grant is
    `market-data`. cleanup / seed / gap-fill / download rewrite candle collections; they
    put the folder next among the remaining writers.
  */
  const WEAKER =
    /(getAdminSession|requireAdminAuth|verifyAdminAuth|verifyAdminToken|verifyAnyAuth|jwtVerify|getAdminJwtSecret)\s*\(/;

  const dir = join(API, "market-data");
  const files = findRouteFiles(dir);

  it("the walk finds the six market-data routes", () => {
    expect(files.length).toBe(6);
  });

  it("every market-data file names guardSection(market-data) and no weaker helper", () => {
    const weaker: string[] = [];
    const wrongSection: string[] = [];
    let handlers = 0;
    let guards = 0;

    for (const file of files) {
      const code = stripComments(readFileSync(file, "utf8"));
      const name = file.slice(API.length + 1).replace(/\\/g, "/");
      const sections = [...code.matchAll(/guardSection\(\s*["']([^"']+)["']\s*\)/g)].map(
        (m) => m[1],
      );

      if (WEAKER.test(code)) weaker.push(name);
      if (sections.some((s) => s !== "market-data")) wrongSection.push(name);
      handlers += (code.match(handlerPattern()) ?? []).length;
      guards += (code.match(guardCallPattern()) ?? []).length;
    }

    expect(weaker).toEqual([]);
    expect(wrongSection).toEqual([]);
    expect(handlers).toBe(11);
    expect(guards).toBeGreaterThanOrEqual(handlers);
  });
});

describe("R101h - symbols/ is section-granted and nothing weaker", () => {
  /*
    Three files, seven handlers. SymbolsSection owns every fetch, so the grant is `symbols`.
    Sync and the writers rewrite the live symbol catalogue anonymously.
  */
  const WEAKER =
    /(getAdminSession|requireAdminAuth|verifyAdminAuth|verifyAdminToken|verifyAnyAuth|jwtVerify|getAdminJwtSecret)\s*\(/;

  const dir = join(API, "symbols");
  const files = findRouteFiles(dir);

  it("the walk finds the three symbols routes", () => {
    expect(files.length).toBe(3);
  });

  it("every symbols file names guardSection(symbols) and no weaker helper", () => {
    const weaker: string[] = [];
    const wrongSection: string[] = [];
    let handlers = 0;
    let guards = 0;

    for (const file of files) {
      const code = stripComments(readFileSync(file, "utf8"));
      const name = file.slice(API.length + 1).replace(/\\/g, "/");
      const sections = [...code.matchAll(/guardSection\(\s*["']([^"']+)["']\s*\)/g)].map(
        (m) => m[1],
      );

      if (WEAKER.test(code)) weaker.push(name);
      if (sections.some((s) => s !== "symbols")) wrongSection.push(name);
      handlers += (code.match(handlerPattern()) ?? []).length;
      guards += (code.match(guardCallPattern()) ?? []).length;
    }

    expect(weaker).toEqual([]);
    expect(wrongSection).toEqual([]);
    expect(handlers).toBe(7);
    expect(guards).toBeGreaterThanOrEqual(handlers);
  });
});

describe("R101i - market-settings/ is section-granted and nothing weaker", () => {
  /*
    Four files, nine handlers. MarketSettingsSection owns every fetch, so the grant is
    `market`. Writers rewrite holiday calendars and trading-hours settings anonymously.
  */
  const WEAKER =
    /(getAdminSession|requireAdminAuth|verifyAdminAuth|verifyAdminToken|verifyAnyAuth|jwtVerify|getAdminJwtSecret)\s*\(/;

  const dir = join(API, "market-settings");
  const files = findRouteFiles(dir);

  it("the walk finds the four market-settings routes", () => {
    expect(files.length).toBe(4);
  });

  it("every market-settings file names guardSection(market) and no weaker helper", () => {
    const weaker: string[] = [];
    const wrongSection: string[] = [];
    let handlers = 0;
    let guards = 0;

    for (const file of files) {
      const code = stripComments(readFileSync(file, "utf8"));
      const name = file.slice(API.length + 1).replace(/\\/g, "/");
      const sections = [...code.matchAll(/guardSection\(\s*["']([^"']+)["']\s*\)/g)].map(
        (m) => m[1],
      );

      if (WEAKER.test(code)) weaker.push(name);
      if (sections.some((s) => s !== "market")) wrongSection.push(name);
      handlers += (code.match(handlerPattern()) ?? []).length;
      guards += (code.match(guardCallPattern()) ?? []).length;
    }

    expect(weaker).toEqual([]);
    expect(wrongSection).toEqual([]);
    expect(handlers).toBe(9);
    expect(guards).toBeGreaterThanOrEqual(handlers);
  });
});

describe("R101j - pages/ is section-granted and nothing weaker", () => {
  /*
    Five files, eight handlers. SitePagesSection owns the screen; LandingPageBuilder and
    FooterSectionEditor reach into the same data, so the grant is still `site-pages`.
  */
  const WEAKER =
    /(getAdminSession|requireAdminAuth|verifyAdminAuth|verifyAdminToken|verifyAnyAuth|jwtVerify|getAdminJwtSecret)\s*\(/;

  const dir = join(API, "pages");
  const files = findRouteFiles(dir);

  it("the walk finds the five pages routes", () => {
    expect(files.length).toBe(5);
  });

  it("every pages file names guardSection(site-pages) and no weaker helper", () => {
    const weaker: string[] = [];
    const wrongSection: string[] = [];
    let handlers = 0;
    let guards = 0;

    for (const file of files) {
      const code = stripComments(readFileSync(file, "utf8"));
      const name = file.slice(API.length + 1).replace(/\\/g, "/");
      const sections = [...code.matchAll(/guardSection\(\s*["']([^"']+)["']\s*\)/g)].map(
        (m) => m[1],
      );

      if (WEAKER.test(code)) weaker.push(name);
      if (sections.some((s) => s !== "site-pages")) wrongSection.push(name);
      handlers += (code.match(handlerPattern()) ?? []).length;
      guards += (code.match(guardCallPattern()) ?? []).length;
    }

    expect(weaker).toEqual([]);
    expect(wrongSection).toEqual([]);
    expect(handlers).toBe(8);
    expect(guards).toBeGreaterThanOrEqual(handlers);
  });
});

describe("R101k - simulator/ is section-granted and nothing weaker", () => {
  /*
    Twelve files, twenty-one handlers. PerformanceSimulatorSection owns the screen;
    AttackSuitePanel and DataIntegrityTab mount on it, so attack-tests and integrity
    routes share `performance-simulator`.
  */
  const WEAKER =
    /(getAdminSession|requireAdminAuth|verifyAdminAuth|verifyAdminToken|verifyAnyAuth|jwtVerify|getAdminJwtSecret)\s*\(/;

  const dir = join(API, "simulator");
  const files = findRouteFiles(dir);

  it("the walk finds the twelve simulator routes", () => {
    expect(files.length).toBe(12);
  });

  it("every simulator file names guardSection(performance-simulator) and no weaker helper", () => {
    const weaker: string[] = [];
    const wrongSection: string[] = [];
    let handlers = 0;
    let guards = 0;

    for (const file of files) {
      const code = stripComments(readFileSync(file, "utf8"));
      const name = file.slice(API.length + 1).replace(/\\/g, "/");
      const sections = [...code.matchAll(/guardSection\(\s*["']([^"']+)["']\s*\)/g)].map(
        (m) => m[1],
      );

      if (WEAKER.test(code)) weaker.push(name);
      if (sections.some((s) => s !== "performance-simulator")) wrongSection.push(name);
      handlers += (code.match(handlerPattern()) ?? []).length;
      guards += (code.match(guardCallPattern()) ?? []).length;
    }

    expect(weaker).toEqual([]);
    expect(wrongSection).toEqual([]);
    expect(handlers).toBe(21);
    expect(guards).toBeGreaterThanOrEqual(handlers);
  });
});

describe("R101l - test runners under performance-simulator are section-granted", () => {
  /*
    Nine files, twelve handlers across tests/, admin/end-logic-tests/ and
    admin/trading-tests/. UnitTestsTab, EndLogicTestsTab and TradingTestsTab all mount
    inside PerformanceSimulatorSection, so they share that grant.
  */
  const WEAKER =
    /(getAdminSession|requireAdminAuth|verifyAdminAuth|verifyAdminToken|verifyAnyAuth|jwtVerify|getAdminJwtSecret)\s*\(/;

  const dirs = [
    join(API, "tests"),
    join(API, "admin", "end-logic-tests"),
    join(API, "admin", "trading-tests"),
  ];
  const files = dirs.flatMap((dir) => findRouteFiles(dir));

  it("the walk finds the nine test-runner routes", () => {
    expect(files.length).toBe(9);
  });

  it("every test-runner file names guardSection(performance-simulator) and no weaker helper", () => {
    const weaker: string[] = [];
    const wrongSection: string[] = [];
    let handlers = 0;
    let guards = 0;

    for (const file of files) {
      const code = stripComments(readFileSync(file, "utf8"));
      const name = file.slice(API.length + 1).replace(/\\/g, "/");
      const sections = [...code.matchAll(/guardSection\(\s*["']([^"']+)["']\s*\)/g)].map(
        (m) => m[1],
      );

      if (WEAKER.test(code)) weaker.push(name);
      if (sections.some((s) => s !== "performance-simulator")) wrongSection.push(name);
      handlers += (code.match(handlerPattern()) ?? []).length;
      guards += (code.match(guardCallPattern()) ?? []).length;
    }

    expect(weaker).toEqual([]);
    expect(wrongSection).toEqual([]);
    expect(handlers).toBe(12);
    expect(guards).toBeGreaterThanOrEqual(handlers);
  });
});

describe("R101m - the last fourteen no-check routes are section-granted", () => {
  /*
    Fourteen files, seventeen handlers. Grants from calling screens (or the closest screen
    for orphan diagnostics). admin/database/indexes is performance-simulator because
    DatabaseIndexesTab mounts there, not under DatabaseSection. server-fleet is its own
    ADMIN_SECTIONS id, added in the same slice so the guard can name the screen.
  */
  const WEAKER =
    /(getAdminSession|requireAdminAuth|verifyAdminAuth|verifyAdminToken|verifyAnyAuth|jwtVerify|getAdminJwtSecret)\s*\(/;

  const entries: { path: string[]; section: string; handlers: number }[] = [
    { path: ["check-database"], section: "database", handlers: 1 },
    { path: ["recover-stats"], section: "database", handlers: 1 },
    { path: ["test-badge-models"], section: "database", handlers: 1 },
    { path: ["admin", "database"], section: "performance-simulator", handlers: 2 },
    { path: ["fraud", "restrictions"], section: "fraud", handlers: 1 },
    { path: ["challenges", "[id]", "gm-info"], section: "challenges", handlers: 1 },
    { path: ["market-status"], section: "competitions", handlers: 1 },
    { path: ["pexels"], section: "landing-pages", handlers: 1 },
    { path: ["action-terms"], section: "users", handlers: 1 },
    { path: ["server-monitor"], section: "server-monitor", handlers: 1 },
    { path: ["server-fleet"], section: "server-fleet", handlers: 2 },
    { path: ["diagnose-user"], section: "users", handlers: 1 },
    { path: ["sync-missing-users"], section: "users", handlers: 2 },
    { path: ["update-competition-status"], section: "competitions", handlers: 1 },
  ];

  it("covers fourteen route trees", () => {
    expect(entries.length).toBe(14);
  });

  it("every R101m file names its section grant and no weaker helper", () => {
    const weaker: string[] = [];
    const wrongSection: string[] = [];
    let handlers = 0;
    let guards = 0;

    for (const { path, section, handlers: expected } of entries) {
      const files = findRouteFiles(join(API, ...path));
      expect(files.length).toBeGreaterThan(0);

      for (const file of files) {
        const code = stripComments(readFileSync(file, "utf8"));
        const name = file.slice(API.length + 1).replace(/\\/g, "/");
        const sections = [
          ...code.matchAll(/guardSection\(\s*["']([^"']+)["']\s*\)/g),
        ].map((m) => m[1]);

        if (WEAKER.test(code)) weaker.push(name);
        if (sections.some((s) => s !== section)) wrongSection.push(name);
        const fileHandlers = (code.match(handlerPattern()) ?? []).length;
        handlers += fileHandlers;
        guards += (code.match(guardCallPattern()) ?? []).length;
        expect(fileHandlers).toBe(expected);
      }
    }

    expect(weaker).toEqual([]);
    expect(wrongSection).toEqual([]);
    expect(handlers).toBe(17);
    expect(guards).toBeGreaterThanOrEqual(handlers);
  });

  it("ADMIN_SECTIONS includes server-fleet so the fleet grant is issuable", () => {
    // Reason: the screen existed; the enum did not. Without this the guard could not name
    // the calling screen and employees could never be granted the tab.
    expect(ADMIN_SECTIONS).toContain("server-fleet");
  });
});

describe("R101a - the badge routes, which are the data R96 widens", () => {
  it("guards the badge CRUD on every handler", () => {
    const code = read("badges", "route.ts");
    const handlers = code.match(handlerPattern()) ?? [];

    // Four handlers today - GET, POST, PUT, DELETE. Asserted as a floor rather than an
    // equality so a fifth does not fail this test instead of the per-handler one above, which
    // is where a new unguarded handler should surface.
    expect(handlers.length).toBeGreaterThanOrEqual(4);
    expect(guardedSections(code).length).toBeGreaterThanOrEqual(handlers.length);
  });

  it("refuses a non-string userId on the evaluation trigger, because the evaluator will not", () => {
    /*
      An omitted `userId` means "every user" on this route, so it cannot fall through to the
      bulk branch on a bad value. The type check is load-bearing rather than defensive for a
      second reason recorded as R100: the ADMIN copy of `gatherUserStats` is an older revision
      with no type check of its own, so an object arriving here reaches a query as an operator.
      The main app's copy has one; relying on that is relying on the wrong file.
    */
    const code = read("trigger-badge-evaluation", "route.ts");
    expect(code).toMatch(/typeof\s+userId\s*!==\s*["'`]string["'`]/);
    expect(guardedSections(code)).toContain("badges");
  });
});

describe("R101n - the three hand-verified routes are section-granted", () => {
  /*
    Three files, five handlers. Hand-verified JWT refused a forgery correctly and never
    asked which grant the holder held - the subtlest of the four auth classes. Grants from
    calling screens: MessagingSection → messaging; TradingRiskSection → trading-risk;
    trigger-margin-check has no UI caller and shares trading-risk by domain.
  */
  const WEAKER =
    /(getAdminSession|requireAdminAuth|verifyAdminAuth|verifyAdminToken|verifyAnyAuth|jwtVerify|getAdminJwtSecret)\s*\(|\bverify\s*\(/;

  const entries: { path: string[]; section: string; handlers: number }[] = [
    { path: ["employees", "availability"], section: "messaging", handlers: 2 },
    { path: ["trading-risk-settings"], section: "trading-risk", handlers: 2 },
    { path: ["trigger-margin-check"], section: "trading-risk", handlers: 1 },
  ];

  it("covers three route trees", () => {
    expect(entries.length).toBe(3);
  });

  it("every R101n file names its section grant and no weaker helper", () => {
    const weaker: string[] = [];
    const wrongSection: string[] = [];
    let handlers = 0;
    let guards = 0;

    for (const { path, section, handlers: expected } of entries) {
      const files = findRouteFiles(join(API, ...path));
      expect(files.length).toBeGreaterThan(0);

      for (const file of files) {
        const code = stripComments(readFileSync(file, "utf8"));
        const name = file.slice(API.length + 1).replace(/\\/g, "/");
        const sections = [
          ...code.matchAll(/guardSection\(\s*["']([^"']+)["']\s*\)/g),
        ].map((m) => m[1]);

        if (WEAKER.test(code)) weaker.push(name);
        if (sections.some((s) => s !== section)) wrongSection.push(name);
        const fileHandlers = (code.match(handlerPattern()) ?? []).length;
        handlers += fileHandlers;
        guards += (code.match(guardCallPattern()) ?? []).length;
        expect(fileHandlers).toBe(expected);
      }
    }

    expect(weaker).toEqual([]);
    expect(wrongSection).toEqual([]);
    expect(handlers).toBe(5);
    expect(guards).toBeGreaterThanOrEqual(handlers);
  });
});

describe("R101o - money writers are section-granted", () => {
  /*
    Eleven files, fifteen handlers. Helper-but-no-grant → section-granted. Grants from
    calling screens: FinancialDashboard → financial; PendingWithdrawalsSection →
    pending-withdrawals. Atlas refund/clawback also open from TransactionDetailDialog,
    which mounts on the same financial surface.
  */
  const WEAKER =
    /(getAdminSession|requireAdminAuth|verifyAdminAuth|verifyAdminToken|verifyAnyAuth|jwtVerify|getAdminJwtSecret)\s*\(|\bverify\s*\(/;

  const entries: { rel: string; section: string; handlers: number }[] = [
    { rel: "admin-funds/route.ts", section: "financial", handlers: 2 },
    { rel: "vat/route.ts", section: "financial", handlers: 2 },
    { rel: "vendor-payments/route.ts", section: "financial", handlers: 2 },
    { rel: "atlas/refund/route.ts", section: "financial", handlers: 1 },
    { rel: "atlas/refund/clawback/route.ts", section: "financial", handlers: 1 },
    { rel: "atlas/refunds/pending/route.ts", section: "financial", handlers: 1 },
    { rel: "withdrawals/route.ts", section: "pending-withdrawals", handlers: 1 },
    { rel: "withdrawals/[id]/route.ts", section: "pending-withdrawals", handlers: 2 },
    {
      rel: "withdrawals/[id]/approve/route.ts",
      section: "pending-withdrawals",
      handlers: 1,
    },
    {
      rel: "withdrawals/[id]/reject/route.ts",
      section: "pending-withdrawals",
      handlers: 1,
    },
    {
      rel: "withdrawals/[id]/complete/route.ts",
      section: "pending-withdrawals",
      handlers: 1,
    },
  ];

  it("covers eleven money-writer route files", () => {
    expect(entries.length).toBe(11);
  });

  it("every R101o file names its section grant and no weaker helper", () => {
    const weaker: string[] = [];
    const wrongSection: string[] = [];
    let handlers = 0;
    let guards = 0;

    for (const { rel, section, handlers: expected } of entries) {
      const file = join(API, ...rel.split("/"));
      const code = stripComments(readFileSync(file, "utf8"));
      const sections = [
        ...code.matchAll(/guardSection\(\s*["']([^"']+)["']\s*\)/g),
      ].map((m) => m[1]);

      if (WEAKER.test(code)) weaker.push(rel);
      if (sections.some((s) => s !== section)) wrongSection.push(rel);
      const fileHandlers = (code.match(handlerPattern()) ?? []).length;
      handlers += fileHandlers;
      guards += (code.match(guardCallPattern()) ?? []).length;
      expect(fileHandlers).toBe(expected);
    }

    expect(weaker).toEqual([]);
    expect(wrongSection).toEqual([]);
    expect(handlers).toBe(15);
    expect(guards).toBeGreaterThanOrEqual(handlers);
  });
});

describe("R101p - clean money helpers are section-granted", () => {
  /*
    Ten files, fifteen handlers. Single-caller money reads/writes. Three of them
    (financial-dashboard, fee-settings, credit-conversion) were hand-rolled jwtVerify —
    they sat in the helper frozen list by mistake; the classifier would have called them
    hand-verified. chargebacks/route is financial; chargebacks/lookup is users (create
    dialog). chargebacks/[id]/* deferred for dual callers.
  */
  const WEAKER =
    /(getAdminSession|requireAdminAuth|verifyAdminAuth|verifyAdminToken|verifyAnyAuth|jwtVerify|getAdminJwtSecret)\s*\(|\bverify\s*\(/;

  const entries: { rel: string; section: string; handlers: number }[] = [
    { rel: "financial-dashboard/route.ts", section: "financial", handlers: 1 },
    { rel: "financial-analytics/route.ts", section: "financial", handlers: 1 },
    { rel: "chargebacks/route.ts", section: "financial", handlers: 1 },
    { rel: "chargebacks/lookup/route.ts", section: "users", handlers: 1 },
    { rel: "deposits/failed/route.ts", section: "failed-deposits", handlers: 1 },
    {
      rel: "deposits/[id]/manual-complete/route.ts",
      section: "failed-deposits",
      handlers: 2,
    },
    { rel: "fee-settings/route.ts", section: "fees", handlers: 2 },
    { rel: "complete-pending-payment/route.ts", section: "payments", handlers: 1 },
    { rel: "withdrawal-settings/route.ts", section: "withdrawals", handlers: 3 },
    { rel: "credit-conversion/route.ts", section: "currency", handlers: 2 },
  ];

  it("covers ten clean money-helper route files", () => {
    expect(entries.length).toBe(10);
  });

  it("every R101p file names its section grant and no weaker helper", () => {
    const weaker: string[] = [];
    const wrongSection: string[] = [];
    let handlers = 0;
    let guards = 0;

    for (const { rel, section, handlers: expected } of entries) {
      const file = join(API, ...rel.split("/"));
      const code = stripComments(readFileSync(file, "utf8"));
      const sections = [
        ...code.matchAll(/guardSection\(\s*["']([^"']+)["']\s*\)/g),
      ].map((m) => m[1]);

      if (WEAKER.test(code)) weaker.push(rel);
      if (sections.some((s) => s !== section)) wrongSection.push(rel);
      const fileHandlers = (code.match(handlerPattern()) ?? []).length;
      handlers += fileHandlers;
      guards += (code.match(guardCallPattern()) ?? []).length;
      expect(fileHandlers).toBe(expected);
    }

    expect(weaker).toEqual([]);
    expect(wrongSection).toEqual([]);
    expect(handlers).toBe(15);
    expect(guards).toBeGreaterThanOrEqual(handlers);
  });

  it("chargebacks list is financial while lookup is users", () => {
    // Reason: two screens, two grants — conflating them is how Users loses the create dialog
    // or Financial loses the queue.
    const list = stripComments(
      readFileSync(join(API, "chargebacks", "route.ts"), "utf8"),
    );
    const lookup = stripComments(
      readFileSync(join(API, "chargebacks", "lookup", "route.ts"), "utf8"),
    );
    expect(list).toMatch(/guardSection\(\s*["']financial["']\s*\)/);
    expect(lookup).toMatch(/guardSection\(\s*["']users["']\s*\)/);
    expect(list).not.toMatch(/guardSection\(\s*["']users["']\s*\)/);
    expect(lookup).not.toMatch(/guardSection\(\s*["']financial["']\s*\)/);
  });
});

describe("R101q - dual-caller money helpers and vendors are section-granted", () => {
  /*
    Sixteen files. guardAnySection for routes called from two screens; guardSection("vendors")
    after adding the menu id to ADMIN_SECTIONS. chargebacks/[id] is not a CLOSED_FOLDERS walk
    because the parent folder also holds the users-only lookup.
  */
  const WEAKER =
    /(getAdminSession|requireAdminAuth|verifyAdminAuth|verifyAdminToken|verifyAnyAuth|jwtVerify|getAdminJwtSecret)\s*\(|\bverify\s*\(/;

  const dualCaller: { rel: string; sections: string[]; handlers: number }[] = [
    { rel: "chargebacks/[id]/route.ts", sections: ["financial", "users"], handlers: 1 },
    {
      rel: "chargebacks/[id]/ai-narrative/route.ts",
      sections: ["financial", "users"],
      handlers: 1,
    },
    {
      rel: "chargebacks/[id]/attachments/route.ts",
      sections: ["financial", "users"],
      handlers: 2,
    },
    {
      rel: "chargebacks/[id]/attachments/[attachmentId]/route.ts",
      sections: ["financial", "users"],
      handlers: 1,
    },
    {
      rel: "chargebacks/[id]/complete/route.ts",
      sections: ["financial", "users"],
      handlers: 1,
    },
    {
      rel: "chargebacks/[id]/initiate/route.ts",
      sections: ["financial", "users"],
      handlers: 1,
    },
    {
      rel: "chargebacks/[id]/narrative/route.ts",
      sections: ["financial", "users"],
      handlers: 1,
    },
    {
      rel: "chargebacks/[id]/report/route.ts",
      sections: ["financial", "users"],
      handlers: 1,
    },
    {
      rel: "chargebacks/[id]/represented/route.ts",
      sections: ["financial", "users"],
      handlers: 1,
    },
    {
      rel: "chargebacks/[id]/withdrawn/route.ts",
      sections: ["financial", "users"],
      handlers: 1,
    },
    {
      rel: "chargebacks/[id]/won/route.ts",
      sections: ["financial", "users"],
      handlers: 1,
    },
    {
      rel: "admin-bank-accounts/route.ts",
      sections: ["company", "pending-withdrawals"],
      handlers: 2,
    },
    {
      rel: "admin-bank-accounts/[id]/route.ts",
      sections: ["company", "pending-withdrawals"],
      handlers: 3,
    },
    {
      rel: "cancel-pending-payment/route.ts",
      sections: ["failed-deposits", "payments"],
      handlers: 1,
    },
  ];

  const singleCaller: { rel: string; section: string; handlers: number }[] = [
    { rel: "vendors/route.ts", section: "vendors", handlers: 4 },
    { rel: "vendors/[id]/mark-paid/route.ts", section: "vendors", handlers: 1 },
  ];

  it("covers sixteen dual-caller and vendors route files", () => {
    expect(dualCaller.length + singleCaller.length).toBe(16);
  });

  it("every dual-caller file uses guardAnySection with both calling-screen grants", () => {
    /*
      Per handler slice, not file-wide. A probe that narrows only the first handler of
      admin-bank-accounts (two handlers) stayed green against a file-level check because the
      sibling still named both grants - fourth cause of a green probe (mutation changes no
      observable). Both calling-screen grants must appear on EVERY exported handler.
    */
    const weaker: string[] = [];
    const missing: string[] = [];
    let handlers = 0;
    let guards = 0;

    for (const { rel, sections, handlers: expected } of dualCaller) {
      const file = join(API, ...rel.split("/"));
      const code = stripComments(readFileSync(file, "utf8"));

      if (WEAKER.test(code)) weaker.push(rel);
      for (const { method, body } of handlerSlices(code)) {
        const named = guardedSections(body);
        if (!sections.every((s) => named.includes(s))) {
          missing.push(`${rel}:${method}`);
        }
        if (!/guardAnySection\s*\(/.test(body)) {
          missing.push(`${rel}:${method}:not-any`);
        }
      }
      const fileHandlers = (code.match(handlerPattern()) ?? []).length;
      handlers += fileHandlers;
      guards += (code.match(guardCallPattern()) ?? []).length;
      expect(fileHandlers).toBe(expected);
    }

    expect(weaker).toEqual([]);
    expect(missing).toEqual([]);
    expect(handlers).toBe(18);
    expect(guards).toBeGreaterThanOrEqual(handlers);
  });

  it("vendors routes name the vendors section and no weaker helper", () => {
    for (const { rel, section, handlers: expected } of singleCaller) {
      const file = join(API, ...rel.split("/"));
      const code = stripComments(readFileSync(file, "utf8"));
      expect(WEAKER.test(code)).toBe(false);
      expect(guardedSections(code)).toContain(section);
      expect((code.match(handlerPattern()) ?? []).length).toBe(expected);
      expect((code.match(guardCallPattern()) ?? []).length).toBeGreaterThanOrEqual(
        expected,
      );
    }
  });

  it("vendors is an ADMIN_SECTIONS value so the grant can be issued", () => {
    // Reason: the menu id existed; the enum did not. Without this, guardSection("vendors")
    // would not typecheck and no employee document could store the grant.
    const model = readFileSync(
      join(
        process.cwd(),
        "apps/admin/database/models/admin-employee.model.ts",
      ),
      "utf8",
    );
    expect(model).toMatch(/"vendors"/);
  });

  it("guardAnySection refuses an empty section list before authenticating", () => {
    // Reason: empty accept-either is a programming error that must fail closed. Asserted
    // in source so the suite does not need a live session to prove the order.
    const authSrc = readFileSync(
      join(process.cwd(), "apps/admin/lib/admin/auth.ts"),
      "utf8",
    );
    const start = authSrc.indexOf("export async function requireAnySectionAccess");
    expect(start).toBeGreaterThan(-1);
    const slice = authSrc.slice(start, start + 600);
    expect(slice.indexOf("sections.length === 0")).toBeLessThan(
      slice.indexOf("verifyAdminAuth"),
    );
  });
});


describe("R101r - fraud/ is section-granted and nothing weaker", () => {
  /*
    Twenty-two files, twenty-eight handlers. FraudMonitoringSection (id fraud) owns
    alerts, devices, investigation, settings, history and restrictions. user-status is
    also fetched from UserFullDetailPanel (users), so it uses guardAnySection.
    fraud/restrictions was already granted in R101m; the rest were admin-at-all.
  */
  const WEAKER =
    /(getAdminSession|requireAdminAuth|verifyAdminAuth|verifyAdminToken|verifyAnyAuth|jwtVerify|getAdminJwtSecret)\s*\(|\bverify\s*\(/;

  const dir = join(API, "fraud");
  const files = findRouteFiles(dir);

  it("covers twenty-two fraud route files", () => {
    expect(files.length).toBe(22);
  });

  it("every fraud file names the fraud section grant and no weaker helper", () => {
    const weaker: string[] = [];
    const missingFraud: string[] = [];
    let handlers = 0;
    let guards = 0;

    for (const file of files) {
      const code = stripComments(readFileSync(file, "utf8"));
      const name = file.slice(API.length + 1).replace(/\\/g, "/");
      const named = guardedSections(code);

      if (WEAKER.test(code)) weaker.push(name);
      if (!named.includes("fraud")) missingFraud.push(name);
      handlers += (code.match(handlerPattern()) ?? []).length;
      guards += (code.match(guardCallPattern()) ?? []).length;
    }

    expect(weaker).toEqual([]);
    expect(missingFraud).toEqual([]);
    expect(handlers).toBe(28);
    expect(guards).toBeGreaterThanOrEqual(handlers);
  });

  it("user-status accepts either the fraud or the users grant", () => {
    // Reason: UserFullDetailPanel is granted by users; the fraud folder's CLOSED_FOLDERS
    // walk still requires the fraud id to be named so a users-only grant does not hide
    // behind a dual-caller path that forgot one half.
    const code = stripComments(
      readFileSync(join(API, "fraud", "user-status", "route.ts"), "utf8"),
    );
    expect(code).toMatch(/guardAnySection\s*\(\s*\[/);
    const named = guardedSections(code);
    expect(named).toEqual(expect.arrayContaining(["fraud", "users"]));
  });
});


describe("R101s - employees helpers and reset-all are section-granted", () => {
  /*
    Five files, thirteen handlers. EmployeesSection owns [id], role-templates,
    upgrade-super-admin and POST /employees. GET /employees is also fetched from
    UsersSection and TransferCustomerDialog (users). reset-all-employees is the
    DatabaseSection danger control. availability stays messaging (R101n).
  */
  const WEAKER =
    /(getAdminSession|requireAdminAuth|verifyAdminAuth|verifyAdminToken|verifyAnyAuth|jwtVerify|getAdminJwtSecret)\s*\(|\bverify\s*\(/;

  const employeeOwned = [
    join(API, "employees", "[id]", "route.ts"),
    join(API, "employees", "role-templates", "route.ts"),
    join(API, "employees", "upgrade-super-admin", "route.ts"),
  ];

  it("covers the three employees-only subtrees", () => {
    for (const file of employeeOwned) {
      expect(existsSync(file)).toBe(true);
    }
  });

  it("every employees-only file names the employees grant and no weaker helper", () => {
    const weaker: string[] = [];
    const missing: string[] = [];
    let handlers = 0;
    let guards = 0;

    for (const file of employeeOwned) {
      const code = stripComments(readFileSync(file, "utf8"));
      const name = file.slice(API.length + 1).replace(/\\/g, "/");
      const named = guardedSections(code);
      if (WEAKER.test(code)) weaker.push(name);
      if (!named.includes("employees")) missing.push(name);
      handlers += (code.match(handlerPattern()) ?? []).length;
      guards += (code.match(guardCallPattern()) ?? []).length;
    }

    expect(weaker).toEqual([]);
    expect(missing).toEqual([]);
    expect(handlers).toBe(10);
    expect(guards).toBeGreaterThanOrEqual(handlers);
  });

  it("GET /employees accepts either employees or users; POST demands employees", () => {
    const code = stripComments(
      readFileSync(join(API, "employees", "route.ts"), "utf8"),
    );
    expect(WEAKER.test(code)).toBe(false);
    expect(code).toMatch(/guardAnySection\s*\(\s*\[\s*["']employees["']\s*,\s*["']users["']/);
    expect(code).toMatch(/guardSection\s*\(\s*["']employees["']\s*\)/);
    // Reason: count both calls so a GET that dropped users still fails here rather than
    // only on the include check that a POST-only employees name would also satisfy.
    expect((code.match(guardCallPattern()) ?? []).length).toBe(2);
    expect((code.match(handlerPattern()) ?? []).length).toBe(2);
  });

  it("reset-all-employees names the database grant and no weaker helper", () => {
    const code = stripComments(
      readFileSync(join(API, "admin", "reset-all-employees", "route.ts"), "utf8"),
    );
    expect(WEAKER.test(code)).toBe(false);
    expect(guardedSections(code)).toEqual(["database"]);
    expect((code.match(handlerPattern()) ?? []).length).toBe(1);
    expect((code.match(guardCallPattern()) ?? []).length).toBe(1);
  });
});

describe("R101t - invoices helpers are section-granted", () => {
  /*
    Nine files, twelve handlers. Invoice data (8 files under invoices/) is dual-caller
    financial|users — FinancialDashboard and UserFullDetailPanel (via TransactionDetailDialog).
    invoice-settings is invoices|financial — InvoiceTemplateSection plus the financial
    dashboard VAT preview. Export/settings audits use guard.admin, never a follow-up session.
  */
  const WEAKER =
    /(getAdminSession|requireAdminAuth|verifyAdminAuth|verifyAdminToken|verifyAnyAuth|jwtVerify|getAdminJwtSecret)\s*\(|\bverify\s*\(/;

  const invoiceFiles = findRouteFiles(join(API, "invoices"));
  const settingsFile = join(API, "invoice-settings", "route.ts");

  it("covers the whole invoices/ tree and invoice-settings", () => {
    expect(invoiceFiles.length).toBe(8);
    expect(existsSync(settingsFile)).toBe(true);
  });

  it("every invoices/ handler names financial and users, with no weaker helper", () => {
    const weaker: string[] = [];
    const missing: string[] = [];
    let handlers = 0;
    let guards = 0;

    for (const file of invoiceFiles) {
      const code = stripComments(readFileSync(file, "utf8"));
      const name = file.slice(API.length + 1).replace(/\\/g, "/");
      const named = guardedSections(code);
      if (WEAKER.test(code)) weaker.push(name);
      if (!named.includes("financial") || !named.includes("users")) {
        missing.push(name);
      }
      handlers += (code.match(handlerPattern()) ?? []).length;
      guards += (code.match(guardCallPattern()) ?? []).length;
    }

    expect(weaker).toEqual([]);
    expect(missing).toEqual([]);
    expect(handlers).toBe(10);
    expect(guards).toBeGreaterThanOrEqual(handlers);
  });

  it("invoice-settings accepts either invoices or financial", () => {
    const code = stripComments(readFileSync(settingsFile, "utf8"));
    expect(WEAKER.test(code)).toBe(false);
    expect(code).toMatch(
      /guardAnySection\s*\(\s*\[\s*["']invoices["']\s*,\s*["']financial["']/,
    );
    const named = guardedSections(code);
    expect(named).toEqual(expect.arrayContaining(["invoices", "financial"]));
    expect((code.match(handlerPattern()) ?? []).length).toBe(2);
    expect((code.match(guardCallPattern()) ?? []).length).toBe(2);
  });

  it("export and settings audits attribute from the guard, not a follow-up session", () => {
    // Reason: getAdminSession after a successful guard is the R101b shape — it reads as
    // attribution while performing none when the guard is later removed.
    for (const file of [
      join(API, "invoices", "export", "route.ts"),
      settingsFile,
    ]) {
      const code = stripComments(readFileSync(file, "utf8"));
      expect(code).toMatch(/guard\.admin/);
      expect(code).not.toMatch(/getAdminSession\s*\(/);
    }
  });
});

describe("R101u - marketplace helpers are section-granted", () => {
  /*
    Five files, eight handlers. MarketplaceSection is the only caller for four of them;
    generate-cosmetic has no UI caller today and shares the marketplace grant so the
    folder stays uniformly section-granted. CRUD audits use guard.admin.
  */
  const WEAKER =
    /(getAdminSession|requireAdminAuth|verifyAdminAuth|verifyAdminToken|verifyAnyAuth|jwtVerify|getAdminJwtSecret)\s*\(|\bverify\s*\(/;

  const marketplaceFiles = findRouteFiles(join(API, "marketplace"));

  it("covers the whole marketplace/ tree", () => {
    expect(marketplaceFiles.length).toBe(5);
  });

  it("every marketplace handler names the marketplace grant and no weaker helper", () => {
    const weaker: string[] = [];
    const missing: string[] = [];
    let handlers = 0;
    let guards = 0;

    for (const file of marketplaceFiles) {
      const code = stripComments(readFileSync(file, "utf8"));
      const name = file.slice(API.length + 1).replace(/\\/g, "/");
      const named = guardedSections(code);
      if (WEAKER.test(code)) weaker.push(name);
      if (!named.includes("marketplace")) missing.push(name);
      handlers += (code.match(handlerPattern()) ?? []).length;
      guards += (code.match(guardCallPattern()) ?? []).length;
    }

    expect(weaker).toEqual([]);
    expect(missing).toEqual([]);
    expect(handlers).toBe(8);
    expect(guards).toBeGreaterThanOrEqual(handlers);
  });

  it("CRUD audits attribute from the guard, not a follow-up session", () => {
    const code = stripComments(
      readFileSync(join(API, "marketplace", "route.ts"), "utf8"),
    );
    expect(code).toMatch(/guard\.admin/);
    expect(code).not.toMatch(/getAdminSession\s*\(/);
    // Reason: three writers (create / update / delete) each take guard.admin — count so
    // dropping one still fails rather than being covered by the other two.
    expect((code.match(/guard\.admin/g) ?? []).length).toBeGreaterThanOrEqual(3);
  });
});

describe("R101 - the no-check and hand-verified debt is closed; helper remains", () => {
  /*
    FLIPPED 16 Sep 2026 (R101m) for no-check; hand-verified closed the same day (R101n).
    Public-by-design routes still call no AUTH_CALL helper (they are a different class), so
    the lasting assertions use the inventory classifier for the empty piles and the
    closed-folder leak check for regressions.
  */
  const AUTH_CALL =
    /(guardSection|guardAnySection|requireSectionAccess|requireAnySectionAccess|getAdminSession|verifyAdminAuth|verifyAdminToken|requireAdminAuth|verifyAnyAuth|verifyGameMasterAuth|getServerSession|auth\.api\.getSession)\s*\(/;

  const unguardedByHelper = findRouteFiles(API).filter((file) => {
    const code = stripComments(readFileSync(file, "utf8"));
    if ((code.match(handlerPattern()) ?? []).length === 0) return false;
    return !AUTH_CALL.test(code);
  });

  it("finds no route in the no-check-of-any-kind class", () => {
    // Reason: inventoryAdminRoutes is the same classifier the audit tool and the ratchet use.
    expect(routesOfClass(inventoryAdminRoutes(), "no-check")).toEqual([]);
  });

  it("finds no route in the hand-verified-no-grant class", () => {
    // Reason: R101n emptied this class. A new hand-rolled jwtVerify without a section grant
    // lands here and turns this red.
    expect(routesOfClass(inventoryAdminRoutes(), "hand-verified-no-grant")).toEqual([]);
  });

  it("and none of the closed folders leak an unguarded file", () => {
    /*
      This is the assertion that lasts, and it is the one the canary above exists to protect.
      A `route.ts` added under any closed folder with no guard lands in this list and turns
      this red - which is the exact defect `users/edit` shipped with, and the exact one a
      per-file allow-list would let through on the day it appeared.
    */
    const closed = CLOSED_FOLDERS.map(({ folder }) => join(API, ...folder));
    const leaked = unguardedByHelper.filter((file) =>
      closed.some((dir) => file.startsWith(dir)),
    );

    expect(leaked.map((f) => f.slice(API.length + 1))).toEqual([]);
  });
});
