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
 * Overview + key features — the "what is this" block above the leaderboard.
 *
 * Description is the contest's own text when present; otherwise a playful
 * fallback that never invents rules. Features are kind-scoped only — never a
 * game-code switch. Wording lives in `contest-lobby-copy.ts`.
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
  /** Optional thumbnail — catalogue banner / how-to image when present. */
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
    >
      <div className="grid grid-cols-1 gap-5 md:grid-cols-[1fr_auto] md:items-start">
        <div className="min-w-0 space-y-4">
          <p className="text-sm leading-relaxed text-gray-300">{about}</p>
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-sky-300/90">
              Key vibes
            </p>
            <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {features.map((feature) => {
                const Icon = FEATURE_ICONS.get(feature.title) ?? Sparkles;
                return (
                  <li
                    key={feature.title}
                    className="flex items-start gap-2.5 rounded-lg border border-[#1B2540]/70 bg-[#080C18]/40 px-3 py-2"
                  >
                    <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sky-300" />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-gray-100">
                        {feature.title}
                      </p>
                      <p className="text-[11px] leading-snug text-gray-400">
                        {feature.detail}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
        <div className="mx-auto w-[112px] shrink-0 md:mx-0">
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
