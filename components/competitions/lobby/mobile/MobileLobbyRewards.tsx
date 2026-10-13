import PrizeTable from "@/components/competitions/PrizeTable";
import { NeonPanel } from "@/components/neon/Cards";
import { NEON_ICON } from "@/lib/services/games/overview-assets";

/**
 * Who wins what — full width, shared PrizeTable (Complobyymobile §13).
 */

export function MobileLobbyRewards({
  competition,
  creditSymbol,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  competition: any;
  creditSymbol?: string;
}) {
  return (
    <NeonPanel
      iconSrc={NEON_ICON("trophy-green")}
      accent="prize"
      title="Who wins what"
      size="lg"
      action={
        competition.platformFeePercentage > 0 ? (
          <span className="rounded-full border border-sky-400/40 bg-sky-500/10 px-2 py-0.5 text-[11px] font-bold text-sky-300">
            Fee {competition.platformFeePercentage}%
          </span>
        ) : undefined
      }
    >
      <PrizeTable competition={competition} creditSymbol={creditSymbol} />
    </NeonPanel>
  );
}
