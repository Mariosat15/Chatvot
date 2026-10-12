import { Flag, Gamepad2, TrendingUp, Trophy, UserPlus } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { NeonPanel } from "@/components/neon/Cards";
import {
  contestHowItWorks,
  contestHowTitle,
  type ContestLobbyKind,
} from "@/components/competitions/lobby/contest-lobby-copy";

/**
 * The four-step "how it works" strip both lobbies share.
 *
 * Kind picks the wording; the chrome stays identical so a player with a trading
 * contest and a game contest open side by side still reads one product.
 *
 * Wording lives in `contest-lobby-copy.ts`. Icons are keyed by step title in a
 * Map so a loop never indexes an icon array (eslint object-injection).
 */

const STEP_ICONS = new Map<string, LucideIcon>([
  ["Jump in", UserPlus],
  ["Play your round", Gamepad2],
  ["Climb the board", TrendingUp],
  ["Trade live", TrendingUp],
  ["Climb the ranks", Flag],
  ["Take the pot", Trophy],
]);

export function ContestHowItWorks({ kind }: { kind: ContestLobbyKind }) {
  const steps = contestHowItWorks(kind);

  return (
    <NeonPanel icon={Flag} accent="score" title={contestHowTitle(kind)}>
      <ol className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map((step, index) => {
          const Icon = STEP_ICONS.get(step.title) ?? Flag;
          return (
            <li
              key={step.title}
              className="relative flex gap-3 rounded-xl border border-[#1B2540]/80 bg-[#080C18]/50 p-3"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-violet-500/40 bg-violet-500/15 text-sm font-bold text-violet-200">
                {index + 1}
              </span>
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 text-sm font-semibold text-gray-100">
                  <Icon className="h-3.5 w-3.5 shrink-0 text-sky-300" />
                  {step.title}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-gray-400">
                  {step.detail}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </NeonPanel>
  );
}
