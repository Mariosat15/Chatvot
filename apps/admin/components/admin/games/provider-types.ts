/**
 * Client-side shapes for the game providers admin screen (X6).
 *
 * `CredentialStatus` carries presence booleans and never a value, mirroring the server.
 * Reason it is worth a type of its own rather than optional strings: an optional
 * `apiKey?: string` on the client invites a future component to render it, and the field
 * would simply be `undefined` in every environment where anyone checked. A boolean cannot
 * be rendered by accident.
 */

export interface ProviderCredentialStatus {
  environment: "sandbox" | "production";
  hasApiKey: boolean;
  hasApiSecret: boolean;
  /** The bearer token we issue for their inbound results. R34. */
  hasCallbackToken: boolean;
  hasCallbackSecret: boolean;
  hasPreviousCallbackSecret: boolean;
  rotatedAt?: string;
}

export interface GameProviderRow {
  providerKey: string;
  displayName: string;
  logoUrl?: string;
  baseUrl: string;
  enabled: boolean;
  healthStatus: string;
  lastHealthCheckAt?: string;
  lastCatalogueSyncAt?: string;
  adapterInstalled: boolean;
  credentials: ProviderCredentialStatus | null;
  titleCount: number;
  enabledTitleCount: number;
}

export interface ProviderTitleRow {
  _id: string;
  providerKey: string;
  gameCode: string;
  gameKey: string;
  displayName: string;
  family: string;
  providerStatus: "active" | "deprecated" | "maintenance";
  chartvoltEnabled: boolean;
  supportsCompetition?: boolean;
  supportsOneVsOne?: boolean;
  supportsPractice?: boolean;
  scoreDirection?: string;
  scoreType?: string;
}

export interface CatalogueSyncSummary {
  received: number;
  created: number;
  updated: number;
  unchanged: number;
  missingFromProvider: string[];
}
