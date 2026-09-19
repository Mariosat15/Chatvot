/**
 * A5 (X6.5) — empty Game Administration wiki topics.
 *
 * // Reason: owner decision 15 Sep 2026 — engineering delivers the reword plus a
 * skeleton of topics to fill; body authoring is owner work. Keeping these in a
 * separate module so filling them later does not force another edit of the
 * 8k-line AdminWikiSection monolith for every paragraph.
 */
"use client";

import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Layers,
  Key,
  Globe,
  ToggleLeft,
  Trophy,
  Play,
  FileEdit,
  Eye,
  Timer,
  Target,
  Info,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export type WikiTopicSkeleton = {
  id: string;
  title: string;
  icon: LucideIcon;
  category: string;
  tags: string[];
  content: ReactNode;
};

function SkeletonBody({
  heading,
  outline,
}: {
  heading: string;
  outline: string[];
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-cyan-400 mb-3">{heading}</h2>
        <p className="text-gray-300 mb-4">
          Operator documentation for this topic has not been written yet. Use the
          outline below when authoring — leave this placeholder until the body
          is ready rather than inventing guidance an operator might trust.
        </p>
      </div>

      <Card className="bg-amber-500/10 border-amber-500/30">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg text-amber-400 flex items-center gap-2">
            <Info className="h-5 w-5" />
            To be completed
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="text-sm text-gray-300 space-y-2 list-disc list-inside">
            {outline.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

/** Category string must stay identical across every topic so the sidebar groups them. */
export const GAME_ADMIN_CATEGORY = "Game Administration";

export const GAME_ADMIN_WIKI_TOPICS: WikiTopicSkeleton[] = [
  {
    id: "games-admin-overview",
    title: "Game Administration Overview",
    icon: Layers,
    category: GAME_ADMIN_CATEGORY,
    tags: ["games", "overview", "multi-game", "external games", "providers"],
    content: (
      <SkeletonBody
        heading="Game Administration Overview"
        outline={[
          "Trading is one game among several — provider titles arrive through the Game Providers screens",
          "Where to find: Game Providers, catalogue, provider contest wizard, round inspector",
          "What the External Games master switch does (and does not do)",
          "When to use a trading contest versus a provider contest",
        ]}
      />
    ),
  },
  {
    id: "game-providers-register",
    title: "Registering Game Providers",
    icon: Key,
    category: GAME_ADMIN_CATEGORY,
    tags: ["game providers", "credentials", "adapter", "callback", "register"],
    content: (
      <SkeletonBody
        heading="Registering Game Providers"
        outline={[
          "Add a provider, base URL, and the four credentials (API key/secret + callback token/secret)",
          "Why a blank secret field means keep, not clear",
          "Enable gate: adapter installed and callback token present",
          "Disable versus delete — never delete a provider joined to contest history",
        ]}
      />
    ),
  },
  {
    id: "provider-catalogue",
    title: "Provider Catalogue & Title Settings",
    icon: Globe,
    category: GAME_ADMIN_CATEGORY,
    tags: ["catalogue", "sync", "enable title", "content", "play style", "scoring"],
    content: (
      <SkeletonBody
        heading="Provider Catalogue & Title Settings"
        outline={[
          "Sync catalogue — report missing titles, never delete them",
          "providerStatus versus chartvoltEnabled (two switches)",
          "Operator-owned content: tagline, rules, how-to-play, artwork",
          "Play-style override and supported play modes",
          "Scoring rules: direction, eligibility bar, score unit",
        ]}
      />
    ),
  },
  {
    id: "external-games-switch",
    title: "External Games Master Switch",
    icon: ToggleLeft,
    category: GAME_ADMIN_CATEGORY,
    tags: ["external games", "platform switch", "feature flag", "whitelabel"],
    content: (
      <SkeletonBody
        heading="External Games Master Switch"
        outline={[
          "Where the switch lives and who may flip it",
          "Drafting a provider contest while the switch is off (allowed vs refused)",
          "What happens to running contests when trading or external games are switched off",
        ]}
      />
    ),
  },
  {
    id: "provider-contest-create",
    title: "Creating Provider Contests",
    icon: Trophy,
    category: GAME_ADMIN_CATEGORY,
    tags: ["provider contest", "wizard", "draft", "config schema", "create"],
    content: (
      <SkeletonBody
        heading="Creating Provider Contests"
        outline={[
          "Game picker routes to the provider wizard (trading form unchanged)",
          "Schema-driven settings — no per-game form code",
          "One contest clock: play window derived from start/end",
          "Round start policy and unscored-contest policy",
          "Drafts only until Publish",
        ]}
      />
    ),
  },
  {
    id: "provider-contest-publish",
    title: "Publishing Provider Contests",
    icon: Play,
    category: GAME_ADMIN_CATEGORY,
    tags: ["publish", "pre-flight", "draft", "checklist"],
    content: (
      <SkeletonBody
        heading="Publishing Provider Contests"
        outline={[
          "Pre-flight re-runs against the stored record, not the form",
          "What each refusal means (adapter, credentials, content seed, round fit)",
          "No unpublish — cancel-with-refund is the reversible operation",
        ]}
      />
    ),
  },
  {
    id: "provider-contest-edit",
    title: "Editing Provider Contests",
    icon: FileEdit,
    category: GAME_ADMIN_CATEGORY,
    tags: ["edit", "freeze", "participants", "play window", "immutable"],
    content: (
      <SkeletonBody
        heading="Editing Provider Contests"
        outline={[
          "Edit routes by game — never open the trading editor on a provider contest",
          "What freezes once anyone has entered",
          "gameKey and playMode are never editable after create",
          "Entry deadline recomputed from the merged document",
        ]}
      />
    ),
  },
  {
    id: "round-inspector",
    title: "Round Inspector & Manual Resolution",
    icon: Eye,
    category: GAME_ADMIN_CATEGORY,
    tags: ["rounds", "inspector", "unresolved", "manual", "resolution"],
    content: (
      <SkeletonBody
        heading="Round Inspector & Manual Resolution"
        outline={[
          "Which rounds need a decision and why",
          "Actions: void / abandon / expire — never enter a score from admin",
          "hold_and_alert versus policies that settle on time",
          "Mandatory reason length",
        ]}
      />
    ),
  },
  {
    id: "play-modes-contest-shape",
    title: "Play Modes & Contest Shape",
    icon: Timer,
    category: GAME_ADMIN_CATEGORY,
    tags: [
      "play mode",
      "scheduled",
      "anytime",
      "entry deadline",
      "synchronised",
    ],
    content: (
      <SkeletonBody
        heading="Play Modes & Contest Shape"
        outline={[
          "anytime versus scheduled — what forces attempts and entry close",
          "Titles that support both shapes; per-contest pick",
          "head_to_head cannot be staggered",
          "How late a player may start a round (round start policy)",
        ]}
      />
    ),
  },
  {
    id: "scoring-rules-eligibility",
    title: "Scoring Rules & Prize Eligibility",
    icon: Target,
    category: GAME_ADMIN_CATEGORY,
    tags: [
      "scoring",
      "score direction",
      "eligibility",
      "unscored",
      "prize",
    ],
    content: (
      <SkeletonBody
        heading="Scoring Rules & Prize Eligibility"
        outline={[
          "Higher-is-better versus lower-is-better — direction from the catalogue",
          "Who is in the ranking (has a result) versus who is refunded",
          "Unscored-contest policy: refund fees versus unclaimed pool",
          "Partial runs and expired rounds still count when configured",
        ]}
      />
    ),
  },
];
