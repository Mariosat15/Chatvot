import mongoose, { Schema, Document, Model } from "mongoose";

/**
 * One playable title from a provider's catalogue (X2, chapter 04 section 3.2).
 *
 * This is a CACHE of the provider's `GET /v1/games` response, not a source of truth about
 * what players can play. Chapter 04 section 3.2 makes that distinction load-bearing:
 *
 *   `providerStatus`   what the PROVIDER says about the title
 *   `chartvoltEnabled` what WE say about it
 *
 * They are independent on purpose. A provider marking a game `active` does not make it
 * live here - we enable each title ourselves after testing it. Collapsing these into one
 * flag would hand a third party the ability to put an untested game in front of paying
 * players by changing a value in their own database.
 */
export interface IProviderGame extends Document {
  providerKey: string;
  gameCode: string;
  gameKey: string;
  displayName: string;
  description?: string;
  thumbnailUrl?: string;
  category?: string;
  tagline?: string;
  bannerUrl?: string;
  highlights?: { title: string; detail: string }[];
  family: "independent" | "head_to_head";
  playMode?: "anytime" | "scheduled";
  supportsCompetition: boolean;
  supportsOneVsOne: boolean;
  supportsPractice: boolean;
  supportsContentSeed: boolean;
  scoreDirection: "higher_is_better" | "lower_is_better";
  scoreType: "integer" | "decimal" | "duration_ms";
  scoreRange?: { min?: number; max?: number };
  typicalDurationSeconds?: number;
  maxDurationSeconds?: number;
  /** JSON Schema from the provider. The admin contest form is generated from this. */
  configSchema?: Record<string, unknown>;
  providerStatus: "active" | "deprecated" | "maintenance";
  chartvoltEnabled: boolean;
  lastSyncedAt?: Date;
  lastSuccessfulRoundAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ProviderGameSchema = new Schema<IProviderGame>(
  {
    providerKey: {
      type: String,
      required: true,
      index: true,
      immutable: true,
      trim: true,
    },
    // Reason: the provider guarantees `gameCode` is stable and permanent (chapter 01
    // section 3). Immutable here so a catalogue sync cannot silently repoint a row at a
    // different title, which would rewrite the meaning of every stat joined to it.
    gameCode: {
      type: String,
      required: true,
      immutable: true,
      trim: true,
    },
    // Reason: `provider:{providerKey}:{gameCode}`, derived ONCE and never recomputed
    // (chapter 02 section 2.1). This is the join key for all historical stats, so it
    // carries the same immutability rule as the contest-level `gameKey`.
    gameKey: {
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
    description: { type: String },
    thumbnailUrl: { type: String },
    category: { type: String },

    // Presentation content the OPERATOR writes, and which no provider ever supplies.
    //
    // The distinction from `description` and `thumbnailUrl` above is worth stating, because
    // all five read like the same kind of field and two of them are not. Those two appear in
    // the provider contract, so the catalogue sync SEEDS them on the first sync and never
    // touches them again (`firstSyncOnlyFields`). These three are in no contract at all, so
    // they are in neither sync allow-list and cannot be seeded, overwritten or cleared by a
    // provider. That is deliberate rather than incidental: a spread of a provider payload
    // over this document would revert an operator's wording on the next sync with nothing
    // raising an error, which is the failure `catalogue.service.ts` is written to prevent.
    //
    // Nothing here may become required. A title synced before these existed, or supplied by
    // a provider whose operator has not written copy yet, must still render - so every
    // consumer treats an absent value as "say less", never as an empty string to print.
    tagline: { type: String, trim: true },
    // Reason: the WIDE hero art, distinct from `thumbnailUrl`, which is the square logo. Two
    // fields because the two shapes crop differently and a single URL used for both makes one
    // of the two look broken. Until this is set, `components/neon/banners.ts` still answers
    // from the game code, so an unset banner is a generic trophy rather than a gap.
    bannerUrl: { type: String, trim: true },
    // Reason: the short "why this game is fun" cards. An array rather than four fields so a
    // title can carry two or six, and `_id: false` because these are content, not entities -
    // nothing joins to them and an id per row would be stored, transported and never read.
    highlights: {
      type: [
        {
          _id: false,
          title: { type: String, required: true, trim: true },
          detail: { type: String, required: true, trim: true },
        },
      ],
      default: undefined,
    },

    // Capability declarations from the catalogue.
    //
    // CORRECTION, 8 Sep 2026: this comment claimed `family` drives which contest formats the
    // admin panel offers. It does not, and nothing reads it - the formats are gated by
    // `supportsCompetition` and `supportsOneVsOne` below. `family` is validated on ingest,
    // stored, transported and rendered as a badge on the wizard's first step, and that badge
    // is its only use. Left required because a title arriving without it is still a title we
    // cannot describe, and because making it optional now would be a mirrored change for no
    // gain. The sentence is corrected in place rather than deleted, because an unverified
    // claim of enforcement is what let `supportsContentSeed` go unread for six days beside
    // three comments asserting it gated paid entry - see `22` s3.
    //
    // `family` is also NOT the axis that decides whether players must play at the same
    // moment: it describes whether a game needs an opponent, and a race is `independent`.
    // That axis is `playMode` below - `22` s1.
    family: {
      type: String,
      enum: ["independent", "head_to_head"],
      required: true,
    },
    // Does everybody play at one appointed moment, or whenever they like? `22` s4.1.
    //
    // Read through `resolvePlayMode` in `lib/services/games/play-shape.ts` and never directly:
    // that function also forces `head_to_head` to `scheduled`, because two people cannot play
    // each other at different times, so a provider declaring the impossible combination is
    // corrected rather than believed.
    //
    // DEFAULTED rather than required, unlike `family` beside it. Every title in the live
    // catalogue is `anytime`, and a required field would refuse the whole catalogue on the next
    // sync - `family` could afford to be required because nothing had been synced when it was
    // added. Note the consequence, which is the usual one for a schema default: this fixes new
    // and re-synced rows only, and an unset value reads as `anytime` either way.
    playMode: {
      type: String,
      enum: ["anytime", "scheduled"],
      default: "anytime",
    },
    supportsCompetition: { type: Boolean, default: false },
    supportsOneVsOne: { type: Boolean, default: false },
    supportsPractice: { type: Boolean, default: false },
    // Reason: required for competitions (chapter 01 section 3) - without a content seed
    // every player gets different content and the contest is not a fair comparison.
    supportsContentSeed: { type: Boolean, default: false },

    scoreDirection: {
      type: String,
      enum: ["higher_is_better", "lower_is_better"],
      required: true,
    },
    scoreType: {
      type: String,
      enum: ["integer", "decimal", "duration_ms"],
      required: true,
    },
    // Reason: used to reject impossible scores at ingestion (chapter 07 section 4). Not
    // required, because a provider need not declare bounds - absent means "unbounded",
    // which must read differently from a declared range of zero.
    scoreRange: {
      min: { type: Number },
      max: { type: Number },
    },

    typicalDurationSeconds: { type: Number },
    maxDurationSeconds: { type: Number },

    // Reason: Mixed because this is a JSON Schema supplied by the provider, whose shape we
    // do not control and must not constrain. It is never executed and never trusted - the
    // admin form is generated from it and the resulting config is validated against it.
    configSchema: {
      type: Schema.Types.Mixed,
    },

    providerStatus: {
      type: String,
      enum: ["active", "deprecated", "maintenance"],
      default: "active",
    },
    // Reason: OUR switch, and it defaults to false. See the class comment - a catalogue
    // sync must never be able to put a title in front of paying players by itself.
    chartvoltEnabled: {
      type: Boolean,
      default: false,
    },

    lastSyncedAt: { type: Date },
    lastSuccessfulRoundAt: { type: Date },
  },
  {
    timestamps: true,
    collection: "provider_game",
  },
);

// Chapter 04 section 3.2: one row per title per provider.
ProviderGameSchema.index({ providerKey: 1, gameCode: 1 }, { unique: true });

// Reason: the catalogue picker and the games list both filter on "what can players
// actually see", which is our flag and the provider's status together.
ProviderGameSchema.index({ chartvoltEnabled: 1, providerStatus: 1 });

const ProviderGame: Model<IProviderGame> =
  mongoose.models.ProviderGame ||
  mongoose.model<IProviderGame>("ProviderGame", ProviderGameSchema);

export default ProviderGame;
