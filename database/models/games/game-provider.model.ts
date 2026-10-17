import mongoose, { Schema, Document, Model } from "mongoose";

/**
 * One contracted external game provider (X2, chapter 04 section 3.1).
 *
 * ────────────────────────────────────────────────────────────────────────────────────────
 * THIS DOCUMENT HOLDS NO SECRETS, AND THAT IS A DESIGN CONSTRAINT, NOT AN OMISSION.
 * ────────────────────────────────────────────────────────────────────────────────────────
 *
 * API keys, API secrets and callback secrets live in `WhiteLabel.gameProviderCredentials`
 * and are never returned to a client. They are deliberately NOT here so that this document
 * can be read freely by admin screens, the contest lobby and the catalogue picker without
 * a secret ever entering scope.
 *
 * Chapter 12 section 4.1 is explicit about the trap: the owner asked for game providers to
 * be added "like payment providers", and `PaymentProvidersSection.tsx` IS the right
 * interaction model. But `payment-provider.model.ts` embeds a `credentials[]` array in the
 * document every screen reads, and carries a `saveToEnv` flag with a route that writes
 * secrets to `.env`. Copying that here would undo this separation **on consistency
 * grounds**, which is the most persuasive possible reason to do the wrong thing.
 *
 * Copy the UX. Do not copy the persistence.
 */
export interface IGameProvider extends Document {
  providerKey: string;
  displayName: string;
  logoUrl?: string;
  baseUrl: string;
  enabled: boolean;
  capabilities: {
    supportsVoid: boolean;
    supportsMatches: boolean;
    supportsPractice: boolean;
    supportsSeeding: boolean;
  };
  healthStatus: "healthy" | "degraded" | "down";
  lastHealthCheckAt?: Date;
  /**
   * When the provider first entered `healthStatus: "down"` continuously.
   * Cleared on recovery. The automatic kill switch (07 s3.3) disables new
   * contests/rounds after this has been set for more than 15 minutes.
   * Absent means "not currently in a sustained down state".
   */
  healthDownSince?: Date;
  /**
   * Consecutive minute probes that observed failure evidence. Three → degraded;
   * further sustained failure → down. Reset on a healthy probe. Written by the
   * X9 kill-switch worker; the admin health screen still DERIVES its verdict.
   */
  healthFailureStreak: number;
  /**
   * Whether the platform may act on this provider's outage BY ITSELF.
   *
   * Owner decision, 20 September 2026: taking a provider off sale is an operator's
   * call, never the platform's. With this off - which is the default and what every
   * existing row means - the health worker still watches, still records the status and
   * still raises the critical alert, and then stops. It does not flip `enabled`, does
   * not refuse new entries, does not pause live contests and does not cancel a contest
   * at its gun. `enabled` remains the one switch, and only a human moves it.
   *
   * With it on, an operator has asked for the chapter 07 section 3 automation, and all
   * four of those consequences apply.
   *
   * Reason it is per provider rather than one platform setting: a first-party provider
   * we run ourselves and a contracted third party do not warrant the same trust, and a
   * single switch forces the more cautious answer on both.
   */
  autoOutageResponseEnabled: boolean;
  /**
   * Whether the worker may pull this provider's catalogue every Friday at 00:00 UTC.
   *
   * Owner decision, 24 September 2026: sync stays a deliberate act by default. With this
   * off - which is the default and what every existing row means - only an operator click
   * (or a future job that does not exist) refreshes titles. With it on, the Friday
   * auto-sync job runs the same catalogue path as the admin button.
   *
   * Defaults to FALSE for the same reason as `autoOutageResponseEnabled`: a schema default
   * of true would switch automation on for every provider registered before the field
   * existed and make the opt-in invisible.
   */
  autoCatalogueSyncFriday: boolean;
  /**
   * `YYYY-MM-DD` (UTC) of the Friday the auto-sync job last claimed for this provider.
   * Prevents a second run in the same midnight hour after a worker restart.
   */
  lastFridayAutoSyncClaimKey?: string;
  /**
   * When the critical outage alert was last raised, used to claim it once per outage.
   *
   * Reason it exists at all: the alert used to be claimed by the `enabled: true → false`
   * write, so it could only fire on a pass that also disabled the provider. Now that
   * disabling is opt-in the alert has to survive without it, or switching the automation
   * off would also switch off the only notice that anything is wrong - which is the
   * opposite of what an operator asking to decide for themselves needs.
   *
   * Compared against `healthDownSince`, which is `$unset` on recovery, so a later outage
   * always has a start after this stamp and re-arms the alert.
   */
  outageAlertedAt?: Date;
  lastCatalogueSyncAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const GameProviderSchema = new Schema<IGameProvider>(
  {
    // Reason: immutable for the same reason `gameKey` is. `providerKey` is embedded in
    // every `gameKey` as `provider:{providerKey}:{gameCode}`, so renaming it would orphan
    // every historical stat, round and participant row that joins on it.
    providerKey: {
      type: String,
      required: true,
      unique: true,
      index: true,
      immutable: true,
      trim: true,
    },
    displayName: {
      type: String,
      required: true,
      trim: true,
    },
    logoUrl: {
      type: String,
    },
    baseUrl: {
      type: String,
      required: true,
      trim: true,
    },
    // Reason: defaults to FALSE, so registering a provider does not make it live. An
    // operator has to supply credentials and enable it deliberately. A default of true
    // would mean the window between creating the row and configuring it is a window in
    // which the platform tries to serve games it cannot authenticate against.
    enabled: {
      type: Boolean,
      default: false,
    },
    // What this provider supports, so the admin panel cannot offer an impossible contest
    // format. All default false: a capability we have not confirmed is one we do not have.
    capabilities: {
      supportsVoid: { type: Boolean, default: false },
      supportsMatches: { type: Boolean, default: false },
      supportsPractice: { type: Boolean, default: false },
      supportsSeeding: { type: Boolean, default: false },
    },
    // Reason: observed state, not an operator switch - `enabled` is the switch. Defaults
    // to "down" rather than "healthy" because a provider that has never been health
    // checked has not been shown to work, and the chapter 07 section 3 kill switch keys
    // off this value. Defaulting to healthy would let an unverified provider straight
    // past a guard whose whole purpose is to stop that.
    //
    // Written by the X9 kill-switch worker (`provider-kill-switch.service.ts`). The admin
    // health dashboard still DERIVES its verdict from rounds/events and must not read
    // this field — a stale "down" default would paint every quiet provider red.
    healthStatus: {
      type: String,
      enum: ["healthy", "degraded", "down"],
      default: "down",
    },
    lastHealthCheckAt: {
      type: Date,
    },
    healthDownSince: {
      type: Date,
    },
    healthFailureStreak: {
      type: Number,
      default: 0,
      min: 0,
    },
    // Reason: defaults to FALSE, and the default is the decision rather than a starting
    // point. A schema default fixes future rows only, so every provider registered before
    // this field existed reads as absent - and absent has to mean "nobody asked for
    // automation", because nobody did. Defaulting to true would switch the old behaviour
    // back on everywhere and make this whole change invisible.
    autoOutageResponseEnabled: {
      type: Boolean,
      default: false,
    },
    autoCatalogueSyncFriday: {
      type: Boolean,
      default: false,
    },
    lastFridayAutoSyncClaimKey: {
      type: String,
    },
    outageAlertedAt: {
      type: Date,
    },
    lastCatalogueSyncAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
    collection: "game_provider",
  },
);

const GameProvider: Model<IGameProvider> =
  mongoose.models.GameProvider ||
  mongoose.model<IGameProvider>("GameProvider", GameProviderSchema);

export default GameProvider;
