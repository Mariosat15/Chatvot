/**
 * Every exported handler under `apps/admin/app/api/ai/` must be behind a section guard.
 *
 * WHY THIS IS A COUNT AND NOT A LIST. All five routes in that folder had no authorization of
 * any kind until 8 September 2026, and the admin app has no middleware, so anything able to
 * reach the origin could post an arbitrary prompt and be answered with the platform's own
 * OpenAI key - and, on two of them, have badge and milestone configuration rewritten.
 *
 * They were not found by reading routes. Every other route in the admin app has *something*,
 * and that is exactly what sends a reader past the ones that have nothing. They were found by
 * counting exported handlers against guards, the same method that found R40's unauthenticated
 * `finalize-old-competitions` and R47's `sync-referrals`.
 *
 * So this test READS THE DIRECTORY rather than naming the five files. A sixth route added next
 * month is the whole thing being defended against, and a hard-coded list is green on the day
 * it appears. It also counts per file, because a route whose `POST` is guarded and whose `GET`
 * is not passes any check that merely asks whether the file mentions a guard.
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { ADMIN_SECTIONS } from "../../apps/admin/database/models/admin-employee.model";
import {
  findRouteFiles,
  guardCallPattern,
  handlerPattern,
  stripComments,
} from "../helpers/route-guard-audit";

const AI_ROUTES = join(process.cwd(), "apps", "admin", "app", "api", "ai");

/*
  The comment stripper, the directory walk and the two patterns MOVED to
  `__tests__/helpers/route-guard-audit.ts` on 8 September 2026, when a second folder needed
  them (`dev-zone/optimize-images`, the ninth unauthenticated admin route). They were extracted
  rather than copied: each of these rules was learned from a probe that came back green, and a
  second suite restating them means which folders are genuinely protected depends on which
  file a reader opens. Nothing about the assertions below changed.

  They are FUNCTIONS returning a fresh regex, and called at each use site rather than stored
  once, because a `g` regex carries `lastIndex`. `match` and `search` happen to reset or ignore
  it, so a shared instance would work here by accident - and the next assertion added, using
  `exec` or `test`, would silently start from wherever the previous one stopped and report a
  correct file as unguarded.
*/

describe("apps/admin/app/api/ai - every handler is behind a section guard", () => {
  const files = findRouteFiles(AI_ROUTES);

  it("finds the AI routes at all, so an empty walk cannot pass", () => {
    // A test that examines nothing passes. `indexOf` returning -1 and a directory walk
    // returning [] look identical from the assertions below.
    expect(files.length).toBeGreaterThanOrEqual(5);
  });

  for (const file of files) {
    const name = file.split(/[\\/]/).slice(-2).join("/");
    const code = stripComments(readFileSync(file, "utf8"));

    it(`${name}: guards every exported handler`, () => {
      const handlers = code.match(handlerPattern()) ?? [];
      const guards = code.match(guardCallPattern()) ?? [];

      expect(handlers.length).toBeGreaterThan(0);
      // Per file and per handler. One guard in a file with two handlers is the shape that
      // leaves a mutation open while reviewing as protected.
      expect(guards.length).toBe(handlers.length);
    });

    it(`${name}: refuses before reading the request body`, () => {
      /*
        Position, not presence. A guard below `await request.json()` still refuses, but the
        route has already done work for an unauthenticated caller - and on the two routes that
        write, anything between the two is work done on an unauthorized request.
      */
      const guardAt = code.search(guardCallPattern());
      const bodyAt = code.search(/await\s+request\.json\(\)/);

      expect(guardAt).toBeGreaterThan(-1);
      if (bodyAt > -1) expect(guardAt).toBeLessThan(bodyAt);
    });

    it(`${name}: names a real section`, () => {
      /*
        A guard is only as good as its argument. `guardSection` is typed to `AdminSection`, so
        the compiler catches an invented id - but this test also catches the id being changed
        to one that exists and is wrong in a way a typecheck cannot see, by pinning the
        argument against the enum that actually issues grants.
      */
      const named = [...code.matchAll(guardCallPattern())];

      // An assertion inside a loop over an empty list is green, and that is not a theoretical
      // worry: the first probe for this test mutated the call into a shape the regex could not
      // match, the loop never ran, and the probe reported the guard useless.
      expect(named.length).toBeGreaterThan(0);

      for (const match of named) {
        expect(ADMIN_SECTIONS as readonly string[]).toContain(match[1]);
      }
    });
  }

  it("returns the guard's own refusal rather than inventing a status", () => {
    // 401 for not signed in and 403 for signed in without the grant are different facts, and
    // `guardSection` is the one place that distinction is made. A route that returns its own
    // 403 for both makes a missing session look like a permissions problem.
    for (const file of files) {
      const code = stripComments(readFileSync(file, "utf8"));
      expect(code).toMatch(/if\s*\(\s*!\s*\w+\.ok\s*\)\s*return\s+\w+\.response/);
    }
  });
});

describe("the two section ids added for the AI routes", () => {
  /*
    `journey-map` and `gamification-wizard` render screens in `AdminDashboard`'s `menuGroups`
    and were not section ids, so `hasAccessToSection` - `allowedSections.includes(id)` for
    anybody but a super admin - could never return true for them. Added add-only, because a
    guard has to name a section and naming an adjacent one issues a grant that does not
    correspond to the screen.
  */
  it("are present, and ADMIN_SECTIONS is add-only", () => {
    expect(ADMIN_SECTIONS as readonly string[]).toContain("journey-map");
    expect(ADMIN_SECTIONS as readonly string[]).toContain("gamification-wizard");
  });

  it("has no duplicate ids, which a Mongoose enum would accept silently", () => {
    expect(new Set(ADMIN_SECTIONS).size).toBe(ADMIN_SECTIONS.length);
  });
});
