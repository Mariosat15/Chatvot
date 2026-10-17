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
 * Historically `DialogContent`'s own class list ended with `sm:max-w-lg`, and an
 * unprefixed `max-w-4xl` never displaced it (R59). The primitive now takes a `size`
 * prop whose variants are all `sm:`-prefixed, and the games surface still uses the
 * tokens below. Both mechanisms must keep winning the merge.
 *
 * THE BEHAVIOURAL HALF IS THE LOAD-BEARING ONE. Asserting that the tokens contain
 * the string `sm:` would pass for ever while a future edit dropped the modifier
 * from the primitive and changed which side wins. So these tests run the real
 * merge, and the CONTROL - an unprefixed width against a size-capped base - is
 * what proves the assertions can tell the two apart.
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
const ADMIN_COMPONENTS = path.join(
  REPO_ROOT,
  "apps",
  "admin",
  "components",
);

const TOKENS = {
  DIALOG_WIDTH_WIDE,
  DIALOG_WIDTH_MEDIUM,
  DIALOG_WIDTH_STANDARD,
};

/** Default size variant — the historic 32rem cap. */
const DEFAULT_SIZE_CAP = "sm:max-w-lg";

function readDialogPrimitive(): string {
  return fs.readFileSync(DIALOG_PRIMITIVE, "utf8");
}

function readBaseDialogClasses(): string {
  const source = readDialogPrimitive();
  const match = source.match(/"(bg-background[^"]+)"/);
  if (!match) {
    throw new Error(
      "Could not find DialogContent's base class list in dialog.tsx. If the primitive has " +
        "been restructured, re-read it here rather than pasting a copy of the classes.",
    );
  }
  return match[1];
}

function readSizeClass(size: string): string {
  const source = readDialogPrimitive();
  // DIALOG_SIZE_CLASSES entries look like `xl: "sm:max-w-4xl",`
  // Reason: size is an allow-listed DialogSize key from the same suite, not input.
  const match = source.match(
    // eslint-disable-next-line security/detect-non-literal-regexp -- allow-listed size key
    new RegExp(`${size}:\\s*"(sm:max-w-[^"]+)"`),
  );
  if (!match) {
    throw new Error(`Could not find size "${size}" in DIALOG_SIZE_CLASSES`);
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

function walkTsx(dir: string, out: string[] = []): string[] {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === "node_modules" || ent.name === ".next") continue;
      walkTsx(p, out);
    } else if (ent.name.endsWith(".tsx")) out.push(p);
  }
  return out;
}

describe("admin dialog width tokens", () => {
  it("displaces the default size cap, which is the only thing that makes a dialog wider", () => {
    const base = readBaseDialogClasses();
    // Reason: width must not live in the base string — that is how R59 was introduced.
    expect(base).not.toContain("sm:max-w-");

    const defaultCap = readSizeClass("default");
    expect(defaultCap).toBe(DEFAULT_SIZE_CAP);

    for (const [name, token] of Object.entries(TOKENS)) {
      const merged = twMerge(base, defaultCap, token);
      expect(merged, `${name} left the default cap in place`).not.toContain(
        DEFAULT_SIZE_CAP,
      );
      expect(merged, `${name} did not survive the merge`).toContain(token);
    }
  });

  it("still reports an unprefixed width as capped, or the assertion above proves nothing", () => {
    // Reason: the control. This is the exact defect - `max-w-4xl` reads as a wide dialog and
    // renders at 32rem beside the default size. If this ever stops being true the merge
    // semantics have changed and the test above has quietly stopped measuring anything.
    const merged = twMerge(
      readBaseDialogClasses(),
      readSizeClass("default"),
      "max-w-4xl",
    );
    expect(merged).toContain(DEFAULT_SIZE_CAP);
    expect(merged).toContain("max-w-4xl");
  });

  it("gives every size variant and every token the sm: modifier", () => {
    for (const size of ["sm", "default", "lg", "xl", "full"] as const) {
      const cls = readSizeClass(size);
      expect(cls, `size ${size} is missing the sm: modifier`).toMatch(
        /^sm:max-w-/,
      );
    }
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

  it("exports a size prop on DialogContent so call sites need no unprefixed max-w", () => {
    const source = stripComments(readDialogPrimitive());
    expect(source).toMatch(/size\?:\s*DialogSize/);
    expect(source).toMatch(/DIALOG_SIZE_CLASSES\[size\]/);
  });
});

describe("the game admin dialogs take their width from the shared module", () => {
  it("finds the dialogs to check", () => {
    expect(gamesDialogFiles().length).toBeGreaterThanOrEqual(5);
  });

  it("has no DialogContent carrying its own unprefixed max-w", () => {
    const offenders: string[] = [];

    for (const file of gamesDialogFiles()) {
      const source = stripComments(fs.readFileSync(file, "utf8"));
      for (const opening of source.match(/<DialogContent[\s\S]*?>/g) ?? []) {
        if (/(?:^|[\s"`{])max-w-/.test(opening)) {
          offenders.push(
            `${path.basename(file)}: ${opening.replace(/\s+/g, " ")}`,
          );
        }
      }
    }

    expect(
      offenders,
      "An unprefixed max-w- on a DialogContent is a dead class: the primitive's size " +
        "default wins. Use a token from lib/admin/dialog-widths.ts instead.\n" +
        offenders.join("\n"),
    ).toEqual([]);
  });

  it("names a width token inside every DialogContent it opens", () => {
    for (const file of gamesDialogFiles()) {
      const source = stripComments(fs.readFileSync(file, "utf8"));
      const openings = source.match(/<DialogContent[\s\S]*?>/g) ?? [];
      expect(
        openings.length,
        `${path.basename(file)} matched no DialogContent`,
      ).toBeGreaterThan(0);

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

describe("R59 remaining sweep — no inert unprefixed max-w on admin DialogContent", () => {
  it("finds admin DialogContent openings to examine", () => {
    const withDialog = walkTsx(ADMIN_COMPONENTS).filter((f) =>
      fs.readFileSync(f, "utf8").includes("<DialogContent"),
    );
    expect(withDialog.length).toBeGreaterThan(20);
  });

  it("has no DialogContent with an unprefixed Tailwind max-w that the size prop should own", () => {
    // Reason: !max-w-none is a deliberate override that works; sm:max-w-* and
    // DIALOG_WIDTH_* already carry the modifier. Everything else is the R59 trap.
    const offenders: string[] = [];
    const inert =
      /(?:^|[\s"`'{])max-w-(md|lg|xl|2xl|3xl|4xl|5xl|6xl)\b/;

    for (const file of walkTsx(ADMIN_COMPONENTS)) {
      if (file.endsWith(`${path.sep}ui${path.sep}dialog.tsx`)) continue;
      const source = stripComments(fs.readFileSync(file, "utf8"));
      for (const opening of source.match(/<DialogContent[\s\S]*?>/g) ?? []) {
        if (/!max-w-/.test(opening)) continue;
        if (/sm:max-w-/.test(opening) || /DIALOG_WIDTH_/.test(opening)) continue;
        if (inert.test(opening)) {
          offenders.push(
            `${path.relative(REPO_ROOT, file)}: ${opening.replace(/\s+/g, " ").slice(0, 140)}`,
          );
        }
      }
    }

    expect(offenders, offenders.join("\n")).toEqual([]);
  });
});
