/**
 * Sign-in feature pills are Branding content (5 Oct 2026): the admin edits
 * them, the login page reads them, and an unset field means the shipped five.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  AUTH_PILL_ICONS,
  AUTH_PILL_MAX_COUNT,
  DEFAULT_AUTH_FEATURE_PILLS,
  resolveAuthFeaturePills,
  validateAuthFeaturePills,
} from "@/lib/constants/auth-feature-pills";

const ROOT = join(__dirname, "../..");
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");
const stripComments = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

describe("auth feature pills rules", () => {
  it("defaults are the five pills from the owner mockup, all with known icons", () => {
    expect(DEFAULT_AUTH_FEATURE_PILLS.map((p) => p.label)).toEqual([
      "AI Markets Simulation",
      "Skill Games & Puzzles",
      "Competitions & Tournaments",
      "Live Leaderboards",
      "Exciting Rewards",
    ]);
    for (const pill of DEFAULT_AUTH_FEATURE_PILLS) {
      expect(AUTH_PILL_ICONS.has(pill.icon)).toBe(true);
    }
  });

  it("unset means defaults, but a saved empty list means no pills", () => {
    expect(resolveAuthFeaturePills(undefined)).toEqual(DEFAULT_AUTH_FEATURE_PILLS);
    expect(resolveAuthFeaturePills(null)).toEqual(DEFAULT_AUTH_FEATURE_PILLS);
    expect(resolveAuthFeaturePills([])).toEqual([]);
  });

  it("returns a saved list as the admin wrote it, trimmed", () => {
    expect(
      resolveAuthFeaturePills([{ label: "  Daily Puzzles ", icon: "puzzle" }]),
    ).toEqual([{ label: "Daily Puzzles", icon: "puzzle" }]);
  });

  it("refuses unknown icons, including prototype keys", () => {
    for (const icon of ["nope", "__proto__", "toString", "constructor"]) {
      const result = validateAuthFeaturePills([{ label: "X", icon }]);
      expect(result.ok).toBe(false);
    }
  });

  it("refuses blank labels, too many pills and non-lists", () => {
    expect(validateAuthFeaturePills([{ label: "   ", icon: "star" }]).ok).toBe(false);
    expect(validateAuthFeaturePills({}).ok).toBe(false);
    const tooMany = Array.from({ length: AUTH_PILL_MAX_COUNT + 1 }, () => ({
      label: "A",
      icon: "star",
    }));
    expect(validateAuthFeaturePills(tooMany).ok).toBe(false);
  });

  it("drops extra properties instead of storing them", () => {
    const result = validateAuthFeaturePills([
      { label: "A", icon: "star", href: "javascript:alert(1)" },
    ]);
    expect(result).toEqual({ ok: true, value: [{ label: "A", icon: "star" }] });
  });

  it("a stored list that no longer validates falls back to defaults", () => {
    expect(resolveAuthFeaturePills([{ label: "A", icon: "gone" }])).toEqual(
      DEFAULT_AUTH_FEATURE_PILLS,
    );
  });
});

describe("auth feature pills wiring", () => {
  it("the admin copy of the rules is byte-identical to the main copy", () => {
    expect(read("apps/admin/lib/constants/auth-feature-pills.ts")).toBe(
      read("lib/constants/auth-feature-pills.ts"),
    );
  });

  it("both HeroSettings copies declare the field with no default array", () => {
    for (const rel of [
      "database/models/hero-settings.model.ts",
      "apps/admin/database/models/hero-settings.model.ts",
    ]) {
      expect(read(rel)).toMatch(
        /authPageFeaturePills: \{\s*type: \[\{ _id: false, label: String, icon: String \}\],\s*default: undefined,/,
      );
    }
  });

  it("the auth layout reads the field and resolves it", () => {
    const src = read("app/(auth)/layout.tsx");
    expect(src).toContain("authPageFeaturePills: 1");
    expect(src).toContain(
      "resolveAuthFeaturePills(heroSettings?.authPageFeaturePills)",
    );
  });

  it("the desktop shell renders pills from branding, not a hard-coded list", () => {
    const src = stripComments(read("components/auth/desktop/DesktopAuthShell.tsx"));
    expect(src).toContain("featurePills.map(");
    expect(src).toContain("AUTH_PILL_ICONS.get(icon)");
    expect(src).not.toContain("Exciting Rewards");
    expect(src).not.toContain("AUTH_SIGN_IN_PILLS");
  });

  it("the admin save route validates the field before assigning it", () => {
    const src = stripComments(read("apps/admin/app/api/hero-settings/route.ts"));
    const validate = src.indexOf("validateAuthFeaturePills(");
    const assign = src.indexOf("Object.assign(settings, updateFields)");
    expect(validate).toBeGreaterThan(-1);
    expect(assign).toBeGreaterThan(validate);
    expect(src).toMatch(/if \(!pills\.ok\)[\s\S]{0,120}status: 400/);
  });

  it("Branding mounts the editor, which saves only its own field", () => {
    expect(read("apps/admin/components/admin/ImagesSection.tsx")).toContain(
      "<AuthFeaturePillsEditor />",
    );
    const editor = read(
      "apps/admin/components/admin/branding/AuthFeaturePillsEditor.tsx",
    );
    expect(editor).toContain("JSON.stringify({ authPageFeaturePills: value })");
  });
});
