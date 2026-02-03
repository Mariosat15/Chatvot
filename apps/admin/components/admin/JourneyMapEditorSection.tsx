"use client";

import { useState, useEffect, useCallback, useRef } from "react";
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
  MousePointer,
  Hand,
  RotateCcw,
  AlertTriangle,
  Wand2,
  MapPin,
  Link,
  Palette,
} from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Image from "next/image";

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
  backgroundImage?: string;
  isActive: boolean;
  version: number;
}

// Map dimensions (matching treasure map)
const MAP_WIDTH = 1200;
const MAP_HEIGHT = 800;

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
  const [selectedMilestone, setSelectedMilestone] = useState<Milestone | null>(null);
  
  // Visual map state
  const [mapScale, setMapScale] = useState(0.7);
  const [mapOffset, setMapOffset] = useState({ x: 0, y: 0 });
  const [editMode, setEditMode] = useState<"select" | "drag">("select");
  const [draggedMilestone, setDraggedMilestone] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  // Generator state
  const [generatorOpen, setGeneratorOpen] = useState(false);
  const [generatorStep, setGeneratorStep] = useState(1);
  const [generatorIslands, setGeneratorIslands] = useState<Array<{
    id: number;
    name: string;
    position: { x: number; y: number };
    milestonesCount: number;
    zoneId: string;
    isPlaced: boolean;
  }>>([]);
  const [generatorZones, setGeneratorZones] = useState<Array<{
    id: string;
    name: string;
    color: string;
    order: number;
  }>>([
    { id: "zone_1", name: "Starting Area", color: "#22C55E", order: 1 },
    { id: "zone_2", name: "Learning Waters", color: "#3B82F6", order: 2 },
    { id: "zone_3", name: "Challenge Zone", color: "#8B5CF6", order: 3 },
    { id: "zone_4", name: "Mastery Islands", color: "#EF4444", order: 4 },
  ]);
  const [generatorIslandCount, setGeneratorIslandCount] = useState(10);
  const [generatorPlacingMode, setGeneratorPlacingMode] = useState(false);
  const [generatorCurrentIsland, setGeneratorCurrentIsland] = useState(0);
  const generatorMapRef = useRef<HTMLDivElement>(null);
  const [generatorMapScale, setGeneratorMapScale] = useState(0.6);

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

  // Update milestone position (local state)
  const updateMilestonePosition = (id: string, x: number, y: number) => {
    setMilestones(prev => prev.map(m => 
      m.id === id ? { ...m, position: { x: Math.round(x), y: Math.round(y) } } : m
    ));
    setHasUnsavedChanges(true);
  };

  // Save single milestone
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

  // Save all milestone positions
  const saveAllPositions = async () => {
    try {
      let savedCount = 0;
      for (const milestone of milestones) {
        const res = await fetch("/api/journey-milestones", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: milestone.id,
            position: milestone.position,
          }),
        });
        const data = await res.json();
        if (data.success) savedCount++;
      }
      toast.success(`Saved ${savedCount} milestone positions`);
      setHasUnsavedChanges(false);
    } catch (error) {
      toast.error("Failed to save positions");
    }
  };

  // Delete milestone (permanent)
  const deleteMilestone = async (id: string) => {
    if (!confirm("Are you sure you want to permanently delete this milestone?")) return;

    try {
      const res = await fetch(`/api/journey-milestones?id=${id}`, {
        method: "DELETE",
      });

      const data = await res.json();

      if (data.success) {
        toast.success("Milestone deleted");
        fetchData();
      } else {
        toast.error(data.error || "Failed to delete milestone");
      }
    } catch (error) {
      toast.error("Failed to delete milestone");
    }
  };

  // Delete ALL milestones
  const deleteAllMilestones = async () => {
    if (!confirm("Are you sure you want to DELETE ALL MILESTONES? This cannot be undone!")) return;
    if (!confirm("FINAL WARNING: This will permanently delete all milestones. Continue?")) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/journey-milestones?all=true&mapId=traders_journey`, {
        method: "DELETE",
      });

      const data = await res.json();

      if (data.success) {
        toast.success(`Deleted ${data.deletedCount} milestones`);
        fetchData();
      } else {
        toast.error(data.error || "Failed to delete milestones");
      }
    } catch (error) {
      toast.error("Failed to delete milestones");
    } finally {
      setLoading(false);
    }
  };

  // Delete zone
  const deleteZone = async (zoneId: string) => {
    if (!confirm(`Are you sure you want to delete zone "${zoneId}"?`)) return;

    try {
      const res = await fetch(`/api/journey-map?mapId=traders_journey&zoneId=${zoneId}`, {
        method: "DELETE",
      });

      const data = await res.json();

      if (data.success) {
        toast.success("Zone deleted");
        setMapConfig(data.mapConfig);
      } else {
        toast.error(data.error || "Failed to delete zone");
      }
    } catch (error) {
      toast.error("Failed to delete zone");
    }
  };

  // Delete ALL zones
  const deleteAllZones = async () => {
    if (!confirm("Are you sure you want to DELETE ALL ZONES? This cannot be undone!")) return;

    try {
      const res = await fetch(`/api/journey-map?mapId=traders_journey&clearZones=true`, {
        method: "DELETE",
      });

      const data = await res.json();

      if (data.success) {
        toast.success("All zones cleared");
        setMapConfig(data.mapConfig);
      } else {
        toast.error(data.error || "Failed to clear zones");
      }
    } catch (error) {
      toast.error("Failed to clear zones");
    }
  };

  // Delete EVERYTHING (milestones + zones + map)
  const deleteEverything = async () => {
    if (!confirm("⚠️ DANGER: This will delete ALL milestones AND zones. Are you sure?")) return;
    if (!confirm("FINAL WARNING: This action cannot be undone! Continue?")) return;

    setLoading(true);
    try {
      // Delete all milestones first
      await fetch(`/api/journey-milestones?all=true&mapId=traders_journey`, {
        method: "DELETE",
      });

      // Clear all zones
      await fetch(`/api/journey-map?mapId=traders_journey&clearZones=true`, {
        method: "DELETE",
      });

      toast.success("All milestones and zones deleted");
      fetchData();
    } catch (error) {
      toast.error("Failed to delete everything");
    } finally {
      setLoading(false);
    }
  };

  // ============================================
  // GENERATOR FUNCTIONS
  // ============================================

  // Initialize generator with island count
  const initializeGenerator = () => {
    const islands = Array.from({ length: generatorIslandCount }, (_, i) => ({
      id: i + 1,
      name: `Island ${i + 1}`,
      position: { x: 0, y: 0 },
      milestonesCount: 1,
      zoneId: generatorZones[Math.floor(i / Math.ceil(generatorIslandCount / generatorZones.length))]?.id || "zone_1",
      isPlaced: false,
    }));
    setGeneratorIslands(islands);
    setGeneratorCurrentIsland(0);
    setGeneratorStep(2);
  };

  // Handle click on generator map to place island
  const handleGeneratorMapClick = (e: React.MouseEvent) => {
    if (!generatorPlacingMode || !generatorMapRef.current) return;
    
    const rect = generatorMapRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / generatorMapScale;
    const y = (e.clientY - rect.top) / generatorMapScale;
    
    // Update current island position
    setGeneratorIslands(prev => prev.map((island, idx) => 
      idx === generatorCurrentIsland 
        ? { ...island, position: { x: Math.round(x), y: Math.round(y) }, isPlaced: true }
        : island
    ));
    
    // Move to next island
    if (generatorCurrentIsland < generatorIslands.length - 1) {
      setGeneratorCurrentIsland(prev => prev + 1);
    } else {
      setGeneratorPlacingMode(false);
      toast.success("All islands placed!");
    }
  };

  // Generate milestones from islands
  const generateFromIslands = async () => {
    if (!confirm("This will delete all existing milestones and generate new ones. Continue?")) return;
    
    setLoading(true);
    try {
      // First delete all existing milestones
      await fetch(`/api/journey-milestones?all=true&mapId=traders_journey`, {
        method: "DELETE",
      });

      // Create zones
      const zonesData = generatorZones.map((z, idx) => ({
        id: z.id,
        name: z.name,
        description: `Zone ${idx + 1}`,
        order: z.order,
        position: { x: 0, y: 0 },
        color: z.color,
        icon: "flag",
        isUnlockable: idx > 0,
        unlockCondition: idx > 0 ? { type: "milestone_complete", value: `island_${idx}_1` } : undefined,
      }));

      // Update map config with zones
      await fetch("/api/journey-map", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mapId: "traders_journey",
          name: "Trader's Journey",
          description: "Navigate through the islands to become a master trader",
          zones: zonesData,
          defaultStartNode: "island_1_1",
          backgroundColor: "#1a3a5c",
          backgroundImage: "/assets/treasure-map.png",
          isActive: true,
        }),
      });

      // Generate milestones for each island
      let milestoneOrder = 1;
      const allMilestones: any[] = [];

      for (const island of generatorIslands) {
        if (!island.isPlaced) continue;

        for (let m = 0; m < island.milestonesCount; m++) {
          const milestoneId = `island_${island.id}_${m + 1}`;
          const isFirst = island.id === 1 && m === 0;
          const isLast = island.id === generatorIslands.length && m === island.milestonesCount - 1;
          
          // Calculate position offset for multiple milestones on same island
          const offsetX = island.milestonesCount > 1 ? (m - (island.milestonesCount - 1) / 2) * 30 : 0;
          const offsetY = island.milestonesCount > 1 ? Math.sin(m) * 20 : 0;

          // Determine next milestone connection
          const connectedTo: string[] = [];
          if (m < island.milestonesCount - 1) {
            connectedTo.push(`island_${island.id}_${m + 2}`);
          } else if (island.id < generatorIslands.length) {
            connectedTo.push(`island_${island.id + 1}_1`);
          }

          // Determine previous milestone connection
          const connectedFrom: string[] = [];
          if (m > 0) {
            connectedFrom.push(`island_${island.id}_${m}`);
          } else if (island.id > 1) {
            const prevIsland = generatorIslands[island.id - 2];
            connectedFrom.push(`island_${island.id - 1}_${prevIsland.milestonesCount}`);
          }

          const milestone = {
            id: milestoneId,
            mapId: "traders_journey",
            name: island.milestonesCount > 1 ? `${island.name} - Step ${m + 1}` : island.name,
            description: `Complete this milestone on ${island.name}`,
            shortDescription: `Milestone ${milestoneOrder}`,
            zoneId: island.zoneId,
            position: { 
              x: Math.round(island.position.x + offsetX), 
              y: Math.round(island.position.y + offsetY) 
            },
            nodeType: isFirst ? "start" : isLast ? "legendary" : "milestone",
            icon: isFirst ? "flag" : isLast ? "crown" : "target",
            color: generatorZones.find(z => z.id === island.zoneId)?.color || "#3B82F6",
            size: isFirst || isLast ? "large" : "medium",
            completeCondition: { type: "total_trades", value: milestoneOrder * 5, comparison: "gte" },
            rewards: { xp: milestoneOrder * 10 },
            connectedTo,
            connectedFrom,
            isRequired: true,
            isAutoComplete: isFirst,
            order: milestoneOrder,
            isActive: true,
          };

          allMilestones.push(milestone);
          milestoneOrder++;
        }
      }

      // Create all milestones
      for (const milestone of allMilestones) {
        await fetch("/api/journey-milestones", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(milestone),
        });
      }

      toast.success(`Generated ${allMilestones.length} milestones across ${generatorIslands.filter(i => i.isPlaced).length} islands`);
      setGeneratorOpen(false);
      setGeneratorStep(1);
      fetchData();
    } catch (error) {
      console.error("Generation error:", error);
      toast.error("Failed to generate map");
    } finally {
      setLoading(false);
    }
  };

  // Add a zone to generator
  const addGeneratorZone = () => {
    const newId = `zone_${generatorZones.length + 1}`;
    setGeneratorZones([...generatorZones, {
      id: newId,
      name: `Zone ${generatorZones.length + 1}`,
      color: ["#22C55E", "#3B82F6", "#8B5CF6", "#F59E0B", "#EF4444"][generatorZones.length % 5],
      order: generatorZones.length + 1,
    }]);
  };

  // Remove a zone from generator
  const removeGeneratorZone = (id: string) => {
    setGeneratorZones(prev => prev.filter(z => z.id !== id));
  };

  // ============================================
  // END GENERATOR FUNCTIONS
  // ============================================

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
    if (!confirm("This will reset all milestone positions to default. Continue?")) return;
    
    setLoading(true);
    try {
      const res = await fetch("/api/journey-map/seed");
      const data = await res.json();

      if (data.success) {
        toast.success(`Map seeded: ${data.milestonesCreated} milestones created`);
        setHasUnsavedChanges(false);
        fetchData();
      } else {
        console.error("Seed error:", data);
        toast.error(data.error || "Failed to seed map");
      }
    } catch (error) {
      console.error("Seed fetch error:", error);
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

  // Handle mouse down on milestone
  const handleMilestoneMouseDown = (e: React.MouseEvent, milestone: Milestone) => {
    if (editMode === "drag") {
      e.preventDefault();
      e.stopPropagation();
      setDraggedMilestone(milestone.id);
    } else if (editMode === "select") {
      setSelectedMilestone(milestone);
      setEditMilestoneOpen(true);
    }
  };

  // Handle mouse move for dragging
  const handleMapMouseMove = (e: React.MouseEvent) => {
    if (draggedMilestone && mapContainerRef.current) {
      const rect = mapContainerRef.current.getBoundingClientRect();
      const x = (e.clientX - rect.left - mapOffset.x) / mapScale;
      const y = (e.clientY - rect.top - mapOffset.y) / mapScale;
      
      // Clamp to map bounds
      const clampedX = Math.max(20, Math.min(MAP_WIDTH - 20, x));
      const clampedY = Math.max(20, Math.min(MAP_HEIGHT - 20, y));
      
      updateMilestonePosition(draggedMilestone, clampedX, clampedY);
    } else if (isPanning) {
      const dx = e.clientX - panStart.x;
      const dy = e.clientY - panStart.y;
      setMapOffset(prev => ({
        x: prev.x + dx,
        y: prev.y + dy,
      }));
      setPanStart({ x: e.clientX, y: e.clientY });
    }
  };

  // Handle mouse up
  const handleMapMouseUp = () => {
    setDraggedMilestone(null);
    setIsPanning(false);
  };

  // Handle pan start
  const handlePanStart = (e: React.MouseEvent) => {
    if (editMode === "drag" && !draggedMilestone) {
      setIsPanning(true);
      setPanStart({ x: e.clientX, y: e.clientY });
    }
  };

  // Get node size
  const getNodeSize = (size: string) => {
    switch (size) {
      case "small": return 20;
      case "large": return 36;
      default: return 28;
    }
  };

  // Render visual map with treasure map background
  const renderVisualMap = () => (
    <div className="space-y-4">
      {/* Map Toolbar */}
      <div className="flex items-center justify-between bg-slate-800 p-3 rounded-lg">
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant={editMode === "select" ? "default" : "outline"}
            onClick={() => setEditMode("select")}
          >
            <MousePointer className="h-4 w-4 mr-1" />
            Select
          </Button>
          <Button
            size="sm"
            variant={editMode === "drag" ? "default" : "outline"}
            onClick={() => setEditMode("drag")}
          >
            <Hand className="h-4 w-4 mr-1" />
            Drag
          </Button>
          <div className="w-px h-6 bg-slate-600 mx-2" />
          <Button
            size="sm"
            variant="outline"
            onClick={() => setMapScale(s => Math.min(s + 0.1, 1.5))}
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
          <span className="text-sm text-slate-400 w-16 text-center">
            {Math.round(mapScale * 100)}%
          </span>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setMapScale(s => Math.max(s - 0.1, 0.3))}
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => { setMapScale(0.7); setMapOffset({ x: 0, y: 0 }); }}
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex items-center gap-2">
          {hasUnsavedChanges && (
            <Badge variant="destructive">Unsaved changes</Badge>
          )}
          <Button
            size="sm"
            onClick={saveAllPositions}
            disabled={!hasUnsavedChanges}
            className="bg-green-600 hover:bg-green-700"
          >
            <Save className="h-4 w-4 mr-1" />
            Save Positions
          </Button>
        </div>
      </div>

      {/* Instructions */}
      <div className="text-sm text-slate-400">
        {editMode === "select" ? (
          <span>Click on a milestone to edit its details</span>
        ) : (
          <span>Drag milestones to reposition them on the map. Drag empty space to pan.</span>
        )}
      </div>

      {/* Map Container */}
      <div
        ref={mapContainerRef}
        className="relative w-full h-[650px] bg-slate-900 rounded-lg overflow-hidden border-4 border-amber-900/50 cursor-move"
        onMouseMove={handleMapMouseMove}
        onMouseUp={handleMapMouseUp}
        onMouseLeave={handleMapMouseUp}
        onMouseDown={handlePanStart}
      >
        {/* Map wrapper with transform */}
        <div
          className="absolute"
          style={{
            width: MAP_WIDTH,
            height: MAP_HEIGHT,
            transform: `translate(${mapOffset.x}px, ${mapOffset.y}px) scale(${mapScale})`,
            transformOrigin: "top left",
          }}
        >
          {/* Treasure Map Background */}
          <Image
            src="/assets/treasure-map.png"
            alt="Treasure Map"
            width={MAP_WIDTH}
            height={MAP_HEIGHT}
            className="absolute top-0 left-0"
            style={{ width: MAP_WIDTH, height: MAP_HEIGHT }}
            priority
            draggable={false}
          />

          {/* Path Connections */}
          <svg
            className="absolute top-0 left-0 pointer-events-none"
            width={MAP_WIDTH}
            height={MAP_HEIGHT}
          >
            <defs>
              <filter id="pathGlow">
                <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
                <feMerge>
                  <feMergeNode in="coloredBlur"/>
                  <feMergeNode in="SourceGraphic"/>
                </feMerge>
              </filter>
            </defs>
            {milestones.map(milestone =>
              milestone.connectedTo.map(targetId => {
                const target = milestones.find(m => m.id === targetId);
                if (!target) return null;
                return (
                  <path
                    key={`${milestone.id}-${targetId}`}
                    d={`M ${milestone.position.x} ${milestone.position.y} Q ${(milestone.position.x + target.position.x) / 2} ${Math.min(milestone.position.y, target.position.y) - 30} ${target.position.x} ${target.position.y}`}
                    fill="none"
                    stroke="#FFFFFF"
                    strokeWidth={3}
                    strokeDasharray="8,8"
                    strokeLinecap="round"
                    opacity={0.5}
                  />
                );
              })
            )}
          </svg>

          {/* Milestone Nodes */}
          {milestones.map(milestone => {
            const size = getNodeSize(milestone.size);
            const isDragging = draggedMilestone === milestone.id;
            
            return (
              <div
                key={milestone.id}
                className={`absolute cursor-pointer transition-transform ${isDragging ? "scale-125 z-50" : "hover:scale-110"}`}
                style={{
                  left: milestone.position.x - size / 2,
                  top: milestone.position.y - size / 2,
                  width: size,
                  height: size,
                }}
                onMouseDown={(e) => handleMilestoneMouseDown(e, milestone)}
              >
                {/* Node circle */}
                <div
                  className="w-full h-full rounded-full flex items-center justify-center text-white font-bold shadow-lg border-2"
                  style={{
                    background: `linear-gradient(135deg, ${milestone.color}, ${milestone.color}88)`,
                    borderColor: isDragging ? "#FFFFFF" : `${milestone.color}`,
                    boxShadow: isDragging 
                      ? `0 0 20px ${milestone.color}, 0 0 40px ${milestone.color}80`
                      : `0 4px 12px rgba(0,0,0,0.4)`,
                  }}
                >
                  <span style={{ fontSize: size * 0.4 }}>
                    {milestone.order}
                  </span>
                </div>

                {/* Label */}
                <div 
                  className="absolute left-1/2 -translate-x-1/2 mt-1 text-center whitespace-nowrap pointer-events-none"
                  style={{ top: size }}
                >
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-slate-900/80 text-white">
                    {milestone.name.length > 12 ? milestone.name.slice(0, 10) + "..." : milestone.name}
                  </span>
                </div>

                {/* Position indicator when dragging */}
                {isDragging && (
                  <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-[10px] bg-black/80 text-white px-2 py-0.5 rounded whitespace-nowrap">
                    x: {Math.round(milestone.position.x)}, y: {Math.round(milestone.position.y)}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Scale indicator */}
        <div className="absolute bottom-4 right-4 bg-slate-900/80 text-white px-3 py-1 rounded text-sm">
          {Math.round(mapScale * 100)}%
        </div>
      </div>
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
            Configure the trader's journey progression map - drag milestones to position them
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setGeneratorOpen(true)} className="bg-purple-600 hover:bg-purple-700">
            <Wand2 className="h-4 w-4 mr-2" />
            Generate Map
          </Button>
          <Button variant="outline" onClick={seedDefaultMap} className="border-amber-600 text-amber-600 hover:bg-amber-600/10">
            <Download className="h-4 w-4 mr-2" />
            Reset to Default
          </Button>
          <Button variant="outline" onClick={deleteEverything} className="border-red-600 text-red-600 hover:bg-red-600/10">
            <AlertTriangle className="h-4 w-4 mr-2" />
            Delete All
          </Button>
          <Button variant="outline" onClick={fetchData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={saveMapConfig} disabled={!mapConfig}>
            <Save className="h-4 w-4 mr-2" />
            Save Config
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
            <Button
              variant="outline"
              onClick={deleteAllMilestones}
              className="border-red-600 text-red-600 hover:bg-red-600/10"
              disabled={milestones.length === 0}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete All
            </Button>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order</TableHead>
                <TableHead>Icon</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Position</TableHead>
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
                    <span className="text-xs font-mono">
                      ({milestone.position.x}, {milestone.position.y})
                    </span>
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
          <div className="flex justify-end mb-4">
            <Button
              variant="outline"
              onClick={deleteAllZones}
              className="border-red-600 text-red-600 hover:bg-red-600/10"
              disabled={!mapConfig?.zones.length}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete All Zones
            </Button>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order</TableHead>
                <TableHead>ID</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Color</TableHead>
                <TableHead>Milestones</TableHead>
                <TableHead>Unlock Condition</TableHead>
                <TableHead>Actions</TableHead>
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
                  <TableCell>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => deleteZone(zone.id)}
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {(!mapConfig?.zones || mapConfig.zones.length === 0) && (
            <div className="text-center py-8 text-muted-foreground">
              No zones found. Use "Reset to Default" to create zones.
            </div>
          )}
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

      {/* Generator Dialog */}
      <Dialog open={generatorOpen} onOpenChange={setGeneratorOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wand2 className="h-5 w-5" />
              Journey Map Generator
            </DialogTitle>
            <DialogDescription>
              Create a custom journey map by defining zones, placing islands, and setting milestones
            </DialogDescription>
          </DialogHeader>

          {/* Step Indicator */}
          <div className="flex items-center justify-center gap-2 my-4">
            {[1, 2, 3].map(step => (
              <div key={step} className="flex items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                  generatorStep >= step ? "bg-blue-500 text-white" : "bg-slate-700 text-slate-400"
                }`}>
                  {step}
                </div>
                {step < 3 && <div className={`w-12 h-1 ${generatorStep > step ? "bg-blue-500" : "bg-slate-700"}`} />}
              </div>
            ))}
          </div>
          <div className="flex justify-center gap-8 text-sm text-muted-foreground mb-4">
            <span className={generatorStep >= 1 ? "text-blue-400" : ""}>Configure</span>
            <span className={generatorStep >= 2 ? "text-blue-400" : ""}>Place Islands</span>
            <span className={generatorStep >= 3 ? "text-blue-400" : ""}>Review & Generate</span>
          </div>

          {/* Step 1: Configure */}
          {generatorStep === 1 && (
            <div className="space-y-6">
              {/* Island Count */}
              <div className="space-y-2">
                <Label className="text-lg font-semibold flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Number of Islands
                </Label>
                <div className="flex items-center gap-4">
                  <Input
                    type="number"
                    min={2}
                    max={30}
                    value={generatorIslandCount}
                    onChange={e => setGeneratorIslandCount(Math.max(2, Math.min(30, parseInt(e.target.value) || 2)))}
                    className="w-24"
                  />
                  <span className="text-sm text-muted-foreground">
                    Each island can have 1 or more milestones
                  </span>
                </div>
              </div>

              {/* Zones */}
              <div className="space-y-2">
                <Label className="text-lg font-semibold flex items-center gap-2">
                  <Palette className="h-4 w-4" />
                  Zones ({generatorZones.length})
                </Label>
                <div className="space-y-2">
                  {generatorZones.map((zone, idx) => (
                    <div key={zone.id} className="flex items-center gap-2 p-2 border rounded-lg">
                      <span className="w-8 text-center text-sm text-muted-foreground">{idx + 1}</span>
                      <Input
                        value={zone.name}
                        onChange={e => setGeneratorZones(prev => prev.map(z => 
                          z.id === zone.id ? { ...z, name: e.target.value } : z
                        ))}
                        className="flex-1"
                        placeholder="Zone name"
                      />
                      <Input
                        type="color"
                        value={zone.color}
                        onChange={e => setGeneratorZones(prev => prev.map(z => 
                          z.id === zone.id ? { ...z, color: e.target.value } : z
                        ))}
                        className="w-16"
                      />
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => removeGeneratorZone(zone.id)}
                        disabled={generatorZones.length <= 1}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  ))}
                  <Button variant="outline" onClick={addGeneratorZone} className="w-full">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Zone
                  </Button>
                </div>
              </div>

              <Button onClick={initializeGenerator} className="w-full">
                Next: Place Islands
                <MapPin className="h-4 w-4 ml-2" />
              </Button>
            </div>
          )}

          {/* Step 2: Place Islands */}
          {generatorStep === 2 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold">Click on the map to place islands</h3>
                  <p className="text-sm text-muted-foreground">
                    {generatorPlacingMode 
                      ? `Placing Island ${generatorCurrentIsland + 1} of ${generatorIslands.length}`
                      : "Click 'Start Placing' to begin"}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant={generatorPlacingMode ? "destructive" : "default"}
                    onClick={() => setGeneratorPlacingMode(!generatorPlacingMode)}
                  >
                    {generatorPlacingMode ? "Stop Placing" : "Start Placing"}
                  </Button>
                </div>
              </div>

              {/* Map for placing */}
              <div
                ref={generatorMapRef}
                className="relative w-full h-[400px] border-4 border-amber-900/50 rounded-lg overflow-hidden cursor-crosshair"
                onClick={handleGeneratorMapClick}
              >
                <div
                  style={{
                    width: 1200,
                    height: 800,
                    transform: `scale(${generatorMapScale})`,
                    transformOrigin: "top left",
                  }}
                >
                  <Image
                    src="/assets/treasure-map.png"
                    alt="Treasure Map"
                    width={1200}
                    height={800}
                    className="absolute top-0 left-0"
                    draggable={false}
                  />
                  {/* Placed islands */}
                  {generatorIslands.filter(i => i.isPlaced).map(island => (
                    <div
                      key={island.id}
                      className="absolute w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold shadow-lg"
                      style={{
                        left: island.position.x - 16,
                        top: island.position.y - 16,
                        backgroundColor: generatorZones.find(z => z.id === island.zoneId)?.color || "#3B82F6",
                        border: island.id === generatorCurrentIsland + 1 ? "3px solid white" : "2px solid rgba(255,255,255,0.5)",
                      }}
                    >
                      {island.id}
                    </div>
                  ))}
                  {/* Current placing indicator */}
                  {generatorPlacingMode && (
                    <div className="absolute top-4 left-4 bg-black/80 text-white px-3 py-1 rounded text-sm">
                      Click to place Island {generatorCurrentIsland + 1}
                    </div>
                  )}
                </div>
              </div>

              {/* Island list */}
              <div className="max-h-48 overflow-y-auto border rounded-lg p-2">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                  {generatorIslands.map((island, idx) => (
                    <div 
                      key={island.id}
                      className={`p-2 rounded border text-sm ${
                        island.isPlaced ? "bg-green-900/20 border-green-600" : "bg-slate-800 border-slate-600"
                      } ${idx === generatorCurrentIsland && generatorPlacingMode ? "ring-2 ring-blue-500" : ""}`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium">Island {island.id}</span>
                        {island.isPlaced && <span className="text-green-500 text-xs">✓</span>}
                      </div>
                      <Input
                        value={island.name}
                        onChange={e => setGeneratorIslands(prev => prev.map(i => 
                          i.id === island.id ? { ...i, name: e.target.value } : i
                        ))}
                        className="h-7 text-xs mb-1"
                        placeholder="Island name"
                      />
                      <div className="flex gap-1">
                        <Select
                          value={island.zoneId}
                          onValueChange={value => setGeneratorIslands(prev => prev.map(i => 
                            i.id === island.id ? { ...i, zoneId: value } : i
                          ))}
                        >
                          <SelectTrigger className="h-7 text-xs flex-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {generatorZones.map(z => (
                              <SelectItem key={z.id} value={z.id} className="text-xs">
                                {z.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Input
                          type="number"
                          min={1}
                          max={5}
                          value={island.milestonesCount}
                          onChange={e => setGeneratorIslands(prev => prev.map(i => 
                            i.id === island.id ? { ...i, milestonesCount: Math.max(1, Math.min(5, parseInt(e.target.value) || 1)) } : i
                          ))}
                          className="w-12 h-7 text-xs"
                          title="Milestones on this island"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setGeneratorStep(1)}>
                  Back
                </Button>
                <Button 
                  onClick={() => setGeneratorStep(3)}
                  disabled={generatorIslands.filter(i => i.isPlaced).length < 2}
                  className="flex-1"
                >
                  Next: Review & Generate
                </Button>
              </div>
            </div>
          )}

          {/* Step 3: Review & Generate */}
          {generatorStep === 3 && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Islands Placed</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {generatorIslands.filter(i => i.isPlaced).length} / {generatorIslands.length}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Total Milestones</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {generatorIslands.filter(i => i.isPlaced).reduce((sum, i) => sum + i.milestonesCount, 0)}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Zones</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{generatorZones.length}</div>
                  </CardContent>
                </Card>
              </div>

              <div className="border rounded-lg p-4">
                <h3 className="font-semibold mb-2">Journey Path</h3>
                <div className="flex flex-wrap gap-2">
                  {generatorIslands.filter(i => i.isPlaced).map((island, idx, arr) => (
                    <div key={island.id} className="flex items-center">
                      <div 
                        className="px-3 py-1 rounded-full text-sm text-white"
                        style={{ backgroundColor: generatorZones.find(z => z.id === island.zoneId)?.color }}
                      >
                        {island.name} ({island.milestonesCount})
                      </div>
                      {idx < arr.length - 1 && <span className="mx-1 text-muted-foreground">→</span>}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setGeneratorStep(2)}>
                  Back
                </Button>
                <Button 
                  onClick={generateFromIslands}
                  className="flex-1 bg-green-600 hover:bg-green-700"
                  disabled={loading}
                >
                  {loading ? (
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Wand2 className="h-4 w-4 mr-2" />
                  )}
                  Generate Journey Map
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
