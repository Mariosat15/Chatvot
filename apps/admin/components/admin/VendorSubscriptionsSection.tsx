"use client";

import { useState, useEffect, useCallback } from "react";
import { useAppSettings } from "@/contexts/AppSettingsContext";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import {
  CreditCard,
  Plus,
  Pencil,
  Trash2,
  RefreshCw,
  Calendar,
  DollarSign,
  AlertTriangle,
  CheckCircle,
  Clock,
  Database,
  Brain,
  Mail,
  Globe,
  Server,
  Shield,
  BarChart3,
  HardDrive,
  Loader2,
  ExternalLink,
  Check,
  Building2,
} from "lucide-react";

interface VendorSubscription {
  _id: string;
  name: string;
  serviceType: string;
  description?: string;
  amount: number;
  currency: string;
  billingCycle: "monthly" | "quarterly" | "yearly" | "one-time";
  nextPaymentDate: string;
  lastPaymentDate?: string;
  reminderDaysBefore: number;
  reminderSent: boolean;
  isActive: boolean;
  autoRenew: boolean;
  vendorUrl?: string;
  accountEmail?: string;
  accountId?: string;
  notes?: string;
  paymentHistory?: Array<{
    date: string;
    amount: number;
    status: "paid" | "pending" | "failed";
    reference?: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

interface VendorSummary {
  total: number;
  active: number;
  totalMonthly: number;
  totalYearly: number;
  byServiceType: Record<string, { count: number; monthlyTotal: number }>;
  paymentsDueSoon: number;
}

const SERVICE_TYPE_ICONS: Record<string, React.ReactNode> = {
  database: <Database className="h-4 w-4" />,
  ai: <Brain className="h-4 w-4" />,
  email: <Mail className="h-4 w-4" />,
  hosting: <Server className="h-4 w-4" />,
  domain: <Globe className="h-4 w-4" />,
  api: <Globe className="h-4 w-4" />,
  storage: <HardDrive className="h-4 w-4" />,
  analytics: <BarChart3 className="h-4 w-4" />,
  security: <Shield className="h-4 w-4" />,
  other: <Building2 className="h-4 w-4" />,
};

const SERVICE_TYPE_LABELS: Record<string, string> = {
  database: "Database",
  ai: "AI / ML",
  email: "Email",
  hosting: "Hosting / VPS",
  domain: "Domain",
  api: "API Service",
  storage: "Storage",
  analytics: "Analytics",
  security: "Security",
  other: "Other",
};

const BILLING_CYCLE_LABELS: Record<string, string> = {
  monthly: "Monthly",
  quarterly: "Quarterly",
  yearly: "Yearly",
  "one-time": "One-time",
};

const PRESET_VENDORS = [
  {
    name: "MongoDB Atlas",
    serviceType: "database",
    vendorUrl: "https://cloud.mongodb.com/v2",
  },
  {
    name: "OpenAI",
    serviceType: "ai",
    vendorUrl: "https://platform.openai.com/usage",
  },
  {
    name: "Google Workspace",
    serviceType: "email",
    vendorUrl: "https://admin.google.com/ac/billing",
  },
  {
    name: "Hostinger",
    serviceType: "hosting",
    vendorUrl: "https://hpanel.hostinger.com/billing",
  },
  { name: "Massive.com", serviceType: "api", vendorUrl: "https://massive.com" },
  {
    name: "Cloudflare",
    serviceType: "security",
    vendorUrl: "https://dash.cloudflare.com",
  },
  {
    name: "AWS",
    serviceType: "hosting",
    vendorUrl: "https://console.aws.amazon.com/billing",
  },
  {
    name: "Vercel",
    serviceType: "hosting",
    vendorUrl: "https://vercel.com/dashboard",
  },
  {
    name: "Stripe",
    serviceType: "api",
    vendorUrl: "https://dashboard.stripe.com",
  },
];

const emptyVendor: Partial<VendorSubscription> = {
  name: "",
  serviceType: "other",
  description: "",
  amount: 0,
  currency: "EUR",
  billingCycle: "monthly",
  nextPaymentDate: new Date().toISOString().split("T")[0],
  reminderDaysBefore: 7,
  isActive: true,
  autoRenew: true,
  vendorUrl: "",
  accountEmail: "",
  accountId: "",
  notes: "",
};

export default function VendorSubscriptionsSection() {
  const { settings } = useAppSettings();
  const cs = settings?.currency?.symbol || "€";
  const [vendors, setVendors] = useState<VendorSubscription[]>([]);
  const [summary, setSummary] = useState<VendorSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Filters
  const [filterServiceType, setFilterServiceType] = useState("all");
  const [filterActive, setFilterActive] = useState("all");

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingVendor, setEditingVendor] =
    useState<Partial<VendorSubscription>>(emptyVendor);
  const [isEditing, setIsEditing] = useState(false);

  // Delete confirmation
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [vendorToDelete, setVendorToDelete] =
    useState<VendorSubscription | null>(null);

  // Mark paid dialog
  const [markPaidDialogOpen, setMarkPaidDialogOpen] = useState(false);
  const [vendorToMarkPaid, setVendorToMarkPaid] =
    useState<VendorSubscription | null>(null);
  const [paymentReference, setPaymentReference] = useState("");

  const fetchVendors = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterServiceType !== "all")
        params.set("serviceType", filterServiceType);
      if (filterActive !== "all") params.set("isActive", filterActive);

