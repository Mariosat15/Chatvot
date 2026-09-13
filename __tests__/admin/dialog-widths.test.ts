import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { twMerge } from "tailwind-merge";

import {
  DIALOG_WIDTH_MEDIUM,
  DIALOG_WIDTH_STANDARD,
  DIALOG_WIDTH_WIDE,
} from "../../apps/admin/lib/admin/dialog-widths";

/**
 * A dialog is only as wide as the class that SURVIVES the merge.
 *
 * `DialogContent`'s own class list ends with `sm:max-w-lg`. `cn()` is `twMerge`, which keys a
 * conflict on the utility group and the modifier together, so an unprefixed `max-w-4xl` does
 * not displace it - both reach the DOM, and Tailwind emits `.sm\:max-w-lg` after `.max-w-4xl`
 * at equal specificity, so the cap wins from 640px up. The class is present, the diff reads
 * correctly, and the dialog is 32rem.
 *
 * THE BEHAVIOURAL HALF IS THE LOAD-BEARING ONE. Asserting that the tokens contain the string
 * `sm:` would pass for ever while a future edit dropped the modifier from the primitive and
 * changed which side wins. So these tests run the real merge, and the CONTROL - an unprefixed
 * width, still capped - is what proves the assertions can tell the two apart. Without it a
 * merge that silently stopped conflicting at all would look like a pass.
 *
 * The base class list is read out of the primitive rather than restated here, because a second
 * copy of it is a test that keeps passing after the thing it describes has moved.
 */

const REPO_ROOT = path.resolve(__dirname, "..", "..");
const DIALOG_PRIMITIVE = path.join(
  REPO_ROOT,
  "apps",
  "admin",
  "components",
  "ui",
  "dialog.tsx",
);
const GAMES_DIR = path.join(
  REPO_ROOT,
  "apps",
  "admin",
  "components",
  "admin",
  "games",
);

const TOKENS = {
  DIALOG_WIDTH_WIDE,
  DIALOG_WIDTH_MEDIUM,
  DIALOG_WIDTH_STANDARD,
};

/** The `sm:`-prefixed cap the primitive imposes on every dialog in the admin app. */
const BASE_CAP = "sm:max-w-lg";

function readBaseDialogClasses(): string {
  const source = fs.readFileSync(DIALOG_PRIMITIVE, "utf8");
  // The one long template of base classes inside DialogContent's cn() call.
  const match = source.match(/"(bg-background[^"]+)"/);
  if (!match) {
    throw new Error(
      "Could not find DialogContent's base class list in dialog.tsx. If the primitive has " +
        "been restructured, re-read it here rather than pasting a copy of the classes.",
    );
  }
  return match[1];
}

/** Line and block comments removed, so a file that DISCUSSES the trap is not read as doing it. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}

function gamesDialogFiles(): string[] {
  return fs
    .readdirSync(GAMES_DIR)
    .filter((name) => name.endsWith(".tsx"))
    .map((name) => path.join(GAMES_DIR, name))
    .filter((file) => fs.readFileSync(file, "utf8").includes("<DialogContent"));
}

describe("admin dialog width tokens", () => {
  it("displaces the primitive's own cap, which is the only thing that makes a dialog wider", () => {
    const base = readBaseDialogClasses();
    expect(base).toContain(BASE_CAP);

    for (const [name, token] of Object.entries(TOKENS)) {
      const merged = twMerge(base, token);
      expect(merged, `${name} left the base cap in place`).not.toContain(BASE_CAP);
      expect(merged, `${name} did not survive the merge`).toContain(token);
    }
  });

  it("still reports an unprefixed width as capped, or the assertion above proves nothing", () => {
    // Reason: the control. This is the exact defect - `max-w-4xl` reads as a wide dialog and
    // renders at 32rem. If this ever stops being true the merge semantics have changed and
    // the test above has quietly stopped measuring anything.
    const merged = twMerge(readBaseDialogClasses(), "max-w-4xl");
    expect(merged).toContain(BASE_CAP);
    expect(merged).toContain("max-w-4xl");
  });

  it("gives every token the sm: modifier and a viewport gutter", () => {
    for (const [name, token] of Object.entries(TOKENS)) {
      expect(token, `${name} is missing the sm: modifier`).toMatch(/^sm:max-w-/);
      expect(token, `${name} does not keep a gutter on small screens`).toContain(
        "calc(100vw-3rem)",
      );
    }
  });

  it("keeps the three tokens distinct, so a screen cannot pick the same width twice by accident", () => {
    const values = Object.values(TOKENS);
    expect(new Set(values).size).toBe(values.length);
  });
});

describe("the game admin dialogs take their width from the shared module", () => {
  it("finds the dialogs to check", () => {
    // A suite that examines nothing passes everything asked of it.
    expect(gamesDialogFiles().length).toBeGreaterThanOrEqual(5);
  });

  it("has no DialogContent carrying its own unprefixed max-w", () => {
    const offenders: string[] = [];

    for (const file of gamesDialogFiles()) {
      const source = stripComments(fs.readFileSync(file, "utf8"));
      // Only the DialogContent openings, so an unrelated `max-w-[260px]` on a paragraph -
      // which is legitimate and used - is not swept up.
      for (const opening of source.match(/<DialogContent[\s\S]*?>/g) ?? []) {
        if (/(?:^|[\s"`{])max-w-/.test(opening)) {
          offenders.push(`${path.basename(file)}: ${opening.replace(/\s+/g, " ")}`);
        }
      }
    }

    expect(
      offenders,
      "An unprefixed max-w- on a DialogContent is a dead class: the primitive's sm:max-w-lg " +
        "wins. Use a token from lib/admin/dialog-widths.ts instead.\n" +
        offenders.join("\n"),
    ).toEqual([]);
  });

  it("names a width token inside every DialogContent it opens", () => {
    // Reason: asserted POSITIONALLY, inside the opening tag, rather than anywhere in the
    // file. A file-wide match is satisfied by the import line alone, so a second dialog
    // added later with no width at all would pass while inheriting the 32rem cap.
    for (const file of gamesDialogFiles()) {
      const source = stripComments(fs.readFileSync(file, "utf8"));
      const openings = source.match(/<DialogContent[\s\S]*?>/g) ?? [];
      expect(openings.length, `${path.basename(file)} matched no DialogContent`).toBeGreaterThan(0);

      for (const opening of openings) {
        expect(
          opening.replace(/\s+/g, " "),
          `${path.basename(file)} opens a DialogContent with no width token. A dialog with ` +
            "no token is one whose width nobody chose.",
        ).toMatch(/DIALOG_WIDTH_[A-Z]+/);
      }
    }
  });
});
