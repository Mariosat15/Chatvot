"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Eye,
  Gamepad2,
  Loader2,
  Plug,
  Plus,
  Save,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTerms } from "@/contexts/TerminologyContext";
import { resolveGameCategory } from "@/lib/services/games/game-categories";
import { playerGamePageHref } from "@/lib/admin/player-app-url";
import type { GameProviderRow, ProviderTitleRow } from "./provider-types";
import GameProvidersSection from "./GameProvidersSection";
import GamesWorkspaceEditor from "./GamesWorkspaceEditor";
import type { TitleStats } from "./GamesWorkspaceEditor";

/**
 * Centralised Games admin workspace (X11 Slice 2).
 *
 * List + header + tabs + right rail. Per-title writers stay on All Games only — the Providers
 * catalogue is sync + Live toggle. Theme matches other admin sections (`gray-800` / `gray-700`).
 */

type WorkspaceView = "games" | "providers";

export type WorkspaceTitle = ProviderTitleRow & {
  providerDisplayName: string;
  providerEnabled: boolean;
  lastCatalogueSyncAt?: string;
};

const TAB_IDS = [
  "general",
  "settings",
  "scoring",
  "challenge",
  "content",
  "assets",
  "theme",
  "live",
] as const;

export type WorkspaceTab = (typeof TAB_IDS)[number];

