"use client";

import { useState } from "react";
import { toast } from "sonner";
import { KeyRound, Loader2, ShieldAlert, RotateCcw } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { GameProviderRow } from "./provider-types";

/**
 * Credential entry for one provider. WRITE-ONLY.
 *
 * These fields are never pre-filled, because the server has no endpoint that would return
 * a stored secret. That differs from the payment-providers screen, which shows saved values
 * behind an eye toggle - deliberately not copied (chapter 04 section 2.3).
 *
 * BLANK MEANS "KEEP THE STORED VALUE", never "clear it", and the labels say so. Getting
 * this wrong would be silent: an operator opening this dialog to switch environment and
 * saving would submit three empty boxes, and if empty meant "clear" that harmless action
 * would break every inbound result with no error anywhere.
 */

interface Props {
  provider: GameProviderRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

export default function ProviderCredentialsDialog({
  provider,
  open,
  onOpenChange,
  onSaved,
}: Props) {
  const [environment, setEnvironment] = useState<"sandbox" | "production">(
    provider?.credentials?.environment ?? "sandbox",
  );
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [callbackSecret, setCallbackSecret] = useState("");
  const [saving, setSaving] = useState(false);
  const [closingRotation, setClosingRotation] = useState(false);

  if (!provider) return null;

  const status = provider.credentials;

  const clearFields = () => {
    setApiKey("");
    setApiSecret("");
    setCallbackSecret("");
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await fetch(
        `/api/games/providers/${provider.providerKey}/credentials`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            environment,
            apiKey,
            apiSecret,
            callbackSecret,
          }),
        },
      );
      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error ?? "Something went wrong. Please contact support.");
        return;
      }

      toast.success("Credentials saved.");
      clearFields();
      onSaved();
      onOpenChange(false);
    } catch {
      toast.error("Something went wrong. Please contact support.");
    } finally {
      setSaving(false);
    }
  };

  const handleCloseRotation = async () => {
    setClosingRotation(true);
    try {
      const response = await fetch(
        `/api/games/providers/${provider.providerKey}/credentials`,
        { method: "POST" },
      );
      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error ?? "Something went wrong. Please contact support.");
        return;
      }

      toast.success("Rotation window closed. Only the new secret is accepted now.");
      onSaved();
    } catch {
      toast.error("Something went wrong. Please contact support.");
    } finally {
      setClosingRotation(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-violet-400" />
            Credentials — {provider.displayName}
          </DialogTitle>
          <DialogDescription>
            Stored secrets are never shown again. Leave a box empty to keep the value
            already saved.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border border-white/10 bg-white/5 p-3 text-sm">
            <div className="mb-2 font-medium text-white/90">What is stored now</div>
            <div className="flex flex-wrap gap-2">
              <StoredBadge label="API key" present={Boolean(status?.hasApiKey)} />
              <StoredBadge label="API secret" present={Boolean(status?.hasApiSecret)} />
              <StoredBadge
                label="Callback secret"
                present={Boolean(status?.hasCallbackSecret)}
              />
            </div>
          </div>

          {status?.hasPreviousCallbackSecret && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
              <div className="flex items-start gap-2">
                <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                <div className="space-y-2">
                  <p className="text-amber-200">
                    A rotation is in progress. Both the old and the new callback secret are
                    currently accepted, so results already in flight are not lost. Close the
                    window once the provider confirms they are signing with the new secret.
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleCloseRotation}
                    disabled={closingRotation}
                  >
                    {closingRotation ? (
                      <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                    ) : (
                      <RotateCcw className="mr-2 h-3 w-3" />
                    )}
                    Close rotation window
                  </Button>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label>Environment</Label>
            <Select
              value={environment}
              onValueChange={(value) =>
                setEnvironment(value as "sandbox" | "production")
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sandbox">Sandbox (test)</SelectItem>
                <SelectItem value="production">Production (live)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <SecretField
            id="apiKey"
            label="API key"
            value={apiKey}
            onChange={setApiKey}
            stored={Boolean(status?.hasApiKey)}
          />
          <SecretField
            id="apiSecret"
            label="API secret"
            value={apiSecret}
            onChange={setApiSecret}
            stored={Boolean(status?.hasApiSecret)}
          />
          <SecretField
            id="callbackSecret"
            label="Callback secret"
            value={callbackSecret}
            onChange={setCallbackSecret}
            stored={Boolean(status?.hasCallbackSecret)}
            hint="Used to prove a result really came from this provider. Changing it starts a rotation window in which the old secret is still accepted."
          />
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save credentials
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function StoredBadge({ label, present }: { label: string; present: boolean }) {
  return (
    <Badge
      variant="outline"
      className={
        present
          ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
          : "border-white/20 bg-white/5 text-white/50"
      }
    >
      {label}: {present ? "set" : "not set"}
    </Badge>
  );
}

function SecretField({
  id,
  label,
  value,
  onChange,
  stored,
  hint,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  stored: boolean;
  hint?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="password"
        autoComplete="off"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={stored ? "Leave blank to keep the saved value" : "Not set yet"}
      />
      {hint && <p className="text-xs text-white/50">{hint}</p>}
    </div>
  );
}
