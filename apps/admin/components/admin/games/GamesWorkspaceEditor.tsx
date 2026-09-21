"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import {
  ExternalLink,
  Info,
  Loader2,
  Lock,
  Power,
  RefreshCw,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTerms } from "@/contexts/TerminologyContext";
import type { ProviderTitleRow } from "./provider-types";
import type { WorkspaceTab, WorkspaceTitle } from "./GamesWorkspaceSection";
import GamePlayStyleControl from "./GamePlayStyleControl";
import GameScoringDialog from "./GameScoringDialog";
import GameChallengeDefaultsDialog from "./GameChallengeDefaultsDialog";
import GameContentDialog from "./GameContentDialog";
import {
  CONTENT_LIMITS,
} from "@/lib/admin/game-content-fields";
import {
  GAME_CATEGORIES,
  normaliseCategorySlug,
  resolveGameCategory,
} from "@/lib/services/games/game-categories";
import { playerGamePageHref } from "@/lib/admin/player-app-url";

/**
 * Tab bodies + optional right rail for the Games workspace.
 */

export interface TitleStats {
  players: number;
  contests: number;
  scoreProducing: number;
  rounds: {
    started: number;
    ranFullCourse: number;
    leftEarly: number;
    cutOff: number;
  };
  abandonmentRate: number | null;
  windowDays: number;
}

interface Props {
  tab: WorkspaceTab;
  title: WorkspaceTitle;
  onTitlePatch: (patch: Partial<ProviderTitleRow>) => void;
  onProvidersChanged: () => void;
  stats?: TitleStats | null;
  statsLoading?: boolean;
  /** Right column only: preview, visibility, quick actions, stats. */
  showSideRail?: boolean;
  onRegisterSave?: (fn: (() => Promise<void>) | null) => void;
}

export default function GamesWorkspaceEditor({
  tab,
  title,
  onTitlePatch,
  onProvidersChanged,
  stats = null,
  statsLoading = false,
  showSideRail = false,
  onRegisterSave,
}: Props) {
  if (showSideRail) {
    return (
      <SideRail
        title={title}
        stats={stats}
        statsLoading={statsLoading}
        onTitlePatch={onTitlePatch}
        onProvidersChanged={onProvidersChanged}
      />
    );
  }

  switch (tab) {
    case "general":
      return (
        <GeneralTab
          title={title}
          onTitlePatch={onTitlePatch}
          onProvidersChanged={onProvidersChanged}
          onRegisterSave={onRegisterSave}
        />
      );
    case "settings":
      return <SettingsTab title={title} />;
    case "scoring":
      return (
        <PanelCard>
          <GameScoringDialog
            providerKey={title.providerKey}
            title={title}
            open
            inline
            onOpenChange={() => undefined}
            onSaved={onTitlePatch}
          />
        </PanelCard>
      );
    case "challenge":
      return <ChallengeTab title={title} onTitlePatch={onTitlePatch} />;
    case "content":
      return (
        <PanelCard>
          <GameContentDialog
            providerKey={title.providerKey}
            title={title}
            open
            inline
            sections="copy"
            onOpenChange={() => undefined}
            onSaved={onTitlePatch}
          />
        </PanelCard>
      );
    case "assets":
      return (
        <PanelCard>
          <GameContentDialog
            providerKey={title.providerKey}
            title={title}
            open
            inline
            sections="artwork"
            onOpenChange={() => undefined}
            onSaved={onTitlePatch}
          />
        </PanelCard>
      );
    case "live":
      return (
        <LiveTab
          title={title}
          onTitlePatch={onTitlePatch}
          onProvidersChanged={onProvidersChanged}
        />
      );
    default:
      return null;
  }
}

function ChallengeTab({
  title,
  onTitlePatch,
}: {
  title: WorkspaceTitle;
  onTitlePatch: (patch: Partial<ProviderTitleRow>) => void;
}) {
  const terms = useTerms();
  if (!title.supportsOneVsOne) {
    return (
      <PanelCard>
        <p className="text-sm text-white/55">
          This title is not playable one against one, so there are no{" "}
          {terms.challenge} defaults to set.
        </p>
      </PanelCard>
    );
  }
  return (
    <PanelCard>
      <GameChallengeDefaultsDialog
        providerKey={title.providerKey}
        title={title}
        open
        inline
        onOpenChange={() => undefined}
        onSaved={onTitlePatch}
      />
    </PanelCard>
  );
}

