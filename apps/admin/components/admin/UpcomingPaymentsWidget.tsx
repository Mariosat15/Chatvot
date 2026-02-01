"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CreditCard,
  Calendar,
  AlertTriangle,
  ExternalLink,
  Loader2,
  RefreshCw,
} from "lucide-react";

interface VendorPayment {
  _id: string;
  name: string;
  serviceType: string;
  amount: number;
  currency: string;
  billingCycle: string;
  nextPaymentDate: string;
  vendorUrl?: string;
}

interface UpcomingPaymentsWidgetProps {
  onNavigate?: (section: string) => void;
  daysAhead?: number;
}

export default function UpcomingPaymentsWidget({
  onNavigate,
  daysAhead = 30,
}: UpcomingPaymentsWidgetProps) {
  const [payments, setPayments] = useState<VendorPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalMonthly, setTotalMonthly] = useState(0);

  useEffect(() => {
    fetchPayments();
  }, [daysAhead]);

  const fetchPayments = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/vendors?upcoming=${daysAhead}&isActive=true`,
      );
      const data = await response.json();

      if (data.success) {
        setPayments(data.vendors.slice(0, 5)); // Show top 5
        setTotalMonthly(data.summary?.totalMonthly || 0);
      }
    } catch (error) {
      console.error("Error fetching upcoming payments:", error);
    } finally {
      setLoading(false);
    }
  };

  const getDaysUntilPayment = (dateStr: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dueDate = new Date(dateStr);
    dueDate.setHours(0, 0, 0, 0);
    return Math.ceil(
      (dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
    );
  };

  const getStatusBadge = (daysUntil: number) => {
    if (daysUntil < 0) {
      return (
        <Badge className="bg-red-500/20 text-red-400 text-xs">Overdue</Badge>
      );
    } else if (daysUntil === 0) {
      return (
        <Badge className="bg-orange-500/20 text-orange-400 text-xs">
          Today
        </Badge>
      );
    } else if (daysUntil <= 7) {
      return (
        <Badge className="bg-yellow-500/20 text-yellow-400 text-xs">
          {daysUntil}d
        </Badge>
      );
    } else {
      return (
        <Badge className="bg-gray-500/20 text-gray-400 text-xs">
          {daysUntil}d
        </Badge>
      );
    }
  };

  const overdueCount = payments.filter(
    (p) => getDaysUntilPayment(p.nextPaymentDate) < 0,
  ).length;
  const dueSoonCount = payments.filter((p) => {
    const days = getDaysUntilPayment(p.nextPaymentDate);
    return days >= 0 && days <= 7;
  }).length;

  return (
    <Card className="bg-gray-900/50 border-gray-800">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-purple-400" />
            <CardTitle className="text-lg">Vendor Payments</CardTitle>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={fetchPayments}
            disabled={loading}
            className="text-gray-400 hover:text-white"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
        <CardDescription className="flex items-center gap-2">
          <span>Monthly cost: €{totalMonthly.toFixed(2)}</span>
          {(overdueCount > 0 || dueSoonCount > 0) && (
            <span className="flex items-center gap-1">
              •
              {overdueCount > 0 && (
                <span className="text-red-400">{overdueCount} overdue</span>
              )}
              {overdueCount > 0 && dueSoonCount > 0 && ", "}
              {dueSoonCount > 0 && (
                <span className="text-yellow-400">{dueSoonCount} due soon</span>
              )}
            </span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : payments.length === 0 ? (
          <div className="text-center py-6">
            <Calendar className="h-8 w-8 mx-auto mb-2 text-gray-600" />
            <p className="text-gray-400 text-sm">No upcoming payments</p>
            <Button
              variant="link"
              className="text-purple-400 text-sm mt-1"
              onClick={() => onNavigate?.("vendors")}
            >
              Add vendor subscriptions
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {payments.map((payment) => {
              const daysUntil = getDaysUntilPayment(payment.nextPaymentDate);
              return (
                <div
                  key={payment._id}
                  className={`flex items-center justify-between p-2 rounded-lg ${
                    daysUntil < 0
                      ? "bg-red-500/10 border border-red-500/30"
                      : daysUntil <= 7
                        ? "bg-yellow-500/5 border border-yellow-500/20"
                        : "bg-gray-800/50"
                  }`}
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="flex flex-col min-w-0">
                      <span className="text-white text-sm font-medium truncate">
                        {payment.name}
                      </span>
                      <span className="text-xs text-gray-500">
                        {new Date(payment.nextPaymentDate).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-white font-mono text-sm">
                      €{payment.amount.toFixed(2)}
                    </span>
                    {getStatusBadge(daysUntil)}
                    {payment.vendorUrl && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 text-gray-400 hover:text-white"
                        onClick={() => {
                          try {
                            const url = new URL(payment.vendorUrl);
                            if (url.protocol === "https:" || url.protocol === "http:") {
                              window.open(payment.vendorUrl, "_blank", "noopener,noreferrer");
                            }
                          } catch {
                            // Invalid URL, don't open
                          }
                        }}
                      >
                        <ExternalLink className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}

            {payments.length > 0 && (
              <Button
                variant="ghost"
                className="w-full mt-2 text-purple-400 hover:text-purple-300 hover:bg-purple-500/10"
                onClick={() => onNavigate?.("vendors")}
              >
                View All Subscriptions →
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
