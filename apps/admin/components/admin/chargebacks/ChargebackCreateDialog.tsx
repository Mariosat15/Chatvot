"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Search, CheckCircle2, AlertCircle } from "lucide-react";

interface Props {
  userId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: () => void;
}

interface LookupPreview {
  found: boolean;
  walletTransactionId?: string;
  provider?: string;
  providerTransactionId?: string;
  status?: string;
  processedAt?: string | null;
  createdAt?: string;
  amount?: number;
  currency?: string;
  userId?: string;
  userEmail?: string;
  userName?: string;
  paymentMethod?: string;
  cardBrand?: string;
  cardLast4?: string;
  userPaymentOptionId?: string;
  clientIp?: string;
  clientCountry?: string;
  clientCity?: string;
  clientRegion?: string;
  depositWasCompleted?: boolean;
}

const PROVIDERS = ["nuvei", "stripe", "paddle", "paypal"] as const;

/**
 * Unified "Create chargeback case" dialog.
 *
 * Admin flow:
 *   1. Pick provider (default: nuvei) and paste the Provider Transaction ID.
 *   2. Click "Look up deposit" — server fetches the WalletTransaction and
 *      enriches it with card / IP / geo facts.
 *   3. Enter the reason code (+ optional chargeback case ID).
 *   4. Submit — everything else is derived on the server.
 */
