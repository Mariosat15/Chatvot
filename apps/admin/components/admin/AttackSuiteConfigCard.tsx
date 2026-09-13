"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Settings,
  RefreshCw,
  Power,
  PowerOff,
  KeyRound,
  Copy,
  Check,
  Loader2,
  AlertTriangle,
} from "lucide-react";

/**
 * Configuration card for the Attack Suite.
 *
 * Lives at the top of the Attack Suite tab. Replaces the old env-var based
 * control with a DB-backed admin-only flow:
 *   - Enable / Disable toggle
 *   - Rotate Secret (server-generated 32-byte hex; revealed once in a dialog)
 *   - Revoke Secret (force-disables the suite)
 *
 * Never displays the raw secret except in the one-time rotation dialog.
 */

interface PublicConfig {
  enabled: boolean;
  secretSet: boolean;
  secretPreview: string | null;
  secretSetAt: string | null;
  updatedBy: { adminId: string; email: string; name?: string } | null;
  updatedAt: string | null;
}

interface AttackSuiteConfigCardProps {
  onChange?: (cfg: PublicConfig) => void;
  /** When true, mutation buttons are disabled (e.g. a run is in flight) */
  mutationsLocked?: boolean;
}

export default function AttackSuiteConfigCard({
  onChange,
  mutationsLocked = false,
}: AttackSuiteConfigCardProps) {
  const [config, setConfig] = useState<PublicConfig | null>(null);
  const [busy, setBusy] = useState<null | "toggle" | "rotate" | "revoke">(null);
  const [revealedSecret, setRevealedSecret] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const fetchConfig = useCallback(async () => {
    try {
      const res = await fetch("/api/simulator/attack-tests/config", {
        cache: "no-store",
      });
      if (!res.ok) return;
      const data = (await res.json()) as { success: boolean; config: PublicConfig };
      if (data.success) {
        setConfig(data.config);
        onChange?.(data.config);
      }
    } catch (err) {
      console.error("AttackSuiteConfigCard fetch failed:", err);
    }
  }, [onChange]);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  async function mutate(action: "enable" | "disable" | "rotate" | "revoke") {
    const stateKey =
      action === "enable" || action === "disable"
        ? "toggle"
        : action === "rotate"
          ? "rotate"
          : "revoke";
    setBusy(stateKey);
    try {
      const res = await fetch("/api/simulator/attack-tests/config", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast.error(data.error || `Action "${action}" failed`);
        return;
      }

      if (action === "rotate" && typeof data.secret === "string") {
        setRevealedSecret(data.secret);
        setCopied(false);
      }

      if (data.config) {
        setConfig(data.config);
        onChange?.(data.config);
      }

      const label: Record<string, string> = {
        enable: "Attack Suite enabled",
        disable: "Attack Suite disabled",
        rotate: "Secret rotated",
        revoke: "Secret revoked",
      };
      // eslint-disable-next-line security/detect-object-injection -- action is a fixed union of literals
      toast.success(label[action] || "Updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : `Action "${action}" failed`);
    } finally {
      setBusy(null);
    }
  }

  async function copyRevealed() {
    if (!revealedSecret) return;
    try {
      await navigator.clipboard.writeText(revealedSecret);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.error("Copy failed — select manually");
    }
  }

  const loading = config === null;
  const enabled = config?.enabled ?? false;
  const secretSet = config?.secretSet ?? false;

  return (
    <>
      <Card className="bg-gray-900/60 border-gray-700">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <Settings className="h-5 w-5 text-cyan-400" />
            Configuration
          </CardTitle>
          <CardDescription className="text-gray-400">
            Enable or disable the Attack Suite and rotate the inter-service
            secret. All changes are audit-logged under the{" "}
            <span className="text-gray-300">security</span> category.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Status row */}
            <div className="rounded border border-gray-700 bg-gray-800/40 p-3">
              <div className="text-xs text-gray-400 mb-1">Status</div>
              {loading ? (
                <Badge className="bg-gray-800 text-gray-300 border-gray-700">
                  Loading...
                </Badge>
              ) : enabled ? (
                <Badge className="bg-emerald-900 text-emerald-200 border-emerald-700">
                  <Power className="h-3 w-3 mr-1" />
                  Enabled
                </Badge>
              ) : (
                <Badge className="bg-gray-800 text-gray-300 border-gray-700">
                  <PowerOff className="h-3 w-3 mr-1" />
                  Disabled
                </Badge>
              )}
              {config?.updatedBy && config?.updatedAt && (
                <div className="text-xs text-gray-500 mt-2">
                  {(config.updatedBy.name || config.updatedBy.email) + " · "}
                  {new Date(config.updatedAt).toLocaleString()}
                </div>
              )}
            </div>

            {/* Secret row */}
            <div className="rounded border border-gray-700 bg-gray-800/40 p-3">
              <div className="text-xs text-gray-400 mb-1">Secret</div>
              {loading ? (
                <Badge className="bg-gray-800 text-gray-300 border-gray-700">
                  Loading...
                </Badge>
              ) : secretSet ? (
                <div className="flex items-center gap-2">
                  <code className="text-xs text-gray-200 bg-black/40 px-2 py-1 rounded">
                    {config?.secretPreview}
                  </code>
                  <Badge className="bg-emerald-900 text-emerald-200 border-emerald-700">
                    <KeyRound className="h-3 w-3 mr-1" />
                    Set
                  </Badge>
                </div>
              ) : (
                <Badge className="bg-red-900 text-red-200 border-red-700">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  Not set
                </Badge>
              )}
              {config?.secretSetAt && (
                <div className="text-xs text-gray-500 mt-2">
                  Rotated {new Date(config.secretSetAt).toLocaleString()}
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            <Button
              size="sm"
              onClick={() => mutate(enabled ? "disable" : "enable")}
              disabled={
                loading ||
                busy !== null ||
                mutationsLocked ||
                (!enabled && !secretSet)
              }
              className={
                enabled
                  ? "bg-amber-700 hover:bg-amber-600 text-white"
                  : "bg-emerald-600 hover:bg-emerald-500 text-white"
              }
            >
              {busy === "toggle" ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : enabled ? (
                <PowerOff className="h-4 w-4 mr-2" />
              ) : (
                <Power className="h-4 w-4 mr-2" />
              )}
              {enabled ? "Disable Suite" : "Enable Suite"}
            </Button>

            <Button
              size="sm"
              variant="outline"
              onClick={() => mutate("rotate")}
              disabled={loading || busy !== null || mutationsLocked}
              className="text-gray-300 border-gray-600 hover:bg-gray-800"
            >
              {busy === "rotate" ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              {secretSet ? "Rotate Secret" : "Generate Secret"}
            </Button>

            {secretSet && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  if (
                    confirm(
                      "Revoke the Attack Suite secret? This will force-disable the suite until a new secret is generated.",
                    )
                  ) {
                    mutate("revoke");
                  }
                }}
                disabled={loading || busy !== null || mutationsLocked}
                className="text-red-300 border-red-900 hover:bg-red-950"
              >
                {busy === "revoke" ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <KeyRound className="h-4 w-4 mr-2" />
                )}
                Revoke Secret
              </Button>
            )}
          </div>

          {!secretSet && !loading && (
            <div className="rounded border border-amber-700 bg-amber-900/20 p-3 text-amber-200 text-xs">
              Click <strong>Generate Secret</strong> first — the suite cannot
              be enabled without an inter-service secret.
            </div>
          )}

          {mutationsLocked && !loading && (
            <div className="rounded border border-gray-700 bg-gray-800/40 p-3 text-gray-300 text-xs">
              Configuration is locked while an attack run is in progress. Wait
              for it to finish before rotating or revoking.
            </div>
          )}
        </CardContent>
      </Card>

      {/* One-time reveal dialog for a freshly rotated secret */}
      {revealedSecret && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          role="dialog"
          aria-modal="true"
        >
          <Card className="w-full max-w-xl bg-gray-900 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <KeyRound className="h-5 w-5 text-amber-400" />
                New Attack Suite Secret
              </CardTitle>
              <CardDescription className="text-gray-400">
                This is the only time the full secret is shown. Copy it now
                if you need it for out-of-band debugging — afterwards only a
                masked preview remains.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <code className="block text-xs text-gray-100 bg-black/50 p-3 rounded break-all">
                {revealedSecret}
              </code>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={copyRevealed}
                  className="bg-cyan-700 hover:bg-cyan-600 text-white"
                >
                  {copied ? (
                    <>
                      <Check className="h-4 w-4 mr-2" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4 mr-2" />
                      Copy
                    </>
                  )}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setRevealedSecret(null)}
                  className="text-gray-300 border-gray-600 hover:bg-gray-800"
                >
                  Close
                </Button>
              </div>
              <p className="text-xs text-gray-500">
                The admin app and main app both read this secret from the
                database — you don&apos;t need to paste it anywhere for the
                suite itself to work.
              </p>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}