function PanelCard({ children }: { children: ReactNode }) {
  return (
    <Card className="border-gray-700 bg-gray-800/50 p-5 shadow-none">{children}</Card>
  );
}

function GeneralTab({
  title,
  onTitlePatch,
  onProvidersChanged,
  onRegisterSave,
}: {
  title: WorkspaceTitle;
  onTitlePatch: (patch: Partial<ProviderTitleRow>) => void;
  onProvidersChanged: () => void;
  onRegisterSave?: (fn: (() => Promise<void>) | null) => void;
}) {
  const terms = useTerms();
  const [displayName, setDisplayName] = useState(title.displayName ?? "");
  const [tagline, setTagline] = useState(title.tagline ?? "");
  const [description, setDescription] = useState(title.description ?? "");
  const [category, setCategory] = useState(title.category ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDisplayName(title.displayName ?? "");
    setTagline(title.tagline ?? "");
    setDescription(title.description ?? "");
    setCategory(title.category ?? "");
  }, [
    title.gameKey,
    title.displayName,
    title.tagline,
    title.description,
    title.category,
  ]);

  const save = useCallback(async () => {
    setSaving(true);
    try {
      const content = {
        displayName: displayName.trim() || title.displayName,
        tagline: tagline.trim(),
        description: description.trim(),
        category: category.trim(),
      };
      const response = await fetch(
        `/api/games/providers/${title.providerKey}/games/content`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ gameCode: title.gameCode, content }),
        },
      );
      const data = await response.json();
      if (!response.ok) {
        toast.error(data.error ?? "Something went wrong. Please contact support.");
        return;
      }
      onTitlePatch({
        displayName: content.displayName,
        tagline: content.tagline || undefined,
        description: content.description || undefined,
        category: content.category || undefined,
      });
      toast.success("General details saved.");
    } catch {
      toast.error("Something went wrong. Please contact support.");
    } finally {
      setSaving(false);
    }
  }, [
    displayName,
    tagline,
    description,
    category,
    title.displayName,
    title.providerKey,
    title.gameCode,
    onTitlePatch,
  ]);

  useEffect(() => {
    if (!onRegisterSave) return;
    onRegisterSave(save);
    return () => onRegisterSave(null);
  }, [onRegisterSave, save]);
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <PanelCard>
        <SectionTitle>Basic information</SectionTitle>
        <div className="mt-3 space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-white/60">Game name</Label>
            <Input
              value={displayName}
              maxLength={CONTENT_LIMITS.displayName}
              className="border-gray-700 bg-gray-900 text-white"
              onChange={(e) => setDisplayName(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-white/60">Slug</Label>
            <Input
              value={title.gameCode}
              disabled
              className="border-gray-700 bg-gray-900/60 font-mono text-xs text-white/50"
            />
            <p className="text-[11px] text-white/35">
              Immutable — used as the player URL segment under /games.
            </p>
          </div>
          <GeneralCategoryField value={category} onChange={setCategory} />
          <div className="space-y-1.5">
            <Label className="text-xs text-white/60">Status</Label>
            <Input
              value={title.chartvoltEnabled ? "Live on ChartVolt" : "Not live"}
              disabled
              className="border-gray-700 bg-gray-900/60 text-white/60"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-white/60">Short tagline</Label>
            <Input
              value={tagline}
              maxLength={CONTENT_LIMITS.tagline}
              className="border-gray-700 bg-gray-900 text-white"
              placeholder="One line under the title"
              onChange={(e) => setTagline(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-white/60">Description</Label>
              <span className="text-[10px] text-white/35">
                {description.length}/{CONTENT_LIMITS.description}
              </span>
            </div>
            <Textarea
              rows={4}
              value={description}
              maxLength={CONTENT_LIMITS.description}
              className="border-gray-700 bg-gray-900 text-white"
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <Button
            size="sm"
            className="bg-violet-600 text-white hover:bg-violet-500"
            disabled={saving}
            onClick={() => void save()}
          >
            {saving ? (
              <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
            ) : null}
            Save basic information
          </Button>
          <p className="text-xs text-white/40">
            Rules, how-to-play and highlights are on the{" "}
            <strong className="font-medium text-white/60">Page content</strong> tab —
            that is what players see on /games/{title.gameCode}.
          </p>
        </div>
      </PanelCard>

      <PanelCard>
        <SectionTitle>Formats & play style</SectionTitle>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {title.supportsCompetition && (
            <Badge variant="outline">{terms.contest}</Badge>
          )}
          {title.supportsOneVsOne && (
            <Badge variant="outline">{terms.challenge}</Badge>
          )}
          {title.supportsPractice && (
            <Badge variant="outline">{terms.practice}</Badge>
          )}
          {!title.supportsCompetition &&
            !title.supportsOneVsOne &&
            !title.supportsPractice && (
              <span className="text-xs text-white/40">No formats declared</span>
            )}
        </div>
        <div className="mt-4">
          <Label className="text-xs text-white/50">Play style</Label>
          <div className="mt-1.5">
            <GamePlayStyleControl
              providerKey={title.providerKey}
              title={title}
              onChanged={onTitlePatch}
            />
          </div>
        </div>
      </PanelCard>

      <PanelCard>
        <SectionTitle>Provider information</SectionTitle>
        <dl className="mt-3 space-y-2 text-sm">
          <Row label="Provider" value={title.providerDisplayName} />
          <Row label={`${terms.game} ID`} value={title.gameCode} mono />
          <Row label="gameKey" value={title.gameKey} mono />
          <Row
            label="Provider enabled"
            value={title.providerEnabled ? "Yes" : "No"}
          />
          <Row
            label="Last catalogue sync"
            value={
              title.lastCatalogueSyncAt
                ? new Date(title.lastCatalogueSyncAt).toLocaleString()
                : "Never"
            }
          />
        </dl>
      </PanelCard>

      <PanelCard>
        <SectionTitle>Visibility</SectionTitle>
        <LiveToggle
          title={title}
          onTitlePatch={onTitlePatch}
          onProvidersChanged={onProvidersChanged}
        />
      </PanelCard>
    </div>
  );
}

function SideRail({
  title,
  stats,
  statsLoading,
  onTitlePatch,
  onProvidersChanged,
}: {
  title: WorkspaceTitle;
  stats: TitleStats | null;
  statsLoading: boolean;
  onTitlePatch: (patch: Partial<ProviderTitleRow>) => void;
  onProvidersChanged: () => void;
}) {
  const terms = useTerms();
  const pageHref = playerGamePageHref(title.gameCode);

  return (
    <div className="space-y-4">
      <PanelCard>
        <SectionTitle>Game preview</SectionTitle>
        <p className="mt-1 text-[11px] text-white/40">
          How the player /games page reads today. Edit copy under Page content and Assets.
        </p>
        <div className="mt-3 overflow-hidden rounded-lg border border-gray-700 bg-gray-900">
          {title.bannerUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={title.bannerUrl}
              alt=""
              className="h-28 w-full object-cover"
            />
          ) : (
            <div className="flex h-28 items-center justify-center text-xs text-white/35">
              No banner — set one under Assets
            </div>
          )}
          <div className="space-y-2 p-3">
            <div className="flex items-center gap-2">
              {title.thumbnailUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={title.thumbnailUrl}
                  alt=""
                  className="h-10 w-10 rounded-md border border-gray-700 object-cover"
                />
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded-md border border-gray-700 text-[10px] text-white/40">
                  Icon
                </div>
              )}
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-white">
                  {title.displayName}
                </div>
                {title.tagline && (
                  <div className="truncate text-xs text-cyan-300/70">
                    {title.tagline}
                  </div>
                )}
              </div>
            </div>
            {title.description && (
              <p className="line-clamp-3 text-xs text-white/55">{title.description}</p>
            )}
            {(title.rulesSummary || title.howToPlay) && (
              <div className="rounded border border-gray-700/80 bg-gray-800/40 p-2 text-[11px] text-white/50">
                {title.rulesSummary
                  ? title.rulesSummary.slice(0, 160)
                  : title.howToPlay?.slice(0, 160)}
                …
              </div>
            )}
          </div>
        </div>
      </PanelCard>

      <PanelCard>
        <SectionTitle>Visibility & platform</SectionTitle>
        <LiveToggle
          title={title}
          onTitlePatch={onTitlePatch}
          onProvidersChanged={onProvidersChanged}
        />
        <p className="mt-2 text-[11px] text-white/35">
          Featured / KYC gates are not on this catalogue row yet.
        </p>
      </PanelCard>

      <PanelCard>
        <SectionTitle>Quick actions</SectionTitle>
        <div className="mt-3 flex flex-col gap-2">
          <Button
            variant="outline"
            size="sm"
            className="justify-start border-gray-600"
            asChild
          >
            <a href={pageHref} target="_blank" rel="noreferrer">
              <ExternalLink className="mr-2 h-3.5 w-3.5" />
              View {terms.game} page
            </a>
          </Button>
          <p className="flex items-start gap-1.5 text-xs text-white/40">
            <Lock className="mt-0.5 h-3 w-3 shrink-0" />
            Duplicate and delete are withheld:{" "}
            <code className="text-white/55">gameKey</code> is immutable and joined to
            history. Disable under Live & publish instead.
          </p>
        </div>
      </PanelCard>

      <PanelCard>
        <SectionTitle>Game statistics</SectionTitle>
        <p className="mt-1 text-[11px] text-white/40">Last 30 days</p>
        {statsLoading ? (
          <div className="mt-3 flex items-center gap-2 text-xs text-white/40">
            <Loader2 className="h-3 w-3 animate-spin" /> Loading…
          </div>
        ) : !stats ? (
          <p className="mt-3 text-xs text-white/40">No traffic in this window.</p>
        ) : (
          <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
            <Stat label="Plays" value={stats.rounds.started} />
            <Stat label="Unique players" value={stats.players} />
            <Stat label="Completions" value={stats.rounds.ranFullCourse} />
            <Stat label="Scored rounds" value={stats.scoreProducing} />
          </dl>
        )}
      </PanelCard>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-wide text-white/40">{label}</dt>
      <dd className="text-base font-semibold text-white">
        {value.toLocaleString()}
      </dd>
    </div>
  );
}

