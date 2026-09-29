import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  requireTerms,
  TerminologyProvider,
  useTerms,
} from "@/contexts/TerminologyContext";
import { TERMS, resolveTerms } from "@/lib/constants/terminology";

/**
 * X8 pass 1 — player delivery of the terminology pack to the authenticated shell.
 *
 * Mirrors `__tests__/admin/terminology-delivery.test.ts` for the main app: IS THE THING
 * MOUNTED, does the layout call `getTerms()`, and does an unmounted hook refuse rather
 * than answering the defaults. Plus structural guards on the two nav consumers so a
 * hard-coded "Competitions" / "Trader" / "Trading" cannot return beside a live provider.
 */

const ROOT = join(__dirname, "..", "..");

function readCode(relativePath: string): string {
  const source = readFileSync(join(ROOT, relativePath), "utf8");
  return source
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");
}

const LAYOUT = "app/(root)/layout.tsx";
const CONTEXT = "contexts/TerminologyContext.tsx";
const SIDEBAR = "components/UserSidebar.tsx";
const MOBILE_NAV = "components/MobileBottomNav.tsx";

describe("the player provider is mounted", () => {
  it("the authenticated root layout mounts TerminologyProvider", () => {
    expect(readCode(LAYOUT)).toMatch(/<TerminologyProvider\b/);
  });

  it("the provider WRAPS the shell rather than rendering beside it", () => {
    const code = readCode(LAYOUT);
    const open = code.indexOf("<TerminologyProvider");
    const close = code.indexOf("</TerminologyProvider>");
    // Reason: UserSidebar and Header must sit INSIDE the provider or useTerms throws
    // at runtime while the layout still "mentions" TerminologyProvider. Header replaced
    // MobileBottomNav here on 29 Sep 2026, when the phone bottom nav was removed.
    const sidebar = code.indexOf("<UserSidebar");
    const header = code.indexOf("<Header");

    expect(open).toBeGreaterThan(-1);
    expect(close).toBeGreaterThan(-1);
    expect(sidebar).toBeGreaterThan(-1);
    expect(header).toBeGreaterThan(-1);
    expect(open).toBeLessThan(sidebar);
    expect(open).toBeLessThan(header);
    expect(sidebar).toBeLessThan(close);
    expect(header).toBeLessThan(close);
  });

  it("the layout resolves the pack server-side by CALLING getTerms", () => {
    expect(readCode(LAYOUT)).toMatch(/getTerms\(\)/);
  });

  it("the layout opts out of static rendering, so a build-time read cannot freeze the words", () => {
    expect(readCode(LAYOUT)).toMatch(/noStore\(\)/);
  });

  it("the pack is never assembled in the browser", () => {
    const code = readCode(CONTEXT);
    expect(code).not.toMatch(/resolveTerms\(/);
    expect(code).not.toMatch(/\bTERMS\b/);
  });
});

describe("an unmounted player provider REFUSES rather than answering the defaults", () => {
  it("requireTerms throws when there is no provider", () => {
    expect(() => requireTerms(null)).toThrow(/TerminologyProvider/);
  });

  it("requireTerms returns the pack it was given, unchanged", () => {
    const pack = resolveTerms({ contest: "Tournament" });
    expect(requireTerms(pack)).toBe(pack);
    expect(requireTerms(pack).contest).toBe("Tournament");
    expect(requireTerms(pack).challenge).toBe(TERMS.challenge);
  });

  it("useTerms routes through requireTerms rather than repeating the check", () => {
    expect(readCode(CONTEXT)).toMatch(/requireTerms\(useContext\(/);
  });

  it("exports the shapes a consumer needs", () => {
    expect(typeof TerminologyProvider).toBe("function");
    expect(typeof useTerms).toBe("function");
  });
});

describe("pass 1 nav consumers read tokens, not hard-coded nouns", () => {
  it.each([["UserSidebar", SIDEBAR]])("%s calls useTerms", (_name, file) => {
    const source = readCode(file);
    expect(source).toMatch(/\bconst\s+terms\s*=\s*useTerms\(\)/);
    expect(source).toMatch(
      /import\s*\{[^}]*\buseTerms\b[^}]*\}\s*from\s*"@\/contexts\/TerminologyContext"/,
    );
  });

  it("UserSidebar uses terms.contests / terms.challenges / terms.leaderboard / terms.games / terms.player", () => {
    const source = readCode(SIDEBAR);
    expect(source).toMatch(/terms\.contests/);
    expect(source).toMatch(/terms\.challenges/);
    expect(source).toMatch(/terms\.leaderboard/);
    expect(source).toMatch(/terms\.games/);
    expect(source).toMatch(/terms\.player/);
  });

  it("there is no phone bottom nav left to carry a hard-coded noun", () => {
    /*
      Reason: flipped twice, not deleted. First (29 Sep 2026) the bar became five tabs
      whose one renameable noun, "games", had to come from the pack. Later the same day
      the owner removed the bar outright - the logo bar's menu is the UserSidebar drawer,
      which reads every noun from the pack (test above). A resurrected bar would be a
      second nav with its own chance to hard-code "Games", so its absence is pinned.
    */
    expect(existsSync(join(ROOT, MOBILE_NAV))).toBe(false);
    expect(readCode(LAYOUT)).not.toMatch(/MobileBottomNav/);
  });

  it("UserSidebar no longer hard-codes the section header Trading or the fallback Trader", () => {
    /*
      Counted, never banned as a bare word — the file legitimately discusses both in
      Reason comments, and a comment-stripped scan must still find zero string literals.
    */
    const source = readCode(SIDEBAR);
    expect(source).not.toMatch(/["']Trading["']/);
    expect(source).not.toMatch(/["']Trader["']/);
  });

  it("nav builders take the pack as an argument rather than closing over TERMS", () => {
    // A builder that imports TERMS and ignores its argument satisfies a bare useTerms check
    // while freezing the defaults forever.
    expect(readCode(SIDEBAR)).toMatch(
      /function\s+buildMainNavItems\s*\(\s*terms\s*:\s*TerminologyPack\s*\)/,
    );
    // Reason: the MobileBottomNav half left with the bar (29 Sep 2026); its absence
    // is pinned above, so the sidebar is the only builder left to check.
    expect(readCode(SIDEBAR)).not.toMatch(/\bTERMS\b/);
  });
});
