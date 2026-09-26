"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, RefreshCw, Gamepad2, Info, AlertTriangle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import type {
  GameProviderRow,
  ProviderTitleRow,
  CatalogueSyncSummary,
} from "./provider-types";
import { resolveGameCategory } from "@/lib/services/games/game-categories";
import { useTerms } from "@/contexts/TerminologyContext";
import { DIALOG_WIDTH_WIDE } from "@/lib/admin/dialog-widths";
import { isCatalogueSyncStale } from "@/lib/services/game-providers/catalogue-sync-freshness";

/**
 * One provider's catalogue: sync + Live on ChartVolt only.
 *
 * Per-title settings (play style, scoring, challenge defaults, page content, assets) live
 * exclusively under All Games. Offering them here again created two writers for one decision
 * and left operators unsure which screen was authoritative.
 */

interface Props {
  provider: GameProviderRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChanged: () => void;
}

export default function ProviderCatalogueDialog({
  provider,
  open,
  onOpenChange,
  onChanged,
}: Props) {
  const terms = useTerms();
  const [titles, setTitles] = useState<ProviderTitleRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [pendingCode, setPendingCode] = useState<string | null>(null);
  const [lastSync, setLastSync] = useState<CatalogueSyncSummary | null>(null);

  const providerKey = provider?.providerKey;

  const load = useCallback(async () => {
    if (!providerKey) return;
    setLoading(true);
    try {
      const response = await fetch(`/api/games/providers/${providerKey}/games`);
      const data = await response.json();
      if (!response.ok) {
        toast.error(data.error ?? `Failed to load the ${terms.game} catalogue.`);
        return;
      }
      setTitles(data.games ?? []);
    } catch {
      toast.error(`Failed to load the ${terms.game} catalogue.`);
    } finally {
      setLoading(false);
    }
  }, [providerKey, terms]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  const handleSync = async () => {
    if (!providerKey) return;
    setSyncing(true);
    try {
      const response = await fetch(`/api/games/providers/${providerKey}/sync`, {
        method: "POST",
      });
      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error ?? "The catalogue sync did not complete.");
        return;
      }

      setLastSync(data.result);
      toast.success(
        `Synced: ${data.result.created} added, ${data.result.updated} updated, ${data.result.unchanged} unchanged.`,
      );
      await load();
      onChanged();
    } catch {
      toast.error("Something went wrong. Please contact support.");
    } finally {
      setSyncing(false);
    }
  };

  const handleToggle = async (title: ProviderTitleRow, enabled: boolean) => {
    if (!providerKey) return;
    setPendingCode(title.gameCode);
    try {
      const response = await fetch(`/api/games/providers/${providerKey}/games`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameCode: title.gameCode, enabled }),
      });
      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error ?? "Something went wrong. Please contact support.");
        return;
      }

      setTitles((current) =>
        current.map((row) =>
          row.gameCode === title.gameCode
            ? { ...row, chartvoltEnabled: enabled }
            : row,
        ),
      );
      toast.success(
        enabled
          ? `${title.displayName} is now available on ChartVolt.`
          : `${title.displayName} will not accept new ${terms.contests}. Any already running will still finish.`,
      );
      onChanged();
    } catch {
      toast.error("Something went wrong. Please contact support.");
    } finally {
      setPendingCode(null);
    }
  };

  if (!provider) return null;

  const catalogueStale = isCatalogueSyncStale(provider.lastCatalogueSyncAt);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`max-h-[85vh] overflow-y-auto ${DIALOG_WIDTH_WIDE}`}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Gamepad2 className="h-5 w-5 text-violet-400" />
            {terms.games} — {provider.displayName}
          </DialogTitle>
          <DialogDescription>
            Sync the catalogue and flip Live on ChartVolt. Edit play style, scoring,{" "}
            {terms.challenge} defaults and page content under{" "}
            <strong className="font-medium text-white/80">All {terms.games}</strong>.
          </DialogDescription>
        </DialogHeader>

        {catalogueStale && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-100"
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
            <div>
              <div className="font-medium text-red-50">
                Catalogue sync overdue (more than 7 days)
              </div>
              <p className="mt-0.5 text-red-100/80">
                {provider.lastCatalogueSyncAt
                  ? `Last synced ${new Date(provider.lastCatalogueSyncAt).toLocaleString()}. `
                  : "This catalogue has never been synced. "}
                Press <strong className="font-medium text-red-50">Sync catalogue</strong> —
                this notice stays until a sync succeeds.
              </p>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between gap-3 rounded-lg border border-gray-700 bg-gray-800/50 p-3">
          <div className="text-sm text-white/70">
            {provider.lastCatalogueSyncAt
              ? `Last synced ${new Date(provider.lastCatalogueSyncAt).toLocaleString()}`
              : "This catalogue has never been synced."}
            {provider.autoCatalogueSyncFriday
              ? " · Friday 00:00 UTC auto-sync is on."
              : ""}
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

        {lastSync && lastSync.missingFromProvider.length > 0 && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">
            <div className="flex items-start gap-2">
              <Info className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                {lastSync.missingFromProvider.length} title(s) in our list were not returned
                by the provider this time. They have been kept, not deleted — a title with
                past {terms.rounds} cannot be removed without orphaning those results.
              </span>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-12 text-white/50">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading {terms.games}…
          </div>
        ) : titles.length === 0 ? (
          <div className="py-12 text-center text-sm text-white/50">
            No {terms.games} cached yet. Press <strong>Sync catalogue</strong> to pull the list
            from this provider.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-gray-700">
            <table className="w-full text-sm">
              <thead className="bg-gray-800/80 text-left text-xs uppercase tracking-wide text-white/50">
                <tr>
                  <th className="whitespace-nowrap px-3 py-2">{terms.game}</th>
                  <th className="whitespace-nowrap px-3 py-2">Formats</th>
                  <th className="whitespace-nowrap px-3 py-2">Provider says</th>
                  <th className="whitespace-nowrap px-3 py-2">Live on ChartVolt</th>
                </tr>
              </thead>
              <tbody>
                {titles.map((title) => (
                  <tr key={title.gameCode} className="border-t border-gray-700/80">
                    <td className="px-3 py-2.5 align-top">
                      <div className="font-medium text-white/90">{title.displayName}</div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-mono text-xs text-white/40">
                          {title.gameCode}
                        </span>
                        <GenreBadge category={title.category} />
                      </div>
                    </td>
                    <td className="px-3 py-2.5 align-top">
                      <div className="flex flex-wrap gap-1">
                        {title.supportsCompetition && (
                          <Badge variant="outline" className="text-xs">
                            {terms.contest}
                          </Badge>
                        )}
                        {title.supportsOneVsOne && (
                          <Badge variant="outline" className="text-xs">
                            {terms.challenge}
                          </Badge>
                        )}
                        {title.supportsPractice && (
                          <Badge variant="outline" className="text-xs">
                            {terms.practice}
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 align-top">
                      <ProviderStatusBadge status={title.providerStatus} />
                    </td>
                    <td className="px-3 py-2.5 align-top">
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={title.chartvoltEnabled}
                          disabled={
                            pendingCode === title.gameCode ||
                            title.providerStatus !== "active"
                          }
                          onCheckedChange={(checked) => handleToggle(title, checked)}
                        />
                        {pendingCode === title.gameCode && (
                          <Loader2 className="h-3 w-3 animate-spin text-white/40" />
                        )}
                      </div>
                      {title.providerStatus !== "active" && (
                        <div className="mt-1 text-xs text-white/40">
                          Cannot be enabled while the provider reports{" "}
                          {title.providerStatus}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function GenreBadge({ category }: { category?: string }) {
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

function ProviderStatusBadge({ status }: { status: string }) {
  const live = status === "active";
  return (
    <Badge
      variant="outline"
      className={
        live
          ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
          : "border-white/20 bg-white/5 text-white/50"
      }
    >
      {status}
    </Badge>
  );
}
