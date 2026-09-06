import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
} from "vitest";
import crypto from "crypto";
import mongoose from "mongoose";
import {
  startTestMongo,
  stopTestMongo,
  clearTestMongo,
  ensureCollections,
} from "../helpers/mongo-test-server";

import ProviderEvent from "../../database/models/games/provider-event.model";
import { WhiteLabel } from "../../database/models/whitelabel.model";
import {
  MockProviderAdapter,
  MOCK_PROVIDER_KEY,
} from "../../lib/services/game-providers/adapters/mock.adapter";
import { getProviderAdapter } from "../../lib/services/game-providers/registry";
import { loadProviderSecrets } from "../../lib/services/games/callback-verification";
import { ingestProviderCallback } from "../../lib/services/games/result-ingestion.service";

/**
 * R34 - the platform could not honour the callback authentication its own issued spec
 * promises.
 *
 * `01` section 2.2 and `ChartVolt-Game-API-Requirements.html` both tell providers to send
 * `Authorization: Bearer {CALLBACK_TOKEN}`, described as "a token we issue to you". No such
 * field existed, so `loadProviderSecrets` returned `credentials.apiKey` - the key the
 * PROVIDER issues US for outbound calls. A provider implementing the document exactly was
 * refused at gate 3, and that refusal is `alert: "critical"` with the message "either
 * credentials are wrong or someone is probing the endpoint", so **a correct integration read
 * as an attack.**
 *
 * WHY THESE TESTS SEED THE TWO FIELDS TO DIFFERENT VALUES. A fixture where the token and the
 * key are equal cannot tell the two branches apart: the wrong branch produces the right
 * answer and the probe stays green. That is the trap that made the first R31 precedence test
 * useless, and it is the whole design of this file.
 *
 * Everything here is latent rather than historical: no real provider exists, so nothing has
 * ever been refused in production and there is nothing to backfill.
 */

const CALLBACK_TOKEN = "the-token-WE-issued-them";
const API_KEY = "the-key-THEY-issued-us";
const CALLBACK_SECRET = "callback-signing-secret";

const COLLECTIONS = ["provider_event", "whitelabels"];

beforeAll(async () => {
  const uri = await startTestMongo();
  await mongoose.connect(uri);
  await ensureCollections(COLLECTIONS);
}, 120_000);

afterAll(async () => {
  await mongoose.disconnect();
  await stopTestMongo();
});

beforeEach(async () => {
  await clearTestMongo();
  await ensureCollections(COLLECTIONS);

  /*
   * THE SIGNATURE IS CHECKED TWICE, AND ONLY ONE OF THEM READS THE DATABASE.
   *
   * Gate 5 verifies the HMAC against the secret stored on `WhiteLabel`; gate 5b then asks the
   * adapter to check it again with whatever secret the adapter itself holds. Both are
   * deliberate - the engine's copy cannot be weakened by a badly-written adapter, and the
   * adapter's copy lets a provider with different headers be stricter.
   *
   * The consequence for a test aimed at gate 3: leaving the mock unconfigured fails at gate
   * 5b with `signature_invalid`, which is the SAME result gate 3 returns. So a fix to the
   * bearer token would look like it had not worked at all. This line is what keeps the
   * failure attributable.
   */
  const mock = getProviderAdapter(MOCK_PROVIDER_KEY) as MockProviderAdapter;
  mock.reset();
  mock.configure({ callbackSecret: CALLBACK_SECRET });
});

/** Seeds an enabled provider with whichever credential fields the test cares about. */
async function seedCredentials(credential: {
  apiKey?: string;
  callbackToken?: string;
  callbackSecret?: string;
}): Promise<void> {
  await WhiteLabel.create({
    externalGamesEnabled: true,
    gameProviders: [{ providerKey: MOCK_PROVIDER_KEY, enabled: true }],
    gameProviderCredentials: [
      {
        providerKey: MOCK_PROVIDER_KEY,
        environment: "sandbox",
        ...credential,
      },
    ],
  });
}

