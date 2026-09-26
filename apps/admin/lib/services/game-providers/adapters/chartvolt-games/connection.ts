import { WhiteLabel } from "@/database/models/whitelabel.model";

/**
 * Where ChartVolt Games lives and how we authenticate to it (X4a, chapter 21).
 *
 * Split out of the adapter so the adapter file stays about the protocol rather than about
 * settings, and because this is the one piece of it that touches the database.
 *
 * WHY THIS DELIBERATELY DOES NOT CHECK WHETHER THE PROVIDER IS ENABLED
 * -------------------------------------------------------------------
 * `loadProviderSecrets` in `lib/services/games/callback-verification.ts` DOES check, and the
 * difference is not an inconsistency. That function decides whether to TRUST AN INBOUND
 * CALLER, so handing out secrets for a disabled provider would be the shape of Prerequisite A -
 * an auth helper accepting a request because of what configuration happened to say.
 *
 * This one loads OUR OWN credentials to make an outbound call, and the first such call happens
 * before anything is enabled: `POST /api/games/providers/[providerKey]/sync` uses
 * `getProviderAdapter` rather than `resolveEnabledProvider` precisely so an operator can see
 * what a provider offers before deciding to switch it on. A check here would make the first
 * catalogue sync impossible and the symptom would read as a credentials fault.
 *
 * Gameplay paths are gated separately and upstream, by `resolveEnabledProvider`.
 */

export const CHARTVOLT_GAMES_PROVIDER_KEY = "chartvolt-games";

export interface ProviderConnection {
  baseUrl: string;
  apiKey: string;
  apiSecret: string;
  environment: "sandbox" | "production";
}

export type ConnectionResult =
  | { ok: true; connection: ProviderConnection }
  | { ok: false; reason: string };

/**
 * Reads the provider's base URL and credentials.
 *
 * Each missing piece gets its OWN message. Reason: "the provider is not configured" sends an
 * operator to the wrong screen half the time - a missing base URL is edited on the provider
 * card, a missing secret in the credentials dialog, and the two are different permissions.
 * The same reasoning is why `resolveEnabledProvider` distinguishes an absent entry from a
 * disabled one.
 */
export async function loadConnection(
  providerKey = CHARTVOLT_GAMES_PROVIDER_KEY,
): Promise<ConnectionResult> {
  let settings: {
    gameProviders?: { providerKey: string; baseUrl?: string }[];
    gameProviderCredentials?: {
      providerKey: string;
      environment?: "sandbox" | "production";
      apiKey?: string;
      apiSecret?: string;
    }[];
  } | null;

  try {
    settings = await WhiteLabel.findOne()
      // `+gameProviderCredentials` is required because the field is `select: false`, which is
      // what stops the dozens of plain `WhiteLabel.findOne()` call sites from leaking secrets.
      .select("+gameProviderCredentials gameProviders")
      .lean<{
        gameProviders?: { providerKey: string; baseUrl?: string }[];
        gameProviderCredentials?: {
          providerKey: string;
          environment?: "sandbox" | "production";
          apiKey?: string;
          apiSecret?: string;
        }[];
      }>();
  } catch (error) {
    // Never the error object. A settings read failure is logged with context on the server and
    // reduced to a sentence for the caller, because this string reaches an admin screen.
    console.error(`❌ [${providerKey}] settings read failed:`, error);
    return { ok: false, reason: "Provider settings could not be read." };
  }

  const entry = settings?.gameProviders?.find((p) => p.providerKey === providerKey);
  const baseUrl = entry?.baseUrl?.trim().replace(/\/+$/, "");
  if (!baseUrl) {
    return {
      ok: false,
      reason: `No base URL is configured for provider "${providerKey}".`,
    };
  }

  const credentials = settings?.gameProviderCredentials?.find(
    (c) => c.providerKey === providerKey,
  );
  if (!credentials?.apiKey || !credentials.apiSecret) {
    return {
      ok: false,
      reason: `API credentials for provider "${providerKey}" are missing.`,
    };
  }

  return {
    ok: true,
    connection: {
      baseUrl,
      apiKey: credentials.apiKey,
      apiSecret: credentials.apiSecret,
      environment: credentials.environment ?? "sandbox",
    },
  };
}
