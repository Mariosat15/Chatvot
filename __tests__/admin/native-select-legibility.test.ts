/**
 * A native `<select>` may not sit on a translucent background (R60).
 *
 * THE MECHANISM, because the rule looks like a style preference otherwise. A browser paints a
 * native select's drop-down list ITSELF. It takes the list background from the element's own
 * `background-color` and lets the options inherit `color`. Give it `bg-white/5` -
 * `rgba(255,255,255,0.05)` - and that composites over the browser's light list surface to
 * something indistinguishable from white; give it `text-white` as well and every option is
 * white on white. The only legible row is the highlighted one, readable against the operating
 * system's own selection band, so the control opens as a tall empty panel with one word in it.
 *
 * Nothing fails. No error, no log line, every option present and correct in the DOM. It reads
 * as a data fault, which is how it was first reported.
 *
 * THIS GUARDS THE CONDITION, NOT THE ELEMENT, and that distinction is the whole reason it can
 * exist platform-wide. There are 33 native selects left in the admin app and 11 in the player
 * app; all of them sit on an opaque `bg-gray-*` or set no background at all, and most set no
 * `color` either, so they have two independent protections and are correct. A rule banning the
 * element would fire on forty-odd working files and be deleted by the first person it
 * inconvenienced - the reasoning that narrowed the `GameIcon` ban in `13` s4.1g. A rule banning
 * the combination fires on nothing that works.
 *
 * // Reason: two instances existed when this was written. The genre picker was moved onto the
 * shared `Select` primitive, which draws its own list in a portal and never asks the browser
 * for one. The second - the "Transfer to" employee picker in `MessagingSection.tsx` - is
 * KNOWN, RECORDED AND NOT FIXED, because that file carries about thirty pre-existing lint
 * warnings and the repository's pre-commit hook lints staged files at zero warnings, so a
 * one-token fix cannot be committed without an unrelated cleanup of a 2,180-line component.
 * It is listed as an allowed exception below rather than being excluded silently, so the
 * exception has to be deleted for the guard to go green again.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = join(__dirname, "..", "..");

/**
 * The one instance that is known, live and deliberately unfixed.
 *
 * Recorded as an exception rather than by narrowing the search, so it appears in the failure
 * message of anybody who widens the rule and cannot be lost. Remove the entry when the file's
 * lint debt is cleared and the background is made opaque.
 */
const KNOWN_UNFIXED = new Set(["apps/admin/components/admin/MessagingSection.tsx"]);

/** Directories to walk. The player app's own components are in scope for the same reason. */
const ROOTS = [
  "apps/admin/components",
  "apps/admin/app",
  "components",
  "app",
];

/** Strip comments, so a file that EXPLAINS the anti-pattern is not flagged for discussing it. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}

function tsxFilesUnder(dir: string): string[] {
  let entries: string[];
  try {
    entries = readdirSync(join(ROOT, dir), { recursive: true, encoding: "utf8" });
  } catch {
    return [];
  }
  return entries
    .filter((name) => name.endsWith(".tsx"))
    .map((name) => `${dir}/${name.split("\\").join("/")}`);
}

/**
 * Every native `<select>` opening tag, with its attributes.
 *
 * A BRACE-AWARE SCAN, NOT `<select\b[^>]*>`, and the difference is the whole test. Every one
 * of these carries an inline handler - `onChange={(e) => setThing(e.target.value)}` - and the
 * arrow contains a `>`. A non-greedy match to the first `>` therefore returns
 * `<select value={x} onChange={(e) =>`, which stops BEFORE `className` and reports a clean
 * tree for ever. That was the first version of this file, and the exception-still-offends test
 * below is what caught it: the offender scan passed, and the known offender came back clean.
 *
 * // Reason: track `{}` depth and skip quoted spans, then take the first `>` at depth zero.
 * The scanner is also what keeps `bg-gray-800/50` on a WRAPPER from implicating the opaque
 * select inside it, because the pattern is applied per opening tag rather than per file.
 */
function nativeSelectOpenings(source: string): string[] {
  const openings: string[] = [];
  const starts = /<select\b/g;
  let match: RegExpExecArray | null;

  while ((match = starts.exec(source)) !== null) {
    let depth = 0;
    let quote: string | null = null;

    for (let i = match.index; i < source.length; i += 1) {
      // `charAt`, not `source[i]`: the lint rule for object injection flags a computed index
      // read, and it is right often enough that silencing it here would be the wrong trade.
      const char = source.charAt(i);

      if (quote !== null) {
        if (char === quote) quote = null;
        continue;
      }
      if (char === '"' || char === "'" || char === "`") {
        quote = char;
        continue;
      }
      if (char === "{") {
        depth += 1;
        continue;
      }
      if (char === "}") {
        depth -= 1;
        continue;
      }
      if (char === ">" && depth === 0) {
        openings.push(source.slice(match.index, i + 1));
        break;
      }
    }
  }

  return openings;
}

/** `bg-white/5`, `bg-black/40`, `bg-transparent` - anything the browser cannot paint with. */
const TRANSLUCENT = /\bbg-(?:transparent|(?:white|black|slate|gray|zinc|neutral|stone)\/\d+)/;

