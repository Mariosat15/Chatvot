import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  requireTerms,
  TerminologyProvider,
  useTerms,
} from "@/apps/admin/contexts/TerminologyContext";
import { TERMS, resolveTerms } from "@/lib/constants/terminology";

/**
 * X6.5 step A1's DELIVERY half - getting resolved tokens to a rendering component.
 *
 * The suite exists because of what was found while wiring it. Chapter 14 specifies delivery
 * through `AppSettingsProvider`, and `apps/admin` mounts that provider NOWHERE while
 * nineteen components call `useAppSettings()` and silently receive the value handed to
 * `createContext`. So the assertions here are weighted towards one question that a
 * terminology test would not normally ask at all: IS THE THING MOUNTED.
 */

const ROOT = join(__dirname, "..", "..");

/**
 * Read a source file with comments stripped.
 *
 * // Reason: every file involved in this slice explains the anti-pattern in prose - the
 * // context file names `AppSettingsProvider` a dozen times in its own docblock. A structural
 * // test that reads prose fails in both directions: it flags a correct file for discussing
 * // the mistake, and it passes a broken one whose only mention of the right thing is a
 * // comment.
 */
function readCode(relativePath: string): string {
  const source = readFileSync(join(ROOT, relativePath), "utf8");
  return source
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");
}

const LAYOUT = "apps/admin/app/layout.tsx";
const CONTEXT = "apps/admin/contexts/TerminologyContext.tsx";

