import { connectToDatabase } from "@/database/mongoose";
import GameProvider from "@/database/models/games/game-provider.model";
import ProviderGame from "@/database/models/games/provider-game.model";
import { WhiteLabel } from "@/database/models/whitelabel.model";
import {
  getProviderAdapter,
  listRegisteredProviderKeys,
} from "./registry";

/**
 * Admin operations for external game providers (X6, chapter 12 section 4).
 *
 * COPY THE PAYMENT-PROVIDERS UX, NEVER ITS PERSISTENCE (chapter 12 section 4.1)
 * ----------------------------------------------------------------------------
 * The owner asked for games to be added "like we have payment providers", and that screen
 * is the right interaction model: a list, an active toggle, a sandbox/production switch, a
 * generic credential bag rather than fixed columns. But `payment-provider.model.ts` embeds
 * `credentials[]` in the document every screen reads, and carries a `saveToEnv` flag whose
 * route writes secrets into `.env`. Copying that wholesale would have undone chapter 04
 * section 3.1 on consistency grounds - and it would have done so in a review where
 * "matches the existing pattern" sounds like the right answer.
 *
 * So: non-secrets live on `game_provider` and in `WhiteLabel.gameProviders`; secrets live
 * ONLY in `WhiteLabel.gameProviderCredentials`, which is `select: false`. A reviewer
 * comparing the two features will reasonably ask why they differ, which is why it is
 * written down here rather than left to be inferred.
 *
 * NOTHING IN THIS FILE MAY RETURN A SECRET. Every read returns presence booleans
 * (`hasApiKey`) instead of values. That differs from the payment-providers screen, which
 * does round-trip secrets to the browser behind an eye toggle - deliberately not copied.
 */

export interface ProviderAdminResult<T = void> {
  success: boolean;
  error?: string;
  data?: T;
}

/** What the admin UI is allowed to know about a provider's credentials. */
export interface CredentialStatus {
  environment: "sandbox" | "production";
  hasApiKey: boolean;
  hasApiSecret: boolean;
  /** The bearer token we issue for their inbound results. R34. */
  hasCallbackToken: boolean;
  hasCallbackSecret: boolean;
  /** Present during a rotation window, when both secrets are accepted. */
  hasPreviousCallbackSecret: boolean;
  rotatedAt?: Date;
}

export interface ProviderSummary {
  providerKey: string;
  displayName: string;
  logoUrl?: string;
  baseUrl: string;
  enabled: boolean;
  healthStatus: string;
  lastHealthCheckAt?: Date;
  lastCatalogueSyncAt?: Date;
  /** False when no code adapter is installed for this key. Blocks enabling. */
  adapterInstalled: boolean;
  credentials: CredentialStatus | null;
  titleCount: number;
  enabledTitleCount: number;
}

/**
 * Reason for a format rule: `providerKey` is immutable and becomes part of every
 * `gameKey` (`provider:<key>:<code>`), which is the join key for all historical stats. A
 * key containing a colon or a space would produce a gameKey that cannot be parsed back,
 * and it can never be corrected in place.
 */
const PROVIDER_KEY_PATTERN = /^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/;

export function validateProviderKey(key: string): string | null {
  if (!PROVIDER_KEY_PATTERN.test(key)) {
    return "The provider key must be 3-40 characters, lowercase letters, numbers and hyphens only, and may not start or end with a hyphen.";
  }
  return null;
}

async function loadSettings() {
  const settings = await WhiteLabel.findOne().select(
    "+gameProviderCredentials externalGamesEnabled gameProviders",
  );
  if (settings) return settings;
  // Reason: a fresh install has no settings document, and every screen here needs one.
  return WhiteLabel.create({});
}

export async function getMasterSwitch(): Promise<{
  externalGamesEnabled: boolean;
  registeredAdapters: string[];
}> {
  await connectToDatabase();
  const settings = await WhiteLabel.findOne()
    .select("externalGamesEnabled")
    .lean<{ externalGamesEnabled?: boolean } | null>();

  return {
    externalGamesEnabled: settings?.externalGamesEnabled ?? false,
    registeredAdapters: listRegisteredProviderKeys(),
  };
}

export async function setMasterSwitch(
  enabled: boolean,
): Promise<ProviderAdminResult> {
  await connectToDatabase();
  await WhiteLabel.updateOne(
    {},
    { $set: { externalGamesEnabled: enabled } },
    { upsert: true },
  );
  return { success: true };
}

