import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * R93 — CreditConversionSection edited eurToCreditsRate but was imported by nothing.
 *
 * Mounting under Settings → Currency reuses the existing `currency` grant (the API
 * already calls guardSection("currency")). A separate section id would be add-only
 * on ADMIN_SECTIONS and a separate grant decision; stacking under currency is the
 * minimal mount that matches the API.
 */

const REPO_ROOT = path.resolve(__dirname, "..", "..");
const DASHBOARD = path.join(
  REPO_ROOT,
  "apps",
  "admin",
  "components",
  "admin",
  "AdminDashboard.tsx",
);

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}

describe("R93 — credit conversion editor is mounted", () => {
  it("imports CreditConversionSection into the admin dashboard", () => {
    const source = stripComments(fs.readFileSync(DASHBOARD, "utf8"));
    expect(source).toMatch(
      /import CreditConversionSection from ["']@\/components\/admin\/CreditConversionSection["']/,
    );
  });

  it("renders CreditConversionSection inside the currency section case", () => {
    // Reason: asserted POSITIONALLY inside the currency case. A file-wide import
    // match is green on an orphaned import that never reaches the tree.
    const source = stripComments(fs.readFileSync(DASHBOARD, "utf8"));
    const caseIdx = source.indexOf('case "currency":');
    expect(caseIdx).toBeGreaterThan(-1);
    const nextCase = source.indexOf("case ", caseIdx + 1);
    const slice = source.slice(caseIdx, nextCase === -1 ? undefined : nextCase);
    expect(slice).toMatch(/<CreditConversionSection\s*\/>/);
    expect(slice).toMatch(/<CurrencySettingsSection\s*\/>/);
  });
});
