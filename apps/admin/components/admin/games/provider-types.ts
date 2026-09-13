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
  // Reason `healthStatus` and `lastHealthCheckAt` are NOT here: both are declared on
  // `game_provider` and nothing has ever written to either, and `healthStatus` defaults to
  // `"down"`. Any screen rendering them would report a working provider as permanently
  // down, so they are deliberately kept off the wire. Health is derived from rounds and
  // deliveries by `provider-health.service.ts` instead. Same reasoning as deleting a dead
  // helper rather than leaving it as a one-line invitation to reintroduce the defect.
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
  /**
   * The provider's own declaration, and OUR override, carried separately on purpose.
   *
   * The Play style control needs both: it shows the effective answer, and it has to be able
   * to label the "follow the provider" option with what the provider actually says. Sending
   * only the resolved value would leave that option reading "Provider's choice" with no way
   * to tell an operator what they would be falling back to.
   *
   * Both optional and both must stay so - a title synced before either field existed carries
   * neither, and `resolvePlayMode` answers `anytime` for that row rather than throwing.
   */
  playMode?: string;
  playModeOverride?: string;
  /**
   * The set an operator may choose from when creating a contest (task document 11).
   *
   * RAW, and the control must pass it through `resolveSupportedPlayModes` rather than render
   * it - that function unions the title's own resolved style in, so the stored array can
   * legitimately omit the one member that behaves as ticked. Optional and must stay so, for
   * the same reason as the two fields above.
   */
  supportedPlayModes?: string[];
  providerStatus: "active" | "deprecated" | "maintenance";
  chartvoltEnabled: boolean;
  supportsCompetition?: boolean;
  supportsOneVsOne?: boolean;
  supportsPractice?: boolean;
  scoreDirection?: string;
  scoreType?: string;
  /**
   * OUR prize-eligibility rules for this title (task document 14).
   *
   * All three optional and they must stay so. A title synced before these fields existed
   * carries none of them, and `resolveScoringRules` answers with the platform rule for that
   * row - zero wins nothing, no extra bar - rather than throwing.
   *
   * `minimumEligibleScore` is `number | undefined` and NEVER coerced to a fallback on the
   * way to a screen. A stored `0` is a real instruction, so `?? 0` or `|| undefined`
   * anywhere on this path turns a configured bar into an unset one, or an unset one into a
   * bar of zero. The dialog's `draftFrom` is written for exactly that trap.
   */
  zeroIsValidResult?: boolean;
  minimumEligibleScore?: number;
  scoreUnit?: string;
  // Presentation content: seeded from the provider on the first sync, the operator's after.
  // Every one is optional and must stay so: a title synced before these fields existed has
  // none of them, and the screens that read them fall back rather than printing a blank.
  // See the model comment on `tagline`, which used to claim no provider supplies any of
  // this and was wrong about four of the six (R63).
  tagline?: string;
  description?: string;
  rulesSummary?: string;
  howToPlay?: string;
  category?: string;
  thumbnailUrl?: string;
  bannerUrl?: string;
  // Ours rather than the provider's, unlike the six above: these two illustrate the arena's
  // own panels, so no sync writes them and only the content dialog does.
  howToPlayImageUrl?: string;
  highlightsImageUrl?: string;
  highlights?: { title: string; detail: string }[];
  // Ours as well, and absent is an instruction rather than a gap: the banner works four
  // features out from the title's declared settings when this is unset.
  heroFeatures?: { icon: string; label: string }[];
}

export interface CatalogueSyncSummary {
  received: number;
  created: number;
  updated: number;
  unchanged: number;
  missingFromProvider: string[];
}
