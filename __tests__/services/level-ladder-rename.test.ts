import { readFileSync, readdirSync } from "node:fs";
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

/* ------------------------------------------------------------------------------------ *
   R90 - a rung's NAME may only come from the ladder.

   R88 is "which ladder does this site read". R90 is one question earlier: several screens
   held their OWN list of rung names and never consulted a ladder at all. The register
   recorded two files. There were six.

   THE FRAMING THAT MATTERS, because it was wrong for a day: these were not stale copies of
   `TITLE_LEVELS`. They were the DIFFICULTY-BAND vocabulary - Novice / Apprentice / Skilled
   / Expert / Elite / Master / Grand Master / Champion / Legend - mislabelled as levels. That
   is why every one of them was wrong BY POSITION rather than merely out of date: rung 3 is
   "Trainee" and they said "Skilled", which is rung 6.

   IT FOLLOWS THAT A VOCABULARY GUARD IS IMPOSSIBLE HERE, and that is the reason this guard
   has the shape it does. `TradingLobbySidebar.tsx` held the offending `LEVEL_NAMES` array
   and, thirty lines below it, `DIFFICULTY_STYLES` keyed by those same words - legitimately,
   because they really are the difficulty bands. Banning the words fires on correct code in
   the same file as the defect, and "Grand Master" is in both lists, so even restricting the
   ban to multi-word names does not separate them. A guard that fails on correct code is the
   one the next reader deletes.

   So the guard is by REACH, not by vocabulary: a screen that renders a level gate must be
   able to reach the ladder. It is directory-scanned rather than a list, because R90's fix
   shipped with no test at all - which is precisely how sites three to six outlived a fix, a
   commit and a register entry.
 * ------------------------------------------------------------------------------------ */

