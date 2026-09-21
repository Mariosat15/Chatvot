"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, LayoutTemplate, Image as ImageIcon, Palette } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import GameContentDialog from "@/components/admin/games/GameContentDialog";
import GamePageThemeEditor from "@/components/admin/games/GamePageThemeEditor";
import type { ProviderTitleRow } from "@/components/admin/games/provider-types";
import {
  TRADING_PAGE_ARTWORK_CODE,
  TRADING_PAGE_ARTWORK_PROVIDER,
  TRADING_PAGE_GAME_KEY,
} from "@/lib/services/games/trading-page-defaults";

/**
 * Page Content / Assets / Page Theme for Trading — same editors as All Games, no Settings.
 *
 * Settings for trading (symbols, risk, market hours) already live on the other Trading tabs.
 * This destination only edits what players see on `/games/trading`.
 */

type PageTab = "content" | "assets" | "theme";

const CONTENT_ENDPOINT = "/api/games/trading/page-content";
const ARTWORK_ENDPOINT = "/api/games/trading/artwork";

const TABS: { id: PageTab; label: string; icon: React.ReactNode }[] = [
  { id: "content", label: "Page content", icon: <LayoutTemplate className="h-4 w-4" /> },
  { id: "assets", label: "Assets", icon: <ImageIcon className="h-4 w-4" /> },
  { id: "theme", label: "Page theme", icon: <Palette className="h-4 w-4" /> },
];

function asTitleRow(content: Record<string, unknown>): ProviderTitleRow {
  return {
    _id: TRADING_PAGE_GAME_KEY,
    providerKey: TRADING_PAGE_ARTWORK_PROVIDER,
    gameCode: TRADING_PAGE_ARTWORK_CODE,
    gameKey: TRADING_PAGE_GAME_KEY,
    displayName:
      typeof content.displayName === "string" ? content.displayName : "Trading",
    family: "independent",
    providerStatus: "active",
    chartvoltEnabled: true,
    tagline: typeof content.tagline === "string" ? content.tagline : undefined,
    description:
      typeof content.description === "string" ? content.description : undefined,
    rulesSummary:
      typeof content.rulesSummary === "string" ? content.rulesSummary : undefined,
    howToPlay:
      typeof content.howToPlay === "string" ? content.howToPlay : undefined,
    category:
      typeof content.category === "string" ? content.category : undefined,
    thumbnailUrl:
      typeof content.thumbnailUrl === "string" ? content.thumbnailUrl : undefined,
    bannerUrl:
      typeof content.bannerUrl === "string" ? content.bannerUrl : undefined,
    howToPlayImageUrl:
      typeof content.howToPlayImageUrl === "string"
        ? content.howToPlayImageUrl
        : undefined,
    highlightsImageUrl:
      typeof content.highlightsImageUrl === "string"
        ? content.highlightsImageUrl
        : undefined,
    highlights: Array.isArray(content.highlights)
      ? (content.highlights as ProviderTitleRow["highlights"])
      : undefined,
    heroFeatures: Array.isArray(content.heroFeatures)
      ? (content.heroFeatures as ProviderTitleRow["heroFeatures"])
      : undefined,
    pageThemeId:
      typeof content.pageThemeId === "string" ? content.pageThemeId : undefined,
    stylizedQuote:
      typeof content.stylizedQuote === "string"
        ? content.stylizedQuote
        : undefined,
    gameplayPreviewUrl:
      typeof content.gameplayPreviewUrl === "string"
        ? content.gameplayPreviewUrl
        : undefined,
    gameplayVideoUrl:
      typeof content.gameplayVideoUrl === "string"
        ? content.gameplayVideoUrl
        : undefined,
    gallery: Array.isArray(content.gallery)
      ? (content.gallery as ProviderTitleRow["gallery"])
      : undefined,
    supportedDevices:
      content.supportedDevices && typeof content.supportedDevices === "object"
        ? (content.supportedDevices as ProviderTitleRow["supportedDevices"])
        : undefined,
    skillLevelLabel:
      typeof content.skillLevelLabel === "string"
        ? content.skillLevelLabel
        : undefined,
    howItWorksSteps: Array.isArray(content.howItWorksSteps)
      ? (content.howItWorksSteps as ProviderTitleRow["howItWorksSteps"])
      : undefined,
    descriptionTags: Array.isArray(content.descriptionTags)
      ? (content.descriptionTags as string[])
      : undefined,
  };
}

export default function TradingPageSection() {
  const [tab, setTab] = useState<PageTab>("content");
  const [title, setTitle] = useState<ProviderTitleRow | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(CONTENT_ENDPOINT);
      const data = await response.json();
      if (!response.ok) {
        toast.error(data.error ?? "Could not load the Trading page.");
        return;
      }
      setTitle(asTitleRow(data.content ?? {}));
    } catch {
      toast.error("Something went wrong. Please contact support.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const onSaved = (patch: Partial<ProviderTitleRow>) => {
    setTitle((current) => (current ? { ...current, ...patch } : current));
  };

  if (loading || !title) {
    return (
      <div className="flex items-center justify-center gap-2 py-24 text-white/50">
        <Loader2 className="h-5 w-5 animate-spin" />
        Loading Trading page…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-white">Trading page</h2>
        <p className="mt-1 text-sm text-white/55">
          What players see on <span className="text-white/80">/games/trading</span>.
          Market hours, symbols and risk stay on the other Trading tabs.
        </p>
      </div>

      <div className="flex flex-wrap border-b border-gray-700">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            aria-current={tab === item.id ? "page" : undefined}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors ${
              tab === item.id
                ? "border-b-2 border-orange-400 bg-orange-500/10 text-orange-400"
                : "text-gray-400 hover:text-gray-200"
            }`}
          >
            {item.icon}
            {item.label}
          </button>
        ))}
      </div>

      <Card className="border-gray-700/60 bg-gray-900/40 p-5">
        {tab === "content" && (
          <GameContentDialog
            providerKey={title.providerKey}
            title={title}
            open
            inline
            sections="copy"
            hideAiAssist
            contentEndpoint={CONTENT_ENDPOINT}
            artworkEndpoint={ARTWORK_ENDPOINT}
            onOpenChange={() => undefined}
            onSaved={onSaved}
          />
        )}
        {tab === "assets" && (
          <GameContentDialog
            providerKey={title.providerKey}
            title={title}
            open
            inline
            sections="artwork"
            hideAiAssist
            contentEndpoint={CONTENT_ENDPOINT}
            artworkEndpoint={ARTWORK_ENDPOINT}
            onOpenChange={() => undefined}
            onSaved={onSaved}
          />
        )}
        {tab === "theme" && (
          <GamePageThemeEditor
            key={title.gameKey}
            title={title}
            contentEndpoint={CONTENT_ENDPOINT}
            onSaved={onSaved}
          />
        )}
      </Card>
    </div>
  );
}
