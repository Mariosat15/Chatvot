"use client";

/**
 * Reusable transaction detail modal shared by the admin dashboards.
 *
 * Reason: the same rich detail view used on the Financials tab was requested
 * on the per-user Transactions tab. Extracted here so both call sites render
 * identical information without duplicating 300+ lines of JSX and risking the
 * Financials view breaking when we iterate on the user-detail copy.
 */

import { useCallback, useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ArrowRightLeft,
  Download,
  Eye,
  FileText,
  RefreshCw,
  Users,
  DollarSign,
} from "lucide-react";
import { toast } from "sonner";

export interface TxDetail {
  _id: string;
  userId: string;
  userName?: string;
  userInfo?: {
    id: string;
    name: string;
    email: string;
  };
  transactionType: string;
  amount: number;
  amountEUR?: number;
  status: string;
  createdAt: string;
  description?: string;
  competitionId?: string;
  paymentMethod?: string;
  metadata?: Record<string, unknown>;
}

interface InvoiceSummary {
  _id: string;
  invoiceNumber: string;
  invoiceDate: string;
  subtotal?: number;
  vatRate?: number;
  vatAmount?: number;
  total?: number;
}

interface Props {
  tx: TxDetail | null;
  onClose: () => void;
  creditSymbol?: string;
  currencySymbol?: string;
}

function getStatusColor(status: string): string {
  switch (status) {
    case "completed":
      return "bg-green-600";
    case "pending":
      return "bg-yellow-600";
    case "failed":
      return "bg-red-600";
    case "cancelled":
      return "bg-gray-600";
    default:
      return "bg-gray-600";
  }
}

function getTransactionTypeColor(type: string): string {
  switch (type) {
    case "deposit":
      return "bg-green-600";
    case "withdrawal":
      return "bg-red-600";
    case "refund":
      return "bg-orange-600";
    case "chargeback":
      return "bg-rose-600";
    case "bonus":
      return "bg-purple-600";
    case "competition_entry":
      return "bg-blue-600";
    case "competition_prize":
      return "bg-yellow-600";
    case "commission":
      return "bg-indigo-600";
    default:
      return "bg-gray-600";
  }
}

function readNumber(
  metadata: Record<string, unknown> | undefined,
  key: string,
): number | undefined {
  if (!metadata) return undefined;
  const raw = metadata[key as keyof typeof metadata];
  return typeof raw === "number" ? raw : undefined;
}

function readString(
  metadata: Record<string, unknown> | undefined,
  key: string,
): string | undefined {
  if (!metadata) return undefined;
  const raw = metadata[key as keyof typeof metadata];
  return typeof raw === "string" ? raw : undefined;
}

