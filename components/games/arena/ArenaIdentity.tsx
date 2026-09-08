import { Shield, Users, Swords, User } from "lucide-react";
import { NEON_LABEL, accentClasses } from "@/components/neon/tokens";
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
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
      <GameLogo url={presentation.logoUrl} name={presentation.gameName} />

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <h1 className="text-2xl font-bold uppercase tracking-wide text-white sm:text-3xl">
            {presentation.gameName}
          </h1>
          {presentation.category && (
            <span className="rounded border border-violet-500/40 bg-violet-500/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-violet-300">
              {presentation.category}
            </span>
          )}
        </div>

        {presentation.tagline && (
          <p className="mt-1 text-sm font-semibold text-sky-300">{presentation.tagline}</p>
        )}

        {/*
          The CONTEST's name, kept visually quieter than the game's. Both matter and they are
          different things - a player is in one contest of many on one game - and the previous
          version of this screen showed only the contest, which read as though the game had no
          identity of its own.
        */}
        <p className={`mt-2 ${NEON_LABEL}`}>Competition</p>
        <p className="truncate text-sm text-gray-300">{contestName}</p>

        {presentation.description && (
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-gray-400">
            {presentation.description}
          </p>
        )}

        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
          {chips.map(({ chip, icon: Icon }) => (
            <div key={chip.label} className="flex items-center gap-2">
              <Icon className="h-3.5 w-3.5 text-sky-400" />
              <div className="leading-tight">
                <div className="text-xs font-semibold text-gray-200">{chip.label}</div>
                <div className="text-[11px] text-gray-500">{chip.detail}</div>
              </div>
            </div>
          ))}
        </div>
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
        className={`flex h-20 w-20 shrink-0 items-center justify-center rounded-xl border text-2xl font-bold ${accent.tile}`}
        aria-hidden
      >
        {name.slice(0, 1).toUpperCase()}
      </div>
    );
  }

  return (
    <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-[#1B2540] bg-black/40">
      {/* eslint-disable-next-line @next/next/no-img-element -- see the note above */}
      <img src={url} alt={name} className="h-full w-full object-cover" />
    </div>
  );
}
