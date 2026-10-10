import { Schema, model, models, Document, Model } from "mongoose";

/**
 * The admin's defaults for competitions a Game Master creates, and which of them a Game
 * Master may change (owner, 1 October 2026). One document.
 *
 * The option list, bounds and validation are in
 * `lib/services/gamemaster/competition-defaults*.ts`, not here. Reason: `value` holds a
 * number, a boolean, a choice or a prize split depending on the option, so the schema stores
 * it as `Mixed` and the validator - shared with the create route - decides what is correct.
 * A stored entry the list no longer knows is ignored when read, never refused.
 *
 * Deliberately NOT cached in memory: the main app and the admin app are separate processes,
 * so a cache cleared by an admin save in one would keep serving the old lock in the other.
 */
export interface IGameMasterCompetitionDefaultEntry {
  key: string;
  value: unknown;
  gmMayChange: boolean;
}

export interface IGameMasterCompetitionDefaults extends Document {
  singletonKey: string;
  options: IGameMasterCompetitionDefaultEntry[];
  updatedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

export const GAMEMASTER_COMPETITION_DEFAULTS_KEY = "global";

const EntrySchema = new Schema<IGameMasterCompetitionDefaultEntry>(
  {
    key: { type: String, required: true },
    value: { type: Schema.Types.Mixed },
    gmMayChange: { type: Boolean, required: true, default: true },
  },
  { _id: false },
);

const GameMasterCompetitionDefaultsSchema =
  new Schema<IGameMasterCompetitionDefaults>(
    {
      singletonKey: {
        type: String,
        required: true,
        unique: true,
        default: GAMEMASTER_COMPETITION_DEFAULTS_KEY,
      },
      options: { type: [EntrySchema], default: [] },
      updatedBy: { type: String },
    },
    { timestamps: true, collection: "gamemaster_competition_defaults" },
  );

const GameMasterCompetitionDefaults: Model<IGameMasterCompetitionDefaults> =
  (models?.GameMasterCompetitionDefaults as Model<IGameMasterCompetitionDefaults>) ||
  model<IGameMasterCompetitionDefaults>(
    "GameMasterCompetitionDefaults",
    GameMasterCompetitionDefaultsSchema,
  );

export default GameMasterCompetitionDefaults;
