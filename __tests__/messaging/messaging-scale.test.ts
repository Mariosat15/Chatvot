import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { unreadFromCounts } from "@/lib/services/messaging/messaging.service";

/*
  Reason (7 Oct 2026): scale guards for 1k+ signed-in clients — unread badge must
  not hydrate full conversations, conversation GET must not write on every poll,
  and send rate limiting prefers Redis across workers.
*/

const ROOT = process.cwd();
const read = (p: string) =>
  readFileSync(join(ROOT, p), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");

describe("messaging scale guards", () => {
  it("unreadFromCounts reads Map and plain object without inventing keys", () => {
    expect(unreadFromCounts(undefined, "u1")).toBe(0);
    expect(unreadFromCounts(new Map([["u1", 3]]), "u1")).toBe(3);
    expect(unreadFromCounts(new Map([["u1", 3]]), "u2")).toBe(0);
    expect(unreadFromCounts({ u1: 2 }, "u1")).toBe(2);
    expect(unreadFromCounts({ u1: 2 }, "toString")).toBe(0);
  });

  it("getUnreadCount only selects unreadCounts", () => {
    const service = read("lib/services/messaging/messaging.service.ts");
    const start = service.indexOf("static async getUnreadCount");
    const end = service.indexOf("static async getEmployeeSupportStats");
    const body = service.slice(start, end);
    expect(body).toMatch(/\.select\(\s*\{\s*unreadCounts:\s*1\s*\}/);
    // Reason: generic form is `.lean<{...}>()` so bare `.lean(` misses.
    expect(body).toMatch(/\.lean</);
    expect(body).not.toMatch(/\.save\(/);
  });

  it("markMessagesAsRead returns early when unread is already zero", () => {
    const service = read("lib/services/messaging/messaging.service.ts");
    const start = service.indexOf("static async markMessagesAsRead");
    // Reason: end at the next method — comment strip removes FRIEND SYSTEM banners.
    const end = service.indexOf("static async sendFriendRequest", start);
    const body = service.slice(start, end);
    expect(end).toBeGreaterThan(start);
    expect(body).toMatch(/unreadFromCounts/);
    expect(body).toMatch(/===\s*0/);
    expect(body).toMatch(/return;/);
    expect(body).toMatch(/Conversation\.updateOne/);
    expect(body).not.toMatch(/\.save\(/);
  });

  it("player conversation GET does not mark messages as read", () => {
    const route = read(
      "app/api/messaging/conversations/[conversationId]/route.ts",
    );
    const getHandler = route.slice(
      route.indexOf("export async function GET"),
      route.indexOf("export async function DELETE"),
    );
    expect(getHandler).not.toMatch(/markMessagesAsRead/);
    expect(getHandler).toMatch(/unreadFromCounts/);
  });

  it("sidebar unread poll is at least 30 seconds", () => {
    const hook = read("hooks/useUnreadMessages.ts");
    expect(hook).toMatch(/POLL_INTERVAL\s*=\s*30000/);
    expect(hook).not.toMatch(/POLL_INTERVAL\s*=\s*10000/);
  });

  it("sendMessage prefers Redis rate limit with memory fallback", () => {
    const service = read("lib/services/messaging/messaging.service.ts");
    expect(service).toMatch(/checkRateLimit as checkRedisRateLimit/);
    expect(service).toMatch(/getRedis/);
    expect(service).toMatch(/messaging:send:/);
    expect(service).toMatch(/rateLimitMap/);
  });

  it("MessagingClient only POSTs /read when opening or when unread > 0", () => {
    const client = read("app/(root)/messaging/MessagingClient.tsx");
    expect(client).toMatch(/isInitial\s*\|\|\s*serverUnread\s*>\s*0/);
    expect(client).toMatch(/\/read/);
  });
});
