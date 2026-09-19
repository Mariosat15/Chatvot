import mongoose, { Schema, Document, Model } from "mongoose";

/**
 * A player's own declarations about one game.
 *
 * Chapter `20` section 2 designs this as its own collection rather than as more
 * fields on `UserPresence`, and the reason is worth keeping: `UserPresence` is
 * one document per player written on every heartbeat, while this is one row per
 * player PER GAME and is written only when somebody presses a switch. Folding
 * per-game rows into the presence document would make a settings change a write
 * to the hottest document the platform has.
 *
 * WHAT IS DELIBERATELY NOT HERE. Chapter `20`'s table also lists
 * `interestLevel`, `inferredAt` and `skillBand`. None of them is declared,
 * because nothing infers interest yet and nothing matches on skill band for a
 * game - that is X11.5. A field declared before anything writes it is the shape
 * behind `requiresSyncPlay`, `isPaused`, `lastSuccessfulRoundAt`, `family` and
 * `playModeOverride`: stored, transported, rendered, and read by nothing. They
 * arrive with the code that populates them.
 *
 * NOT MIRRORED INTO `apps/admin`, deliberately. Nothing in the admin app reads
 * a player's game preferences, and R42 is the precedent - `provider-finalize.ts`
 * sat mirrored and imported by nothing for three days, two copies agreeing while
 * only one ran. A mirror arrives with its first admin importer.
 */
export interface IUserGamePreference extends Document {
  userId: string;
  /** The immutable statistics key from chapter `02`. `"trading"` for trading. */
  gameKey: string;
  willingToBeChallenged: boolean;
  declaredAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const UserGamePreferenceSchema = new Schema<IUserGamePreference>(
  {
    userId: {
      type: String,
      required: true,
      index: true,
    },
    gameKey: {
      type: String,
      required: true,
    },
    // Reason: `true` matches `UserPresence.acceptingChallenges` and the
    // `WILLING_TO_BE_CHALLENGED_BY_DEFAULT` constant the route and the settings
    // screen both read. A schema default fixes future rows only, which costs
    // nothing here because no row exists - but the default and the constant are
    // two definitions of one fact, so a test compares them.
    willingToBeChallenged: {
      type: Boolean,
      required: true,
      default: true,
    },
    // Reason: separate from `updatedAt`, which moves for any write at all. This
    // is when the PLAYER last said so, which is the question a support ticket
    // asks. Chapter `20` keeps `declaredAt` and `inferredAt` apart for the same
    // reason - an inference must never be mistaken for a declaration.
    declaredAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    collection: "user_game_preference",
  },
);

// Chapter `20` section 2: one row per player per game.
UserGamePreferenceSchema.index({ userId: 1, gameKey: 1 }, { unique: true });

const UserGamePreference: Model<IUserGamePreference> =
  mongoose.models.UserGamePreference ||
  mongoose.model<IUserGamePreference>(
    "UserGamePreference",
    UserGamePreferenceSchema,
  );

export default UserGamePreference;