function SettingsTab({ title }: { title: WorkspaceTitle }) {
  const terms = useTerms();
  return (
    <PanelCard>
      <SectionTitle>{terms.game} settings</SectionTitle>
      <p className="mt-1 text-xs text-white/45">
        Provider-owned declarations. A catalogue sync rewrites these; edit play style and
        eligibility on their own tabs.
      </p>
      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
        <Row label="Family" value={title.family} />
        <Row label="Provider status" value={title.providerStatus} />
        <Row label="Score direction" value={title.scoreDirection ?? "—"} />
        <Row label="Score type" value={title.scoreType ?? "—"} />
        <Row
          label="Round ceiling"
          value={title.maxDurationSeconds ? `${title.maxDurationSeconds}s` : "—"}
        />
        <Row label="Play mode (provider)" value={title.playMode ?? "—"} />
      </dl>
      {title.configSchema != null && (
        <div className="mt-4 rounded-lg border border-gray-700 bg-gray-900 p-3">
          <div className="mb-1 text-xs font-medium text-white/60">configSchema</div>
          <pre className="max-h-48 overflow-auto text-[11px] text-white/50">
            {JSON.stringify(title.configSchema, null, 2)}
          </pre>
        </div>
      )}
    </PanelCard>
  );
}

function LiveTab({
  title,
  onTitlePatch,
  onProvidersChanged,
}: {
  title: WorkspaceTitle;
  onTitlePatch: (patch: Partial<ProviderTitleRow>) => void;
  onProvidersChanged: () => void;
}) {
  const terms = useTerms();
  const [syncing, setSyncing] = useState(false);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const response = await fetch(
        `/api/games/providers/${title.providerKey}/sync`,
        { method: "POST" },
      );
      const data = await response.json();
      if (!response.ok) {
        toast.error(data.error ?? "The catalogue sync did not complete.");
        return;
      }
      toast.success(
        `Synced: ${data.result.created} added, ${data.result.updated} updated, ${data.result.unchanged} unchanged.`,
      );
      onProvidersChanged();
    } catch {
      toast.error("Something went wrong. Please contact support.");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <PanelCard>
        <SectionTitle>Live on ChartVolt</SectionTitle>
        <LiveToggle
          title={title}
          onTitlePatch={onTitlePatch}
          onProvidersChanged={onProvidersChanged}
        />
      </PanelCard>

      <PanelCard>
        <SectionTitle>Provider sync</SectionTitle>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm text-white/65">
            {title.lastCatalogueSyncAt
              ? `Last synced ${new Date(title.lastCatalogueSyncAt).toLocaleString()}`
              : "This catalogue has never been synced."}
          </div>
          <Button size="sm" onClick={handleSync} disabled={syncing}>
            {syncing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Sync catalogue
          </Button>
        </div>
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-gray-700 bg-gray-900/60 p-2.5 text-xs text-white/55">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            A sync never enables a {terms.game}. It updates provider-owned fields and leaves
            every ChartVolt switch as it was.
          </span>
        </div>
        <div className="mt-3">
          <Badge
            variant="outline"
            className={
              title.providerStatus === "active"
                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                : "border-white/20 bg-white/5 text-white/50"
            }
          >
            Provider says: {title.providerStatus}
          </Badge>
        </div>
      </PanelCard>
    </div>
  );
}

