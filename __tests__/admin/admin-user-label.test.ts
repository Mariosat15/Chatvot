import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { withUsername } from "../../apps/admin/lib/utils/admin-user-label";

const read = (rel: string) =>
  readFileSync(path.resolve(__dirname, "../..", rel), "utf8");

describe("admin player label", () => {
  it("shows the real name with the public handle beside it", () => {
    expect(withUsername("Jane Smith", "volt_jane")).toBe("Jane Smith (@volt_jane)");
  });

  it("keeps the real name alone for an account that predates usernames", () => {
    expect(withUsername("Jane Smith", undefined)).toBe("Jane Smith");
    expect(withUsername("Jane Smith", "  ")).toBe("Jane Smith");
  });

  it("falls back to the handle when the name is missing", () => {
    expect(withUsername("", "volt_jane")).toBe("@volt_jane");
    expect(withUsername(null, null)).toBe("");
  });

  it("the users API searches and returns the username", () => {
    const src = read("apps/admin/app/api/users/route.ts");
    expect(src).toMatch(/\{\s*username:\s*\{\s*\$regex:\s*search/);
    expect(src).toMatch(/username:\s*user\.username\s*\|\|\s*null/);
  });

  it("the shared admin user lookup carries the username in every builder", () => {
    const src = read("apps/admin/lib/utils/user-lookup.ts");
    expect(src.match(/username:\s*user\.username/g)?.length).toBe(3);
  });
});
