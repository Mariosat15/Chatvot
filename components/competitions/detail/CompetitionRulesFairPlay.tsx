import { Shield } from "lucide-react";
import { NeonPanel } from "@/components/neon/Cards";
import { NeonPill } from "@/components/neon/Buttons";

/**
 * Compact sidebar closer for both competition kinds.
 * Links to the real help surface — does not invent per-title rules text.
 */

export function CompetitionRulesFairPlay({
  href = "/help/competitions",
}: {
  href?: string;
}) {
  return (
    <NeonPanel icon={Shield} accent="players" title="Rules & fair play" size="lg">
      <p className="text-sm leading-relaxed text-gray-300">
        Play fair, follow the competition rules, and let skill decide the winner.
      </p>
      <div className="mt-4">
        <NeonPill href={href} icon={Shield} label="View rules" />
      </div>
    </NeonPanel>
  );
}
