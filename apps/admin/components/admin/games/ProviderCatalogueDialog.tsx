"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, RefreshCw, Gamepad2, Info } from "lucide-react";
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

/**
 * One provider's game catalogue, with our own enable switch per title.
 *
 * BOTH SWITCHES ARE SHOWN ON EVERY ROW, and that is the whole point of the screen. The
 * provider's `providerStatus` is their opinion; `chartvoltEnabled` is our decision. Showing
 * only ours would leave an operator unable to tell "we have not enabled it yet" from "the
 * provider has withdrawn it" - two situations needing opposite actions.
 *
 * A SYNC NEVER ENABLES ANYTHING. Pulling a catalogue is safe to press at any time: it adds
 * and updates rows, reports titles the provider has stopped listing without deleting them,
 * and leaves every ChartVolt switch exactly as it was.
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
        toast.error(data.error ?? "Failed to load the game catalogue.");
        return;
      }
      setTitles(data.games ?? []);
    } catch {
      toast.error("Failed to load the game catalogue.");
    } finally {
      setLoading(false);
    }
  }, [providerKey]);

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
          : `${title.displayName} will not accept new contests. Any already running will still finish.`,
      );
      onChanged();
    } catch {
      toast.error("Something went wrong. Please contact support.");
    } finally {
      setPendingCode(null);
    }
  };

  if (!provider) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Gamepad2 className="h-5 w-5 text-violet-400" />
            Games — {provider.displayName}
          </DialogTitle>
          <DialogDescription>
            The provider decides what it offers. You decide what goes live here. A game needs
            both.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/5 p-3">
          <div className="text-sm text-white/70">
            {provider.lastCatalogueSyncAt
              ? `Last synced ${new Date(provider.lastCatalogueSyncAt).toLocaleString()}`
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

        {lastSync && lastSync.missingFromProvider.length > 0 && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">
            <div className="flex items-start gap-2">
              <Info className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                {lastSync.missingFromProvider.length} title(s) in our list were not returned
                by the provider this time. They have been kept, not deleted — a title with
                past rounds cannot be removed without orphaning those results, and an absent
                item is as likely to be a partial failure upstream as a real withdrawal.
              </span>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-12 text-white/50">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading games…
          </div>
        ) : titles.length === 0 ? (
          <div className="py-12 text-center text-sm text-white/50">
            No games cached yet. Press <strong>Sync catalogue</strong> to pull the list from
            this provider.
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-white/10">
            <table className="w-full text-sm">
              <thead className="bg-white/5 text-left text-xs uppercase tracking-wide text-white/50">
                <tr>
                  <th className="px-3 py-2">Game</th>
                  <th className="px-3 py-2">Formats</th>
                  <th className="px-3 py-2">Provider says</th>
                  <th className="px-3 py-2">Live on ChartVolt</th>
                </tr>
              </thead>
              <tbody>
                {titles.map((title) => (
                  <tr key={title.gameCode} className="border-t border-white/5">
                    <td className="px-3 py-2.5">
                      <div className="font-medium text-white/90">{title.displayName}</div>
                      <div className="font-mono text-xs text-white/40">
                        {title.gameCode}
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex flex-wrap gap-1">
                        {title.supportsCompetition && (
                          <Badge variant="outline" className="text-xs">
                            Competition
                          </Badge>
                        )}
                        {title.supportsOneVsOne && (
                          <Badge variant="outline" className="text-xs">
                            Challenge
                          </Badge>
                        )}
                        {title.supportsPractice && (
                          <Badge variant="outline" className="text-xs">
                            Practice
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <ProviderStatusBadge status={title.providerStatus} />
                    </td>
                    <td className="px-3 py-2.5">
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

function ProviderStatusBadge({ status }: { status: string }) {
  const tone =
    status === "active"
      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
      : status === "maintenance"
        ? "border-amber-500/40 bg-amber-500/10 text-amber-300"
        : "border-white/20 bg-white/5 text-white/50";

  return (
    <Badge variant="outline" className={tone}>
      {status}
    </Badge>
  );
}
