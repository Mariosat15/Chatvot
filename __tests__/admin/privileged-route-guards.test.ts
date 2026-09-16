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
import { readFileSync } from "fs";
import { join } from "path";
import { ADMIN_SECTIONS } from "../../apps/admin/database/models/admin-employee.model";
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

describe("R101 - the rest of the tree is still an offender", () => {
  /*
    A TRIPWIRE POINTING THE RIGHT WAY, and the reason it is written as a canary rather than as
    a passing summary is the R60 rule: a test that states a known gap and passes is
    indistinguishable from the gap having been closed, and it silently re-permits the defect in
    every file it excuses. When somebody finishes R101b and R101c this goes red, and the reader
    is sent here to delete it and tighten the walk below into the real guard.

    IT DELIBERATELY ASSERTS NO EXACT COUNT. The number moved three times in one afternoon -
    A check that states a known gap and passes anyway is indistinguishable from the gap having
    been closed, and it quietly excuses every file it lists. It goes red when the remaining
    no-check debt reaches zero - which R101c did not do, and is not supposed to: this canary
    asserts the TREE is still an offender, not that messaging and trading-history still are.
  */
  const AUTH_CALL =
    /(guardSection|requireSectionAccess|getAdminSession|verifyAdminAuth|verifyAdminToken|requireAdminAuth|verifyAnyAuth|verifyGameMasterAuth|getServerSession|auth\.api\.getSession)\s*\(/;

  const unguarded = findRouteFiles(API).filter((file) => {
    const code = stripComments(readFileSync(file, "utf8"));
    if ((code.match(handlerPattern()) ?? []).length === 0) return false;
    return !AUTH_CALL.test(code);
  });

  it("still finds routes with no authorization call at all", () => {
    expect(unguarded.length).toBeGreaterThan(0);
  });

  it("but none of them are in the folders R101a closed", () => {
    /*
      This is the assertion that lasts, and it is the one the canary above exists to protect.
      A `route.ts` added under any closed folder with no guard lands in this list and turns
      this red - which is the exact defect `users/edit` shipped with, and the exact one a
      per-file allow-list would let through on the day it appeared.
    */
    const closed = CLOSED_FOLDERS.map(({ folder }) => join(API, ...folder));
    const leaked = unguarded.filter((file) =>
      closed.some((dir) => file.startsWith(dir)),
    );

    expect(leaked.map((f) => f.slice(API.length + 1))).toEqual([]);
  });
});
