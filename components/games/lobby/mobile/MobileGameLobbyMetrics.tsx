import { formatVolts } from "@/lib/utils/format-volts";
import { COMPETITION_ICON } from "@/lib/competitions/game-definitions";
import { DATA_ICON } from "@/lib/constants/data-icons";
import {
  LobbyLivePlayersValue,
  LobbyLivePrizePoolValue,
} from "@/components/games/LobbyLiveParts";
import { MobileIcon } from "@/components/competitions/lobby/mobile/MobileLobbyCard";

/**
 * Contest essentials 2×2 (guide §9): Prize pool, Entry fee, Players, Round time.
 * Countdown lives only in `MobileGameLobbyStatus` — one clock on the phone.
 */

type Tone = "gold" | "red" | "blue" | "purple";

const TONE_BOX = new Map<Tone, string>([
  ["gold", "border-amber-400/25 bg-amber-500/10"],
  ["red", "border-rose-400/25 bg-rose-500/10"],
  ["blue", "border-sky-400/25 bg-sky-500/10"],
  ["purple", "border-violet-400/25 bg-violet-500/10"],
]);

const TONE_VALUE = new Map<Tone, string>([
  ["gold", "text-amber-200"],
  ["red", "text-white"],
  ["blue", "text-white"],
  ["purple", "text-white"],
]);

export function MobileGameLobbyMetrics({
  prizePool,
  entryFee,
  currentParticipants,
  maxParticipants,
  roundTimeLabel,
  creditSymbol,
  funded = false,
}: {
  prizePool: number;
  entryFee: number;
  currentParticipants: number;
  maxParticipants: number;
  roundTimeLabel?: string | null;
  creditSymbol?: string;
  funded?: boolean;
}) {
  return (
    <div className="grid min-w-0 grid-cols-2 gap-3">
      <Tile
        tone="gold"
        iconSrc={DATA_ICON.prizePool}
        label="Prize pool"
        value={
          <LobbyLivePrizePoolValue
            initialPool={prizePool}
            creditSymbol={creditSymbol}
          />
        }
      />
      <Tile
        tone="red"
        iconSrc={COMPETITION_ICON.entryFee}
        label="Entry fee"
        value={
          funded ? "FREE" : formatVolts(entryFee, { symbol: creditSymbol })
        }
        sub={funded ? "GM pays your seat" : undefined}
      />
      <Tile
        tone="blue"
        iconSrc={COMPETITION_ICON.players}
        label="Players"
        value={
          <LobbyLivePlayersValue
            initialCurrent={currentParticipants}
            initialMax={maxParticipants}
          />
        }
      />
      <Tile
        tone="purple"
        iconSrc={COMPETITION_ICON.clock}
        label="Round time"
        value={roundTimeLabel?.trim() || "—"}
      />
    </div>
  );
}

function Tile({
  tone,
  iconSrc,
  label,
  value,
  sub,
}: {
  tone: Tone;
  iconSrc: string;
  label: string;
  value: React.ReactNode;
  sub?: string;
}) {
  return (
    <div className="flex min-h-[96px] min-w-0 flex-col rounded-2xl border border-white/[0.07] bg-[#0A1024]/90 p-3">
      <div className="flex items-center gap-2">
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${TONE_BOX.get(tone)}`}
        >
          <MobileIcon src={iconSrc} className="h-5 w-5" />
        </span>
        <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
          {label}
        </span>
      </div>
      <p
        className={`mt-2 break-words text-[18px] font-bold leading-tight ${TONE_VALUE.get(tone)}`}
      >
        {value}
      </p>
      {sub ? <p className="mt-0.5 text-[11px] text-gray-500">{sub}</p> : null}
    </div>
  );
}