function LiveToggle({
  title,
  onTitlePatch,
  onProvidersChanged,
}: {
  title: WorkspaceTitle;
  onTitlePatch: (patch: Partial<ProviderTitleRow>) => void;
  onProvidersChanged: () => void;
}) {
  const terms = useTerms();
  const [pending, setPending] = useState(false);

  const handleToggle = async (enabled: boolean) => {
    setPending(true);
    try {
      const response = await fetch(
        `/api/games/providers/${title.providerKey}/games`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ gameCode: title.gameCode, enabled }),
        },
      );
      const data = await response.json();
      if (!response.ok) {
        toast.error(data.error ?? "Something went wrong. Please contact support.");
        return;
      }
      onTitlePatch({ chartvoltEnabled: enabled });
      toast.success(
        enabled
          ? `${title.displayName} is now available on ChartVolt.`
          : `${title.displayName} will not accept new ${terms.contests}. Any already running will still finish.`,
      );
      onProvidersChanged();
    } catch {
      toast.error("Something went wrong. Please contact support.");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="mt-3 flex items-start justify-between gap-4 rounded-lg border border-gray-700 bg-gray-900 p-3">
      <div className="flex items-start gap-2">
        <Power
          className={`mt-0.5 h-4 w-4 ${
            title.chartvoltEnabled ? "text-emerald-400" : "text-white/35"
          }`}
        />
        <div>
          <div className="text-sm font-medium text-white/90">Show on ChartVolt</div>
          <p className="text-xs text-white/50">
            Needs the platform switch, the provider switch and this one all on before{" "}
            {terms.players} can enter.
          </p>
          {title.providerStatus !== "active" && (
            <p className="mt-1 text-xs text-amber-300/80">
              Cannot enable while the provider reports {title.providerStatus}.
            </p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        {pending && <Loader2 className="h-3.5 w-3.5 animate-spin text-white/40" />}
        <Switch
          checked={title.chartvoltEnabled}
          disabled={pending || title.providerStatus !== "active"}
          onCheckedChange={handleToggle}
        />
      </div>
    </div>
  );
}

const NO_GENRE = "__no_genre__";
const CUSTOM = "__custom__";

function GeneralCategoryField({
  value,
  onChange,
}: {
  value: string;
  onChange: (slug: string) => void;
}) {
  const resolved = resolveGameCategory(value);
  const isCustom = resolved !== undefined && !resolved.isKnown;
  const [mode, setMode] = useState<"list" | "custom">(isCustom ? "custom" : "list");
  const [typed, setTyped] = useState(isCustom ? value : "");

  useEffect(() => {
    const next = resolveGameCategory(value);
    const custom = next !== undefined && !next.isKnown;
    setMode(custom ? "custom" : "list");
    setTyped(custom ? value : "");
  }, [value]);

  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-white/60">Category</Label>
      <div className="grid gap-2 sm:grid-cols-2">
        <Select
          value={mode === "custom" ? CUSTOM : value === "" ? NO_GENRE : value}
          onValueChange={(next) => {
            if (next === CUSTOM) {
              setMode("custom");
              onChange(normaliseCategorySlug(typed) ?? "");
              return;
            }
            setMode("list");
            onChange(next === NO_GENRE ? "" : next);
          }}
        >
          <SelectTrigger className="h-10 border-gray-700 bg-gray-900 text-sm text-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="border-gray-700 bg-gray-800">
            <SelectItem value={NO_GENRE}>No genre</SelectItem>
            {GAME_CATEGORIES.map((entry) => (
              <SelectItem key={entry.slug} value={entry.slug}>
                {entry.label}
              </SelectItem>
            ))}
            <SelectItem value={CUSTOM}>Something else…</SelectItem>
          </SelectContent>
        </Select>
        {mode === "custom" && (
          <Input
            value={typed}
            maxLength={CONTENT_LIMITS.category}
            className="border-gray-700 bg-gray-900 text-white"
            placeholder="Rhythm"
            onChange={(event) => {
              setTyped(event.target.value);
              onChange(normaliseCategorySlug(event.target.value) ?? "");
            }}
          />
        )}
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  return <h3 className="text-sm font-semibold text-white">{children}</h3>;
}

function Row({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <dt className="text-xs text-white/45">{label}</dt>
      <dd
        className={`mt-0.5 break-all text-white/85 ${mono ? "font-mono text-xs" : ""}`}
      >
        {value}
      </dd>
    </div>
  );
}
