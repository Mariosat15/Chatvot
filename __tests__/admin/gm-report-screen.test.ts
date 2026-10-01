import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  escapeCsvCell,
  exportCapMessage,
  csvHeaderLine,
  EXPORT_COLUMNS,
  REFERRED_PLAYERS_EXPORT_CAP,
} from "../../apps/admin/lib/admin/gm-report-csv";
import {
  readReportState,
  writeReportState,
  toApiQuery,
  resolveGmTab,
  REPORT_PARAM_PREFIX,
} from "../../apps/admin/lib/admin/gm-report-query";
import { parseReferredPlayersQuery } from "../../apps/admin/lib/services/gamemaster/referral-report-filter";
import { MIN_REASON_LENGTH, MAX_REASON_LENGTH } from "../../apps/admin/lib/services/gamemaster/admin-affiliation.service";
import { guardedSections, handlerSlices, stripComments } from "../helpers/route-guard-audit";

/**
 * Gamemaster Program v2, task 4 (`External game plans/24` s7.3-s7.5): the admin report screen,
 * its URL state, the CSV export and the move/detach route. Behaviour where it is pure,
 * structure where the guarantee is about WHICH call happens WHERE.
 */

const root = resolve(__dirname, "../..");
const code = (p: string) => stripComments(readFileSync(resolve(root, p), "utf8"));

const EXPORT_ROUTE = "apps/admin/app/api/gamemasters/report/export/route.ts";
const MOVE_ROUTE = "apps/admin/app/api/gamemasters/referred-players/[userId]/route.ts";
const DIALOG = "apps/admin/components/admin/gamemaster/GmAffiliationActionDialog.tsx";
const DASHBOARD = "apps/admin/components/admin/AdminDashboard.tsx";
const BADGE = "apps/admin/components/admin/gamemaster/AffiliationSourceBadge.tsx";

