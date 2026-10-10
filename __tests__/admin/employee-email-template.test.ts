import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { stripComments } from "../helpers/route-guard-audit";
import { replaceTemplateVariables } from "../../apps/admin/lib/admin/employee-email-template";

// Reason: `replaceTemplateVariables` used to live in a route file, which Next.js only
// lets export handlers, so this guard was structural. It used `String.replace(regex,
// value)`, which reads `$&` and `$$` in the value as replacement patterns. The generated
// password alphabet contains both `$` and `&`, so a password with `$&` in it was emailed
// as something other than the password that was stored. A literal split/join cannot do that.
// Since 3 Oct 2026 the function lives in `apps/admin/lib/admin/employee-email-template.ts`,
// so the same claims are now asserted behaviourally as well; the claims are unchanged and
// only the location moved. The same move added HTML escaping: an `&` followed by `lt`,
// `not` or `para` renders as another character in an HTML body even without a semicolon.
const ROUTE = join(process.cwd(), "apps/admin/app/api/employees/route.ts");
const MODULE = join(process.cwd(), "apps/admin/lib/admin/employee-email-template.ts");

describe("employee credentials email template", () => {
  it("substitutes variables literally so a password with a dollar sign survives", () => {
    const body = stripComments(readFileSync(MODULE, "utf8"));
    expect(body).toMatch(/\.split\(`\{\{\$\{key\}\}\}`\)\.join\(/);
    expect(body).not.toMatch(/new RegExp/);
    expect(body).not.toMatch(/\.replace\(regex/);
    expect(replaceTemplateVariables("pw: {{password}}", { password: "a$&b$$c" })).toBe(
      "pw: a$&b$$c",
    );
  });

  it("escapes the password in the HTML body and leaves the plain-text body alone", () => {
    const vars = { password: "x&lt9&not" };
    expect(replaceTemplateVariables("{{password}}", vars, { html: true })).toBe(
      "x&amp;lt9&amp;not",
    );
    expect(replaceTemplateVariables("{{password}}", vars)).toBe("x&lt9&not");
  });

  it("the route builds the HTML body in HTML mode and no longer carries its own copy", () => {
    const code = stripComments(readFileSync(ROUTE, "utf8"));
    expect(code).toMatch(/replaceTemplateVariables\([\s\S]{0,200}\{\s*html:\s*true\s*,?\s*\}/);
    expect(code).not.toContain("function replaceTemplateVariables(");
  });

  it("the password alphabet really does contain both characters that made this reachable", () => {
    const code = readFileSync(ROUTE, "utf8");
    const alphabet = code.match(/const chars =\s*"([^"]+)"/)?.[1] ?? "";
    expect(alphabet).toContain("$");
    expect(alphabet).toContain("&");
  });
});
