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
    healthStatus: {
      type: String,
      enum: ["healthy", "degraded", "down"],
      default: "down",
    },
    lastHealthCheckAt: {
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
