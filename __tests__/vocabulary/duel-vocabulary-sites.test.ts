import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import LandingPageTemplate from "@/database/models/landing-page-template.model";
import LandingPage from "@/database/models/landing-page.model";
import HeroSettings from "@/database/models/hero-settings.model";
import {
  DUEL_SEED_COLLECTIONS,
  collectDuelHits,
  rewriteDuelVocabulary,
  stringContainsDuel,
} from "../../tools/vocabulary/rewrite-duel-seeds-core";

/**
 * The nine `duel` sites recorded in `13` s9.1a.
 *
 * Four are live code (rewriting the source is enough). Three are seeded defaults whose
 * DB rows survive a constant edit — covered by the report-only migration. The ban here
 * pins the SOURCE half so a later edit cannot put the banned noun back while the help
 * page and terminology tokens stay clean.
 */

const ROOT = process.cwd();

const NINE_SITES = [
  "lib/constants/landing-page-templates-4.ts",
  "apps/admin/components/admin/landing-builder/defaults.ts",
  "database/models/hero-settings.defaults.ts",
  "components/landing/sections/LiveChallenges.tsx",
  "components/landing/sections/challenge-arena-extras.tsx",
  "components/arena/scenes/H2HScene.tsx",
  "lib/themes/theme-unique-data.ts",
] as const;

function readSource(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

/** Strip block and line comments so a comment explaining the ban cannot satisfy it. */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

describe("duel vocabulary — nine sites from 13 s9.1a", () => {
  it.each([...NINE_SITES])("%s never says duel", (rel) => {
    const body = stripComments(readSource(rel));
    expect(body.toLowerCase()).not.toMatch(/\bduels?\b/);
  });

  it("lists exactly the seven files s9.1a named (counts were per-occurrence)", () => {
    // Reason: s9.1a named seven paths with occurrence counts that summed past nine once
    // the help page itself was cleaned. The load-bearing claim is the PATH list, not the
    // arithmetic — a new eighth site must fail this length check until the chapter and
    // this suite move together.
    expect(NINE_SITES).toHaveLength(7);
  });
});

describe("rewriteDuelVocabulary", () => {
  it("rewrites every case form, longest first", () => {
    expect(rewriteDuelVocabulary("1v1 Duels and a duel")).toBe(
      "1v1 Challenges and a challenge",
    );
    expect(rewriteDuelVocabulary("DUEL / Duels / duels")).toBe(
      "CHALLENGE / Challenges / challenges",
    );
    expect(rewriteDuelVocabulary("Duel Specialist")).toBe("Challenge Specialist");
  });

  it("leaves identifiers that merely contain the letters alone", () => {
    // Reason: word boundary — "scheduled" must not become "schallengeed".
    expect(rewriteDuelVocabulary("scheduled")).toBe("scheduled");
    expect(stringContainsDuel("scheduled")).toBe(false);
  });

  it("collectDuelHits uses MongoDB dotted paths including array indices", () => {
    const hits = collectDuelHits({
      sections: [{ content: { title: "1v1 Duels", body: "clean" } }],
      challengesTitle: "Trading Duels",
    });
    expect(hits.map((h) => h.path).sort()).toEqual([
      "challengesTitle",
      "sections.0.content.title",
    ]);
    expect(hits.find((h) => h.path === "challengesTitle")?.after).toBe(
      "Trading Challenges",
    );
  });

  it("refuses to invent a hit when the string is already clean", () => {
    expect(collectDuelHits({ title: "1v1 Challenges" })).toEqual([]);
  });
});

describe("seed collection allow-list", () => {
  it("matches the three mongoose models that hold the seeded wording", () => {
    // Reason: a rename of Model.collection.name with this list left behind aims the
    // migration at an empty collection while every structural test stays green.
    expect(LandingPageTemplate.collection.name).toBe("landingpagetemplates");
    expect(LandingPage.collection.name).toBe("landingpages");
    expect(HeroSettings.collection.name).toBe("herosettings");
    expect([...DUEL_SEED_COLLECTIONS].sort()).toEqual(
      ["herosettings", "landingpages", "landingpagetemplates"].sort(),
    );
  });
});
