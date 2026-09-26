import { connectToDatabase } from "@/database/mongoose";
import GamePageContent from "@/database/models/games/game-page-content.model";
import {
  validateGameContent,
  type GameContentInput,
} from "@/lib/admin/game-content-fields";
import { buildContentMongoUpdate } from "@/lib/services/game-providers/game-content.service";
import {
  TRADING_PAGE_DEFAULTS,
  TRADING_PAGE_GAME_KEY,
} from "@/lib/services/games/trading-page-defaults";

/**
 * Read/write the Trading player page singleton (`gameKey: "trading"`).
 *
 * ADMIN-ONLY AND NOT MIRRORED. The player app reads `game_page_content` and falls back to
 * `TRADING_PAGE_DEFAULTS`; mirroring this writer would create a second door onto the same
 * document from the app with no operator behind it (R42).
 */

export type TradingPageContentView = GameContentInput & {
  gameKey: typeof TRADING_PAGE_GAME_KEY;
};

export type TradingPageUpdateResult =
  | { success: true; content: GameContentInput }
  | { success: false; error: string };

function leanToView(
  doc: Record<string, unknown> | null | undefined,
): TradingPageContentView {
  const d = TRADING_PAGE_DEFAULTS;
  return {
    gameKey: TRADING_PAGE_GAME_KEY,
    displayName:
      typeof doc?.displayName === "string" && doc.displayName.trim()
        ? doc.displayName
        : d.displayName,
    tagline:
      typeof doc?.tagline === "string" && doc.tagline.trim()
        ? doc.tagline
        : d.tagline,
    description:
      typeof doc?.description === "string" && doc.description.trim()
        ? doc.description
        : d.description,
    category:
      typeof doc?.category === "string" && doc.category.trim()
        ? doc.category
        : d.category,
    rulesSummary:
      typeof doc?.rulesSummary === "string" && doc.rulesSummary.trim()
        ? doc.rulesSummary
        : d.rulesSummary,
    howToPlay:
      typeof doc?.howToPlay === "string" && doc.howToPlay.trim()
        ? doc.howToPlay
        : d.howToPlay,
    pageThemeId:
      typeof doc?.pageThemeId === "string" && doc.pageThemeId.trim()
        ? doc.pageThemeId
        : d.pageThemeId,
    skillLevelLabel:
      typeof doc?.skillLevelLabel === "string" && doc.skillLevelLabel.trim()
        ? doc.skillLevelLabel
        : d.skillLevelLabel,
    thumbnailUrl:
      typeof doc?.thumbnailUrl === "string" ? doc.thumbnailUrl : undefined,
    bannerUrl: typeof doc?.bannerUrl === "string" ? doc.bannerUrl : undefined,
    howToPlayImageUrl:
      typeof doc?.howToPlayImageUrl === "string"
        ? doc.howToPlayImageUrl
        : undefined,
    highlightsImageUrl:
      typeof doc?.highlightsImageUrl === "string"
        ? doc.highlightsImageUrl
        : undefined,
    stylizedQuote:
      typeof doc?.stylizedQuote === "string" ? doc.stylizedQuote : undefined,
    gameplayPreviewUrl:
      typeof doc?.gameplayPreviewUrl === "string"
        ? doc.gameplayPreviewUrl
        : undefined,
    gameplayVideoUrl:
      typeof doc?.gameplayVideoUrl === "string"
        ? doc.gameplayVideoUrl
        : undefined,
    gallery: Array.isArray(doc?.gallery)
      ? (doc.gallery as GameContentInput["gallery"])
      : undefined,
    highlights: Array.isArray(doc?.highlights)
      ? (doc.highlights as GameContentInput["highlights"])
      : undefined,
    heroFeatures: Array.isArray(doc?.heroFeatures)
      ? (doc.heroFeatures as GameContentInput["heroFeatures"])
      : undefined,
    supportedDevices:
      doc?.supportedDevices && typeof doc.supportedDevices === "object"
        ? (doc.supportedDevices as GameContentInput["supportedDevices"])
        : undefined,
    howItWorksSteps: Array.isArray(doc?.howItWorksSteps)
      ? (doc.howItWorksSteps as GameContentInput["howItWorksSteps"])
      : undefined,
    descriptionTags: Array.isArray(doc?.descriptionTags)
      ? (doc.descriptionTags as string[])
      : undefined,
  };
}

/**
 * Returns the merged view (stored row over defaults). Does NOT seed the database —
 * first write creates the singleton. Seeding on GET would invent rows operators never
 * chose, the opposite of "a stored value and an absent one are different facts".
 */
export async function getTradingPageContent(): Promise<TradingPageContentView> {
  await connectToDatabase();
  const doc = await GamePageContent.findOne({ gameKey: TRADING_PAGE_GAME_KEY }).lean();
  return leanToView(doc as Record<string, unknown> | null);
}

export async function updateTradingPageContent(
  body: unknown,
): Promise<TradingPageUpdateResult> {
  const validated = validateGameContent(body);
  if (!validated.ok) return { success: false, error: validated.error };

  const update = buildContentMongoUpdate(validated.content);
  if (!update.$set && !update.$unset) {
    return { success: false, error: "No content fields were sent." };
  }

  await connectToDatabase();

  // Reason: upsert stamps gameKey only on insert. Never accept gameKey from the body —
  // validateGameContent already refuses it, and a caller-supplied key would edit a
  // different singleton through this route.
  await GamePageContent.findOneAndUpdate(
    { gameKey: TRADING_PAGE_GAME_KEY },
    {
      ...update,
      $setOnInsert: { gameKey: TRADING_PAGE_GAME_KEY },
    },
    { upsert: true, new: true },
  );

  return { success: true, content: validated.content };
}
