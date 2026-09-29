import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { MOBILE_OVERVIEW_ART } from "@/lib/services/games/overview-assets";

/*
  Mobile Overview (owner "Mobile Dashboard" spec, 29 Sep 2026).

  Reason: the phone layout is a SECOND tree, never the desktop made responsive —
  the owner's instruction was explicit, because squeezing the desktop grid is how
  a crowded phone screen happens. Both trees read one provider, and only the tree
  that is actually visible may poll (a CSS-hidden tree stays mounted).
*/

const ROOT = process.cwd();
const read = (p: string) =>
  readFileSync(join(ROOT, p), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");

const MOBILE_DIR = "components/dashboard/mobile";
const mobileFiles = () =>
  readdirSync(join(ROOT, MOBILE_DIR))
    .filter((f) => f.endsWith(".tsx"))
    .map((f) => `${MOBILE_DIR}/${f}`);

describe("mobile dashboard split", () => {
  it("Overview renders DesktopDashboard at md+ and MobileDashboard below, inside one provider", () => {
    const code = read("components/dashboard/DashboardLayout.tsx");
    const provider = code.indexOf("<DashboardOverviewProvider");
    const desktop = code.indexOf('<div className="hidden md:block">');
    const mobile = code.indexOf('<div className="md:hidden">');
    const close = code.indexOf("</DashboardOverviewProvider>");
    expect(provider).toBeGreaterThan(-1);
    expect(close).toBeGreaterThan(provider);
    expect(desktop).toBeGreaterThan(provider);
    expect(mobile).toBeGreaterThan(desktop);
    expect(mobile).toBeLessThan(close);
    expect(code.slice(desktop, mobile)).toMatch(/<DesktopDashboard/);
    expect(code.slice(mobile, close)).toMatch(/<MobileDashboard/);
  });

  it("every polling mobile component is gated to the mobile viewport", () => {
    for (const f of mobileFiles()) {
      const code = read(f);
      if (!/setInterval|fetch\(/.test(code)) continue;
      expect(
        /useOverviewLive\(\s*"mobile"\s*\)|viewport\s*[!=]==\s*"mobile"/.test(code),
        `${f} fetches or polls without a mobile viewport gate`,
      ).toBe(true);
    }
  });

  it("no mobile file imports the Mongoose-reaching standing service (R58)", () => {
    for (const f of mobileFiles()) {
      expect(read(f), f).not.toMatch(/overview-standing\.service/);
    }
  });

  it("mobile order is Wallet, Actions, Games, Progress, Competition", () => {
    const code = read(`${MOBILE_DIR}/MobileDashboard.tsx`);
    const order = [
      "<MobileBalanceCard",
      "<MobileQuickActions",
      "<MobileGameCarousel",
      "<MobilePlayerProgress",
      "<MobileUpcomingCompetitions",
      "<MobileCompeteCarousel",
    ].map((tag) => code.indexOf(tag));
    for (const idx of order) expect(idx).toBeGreaterThan(-1);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it("bottom nav has exactly five tabs and clears the safe area", () => {
    const code = read("components/MobileBottomNav.tsx");
    const hrefs = [...code.matchAll(/href:\s*"([^"]+)"/g)].map((m) => m[1]);
    expect(hrefs).toEqual(["/dashboard", "/games", "/competitions", "/wallet", "/profile"]);
    expect(code).toMatch(/env\(safe-area-inset-bottom\)/);
    expect(code).toMatch(/min-h-\[44px\]/);
  });

  it("every mobile overview asset exists on disk", () => {
    for (const src of Object.values(MOBILE_OVERVIEW_ART)) {
      expect(existsSync(join(ROOT, "public", src)), src).toBe(true);
    }
  });

  it("the phone Compete header's Matching Cards is a pressable pill, not bare text", () => {
    // Reason: owner, 29 Sep 2026 - a plain cyan word did not read as tappable.
    const carousel = read("components/dashboard/mobile/MobileCompeteCarousel.tsx");
    const section = read("components/dashboard/mobile/MobileSection.tsx");
    expect(carousel).toMatch(/linkLabel="Matching Cards"\s*linkAsButton/);
    const pill = section.slice(section.indexOf("linkAsButton && ("));
    expect(pill.length).toBeGreaterThan(40);
    expect(pill).toMatch(/rounded-full[^"]*active:scale-95/);
    expect(pill).toMatch(/<ChevronRight/);
  });

  it("desktop Compete tiles put the icon beside the figure, as in the reference", () => {
    const compete = read("components/dashboard/overview/OverviewCompete.tsx");
    expect(compete).toMatch(/const COMPETE_TILE =\s*"flex[^"]*items-center/);
    expect((compete.match(/className=\{COMPETE_TILE\}/g) ?? []).length).toBe(4);
    expect(compete).toMatch(/clip-path:polygon/);
  });
});
