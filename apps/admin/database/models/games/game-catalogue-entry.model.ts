import mongoose, { Schema, Document, Model } from "mongoose";

/**
 * Thin merchandising row for the player `/games` catalogue (X11 Slice 2, option 1).
 *
 * THIS IS THE SHOP WINDOW, NOT THE PAGE CONTENT. Names, rules, artwork and themes stay
 * on `provider_game` (provider titles) or `game_page_content` (trading). Collapsing those
 * into this collection would recreate "one rule, two copies" and invite a sync overwrite.
 *
 * Owner choice 22 Sep 2026: thin layer — `slug`, join key, and discovery flags only.
 * Chapter `16`'s full content fields on the entry are deliberately not implemented.
 *
 * Never delete a row when a title is disabled (R29): hide via `isVisible`, leave history.
 * `slug` and `gameKey` are permanent once written — seed uses `trading` or `gameCode` so
 * existing `/games/circuit-sprint` links keep working.
 */

export type CatalogueGameType = "trading" | "provider";

export interface IGameCatalogueEntry extends Document {
  slug: string;
  gameKey: string;
  gameType: CatalogueGameType;
  providerKey?: string;
  gameCode?: string;
  sortOrder: number;
  isFeatured: boolean;
  isVisible: boolean;
  comingSoon: boolean;
  seoTitle?: string;
  seoDescription?: string;
  createdAt: Date;
  updatedAt: Date;
}

const GameCatalogueEntrySchema = new Schema<IGameCatalogueEntry>(
  {
    slug: {
      type: String,
      required: true,
      trim: true,
      unique: true,
      // Reason: no default — an empty slug must fail validation, never become "".
    },
    gameKey: {
      type: String,
      required: true,
      trim: true,
      unique: true,
      // Reason: v1 is one shop row per game. Multiple entries over one gameKey is deferred.
    },
    gameType: {
      type: String,
      required: true,
      enum: ["trading", "provider"],
    },
    providerKey: { type: String, trim: true },
    gameCode: { type: String, trim: true },
    sortOrder: { type: Number, required: true, default: 100 },
    isFeatured: { type: Boolean, required: true, default: false },
    // Reason: default visible so ensure-upsert does not hide a newly enabled title.
    isVisible: { type: Boolean, required: true, default: true },
    comingSoon: { type: Boolean, required: true, default: false },
    seoTitle: { type: String, trim: true },
    seoDescription: { type: String, trim: true },
  },
  {
    timestamps: true,
    collection: "game_catalogue_entry",
  },
);

GameCatalogueEntrySchema.index({ isVisible: 1, sortOrder: 1 });
GameCatalogueEntrySchema.index({ isFeatured: 1, sortOrder: 1 });

const GameCatalogueEntry: Model<IGameCatalogueEntry> =
  mongoose.models?.GameCatalogueEntry ||
  mongoose.model<IGameCatalogueEntry>(
    "GameCatalogueEntry",
    GameCatalogueEntrySchema,
  );

export default GameCatalogueEntry;
