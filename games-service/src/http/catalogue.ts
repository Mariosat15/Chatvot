import type { Request, Response } from "express";

import { loadConfig } from "../config";
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
 * The catalogue entry for one title.
 *
 * Field names and nesting follow section 6 exactly. Reason for building this explicitly rather
 * than spreading the title object: a spread would publish every internal field a title gains
 * later, and a catalogue is a public contract. The same rule the platform applies to its own
 * catalogue sync - a named allow-list, never a spread of the remote payload - is worth applying
 * in the outbound direction too.
 */
export function catalogueEntry(title: TitleDefinition, assetBase: string) {
  return {
    gameCode: title.gameCode,
    displayName: title.displayName,

    tagline: title.tagline,
    description: title.description,
    rulesSummary: title.rulesSummary,
    howToPlay: title.howToPlay,
    category: title.category,
    tags: title.tags,

    ...artwork(title, assetBase),

    family: title.family,
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

export function listGames(_req: Request, res: Response): void {
  const config = loadConfig();
  const assetBase = config.assetBaseUrl || config.publicUrl;

  // A short cache is honest about what this is: the platform caches the catalogue and re-syncs
  // periodically, so a long max-age would delay a status change to `maintenance` - the one
  // catalogue field that needs to take effect quickly.
  res.setHeader("Cache-Control", "public, max-age=60");
  res.json({ games: TITLES.map((title) => catalogueEntry(title, assetBase)) });
}
