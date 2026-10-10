"use client";

import { useState } from "react";
import { PackageX, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * "Disable GM package" - the opposite of "Enable GM package".
 *
 * Switches off EVERY Contact-us package enabled for this person in one action, so they see
 * Contact us again and must ask support before buying. An admin revoke and an expiry do the same
 * automatically; this button is for doing it by hand.
 */
type DisableGmPackageButtonProps =
  | { subscriptionId: string; userId?: never }
  | { userId: string; subscriptionId?: never };

export default function DisableGmPackageButton(props: DisableGmPackageButtonProps) {
  const endpoint = props.userId
    ? `/api/users/${encodeURIComponent(props.userId)}/package-unlocks`
    : `/api/gamemasters/${props.subscriptionId}/package-unlocks`;
  const subject = props.userId ? "this player" : "this Game Master";
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const disableAll = async () => {
    setSaving(true);
    try {
      const response = await fetch(endpoint, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || "Something went wrong. Please contact support.");
      }
      toast.success(
        data.disabledCount > 0
          ? `${data.disabledCount} GM package(s) disabled - ${subject} must contact support again`
          : `No GM package was enabled for ${subject}`,
      );
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong. Please contact support.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-4 py-2 bg-red-700 text-white font-semibold rounded hover:bg-red-600"
      >
        <PackageX className="h-4 w-4" />
        Disable GM package
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent size="default" className="bg-gray-900 border-gray-700 text-white">
          <DialogHeader>
            <DialogTitle>Disable GM package</DialogTitle>
            <DialogDescription className="text-gray-400">
              Every Contact us package enabled for {subject} will be switched off. They will see
              Contact us again and must ask support before they can buy one. A package they
              already own keeps running until it ends or is revoked.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              disabled={saving}
              className="rounded px-4 py-2 text-sm text-gray-300 hover:bg-gray-800 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void disableAll()}
              disabled={saving}
              className="flex items-center gap-2 rounded bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-600 disabled:opacity-50"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Disable all
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
