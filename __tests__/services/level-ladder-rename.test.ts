import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  TITLE_LEVELS,
  levelEntryForXP,
  type TitleLevel,
} from "@/lib/constants/levels";
import { resolveLevelName, resolveLevelTitle } from "@/lib/utils/level-title";

/*
  R88 - a renamed level ladder must reach every screen.
  R89 - the routes that read and write that ladder must be authorized.

  The defect: two functions are called `getTitleByXP`. The async one in
  `lib/services/xp-config.service.ts` reads the operator's ladder out of `XPConfig`; the
  synchronous one in `lib/constants/levels.ts` reads a hard-coded twenty-entry array. The
  XP award path used the database one and cached its answer on `UserLevel.currentTitle`,
  while the read sites recomputed from the constant. So renaming the ladder in admin
  changed the profile and left every leaderboard saying "Novice Trader" - no error, no log
  line, and the paid-entry level gate refusing on thresholds nobody had configured.

  Most of what follows is BEHAVIOURAL on the resolver plus STRUCTURAL on the call sites,
  because there is no wrong number to assert on: every site computed a correct level from
  the ladder it happened to pick, and the whole defect is WHICH ladder that was.
*/

const root = join(__dirname, "..", "..");

function read(relative: string): string {
  return readFileSync(join(root, relative), "utf8");
}

