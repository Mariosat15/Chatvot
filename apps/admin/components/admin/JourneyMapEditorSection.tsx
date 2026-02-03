"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { GameIcon } from "@/components/ui/GameIcon";
import { GameIconPicker } from "@/components/ui/GameIconPicker";
import { type GameIconName } from "@/lib/constants/game-icons";
import {
  Map,
  Target,
  Plus,
  Edit,
  Trash2,
  Save,
  X,
  RefreshCw,
  Search,
  Download,
  Eye,
  Settings,
  ZoomIn,
  ZoomOut,
  Move,
  Flag,
  Star,
  Trophy,
  Crown,
  BookOpen,
} from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// Types
interface Zone {
  id: string;
  name: string;
  description: string;
  order: number;
  position: { x: number; y: number };
  color: string;
  icon: string;
  isUnlockable: boolean;
  unlockCondition?: {
    type: string;
    value: string | number;
  };
}

interface Milestone {
  id: string;
  mapId: string;
  name: string;
  description: string;
  shortDescription: string;
  zoneId: string;
  position: { x: number; y: number };
  nodeType: string;
  icon: string;
  color: string;
  size: string;
  unlockCondition?: {
    type: string;
    value?: number;
    comparison?: string;
    badgeId?: string;
  };
  completeCondition: {
    type: string;
    value?: number;
    comparison?: string;
    badgeId?: string;
  };
  rewards: {
    xp: number;
    badgeId?: string;
    title?: string;
  };
  connectedTo: string[];
  connectedFrom: string[];
  isRequired: boolean;
  isAutoComplete: boolean;
  order: number;
  tooltipText?: string;
  celebrationText?: string;
  isActive: boolean;
}

interface MapConfig {
  mapId: string;
  name: string;
  description: string;
  zones: Zone[];
  defaultStartNode: string;
  backgroundColor: string;
  isActive: boolean;
  version: number;
}

// Node type icons and colors
const NODE_TYPE_CONFIG: Record<string, { icon: typeof Flag; color: string; label: string }> = {
  start: { icon: Flag, color: "#22C55E", label: "Start" },
  milestone: { icon: Target, color: "#3B82F6", label: "Milestone" },
  checkpoint: { icon: Star, color: "#F59E0B", label: "Checkpoint" },
  branch: { icon: Map, color: "#8B5CF6", label: "Branch" },
  legendary: { icon: Crown, color: "#EF4444", label: "Legendary" },
  lesson: { icon: BookOpen, color: "#F59E0B", label: "Lesson" },
  optional: { icon: Target, color: "#6B7280", label: "Optional" },
};

// Condition types
const CONDITION_TYPES = [
  { value: "account_created", label: "Account Created" },
  { value: "first_deposit", label: "First Deposit" },
  { value: "total_deposits", label: "Total Deposits" },
  { value: "total_trades", label: "Total Trades" },
  { value: "winning_trades", label: "Winning Trades" },
  { value: "competitions_entered", label: "Competitions Entered" },
  { value: "competitions_completed", label: "Competitions Completed" },
  { value: "first_place_finishes", label: "First Place Finishes" },
  { value: "podium_finishes", label: "Podium Finishes (Top 3)" },
  { value: "total_pnl_positive", label: "Positive Total P&L" },
  { value: "win_rate", label: "Win Rate %" },
  { value: "win_streak", label: "Win Streak" },
  { value: "badge_earned", label: "Badge Earned" },
  { value: "xp_threshold", label: "XP Threshold" },
  { value: "level_reached", label: "Level Reached" },
];

