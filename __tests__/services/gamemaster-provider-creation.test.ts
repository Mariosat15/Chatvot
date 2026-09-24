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

vi.mock("@/lib/services/gamemaster/platform-fee", () => ({
  FALLBACK_GM_PLATFORM_FEE_PERCENTAGE: 10,
  resolveGameMasterPlatformFeePercentage: vi.fn().mockResolvedValue(12),
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
    // Fee is admin-resolved — body platformFeePercentage is ignored.
    expect(arg.platformFeePercentage).toBe(12);
  });

  it("ignores a GM-supplied platformFeePercentage in the body", async () => {
    const { createGameMasterProviderCompetition } = await import(
      "@/lib/services/gamemaster/create-provider-competition"
    );

    await createGameMasterProviderCompetition({
      body: {
        name: "Fee probe",
        description: "desc",
        providerKey: "chartvolt-games",
        gameCode: "circuit-sprint",
        entryFee: 5,
        maxParticipants: 10,
        platformFeePercentage: 99,
        startTime: new Date(Date.now() + 3600_000).toISOString(),
        endTime: new Date(Date.now() + 7200_000).toISOString(),
      },
      userId: "dddddddddddddddddddddddd",
      gameMasterName: "GM",
      maxUsersPerCompetition: 30,
    });

    expect(createAndPublish.mock.calls[0][0].platformFeePercentage).toBe(12);
    expect(createAndPublish.mock.calls[0][0].platformFeePercentage).not.toBe(99);
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
    [
      "lib/services/gamemaster/platform-fee.ts",
      "apps/admin/lib/services/gamemaster/platform-fee.ts",
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
  const STEPS = "components/gamemaster/provider-contest-wizard-steps.tsx";
  const GATE = "components/gamemaster/CreateCompetitionGate.tsx";
  const OPTIONS = "app/api/gamemaster/creation-options/route.ts";
  const CREATE_ROUTE = "app/api/gamemaster/competitions/route.ts";

  it("provider form uses ChallengeSettingsFields (field-type branch, not game code)", () => {
    const form = code(FORM);
    const steps = code(STEPS);
    // Settings live in the step module; orchestrator must still post gameType provider.
    expect(steps).toMatch(/ChallengeSettingsFields/);
    expect(form + steps).not.toMatch(/circuit-sprint|circuit-perfect|gameCode\s*===/);
    expect(form).toMatch(/gameType:\s*["']provider["']/);
  });

  it("is a multi-step wizard with Creation Progress, not a single page", () => {
    const form = code(FORM);
    expect(form).toMatch(/Creation Progress/);
    expect(form).toMatch(/STEPS/);
    expect(form).toMatch(/setStep/);
    // Five steps: basics, settings, schedule, prizes, launch.
    expect(form).toMatch(/BasicsStep/);
    expect(form).toMatch(/GameSettingsStep/);
    expect(form).toMatch(/ScheduleStep/);
    expect(form).toMatch(/PrizesStep/);
    expect(form).toMatch(/ReviewStep/);
  });

  it("locks platform fee — no editable input; display uses LockedPlatformFee", () => {
    const form = code(FORM);
    const steps = code(STEPS);
    expect(steps).toMatch(/LockedPlatformFee/);
    expect(steps).toMatch(/Set by platform administrators/);
    // Must not offer an editable Platform fee % field.
    expect(form + steps).not.toMatch(/setPlatformFeePercentage/);
    expect(form).not.toMatch(/platformFeePercentage:\s*Number\(/);
    // Create body must not send platformFeePercentage — server stamps Challenge Settings.
    const bodyMatch = form.match(/JSON\.stringify\(\{([\s\S]*?)\}\)/);
    expect(bodyMatch?.[1] ?? "").not.toMatch(/platformFeePercentage/);
  });

  it("gate passes admin fee from creation-options into the wizard", () => {
    const source = code(GATE);
    expect(source).toMatch(/platformFeePercentage=\{platformFeePercentage\}/);
    expect(source).toMatch(/data\.platformFeePercentage/);
  });

  it("gate only shows the picker when provider is allowed and titles exist", () => {
    const source = code(GATE);
    expect(source).toMatch(/allowed\.includes\(\s*["']provider["']\s*\)/);
    expect(source).toMatch(/list\.length\s*>\s*0/);
  });

  it("creation-options lists contestable titles and exposes admin platform fee", () => {
    const source = code(OPTIONS);
    expect(source).toMatch(/listContestableTitles\s*\(/);
    expect(source).toMatch(/resolveCreationLimits\s*\(\s*\{/);
    expect(source).toMatch(/effectiveLimits\.allowedGameTypes/);
    expect(source).toMatch(/resolveGameMasterPlatformFeePercentage\s*\(/);
    expect(source).toMatch(/platformFeePercentage/);
  });

  it("trading and provider create routes ignore body fee and resolve from admin", () => {
    const source = code(CREATE_ROUTE);
    expect(source).toMatch(/resolveGameMasterPlatformFeePercentage\s*\(/);
    // Trading path must not use body.platformFeePercentage || 10.
    expect(source).not.toMatch(/platformFeePercentage\s*\|\|\s*10/);
  });

  it("schedule step uses UTC picker with server clock, never datetime-local", () => {
    const steps = code(STEPS);
    const form = code(FORM);
    const utc = code("components/gamemaster/UtcScheduleFields.tsx");
    expect(steps).toMatch(/UtcScheduleFields/);
    expect(steps + form).not.toMatch(/type=["']datetime-local["']/);
    expect(utc).toMatch(/Current Server Time \(UTC\)/);
    expect(utc).toMatch(/WHITE_DATE_PICKER_CLASS|color-scheme:light|\[color-scheme:light\]/);
    expect(utc).toMatch(/bg-white/);
    expect(utc).toMatch(/type=["']date["']/);
    // Create must append Z so the POST matches the UTC wall-clock on screen.
    expect(form).toMatch(/utcDraftToIso/);
  });

  it("shows daily limit banner and disables wizard from the start", () => {
    const form = code(FORM);
    expect(form).toMatch(/Daily Limit Reached/);
    expect(form).toMatch(/maxCompetitionsPerDay/);
    expect(form).toMatch(/competitionsCreatedToday/);
    // Next and Create both gate on canCreate — not Launch-only.
    expect(form).toMatch(/onClick=\{goNext\}[\s\S]*?disabled=\{!canCreate\}/);
    expect(form).toMatch(/disabled=\{submitting \|\| !canCreate\}/);
  });

  it("utcDraftToIso treats YYYY-MM-DDTHH:mm as UTC, not local", async () => {
    const { utcDraftToIso } = await import(
      "@/components/gamemaster/UtcScheduleFields"
    );
    expect(utcDraftToIso("2026-09-20T13:00")).toBe("2026-09-20T13:00:00.000Z");
    expect(utcDraftToIso("2026-09-20T00:30")).toBe("2026-09-20T00:30:00.000Z");
  });
});
