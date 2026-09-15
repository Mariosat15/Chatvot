import { Schema, model, models, type Document, type Model } from "mongoose";

export interface WhiteLabelDocument extends Document {
  // App Branding
  appLogo: string;
  emailLogo: string;
  profileImage: string;
  dashboardPreview: string;
  favicon: string;

  // SEO / Open Graph — editable from admin > Settings > Branding
  seoTitle: string;
  seoDescription: string;
  ogImageUrl: string;
  siteUrl: string;

  // Branding file backup (base64-encoded file data stored in DB for persistence)
  brandingFiles: Map<
    string,
    { data: string; contentType: string; updatedAt: Date }
  >;

  // General Settings
  nodeEnv: string;
  nextPublicBaseUrl: string;

  // Email Configuration
  nodemailerEmail: string;
  nodemailerPassword: string;

  // API Keys & URLs
  massiveApiKey: string;
  nextPublicMassiveApiKey: string;

  // OpenAI Configuration
  openaiApiKey: string;
  openaiModel: string;
  openaiEnabled: boolean;
  openaiForEmails: boolean;

  // Database
  mongodbUri: string;

  // Authentication
  betterAuthSecret: string;
  betterAuthUrl: string;

  // Admin Credentials
  adminEmail: string;
  adminPassword: string;
  adminName: string;

  // Redis Configuration (Self-hosted)
  redisHost: string;
  redisPort: number;
  redisPassword: string;
  redisEnabled: boolean;
  redisPriceSyncEnabled: boolean; // Enable for multi-server deployments
  // Legacy Upstash fields (kept for backward compatibility)
  upstashRedisUrl: string;
  upstashRedisToken: string;

  // Inngest Configuration
  inngestSigningKey: string;
  inngestEventKey: string;
  inngestMode: "dev" | "cloud"; // dev = local dev server, cloud = Inngest Cloud (production)

  // Pexels API (stock images for landing pages)
  pexelsApiKey: string;

  // Fraud & Security — IP intelligence (proxycheck.io) for VPN/proxy/Tor detection
  ipIntelligenceApiKey: string;

  // Feature Toggles
  arenaEnabled: boolean; // Enable/disable Live Arena page and menu link

  // Which game modules are live (X1 foundation).
  // Reason: gates CREATION, DISCOVERY and ENTRY only. It must never reach a stats or
  // leaderboard read path - summing totals over the enabled set retroactively demotes
  // players when a game is switched off. Risk R29, "External game plans/05" s11.3.
  enabledGameTypes: string[];

  // ── External game providers (X2, chapter 04 section 2.3) ──────────────────────────────
  //
  // Master kill switch for the whole external-games feature, independent of any single
  // provider's `enabled` flag. Reason: chapter 09 section 5 needs one switch that turns
  // the feature off without editing provider rows, so a rollout can be reversed in one
  // action rather than N.
  externalGamesEnabled: boolean;

  // Non-secret, freely readable provider configuration. Mirrors `game_provider` for the
  // settings screen; the collection remains the source of truth.
  gameProviders: {
    providerKey: string;
    enabled: boolean;
    baseUrl?: string;
    displayName?: string;
  }[];

  // SECRETS. Never returned to a client, never logged, never rendered.
  //
  // Reason: these are here rather than on `game_provider` precisely so that document stays
  // safe for any screen to read (chapter 04 section 3.1, chapter 12 section 4.1). Anything
  // that reads this array must strip it before the value crosses a network boundary.
  //
  // `callbackSecret` is separate from `apiSecret` and both are per-environment, because
  // chapter 06 section 8 requires the callback secret to be rotatable with no downtime -
  // which means accepting the old and the new value at once during a rotation.
  //
  // THERE ARE FOUR CREDENTIALS AND TWO DIRECTIONS, which is the distinction risk R34 was
  // about. `apiKey`/`apiSecret` are issued to us BY the provider and travel OUTBOUND on
  // every call we make to them. `callbackToken`/`callbackSecret` are issued BY US to them
  // and travel INBOUND on every result they send. The token authenticates, the secret
  // signs.
  gameProviderCredentials: {
    providerKey: string;
    environment: "sandbox" | "production";
    apiKey?: string;
    apiSecret?: string;
    /**
     * The bearer token we issue to the provider for their INBOUND result callbacks.
     *
     * Added 6 September 2026 to close R34. `01` section 2.2 and the requirements HTML sent
     * to providers both promise `Authorization: Bearer {CALLBACK_TOKEN}`, described as "a
     * token we issue to you" - and until this field existed there was nowhere to issue one,
     * so `loadProviderSecrets` substituted `apiKey`. That asked a provider to authenticate
     * inbound with the credential they had issued us for outbound calls, so a provider who
     * implemented the document exactly was rejected and logged as a probable attack.
     *
     * Reason it is a separate field rather than a reuse of `apiSecret`: the two directions
     * must be independently rotatable, and a provider must never need our signing secret in
     * order to authenticate to us.
     */
    callbackToken?: string;
    callbackSecret?: string;
    /** Kept during a rotation so in-flight callbacks signed with the old value verify. */
    previousCallbackSecret?: string;
    rotatedAt?: Date;
  }[];

