import type { Request, Response } from "express";

import { loadConfig } from "../config";
import {
  copyFor,
  howToPlayFor,
} from "../games/content";
import { resolveLocaleFromHeader } from "../games/locale";
import { TITLES, type TitleDefinition } from "../games/titles";

/**
 * `GET /v1/games` - endpoint 1 of the specification.
 *
 * WHAT THIS ENDPOINT IS ACTUALLY FOR
 * ----------------------------------
 * It looks like a list of names and it is really two things the platform cannot work without.
 *
 * The capability flags decide which contest formats are offered, and `supportsContentSeed`
 * decides whether the title may be used in a paid competition at all. The scoring fields decide
 * how the field is ranked - the specification's own warning about `scoreDirection` is that
 * getting it wrong means "we rank the entire field backwards and pay the worst player first",
 * which is not a bug either side would notice from a screenshot.
 *
 * `configSchema` is the other half. The platform generates its admin settings form directly from
 * it, so an accurate schema is what lets a new title start running contests with no code
 * written on the platform's side. That is the "no additional coding" claim, and this field is
 * where a provider either honours it or quietly transfers the cost.
 */

/**
 * Artwork for a title.
 *
 * Served by this service rather than a CDN, which is a deliberate simplification and is noted
 * as such: the specification asks for HTTPS URLs with a cache policy and warns that "URLs that
 * rotate leave broken game pages behind". These are stable and derived from the game code, so
 * they satisfy the property that matters even though the hosting is not what a real provider
 * would use.
 *
 * Labels on the generated SVGs stay English (title.displayName / tagline). Localising the
 * rasterised text inside a cacheable asset URL would either fork every URL by locale or serve
 * wrong labels from a shared cache - neither is worth it for decorative placeholders.
 */
function artwork(title: TitleDefinition, assetBase: string) {
  const base = `${assetBase}/assets/${title.gameCode}`;
  return {
    thumbnailUrl: `${base}/thumbnail.svg`,
    bannerUrl: `${base}/banner.svg`,
    iconUrl: `${base}/icon.svg`,
    screenshotUrls: [`${base}/screenshot-1.svg`, `${base}/screenshot-2.svg`],
  };
}

/**
 * The catalogue entry for one title in one locale.
 *
 * Field names and nesting follow section 6 exactly. Reason for building this explicitly rather
 * than spreading the title object: a spread would publish every internal field a title gains
 * later, and a catalogue is a public contract. The same rule the platform applies to its own
 * catalogue sync - a named allow-list, never a spread of the remote payload - is worth applying
 * in the outbound direction too.
 *
 * Text fields are resolved through `content.ts` for the requested locale (A11): always flat
 * strings, never a map.
 */
export function catalogueEntry(
  title: TitleDefinition,
  assetBase: string,
  locale?: string,
) {
  const resolved =
    locale ??
    resolveLocaleFromHeader(undefined, title.locales);
  const copy = copyFor(title.gameCode, resolved);

  return {
    gameCode: title.gameCode,
    displayName: copy.displayName,

    tagline: copy.tagline,
    description: copy.description,
    rulesSummary: copy.rulesSummary,
    howToPlay: howToPlayFor(title.gameCode, resolved),
    category: title.category,
    tags: title.tags,

    ...artwork(title, assetBase),

    family: title.family,
    playMode: title.playMode,
    supportsCompetition: title.supportsCompetition,
    supportsOneVsOne: title.supportsOneVsOne,
    supportsPractice: title.supportsPractice,
    supportsContentSeed: title.supportsContentSeed,

    scoreDirection: title.scoreDirection,
    scoreType: title.scoreType,
    scoreRange: title.scoreRange,

    typicalDurationSeconds: title.typicalDurationSeconds,
    maxDurationSeconds: title.maxDurationSeconds,

    configSchema: title.configSchema,

    locales: title.locales,
    platforms: title.platforms,
    status: title.status,
  };
}

export function listGames(req: Request, res: Response): void {
  const config = loadConfig();
  const assetBase = config.assetBaseUrl || config.publicUrl;

  // A short cache is honest about what this is: the platform caches the catalogue and re-syncs
  // periodically, so a long max-age would delay a status change to `maintenance` - the one
  // catalogue field that needs to take effect quickly.
  //
  // Accept-Language (A11): pick a declared locale per title. Vary so a shared cache cannot
  // serve Greek copy to an English sync (or the reverse).
  const acceptLanguage = req.header("accept-language");

  res.setHeader("Cache-Control", "public, max-age=60");
  res.setHeader("Vary", "Accept-Language");
  res.json({
    games: TITLES.map((title) => {
      const locale = resolveLocaleFromHeader(acceptLanguage, title.locales);
      return catalogueEntry(title, assetBase, locale);
    }),
  });
}