describe("a native <select> may not sit on a translucent background", () => {
  const files = ROOTS.flatMap(tsxFilesUnder);

  it("finds the files at all, so an empty walk cannot pass vacuously", () => {
    // A test examining nothing passes everything asked of it. The count is deliberately a
    // floor well below the real number rather than an exact figure nobody will maintain.
    expect(files.length).toBeGreaterThan(200);
  });

  it("has at least one native select to examine, or the rule is measuring nothing", () => {
    const withSelects = files.filter((file) =>
      nativeSelectOpenings(stripComments(readFileSync(join(ROOT, file), "utf8"))).length > 0,
    );
    // If this ever reaches zero because everything moved to the shared primitive, the rule
    // above is inert and this test is where that becomes visible rather than silent.
    expect(withSelects.length).toBeGreaterThan(10);
  });

  it("no unlisted file combines the two", () => {
    const offenders: string[] = [];

    for (const file of files) {
      const source = stripComments(readFileSync(join(ROOT, file), "utf8"));
      for (const opening of nativeSelectOpenings(source)) {
        if (TRANSLUCENT.test(opening)) {
          offenders.push(file);
          break;
        }
      }
    }

    const unlisted = offenders.filter((file) => !KNOWN_UNFIXED.has(file));
    expect(unlisted).toEqual([]);
  });

  it("every listed exception is still an offender, so the list cannot rot", () => {
    // A stale exception is worse than none: it reads as a known problem long after somebody
    // fixed it, and it silently permits the defect coming back to that file. Same reasoning
    // as flipping a defect test to prove its fix rather than deleting it.
    for (const file of KNOWN_UNFIXED) {
      const source = stripComments(readFileSync(join(ROOT, file), "utf8"));
      const offends = nativeSelectOpenings(source).some((opening) =>
        TRANSLUCENT.test(opening),
      );
      expect(offends, `${file} no longer offends - delete it from KNOWN_UNFIXED`).toBe(true);
    }
  });

  it("the pattern recognises what it claims to and not more", () => {
    // The CONTROL, and the reason the other three assertions mean anything. Without it, a
    // pattern that matched nothing at all would report a clean tree for ever.
    expect(TRANSLUCENT.test('<select className="bg-white/5 text-white">')).toBe(true);
    expect(TRANSLUCENT.test('<select className="bg-black/40">')).toBe(true);
    expect(TRANSLUCENT.test('<select className="bg-transparent">')).toBe(true);

    // Opaque is fine, which is what the forty-odd correct call sites use.
    expect(TRANSLUCENT.test('<select className="bg-gray-800 text-gray-100">')).toBe(false);
    expect(TRANSLUCENT.test('<select className="bg-gray-700">')).toBe(false);

    // And `bg-gray-800/50` on a WRAPPER must not implicate the select inside it, which is why
    // the pattern is applied to the opening tag rather than to the file.
    const wrapper = '<div className="bg-gray-800/50"><select className="bg-gray-800">';
    expect(nativeSelectOpenings(wrapper).some((tag) => TRANSLUCENT.test(tag))).toBe(false);
  });

  it("reads past an inline handler to reach className", () => {
    // THE ASSERTION THIS FILE EXISTS BECAUSE OF. Every real call site puts an arrow function
    // in an attribute, and `=>` contains a `>`. A scan that stops at the first one never sees
    // the background at all and reports every file clean - which is exactly what the first
    // version of this test did, and every assertion above it was green.
    const real = [
      "<select",
      "  value={selected}",
      "  onChange={(e) => setSelected(e.target.value)}",
      '  className="w-full bg-white/5 text-white"',
      ">",
    ].join("\n");

    const openings = nativeSelectOpenings(real);
    expect(openings).toHaveLength(1);
    expect(openings[0]).toContain("className");
    expect(TRANSLUCENT.test(openings[0]!)).toBe(true);
  });

  it("does not flag the shared Select primitive, whichever background it is given", () => {
    // The primitive renders its own list in a portal, so a translucent trigger is correct and
    // common - `GamePlayStyleControl` uses exactly that. A rule matching `<Select` as well as
    // `<select` would fire on it, and a case-insensitive regex is the easy way to get there.
    const trigger = '<SelectTrigger className="border-white/15 bg-white/5 text-white/90">';
    expect(nativeSelectOpenings(trigger)).toEqual([]);
  });
});

describe("the relative paths this test reports are usable", () => {
  it("names files from the repository root", () => {
    // So a failure message can be pasted into an editor. `readdirSync(recursive)` returns
    // backslashes on Windows and forward slashes elsewhere, and an offender list that only
    // matches KNOWN_UNFIXED on one operating system is a guard that passes on CI and fails
    // locally, or the reverse.
    const sample = ROOTS.flatMap(tsxFilesUnder)[0];
    expect(sample).toBeDefined();
    expect(sample).not.toContain("\\");
    expect(relative(ROOT, join(ROOT, sample!)).split("\\").join("/")).toBe(sample);
  });
});
