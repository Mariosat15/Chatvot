import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { stripComments } from "../helpers/route-guard-audit";

// Reason: `replaceTemplateVariables` lives in a route file, which Next.js only
// lets export handlers, so it cannot be imported - the guard is structural.
// It used `String.replace(regex, value)`, which reads `$&` and `$$` in the
// value as replacement patterns. The generated password alphabet contains
// both `$` and `&`, so a password with `$&` in it was emailed as something
// other than the password that was stored. A literal split/join cannot do that.
const ROUTE = join(process.cwd(), "apps/admin/app/api/employees/route.ts");

function templateFunction(): string {
  const code = stripComments(readFileSync(ROUTE, "utf8"));
  const start = code.indexOf("function replaceTemplateVariables(");
  const end = code.indexOf("export async function GET(");
  expect(start).toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);
  return code.slice(start, end);
}

describe("employee credentials email template", () => {
  it("substitutes variables literally so a password with a dollar sign survives", () => {
    const body = templateFunction();
    expect(body).toMatch(/\.split\(`\{\{\$\{key\}\}\}`\)\.join\(/);
    expect(body).not.toMatch(/new RegExp/);
    expect(body).not.toMatch(/\.replace\(regex/);
  });

  it("the password alphabet really does contain both characters that made this reachable", () => {
    const code = readFileSync(ROUTE, "utf8");
    const alphabet = code.match(/const chars =\s*"([^"]+)"/)?.[1] ?? "";
    expect(alphabet).toContain("$");
    expect(alphabet).toContain("&");
  });
});
