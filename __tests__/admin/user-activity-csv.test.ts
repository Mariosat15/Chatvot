import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  buildUserActivityCsv,
  csvCell,
} from "../../apps/admin/lib/admin/user-activity-csv";

const root = join(__dirname, "..", "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");

describe("user activity CSV", () => {
  it("neutralises spreadsheet formulas in player-supplied text", () => {
    expect(csvCell("=HYPERLINK(\"x\")")).toBe(`"'=HYPERLINK(""x"")"`);
    expect(csvCell("@SUM(A1)")).toBe("'@SUM(A1)");
    expect(csvCell("+cmd")).toBe("'+cmd");
  });

  it("leaves negative amounts as numbers", () => {
    expect(csvCell(-50)).toBe("-50");
    expect(csvCell("-12.5")).toBe("-12.5");
  });

  it("quotes commas and newlines", () => {
    expect(csvCell("a,b")).toBe('"a,b"');
    expect(csvCell("a\nb")).toBe('"a\nb"');
  });

  it("writes one header and one line per row, with a BOM", () => {
    const csv = buildUserActivityCsv([
      {
        id: "r1",
        type: "transaction",
        category: "deposit",
        description: "Deposit",
        status: "completed",
        amount: 100,
        createdAt: new Date("2026-10-05T10:00:00Z"),
        details: { reference: "ABC", empty: "" },
      },
    ]);
    expect(csv.startsWith("\uFEFF")).toBe(true);
    const lines = csv.slice(1).split("\r\n");
    expect(lines).toHaveLength(2);
    expect(lines[1]).toBe(
      "2026-10-05T10:00:00.000Z,transaction,deposit,Deposit,completed,100,reference: ABC,r1",
    );
  });

  it("is served by the guarded history route and audited", () => {
    const route = read("apps/admin/app/api/users/[userId]/history/route.ts");
    const guardAt = route.indexOf('guardSection("users")');
    const csvAt = route.indexOf("buildUserActivityCsv(history)");
    expect(guardAt).toBeGreaterThan(-1);
    expect(csvAt).toBeGreaterThan(guardAt);
    expect(route).toContain('action: "user_activity_export"');
  });
});
