"use client";

import { useEffect, useState } from "react";
import { AtSign, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { USERNAME_MAX_LENGTH, validateUsername } from "@/lib/utils/username";

/**
 * The player's public handle - the only name other players see.
 *
 * Accounts created before usernames existed have none and are shown as a generated
 * `Player_xxxxxx` name until they pick one here. The format rule is the same function the
 * server runs; the server stays the authority on whether the name is free.
 */
export default function UsernameSection() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [current, setCurrent] = useState<string | null>(null);
  const [publicName, setPublicName] = useState("");
  const [draft, setDraft] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/user/username")
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("load"))))
      .then((data: { username: string | null; publicName: string }) => {
        if (cancelled) return;
        setCurrent(data.username);
        setPublicName(data.publicName);
        setDraft(data.username ?? "");
      })
      .catch(() => toast.error("Could not load your username"))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  const parsed = validateUsername(draft);
  const unchanged = parsed.ok && parsed.value === current;
  const formatError = draft.trim() && !parsed.ok ? parsed.error : null;

  const save = async () => {
    if (!parsed.ok || unchanged) return;
    setSaving(true);
    try {
      const res = await fetch("/api/user/username", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: parsed.value }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || "Something went wrong. Please contact support.");
        return;
      }
      setCurrent(data.username);
      setPublicName(data.username);
      setDraft(data.username);
      toast.success("Username updated");
    } catch {
      toast.error("Something went wrong. Please contact support.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-dark-700/50 rounded-2xl p-6 shadow-xl border border-dark-600">
      <div className="flex items-center gap-3 mb-2">
        <AtSign className="h-6 w-6 text-cyan-400" />
        <h2 className="text-2xl font-bold text-white">Username</h2>
      </div>
      <p className="text-sm text-gray-400 mb-4">
        This is the only name other players see. Your real name stays private.
      </p>

      {loading ? (
        <div className="flex items-center gap-2 text-gray-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Loading…</span>
        </div>
      ) : (
        <div className="space-y-3">
          {!current && (
            <p className="text-sm text-amber-400">
              You have not chosen a username yet, so others see you as{" "}
              <span className="font-mono">{publicName}</span>.
            </p>
          )}
          <div className="flex flex-col sm:flex-row gap-3">
            <Input
              value={draft}
              maxLength={USERNAME_MAX_LENGTH}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Choose a username"
              className="bg-dark-800 border-dark-600 text-white"
              autoComplete="username"
            />
            <Button
              type="button"
              onClick={save}
              disabled={saving || !parsed.ok || unchanged}
              className="bg-cyan-500 hover:bg-cyan-600 text-white"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
            </Button>
          </div>
          {formatError && <p className="text-sm text-red-400">{formatError}</p>}
        </div>
      )}
    </div>
  );
}
