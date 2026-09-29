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
      // Reason: moved 29 Sep 2026 - owner put Upcoming competitions above Play by game.
      "<MobileUpcomingCompetitions",
      "<MobileGameCarousel",
      "<MobilePlayerProgress",
      "<MobileCompeteCarousel",
    ].map((tag) => code.indexOf(tag));
    for (const idx of order) expect(idx).toBeGreaterThan(-1);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it("phones have no bottom nav, and content clears the fixed logo bar", () => {
    /*
      Reason: flipped, not deleted. This pinned the five-tab bar; the owner removed it
      on 29 Sep 2026 ("we have the menu on top anyway"). What must hold now: nothing
      mounts it, no page keeps bottom clearance for it, and <main> reserves the 64px
      the fixed UserSidebar logo bar covers - without pt-16 the Overview's first card
      was drawn under the logo.
    */
    const layout = read("app/(root)/layout.tsx");
    expect(existsSync(join(ROOT, "components/MobileBottomNav.tsx"))).toBe(false);
    expect(layout).not.toMatch(/MobileBottomNav|pb-20/);
    expect(layout).toMatch(/<main className="[^"]*\bpt-16 lg:pt-0\b/);
    expect(read("components/UserSidebar.tsx")).toMatch(/lg:hidden fixed top-0[^"]*\bh-16\b/);
    expect(read("components/Header.tsx")).toMatch(/sticky top-16 lg:top-0/);
  });

  it("Quick access is All Competitions / Profile / 1v1 / Marketplace, not split by game", () => {
    // Reason: owner, 29 Sep 2026 - one competitions tile for every game, Profile in
    // the slot the removed bottom nav used to carry.
    const code = read("components/dashboard/mobile/MobileActions.tsx");
    const block = code.slice(code.indexOf("const QUICK_ACCESS"), code.indexOf("export function MobileQuickAccess"));
    expect(block.length).toBeGreaterThan(40);
    const labels = [...block.matchAll(/label:\s*"([^"]+)"/g)].map((m) => m[1]);
    expect(labels).toEqual(["All Competitions", "Profile", "1v1 Challenges", "Marketplace"]);
    expect(block).toMatch(/label: "Profile", href: "\/profile"/);
    expect(code).not.toMatch(/Trading Competitions|Game Competitions|tradingEnabled/);
  });

  it("the phone shows one account status - the shared card - with no pill beside it", () => {
    const code = read("components/dashboard/mobile/MobileWelcome.tsx");
    expect((code.match(/<AccountStatusCard\b/g) ?? []).length).toBe(1);
    expect(code).not.toMatch(/Account status|role="status"|ShieldCheck/);
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

  it("each phone Compete card carries Matching Cards beside its Challenge button", () => {
    // Reason: owner, 29 Sep 2026 - moved off the header onto every card. The
    // header pill survives only for the empty state, so it is conditional.
    const carousel = read("components/dashboard/mobile/MobileCompeteCarousel.tsx");
    expect(carousel).toMatch(/href=\{matches\.length === 0 && !loading \? MATCHING_CARDS_HREF : undefined\}/);
    const start = carousel.indexOf('<div className="grid grid-cols-2 gap-2">');
    expect(start).toBeGreaterThan(-1);
    const row = carousel.slice(start, carousel.indexOf("</article>", start));
    expect(row.length).toBeGreaterThan(100);
    const challenge = row.indexOf("setChallengeTarget(");
    const cards = row.indexOf("href={MATCHING_CARDS_HREF}");
    expect(challenge).toBeGreaterThan(-1);
    expect(cards).toBeGreaterThan(challenge);
    expect((row.match(/\$\{ACTION_BUTTON\}/g) ?? []).length).toBe(2);
    expect(carousel).toMatch(/const ACTION_BUTTON =\s*"[^"]*h-12[^"]*active:scale-95/);
  });

  it("desktop Compete tiles put the icon beside the figure, as in the reference", () => {
    const compete = read("components/dashboard/overview/OverviewCompete.tsx");
    expect(compete).toMatch(/const COMPETE_TILE =\s*"flex[^"]*items-center/);
    expect((compete.match(/className=\{COMPETE_TILE\}/g) ?? []).length).toBe(4);
    // Reason: flipped 29 Sep 2026 - the owner rejected the notched match plate
    // and the corner brackets as a "cut-off" border. Clean rounded edges only.
    expect(compete).not.toMatch(/clip-path:polygon/);
    expect(compete).not.toMatch(/rounded-tl-\[16px\] border-l-2 border-t-2/);
    expect(compete).not.toMatch(/rounded-br-\[16px\] border-b-2 border-r-2/);
    // Reason: flipped 29 Sep 2026 - centring left a dead gap on the left; the
    // owner wants a larger icon at the edge and the text filling the tile.
    expect(compete).not.toMatch(/const COMPETE_TILE =\s*"[^"]*justify-center/);
    // Reason: flipped 29 Sep 2026 - the 1v1 tile's violet line icon was replaced
    // by the owner's supplied blue swords art, so all four tiles carry art.
    expect((compete.match(/relative h-11 w-11 shrink-0 drop-shadow-\[0_0_8px/g) ?? []).length).toBe(4);
    expect(compete).not.toMatch(/h-10 w-10 shrink-0 text-violet-300/);
    expect(compete).toMatch(/src=\{OVERVIEW_COMPETE_ART\.oneVsOne\}/);
    expect((compete.match(/min-w-0 flex-1">\s*<p className="(?:truncate )?text-xl/g) ?? []).length).toBe(4);
  });

  it("desktop Challenge button is larger and served at source resolution", () => {
    const compete = read("components/dashboard/overview/OverviewCompete.tsx");
    const start = compete.indexOf("src={OVERVIEW_COMPETE_ART.challenge}");
    expect(start).toBeGreaterThan(-1);
    const img = compete.slice(start, compete.indexOf("/>", start));
    // Reason: a resized copy upscaled by hover:scale-110 blurs; the 967px
    // source served unoptimized is always downsampled instead.
    expect(img).toMatch(/\bunoptimized\b/);
    expect(compete).toMatch(/aspect-\[967\/172\] w-\[94%\] max-w-\[340px\]/);
  });
});