  // Price Feed Configuration
  priceFeedMode: "websocket" | "api" | "both"; // both = websocket primary, api fallback
  priceFeedWebsocketEnabled: boolean;
  priceFeedApiEnabled: boolean;
  priceFeedPrimarySource: "websocket" | "api"; // when both enabled, which is primary
  priceFeedUpdateInterval: number; // ms - how often to sync to Redis
  priceFeedCacheTTL: number; // ms - how long prices are valid in cache
  priceFeedClientPollInterval: number; // ms - how often client polls for prices
  priceFeedWebsocketReconnectAttempts: number; // max reconnect attempts
  priceFeedWebsocketReconnectDelay: number; // ms - base delay between reconnects
  priceFeedApiConcurrency: number; // max parallel API requests
  priceFeedFallbackEnabled: boolean; // auto-fallback to API if WebSocket fails

  // ── Operator-facing vocabulary (X6.5, chapter 14 section 2) ──────────────────────────
  //
  // A PARTIAL set of display-word overrides, keyed by the token names in
  // `lib/constants/terminology.ts`. An absent or blank token falls through to the default,
  // so an operator renaming one noun inherits the other twenty-two and a later correction
  // to a default still reaches this deployment.
  //
  // NOTHING HERE IS AN IDENTIFIER. These are words a human reads. `contests` may render as
  // "Tournaments" while the route stays `/api/competitions/*` and the ledger row stays
  // `competition_entry` - chapter 14 section 6, and renaming either of those orphans
  // financial history (R13).
  //
  // WHY TWENTY-THREE EXPLICIT FIELDS RATHER THAN ONE `Map` OR A `Mixed`, because one field
  // is obviously tidier and is the wrong answer:
  //
  //   - A Mongoose `Map` is read back as a `MongooseMap` when the document is HYDRATED and
  //     as a plain object under `.lean()`. `resolveTerms` walks it with `Object.entries`,
  //     which yields `[]` for a MongooseMap - so overrides would be silently ignored on
  //     one of the three read paths while every screen rendered perfectly in defaults. No
  //     error, no log line. That is the `brandingFiles` failure from the other direction.
  //   - `Schema.Types.Mixed` loses change tracking, so an edit needs `markModified` and a
  //     writer that forgets it saves nothing while reporting success.
  //
  // The cost of being explicit is that a new token is a mirrored model edit. That is paid
  // deliberately: a token absent from the schema would be DISCARDED by strict mode on
  // write, silently, which is the mirror-drift failure mode - so a test pins these paths
  // against `TERMINOLOGY_TOKENS` in both directions and turns red instead.
  terminologyOverrides?: {
    contest?: string;
    contests?: string;
    challenge?: string;
    challenges?: string;
    practice?: string;
    player?: string;
    players?: string;
    opponent?: string;
    score?: string;
    leaderboard?: string;
    rank?: string;
    entryFee?: string;
    prizePool?: string;
    prize?: string;
    round?: string;
    rounds?: string;
    attempt?: string;
    attempts?: string;
    game?: string;
    games?: string;
    level?: string;
    levels?: string;
    points?: string;
  };

  updatedAt: Date;
  createdAt: Date;
}

