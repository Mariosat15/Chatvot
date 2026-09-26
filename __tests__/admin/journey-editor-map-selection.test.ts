/**
 * Journey Map Editor — selected map must drive Current Map / Milestones / Zones.
 *
 * The defect: clicking a sequence card only set `selectedSequenceMap`, so the
 * ring moved to map 3 while Current Map / Milestones / Zones kept showing map 1.
 * Click must call `selectAndLoadMap` with the card's mapId; tab changes must
 * re-fetch when `mapConfig.mapId` disagrees with the selection.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

describe("JourneyMapEditorSection map selection", () => {
  const file = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../../apps/admin/components/admin/JourneyMapEditorSection.tsx",
  );
  const source = stripComments(readFileSync(file, "utf8"));

  it("loads the selected map on card click rather than only highlighting it", () => {
    expect(source).toMatch(/selectAndLoadMap\s*\(/);
    expect(source).toMatch(/onClick=\{\(\)\s*=>\s*void\s+selectAndLoadMap\(/);
    // Reason: the old defect — selection without a fetch.
    expect(source).not.toMatch(
      /onClick=\{\(\)\s*=>\s*setSelectedSequenceMap\(map\.order\)\}/,
    );
  });

  it("reloads the selected map when leaving the sequence tab", () => {
    expect(source).toMatch(/handleEditorTabChange/);
    expect(source).toMatch(/onValueChange=\{handleEditorTabChange\}/);
    expect(source).toMatch(/mapConfig\?\.mapId\s*!==\s*expectedId/);
  });

  it("resolves mapId by the API order field before falling back to index", () => {
    const getMapSlice = source.slice(
      source.indexOf("const getMapIdFromOrder"),
      source.indexOf("const getMapIdFromOrder") + 450,
    );
    expect(getMapSlice).toMatch(/availableMaps\.find\(\(m\)\s*=>\s*m\.order\s*===\s*order\)/);
  });
});
