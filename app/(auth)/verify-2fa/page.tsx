"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, ShieldCheck, KeyRound, Mail } from "lucide-react";
import { trackDeviceFingerprint } from "@/lib/services/device-fingerprint.service";

type Mode = "totp" | "backup" | "email";

const VerifyTwoFactorPage = () => {
  const router = useRouter();
  const searchParams = useSearchParams();

  const availableMethods = useMemo(() => {
    const raw = searchParams.get("methods") || "totp";
    return raw.split(",").map((s) => s.trim()).filter(Boolean);
  }, [searchParams]);

  const [mode, setMode] = useState<Mode>("totp");
  const [code, setCode] = useState("");
  const [trustDevice, setTrustDevice] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);

  const endpointForMode = (m: Mode): string => {
    if (m === "backup") return "/api/user/2fa/verify-backup-code";
    if (m === "email") return "/api/user/2fa/verify-otp";
    return "/api/user/2fa/verify-totp";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) {
      toast.error("Please enter your verification code.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(endpointForMode(mode), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim(), trustDevice }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data?.success) {
        toast.error(data?.error || "Could not verify the code.");
        setSubmitting(false);
        return;
      }

      toast.success("Signed in successfully.");
      try {
        await trackDeviceFingerprint();
      } catch {
        // Non-blocking — fingerprint failure should not stop login.
      }
      router.push("/");
    } catch (err) {
      console.error("2FA verify error:", err);
      toast.error("Could not verify the code. Please try again.");
      setSubmitting(false);
    }
  };

  const handleSendEmailCode = async () => {
    setSendingEmail(true);
    try {
      const res = await fetch("/api/user/2fa/send-otp", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        toast.error(data?.error || "Could not send email code.");
        return;
      }
      toast.success("Code sent to your email.");
      setMode("email");
      setCode("");
    } catch {
      toast.error("Could not send email code.");
    } finally {
      setSendingEmail(false);
    }
  };

  return (
    <>
      <h1 className="form-title">Two-factor verification</h1>
      <p className="text-sm text-gray-400 mb-6">
        For your security, enter a code to finish signing in.
      </p>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-2">
          <Label className="text-sm text-gray-300">
            {mode === "totp" && "Authenticator app code"}
            {mode === "backup" && "Backup code"}
            {mode === "email" && "Email verification code"}
          </Label>
          <Input
            type="text"
            inputMode={mode === "backup" ? "text" : "numeric"}
            autoComplete="one-time-code"
            autoFocus
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder={
              mode === "backup" ? "XXXX-XXXX" : "6-digit code"
            }
            className="bg-gray-900/60 border-gray-700 text-white text-lg tracking-widest text-center"
          />
        </div>

        <label className="flex items-center gap-2 text-sm text-gray-400 select-none">
          <input
            type="checkbox"
            checked={trustDevice}
            onChange={(e) => setTrustDevice(e.target.checked)}
            className="accent-yellow-500"
          />
          Trust this device for 60 days
        </label>

        <Button
          type="submit"
          disabled={submitting}
          className="yellow-btn w-full"
        >
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Verifying...
            </>
          ) : (
            <>
              <ShieldCheck className="h-4 w-4 mr-2" />
              Verify and sign in
            </>
          )}
        </Button>

        <div className="pt-4 border-t border-gray-800 space-y-2">
          {mode !== "totp" && (
            <Button
              type="button"
              variant="ghost"
              className="w-full justify-start text-sm text-gray-400 hover:text-white"
              onClick={() => {
                setMode("totp");
                setCode("");
              }}
            >
              <ShieldCheck className="h-4 w-4 mr-2" />
              Use authenticator app
            </Button>
          )}

          {mode !== "backup" && (
            <Button
              type="button"
              variant="ghost"
              className="w-full justify-start text-sm text-gray-400 hover:text-white"
              onClick={() => {
                setMode("backup");
                setCode("");
              }}
            >
              <KeyRound className="h-4 w-4 mr-2" />
              Use a backup code
            </Button>
          )}

          {availableMethods.includes("otp") && mode !== "email" && (
            <Button
              type="button"
              variant="ghost"
              className="w-full justify-start text-sm text-gray-400 hover:text-white"
              onClick={handleSendEmailCode}
              disabled={sendingEmail}
            >
              {sendingEmail ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Sending email code...
                </>
              ) : (
                <>
                  <Mail className="h-4 w-4 mr-2" />
                  Email me a code instead
                </>
              )}
            </Button>
          )}
        </div>
      </form>
    </>
  );
};

export default VerifyTwoFactorPage;
