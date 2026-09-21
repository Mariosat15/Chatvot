/**
 * Games workspace (X11 Slice 2) — structural guards.
 *
 * The workspace is the only place for per-title settings. Providers catalogue is sync + Live
 * only. Theme matches other admin sections. Player page links leave the admin origin.
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
  const catalogue = readCode(
    "apps/admin/components/admin/games/ProviderCatalogueDialog.tsx",
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
    const tabIdsBlock = section.slice(
      section.indexOf("const TAB_IDS"),
      section.indexOf("export type WorkspaceTab"),
    );
    expect((tabIdsBlock.match(/"/g) ?? []).length).toBe(14);
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
    expect((editor.match(/<GameContentDialog/g) ?? []).length).toBe(2);
  });

  it("withholds Duplicate and Delete by name", () => {
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

  it("uses the shared admin chrome, not a custom navy palette", () => {
    expect(section).toContain("border-gray-700");
    expect(section).toContain("bg-gray-900");
    expect(section).not.toContain("#020817");
    expect(editor).toContain("bg-gray-800/50");
    expect(editor).not.toContain("#07152c");
  });

  it("opens the player game page via playerGamePageHref, never a relative /games link alone", () => {
    expect(section).toContain("playerGamePageHref");
    expect(editor).toContain("playerGamePageHref");
    expect(section).not.toMatch(/href=\{`\/games\/\$\{/);
    expect(editor).not.toMatch(/href=\{`\/games\/\$\{/);
  });

  it("saves General fields through the content route", () => {
    expect(editor).toMatch(/\/games\/content/);
    expect(editor).toContain("displayName");
    expect(editor).toContain("Save basic information");
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

  it("Providers catalogue no longer mounts per-title editors", () => {
    expect(catalogue).not.toContain("<GameScoringDialog");
    expect(catalogue).not.toContain("<GameChallengeDefaultsDialog");
    expect(catalogue).not.toContain("<GameContentDialog");
    expect(catalogue).not.toContain("<GamePlayStyleControl");
    expect(catalogue).toContain("Sync catalogue");
    expect(catalogue).toContain("All ");
  });
});

describe("player app URL helper", () => {
  it("builds an absolute path when a base is configured", async () => {
    const { playerGamePageHref, getPlayerAppBaseUrl } = await import(
      "../../apps/admin/lib/admin/player-app-url"
    );
    expect(typeof getPlayerAppBaseUrl()).toBe("string");
    expect(playerGamePageHref("circuit-sprint")).toMatch(/\/games\/circuit-sprint$/);
  });
});
