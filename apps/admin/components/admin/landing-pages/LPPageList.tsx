"use client";

import { useState, useEffect, useCallback } from "react";
import {
  FileText,
  Plus,
  Search,
  Loader2,
  Pencil,
  Trash2,
  BarChart3,
  Copy,
  Eye,
  LayoutGrid,
  TrendingUp,
  Users,
  MousePointer,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import type { LandingPageData } from "./lp-types";

interface Props {
  onEdit: (page: LandingPageData) => void;
  onViewAnalytics: (page?: LandingPageData) => void;
  onBrowseTemplates: () => void;
  onCreateFromScratch: () => void;
}

export default function LPPageList({
  onEdit,
  onViewAnalytics,
  onBrowseTemplates,
  onCreateFromScratch,
}: Props) {
  const [pages, setPages] = useState<LandingPageData[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchPages = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: String(page),
        limit: "20",
        ...(search ? { search } : {}),
      });
      const res = await fetch(`/api/landing-pages?${params}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setPages(data.pages || []);
      setTotalPages(data.totalPages || 1);
    } catch {
      toast.error("Failed to load landing pages");
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    fetchPages();
  }, [fetchPages]);

  async function handleDelete(id: string) {
    if (!confirm("Deactivate this landing page?")) return;
    try {
      const res = await fetch(`/api/landing-pages/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      toast.success("Landing page deactivated");
      fetchPages();
    } catch {
      toast.error("Failed to deactivate");
    }
  }

  function copyTrackingUrl(trackingId: string) {
    const url = `${window.location.origin.replace("admin.", "")}/lp/${trackingId}`;
    navigator.clipboard.writeText(url);
    toast.success("Tracking URL copied to clipboard!");
  }

  // Summary stats
  const totalVisits = pages.reduce((sum, p) => sum + (p.totalVisits || 0), 0);
  const totalUnique = pages.reduce((sum, p) => sum + (p.uniqueVisitors || 0), 0);
  const activeCount = pages.filter((p) => p.isActive).length;

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          icon={<FileText className="h-5 w-5" />}
          label="Total Pages"
          value={pages.length}
          color="text-blue-400"
          bg="bg-blue-500/10"
        />
        <KPICard
          icon={<Eye className="h-5 w-5" />}
          label="Active"
          value={activeCount}
          color="text-emerald-400"
          bg="bg-emerald-500/10"
        />
        <KPICard
          icon={<MousePointer className="h-5 w-5" />}
          label="Total Visits"
          value={totalVisits}
          color="text-yellow-400"
          bg="bg-yellow-500/10"
        />
        <KPICard
          icon={<Users className="h-5 w-5" />}
          label="Unique Visitors"
          value={totalUnique}
          color="text-purple-400"
          bg="bg-purple-500/10"
        />
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
          <Input
            placeholder="Search landing pages..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="pl-10 bg-gray-900 border-gray-700"
          />
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onViewAnalytics()}
          >
            <BarChart3 className="h-4 w-4 mr-1" />
            Analytics
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onBrowseTemplates}
          >
            <LayoutGrid className="h-4 w-4 mr-1" />
            Templates
          </Button>
          <Button
            size="sm"
            onClick={onCreateFromScratch}
            className="bg-yellow-500 hover:bg-yellow-400 text-black"
          >
            <Plus className="h-4 w-4 mr-1" />
            Create New
          </Button>
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-yellow-500" />
        </div>
      ) : pages.length === 0 ? (
        <Card className="bg-gray-900 border-gray-800">
          <CardContent className="py-16 text-center">
            <FileText className="h-16 w-16 text-gray-700 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-400 mb-2">
              No Landing Pages Yet
            </h3>
            <p className="text-gray-500 text-sm mb-6">
              Create your first landing page from a template or start from
              scratch.
            </p>
            <div className="flex gap-3 justify-center">
              <Button variant="outline" onClick={onBrowseTemplates}>
                <LayoutGrid className="h-4 w-4 mr-1" />
                Browse Templates
              </Button>
              <Button onClick={onCreateFromScratch}>
                <Plus className="h-4 w-4 mr-1" />
                Start from Scratch
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {pages.map((lp) => (
            <PageRow
              key={lp._id}
              page={lp}
              onEdit={onEdit}
              onDelete={handleDelete}
              onCopyUrl={copyTrackingUrl}
              onViewAnalytics={onViewAnalytics}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
          >
            Previous
          </Button>
          <span className="text-gray-400 text-sm">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage(page + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function KPICard({
  icon,
  label,
  value,
  color,
  bg,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: string;
  bg: string;
}) {
  return (
    <Card className="bg-gray-900 border-gray-800">
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`p-2.5 rounded-xl ${bg}`}>
          <span className={color}>{icon}</span>
        </div>
        <div>
          <p className="text-2xl font-bold text-white">{value.toLocaleString()}</p>
          <p className="text-xs text-gray-500">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function PageRow({
  page,
  onEdit,
  onDelete,
  onCopyUrl,
  onViewAnalytics,
}: {
  page: LandingPageData;
  onEdit: (p: LandingPageData) => void;
  onDelete: (id: string) => void;
  onCopyUrl: (trackingId: string) => void;
  onViewAnalytics: (p: LandingPageData) => void;
}) {
  return (
    <Card className="bg-gray-900 border-gray-800 hover:border-gray-700 transition-all">
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-medium text-white truncate">{page.name}</h3>
              <Badge
                className={
                  page.isActive
                    ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                    : "bg-gray-500/20 text-gray-400 border-gray-500/30"
                }
              >
                {page.isActive ? "Active" : "Inactive"}
              </Badge>
              {page.campaign && (
                <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30 text-xs">
                  {page.campaign}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-4 text-xs text-gray-500">
              <span className="font-mono">/lp/{page.trackingId}</span>
              {page.source && <span>Source: {page.source}</span>}
              {page.assignedTo && <span>Partner: {page.assignedTo}</span>}
              <span className="flex items-center gap-1">
                <MousePointer className="h-3 w-3" />
                {page.totalVisits} visits
              </span>
              <span className="flex items-center gap-1">
                <Users className="h-3 w-3" />
                {page.uniqueVisitors} unique
              </span>
              <span className="flex items-center gap-1">
                <TrendingUp className="h-3 w-3" />
                {page.totalSignups} signups
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onCopyUrl(page.trackingId)}
              title="Copy tracking URL"
            >
              <Copy className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onViewAnalytics(page)}
              title="View analytics"
            >
              <BarChart3 className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onEdit(page)}
              title="Edit"
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDelete(page._id)}
              title="Deactivate"
              className="text-red-400 hover:text-red-300"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
