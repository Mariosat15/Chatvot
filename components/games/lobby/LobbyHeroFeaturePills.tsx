import { resolveFeatureLucideIcon } from "@/components/games/resolve-feature-icon";

/**
 * Vertical feature pills on the game lobby hero (Fast Rounds / Beat the Clock / …).
 *
 * Fed from catalogue `heroFeatures` — never hard-coded per title. Empty list
 * renders nothing so a title with no authored features stays clean.
 */

export function LobbyHeroFeaturePills({
  features,
}: {
  features: { icon?: string; label: string }[];
}) {
  if (!features.length) return null;

  return (
    <ul className="flex flex-row flex-wrap gap-2 sm:flex-col sm:items-stretch sm:gap-2.5">
      {features.slice(0, 4).map((feature, index) => {
        const Icon = resolveFeatureLucideIcon(feature.icon, index);
        return (
          <li
            key={`${feature.label}-${index}`}
            className="inline-flex items-center gap-2 rounded-full border border-cyan-400/45 bg-[#061428]/85 px-3 py-2 shadow-[0_0_16px_rgba(34,211,238,0.18)] backdrop-blur-sm"
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-cyan-300/40 bg-cyan-400/15 text-cyan-200">
              <Icon className="h-3.5 w-3.5" aria-hidden />
            </span>
            <span className="text-[11px] font-bold uppercase tracking-wide text-cyan-50">
              {feature.label}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