describe("R34 - which stored field becomes the inbound bearer token", () => {
  it("prefers the callback token WE issue over the API key THEY issued us", async () => {
    // The two values differ on purpose. With the pre-R34 line - `callbackToken:
    // credentials?.apiKey` - this test fails on the value, not merely on the source.
    await seedCredentials({ apiKey: API_KEY, callbackToken: CALLBACK_TOKEN });

    const secrets = await loadProviderSecrets(MOCK_PROVIDER_KEY);

    expect(secrets?.callbackToken).toBe(CALLBACK_TOKEN);
    expect(secrets?.callbackTokenSource).toBe("callbackToken");
  });

  it("falls back to the API key for a provider enabled before the field existed", async () => {
    /*
     * The compatibility path, and it is deliberate rather than incidental. Removing it would
     * mean every provider already configured stops authenticating the moment this deploys -
     * a schema default fixes future rows only, and no migration can invent a token both
     * sides already agree on.
     *
     * `setProviderEnabled` requires the explicit field, so nothing NEW can arrive here.
     */
    await seedCredentials({ apiKey: API_KEY });

    const secrets = await loadProviderSecrets(MOCK_PROVIDER_KEY);

    expect(secrets?.callbackToken).toBe(API_KEY);
    expect(secrets?.callbackTokenSource).toBe("apiKey");
  });

  it("treats a blank stored token as absent rather than offering it", async () => {
    /*
     * WHY `||` AND NOT `??`, stated as a test because the two differ only on this input.
     * `??` would return the empty string, and an empty token is not merely useless - gate 3
     * compares it with `safeEqual`, and `safeEqual("", "")` is TRUE, so an empty stored token
     * against a request carrying no `Authorization` header at all would authenticate
     * anybody. Gate 3 does guard this separately, which is exactly why it must not be the
     * only place it is handled.
     */
    await seedCredentials({ apiKey: API_KEY, callbackToken: "" });

    const secrets = await loadProviderSecrets(MOCK_PROVIDER_KEY);

    expect(secrets?.callbackToken).toBe(API_KEY);
    expect(secrets?.callbackTokenSource).toBe("apiKey");
  });

  it("reports no token and no source when neither field is stored", async () => {
    await seedCredentials({ callbackSecret: CALLBACK_SECRET });

    const secrets = await loadProviderSecrets(MOCK_PROVIDER_KEY);

    expect(secrets?.callbackToken).toBeUndefined();
    expect(secrets?.callbackTokenSource).toBeUndefined();
  });
});

