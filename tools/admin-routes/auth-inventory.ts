/**
 * Report which admin API routes ask what about authorization.
 *
 * `npm run audit:admin-routes` - report-only, writes nothing, changes nothing.
 *
 * WHY THIS IS A COMMITTED TOOL RATHER THAN A SCRATCH SCRIPT. R101's figure moved four times
 * in two days - 100, 99, 97, then 83 - and not one of those moves was a code change. Each was
 * the CLASSIFIER changing, as the scan learned to strip comments, to recognise `export const`
 * handlers, and to count `getAdminSession` and `auth.api.getSession` as authentication. A
 * figure arrived at by a method nobody can re-run is a figure nobody can check, and the
 * arithmetic on record was wrong twice because of it. So the method ships beside the number,
 * it imports the same classifier the test suite asserts against, and regenerating the frozen
 * lists in `__tests__/admin/admin-route-auth-inventory.test.ts` is one command rather than an
 * afternoon of grep.
 *
 * FOUR CLASSES, AND THE THIRD IS THE ONE THAT HID EIGHT FILES. A route is section-granted, or
 * it calls a helper that never asks about grants, or it hand-verifies a JWT and so calls no
 * helper at all while looking more careful than one that does, or it checks nothing. The
 * middle two both read as "guarded" to a reviewer and as "unguarded" to a grep, which is
 * exactly why counting one axis kept producing a different answer.
 */

import { readFileSync } from "fs";
import { join, relative, sep } from "path";

import {
  anyAuthHelperPattern,
  classifyRouteAuth,
  findRouteFiles,
  handlerPattern,
  handlerSlices,
  mutatingDbCallPattern,
  stripComments,
  type RouteAuthClass,
} from "../../__tests__/helpers/route-guard-audit";

export const ADMIN_API_ROOT = join(process.cwd(), "apps", "admin", "app", "api");

const ASSET_REASON =
  "Serves bytes that are already public on the player site. GET only, the path is reduced " +
  "to `path.basename`, and the `writeFile` in it is a disk restore of a file already in our " +
  "own database rather than an upload - the caller supplies a filename and can receive only " +
  "something we already store.";

/**
 * Routes meant to be reachable without a session, with the reason each one is.
 *
 * This is the only list here that is a JUDGEMENT rather than a measurement, so every entry
 * carries why - an unexplained carve-out is indistinguishable from a route somebody could not
 * be bothered to guard, and it is the shape a privilege hole hides in for a year. Each was
 * read before being listed.
 */
export const PUBLIC_BY_DESIGN: Record<string, string> = {
  "auth/check-session/route.ts":
    "It IS the session check. Guarding it means a signed-out caller cannot be told they are signed out.",
  "auth/login/route.ts":
    "The sign-in itself. Rate-limited, and the password is compared with bcrypt.",
  "gamemaster-auth/login/route.ts": "The Game Master sign-in itself.",
  "gamemaster-auth/logout/route.ts":
    "Clears the caller's own cookie. It can do nothing to anybody else.",
  "assets/game-icons/[filename]/route.ts": ASSET_REASON,
  "assets/hero/[filename]/route.ts": ASSET_REASON,
  "assets/images/[filename]/route.ts": ASSET_REASON,
  "assets/marketplace/[filename]/route.ts": ASSET_REASON,
  "tutorials/videos/[filename]/route.ts": ASSET_REASON,
  "tutorials/videos/thumbnails/[filename]/route.ts": ASSET_REASON,
};

/** The six above that must stay read-only, because a write method on one would be an upload. */
export const READ_ONLY_PUBLIC = Object.keys(PUBLIC_BY_DESIGN).filter(
  (name) => name.startsWith("assets/") || name.startsWith("tutorials/videos/"),
);

export interface RouteAuthFinding {
  /** Path relative to the admin API root, forward-slashed on every platform. */
  route: string;
  klass: RouteAuthClass;
  /** `GET`, `POST`, ... in source order. */
  methods: string[];
}

/** Every admin route with at least one exported handler, classified. */
export function inventoryAdminRoutes(root = ADMIN_API_ROOT): RouteAuthFinding[] {
  const findings: RouteAuthFinding[] = [];

  for (const file of findRouteFiles(root)) {
    const code = stripComments(readFileSync(file, "utf8"));
    const methods = [...code.matchAll(handlerPattern())].map((match) => match[1]);
    if (methods.length === 0) continue;

    findings.push({
      route: relative(root, file).split(sep).join("/"),
      klass: classifyRouteAuth(code),
      methods,
    });
  }

  return findings.sort((a, b) => a.route.localeCompare(b.route));
}

/**
 * Handlers that authenticate only AFTER changing stored data.
 *
 * Not a refinement of "is there a guard" - it is the difference between a weak check and no
 * check at all, because a helper called after the write has already let the write happen.
 * `users/edit` sat in the helper-no-grant class for that reason and was in fact wide open.
 *
 * Per HANDLER, never per file: a file whose `GET` authenticates first and whose `PATCH` writes
 * first passes any file-wide position comparison, which is the same count-per-handler rule the
 * guard suites learned from a green probe.
 */
export function handlersAuthenticatingAfterAWrite(root = ADMIN_API_ROOT): string[] {
  const late: string[] = [];

  for (const file of findRouteFiles(root)) {
    const code = stripComments(readFileSync(file, "utf8"));
    const route = relative(root, file).split(sep).join("/");

    for (const { method, body } of handlerSlices(code)) {
      const auth = body.search(anyAuthHelperPattern());
      const write = body.search(mutatingDbCallPattern());
      if (auth >= 0 && write >= 0 && auth > write) {
        late.push(`${route}#${method}`);
      }
    }
  }

  return late.sort();
}

/** The routes of one class, with the public-by-design carve-outs removed. */
export function routesOfClass(
  findings: RouteAuthFinding[],
  klass: RouteAuthClass,
): string[] {
  return findings
    .filter((finding) => finding.klass === klass)
    .filter((finding) => !(finding.route in PUBLIC_BY_DESIGN))
    .map((finding) => finding.route);
}

function main(): void {
  const findings = inventoryAdminRoutes();
  const carvedOut = findings.filter((finding) => finding.route in PUBLIC_BY_DESIGN);

  const groups: [string, string[]][] = [
    ["NO CHECK OF ANY KIND", routesOfClass(findings, "no-check")],
    ["HAND-VERIFIED TOKEN, NO GRANT", routesOfClass(findings, "hand-verified-no-grant")],
    ["HELPER BUT NO GRANT", routesOfClass(findings, "helper-no-grant")],
    ["SECTION-GRANTED", routesOfClass(findings, "section-granted")],
  ];

  console.log(`\n${findings.length} admin API routes with exported handlers`);
  console.log(`${carvedOut.length} carved out as public by design\n`);

  for (const [label, list] of groups) {
    console.log(`${label}: ${list.length}`);
    if (process.argv.includes("--list")) {
      console.log(list.map((route) => `    "${route}",`).join("\n"));
    }
  }

  const late = handlersAuthenticatingAfterAWrite();
  console.log(`\nAUTHENTICATING AFTER A DATABASE WRITE: ${late.length}`);
  if (late.length > 0) {
    console.log(late.map((entry) => `    "${entry}",`).join("\n"));
  }
}

// Reason: guarded so the test suite can import the classifier without printing a report.
if (process.argv[1]?.includes("auth-inventory")) main();
