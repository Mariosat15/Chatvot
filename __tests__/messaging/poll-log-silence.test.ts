import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/*
  Reason (7 Oct 2026, owner): an open chat polls conversation GET about once a
  minute and was dumping every message body into PM2 as [ConvAPI]. Support GET,
  admin conversation list, and employees list did the same. Happy-path console.log
  on those routes must stay gone — errors may still use console.error.
*/

const ROOT = process.cwd();
const read = (p: string) =>
  readFileSync(join(ROOT, p), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");

describe("messaging poll log silence", () => {
  it("player conversation GET never dumps message bodies", () => {
    const code = read(
      "app/api/messaging/conversations/[conversationId]/route.ts",
    );
    expect(code).not.toMatch(/\[ConvAPI\]/);
    expect(code).not.toMatch(/Got messages/);
    expect(code).not.toMatch(/Fetching messages for conv/);
    expect(code).not.toMatch(/console\.log/);
    expect(code).toMatch(/console\.error/);
  });

  it("support GET/POST and AI handler do not log happy-path chatter or message text", () => {
    const code = read("app/api/messaging/support/route.ts");
    // Reason: tags may remain on console.error; ban the poll dumps and console.log.
    expect(code).not.toMatch(/User message:/);
    expect(code).not.toMatch(/\[Support GET\] Messages/);
    expect(code).not.toMatch(/\[Support GET\] User:/);
    expect(code).not.toMatch(/\[Support POST\] Content/);
    expect(code).not.toMatch(/console\.log\s*\(/);
    expect(code).toMatch(/console\.error/);
  });

  it("admin conversation list and employees picker do not log on every poll", () => {
    const list = read("apps/admin/app/api/messaging/conversations/route.ts");
    // Reason: GET list is polled; CreateConv POST may still log once — ban GET dumps.
    const getHandler = list.slice(
      list.indexOf("export async function GET"),
      list.indexOf("export async function POST"),
    );
    expect(getHandler).not.toMatch(/console\.log\s*\(/);
    // Reason: `[GetConv]` may remain on console.error; ban poll dumps only.
    expect(getHandler).not.toMatch(/\[GetConv\]\s+(Found|Fetching|Got)/);

    const employees = read("apps/admin/app/api/messaging/employees/route.ts");
    expect(employees).not.toMatch(/Total admins in DB/);
    expect(employees).not.toMatch(/console\.log\s*\(/);
    expect(employees).toMatch(/console\.error/);
  });

  it("admin send-message route does not log message content", () => {
    const code = read(
      "apps/admin/app/api/messaging/conversations/[conversationId]/messages/route.ts",
    );
    expect(code).not.toMatch(/\[SendMsg\] Content/);
    expect(code).not.toMatch(/\[SendMsg\] From:/);
    expect(code).not.toMatch(/console\.log\s*\(/);
  });
});
