import { CandlestickChart } from "lucide-react";
import { NeonHero, NeonStatusBadge } from "@/components/neon/Hero";
import { resolveTradingBanner } from "@/components/neon/banners";

/**
 * Trading competition-detail hero only.
 *
 * Summary KPI cards sit BELOW the hero in `CompetitionDetailShell` (spec §8–15).
 * Putting them inside NeonHero was the thin-row layout the owner rejected.
 */

export interface TradingLobbyHeroProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  competition: any;
  /**
   * Optional banner from Games & Trading page settings (`GamePageContent.bannerUrl`).
   * Absent → neon trading fallback.
   */
  bannerUrl?: string | null;
  isCancelled: boolean;
}

export default function TradingLobbyHero({
  competition,
  bannerUrl,
  isCancelled,
}: TradingLobbyHeroProps) {
  return (
    <NeonHero
      banner={resolveTradingBanner(bannerUrl)}
      badge={{ icon: CandlestickChart, label: "Trading" }}
      title={competition.name}
      subtitle={competition.description}
      status={
        <>
          <NeonStatusBadge status={String(competition.status ?? "")} />
          {isCancelled && competition.cancellationReason && (
            <p className="w-full rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
              <strong className="font-semibold">Reason:</strong>{" "}
              {competition.cancellationReason}
            </p>
          )}
        </>
      }
    />
  );
}