export async function listProviders(): Promise<ProviderSummary[]> {
  await connectToDatabase();
  const settings = await loadSettings();
  const providers = await GameProvider.find().sort({ displayName: 1 });

  // Reason for aggregating counts rather than one query per provider: the title list can
  // run to hundreds of rows per provider, and this screen only needs two numbers.
  const counts = await ProviderGame.aggregate<{
    _id: string;
    total: number;
    enabled: number;
  }>([
    {
      $group: {
        _id: "$providerKey",
        total: { $sum: 1 },
        enabled: { $sum: { $cond: ["$chartvoltEnabled", 1, 0] } },
      },
    },
  ]);
  const countBy = new Map(counts.map((c) => [c._id, c]));

  const credentials = settings.gameProviderCredentials ?? [];

  return providers.map((provider) => {
    const credential = credentials.find(
      (c) => c.providerKey === provider.providerKey,
    );
    const count = countBy.get(provider.providerKey);

    return {
      providerKey: provider.providerKey,
      displayName: provider.displayName,
      logoUrl: provider.logoUrl,
      baseUrl: provider.baseUrl,
      enabled: provider.enabled,
      healthStatus: provider.healthStatus,
      lastHealthCheckAt: provider.lastHealthCheckAt,
      lastCatalogueSyncAt: provider.lastCatalogueSyncAt,
      adapterInstalled: Boolean(getProviderAdapter(provider.providerKey)),
      // Presence only. Never the values.
      credentials: credential
        ? {
            environment: credential.environment,
            hasApiKey: Boolean(credential.apiKey),
            hasApiSecret: Boolean(credential.apiSecret),
            hasCallbackToken: Boolean(credential.callbackToken),
            hasCallbackSecret: Boolean(credential.callbackSecret),
            hasPreviousCallbackSecret: Boolean(credential.previousCallbackSecret),
            rotatedAt: credential.rotatedAt,
          }
        : null,
      titleCount: count?.total ?? 0,
      enabledTitleCount: count?.enabled ?? 0,
    };
  });
}

export interface RegisterProviderInput {
  providerKey: string;
  displayName: string;
  baseUrl: string;
  logoUrl?: string;
}

export async function registerProvider(
  input: RegisterProviderInput,
): Promise<ProviderAdminResult<{ providerKey: string }>> {
  await connectToDatabase();

  const providerKey = input.providerKey.trim().toLowerCase();
  const keyError = validateProviderKey(providerKey);
  if (keyError) return { success: false, error: keyError };

  if (!input.displayName?.trim()) {
    return { success: false, error: "A display name is required." };
  }
  if (!isHttpsUrl(input.baseUrl)) {
    // Reason: HTTPS is not optional on a link that carries a signed callback contract and
    // an API key. Refusing here is cheaper than discovering it during an incident.
    return { success: false, error: "The base URL must be a valid https:// URL." };
  }

  const existing = await GameProvider.findOne({ providerKey });
  if (existing) {
    return {
      success: false,
      error: `A provider with the key "${providerKey}" already exists.`,
    };
  }

  // Enabled defaults to false on the model, and registration does not override it. A
  // provider becomes live only when an operator deliberately turns it on, after
  // credentials exist.
  await GameProvider.create({
    providerKey,
    displayName: input.displayName.trim(),
    baseUrl: input.baseUrl.trim(),
    logoUrl: input.logoUrl?.trim() || undefined,
  });

  const settings = await loadSettings();
  settings.gameProviders = [
    ...(settings.gameProviders ?? []).filter((p) => p.providerKey !== providerKey),
    {
      providerKey,
      enabled: false,
      baseUrl: input.baseUrl.trim(),
      displayName: input.displayName.trim(),
    },
  ];
  await settings.save();

  return { success: true, data: { providerKey } };
}

export interface UpdateProviderInput {
  displayName?: string;
  baseUrl?: string;
  logoUrl?: string;
}