export default function TransactionDetailDialog({
  tx,
  onClose,
  creditSymbol = "credits",
  currencySymbol = "€",
}: Props) {
  const [invoice, setInvoice] = useState<InvoiceSummary | null>(null);
  const [loadingInvoice, setLoadingInvoice] = useState(false);

  const fetchInvoice = useCallback(async (selected: TxDetail) => {
    setInvoice(null);
    if (
      selected.transactionType !== "deposit" ||
      selected.status !== "completed"
    ) {
      return;
    }
    setLoadingInvoice(true);
    try {
      const paymentId = readString(selected.metadata, "paymentIntentId") || "";
      const res = await fetch(
        `/api/invoices/by-transaction?transactionId=${selected._id}&userId=${selected.userId}&paymentId=${encodeURIComponent(paymentId)}`,
      );
      if (res.ok) {
        const result = await res.json();
        if (result?.invoice) setInvoice(result.invoice);
      }
    } catch (err) {
      console.error("Failed to fetch invoice", err);
    } finally {
      setLoadingInvoice(false);
    }
  }, []);

  useEffect(() => {
    if (tx) {
      void fetchInvoice(tx);
    } else {
      setInvoice(null);
      setLoadingInvoice(false);
    }
  }, [tx, fetchInvoice]);

  const withdrawalAmountEUR = readNumber(tx?.metadata, "amountEUR");
  const withdrawalPlatformFee = readNumber(tx?.metadata, "platformFee");
  const withdrawalBankFee = readNumber(tx?.metadata, "bankFee");
  const withdrawalNetEUR = readNumber(tx?.metadata, "netAmountEUR");
  const metaPaymentIntentId = readString(tx?.metadata, "paymentIntentId");
  const metaCreditsValue = readNumber(tx?.metadata, "creditsValue");
  const metaVatAmount = readNumber(tx?.metadata, "vatAmount");
  const metaVatRate = readNumber(tx?.metadata, "vatRate");
  const metaTotalPaid = readNumber(tx?.metadata, "totalPaid");

  return (
    <Dialog open={!!tx} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="bg-gray-900 border-gray-700 max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white">
            <ArrowRightLeft className="h-5 w-5 text-indigo-400" />
            Transaction Details
          </DialogTitle>
          <DialogDescription>
            Complete information about this transaction
          </DialogDescription>
        </DialogHeader>

        {tx && (
          <div className="space-y-4">
            {/* Status banner */}
            <div
              className={`rounded-lg p-4 ${
                tx.status === "completed"
                  ? "bg-green-500/10 border border-green-500/30"
                  : tx.status === "failed"
                    ? "bg-red-500/10 border border-red-500/30"
                    : "bg-yellow-500/10 border border-yellow-500/30"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Badge
                    className={`${getStatusColor(tx.status)} text-white`}
                  >
                    {tx.status}
                  </Badge>
                  <Badge
                    className={`${getTransactionTypeColor(tx.transactionType)} text-white`}
                  >
                    {tx.transactionType.replace(/_/g, " ")}
                  </Badge>
                </div>
                <div
                  className={`text-2xl font-bold ${
                    tx.amount >= 0 ? "text-green-400" : "text-red-400"
                  }`}
                >
                  {tx.amount >= 0 ? "+" : ""}
                  {tx.amount.toLocaleString()} {creditSymbol}
                </div>
              </div>
            </div>

            {/* Basic grid */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-800 rounded-lg p-4">
                <div className="text-xs text-gray-500 mb-1">
                  Transaction ID
                </div>
                <div
                  className="font-mono text-sm text-white cursor-pointer hover:text-indigo-400 break-all"
                  onClick={() => {
                    void navigator.clipboard.writeText(tx._id);
                    toast.success("Transaction ID copied!");
                  }}
                >
                  {tx._id}
                </div>
              </div>
              <div className="bg-gray-800 rounded-lg p-4">
                <div className="text-xs text-gray-500 mb-1">Date & Time</div>
                <div className="text-white text-sm">
                  {new Date(tx.createdAt).toLocaleString()}
                </div>
              </div>
            </div>

            {/* User info */}
            <div className="bg-gray-800 rounded-lg p-4">
              <div className="text-xs text-gray-500 mb-2">
                User Information
              </div>
              <div className="flex items-center gap-3">
                <div className="bg-indigo-500/20 rounded-full p-2">
                  <Users className="h-4 w-4 text-indigo-400" />
                </div>
                <div>
                  <div className="text-white font-medium">
                    {tx.userInfo?.name || tx.userName || "Unknown User"}
                  </div>
                  <div className="text-sm text-gray-400">
                    {tx.userInfo?.email || tx.userId}
                  </div>
                  <div className="text-xs text-gray-500 font-mono">
                    ID: {tx.userInfo?.id || tx.userId}
                  </div>
                </div>
              </div>
            </div>

            {/* Description */}
            {tx.description && (
              <div className="bg-gray-800 rounded-lg p-4">
                <div className="text-xs text-gray-500 mb-1">Description</div>
                <div className="text-white text-sm">{tx.description}</div>
              </div>
            )}

            {/* Payment method */}
            {tx.paymentMethod && (
              <div className="bg-gray-800 rounded-lg p-4">
                <div className="text-xs text-gray-500 mb-1">Payment Method</div>
                <div className="text-white text-sm capitalize">
                  {tx.paymentMethod}
                </div>
              </div>
            )}

            {/* Competition */}
            {tx.competitionId && (
              <div className="bg-gray-800 rounded-lg p-4">
                <div className="text-xs text-gray-500 mb-1">Competition</div>
                <div className="text-white text-sm font-mono">
                  {tx.competitionId}
                </div>
              </div>
            )}

            {/* Withdrawal breakdown */}
            {tx.transactionType === "withdrawal" && tx.metadata && (
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <DollarSign className="h-4 w-4 text-blue-400" />
                  <span className="text-white font-medium">
                    Withdrawal Fee Breakdown
                  </span>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Withdrawal Amount:</span>
                    <span className="text-white">
                      {currencySymbol}
                      {(withdrawalAmountEUR ?? 0).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Platform Fee:</span>
                    <span className="text-red-400">
                      -{currencySymbol}
                      {(withdrawalPlatformFee ?? 0).toFixed(2)}
                    </span>
                  </div>
                  {withdrawalBankFee !== undefined && withdrawalBankFee > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Bank Fee:</span>
                      <span className="text-red-400">
                        -{currencySymbol}
                        {withdrawalBankFee.toFixed(2)}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm font-medium border-t border-blue-500/30 pt-2 mt-2">
                    <span className="text-blue-300">User Receives:</span>
                    <span className="text-green-400 text-lg">
                      {currencySymbol}
                      {(withdrawalNetEUR ?? 0).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Deposit / non-withdrawal metadata */}
            {tx.metadata &&
              Object.keys(tx.metadata).length > 0 &&
              tx.transactionType !== "withdrawal" && (
                <div className="bg-gray-800 rounded-lg p-4">
                  <div className="text-xs text-gray-500 mb-2">
                    Additional Details
                  </div>
                  <div className="space-y-2">
                    {metaPaymentIntentId && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-400">
                          Payment Intent ID:
                        </span>
                        <span className="text-white font-mono text-xs break-all text-right">
                          {metaPaymentIntentId}
                        </span>
                      </div>
                    )}
                    {metaCreditsValue !== undefined && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-400">Credits Value:</span>
                        <span className="text-white">
                          {currencySymbol}
                          {metaCreditsValue.toFixed(2)}
                        </span>
                      </div>
                    )}
                    {metaVatAmount !== undefined && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-400">VAT Amount:</span>
                        <span className="text-orange-400">
                          {currencySymbol}
                          {metaVatAmount.toFixed(2)}
                        </span>
                      </div>
                    )}
                    {metaVatRate !== undefined && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-400">VAT Rate:</span>
                        <span className="text-white">{metaVatRate}%</span>
                      </div>
                    )}
                    {metaTotalPaid !== undefined && (
                      <div className="flex justify-between text-sm font-medium border-t border-gray-700 pt-2 mt-2">
                        <span className="text-gray-300">Total Paid:</span>
                        <span className="text-emerald-400">
                          {currencySymbol}
                          {metaTotalPaid.toFixed(2)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

            {/* Invoice for completed deposits */}
            {tx.transactionType === "deposit" && (
              <div className="bg-indigo-500/10 border border-indigo-500/30 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-indigo-400" />
                    <span className="text-white font-medium">Invoice</span>
                  </div>
                  {loadingInvoice && (
                    <RefreshCw className="h-4 w-4 animate-spin text-indigo-400" />
                  )}
                </div>

                {loadingInvoice ? (
                  <div className="text-center py-4 text-gray-400 text-sm">
                    Loading invoice...
                  </div>
                ) : invoice ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <div className="text-xs text-gray-500">
                          Invoice Number
                        </div>
                        <div className="text-white font-mono text-sm">
                          {invoice.invoiceNumber}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500">Invoice Date</div>
                        <div className="text-white text-sm">
                          {new Date(invoice.invoiceDate).toLocaleDateString()}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3 bg-gray-800 rounded-lg p-3">
                      <div>
                        <div className="text-xs text-gray-500">Subtotal</div>
                        <div className="text-white">
                          {currencySymbol}
                          {invoice.subtotal?.toFixed(2) ?? "0.00"}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500">
                          VAT ({invoice.vatRate ?? 0}%)
                        </div>
                        <div className="text-orange-400">
                          {currencySymbol}
                          {invoice.vatAmount?.toFixed(2) ?? "0.00"}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500">Total</div>
                        <div className="text-emerald-400 font-semibold">
                          {currencySymbol}
                          {invoice.total?.toFixed(2) ?? "0.00"}
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 border-indigo-500/30 text-indigo-400 hover:bg-indigo-500/10"
                        onClick={() =>
                          window.open(
                            `/api/invoices/${invoice._id}/pdf`,
                            "_blank",
                          )
                        }
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Download PDF
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 border-indigo-500/30 text-indigo-400 hover:bg-indigo-500/10"
                        onClick={() =>
                          window.open(
                            `/api/invoices/${invoice._id}/view`,
                            "_blank",
                          )
                        }
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        View Invoice
                      </Button>
                    </div>
                  </div>
                ) : tx.status === "completed" ? (
                  <div className="text-center py-4 text-gray-500 text-sm">
                    No invoice found for this transaction
                  </div>
                ) : (
                  <div className="text-center py-4 text-gray-500 text-sm">
                    Invoices are generated for completed deposits only.
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
