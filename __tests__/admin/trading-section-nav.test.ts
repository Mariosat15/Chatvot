import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  TRADING_SECTION_TABS,
  isTradingSection,
} from "../../apps/admin/lib/admin/game-sections";
import { ADMIN_SECTIONS } from "../../apps/admin/database/models/admin-employee.model";

/**
 * Guards the admin navigation restructure that gave trading its own destination.
 *
 * Reason: collapsing six sidebar entries into one collapsible destination is the
 * shape of change that widens privileges while looking completely correct on
 * review. `ADMIN_SECTIONS` grants access per *section*, so the six trading
 * screens must stay six independently-gated ids — not one. These tests fail if a
 * later change merges them, renames one, or introduces a menu id that RBAC
 * cannot express.
 */

const DASHBOARD_PATH = join(
  process.cwd(),
  "apps/admin/components/admin/AdminDashboard.tsx",
);

/** Menu ids that are containers only — they open a submenu and render nothing. */
const PARENT_CONTAINER_IDS = ["trading-menu"];

/** Sections that administer contests, which belong to any game, not to trading. */
const CONTEST_SECTION_IDS = ["competitions", "challenges", "analytics"];

function readDashboardSource(): string {
  return readFileSync(DASHBOARD_PATH, "utf8");
}

/** Returns the ids listed under a parent menu item's `children` array. */
function childIdsOf(source: string, parentId: string): string[] {
  const parentIndex = source.indexOf(`id: "${parentId}"`);
  expect(
    parentIndex,
    `menu item "${parentId}" not found in AdminDashboard.tsx`,
  ).toBeGreaterThan(-1);

  const childrenIndex = source.indexOf("children: [", parentIndex);
  expect(
    childrenIndex,
    `menu item "${parentId}" has no children array`,
  ).toBeGreaterThan(-1);

  // Reason: the children array holds only flat `{ id, label, icon }` objects, so
  // the first "]" after it is reliably the end of the array.
  const end = source.indexOf("],", childrenIndex);
  const block = source.slice(childrenIndex, end);

  return [...block.matchAll(/id: "([^"]+)"/g)].map((match) => match[1]);
}

describe("trading admin sections are individually permissioned", () => {
  it("every trading tab is a real admin section id", () => {
    for (const tab of TRADING_SECTION_TABS) {
      expect(
        ADMIN_SECTIONS as readonly string[],
        `"${tab.id}" is offered as a trading tab but is not in ADMIN_SECTIONS, so RBAC cannot gate it and ?activeTab=${tab.id} cannot deep link to it`,
      ).toContain(tab.id);
    }
  });

  it("collapsing the menu did not collapse the permissions", () => {
    // Reason: the failure this pins is a future refactor replacing the six ids
    // with a single "trading" grant, which would hand anyone who can see symbols
    // the ability to change risk and margin limits too.
    expect(TRADING_SECTION_TABS.length).toBe(6);
    expect(new Set(TRADING_SECTION_TABS.map((t) => t.id)).size).toBe(6);
  });

  it("the sidebar gates each trading screen separately", () => {
    const source = readDashboardSource();
    const childIds = childIdsOf(source, "trading-menu");

    expect(childIds).toEqual(TRADING_SECTION_TABS.map((tab) => tab.id));
  });

  it("the trading parent is a container, so it grants nothing by itself", () => {
    for (const parentId of PARENT_CONTAINER_IDS) {
      expect(
        ADMIN_SECTIONS as readonly string[],
        `"${parentId}" only opens a submenu, so granting it would be a permission that maps to no screen`,
      ).not.toContain(parentId);
    }
  });
});

describe("contest administration is not filed under trading", () => {
  it.each(CONTEST_SECTION_IDS)(
    "%s is not treated as a trading section",
    (sectionId) => {
      expect(isTradingSection(sectionId)).toBe(false);
    },
  );

  it("contest sections are not children of the trading destination", () => {
    const source = readDashboardSource();
    const childIds = childIdsOf(source, "trading-menu");

    for (const contestId of CONTEST_SECTION_IDS) {
      expect(
        childIds,
        `"${contestId}" administers contests for any game and must not live inside the Trading destination`,
      ).not.toContain(contestId);
    }
  });

  it("the trading-specific screens left their old homes", () => {
    const source = readDashboardSource();

    // Reason: both were reachable from two places during the move. If a stale
    // copy is left behind, an operator can change margin limits from Settings
    // and never see the Trading destination at all.
    const settingsChildren = childIdsOf(source, "settings");
    expect(settingsChildren).not.toContain("trading-risk");

    const operationsIndex = source.indexOf('id: "operations"');
    const operationsBlock = source.slice(operationsIndex, operationsIndex + 800);
    expect(operationsBlock).not.toContain('id: "price-health"');
  });
});