export default function JourneyMapEditorSection() {
  const [mapConfig, setMapConfig] = useState<MapConfig | null>(null);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTab, setSelectedTab] = useState("map");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedZone, setSelectedZone] = useState<string | "all">("all");
  
  // Edit dialogs
  const [editMilestoneOpen, setEditMilestoneOpen] = useState(false);
  const [editZoneOpen, setEditZoneOpen] = useState(false);
  const [selectedMilestone, setSelectedMilestone] = useState<Milestone | null>(null);
  const [selectedEditZone, setSelectedEditZone] = useState<Zone | null>(null);
  
  // Visual map state
  const [mapScale, setMapScale] = useState(1);
  const [mapOffset, setMapOffset] = useState({ x: 0, y: 0 });
  const [previewMode, setPreviewMode] = useState(false);

  // Fetch data
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [mapRes, milestonesRes] = await Promise.all([
        fetch("/api/journey-map?mapId=traders_journey"),
        fetch("/api/journey-milestones?mapId=traders_journey"),
      ]);

      const mapData = await mapRes.json();
      const milestonesData = await milestonesRes.json();

      if (mapData.success) {
        setMapConfig(mapData.mapConfig);
      }

      if (milestonesData.success) {
        setMilestones(milestonesData.milestones);
      }
    } catch (error) {
      console.error("Error fetching journey data:", error);
      toast.error("Failed to fetch journey map data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Save milestone
  const saveMilestone = async (milestone: Partial<Milestone>) => {
    try {
      const isNew = !milestones.find(m => m.id === milestone.id);
      const method = isNew ? "POST" : "PUT";

      const res = await fetch("/api/journey-milestones", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(milestone),
      });

      const data = await res.json();

      if (data.success) {
        toast.success(isNew ? "Milestone created" : "Milestone updated");
        fetchData();
        setEditMilestoneOpen(false);
        setSelectedMilestone(null);
      } else {
        toast.error(data.error || "Failed to save milestone");
      }
    } catch (error) {
      toast.error("Failed to save milestone");
    }
  };

  // Delete milestone
  const deleteMilestone = async (id: string) => {
    if (!confirm("Are you sure you want to deactivate this milestone?")) return;

    try {
      const res = await fetch(`/api/journey-milestones?id=${id}`, {
        method: "DELETE",
      });

      const data = await res.json();

      if (data.success) {
        toast.success("Milestone deactivated");
        fetchData();
      } else {
        toast.error(data.error || "Failed to delete milestone");
      }
    } catch (error) {
      toast.error("Failed to delete milestone");
    }
  };

  // Save map config
  const saveMapConfig = async () => {
    if (!mapConfig) return;

    try {
      const res = await fetch("/api/journey-map", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mapConfig),
      });

      const data = await res.json();

      if (data.success) {
        toast.success("Map configuration saved");
      } else {
        toast.error(data.error || "Failed to save map");
      }
    } catch (error) {
      toast.error("Failed to save map");
    }
  };

  // Seed default map template
  const seedDefaultMap = async () => {
    if (!confirm("This will seed/update the default journey map template. Continue?")) return;
    
    setLoading(true);
    try {
      const res = await fetch("/api/journey-map/seed");
      const data = await res.json();

      if (data.success) {
        toast.success(`Map seeded: ${data.milestonesCreated} created, ${data.milestonesUpdated} updated`);
        fetchData();
      } else {
        toast.error(data.error || "Failed to seed map");
      }
    } catch (error) {
      toast.error("Failed to seed map");
    } finally {
      setLoading(false);
    }
  };

  // Filter milestones
  const filteredMilestones = milestones.filter(m => {
    const matchesSearch = 
      m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.id.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesZone = selectedZone === "all" || m.zoneId === selectedZone;
    return matchesSearch && matchesZone;
  });

  // Render visual map
  const renderVisualMap = () => (
    <div className="relative w-full h-[600px] bg-slate-900 rounded-lg overflow-hidden border border-slate-700">
      {/* Map Controls */}
      <div className="absolute top-4 left-4 z-10 flex gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() => setMapScale(s => Math.min(s + 0.2, 2))}
        >
          <ZoomIn className="h-4 w-4" />
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setMapScale(s => Math.max(s - 0.2, 0.5))}
        >
          <ZoomOut className="h-4 w-4" />
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => { setMapScale(1); setMapOffset({ x: 0, y: 0 }); }}
        >
          <Move className="h-4 w-4" />
        </Button>
        <Button
          size="sm"
          variant={previewMode ? "default" : "outline"}
          onClick={() => setPreviewMode(!previewMode)}
        >
          <Eye className="h-4 w-4 mr-1" />
          {previewMode ? "Edit" : "Preview"}
        </Button>
      </div>

      {/* SVG Map */}
      <svg
        className="w-full h-full"
        viewBox="0 0 1200 600"
        style={{
          transform: `scale(${mapScale}) translate(${mapOffset.x}px, ${mapOffset.y}px)`,
        }}
      >
        {/* Background gradient */}
        <defs>
          <linearGradient id="mapGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#0F172A" />
            <stop offset="100%" stopColor="#1E293B" />
          </linearGradient>
        </defs>
        <rect width="1200" height="600" fill="url(#mapGradient)" />

        {/* Zone backgrounds */}
        {mapConfig?.zones.map((zone, index) => (
          <g key={zone.id}>
            <rect
              x={100 + index * 200}
              y={50}
              width={180}
              height={500}
              rx={10}
              fill={zone.color}
              fillOpacity={0.1}
              stroke={zone.color}
              strokeOpacity={0.3}
              strokeWidth={2}
            />
            <text
              x={190 + index * 200}
              y={80}
              fill={zone.color}
              fontSize="14"
              fontWeight="bold"
              textAnchor="middle"
            >
              {zone.name}
            </text>
          </g>
        ))}

        {/* Connections */}
        {milestones.map(milestone =>
          milestone.connectedTo.map(targetId => {
            const target = milestones.find(m => m.id === targetId);
            if (!target) return null;
            return (
              <line
                key={`${milestone.id}-${targetId}`}
                x1={milestone.position.x}
                y1={milestone.position.y}
                x2={target.position.x}
                y2={target.position.y}
                stroke={milestone.color}
                strokeWidth={2}
                strokeOpacity={0.5}
                strokeDasharray={milestone.nodeType === "branch" ? "5,5" : "none"}
              />
            );
          })
        )}

        {/* Nodes */}
        {milestones.map(milestone => {
          const config = NODE_TYPE_CONFIG[milestone.nodeType] || NODE_TYPE_CONFIG.milestone;
          const size = milestone.size === "large" ? 30 : milestone.size === "small" ? 18 : 24;
          
          return (
            <g
              key={milestone.id}
              className="cursor-pointer"
              onClick={() => {
                if (!previewMode) {
                  setSelectedMilestone(milestone);
                  setEditMilestoneOpen(true);
                }
              }}
            >
              <circle
                cx={milestone.position.x}
                cy={milestone.position.y}
                r={size}
                fill={milestone.isActive ? milestone.color : "#4B5563"}
                stroke={previewMode ? "#fff" : "#94A3B8"}
                strokeWidth={2}
                className="transition-all hover:stroke-white hover:stroke-[3]"
              />
              <text
                x={milestone.position.x}
                y={milestone.position.y + size + 15}
                fill="#E2E8F0"
                fontSize="10"
                textAnchor="middle"
              >
                {milestone.name.length > 15 ? milestone.name.slice(0, 12) + "..." : milestone.name}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );

  // Render milestone editor dialog
  const renderMilestoneEditor = () => {
    if (!selectedMilestone) return null;

    return (
      <Dialog open={editMilestoneOpen} onOpenChange={setEditMilestoneOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {milestones.find(m => m.id === selectedMilestone.id) ? "Edit" : "Create"} Milestone
            </DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Basic Info */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>ID (unique)</Label>
                <Input
                  value={selectedMilestone.id}
                  onChange={e => setSelectedMilestone({ ...selectedMilestone, id: e.target.value })}
                  placeholder="e.g., first_trade"
                />
              </div>
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  value={selectedMilestone.name}
                  onChange={e => setSelectedMilestone({ ...selectedMilestone, name: e.target.value })}
                  placeholder="First Trade"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={selectedMilestone.description}
                onChange={e => setSelectedMilestone({ ...selectedMilestone, description: e.target.value })}
                placeholder="Execute your first trade..."
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Zone</Label>
                <Select
                  value={selectedMilestone.zoneId}
                  onValueChange={value => setSelectedMilestone({ ...selectedMilestone, zoneId: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {mapConfig?.zones.map(zone => (
                      <SelectItem key={zone.id} value={zone.id}>
                        {zone.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Node Type</Label>
                <Select
                  value={selectedMilestone.nodeType}
                  onValueChange={value => setSelectedMilestone({ ...selectedMilestone, nodeType: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(NODE_TYPE_CONFIG).map(([key, config]) => (
                      <SelectItem key={key} value={key}>
                        {config.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Size</Label>
                <Select
                  value={selectedMilestone.size}
                  onValueChange={value => setSelectedMilestone({ ...selectedMilestone, size: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="small">Small</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="large">Large</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Position */}
            <div className="grid grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label>Position X</Label>
                <Input
                  type="number"
                  value={selectedMilestone.position.x}
                  onChange={e => setSelectedMilestone({
                    ...selectedMilestone,
                    position: { ...selectedMilestone.position, x: parseInt(e.target.value) || 0 }
                  })}
                />
              </div>
              <div className="space-y-2">
                <Label>Position Y</Label>
                <Input
                  type="number"
                  value={selectedMilestone.position.y}
                  onChange={e => setSelectedMilestone({
                    ...selectedMilestone,
                    position: { ...selectedMilestone.position, y: parseInt(e.target.value) || 0 }
                  })}
                />
              </div>
              <div className="space-y-2">
                <Label>Color</Label>
                <Input
                  type="color"
                  value={selectedMilestone.color}
                  onChange={e => setSelectedMilestone({ ...selectedMilestone, color: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Order</Label>
                <Input
                  type="number"
                  value={selectedMilestone.order}
                  onChange={e => setSelectedMilestone({
                    ...selectedMilestone,
                    order: parseInt(e.target.value) || 0
                  })}
                />
              </div>
            </div>

            {/* Icon */}
            <div className="space-y-2">
              <Label>Icon</Label>
              <div className="flex items-center gap-4">
                <GameIcon name={selectedMilestone.icon as GameIconName} size={40} />
                <GameIconPicker
                  value={selectedMilestone.icon as GameIconName}
                  onChange={(icon) => setSelectedMilestone({ ...selectedMilestone, icon })}
                />
              </div>
            </div>

            {/* Completion Condition */}
            <div className="space-y-2 p-4 border rounded-lg">
              <Label className="text-base font-semibold">Completion Condition</Label>
              <div className="grid grid-cols-3 gap-4 mt-2">
                <div className="space-y-2">
                  <Label className="text-sm">Type</Label>
                  <Select
                    value={selectedMilestone.completeCondition.type}
                    onValueChange={value => setSelectedMilestone({
                      ...selectedMilestone,
                      completeCondition: { ...selectedMilestone.completeCondition, type: value }
                    })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CONDITION_TYPES.map(ct => (
                        <SelectItem key={ct.value} value={ct.value}>
                          {ct.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm">Value</Label>
                  <Input
                    type="number"
                    value={selectedMilestone.completeCondition.value || ""}
                    onChange={e => setSelectedMilestone({
                      ...selectedMilestone,
                      completeCondition: {
                        ...selectedMilestone.completeCondition,
                        value: e.target.value ? parseInt(e.target.value) : undefined
                      }
                    })}
                    placeholder="e.g., 10"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm">Comparison</Label>
                  <Select
                    value={selectedMilestone.completeCondition.comparison || "gte"}
                    onValueChange={value => setSelectedMilestone({
                      ...selectedMilestone,
                      completeCondition: { ...selectedMilestone.completeCondition, comparison: value }
                    })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="gte">≥ Greater or Equal</SelectItem>
                      <SelectItem value="gt">&gt; Greater</SelectItem>
                      <SelectItem value="eq">= Equal</SelectItem>
                      <SelectItem value="lte">≤ Less or Equal</SelectItem>
                      <SelectItem value="lt">&lt; Less</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Rewards */}
            <div className="space-y-2 p-4 border rounded-lg">
              <Label className="text-base font-semibold">Rewards</Label>
              <div className="grid grid-cols-3 gap-4 mt-2">
                <div className="space-y-2">
                  <Label className="text-sm">XP</Label>
                  <Input
                    type="number"
                    value={selectedMilestone.rewards.xp}
                    onChange={e => setSelectedMilestone({
                      ...selectedMilestone,
                      rewards: { ...selectedMilestone.rewards, xp: parseInt(e.target.value) || 0 }
                    })}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm">Badge ID (optional)</Label>
                  <Input
                    value={selectedMilestone.rewards.badgeId || ""}
                    onChange={e => setSelectedMilestone({
                      ...selectedMilestone,
                      rewards: { ...selectedMilestone.rewards, badgeId: e.target.value || undefined }
                    })}
                    placeholder="e.g., trade_first"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm">Title (optional)</Label>
                  <Input
                    value={selectedMilestone.rewards.title || ""}
                    onChange={e => setSelectedMilestone({
                      ...selectedMilestone,
                      rewards: { ...selectedMilestone.rewards, title: e.target.value || undefined }
                    })}
                    placeholder="e.g., First Trader"
                  />
                </div>
              </div>
            </div>

            {/* Connections */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Connected To (comma-separated IDs)</Label>
                <Input
                  value={selectedMilestone.connectedTo.join(", ")}
                  onChange={e => setSelectedMilestone({
                    ...selectedMilestone,
                    connectedTo: e.target.value.split(",").map(s => s.trim()).filter(Boolean)
                  })}
                  placeholder="first_trade, first_deposit"
                />
              </div>
              <div className="space-y-2">
                <Label>Connected From (comma-separated IDs)</Label>
                <Input
                  value={selectedMilestone.connectedFrom.join(", ")}
                  onChange={e => setSelectedMilestone({
                    ...selectedMilestone,
                    connectedFrom: e.target.value.split(",").map(s => s.trim()).filter(Boolean)
                  })}
                  placeholder="account_created"
                />
              </div>
            </div>

            {/* Options */}
            <div className="flex gap-6">
              <div className="flex items-center gap-2">
                <Switch
                  checked={selectedMilestone.isRequired}
                  onCheckedChange={checked => setSelectedMilestone({
                    ...selectedMilestone,
                    isRequired: checked
                  })}
                />
                <Label>Required for progression</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={selectedMilestone.isAutoComplete}
                  onCheckedChange={checked => setSelectedMilestone({
                    ...selectedMilestone,
                    isAutoComplete: checked
                  })}
                />
                <Label>Auto-complete on unlock</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={selectedMilestone.isActive}
                  onCheckedChange={checked => setSelectedMilestone({
                    ...selectedMilestone,
                    isActive: checked
                  })}
                />
                <Label>Active</Label>
              </div>
            </div>

            {/* Texts */}
            <div className="space-y-2">
              <Label>Celebration Text (shown on complete)</Label>
              <Textarea
                value={selectedMilestone.celebrationText || ""}
                onChange={e => setSelectedMilestone({
                  ...selectedMilestone,
                  celebrationText: e.target.value
                })}
                placeholder="Congratulations! You've completed this milestone!"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditMilestoneOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => saveMilestone(selectedMilestone)}>
              <Save className="h-4 w-4 mr-2" />
              Save Milestone
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Map className="h-6 w-6" />
            Journey Map Editor
          </h2>
          <p className="text-muted-foreground">
            Configure the trader's journey progression map
          </p>
        </div>
        <div className="flex gap-2">
          {(!mapConfig || milestones.length === 0) && (
            <Button variant="default" onClick={seedDefaultMap} className="bg-amber-600 hover:bg-amber-700">
              <Download className="h-4 w-4 mr-2" />
              Seed Default Map
            </Button>
          )}
          {mapConfig && milestones.length > 0 && (
            <Button variant="outline" onClick={seedDefaultMap}>
              <Download className="h-4 w-4 mr-2" />
              Reset to Default
            </Button>
          )}
          <Button variant="outline" onClick={fetchData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={saveMapConfig} disabled={!mapConfig}>
            <Save className="h-4 w-4 mr-2" />
            Save Map
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Milestones
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{milestones.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Zones
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{mapConfig?.zones.length || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active Milestones
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {milestones.filter(m => m.isActive).length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Map Version
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">v{mapConfig?.version || 1}</div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList>
          <TabsTrigger value="map">
            <Map className="h-4 w-4 mr-2" />
            Visual Map
          </TabsTrigger>
          <TabsTrigger value="milestones">
            <Target className="h-4 w-4 mr-2" />
            Milestones
          </TabsTrigger>
          <TabsTrigger value="zones">
            <Flag className="h-4 w-4 mr-2" />
            Zones
          </TabsTrigger>
          <TabsTrigger value="settings">
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </TabsTrigger>
        </TabsList>

        {/* Visual Map Tab */}
        <TabsContent value="map" className="mt-4">
          {renderVisualMap()}
          <p className="text-sm text-muted-foreground mt-2">
            Click on any node to edit. Toggle Preview mode to see player view.
          </p>
        </TabsContent>

        {/* Milestones Tab */}
        <TabsContent value="milestones" className="mt-4">
          <div className="flex gap-4 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search milestones..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={selectedZone} onValueChange={setSelectedZone}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filter by zone" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Zones</SelectItem>
                {mapConfig?.zones.map(zone => (
                  <SelectItem key={zone.id} value={zone.id}>
                    {zone.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              onClick={() => {
                setSelectedMilestone({
                  id: "",
                  mapId: "traders_journey",
                  name: "",
                  description: "",
                  shortDescription: "",
                  zoneId: mapConfig?.zones[0]?.id || "starting_dock",
                  position: { x: 100, y: 300 },
                  nodeType: "milestone",
                  icon: "target",
                  color: "#3B82F6",
                  size: "medium",
                  completeCondition: { type: "total_trades", value: 1, comparison: "gte" },
                  rewards: { xp: 10 },
                  connectedTo: [],
                  connectedFrom: [],
                  isRequired: true,
                  isAutoComplete: false,
                  order: milestones.length + 1,
                  isActive: true,
                });
                setEditMilestoneOpen(true);
              }}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Milestone
            </Button>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order</TableHead>
                <TableHead>Icon</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Zone</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Condition</TableHead>
                <TableHead>Rewards</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredMilestones.map(milestone => (
                <TableRow key={milestone.id}>
                  <TableCell>{milestone.order}</TableCell>
                  <TableCell>
                    <GameIcon name={milestone.icon as GameIconName} size={24} />
                  </TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium">{milestone.name}</div>
                      <div className="text-xs text-muted-foreground">{milestone.id}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" style={{ borderColor: milestone.color }}>
                      {mapConfig?.zones.find(z => z.id === milestone.zoneId)?.name || milestone.zoneId}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge>{milestone.nodeType}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      {milestone.completeCondition.type}
                      {milestone.completeCondition.value && (
                        <span className="text-muted-foreground">
                          {" "}({milestone.completeCondition.comparison || "≥"} {milestone.completeCondition.value})
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      <span className="text-yellow-500">{milestone.rewards.xp} XP</span>
                      {milestone.rewards.badgeId && (
                        <span className="text-muted-foreground ml-1">+badge</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={milestone.isActive ? "default" : "secondary"}>
                      {milestone.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setSelectedMilestone(milestone);
                          setEditMilestoneOpen(true);
                        }}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => deleteMilestone(milestone.id)}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TabsContent>

        {/* Zones Tab */}
        <TabsContent value="zones" className="mt-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order</TableHead>
                <TableHead>ID</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Color</TableHead>
                <TableHead>Milestones</TableHead>
                <TableHead>Unlock Condition</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mapConfig?.zones.map(zone => (
                <TableRow key={zone.id}>
                  <TableCell>{zone.order}</TableCell>
                  <TableCell className="font-mono text-sm">{zone.id}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-4 h-4 rounded"
                        style={{ backgroundColor: zone.color }}
                      />
                      {zone.name}
                    </div>
                  </TableCell>
                  <TableCell>{zone.color}</TableCell>
                  <TableCell>
                    {milestones.filter(m => m.zoneId === zone.id).length}
                  </TableCell>
                  <TableCell>
                    {zone.unlockCondition ? (
                      <span className="text-sm">
                        {zone.unlockCondition.type}: {zone.unlockCondition.value}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">Always unlocked</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings" className="mt-4">
          {mapConfig && (
            <div className="space-y-4 max-w-lg">
              <div className="space-y-2">
                <Label>Map Name</Label>
                <Input
                  value={mapConfig.name}
                  onChange={e => setMapConfig({ ...mapConfig, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={mapConfig.description}
                  onChange={e => setMapConfig({ ...mapConfig, description: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Default Start Node</Label>
                <Select
                  value={mapConfig.defaultStartNode}
                  onValueChange={value => setMapConfig({ ...mapConfig, defaultStartNode: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {milestones.map(m => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name} ({m.id})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Background Color</Label>
                <Input
                  type="color"
                  value={mapConfig.backgroundColor}
                  onChange={e => setMapConfig({ ...mapConfig, backgroundColor: e.target.value })}
                />
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={mapConfig.isActive}
                  onCheckedChange={checked => setMapConfig({ ...mapConfig, isActive: checked })}
                />
                <Label>Map Active</Label>
              </div>
              <Button onClick={saveMapConfig}>
                <Save className="h-4 w-4 mr-2" />
                Save Settings
              </Button>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Milestone Editor Dialog */}
      {renderMilestoneEditor()}
    </div>
  );
}
