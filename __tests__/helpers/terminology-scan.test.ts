/**
 * The scanner behind every X6.5 terminology guard, tested against fixtures.
 *
 * WHY A HELPER GETS A SUITE OF ITS OWN, which is not this codebase's habit. Six wording
 * suites - A1 through A4 - assert the same shape: "the scan found nothing". Every one of
 * those assertions is satisfied by a scanner that has quietly stopped looking, and a scanner
 * that has stopped looking is indistinguishable from a surface that is clean. The suites
 * cannot police their own reader.
 *
 * That is not theoretical. The A4 surface forced TWO EXEMPTIONS into `literalNounHits` - it
 * was the first surface to import a Mongoose model (`import Challenge from ...`) and to call
 * a model's own static (`Challenge.findById`), both of which the scan reported as captions.
 * Each exemption is a place the guard was deliberately made blinder, and each has the obvious
 * wrong spelling sitting right next to the correct one:
 *
 *   - skipping every line that mentions `export`, rather than only a module specifier, also
 *     skips `export const CAPTION = "Competition Entry"`;
 *   - exempting a bare `${word}.`, rather than a dot followed by an identifier character,
 *     also exempts every sentence that ENDS in the noun, which is the commonest caption
 *     shape there is.
 *
 * Both wrong spellings are shorter than the right ones and both read as correct. So each one
 * is pinned here by a fixture holding the exemption's true case and its adjacent false case
 * TOGETHER: the exempt line must not be reported, and the caption beside it must be.
 *
 * Fixtures rather than real files on purpose. A guard asserted against the live surface
 * passes on the day somebody tokenises the last hit, and then proves nothing for ever.
 */

import { describe, it, expect, afterAll } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { literalNounHits, lowercaseNounHits } from "./terminology-scan";

const dir = mkdtempSync(join(tmpdir(), "terminology-scan-"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

let counter = 0;

/** A one-file surface built from the given source lines. */
function surface(...source: string[]): string[] {
  const file = join(dir, `fixture-${counter++}.tsx`);
  writeFileSync(file, source.join("\n"), "utf8");
  return [file];
}

const texts = (hits: { text: string }[]): string[] =>
  hits.map((hit) => hit.text.trim());

describe("the Title Case scan", () => {
  it("reports a caption and ignores an identifier", () => {
    /*
      The baseline, so a fixture that reports nothing at all cannot make the two exemption
      tests below vacuous. Both lines carry the same word; only one is displayed.
    */
    const hits = texts(
      literalNounHits(
        surface(
          "        <Label>Prize</Label>",
          "        const prizeDistribution: PrizeSlice[] = [];",
        ),
      ),
    );
    expect(hits).toEqual(["<Label>Prize</Label>"]);
  });

  it("skips a module specifier and nothing else", () => {
    /*
      THE FIRST A4 EXEMPTION. A default import's local name is surrounded by spaces, which is
      exactly the adjacency test in the scan looking for prose - so `import Challenge from
      "..."` read as a caption. The exemption requires BOTH an `import`/`export` keyword and a
      `from`, because that pair is the only shape a module specifier has.

      Widened to every line mentioning `export`, it swallows a caption extracted to a
      constant, which is the one file shape where a caption most often is. Both cases are
      asserted here together, or the exemption can be widened with this test still green.
    */
    const hits = texts(
      literalNounHits(
        surface(
          'import Challenge from "@/database/models/trading/challenge.model";',
          'export type { Competition } from "./competition.model";',
          'export const CAPTION = "Competition Entry";',
        ),
      ),
    );
    expect(hits).toEqual(['export const CAPTION = "Competition Entry";']);
  });

  it("still catches a caption that ends in the noun", () => {
    /*
      THE SECOND A4 EXEMPTION. `Challenge.findById(id)` is a member access, not prose, and the
      tempting exemption is a bare `${word}.` - which also exempts "...refunded to the
      Competition." Requiring an identifier character immediately after the dot separates the
      two exactly: a sentence ending has a space, a tag or the end of the line there, never a
      letter.
    */
    const hits = texts(
      literalNounHits(
        surface(
          "  const doc = await Challenge.findById(id);",
          "        <p>Entry fees were refunded to the Competition.</p>",
        ),
      ),
    );
    expect(hits).toEqual([
      "<p>Entry fees were refunded to the Competition.</p>",
    ]);
  });
});

describe("the lowercase scan", () => {
  it("reports running prose and ignores a route id", () => {
    /*
      The lowercase forms are legitimate as route segments, stored status values and locals,
      which is why this scan works occurrence by occurrence rather than line by line. Kept
      here as a canary for that distinction: a scan that reported the second line would be
      deleted within the week, and a scan that reported neither would be useless.
    */
    const hits = texts(
      lowercaseNounHits(
        surface(
          '        toast.error("Failed to load competitions for this page");',
          "        const url = `/api/competitions/${id}`;",
        ),
      ),
    );
    expect(hits).toEqual([
      'toast.error("Failed to load competitions for this page");',
    ]);
  });
});
