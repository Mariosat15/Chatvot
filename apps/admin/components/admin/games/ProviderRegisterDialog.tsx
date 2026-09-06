"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Info } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Registering a provider.
 *
 * THE KEY IS PERMANENT, AND THE FORM SAYS SO BEFORE IT IS TYPED, NOT AFTER. It becomes part
 * of every `gameKey` (`provider:<key>:<code>`), which is the join key for all historical
 * stats and is immutable. So a typo here cannot be corrected later without orphaning every
 * round played under it - a warning shown only on the edit screen would arrive too late to
 * be useful.
 */

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRegistered: () => void;
  /** Adapter keys that exist in code. Registering another key is allowed but cannot go live. */
  registeredAdapters: string[];
}

export default function ProviderRegisterDialog({
  open,
  onOpenChange,
  onRegistered,
  registeredAdapters,
}: Props) {
  const [providerKey, setProviderKey] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [saving, setSaving] = useState(false);

  const normalisedKey = providerKey.trim().toLowerCase();
  const adapterMissing =
    normalisedKey.length > 0 && !registeredAdapters.includes(normalisedKey);

  const handleSubmit = async () => {
    setSaving(true);
    try {
      const response = await fetch("/api/games/providers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "register",
          providerKey: normalisedKey,
          displayName,
          baseUrl,
          logoUrl,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error ?? "Something went wrong. Please contact support.");
        return;
      }

      toast.success(
        `${displayName} registered. It stays switched off until credentials are added.`,
      );
      setProviderKey("");
      setDisplayName("");
      setBaseUrl("");
      setLogoUrl("");
      onRegistered();
      onOpenChange(false);
    } catch {
      toast.error("Something went wrong. Please contact support.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Register a game provider</DialogTitle>
          <DialogDescription>
            A newly registered provider is switched off. Nothing reaches players until you
            add credentials, enable the provider and enable individual games.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="providerKey">Provider key</Label>
            <Input
              id="providerKey"
              value={providerKey}
              onChange={(event) => setProviderKey(event.target.value)}
              placeholder="acme-games"
            />
            <p className="text-xs text-amber-300/80">
              Permanent. This key is built into every game and every score recorded for this
              provider, so it can never be renamed afterwards. Lowercase letters, numbers and
              hyphens.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="displayName">Display name</Label>
            <Input
              id="displayName"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              placeholder="ACME Games"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="baseUrl">API base URL</Label>
            <Input
              id="baseUrl"
              value={baseUrl}
              onChange={(event) => setBaseUrl(event.target.value)}
              placeholder="https://api.acme-games.com"
            />
            <p className="text-xs text-white/50">
              Must be https, unless the provider runs on this machine, in which case http on
              localhost is accepted.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="logoUrl">Logo URL (optional)</Label>
            <Input
              id="logoUrl"
              value={logoUrl}
              onChange={(event) => setLogoUrl(event.target.value)}
              placeholder="https://…"
            />
          </div>

          {adapterMissing && (
            <div className="rounded-lg border border-sky-500/30 bg-sky-500/10 p-3 text-sm text-sky-200">
              <div className="flex items-start gap-2">
                <Info className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  No connector for <span className="font-mono">{normalisedKey}</span> exists
                  in the code yet, so this provider can be recorded but not switched on.
                  Adding a title from a provider we already connect to needs no developer;
                  connecting to a brand new provider needs a release.
                </span>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={saving || !normalisedKey || !displayName || !baseUrl}
          >
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Register provider
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
