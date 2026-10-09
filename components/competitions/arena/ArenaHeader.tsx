"use client";

import Image from "next/image";
import Link from "next/link";
import { COMPETITION_ICON } from "@/lib/competitions/game-definitions";
import type { GameDefinition } from "@/lib/competitions/game-definitions";
import { formatVolts } from "@/lib/utils/format-volts";
import { ArenaUtilityCard } from "./ArenaUtilityCard";

/** Shared with the phone header so the arena title cannot drift between layouts. */
export function splitArenaTitle(title: string): { lead: string; accent: string } {
  const parts = title.trim().split(/\s+/);
  if (parts.length < 2) return { lead: title, accent: "" };
  return {
    lead: parts.slice(0, -1).join(" "),
    accent: parts[parts.length - 1] || "",
  };
}

export function ArenaHeader({
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
      className="rounded-[18px] border p-4 sm:p-5"
      style={{
        background:
          "linear-gradient(180deg, rgba(7,22,55,.88), rgba(3,11,29,.94))",
        borderColor: "rgba(50,180,255,.45)",
        boxShadow: "0 0 20px rgba(0,160,255,.12)",
      }}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-center gap-3 sm:gap-4">
          <div
            className="relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl border sm:h-[72px] sm:w-[72px]"
            style={{
              borderColor: `${game.accent}88`,
              boxShadow: `0 0 18px ${game.theme.glow}`,
            }}
          >
            <Image
              src={game.icon}
              alt=""
              fill
              className="object-contain p-1.5"
              sizes="72px"
            />
          </div>
          <div className="min-w-0">
            <h1 className="text-[28px] font-black uppercase leading-none tracking-tight text-white sm:text-[34px]">
              {lead}{" "}
              {accent ? (
                <span style={{ color: game.accent }}>{accent}</span>
              ) : null}
            </h1>
            <p className="mt-2 text-sm text-white/65 sm:text-[15px]">
              {game.subtitle}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-3 lg:min-w-[520px]">
          <ArenaUtilityCard
            tone="cyan"
            icon={COMPETITION_ICON.clock}
            label="Server Time"
            value={serverTime}
            subvalue={serverDate}
          />
          <ArenaUtilityCard
            tone="gold"
            icon={COMPETITION_ICON.bolt}
            label="Your Balance"
            value={formatVolts(balance, { symbol: creditSymbol })}
          />
          <Link href="/wallet" className="block">
            <ArenaUtilityCard
              tone="gold"
              icon={COMPETITION_ICON.topup}
              label="Top Up"
              value="Add Volts →"
              interactive
            />
          </Link>
        </div>
      </div>
    </section>
  );
}
