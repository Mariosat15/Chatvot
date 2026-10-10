/**
 * Live updates: competitions, challenges and messages reach open screens
 * without a refresh (10 Oct 2026).
 *
 * The design is one generic socket event carrying a topic and an id, never the
 * data; the screen re-reads through its own loader. These tests pin the parts
 * that fail silently - a screen that is not told simply stays stale.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { challengeAudience } from "@/lib/services/live-event-hooks";

const root = path.resolve(__dirname, "../..");
const read = (file: string) => readFileSync(path.join(root, file), "utf8");
const code = (file: string) =>
  read(file)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
const count = (text: string, pattern: RegExp) => (text.match(pattern) ?? []).length;

describe("live events - shared modules", () => {
  it.each(["lib/services/live-events.ts", "lib/services/live-event-hooks.ts"])(
    "%s is byte-identical in apps/admin",
    (file) => {
      // Reason: check:mirrors compares models only; operators publish and cancel
      // competitions from the admin app, so a drifted copy there goes quiet.
      expect(read(`apps/admin/${file}`)).toBe(read(file));
    },
  );
});

describe("live events - models announce their own writes", () => {
  it.each([
    "database/models/trading/competition.model.ts",
    "apps/admin/database/models/trading/competition.model.ts",
  ])("%s attaches the competitions topic", (file) => {
    expect(code(file)).toMatch(/attachLiveEventHooks\(CompetitionSchema,\s*"competitions"\)/);
  });

  it.each([
    "database/models/trading/challenge.model.ts",
    "apps/admin/database/models/trading/challenge.model.ts",
  ])("%s attaches the challenges topic with its audience", (file) => {
    expect(code(file)).toMatch(
      /attachLiveEventHooks\(ChallengeSchema,\s*"challenges",\s*challengeAudience\)/,
    );
  });

  it("hooks are attached before the model is compiled", () => {
    // Reason: Mongoose copies middleware when the model is built; a hook added
    // after `model(...)` is never run and nothing reports it.
    for (const [file, schema] of [
      ["database/models/trading/competition.model.ts", "Competition"],
      ["database/models/trading/challenge.model.ts", "Challenge"],
    ] as const) {
      const text = code(file);
      const hook = text.indexOf("attachLiveEventHooks(");
      const compiled = text.indexOf(`model<I${schema}>(`);
      expect(hook).toBeGreaterThan(0);
      expect(compiled).toBeGreaterThan(hook);
    }
  });

  it("an update that changed nothing is not announced", () => {
    expect(code("lib/services/live-event-hooks.ts")).toMatch(/if \(changedCount\(result\) > 0\)/);
  });
});

describe("live events - challenge audience", () => {
  it("a directed challenge reaches its two players only", () => {
    expect(challengeAudience({ challengerId: "a", challengedId: "b" })).toEqual(["a", "b"]);
  });

  it("an open challenge reaches everybody, even after the seat is taken", () => {
    expect(challengeAudience({ openToAnyone: true, challengerId: "a" })).toBeUndefined();
    expect(
      challengeAudience({ openToAnyone: true, challengerId: "a", challengedId: "b" }),
    ).toBeUndefined();
  });

  it("an empty seat is not a recipient", () => {
    expect(challengeAudience({ challengerId: "a", challengedId: "" })).toEqual(["a"]);
  });
});

describe("live events - raw-driver writers publish for themselves", () => {
  it.each([
    ["lib/services/gamemaster/free-private-create.ts", 2],
    ["apps/admin/lib/services/gamemaster/free-private-create.ts", 2],
    ["worker/jobs/early-end-check.job.ts", 2],
    ["worker/jobs/challenge-finalize.job.ts", 1],
  ] as const)("%s announces %i time(s)", (file, expected) => {
    expect(count(code(file), /announceLiveChange\(/g)).toBe(expected);
  });
});

describe("live events - the socket server stays generic", () => {
  const server = code("websocket-server/index.ts");
  const start = server.indexOf('case "live-event"');
  const end = server.indexOf("case ", start + 10);
  const block = server.slice(start, end);

  it("relays any topic through one case", () => {
    expect(start).toBeGreaterThan(0);
    expect(end).toBeGreaterThan(start);
    expect(block).toMatch(/type:\s*"live"/);
  });

  it("names no topic, so a new one needs no socket redeploy", () => {
    expect(block).not.toMatch(/"(competitions|challenges)"/);
  });

  it("tells conversation participants when a message arrives or is read", () => {
    expect(count(server, /void announceToConversationParticipants\(/g)).toBe(2);
  });
});

describe("live events - screens subscribe", () => {
  it("the one socket per tab relays live events to the page", () => {
    const popup = code("components/challenges/ChallengePopup.tsx");
    expect(popup).toMatch(/message\.type === "live"/);
    expect(popup).toMatch(/broadcastLiveEvent\(/);
  });

  it.each([
    ["app/(root)/competitions/page-content.tsx", "competitions"],
    ["app/(root)/challenges/page-content.tsx", "challenges"],
    ["hooks/useUnreadMessages.ts", "messages"],
  ] as const)("%s listens to %s", (file, topic) => {
    expect(code(file)).toContain(`useLiveTopic("${topic}"`);
  });

  it("the competitions list no longer runs the poll that froze on a hidden tab", () => {
    expect(code("app/(root)/competitions/page-content.tsx")).not.toMatch(/setTimeout\(poll/);
  });

  it("the hook only re-reads while the tab is visible and catches up on return", () => {
    const hook = code("hooks/useLiveTopic.ts");
    expect(hook).toMatch(/visibilityState/);
    expect(hook).toMatch(/addEventListener\("visibilitychange"/);
    expect(hook).toMatch(/addEventListener\(LIVE_EVENT/);
  });
});
