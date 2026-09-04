/**
 * X6 - the game providers admin screen.
 *
 * Two kinds of test here, and the split is deliberate.
 *
 * The BEHAVIOURAL tests run against a real MongoDB, because every interesting rule in this
 * feature is a rule about what is persisted: that registering leaves a provider off, that a
 * blank secret box keeps the stored value, that rotation retains the outgoing secret. None
 * of those can be checked by reading the code.
 *
 * The STRUCTURAL tests read the route and component files as text, because the rules they
 * pin are absences - no endpoint returns a secret, no route settles for "is an admin". An
 * absence cannot be asserted by calling something; a test that calls the endpoints would
 * pass just as happily on the day someone adds the one that leaks.
 *
 * WHICH COPY OF EACH MODEL THIS FILE SEEDS IS NOT A FREE CHOICE, and getting it wrong
 * produces a test that fails as though the service were broken. The service under test
 * lives in `apps/admin`, but vitest maps `@` to the REPO ROOT, so its `@/database/...`
 * imports resolve to the MAIN app's models - not to the admin copies sitting beside it.
 * Probed rather than reasoned about: `mainModel.base === mongoose` is true and
 * `adminModel.base === mongoose` is false, because `apps/admin` has its own
 * `node_modules/mongoose` and therefore its own instance.
 *
 * So this file seeds the MAIN copies, which is what the service actually reads. Seeding the
 * admin copies instead puts the fixtures on a second Mongoose instance the service never
 * touches, and every assertion then fails on an empty collection - which reads exactly like
 * a logic bug. Testing the service against the main models is sound because the two copies
 * are byte-identical mirrors, enforced by `npm run check:mirrors`.
 *
 * Only ONE copy of each model is imported here. Both register under the same model name via
 * `models.X || model(...)`, so importing both would silently return whichever registered
 * first and this file would examine the wrong schema while looking entirely correct.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  describe,
  it,
  expect,
  beforeAll,
  beforeEach,
  afterAll,
  afterEach,
  vi,
} from "vitest";
import mongoose from "mongoose";
import {
  startTestMongo,
  stopTestMongo,
  clearTestMongo,
} from "../helpers/mongo-test-server";

// Reason: the harness owns the connection. The real helper would dial the configured
// MONGODB_URI, which in a test run is either absent or, worse, production.
vi.mock("@/database/mongoose", () => ({
  connectToDatabase: async () => mongoose.connection,
  default: async () => mongoose.connection,
}));

const GameProvider = (
  await import("../../database/models/games/game-provider.model")
).default;
const ProviderGame = (
  await import("../../database/models/games/provider-game.model")
).default;
const { WhiteLabel } = await import("../../database/models/whitelabel.model");
const {
  registerProvider,
  setProviderEnabled,
  saveCredentials,
  completeRotation,
  listProviders,
  setTitleEnabled,
  validateProviderKey,
} = await import(
  "../../apps/admin/lib/services/game-providers/provider-admin.service"
);
const { MOCK_PROVIDER_KEY } = await import(
  "../../lib/services/game-providers/adapters/mock.adapter"
);
const { ADMIN_SECTIONS } = await import(
  "../../apps/admin/database/models/admin-employee.model"
);

const REPO_ROOT = join(__dirname, "..", "..");
const read = (relative: string) =>
  readFileSync(join(REPO_ROOT, relative), "utf8");

/**
 * Reads a file with comments removed.
 *
 * REQUIRED, NOT TIDINESS. The first version of this file asserted that the routes never
 * mention `requireAdminAuth`, and it failed - on a comment in the route explaining why
 * `requireAdminAuth` is the wrong helper to use. A structural test that reads prose fails
 * in both directions: it flags a correct file that discusses the anti-pattern, and it
 * passes a broken one whose only mention of the right helper is in a comment.
 */
const readCode = (relative: string) =>
  read(relative)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^[ \t]*\/\/.*$/gm, "");

