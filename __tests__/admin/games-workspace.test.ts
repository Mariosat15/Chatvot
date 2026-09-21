/**
 * Games workspace (X11 Slice 2) — structural guards.
 *
 * The workspace is a UI reorganisation of the existing per-title dialogs. These tests pin
 * the load-bearing properties: same section grant, same writers, no Duplicate/Delete, and
 * that Page content / Assets split without inventing a second save path.
 */

import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";

const ROOT = join(__dirname, "../..");

function readCode(relative: string): string {
  return readFileSync(join(ROOT, relative), "utf8").replace(
    /\/\*[\s\S]*?\*\/|\/\/.*$/gm,
    "",
  );
}

describe("Games workspace structure", () => {
  const section = readCode(
    "apps/admin/components/admin/games/GamesWorkspaceSection.tsx",
  );
  const editor = readCode(
    "apps/admin/components/admin/games/GamesWorkspaceEditor.tsx",
  );

  it("exposes the seven planned tabs and no more", () => {
    for (const id of [
      "general",
      "settings",
      "scoring",
      "challenge",
      "content",
      "assets",
      "live",
    ]) {
      expect(section).toContain(`"${id}"`);
    }
    // A ninth tab is a place a new writer can hide. Count the TAB_IDS literals.
    const tabIdsBlock = section.slice(
      section.indexOf("const TAB_IDS"),
      section.indexOf("export type WorkspaceTab"),
    );
    expect((tabIdsBlock.match(/"/g) ?? []).length).toBe(14); // 7 ids × 2 quotes
  });

  it("keeps providers reachable without a second section id", () => {
    expect(section).toContain('view === "providers"');
    expect(section).toContain("<GameProvidersSection");
    expect(section).not.toContain("all-games");
  });

  it("reuses the existing dialogs in inline mode rather than reimplementing forms", () => {
    expect(editor).toContain("<GameScoringDialog");
    expect(editor).toContain("<GameChallengeDefaultsDialog");
    expect(editor).toContain("<GameContentDialog");
    expect(editor).toContain("inline");
    expect(editor).toContain('sections="copy"');
    expect(editor).toContain('sections="artwork"');
    // Two content mounts — page copy and assets — same component, different sections.
    expect((editor.match(/<GameContentDialog/g) ?? []).length).toBe(2);
  });

  it("withholds Duplicate and Delete by name", () => {
    // gameKey is immutable and joined to history. A delete here would orphan stats.
    expect(editor).toMatch(/Duplicate and delete are withheld/i);
    expect(editor.toLowerCase()).not.toContain("ondelete");
    expect(editor.toLowerCase()).not.toContain("handledelete");
    expect(editor.toLowerCase()).not.toContain("handleduplicate");
  });

  it("toggles live through the existing games PATCH, not a new route", () => {
    expect(editor).toMatch(
      /\/api\/games\/providers\/\$\{title\.providerKey\}\/games/,
    );
    expect(editor).toContain('method: "PATCH"');
    expect(editor).toContain("chartvoltEnabled");
  });

  it("dialog components still keep DialogFooter so catalogue structural tests stay green", () => {
    for (const file of [
      "apps/admin/components/admin/games/GameScoringDialog.tsx",
      "apps/admin/components/admin/games/GameChallengeDefaultsDialog.tsx",
      "apps/admin/components/admin/games/GameContentDialog.tsx",
    ]) {
      const code = readCode(file);
      expect(code, file).toContain("DialogFooter");
      expect(code, file).toContain("inline");
    }
  });
});
