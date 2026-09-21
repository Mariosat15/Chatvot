"use client";

import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import {
  ExternalLink,
  Info,
  Loader2,
  Power,
  RefreshCw,
  Lock,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useTerms } from "@/contexts/TerminologyContext";
import type { ProviderTitleRow } from "./provider-types";
import type { WorkspaceTab, WorkspaceTitle } from "./GamesWorkspaceSection";
import GamePlayStyleControl from "./GamePlayStyleControl";
import GameScoringDialog from "./GameScoringDialog";
import GameChallengeDefaultsDialog from "./GameChallengeDefaultsDialog";
import GameContentDialog from "./GameContentDialog";
import { resolveGameCategory } from "@/lib/services/games/game-categories";

/**
 * Tab bodies for the Games workspace. Each tab reuses an existing writer — scoring,
 * challenge defaults, content, play style, live toggle — so the catalogue dialog and this
 * screen cannot disagree about what a save does.
 */

interface Props {
  tab: WorkspaceTab;
  title: WorkspaceTitle;
  onTitlePatch: (patch: Partial<ProviderTitleRow>) => void;
  onProvidersChanged: () => void;
}

export default function GamesWorkspaceEditor({
  tab,
  title,
  onTitlePatch,
  onProvidersChanged,
}: Props) {
  switch (tab) {
    case "general":
      return (
        <GeneralTab
          title={title}
          onTitlePatch={onTitlePatch}
          onProvidersChanged={onProvidersChanged}
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
      return (
        <ChallengeTab title={title} onTitlePatch={onTitlePatch} />
      );
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
    <Card className="border-[#1e3a5f]/50 bg-[#07152c]/90 p-5 shadow-none">
      {children}
    </Card>
  );
}

function GeneralTab({
  title,
  onTitlePatch,
  onProvidersChanged,
}: {
  title: WorkspaceTitle;
  onTitlePatch: (patch: Partial<ProviderTitleRow>) => void;
  onProvidersChanged: () => void;
}) {
  const terms = useTerms();
  const genre = resolveGameCategory(title.category);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <PanelCard>
        <SectionTitle>Basic information</SectionTitle>
        <dl className="mt-3 space-y-3 text-sm">
          <Row label="Name" value={title.displayName} />
          <Row label="Slug" value={title.gameCode} mono />
          <Row label="Genre" value={genre?.label ?? "—"} />
          <Row
            label="Status"
            value={title.chartvoltEnabled ? "Live on ChartVolt" : "Not live"}
          />
          <Row label="Tagline" value={title.tagline || "—"} />
          <div>
            <dt className="text-xs text-white/45">Description</dt>
            <dd className="mt-0.5 whitespace-pre-wrap text-white/80">
              {title.description || "—"}
            </dd>
            <p className="mt-2 text-xs text-white/40">
              Edit name, tagline, description and genre on the{" "}
              <strong className="font-medium text-white/60">Page content</strong> tab —
              one writer, one audit line.
            </p>
          </div>
        </dl>
      </PanelCard>

      <PanelCard>
        <SectionTitle>Game preview</SectionTitle>
        <div className="mt-3 space-y-3">
          <div className="overflow-hidden rounded-lg border border-[#1e3a5f]/50 bg-[#020817]">
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
          </div>
          <div className="flex items-center gap-3">
            {title.thumbnailUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={title.thumbnailUrl}
                alt=""
                className="h-16 w-16 rounded-lg border border-[#1e3a5f]/50 object-cover"
              />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-lg border border-[#1e3a5f]/50 text-xs text-white/35">
                Icon
              </div>
            )}
            <p className="text-xs text-white/45">
              Replace logo and banner on the Assets tab.
            </p>
          </div>
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
        <SectionTitle>Visibility & platform</SectionTitle>
        <LiveToggle
          title={title}
          onTitlePatch={onTitlePatch}
          onProvidersChanged={onProvidersChanged}
        />
        <p className="mt-3 text-xs text-white/40">
          Featured / KYC gates are not on this catalogue row yet — they wait on a
          merchandising model when a second title needs them.
        </p>
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
        <SectionTitle>Quick actions</SectionTitle>
        <div className="mt-3 flex flex-col gap-2">
          <Button variant="outline" size="sm" className="justify-start" asChild>
            <a href={`/games/${title.gameCode}`} target="_blank" rel="noreferrer">
              <ExternalLink className="mr-2 h-3.5 w-3.5" />
              View {terms.game} page
            </a>
          </Button>
          <p className="flex items-start gap-1.5 text-xs text-white/40">
            <Lock className="mt-0.5 h-3 w-3 shrink-0" />
            Duplicate and delete are withheld: <code className="text-white/55">gameKey</code>{" "}
            is immutable and joined to history. Disable under Live & publish instead.
          </p>
        </div>
      </PanelCard>
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
      <dl className="mt-4 grid gap-3 sm:grid-cols-2 text-sm">
        <Row label="Family" value={title.family} />
        <Row label="Provider status" value={title.providerStatus} />
        <Row label="Score direction" value={title.scoreDirection ?? "—"} />
        <Row label="Score type" value={title.scoreType ?? "—"} />
        <Row
          label="Round ceiling"
          value={
            title.maxDurationSeconds
              ? `${title.maxDurationSeconds}s`
              : "—"
          }
        />
        <Row label="Play mode (provider)" value={title.playMode ?? "—"} />
      </dl>
      {title.configSchema != null && (
        <div className="mt-4 rounded-lg border border-[#1e3a5f]/40 bg-[#020817] p-3">
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
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-white/10 bg-white/5 p-2.5 text-xs text-white/55">
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
    <div className="mt-3 flex items-start justify-between gap-4 rounded-lg border border-[#1e3a5f]/40 bg-[#020817] p-3">
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