      const response = await fetch(`/api/vendors?${params}`);
      const data = await response.json();

      if (data.success) {
        setVendors(data.vendors);
        setSummary(data.summary);
      } else {
        toast.error(data.error || "Failed to fetch vendors");
      }
    } catch (error) {
      console.error("Error fetching vendors:", error);
      toast.error("Failed to fetch vendors");
    } finally {
      setLoading(false);
    }
  }, [filterServiceType, filterActive]);

  useEffect(() => {
    fetchVendors();
  }, [fetchVendors]);

  const handleOpenDialog = (vendor?: VendorSubscription) => {
    if (vendor) {
      setEditingVendor({
        ...vendor,
        nextPaymentDate: new Date(vendor.nextPaymentDate)
          .toISOString()
          .split("T")[0],
        lastPaymentDate: vendor.lastPaymentDate
          ? new Date(vendor.lastPaymentDate).toISOString().split("T")[0]
          : undefined,
      });
      setIsEditing(true);
    } else {
      setEditingVendor({ ...emptyVendor });
      setIsEditing(false);
    }
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!editingVendor.name || !editingVendor.amount) {
      toast.error("Name and amount are required");
      return;
    }

    setSaving(true);
    try {
      const method = isEditing ? "PUT" : "POST";
      const response = await fetch("/api/vendors", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingVendor),
      });

      const data = await response.json();

      if (data.success) {
        toast.success(data.message);
        setDialogOpen(false);
        fetchVendors();
      } else {
        toast.error(data.error || "Failed to save vendor");
      }
    } catch (error) {
      console.error("Error saving vendor:", error);
      toast.error("Failed to save vendor");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!vendorToDelete) return;

    try {
      const response = await fetch(`/api/vendors?id=${vendorToDelete._id}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (data.success) {
        toast.success("Vendor deleted successfully");
        setDeleteDialogOpen(false);
        setVendorToDelete(null);
        fetchVendors();
      } else {
        toast.error(data.error || "Failed to delete vendor");
      }
    } catch (error) {
      console.error("Error deleting vendor:", error);
      toast.error("Failed to delete vendor");
    }
  };

  const handleMarkPaid = async () => {
    if (!vendorToMarkPaid) return;

    try {
      const response = await fetch(
        `/api/vendors/${vendorToMarkPaid._id}/mark-paid`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reference: paymentReference }),
        },
      );

      const data = await response.json();

      if (data.success) {
        toast.success(data.message);
        setMarkPaidDialogOpen(false);
        setVendorToMarkPaid(null);
        setPaymentReference("");
        fetchVendors();
      } else {
        toast.error(data.error || "Failed to mark payment");
      }
    } catch (error) {
      console.error("Error marking payment:", error);
      toast.error("Failed to mark payment");
    }
  };

  const selectPresetVendor = (preset: (typeof PRESET_VENDORS)[0]) => {
    setEditingVendor((prev) => ({
      ...prev,
      name: preset.name,
      serviceType: preset.serviceType,
      vendorUrl: preset.vendorUrl,
    }));
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

  const getPaymentStatusBadge = (vendor: VendorSubscription) => {
    const days = getDaysUntilPayment(vendor.nextPaymentDate);

    if (days < 0) {
      return (
        <Badge className="bg-red-500/20 text-red-400 border-red-500/30">
          Overdue
        </Badge>
      );
    } else if (days === 0) {
      return (
        <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30">
          Due Today
        </Badge>
      );
    } else if (days <= vendor.reminderDaysBefore) {
      return (
        <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
          Due Soon
        </Badge>
      );
    } else {
      return (
        <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
          Upcoming
        </Badge>
      );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="bg-gradient-to-br from-gray-900 to-gray-800 border-gray-700">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-500/20 rounded-lg">
                <CreditCard className="h-6 w-6 text-purple-400" />
              </div>
              <div>
                <CardTitle className="text-white">
                  Vendor Subscriptions
                </CardTitle>
                <CardDescription className="text-gray-400">
                  Track and manage your third-party service subscriptions and
                  payments
                </CardDescription>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={fetchVendors}
                disabled={loading}
                className="border-gray-600"
              >
                <RefreshCw
                  className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`}
                />
                Refresh
              </Button>
              <Button
                onClick={() => handleOpenDialog()}
                className="bg-purple-600 hover:bg-purple-700"
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Vendor
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-gray-800/50 border-gray-700">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Building2 className="h-8 w-8 text-blue-400" />
                <div>
                  <p className="text-sm text-gray-400">Active Subscriptions</p>
                  <p className="text-2xl font-bold text-white">
                    {summary.active}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-800/50 border-gray-700">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <DollarSign className="h-8 w-8 text-green-400" />
                <div>
                  <p className="text-sm text-gray-400">Monthly Cost</p>
                  <p className="text-2xl font-bold text-green-400">
                    {cs}{summary.totalMonthly.toFixed(2)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-800/50 border-gray-700">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Calendar className="h-8 w-8 text-purple-400" />
                <div>
                  <p className="text-sm text-gray-400">Yearly Cost</p>
                  <p className="text-2xl font-bold text-purple-400">
                    {cs}{summary.totalYearly.toFixed(2)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card
            className={`bg-gray-800/50 ${summary.paymentsDueSoon > 0 ? "border-yellow-500/50" : "border-gray-700"}`}
          >
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <AlertTriangle
                  className={`h-8 w-8 ${summary.paymentsDueSoon > 0 ? "text-yellow-400" : "text-gray-400"}`}
                />
                <div>
                  <p className="text-sm text-gray-400">Payments Due Soon</p>
                  <p
                    className={`text-2xl font-bold ${summary.paymentsDueSoon > 0 ? "text-yellow-400" : "text-white"}`}
                  >
                    {summary.paymentsDueSoon}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card className="bg-gray-800/50 border-gray-700">
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <Label className="text-gray-400">Service Type:</Label>
              <Select
                value={filterServiceType}
                onValueChange={setFilterServiceType}
              >
                <SelectTrigger className="w-[150px] bg-gray-900 border-gray-600">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {Object.entries(SERVICE_TYPE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      <span className="flex items-center gap-2">
                        {SERVICE_TYPE_ICONS[value]}
                        {label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-gray-400">Status:</Label>
              <Select value={filterActive} onValueChange={setFilterActive}>
                <SelectTrigger className="w-[150px] bg-gray-900 border-gray-600">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="true">Active</SelectItem>
                  <SelectItem value="false">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Vendors Table */}
      <Card className="bg-gray-800/50 border-gray-700">
        <CardContent className="pt-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : vendors.length === 0 ? (
            <div className="text-center py-12">
              <CreditCard className="h-12 w-12 mx-auto mb-4 text-gray-600" />
              <p className="text-gray-400">No vendor subscriptions found</p>
              <p className="text-sm text-gray-500 mt-1">
                Add your first vendor to track payments
              </p>
              <Button
                onClick={() => handleOpenDialog()}
                className="mt-4 bg-purple-600 hover:bg-purple-700"
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Vendor
              </Button>
            </div>
          ) : (
            <div className="rounded-lg border border-gray-700 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="border-gray-700 hover:bg-gray-800/50">
                    <TableHead className="text-gray-400">Vendor</TableHead>
                    <TableHead className="text-gray-400">Type</TableHead>
                    <TableHead className="text-gray-400">Amount</TableHead>
                    <TableHead className="text-gray-400">Billing</TableHead>
                    <TableHead className="text-gray-400">
                      Next Payment
                    </TableHead>
                    <TableHead className="text-gray-400">Status</TableHead>
                    <TableHead className="text-gray-400 text-right">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vendors.map((vendor) => {
                    const daysUntil = getDaysUntilPayment(
                      vendor.nextPaymentDate,
                    );
                    return (
                      <TableRow
                        key={vendor._id}
                        className="border-gray-700 hover:bg-gray-800/30"
                      >
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div
                              className={`p-2 rounded-lg ${vendor.isActive ? "bg-gray-700" : "bg-gray-800"}`}
                            >
                              {SERVICE_TYPE_ICONS[vendor.serviceType] || (
                                <Building2 className="h-4 w-4" />
                              )}
                            </div>
                            <div>
                              <p
                                className={`font-medium ${vendor.isActive ? "text-white" : "text-gray-500"}`}
                              >
                                {vendor.name}
                              </p>
                              {vendor.description && (
                                <p className="text-xs text-gray-500 truncate max-w-[200px]">
                                  {vendor.description}
                                </p>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className="border-gray-600 text-gray-300"
                          >
                            {SERVICE_TYPE_LABELS[vendor.serviceType] ||
                              vendor.serviceType}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className="text-white font-mono">
                            {vendor.currency === "EUR"
                              ? "€"
                              : vendor.currency === "USD"
                                ? "$"
                                : vendor.currency}
                            {vendor.amount.toFixed(2)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="text-gray-300">
                            {BILLING_CYCLE_LABELS[vendor.billingCycle]}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="text-white">
                              {new Date(
                                vendor.nextPaymentDate,
                              ).toLocaleDateString()}
                            </p>
                            <p
                              className={`text-xs ${
                                daysUntil < 0
                                  ? "text-red-400"
                                  : daysUntil <= 7
                                    ? "text-yellow-400"
                                    : "text-gray-500"
                              }`}
                            >
                              {daysUntil < 0
                                ? `${Math.abs(daysUntil)} days overdue`
                                : daysUntil === 0
                                  ? "Due today"
                                  : `${daysUntil} days`}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            {getPaymentStatusBadge(vendor)}
                            {!vendor.isActive && (
                              <Badge className="bg-gray-500/20 text-gray-400 border-gray-500/30">
                                Inactive
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            {vendor.vendorUrl && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  try {
                                    const url = new URL(vendor.vendorUrl);
                                    if (url.protocol === "https:" || url.protocol === "http:") {
                                      window.open(vendor.vendorUrl, "_blank", "noopener,noreferrer");
                                    }
                                  } catch {
                                    // Invalid URL, don't open
                                  }
                                }}
                                className="text-gray-400 hover:text-white"
                              >
                                <ExternalLink className="h-4 w-4" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setVendorToMarkPaid(vendor);
                                setMarkPaidDialogOpen(true);
                              }}
                              className="text-green-400 hover:text-green-300 hover:bg-green-500/10"
                              title="Mark as Paid"
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOpenDialog(vendor)}
                              className="text-gray-400 hover:text-white"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setVendorToDelete(vendor);
                                setDeleteDialogOpen(true);
                              }}
                              className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-gray-900 border-gray-700 max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              {isEditing ? (
                <Pencil className="h-5 w-5" />
              ) : (
                <Plus className="h-5 w-5" />
              )}
              {isEditing ? "Edit Vendor" : "Add Vendor Subscription"}
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              {isEditing
                ? "Update the vendor subscription details"
                : "Add a new vendor subscription to track"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Preset Vendors */}
            {!isEditing && (
              <div>
                <Label className="text-gray-400 text-sm">
                  Quick Add (click to fill):
                </Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {PRESET_VENDORS.map((preset) => (
                    <Button
                      key={preset.name}
                      variant="outline"
                      size="sm"
                      onClick={() => selectPresetVendor(preset)}
                      className={`border-gray-600 text-gray-300 hover:bg-gray-800 ${
                        editingVendor.name === preset.name
                          ? "bg-gray-800 border-purple-500"
                          : ""
                      }`}
                    >
                      {SERVICE_TYPE_ICONS[preset.serviceType]}
                      <span className="ml-1">{preset.name}</span>
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {/* Basic Info */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-gray-300">Vendor Name *</Label>
                <Input
                  value={editingVendor.name || ""}
                  onChange={(e) =>
                    setEditingVendor({ ...editingVendor, name: e.target.value })
                  }
                  placeholder="e.g., MongoDB Atlas"
                  className="bg-gray-800 border-gray-600"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-gray-300">Service Type</Label>
                <Select
                  value={editingVendor.serviceType || "other"}
                  onValueChange={(value) =>
                    setEditingVendor({ ...editingVendor, serviceType: value })
                  }
                >
                  <SelectTrigger className="bg-gray-800 border-gray-600">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(SERVICE_TYPE_LABELS).map(
                      ([value, label]) => (
                        <SelectItem key={value} value={value}>
                          <span className="flex items-center gap-2">
                            {SERVICE_TYPE_ICONS[value]}
                            {label}
                          </span>
                        </SelectItem>
                      ),
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-gray-300">Description</Label>
              <Input
                value={editingVendor.description || ""}
                onChange={(e) =>
                  setEditingVendor({
                    ...editingVendor,
                    description: e.target.value,
                  })
                }
                placeholder="What is this service used for?"
                className="bg-gray-800 border-gray-600"
              />
            </div>

            {/* Billing */}
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label className="text-gray-300">Amount *</Label>
                <Input
                  type="number"
                  value={editingVendor.amount || ""}
                  onChange={(e) =>
                    setEditingVendor({
                      ...editingVendor,
                      amount: parseFloat(e.target.value) || 0,
                    })
                  }
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                  className="bg-gray-800 border-gray-600"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-gray-300">Currency</Label>
                <Select
                  value={editingVendor.currency || "EUR"}
                  onValueChange={(value) =>
                    setEditingVendor({ ...editingVendor, currency: value })
                  }
                >
                  <SelectTrigger className="bg-gray-800 border-gray-600">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="EUR">EUR (€)</SelectItem>
                    <SelectItem value="USD">USD ($)</SelectItem>
                    <SelectItem value="GBP">GBP (£)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-gray-300">Billing Cycle</Label>
                <Select
                  value={editingVendor.billingCycle || "monthly"}
                  onValueChange={(value) =>
                    setEditingVendor({
                      ...editingVendor,
                      billingCycle: value as any,
                    })
                  }
                >
                  <SelectTrigger className="bg-gray-800 border-gray-600">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(BILLING_CYCLE_LABELS).map(
                      ([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ),
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-gray-300">Next Payment Date *</Label>
                <Input
                  type="date"
                  value={editingVendor.nextPaymentDate || ""}
                  onChange={(e) =>
                    setEditingVendor({
                      ...editingVendor,
                      nextPaymentDate: e.target.value,
                    })
                  }
                  className="bg-gray-800 border-gray-600"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-gray-300">Reminder Days Before</Label>
                <Input
                  type="number"
                  value={editingVendor.reminderDaysBefore || 7}
                  onChange={(e) =>
                    setEditingVendor({
                      ...editingVendor,
                      reminderDaysBefore: parseInt(e.target.value) || 7,
                    })
                  }
                  min="1"
                  max="30"
                  className="bg-gray-800 border-gray-600"
                />
              </div>
            </div>

            {/* Vendor Details */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-gray-300">Vendor Dashboard URL</Label>
                <Input
                  value={editingVendor.vendorUrl || ""}
                  onChange={(e) =>
                    setEditingVendor({
                      ...editingVendor,
                      vendorUrl: e.target.value,
                    })
                  }
                  placeholder="https://..."
                  className="bg-gray-800 border-gray-600"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-gray-300">Account Email</Label>
                <Input
                  type="email"
                  value={editingVendor.accountEmail || ""}
                  onChange={(e) =>
                    setEditingVendor({
                      ...editingVendor,
                      accountEmail: e.target.value,
                    })
                  }
                  placeholder="account@example.com"
                  className="bg-gray-800 border-gray-600"
                />
              </div>
            </div>

            {/* Toggles */}
            <div className="flex items-center gap-8">
              <div className="flex items-center gap-2">
                <Switch
                  checked={editingVendor.isActive ?? true}
                  onCheckedChange={(checked) =>
                    setEditingVendor({ ...editingVendor, isActive: checked })
                  }
                />
                <Label className="text-gray-300">Active</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={editingVendor.autoRenew ?? true}
                  onCheckedChange={(checked) =>
                    setEditingVendor({ ...editingVendor, autoRenew: checked })
                  }
                />
                <Label className="text-gray-300">Auto-renew</Label>
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label className="text-gray-300">Notes</Label>
              <Textarea
                value={editingVendor.notes || ""}
                onChange={(e) =>
                  setEditingVendor({ ...editingVendor, notes: e.target.value })
                }
                placeholder="Additional notes..."
                className="bg-gray-800 border-gray-600 min-h-[80px]"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              className="border-gray-600"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-purple-600 hover:bg-purple-700"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>{isEditing ? "Update" : "Create"}</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="bg-gray-900 border-gray-700">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-red-400" />
              Delete Vendor
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              Are you sure you want to delete "{vendorToDelete?.name}"? This
              action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              className="border-gray-600"
            >
              Cancel
            </Button>
            <Button
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mark Paid Dialog */}
      <Dialog open={markPaidDialogOpen} onOpenChange={setMarkPaidDialogOpen}>
        <DialogContent className="bg-gray-900 border-gray-700">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-400" />
              Mark Payment as Paid
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              Record payment for "{vendorToMarkPaid?.name}" (
              {vendorToMarkPaid?.currency}{" "}
              {vendorToMarkPaid?.amount?.toFixed(2)})
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-gray-300">
                Payment Reference (optional)
              </Label>
              <Input
                value={paymentReference}
                onChange={(e) => setPaymentReference(e.target.value)}
                placeholder="e.g., Invoice #123"
                className="bg-gray-800 border-gray-600"
              />
            </div>
            <p className="text-sm text-gray-400">
              This will record the payment and automatically advance the next
              payment date to{" "}
              <span className="text-white">
                {vendorToMarkPaid &&
                  (() => {
                    const next = new Date(vendorToMarkPaid.nextPaymentDate);
                    switch (vendorToMarkPaid.billingCycle) {
                      case "monthly":
                        next.setMonth(next.getMonth() + 1);
                        break;
                      case "quarterly":
                        next.setMonth(next.getMonth() + 3);
                        break;
                      case "yearly":
                        next.setFullYear(next.getFullYear() + 1);
                        break;
                    }
                    return next.toLocaleDateString();
                  })()}
              </span>
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setMarkPaidDialogOpen(false)}
              className="border-gray-600"
            >
              Cancel
            </Button>
            <Button
              onClick={handleMarkPaid}
              className="bg-green-600 hover:bg-green-700"
            >
              <Check className="h-4 w-4 mr-2" />
              Mark as Paid
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
