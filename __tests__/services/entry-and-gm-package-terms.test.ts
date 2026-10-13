/**
 * The two action-terms pages added for the regulatory position (13 Oct 2026):
 *
 * - the Game Master package terms, which state that commission is a commercial payment by
 *   ChartVolt out of its own fee under a written agreement, never a player paying a Game
 *   Master in Volts;
 * - the competition entry terms, which now publish the fairness rules players already have.
 *
 * Reason for the upgrade tests: the seed only inserts missing slugs, so a reworded built-in
 * page would reach no existing database. It may replace a stored page only when that page is
 * still an earlier built-in wording, character for character - an edited page is the
 * operator's (R11) and must survive.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  ALL_DEFAULT_PAGES,
  DEFAULT_ACTION_TERMS,
} from "@/lib/constants/default-pages";
import {
  COMPETITION_ENTRY_TERMS_PAGE,
  COMPETITION_ENTRY_TERMS_V0_SECTIONS,
} from "@/lib/constants/competition-entry-terms-page";
import {
  GM_PACKAGE_TERMS_PAGE,
  GM_PACKAGE_TERMS_SLUG,
} from "@/lib/constants/gm-package-terms-page";
import { upgradeableSystemPage } from "@/lib/services/site-page-seed.service";
import { ACTION_TERM_SLUGS } from "@/components/ActionTermsDialog";

const allText = (sections: { title?: string; content?: string }[]) =>
  sections.map((s) => `${s.title ?? ""}\n${s.content ?? ""}`).join("\n");

describe("Game Master package terms", () => {
  const text = allText(GM_PACKAGE_TERMS_PAGE.sections);

  it("is a registered system action-terms page shown on every purchase", () => {
    expect(DEFAULT_ACTION_TERMS.map((p) => p.slug)).toContain(GM_PACKAGE_TERMS_SLUG);
    expect(GM_PACKAGE_TERMS_PAGE.category).toBe("action_terms");
    expect(GM_PACKAGE_TERMS_PAGE.isSystem).toBe(true);
    expect(GM_PACKAGE_TERMS_PAGE.showEveryTime).toBe(true);
    expect(ACTION_TERM_SLUGS.GM_PACKAGE).toBe(GM_PACKAGE_TERMS_SLUG);
  });

  it("states commission is paid by ChartVolt from its own fee under a written agreement", () => {
    expect(text).toMatch(/paid by ChartVolt/i);
    expect(text).toMatch(/own platform fee/i);
    expect(text).toMatch(/written agreement/i);
    expect(text).toMatch(/payment from ChartVolt, the issuer of Volts/i);
    expect(text).toMatch(/not accept Volts from players/i);
  });

  it("is the page the marketplace shows when a Game Master package is bought", () => {
    const code = readFileSync("app/(root)/marketplace/page-content.tsx", "utf8");
    expect(code).toMatch(
      /pendingPurchaseItem\?\.category === "gamemaster"\s*\?\s*ACTION_TERM_SLUGS\.GM_PACKAGE\s*:\s*ACTION_TERM_SLUGS\.MARKETPLACE/,
    );
  });
});

describe("Competition entry terms - published fairness rules", () => {
  const text = allText(COMPETITION_ENTRY_TERMS_PAGE.sections);

  it("is the registered competition entry page", () => {
    const stored = ALL_DEFAULT_PAGES.find(
      (p) => p.slug === ACTION_TERM_SLUGS.COMPETITION_ENTRY,
    );
    expect(stored).toBe(COMPETITION_ENTRY_TERMS_PAGE);
  });

  it.each([
    ["identical content", /same track, board or puzzle set/i],
    ["no paid advantages", /no extra time, retries, hints, skips or easier content/i],
    ["no mystery packs", /mystery/i],
    ["minimum two players", /never fewer than two/i],
    ["refunds", /refunded in full/i],
  ])("publishes the %s rule", (_name, pattern) => {
    expect(text).toMatch(pattern);
  });
});

describe("seed upgrade of an unedited built-in page", () => {
  const page = COMPETITION_ENTRY_TERMS_PAGE;

  it("upgrades a stored page still carrying the old built-in wording", () => {
    expect(
      upgradeableSystemPage(page, {
        isSystem: true,
        sections: COMPETITION_ENTRY_TERMS_V0_SECTIONS.map((s) => ({ ...s })),
      }),
    ).toBe(true);
  });

  it("leaves a page the operator has edited alone", () => {
    const edited = COMPETITION_ENTRY_TERMS_V0_SECTIONS.map((s) => ({ ...s }));
    edited[0] = { ...edited[0], content: `${edited[0].content} Our counsel's addition.` };
    expect(upgradeableSystemPage(page, { isSystem: true, sections: edited })).toBe(false);
  });

  it("does nothing once the page already carries the current wording", () => {
    expect(
      upgradeableSystemPage(page, { isSystem: true, sections: page.sections }),
    ).toBe(false);
  });

  it("never touches a page marked non-system", () => {
    expect(
      upgradeableSystemPage(page, {
        isSystem: false,
        sections: COMPETITION_ENTRY_TERMS_V0_SECTIONS.map((s) => ({ ...s })),
      }),
    ).toBe(false);
  });
});
