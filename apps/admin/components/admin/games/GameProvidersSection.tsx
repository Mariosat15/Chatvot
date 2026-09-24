"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Plug,
  Plus,
  Loader2,
  AlertTriangle,
  Power,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import ProviderRegisterDialog from "./ProviderRegisterDialog";
import ProviderCredentialsDialog from "./ProviderCredentialsDialog";
import ProviderCatalogueDialog from "./ProviderCatalogueDialog";
import ProviderCard from "./ProviderCard";
import { useTerms } from "@/contexts/TerminologyContext";
import type { GameProviderRow } from "./provider-types";
import { isCatalogueSyncStale } from "@/lib/services/game-providers/catalogue-sync-freshness";

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
 *
 * TWO MORE SWITCHES SIT BESIDE THE PROVIDER'S, AND THEY ARE NOT LINKS IN THAT CHAIN.
 * The three above answer "may this run". `autoOutageResponseEnabled` answers "may the
 * platform take this provider off sale by itself when it looks to be having an outage".
 * `autoCatalogueSyncFriday` answers "may the worker pull this catalogue every Friday at
 * 00:00 UTC". Both default off. They are deliberately separate controls with their own
 * wording, because a single switch could only ever mean "the opposite of whatever applies
 * right now".
 */

export default function GameProvidersSection() {
  const terms = useTerms();
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
        toast.error(data.error ?? `Failed to load ${terms.game} providers.`);
        return;
      }

      setProviders(data.providers ?? []);
      setMasterEnabled(Boolean(data.externalGamesEnabled));
      setRegisteredAdapters(data.registeredAdapters ?? []);
    } catch {
      toast.error(`Failed to load ${terms.game} providers.`);
    } finally {
      setLoading(false);
    }
  }, [terms]);

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
          ? `External ${terms.games} are switched on platform-wide.`
          : `External ${terms.games} are switched off platform-wide. ${terms.contests} already running will still finish.`,
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
          : `${provider.displayName} will not accept new ${terms.contests}. Any already running will still finish.`,
      );
      await load();
    } catch {
      toast.error("Something went wrong. Please contact support.");
    } finally {
      setPendingKey(null);
    }
  };

  /*
   * Deliberately a SECOND handler rather than a parameter on the one above. The two send
   * different fields, tell the operator different things and are refused together by the
   * route, so folding them into one function with a flag would put the "which decision is
   * this" branch in three places instead of none.
   */
  const handleAutoResponseToggle = async (
    provider: GameProviderRow,
    autoOutageResponseEnabled: boolean,
  ) => {
    setPendingKey(provider.providerKey);
    try {
      const response = await fetch(`/api/games/providers/${provider.providerKey}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ autoOutageResponseEnabled }),
      });
      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error ?? "Something went wrong. Please contact support.");
        return;
      }

      toast.success(
        autoOutageResponseEnabled
          ? `The platform may now take ${provider.displayName} off sale by itself during a sustained outage.`
          : `Outages at ${provider.displayName} will be alerted only. Taking it off sale is a manual decision.`,
      );
      await load();
    } catch {
      toast.error("Something went wrong. Please contact support.");
    } finally {
      setPendingKey(null);
    }
  };

  const handleFridaySyncToggle = async (
    provider: GameProviderRow,
    autoCatalogueSyncFriday: boolean,
  ) => {
    setPendingKey(provider.providerKey);
    try {
      const response = await fetch(`/api/games/providers/${provider.providerKey}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ autoCatalogueSyncFriday }),
      });
      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error ?? "Something went wrong. Please contact support.");
        return;
      }

      toast.success(
        autoCatalogueSyncFriday
          ? `${provider.displayName} will sync its catalogue every Friday at 00:00 UTC.`
          : `Friday auto-sync is off for ${provider.displayName}. Use Sync catalogue when you want a refresh.`,
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
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading {terms.game} providers…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-semibold text-white">
            <Plug className="h-6 w-6 text-violet-400" />
            {terms.game} Providers
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-white/60">
            Companies that supply {terms.games} to run {terms.contests} on. A {terms.game}{" "}
            reaches {terms.players} only when the platform switch, the provider switch and
            that {terms.game}&apos;s own switch are all on.
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
                External {terms.games}, platform-wide
              </div>
              <p className="text-sm text-white/60">
                The master switch. With this off, no external {terms.game} runs no matter how
                any provider or {terms.game} is configured.
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

      {providers.some(
        (p) => p.enabled && isCatalogueSyncStale(p.lastCatalogueSyncAt),
      ) && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-lg border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-100"
        >
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-400" />
          <div>
            <div className="font-medium text-red-50">
              Catalogue sync overdue (more than 7 days)
            </div>
            <p className="mt-1 text-red-100/80">
              At least one enabled provider has not synced in over seven days (or has never
              been synced). Open that provider&apos;s {terms.games} list and press{" "}
              <strong className="font-medium text-red-50">Sync catalogue</strong> — this
              notice clears once a sync succeeds. The security log records this once per
              episode; it does not repeat every minute.
            </p>
          </div>
        </div>
      )}

      {providers.length === 0 ? (
        <Card className="border-dashed border-white/15 bg-transparent p-12 text-center">
          <Plug className="mx-auto mb-3 h-8 w-8 text-white/25" />
          <div className="font-medium text-white/80">No providers registered yet</div>
          <p className="mx-auto mt-1 max-w-md text-sm text-white/50">
            Register a provider to store its API details, pull its {terms.game} catalogue and
            choose which of its {terms.games} go live here.
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
              onToggleAutoResponse={(auto) =>
                handleAutoResponseToggle(provider, auto)
              }
              onToggleFridaySync={(auto) =>
                handleFridaySyncToggle(provider, auto)
              }
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
