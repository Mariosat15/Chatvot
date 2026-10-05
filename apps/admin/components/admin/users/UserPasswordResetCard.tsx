"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Copy, Eye, EyeOff, KeyRound, RefreshCw, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DIALOG_WIDTH_STANDARD } from "@/lib/admin/dialog-widths";

const MIN_LENGTH = 8;
// Reason: no 0/O/1/l/I, so a password read aloud to a player over chat is not mistyped.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%*";

/** A random 14-character password from the browser's cryptographic generator. */
function generatePassword(length = 14): string {
  const bytes = new Uint32Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
}

interface UserPasswordResetCardProps {
  userId: string;
  userEmail: string;
}

/** "Password" row on the user's Security tab: an admin sets a new sign-in password. */
export default function UserPasswordResetCard({
  userId,
  userEmail,
}: UserPasswordResetCardProps) {
  const [open, setOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [adminPassword, setAdminPassword] = useState("");
  const [revokeSessions, setRevokeSessions] = useState(true);
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setNewPassword("");
    setRevealed(false);
    setAdminPassword("");
    setRevokeSessions(true);
  };

  const handleGenerate = () => {
    setNewPassword(generatePassword());
    setRevealed(true);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(newPassword);
      toast.success("Password copied");
    } catch {
      toast.error("Could not copy - select the text and copy it by hand.");
    }
  };

  const handleSubmit = async () => {
    if (newPassword.length < MIN_LENGTH) {
      toast.error(`The new password must be at least ${MIN_LENGTH} characters.`);
      return;
    }
    if (!adminPassword) {
      toast.error("Enter your admin password to confirm.");
      return;
    }
    setSaving(true);
    try {
      const response = await fetch(`/api/users/${userId}/password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword, adminPassword, revokeSessions }),
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok && data.success) {
        toast.success(data.message || "Password updated.");
        setOpen(false);
        reset();
      } else {
        toast.error(data.error || "Something went wrong. Please contact support.");
      }
    } catch (error) {
      console.error("❌ Error resetting password:", error);
      toast.error("Something went wrong. Please contact support.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="p-3 rounded-lg border bg-gray-700/30 border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-cyan-400" />
            <div>
              <p className="text-sm font-medium text-white">Password</p>
              <p className="text-xs text-gray-400">
                Set a new sign-in password for this user
              </p>
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setOpen(true)}
            className="text-cyan-400"
          >
            <KeyRound className="h-4 w-4 mr-1" />
            Reset Password
          </Button>
        </div>
      </div>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) reset();
        }}
      >
        <DialogContent className={`${DIALOG_WIDTH_STANDARD} bg-gray-800 border-gray-700`}>
          <DialogHeader>
            <DialogTitle className="text-white">Reset password</DialogTitle>
            <DialogDescription className="text-gray-400">
              New password for {userEmail || "this user"}. Give it to the user privately -
              it is not emailed.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="admin-new-user-password" className="text-sm text-gray-300">
                New password
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    id="admin-new-user-password"
                    type={revealed ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    autoComplete="new-password"
                    placeholder={`At least ${MIN_LENGTH} characters`}
                    className="bg-gray-900 border-gray-700 pr-10 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setRevealed((v) => !v)}
                    className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-gray-400 hover:text-white"
                    aria-label={revealed ? "Hide password" : "Show password"}
                  >
                    {revealed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <Button type="button" variant="outline" size="icon" onClick={handleGenerate} title="Generate">
                  <Wand2 className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={handleCopy}
                  disabled={!newPassword}
                  title="Copy"
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm text-gray-300">
              <input
                type="checkbox"
                checked={revokeSessions}
                onChange={(e) => setRevokeSessions(e.target.checked)}
                className="h-4 w-4 accent-cyan-500"
              />
              Sign the user out on every device
            </label>

            <div className="space-y-2">
              <label htmlFor="admin-confirm-password" className="text-sm text-gray-300">
                Your admin password
              </label>
              <Input
                id="admin-confirm-password"
                type="password"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                autoComplete="current-password"
                className="bg-gray-900 border-gray-700"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={saving || newPassword.length < MIN_LENGTH || !adminPassword}
              className="bg-cyan-600 hover:bg-cyan-700 text-white"
            >
              {saving && <RefreshCw className="h-4 w-4 mr-2 animate-spin" />}
              Set password
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