describe("the provider is mounted", () => {
  /*
    THE LOAD-BEARING TEST OF THE SLICE. Everything else here is about correctness given that
    tokens arrive; this is the one that fails when they do not arrive at all.
  */
  it("the admin root layout mounts TerminologyProvider", () => {
    expect(readCode(LAYOUT)).toMatch(/<TerminologyProvider\b/);
  });

  it("the provider WRAPS children rather than rendering beside them", () => {
    const code = readCode(LAYOUT);

    /*
      Position within the construct, not presence.

      // Reason: `<TerminologyProvider terms={terms} />` beside `{children}` satisfies any
      // check that the provider is mentioned, renders perfectly, and delivers nothing to
      // anybody - which is `AppSettingsProvider`'s failure with an extra step. The opening
      // tag must precede `children` and the closing tag must follow it.
    */
    const open = code.indexOf("<TerminologyProvider");
    const close = code.indexOf("</TerminologyProvider>");
    const children = code.indexOf("{children}");

    expect(open).toBeGreaterThan(-1);
    expect(close).toBeGreaterThan(-1);
    expect(children).toBeGreaterThan(-1);
    expect(open).toBeLessThan(children);
    expect(children).toBeLessThan(close);
  });

  it("the layout resolves the pack server-side by CALLING getTerms", () => {
    // An import is not a use: `toContain("getTerms")` stays true when the call is replaced by
    // a hand-rolled `resolveTerms(null)`, because the name survives on the import line.
    expect(readCode(LAYOUT)).toMatch(/getTerms\(\)/);
  });

  it("the layout opts out of static rendering, so a build-time read cannot freeze the words", () => {
    // Asserted as a CALL. `noStore` on the import line alone is a page that Next.js is still
    // free to prerender, which bakes whatever the build machine's database said - or, if it
    // had none, the defaults - into a static response.
    expect(readCode(LAYOUT)).toMatch(/noStore\(\)/);
  });

  it("the pack is never assembled in the browser", () => {
    /*
      The context receives a resolved pack and must not build one.

      // Reason: two resolvers means two answers. The server's reads the stored override; a
      // browser-side one would read whatever the payload happened to carry, and the screen is
      // the copy the operator is looking at. Same shape as the score direction being resolved
      // once in `calculateRankings` (R37).
    */
    const code = readCode(CONTEXT);
    expect(code).not.toMatch(/resolveTerms\(/);
    expect(code).not.toMatch(/\bTERMS\b/);
  });
});

describe("an unmounted provider REFUSES rather than answering the defaults", () => {
  it("requireTerms throws when there is no provider", () => {
    /*
      The single most important assertion in the file, and the one a reasonable person would
      not write - because the tempting alternative is not an error, it is a kindness.

      // Reason: `if (!terms) return { ...TERMS }` reads as defensive, passes review, and is
      // exactly the behaviour that let nineteen components read a hard-coded credit symbol
      // for months with nothing thrown and nothing logged. A caller handed a plausible pack
      // cannot tell it is unwired; a caller handed an exception cannot fail to. Asserted on
      // the MESSAGE as well, so a bare `throw new Error()` cannot satisfy it - the one person
      // who will ever see this is somebody whose new subtree is missing the provider, and the
      // message is the whole remedy.
    */
    expect(() => requireTerms(null)).toThrow(/TerminologyProvider/);
  });

  it("requireTerms returns the pack it was given, unchanged", () => {
    const pack = resolveTerms({ contest: "Tournament" });
    expect(requireTerms(pack)).toBe(pack);
    expect(requireTerms(pack).contest).toBe("Tournament");
    // An untouched token still resolves, so a partial override cannot leave a hole.
    expect(requireTerms(pack).challenge).toBe(TERMS.challenge);
  });

  it("useTerms routes through requireTerms rather than repeating the check", () => {
    // Two copies of the refusal is two places for one of them to be softened into a default.
    expect(readCode(CONTEXT)).toMatch(/requireTerms\(useContext\(/);
  });

  it("exports the shapes a consumer needs", () => {
    expect(typeof TerminologyProvider).toBe("function");
    expect(typeof useTerms).toBe("function");
  });
});

describe("the AppSettingsProvider defect is still open", () => {
  /*
    A NAMED EXCEPTION THAT ASSERTS IT IS STILL AN OFFENDER.

    The owner's decision of 15 September 2026 was to record the unmounted
    `AppSettingsProvider` and fix it in its own commit, since mounting it changes what
    nineteen money-adjacent screens display and does not belong in a wording pass.

    // Reason this is a test rather than a note: a recorded defect with nothing watching it
    // reads as a live problem long after somebody has fixed it, and the next reader either
    // re-investigates or - worse - trusts the note and works around a defect that is gone.
    // This goes RED on the day the provider is mounted, which is the day the record should be
    // closed. Do not delete it to make the suite green; close the record and flip it.
  */
  it("apps/admin still mounts no AppSettingsProvider - flip this test when that is fixed", () => {
    expect(readCode(LAYOUT)).not.toMatch(/<AppSettingsProvider\b/);
  });
});

describe("the vitest alias for the admin context is still unambiguous", () => {
  /*
    A TRIPWIRE FOR X7, not a claim about today.

    `vitest.config.ts` maps the bare specifier `@/contexts/TerminologyContext` to the ADMIN
    copy, because `@` maps to the repository root here and fourteen admin components import
    the context through that alias - `provider-contest-schedule-and-prizes.test.ts` imports
    one of them for real, and without the entry it stops loading rather than failing an
    assertion.

    That mapping is only correct while there is exactly one such module. X7 delivers tokens to
    the PLAYER screens, which is the obvious moment a main-app `contexts/TerminologyContext`
    appears - and on that day every main-app file importing it resolves to the admin copy IN
    TESTS ONLY, because `next build` uses each app's own tsconfig and would be perfectly
    happy. That is the quiet direction: two apps' screens sharing one provider instance in the
    harness, with the suite green.

    // Reason this asserts absence rather than the alias's contents: the alias is correct as
    // written, so there is nothing about it to pin. What can change is the assumption under
    // it. When this goes red, do not delete it - scope the alias to the admin path prefix and
    // give the main-app module its own entry, then flip this to assert both resolve apart.
  */
  it("has no main-app contexts/TerminologyContext competing for the alias", () => {
    expect(existsSync(join(ROOT, "contexts", "TerminologyContext.tsx"))).toBe(
      false,
    );
    expect(existsSync(join(ROOT, "contexts", "TerminologyContext.ts"))).toBe(
      false,
    );
  });

  it("the alias entry sits above the catch-all, or it never fires", () => {
    /*
      Vite tries aliases IN ORDER, so this entry below `"@"` is silently dead - and dead in
      the way that reads as working, because `@/contexts/...` would then resolve against the
      repository root and fail exactly as it did before the entry was added. The config's own
      docblock states the rule; this is what holds it.
    */
    const config = readCode("vitest.config.ts");
    const specific = config.indexOf('"@/contexts/TerminologyContext"');
    const catchAll = config.indexOf('"@": path.resolve');
    // A slice taken from -1 passes everything asked of it, so both ends are proven first.
    expect(specific).toBeGreaterThan(-1);
    expect(catchAll).toBeGreaterThan(-1);
    expect(specific).toBeLessThan(catchAll);
  });
});
