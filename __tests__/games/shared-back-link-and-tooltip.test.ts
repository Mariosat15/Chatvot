import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/*
  Owner, 13 Oct 2026: "make sure that in all pages the back buttons are the same", and
  "tooltips for mobile version not work". One back link and one tooltip wrapper, so a screen
  cannot grow its own variant again.
*/

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

const BACK_LINK_SCREENS = [
  "components/competitions/detail/DesktopTradingLobby.tsx",
  "components/competitions/detail/mobile/MobileTradingLobby.tsx",
  "components/competitions/lobby/mobile/MobileCompetitionLobby.tsx",
  "components/games/ProviderContestLobby.tsx",
  "components/games/ProviderChallengeLobby.tsx",
  "components/games/arena/GameArenaLayout.tsx",
  "components/gamemaster/PrivateContestGate.tsx",
  "components/games/practice/DesktopPracticeLobby.tsx",
  "components/games/practice/MobilePracticeArea.tsx",
  "components/dashboard/mobile/MobileDashboardBackBar.tsx",
  "app/(root)/competitions/[id]/results/page.tsx",
  "app/(root)/competitions/[id]/play/page.tsx",
  "app/(root)/challenges/[id]/page.tsx",
  "app/(root)/challenges/[id]/play/page.tsx",
  "app/(root)/gamemaster/earnings/page.tsx",
  "app/(root)/gamemaster/referrals/page.tsx",
  "app/(root)/gamemaster/create-competition/page-content.tsx",
];

describe("every back link is the shared NeonBackLink", () => {
  it.each(BACK_LINK_SCREENS)("%s renders NeonBackLink and no hand-rolled back link", (file) => {
    const src = read(file);
    expect(src).toMatch(/<NeonBackLink\b/);
    // A hand-rolled one is an ArrowLeft drawn beside "Back to" text in the same file.
    expect(/<ArrowLeft\b/.test(src) && /Back to /.test(src)).toBe(false);
  });

  it("the link itself states where it goes", () => {
    const src = read("components/neon/Buttons.tsx");
    expect(src).toMatch(/export function NeonBackLink/);
    expect(src).toMatch(/Back to \{label\}/);
  });
});

describe("tooltips open on a tap", () => {
  const src = read("components/ui/tooltip.tsx");

  it("records the pointer type and opens from a touch click", () => {
    expect(src).toMatch(/pointerType !== "mouse"/);
    expect(src).toMatch(/openFromTap\(\)/);
    expect(src).toMatch(/if \(tap\.touch && !tap\.wasOpen|touch[\s\S]{0,80}wasOpen/);
  });

  it("controls the Radix root's open state", () => {
    expect(src).toMatch(/open=\{open\}/);
    expect(src).toMatch(/onOpenChange=\{setOpen\}/);
  });
});
