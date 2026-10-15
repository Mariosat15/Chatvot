import { Clock, LifeBuoy } from "lucide-react";
import { NeonPill } from "@/components/neon/Buttons";
import { NeonPanel } from "@/components/neon/Cards";
import { NEON_PANEL } from "@/components/neon/tokens";

/** The help strip at the foot of a game lobby. */
export function LobbyHelpFooter() {
  return (
    <div
      className={`${NEON_PANEL} flex flex-wrap items-center justify-between gap-3 px-4 py-3`}
    >
      <div className="flex items-center gap-2.5">
        <LifeBuoy className="h-4 w-4 text-sky-300" />
        <p className="text-sm text-gray-400">
          Need help? Read how competitions work, or contact support.
        </p>
      </div>
      <NeonPill href="/help/competitions" icon={LifeBuoy} label="Help centre" />
    </div>
  );
}

/** Holds the tips slot on desktop until the catalogue carries tips for the title. */
export function LobbyTipsPlaceholder() {
  return (
    <NeonPanel icon={Clock} accent="waiting" title="Game tips" size="lg">
      <p className="text-sm text-gray-400">
        Tips for this game appear here once they are written in the catalogue.
      </p>
    </NeonPanel>
  );
}
