import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import {
  USERNAME_MAX_LENGTH,
  resolvePublicName,
  usernameKey,
  validateUsername,
} from "@/lib/utils/username";

const root = path.resolve(__dirname, "../..");
const read = (rel: string) => readFileSync(path.join(root, rel), "utf8");
const stripComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

describe("username rules", () => {
  it("accepts a well-formed handle and returns its lower-cased key", () => {
    expect(validateUsername("  Alice_01 ")).toEqual({
      ok: true,
      value: "Alice_01",
      key: "alice_01",
    });
    expect(usernameKey("BoB")).toBe("bob");
  });

  it.each([
    [undefined],
    [""],
    ["   "],
    ["ab"],
    ["a".repeat(USERNAME_MAX_LENGTH + 1)],
    ["1alice"],
    ["al ice"],
    ["al-ice"],
    ["ADMIN"],
    ["Support"],
  ])("refuses %s", (raw) => {
    expect(validateUsername(raw).ok).toBe(false);
  });
});

describe("resolvePublicName never reveals the real name", () => {
  it("uses the username when present", () => {
    expect(resolvePublicName({ username: " neo ", id: "abc" })).toBe("neo");
  });

  it("falls back to a stable id-derived name, ignoring any real name", () => {
    const user = { id: "64b7f0a1c2d3e4f5a6b7c8d9", name: "Real Person" } as {
      id: string;
      name: string;
    };
    expect(resolvePublicName(user)).toBe("Player_B7C8D9");
    expect(resolvePublicName(user)).not.toContain("Real");
  });

  it("reads _id when id is absent, and never returns an empty string", () => {
    expect(resolvePublicName({ _id: "000000aaaaaa" })).toBe("Player_AAAAAA");
    expect(resolvePublicName(null)).toBe("Player");
  });
});

describe("username module mirror", () => {
  it("is byte-identical in both apps", () => {
    expect(read("apps/admin/lib/utils/username.ts")).toBe(read("lib/utils/username.ts"));
  });
});

describe("PUT /api/user/username", () => {
  const route = stripComments(read("app/api/user/username/route.ts"));

  it("authenticates every handler", () => {
    const handlers = route.match(/export async function (GET|PUT|POST|PATCH|DELETE)\b/g) ?? [];
    const guards = route.match(/auth\.api\.getSession\(/g) ?? [];
    expect(handlers.length).toBe(2);
    expect(guards.length).toBe(handlers.length);
  });

  it("rewrites stored name copies after a change, and only after the save", () => {
    const save = route.indexOf("await setUsername(");
    const sync = route.indexOf("syncPublicNameCopies(userId");
    expect(save).toBeGreaterThan(-1);
    expect(sync).toBeGreaterThan(save);
  });

  it("reports a taken name as a conflict rather than a server error", () => {
    expect(route).toMatch(/result\.code === "taken" \? 409/);
  });
});

describe("profile username control", () => {
  it("is mounted on the settings screen and validates with the shared rule", () => {
    const settings = stripComments(read("components/profile/ProfileSettingsSection.tsx"));
    expect(settings).toMatch(/<UsernameSection \/>/);
    const section = read("components/profile/UsernameSection.tsx");
    expect(section).toMatch(/validateUsername\(draft\)/);
    expect(section).toMatch(/fetch\("\/api\/user\/username", \{\s*method: "PUT"/);
  });
});