describe("R34 - gate 3 against a provider that implemented the issued spec", () => {
  /**
   * Sends a callback the way the specification tells a provider to, and returns the outcome.
   *
   * The signature is computed over the exact bytes passed as `rawBody`, because that is the
   * only construction gate 5 accepts - a re-serialised body does not reproduce them.
   */
  async function callback(
    bearer: string,
    eventId: string,
  ): Promise<Awaited<ReturnType<typeof ingestProviderCallback>>> {
    const rawBody = JSON.stringify({
      eventId,
      eventType: "round.completed",
      roundId: "cv_rnd_does_not_exist",
    });
    const signature = crypto
      .createHmac("sha256", CALLBACK_SECRET)
      .update(rawBody)
      .digest("hex");
    const mock = getProviderAdapter(MOCK_PROVIDER_KEY) as MockProviderAdapter;

    return ingestProviderCallback({
      providerKey: MOCK_PROVIDER_KEY,
      rawBody,
      headers: {
        authorization: `Bearer ${bearer}`,
        // Unix SECONDS, which is what the issued spec asks for in both directions and what
        // `checkTimestamp` parses. An ISO string is rejected at gate 4, which looks exactly
        // like a gate 3 pass followed by an unrelated failure - so it is worth being
        // explicit here rather than reading the rejection as a token problem.
        "x-timestamp": Math.floor(Date.now() / 1000).toString(),
        "x-signature": `sha256=${signature}`,
        // Gate 5b. The mock deliberately uses its OWN header name, because the point of a
        // second check is to let a provider whose transport differs from ours be stricter.
        // Omitting it fails with `signature_invalid` - indistinguishable, from the result
        // code alone, from the gate 3 refusal this file is about.
        "x-mock-signature": mock.sign(rawBody),
        "x-event-id": eventId,
      },
    });
  }

  /** The error text recorded by gate 1's stored event, which names the gate that refused. */
  async function recordedError(eventId: string): Promise<string | undefined> {
    const event = await ProviderEvent.findOne({ eventId });
    return event?.processingError;
  }

  it("accepts the token from the spec and gets past gate 3", async () => {
    /*
     * THE ACTUAL DEFECT, EXPRESSED AS A TEST. Before the fix this returned
     * `signature_invalid` with `alert: "critical"`.
     *
     * It asserts what gate 3 must NOT do rather than a success, because this round id does
     * not exist - so the furthest a correct request can travel is gate 7. Asserting
     * `round_not_found` is what proves gates 3, 4 and 5 all passed, and it keeps the test
     * about authentication instead of dragging in a whole contest fixture.
     */
    await seedCredentials({
      apiKey: API_KEY,
      callbackToken: CALLBACK_TOKEN,
      callbackSecret: CALLBACK_SECRET,
    });

    const outcome = await callback(CALLBACK_TOKEN, "evt-spec-conforming");

    expect(outcome.result).not.toBe("signature_invalid");
    expect(outcome.result).toBe("round_not_found");
  });

  it("refuses the provider's own API key once a callback token is stored", async () => {
    /*
     * The other half, and without it the fix would simply have widened what is accepted.
     * Two valid bearer tokens for ever is worse than the wrong one: rotating the real token
     * would not revoke access, and nothing on any screen would say why.
     */
    await seedCredentials({
      apiKey: API_KEY,
      callbackToken: CALLBACK_TOKEN,
      callbackSecret: CALLBACK_SECRET,
    });

    const outcome = await callback(API_KEY, "evt-wrong-credential");

    expect(outcome.accepted).toBe(false);
    expect(outcome.result).toBe("signature_invalid");
    expect(outcome.alert).toBe("critical");
    // Gate 3, not gate 5. The result code is the same for both, so without this the test
    // would pass just as happily if the HMAC had failed for an unrelated reason.
    expect(await recordedError("evt-wrong-credential")).toMatch(/bearer token/i);
  });

  it("refuses an empty bearer token when no token is stored at all", async () => {
    // The `safeEqual("", "")` trap. A provider with no token configured must be refused,
    // not accidentally authenticated by two empty strings comparing equal.
    await seedCredentials({ callbackSecret: CALLBACK_SECRET });

    const outcome = await callback("", "evt-empty-both-sides");

    expect(outcome.accepted).toBe(false);
    expect(outcome.result).toBe("signature_invalid");
    expect(await recordedError("evt-empty-both-sides")).toMatch(/bearer token/i);
  });

  it("records the refusal as evidence rather than dropping it", async () => {
    // Gate 1 stores the raw event before anything is checked, so a rejected callback still
    // leaves a row an operator can read. Asserted here because a rejection nobody can
    // investigate is how R34 would have been debugged as an attack.
    await seedCredentials({
      callbackToken: CALLBACK_TOKEN,
      callbackSecret: CALLBACK_SECRET,
    });

    await callback("not-the-token", "evt-stored-anyway");

    const event = await ProviderEvent.findOne({ eventId: "evt-stored-anyway" });
    expect(event).not.toBeNull();
    expect(event?.signatureValid).toBe(false);
    expect(event?.processingResult).toBe("signature_invalid");
  });
});