export default function ChargebackCreateDialog({
  userId,
  open,
  onOpenChange,
  onCreated,
}: Props) {
  const [provider, setProvider] = useState<string>("nuvei");
  const [providerTxId, setProviderTxId] = useState<string>("");
  const [reasonCode, setReasonCode] = useState<string>("");
  const [caseId, setCaseId] = useState<string>("");

  const [looking, setLooking] = useState(false);
  const [lookup, setLookup] = useState<LookupPreview | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setProvider("nuvei");
      setProviderTxId("");
      setReasonCode("");
      setCaseId("");
      setLookup(null);
      setLookupError(null);
    }
  }, [open]);

  const runLookup = useCallback(async () => {
    const tx = providerTxId.trim();
    if (!tx) {
      toast.error("Enter the Provider Transaction ID first");
      return;
    }
    setLooking(true);
    setLookupError(null);
    setLookup(null);
    try {
      const qs = new URLSearchParams({
        providerTransactionId: tx,
        provider,
      });
      const res = await fetch(`/api/chargebacks/lookup?${qs.toString()}`, {
        cache: "no-store",
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || "Lookup failed");
      }
      const json = (await res.json()) as LookupPreview;
      setLookup(json);
      if (!json.found) {
        setLookupError(
          "No matching deposit was found — you can still create the case manually, but evidence will be limited.",
        );
      }
    } catch (err) {
      setLookupError(
        err instanceof Error ? err.message : "Lookup failed",
      );
    } finally {
      setLooking(false);
    }
  }, [providerTxId, provider]);

  const canSubmit = !!lookup?.found && reasonCode.trim().length > 0;

  const submit = async () => {
    if (!lookup?.found) {
      toast.error("Look up the deposit first");
      return;
    }
    if (!reasonCode.trim()) {
      toast.error("Reason code is required");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/users/${userId}/chargebacks`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          provider: lookup.provider || provider,
          providerTransactionId: lookup.providerTransactionId || providerTxId,
          reasonCode: reasonCode.trim(),
          chargebackCaseId: caseId.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || "Failed to create case");
      }
      toast.success("Chargeback case created");
      onOpenChange(false);
      onCreated();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setSubmitting(false);
    }
  };

  const geo = lookup
    ? [lookup.clientCity, lookup.clientRegion, lookup.clientCountry]
        .filter(Boolean)
        .join(", ")
    : "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create chargeback case</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          <p className="text-gray-300">
            Paste the Provider Transaction ID — the system will locate the
            original deposit and its cardholder evidence automatically. You
            only need to enter the reason code.
          </p>

          {/* Step 1: lookup */}
          <div className="rounded-md border border-gray-700 p-3 space-y-3">
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-1 space-y-1">
                <Label className="text-gray-200">Provider</Label>
                <Select value={provider} onValueChange={setProvider}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PROVIDERS.map((p) => (
                      <SelectItem key={p} value={p}>
                        {p}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2 space-y-1">
                <Label className="text-gray-200">
                  Provider Transaction ID
                </Label>
                <div className="flex gap-2">
                  <Input
                    value={providerTxId}
                    onChange={(e) => setProviderTxId(e.target.value)}
                    placeholder="e.g. 7110000001234567890"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        runLookup();
                      }
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={runLookup}
                    disabled={looking || !providerTxId.trim()}
                  >
                    {looking ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Search className="h-4 w-4" />
                    )}
                    <span className="ml-1">Look up</span>
                  </Button>
                </div>
              </div>
            </div>

            {/* Lookup result */}
            {lookup?.found && (
              <div className="rounded-md border border-green-700/60 bg-green-950/20 p-3 space-y-1">
                <div className="flex items-center gap-2 text-green-300 font-medium">
                  <CheckCircle2 className="h-4 w-4" />
                  Deposit located
                </div>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-300 mt-2">
                  <dt className="text-gray-500">User</dt>
                  <dd className="font-mono text-gray-200">
                    {lookup.userName || "—"}
                    {lookup.userEmail ? ` · ${lookup.userEmail}` : ""}
                  </dd>
                  <dt className="text-gray-500">Amount</dt>
                  <dd className="font-mono text-gray-200">
                    {lookup.amount} {lookup.currency || "EUR"}
                  </dd>
                  <dt className="text-gray-500">Status</dt>
                  <dd className="font-mono text-gray-200">
                    {lookup.status || "—"}
                  </dd>
                  <dt className="text-gray-500">Processed</dt>
                  <dd className="font-mono text-gray-200">
                    {lookup.processedAt
                      ? new Date(lookup.processedAt).toLocaleString()
                      : "—"}
                  </dd>
                  <dt className="text-gray-500">Card</dt>
                  <dd className="font-mono text-gray-200">
                    {lookup.cardBrand || "—"}
                    {lookup.cardLast4 ? ` ···· ${lookup.cardLast4}` : ""}
                  </dd>
                  <dt className="text-gray-500">IP</dt>
                  <dd className="font-mono text-gray-200">
                    {lookup.clientIp || "—"}
                    {geo ? ` · ${geo}` : ""}
                  </dd>
                </dl>
                {lookup.userId && lookup.userId !== userId && (
                  <div className="flex items-start gap-2 mt-2 text-xs text-amber-400">
                    <AlertCircle className="h-3.5 w-3.5 mt-0.5" />
                    <span>
                      This deposit belongs to a different user (
                      <span className="font-mono">{lookup.userId}</span>). The
                      case will still be attributed to the current profile — a
                      mismatch note will be written to the audit log.
                    </span>
                  </div>
                )}
              </div>
            )}
            {lookupError && (
              <div className="flex items-start gap-2 rounded-md border border-red-700/60 bg-red-950/20 p-2 text-xs text-red-300">
                <AlertCircle className="h-3.5 w-3.5 mt-0.5" />
                <span>{lookupError}</span>
              </div>
            )}
          </div>

          {/* Step 2: reason */}
          <div className="rounded-md border border-gray-700 p-3 space-y-3">
            <div className="space-y-1">
              <Label htmlFor="cb-reason" className="text-gray-200">
                Reason code <span className="text-red-400">*</span>
              </Label>
              <Input
                id="cb-reason"
                value={reasonCode}
                onChange={(e) => setReasonCode(e.target.value)}
                placeholder="e.g. 10.4 (fraudulent card-not-present), 13.1 (merchandise/services not received)"
              />
              <p className="text-xs text-gray-500">
                Use the acquirer / card-scheme reason code exactly as received.
              </p>
            </div>
            <div className="space-y-1">
              <Label htmlFor="cb-case-id" className="text-gray-200">
                Chargeback case ID (optional)
              </Label>
              <Input
                id="cb-case-id"
                value={caseId}
                onChange={(e) => setCaseId(e.target.value)}
                placeholder="PSP's own chargeback case ID, if known"
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            onClick={submit}
            disabled={!canSubmit || submitting}
            className="bg-amber-600 hover:bg-amber-700"
          >
            {submitting ? "Creating…" : "Create case"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
