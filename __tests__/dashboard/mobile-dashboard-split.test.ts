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

  it("mobile order is Wallet, Actions, Games, Progress, Competition — no Upcoming strip", () => {
    // Reason: flipped 3 Oct 2026 — owner removed Upcoming competitions; Suggested
    // for You already lists open contests. The orphan component file is deleted.
    const code = read(`${MOBILE_DIR}/MobileDashboard.tsx`);
    expect(code).not.toMatch(/MobileUpcomingCompetitions/);
    expect(existsSync(join(ROOT, `${MOBILE_DIR}/MobileUpcomingCompetitions.tsx`))).toBe(
      false,
    );
    const order = [
      "<MobileBalanceCard",
      "<MobileQuickActions",
      "<MobileGameCarousel",
      "<MobilePlayerProgress",
      "<MobileCompeteCarousel",
      "<GameSuggestionsCard",
      "<MobileRecentActivity",
      "<MobileStreakGrid",
    ].map((tag) => code.indexOf(tag));
    for (const idx of order) expect(idx).toBeGreaterThan(-1);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it("phones get a back-to-Overview bar, smooth carousels, and Dashboard opens Overview", () => {
    // Reason: owner 3 Oct 2026 — Header tabs are withheld on phone, so Wallet /
    // Performance / Tutorials stranded players; menu scroll felt clunky; bare
    // /dashboard restored the last tab from localStorage.
    const layout = read("components/dashboard/DashboardLayout.tsx");
    expect(layout).toMatch(/MobileDashboardBackBar/);
    expect(layout).toMatch(
      /activeTab !== "overview" \? <MobileDashboardBackBar/,
    );
    const back = read(`${MOBILE_DIR}/MobileDashboardBackBar.tsx`);
    expect(back).toMatch(/href="\/dashboard\?tab=overview"/);
    expect(back).toMatch(/md:hidden/);

    const section = read(`${MOBILE_DIR}/MobileSection.tsx`);
    expect(section).toMatch(/snap-proximity/);
    expect(section).toMatch(/scroll-smooth/);
    expect(section).toMatch(/-webkit-overflow-scrolling:touch/);
    expect(section).not.toMatch(/snap-mandatory/);

    const sidebar = read("components/UserSidebar.tsx");
    expect(sidebar).toMatch(/href:\s*"\/dashboard\?tab=overview"/);
    expect(sidebar).toMatch(/path\.split\("\?"\)/);
    expect(sidebar).toMatch(
      /overflow-y-auto overscroll-contain scroll-smooth \[-webkit-overflow-scrolling:touch\]/,
    );
    // Reason: owner 6 Oct 2026 — SignOut / hamburger only worked on Overview.
    expect(sidebar).toMatch(/type="button"/);
    expect(sidebar).toMatch(/hidden pointer-events-none/);
    expect(sidebar).toMatch(/z-\[60\]/);
    expect(sidebar).toMatch(/z-\[100\]/);
    expect(sidebar).toMatch(/pointer-events-none/);
  });

  it("phone Overview section headers share desktop neon plates (games / fire / blend)", () => {
    // Reason: owner 3 Oct 2026 — desktop icon remap must land on the phone tree too.
    const progress = read(`${MOBILE_DIR}/MobilePlayerProgress.tsx`);
    const streaks = read(`${MOBILE_DIR}/MobileActivityStreaks.tsx`);
    const section = read(`${MOBILE_DIR}/MobileSection.tsx`);
    expect(progress).toMatch(/iconSrc=\{OVERVIEW_ICON_ART\.games\}/);
    expect(streaks).toMatch(/iconSrc=\{OVERVIEW_ICON_ART\.fire\}/);
    expect(streaks).toMatch(/TILES\.map/);
    // Reason: flipped 5 Oct 2026 — transparent Menuitems art needs no screen blend.
    expect(streaks).not.toMatch(/mix-blend-screen/);
    expect(section).toMatch(/iconSrc/);
    expect(section).not.toMatch(/mix-blend-screen/);
    // Reason: owner, 5 Oct 2026 - no View all on phone Recent activity.
    expect(streaks).toMatch(/title="Recent activity"/);
    expect(streaks).not.toMatch(/href="\/dashboard\?tab=contests"/);
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
    expect(read("components/UserSidebar.tsx")).toMatch(
      /fixed left-0 right-0 top-0[^"]*\bh-16\b[^"]*\blg:hidden\b/,
    );
    expect(read("components/Header.tsx")).toMatch(/sticky top-16 lg:top-0/);
    // Reason: Header tab strip withheld on phone from 30 Sep 2026 — no MobileTabStrip.
    expect(read("components/Header.tsx")).not.toMatch(/MobileTabStrip/);
  });

  it("Quick access is Wallet Analytics / Performance / Tutorials / Marketplace", () => {
    // Reason: flipped 3 Oct 2026 — owner replaced competitions/profile/1v1 with
    // the three dashboard tabs phones otherwise bury; Marketplace stays.
    const code = read("components/dashboard/mobile/MobileActions.tsx");
    const block = code.slice(code.indexOf("const QUICK_ACCESS"), code.indexOf("export function MobileQuickAccess"));
    expect(block.length).toBeGreaterThan(40);
    const labels = [...block.matchAll(/label:\s*"([^"]+)"/g)].map((m) => m[1]);
    expect(labels).toEqual([
      "Wallet Analytics",
      "Performance",
      "Tutorials",
      "Marketplace",
    ]);
    expect(block).toMatch(/\/dashboard\?tab=wallet/);
    expect(block).toMatch(/\/dashboard\?tab=performance/);
    expect(block).toMatch(/\/dashboard\?tab=tutorials/);
    expect(block).toMatch(/\/marketplace/);
    expect(block).not.toMatch(/\/competitions"|\/profile"|\/challenges"/);
    expect(code).not.toMatch(/Trading Competitions|Game Competitions|tradingEnabled/);
  });

  it("phone Quick Actions / Quick Access / Wallet card use owner neon plates, equal size, no bg", () => {
    // Reason: flipped 5 Oct 2026 — owner replaced the black-canvas plates with the
    // transparent Menuitems set; one ICON_BOX still keeps every tile equal size.
    const icon = (slug: string) => `/assets/neon/icons/${slug}.webp`;
    expect(MOBILE_OVERVIEW_ART.deposit).toBe(icon("deposit"));
    expect(MOBILE_OVERVIEW_ART.withdraw).toBe(icon("withdrawal"));
    expect(MOBILE_OVERVIEW_ART.compete).toBe(icon("trophy-purple"));
    expect(MOBILE_OVERVIEW_ART.play).toBe(icon("games-orange"));
    expect(MOBILE_OVERVIEW_ART.volt).toBe(icon("wallet-blue"));
    expect(MOBILE_OVERVIEW_ART.walletChart).toBe(icon("wallet-blue"));
    expect(MOBILE_OVERVIEW_ART.performance).toBe(icon("chart-growth-orange"));
    expect(MOBILE_OVERVIEW_ART.tutorials).toBe(icon("lightbulb"));
    expect(MOBILE_OVERVIEW_ART.marketplace).toBe(icon("purchases"));
    // Reason: old compete/play webps must not survive as the live mapping.
    expect(MOBILE_OVERVIEW_ART.compete).not.toMatch(/action-compete/);
    expect(MOBILE_OVERVIEW_ART.play).not.toMatch(/action-play/);

    const actions = read(`${MOBILE_DIR}/MobileActions.tsx`);
    expect(actions).toMatch(/const ICON_BOX =\s*"relative h-10 w-10/);
    expect((actions.match(/className=\{ICON_BOX\}/g) ?? []).length).toBe(1);
    expect(actions).not.toMatch(/mix-blend-screen/);
    expect(actions).toMatch(/object-contain/);
    expect(actions).toMatch(/bg-transparent/);
    // Reason: both tile lists must read from MOBILE_OVERVIEW_ART, never hard-coded paths.
    expect(actions).toMatch(/art:\s*MOBILE_OVERVIEW_ART\.deposit/);
    expect(actions).toMatch(/art:\s*MOBILE_OVERVIEW_ART\.withdraw/);
    expect(actions).toMatch(/art:\s*MOBILE_OVERVIEW_ART\.compete/);
    expect(actions).toMatch(/art:\s*MOBILE_OVERVIEW_ART\.play/);
    expect(actions).toMatch(/art:\s*MOBILE_OVERVIEW_ART\.walletChart/);
    expect(actions).toMatch(/art:\s*MOBILE_OVERVIEW_ART\.performance/);
    expect(actions).toMatch(/art:\s*MOBILE_OVERVIEW_ART\.tutorials/);
    expect(actions).toMatch(/art:\s*MOBILE_OVERVIEW_ART\.marketplace/);

    const balance = read(`${MOBILE_DIR}/MobileBalanceCard.tsx`);
    expect(balance).toMatch(/MOBILE_OVERVIEW_ART\.volt/);
    expect(balance).not.toMatch(/mix-blend-screen/);
    // Reason: empty sparkline fallback is the chart plate, not a second wallet.
    expect(balance).toMatch(/MOBILE_OVERVIEW_ART\.performance/);
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

  it("the phone Compete header's Matching Cards is a pressable CTA, not bare text", () => {
    // Reason: flipped 5 Oct 2026 - violet glow pill replaced by the shared
    // sharp cyan OVERVIEW_ACTION_BUTTON_INLINE (owner: no blur, one theme).
    // Later same day: quiet header "view" links use OVERVIEW_TEXT_LINK; only
    // linkAsButton (Matching Cards) stays a bordered button.
    const carousel = read("components/dashboard/mobile/MobileCompeteCarousel.tsx");
    const section = read("components/dashboard/mobile/MobileSection.tsx");
    expect(carousel).toMatch(/linkLabel="Matching Cards"\s*linkAsButton/);
    expect(section).toMatch(/OVERVIEW_ACTION_BUTTON_INLINE/);
    expect(section).toMatch(/OVERVIEW_TEXT_LINK/);
    const pill = section.slice(section.indexOf("linkAsButton && ("));
    expect(pill.length).toBeGreaterThan(40);
    expect(pill).toMatch(/OVERVIEW_ACTION_BUTTON_INLINE/);
    expect(pill).not.toMatch(/shadow-\[0_0_14px_rgba\(139,92,246/);
    expect(pill).toMatch(/<ChevronRight/);
    const textLink = section.slice(section.indexOf("!linkAsButton && ("));
    expect(textLink.length).toBeGreaterThan(40);
    expect(textLink).toMatch(/OVERVIEW_TEXT_LINK/);
    expect(textLink).not.toMatch(/OVERVIEW_ACTION_BUTTON/);
  });

  it("each phone Compete card carries Matching Cards beside its Challenge button", () => {
    // Reason: owner, 29 Sep 2026 - moved off the header onto every card. The
    // header pill survives only for the empty state, so it is conditional.
    // Flipped 5 Oct 2026: ACTION_BUTTON is the shared sharp cyan CTA, not a
    // local orange/purple pair with bloom shadows.
    const carousel = read("components/dashboard/mobile/MobileCompeteCarousel.tsx");
    expect(carousel).toMatch(/href=\{matches\.length === 0 && !loading \? MATCHING_CARDS_HREF : undefined\}/);
    expect(carousel).toMatch(/const ACTION_BUTTON = OVERVIEW_ACTION_BUTTON/);
    const start = carousel.indexOf('<div className="grid grid-cols-2 gap-2">');
    expect(start).toBeGreaterThan(-1);
    const row = carousel.slice(start, carousel.indexOf("</article>", start));
    expect(row.length).toBeGreaterThan(100);
    const challenge = row.indexOf("setChallengeTarget(");
    const cards = row.indexOf("href={MATCHING_CARDS_HREF}");
    expect(challenge).toBeGreaterThan(-1);
    expect(cards).toBeGreaterThan(challenge);
    expect((row.match(/className=\{ACTION_BUTTON\}/g) ?? []).length).toBe(2);
    expect(row).not.toMatch(/shadow-\[0_0_14px_rgba\(251,146,60/);
    expect(row).not.toMatch(/shadow-\[0_0_14px_rgba\(139,92,246/);
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
    // Reason: 29 Sep 2026 - Score and Competitions also switched to the owner's
    // blue crystal art; the shared KPI target/trophy stay for other screens.
    expect(compete).toMatch(/src=\{OVERVIEW_COMPETE_ART\.score\}/);
    expect(compete).toMatch(/src=\{OVERVIEW_COMPETE_ART\.competitions\}/);
    expect(compete).not.toMatch(/OVERVIEW_ICON_ART\.(target|trophy)/);
    // Reason: 29 Sep 2026 - Level moved to the owner's blue crown badge too.
    expect(compete).toMatch(/src=\{OVERVIEW_COMPETE_ART\.level\}/);
    expect(compete).not.toMatch(/OVERVIEW_COMPETE_ART\.crown/);
    expect((compete.match(/min-w-0 flex-1">\s*<p className="(?:truncate )?text-xl/g) ?? []).length).toBe(4);
  });

  it("each desktop Compete card carries Matching Cards beside its Challenge button", () => {
    // Reason: flipped 5 Oct 2026 - PNG Challenge/Matching Cards art + drop-shadow
    // blooms looked blurry (owner). Both footers use OVERVIEW_ACTION_BUTTON;
    // empty-state header still links Matching Cards.
    const compete = read("components/dashboard/overview/OverviewCompete.tsx");
    expect(compete).toMatch(/const ACTION_BUTTON = OVERVIEW_ACTION_BUTTON/);
    expect(compete).not.toMatch(/const ART_ACTION =/);
    expect(compete).not.toMatch(/OVERVIEW_COMPETE_ART\.challenge/);
    expect(compete).not.toMatch(/OVERVIEW_COMPETE_ART\.matchingCards/);
    expect(compete).not.toMatch(/drop-shadow-\[0_0_12px_rgba\(251,146,60/);
    expect(compete).toMatch(
      /matches\.length === 0 && !loading && \([\s\S]*?MATCHING_CARDS_HREF/,
    );
    const start = compete.indexOf('className="mt-auto grid grid-cols-2 gap-2"');
    expect(start).toBeGreaterThan(-1);
    const row = compete.slice(start, compete.indexOf("</article>", start));
    expect(row.length).toBeGreaterThan(100);
    const challenge = row.indexOf("setChallengeTarget(");
    const cards = row.indexOf("href={MATCHING_CARDS_HREF}");
    expect(challenge).toBeGreaterThan(-1);
    expect(cards).toBeGreaterThan(challenge);
    expect((row.match(/className=\{ACTION_BUTTON\}/g) ?? []).length).toBe(2);
  });

  it("locks phone pinch-zoom and hides inactive dashboard tabs so they cannot steal taps", () => {
    // Reason: owner 6 Oct 2026 — pinch-zoom broke the view; SignOut only worked
    // on Overview because a still-flex inactive tab sat over the chrome.
    const layout = read("app/layout.tsx");
    expect(layout).toMatch(/export const viewport/);
    expect(layout).toMatch(/maximumScale:\s*1/);
    expect(layout).toMatch(/userScalable:\s*false/);
    const tabs = read("components/ui/tabs.tsx");
    expect(tabs).toMatch(/data-\[state=inactive\]:hidden/);
  });
});