describe("CSV cells", () => {
  it.each(["=SUM(A1)", "+1", "-2+3", "@cmd", "\tx", "\rx"])("neutralises a formula start: %j", (raw) => {
    expect(escapeCsvCell(raw).replace(/^"/, "").startsWith("'")).toBe(true);
  });

  it("leaves numbers as numbers, including negatives", () => {
    expect(escapeCsvCell(-5)).toBe("-5");
    expect(escapeCsvCell(Number.NaN)).toBe("");
  });

  it("quotes delimiters and doubles quotes", () => {
    expect(escapeCsvCell('a,"b"')).toBe('"a,""b"""');
    expect(escapeCsvCell("line\nbreak")).toBe('"line\nbreak"');
    expect(escapeCsvCell(null)).toBe("");
    expect(escapeCsvCell(true)).toBe("yes");
  });

  it("a formula that also needs quoting is neutralised INSIDE the quotes", () => {
    expect(escapeCsvCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
  });

  it("the header has one cell per column and the cap message names both numbers", () => {
    expect(csvHeaderLine().trim().split(",")).toHaveLength(EXPORT_COLUMNS.length);
    const msg = exportCapMessage(12_345);
    expect(msg).toContain("12,345");
    expect(msg).toContain(REFERRED_PLAYERS_EXPORT_CAP.toLocaleString("en-US"));
  });
});

describe("report URL state", () => {
  it("round-trips through the rp_ prefix and leaves other sections' params alone", () => {
    const current = new URLSearchParams("activeTab=gamemaster-management&status=other");
    const next = writeReportState(current, { kind: "own", search: "  ann ", page: "3" });
    expect(next.get("status")).toBe("other");
    expect(next.get(`${REPORT_PARAM_PREFIX}search`)).toBe("ann");
    expect(readReportState(next)).toEqual({ kind: "own", search: "ann", page: "3" });
    const cleared = writeReportState(next, {});
    expect(readReportState(cleared)).toEqual({});
  });

  it("gmId always opens the masters tab, so the existing deep link survives", () => {
    expect(resolveGmTab(new URLSearchParams("gmTab=players&gmId=abc"))).toBe("masters");
    expect(resolveGmTab(new URLSearchParams("gmTab=players"))).toBe("players");
    expect(resolveGmTab(new URLSearchParams("gmTab=bogus"))).toBe("masters");
  });

  it("the API query is understood by the REAL parser", () => {
    const state = {
      gameMasterId: "64c0000000000000000000a1",
      kind: "own",
      status: "ended",
      activity: "active",
      search: "ann",
      page: "2",
    };
    const { filter, paging } = parseReferredPlayersQuery(toApiQuery(state));
    expect(filter).toMatchObject({
      gameMasterIds: ["64c0000000000000000000a1"],
      kind: "own",
      status: "ended",
      activity: "active",
      search: "ann",
    });
    expect(paging).toEqual({ page: 2, limit: 25 });
  });

  it("the export query carries no paging - it always takes the whole filtered set", () => {
    const q = toApiQuery({ kind: "own", page: "4" }, { forExport: true });
    expect(q.get("format")).toBe("csv");
    expect(q.has("page")).toBe(false);
    expect(q.has("limit")).toBe(false);
  });
});

describe("export route", () => {
  const src = code(EXPORT_ROUTE);

  it("requires BOTH the view grant and the export grant", () => {
    expect(guardedSections(src).sort()).toEqual(["gamemaster-management", "gamemaster-reports-export"]);
    const slices = handlerSlices(src);
    expect(slices.map((s) => s.method)).toEqual(["GET"]);
  });

  it("refuses at the cap, and writes the audit row BEFORE the stream is built", () => {
    const capCheck = src.indexOf("first.total > REFERRED_PLAYERS_EXPORT_CAP");
    const refused = src.indexOf('"gm_report_export_refused"');
    const exported = src.indexOf('"gm_report_exported"');
    const stream = src.indexOf("new ReadableStream");
    expect(capCheck).toBeGreaterThan(-1);
    expect(refused).toBeGreaterThan(capCheck);
    expect(exported).toBeGreaterThan(refused);
    expect(stream).toBeGreaterThan(exported);
  });

  it("the audit rows carry the filters and the row count", () => {
    // Reason: `[^;]` keeps each match inside ITS OWN logSystemAction call - a lazy `[\s\S]`
    // ran from the refusal into the export's call and was green with the refusal's count gone.
    expect(src).toMatch(/"gm_report_exported"[^;]*?filters: auditFilter, rowCount: first\.total/);
    expect(src).toMatch(/"gm_report_export_refused"[^;]*?filters: auditFilter, rowCount: first\.total/);
  });

  it("refuses any format other than CSV", () => {
    expect(src).toMatch(/if \(format !== "csv"\)/);
  });
});

describe("move and detach route", () => {
  const src = code(MOVE_ROUTE);

  it("every handler is section-guarded and every success is in the system log", () => {
    for (const slice of handlerSlices(src)) {
      expect(slice.body).toMatch(/guardSection\("gamemaster-management"\)/);
    }
    expect(src).toMatch(/logSystemAction\(/);
  });
});

describe("enum values the admin writer needs", () => {
  it.each(["database/models/user-referral.model.ts", "apps/admin/database/models/user-referral.model.ts"])(
    "%s declares admin_assigned, admin and admin_detached",
    (p) => {
      const src = code(p);
      expect(src).toContain('"admin_assigned"');
      expect(src).toContain('"admin"');
      expect(src).toContain('"admin_detached"');
    },
  );

  it("the export grant is an admin section and has a label", () => {
    expect(code("apps/admin/database/models/admin-employee.model.ts")).toContain('"gamemaster-reports-export"');
    expect(code("apps/admin/app/api/employees/route.ts")).toContain('"gamemaster-reports-export"');
  });
});

describe("screen wiring", () => {
  it("the dialog reason bounds equal the service", () => {
    const src = code(DIALOG);
    expect(src).toContain(`const MIN_REASON = ${MIN_REASON_LENGTH};`);
    expect(src).toContain(`const MAX_REASON = ${MAX_REASON_LENGTH};`);
  });

  it("the dashboard renders the program section and passes the EXPORT grant, not the view grant", () => {
    const src = code(DASHBOARD);
    expect(src).toMatch(/<GameMasterProgramSection[\s\S]*?canExport=\{hasAccessToSection\("gamemaster-reports-export"\)\}/);
  });

  it("the badge looks labels up in a Map, never an object", () => {
    const src = code(BADGE);
    expect(src).toMatch(/new Map/);
    expect(src).not.toMatch(/\[kind\]|\[surface\]/);
  });
});
