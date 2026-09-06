"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  ArrowLeft,
  Copy,
  Download,
  FileText,
  FileUp,
  Flag,
  Hammer,
  RefreshCw,
  Send,
  ShieldAlert,
  Sparkles,
  Trash2,
  XCircle,
} from "lucide-react";
import ChargebackCompleteDialog from "./ChargebackCompleteDialog";

interface Attachment {
  id: string;
  originalName: string;
  size: number;
  mimeType: string;
  fileUrl: string;
  uploadedAt: string;
  uploadedByName?: string;
}

interface TimelineEntry {
  at: string;
  actorName?: string;
  action: string;
  notes?: string;
}

interface CaseDoc {
  _id: string;
  userId: string;
  userEmail?: string;
  userName?: string;
  provider: string;
  providerTransactionId?: string;
  chargebackCaseId?: string;
  reasonCode?: string;
  amount: number;
  currency: string;
  status: string;
  outcome?: string;
  receivedAt: string;
  initiatedAt?: string;
  representedAt?: string;
  resolvedAt?: string;
  restrictionId?: string;
  narrative?: string;
  attachments: Attachment[];
  timeline: TimelineEntry[];
  clawback?: {
    userWallet?: {
      applied?: boolean;
      amount?: number;
      appliedAt?: string;
    };
    platformBank?: {
      applied?: boolean;
      amount?: number;
      appliedAt?: string;
    };
  };
}

interface PacketResponse {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- free-form evidence snapshot
  snapshot?: any;
  rebuttalLetter?: string;
  markdown?: string;
}

const STATUS_BADGE: Record<string, string> = {
  pending_review: "bg-amber-950/40 border-amber-700 text-amber-300",
  initiated: "bg-blue-950/40 border-blue-700 text-blue-300",
  represented: "bg-indigo-950/40 border-indigo-700 text-indigo-300",
  won: "bg-green-950/40 border-green-700 text-green-300",
  lost: "bg-red-950/40 border-red-700 text-red-300",
  withdrawn: "bg-gray-800 border-gray-600 text-gray-300",
};