export async function updateProvider(
  providerKey: string,
  input: UpdateProviderInput,
): Promise<ProviderAdminResult> {
  await connectToDatabase();

  const provider = await GameProvider.findOne({ providerKey });
  if (!provider) return { success: false, error: "Provider not found." };

  if (input.baseUrl !== undefined && !isHttpsUrl(input.baseUrl)) {
    return { success: false, error: "The base URL must be a valid https:// URL." };
  }
  if (input.displayName !== undefined && !input.displayName.trim()) {
    return { success: false, error: "A display name is required." };
  }

  // `providerKey` is deliberately absent from this function's inputs - it is immutable on
  // the schema, so a caller passing one would be silently ignored, which is worse than
  // not offering it.
  if (input.displayName !== undefined) provider.displayName = input.displayName.trim();
  if (input.baseUrl !== undefined) provider.baseUrl = input.baseUrl.trim();
  if (input.logoUrl !== undefined) provider.logoUrl = input.logoUrl.trim() || undefined;
  await provider.save();

  const settings = await loadSettings();
  const entry = (settings.gameProviders ?? []).find(
    (p) => p.providerKey === providerKey,
  );
  if (entry) {
    entry.displayName = provider.displayName;
    entry.baseUrl = provider.baseUrl;
    await settings.save();
  }

  return { success: true };
}

/**
 * Turns a provider on or off.
 *
 * ENABLING REQUIRES AN INSTALLED ADAPTER AND A CALLBACK SECRET, and both refusals are
 * deliberate. Without an adapter there is no code that can talk to this provider, so
 * `resolveEnabledProvider` would refuse every round with a message an operator cannot act
 * on - a switch that appears to work and silently does nothing. Without a callback secret
 * every inbound result fails signature verification, which looks identical to an attack.
 *
 * DISABLING ONLY STOPS NEW CONTESTS (chapter 12 section 6). Contests already running must
 * be allowed to finish, and the UI says so rather than leaving an operator to guess.
 */
export async function setProviderEnabled(
  providerKey: string,
  enabled: boolean,
): Promise<ProviderAdminResult> {
  await connectToDatabase();

  const provider = await GameProvider.findOne({ providerKey });
  if (!provider) return { success: false, error: "Provider not found." };

  if (enabled) {
    if (!getProviderAdapter(providerKey)) {
      return {
        success: false,
        error: `No code adapter is installed for "${providerKey}", so it cannot be enabled yet. Registering a provider is a settings change; connecting to a new one needs a release.`,
      };
    }

    const settings = await loadSettings();
    const credential = (settings.gameProviderCredentials ?? []).find(
      (c) => c.providerKey === providerKey,
    );
    if (!credential?.callbackSecret) {
      return {
        success: false,
        error:
          "Add a callback secret before enabling this provider, or every result it sends will be rejected as unsigned.",
      };
    }

    /*
     * THE SAME GATE FOR THE TOKEN, AND THE HOLE IT CLOSES WAS ALREADY REACHABLE.
     *
     * Before R34 a provider could be enabled with a callback secret and nothing else, and
     * every result would then fail GATE 3 rather than gate 5 - refused for an absent bearer
     * token, with `alert: "critical"` and a message about someone probing the endpoint. So
     * the screen already had a switch that could be turned on into a configuration where
     * nothing could ever work, which is exactly what the adapter and callback-secret checks
     * above exist to prevent. Found while fixing R34 by asking what else gate 3 needs; the
     * sibling check was simply missing.
     *
     * It requires the EXPLICIT field, not the `apiKey` fallback in `loadProviderSecrets`.
     * Reason: the fallback exists so a provider enabled before this field existed keeps
     * working, and accepting it here would let every new integration keep relying on it -
     * a transitional path nobody can observe is a transitional path nobody removes.
     */
    if (!credential.callbackToken) {
      return {
        success: false,
        error:
          "Add a callback token before enabling this provider. It is the bearer token they send with every result, and without it each one is refused and logged as a suspected attack.",
      };
    }
  }

  provider.enabled = enabled;
  await provider.save();

  const settings = await loadSettings();
  const entry = (settings.gameProviders ?? []).find(
    (p) => p.providerKey === providerKey,
  );
  if (entry) {
    entry.enabled = enabled;
  } else {
    settings.gameProviders = [
      ...(settings.gameProviders ?? []),
      { providerKey, enabled, baseUrl: provider.baseUrl, displayName: provider.displayName },
    ];
  }
  await settings.save();

  return { success: true };
}

export interface SaveCredentialsInput {
  environment: "sandbox" | "production";
  /** Blank or omitted means "keep the stored value". Never means "clear it". */
  apiKey?: string;
  apiSecret?: string;
  callbackToken?: string;
  callbackSecret?: string;
  /** When true, the outgoing callback secret is kept as `previousCallbackSecret`. */
  rotateCallbackSecret?: boolean;
}

