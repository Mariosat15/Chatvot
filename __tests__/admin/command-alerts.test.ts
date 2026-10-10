/**
 * Command Alerts (Dev Zone) — categories, retention options, route section grant.
 *
 * Surfaces SecurityAlert rows (the same events that print 🚨 [SECURITY] in PM2).
 * Does not scrape logs; soft-polls from the admin UI only while the tab is visible.
 */

import { describe, expect, it, beforeAll, afterAll, beforeEach } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import {
  categoryForAlertType,
  alertTypesForCategory,
  COMMAND_ALERT_CATEGORY_LABELS,
} from "../../apps/admin/lib/admin/command-alert-categories";
import { ADMIN_SECTIONS } from "../../apps/admin/database/models/admin-employee.model";
import {
  findRouteFiles,
  guardCallPattern,
  guardedSections,
  handlerPattern,
  stripComments,
} from "../helpers/route-guard-audit";
import {
  startTestMongo,
  stopTestMongo,
  ensureCollections,
} from "../helpers/mongo-test-server";
import SecurityAlert from "../../database/models/security-alert.model";
import { SECURITY_ALERT_RETENTION_DAYS } from "../../database/models/security-alert-settings.model";
import {
  pageSecurityAlerts,
  deleteSecurityAlertsByIds,
  purgeSecurityAlertsOlderThan,
  setSecurityAlertRetentionSettings,
  getSecurityAlertRetentionSettings,
  runSecurityAlertAutoPurge,
  acknowledgeSecurityAlertsByIds,
  listSecurityAlertsForExport,
  securityAlertsToCsv,
  COMMAND_ALERT_PAGE_SIZES,
} from "../../lib/services/security/security-alert-ops.service";
import { fraudDeepLinkForAlert } from "../../apps/admin/lib/admin/command-alert-links";

const ROOT = process.cwd();
const ROUTE = join(
  ROOT,
  "apps/admin/app/api/dev-zone/command-alerts/route.ts",
);
const DASHBOARD = join(
  ROOT,
  "apps/admin/components/admin/AdminDashboard.tsx",
);

describe("command-alert-categories", () => {
  it("maps known provider / security / payment types", () => {
    expect(categoryForAlertType("prize_pool_mismatch")).toBe("provider");
    expect(categoryForAlertType("brute_force_detected")).toBe("security");
    expect(categoryForAlertType("chargeback_received")).toBe("payment");
    expect(categoryForAlertType("other")).toBe("other");
  });

  it("returns alert types for each category (other is the typed other)", () => {
    expect(alertTypesForCategory("provider")).toContain("catalogue_sync_stale");
    expect(alertTypesForCategory("security")).toContain("csrf_violation");
    expect(alertTypesForCategory("payment")).toEqual(["chargeback_received"]);
    expect(alertTypesForCategory("other")).toEqual(["other"]);
  });

  it("exposes a label for every category key", () => {
    for (const key of Object.keys(COMMAND_ALERT_CATEGORY_LABELS)) {
      expect(COMMAND_ALERT_CATEGORY_LABELS[key as keyof typeof COMMAND_ALERT_CATEGORY_LABELS].length).toBeGreaterThan(0);
    }
  });
});

