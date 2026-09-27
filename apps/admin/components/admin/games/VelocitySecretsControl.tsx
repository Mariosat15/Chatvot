"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { KeyRound, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  VELOCITY_RESTART_COMMAND,
  VELOCITY_ROTATE_CONFIRMATION,
} from "@/lib/admin/velocity-secrets-copy";
import type { ProviderTitleRow } from "./provider-types";

/**
 * Generate the two Volt Velocity secrets into games-service/.env.
 *
 * The route says which title the secrets belong to, so this screen names no game itself - it
 * renders nothing on every other title. No value is ever shown: the server reports "set" or
 * "not set" and nothing more (see `velocity-secrets.service.ts`).
 */

interface Status {
  gameCode: string;
  envPath: string;
  fileFound: boolean;
  adminKeyConfigured: boolean;
  ticketSecretConfigured: boolean;
  secretsEqual: boolean;
}

export default function VelocitySecretsControl({ title }: { title: ProviderTitleRow }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [confirm, setConfirm] = useState("");
  const [working, setWorking] = useState(false);
  const [restartNeeded, setRestartNeeded] = useState(false);

  useEffect(() => {
    let mounted = true;
    fetch("/api/games/velocity-secrets")
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (mounted && data?.success) setStatus(data as Status);
      })
      .catch(() => undefined);
    return () => {
      mounted = false;
    };
  }, []);

  if (!status || status.gameCode !== title.gameCode) return null;

  const configured = status.adminKeyConfigured && status.ticketSecretConfigured;
  const partlySet = status.adminKeyConfigured !== status.ticketSecretConfigured;
  const needsConfirm = status.adminKeyConfigured || status.ticketSecretConfigured;

  const generate = async () => {
    setWorking(true);
    try {
      const response = await fetch("/api/games/velocity-secrets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(needsConfirm ? { confirm } : {}),
      });
      const data = await response.json();
      if (!response.ok) {
        toast.error(data.error ?? "Something went wrong. Please contact support.");
        return;
      }
      setStatus({
        ...status,
        adminKeyConfigured: true,
        ticketSecretConfigured: true,
        secretsEqual: false,
      });
      setConfirm("");
      setRestartNeeded(true);
      toast.success(
        data.rotated
          ? "New race secrets saved. Restart the game services to use them."
          : "Race secrets saved. Restart the game services to use them.",
      );
    } catch {
      toast.error("Something went wrong. Please contact support.");
    } finally {
      setWorking(false);
    }
  };

  return (
    <div className="mt-4 space-y-2 border-t border-white/10 pt-3">
      <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-white/35">
        <KeyRound className="h-3 w-3" /> Race server secrets
      </p>
      <p className="text-xs text-white/60">
        {!status.fileFound
          ? "The games-service .env file was not found, so nothing can be saved yet."
          : configured && !status.secretsEqual
            ? "Set. Races can run."
            : status.secretsEqual
              ? "Set to the same value twice - the race server will not start. Generate new ones."
              : partlySet
                ? "Only one of the two is set - the games service will not start. Generate both."
                : "Not set. The race is shown as under maintenance until they are."}
      </p>
      <p className="break-all font-mono text-[11px] text-white/35">{status.envPath}</p>

      {status.fileFound && (
        <div className="space-y-2">
          {needsConfirm && (
            <div className="space-y-1">
              <p className="text-xs text-amber-300/80">
                Replacing them ends every race in progress. Type {VELOCITY_ROTATE_CONFIRMATION} to
                confirm.
              </p>
              <Input
                value={confirm}
                disabled={working}
                onChange={(event) => setConfirm(event.target.value)}
                placeholder={VELOCITY_ROTATE_CONFIRMATION}
                className="h-8 w-40 border-white/15 bg-white/5 text-xs text-white/90"
              />
            </div>
          )}
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs"
            disabled={working || (needsConfirm && confirm !== VELOCITY_ROTATE_CONFIRMATION)}
            onClick={() => void generate()}
          >
            {working && <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />}
            {needsConfirm ? "Replace secrets" : "Generate secrets"}
          </Button>
        </div>
      )}

      {restartNeeded && (
        <p className="text-xs text-white/60">
          Now run on the server:{" "}
          <code className="rounded bg-white/10 px-1 py-0.5 font-mono text-[11px] text-white/80">
            {VELOCITY_RESTART_COMMAND}
          </code>
        </p>
      )}
    </div>
  );
}