/**
 * Stores credentials, write-only.
 *
 * "BLANK MEANS KEEP" IS THE ONLY SAFE READING, and getting it wrong is silent. Since the
 * UI can never display a stored secret, an operator editing the display name and saving
 * would submit empty secret fields - and if empty meant "clear", that harmless edit would
 * silently break every inbound callback. There is a separate explicit clear for the rare
 * case where removal is intended.
 *
 * FOUR FIELDS, TWO DIRECTIONS. `apiKey` and `apiSecret` are the provider's, used outbound.
 * `callbackToken` and `callbackSecret` are ours, used inbound - the token authenticates the
 * request and the secret signs the body. Conflating the two directions is what R34 was.
 *
 * ROTATION KEEPS THE OLD SECRET (chapter 06 section 8). A callback signed moments before
 * the rotation is still in flight when the new secret lands, and rejecting it would discard
 * a real score because of an operational action the provider was never told about.
 */
export async function saveCredentials(
  providerKey: string,
  input: SaveCredentialsInput,
): Promise<ProviderAdminResult> {
  await connectToDatabase();

  const provider = await GameProvider.findOne({ providerKey }).select("providerKey");
  if (!provider) return { success: false, error: "Provider not found." };

  const settings = await loadSettings();
  const credentials = settings.gameProviderCredentials ?? [];
  const existing = credentials.find((c) => c.providerKey === providerKey);

  const next = {
    providerKey,
    environment: input.environment,
    apiKey: firstNonBlank(input.apiKey, existing?.apiKey),
    apiSecret: firstNonBlank(input.apiSecret, existing?.apiSecret),
    callbackToken: firstNonBlank(input.callbackToken, existing?.callbackToken),
    callbackSecret: firstNonBlank(input.callbackSecret, existing?.callbackSecret),
    previousCallbackSecret: existing?.previousCallbackSecret,
    rotatedAt: existing?.rotatedAt,
  };

  // Reason for requiring a PREVIOUS secret to exist: without this clause the first time a
  // secret is ever stored counts as a rotation, stamping `rotatedAt` on a provider that has
  // never rotated anything. Nothing breaks - `previousCallbackSecret` is undefined either
  // way, so no stale secret becomes acceptable - but the record is simply untrue, and an
  // operator reading a rotation date would reasonably believe one had happened.
  const callbackSecretRotated =
    isProvided(input.callbackSecret) &&
    isProvided(existing?.callbackSecret) &&
    input.callbackSecret !== existing?.callbackSecret;

  if (callbackSecretRotated && input.rotateCallbackSecret !== false) {
    next.previousCallbackSecret = existing?.callbackSecret;
    next.rotatedAt = new Date();
  }

  settings.gameProviderCredentials = [
    ...credentials.filter((c) => c.providerKey !== providerKey),
    next,
  ];
  await settings.save();

  return { success: true };
}

/** Ends a rotation window by dropping the previous secret. */
export async function completeRotation(
  providerKey: string,
): Promise<ProviderAdminResult> {
  await connectToDatabase();
  const settings = await loadSettings();
  const credential = (settings.gameProviderCredentials ?? []).find(
    (c) => c.providerKey === providerKey,
  );
  if (!credential) return { success: false, error: "No credentials stored." };

  credential.previousCallbackSecret = undefined;
  await settings.save();
  return { success: true };
}

/**
 * Our own decision about a title, which is the second of the two switches.
 *
 * `providerStatus` is what the provider says; `chartvoltEnabled` is what we say. One flag
 * would let a third party put an untested game in front of paying players by editing their
 * own database, so a supplier's opinion is an input and never a decision.
 */
export async function setTitleEnabled(
  providerKey: string,
  gameCode: string,
  enabled: boolean,
): Promise<ProviderAdminResult> {
  await connectToDatabase();

  const title = await ProviderGame.findOne({ providerKey, gameCode });
  if (!title) return { success: false, error: "Game not found." };

  if (enabled && title.providerStatus !== "active") {
    // Reason: enabling a title the provider has deprecated or put in maintenance is almost
    // always a mistake, and it is the operator's own catalogue screen telling them so.
    return {
      success: false,
      error: `The provider currently reports this game as "${title.providerStatus}", so it cannot be enabled.`,
    };
  }

  title.chartvoltEnabled = enabled;
  await title.save();
  return { success: true };
}

function isProvided(value?: string): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function firstNonBlank(...values: (string | undefined)[]): string | undefined {
  for (const value of values) {
    if (isProvided(value)) return value.trim();
  }
  return undefined;
}

function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}
