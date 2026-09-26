"use client";

import {
  Loader2,
  KeyRound,
  Gamepad2,
  AlertTriangle,
  ShieldAlert,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { useTerms } from "@/contexts/TerminologyContext";
import type { GameProviderRow } from "./provider-types";
import { isCatalogueSyncStale } from "@/lib/services/game-providers/catalogue-sync-freshness";

/**
 * One provider card on the Games Providers admin screen.
 *
 * Extracted from GameProvidersSection so that file stays under the 500-line limit after
 * the Friday auto-sync toggle and the 7-day stale banner were added.
 */

export default function ProviderCard({
  provider,
  masterEnabled,
  pending,
  onToggle,
  onToggleAutoResponse,
  onToggleFridaySync,
  onCredentials,
  onCatalogue,
}: {
  provider: GameProviderRow;
  masterEnabled: boolean;
  pending: boolean;
  onToggle: (enabled: boolean) => void;
  onToggleAutoResponse: (autoOutageResponseEnabled: boolean) => void;
  onToggleFridaySync: (autoCatalogueSyncFriday: boolean) => void;
  onCredentials: () => void;
  onCatalogue: () => void;
}) {
  const terms = useTerms();
  const hasCallbackSecret = Boolean(provider.credentials?.hasCallbackSecret);
  const catalogueStale =
    provider.enabled && isCatalogueSyncStale(provider.lastCatalogueSyncAt);

  // Reason for computing this rather than only disabling the switch: an operator needs to
  // know WHY a provider cannot go live, and the switch alone cannot say.
  const blockers: string[] = [];
  if (!provider.adapterInstalled) blockers.push("no connector installed in the code");
  if (!hasCallbackSecret) blockers.push("no callback secret stored");

  return (
    <Card
      className={`border-white/10 bg-white/5 p-4 ${
        catalogueStale ? "ring-1 ring-red-500/50" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate font-semibold text-white">
              {provider.displayName}
            </span>
            {provider.credentials && (
              <Badge variant="outline" className="text-xs">
                {provider.credentials.environment}
              </Badge>
            )}
          </div>
          <div className="truncate font-mono text-xs text-white/40">
            {provider.providerKey}
          </div>
          <div className="mt-1 truncate text-xs text-white/50">{provider.baseUrl}</div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {pending && <Loader2 className="h-4 w-4 animate-spin text-white/40" />}
          <Switch
            checked={provider.enabled}
            disabled={pending || (!provider.enabled && blockers.length > 0)}
            onCheckedChange={onToggle}
          />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
        <Badge
          variant="outline"
          className={
            provider.enabled
              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
              : "border-white/20 bg-white/5 text-white/50"
          }
        >
          {provider.enabled ? "Enabled" : "Disabled"}
        </Badge>
        <Badge variant="outline" className="border-white/20 bg-white/5 text-white/60">
          {provider.enabledTitleCount} of {provider.titleCount} {terms.games} live
        </Badge>
        {provider.enabled && !masterEnabled && (
          <Badge className="border-amber-500/40 bg-amber-500/10 text-amber-300">
            Master switch off — nothing runs
          </Badge>
        )}
      </div>

      {blockers.length > 0 && (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-500/25 bg-amber-500/10 p-2.5 text-xs text-amber-200">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>Cannot be enabled yet: {blockers.join("; ")}.</span>
        </div>
      )}

      {catalogueStale && (
        <div
          role="alert"
          className="mt-3 flex items-start gap-2 rounded-lg border border-red-500/40 bg-red-500/10 p-2.5 text-xs text-red-100"
        >
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-400" />
          <span>
            Catalogue not synced for more than 7 days
            {provider.lastCatalogueSyncAt
              ? ` (last: ${new Date(provider.lastCatalogueSyncAt).toLocaleString()})`
              : " (never synced)"}
            . Open {terms.games} and sync — this notice stays until then.
          </span>
        </div>
      )}

      {/*
        Switches are described in terms of what they PERMIT, never in terms of the
        field name. An operator deciding whether to hand the platform the ability to take
        a provider off sale needs to know that it means refused entries and paused live
        contests; "automatic outage response" on its own says none of that.
      */}
      <div className="mt-3 space-y-2 rounded-lg border border-white/10 bg-black/20 p-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs font-medium text-white/80">
              Provider switch (above) — yours alone
            </div>
            <p className="mt-0.5 text-xs text-white/50">
              Turning this provider off stops new {terms.contests} and challenges being
              created or entered on its {terms.games}. Nothing but an operator does this
              unless you switch the outage line below on.
            </p>
          </div>
        </div>

        <div className="flex items-start justify-between gap-3 border-t border-white/10 pt-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-xs font-medium text-white/80">
              <ShieldAlert
                className={`h-3.5 w-3.5 ${
                  provider.autoOutageResponseEnabled
                    ? "text-amber-300"
                    : "text-white/35"
                }`}
              />
              Let the platform act on an outage by itself
            </div>
            <p className="mt-0.5 text-xs text-white/50">
              {provider.autoOutageResponseEnabled
                ? `On: after a sustained outage the platform will disable this provider, refuse new entries and pause live ${terms.contests} without waiting for you.`
                : `Off: outages raise a critical alert and nothing else. Disabling, refusing entries and pausing live ${terms.contests} stay your decision.`}
            </p>
          </div>
          <Switch
            checked={provider.autoOutageResponseEnabled}
            disabled={pending}
            onCheckedChange={onToggleAutoResponse}
          />
        </div>

        <div className="flex items-start justify-between gap-3 border-t border-white/10 pt-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-xs font-medium text-white/80">
              <RefreshCw
                className={`h-3.5 w-3.5 ${
                  provider.autoCatalogueSyncFriday
                    ? "text-violet-300"
                    : "text-white/35"
                }`}
              />
              Auto-sync catalogue every Friday at 00:00 UTC
            </div>
            <p className="mt-0.5 text-xs text-white/50">
              {provider.autoCatalogueSyncFriday
                ? "On: the worker pulls this provider's title list every Friday at midnight UTC. Titles are never enabled by a sync."
                : "Off: only a manual Sync catalogue refreshes titles. A red notice appears if this catalogue goes more than 7 days without a sync."}
            </p>
          </div>
          <Switch
            checked={provider.autoCatalogueSyncFriday}
            disabled={pending}
            onCheckedChange={onToggleFridaySync}
          />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={onCredentials}>
          <KeyRound className="mr-2 h-3.5 w-3.5" />
          Credentials
        </Button>
        <Button size="sm" variant="outline" onClick={onCatalogue}>
          <Gamepad2 className="mr-2 h-3.5 w-3.5" />
          {terms.games}
        </Button>
      </div>
    </Card>
  );
}
