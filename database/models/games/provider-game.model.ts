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
  rulesSummary?: string;
  howToPlay?: string;
  bannerUrl?: string;
  highlights?: { title: string; detail: string }[];
  /** Ours, not the provider's - the arena's two illustrations. See the schema note below. */
  howToPlayImageUrl?: string;
  highlightsImageUrl?: string;
  family: "independent" | "head_to_head";
  playMode?: "anytime" | "scheduled";
  /** OUR answer, when the provider's is absent or wrong for how we want to run it. */
  playModeOverride?: "anytime" | "scheduled";
  /** Task 11. Read through `resolveSupportedPlayModes`, which unions the default in. */
  supportedPlayModes?: ("anytime" | "scheduled")[];
  supportsCompetition: boolean;
  supportsOneVsOne: boolean;
  supportsPractice: boolean;
  supportsContentSeed: boolean;
  scoreDirection: "higher_is_better" | "lower_is_better";
  scoreType: "integer" | "decimal" | "duration_ms";
  scoreRange?: { min?: number; max?: number };
  /** Display only. "points", "ms", "boards" - never parsed, never ranked on. */
  scoreUnit?: string;
  /** Does a score of exactly zero count as a result worth paying? Defaults to no. */
  zeroIsValidResult?: boolean;
  /** An extra bar a score must clear to be paid, expressed in the game's own units. */
  minimumEligibleScore?: number;
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

    // Presentation content, seeded from the provider once and owned by the operator after.
    //
    // THIS COMMENT USED TO SAY THESE FIELDS ARE "content the OPERATOR writes, and which no
    // provider ever supplies", and that they "are in no contract at all". BOTH CLAIMS WERE
    // FALSE, corrected 10 September 2026 (R63). `01` section 3 marks `tagline`,
    // `description`, `rulesSummary`, `howToPlay`, `thumbnailUrl` and `bannerUrl` all `Yes`,
    // required of every provider, and has since the requirements document issued to
    // providers reached version 1.1. Our own reference provider sends all six.
    //
    // The correction is left visible rather than tidied away, because the wrong sentence is
    // the reason nobody looked: it explained the omission as a deliberate design choice, so
    // `tagline` and `bannerUrl` sat outside both sync allow-lists and every provider's
    // values for them were discarded on every sync, silently. An aside in a comment is a
    // claim, not a fact, and this is the seventh instance of it here.
    //
    // What IS true, and is the real distinction: these are sentences a player reads, so
    // they are in `firstSyncOnlyFields` and not `providerOwnedFields` - an operator may
    // improve, localise or correct them and the next scheduled sync will not revert the
    // edit. That is the opposite treatment to `scoreDirection` or `playMode`, which are the
    // provider's statements about how their own game works.
    //
    // Nothing here may become required. A title synced before these existed, or supplied by
    // a provider whose operator has not written copy yet, must still render - so every
    // consumer treats an absent value as "say less", never as an empty string to print.
    tagline: { type: String, trim: true },
    // Reason: how the score is produced and how ties break. `01` s3 calls this the first
    // text support quotes back when a player disputes a prize, which is why it is the
    // provider's account of their own game rather than ours - and why nothing generates it.
    rulesSummary: { type: String, trim: true },
    // Reason: the controls and constraints in plain language. Separate from `rulesSummary`
    // because a player asking "how do I play" and a player asking "why did I lose" are
    // asking two different questions, and one text answering both answers neither well.
    howToPlay: { type: String, trim: true },
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
    // The two illustrations the arena draws beside this content (owner, 11 September 2026).
    //
    // OURS, NOT THE PROVIDER'S, and that is the distinction that decides where they live. A
    // provider supplies a logo and a hero banner because those identify their title; these
    // two illustrate OUR panels - the rules block and the feature cards - at the size and in
    // the style of our arena. So they are in no sync allow-list at all, not even
    // `firstSyncOnlyFields`, and no provider is asked for them: the requirements document
    // is unchanged and there is no version to bump.
    //
    // ABSENT IS THE NORMAL STATE AND MUST STAY CHEAP. Every title carries neither today, so
    // the panels draw a recreated emblem instead - which is why a missing value is a
    // different-looking panel rather than a gap, and why nothing here may become required.
    howToPlayImageUrl: { type: String, trim: true },
    highlightsImageUrl: { type: String, trim: true },

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
    // OUR answer, and the reason it is a second field rather than an edit to `playMode` above
    // is the sync: `playMode` is in `providerOwnedFields`, so a control writing there would be
    // reverted on the next catalogue pull with no error raised anywhere. An operator would set
    // a race to run simultaneously, watch it save, and find it staggered again the next
    // morning. This field is in NO sync list, which is what makes it survive - and that is a
    // property of the allow-list rather than of anything written here, so it is asserted by a
    // test rather than trusted.
    //
    // NO DEFAULT, deliberately, unlike `playMode` beside it. Absent means "we have not
    // decided, follow the provider", and a default would make every existing row carry a
    // decision nobody took - a schema default IS a stored value, which is the rule behind R50,
    // `entryBlockThreshold` and `canEnterChallenges`. Read through `resolvePlayMode`, never
    // directly: it also refuses to let this beat a `head_to_head` title, because an override
    // cannot make two people play each other at different times.
    playModeOverride: {
      type: String,
      enum: ["anytime", "scheduled"],
    },
    // Which shapes a contest on this title may be created as - task 11.
    //
    // The PLURAL of `playMode`, and it does not replace it: `playMode` (corrected by
    // `playModeOverride`) is what this game IS and supplies the default a new contest gets,
    // while this is the set an operator may choose from. Task 11's own example needs both -
    // a multiplayer racing game running a synchronous race and an async time trial.
    //
    // Read through `resolveSupportedPlayModes`, never directly. That function unions the
    // resolved default INTO the set, because a title's own declared style must not be
    // unselectable and every contest already created on this title was created as it; and it
    // returns `["scheduled"]` alone for a `head_to_head` title, because an async form of a
    // chess match is not a shape anybody may enable.
    //
    // NO DEFAULT, like `playModeOverride` and for the same reason: a schema default IS a
    // stored value, so `default: ["anytime"]` would write a decision nobody took onto every
    // row the next sync creates and make an operator's deliberate single-shape answer
    // indistinguishable from silence. R50, `entryBlockThreshold` and `canEnterChallenges`.
    //
    // OPERATOR-OWNED and in NO sync list, which is what makes it survive a catalogue pull -
    // a property of the allow-list rather than of anything written here, so a test asserts it
    // rather than trusting it. Deliberately NOT in the provider contract either, so `01` and
    // the requirements HTML need no version bump: a provider declares what their game is, we
    // declare what we are willing to run it as.
    supportedPlayModes: {
      type: [String],
      enum: ["anytime", "scheduled"],
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

    // How a score is described, and what counts as one at all (task document 14).
    //
    // These three are OPERATOR-owned and in no sync allow-list, like `tagline` and
    // `bannerUrl` above - a provider declares how their game scores, but whether a
    // particular number is worth a prize is our commercial rule about our own money.
    //
    // Read through `resolveScoreEligibility` in `lib/services/games/score-direction.service.ts`
    // and never directly. That function is the single place the defaults live, and it is the
    // same one-resolve-per-contest seam `scoreDirection` already travels on - which is not a
    // convenience. R32/R33 established that a per-participant copy of a ranking input lets two
    // rows in ONE leaderboard disagree, and an incoherent board cannot be explained to a
    // player, whereas a uniformly wrong one is at least visibly wrong.
    scoreUnit: { type: String, trim: true },
    // Task 14 asks for zero-eligibility to be configurable, and this is the field that
    // makes the owner's 9 September rule a DEFAULT rather than a law hard-coded in
    // `providerHasResult`. The rule is unchanged: a score of zero wins nothing.
    //
    // NO DEFAULT, and this was written WITH `default: false` first, so the correction is left
    // visible rather than tidied away. The argument for defaulting was that a stored `false`
    // equals what `providerHasResult` already does, so nothing settles differently on the day
    // it ships - which is true, and is not the whole question.
    //
    // A schema default IS a stored value (R50, `entryBlockThreshold`, `canEnterChallenges`),
    // and a default only ever fixes FUTURE rows. This particular rule has already been
    // reversed once - a zero used to be paid, until the owner's decision of 9 September 2026 -
    // so a reversal is a live possibility rather than a hypothetical. With a default, every
    // synced row holds a real stored `false` indistinguishable from an operator's deliberate
    // `false`, and a second reversal becomes a migration that cannot tell the two apart. With
    // no default, absence keeps meaning "nobody has said otherwise" and the platform rule
    // stays a single line of code. Same reasoning as `playModeOverride`.
    //
    // Nothing is lost by the absence: `resolveScoringRules` reads `=== true`, the gate reads
    // `!== true`, and the dialog's `draftFrom` reads `=== true`, so a blank row renders the
    // switch OFF correctly rather than ambiguously.
    //
    // THE TITLE THIS EXISTS FOR was named in `scoring.ts` before it could be expressed: an
    // `integer` + `lower_is_better` game scoring mistakes or penalties, where zero is a
    // flawless round rather than an absent one. No such title is in the catalogue. That is
    // also why this must never be inferred from `scoreType` - the only lower-is-better title
    // today measures `duration_ms`, where zero is an unrecorded round, so a guess from the
    // type would be wrong for the one case it was reached for.
    zeroIsValidResult: { type: Boolean },
    // An optional extra bar, "if required" in task 14's words, and it is DIRECTIONAL: the
    // test is "at least as good as", so a higher-is-better game needs `score >= this` and a
    // lower-is-better game needs `score <= this`. Naming it a minimum and comparing it with
    // `>=` in both directions would silently refuse every finisher of a race, which reads
    // correct in the diff because the field says "minimum".
    //
    // No default. Absent means "no bar beyond the zero rule", and a stored `0` is a real and
    // different instruction: it admits zero on a higher-is-better game, which is why it must
    // not be conflated with absence.
    minimumEligibleScore: { type: Number },

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
