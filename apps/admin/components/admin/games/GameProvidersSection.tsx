"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Plug,
  Plus,
  Loader2,
  KeyRound,
  Gamepad2,
  AlertTriangle,
  Power,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import ProviderRegisterDialog from "./ProviderRegisterDialog";
import ProviderCredentialsDialog from "./ProviderCredentialsDialog";
import ProviderCatalogueDialog from "./ProviderCatalogueDialog";
import type { GameProviderRow } from "./provider-types";

/**
 * Game providers admin screen (X6, chapter 12 section 4).
 *
 * THREE SWITCHES, DELIBERATELY NESTED, and this screen exists mainly to make that visible:
 * the platform master switch, then each provider, then each individual game. A provider
 * telling us a game is active is an input, never a decision - one flag would let a third
 * party put an untested game in front of paying players by editing their own database.
 *
 * The screen shows the whole chain per provider so an operator can tell at a glance which
 * of the three is the reason a game is not live. That question is otherwise answered by
 * reading three separate places and guessing.
 */

export default function GameProvidersSection() {
  const [providers, setProviders] = useState<GameProviderRow[]>([]);
  const [masterEnabled, setMasterEnabled] = useState(false);
  const [registeredAdapters, setRegisteredAdapters] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [masterPending, setMasterPending] = useState(false);

  const [registerOpen, setRegisterOpen] = useState(false);
  const [credentialsFor, setCredentialsFor] = useState<GameProviderRow | null>(null);
  const [catalogueFor, setCatalogueFor] = useState<GameProviderRow | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/games/providers");
      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error ?? "Failed to load game providers.");
        return;
      }

      setProviders(data.providers ?? []);
      setMasterEnabled(Boolean(data.externalGamesEnabled));
      setRegisteredAdapters(data.registeredAdapters ?? []);
    } catch {
      toast.error("Failed to load game providers.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Keep the open dialogs pointed at fresh data after a change, or the credential badges
  // and sync timestamp inside them go stale while still looking authoritative.
  useEffect(() => {
    if (credentialsFor) {
      const fresh = providers.find((p) => p.providerKey === credentialsFor.providerKey);
      if (fresh && fresh !== credentialsFor) setCredentialsFor(fresh);
    }
    if (catalogueFor) {
      const fresh = providers.find((p) => p.providerKey === catalogueFor.providerKey);
      if (fresh && fresh !== catalogueFor) setCatalogueFor(fresh);
    }
  }, [providers, credentialsFor, catalogueFor]);

  const handleMasterToggle = async (enabled: boolean) => {
    setMasterPending(true);
    try {
      const response = await fetch("/api/games/providers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "set-master-switch", enabled }),
      });
      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error ?? "Something went wrong. Please contact support.");
        return;
      }

      setMasterEnabled(enabled);
      toast.success(
        enabled
          ? "External games are switched on at platform level."
          : "External games are switched off platform-wide. Contests already running will still finish.",
      );
    } catch {
      toast.error("Something went wrong. Please contact support.");
    } finally {
      setMasterPending(false);
    }
  };

  const handleProviderToggle = async (
    provider: GameProviderRow,
    enabled: boolean,
  ) => {
    setPendingKey(provider.providerKey);
    try {
      const response = await fetch(`/api/games/providers/${provider.providerKey}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      });
      const data = await response.json();

      if (!response.ok) {
        // The refusals here are actionable (no adapter, no callback secret), so the
        // provider's own message is shown rather than a generic failure.
        toast.error(data.error ?? "Something went wrong. Please contact support.");
        return;
      }

      toast.success(
        enabled
          ? `${provider.displayName} is enabled.`
          : `${provider.displayName} will not accept new contests. Any already running will still finish.`,
      );
      await load();
    } catch {
      toast.error("Something went wrong. Please contact support.");
    } finally {
      setPendingKey(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-white/50">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading game providers…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-semibold text-white">
            <Plug className="h-6 w-6 text-violet-400" />
            Game Providers
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-white/60">
            Companies that supply games to run competitions on. A game reaches players only
            when the platform switch, the provider switch and that game&apos;s own switch are
            all on.
          </p>
        </div>
        <Button onClick={() => setRegisterOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Register provider
        </Button>
      </div>

      <Card className="border-white/10 bg-white/5 p-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <Power
              className={`mt-0.5 h-5 w-5 ${
                masterEnabled ? "text-emerald-400" : "text-white/40"
              }`}
            />
            <div>
              <div className="font-medium text-white/90">
                External games, platform-wide
              </div>
              <p className="text-sm text-white/60">
                The master switch. With this off, no external game runs no matter how any
                provider or game is configured.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {masterPending && (
              <Loader2 className="h-4 w-4 animate-spin text-white/40" />
            )}
            <Switch
              checked={masterEnabled}
              disabled={masterPending}
              onCheckedChange={handleMasterToggle}
            />
          </div>
        </div>
      </Card>

      {providers.length === 0 ? (
        <Card className="border-dashed border-white/15 bg-transparent p-12 text-center">
          <Plug className="mx-auto mb-3 h-8 w-8 text-white/25" />
          <div className="font-medium text-white/80">No providers registered yet</div>
          <p className="mx-auto mt-1 max-w-md text-sm text-white/50">
            Register a provider to store its API details, pull its game catalogue and choose
            which of its games go live here.
          </p>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {providers.map((provider) => (
            <ProviderCard
              key={provider.providerKey}
              provider={provider}
              masterEnabled={masterEnabled}
              pending={pendingKey === provider.providerKey}
              onToggle={(enabled) => handleProviderToggle(provider, enabled)}
              onCredentials={() => setCredentialsFor(provider)}
              onCatalogue={() => setCatalogueFor(provider)}
            />
          ))}
        </div>
      )}

      <ProviderRegisterDialog
        open={registerOpen}
        onOpenChange={setRegisterOpen}
        onRegistered={load}
        registeredAdapters={registeredAdapters}
      />
      <ProviderCredentialsDialog
        key={credentialsFor?.providerKey ?? "none"}
        provider={credentialsFor}
        open={Boolean(credentialsFor)}
        onOpenChange={(open) => !open && setCredentialsFor(null)}
        onSaved={load}
      />
      <ProviderCatalogueDialog
        provider={catalogueFor}
        open={Boolean(catalogueFor)}
        onOpenChange={(open) => !open && setCatalogueFor(null)}
        onChanged={load}
      />
    </div>
  );
}

function ProviderCard({
  provider,
  masterEnabled,
  pending,
  onToggle,
  onCredentials,
  onCatalogue,
}: {
  provider: GameProviderRow;
  masterEnabled: boolean;
  pending: boolean;
  onToggle: (enabled: boolean) => void;
  onCredentials: () => void;
  onCatalogue: () => void;
}) {
  const hasCallbackSecret = Boolean(provider.credentials?.hasCallbackSecret);

  // Reason for computing this rather than only disabling the switch: an operator needs to
  // know WHY a provider cannot go live, and the switch alone cannot say.
  const blockers: string[] = [];
  if (!provider.adapterInstalled) blockers.push("no connector installed in the code");
  if (!hasCallbackSecret) blockers.push("no callback secret stored");

  return (
    <Card className="border-white/10 bg-white/5 p-4">
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
          {provider.enabledTitleCount} of {provider.titleCount} games live
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

      <div className="mt-4 flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={onCredentials}>
          <KeyRound className="mr-2 h-3.5 w-3.5" />
          Credentials
        </Button>
        <Button size="sm" variant="outline" onClick={onCatalogue}>
          <Gamepad2 className="mr-2 h-3.5 w-3.5" />
          Games
        </Button>
      </div>
    </Card>
  );
}