describe("command-alerts route grant", () => {
  it("is a real ADMIN_SECTIONS value", () => {
    expect(ADMIN_SECTIONS as readonly string[]).toContain("command-alerts");
  });

  it("guards every exported handler with guardSection(command-alerts)", () => {
    const code = stripComments(readFileSync(ROUTE, "utf8"));
    const handlers = code.match(handlerPattern()) ?? [];
    const guards = code.match(guardCallPattern()) ?? [];
    expect(handlers.length).toBe(4); // GET, POST (ack), PATCH, DELETE
    expect(guards.length).toBeGreaterThanOrEqual(handlers.length);
    // Reason: guardedSections returns every call site; four handlers → four identical ids.
    expect(new Set(guardedSections(code))).toEqual(new Set(["command-alerts"]));
  });

  it("POST acknowledges and GET can export CSV", () => {
    const code = stripComments(readFileSync(ROUTE, "utf8"));
    expect(code).toMatch(/acknowledgeSecurityAlertsByIds\s*\(/);
    expect(code).toMatch(/action\s*!==\s*"acknowledge"/);
    expect(code).toMatch(/get\("format"\)\s*===\s*"csv"/);
    expect(code).toMatch(/securityAlertsToCsv\s*\(/);
  });

  it("UI wires acknowledge, drawer, CSV and fraud deep-links", () => {
    const section = stripComments(
      readFileSync(
        join(ROOT, "apps/admin/components/admin/CommandAlertsSection.tsx"),
        "utf8",
      ),
    );
    const table = stripComments(
      readFileSync(
        join(ROOT, "apps/admin/components/admin/CommandAlertsTable.tsx"),
        "utf8",
      ),
    );
    const drawer = stripComments(
      readFileSync(
        join(ROOT, "apps/admin/components/admin/CommandAlertDetailDrawer.tsx"),
        "utf8",
      ),
    );
    const links = stripComments(
      readFileSync(
        join(ROOT, "apps/admin/lib/admin/command-alert-links.ts"),
        "utf8",
      ),
    );
    expect(section).toMatch(/action:\s*"acknowledge"/);
    expect(section).toMatch(/format.*csv|set\("format",\s*"csv"\)/);
    expect(section).toMatch(/CommandAlertDetailDrawer/);
    expect(table).toMatch(/fraudDeepLinkForAlert/);
    expect(table).toMatch(/onAcknowledgeIds/);
    expect(drawer).toMatch(/fraudDeepLinkForAlert/);
    expect(links).toMatch(/activeTab=users/);
    expect(links).toMatch(/activeTab=fraud/);
  });

  it("is wired into AdminDashboard menu and case", () => {
    const dash = stripComments(readFileSync(DASHBOARD, "utf8"));
    expect(dash).toMatch(/id:\s*"command-alerts"/);
    expect(dash).toMatch(/case\s+"command-alerts"/);
    expect(dash).toMatch(/CommandAlertsSection/);
  });

  it("appears under the Dev Zone route walk (folder-wide no-unauth rule)", () => {
    const files = findRouteFiles(
      join(ROOT, "apps/admin/app/api/dev-zone"),
    );
    expect(files.some((f) => f.replace(/\\/g, "/").endsWith("command-alerts/route.ts"))).toBe(
      true,
    );
  });
});

describe("security-alert-ops", () => {
  beforeAll(async () => {
    const uri = await startTestMongo();
    process.env.MONGODB_URI = uri;
    await ensureCollections(["securityalerts", "security_alert_settings"]);
  }, 60_000);

  afterAll(async () => {
    await stopTestMongo();
  });

  beforeEach(async () => {
    await SecurityAlert.deleteMany({});
  });

  it("pages with severity filters and caps page size", async () => {
    await SecurityAlert.create([
      {
        alertType: "brute_force_detected",
        severity: "critical",
        source: "/api/auth",
        reason: "too many tries",
        acknowledged: false,
      },
      {
        alertType: "prize_pool_mismatch",
        severity: "high",
        source: "settlement",
        reason: "pool off",
        acknowledged: false,
      },
      {
        alertType: "chargeback_received",
        severity: "medium",
        source: "/api/nuvei",
        reason: "cb",
        acknowledged: true,
      },
    ]);

    const open = await pageSecurityAlerts({ page: 1, pageSize: 10 });
    expect(open.total).toBe(2); // acknowledged excluded by default
    expect(open.bySeverity.critical).toBe(1);
    expect(open.byCategoryRough.provider).toBe(1);
    expect(open.byCategoryRough.security).toBe(1);

    const capped = await pageSecurityAlerts({ page: 1, pageSize: 999 });
    expect(capped.pageSize).toBe(100);
    expect(COMMAND_ALERT_PAGE_SIZES).toContain(25);
  });

  it("deletes by id and purges by age", async () => {
    const [a] = await SecurityAlert.create([
      {
        alertType: "other",
        severity: "low",
        source: "test",
        reason: "keep",
        acknowledged: false,
      },
      {
        alertType: "other",
        severity: "low",
        source: "test",
        reason: "old",
        acknowledged: false,
        createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
      },
    ]);

    const deleted = await deleteSecurityAlertsByIds([String(a._id)]);
    expect(deleted).toBe(1);

    const purged = await purgeSecurityAlertsOlderThan(7);
    expect(purged).toBe(1);
    expect(await SecurityAlert.countDocuments()).toBe(0);
  });

  it("auto-purge is a no-op until enabled; then honours retention days", async () => {
    expect(SECURITY_ALERT_RETENTION_DAYS).toEqual([1, 5, 7, 30]);

    await setSecurityAlertRetentionSettings({
      autoDeleteEnabled: false,
      retentionDays: 7,
    });
    await SecurityAlert.create({
      alertType: "other",
      severity: "low",
      source: "test",
      reason: "stale",
      acknowledged: false,
      createdAt: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000),
    });

    const skipped = await runSecurityAlertAutoPurge();
    expect(skipped.skipped).toBe(true);
    expect(await SecurityAlert.countDocuments()).toBe(1);

    await setSecurityAlertRetentionSettings({
      autoDeleteEnabled: true,
      retentionDays: 30,
    });
    const settings = await getSecurityAlertRetentionSettings();
    expect(settings.autoDeleteEnabled).toBe(true);
    expect(settings.retentionDays).toBe(30);

    const ran = await runSecurityAlertAutoPurge();
    expect(ran.skipped).toBe(false);
    expect(ran.deleted).toBe(1);
  });

  it("acknowledge keeps the row but drops it from the open list", async () => {
    const [a, b] = await SecurityAlert.create([
      {
        alertType: "brute_force_detected",
        severity: "high",
        source: "/api/auth",
        reason: "open one",
        acknowledged: false,
        userId: "aaaaaaaaaaaaaaaaaaaaaaaa",
      },
      {
        alertType: "other",
        severity: "low",
        source: "test",
        reason: "already done",
        acknowledged: true,
      },
    ]);

    const n = await acknowledgeSecurityAlertsByIds(
      [String(a._id), String(b._id)],
      "admin-1",
      "looked at",
    );
    // Reason: only unacknowledged rows are updated — b was already ack.
    expect(n).toBe(1);

    const open = await pageSecurityAlerts({ page: 1, pageSize: 10 });
    expect(open.total).toBe(0);

    const all = await pageSecurityAlerts({
      page: 1,
      pageSize: 10,
      includeAcknowledged: true,
    });
    expect(all.total).toBe(2);
    const updated = all.alerts.find((r) => String(r._id) === String(a._id));
    expect(updated?.acknowledged).toBe(true);
    expect(updated?.acknowledgedBy).toBe("admin-1");
  });

  it("CSV export includes header and escapes commas in reason", async () => {
    await SecurityAlert.create({
      alertType: "prize_pool_mismatch",
      severity: "critical",
      source: "provider-threshold-monitors",
      reason: "pool off, fees booked",
      acknowledged: false,
    });
    const rows = await listSecurityAlertsForExport({ page: 1, pageSize: 10 });
    const csv = securityAlertsToCsv(rows);
    expect(csv.startsWith("id,createdAt,alertType")).toBe(true);
    expect(csv).toContain("prize_pool_mismatch");
    expect(csv).toMatch(/"pool off, fees booked"/);
  });
});

describe("fraudDeepLinkForAlert", () => {
  it("prefers the user panel when userId is present", () => {
    const link = fraudDeepLinkForAlert({
      userId: "bbbbbbbbbbbbbbbbbbbbbbbb",
      alertType: "brute_force_detected",
    });
    expect(link?.href).toContain("activeTab=users");
    expect(link?.href).toContain("userId=bbbbbbbbbbbbbbbbbbbbbbbb");
  });

  it("falls back to Fraud Monitoring for security types without a user", () => {
    const link = fraudDeepLinkForAlert({
      alertType: "csrf_violation",
    });
    expect(link?.href).toBe("/dashboard?activeTab=fraud");
  });
});
