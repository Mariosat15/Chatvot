import {
  ChartNoAxesColumn,
  Gift,
  Infinity as InfinityIcon,
  UserRound,
  type LucideIcon,
} from "lucide-react";

export type PracticeFeature = {
  label: string;
  shortLabel: string;
  tone: string;
  Icon: LucideIcon;
};

/**
 * Same four facts on every Practice page. Desktop uses `label`; mobile uses `shortLabel`
 * so a 2×2 grid stays readable at 360px without squeezing four into one row.
 */
export const PRACTICE_FEATURES: ReadonlyArray<PracticeFeature> = [
  {
    label: "Solo Mode",
    shortLabel: "Solo Mode",
    tone: "cyan",
    Icon: UserRound,
  },
  {
    label: "Free to Play",
    shortLabel: "Free Play",
    tone: "purple",
    Icon: Gift,
  },
  {
    label: "No Ranking Impact",
    shortLabel: "No Rank",
    tone: "blue",
    Icon: ChartNoAxesColumn,
  },
  {
    label: "Unlimited Practice",
    shortLabel: "Unlimited",
    tone: "magenta",
    Icon: InfinityIcon,
  },
];
