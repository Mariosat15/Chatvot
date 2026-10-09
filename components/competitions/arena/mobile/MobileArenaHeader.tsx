"use client";

import Image from "next/image";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  COMPETITION_ICON,
  type GameDefinition,
} from "@/lib/competitions/game-definitions";
import { formatVolts } from "@/lib/utils/format-volts";
import { splitArenaTitle } from "../ArenaHeader";

type Tone = "cyan" | "gold";

const CYAN = {
  border: "rgba(60,190,255,.55)",
  label: "text-cyan-300",
  glow: "rgba(0,170,255,.18)",
};
const GOLD = {
  border: "rgba(255,196,60,.55)",
  label: "text-amber-300",
  glow: "rgba(255,180,40,.16)",
};

/**
 * Phone utility tile: small icon on the left, a short label above the value.
 *
 * Reason: the desktop utility card is laid out for ~200px; at a third of a
 * phone its label and value were cut to "SERVE…" / "966.…". This tile is
 * sized for ~110px and lets the value wrap instead of truncating.
 */
function UtilityTile({
  tone,
  icon,
  label,
  value,
  subvalue,
  trailing,
}: {
  tone: Tone;
  icon: string;
  label: string;
  value: string;
  subvalue?: string;
  trailing?: boolean;
}) {
  const t = tone === "cyan" ? CYAN : GOLD;
  return (
    <div
      className="flex h-full min-h-[58px] items-center gap-1.5 rounded-xl border bg-black/45 px-2 py-1.5"
      style={{ borderColor: t.border, boxShadow: `inset 0 0 14px ${t.glow}` }}
    >
      <Image
        src={icon}
        alt=""
        width={26}
        height={26}
        className="h-[26px] w-[26px] shrink-0 object-contain"
      />
      <div className="min-w-0 flex-1">
        <p
          className={`text-[8.5px] font-black uppercase leading-tight tracking-wide ${t.label}`}
        >
          {label}
        </p>
        <p className="flex items-center gap-0.5 break-words text-[12.5px] font-black leading-tight text-white tabular-nums">
          {value}
          {trailing ? <ChevronRight className="h-3 w-3 shrink-0" aria-hidden /> : null}
        </p>
        {subvalue ? (
          <p className="text-[9px] leading-tight text-white/55">{subvalue}</p>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Phone header from the Mobile UI Guide: back button, "Competition Arena"
 * (same split and accent as desktop, normal case so it fits), a short
 * subtitle, then Server Time / Your Volts / Add Volts.
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
    <section className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <Link
          href="/dashboard"
          aria-label="Back"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-cyan-400/35 bg-black/45 text-cyan-200"
        >
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="text-[21px] font-black capitalize leading-tight text-white">
            {lead.toLowerCase()}{" "}
            {accent ? (
              <span className="capitalize" style={{ color: game.accent }}>
                {accent.toLowerCase()}
              </span>
            ) : null}
          </h1>
          <p className="mt-0.5 text-[12px] leading-snug text-white/65">
            {game.subtitle}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <UtilityTile
          tone="cyan"
          icon={COMPETITION_ICON.clock}
          label="Server Time"
          value={serverTime}
          subvalue={serverDate}
        />
        <UtilityTile
          tone="gold"
          icon={COMPETITION_ICON.bolt}
          label="Your Volts"
          value={formatVolts(balance, { bare: true })}
        />
        <Link href="/wallet" className="block" aria-label={`Add ${creditSymbol ?? "Volts"}`}>
          <UtilityTile
            tone="gold"
            icon={COMPETITION_ICON.topup}
            label="Add Volts"
            value="Top Up"
            trailing
          />
        </Link>
      </div>
    </section>
  );
}
