"use client";

import Image from "next/image";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import {
  COMPETITION_ICON,
  type GameDefinition,
} from "@/lib/competitions/game-definitions";
import { formatVolts } from "@/lib/utils/format-volts";
import { splitArenaTitle } from "../ArenaHeader";
import { ArenaUtilityCard } from "../ArenaUtilityCard";

/**
 * Phone header from the Mobile UI Guide: back button, the arena title (same
 * split and accent as desktop), subtitle, then Server Time / Balance / Add
 * Volts in one row.
 */
export function MobileArenaHeader({
  game,
  balance,
  creditSymbol,
  serverTime,
  serverDate,
}: {
  game: GameDefinition;
  balance: number;
  creditSymbol?: string;
  serverTime: string;
  serverDate: string;
}) {
  const { lead, accent } = splitArenaTitle(game.arenaTitle);

  return (
    <section
      className="rounded-2xl border p-3"
      style={{
        background:
          "linear-gradient(180deg, rgba(7,22,55,.88), rgba(3,11,29,.94))",
        borderColor: "rgba(50,180,255,.45)",
        boxShadow: "0 0 20px rgba(0,160,255,.12)",
      }}
    >
      <div className="flex items-center gap-3">
        <Link
          href="/dashboard"
          aria-label="Back"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-cyan-400/35 bg-black/40 text-cyan-200"
        >
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <div
          className="relative h-11 w-11 shrink-0 overflow-hidden rounded-xl border"
          style={{
            borderColor: `${game.accent}88`,
            boxShadow: `0 0 14px ${game.theme.glow}`,
          }}
        >
          <Image
            src={game.icon}
            alt=""
            fill
            className="object-contain p-1"
            sizes="44px"
          />
        </div>
        <div className="min-w-0">
          <h1 className="truncate text-[22px] font-black uppercase leading-none tracking-tight text-white">
            {lead}{" "}
            {accent ? <span style={{ color: game.accent }}>{accent}</span> : null}
          </h1>
          <p className="mt-1 line-clamp-2 text-[12px] leading-snug text-white/65">
            {game.subtitle}
          </p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <ArenaUtilityCard
          compact
          tone="cyan"
          icon={COMPETITION_ICON.clock}
          label="Server Time"
          value={serverTime}
          subvalue={serverDate}
        />
        <ArenaUtilityCard
          compact
          tone="gold"
          icon={COMPETITION_ICON.bolt}
          label="Your Balance"
          value={formatVolts(balance, { symbol: creditSymbol })}
        />
        <Link href="/wallet" className="block">
          <ArenaUtilityCard
            compact
            interactive
            tone="gold"
            icon={COMPETITION_ICON.topup}
            label="Top Up"
            value="Add Volts"
          />
        </Link>
      </div>
    </section>
  );
}
