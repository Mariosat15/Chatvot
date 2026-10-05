"use client";

import Image from "next/image";
import Link from "next/link";
import { MOBILE_OVERVIEW_ART } from "@/lib/services/games/overview-assets";
import MobileSection, { MOBILE_CARD } from "./MobileSection";

interface Tile {
  label: string;
  href: string;
  art: string;
  tone: string;
}

/**
 * Reason: `/wallet` takes no deposit/withdraw deep-link parameter, so both
 * actions open the wallet. Inventing `?action=` would be a link that silently
 * lands on the same screen while promising a different one.
 */
const QUICK_ACTIONS: Tile[] = [
  {
    label: "Deposit",
    href: "/wallet",
    art: MOBILE_OVERVIEW_ART.deposit,
    tone: "border-emerald-400/55 text-emerald-200",
  },
  {
    label: "Withdraw",
    href: "/wallet",
    art: MOBILE_OVERVIEW_ART.withdraw,
    tone: "border-violet-400/55 text-violet-200",
  },
  {
    label: "Compete",
    href: "/competitions",
    art: MOBILE_OVERVIEW_ART.compete,
    tone: "border-amber-400/55 text-amber-200",
  },
  {
    label: "Play",
    href: "/games",
    art: MOBILE_OVERVIEW_ART.play,
    tone: "border-cyan-400/55 text-cyan-200",
  },
];

/** Fixed box so every neon plate renders at the same crisp size. */
const ICON_BOX = "relative h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-transparent";

function TileLink({ tile, height }: { tile: Tile; height: string }) {
  return (
    <Link
      href={tile.href}
      className={`${MOBILE_CARD} ${tile.tone} ${height} flex flex-col items-center justify-center gap-1.5 px-1 active:scale-95 transition-transform`}
    >
      <span className={ICON_BOX}>
        <Image
          src={tile.art}
          alt=""
          fill
          sizes="40px"
          // Reason: contain + no scale-up softens JPG plates; screen knocks black canvas.
          className="object-contain object-center"
        />
      </span>
      <span className="text-center text-[11px] font-semibold leading-tight">
        {tile.label}
      </span>
    </Link>
  );
}

/** Deposit / Withdraw / Compete / Play — four large thumb targets (spec s8). */
export function MobileQuickActions() {
  return (
    <div className="grid grid-cols-4 gap-2.5">
      {QUICK_ACTIONS.map((t) => (
        <TileLink key={t.label} tile={t} height="min-h-[76px]" />
      ))}
    </div>
  );
}

/**
 * Quick Access 2x2. Reason: owner, 3 Oct 2026 — dashboard destinations that
 * phones otherwise bury behind the tab strip. Marketplace stays; competitions /
 * profile / 1v1 already have other entry points.
 */
const QUICK_ACCESS: Tile[] = [
  {
    label: "Wallet Analytics",
    href: "/dashboard?tab=wallet",
    art: MOBILE_OVERVIEW_ART.walletChart,
    tone: "border-cyan-400/45 text-cyan-100",
  },
  {
    label: "Performance",
    href: "/dashboard?tab=performance",
    art: MOBILE_OVERVIEW_ART.performance,
    tone: "border-violet-400/45 text-violet-100",
  },
  {
    label: "Tutorials",
    href: "/dashboard?tab=tutorials",
    art: MOBILE_OVERVIEW_ART.tutorials,
    tone: "border-orange-400/45 text-orange-100",
  },
  {
    label: "Marketplace",
    href: "/marketplace",
    art: MOBILE_OVERVIEW_ART.marketplace,
    tone: "border-amber-400/45 text-amber-100",
  },
];

export function MobileQuickAccess() {
  const tiles = QUICK_ACCESS;
  return (
    <MobileSection title="Quick access">
      <div className="grid grid-cols-2 gap-2.5">
        {tiles.map((t) => (
          <TileLink key={t.label} tile={t} height="min-h-[84px]" />
        ))}
      </div>
    </MobileSection>
  );
}
