"use client";

import { useState } from "react";
import {
  ShieldBan,
  Plus,
  Trash2,
  Globe,
  Monitor,
  User,
  Wifi,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import type { BlockedRule } from "./visitor-types";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  ip: { label: "IP Address", icon: <Wifi className="h-3 w-3" />, color: "text-red-400" },
  ip_range: { label: "IP Range", icon: <Wifi className="h-3 w-3" />, color: "text-orange-400" },
  user_agent: { label: "User Agent", icon: <Monitor className="h-3 w-3" />, color: "text-yellow-400" },
  user: { label: "User ID", icon: <User className="h-3 w-3" />, color: "text-purple-400" },
  country: { label: "Country", icon: <Globe className="h-3 w-3" />, color: "text-blue-400" },
};

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString("en-GB", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ─── Props ───────────────────────────────────────────────────────────────────

interface Props {
  blocked: BlockedRule[];
  onRefresh: () => void;
  /** Pre-fill the block form with an IP. Set by the parent when user clicks Block on a visitor. */
  prefillIp?: string;
  onClearPrefill?: () => void;
}

export default function BlockedVisitorsList({
  blocked,
  onRefresh,
  prefillIp,
  onClearPrefill,
}: Props) {
  const [dialogOpen, setDialogOpen] = useState(!!prefillIp);
  const [blockType, setBlockType] = useState<string>(prefillIp ? "ip" : "ip");
  const [blockValue, setBlockValue] = useState(prefillIp || "");
  const [blockReason, setBlockReason] = useState("");
  const [blockExpiry, setBlockExpiry] = useState("");
  const [saving, setSaving] = useState(false);

  // Reason: Open dialog when parent passes a prefillIp (from Block button)
  if (prefillIp && !dialogOpen) {
    setDialogOpen(true);
    setBlockType("ip");
    setBlockValue(prefillIp);
  }

  const handleBlock = async () => {
    if (!blockValue.trim()) {
      toast.error("Value is required");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/visitors/block", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: blockType,
          value: blockValue.trim(),
          reason: blockReason.trim(),
          blockedBy: "admin",
          expiresAt: blockExpiry || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to block");
        return;
      }
      toast.success("Visitor blocked successfully");
      setDialogOpen(false);
      setBlockValue("");
      setBlockReason("");
      setBlockExpiry("");
      onClearPrefill?.();
      onRefresh();
    } catch {
      toast.error("Failed to block visitor");
    } finally {
      setSaving(false);
    }
  };

  const handleUnblock = async (id: string) => {
    try {
      const res = await fetch(`/api/visitors/block?id=${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error();
      toast.success("Block rule removed");
      onRefresh();
    } catch {
      toast.error("Failed to remove block rule");
    }
  };

  const activeBlocks = blocked.filter((b) => b.isActive);
  const inactiveBlocks = blocked.filter((b) => !b.isActive);

  return (
    <Card className="bg-gray-800/50 border-gray-700">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-gray-300 flex items-center gap-1.5">
            <ShieldBan className="h-4 w-4 text-red-400" />
            Blocked Visitors ({activeBlocks.length} active)
          </CardTitle>

          <Dialog
            open={dialogOpen}
            onOpenChange={(open) => {
              setDialogOpen(open);
              if (!open) onClearPrefill?.();
            }}
          >
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" className="h-7 text-xs">
                <Plus className="h-3 w-3 mr-1" /> Add Block Rule
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-gray-900 border-gray-700">
              <DialogHeader>
                <DialogTitle className="text-white">Block Visitor</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label className="text-gray-300">Block Type</Label>
                  <Select value={blockType} onValueChange={setBlockType}>
                    <SelectTrigger className="bg-gray-800 border-gray-700 text-white mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-800 border-gray-700">
                      <SelectItem value="ip">IP Address</SelectItem>
                      <SelectItem value="ip_range">IP Range (CIDR)</SelectItem>
                      <SelectItem value="user_agent">User Agent Pattern</SelectItem>
                      <SelectItem value="user">User ID</SelectItem>
                      <SelectItem value="country">Country Code</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-gray-300">Value</Label>
                  <Input
                    className="bg-gray-800 border-gray-700 text-white mt-1"
                    placeholder={
                      blockType === "ip"
                        ? "e.g. 192.168.1.1"
                        : blockType === "country"
                          ? "e.g. CN, RU"
                          : blockType === "ip_range"
                            ? "e.g. 192.168.1.0/24"
                            : "Value..."
                    }
                    value={blockValue}
                    onChange={(e) => setBlockValue(e.target.value)}
                  />
                </div>
                <div>
                  <Label className="text-gray-300">Reason (optional)</Label>
                  <Input
                    className="bg-gray-800 border-gray-700 text-white mt-1"
                    placeholder="Why block this visitor?"
                    value={blockReason}
                    onChange={(e) => setBlockReason(e.target.value)}
                  />
                </div>
                <div>
                  <Label className="text-gray-300">
                    Expiry (optional, leave blank for permanent)
                  </Label>
                  <Input
                    type="datetime-local"
                    className="bg-gray-800 border-gray-700 text-white mt-1"
                    value={blockExpiry}
                    onChange={(e) => setBlockExpiry(e.target.value)}
                  />
                </div>
                <Button
                  onClick={handleBlock}
                  disabled={saving}
                  className="w-full bg-red-600 hover:bg-red-700"
                >
                  {saving ? "Blocking..." : "Block Visitor"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent className="p-3">
        <div className="space-y-1 max-h-[400px] overflow-y-auto">
          {activeBlocks.length === 0 && inactiveBlocks.length === 0 ? (
            <p className="text-xs text-gray-500 text-center py-4">
              No block rules configured
            </p>
          ) : (
            <>
              {activeBlocks.map((b) => {
                const typeInfo = TYPE_LABELS[b.type] || TYPE_LABELS.ip;
                return (
                  <div
                    key={b._id}
                    className="flex items-center gap-2 p-2 rounded-lg bg-red-500/5 border border-red-500/20 text-xs"
                  >
                    <span className={typeInfo.color}>{typeInfo.icon}</span>
                    <Badge variant="outline" className="text-[10px] text-red-400 border-red-500/30">
                      {typeInfo.label}
                    </Badge>
                    <span className="text-white font-mono">{b.value}</span>
                    {b.reason && (
                      <span className="text-gray-500 truncate max-w-[120px]">
                        — {b.reason}
                      </span>
                    )}
                    <span className="text-gray-600 ml-auto">
                      {b.hitCount} hits
                    </span>
                    {b.expiresAt && (
                      <span className="text-gray-500 text-[10px]">
                        exp: {formatDate(b.expiresAt)}
                      </span>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-5 px-1.5 text-gray-400 hover:text-white hover:bg-gray-700"
                      onClick={() => handleUnblock(b._id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                );
              })}
              {inactiveBlocks.length > 0 && (
                <div className="pt-2 border-t border-gray-700 mt-2">
                  <p className="text-[10px] text-gray-500 mb-1">
                    Inactive / Removed ({inactiveBlocks.length})
                  </p>
                  {inactiveBlocks.slice(0, 10).map((b) => {
                    const typeInfo = TYPE_LABELS[b.type] || TYPE_LABELS.ip;
                    return (
                      <div
                        key={b._id}
                        className="flex items-center gap-2 p-1.5 rounded text-xs text-gray-600"
                      >
                        {typeInfo.icon}
                        <span className="font-mono">{b.value}</span>
                        <span className="ml-auto">{b.hitCount} hits</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
