import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * X6.5 leftover from `12` s1.1a — sidebar clicks must write `?activeTab=`.
 *
 * Deep links already worked inbound. Without an outbound write, every bookmark
 * and wiki screenshot of "where I am" was wrong after one click.
 */

const DASHBOARD = join(
  process.cwd(),
  "apps/admin/components/admin/AdminDashboard.tsx",
);

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}

function source(): string {
  return stripComments(readFileSync(DASHBOARD, "utf8"));
}

describe("admin sidebar writes activeTab to the URL", () => {
  it("defines navigateToSection that sets activeTab via router.replace", () => {
    const src = source();
    const start = src.indexOf("const navigateToSection");
    expect(start).toBeGreaterThan(-1);
    const end = src.indexOf("const handleMenuClick", start);
    const body = src.slice(start, end === -1 ? undefined : end);
    expect(body).toMatch(/params\.set\(\s*["']activeTab["']/);
    expect(body).toMatch(/router\.replace/);
    // Reason: push would stack every section visit on Back; replace keeps Back
    // for leaving the panel.
    expect(body).not.toMatch(/router\.push/);
  });

  it("handleMenuClick navigates through navigateToSection, not setActiveSection alone", () => {
    const src = source();
    const start = src.indexOf("const handleMenuClick");
    expect(start).toBeGreaterThan(-1);
    const end = src.indexOf("const isActive", start);
    const body = src.slice(start, end === -1 ? undefined : end);
    expect(body).toMatch(/navigateToSection\(/);
    // Reason: a bare setActiveSection here reintroduces the defect while the
    // helper still exists and satisfies any whole-file match.
    expect(body).not.toMatch(/setActiveSection\(/);
  });

  it("trading tabs and overview navigate through the same helper", () => {
    const src = source();
    expect(src).toMatch(/onSelect=\{navigateToSection\}/);
    expect(src).toMatch(/onNavigate=\{navigateToSection\}/);
  });
});
