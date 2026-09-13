"use client";

import { useEffect, useState } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

interface Props {
  caseId: string;
  defaultAmount: number;
  currency: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onDone: () => void;
}

export default function ChargebackCompleteDialog({
  caseId,
  defaultAmount,
  currency,
  open,
  onOpenChange,
  onDone,
}: Props) {
  const [walletOn, setWalletOn] = useState(true);
  const [bankOn, setBankOn] = useState(true);
  const [walletAmt, setWalletAmt] = useState<string>(String(defaultAmount));
  const [bankAmt, setBankAmt] = useState<string>(String(defaultAmount));
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setWalletOn(true);
      setBankOn(true);
      setWalletAmt(String(defaultAmount));
      setBankAmt(String(defaultAmount));
      setNotes("");
    }
  }, [open, defaultAmount]);

  const submit = async () => {
    if (!walletOn && !bankOn) {
      toast.error("Select at least one of wallet / bank");
      return;
    }
    const w = walletOn ? Number(walletAmt) : 0;
    const b = bankOn ? Number(bankAmt) : 0;
    if (walletOn && !(w > 0)) {
      toast.error("Wallet amount must be > 0");
      return;
    }
    if (bankOn && !(b > 0)) {
      toast.error("Bank amount must be > 0");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/chargebacks/${caseId}/complete`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          userWallet: walletOn ? { amount: w } : undefined,
          platformBank: bankOn ? { amount: b } : undefined,
          notes: notes.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || "Failed");
      }
      toast.success("Chargeback completed (marked lost)");
      onOpenChange(false);
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Complete chargeback — apply clawback</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 text-sm">
          <p className="text-gray-300">
            Choose which ledgers to deduct. Typical loss hits both: the user
            wallet (reverse their credits) and our bank (the funds the
            acquirer already took).
          </p>

          <div className="rounded-md border border-gray-700 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="cb-wallet-switch" className="text-gray-200">
                Remove credits from user wallet
              </Label>
              <Switch
                id="cb-wallet-switch"
                checked={walletOn}
                onCheckedChange={setWalletOn}
              />
            </div>
            <Input
              type="number"
              min={0}
              step={0.01}
              value={walletAmt}
              disabled={!walletOn}
              onChange={(e) => setWalletAmt(e.target.value)}
              placeholder={`Amount in ${currency}`}
            />
          </div>

          <div className="rounded-md border border-gray-700 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="cb-bank-switch" className="text-gray-200">
                Record platform bank loss
              </Label>
              <Switch
                id="cb-bank-switch"
                checked={bankOn}
                onCheckedChange={setBankOn}
              />
            </div>
            <Input
              type="number"
              min={0}
              step={0.01}
              value={bankAmt}
              disabled={!bankOn}
              onChange={(e) => setBankAmt(e.target.value)}
              placeholder={`Amount in ${currency}`}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="cb-notes" className="text-gray-200">
              Notes (optional)
            </Label>
            <Textarea
              id="cb-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
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
            disabled={submitting}
            className="bg-red-600 hover:bg-red-700"
          >
            {submitting ? "Applying…" : "Apply clawback & mark lost"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
