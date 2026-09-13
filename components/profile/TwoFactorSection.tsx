"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Shield,
  ShieldCheck,
  ShieldOff,
  KeyRound,
  Loader2,
  Copy,
  Download,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

type Phase =
  | "loading"
  | "disabled"
  | "enabled"
  | "enrolling-password"
  | "enrolling-qr"
  | "enrolling-backup"
  | "disabling"
  | "regenerating";

interface EnrollmentState {
  totpURI: string;
  backupCodes: string[];
}

/**
 * TwoFactorSection
 * ----------------
 * Self-contained 2FA enrollment / management UI for the user profile.
 *
 * State machine:
 *   disabled → enrolling-password → enrolling-qr → enrolling-backup → enabled
 *   enabled  → disabling → disabled (after password confirm)
 *   enabled  → regenerating → enabled (new backup codes shown once)
 *
 * Note: We intentionally split the enrollment flow into three UI phases
 * to give the user time to (a) set up their authenticator, (b) prove
 * it works by entering a code, and (c) save their backup codes.
 */
export default function TwoFactorSection() {
  const [phase, setPhase] = useState<Phase>("loading");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [working, setWorking] = useState(false);
  const [enrollment, setEnrollment] = useState<EnrollmentState | null>(null);
  const [backupAcknowledged, setBackupAcknowledged] = useState(false);

  const refreshStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/user/2fa/status");
      const data = await res.json().catch(() => ({}));
      setPhase(data?.enabled ? "enabled" : "disabled");
    } catch {
      setPhase("disabled");
    }
  }, []);

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  const resetAll = () => {
    setPassword("");
    setCode("");
    setEnrollment(null);
    setBackupAcknowledged(false);
  };

  /* ------------------------- Enable flow ------------------------- */

  const startEnable = () => {
    resetAll();
    setPhase("enrolling-password");
  };

  const submitPasswordForEnable = async () => {
    if (!password) {
      toast.error("Please enter your password.");
      return;
    }
    setWorking(true);
    try {
      const res = await fetch("/api/user/2fa/enable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        toast.error(data?.error || "Could not start 2FA setup.");
        return;
      }
      setEnrollment({
        totpURI: data.totpURI,
        backupCodes: data.backupCodes || [],
      });
      setPhase("enrolling-qr");
    } finally {
      setWorking(false);
    }
  };

  const submitCodeForEnable = async () => {
    if (!/^\d{6,8}$/.test(code.trim())) {
      toast.error("Enter the 6-digit code from your authenticator app.");
      return;
    }
    setWorking(true);
    try {
      const res = await fetch("/api/user/2fa/verify-totp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        toast.error(data?.error || "Invalid code. Please try again.");
        return;
      }
      setPhase("enrolling-backup");
    } finally {
      setWorking(false);
    }
  };

  const finishEnrollment = () => {
    toast.success("Two-factor authentication is now active.");
    resetAll();
    setPhase("enabled");
  };

  /* ------------------------- Disable flow ------------------------ */

  const startDisable = () => {
    resetAll();
    setPhase("disabling");
  };

  const submitPasswordForDisable = async () => {
    if (!password) {
      toast.error("Please enter your password.");
      return;
    }
    setWorking(true);
    try {
      const res = await fetch("/api/user/2fa/disable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        toast.error(data?.error || "Could not disable 2FA.");
        return;
      }
      toast.success("Two-factor authentication disabled.");
      resetAll();
      setPhase("disabled");
    } finally {
      setWorking(false);
    }
  };

  /* ----------------------- Regenerate flow ---------------------- */

  const startRegenerate = () => {
    resetAll();
    setPhase("regenerating");
  };

  const submitPasswordForRegenerate = async () => {
    if (!password) {
      toast.error("Please enter your password.");
      return;
    }
    setWorking(true);
    try {
      const res = await fetch("/api/user/2fa/regenerate-backup-codes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        toast.error(data?.error || "Could not regenerate codes.");
        return;
      }
      setEnrollment({ totpURI: "", backupCodes: data.backupCodes || [] });
      setPhase("enrolling-backup");
    } finally {
      setWorking(false);
    }
  };

  /* -------------------------- Helpers --------------------------- */

  const copyBackupCodes = async () => {
    if (!enrollment?.backupCodes?.length) return;
    try {
      await navigator.clipboard.writeText(enrollment.backupCodes.join("\n"));
      toast.success("Backup codes copied to clipboard.");
    } catch {
      toast.error("Could not copy to clipboard.");
    }
  };

  const downloadBackupCodes = () => {
    if (!enrollment?.backupCodes?.length) return;
    const blob = new Blob(
      [
        "ChartVolt 2FA backup codes\n",
        "--------------------------------\n",
        "Keep these somewhere safe. Each code can be used once if you\n",
        "lose access to your authenticator app.\n\n",
        enrollment.backupCodes.join("\n"),
        "\n",
      ],
      { type: "text/plain" },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "chartvolt-backup-codes.txt";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  /* --------------------------- Render --------------------------- */

  return (
    <div className="bg-dark-700/50 rounded-2xl p-6 shadow-xl border border-dark-600">
      <div className="flex items-center gap-3 mb-6">
        <ShieldCheck className="h-6 w-6 text-green-500" />
        <h2 className="text-2xl font-bold text-white">
          Two-Factor Authentication
        </h2>
      </div>

      {phase === "loading" && (
        <div className="flex items-center gap-2 text-gray-400 text-sm">
          <Loader2 className="h-4 w-4 animate-spin" />
          Checking 2FA status...
        </div>
      )}

      {phase === "disabled" && (
        <div className="space-y-4">
          <p className="text-sm text-gray-400">
            Protect your account with an authenticator app (Google Authenticator,
            1Password, Authy, etc.). We&apos;ll also require a verification code
            before approving withdrawals and sensitive account changes.
          </p>
          <Button
            onClick={startEnable}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            <Shield className="h-4 w-4 mr-2" />
            Enable 2FA
          </Button>
        </div>
      )}

      {phase === "enabled" && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
            <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0" />
            <p className="text-sm text-green-300">
              Two-factor authentication is enabled on this account.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={startRegenerate}
              variant="outline"
              className="border-gray-600 text-gray-200 hover:bg-gray-800"
            >
              <KeyRound className="h-4 w-4 mr-2" />
              Regenerate backup codes
            </Button>
            <Button
              onClick={startDisable}
              variant="outline"
              className="border-red-600/40 text-red-400 hover:bg-red-500/10"
            >
              <ShieldOff className="h-4 w-4 mr-2" />
              Disable 2FA
            </Button>
          </div>
        </div>
      )}

      {phase === "enrolling-password" && (
        <PasswordStep
          title="Confirm your password to start 2FA setup"
          password={password}
          onPasswordChange={setPassword}
          onCancel={() => {
            resetAll();
            setPhase("disabled");
          }}
          onSubmit={submitPasswordForEnable}
          working={working}
          submitLabel="Continue"
        />
      )}

      {phase === "enrolling-qr" && enrollment && (
        <div className="space-y-5">
          <p className="text-sm text-gray-300">
            Scan this QR code with your authenticator app, then enter the 6-digit
            code it shows to finish setup.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 items-center">
            <div className="p-4 bg-white rounded-lg">
              <QRCodeSVG value={enrollment.totpURI} size={180} />
            </div>
            <div className="text-xs text-gray-400 break-all font-mono bg-gray-900/50 p-3 rounded-lg flex-1">
              <span className="block mb-1 text-gray-500">
                Can&apos;t scan? Paste this URI manually:
              </span>
              {enrollment.totpURI}
            </div>
          </div>

          <div className="space-y-2 max-w-xs">
            <Label className="text-sm text-gray-300">
              Code from your app
            </Label>
            <Input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="123456"
              className="bg-gray-900/60 border-gray-700 text-white text-center tracking-widest"
            />
          </div>

          <div className="flex gap-2">
            <Button
              onClick={submitCodeForEnable}
              disabled={working}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              {working ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Verifying...
                </>
              ) : (
                "Verify and continue"
              )}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                resetAll();
                setPhase("disabled");
              }}
              disabled={working}
              className="border-gray-600 text-gray-300"
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {phase === "enrolling-backup" && enrollment && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
            <AlertTriangle className="h-5 w-5 text-yellow-500 flex-shrink-0" />
            <p className="text-sm text-yellow-200">
              Save these backup codes now — they are shown only once. Each code
              can be used once to sign in if you lose your authenticator.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 font-mono text-sm bg-gray-900/60 p-4 rounded-lg">
            {enrollment.backupCodes.map((c, i) => (
              <div key={i} className="text-gray-200">
                {c}
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={copyBackupCodes}
              className="border-gray-600 text-gray-200 hover:bg-gray-800"
            >
              <Copy className="h-4 w-4 mr-2" />
              Copy
            </Button>
            <Button
              variant="outline"
              onClick={downloadBackupCodes}
              className="border-gray-600 text-gray-200 hover:bg-gray-800"
            >
              <Download className="h-4 w-4 mr-2" />
              Download .txt
            </Button>
          </div>

          <label className="flex items-start gap-2 text-sm text-gray-300 select-none">
            <input
              type="checkbox"
              checked={backupAcknowledged}
              onChange={(e) => setBackupAcknowledged(e.target.checked)}
              className="mt-1 accent-green-500"
            />
            I have saved my backup codes in a safe place.
          </label>

          <Button
            onClick={finishEnrollment}
            disabled={!backupAcknowledged}
            className="bg-green-600 hover:bg-green-700 text-white disabled:bg-gray-700"
          >
            Done
          </Button>
        </div>
      )}

      {phase === "disabling" && (
        <PasswordStep
          title="Confirm your password to disable 2FA"
          password={password}
          onPasswordChange={setPassword}
          onCancel={() => {
            resetAll();
            setPhase("enabled");
          }}
          onSubmit={submitPasswordForDisable}
          working={working}
          submitLabel="Disable 2FA"
          danger
        />
      )}

      {phase === "regenerating" && (
        <PasswordStep
          title="Confirm your password to regenerate backup codes"
          password={password}
          onPasswordChange={setPassword}
          onCancel={() => {
            resetAll();
            setPhase("enabled");
          }}
          onSubmit={submitPasswordForRegenerate}
          working={working}
          submitLabel="Generate new codes"
        />
      )}
    </div>
  );
}

/* Small local component for password confirmation steps. Keeps the main
   render tree readable without splitting files. */
function PasswordStep({
  title,
  password,
  onPasswordChange,
  onSubmit,
  onCancel,
  working,
  submitLabel,
  danger,
}: {
  title: string;
  password: string;
  onPasswordChange: (v: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
  working: boolean;
  submitLabel: string;
  danger?: boolean;
}) {
  return (
    <div className="space-y-4 max-w-md">
      <p className="text-sm text-gray-300">{title}</p>
      <Input
        type="password"
        value={password}
        onChange={(e) => onPasswordChange(e.target.value)}
        placeholder="Current password"
        className="bg-gray-900/60 border-gray-700 text-white"
      />
      <div className="flex gap-2">
        <Button
          onClick={onSubmit}
          disabled={working}
          className={
            danger
              ? "bg-red-600 hover:bg-red-700 text-white"
              : "bg-green-600 hover:bg-green-700 text-white"
          }
        >
          {working ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Working...
            </>
          ) : (
            submitLabel
          )}
        </Button>
        <Button
          variant="outline"
          onClick={onCancel}
          disabled={working}
          className="border-gray-600 text-gray-300"
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
