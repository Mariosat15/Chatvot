"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Database,
  HardDrive,
  Save,
  RotateCcw,
  Trash2,
  Clock,
  Loader2,
  CheckCircle,
  AlertTriangle,
  Shield,
  History,
} from "lucide-react";
import { toast } from "sonner";

interface BackupSummary {
  id: string;
  label: string;
  kind: "manual" | "pre_restore";
  status: "in_progress" | "completed" | "failed";
  dbName: string;
  createdAt: string;
  completedAt?: string;
  createdBy?: string;
  collectionCount: number;
  totalDocuments: number;
  totalSizeBytes: number;
  error?: string;
  stale?: boolean;
}

interface RestoreStatus {
  status: "in_progress" | "completed" | "failed";
  phase: "safety_backup" | "restoring" | "cleanup" | "done";
  backupId: string;
  backupLabel: string;
  safetyBackupId?: string;
  startedAt: string;
  finishedAt?: string;
  collectionsRestored: number;
  totalCollections: number;
  error?: string;
}

function formatBytes(bytes: number): string {
  if (!bytes) return "0 B";
  const k = 1024;
  let i = Math.floor(Math.log(bytes) / Math.log(k));
  if (i < 0) i = 0;
  if (i > 4) i = 4;
  const value = (bytes / Math.pow(k, i)).toFixed(i === 0 ? 0 : 1);
  // Reason: switch avoids indexing an array with a computed value (lint:
  // security/detect-object-injection).
  const unit =
    i === 0 ? "B" : i === 1 ? "KB" : i === 2 ? "MB" : i === 3 ? "GB" : "TB";
  return `${value} ${unit}`;
}

