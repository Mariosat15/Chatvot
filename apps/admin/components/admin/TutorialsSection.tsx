"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  Video,
  Upload,
  Trash2,
  Pencil,
  Eye,
  EyeOff,
  Play,
  RefreshCw,
  FileVideo,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";

const CATEGORIES = [
  { id: "getting-started", label: "Getting Started" },
  { id: "trading", label: "Trading" },
  { id: "wallet", label: "Wallet & Credits" },
  { id: "competitions", label: "Competitions" },
  { id: "challenges", label: "1v1 Challenges" },
  { id: "marketplace", label: "Marketplace" },
  { id: "profile", label: "Profile & KYC" },
  { id: "other", label: "Other" },
] as const;

type CategoryId = (typeof CATEGORIES)[number]["id"];

interface Tutorial {
  _id: string;
  slug: string;
  title: string;
  description: string;
  category: CategoryId;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  durationSec?: number | null;
  thumbnailFilename?: string;
  order: number;
  isActive: boolean;
  uploadedByName?: string;
  createdAt: string;
  updatedAt: string;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export default function TutorialsSection() {
  const [tutorials, setTutorials] = useState<Tutorial[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [editing, setEditing] = useState<Tutorial | null>(null);
  const [previewing, setPreviewing] = useState<Tutorial | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const thumbInputRef = useRef<HTMLInputElement>(null);
  // Refs to track the active upload session so we can abort cleanly
  // on unmount, browser close, or the explicit Cancel button.
  const sessionIdRef = useRef<string | null>(null);
  const cancelRequestedRef = useRef(false);

  // Upload form
  const [form, setForm] = useState({
    title: "",
    description: "",
    category: "getting-started" as CategoryId,
    order: 100,
    isActive: true,
    file: null as File | null,
    thumb: null as File | null,
  });

  const resetForm = () => {
    setForm({
      title: "",
      description: "",
      category: "getting-started",
      order: 100,
      isActive: true,
      file: null,
      thumb: null,
    });
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (thumbInputRef.current) thumbInputRef.current.value = "";
  };

  const fetchTutorials = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/tutorials", { credentials: "include" });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to load tutorials");
      }
      setTutorials(json.items || []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load tutorials");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTutorials();
  }, [fetchTutorials]);

  // Reason: Reads a File/Blob as base64 for sending the small (< 2 MB)
  // thumbnail inline with the init request. Avoids a second multipart
  // round-trip just for a couple hundred KB of image.
  const readAsBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result;
        if (typeof result !== "string") {
          reject(new Error("Failed to read thumbnail"));
          return;
        }
        // strip the "data:<mime>;base64," prefix
        const comma = result.indexOf(",");
        resolve(comma >= 0 ? result.slice(comma + 1) : result);
      };
      reader.onerror = () => reject(new Error("Failed to read thumbnail"));
      reader.readAsDataURL(file);
    });

  /**
   * Aborts the current upload session (if any). Best-effort — safe to
   * call multiple times.
   */
  const abortUpload = async () => {
    cancelRequestedRef.current = true;
    const sid = sessionIdRef.current;
    if (!sid) return;
    sessionIdRef.current = null;
    try {
      await fetch(`/api/tutorials/upload/${sid}`, {
        method: "DELETE",
        credentials: "include",
        // sendBeacon-style: don't block UI on the response
        keepalive: true,
      });
    } catch {
      // best-effort
    }
  };

  // Cancel any in-flight upload if the section unmounts or the
  // browser tab closes.
  useEffect(() => {
    const onUnload = () => {
      const sid = sessionIdRef.current;
      if (sid && navigator.sendBeacon) {
        // sendBeacon doesn't support DELETE, so fire-and-forget POST to abort.
        // The DELETE endpoint is idempotent and will accept either method
        // semantics for cleanup, but we keep DELETE for the live UI path.
        // For unload, the keepalive fetch in abortUpload() also covers it.
        navigator.sendBeacon(`/api/tutorials/upload/${sid}`);
      }
    };
    window.addEventListener("beforeunload", onUnload);
    return () => {
      window.removeEventListener("beforeunload", onUnload);
      if (sessionIdRef.current) {
        void abortUpload();
      }
    };
  }, []);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.file) {
      toast.error("Please choose a video file");
      return;
    }
    if (!form.title.trim()) {
      toast.error("Please enter a title");
      return;
    }

    // Reason: capture File reference once so closures below don't need
    // the non-null assertion that depends on outer-scope narrowing.
    const file: File = form.file;

    setUploading(true);
    setUploadProgress(0);
    cancelRequestedRef.current = false;
    sessionIdRef.current = null;

    try {
      // ---- 1. Init -------------------------------------------------
      const initBody: Record<string, unknown> = {
        title: form.title.trim(),
        description: form.description.trim(),
        category: form.category,
        order: form.order,
        isActive: form.isActive,
        mimeType: file.type,
        totalSize: file.size,
      };

      if (form.thumb) {
        const thumbB64 = await readAsBase64(form.thumb);
        initBody.thumbnail = {
          mimeType: form.thumb.type,
          base64: thumbB64,
        };
      }

      const initRes = await fetch("/api/tutorials/upload/init", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(initBody),
      });
      const initJson = await initRes.json();
      if (!initRes.ok || !initJson.success) {
        throw new Error(initJson.error || `Init failed (${initRes.status})`);
      }

      const sessionId: string = initJson.sessionId;
      const chunkSize: number = initJson.chunkSize;
      const totalChunks: number = initJson.totalChunks;
      sessionIdRef.current = sessionId;

      // ---- 2. Upload chunks ---------------------------------------
      for (let i = 0; i < totalChunks; i++) {
        if (cancelRequestedRef.current) {
          throw new Error("Upload cancelled");
        }

        const start = i * chunkSize;
        const end = Math.min(start + chunkSize, file.size);
        const blob = file.slice(start, end);

        // XHR for per-chunk progress so we can roll an overall %.
        // Reason: A single fetch() does not expose upload progress in
        // any browser today; XHR is still the only portable option.
        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open("PUT", `/api/tutorials/upload/${sessionId}/chunk?index=${i}`);
          xhr.withCredentials = true;
          xhr.setRequestHeader("Content-Type", "application/octet-stream");
          xhr.upload.onprogress = (ev) => {
            if (ev.lengthComputable) {
              const completedBytes = start + ev.loaded;
              setUploadProgress(
                Math.min(
                  99,
                  Math.round((completedBytes / file.size) * 100),
                ),
              );
            }
          };
          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              resolve();
            } else {
              try {
                const j = JSON.parse(xhr.responseText || "{}");
                reject(
                  new Error(j.error || `Chunk ${i} failed (${xhr.status})`),
                );
              } catch {
                reject(new Error(`Chunk ${i} failed (${xhr.status})`));
              }
            }
          };
          xhr.onerror = () =>
            reject(new Error(`Network error on chunk ${i}`));
          xhr.send(blob);
        });
      }

      // ---- 3. Finalize --------------------------------------------
      const finRes = await fetch(
        `/api/tutorials/upload/${sessionId}/finalize`,
        {
          method: "POST",
          credentials: "include",
        },
      );
      const finJson = await finRes.json();
      if (!finRes.ok || !finJson.success) {
        throw new Error(finJson.error || `Finalize failed (${finRes.status})`);
      }

      setUploadProgress(100);
      sessionIdRef.current = null;
      toast.success("Tutorial uploaded successfully");
      resetForm();
      await fetchTutorials();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Upload failed";
      toast.error(message);
      // Try to clean up the partial upload on the server.
      if (sessionIdRef.current) {
        await abortUpload();
      }
    } finally {
      setUploading(false);
      setUploadProgress(0);
      cancelRequestedRef.current = false;
    }
  };

  const handleSaveEdit = async () => {
    if (!editing) return;
    try {
      const res = await fetch(`/api/tutorials/${editing._id}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editing.title,
          description: editing.description,
          category: editing.category,
          order: editing.order,
          isActive: editing.isActive,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to update");
      }
      toast.success("Tutorial updated");
      setEditing(null);
      await fetchTutorials();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update");
    }
  };

  const handleDelete = async (item: Tutorial) => {
    if (
      !confirm(
        `Delete "${item.title}"? This removes the video file from disk and cannot be undone.`,
      )
    ) {
      return;
    }
    try {
      const res = await fetch(`/api/tutorials/${item._id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to delete");
      }
      toast.success("Tutorial deleted");
      await fetchTutorials();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete");
    }
  };

  const handleToggleActive = async (item: Tutorial) => {
    try {
      const res = await fetch(`/api/tutorials/${item._id}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !item.isActive }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to toggle");
      }
      await fetchTutorials();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to toggle");
    }
  };

  const grouped = useMemo(() => {
    const byCat = new Map<CategoryId, Tutorial[]>();
    for (const t of tutorials) {
      const arr = byCat.get(t.category) || [];
      arr.push(t);
      byCat.set(t.category, arr);
    }
    return CATEGORIES.map((c) => ({
      ...c,
      items: byCat.get(c.id) || [],
    }));
  }, [tutorials]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Video className="h-6 w-6 text-rose-400" />
            Tutorial Videos
          </h2>
          <p className="text-sm text-gray-400 mt-1">
            Upload tutorial videos to <code className="text-rose-300">Videos/</code>.
            Files up to 200 MB are uploaded in small chunks so no reverse-proxy
            tuning is required. Committed videos ship as platform defaults for
            every white-label deployment; admin-uploaded videos override them
            at runtime.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchTutorials}
          disabled={loading}
        >
          <RefreshCw
            className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`}
          />
          Refresh
        </Button>
      </div>

      {/* Upload form */}
      <Card className="bg-gray-800/40 border-gray-700/50">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Upload className="h-5 w-5 text-rose-400" />
            Upload a new tutorial
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleUpload} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="t-title">Title *</Label>
                <Input
                  id="t-title"
                  value={form.title}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, title: e.target.value }))
                  }
                  placeholder="e.g. How to place your first trade"
                  maxLength={160}
                  required
                />
              </div>
              <div>
                <Label htmlFor="t-category">Category</Label>
                <Select
                  value={form.category}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, category: v as CategoryId }))
                  }
                >
                  <SelectTrigger id="t-category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="t-desc">Description</Label>
              <Textarea
                id="t-desc"
                value={form.description}
                onChange={(e) =>
                  setForm((f) => ({ ...f, description: e.target.value }))
                }
                rows={3}
                maxLength={2000}
                placeholder="Short summary that appears under the video title."
              />
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <Label htmlFor="t-file">Video file (MP4 / WebM, max 200 MB) *</Label>
                <Input
                  id="t-file"
                  ref={fileInputRef}
                  type="file"
                  accept="video/mp4,video/webm,video/ogg,video/quicktime"
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      file: e.target.files?.[0] || null,
                    }))
                  }
                  required
                />
                {form.file && (
                  <p className="text-xs text-gray-400 mt-1">
                    {form.file.name} — {formatBytes(form.file.size)}
                  </p>
                )}
              </div>
              <div>
                <Label htmlFor="t-thumb">Thumbnail (optional, max 2 MB)</Label>
                <Input
                  id="t-thumb"
                  ref={thumbInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      thumb: e.target.files?.[0] || null,
                    }))
                  }
                />
              </div>
              <div>
                <Label htmlFor="t-order">Order</Label>
                <Input
                  id="t-order"
                  type="number"
                  value={form.order}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      order: Number(e.target.value) || 0,
                    }))
                  }
                />
              </div>
            </div>

            {uploading && (
              <div className="space-y-1">
                <div className="h-2 bg-gray-700 rounded overflow-hidden">
                  <div
                    className="h-full bg-rose-500 transition-all"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
                <p className="text-xs text-gray-400">
                  Uploading… {uploadProgress}%
                </p>
              </div>
            )}

            <div className="flex gap-2">
              <Button
                type="submit"
                disabled={uploading || !form.file}
                className="bg-rose-500 hover:bg-rose-600"
              >
                {uploading ? "Uploading…" : "Upload Tutorial"}
              </Button>
              {uploading ? (
                <Button
                  type="button"
                  variant="outline"
                  className="text-red-300 border-red-500/40 hover:bg-red-500/10"
                  onClick={() => {
                    cancelRequestedRef.current = true;
                    void abortUpload();
                  }}
                >
                  Cancel
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  onClick={resetForm}
                  disabled={uploading}
                >
                  Reset
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      {/* List */}
      {loading ? (
        <p className="text-gray-400">Loading tutorials…</p>
      ) : tutorials.length === 0 ? (
        <Card className="bg-gray-800/30 border-gray-700/50">
          <CardContent className="py-10 text-center text-gray-400">
            <FileVideo className="h-10 w-10 mx-auto mb-3 text-gray-500" />
            No tutorials uploaded yet. Use the form above to add the first one.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {grouped.map((g) =>
            g.items.length === 0 ? null : (
              <div key={g.id}>
                <h3 className="text-sm font-semibold text-gray-300 mb-2 uppercase tracking-wide">
                  {g.label}{" "}
                  <span className="text-gray-500 font-normal">
                    ({g.items.length})
                  </span>
                </h3>
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                  {g.items.map((t) => (
                    <Card
                      key={t._id}
                      className="bg-gray-800/40 border-gray-700/50 overflow-hidden"
                    >
                      <CardContent className="p-4 space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <h4 className="font-semibold text-white truncate">
                                {t.title}
                              </h4>
                              {!t.isActive && (
                                <Badge
                                  variant="outline"
                                  className="bg-gray-700/50 text-gray-400 text-xs"
                                >
                                  Hidden
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">
                              {t.description || (
                                <span className="italic">No description</span>
                              )}
                            </p>
                          </div>
                          <Badge
                            variant="outline"
                            className="bg-rose-500/10 text-rose-300 border-rose-500/30 text-xs whitespace-nowrap"
                          >
                            #{t.order}
                          </Badge>
                        </div>

                        <div className="text-xs text-gray-500 flex flex-wrap gap-x-3 gap-y-1">
                          <span>{formatBytes(t.sizeBytes)}</span>
                          <span>{t.mimeType.replace("video/", "")}</span>
                          {t.uploadedByName && <span>by {t.uploadedByName}</span>}
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setPreviewing(t)}
                          >
                            <Play className="h-3.5 w-3.5 mr-1" />
                            Preview
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setEditing(t)}
                          >
                            <Pencil className="h-3.5 w-3.5 mr-1" />
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleToggleActive(t)}
                          >
                            {t.isActive ? (
                              <>
                                <EyeOff className="h-3.5 w-3.5 mr-1" />
                                Hide
                              </>
                            ) : (
                              <>
                                <Eye className="h-3.5 w-3.5 mr-1" />
                                Show
                              </>
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-red-300 border-red-500/30 hover:bg-red-500/10"
                            onClick={() => handleDelete(t)}
                          >
                            <Trash2 className="h-3.5 w-3.5 mr-1" />
                            Delete
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            ),
          )}
        </div>
      )}

      {/* Edit dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit tutorial</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div>
                <Label>Title</Label>
                <Input
                  value={editing.title}
                  onChange={(e) =>
                    setEditing({ ...editing, title: e.target.value })
                  }
                />
              </div>
              <div>
                <Label>Description</Label>
                <Textarea
                  value={editing.description}
                  onChange={(e) =>
                    setEditing({ ...editing, description: e.target.value })
                  }
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Category</Label>
                  <Select
                    value={editing.category}
                    onValueChange={(v) =>
                      setEditing({ ...editing, category: v as CategoryId })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Order</Label>
                  <Input
                    type="number"
                    value={editing.order}
                    onChange={(e) =>
                      setEditing({
                        ...editing,
                        order: Number(e.target.value) || 0,
                      })
                    }
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={editing.isActive}
                  onChange={(e) =>
                    setEditing({ ...editing, isActive: e.target.checked })
                  }
                  className="h-4 w-4 accent-rose-500"
                />
                Visible to users
              </label>
              <p className="text-xs text-gray-500 flex items-start gap-1">
                <AlertCircle className="h-3.5 w-3.5 mt-0.5" />
                The video file itself cannot be changed. To replace it, delete
                this tutorial and re-upload.
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveEdit}
              className="bg-rose-500 hover:bg-rose-600"
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview dialog */}
      <Dialog open={!!previewing} onOpenChange={(o) => !o && setPreviewing(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{previewing?.title}</DialogTitle>
          </DialogHeader>
          {previewing && (
            <video
              key={previewing._id}
              src={`/api/tutorials/videos/${encodeURIComponent(
                previewing.filename,
              )}`}
              controls
              autoPlay
              className="w-full rounded-lg bg-black"
              poster={
                previewing.thumbnailFilename
                  ? `/api/tutorials/videos/thumbnails/${encodeURIComponent(
                      previewing.thumbnailFilename,
                    )}`
                  : undefined
              }
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