export default function ChargebackCasePanel({
  caseId,
  onBack,
}: {
  caseId: string;
  onBack?: () => void;
}) {
  const [data, setData] = useState<CaseDoc | null>(null);
  const [packet, setPacket] = useState<PacketResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [narrativeDraft, setNarrativeDraft] = useState("");
  const [savingNarrative, setSavingNarrative] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [completeOpen, setCompleteOpen] = useState(false);
  const [generatingAI, setGeneratingAI] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/chargebacks/${caseId}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("failed");
      const json = await res.json();
      setData(json.case as CaseDoc);
      setPacket(json.packet as PacketResponse);
      setNarrativeDraft((json.case as CaseDoc)?.narrative || "");
    } catch (err) {
      console.error("load chargeback failed", err);
      toast.error("Failed to load chargeback case");
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => {
    load();
  }, [load]);

  const runAction = useCallback(
    async (
      action: "initiate" | "represented" | "won" | "withdrawn",
      confirmMsg?: string,
    ) => {
      if (confirmMsg && !window.confirm(confirmMsg)) return;
      try {
        const res = await fetch(`/api/chargebacks/${caseId}/${action}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({}),
        });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j?.error || "Failed");
        }
        toast.success(`Status updated: ${action}`);
        load();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed");
      }
    },
    [caseId, load],
  );

  const saveNarrative = useCallback(async () => {
    setSavingNarrative(true);
    try {
      const res = await fetch(`/api/chargebacks/${caseId}/narrative`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ narrative: narrativeDraft }),
      });
      if (!res.ok) throw new Error("Failed");
      toast.success("Rebuttal saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setSavingNarrative(false);
    }
  }, [caseId, narrativeDraft]);

  const copyReport = useCallback(async () => {
    try {
      const res = await fetch(`/api/chargebacks/${caseId}/report?format=md`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Failed");
      const md = await res.text();
      await navigator.clipboard.writeText(md);
      toast.success("Defense packet copied to clipboard");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  }, [caseId]);

  const downloadDocx = useCallback(() => {
    window.location.href = `/api/chargebacks/${caseId}/report?format=docx`;
  }, [caseId]);

  const downloadMd = useCallback(() => {
    window.location.href = `/api/chargebacks/${caseId}/report?format=md`;
  }, [caseId]);

  const generateAINarrative = useCallback(async () => {
    setGeneratingAI(true);
    try {
      const res = await fetch(`/api/chargebacks/${caseId}/ai-narrative`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || "Failed");
      }
      const json = await res.json();
      if (json?.narrative) setNarrativeDraft(json.narrative);
      toast.success(
        json?.source === "ai"
          ? `AI narrative generated (${json.model || "openai"})`
          : "Narrative regenerated from template (AI disabled)",
      );
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setGeneratingAI(false);
    }
  }, [caseId, load]);

  const onFilesPicked = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;
      setUploading(true);
      try {
        const fd = new FormData();
        for (const f of Array.from(files)) fd.append("file", f);
        const res = await fetch(`/api/chargebacks/${caseId}/attachments`, {
          method: "POST",
          body: fd,
        });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j?.error || "Upload failed");
        }
        toast.success("Attachment uploaded");
        load();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Upload failed");
      } finally {
        setUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    },
    [caseId, load],
  );

  const deleteAttachment = useCallback(
    async (attachmentId: string, name?: string) => {
      if (!window.confirm(`Delete "${name || attachmentId}"?`)) return;
      try {
        const res = await fetch(
          `/api/chargebacks/${caseId}/attachments/${attachmentId}`,
          { method: "DELETE" },
        );
        if (!res.ok) throw new Error("Failed");
        toast.success("Attachment deleted");
        load();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed");
      }
    },
    [caseId, load],
  );

  const terminal = useMemo(
    () => ["won", "lost", "withdrawn"].includes(data?.status || ""),
    [data?.status],
  );

  if (loading) return <div className="text-sm text-gray-400">Loading…</div>;
  if (!data)
    return <div className="text-sm text-red-400">Case not found.</div>;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          {onBack && (
            <Button size="sm" variant="ghost" onClick={onBack}>
              <ArrowLeft className="h-3 w-3 mr-1" />
              Back
            </Button>
          )}
          <Badge
            className={`border ${
              STATUS_BADGE[data.status] ||
              "bg-gray-800 border-gray-700 text-gray-300"
            }`}
          >
            {data.status}
          </Badge>
          <span className="font-mono text-gray-300 text-sm">
            {data.amount} {data.currency}
          </span>
          <span className="text-xs text-gray-400">
            {data.provider}
            {data.reasonCode ? ` · ${data.reasonCode}` : ""}
          </span>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button size="sm" variant="outline" onClick={load}>
            <RefreshCw className="h-3 w-3 mr-1" />
            Refresh
          </Button>
          {data.status === "pending_review" && (
            <Button
              size="sm"
              className="bg-blue-600 hover:bg-blue-700"
              onClick={() =>
                runAction(
                  "initiate",
                  "Initiate this chargeback? The user's account will be fully restricted.",
                )
              }
            >
              <ShieldAlert className="h-3 w-3 mr-1" />
              Initiate chargeback
            </Button>
          )}
          {(data.status === "initiated" || data.status === "represented") && (
            <>
              {data.status === "initiated" && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    runAction("represented", "Mark as represented?")
                  }
                >
                  <Send className="h-3 w-3 mr-1" />
                  Mark represented
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                className="border-green-700 text-green-300"
                onClick={() => runAction("won", "Mark this chargeback as WON?")}
              >
                <Flag className="h-3 w-3 mr-1" />
                Mark won
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  runAction("withdrawn", "Mark this chargeback as withdrawn?")
                }
              >
                <XCircle className="h-3 w-3 mr-1" />
                Mark withdrawn
              </Button>
              <Button
                size="sm"
                className="bg-red-600 hover:bg-red-700"
                onClick={() => setCompleteOpen(true)}
              >
                <Hammer className="h-3 w-3 mr-1" />
                Complete chargeback
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="rounded-lg border border-gray-700 bg-gray-900/50 p-4 space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h3 className="font-semibold text-gray-200">Defense packet</h3>
            <div className="flex gap-2 flex-wrap">
              {!terminal && (
                <Button
                  size="sm"
                  variant="outline"
                  className="border-purple-700 text-purple-300"
                  onClick={generateAINarrative}
                  disabled={generatingAI}
                  title="Regenerate the defense narrative with AI using the latest evidence."
                >
                  <Sparkles className="h-3 w-3 mr-1" />
                  {generatingAI ? "Generating…" : "Generate with AI"}
                </Button>
              )}
              <Button
                size="sm"
                className="bg-blue-600 hover:bg-blue-700"
                onClick={downloadDocx}
                title="Download as Microsoft Word (.docx)"
              >
                <FileText className="h-3 w-3 mr-1" /> Download Word
              </Button>
              <Button size="sm" variant="outline" onClick={downloadMd}>
                <Download className="h-3 w-3 mr-1" /> .md
              </Button>
              <Button size="sm" variant="outline" onClick={copyReport}>
                <Copy className="h-3 w-3 mr-1" /> Copy
              </Button>
            </div>
          </div>
          <div className="text-xs text-gray-500">
            Snapshot generated {data.initiatedAt ? "on initiate" : "live"}.
            Frozen snapshots preserve the exact packet sent to the acquirer.
            The Word download includes an AI-written narrative plus the full
            raw evidence in human-readable tables.
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">
              Rebuttal letter (editable)
            </label>
            <Textarea
              value={narrativeDraft}
              onChange={(e) => setNarrativeDraft(e.target.value)}
              rows={14}
              className="font-mono text-xs"
              disabled={terminal}
            />
            {!terminal && (
              <div className="mt-2 flex justify-end">
                <Button
                  size="sm"
                  onClick={saveNarrative}
                  disabled={savingNarrative}
                >
                  {savingNarrative ? "Saving…" : "Save rebuttal"}
                </Button>
              </div>
            )}
          </div>
        </div>

        <div className="rounded-lg border border-gray-700 bg-gray-900/50 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-200">
              Attachments ({data.attachments?.length || 0})
            </h3>
            {!terminal && (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(e) => onFilesPicked(e.target.files)}
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                >
                  <FileUp className="h-3 w-3 mr-1" />
                  {uploading ? "Uploading…" : "Upload"}
                </Button>
              </>
            )}
          </div>
          {data.attachments?.length ? (
            <ul className="divide-y divide-gray-800">
              {data.attachments.map((a) => (
                <li
                  key={a.id}
                  className="py-2 flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <a
                      href={a.fileUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm text-blue-300 hover:underline truncate block"
                    >
                      {a.originalName}
                    </a>
                    <div className="text-xs text-gray-500">
                      {(a.size / 1024).toFixed(1)} KB · {a.mimeType} ·{" "}
                      {new Date(a.uploadedAt).toLocaleString()}
                      {a.uploadedByName ? ` · ${a.uploadedByName}` : ""}
                    </div>
                  </div>
                  {!terminal && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => deleteAttachment(a.id, a.originalName)}
                    >
                      <Trash2 className="h-3 w-3 text-red-400" />
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-xs text-gray-500">
              No attachments. Upload evidence files (PDF, images,
              spreadsheets).
            </div>
          )}

          <div className="pt-3 border-t border-gray-800">
            <h4 className="text-sm font-semibold text-gray-200 mb-2">
              Clawback status
            </h4>
            <ul className="text-xs text-gray-300 space-y-1">
              <li>
                Wallet:{" "}
                {data.clawback?.userWallet?.applied
                  ? `${data.clawback.userWallet.amount} ${data.currency} at ${new Date(
                      data.clawback.userWallet.appliedAt || "",
                    ).toLocaleString()}`
                  : "not applied"}
              </li>
              <li>
                Bank:{" "}
                {data.clawback?.platformBank?.applied
                  ? `${data.clawback.platformBank.amount} ${data.currency} at ${new Date(
                      data.clawback.platformBank.appliedAt || "",
                    ).toLocaleString()}`
                  : "not applied"}
              </li>
            </ul>
          </div>

          <div className="pt-3 border-t border-gray-800">
            <h4 className="text-sm font-semibold text-gray-200 mb-2">
              Timeline
            </h4>
            <ul className="text-xs text-gray-300 space-y-1 max-h-60 overflow-y-auto">
              {(data.timeline || []).map((t, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-gray-500">
                    {new Date(t.at).toLocaleString()}
                  </span>
                  <span className="text-gray-400">·</span>
                  <span className="text-gray-200">{t.action}</span>
                  {t.actorName && (
                    <span className="text-gray-500">by {t.actorName}</span>
                  )}
                  {t.notes && (
                    <span className="text-gray-400 truncate">— {t.notes}</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {packet?.snapshot && (
        <details className="rounded-lg border border-gray-700 bg-gray-900/50">
          <summary className="cursor-pointer px-4 py-2 text-sm font-semibold text-gray-200">
            Raw evidence snapshot (JSON)
          </summary>
          <pre className="overflow-x-auto text-xs text-gray-300 p-4 whitespace-pre-wrap">
            {JSON.stringify(packet.snapshot, null, 2)}
          </pre>
        </details>
      )}

      <ChargebackCompleteDialog
        caseId={caseId}
        defaultAmount={data.amount}
        currency={data.currency}
        open={completeOpen}
        onOpenChange={setCompleteOpen}
        onDone={load}
      />
    </div>
  );
}
