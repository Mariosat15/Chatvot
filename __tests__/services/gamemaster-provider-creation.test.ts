/**
 * Game Master provider contest construction (23 Sep 2026).
 *
 * Permission half was already covered by gamemaster-creation-permissions.test.ts.
 * This suite pins the construction half: validation before create, gameMasterId
 * threaded into createAndPublish, mirrors, and the UI gate that reuses ChallengeSettingsFields.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(__dirname, "..", "..");
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");
function code(path: string): string {
  return read(path)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

const createAndPublish = vi.fn();

vi.mock("@/lib/services/game-providers/provider-contest.service", () => ({
  createAndPublishProviderContest: (...args: unknown[]) =>
    createAndPublish(...args),
}));

describe("createGameMasterProviderCompetition validation", () => {
  beforeEach(() => {
    createAndPublish.mockReset();
    createAndPublish.mockResolvedValue({
      success: true,
      competitionId: "comp-1",
      slug: "test-contest",
      warnings: [],
    });
  });

  it("refuses when providerKey or gameCode is missing", async () => {
    const { createGameMasterProviderCompetition } = await import(
      "@/lib/services/gamemaster/create-provider-competition"
    );

    const result = await createGameMasterProviderCompetition({
      body: {
        name: "Race",
        description: "A race",
        entryFee: 10,
        maxParticipants: 20,
        startTime: new Date(Date.now() + 3600_000).toISOString(),
        endTime: new Date(Date.now() + 7200_000).toISOString(),
      },
      userId: "aaaaaaaaaaaaaaaaaaaaaaaa",
      gameMasterName: "GM",
      maxUsersPerCompetition: 50,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/provider and game/i);
    expect(createAndPublish).not.toHaveBeenCalled();
  });

  it("stamps gameMasterId and publishes via the shared helper", async () => {
    const { createGameMasterProviderCompetition } = await import(
      "@/lib/services/gamemaster/create-provider-competition"
    );

    const start = new Date(Date.now() + 3600_000);
    const end = new Date(Date.now() + 7200_000);
    const userId = "bbbbbbbbbbbbbbbbbbbbbbbb";

    const result = await createGameMasterProviderCompetition({
      body: {
        name: "Sprint Night",
        description: "Fast puzzles",
        providerKey: "chartvolt-games",
        gameCode: "circuit-sprint",
        settings: { durationSeconds: 120 },
        entryFee: 25,
        minParticipants: 2,
        maxParticipants: 40,
        startTime: start.toISOString(),
        endTime: end.toISOString(),
      },
      userId,
      gameMasterName: "Ada",
      maxUsersPerCompetition: 50,
    });

    expect(result.ok).toBe(true);
    expect(createAndPublish).toHaveBeenCalledTimes(1);
    const arg = createAndPublish.mock.calls[0][0];
    expect(arg.gameMasterId).toBe(userId);
    expect(arg.gameMasterName).toBe("Ada");
    expect(arg.createdBy).toBe(userId);
    expect(arg.providerKey).toBe("chartvolt-games");
    expect(arg.gameCode).toBe("circuit-sprint");
    expect(arg.settings).toEqual({ durationSeconds: 120 });
    // Cap from package, not a higher body value.
    expect(arg.maxParticipants).toBe(40);
  });

  it("clamps maxParticipants to the package cap", async () => {
    const { createGameMasterProviderCompetition } = await import(
      "@/lib/services/gamemaster/create-provider-competition"
    );

    await createGameMasterProviderCompetition({
      body: {
        name: "Cap test",
        description: "desc",
        providerKey: "chartvolt-games",
        gameCode: "circuit-sprint",
        entryFee: 5,
        maxParticipants: 200,
        startTime: new Date(Date.now() + 3600_000).toISOString(),
        endTime: new Date(Date.now() + 7200_000).toISOString(),
      },
      userId: "cccccccccccccccccccccccc",
      gameMasterName: "GM",
      maxUsersPerCompetition: 30,
    });

    expect(createAndPublish.mock.calls[0][0].maxParticipants).toBe(30);
  });
});

describe("createAndPublishProviderContest composition", () => {
  it("createAndPublish exists on both service copies and calls publish after create", () => {
    const main = code("lib/services/game-providers/provider-contest.service.ts");
    expect(main).toMatch(/export async function createAndPublishProviderContest/);
    expect(main).toMatch(/createProviderContest\s*\(\s*input\s*\)/);
    expect(main).toMatch(/publishProviderContest\s*\(\s*created\.competitionId\s*\)/);
    // gameMasterId is optional and written when present.
    expect(main).toMatch(/gameMasterId/);
  });
});

describe("mirrors stay byte-identical", () => {
  const pairs: [string, string][] = [
    [
      "lib/services/game-providers/provider-contest.service.ts",
      "apps/admin/lib/services/game-providers/provider-contest.service.ts",
    ],
    [
      "lib/services/game-providers/provider-contest-publish.service.ts",
      "apps/admin/lib/services/game-providers/provider-contest-publish.service.ts",
    ],
    [
      "lib/services/gamemaster/create-provider-competition.ts",
      "apps/admin/lib/services/gamemaster/create-provider-competition.ts",
    ],
  ];

  it.each(pairs)("%s matches admin", (main, admin) => {
    expect(read(admin).replace(/\r\n/g, "\n")).toBe(
      read(main).replace(/\r\n/g, "\n"),
    );
  });
});

describe("GM create UI reuses schema settings and does not enumerate games", () => {
  const FORM = "components/gamemaster/ProviderContestCreateForm.tsx";
  const GATE = "components/gamemaster/CreateCompetitionGate.tsx";
  const OPTIONS = "app/api/gamemaster/creation-options/route.ts";

  it("provider form uses ChallengeSettingsFields (field-type branch, not game code)", () => {
    const source = code(FORM);
    expect(source).toMatch(/ChallengeSettingsFields/);
    expect(source).not.toMatch(/circuit-sprint|circuit-perfect|gameCode\s*===/);
    expect(source).toMatch(/gameType:\s*["']provider["']/);
  });

  it("gate only shows the picker when provider is allowed and titles exist", () => {
    const source = code(GATE);
    expect(source).toMatch(/allowed\.includes\(\s*["']provider["']\s*\)/);
    expect(source).toMatch(/list\.length\s*>\s*0/);
  });

  it("creation-options lists contestable titles without inventing a second catalogue", () => {
    const source = code(OPTIONS);
    expect(source).toMatch(/listContestableTitles\s*\(/);
    // Same precedence as the create route - do not re-derive allowedGameTypes here.
    expect(source).toMatch(/resolveCreationLimits\s*\(\s*\{/);
    expect(source).toMatch(/effectiveLimits\.allowedGameTypes/);
  });
});
