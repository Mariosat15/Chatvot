import {
  Circle,
  Clock,
  Globe,
  Shield,
  Sparkles,
  Target,
  Trophy,
  Users,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { accentClasses } from "@/components/neon/tokens";
import type { GamePresentation } from "@/lib/services/games/game-presentation.service";
import type { HeroFeatureIcon } from "@/lib/services/games/hero-features";
import { resolveHeroFeatures, splitGameTitle } from "./arena-facts";

/**
 * Who the game is: artwork, name, genre, tagline, two lines of description and four facts -
 * all of it inside one thin horizontal banner.
 *
 * NOTHING HERE IS PER-TITLE CODE. Every word comes from the catalogue row an operator edits,
 * and every feature is either written by that operator or derived in `arena-facts.ts` from a
 * DECLARED field. That is the whole mechanism behind "a new game needs no additional coding":
 * the screen renders content, not cases. A `switch` on game code here would satisfy every
 * existing test and quietly make the claim false for the next title.
 *
 * AN ABSENT VALUE RENDERS NOTHING, never a placeholder. A game with no tagline shows no
 * tagline line; one with no logo shows the monogram below. A grey box captioned "no image"
 * is worse than a clean heading, and an operator who has not written copy yet should see a
 * screen that looks deliberately spare rather than broken.
 *
 * ----------------------------------------------------------------------------------------
 * REBUILT 11 SEPTEMBER 2026 on the owner's hero reference, then WIDENED the same day on his
 * reply to it: "the icons and info needs to be bigger and also the game logo bigger and also
 * the info of the game must show - you may need to make the banner bigger".
 *
 * THE HEIGHT IS STILL FIXED, AND THAT MECHANISM IS THE PART THAT MATTERS. It moved from 118
 * to 150 because a taller strip was asked for; it did not become a `min-height`. The previous
 * version before these two set a floor of 220 and let its content decide, which is how a
 * banner reaches 400: a badge, a wrapped heading, a three-line description, the contest's
 * name and three bordered cards, each individually reasonable. A number that content may
 * exceed is not a measurement. So 150 is ARRIVED AT rather than chosen - it is what the six
 * lines below need at the sizes the owner asked for, plus the logo at 120 - and everything
 * inside is still clamped, so nothing added here can push the board down.
 *
 * THE DESCRIPTION IS TWO LINES, up from one. That was the owner's third point and it is why
 * the height moved at all: the field is 2,000 characters and one line cut the live title's
 * copy mid-sentence, which reads as a rendering fault rather than as a summary.
 *
 * THE FEATURES ARE ICON-AND-LABEL WITH NO BOX, and that has not changed. Boxes are what made
 * them read as a second section rather than as part of the banner, and boxes need padding,
 * which is height. They are simply drawn larger.
 *
 * THE STRIP IS OPERATOR-EDITABLE SINCE THE SAME REPLY. An authored list replaces all four;
 * an empty one restores the derived four. `resolveHeroFeatures` is the only place that
 * decision is taken - see the note there, because the empty case is the normal one.
 *
 * THE CONTEST'S OWN NAME IS NOT HERE, and that is a removal rather than an omission. It was a
 * line of copy repeating what the "Back to ..." link directly above this banner already says.
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
 * A `Map` keyed by the slug the vocabulary declares, rather than object indexing: the key now
 * comes from a stored document, and object lookup walks the prototype chain, so `"__proto__"`
 * returns something truthy that survives a null check and fails later somewhere unrelated.
 *
 * EVERY SLUG IN `HERO_FEATURE_ICONS` MUST HAVE AN ENTRY, and a test asserts it. A vocabulary
 * offering a glyph this map does not carry is a picker that appears to work and puts a
 * neutral mark on a live banner - the same shape as enabling a provider with no adapter.
 */
const FEATURE_ICONS = new Map<HeroFeatureIcon, LucideIcon>([
  ["speed", Zap],
  ["clock", Clock],
  ["players", Users],
  ["skill", Shield],
  ["ranking", Globe],
  ["reward", Trophy],
  ["target", Target],
  ["spark", Sparkles],
]);

/**
 * What an unrecognised slug draws.
 *
 * A mark rather than nothing: the four columns are the same width, so an empty picture slot
 * leaves one label sitting lower than the three beside it, which reads as a broken row rather
 * than as an unknown icon.
 */
const NEUTRAL_ICON: LucideIcon = Circle;

export function ArenaIdentity({
  presentation,
  minParticipants,
  maxParticipants,
}: Props) {
  const { title, subtitle } = splitGameTitle(presentation.gameName);
  const features = resolveHeroFeatures(
    presentation.heroFeatures,
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
    <div className="grid h-full items-center gap-3 grid-cols-[64px_minmax(0,1fr)] sm:gap-5 sm:grid-cols-[168px_minmax(0,1fr)] xl:grid-cols-[168px_minmax(0,1fr)_330px]">
      <GameLogo url={presentation.logoUrl} name={presentation.gameName} />

      <div className="flex min-w-0 items-center gap-6">
        <div className="min-w-0 flex-1">
          {/*
            The genre, phrased as what the player is in rather than as a bare tag. The
            reference reads "PUZZLE COMPETITION"; a title with no genre set still needs the
            second word, because the badge's job is to say what kind of page this is.
          */}
          <span className="inline-block rounded border border-violet-500/40 bg-violet-500/10 px-1.5 py-px text-[9px] font-bold uppercase tracking-[0.18em] text-violet-300">
            {presentation.category
              ? `${presentation.category} competition`
              : "Competition"}
          </span>

          {/*
            `truncate` on the three single-line fields rather than wrapping. A wrapped heading
            would push the lines below it out of the banner, where `overflow-hidden` would
            hide them with nothing on screen to say so - and the full name is on the logo's
            alt text and on the lobby.
          */}
          <h1 className="mt-0.5 truncate text-[21px] font-bold uppercase italic leading-tight tracking-wide text-white sm:text-[25px]">
            {title}
          </h1>

          {subtitle && (
            <p className="truncate text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-300 sm:text-[12px]">
              {subtitle}
            </p>
          )}

          {presentation.tagline && (
            <p className="mt-0.5 truncate text-[11px] font-semibold text-sky-300 sm:text-[12px]">
              {presentation.tagline}
            </p>
          )}

          {/*
            TWO LINES, AND THE CLAMP IS WHAT KEEPS THE HEIGHT A MEASUREMENT. The operator
            field is 2,000 characters; unclamped it would fill the banner and then overflow it
            invisibly. Two is what the 150px budget affords beside the five lines above.
          */}
          {presentation.description && (
            <p className="mt-0.5 line-clamp-2 text-[10px] leading-snug text-gray-400 sm:text-[11px]">
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
        <div className="hidden shrink-0 items-start gap-5 lg:flex">
          {features.map((feature) => {
            const Icon = feature.icon
              ? FEATURE_ICONS.get(feature.icon) ?? NEUTRAL_ICON
              : NEUTRAL_ICON;
            return (
              <div
                key={feature.label}
                className="flex w-[92px] flex-col items-center gap-1.5 text-center"
              >
                <Icon className="h-6 w-6 text-sky-300" />
                {/*
                  10px, and NOT the kit's `NEON_LABEL`, which is 11 with wide tracking. The
                  wide tracking is the problem rather than the size: at that spacing "Global
                  leaderboard" needs three lines in a column this width, and a third line does
                  not fit the budget. The kit token is right everywhere it is used and wrong
                  here, which is why this is a deviation rather than a candidate for the kit.
                */}
                <span className="text-[10px] font-bold uppercase leading-tight tracking-wide text-gray-200">
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
 * `object-contain`, NOT `cover`. The slot is landscape - as wide as the reference's and only
 * as tall as the banner - and a square logo cropped to a landscape box loses its top and
 * bottom, which for a logo means the part that identifies it.
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
        className={`flex h-[60px] w-[60px] shrink-0 items-center justify-center rounded-xl border text-2xl font-bold sm:h-[112px] sm:w-[112px] sm:text-4xl ${accent.tile}`}
        aria-hidden
      >
        {name.slice(0, 1).toUpperCase()}
      </div>
    );
  }

  return (
    <div className="flex h-[60px] w-[64px] shrink-0 items-center justify-center overflow-hidden sm:h-[120px] sm:w-[168px]">
      {/* eslint-disable-next-line @next/next/no-img-element -- see the note above */}
      <img
        src={url}
        alt={name}
        className="h-full w-auto max-w-full object-contain"
      />
    </div>
  );
}
