/**
 * Game Master contest notifications (owner, 2 Oct 2026): created (and which kind), started
 * (how many players), finished (what the Game Master earned in total).
 *
 * The wording and the recipient rule are tested as pure functions; the wiring is tested
 * structurally with comments stripped, because the hooks sit inside settlement and cron
 * code that a unit test cannot drive cheaply. The mirror is byte-for-byte, because
 * `check:mirrors` compares models and says nothing about a service.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  createdNoticeVariables,
  finishedRecipients,
  participantCountOf,
  GM_CONTEST_TEMPLATES,
} from "@/lib/services/gamemaster/gm-contest-notifications";

const root = process.cwd();
const read = (p: string) => readFileSync(join(root, p), "utf8");
const code = (p: string) =>
  read(p)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:"'`])\/\/.*$/gm, "$1");

const MODELS = [
  "database/models/notification-template.model.ts",
  "apps/admin/database/models/notification-template.model.ts",
];

/** The `{{var}}` names a template's title and message use, read from the model's defaults. */
function placeholdersOf(file: string, templateId: string): Set<string> {
  const text = read(file);
  const start = text.indexOf(`templateId: "${templateId}"`);
  expect(start).toBeGreaterThan(-1);
  const end = text.indexOf("actionText:", start);
  expect(end).toBeGreaterThan(start);
  const block = text.slice(start, end);
  return new Set([...block.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]));
}

describe("created notice wording", () => {
  it("funded: players enter free, the GM pays per seat, and the reserve is stated", () => {
    const v = createdNoticeVariables(
      { name: "Cup", entryFee: 10, fundingMode: "gm_funded", visibility: "gm_private" },
      200,
    );
    expect(v.contestKind).toBe("Funded");
    expect(v.entryFee).toMatch(/^free for players/);
    expect(v.kindLine).toMatch(/reserved from your balance/);
    expect(v.kindLine).toContain("200");
  });

  it("private and normal are told apart, and a zero fee reads as free", () => {
    const priv = createdNoticeVariables({ name: "A", entryFee: 5, visibility: "gm_private" });
    expect(priv.contestKind).toBe("Private");
    expect(priv.kindLine).toMatch(/affiliated/);
    const normal = createdNoticeVariables({ name: "B", entryFee: 0 });
    expect(normal.contestKind).toBe("Normal");
    expect(normal.entryFee).toBe("free");
    expect(normal.kindLine).toMatch(/every player/);
  });

  it("an unparseable start time never prints Invalid Date", () => {
    expect(createdNoticeVariables({ name: "C", startTime: "nope" }).startTime).not.toMatch(
      /Invalid/,
    );
  });
});

describe("finished notice recipients", () => {
  it("the creator hears even at zero, and every earning GM hears with their own total", () => {
    const r = finishedRecipients("gm1", new Map([["gm2", 4.5]]));
    expect(r.get("gm1")).toBe(0);
    expect(r.get("gm2")).toBe(4.5);
    expect(r.size).toBe(2);
  });

  it("a creator who also earned keeps their earned total, not zero", () => {
    const r = finishedRecipients("gm1", new Map([["gm1", 7]]));
    expect(r.get("gm1")).toBe(7);
    expect(r.size).toBe(1);
  });

  it("an admin contest with no creator GM notifies only the earners", () => {
    expect([...finishedRecipients(null, new Map([["gm2", 1]])).keys()]).toEqual(["gm2"]);
  });

  it("participant count prefers the stored counter, then the array", () => {
    expect(participantCountOf({ currentParticipants: 3, participants: [1] })).toBe(3);
    expect(participantCountOf({ participants: ["a", "b"] })).toBe(2);
    expect(participantCountOf({})).toBe(0);
  });
});

describe("templates exist in BOTH apps and every placeholder is supplied", () => {
  it.each(MODELS)("%s declares the three templates and their types", (file) => {
    const text = read(file);
    for (const id of Object.values(GM_CONTEST_TEMPLATES)) {
      expect(text).toContain(`templateId: "${id}"`);
      expect(text).toContain(`| "${id}"`);
    }
  });

  it.each(MODELS)("%s: created placeholders are all produced", (file) => {
    const supplied = new Set(Object.keys(createdNoticeVariables({ name: "x" })));
    for (const p of placeholdersOf(file, "gm_competition_created")) {
      expect(supplied.has(p), p).toBe(true);
    }
  });

  it.each(MODELS)("%s: started and finished placeholders are all produced", (file) => {
    const svc = code("lib/services/gamemaster/gm-contest-notifications.ts");
    for (const id of ["gm_competition_started", "gm_competition_finished"]) {
      for (const p of placeholdersOf(file, id)) {
        const produced = svc.includes(` ${p},`) || svc.includes(` ${p}:`);
        expect(produced, `${id} needs ${p}`).toBe(true);
      }
    }
  });
});

describe("mirrors are byte-identical", () => {
  it.each([
    "lib/services/gamemaster/gm-contest-notifications.ts",
    "lib/utils/gm-contest-kind.ts",
    "lib/utils/sponsored-contest-copy.ts",
    "lib/services/gamemaster/free-private-create.ts",
    "lib/services/gamemaster/create-provider-competition.ts",
    "lib/services/settlement/contest-rewards.ts",
  ])("%s", (p) => {
    expect(read(`apps/admin/${p}`)).toBe(read(p));
  });
});

describe("wiring", () => {
  it("both insert branches notify, the funded one only after its transaction commits", () => {
    const src = code("lib/services/gamemaster/free-private-create.ts");
    expect(src.match(/notifyGmContestCreated\(doc/g)?.length).toBe(2);
    const tx = src.indexOf("withTransaction(");
    const funded = src.lastIndexOf("notifyGmContestCreated(doc, { reserve })");
    expect(tx).toBeGreaterThan(-1);
    expect(funded).toBeGreaterThan(src.indexOf("});", src.indexOf("reserve = result.reserve")));
  });

  it("the game-contest creator notifies only after the refusal return", () => {
    const src = code("lib/services/gamemaster/create-provider-competition.ts");
    const refusal = src.indexOf("if (!created.success || !created.competitionId)");
    const call = src.indexOf("notifyGmContestCreated(");
    expect(refusal).toBeGreaterThan(-1);
    expect(call).toBeGreaterThan(refusal);
  });

  it.each(["lib/inngest/functions.ts", "apps/admin/lib/inngest/functions.ts"])(
    "%s notifies the Game Master when a contest starts",
    (p) => {
      expect(code(p)).toMatch(/notifyGmContestStarted\(/);
    },
  );

  it("the finish notice is sent for competitions only, before the empty-field early return", () => {
    const src = code("lib/services/settlement/contest-rewards.ts");
    const guard = src.indexOf('if (kind === "competition")');
    const call = src.indexOf("notifyGmContestFinished(contestId)");
    const early = src.indexOf("if (bestByUser.size === 0)");
    expect(guard).toBeGreaterThan(-1);
    expect(call).toBeGreaterThan(guard);
    expect(early).toBeGreaterThan(call);
  });
});