const WhiteLabelSchema = new Schema<WhiteLabelDocument>(
  {
    // App Branding
    appLogo: {
      type: String,
      default: "/assets/images/logo.png",
    },
    emailLogo: {
      type: String,
      default: "/assets/images/logo.png",
    },
    profileImage: {
      type: String,
      default: "/assets/images/PROFILE.png",
    },
    dashboardPreview: {
      type: String,
      default: "/assets/images/dashboard-preview.png",
    },
    favicon: {
      type: String,
      default: "/favicon.ico",
    },

    // SEO / Open Graph
    seoTitle: { type: String, default: "" },
    seoDescription: { type: String, default: "" },
    ogImageUrl: { type: String, default: "" },
    siteUrl: { type: String, default: "" },

    // Branding file backup (base64-encoded, auto-restored if disk files are lost)
    //
    // SUPERSEDED 8 September 2026 by the `branding_asset` collection. Nothing writes here
    // any more; `lib/services/branding-assets.service.ts` reads it as a fallback for images
    // uploaded before that date, and `tools/branding/migrate-branding-files.ts` empties it.
    //
    // `select: false` is not a tidy-up. This map holds a base64 copy of every image ever
    // uploaded and had grown to the far side of 16MB, and 67 files call `WhiteLabel.findOne()`
    // - so reading any setting at all transferred the lot. The four routes that genuinely
    // want it now ask for it by name, through that one service.
    brandingFiles: {
      select: false,
      type: Map,
      of: new Schema(
        {
          data: { type: String, required: true },
          contentType: { type: String, required: true },
          updatedAt: { type: Date, default: Date.now },
        },
        { _id: false },
      ),
      default: new Map(),
    },

    // General Settings
    nodeEnv: {
      type: String,
      default: "development",
    },
    nextPublicBaseUrl: {
      type: String,
      default: "http://localhost:3000",
    },

    // Email Configuration
    nodemailerEmail: {
      type: String,
      default: "",
    },
    nodemailerPassword: {
      type: String,
      default: "",
    },

    // API Keys & URLs
    massiveApiKey: {
      type: String,
      default: "",
    },
    nextPublicMassiveApiKey: {
      type: String,
      default: "",
    },

    // OpenAI Configuration
    openaiApiKey: {
      type: String,
      default: "",
    },
    openaiModel: {
      type: String,
      default: "gpt-4o-mini", // Fast and cheap default
    },
    openaiEnabled: {
      type: Boolean,
      default: false, // Disabled by default
    },
    openaiForEmails: {
      type: Boolean,
      default: false, // AI for email personalization disabled by default
    },

    // Database
    mongodbUri: {
      type: String,
      default: "",
    },

    // Authentication
    betterAuthSecret: {
      type: String,
      default: "",
    },
    betterAuthUrl: {
      type: String,
      default: "http://localhost:3000",
    },

    // Admin Credentials
    adminEmail: {
      type: String,
      default: "",
    },
    adminPassword: {
      type: String,
      default: "",
    },
    adminName: {
      type: String,
      default: "Admin",
    },

    // Redis Configuration (Self-hosted)
    redisHost: {
      type: String,
      default: "127.0.0.1",
    },
    redisPort: {
      type: Number,
      default: 6379,
    },
    redisPassword: {
      type: String,
      default: "",
    },
    redisEnabled: {
      type: Boolean,
      default: false,
    },
    redisPriceSyncEnabled: {
      type: Boolean,
      default: false, // Enable only for multi-server deployments
    },
    // Legacy Upstash fields (kept for backward compatibility)
    upstashRedisUrl: {
      type: String,
      default: "",
    },
    upstashRedisToken: {
      type: String,
      default: "",
    },

    // Inngest Configuration
    inngestSigningKey: {
      type: String,
      default: "",
    },
    inngestEventKey: {
      type: String,
      default: "",
    },
    inngestMode: {
      type: String,
      enum: ["dev", "cloud"],
      default: "dev", // Default to dev mode (local Inngest dev server)
    },

    // Pexels API (stock images for landing pages)
    pexelsApiKey: {
      type: String,
      default: "",
    },

    // Fraud & Security — IP intelligence (proxycheck.io)
    ipIntelligenceApiKey: {
      type: String,
      default: "",
    },

    // Feature Toggles
    arenaEnabled: {
      type: Boolean,
      default: true, // Arena enabled by default
    },
    enabledGameTypes: {
      type: [String],
      default: ["trading"],
    },

    // ── External game providers (X2, chapter 04 section 2.3) ────────────────────────────
    //
    // Reason: defaults to false so that merely deploying X2 changes nothing a player can
    // see. Every rollout step in chapter 18 assumes the feature stays dark until an
    // operator turns it on, and a default of true would launch it on deploy.
    externalGamesEnabled: {
      type: Boolean,
      default: false,
    },
    gameProviders: {
      type: [
        {
          providerKey: { type: String, required: true },
          enabled: { type: Boolean, default: false },
          baseUrl: { type: String },
          displayName: { type: String },
        },
      ],
      default: [],
    },
    // SECRETS - see the interface comment. Must be stripped before any client response.
    gameProviderCredentials: {
      type: [
        {
          providerKey: { type: String, required: true },
          environment: {
            type: String,
            enum: ["sandbox", "production"],
            default: "sandbox",
          },
          apiKey: { type: String },
          apiSecret: { type: String },
          // See the interface comment: inbound bearer token, issued by us. R34.
          callbackToken: { type: String },
          callbackSecret: { type: String },
          previousCallbackSecret: { type: String },
          rotatedAt: { type: Date },
        },
      ],
      default: [],
      // Reason: excluded from every query by default, so a plain `WhiteLabel.findOne()` -
      // which dozens of call sites already do, several of which return the result to a
      // client - cannot leak provider secrets. A caller that genuinely needs them must ask
      // with `.select("+gameProviderCredentials")`, which is greppable and reviewable.
      select: false,
    },

    // Price Feed Configuration
    priceFeedMode: {
      type: String,
      enum: ["websocket", "api", "both"],
      default: "both", // both = websocket primary with api fallback
    },
    priceFeedWebsocketEnabled: {
      type: Boolean,
      default: true,
    },
    priceFeedApiEnabled: {
      type: Boolean,
      default: true,
    },
    priceFeedPrimarySource: {
      type: String,
      enum: ["websocket", "api"],
      default: "websocket",
    },
    priceFeedUpdateInterval: {
      type: Number,
      default: 2000, // 2 seconds - sync WebSocket cache to Redis
    },
    priceFeedCacheTTL: {
      type: Number,
      default: 10000, // 10 seconds - how long cached prices are valid
    },
    priceFeedClientPollInterval: {
      type: Number,
      default: 500, // 500ms - client polls every half second
    },
    priceFeedWebsocketReconnectAttempts: {
      type: Number,
      default: 10,
    },
    priceFeedWebsocketReconnectDelay: {
      type: Number,
      default: 3000, // 3 seconds base delay
    },
    priceFeedApiConcurrency: {
      type: Number,
      default: 30, // fetch 30 pairs in parallel
    },
    priceFeedFallbackEnabled: {
      type: Boolean,
      default: true, // auto-fallback to API if WebSocket fails
    },

    // ── Operator-facing vocabulary (X6.5, chapter 14 section 2) ──────────────────────────
    //
    // See the interface comment for why these are twenty-three declared paths rather than a
    // `Map`. No `default` on any of them, and none on the parent: an unset token must read
    // as ABSENT so it falls through to the catalogue default. A `default: ""` would store a
    // real empty string on every row, which `resolveTerms` then has to treat as absent
    // anyway - and a stored value that has to be reinterpreted is indistinguishable from an
    // operator who meant it (the `zeroIsValidResult` and `playModeOverride` reading).
    terminologyOverrides: {
      contest: { type: String, trim: true },
      contests: { type: String, trim: true },
      challenge: { type: String, trim: true },
      challenges: { type: String, trim: true },
      practice: { type: String, trim: true },
      player: { type: String, trim: true },
      players: { type: String, trim: true },
      opponent: { type: String, trim: true },
      score: { type: String, trim: true },
      leaderboard: { type: String, trim: true },
      rank: { type: String, trim: true },
      entryFee: { type: String, trim: true },
      prizePool: { type: String, trim: true },
      prize: { type: String, trim: true },
      round: { type: String, trim: true },
      rounds: { type: String, trim: true },
      attempt: { type: String, trim: true },
      attempts: { type: String, trim: true },
      game: { type: String, trim: true },
      games: { type: String, trim: true },
      level: { type: String, trim: true },
      levels: { type: String, trim: true },
      points: { type: String, trim: true },
    },
  },
  {
    timestamps: true,
  },
);

export const WhiteLabel: Model<WhiteLabelDocument> =
  (models?.WhiteLabel as Model<WhiteLabelDocument>) ||
  model<WhiteLabelDocument>("WhiteLabel", WhiteLabelSchema);
