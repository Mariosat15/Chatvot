/**
 * X6.5 step A1b - the operator's screen for renaming words, and the writer behind it.
 *
 * THE ONE PROPERTY WORTH ALL THE OTHERS: an untouched field is EMPTY, and the default word is
 * a placeholder. A form seeded with the resolved pack - which is the obvious thing to do,
 * since `useTerms()` is already mounted and hands one over - saves all twenty-three defaults
 * as explicit overrides the first time anybody presses Save. Nothing fails, nothing logs, and
 * the screen looks right. What is lost is the platform's ability to correct a default word
 * ever again on any deployment where somebody opened the screen. So the guard is a NEGATIVE
 * one: the component must not call `useTerms()` at all.
 *
 * The write half is behavioural, against a real MongoDB, because every claim is about what is
 * STORED: whether a cleared token is `$unset` or left as `""`, and whether saving one token
 * leaves the others alone. A structural check cannot tell a write that reported success from
 * one that landed, which is the distinction this codebase keeps finding defects on.
 */

import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  startTestMongo,
  stopTestMongo,
  clearTestMongo,
} from "../helpers/mongo-test-server";
import { TERMINOLOGY_TOKENS, resolveTerms } from "@/lib/constants/terminology";
import {
  getStoredTerminologyOverrides,
  saveTerminologyOverrides,
} from "@/lib/services/terminology.service";
import { WhiteLabel } from "@/database/models/whitelabel.model";

const ROOT = join(__dirname, "..", "..");
const read = (relative: string) => readFileSync(join(ROOT, relative), "utf8");