/**
 * A COMPLETE `provider_game`, not merely the fields these tests read.
 *
 * Mongoose validates the whole document, so a fixture trimmed to what the assertions touch
 * fails every test in the block at once for one unrelated reason - here `scoreType`,
 * `scoreDirection` and an invented `family` value. That has now happened four times in this
 * project, and it keeps recurring because trimming a fixture always feels like tidying.
 */
async function seedTitle(overrides: Record<string, unknown> = {}) {
  return ProviderGame.create({
    providerKey: MOCK_PROVIDER_KEY,
    gameCode: "reaction-time",
    gameKey: `provider:${MOCK_PROVIDER_KEY}:reaction-time`,
    displayName: "Reaction Time",
    family: "independent",
    scoreType: "duration_ms",
    scoreDirection: "lower_is_better",
    providerStatus: "active",
    ...overrides,
  });
}

describe("X6 game providers admin", () => {
  beforeAll(async () => {
    const uri = await startTestMongo();
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(uri, { serverSelectionTimeoutMS: 30_000 });
    }
  }, 120_000);

  afterAll(async () => {
    await stopTestMongo();
  });

  afterEach(async () => {
    await clearTestMongo();
  });

  // ---------------------------------------------------------------- registration

  describe("registering a provider", () => {
    it("leaves the new provider switched off", async () => {
      // Reason: this is the whole safety property of registration. If a provider were
      // created enabled, entering API details would be enough to expose games, and the
      // operator's next two decisions would have been made for them.
      const result = await registerProvider({
        providerKey: "acme-games",
        displayName: "ACME Games",
        baseUrl: "https://api.acme-games.test",
      });

      expect(result.success).toBe(true);

      const stored = await GameProvider.findOne({ providerKey: "acme-games" });
      expect(stored?.enabled).toBe(false);

      const settings = await WhiteLabel.findOne();
      const entry = settings?.gameProviders?.find(
        (p) => p.providerKey === "acme-games",
      );
      expect(entry?.enabled).toBe(false);
    });

    it("refuses a key that would corrupt gameKey", async () => {
      // `gameKey` is `provider:<key>:<code>` and is immutable, so a key containing a colon
      // produces a key nothing can parse back and nothing can correct.
      expect(validateProviderKey("acme:games")).not.toBeNull();
      expect(validateProviderKey("Acme")).not.toBeNull();
      expect(validateProviderKey("-acme")).not.toBeNull();
      expect(validateProviderKey("ab")).not.toBeNull();
      expect(validateProviderKey("acme-games")).toBeNull();
    });

    it("refuses a non-https base URL", async () => {
      const result = await registerProvider({
        providerKey: "acme-games",
        displayName: "ACME Games",
        baseUrl: "http://api.acme-games.test",
      });

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/https/i);
      expect(await GameProvider.countDocuments()).toBe(0);
    });

    it("refuses a duplicate key rather than overwriting the existing provider", async () => {
      await registerProvider({
        providerKey: "acme-games",
        displayName: "ACME Games",
        baseUrl: "https://api.acme-games.test",
      });
      const second = await registerProvider({
        providerKey: "acme-games",
        displayName: "Someone Else",
        baseUrl: "https://elsewhere.test",
      });

      expect(second.success).toBe(false);
      const stored = await GameProvider.findOne({ providerKey: "acme-games" });
      expect(stored?.displayName).toBe("ACME Games");
    });
  });

  // ------------------------------------------------------------ enabling refusals

  describe("enabling a provider", () => {
    it("refuses when no code adapter is installed", async () => {
      // Reason: without an adapter, resolveEnabledProvider refuses every round with a
      // message the operator cannot act on. The switch would appear to work and silently
      // do nothing - the failure shape this codebase keeps hitting.
      await registerProvider({
        providerKey: "acme-games",
        displayName: "ACME Games",
        baseUrl: "https://api.acme-games.test",
      });
      await saveCredentials("acme-games", {
        environment: "sandbox",
        callbackSecret: "s3cret-value",
      });

      const result = await setProviderEnabled("acme-games", true);

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/adapter/i);
      expect((await GameProvider.findOne({ providerKey: "acme-games" }))?.enabled).toBe(
        false,
      );
    });

    it("refuses when no callback secret is stored", async () => {
      // Without it every inbound result fails signature verification, which is
      // indistinguishable from an attack in the logs.
      await registerProvider({
        providerKey: MOCK_PROVIDER_KEY,
        displayName: "Mock",
        baseUrl: "https://mock.test",
      });

      const result = await setProviderEnabled(MOCK_PROVIDER_KEY, true);
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/callback secret/i);
    });

    it("enables once an adapter and a callback secret both exist", async () => {
      await registerProvider({
        providerKey: MOCK_PROVIDER_KEY,
        displayName: "Mock",
        baseUrl: "https://mock.test",
      });
      await saveCredentials(MOCK_PROVIDER_KEY, {
        environment: "sandbox",
        callbackSecret: "s3cret-value",
      });

      const result = await setProviderEnabled(MOCK_PROVIDER_KEY, true);
      expect(result.success).toBe(true);

      const settings = await WhiteLabel.findOne();
      expect(
        settings?.gameProviders?.find((p) => p.providerKey === MOCK_PROVIDER_KEY)
          ?.enabled,
      ).toBe(true);
    });

    it("does not turn on the platform master switch as a side effect", async () => {
      // Reason: enabling a provider must stay one decision. If it flipped the master
      // switch too, the reversible-in-one-action property of the kill switch would be gone.
      await registerProvider({
        providerKey: MOCK_PROVIDER_KEY,
        displayName: "Mock",
        baseUrl: "https://mock.test",
      });
      await saveCredentials(MOCK_PROVIDER_KEY, {
        environment: "sandbox",
        callbackSecret: "s3cret-value",
      });
      await setProviderEnabled(MOCK_PROVIDER_KEY, true);

      const settings = await WhiteLabel.findOne().select("externalGamesEnabled");
      expect(settings?.externalGamesEnabled).toBe(false);
    });
  });

  // ------------------------------------------------------------------ credentials

  describe("credentials", () => {
    beforeEachRegisterMock();

    it("keeps the stored value when a field is submitted blank", async () => {
      // THE SILENT FAILURE THIS PREVENTS: the UI can never show a stored secret, so an
      // operator changing only the environment submits three empty boxes. If empty meant
      // "clear", that harmless edit would break every inbound callback with no error
      // raised anywhere.
      await saveCredentials(MOCK_PROVIDER_KEY, {
        environment: "sandbox",
        apiKey: "key-one",
        apiSecret: "secret-one",
        callbackSecret: "callback-one",
      });

      await saveCredentials(MOCK_PROVIDER_KEY, {
        environment: "production",
        apiKey: "",
        apiSecret: undefined,
        callbackSecret: "   ",
      });

      const settings = await WhiteLabel.findOne().select("+gameProviderCredentials");
      const credential = settings?.gameProviderCredentials?.find(
        (c) => c.providerKey === MOCK_PROVIDER_KEY,
      );

      expect(credential?.environment).toBe("production");
      expect(credential?.apiKey).toBe("key-one");
      expect(credential?.apiSecret).toBe("secret-one");
      expect(credential?.callbackSecret).toBe("callback-one");
    });

    it("retains the outgoing callback secret when it is replaced", async () => {
      // Chapter 06 section 8: a callback signed moments before the change is still in
      // flight when the new secret lands. Rejecting it would discard a real score because
      // of an operational action the provider was never told about.
      await saveCredentials(MOCK_PROVIDER_KEY, {
        environment: "sandbox",
        callbackSecret: "callback-one",
      });
      await saveCredentials(MOCK_PROVIDER_KEY, {
        environment: "sandbox",
        callbackSecret: "callback-two",
      });

      const settings = await WhiteLabel.findOne().select("+gameProviderCredentials");
      const credential = settings?.gameProviderCredentials?.find(
        (c) => c.providerKey === MOCK_PROVIDER_KEY,
      );

      expect(credential?.callbackSecret).toBe("callback-two");
      expect(credential?.previousCallbackSecret).toBe("callback-one");
      expect(credential?.rotatedAt).toBeInstanceOf(Date);
    });

    it("stops accepting the previous secret once the rotation window is closed", async () => {
      await saveCredentials(MOCK_PROVIDER_KEY, {
        environment: "sandbox",
        callbackSecret: "callback-one",
      });
      await saveCredentials(MOCK_PROVIDER_KEY, {
        environment: "sandbox",
        callbackSecret: "callback-two",
      });

      const result = await completeRotation(MOCK_PROVIDER_KEY);
      expect(result.success).toBe(true);

      const settings = await WhiteLabel.findOne().select("+gameProviderCredentials");
      const credential = settings?.gameProviderCredentials?.find(
        (c) => c.providerKey === MOCK_PROVIDER_KEY,
      );
      expect(credential?.previousCallbackSecret).toBeFalsy();
      expect(credential?.callbackSecret).toBe("callback-two");
    });

    it("does not treat the first stored secret as a rotation", async () => {
      // Found by the presence-booleans test failing on a stray `rotatedAt`. Harmless in
      // effect - there is no previous secret to accept either way - but it records a
      // rotation that never happened, and an operator reading that date would believe one
      // had.
      await saveCredentials(MOCK_PROVIDER_KEY, {
        environment: "sandbox",
        callbackSecret: "callback-one",
      });

      const settings = await WhiteLabel.findOne().select("+gameProviderCredentials");
      const credential = settings?.gameProviderCredentials?.find(
        (c) => c.providerKey === MOCK_PROVIDER_KEY,
      );
      expect(credential?.rotatedAt).toBeFalsy();
      expect(credential?.previousCallbackSecret).toBeFalsy();
    });

    it("does not start a rotation when the same secret is resubmitted", async () => {
      // Reason: an operator re-saving an unchanged form would otherwise park the current
      // secret in `previousCallbackSecret`, widening the accepted set for no reason.
      await saveCredentials(MOCK_PROVIDER_KEY, {
        environment: "sandbox",
        callbackSecret: "callback-one",
      });
      await saveCredentials(MOCK_PROVIDER_KEY, {
        environment: "sandbox",
        callbackSecret: "callback-one",
      });

      const settings = await WhiteLabel.findOne().select("+gameProviderCredentials");
      const credential = settings?.gameProviderCredentials?.find(
        (c) => c.providerKey === MOCK_PROVIDER_KEY,
      );
      expect(credential?.previousCallbackSecret).toBeFalsy();
    });
  });

  // ------------------------------------------------- secrets never leave the server

  describe("the provider list never carries a secret value", () => {
    beforeEachRegisterMock();

    it("returns presence booleans, and none of the stored values appear anywhere in it", async () => {
      const apiKey = "key-abc123";
      const apiSecret = "secret-def456";
      const callbackSecret = "callback-ghi789";
      const secrets = [apiKey, apiSecret, callbackSecret];

      await saveCredentials(MOCK_PROVIDER_KEY, {
        environment: "sandbox",
        apiKey,
        apiSecret,
        callbackSecret,
      });

      const providers = await listProviders();
      const row = providers.find((p) => p.providerKey === MOCK_PROVIDER_KEY);

      expect(row?.credentials).toEqual({
        environment: "sandbox",
        hasApiKey: true,
        hasApiSecret: true,
        hasCallbackSecret: true,
        hasPreviousCallbackSecret: false,
        rotatedAt: undefined,
      });

      // Reason for serialising the WHOLE payload and searching it: asserting on the
      // `credentials` field only would still pass if a secret were attached somewhere
      // else on the row, which is exactly how this kind of leak happens.
      const serialised = JSON.stringify(providers);
      for (const secret of secrets) {
        expect(serialised).not.toContain(secret);
      }
    });
  });

  // -------------------------------------------------------------- the two switches

  describe("per-title enabling", () => {
    beforeEachRegisterMock();

    it("refuses to enable a title the provider does not report as active", async () => {
      await seedTitle({ providerStatus: "maintenance" });

      const result = await setTitleEnabled(
        MOCK_PROVIDER_KEY,
        "reaction-time",
        true,
      );

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/maintenance/);
      const title = await ProviderGame.findOne({ gameCode: "reaction-time" });
      expect(title?.chartvoltEnabled).toBe(false);
    });

    it("still allows disabling a title the provider has withdrawn", async () => {
      // Reason: the refusal above must not trap a title in the enabled state. A provider
      // deprecating a game we had already switched on is precisely when an operator most
      // needs the off switch to work.
      await seedTitle({ providerStatus: "active", chartvoltEnabled: true });
      await ProviderGame.updateOne(
        { gameCode: "reaction-time" },
        { $set: { providerStatus: "deprecated" } },
      );

      const result = await setTitleEnabled(
        MOCK_PROVIDER_KEY,
        "reaction-time",
        false,
      );

      expect(result.success).toBe(true);
      const title = await ProviderGame.findOne({ gameCode: "reaction-time" });
      expect(title?.chartvoltEnabled).toBe(false);
    });

    it("defaults a freshly cached title to off", async () => {
      const title = await seedTitle();
      expect(title.chartvoltEnabled).toBe(false);
    });
  });

  // ------------------------------------------------------------------- structural

  describe("RBAC registration", () => {
    it("registers both new section ids without removing any existing one", () => {
      // ADMIN_SECTIONS is a Mongoose enum on allowedSections AND customPermissions, so it
      // is add-only: removing a value orphans every employee document storing it.
      expect(ADMIN_SECTIONS).toContain("game-providers");
      expect(ADMIN_SECTIONS).toContain("provider-health");

      for (const previouslyGrantable of [
        "payment-providers",
        "symbols",
        "market-data",
        "trading-risk",
        "fraud",
        "employees",
      ]) {
        expect(ADMIN_SECTIONS).toContain(previouslyGrantable);
      }
    });

    it("does not make the menu parent grantable", () => {
      // A grant mapping to no screen is where privilege widening starts, and it reviews as
      // harmless.
      expect(ADMIN_SECTIONS).not.toContain("trading-menu");
    });

    it("wires the section into the GAMES group and to a rendered component", () => {
      const dashboard = readCode("apps/admin/components/admin/AdminDashboard.tsx");

      expect(dashboard).toContain('id: "game-providers"');
      expect(dashboard).toContain('case "game-providers"');
      expect(dashboard).toContain("<GameProvidersSection");

      // Reason: a section id present in ADMIN_SECTIONS but absent from the menu can be
      // granted and never reached; present in the menu but absent from ADMIN_SECTIONS it
      // can be reached only by a super admin. Both halves have to exist.
      const gamesGroupIndex = dashboard.indexOf('id: "games"');
      const userManagementIndex = dashboard.indexOf('id: "user-management"');
      const providerItemIndex = dashboard.indexOf('id: "game-providers"');
      expect(gamesGroupIndex).toBeGreaterThan(-1);
      expect(providerItemIndex).toBeGreaterThan(gamesGroupIndex);
      expect(providerItemIndex).toBeLessThan(userManagementIndex);
    });
  });

  describe("route-level authorisation and secret containment", () => {
    const routes = [
      "apps/admin/app/api/games/providers/route.ts",
      "apps/admin/app/api/games/providers/[providerKey]/route.ts",
      "apps/admin/app/api/games/providers/[providerKey]/credentials/route.ts",
      "apps/admin/app/api/games/providers/[providerKey]/sync/route.ts",
      "apps/admin/app/api/games/providers/[providerKey]/games/route.ts",
    ];

    it("guards every route on the section grant, not merely on being an admin", () => {
      // requireAdminAuth only asks whether the caller is an admin at all, so an employee
      // granted one unrelated section passes it. These routes reach provider credentials.
      for (const route of routes) {
        const source = readCode(route);
        expect(source, route).toContain('guardSection("game-providers")');
        expect(source, route).not.toContain("requireAdminAuth");
      }
    });

    it("guards every exported handler, not just the first one", () => {
      // Reason: a file whose GET is guarded and whose PATCH is not passes the check above
      // while leaving the mutation open. Count the handlers and count the guards.
      for (const route of routes) {
        const source = readCode(route);
        const handlers = (
          source.match(/^export async function (GET|POST|PUT|PATCH|DELETE)/gm) ?? []
        ).length;
        const guards = (source.match(/guardSection\("game-providers"\)/g) ?? [])
          .length;
        expect(handlers, route).toBeGreaterThan(0);
        expect(guards, route).toBe(handlers);
      }
    });

    it("exposes no endpoint that could return a stored credential", () => {
      // The absence IS the protection. Chapter 04 section 2.3 says these are never
      // returned to the client, so the read endpoint that would make it possible must not
      // exist - unlike the payment-providers screen, which does round-trip its secrets.
      const credentialsRoute = readCode(
        "apps/admin/app/api/games/providers/[providerKey]/credentials/route.ts",
      );
      expect(credentialsRoute).not.toMatch(/^export async function GET/m);
    });

    it("never selects the credential field in a route that responds with the document", () => {
      // `select: false` protects a plain read; a route explicitly asking for
      // "+gameProviderCredentials" and returning the document would bypass it while
      // looking like ordinary Mongoose.
      for (const route of routes) {
        const source = readCode(route);
        expect(source, route).not.toContain("+gameProviderCredentials");
      }
    });

    it("records that secrets changed without recording the values", () => {
      // An audit log is read by more people than the settings screen, so writing a secret
      // into it widens exposure while looking like diligence.
      const source = readCode(
        "apps/admin/app/api/games/providers/[providerKey]/credentials/route.ts",
      );
      expect(source).toContain("apiKeyChanged");
      expect(source).not.toMatch(/newValue:\s*\{[^}]*apiKey:\s*body\.apiKey/);
    });
  });

  describe("the credentials dialog cannot display a secret", () => {
    it("never pre-fills a secret field from server data", () => {
      const dialog = readCode(
        "apps/admin/components/admin/games/ProviderCredentialsDialog.tsx",
      );

      // The three inputs are initialised to empty strings, not from `provider`.
      expect(dialog).toContain('useState("")');
      expect(dialog).not.toMatch(/useState\(\s*provider\?\.credentials\?\.(api|callback)/);

      // Reason: the client type carries booleans, so there is nothing renderable to leak
      // even if a future edit tried.
      const types = readCode("apps/admin/components/admin/games/provider-types.ts");
      expect(types).toContain("hasApiKey: boolean");
      expect(types).not.toMatch(/^\s*apiKey\?:\s*string/m);
    });
  });
});

/**
 * Registers the mock provider before each test in the enclosing block.
 *
 * Reason for a helper rather than a repeated hook: `clearTestMongo` runs after every test,
 * so the provider row has to be recreated, and three blocks need it.
 */
function beforeEachRegisterMock() {
  beforeEach(async () => {
    await registerProvider({
      providerKey: MOCK_PROVIDER_KEY,
      displayName: "Mock Provider",
      baseUrl: "https://mock.test",
    });
  });
}