export default function GamesWorkspaceSection() {
  const terms = useTerms();
  const [view, setView] = useState<WorkspaceView>("games");
  const [titles, setTitles] = useState<WorkspaceTitle[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [tab, setTab] = useState<WorkspaceTab>("general");
  const [stats, setStats] = useState<TitleStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const saveHandlerRef = useRef<(() => Promise<void>) | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/games/providers");
      const data = await response.json();
      if (!response.ok) {
        toast.error(data.error ?? `Failed to load ${terms.game} providers.`);
        return;
      }

      const list = (data.providers ?? []) as GameProviderRow[];

      const perProvider = await Promise.all(
        list.map(async (provider) => {
          const gamesRes = await fetch(
            `/api/games/providers/${provider.providerKey}/games`,
          );
          const gamesData = await gamesRes.json();
          if (!gamesRes.ok) {
            toast.error(
              gamesData.error ??
                `Failed to load ${terms.games} for ${provider.displayName}.`,
            );
            return [] as WorkspaceTitle[];
          }
          return ((gamesData.games ?? []) as ProviderTitleRow[]).map((row) => ({
            ...row,
            providerDisplayName: provider.displayName,
            providerEnabled: provider.enabled,
            lastCatalogueSyncAt: provider.lastCatalogueSyncAt,
          }));
        }),
      );

      const flat = perProvider.flat();
      setTitles(flat);
      setSelectedKey((current) => {
        if (current && flat.some((t) => t.gameKey === current)) return current;
        return flat[0]?.gameKey ?? null;
      });
    } catch {
      toast.error(`Failed to load ${terms.games}.`);
    } finally {
      setLoading(false);
    }
  }, [terms]);

  useEffect(() => {
    void load();
  }, [load]);

  const selected = titles.find((t) => t.gameKey === selectedKey) ?? null;
  const selectedGameKey = selected?.gameKey ?? null;
  const selectedProviderKey = selected?.providerKey ?? null;
  const selectedGameCode = selected?.gameCode ?? null;

  useEffect(() => {
    if (!selectedGameKey || !selectedProviderKey || !selectedGameCode) {
      setStats(null);
      return;
    }
    let cancelled = false;
    setStatsLoading(true);
    void (async () => {
      try {
        const res = await fetch(
          `/api/games/providers/${selectedProviderKey}/games/performance?gameCode=${encodeURIComponent(selectedGameCode)}&days=30`,
        );
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setStats(null);
          return;
        }
        setStats(data.stats ?? null);
      } catch {
        if (!cancelled) setStats(null);
      } finally {
        if (!cancelled) setStatsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedGameKey, selectedProviderKey, selectedGameCode]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return titles;
    return titles.filter((t) => {
      const genre = resolveGameCategory(t.category)?.label ?? t.category ?? "";
      return (
        t.displayName.toLowerCase().includes(q) ||
        t.gameCode.toLowerCase().includes(q) ||
        t.providerDisplayName.toLowerCase().includes(q) ||
        genre.toLowerCase().includes(q)
      );
    });
  }, [titles, search]);

  const updateTitle = useCallback((gameKey: string, patch: Partial<ProviderTitleRow>) => {
    setTitles((current) =>
      current.map((row) => (row.gameKey === gameKey ? { ...row, ...patch } : row)),
    );
  }, []);

  const registerSave = useCallback((fn: (() => Promise<void>) | null) => {
    saveHandlerRef.current = fn;
  }, []);

  const handleHeaderSave = async () => {
    if (!saveHandlerRef.current) {
      toast.message("Nothing to save on this tab — use the form actions below.");
      return;
    }
    setSaving(true);
    try {
      await saveHandlerRef.current();
    } finally {
      setSaving(false);
    }
  };

  if (view === "providers") {
    return (
      <div className="space-y-4">
        <ViewSwitch view={view} onChange={setView} termsLabel={terms.games} />
        <GameProvidersSection />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-white/50">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading {terms.games}…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <ViewSwitch view={view} onChange={setView} termsLabel={terms.games} />

      <div className="flex min-h-[70vh] overflow-hidden rounded-xl border border-gray-700 bg-gray-900">
        {/* Games list */}
        <aside className="flex w-72 shrink-0 flex-col border-r border-gray-700 bg-gray-800/40">
          <div className="border-b border-gray-700 p-3">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white">
                {terms.games} ({titles.length})
              </h2>
            </div>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-white/35" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={`Search ${terms.games}…`}
                className="h-9 border-gray-700 bg-gray-900 pl-8 text-sm text-white placeholder:text-white/35"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2">
            {filtered.length === 0 ? (
              <p className="px-2 py-8 text-center text-xs text-white/40">
                {titles.length === 0
                  ? `No ${terms.games} cached yet. Open Providers and sync a catalogue.`
                  : "No matches."}
              </p>
            ) : (
              <ul className="space-y-1">
                {filtered.map((title) => {
                  const active = title.gameKey === selectedKey;
                  const genre = resolveGameCategory(title.category);
                  return (
                    <li key={title.gameKey}>
                      <button
                        type="button"
                        onClick={() => setSelectedKey(title.gameKey)}
                        className={`flex w-full items-center gap-2.5 rounded-lg border px-2.5 py-2 text-left transition ${
                          active
                            ? "border-violet-500/60 bg-violet-500/15"
                            : "border-transparent hover:border-gray-600 hover:bg-gray-800/50"
                        }`}
                      >
                        <TitleThumb url={title.thumbnailUrl} name={title.displayName} />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium text-white">
                            {title.displayName}
                          </div>
                          <div className="truncate text-[11px] text-white/45">
                            {genre?.label ?? title.providerDisplayName}
                          </div>
                        </div>
                        <span
                          className={`h-2 w-2 shrink-0 rounded-full ${
                            title.chartvoltEnabled ? "bg-emerald-400" : "bg-white/25"
                          }`}
                          title={
                            title.chartvoltEnabled
                              ? "Live on ChartVolt"
                              : "Not live on ChartVolt"
                          }
                        />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="border-t border-gray-700 p-3">
            <Button
              className="w-full bg-violet-600 text-white hover:bg-violet-500"
              onClick={() => setView("providers")}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add via provider sync
            </Button>
          </div>
        </aside>

        {/* Main + right rail */}
        <div className="flex min-w-0 flex-1">
          <main className="flex min-w-0 flex-1 flex-col bg-gray-900">
            {!selected ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-3 p-12 text-center text-white/50">
                <Gamepad2 className="h-10 w-10 text-white/25" />
                <p className="text-sm">
                  Select a {terms.game} from the list, or sync a catalogue under Providers.
                </p>
              </div>
            ) : (
              <>
                <header className="border-b border-gray-700 px-5 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="flex min-w-0 items-start gap-3">
                      <TitleThumb
                        url={selected.thumbnailUrl}
                        name={selected.displayName}
                        size="lg"
                      />
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h1 className="truncate text-xl font-semibold text-white">
                            {selected.displayName}
                          </h1>
                          <Badge
                            className={
                              selected.chartvoltEnabled
                                ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-300"
                                : "border-white/20 bg-white/5 text-white/50"
                            }
                          >
                            {selected.chartvoltEnabled ? "Active" : "Off"}
                          </Badge>
                          <GenrePill category={selected.category} />
                        </div>
                        {selected.tagline && (
                          <p className="mt-0.5 text-sm text-cyan-300/80">
                            {selected.tagline}
                          </p>
                        )}
                        {selected.description && (
                          <p className="mt-1 line-clamp-2 max-w-2xl text-xs text-white/50">
                            {selected.description}
                          </p>
                        )}
                        <HeaderStats stats={stats} loading={statsLoading} />
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-gray-600 text-white/80"
                        asChild
                      >
                        <a
                          href={playerGamePageHref(selected.gameCode)}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <Eye className="mr-1.5 h-3.5 w-3.5" />
                          View on platform
                        </a>
                      </Button>
                      <Button
                        size="sm"
                        className="bg-violet-600 text-white hover:bg-violet-500"
                        disabled={saving || tab !== "general"}
                        onClick={() => void handleHeaderSave()}
                        title={
                          tab !== "general"
                            ? "Save from the General tab, or use each tab’s own Save"
                            : undefined
                        }
                      >
                        {saving ? (
                          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Save className="mr-1.5 h-3.5 w-3.5" />
                        )}
                        Save changes
                      </Button>
                    </div>
                  </div>
                </header>

                <Tabs
                  value={tab}
                  onValueChange={(v) => setTab(v as WorkspaceTab)}
                  className="flex min-h-0 flex-1 flex-col gap-0"
                >
                  <div className="overflow-x-auto border-b border-gray-700 px-3">
                    <TabsList className="h-auto w-full justify-start gap-0 rounded-none bg-transparent p-0">
                      {(
                        [
                          ["general", "General"],
                          ["settings", `${terms.game} settings`],
                          ["scoring", `${terms.prize} & scoring`],
                          ["challenge", `${terms.challenge} defaults`],
                          ["content", "Page content"],
                          ["assets", "Assets"],
                          ["theme", "Page theme"],
                          ["live", "Live & publish"],
                        ] as const
                      ).map(([id, label]) => (
                        <TabsTrigger
                          key={id}
                          value={id}
                          className="rounded-none border-b-2 border-transparent px-3 py-2.5 text-xs data-[state=active]:border-violet-500 data-[state=active]:bg-transparent data-[state=active]:text-violet-300 data-[state=active]:shadow-none"
                        >
                          {label}
                        </TabsTrigger>
                      ))}
                    </TabsList>
                  </div>

                  <div className="min-h-0 flex-1 overflow-y-auto p-5">
                    {TAB_IDS.map((id) => (
                      <TabsContent key={id} value={id} className="mt-0 outline-none">
                        {tab === id && (
                          <GamesWorkspaceEditor
                            tab={id}
                            title={selected}
                            stats={stats}
                            statsLoading={statsLoading}
                            showSideRail={false}
                            onTitlePatch={(patch) =>
                              updateTitle(selected.gameKey, patch)
                            }
                            onProvidersChanged={load}
                            onRegisterSave={id === "general" ? registerSave : undefined}
                          />
                        )}
                      </TabsContent>
                    ))}
                  </div>
                </Tabs>
              </>
            )}
          </main>

          {selected && (
            <aside className="hidden w-80 shrink-0 overflow-y-auto border-l border-gray-700 bg-gray-800/30 p-4 xl:block">
              <GamesWorkspaceEditor
                tab="general"
                title={selected}
                stats={stats}
                statsLoading={statsLoading}
                showSideRail
                onTitlePatch={(patch) => updateTitle(selected.gameKey, patch)}
                onProvidersChanged={load}
              />
            </aside>
          )}
        </div>
      </div>
    </div>
  );
}

function HeaderStats({
  stats,
  loading,
}: {
  stats: TitleStats | null;
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="mt-3 flex items-center gap-2 text-xs text-white/40">
        <Loader2 className="h-3 w-3 animate-spin" /> Loading stats…
      </div>
    );
  }
  if (!stats) {
    return (
      <p className="mt-3 text-xs text-white/35">
        No play traffic in the last 30 days yet.
      </p>
    );
  }
  const cells = [
    { label: "Players", value: stats.players },
    { label: "Competitions", value: stats.contests },
    { label: "Plays", value: stats.rounds.started },
    { label: "Scored rounds", value: stats.scoreProducing },
  ];
  return (
    <div className="mt-3 flex flex-wrap gap-4">
      {cells.map((cell) => (
        <div key={cell.label}>
          <div className="text-[10px] uppercase tracking-wide text-white/40">
            {cell.label}
          </div>
          <div className="text-sm font-semibold text-white">
            {cell.value.toLocaleString()}
          </div>
        </div>
      ))}
    </div>
  );
}

function ViewSwitch({
  view,
  onChange,
  termsLabel,
}: {
  view: WorkspaceView;
  onChange: (v: WorkspaceView) => void;
  termsLabel: string;
}) {
  return (
    <div className="inline-flex rounded-lg border border-gray-700 bg-gray-800/50 p-0.5">
      <button
        type="button"
        onClick={() => onChange("games")}
        className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm ${
          view === "games"
            ? "bg-violet-600 text-white"
            : "text-white/60 hover:text-white"
        }`}
      >
        <Gamepad2 className="h-3.5 w-3.5" />
        All {termsLabel}
      </button>
      <button
        type="button"
        onClick={() => onChange("providers")}
        className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm ${
          view === "providers"
            ? "bg-violet-600 text-white"
            : "text-white/60 hover:text-white"
        }`}
      >
        <Plug className="h-3.5 w-3.5" />
        Providers
      </button>
    </div>
  );
}

function TitleThumb({
  url,
  name,
  size = "sm",
}: {
  url?: string;
  name: string;
  size?: "sm" | "lg";
}) {
  const dim = size === "lg" ? "h-14 w-14" : "h-9 w-9";
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt=""
        className={`${dim} shrink-0 rounded-lg border border-gray-700 object-cover`}
      />
    );
  }
  return (
    <div
      className={`${dim} flex shrink-0 items-center justify-center rounded-lg border border-gray-700 bg-gray-800 text-xs font-semibold text-violet-300`}
    >
      {name.slice(0, 2).toUpperCase()}
    </div>
  );
}

function GenrePill({ category }: { category?: string }) {
  const resolved = resolveGameCategory(category);
  if (!resolved) return null;
  return (
    <Badge
      className={
        resolved.isKnown
          ? "border-violet-500/40 bg-violet-500/15 text-violet-300"
          : "border-amber-500/40 bg-amber-500/15 text-amber-300"
      }
    >
      {resolved.label}
    </Badge>
  );
}
