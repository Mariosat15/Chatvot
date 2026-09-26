import { describe, expect, it } from "vitest";
import { join } from "node:path";
import { readFileSync } from "node:fs";
import {
  ALL_DEFAULT_PAGES,
  DEFAULT_PAGES,
} from "@/lib/constants/default-pages";
import { ACTION_TERM_SLUGS } from "@/components/ActionTermsDialog";

/**
 * X8 pass 11 — legal surfaces are counsel-owned (R11), not a terminology token pass.
 *
 * Engineering deliverable: pin the inventory and forbid accidentally wiring
 * `useTerms` / `getTerms` into contract bodies. Rewording ToS / action-terms
 * copy is Admin → Site Pages after legal review, never a deploy-time find-replace.
 */

const ROOT = join(__dirname, "..", "..");

function readCode(rel: string): string {
  const source = readFileSync(join(ROOT, rel), "utf8");
  return source
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");
}

const SLUG_PAGE = "app/[slug]/page.tsx";
const ACTION_DIALOG = "components/ActionTermsDialog.tsx";
const DEFAULT_PAGES_FILE = "lib/constants/default-pages.ts";
const DEFENCE_PACK = "legal/ChartVolt-Regulatory-Defence-Pack.html";

describe("X8 pass 11 legal surfaces stay off the terminology pack", () => {
  it("inventory — system pages and action-terms slugs are the known set", () => {
    expect(DEFAULT_PAGES.map((p) => p.slug).sort()).toEqual([
      "privacy",
      "terms",
    ]);
    const actionSlugs = ALL_DEFAULT_PAGES.filter(
      (p) => p.category === "action_terms",
    )
      .map((p) => p.slug)
      .sort();
    expect(actionSlugs).toEqual(
      [
        ACTION_TERM_SLUGS.CHALLENGE,
        ACTION_TERM_SLUGS.COMPETITION_ENTRY,
        ACTION_TERM_SLUGS.CREDIT_PURCHASE,
        ACTION_TERM_SLUGS.MARKETPLACE,
        ACTION_TERM_SLUGS.WITHDRAWAL,
      ].sort(),
    );
  });

  it("CMS page renderer does not import the terminology pack", () => {
    const code = readCode(SLUG_PAGE);
    expect(code).not.toMatch(/\buseTerms\b/);
    expect(code).not.toMatch(/\bgetTerms\b/);
    expect(code).not.toMatch(/from\s+["']@\/lib\/constants\/terminology["']/);
    expect(code).not.toMatch(/from\s+["']@\/contexts\/TerminologyContext["']/);
  });

  it("action-terms dialog loads CMS copy and does not import the terminology pack", () => {
    const code = readCode(ACTION_DIALOG);
    // Reason: the dialog's local `terms` state is SitePage data — assert imports,
    // not the identifier `terms`, which legitimately names that payload.
    expect(code).not.toMatch(/\buseTerms\b/);
    expect(code).not.toMatch(/\bgetTerms\b/);
    expect(code).not.toMatch(/from\s+["']@\/lib\/constants\/terminology["']/);
    expect(code).not.toMatch(/from\s+["']@\/contexts\/TerminologyContext["']/);
    expect(code).toContain("/api/action-terms/");
  });

  it("default-pages seed does not import the terminology pack", () => {
    const code = readCode(DEFAULT_PAGES_FILE);
    expect(code).not.toMatch(/\buseTerms\b/);
    expect(code).not.toMatch(/\bgetTerms\b/);
    expect(code).not.toMatch(/from\s+["'].*terminology["']/);
  });

  it("regulatory defence pack stays outside the player wording tree", () => {
    // Reason: R11 — counsel artefact; not a SitePage and not a token target.
    const pack = readFileSync(join(ROOT, DEFENCE_PACK), "utf8");
    expect(pack.length).toBeGreaterThan(1000);
    expect(pack).not.toMatch(/\buseTerms\b/);
    expect(pack).not.toMatch(/\bgetTerms\b/);
  });

  it("related-page chrome on the CMS renderer stays legal labels, not contest tokens", () => {
    const code = readCode(SLUG_PAGE);
    expect(code).toContain('"Terms of Service"');
    expect(code).toContain('"Privacy Policy"');
    expect(code).toContain('"Risk Disclaimer"');
    expect(code).not.toMatch(/terms\.contests/);
    expect(code).not.toMatch(/terms\.challenges/);
  });
});
