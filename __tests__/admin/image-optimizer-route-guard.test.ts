/**
 * The Image Optimizer's route must be behind the grant that reveals its screen.
 *
 * WHAT WAS WRONG. Until 8 September 2026 `apps/admin/app/api/dev-zone/optimize-images/route.ts`
 * had **no authorization of any kind on either handler**. The *screen* is gated - the
 * `image-optimizer` tab is filtered out of `menuGroups` for an employee without the grant - so
 * it read as protected, and that is precisely the arrangement that hides an open route: the
 * guard was on the thing the reviewer could see.
 *
 * WHY IT IS WORSE THAN A READ. The `POST` handler re-encodes files in place and then `unlink`s
 * the original, across `public/uploads` and `public/assets/avatars` - marketplace uploads,
 * avatars, cosmetics, indicators and strategies. An image whose only copy was on that disk is
 * gone. And a route with no guard has no attribution, so whether it was ever called is
 * unanswerable; the absence of evidence is not reassurance.
 *
 * HOW IT WAS FOUND, which is the part that generalises: by **counting exported handlers
 * against guards**, not by reading routes. Every neighbouring route in the admin app has
 * *something*, and that is exactly what sends a reader straight past the one that has nothing.
 * Same method as R40's unauthenticated `finalize-old-competitions`, R47's `sync-referrals` and
 * R51's five AI routes. This is the ninth route of that class.
 *
 * The rules these assertions rest on live in `__tests__/helpers/route-guard-audit.ts` and are
 * deliberately imported rather than restated - see that file's header for why.
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
  stripComments,
} from "../helpers/route-guard-audit";

const DEV_ZONE = join(process.cwd(), "apps", "admin", "app", "api", "dev-zone");

/**
 * Any helper that establishes the caller is an admin at all.
 *
 * `guardSection` is the only one that also checks the *grant*, and the rest are the weaker
 * form this programme has now corrected eight times. They are accepted by the folder-wide
 * assertion below on purpose - see that block's comment for why the weak property is the one
 * worth asserting across a directory.
 */
