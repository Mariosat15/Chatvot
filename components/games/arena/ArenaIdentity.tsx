import { Globe, Shield, Users, Zap, type LucideIcon } from "lucide-react";
import { accentClasses } from "@/components/neon/tokens";
import type { GamePresentation } from "@/lib/services/games/game-presentation.service";
import {
  heroFeatures,
  splitGameTitle,
  type ArenaFeature,
} from "./arena-facts";

/**
 * Who the game is: artwork, name, genre, tagline, one line of description and four facts -
 * all of it inside one thin horizontal banner.
 *
 * NOTHING HERE IS PER-TITLE CODE. Every word comes from the catalogue row an operator edits,
 * and every feature is derived in `arena-facts.ts` from a DECLARED field. That is the whole
 * mechanism behind "a new game needs no additional coding": the screen renders content, not
 * cases. A `switch` on game code here would satisfy every existing test and quietly make the
 * claim false for the next title.
 *
 * AN ABSENT VALUE RENDERS NOTHING, never a placeholder. A game with no tagline shows no
 * tagline line; one with no logo shows the monogram below. A grey box captioned "no image"
 * is worse than a clean heading, and an operator who has not written copy yet should see a
 * screen that looks deliberately spare rather than broken.
 *
 * ----------------------------------------------------------------------------------------
 * REBUILT AGAIN 11 SEPTEMBER 2026, on the owner's hero reference and a one-line instruction:
 * "the current banner is far too tall and has unnecessary content/cards underneath". This is
 * the second rebuild of this component in a day and the fault was the same both times - the
 * header kept growing until it was the largest thing on a page whose whole purpose is the
 * board below it.
 *
 * FIVE THINGS ABOUT THE SHAPE ARE DELIBERATE, and four of them are the measurement.
 *
 * THE HEIGHT IS FIXED AT 118px AND THAT IS THE SPECIFICATION, not a starting point. The
 * previous version set a `min-height` of 220 and then let its content decide, which is how a
 * banner reaches 400: a badge, a wrapped two-line heading, a three-line description, the
 * contest's name and then three bordered cards across the foot, each of them individually
 * reasonable. A fixed height with `overflow-hidden` above it means nothing added here can
 * push the board down - the same rule, and the same reason, as the bottom band's 104px.
 *
 * THE NAME SPLITS INTO TWO LINES at its own colon, because the catalogue stores one field and
 * the reference shows a title with a subtitle under it. See `splitGameTitle`.
 *
 * THE DESCRIPTION IS ONE LINE. It is a 2,000-character operator field; the lobby renders it
 * whole, which is where a player reads about a game before paying, and this screen is for
 * somebody who has already decided.
 *
 * THE FEATURES ARE ICON-AND-LABEL WITH NO BOX. The previous version drew them as three
 * bordered cards, which is what made them read as a second section rather than as part of the
 * banner - and boxes need padding, which is height.
 *
 * THE CONTEST'S OWN NAME IS NOT HERE ANY MORE, and that is a removal rather than an
 * omission. It was a fifth line of copy repeating what the "Back to ..." link directly above
 * this banner already says, so the page states it once instead of twice.
 * ----------------------------------------------------------------------------------------
 */

interface Props {
  presentation: GamePresentation;
  minParticipants?: number;
  maxParticipants?: number;
}

/**
 * The glyph for each feature slot.
 *
 * A `Map` keyed by the name `arena-facts.ts` returns, rather than object indexing: the key is
 * derived from stored data and object lookup walks the prototype chain, so `"__proto__"`
 * returns something truthy that survives a null check and fails later somewhere unrelated.
 */
const FEATURE_ICONS = new Map<ArenaFeature["icon"], LucideIcon>([
  ["speed", Zap],
  ["players", Users],
  ["skill", Shield],
  ["ranking", Globe],
]);

