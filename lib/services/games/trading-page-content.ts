/**
 * Read the Trading player page singleton for catalogue + `/games/trading`.
 *
 * MAIN-APP ONLY. Admin owns the writer (`trading-page-content.service.ts`); mirroring this
 * reader into admin ahead of a caller is the R42 trap.
 *
 * Absences fall back to `TRADING_PAGE_DEFAULTS` — never invent empty strings. A missing
 * document means "nobody has edited yet", which is the shipped copy, not a blank page.
 */

import { connectToDatabase } from "@/database/mongoose";
import GamePageContent from "@/database/models/games/game-page-content.model";
import {
  TRADING_PAGE_DEFAULTS,
  TRADING_PAGE_GAME_KEY,
} from "@/lib/services/games/trading-page-defaults";

export interface TradingPageStoredContent {
  displayName: string;
  tagline: string;
  description: string;
  category: string;
  rulesSummary: string;
  howToPlay: string;
  pageThemeId: string;
  skillLevelLabel: string;
  thumbnailUrl?: string;
  bannerUrl?: string;
  howToPlayImageUrl?: string;
  highlightsImageUrl?: string;
  stylizedQuote?: string;
  gameplayPreviewUrl?: string;
  gameplayVideoUrl?: string;
  gallery?: { url: string; title?: string; type?: string }[];
  highlights?: { title: string; detail: string }[];
  heroFeatures?: { icon: string; label: string }[];
  supportedDevices?: { desktop?: boolean; tablet?: boolean; mobile?: boolean };
  howItWorksSteps?: { title: string; detail: string; icon?: string }[];
  descriptionTags?: string[];
}

function pickString(
  value: unknown,
  fallback: string,
): string {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : fallback;
}

function pickOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : undefined;
}

export async function loadTradingPageContent(): Promise<TradingPageStoredContent> {
  await connectToDatabase();
  const doc = await GamePageContent.findOne({
    gameKey: TRADING_PAGE_GAME_KEY,
  }).lean();

  const d = TRADING_PAGE_DEFAULTS;
  if (!doc) {
    return { ...d };
  }

  return {
    displayName: pickString(doc.displayName, d.displayName),
    tagline: pickString(doc.tagline, d.tagline),
    description: pickString(doc.description, d.description),
    category: pickString(doc.category, d.category),
    rulesSummary: pickString(doc.rulesSummary, d.rulesSummary),
    howToPlay: pickString(doc.howToPlay, d.howToPlay),
    pageThemeId: pickString(doc.pageThemeId, d.pageThemeId),
    skillLevelLabel: pickString(doc.skillLevelLabel, d.skillLevelLabel),
    thumbnailUrl: pickOptionalString(doc.thumbnailUrl),
    bannerUrl: pickOptionalString(doc.bannerUrl),
    howToPlayImageUrl: pickOptionalString(doc.howToPlayImageUrl),
    highlightsImageUrl: pickOptionalString(doc.highlightsImageUrl),
    stylizedQuote: pickOptionalString(doc.stylizedQuote),
    gameplayPreviewUrl: pickOptionalString(doc.gameplayPreviewUrl),
    gameplayVideoUrl: pickOptionalString(doc.gameplayVideoUrl),
    gallery: Array.isArray(doc.gallery) ? doc.gallery : undefined,
    highlights: Array.isArray(doc.highlights) ? doc.highlights : undefined,
    heroFeatures: Array.isArray(doc.heroFeatures) ? doc.heroFeatures : undefined,
    supportedDevices:
      doc.supportedDevices && typeof doc.supportedDevices === "object"
        ? doc.supportedDevices
        : undefined,
    howItWorksSteps: Array.isArray(doc.howItWorksSteps)
      ? doc.howItWorksSteps
      : undefined,
    descriptionTags: Array.isArray(doc.descriptionTags)
      ? doc.descriptionTags
      : undefined,
  };
}
