"use client";

import { useState } from "react";
import { PackageOpen, Loader2, Check, Lock } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * "Enable GM package" on the Manage Game Masters detail view.
 *
 * Lists every GM package an operator marked "Contact us (no direct purchase)" and lets them
 * enable one for THIS Game Master only. Once enabled, that player sees the normal buy button for
 * the package in the marketplace (within a few seconds - the player list is cached ~5s).
 */

interface ContactUsPackageRow {
  id: string;
  name: string;
  price: number;
  isPublished?: boolean;
  status?: string;
  unlocked: boolean;
}

/**
 * Pass `subscriptionId` on Manage Game Masters, or `userId` in the Users section - the latter
 * reaches players who are not Game Masters yet. Both routes share one unlock service.
 */
type EnableGmPackageButtonProps =
  | { subscriptionId: string; userId?: never }
  | { userId: string; subscriptionId?: never };

export default function EnableGmPackageButton(props: EnableGmPackageButtonProps) {
  const endpoint = props.userId
    ? `/api/users/${encodeURIComponent(props.userId)}/package-unlocks`
    : `/api/gamemasters/${props.subscriptionId}/package-unlocks`;
  const subject = props.userId ? "this player" : "this Game Master";
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [packages, setPackages] = useState<ContactUsPackageRow[]>([]);

  const load = async () => {
    setLoading(true);
    try {
      const response = await fetch(endpoint);
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || "Something went wrong. Please contact support.");
      }
      setPackages(data.packages);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong. Please contact support.");
    } finally {
      setLoading(false);
    }
  };

  const toggle = async (pkg: ContactUsPackageRow) => {
    setSavingId(pkg.id);
    try {
      const response = await fetch(endpoint, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packageId: pkg.id, enabled: !pkg.unlocked }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || "Something went wrong. Please contact support.");
      }
      setPackages((rows) =>
        rows.map((row) => (row.id === pkg.id ? { ...row, unlocked: data.unlocked } : row)),
      );
      toast.success(
        data.unlocked
          ? `"${pkg.name}" can now be bought by ${subject}`
          : `"${pkg.name}" is back to Contact us for ${subject}`,
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong. Please contact support.");
    } finally {
      setSavingId(null);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          void load();
        }}
        className="flex items-center gap-2 px-4 py-2 bg-yellow-600 text-black font-semibold rounded hover:bg-yellow-500"
      >
        <PackageOpen className="h-4 w-4" />
        Enable GM package
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent size="lg" className="bg-gray-900 border-gray-700 text-white">
          <DialogHeader>
            <DialogTitle>Enable GM package</DialogTitle>
            <DialogDescription className="text-gray-400">
              These packages are set to Contact us. Enable one to let {subject} buy it directly;
              everyone else still sees Contact us.
            </DialogDescription>
          </DialogHeader>

          {loading ? (
            <div className="flex items-center justify-center py-10 text-gray-400">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : packages.length === 0 ? (
            <p className="py-6 text-sm text-gray-400">
              No GM package has Contact us switched on. Turn it on for a package in Marketplace →
              edit the Game Master package → &quot;Contact us (no direct purchase)&quot;.
            </p>
          ) : (
            <ul className="space-y-2">
              {packages.map((pkg) => (
                <li
                  key={pkg.id}
                  className="flex items-center justify-between gap-4 rounded-lg border border-gray-700 bg-gray-800/60 px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{pkg.name}</p>
                    <p className="text-xs text-gray-400">
                      ⚡ {pkg.price.toLocaleString()}
                      {pkg.isPublished === false ? " · not published" : ""}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void toggle(pkg)}
                    disabled={savingId === pkg.id}
                    className={`flex flex-shrink-0 items-center gap-2 rounded px-3 py-1.5 text-sm font-semibold disabled:opacity-50 ${
                      pkg.unlocked
                        ? "bg-green-600/20 text-green-400 hover:bg-green-600/30"
                        : "bg-yellow-500 text-black hover:bg-yellow-400"
                    }`}
                  >
                    {savingId === pkg.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : pkg.unlocked ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Lock className="h-4 w-4" />
                    )}
                    {pkg.unlocked ? "Enabled - click to disable" : "Enable for purchase"}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