/** Every way a file can legitimately obtain a rung name. */
/*
  Does this file have any route to the operator's ladder at all?

  // Reason: the helper names are matched AS CALLS and TITLE_LEVELS only inside an import.
  // Written as bare identifiers this regex was satisfied by a `useState` local in
  // BadgeXPManagementSection.tsx literally named TITLE_LEVELS, which held a hard-coded
  // ten-rung ladder (R91). A NAME IS NOT AN IMPORT - the sibling of "an import is not a
  // use", and the more dangerous direction, because the guard reported the file as safe.
*/
const LADDER_REACH =
  /levelLadder|resolveLevelName\(|resolveLevelTitle\(|getTitleLevels\(|import[^;]*\bTITLE_LEVELS\b/;

/*
  Files that mention a level gate and render no rung name. Each carries its reason, and the
  canary below asserts each is still in the state its reason describes - a stale exemption
  reads as a known problem long after it is solved while silently re-permitting the defect.
*/
const NAMES_NO_RUNG: { file: string; reason: string; number: RegExp }[] = [
  {
    file: "apps/admin/components/admin/GamificationWizardSection.tsx",
    reason: "renders `Lv.{n}` - the rung NUMBER, never its name",
    number: /Lv\.\{/,
  },
  {
    file: "components/profile/BadgeDetailCard.tsx",
    reason: "a badge's rarity-default required level, as a number",
    number: /requiredLevel/,
  },
  {
    file: "components/profile/BadgesDisplay.tsx",
    reason: "same as BadgeDetailCard - a number, not a name",
    number: /requiredLevel/,
  },
];

/*
  A fourth legitimate route to the operator's ladder: a client screen that FETCHES it.

  This is not a loophole for "it probably loads it somewhere". Each entry asserts the
  endpoint is still called, so a file that loses the fetch and falls back to its own list
  turns this red. The ladder editor is the one screen that must be able to WRITE the
  ladder, so it cannot go through the read-only server helpers.
*/
const LADDER_BY_FETCH: { file: string; endpoint: RegExp }[] = [
  {
    file: "apps/admin/components/admin/BadgeXPManagementSection.tsx",
    endpoint: /fetch\("\/api\/badges-xp\/manage"\)/,
  },
];

/*
  THE RECORDED OFFENDER, FIXED 16 September 2026 - and the canary below was FLIPPED rather
  than deleted, because the reason it existed is the reason to keep watching the file.

  What it was. `app/(root)/gamemaster/create-competition/page.tsx` named rungs inline as JSX
  options and was wrong by position in the ladder's own vocabulary, so a Game Master choosing
  "Level 3: Skilled Trader" created a contest that actually admitted rung 3, "Trainee". Its
  maxLevel dropdown named no rung but capped at 10 of 20, so no Game Master could gate above
  halfway - a truncation that was wrong even against the DEFAULT ladder, which is the part
  that makes it more than a rename defect.

  Why it was exempt for a day. The fix is not a wording change: the page was a 2,798-line
  client component with no access to the operator's ladder, so closing it meant threading a
  server-side read in. It is now the same split `app/(root)/competitions/page.tsx` uses - a
  server `page.tsx` reading the ladder, a client `page-content.tsx` receiving it as a
  REQUIRED prop, so the compiler objects rather than a default quietly covering for it.
*/
const GAMEMASTER_PAGE = "app/(root)/gamemaster/create-competition/page.tsx";
const GAMEMASTER_FORM =
  "app/(root)/gamemaster/create-competition/page-content.tsx";

function gateScreens(): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(join(root, dir), { withFileTypes: true })) {
      const rel = `${dir}/${entry.name}`;
      if (entry.isDirectory()) {
        if (entry.name === "node_modules" || entry.name === ".next") continue;
        walk(rel);
      } else if (entry.name.endsWith(".tsx") && /minLevel|maxLevel/.test(read(rel))) {
        out.push(rel);
      }
    }
  };
  for (const dir of ["components", "app", "apps/admin/components"]) walk(dir);
  return out;
}

function r90Exempt(): Set<string> {
  return new Set([
    ...NAMES_NO_RUNG.map((e) => e.file),
    ...LADDER_BY_FETCH.map((e) => e.file),
    // Reason: the Game Master form is the same THIRD shape as the two admin contest forms -
    // it renders the whole ladder as choices and never calls the resolver - so it is
    // asserted by the `offers the operator's ladder` case below rather than by LADDER_REACH.
    GAMEMASTER_FORM,
  ]);
}

describe("R90 - no screen holds its own list of rung names", () => {
  const screens = gateScreens();

  /*
    // Reason: a directory walk that finds nothing passes every assertion asked of it. This
    // is the same length check that caught a slice taken against a moved marker.
  */
  it("finds the level-gate screens", () => {
    expect(screens.length).toBeGreaterThanOrEqual(8);
    expect(screens).toContain("components/trading/CompetitionEntryButton.tsx");
    // Reason: the Game Master gate controls live in the CLIENT half since the split. Asserting
    // the server `page.tsx` here would pass vacuously - it holds no `minLevel` at all, so the
    // walk never reaches it and the one file with the controls would go unchecked.
    expect(screens).toContain(GAMEMASTER_FORM);
  });

  it.each(
    // Computed at collection time, so a NEW screen is covered on the day it appears.
    gateScreens().filter((f) => !r90Exempt().has(f)),
  )("%s can reach the ladder", (relative) => {
    expect(readCode(relative)).toMatch(LADDER_REACH);
  });

  it.each(LADDER_BY_FETCH)("$file still fetches the ladder", ({ file, endpoint }) => {
    expect(readCode(file)).toMatch(endpoint);
  });

  it.each(NAMES_NO_RUNG)("$file renders a number, not a name ($reason)", ({ file, number }) => {
    // Both halves: the file still has no ladder reach, AND it still renders the number the
    // reason describes. Asserting only the first passes a file that grew a hard-coded name.
    expect(readCode(file)).not.toMatch(LADDER_REACH);
    expect(readCode(file)).toMatch(number);
  });

  /*
    // Reason: FLIPPED 16 Sep 2026. This asserted the Game Master page was still an offender.
    // The claim is inverted and the two halves are kept, because fixing one alone still left
    // a Game Master misled: the names had to stop being typed in AND the cap of ten had to go.
  */
  it("the Game Master form names no rung of its own and caps at no number", () => {
    const code = readCode(GAMEMASTER_FORM);
    // The exact string the defect rendered. Any hard-coded rung name would do, but this one
    // is the one that was wrong by position, so it is the one worth naming.
    expect(code).not.toMatch(/Level 3: Skilled Trader/);
    // The maxLevel list was a literal `[1..10]`. A ladder is never a literal array of rungs.
    expect(code).not.toMatch(/\[\s*1\s*,\s*2\s*,\s*3\s*,/);
  });

  it("the four fixed screens resolve through the shared helper, not a local map", () => {
    for (const relative of [
      "components/trading/CompetitionEntryButton.tsx",
      "components/trading/CompetitionCard.tsx",
      "components/trading/lobby/TradingLobbySidebar.tsx",
      "app/(root)/competitions/page-content.tsx",
    ]) {
      const code = readCode(relative);
      // Named WITH its argument, never as a bare identifier - an import line alone
      // satisfies a whole-file match, which is how three assertions were defeated in
      // `12` s4.2a.
      expect(code).toMatch(/resolveLevelName\s*\(/);
      expect(code).not.toMatch(/LEVEL_NAMES|LEVEL_LABELS|LEVEL_TITLES/);
    }
  });

  /*
    // Reason: the two admin forms are a THIRD shape - they render the whole ladder as
    // choices, so they never call the resolver at all and could not be folded into
    // READ_SITES without weakening its assertions to the point of catching nothing. What
    // they must not do is import the constant, which is what they did until X6.5.
  */
  it.each([
    "apps/admin/components/admin/CompetitionCreatorForm.tsx",
    "apps/admin/components/admin/CompetitionEditorForm.tsx",
    GAMEMASTER_FORM,
  ])("%s offers the operator's ladder, not the constant", (relative) => {
    const code = readCode(relative);
    expect(code).toMatch(/levelLadder\.map\s*\(/);
    // A value import of the constant is the defect; the TYPE import is required.
    expect(code).not.toMatch(/import\s*\{\s*TITLE_LEVELS/);
  });

  it.each([
    "apps/admin/app/competitions/create/page.tsx",
    "apps/admin/app/competitions/edit/[id]/page.tsx",
    GAMEMASTER_PAGE,
  ])("%s reads the ladder once and hands it down", (relative) => {
    const code = readCode(relative);
    expect((code.match(/getTitleLevels\s*\(/g) ?? []).length).toBe(1);
    expect(code).toMatch(/levelLadder=\{levelLadder\}/);
  });
});

/*
  R91 - the ladder EDITOR could destroy the ladder.

  `BadgeXPManagementSection.tsx` seeded state with a hard-coded ten-rung ladder carrying the
  old trading names, and `saveLevels` POSTs whatever state holds to a route whose handler is
  `findOneAndUpdate({ configType: "level_progression" }, { data: { levels } })` - a whole
  document REPLACEMENT with no merge and no length check. So one failed GET, which the code
  already anticipates with a toast, followed by one save, replaced a twenty-rung renamed
  ladder with ten stale rungs. Every player above rung ten then had no rung at all.

  That makes it the only write in the R88/R90/R91 family. The rest were reads showing a wrong
  name; this one changed the stored configuration and there is no attribution to say whether
  it ever happened.

  The fix is a REFUSAL, not a better default: seeding the canonical twenty would still
  overwrite the operator's renames with ours, and a stored value and an absent one are
  different facts.
*/
const LADDER_EDITOR = "apps/admin/components/admin/BadgeXPManagementSection.tsx";

describe("R91 - the ladder editor cannot overwrite what it failed to load", () => {
  it("holds no hard-coded ladder of its own", () => {
    const code = readCode(LADDER_EDITOR);
    /*
      The old literal's own names. Matched as strings because the rungs are renameable, so
      there is no generic shape to look for - only the specific stale set that was there.
    */
    for (const stale of [
      "Novice Trader",
      "Apprentice Trader",
      "Trading God",
      "Market Legend",
    ]) {
      expect(code).not.toContain(stale);
    }
    // And the shadowing name that hid it from LADDER_REACH is gone for good.
    expect(code).not.toContain("TITLE_LEVELS");
  });

  it("states no rung count of its own", () => {
    const code = readCode(LADDER_EDITOR);
    /*
      A second instance, found only because the string test above went red on prose rather
      than on the literal: the help copy asserted "Level 10 ... is the maximum level". Wrong
      twice over - the canonical ladder has twenty rungs, and the number is the operator's to
      change. The top rung is derived, and an absent ladder states nothing.

      // Reason: a claim about the data is as renameable as a label, and it is the one a diff
      // scrolls past because it reads like documentation.
    */
    expect(code).not.toMatch(/maximum level/);
    expect(code).toMatch(/topRung\s*\?/);
  });

  it("the save refuses before the ladder has loaded", () => {
    const code = readCode(LADDER_EDITOR);
    const start = code.indexOf("const saveLevels");
    expect(start).toBeGreaterThan(-1);
    const post = code.indexOf('method: "POST"', start);
    expect(post).toBeGreaterThan(start);

    /*
      // Reason: POSITION, not presence. The guard has to sit between the function opening
      // and the request, or it is a check that runs after the write it exists to prevent.
      // Asserting the file merely mentions ladderLoaded is green on that arrangement.
    */
    const beforeRequest = code.slice(start, post);
    expect(beforeRequest).toMatch(/if\s*\(!ladderLoaded/);
    /*
      Both clauses, and the `return`. The flag alone is not enough: a response of `[]` is a
      shape a half-run migration or a failed seed leaves behind, and without the length test
      the save POSTs an empty ladder over the stored one - the same destruction the flag
      exists to prevent, arriving one step along.

      // Reason: the `return` is asserted separately because a guard that toasts and then
      // falls through is the shape this file already had for the XP tab, and it reads as
      // correct - the operator is even told something is wrong while the write proceeds.
    */
    expect(beforeRequest).toMatch(/levels\.length === 0/);
    expect(beforeRequest).toMatch(/return;/);
  });

  it("the flag is set only by a non-empty loaded ladder", () => {
    const code = readCode(LADDER_EDITOR);
    const sets = code.match(/setLadderLoaded\(/g) ?? [];
    /*
      Exactly one writer. A second `setLadderLoaded(true)` anywhere - in a catch, or beside
      the save - re-arms the defect while every other assertion here stays green.
    */
    expect(sets.length).toBe(1);

    const at = code.indexOf("setLadderLoaded(true)");
    expect(at).toBeGreaterThan(-1);
    // The length test must guard it. `if (xpData.levels)` admits [] and an empty ladder
    // sets the flag, which is the whole defect one step along.
    const guarded = code.slice(Math.max(0, at - 400), at);
    expect(guarded).toMatch(/xpData\.levels\.length\s*>\s*0/);
  });

  it("the editor control is withheld with its reason, not disabled", () => {
    const code = readCode(LADDER_EDITOR);
    expect(code).toMatch(/!ladderLoaded \?/);
    // A refusal that names the missing thing. `disabled={!ladderLoaded}` teaches nothing,
    // so assert the operator is told what failed and what to do.
    expect(code).toMatch(/has not loaded/);
    expect(code).toMatch(/Reload the page/);
  });

  it("every read of a rung survives an empty ladder", () => {
    const code = readCode(LADDER_EDITOR);
    /*
      storedLevels is empty until the fetch lands, so `storedLevels[0]` is no longer a
      guaranteed fallback. Both consumers of levelData must be optional or the users table
      throws on exactly the failed-load path this defect is about.
    */
    expect(code).toMatch(/levelData\?\.icon/);
    expect(code).toMatch(/levelData\?\.color/);
    expect(code).not.toMatch(/levelData\.icon/);
    expect(code).not.toMatch(/levelData\.color/);
  });
});
