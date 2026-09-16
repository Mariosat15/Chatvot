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
  { folder: ["users", "edit"], section: "users" },
  { folder: ["badges"], section: "badges" },
  { folder: ["trigger-badge-evaluation"], section: "badges" },
  { folder: ["journey-map"], section: "journey-map" },
  { folder: ["journey-milestones"], section: "journey-map" },
  { folder: ["journey-progress"], section: "journey-map" },
  { folder: ["journey"], section: "journey-map" },
  { folder: ["admin", "whitelabel-defaults"], section: "settings" },
  { folder: ["admin", "badge-simulator"], section: "badges" },
  { folder: ["admin", "milestone-simulator"], section: "journey-map" },
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
    100, then 99, then 97 - and not one of those moves was a code change: each was the
    CLASSIFIER changing, as the scan learned to strip comments, to recognise `export const`
    handlers, and to count `getSession` and `auth.api.getSession` as authorization. So the
    honest thing to pin is the shape rather than the figure, because a hard number here would
    fail on the day somebody improves the scan and teach the next reader that the suite is
    noise. The figure belongs in the risk register beside the method that produced it.
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
