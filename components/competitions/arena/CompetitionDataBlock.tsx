import { describeCompetitionMode } from "@/lib/competitions/competition-mode-copy";
import type { CompetitionMetric } from "@/lib/competitions/types";
import { CompetitionDataShell } from "./CompetitionDataShell";
import { CompetitionInfoDataBlock } from "./CompetitionInfoDataBlock";

/**
 * One boxed stat on a competition card; Mode is explanatory because its
 * meaning changes how and when a player may play.
 */
export function CompetitionDataBlock({
  metric,
  accent,
}: {
  metric: CompetitionMetric;
  accent: string;
}) {
  if (metric.key === "mode") {
    return (
      <CompetitionInfoDataBlock
        icon={metric.icon}
        label={metric.label}
        value={metric.value}
        explanation={describeCompetitionMode(metric.value)}
        accent={accent}
      />
    );
  }

  return (
    <CompetitionDataShell
      icon={metric.icon}
      label={metric.label}
      value={metric.value}
      subvalue={metric.subvalue}
      accent={accent}
      emphasize={metric.emphasize}
    />
  );
}
