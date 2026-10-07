import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { resolveChatAvatar } from "@/lib/utils/chat-avatar";

/*
  Reason (7 Oct 2026, owner): Messages list/header could show a face while the
  bubble showed a letter "P", and some list rows stayed as letters even when the
  user had a profile picture. Two causes: bubbles never painted senderAvatar,
  and APIs preferred session.user.image over profileImage.
*/

const ROOT = process.cwd();
const read = (p: string) =>
  readFileSync(join(ROOT, p), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");

describe("resolveChatAvatar", () => {
  it("prefers the message snapshot, then the participant, then nothing", () => {
    expect(
      resolveChatAvatar({
        senderAvatar: " https://cdn/a.webp ",
        participantAvatar: "https://cdn/b.webp",
      }),
    ).toBe("https://cdn/a.webp");
    expect(
      resolveChatAvatar({
        senderAvatar: "",
        participantAvatar: "https://cdn/b.webp",
      }),
    ).toBe("https://cdn/b.webp");
    expect(
      resolveChatAvatar({ senderAvatar: null, participantAvatar: "  " }),
    ).toBeUndefined();
  });
});

describe("messaging avatar plumbing", () => {
  it("message bubbles use resolveChatAvatar and can render an img", () => {
    const client = read("app/(root)/messaging/MessagingClient.tsx");
    expect(client).toMatch(/resolveChatAvatar/);
    // Reason: the bubble branch must be able to paint a picture — a letter-only
    // span with no img path is the defect the owner screenshotted.
    const bubbleStart = client.indexOf("messages.map((msg, index)");
    expect(bubbleStart).toBeGreaterThan(-1);
    const bubbleSlice = client.slice(bubbleStart, bubbleStart + 2500);
    expect(bubbleSlice).toMatch(/bubbleAvatar/);
    expect(bubbleSlice).toMatch(/<img[\s\S]*bubbleAvatar/);
    expect(bubbleSlice).not.toMatch(
      /isAI \?[\s\S]*Sparkles[\s\S]*:[\s\S]*senderName\?\.charAt\(0\)[\s\S]*\}\s*<\/div>\s*\)\}/,
    );
  });

  it("DM send stores profileImage, not only session.user.image", () => {
    const code = read(
      "app/api/messaging/conversations/[conversationId]/messages/route.ts",
    );
    expect(code).toMatch(/getUserById/);
    expect(code).toMatch(/profileImage/);
    // Reason: the old one-liner is the defect — session alone misses uploads.
    expect(code).not.toMatch(
      /senderAvatar:\s*session\.user\.image\s*\?\?\s*undefined/,
    );
  });

  it("conversation list overlays live profile faces on participants", () => {
    const code = read("app/api/messaging/conversations/route.ts");
    const getStart = code.indexOf("export async function GET");
    const getEnd = code.indexOf("export async function POST", getStart);
    const getBody = code.slice(getStart, getEnd);
    expect(getBody).toMatch(/getUsersByIds/);
    expect(getBody).toMatch(/profileImage/);
    expect(getBody).toMatch(/liveAvatar/);
  });

  it("opening a conversation fills blank message senderAvatar from participants", () => {
    const code = read(
      "app/api/messaging/conversations/[conversationId]/route.ts",
    );
    expect(code).toMatch(/getUsersByIds/);
    expect(code).toMatch(/avatarBySender/);
    expect(code).toMatch(
      /msg\.senderAvatar\s*\|\|\s*avatarBySender\.get\(msg\.senderId\)/,
    );
  });

  it("restoring a DM refreshes stored participant avatars", () => {
    const messaging = read("lib/services/messaging/messaging.service.ts");
    const dmStart = messaging.indexOf(
      "static async findOrCreateDirectConversation",
    );
    const dmEnd = messaging.indexOf(
      "static async getOrCreateSupportConversation",
      dmStart,
    );
    const dmBody = messaging.slice(dmStart, dmEnd);
    expect(dmBody).toMatch(/participants\.\$\[u1\]\.avatar/);
    expect(dmBody).toMatch(/arrayFilters/);
  });
});
