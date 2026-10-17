import { describe, expect, it } from "vitest";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ART_BUTTON_HOVER, PRESS_EFFECT } from "@/components/ui/press-effect";

const ROOT = join(__dirname, "..", "..");
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");

describe("one press effect for every player-side button (owner, 3 Oct 2026; hand 17 Oct)", () => {
  it("is the small press plus hand cursor, and never scales on hover", () => {
    expect(PRESS_EFFECT).toMatch(/\bpress-effect\b/);
    expect(PRESS_EFFECT).toMatch(/\bcursor-pointer\b/);
    expect(PRESS_EFFECT).toMatch(/\bduration-150\b/);
    expect(PRESS_EFFECT).toMatch(/\bactive:scale-95\b/);
    expect(PRESS_EFFECT).not.toMatch(/hover:scale/);
    expect(ART_BUTTON_HOVER).not.toMatch(/scale/);
    // Competition entry still documents the same numbers inline on a few Buttons.
    const entry = read("components/trading/CompetitionEntryButton.tsx");
    expect(entry).toMatch(/active:scale-95 transition-all duration-150/);
  });

  it("the shared Button and NeonButton/NeonPill all carry it", () => {
    expect(read("components/ui/button.tsx")).toMatch(/\$\{PRESS_EFFECT\}/);
    const neon = read("components/neon/Buttons.tsx");
    expect(neon.match(/\$\{PRESS_EFFECT\}/g)?.length).toBe(2);
    // Admin mirrors the same contract so operator controls press identically.
    expect(read("apps/admin/components/ui/button.tsx")).toMatch(/\$\{PRESS_EFFECT\}/);
    expect(read("apps/admin/components/ui/press-effect.ts")).toMatch(
      /export const PRESS_EFFECT/,
    );
  });

  it("lobby join art and tab chrome use PRESS_EFFECT, not a one-off hover lift", () => {
    const join = read("components/competitions/lobby/LobbyJoinArtworkButton.tsx");
    expect(join).toMatch(/PRESS_EFFECT/);
    expect(join).not.toMatch(/hover:-translate-y/);
    const tabs = read("components/competitions/detail/TradingDetailTabs.tsx");
    expect(tabs).toMatch(/PRESS_EFFECT/);
  });

  it("Play plate presses via the caller group + PRESS_EFFECT, not a nested group", () => {
    // Reason: ArenaPlayPlate used to put `group` on itself, so group-active never
    // saw the Link/button :active and the gold plate felt dead.
    const plate = read("components/games/lobby/ArenaPlayPlate.tsx");
    expect(plate).not.toMatch(/className="group /);
    expect(plate).not.toMatch(/group-active:scale/);
    const entry = read("components/trading/CompetitionEntryButton.tsx");
    expect(entry).toMatch(/group block w-full \$\{PRESS_EFFECT\}/);
    const preflight = read("components/games/RoundPreflight.tsx");
    expect(preflight).toMatch(/group block w-full.*\$\{PRESS_EFFECT\}/);
    const cta = read("components/competitions/arena/CompetitionCTA.tsx");
    expect(cta).toMatch(/PRESS_EFFECT/);
    expect(cta).not.toMatch(/hover:-translate-y/);
    // Trading lobby run-dashboard actions (desktop + phone) share the same press.
    const dash = read("components/trading/competition-dashboard/DashboardPieces.tsx");
    expect(dash.match(/\$\{PRESS_EFFECT\}/g)?.length).toBeGreaterThanOrEqual(2);
    const mobileRun = read(
      "components/trading/competition-dashboard/MobileRunPanel.tsx",
    );
    expect(mobileRun.match(/\$\{PRESS_EFFECT\}/g)?.length).toBeGreaterThanOrEqual(3);
  });

  it("competition cards, catalogue and phone wallet/perf CTAs share PRESS_EFFECT", () => {
    expect(read("components/games/catalogue/GameCatalogueCard.tsx")).toMatch(
      /\$\{PRESS_EFFECT\}/,
    );
    expect(read("components/games/catalogue/mobile/MobileGameCard.tsx")).toMatch(
      /PRESS_EFFECT/,
    );
    expect(read("components/dashboard/wallet/mobile/MobileWalletActions.tsx")).toMatch(
      /\$\{PRESS_EFFECT\}/,
    );
    expect(
      read("components/dashboard/performance/mobile/MobileGamePerformanceCarousel.tsx"),
    ).toMatch(/\$\{PRESS_EFFECT\}/);
    const compCard = read("components/trading/CompetitionCard.tsx");
    expect(compCard).not.toMatch(/hover:-translate-y-2/);
    const challengeCard = read("components/trading/ChallengeCard.tsx");
    expect(challengeCard).not.toMatch(/hover:-translate-y-2/);
  });

  it("globals apply the same press + hand with !important (player and admin)", () => {
    for (const path of ["app/globals.css", "apps/admin/app/globals.css"]) {
      const css = read(path);
      expect(css).toMatch(/button:enabled:not\(\[aria-disabled="true"\]\)/);
      expect(css).toMatch(/a\.press-effect/);
      expect(css).toMatch(/cursor:\s*pointer/);
      // Reason: without !important, active:scale-[0.99] utilities beat the base rule.
      expect(css).toMatch(/scale\(0\.95\)\s*!important/);
    }
  });

  it("no player-side TSX keeps a weakened active:scale-[0.98]/[0.99]", () => {
    let out = "";
    try {
      out = execSync(
        'rg -n --glob "*.tsx" "active:scale-\\\\[0\\\\.(98|99)\\\\]" components app',
        { cwd: ROOT, encoding: "utf8" },
      );
    } catch (err) {
      // rg exit 1 = no matches — that is the pass.
      const status = (err as { status?: number }).status;
      if (status !== 1) throw err;
      out = "";
    }
    expect(out.trim()).toBe("");
  });

  it("no <Button>, <button> or <Link> opening tag scales on hover", () => {
    // Reason: a bare grep would also hit `group-hover:scale` on icons inside a card, which
    // is fine; only a hover scale on the control itself breaks the shared press.
    const files = execSync('rg -l --glob "*.tsx" "hover:scale-" components app', {
      cwd: ROOT,
      encoding: "utf8",
    })
      .split(/\r?\n/)
      .filter(Boolean);
    expect(files.length).toBeGreaterThan(0);
    const offenders: string[] = [];
    for (const f of files) {
      const src = read(f);
      const re = /<(Button|button|Link)\b/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(src))) {
        let depth = 0;
        let end = m.index;
        for (let i = m.index; i < src.length; i++) {
          const ch = src.charAt(i);
          if (ch === "{") depth++;
          else if (ch === "}") depth--;
          else if (ch === ">" && depth === 0 && src[i - 1] !== "=") {
            end = i;
            break;
          }
        }
        if (/(^|[\s"'`{])hover:scale-/.test(src.slice(m.index, end))) offenders.push(f);
      }
    }
    expect(offenders).toEqual([]);
  });
});