export function ArenaIdentity({
  presentation,
  minParticipants,
  maxParticipants,
}: Props) {
  const { title, subtitle } = splitGameTitle(presentation.gameName);
  const features = heroFeatures(
    presentation.maxDurationSeconds,
    presentation.family,
    minParticipants,
    maxParticipants,
  );

  return (
    /*
      THE THIRD COLUMN IS DELIBERATELY EMPTY. It exists so the copy stops before the artwork
      rather than running underneath it - the banner's picture is a background that bleeds to
      the right edge, and the alternative to reserving space for it is text sitting on top of
      a trophy. It only appears at `xl`: below that there is not enough width for both, so the
      scrim covers the art and the copy takes the whole banner.
    */
    <div className="grid h-full items-center gap-3 grid-cols-[56px_minmax(0,1fr)] sm:gap-4 sm:grid-cols-[132px_minmax(0,1fr)] xl:grid-cols-[132px_minmax(0,1fr)_330px]">
      <GameLogo url={presentation.logoUrl} name={presentation.gameName} />

      <div className="flex min-w-0 items-center gap-6">
        <div className="min-w-0 flex-1">
          {/*
            The genre, phrased as what the player is in rather than as a bare tag. The
            reference reads "PUZZLE COMPETITION"; a title with no genre set still needs the
            second word, because the badge's job is to say what kind of page this is.
          */}
          <span className="inline-block rounded border border-violet-500/40 bg-violet-500/10 px-1.5 py-px text-[8px] font-bold uppercase tracking-[0.18em] text-violet-300">
            {presentation.category
              ? `${presentation.category} competition`
              : "Competition"}
          </span>

          {/*
            `truncate` on both lines rather than wrapping. At this height a wrapped heading
            would push the lines below it out of the banner, where `overflow-hidden` would
            hide them with nothing on screen to say so - and the full name is on the logo's
            alt text and on the lobby.
          */}
          <h1 className="mt-0.5 truncate text-[19px] font-bold uppercase italic leading-tight tracking-wide text-white sm:text-[22px]">
            {title}
          </h1>

          {subtitle && (
            <p className="truncate text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-300 sm:text-[11px]">
              {subtitle}
            </p>
          )}

          {presentation.tagline && (
            <p className="mt-0.5 truncate text-[10px] font-semibold text-sky-300 sm:text-[11px]">
              {presentation.tagline}
            </p>
          )}

          {presentation.description && (
            <p className="mt-0.5 line-clamp-1 text-[9px] leading-snug text-gray-400 sm:text-[10px]">
              {presentation.description}
            </p>
          )}
        </div>

        {/*
          BESIDE THE COPY, NOT BENEATH IT, which is the difference between a banner and a
          section. Hidden below `lg` because four labels and a heading do not fit one row at
          tablet width, and dropping them is better than wrapping them under the title - that
          is precisely how this hero grew the first time.
        */}
        <div className="hidden shrink-0 items-start gap-4 lg:flex">
          {features.map((feature) => {
            const Icon = FEATURE_ICONS.get(feature.icon);
            return (
              <div
                key={feature.label}
                className="flex w-[68px] flex-col items-center gap-1 text-center"
              >
                {Icon && <Icon className="h-4 w-4 text-sky-300" />}
                {/*
                  8px, and NOT the kit's `NEON_LABEL`, which is 11 with wide tracking. At that
                  size "Global leaderboard" is three lines in a 68px column, and the owner's
                  measurement for these labels is 7-9px. The kit token is right everywhere it
                  is used and wrong here, which is why this is a deviation rather than a
                  candidate for the kit.
                */}
                <span className="text-[8px] font-bold uppercase leading-tight tracking-wider text-gray-300">
                  {feature.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/**
 * The title's artwork, or a monogram when there is none.
 *
 * `object-contain`, NOT THE `cover` IT USED TO BE. The slot is landscape now - as wide as the
 * reference's and only as tall as the banner - and a square logo cropped to a landscape box
 * loses its top and bottom, which for a logo means the part that identifies it.
 *
 * A plain `<img>` rather than `next/image`: the URL is served by an API route with a database
 * fallback, which is what makes an uploaded image reachable from BOTH web servers, and the
 * image optimiser cannot resolve it on the server where the file exists only in the database.
 */
function GameLogo({ url, name }: { url?: string; name: string }) {
  const accent = accentClasses("score");

  if (!url) {
    return (
      <div
        className={`flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-xl border text-xl font-bold sm:h-[86px] sm:w-[86px] sm:text-3xl ${accent.tile}`}
        aria-hidden
      >
        {name.slice(0, 1).toUpperCase()}
      </div>
    );
  }

  return (
    <div className="flex h-[52px] w-[56px] shrink-0 items-center justify-center overflow-hidden sm:h-[92px] sm:w-[132px]">
      {/* eslint-disable-next-line @next/next/no-img-element -- see the note above */}
      <img
        src={url}
        alt={name}
        className="h-full w-auto max-w-full object-contain"
      />
    </div>
  );
}
