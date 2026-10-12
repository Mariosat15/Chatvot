import { Info } from "lucide-react";
import { NeonPanel, NeonRow } from "@/components/neon/Cards";

/**
 * Game sidebar “Event details” — only rows with a real value.
 * Never forces empty labels; never switches on a game code.
 */

export function GameEventDetails({
  rows,
}: {
  rows: Array<{ label: string; value: string }>;
}) {
  const visible = rows.filter(
    (row) => typeof row.value === "string" && row.value.trim().length > 0,
  );
  if (visible.length === 0) return null;

  return (
    <NeonPanel icon={Info} accent="players" title="Event details" size="lg">
      <div className="space-y-2.5">
        {visible.map((row) => (
          <NeonRow key={row.label} label={row.label} value={row.value} />
        ))}
      </div>
    </NeonPanel>
  );
}
