import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { ADMIN_SECTIONS } from "../../apps/admin/database/models/admin-employee.model";

/**
 * Menu ↔ grant parity for the admin sidebar.
 *
 * A leaf menu id that is not in `ADMIN_SECTIONS` cannot be granted to an
 * employee — only a super admin reaches that screen, and no checkbox can
 * ever name it. The original eight (`journey-map`, `gamification-wizard`,
 * `system-announcements`, `vendors`, `mdb-cluster`, `server-fleet`,
 * `data-cleanup`, `data-maintenance`) were closed one-by-one through
 * R101x–ac and earlier X6 work. This suite is the tripwire so a ninth
 * cannot land the same way.
 *
 * Sidebar URL sync (`?activeTab=`) is a separate leftover, closed 18 Sep
 * 2026 and pinned by `sidebar-url-sync.test.ts`.
 */

const DASHBOARD = join(
  process.cwd(),
  "apps/admin/components/admin/AdminDashboard.tsx",
);

/**
 * Menu ids that open a submenu / group and render no screen of their own.
 * A grant mapping to one of these is privilege widening that reviews as
 * harmless (`12` s1.1 — `trading-menu` is the canonical case).
 */
const PARENT_CONTAINER_IDS = new Set([
  "dashboard",
  "content",
  "contests",
  "games",
  "user-management",
  "finance",
  "security",
  "operations",
  "help",
  "messaging-group",
  "gamemaster-group",
  "ai-automation",
  "settings-group",
  "dev-zone",
  "admin-management",
  "my-account",
  "trading-menu",
  // Nested tab parents that also appear as collapsible destinations.
  // `settings` and `dev-zone-menu` ARE grantable sections (whole-area access)
  // and live in ADMIN_SECTIONS on purpose — they are not in this set.
]);

/** The eight chapter-`12` ids that used to be menu-only. Must stay grantable. */
const ORIGINAL_EIGHT = [
  "journey-map",
  "gamification-wizard",
  "system-announcements",
  "vendors",
  "mdb-cluster",
  "server-fleet",
  "data-cleanup",
  "data-maintenance",
] as const;

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}

function allMenuIds(source: string): string[] {
  return [
    ...new Set(
      [...source.matchAll(/id:\s*"([a-z0-9-]+)"/g)].map((m) => m[1]),
    ),
  ];
}

function leafMenuIds(source: string): string[] {
  return allMenuIds(source).filter((id) => !PARENT_CONTAINER_IDS.has(id));
}

describe("admin menu ↔ ADMIN_SECTIONS parity", () => {
  it("every leaf menu id is grantable (in ADMIN_SECTIONS)", () => {
    const leaves = leafMenuIds(stripComments(readFileSync(DASHBOARD, "utf8")));
    expect(leaves.length).toBeGreaterThan(40);

    const missing = leaves.filter(
      (id) => !(ADMIN_SECTIONS as readonly string[]).includes(id),
    );
    expect(
      missing,
      `leaf menu id(s) missing from ADMIN_SECTIONS — only a super admin can open them and no employee grant can name them: ${missing.join(", ")}`,
    ).toEqual([]);
  });

  it("parent containers are not grantable sections", () => {
    // Reason: a grant that maps to no screen is exactly where privilege
    // widening starts (`12` s1.1). trading-menu is the documented case;
    // group ids like my-account / admin-management are the same shape.
    for (const id of PARENT_CONTAINER_IDS) {
      expect(
        ADMIN_SECTIONS as readonly string[],
        `"${id}" is a menu parent and must not be in ADMIN_SECTIONS`,
      ).not.toContain(id);
    }
  });

  it("the original eight missing sections are all present", () => {
    for (const id of ORIGINAL_EIGHT) {
      expect(
        ADMIN_SECTIONS as readonly string[],
        `"${id}" was one of chapter 12's eight missing grants`,
      ).toContain(id);
    }
  });

  it("ADMIN_SECTIONS stays add-only for the original eight (no silent rename)", () => {
    // Reason: removing an enum value orphans every employee document storing
    // it. Renaming is the same defect wearing a different hat.
    expect(ADMIN_SECTIONS as readonly string[]).toEqual(
      expect.arrayContaining([...ORIGINAL_EIGHT]),
    );
  });
});