function authCallPattern(): RegExp {
  return /(guardSection|verifyAdminAuth|requireAdminAuth|requireSectionAccess|verifyAdminToken)\s*\(/g;
}

describe("apps/admin/app/api/dev-zone - no handler is reachable unauthenticated", () => {
  const files = findRouteFiles(DEV_ZONE);

  it("finds the dev-zone routes at all, so an empty walk cannot pass", () => {
    // A test that examines nothing passes, and a directory walk returning [] is
    // indistinguishable from every file being correct.
    expect(files.length).toBeGreaterThan(0);
    expect(files.some((f) => f.includes("optimize-images"))).toBe(true);
  });

  for (const file of files) {
    const name = file.split(/[\\/]/).slice(-2).join("/");
    const code = stripComments(readFileSync(file, "utf8"));

    it(`${name}: authenticates every exported handler`, () => {
      /*
        THIS ASSERTS THE WEAK PROPERTY DELIBERATELY, and the reason is the whole design of this
        block. The strong property - every handler behind `guardSection` - is false for this
        folder today: `dependency-check` authenticates all three of its handlers with
        `verifyAdminAuth`, which is admin-at-all rather than section access. That is the same
        class of defect corrected eight times elsewhere, but converting it means choosing a
        section id and deciding which existing employees keep the screen, which is an owner
        decision rather than a mechanical fix. It is recorded below rather than quietly
        permitted by an allow-list.

        What the weak form still buys, and it is the thing that matters: a route added to this
        folder with NO authorization at all turns this red. That is the exact defect
        `optimize-images` shipped with, and the exact one that a per-file allow-list would let
        through on the day it appeared.
      */
      const handlers = code.match(handlerPattern()) ?? [];
      const guards = code.match(authCallPattern()) ?? [];

      expect(handlers.length).toBeGreaterThan(0);
      // Per handler, not per file. One guard in a file with two handlers is the shape that
      // leaves the destructive one open while reviewing as protected - and that is the exact
      // shape this route would have had if only the GET had been fixed.
      expect(guards.length).toBeGreaterThanOrEqual(handlers.length);
    });

    it(`${name}: any section it names is a real one`, () => {
      // Scoped to the ids actually present, so a route using the weaker helper is not failed
      // here for a decision recorded elsewhere.
      for (const section of guardedSections(code)) {
        expect(ADMIN_SECTIONS as readonly string[]).toContain(section);
      }
    });
  }

  it("records dependency-check as still using the weaker helper", () => {
    /*
      A tripwire pointing the right way. If somebody strengthens `dependency-check` to
      `guardSection`, this goes red and the reader is sent to delete it and tighten the
      folder-wide assertion above to the strong property - at which point the weak form can go
      entirely. Left as a passing test that states a known gap, it would be indistinguishable
      from the gap having been closed.
    */
    const code = stripComments(
      readFileSync(join(DEV_ZONE, "dependency-check", "route.ts"), "utf8"),
    );

    expect(code).toMatch(/verifyAdminAuth\s*\(/);
    expect(guardedSections(code)).toEqual([]);
  });
});

describe("the optimizer refuses before it touches the filesystem", () => {
  const route = join(DEV_ZONE, "optimize-images", "route.ts");
  const code = stripComments(readFileSync(route, "utf8"));

  it("guards the POST before reading the body", () => {
    /*
      Position, not presence. A guard placed below `await request.json()` still refuses, but
      the route has already parsed an unauthenticated caller's body by then. Sliced from the
      POST onwards rather than searched whole-file, because the GET's guard appears earlier in
      the file and would satisfy a naive `search` while the POST's was missing entirely.
    */
    const postAt = code.indexOf("export async function POST");
    expect(postAt).toBeGreaterThan(-1);

    const post = code.slice(postAt);
    // A slice that found the wrong thing passes everything asked of it, so assert it is real.
    expect(post.length).toBeGreaterThan(200);

    const guardAt = post.search(guardCallPattern());
    const bodyAt = post.search(/await\s+request\.json\(\)/);

    expect(guardAt).toBeGreaterThan(-1);
    expect(bodyAt).toBeGreaterThan(-1);
    expect(guardAt).toBeLessThan(bodyAt);
  });

  it("guards the POST before anything is deleted or written", () => {
    /*
      The assertion that actually matters. `unlink` removes the only copy of an uploaded file,
      so the ordering against the write and the delete is the property, and it is stated
      separately from the body check above: a guard could sit after `request.json()` and still
      be before `unlink`, which is a real but much smaller defect than the one this pins.
    */
    const postAt = code.indexOf("export async function POST");
    const post = code.slice(postAt);
    expect(post.length).toBeGreaterThan(200);

    const guardAt = post.search(guardCallPattern());
    expect(guardAt).toBeGreaterThan(-1);

    for (const destructive of ["unlink(", "writeFile("]) {
      const at = post.indexOf(destructive);
      expect(at, `${destructive} not found in the POST handler`).toBeGreaterThan(-1);
      expect(guardAt).toBeLessThan(at);
    }
  });

  it("guards both handlers with the strong helper, not merely authenticates them", () => {
    /*
      The strong property, asserted on this route specifically because it is true here and not
      folder-wide. `verifyAdminAuth` would satisfy the block above and is NOT enough: it asks
      only whether the caller is an admin at all, so an employee granted one unrelated section
      would pass it and could delete the upload tree.
    */
    const handlers = code.match(handlerPattern()) ?? [];
    expect(handlers.length).toBe(2);
    expect(guardedSections(code)).toHaveLength(2);
    expect(code).not.toMatch(/verifyAdminAuth\s*\(/);
  });

  it("returns the guard's own refusal, once per guard, rather than inventing a status", () => {
    /*
      401 for not signed in and 403 for signed in without the grant are different facts, and
      `guardSection` is the one place that distinction is made. A route returning its own 403
      for both makes a missing session look like a permissions problem.

      COUNTED, NOT MATCHED, and a probe is why. `toMatch` over the whole file stayed green when
      the POST's refusal was deleted, because the GET still had one - the same identifier
      appearing twice defeating a structural test, after `!expectedOrigin`, the fixed-character
      Edit guard, `canTransitionRound` and `MIN_REASON_LENGTH`. A guard whose result is
      discarded reads perfectly and authorizes nothing, so the pairing is the property: one
      refusal for every `guardSection` call.
    */
    const guards = code.match(guardCallPattern()) ?? [];
    const refusals =
      code.match(/if\s*\(\s*!\s*\w+\.ok\s*\)\s*return\s+\w+\.response/g) ?? [];

    expect(guards.length).toBe(2);
    expect(refusals.length).toBe(guards.length);
  });

  it("uses the section that reveals the screen, not an adjacent one", () => {
    /*
      `guardSection` is typed to `AdminSection`, so the compiler already refuses an invented
      id. What it cannot see is an id that exists and is wrong - naming `database` or
      `dev-zone-menu` here would compile, review as plausible, and issue the wrong grant. The
      id has to be the one `AdminDashboard` filters this tab on.
    */
    expect(guardedSections(code)).toEqual([
      "image-optimizer",
      "image-optimizer",
    ]);
  });
});