/** Match the source with comments removed - every file here discusses R88 in prose. */
function readCode(relative: string): string {
  return read(relative)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

/*
  A three-rung ladder an operator has renamed and re-thresholded.

  Annotated `TitleLevel[]` rather than left to inference, and that is load-bearing rather
  than tidiness: the resolver's contract is that the ICON and COLOUR come from the code
  ladder and never from the operator's row, so a fixture carrying an icon name the asset
  map does not have would sail through every assertion here. The first draft said
  `icon: "medal"`, which is not a key of `GAME_ICONS` at all, and the only symptom was
  seven errors at the CALL SITES several tests below - the shape of a fixture never being
  checked against the type it is standing in for.
*/
const renamed: TitleLevel[] = [
  {
    level: 1,
    title: "Rookie Racer",
    minXP: 0,
    maxXP: 499,
    color: "text-gray-400",
    icon: "starBadge",
    description: "",
  },
  {
    level: 2,
    title: "Circuit Regular",
    minXP: 500,
    maxXP: 1999,
    color: "text-blue-400",
    icon: "medal7",
    description: "",
  },
  {
    level: 3,
    title: "Track Legend",
    minXP: 2000,
    maxXP: Infinity,
    color: "text-amber-400",
    icon: "victory",
    description: "",
  },
];

describe("resolveLevelTitle - the operator's ladder is authoritative", () => {
  /*
    // Reason: this is the defect itself. `currentTitle` is a cache written at XP-award
    // time, so it is stale from the instant the ladder is renamed until the player next
    // earns XP. The fixture deliberately makes the two DISAGREE - with both saying the
    // same thing the wrong branch produces the right answer and the test proves nothing.
  */
  it("prefers the ladder's name over the cached currentTitle", () => {
    const display = resolveLevelTitle(
      { currentXP: 600, currentLevel: 2, currentTitle: "Novice Trader" },
      renamed,
    );

    expect(display.title).toBe("Circuit Regular");
  });

  /*
    // Reason: the stored level number is the same cache one field along. An operator who
    // moves a threshold leaves every stored level wrong until the next award, and the
    // paid-entry gate compares against it.
  */
  it("derives the level from XP against the ladder, not from the stored level", () => {
    const display = resolveLevelTitle(
      { currentXP: 2500, currentLevel: 2, currentTitle: "Novice Trader" },
      renamed,
    );

    expect(display.level).toBe(3);
    expect(display.title).toBe("Track Legend");
  });

  /*
    // Reason: the cache is the better answer in exactly one case, and getting the fixture
    // right here took two attempts. An EMPTY ladder does not reach this branch at all -
    // `levelEntryForXP` falls back to the code ladder, so the entry is always named and
    // the first version of this test passed with the fallback deleted. The reachable case
    // is an operator who has saved a rung with a BLANK title, which is what a half-filled
    // row in the level editor leaves behind. Dropping the cache then replaces a real
    // historical title with "Level 2" on every screen the player appears on.
  */
  it("falls back to the cached title when the ladder cannot name the level", () => {
    const blankRung = [{ ...renamed[1], title: "   " }];

    const display = resolveLevelTitle(
      { currentXP: 600, currentLevel: 2, currentTitle: "Market Wizard" },
      blankRung,
    );

    expect(display.title).toBe("Market Wizard");
  });

  it("renders a player who has never earned XP rather than omitting them", () => {
    const display = resolveLevelTitle(null, renamed);

    expect(display.level).toBe(1);
    expect(display.title).toBe("Rookie Racer");
  });

  /*
    // Reason: `GameIconName` is a union of committed SVG assets and `color` is a Tailwind
    // class that has to exist in the compiled stylesheet. An operator-typed string for
    // either draws nothing while reviewing as perfectly correct, so the artwork is matched
    // out of the CODE ladder by level number and the database entry's own values are
    // ignored. Renaming is content; artwork needs code support.
  */
  it("takes the icon and colour from the code ladder, never the operator's entry", () => {
    const hostile = [
      {
        ...renamed[0],
        icon: "not-an-asset" as never,
        color: "text-does-not-exist",
      },
    ];

    const display = resolveLevelTitle({ currentXP: 0 }, hostile);

    expect(display.icon).toBe(TITLE_LEVELS[0].icon);
    expect(display.color).toBe(TITLE_LEVELS[0].color);
  });

  /*
    // Reason: every caller hands the resolver a `.lean()` row, which skips hydration and
    // is typed `FlattenMaps<any>` - so the compiler cannot check that `currentXP` is a
    // number. A NaN total would place the player arbitrarily rather than at rung one.
    //
    // The EXPECTED RUNG is asserted rather than merely that the answer is finite and
    // named, so this states the contract rather than that nothing threw.
    //
    // It is NOT PROBEABLE and the coercion is clarity rather than a fix - said here
    // rather than left implied, because an overstated comment is a wrong fact. JavaScript
    // coerces both sides of `xp >= entry.minXP` anyway, and an unparseable total makes
    // every comparison false and falls through the scan to rung one, which is the same
    // answer `?? 0` produces. Removing `numeric` changes none of the five rows below. It
    // stays because the accident holds only for this scan: a reader that compared with
    // `<`, or took an average, would be silently wrong on a `NaN` total.
  */
  it.each([
    ["a string", "600", 2],
    ["not a number", "abc", 1],
    ["null", null, 1],
    ["absent", undefined, 1],
    ["NaN", Number.NaN, 1],
  ])("coerces an XP total stored as %s", (_label, currentXP, expected) => {
    const display = resolveLevelTitle({ currentXP }, renamed);

    expect(display.level).toBe(expected);
  });
});

describe("resolveLevelName - naming a level with no player to scan", () => {
  /*
    // Reason: `ladder[level - 1]` is the position form. It THROWS on a ladder an operator
    // has shortened and names the WRONG rung on one they have reordered - and the level
    // gate quotes this string to a player being refused paid entry.
  */
  it("matches on the level number, not on array position", () => {
    const reordered = [renamed[2], renamed[0], renamed[1]];

    expect(resolveLevelName(2, reordered)).toBe("Circuit Regular");
  });

  it("falls back to the code ladder, then to a plain level number", () => {
    expect(resolveLevelName(2, [])).toBe(
      TITLE_LEVELS.find((e) => e.level === 2)?.title,
    );
    expect(resolveLevelName(99, [])).toBe("Level 99");
  });
});

describe("levelEntryForXP - the one definition of the XP to level rule", () => {
  /*
    // Reason: this scan existed four times over - here, in `xp-config.service.ts` against
    // the database ladder, and in both apps' copies of each. The database copy also read
    // `levels[0]` unguarded, so an operator saving an empty level list took down every
    // leaderboard and the paid-entry gate with an undefined read.
  */
  it("falls back to the code ladder when the operator's is empty", () => {
    expect(levelEntryForXP(600, []).level).toBe(
      levelEntryForXP(600, TITLE_LEVELS).level,
    );
  });

  it("places an XP total below the first threshold on the first rung", () => {
    expect(levelEntryForXP(-50, renamed).level).toBe(1);
  });
});

/*
  The read sites. Each of these recomputed the title from the hard-coded array, so each is
  pinned to the resolver by NAME AND ARGUMENT rather than by a bare identifier - an import
  line alone satisfies a whole-file match, which is how three assertions were defeated in
  `12` s4.2a.
*/
const READ_SITES = [
  "app/api/leaderboard/route.ts",
  "lib/actions/trading/competition.actions.ts",
  "lib/services/contest-entry/guards.ts",
  "app/(root)/competitions/[id]/page.tsx",
  "apps/admin/lib/actions/leaderboard/global-leaderboard.actions.ts",
  "apps/admin/lib/actions/trading/competition.actions.ts",
  /*
    The sixth site, and it was absent from this list while the suite passed 50 tests -
    which is how half of R88 survived on it. `getComprehensiveDashboardData` was fixed to
    resolve `level` and `title` through the helper and left `titleColor` and `titleIcon`
    reading the award-time cache, so the dashboard named the operator's new rung and
    painted it in the old one's colour. The list is the guard; a site missing from it is
    not guarded, whatever the total test count says.
  */
  "lib/actions/comprehensive-dashboard.actions.ts",
];

describe("every read site resolves through the shared helper", () => {
  it.each(READ_SITES)("%s calls resolveLevelTitle", (relative) => {
    expect(readCode(relative)).toMatch(/resolveLevelTitle\s*\(/);
  });

  /*
    // Reason: the resolver needs the operator's ladder passed in - it cannot read the
    // database itself, being model-free so the admin client bundle can import it (R58).
    // A site that calls the resolver and lets the default parameter apply is back to the
    // constant, which is the defect wearing the fix's name.
  */
  it.each(READ_SITES)("%s reads the ladder it resolves against", (relative) => {
    expect(readCode(relative)).toMatch(/getTitleLevels\s*\(/);
  });

  /*
    // Reason: the ladder is one read per BOARD, not one per row. Resolving inside the row
    // map would issue a database read per participant, which is the shape that made
    // `getComprehensiveDashboardData` unpollable.
  */
  it.each(READ_SITES)("%s reads the ladder once, not per row", (relative) => {
    const code = readCode(relative);
    const reads = code.match(/getTitleLevels\s*\(/g) ?? [];

    expect(reads.length).toBe(1);
  });
});

/*
  One read site keeps the literal, and it is a DIFFERENT CONCEPT that happens to share the
  words. `app/(root)/competitions/[id]/page.tsx` also holds `getDifficultyData`'s map from a
  contest's `difficulty.manualLevel` to a difficulty band label - an operator's description
  of how hard a CONTEST is, which has no relationship to `XPConfig` and must not follow the
  player ladder when one is renamed. Renaming the ladder to "Rookie" must not relabel a
  contest's difficulty.

  So the ban is positional for that file rather than dropped: the literal may appear inside
  the difficulty map and nowhere else. The canary below asserts the exemption is STILL
  needed, on the R60 precedent - a stale exemption reads as a known problem long after it is
  solved and silently re-permits the defect in the one file it covers. When X6.5's wording
  pass tokenises those difficulty bands, this goes red and the exemption gets deleted.
*/
const DIFFICULTY_MAP_SITE = "app/(root)/competitions/[id]/page.tsx";

function withoutDifficultyMap(code: string): string {
  const open = code.indexOf("const levelMap: Record<");
  const close = code.indexOf("const mapped = levelMap[", open + 1);
  // A slice taken against a marker that has moved returns -1, and `slice(0, -1)` hands back
  // almost the whole file with every assertion trivially true. Both ends are proven, and
  // the canary below fails when the slice covers nothing.
  if (open === -1 || close === -1 || close <= open) return code;
  return code.slice(0, open) + code.slice(close);
}

describe("no read site names a hard-coded rung", () => {
  it.each(READ_SITES)("%s", (relative) => {
    const code = readCode(relative);
    expect(
      relative === DIFFICULTY_MAP_SITE ? withoutDifficultyMap(code) : code,
    ).not.toMatch(/Novice Trader/);
  });

  it("the difficulty-band exemption is still an offender", () => {
    const code = readCode(DIFFICULTY_MAP_SITE);
    // Both halves, or the slice silently covering nothing looks like a working exemption.
    expect(code).toMatch(/Novice Trader/);
    expect(withoutDifficultyMap(code)).not.toBe(code);
  });
});

/*
  The dashboard's `player` object, guarded per FIELD rather than per file.

  Calling the resolver is not using its answer. This site called `resolveLevelTitle`, read
  `level` and `title` off it, and then took `titleColor` and `titleIcon` from the
  award-time cache two lines below - so every assertion above passes against it, because
  the resolver is named and the ladder is read. A rung's name, colour and icon are one
  fact; the only guard that can see them disagree is one that reads all four.

  The negative half is the load-bearing one: a version that resolves correctly and then
  overrides a field from the cache satisfies the positive assertions exactly.
*/
const DASHBOARD_SITE = "lib/actions/comprehensive-dashboard.actions.ts";

function dashboardPlayerObject(code: string): string {
  /*
    `lastIndexOf`, not `indexOf`. There are two `player: {` in this file - the RETURN TYPE
    declaration near the top and the object literal at the bottom - and `indexOf` matches
    leftmost-first, so the first spelling of this helper sliced the type declaration and
    reported `titleIcon: string;` as failing to read the resolver. A guard that fails on
    correct code is the one the next reader deletes.
  */
  const open = code.lastIndexOf("player: {");
  // Reason: `globalRank` is the last field of the object. Sliced to a marker inside it
  // rather than to a closing brace, because the object contains nested ones.
  const close = code.indexOf("globalRank", open + 1);

  // Both ends proven. A slice against a marker that has moved returns -1, and the
  // resulting `slice(0, -1)` hands back almost the whole file with every assertion
  // trivially true - the same trap that made three guards useless in `21` s4.1r.
  expect(open).toBeGreaterThan(-1);
  expect(close).toBeGreaterThan(open);

  const slice = code.slice(open, close);
  // And proven to be the LITERAL rather than the type, so a third `player: {` appearing
  // below cannot quietly send this back to asserting things about a type declaration.
  expect(slice).not.toMatch(/level:\s*number;/);
  return slice;
}

describe("R88 - the dashboard's rung is one fact from one place", () => {
  it.each(["level", "title", "titleColor", "titleIcon"])(
    "%s comes from the resolver",
    (field) => {
      const player = dashboardPlayerObject(readCode(DASHBOARD_SITE));
      expect(player).toMatch(
        new RegExp(`${field}:\\s*(levelDisplay\\.|levelDisplay\\b)`),
      );
    },
  );

  it.each(["currentTitle", "currentColor", "currentIcon", "currentLevel"])(
    "does not read %s off the award-time cache",
    (cached) => {
      const player = dashboardPlayerObject(readCode(DASHBOARD_SITE));
      expect(player).not.toMatch(new RegExp(`\\.${cached}\\b`));
    },
  );

  /*
    The icon and colour must not come from the PROGRESS entry either, which is the obvious
    repair and is wrong: `calculateXPProgress` returns a `TitleLevel` read out of the
    operator's `XPConfig` row, and an operator-typed `GameIconName` is not a committed SVG
    while an operator-typed colour is not in the compiled stylesheet. Both draw nothing
    while reviewing as correct.
  */
  it("does not take presentation from the progress calculation", () => {
    const code = readCode(DASHBOARD_SITE);
    expect(code).not.toMatch(/currentLevel\s*\.\s*(icon|color|title)/);
  });

  /*
    A canary for the deletion beside the fix. The discarded `calculateXPProgress(0)` in
    the parallel fetch cost two `XPConfig` round trips for a value nothing read. If a
    second call reappears, this action is paying for the ladder twice again.
  */
  it("computes progress once", () => {
    const code = readCode(DASHBOARD_SITE);
    const calls = code.match(/calculateXPProgress\s*\(/g) ?? [];
    expect(calls.length).toBe(1);
  });
});

describe("the resolver stays importable from a client bundle", () => {
  /*
    // Reason: R58 - a `"use client"` file may not name a driver-reaching module in a
    // value-import position, and this module is imported by admin screens. It must reach
    // no model and no service.
  */
  it("imports no model and no database service", () => {
    const code = readCode("lib/utils/level-title.ts");

    expect(code).not.toMatch(/database\/models/);
    expect(code).not.toMatch(/xp-config\.service/);
    expect(code).not.toMatch(/\bmongoose\b/);
  });
});

describe("the mirrored copy is byte-identical", () => {
  /*
    // Reason: `check:mirrors` compares MODELS. It has never had an opinion about a
    // utility module, so two copies of this resolver could disagree about which ladder
    // wins and every existing guard would stay green.
  */
  it("apps/admin/lib/utils/level-title.ts matches the main copy", () => {
    expect(read("apps/admin/lib/utils/level-title.ts")).toBe(
      read("lib/utils/level-title.ts"),
    );
  });

  it("apps/admin/lib/constants/levels.ts matches the main copy", () => {
    expect(read("apps/admin/lib/constants/levels.ts")).toBe(
      read("lib/constants/levels.ts"),
    );
  });
});

/*
  R89 - the badge and XP routes.

  Four routes under `apps/admin/app/api/` had no authorization of any kind. Two of them
  WRITE: `badges-xp/manage` rebalances the level ladder and badge XP values, and
  `seed-badges-xp` force-resets both - on GET as well as POST, so a crawler could have
  done it. `badges-xp` hands out a paginated list of users. `debug-levels` exposes the
  configured ladder.

  Found by COUNTING exported handlers against guard calls, which is the only method that
  works here: every route in the folder looks like its neighbours, and the neighbours that
  do have a guard are what carry a reader past the ones that do not.
*/
const XP_ROUTES = [
  "apps/admin/app/api/badges-xp/route.ts",
  "apps/admin/app/api/badges-xp/manage/route.ts",
  "apps/admin/app/api/seed-badges-xp/route.ts",
  "apps/admin/app/api/debug-levels/route.ts",
];

describe("R89 - the level ladder routes are authorized", () => {
  it.each(XP_ROUTES)("%s guards every exported handler", (relative) => {
    const code = readCode(relative);
    const handlers =
      code.match(/export\s+async\s+function\s+(GET|POST|PATCH|PUT|DELETE)\b/g) ??
      [];
    const guards = code.match(/guardSection\s*\(/g) ?? [];

    /*
      // Reason: a file whose POST is guarded and whose GET is not passes any assertion
      // that merely MENTIONS the helper, while leaving a mutation wide open. Counting is
      // what catches that - and `seed-badges-xp` is exactly that shape, its GET being
      // just as destructive as its POST.
    */
    expect(handlers.length).toBeGreaterThan(0);
    expect(guards.length).toBe(handlers.length);
  });

  /*
    // Reason: `requireAdminAuth` / `verifyAdminAuth` ask only whether the caller is an
    // admin at all, so an employee granted one unrelated section passes. The grant is
    // per-section, and these screens are granted by `badges`.
  */
  it.each(XP_ROUTES)("%s asks for the badges section, not admin-at-all", (relative) => {
    expect(readCode(relative)).toMatch(/guardSection\(\s*["']badges["']\s*\)/);
  });
});