/** Strip comments, so a file that EXPLAINS an anti-pattern is not flagged for discussing it. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}

const ROUTE = "apps/admin/app/api/terminology/route.ts";
const PANEL = "apps/admin/components/admin/TerminologySettingsSection.tsx";
const DASHBOARD = "apps/admin/components/admin/AdminDashboard.tsx";
const SECTIONS = "apps/admin/database/models/admin-employee.model.ts";
const SERVICE = "lib/services/terminology.service.ts";

beforeAll(async () => {
  const uri = await startTestMongo();
  // Reason: the service calls `connectToDatabase()`, which throws when `MONGODB_URI` is
  // unset - and the message it throws reads like a defect in the code under test.
  process.env.MONGODB_URI = uri;
}, 120_000);

afterAll(async () => {
  await stopTestMongo();
});

afterEach(async () => {
  await clearTestMongo();
});

describe("the route is authorized by the grant, not by being an admin", () => {
  it("every exported handler is matched by a guardSection call", () => {
    const source = stripComments(read(ROUTE));
    const handlers =
      source.match(/export async function (GET|PUT|POST|PATCH|DELETE)\b/g) ?? [];
    const guards = source.match(/guardSection\(/g) ?? [];

    // Reason: counted rather than merely found. A file whose GET is guarded and whose PUT is
    // not satisfies any mention-based check while leaving the mutation wide open - the
    // shape behind R40, R47, R51 and R57.
    expect(handlers.length).toBeGreaterThanOrEqual(2);
    expect(guards.length).toBe(handlers.length);
  });

  it("asks for the terminology section specifically", () => {
    expect(stripComments(read(ROUTE))).toMatch(/guardSection\(\s*"terminology"\s*\)/);
  });

  it("does not use a helper that only asks whether the caller is an admin at all", () => {
    const source = stripComments(read(ROUTE));
    expect(source).not.toMatch(/requireAdminAuth|verifyAdminToken|verifyAdminAuth/);
  });

  it("terminology is a declared admin section, so the grant can be given", () => {
    expect(stripComments(read(SECTIONS))).toMatch(/"terminology"/);
  });
});

describe("the GET hands back stored overrides and defaults separately", () => {
  it("never resolves a merged pack in the route", () => {
    // Reason: a merged pack is the whole defect. Saving one back turns every default into an
    // explicit override, after which a corrected default reaches nobody who opened the screen.
    const source = stripComments(read(ROUTE));
    expect(source).not.toMatch(/\bgetTerms\(|\bresolveTerms\(/);
  });

  it("returns the stored overrides and the defaults under separate keys", () => {
    const source = stripComments(read(ROUTE));
    expect(source).toMatch(/getStoredTerminologyOverrides\(\)/);
    expect(source).toMatch(/overrides,\s*defaults:\s*TERMS/);
  });
});

describe("the PUT validates before it writes", () => {
  it("routes the body through validateTerminologyOverrides", () => {
    expect(stripComments(read(ROUTE))).toMatch(/validateTerminologyOverrides\(/);
  });

  it("refuses before saving, not after", () => {
    const source = stripComments(read(ROUTE));
    const refusal = source.indexOf("validated.error");
    const write = source.indexOf("saveTerminologyOverrides(");

    expect(refusal).toBeGreaterThan(-1);
    expect(write).toBeGreaterThan(-1);
    // Reason: position, not presence. A route that validates and then writes regardless
    // satisfies every assertion about the validator being called.
    expect(refusal).toBeLessThan(write);
  });

  it("refuses an unknown token with a 400 rather than dropping it", () => {
    const source = stripComments(read(ROUTE));
    expect(source).toMatch(/validated\.error[\s\S]{0,200}status:\s*400/);
  });
});

describe("the panel treats the default as a placeholder, never as a value", () => {
  it("does not call useTerms - the resolved pack must not seed the form", () => {
    // Reason: THE load-bearing assertion of this suite. `useTerms()` is mounted and returns
    // the resolved word, so a renamed token would show its own new word as the placeholder
    // and nobody could ever see what the platform says by default.
    expect(stripComments(read(PANEL))).not.toMatch(/\buseTerms\b/);
  });

  it("the input value is the stored override and the placeholder is the default", () => {
    const source = stripComments(read(PANEL));
    expect(source).toMatch(/value=\{draft\.get\(token\)\s*\?\?\s*""\}/);
    expect(source).toMatch(/placeholder=\{DEFAULTS\.get\(token\)\}/);
  });

  it("sends every token on save, including the emptied ones", () => {
    const source = stripComments(read(PANEL));
    // Reason: a cleared box has to arrive as a key with a blank value so the writer can
    // `$unset` it. Omitting it leaves the old override stored while the screen shows it gone.
    expect(source).toMatch(/TERMINOLOGY_TOKENS\.map\(/);
  });

  it("every token appears in exactly one field group", () => {
    const source = read(PANEL);
    const grouped = [...source.matchAll(/tokens:\s*\[([^\]]*)\]/g)].flatMap((match) =>
      [...match[1].matchAll(/"([A-Za-z]+)"/g)].map((token) => token[1]),
    );

    // Reason: a token added to the catalogue and forgotten here is a word no operator can
    // ever change, and the screen looks complete.
    expect([...grouped].sort()).toEqual([...TERMINOLOGY_TOKENS].sort());
    expect(new Set(grouped).size).toBe(grouped.length);
  });
});

describe("the screen is reachable", () => {
  it("the settings menu carries a terminology child", () => {
    expect(stripComments(read(DASHBOARD))).toMatch(/id:\s*"terminology"/);
  });

  it("the section id renders the panel", () => {
    // Reason: sections are driven by `?activeTab=<sectionId>`, so reusing the section id as
    // the case label is what preserves the deep link with no extra code.
    expect(stripComments(read(DASHBOARD))).toMatch(
      /case "terminology":[\s\S]{0,160}<TerminologySettingsSection/,
    );
  });
});

describe("the writer stores what an operator chose and nothing else", () => {
  it("writes dotted paths rather than the whole subdocument", () => {
    const source = stripComments(read(SERVICE));
    expect(source).toMatch(/terminologyOverrides\.\$\{token\}/);
    // Reason: assigning `terminologyOverrides` wholesale silently clears every token the
    // form did not send, and the loss reads as the save having worked.
    expect(source).not.toMatch(/\$set:\s*\{\s*terminologyOverrides:/);
  });

  it("stores an override and reads it back", async () => {
    await saveTerminologyOverrides({ contest: "Tournament" });

    expect(await getStoredTerminologyOverrides()).toMatchObject({
      contest: "Tournament",
    });
  });

  it("a blank value unsets the token rather than storing an empty string", async () => {
    await saveTerminologyOverrides({ contest: "Tournament" });
    await saveTerminologyOverrides({ contest: "" });

    const raw = await WhiteLabel.findOne()
      .select("terminologyOverrides")
      .lean<{ terminologyOverrides?: Record<string, unknown> }>();

    // Reason: a stored "" is a value that has to be reinterpreted as absent on every read,
    // and a reinterpreted value is indistinguishable from an operator who meant it.
    expect(raw?.terminologyOverrides?.contest).toBeUndefined();
  });

  it("saving one token leaves the others alone", async () => {
    await saveTerminologyOverrides({ contest: "Tournament", player: "Competitor" });
    await saveTerminologyOverrides({ contest: "Cup" });

    const stored = await getStoredTerminologyOverrides();
    expect(stored.contest).toBe("Cup");
    expect(stored.player).toBe("Competitor");
  });

  it("trims a padded word, so an accidental space is not a different noun", async () => {
    // Reason: TWO layers hold this and the probe had to break both before it went red -
    // `.trim()` in the writer and `trim: true` on all twenty-three schema fields. Worth
    // stating rather than crediting the service alone: the first version of this comment
    // said the writer trimmed, which is true and is not why the test passes.
    await saveTerminologyOverrides({ contest: "  Tournament  " });
    expect((await getStoredTerminologyOverrides()).contest).toBe("Tournament");
  });

  it("creates the settings document when none exists yet", async () => {
    // Reason: a fresh deployment has no WhiteLabel document, and an operator renaming a word
    // before anybody uploads a logo must not hit a write that silently matches nothing.
    await saveTerminologyOverrides({ player: "Competitor" });
    expect((await getStoredTerminologyOverrides()).player).toBe("Competitor");
  });

  it("ignores a key that is not a token rather than writing it", async () => {
    // Reason: the REFUSAL belongs at the route, where an operator is present to read it.
    // What stops an unknown key BEING STORED is Mongoose strict mode over twenty-three
    // declared fields, not the writer's own guard - a probe removing that guard left this
    // green, so the honest claim is that two layers agree rather than that the service
    // enforces it. The guard still matters for the sibling assertion below, and it is the
    // only thing that would hold if `terminologyOverrides` ever became a Map or Mixed.
    await saveTerminologyOverrides({
      contest: "Tournament",
      nonsense: "Whatever",
    } as never);

    const raw = await WhiteLabel.findOne()
      .select("terminologyOverrides")
      .lean<{ terminologyOverrides?: Record<string, unknown> }>();

    expect(raw?.terminologyOverrides?.contest).toBe("Tournament");
    expect(raw?.terminologyOverrides?.nonsense).toBeUndefined();
  });

  it("an unknown key on its own causes no write at all", async () => {
    // Reason: this is where the writer's token guard IS observable, and it is the assertion
    // the previous one could not make. With the guard removed the update is non-empty, so
    // the upsert CREATES a settings document - stripped of the junk path, so the stored
    // wording is identical and the only witness is the document's existence. A caller-named
    // path reaching `$unset` is how an unrelated part of a settings document gets deleted.
    await saveTerminologyOverrides({ nonsense: "Whatever" } as never);

    expect(await WhiteLabel.countDocuments()).toBe(0);
  });

  it("a stored override still resolves through the shared resolver", async () => {
    await saveTerminologyOverrides({ contest: "Tournament" });
    const stored = await getStoredTerminologyOverrides();

    expect(resolveTerms(stored).contest).toBe("Tournament");
    expect(resolveTerms({}).contest).toBe("Competition");
  });

  it("the two service copies stay byte-identical", () => {
    // Reason: `check:mirrors` compares MODELS, so it has never had an opinion about this
    // file - and the admin copy is the one that runs when an operator presses Save.
    expect(read("apps/admin/lib/services/terminology.service.ts")).toBe(read(SERVICE));
  });
});
