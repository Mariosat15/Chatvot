import {
  ChartNoAxesCombined,
  Sparkles,
  Trophy,
  Users,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { NeonIllustration, NeonPanel } from "@/components/neon/Cards";
import {
  contestAboutFallback,
  contestFeatures,
  contestOverviewTitle,
  type ContestLobbyKind,
} from "@/components/competitions/lobby/contest-lobby-copy";

/**
 * Large Overview card — description + key features + optional artwork.
 * Kind-scoped features only; never a game-code switch.
 */

const FEATURE_ICONS = new Map<string, LucideIcon>([
  ["Live standings", ChartNoAxesCombined],
  ["Skill wins", Users],
  ["Fair prizes", Trophy],
  ["Same rules for all", Zap],
  ["Live markets", ChartNoAxesCombined],
  ["Global rivals", Users],
  ["Climb for glory", Trophy],
  ["Prize drops", Zap],
]);

export function ContestOverviewPanel({
  kind,
  description,
  imageUrl,
  imageAlt,
}: {
  kind: ContestLobbyKind;
  description?: string | null;
  imageUrl?: string | null;
  imageAlt?: string | null;
}) {
  const about =
    typeof description === "string" && description.trim()
      ? description.trim()
      : contestAboutFallback(kind);
  const features = contestFeatures(kind);

  return (
    <NeonPanel
      icon={Sparkles}
      accent="players"
      title={contestOverviewTitle(kind)}
      size="lg"
    >
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.2fr_0.8fr] lg:items-start">
        <div className="min-w-0 space-y-5">
          <p className="text-base leading-relaxed text-gray-200 sm:text-[17px]">
            {about}
          </p>
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-sky-300">
              Key features
            </p>
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {features.map((feature) => {
                const Icon = FEATURE_ICONS.get(feature.title) ?? Sparkles;
                return (
                  <li
                    key={feature.title}
                    className="flex items-start gap-3 rounded-xl border border-[#1B2540] bg-[#080C18]/50 px-3.5 py-3"
                  >
                    <Icon className="mt-0.5 h-5 w-5 shrink-0 text-sky-300" />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-100">
                        {feature.title}
                      </p>
                      <p className="mt-0.5 text-sm leading-snug text-gray-400">
                        {feature.detail}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
        <div className="mx-auto w-full max-w-[200px] shrink-0 lg:mx-0 lg:justify-self-end">
          <NeonIllustration
            src={imageUrl || undefined}
            alt={imageAlt || "Competition"}
            icon={kind === "trading" ? ChartNoAxesCombined : Trophy}
            accent="prize"
            shape="square"
            fit="contain"
          />
        </div>
      </div>
    </NeonPanel>
  );
}
