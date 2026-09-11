import { Shield, Users, Swords, User } from "lucide-react";
import { NEON_LABEL, accentClasses } from "@/components/neon/tokens";
import { IconTile } from "@/components/neon/Cards";
import type { GamePresentation } from "@/lib/services/games/game-presentation.service";
import {
  SKILL_CHIP,
  interactionChip,
  playersChip,
  type ArenaChip,
} from "./arena-facts";

/**
 * Who the game is: artwork, name, genre, tagline, description and its declared shape.
 *
 * NOTHING HERE IS PER-TITLE CODE. Every word comes from the catalogue row an operator edits,
 * and every chip is derived in `arena-facts.ts` from a DECLARED field. That is the whole
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
 * REBUILT 11 SEPTEMBER 2026 on `design-reference/arena-target-full.png`, after the owner
 * described the screen as "very not professional". The previous version put the genre badge
 * on the same line as the heading, the contest name above the description, and the three
 * facts as small inline text at the bottom of a single column - so the header read as one
 * unbroken block of prose with the title lost inside it, which is exactly what a title as
 * long as "Circuit Sprint: Fast and Fun Spatial Puzzles" makes obvious.
 *
 * THREE THINGS ABOUT THE NEW SHAPE ARE DELIBERATE.
 *
 * The badge sits ABOVE the heading, on its own line. On the same line it competes with the
 * title for the eye and, once the title wraps, ends up floating beside a fragment of it.
 *
 * The description is CLAMPED to three lines. It is a 2,000-character operator field and the
 * reference gives it two lines; unclamped, a long one pushes the board below the fold on a
 * laptop, which is the one thing this whole layout exists to prevent. It is not truncated
 * data - the full text is on the lobby, which is where a player reads about a game before
 * paying, and this screen is for someone who has already decided.
 *
 * The facts are a COLUMN ON THE RIGHT at desktop width, matching the reference, and fall
 * back to a row beneath the copy on anything narrower. They are the same three chips from
 * the same helper; only their placement changed.
 * ----------------------------------------------------------------------------------------
 */

interface Props {
  presentation: GamePresentation;
  contestName: string;
  minParticipants?: number;
  maxParticipants?: number;
}

export function ArenaIdentity({
  presentation,
  contestName,
  minParticipants,
  maxParticipants,
}: Props) {
  const chips: { chip: ArenaChip; icon: typeof Users }[] = [];

  const interaction = interactionChip(presentation.family);
  if (interaction) {
    chips.push({
      chip: interaction,
      icon: presentation.family === "head_to_head" ? Swords : User,
    });
  }

  const players = playersChip(minParticipants, maxParticipants);
  if (players) chips.push({ chip: players, icon: Users });

  chips.push({ chip: SKILL_CHIP, icon: Shield });

  return (
    <div className="flex flex-col gap-5 lg:flex-row lg:items-center">
      <div className="flex min-w-0 flex-1 flex-col gap-4 sm:flex-row sm:items-start">
        <GameLogo url={presentation.logoUrl} name={presentation.gameName} />

        <div className="min-w-0 flex-1">
          {/*
            The genre, phrased as what the player is in rather than as a bare tag. The
            reference reads "PUZZLE COMPETITION"; a title with no genre set still needs the
            second word, because the badge's job is to say what kind of page this is.
          */}
          <span className="inline-block rounded border border-violet-500/40 bg-violet-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.16em] text-violet-300">
            {presentation.category
              ? `${presentation.category} competition`
              : "Competition"}
          </span>

          <h1 className="mt-2 text-2xl font-bold uppercase leading-tight tracking-wide text-white sm:text-3xl xl:text-4xl">
            {presentation.gameName}
          </h1>

          {presentation.tagline && (
            <p className="mt-1.5 text-sm font-semibold text-sky-300 sm:text-base">
              {presentation.tagline}
            </p>
          )}

          {presentation.description && (
            <p className="mt-2 line-clamp-3 max-w-2xl text-sm leading-relaxed text-gray-400">
              {presentation.description}
            </p>
          )}

          {/*
            The CONTEST's name, kept visually quieter than the game's. Both matter and they
            are different things - a player is in one contest of many on one game - and an
            early version of this screen showed only the contest, which read as though the
            game had no identity of its own.
          */}
          <div className="mt-3 flex items-baseline gap-2">
            <span className={NEON_LABEL}>Competition</span>
            <span className="truncate text-sm font-medium text-gray-300">
              {contestName}
            </span>
          </div>
        </div>
      </div>

      <div className="flex shrink-0 flex-wrap gap-x-6 gap-y-4 lg:w-56 lg:flex-col lg:gap-4">
        {chips.map(({ chip, icon: Icon }) => (
          <div key={chip.label} className="flex items-center gap-2.5">
            <IconTile icon={Icon} accent="players" size="sm" />
            <div className="min-w-0 leading-tight">
              <div className="text-xs font-semibold text-gray-100">
                {chip.label}
              </div>
              <div className="text-[11px] text-gray-500">{chip.detail}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * The square logo, or a monogram when there is none.
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
        className={`flex h-20 w-20 shrink-0 items-center justify-center rounded-xl border text-2xl font-bold sm:h-24 sm:w-24 sm:text-3xl ${accent.tile}`}
        aria-hidden
      >
        {name.slice(0, 1).toUpperCase()}
      </div>
    );
  }

  return (
    <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-[#1B2540] bg-black/40 sm:h-24 sm:w-24">
      {/* eslint-disable-next-line @next/next/no-img-element -- see the note above */}
      <img src={url} alt={name} className="h-full w-full object-cover" />
    </div>
  );
}