function formatDate(iso?: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-GB", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function DatabaseBackupSection() {
  const [backups, setBackups] = useState<BackupSummary[]>([]);
  const [restore, setRestore] = useState<RestoreStatus | null>(null);
  const [backupRoot, setBackupRoot] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Restore dialog state
  const [restoreTarget, setRestoreTarget] = useState<BackupSummary | null>(null);
  const [password, setPassword] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [submittingRestore, setSubmittingRestore] = useState(false);

  const fetchingRef = useRef(false);

  const restoreInProgress = restore?.status === "in_progress";
  const backupInProgress = backups.some(
    (b) => b.status === "in_progress" && !b.stale,
  );
  const busy = restoreInProgress || backupInProgress;

  // Show the restore banner while running, or for 15 min after it finishes.
  const showRestoreBanner =
    !!restore &&
    (restore.status === "in_progress" ||
      (!!restore.finishedAt &&
        Date.now() - new Date(restore.finishedAt).getTime() < 15 * 60 * 1000));

  const fetchState = useCallback(async () => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    try {
      const res = await fetch("/api/database/backups", { cache: "no-store" });
      const data = await res.json();
      if (data.success) {
        setBackups(data.backups || []);
        setRestore(data.restore || null);
        setBackupRoot(data.backupRoot || "");
      }
    } catch {
      // transient — next poll will retry
    } finally {
      fetchingRef.current = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchState();
    // Poll faster while an operation is running, slower when idle.
    const interval = setInterval(fetchState, busy ? 3000 : 12000);
    return () => clearInterval(interval);
  }, [fetchState, busy]);

  const handleCreate = async () => {
    setCreating(true);
    try {
      const res = await fetch("/api/database/backups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Backup started. It will appear below when complete.");
        fetchState();
      } else {
        toast.error(data.message || "Failed to start backup");
      }
    } catch {
      toast.error("Failed to start backup");
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/database/backups/${id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Backup deleted");
        fetchState();
      } else {
        toast.error(data.message || "Failed to delete backup");
      }
    } catch {
      toast.error("Failed to delete backup");
    } finally {
      setDeletingId(null);
    }
  };

  const openRestore = (backup: BackupSummary) => {
    setRestoreTarget(backup);
    setPassword("");
    setConfirmText("");
  };

  const handleRestore = async () => {
    if (!restoreTarget) return;
    if (confirmText !== "RESTORE") {
      toast.error('Please type RESTORE to confirm');
      return;
    }
    if (!password) {
      toast.error("Password is required");
      return;
    }
    setSubmittingRestore(true);
    try {
      const res = await fetch(
        `/api/database/backups/${restoreTarget.id}/restore`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password, confirmationCode: "RESTORE" }),
        },
      );
      const data = await res.json();
      if (data.success) {
        toast.success("Restore started — a safety snapshot is taken first.");
        setRestoreTarget(null);
        setPassword("");
        setConfirmText("");
        fetchState();
      } else {
        toast.error(data.message || "Failed to start restore");
      }
    } catch {
      toast.error("Failed to start restore");
    } finally {
      setSubmittingRestore(false);
    }
  };

  return (
    <div className="bg-gradient-to-br from-gray-800 to-gray-900 border-2 border-blue-500/40 rounded-2xl shadow-2xl shadow-blue-500/10 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-6">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
            <Database className="h-6 w-6 text-white" />
          </div>
          <div>
            <h3 className="text-2xl font-bold text-white">Backup &amp; Restore</h3>
            <p className="text-blue-100 text-sm">
              Snapshot the entire database and roll back to any point — like a
              Windows restore point.
            </p>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-5">
        {/* Info + create */}
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4">
          <div className="flex items-start gap-2 text-sm text-gray-300">
            <Shield className="h-4 w-4 text-blue-300 mt-0.5 shrink-0" />
            <div className="space-y-1">
              <p>
                A backup is a complete snapshot of every collection, saved on the
                server. Restoring reverts the database to exactly that state.
              </p>
              <p className="text-gray-400">
                Before any restore, a{" "}
                <span className="text-blue-300 font-semibold">
                  safety snapshot
                </span>{" "}
                is taken automatically, so a restore can always be undone. For a
                clean snapshot, prefer low-traffic periods. You may be logged out
                after a restore — just log back in.
              </p>
              {backupRoot && (
                <p className="text-xs text-gray-500 flex items-center gap-1 pt-1">
                  <HardDrive className="h-3 w-3" /> Saved to:{" "}
                  <code className="text-gray-400">{backupRoot}</code>
                </p>
              )}
            </div>
          </div>
        </div>

        <Button
          onClick={handleCreate}
          disabled={creating || busy}
          className="w-full bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 text-white h-12 text-base font-bold"
        >
          {creating || backupInProgress ? (
            <Loader2 className="h-5 w-5 mr-2 animate-spin" />
          ) : (
            <Save className="h-5 w-5 mr-2" />
          )}
          {backupInProgress
            ? "Backup in progress…"
            : creating
              ? "Starting…"
              : "Create Backup Now"}
        </Button>

        {/* Restore progress banner */}
        {showRestoreBanner && restore && (
          <div
            className={`rounded-xl p-4 border ${
              restore.status === "in_progress"
                ? "bg-amber-500/10 border-amber-500/40"
                : restore.status === "completed"
                  ? "bg-green-500/10 border-green-500/40"
                  : "bg-red-500/10 border-red-500/40"
            }`}
          >
            <div className="flex items-center gap-2 text-sm">
              {restore.status === "in_progress" ? (
                <Loader2 className="h-4 w-4 animate-spin text-amber-300" />
              ) : restore.status === "completed" ? (
                <CheckCircle className="h-4 w-4 text-green-400" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-red-400" />
              )}
              <span className="font-semibold text-white">
                {restore.status === "in_progress"
                  ? restore.phase === "safety_backup"
                    ? "Creating safety snapshot before restore…"
                    : `Restoring "${restore.backupLabel}" — ${restore.collectionsRestored}/${restore.totalCollections} collections`
                  : restore.status === "completed"
                    ? `Restore of "${restore.backupLabel}" completed`
                    : `Restore failed: ${restore.error || "unknown error"}`}
              </span>
            </div>
            {restore.status === "completed" && restore.safetyBackupId && (
              <p className="text-xs text-gray-400 mt-1">
                A safety snapshot was saved — you can restore it to undo this
                change.
              </p>
            )}
          </div>
        )}

        {/* Backup list */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <History className="h-4 w-4 text-gray-400" />
            <h4 className="text-sm font-semibold text-gray-300">
              Available Restore Points ({backups.length})
            </h4>
          </div>

          {loading ? (
            <div className="text-center py-8 text-gray-500 text-sm">
              <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
              Loading backups…
            </div>
          ) : backups.length === 0 ? (
            <div className="text-center py-8 text-gray-500 text-sm border border-dashed border-gray-700 rounded-xl">
              No backups yet. Click “Create Backup Now” to make your first
              restore point.
            </div>
          ) : (
            <div className="space-y-2">
              {backups.map((b) => (
                <div
                  key={b.id}
                  className="bg-gray-900/60 border border-gray-700 rounded-xl p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-white font-medium truncate">
                        {b.label}
                      </span>
                      {b.kind === "pre_restore" && (
                        <span className="text-[10px] uppercase tracking-wide bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded-full">
                          Auto safety
                        </span>
                      )}
                      {b.status === "in_progress" && !b.stale && (
                        <span className="text-[10px] uppercase tracking-wide bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <Loader2 className="h-3 w-3 animate-spin" /> Creating
                        </span>
                      )}
                      {b.status === "failed" && (
                        <span className="text-[10px] uppercase tracking-wide bg-red-500/20 text-red-300 px-2 py-0.5 rounded-full">
                          Failed
                        </span>
                      )}
                      {b.stale && (
                        <span className="text-[10px] uppercase tracking-wide bg-red-500/20 text-red-300 px-2 py-0.5 rounded-full">
                          Interrupted
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-500 mt-1 flex-wrap">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" /> {formatDate(b.createdAt)}
                      </span>
                      {b.status === "completed" && (
                        <>
                          <span>{formatBytes(b.totalSizeBytes)}</span>
                          <span>{b.collectionCount} collections</span>
                          <span>
                            {b.totalDocuments.toLocaleString()} documents
                          </span>
                        </>
                      )}
                      {b.error && (
                        <span className="text-red-400">{b.error}</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      onClick={() => openRestore(b)}
                      disabled={b.status !== "completed" || busy}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white h-9"
                      title={
                        b.status !== "completed"
                          ? "Only completed backups can be restored"
                          : "Restore the database to this point"
                      }
                    >
                      <RotateCcw className="h-4 w-4 mr-1" /> Restore
                    </Button>
                    <Button
                      onClick={() => handleDelete(b.id)}
                      disabled={
                        deletingId === b.id ||
                        (b.status === "in_progress" && !b.stale) ||
                        busy
                      }
                      variant="outline"
                      className="border-red-500/40 text-red-300 hover:bg-red-500/10 h-9"
                    >
                      {deletingId === b.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Restore confirmation dialog */}
      <Dialog
        open={!!restoreTarget}
        onOpenChange={(open) => !open && setRestoreTarget(null)}
      >
        <DialogContent className="bg-gray-900 border-gray-700">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-400" />
              Restore Database
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              This overwrites the current database with the snapshot{" "}
              <span className="text-white font-medium">
                “{restoreTarget?.label}”
              </span>{" "}
              from {formatDate(restoreTarget?.createdAt)}. A safety snapshot of
              the current state is created first so you can undo this.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <Label htmlFor="restorePassword" className="text-gray-300">
                Admin password
              </Label>
              <Input
                id="restorePassword"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your admin password"
                className="bg-gray-800 border-gray-600 text-white mt-1"
                autoComplete="current-password"
              />
            </div>
            <div>
              <Label htmlFor="restoreConfirm" className="text-gray-300">
                Type <span className="text-amber-400 font-mono">RESTORE</span> to
                confirm
              </Label>
              <Input
                id="restoreConfirm"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="RESTORE"
                className="bg-gray-800 border-gray-600 text-white mt-1"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRestoreTarget(null)}
              className="border-gray-600 text-gray-300"
              disabled={submittingRestore}
            >
              Cancel
            </Button>
            <Button
              onClick={handleRestore}
              disabled={
                submittingRestore || confirmText !== "RESTORE" || !password
              }
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {submittingRestore ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RotateCcw className="h-4 w-4 mr-2" />
              )}
              Start Restore
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
