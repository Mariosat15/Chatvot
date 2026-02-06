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

// Condition types - organized by category
const CONDITION_TYPES = [
  // Account & Setup
  { value: "account_created", label: "Account Created", category: "setup" },
  { value: "first_deposit", label: "First Deposit", category: "setup" },
  { value: "kyc_verified", label: "KYC Verified", category: "setup" },
  { value: "profile_complete", label: "Profile Complete", category: "setup" },
  
  // Trading Activity
  { value: "total_trades", label: "Total Trades", category: "trading" },
  { value: "total_deposits", label: "Total Deposits ($)", category: "trading" },
  { value: "winning_trades", label: "Winning Trades", category: "trading" },
  { value: "losing_trades", label: "Losing Trades (Learn from losses)", category: "trading" },
  { value: "trades_today", label: "Trades Today", category: "trading" },
  { value: "trades_this_week", label: "Trades This Week", category: "trading" },
  { value: "trades_this_month", label: "Trades This Month", category: "trading" },
  { value: "consecutive_trading_days", label: "Consecutive Trading Days", category: "trading" },
  { value: "different_assets_traded", label: "Different Assets Traded", category: "trading" },
  
  // Performance
  { value: "win_rate", label: "Win Rate %", category: "performance" },
  { value: "win_streak", label: "Current Win Streak", category: "performance" },
  { value: "max_win_streak", label: "Best Win Streak Ever", category: "performance" },
  { value: "total_pnl_positive", label: "Positive Total P&L", category: "performance" },
  { value: "total_pnl", label: "Total P&L Amount ($)", category: "performance" },
  { value: "profit_factor", label: "Profit Factor", category: "performance" },
  { value: "best_trade_pnl", label: "Best Single Trade P&L ($)", category: "performance" },
  { value: "average_trade_pnl", label: "Average Trade P&L ($)", category: "performance" },
  { value: "risk_reward_ratio", label: "Risk/Reward Ratio", category: "performance" },
  
  // Competitions
  { value: "competitions_entered", label: "Competitions Entered", category: "competitions" },
  { value: "competitions_completed", label: "Competitions Completed", category: "competitions" },
  { value: "first_place_finishes", label: "1st Place Finishes", category: "competitions" },
  { value: "second_place_finishes", label: "2nd Place Finishes", category: "competitions" },
  { value: "third_place_finishes", label: "3rd Place Finishes", category: "competitions" },
  { value: "podium_finishes", label: "Podium Finishes (Top 3)", category: "competitions" },
  { value: "top_10_finishes", label: "Top 10 Finishes", category: "competitions" },
  { value: "top_50_percent_finishes", label: "Top 50% Finishes", category: "competitions" },
  { value: "competition_pnl", label: "Competition P&L Total ($)", category: "competitions" },
  
  // Progression & XP
  { value: "level_reached", label: "Level Reached", category: "progression" },
  { value: "xp_threshold", label: "XP Threshold", category: "progression" },
  { value: "xp_earned_today", label: "XP Earned Today", category: "progression" },
  { value: "xp_earned_this_week", label: "XP Earned This Week", category: "progression" },
  { value: "total_badges", label: "Total Badges Earned", category: "progression" },
  { value: "badge_earned", label: "Specific Badge Earned", category: "progression" },
  { value: "milestone_complete", label: "Specific Milestone Complete", category: "progression" },
  
  // Social & Community
  { value: "referrals_made", label: "Referrals Made", category: "social" },
  { value: "referrals_active", label: "Active Referrals", category: "social" },
  { value: "friends_added", label: "Friends Added", category: "social" },
  { value: "messages_sent", label: "Messages Sent", category: "social" },
  
  // Risk Management
  { value: "stop_loss_used", label: "Stop Losses Used", category: "risk" },
  { value: "take_profit_used", label: "Take Profits Used", category: "risk" },
  { value: "max_drawdown_under", label: "Max Drawdown Under %", category: "risk" },
  { value: "position_size_under", label: "Position Size Under %", category: "risk" },
  
  // Time-based
  { value: "account_age_days", label: "Account Age (Days)", category: "time" },
  { value: "active_days", label: "Active Trading Days", category: "time" },
  { value: "login_streak", label: "Login Streak (Days)", category: "time" },
];

// Milestone templates for varied generation
const MILESTONE_TEMPLATES = [
  // Early game - Getting started
  { name: "First Steps", desc: "Begin your trading journey", condition: { type: "account_created" }, xp: 10, tier: 1 },
  { name: "Fund Your Account", desc: "Make your first deposit", condition: { type: "first_deposit" }, xp: 25, tier: 1 },
  { name: "Identity Verified", desc: "Complete KYC verification", condition: { type: "kyc_verified" }, xp: 30, tier: 1 },
  { name: "First Blood", desc: "Execute your first trade", condition: { type: "total_trades", value: 1 }, xp: 20, tier: 1 },
  
  // Early-mid - Learning the ropes
  { name: "Getting Warmed Up", desc: "Complete 10 trades", condition: { type: "total_trades", value: 10 }, xp: 40, tier: 2 },
  { name: "Taste of Victory", desc: "Win your first trade", condition: { type: "winning_trades", value: 1 }, xp: 35, tier: 2 },
  { name: "Learning Curve", desc: "Experience your first loss (it happens!)", condition: { type: "losing_trades", value: 1 }, xp: 25, tier: 2 },
  { name: "Consistent Trader", desc: "Trade for 5 consecutive days", condition: { type: "consecutive_trading_days", value: 5 }, xp: 50, tier: 2 },
  { name: "Diversified", desc: "Trade 3 different assets", condition: { type: "different_assets_traded", value: 3 }, xp: 45, tier: 2 },
  
  // Mid game - Building skills
  { name: "Centurion", desc: "Complete 100 trades", condition: { type: "total_trades", value: 100 }, xp: 100, tier: 3 },
  { name: "Winning Ways", desc: "Achieve 50% win rate", condition: { type: "win_rate", value: 50 }, xp: 75, tier: 3 },
  { name: "Hot Streak", desc: "Win 3 trades in a row", condition: { type: "win_streak", value: 3 }, xp: 60, tier: 3 },
  { name: "In the Green", desc: "Achieve positive P&L", condition: { type: "total_pnl_positive" }, xp: 80, tier: 3 },
  { name: "Arena Ready", desc: "Enter your first competition", condition: { type: "competitions_entered", value: 1 }, xp: 70, tier: 3 },
  
  // Mid-late - Proving yourself
  { name: "Battle Tested", desc: "Complete 5 competitions", condition: { type: "competitions_completed", value: 5 }, xp: 120, tier: 4 },
  { name: "Top Half", desc: "Finish in top 50% of a competition", condition: { type: "top_50_percent_finishes", value: 1 }, xp: 100, tier: 4 },
  { name: "Sharpshooter", desc: "Achieve 60% win rate", condition: { type: "win_rate", value: 60 }, xp: 150, tier: 4 },
  { name: "Endurance", desc: "Trade for 30 days", condition: { type: "active_days", value: 30 }, xp: 130, tier: 4 },
  { name: "Risk Manager", desc: "Use stop loss on 50 trades", condition: { type: "stop_loss_used", value: 50 }, xp: 110, tier: 4 },
  
  // Late game - Excellence
  { name: "Gladiator", desc: "Finish in top 10", condition: { type: "top_10_finishes", value: 1 }, xp: 200, tier: 5 },
  { name: "Bronze Medal", desc: "Earn a 3rd place finish", condition: { type: "third_place_finishes", value: 1 }, xp: 250, tier: 5 },
  { name: "Silver Medal", desc: "Earn a 2nd place finish", condition: { type: "second_place_finishes", value: 1 }, xp: 300, tier: 5 },
  { name: "Veteran", desc: "Complete 500 trades", condition: { type: "total_trades", value: 500 }, xp: 280, tier: 5 },
  { name: "Profit Machine", desc: "Earn $1000 in total P&L", condition: { type: "total_pnl", value: 1000 }, xp: 320, tier: 5 },
  
  // End game - Mastery
  { name: "Champion", desc: "Win a competition", condition: { type: "first_place_finishes", value: 1 }, xp: 500, tier: 6 },
  { name: "Legend", desc: "Win 3 competitions", condition: { type: "first_place_finishes", value: 3 }, xp: 750, tier: 6 },
  { name: "Unbreakable", desc: "Win 10 trades in a row", condition: { type: "win_streak", value: 10 }, xp: 600, tier: 6 },
  { name: "Trading Veteran", desc: "Complete 1000 trades", condition: { type: "total_trades", value: 1000 }, xp: 800, tier: 6 },
  { name: "Master Strategist", desc: "Achieve 70% win rate", condition: { type: "win_rate", value: 70 }, xp: 700, tier: 6 },
  
  // Ultimate achievements
  { name: "Hall of Fame", desc: "Win 10 competitions", condition: { type: "first_place_finishes", value: 10 }, xp: 1500, tier: 7 },
  { name: "Perfect Record", desc: "Win 20 trades in a row", condition: { type: "max_win_streak", value: 20 }, xp: 1200, tier: 7 },
  { name: "Trading Elite", desc: "Achieve 80% win rate", condition: { type: "win_rate", value: 80 }, xp: 1000, tier: 7 },
  { name: "Trading God", desc: "Reach Level 20", condition: { type: "level_reached", value: 20 }, xp: 2000, tier: 7 },
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

  // AI Generator state
  const [aiModeEnabled, setAiModeEnabled] = useState(false);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiTheme, setAiTheme] = useState<"pirate" | "space" | "medieval" | "modern">("pirate");
  const [aiGeneratedMilestones, setAiGeneratedMilestones] = useState<Milestone[]>([]);
  const [aiValidation, setAiValidation] = useState<{ isValid: boolean; errors: any[]; warnings: any[] } | null>(null);

  // Multi-map sequence management
  const [mapSequence, setMapSequence] = useState<Array<{
    mapId: string;
    name: string;
    theme: string;
    sequenceOrder: number;
    difficulty: number;
    xpBudget: number;
    estimatedXP: number;
    milestoneCount: number;
    isComplete: boolean;
  }>>([]);
  const [selectedSequenceMap, setSelectedSequenceMap] = useState<number>(1);
  const [sequenceLoading, setSequenceLoading] = useState(false);
  const [sequenceGenerating, setSequenceGenerating] = useState(false);
  const [showSequenceDialog, setShowSequenceDialog] = useState(false);
  const [sequenceValidation, setSequenceValidation] = useState<any>(null);

  // AI Journey Generation function
  const generateAIJourney = async () => {
    setAiGenerating(true);
    try {
      const response = await fetch("/api/ai/generate-journey", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "generate_full_journey",
          theme: aiTheme,
          count: generatorIslandCount,
          startOrder: 1,
          mapId: "traders_journey",
        }),
      });

      const data = await response.json();

      if (data.success) {
        setAiGeneratedMilestones(data.milestones);
        setAiValidation(data.validation);
        toast.success(`AI generated ${data.milestones.length} milestones!`);
        setGeneratorStep(3); // Jump to review step
      } else {
        toast.error(data.error || "AI generation failed");
      }
    } catch (error) {
      console.error("AI generation error:", error);
      toast.error("Failed to generate journey with AI");
    } finally {
      setAiGenerating(false);
    }
  };

  // Generate full 10-map sequence with AI (one map at a time to avoid timeout)
  const generateFullSequence = async () => {
    setSequenceGenerating(true);
    setShowSequenceDialog(false);
    
    const mapNames = [
      "Pirate Cove", "Space Station", "Medieval Castle", "Cyber City", "Ancient Temple",
      "Volcanic Island", "Arctic Fortress", "Dragon Realm", "Celestial Kingdom", "Hall of Legends"
    ];
    
    let totalMilestones = 0;
    let successfulMaps = 0;
    
    try {
      for (let mapIndex = 1; mapIndex <= 10; mapIndex++) {
        toast.info(`Generating Map ${mapIndex}/10: ${mapNames[mapIndex - 1]}...`);
        
        try {
          const response = await fetch("/api/ai/generate-journey", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "generate_single_map",
              mapIndex: mapIndex,
            }),
          });

          const data = await response.json();

          if (data.success) {
            totalMilestones += data.milestones?.length || 0;
            successfulMaps++;
            toast.success(`Map ${mapIndex} complete: ${data.milestones?.length || 0} milestones`);
          } else {
            toast.warning(`Map ${mapIndex} failed: ${data.error || "Unknown error"}`);
          }
        } catch (mapError) {
          console.error(`Error generating map ${mapIndex}:`, mapError);
          toast.warning(`Map ${mapIndex} failed, continuing...`);
        }
        
        // Small delay between maps to avoid rate limiting
        if (mapIndex < 10) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      
      if (successfulMaps > 0) {
        toast.success(`Generated ${totalMilestones} milestones across ${successfulMaps} maps!`);
        // Refresh the milestones list
        await fetchMilestones();
        // Connect maps in sequence
        await connectMapsInSequence();
      } else {
        toast.error("Failed to generate any maps");
      }
    } catch (error) {
      console.error("Sequence generation error:", error);
      toast.error("Failed to generate full sequence");
    } finally {
      setSequenceGenerating(false);
    }
  };

  // Validate full 10-map sequence
  const validateFullSequence = async () => {
    setSequenceLoading(true);
    
    try {
      const response = await fetch("/api/ai/generate-journey", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "validate_sequence",
        }),
      });

      const data = await response.json();

      if (data.success) {
        setSequenceValidation(data.validation);
        if (data.validation.isValid) {
          toast.success("All maps validated successfully!");
        } else {
          toast.warning(`Found ${data.validation.errors?.length || 0} errors across maps`);
        }
      }
    } catch (error) {
      console.error("Sequence validation error:", error);
      toast.error("Failed to validate sequence");
    } finally {
      setSequenceLoading(false);
    }
  };

  // Connect maps in sequence (set previousMapId/nextMapId)
  const connectMapsInSequence = async () => {
    try {
      const response = await fetch("/api/ai/generate-journey", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "connect_maps",
        }),
      });

      const data = await response.json();

      if (data.success) {
        toast.success(`Connected ${data.mapsConnected} maps in sequence!`);
      } else {
        toast.error(data.error || "Failed to connect maps");
      }
    } catch (error) {
      console.error("Connect maps error:", error);
      toast.error("Failed to connect maps");
    }
  };

  // Validate journey with AI
  const validateJourney = async () => {
    try {
      const response = await fetch("/api/ai/generate-journey", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "validate",
          mapId: "traders_journey",
        }),
      });

      const data = await response.json();

      if (data.success) {
        setAiValidation(data.validation);
        if (data.validation.isValid) {
          toast.success("Journey validation passed!");
        } else {
          toast.warning(`Found ${data.validation.errors.length} errors, ${data.validation.warnings.length} warnings`);
        }
      }
    } catch (error) {
      console.error("Validation error:", error);
      toast.error("Failed to validate journey");
    }
  };

  // Apply AI-generated milestones
  const applyAIMilestones = async () => {
    if (!aiGeneratedMilestones.length) return;

    try {
      // First, delete existing milestones
      await fetch("/api/journey-milestones", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mapId: "traders_journey", deleteAll: true }),
      });

      // Create new milestones
      for (const milestone of aiGeneratedMilestones) {
        await fetch("/api/journey-milestones", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(milestone),
        });
      }

      toast.success(`Applied ${aiGeneratedMilestones.length} AI-generated milestones!`);
      setGeneratorOpen(false);
      setGeneratorStep(1);
      setAiGeneratedMilestones([]);
      fetchData();
    } catch (error) {
      console.error("Error applying AI milestones:", error);
      toast.error("Failed to apply AI milestones");
    }
  };

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

  // Predefined zone templates for automatic generation
  const ZONE_TEMPLATES = [
    { name: "Beginner's Cove", color: "#22C55E", icon: "flag", description: "Your journey begins here" },
    { name: "Training Grounds", color: "#3B82F6", icon: "sword", description: "Learn the basics of trading" },
    { name: "Proving Grounds", color: "#8B5CF6", icon: "target", description: "Test your skills" },
    { name: "Expert Territory", color: "#F59E0B", icon: "shield1", description: "Challenges for experienced traders" },
    { name: "Champion's Domain", color: "#EF4444", icon: "trophy", description: "Only the best reach here" },
    { name: "Legend's Realm", color: "#EC4899", icon: "crown", description: "The path to mastery" },
    { name: "God's Peak", color: "#FFD700", icon: "victory", description: "The ultimate destination" },
  ];

  // Calculate optimal number of zones based on islands
  const calculateOptimalZones = (islandCount: number): number => {
    if (islandCount <= 3) return 2;
    if (islandCount <= 6) return 3;
    if (islandCount <= 10) return 4;
    if (islandCount <= 15) return 5;
    if (islandCount <= 22) return 6;
    return 7;
  };

  // Auto-generate zones based on island count
  const autoGenerateZones = (islandCount: number) => {
    const zoneCount = calculateOptimalZones(islandCount);
    const zones = ZONE_TEMPLATES.slice(0, zoneCount).map((template, idx) => ({
      id: `zone_${idx + 1}`,
      name: template.name,
      color: template.color,
      order: idx + 1,
    }));
    return zones;
  };

  // Initialize generator with island count and auto-generated zones
  const initializeGenerator = () => {
    // Auto-generate zones based on island count
    const autoZones = autoGenerateZones(generatorIslandCount);
    setGeneratorZones(autoZones);
    
    // Calculate how many islands per zone
    const islandsPerZone = Math.ceil(generatorIslandCount / autoZones.length);
    
    // Create islands with automatic zone assignment
    const islands = Array.from({ length: generatorIslandCount }, (_, i) => {
      const zoneIndex = Math.min(Math.floor(i / islandsPerZone), autoZones.length - 1);
      const zone = autoZones[zoneIndex];
      
      // Generate thematic island names based on zone
      const islandNamesPerZone: Record<string, string[]> = {
        "Beginner's Cove": ["Welcome Isle", "First Steps", "Dawn Harbor", "Novice Bay", "Starter Shore"],
        "Training Grounds": ["Practice Point", "Drill Island", "Learning Lagoon", "Study Shores", "Tutorial Atoll"],
        "Proving Grounds": ["Challenge Cay", "Trial Isle", "Test Reef", "Skill Shoals", "Exam Island"],
        "Expert Territory": ["Veteran Valley", "Pro Point", "Master's Marina", "Elite Edge", "Advanced Atoll"],
        "Champion's Domain": ["Victory Cove", "Winner's Wharf", "Champion's Channel", "Glory Gulf", "Trophy Trench"],
        "Legend's Realm": ["Mythic Mesa", "Hero's Harbor", "Legend's Landing", "Fame Fjord", "Honor Haven"],
        "God's Peak": ["Divine Dock", "Immortal Isle", "God's Gateway", "Eternal End", "Final Frontier"],
      };
      
      const zoneNames = islandNamesPerZone[zone.name] || ["Island"];
      const posInZone = i - (zoneIndex * islandsPerZone);
      const islandName = zoneNames[posInZone % zoneNames.length] || `Island ${i + 1}`;
      
      // Auto-calculate milestones based on zone tier (more variety)
      // Zone 1: 1-2 milestones, Zone 2: 2-3, Zone 3: 2-3, Zone 4: 3-4, Zone 5+: 3-5
      const zoneBasedMilestones: Record<number, number[]> = {
        0: [1, 1, 2, 1, 2],           // Beginner's Cove: mostly 1, some 2
        1: [2, 2, 3, 2, 2],           // Training Grounds: mostly 2, some 3
        2: [2, 3, 3, 2, 3],           // Proving Grounds: mix of 2-3
        3: [3, 3, 4, 3, 3],           // Expert Territory: mostly 3, some 4
        4: [3, 4, 4, 5, 4],           // Champion's Domain: 3-5
        5: [4, 5, 5, 4, 5],           // Legend's Realm: mostly 4-5
        6: [5, 5, 6, 5, 6],           // God's Peak: 5-6
      };
      
      const milestoneOptions = zoneBasedMilestones[zoneIndex] || [3, 3, 4, 4, 5];
      const baseMilestones = milestoneOptions[posInZone % milestoneOptions.length];
      
      return {
        id: i + 1,
        name: islandName,
        position: { x: 0, y: 0 },
        milestonesCount: baseMilestones,
        zoneId: zone.id,
        isPlaced: false,
      };
    });
    
    setGeneratorIslands(islands);
    setGeneratorCurrentIsland(0);
    setGeneratorStep(2);
  };

  // Handle click on generator map to place island
  const handleGeneratorMapClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!generatorPlacingMode || !generatorMapRef.current) return;
    
    // Get the image element (the clickable area)
    const rect = generatorMapRef.current.getBoundingClientRect();
    
    // Calculate click position relative to the container
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;
    
    // Convert to map coordinates (1200x800 map space)
    // The container shows the scaled map, so we need to convert back to original coordinates
    const containerWidth = rect.width;
    const containerHeight = rect.height;
    
    // Map coordinates = (click position / container size) * map size
    const x = (clickX / containerWidth) * 1200;
    const y = (clickY / containerHeight) * 800;
    
    console.log("Click:", { clickX, clickY, containerWidth, containerHeight, mapX: x, mapY: y });
    
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

  // Level requirements for progression
  const LEVEL_REQUIREMENTS = [
    { level: 1, title: "Novice Trader", minXP: 0, icon: "starBadge" },
    { level: 2, title: "Apprentice", minXP: 50, icon: "guideBook" },
    { level: 3, title: "Trainee", minXP: 125, icon: "sword" },
    { level: 4, title: "Junior Trader", minXP: 250, icon: "trade" },
    { level: 5, title: "Rising Trader", minXP: 375, icon: "profit" },
    { level: 6, title: "Skilled Trader", minXP: 500, icon: "target" },
    { level: 7, title: "Competent Trader", minXP: 750, icon: "archer" },
    { level: 8, title: "Proficient Trader", minXP: 1100, icon: "shield1" },
    { level: 9, title: "Expert Trader", minXP: 1450, icon: "swordNumbered" },
    { level: 10, title: "Senior Trader", minXP: 1800, icon: "gems" },
    { level: 11, title: "Elite Trader", minXP: 2000, icon: "star1" },
    { level: 12, title: "Master Trader", minXP: 2500, icon: "crown" },
    { level: 13, title: "Grand Master", minXP: 3000, icon: "fireSpell" },
    { level: 14, title: "Trading Virtuoso", minXP: 3500, icon: "blueFireSpell" },
    { level: 15, title: "Trading Champion", minXP: 4000, icon: "trophy" },
    { level: 16, title: "Market Legend", minXP: 5000, icon: "starAward" },
    { level: 17, title: "Trading Titan", minXP: 6000, icon: "goldMedal" },
    { level: 18, title: "Market Overlord", minXP: 7500, icon: "lord" },
    { level: 19, title: "Trading Immortal", minXP: 10000, icon: "champion" },
    { level: 20, title: "Trading God", minXP: 15000, icon: "victory" },
  ];

  // Generate milestones from islands with progressive difficulty and game-like balance
  const generateFromIslands = async () => {
    if (!confirm("This will delete all existing milestones and generate new ones with progressive difficulty. Continue?")) return;
    
    setLoading(true);
    try {
      // First delete all existing milestones
      await fetch(`/api/journey-milestones?all=true&mapId=traders_journey`, {
        method: "DELETE",
      });

      // Create zones with level requirements
      const zonesData = generatorZones.map((z, idx) => {
        // Each zone requires a certain level to enter
        const zoneLevel = Math.min(20, Math.ceil((idx / generatorZones.length) * 20));
        const zoneLevelReq = LEVEL_REQUIREMENTS[Math.max(0, zoneLevel - 1)];
        
        return {
          id: z.id,
          name: z.name,
          description: idx === 0 
            ? "Your journey begins here. Complete milestones to progress!"
            : `Requires ${zoneLevelReq.title} (Level ${zoneLevelReq.level}) to enter this zone`,
          order: z.order,
          position: { x: 0, y: 0 },
          color: z.color,
          icon: idx === 0 ? "flag" : zoneLevelReq.icon,
          isUnlockable: idx > 0,
          unlockCondition: idx > 0 ? { 
            type: "level_reached", 
            value: zoneLevelReq.level,
            comparison: "gte"
          } : undefined,
        };
      });

      // Update map config with zones
      await fetch("/api/journey-map", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mapId: "traders_journey",
          name: "Trader's Journey",
          description: "Navigate through the islands to become a Trading God. Each zone requires higher levels to unlock!",
          zones: zonesData,
          defaultStartNode: "island_1_1",
          backgroundColor: "#1a3a5c",
          backgroundImage: "/assets/treasure-map.png",
          isActive: true,
        }),
      });

      // Count total milestones to distribute templates
      const placedIslands = generatorIslands.filter(i => i.isPlaced);
      const totalMilestones = placedIslands.reduce((sum, i) => sum + i.milestonesCount, 0);
      
      // Get the appropriate tier templates based on progress
      const getTemplatesForTier = (tier: number) => {
        return MILESTONE_TEMPLATES.filter(t => t.tier === tier);
      };

      // Calculate which tier a milestone should be in (1-7)
      const getTierForProgress = (progress: number): number => {
        if (progress < 0.1) return 1;      // First 10%
        if (progress < 0.25) return 2;     // 10-25%
        if (progress < 0.4) return 3;      // 25-40%
        if (progress < 0.55) return 4;     // 40-55%
        if (progress < 0.75) return 5;     // 55-75%
        if (progress < 0.9) return 6;      // 75-90%
        return 7;                           // Final 10%
      };

      // Get level requirement based on progress through journey
      const getLevelForProgress = (progress: number): typeof LEVEL_REQUIREMENTS[0] => {
        const levelIndex = Math.min(19, Math.floor(progress * 20));
        return LEVEL_REQUIREMENTS[levelIndex];
      };

      // Scale condition values based on progress
      const scaleConditionValue = (baseValue: number, progress: number, type: string): number => {
        // Different scaling for different condition types
        const scalingFactors: Record<string, number> = {
          "total_trades": 1.5,
          "winning_trades": 1.3,
          "win_rate": 1.0, // Don't scale percentages much
          "win_streak": 1.2,
          "competitions_entered": 1.4,
          "competitions_completed": 1.4,
          "first_place_finishes": 1.5,
          "podium_finishes": 1.4,
          "total_pnl": 2.0,
          "active_days": 1.3,
        };
        
        const factor = scalingFactors[type] || 1.3;
        return Math.ceil(baseValue * (1 + progress * factor));
      };

      // Generate milestones for each island
      let milestoneOrder = 1;
      let templateIndex = 0;
      const allMilestones: any[] = [];
      const usedTemplates = new Set<string>();

      for (const island of placedIslands) {
        // Calculate what level is required to reach this island
        const islandProgress = (island.id - 1) / placedIslands.length;
        const islandLevelReq = getLevelForProgress(islandProgress);
        
        for (let m = 0; m < island.milestonesCount; m++) {
          const milestoneId = `island_${island.id}_${m + 1}`;
          const isFirst = milestoneOrder === 1;
          const isLast = milestoneOrder === totalMilestones;
          const progress = milestoneOrder / totalMilestones;
          
          // Get the appropriate tier for this milestone
          const tier = getTierForProgress(progress);
          const tierTemplates = getTemplatesForTier(tier);
          
          // Pick a template (rotate through available templates)
          let template = tierTemplates[templateIndex % tierTemplates.length];
          
          // Try to avoid duplicate templates if possible
          let attempts = 0;
          while (usedTemplates.has(template.name) && attempts < tierTemplates.length) {
            templateIndex++;
            template = tierTemplates[templateIndex % tierTemplates.length];
            attempts++;
          }
          usedTemplates.add(template.name);
          templateIndex++;
          
          // Get level requirement for this specific milestone
          const levelReq = getLevelForProgress(progress);
          
          // Calculate position offset for multiple milestones on same island
          const offsetX = island.milestonesCount > 1 
            ? (m - (island.milestonesCount - 1) / 2) * 25 
            : 0;
          const offsetY = island.milestonesCount > 1 
            ? (m % 2 === 0 ? -15 : 15) * Math.ceil((m + 1) / 2)
            : 0;

          // Determine next milestone connection
          const connectedTo: string[] = [];
          if (m < island.milestonesCount - 1) {
            connectedTo.push(`island_${island.id}_${m + 2}`);
          } else {
            const nextIsland = placedIslands.find(i => i.id === island.id + 1);
            if (nextIsland) {
              connectedTo.push(`island_${nextIsland.id}_1`);
            }
          }

          // Determine previous milestone connection
          const connectedFrom: string[] = [];
          if (m > 0) {
            connectedFrom.push(`island_${island.id}_${m}`);
          } else {
            const prevIsland = placedIslands.find(i => i.id === island.id - 1);
            if (prevIsland) {
              connectedFrom.push(`island_${prevIsland.id}_${prevIsland.milestonesCount}`);
            }
          }

          // Determine node type based on milestone importance
          let nodeType = "milestone";
          let icon = template.condition.type === "account_created" ? "ship" 
            : template.condition.type === "first_deposit" ? "coins"
            : template.condition.type === "kyc_verified" ? "shield1"
            : template.condition.type.includes("competition") ? "trophy"
            : template.condition.type.includes("win") ? "star1"
            : template.condition.type.includes("trade") ? "trade"
            : levelReq.icon;
          let size: "small" | "medium" | "large" = "medium";
          
          if (isFirst) {
            nodeType = "start";
            icon = "ship";
            size = "large";
          } else if (isLast) {
            nodeType = "legendary";
            icon = "victory";
            size = "large";
          } else if (m === 0) {
            // First milestone of each island is a checkpoint
            nodeType = "checkpoint";
            size = "large";
          } else if (tier >= 6) {
            nodeType = "legendary";
            size = "large";
          } else if (tier >= 4) {
            size = "medium";
          } else {
            size = m === island.milestonesCount - 1 ? "medium" : "small";
          }

          // Build unlock condition - requires BOTH level AND previous milestone
          const unlockCondition = isFirst ? undefined : {
            type: "level_reached",
            value: levelReq.level,
            comparison: "gte",
          };

          // Build completion condition from template
          const completeCondition = {
            type: template.condition.type,
            value: template.condition.value 
              ? scaleConditionValue(template.condition.value, progress, template.condition.type)
              : undefined,
            comparison: "gte" as const,
          };

          // Scale XP reward based on progress and tier
          const baseXP = template.xp;
          const scaledXP = Math.round(baseXP * (1 + progress * 2)); // Double XP at end

          const milestone = {
            id: milestoneId,
            mapId: "traders_journey",
            name: isFirst 
              ? "Set Sail" 
              : isLast 
                ? "Trading God - Final Destination"
                : `${template.name}`,
            description: isFirst
              ? "Your trading journey begins here! Complete challenges to progress across the map."
              : isLast
                ? "The ultimate achievement. Reach Level 20 and become a Trading God!"
                : template.desc,
            shortDescription: `${levelReq.title} (Lv.${levelReq.level})`,
            zoneId: island.zoneId,
            position: { 
              x: Math.round(island.position.x + offsetX), 
              y: Math.round(island.position.y + offsetY) 
            },
            nodeType,
            icon,
            color: generatorZones.find(z => z.id === island.zoneId)?.color || "#3B82F6",
            size,
            unlockCondition,
            completeCondition,
            rewards: { 
              xp: scaledXP,
              title: tier >= 5 ? levelReq.title : undefined,
            },
            connectedTo,
            connectedFrom,
            isRequired: true,
            isAutoComplete: isFirst,
            order: milestoneOrder,
            tooltipText: `Level ${levelReq.level}: ${levelReq.title}`,
            celebrationText: isLast 
              ? "🎉 CONGRATULATIONS! You have become a TRADING GOD! 🎉"
              : tier >= 6
                ? `🏆 LEGENDARY! You've completed "${template.name}"!`
                : tier >= 4
                  ? `⭐ Excellent! You've completed "${template.name}"!`
                  : `✓ You've completed "${template.name}"!`,
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

      toast.success(`Generated ${allMilestones.length} milestones with varied challenges (Tier 1-7)! Journey from Novice → Trading God`);
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

  // Render milestone editor - fullscreen overlay
  const renderMilestoneEditor = () => {
    if (!selectedMilestone || !editMilestoneOpen) return null;

    return (
      <div className="fixed inset-0 z-[100] bg-slate-950 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 bg-slate-900 border-b border-slate-700">
          <div className="flex items-center gap-4">
            <GameIcon name={selectedMilestone.icon as GameIconName} size={40} />
            <div>
              <h2 className="text-xl font-bold">
                {milestones.find(m => m.id === selectedMilestone.id) ? "Edit" : "Create"} Milestone
              </h2>
              <p className="text-sm text-muted-foreground">
                {selectedMilestone.name || "New Milestone"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={() => setEditMilestoneOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => saveMilestone(selectedMilestone)}>
              <Save className="h-4 w-4 mr-2" />
              Save Milestone
            </Button>
          </div>
        </div>

        {/* Main Content - Two Columns */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Column - Form Fields */}
          <div className="flex-1 overflow-y-auto p-6">
            <div className="max-w-4xl mx-auto space-y-6">
              {/* Basic Info */}
              <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Target className="h-5 w-5 text-blue-500" />
                  Basic Information
                </h3>
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

                <div className="space-y-2 mt-4">
                  <Label>Description</Label>
                  <Textarea
                    value={selectedMilestone.description}
                    onChange={e => setSelectedMilestone({ ...selectedMilestone, description: e.target.value })}
                    placeholder="Execute your first trade..."
                    rows={3}
                  />
                </div>
              </div>

              {/* Appearance */}
              <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Palette className="h-5 w-5 text-purple-500" />
                  Appearance
                </h3>
                <div className="grid grid-cols-4 gap-4">
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
                            <span className="flex items-center gap-2">
                              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: zone.color }} />
                              {zone.name}
                            </span>
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

                  <div className="space-y-2">
                    <Label>Color</Label>
                    <Input
                      type="color"
                      value={selectedMilestone.color}
                      onChange={e => setSelectedMilestone({ ...selectedMilestone, color: e.target.value })}
                      className="h-10"
                    />
                  </div>
                </div>

                {/* Position */}
                <div className="grid grid-cols-3 gap-4 mt-4">
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
                <div className="space-y-2 mt-4">
                  <Label>Icon</Label>
                  <GameIconPicker
                    value={selectedMilestone.icon as GameIconName}
                    onChange={(icon) => setSelectedMilestone({ ...selectedMilestone, icon })}
                  />
                </div>
              </div>

              {/* Completion Condition */}
              <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Target className="h-5 w-5 text-green-500" />
                  Completion Condition
                </h3>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Type</Label>
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
                    <Label>Value</Label>
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
                    <Label>Comparison</Label>
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
              <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Star className="h-5 w-5 text-yellow-500" />
                  Rewards
                </h3>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>XP</Label>
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
                    <Label>Badge ID (optional)</Label>
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
                    <Label>Title (optional)</Label>
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
              <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Link className="h-5 w-5 text-cyan-500" />
                  Connections
                </h3>
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
              </div>

              {/* Options */}
              <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Settings className="h-5 w-5 text-slate-400" />
                  Options
                </h3>
                <div className="flex flex-wrap gap-6">
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
              </div>

              {/* Celebration Text */}
              <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-amber-500" />
                  Celebration
                </h3>
                <div className="space-y-2">
                  <Label>Celebration Text (shown on complete)</Label>
                  <Textarea
                    value={selectedMilestone.celebrationText || ""}
                    onChange={e => setSelectedMilestone({
                      ...selectedMilestone,
                      celebrationText: e.target.value
                    })}
                    placeholder="Congratulations! You've completed this milestone!"
                    rows={3}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Preview */}
          <div className="w-80 bg-slate-900 border-l border-slate-700 p-4 overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">Preview</h3>
            
            {/* Milestone Preview Card */}
            <div className="bg-slate-800 rounded-lg p-4 border border-slate-600">
              <div className="flex items-center gap-3 mb-3">
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: selectedMilestone.color }}
                >
                  <GameIcon name={selectedMilestone.icon as GameIconName} size={28} />
                </div>
                <div>
                  <div className="font-semibold">{selectedMilestone.name || "Unnamed"}</div>
                  <div className="text-sm text-muted-foreground">{selectedMilestone.nodeType}</div>
                </div>
              </div>
              
              <p className="text-sm text-muted-foreground mb-3">
                {selectedMilestone.description || "No description"}
              </p>
              
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Zone:</span>
                  <span>{mapConfig?.zones.find(z => z.id === selectedMilestone.zoneId)?.name || selectedMilestone.zoneId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Position:</span>
                  <span>({selectedMilestone.position.x}, {selectedMilestone.position.y})</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Order:</span>
                  <span>#{selectedMilestone.order}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">XP Reward:</span>
                  <span className="text-yellow-500 font-semibold">+{selectedMilestone.rewards.xp} XP</span>
                </div>
                {selectedMilestone.rewards.badgeId && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Badge:</span>
                    <span className="text-purple-400">{selectedMilestone.rewards.badgeId}</span>
                  </div>
                )}
              </div>
              
              <div className="mt-3 pt-3 border-t border-slate-600">
                <div className="text-sm text-muted-foreground mb-1">Condition:</div>
                <div className="text-sm">
                  {selectedMilestone.completeCondition.type} {selectedMilestone.completeCondition.comparison || "≥"} {selectedMilestone.completeCondition.value || 0}
                </div>
              </div>
            </div>
            
            {/* Quick Stats */}
            <div className="mt-4 space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <Badge variant={selectedMilestone.isActive ? "default" : "secondary"}>
                  {selectedMilestone.isActive ? "Active" : "Inactive"}
                </Badge>
                {selectedMilestone.isRequired && (
                  <Badge variant="outline">Required</Badge>
                )}
                {selectedMilestone.isAutoComplete && (
                  <Badge variant="outline">Auto</Badge>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
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
          <Button variant="outline" onClick={validateJourney} className="border-green-600 text-green-600 hover:bg-green-600/10">
            <Star className="h-4 w-4 mr-2" />
            Validate
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
          <TabsTrigger value="sequence">
            <Map className="h-4 w-4 mr-2" />
            10 Maps
          </TabsTrigger>
          <TabsTrigger value="map">
            <MapPin className="h-4 w-4 mr-2" />
            Current Map
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

        {/* 10-Map Sequence Tab */}
        <TabsContent value="sequence" className="mt-4">
          <div className="space-y-6">
            {/* Sequence Header */}
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">10-Map Journey Sequence</h3>
                <p className="text-sm text-muted-foreground">
                  Manage your multi-map progression system with themes, XP budgets, and difficulty scaling
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={async () => {
                    try {
                      setSequenceLoading(true);
                      const res = await fetch("/api/ai/generate-journey", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ action: "validate_sequence" }),
                      });
                      const data = await res.json();
                      setSequenceValidation(data);
                      toast.success("Sequence validated");
                    } catch {
                      toast.error("Failed to validate sequence");
                    } finally {
                      setSequenceLoading(false);
                    }
                  }}
                  disabled={sequenceLoading}
                >
                  {sequenceLoading ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <AlertTriangle className="h-4 w-4 mr-2" />}
                  Validate All
                </Button>
                <Button
                  onClick={() => setShowSequenceDialog(true)}
                  disabled={sequenceGenerating}
                >
                  {sequenceGenerating ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Wand2 className="h-4 w-4 mr-2" />}
                  Generate Full Sequence
                </Button>
              </div>
            </div>

            {/* Sequence Overview Cards */}
            <div className="grid grid-cols-5 gap-4">
              {[
                { order: 1, name: "Pirate Cove", theme: "pirate", xp: 150, color: "#F59E0B" },
                { order: 2, name: "Space Station", theme: "space", xp: 200, color: "#8B5CF6" },
                { order: 3, name: "Medieval Castle", theme: "medieval", xp: 300, color: "#EF4444" },
                { order: 4, name: "Cyber City", theme: "cyber", xp: 400, color: "#00FFFF" },
                { order: 5, name: "Ancient Temple", theme: "ancient", xp: 500, color: "#D4A373" },
                { order: 6, name: "Volcanic Island", theme: "volcanic", xp: 700, color: "#DC2626" },
                { order: 7, name: "Arctic Fortress", theme: "arctic", xp: 1000, color: "#38BDF8" },
                { order: 8, name: "Dragon Realm", theme: "dragon", xp: 1500, color: "#A855F7" },
                { order: 9, name: "Celestial Kingdom", theme: "celestial", xp: 2500, color: "#FFD700" },
                { order: 10, name: "Hall of Legends", theme: "legendary", xp: 5000, color: "#FF6B6B" },
              ].map((map) => (
                <Card 
                  key={map.order}
                  className={`cursor-pointer transition-all hover:scale-105 ${
                    selectedSequenceMap === map.order ? "ring-2 ring-primary" : ""
                  }`}
                  onClick={() => {
                    setSelectedSequenceMap(map.order);
                    // Could load this specific map here
                  }}
                >
                  <CardHeader className="p-3">
                    <div 
                      className="w-full h-2 rounded-full mb-2"
                      style={{ backgroundColor: map.color }}
                    />
                    <CardTitle className="text-sm flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center text-xs">
                        {map.order}
                      </span>
                      {map.name}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-3 pt-0">
                    <div className="text-xs space-y-1">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Theme:</span>
                        <span className="capitalize">{map.theme}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">XP Budget:</span>
                        <span>{map.xp} XP</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Difficulty:</span>
                        <span>{map.order}/10</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* XP Economy Overview */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">XP Economy Overview</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-4 gap-4 text-sm">
                  <div className="text-center p-4 bg-slate-800 rounded-lg">
                    <div className="text-2xl font-bold text-green-500">12,250+</div>
                    <div className="text-muted-foreground">Total XP</div>
                  </div>
                  <div className="text-center p-4 bg-slate-800 rounded-lg">
                    <div className="text-2xl font-bold text-blue-500">200</div>
                    <div className="text-muted-foreground">Total Milestones</div>
                  </div>
                  <div className="text-center p-4 bg-slate-800 rounded-lg">
                    <div className="text-2xl font-bold text-purple-500">10</div>
                    <div className="text-muted-foreground">Themed Maps</div>
                  </div>
                  <div className="text-center p-4 bg-slate-800 rounded-lg">
                    <div className="text-2xl font-bold text-yellow-500">20</div>
                    <div className="text-muted-foreground">Max Level</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Validation Results */}
            {sequenceValidation && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    {sequenceValidation.overallValid ? (
                      <Badge variant="default" className="bg-green-600">Valid</Badge>
                    ) : (
                      <Badge variant="destructive">Issues Found</Badge>
                    )}
                    Sequence Validation Results
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {sequenceValidation.sequenceValidation?.errors?.map((error: any, i: number) => (
                      <div key={i} className="flex items-start gap-2 text-red-500 text-sm">
                        <AlertTriangle className="h-4 w-4 mt-0.5" />
                        <span>{error.message}</span>
                      </div>
                    ))}
                    {sequenceValidation.sequenceValidation?.warnings?.map((warn: any, i: number) => (
                      <div key={i} className="flex items-start gap-2 text-yellow-500 text-sm">
                        <AlertTriangle className="h-4 w-4 mt-0.5" />
                        <span>{warn.message}</span>
                      </div>
                    ))}
                    {sequenceValidation.overallValid && (
                      <div className="text-green-500 text-sm">All maps validated successfully!</div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Quick Actions */}
            <div className="flex gap-4">
              <Button
                variant="outline"
                onClick={async () => {
                  try {
                    const res = await fetch("/api/ai/generate-journey", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ action: "connect_maps" }),
                    });
                    const data = await res.json();
                    if (data.success) {
                      toast.success(`Connected ${data.mapsConnected} maps in sequence`);
                    }
                  } catch {
                    toast.error("Failed to connect maps");
                  }
                }}
              >
                <Link className="h-4 w-4 mr-2" />
                Connect Maps
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setSelectedTab("map");
                }}
              >
                <Eye className="h-4 w-4 mr-2" />
                View Map {selectedSequenceMap}
              </Button>
            </div>
          </div>
        </TabsContent>

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

      {/* Generator Dialog - Hide when step 2 is active (fullscreen mode) */}
      <Dialog open={generatorOpen && generatorStep !== 2} onOpenChange={setGeneratorOpen}>
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
              {/* AI Mode Toggle */}
              <div className="p-4 rounded-lg border-2 border-dashed border-purple-500/50 bg-purple-500/5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-purple-500/20">
                      <Wand2 className="h-5 w-5 text-purple-400" />
                    </div>
                    <div>
                      <Label className="text-lg font-semibold text-purple-300">AI Journey Agent</Label>
                      <p className="text-sm text-muted-foreground">
                        Let AI create a smart, progressively challenging journey
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={aiModeEnabled}
                    onCheckedChange={setAiModeEnabled}
                    className="data-[state=checked]:bg-purple-500"
                  />
                </div>

                {aiModeEnabled && (
                  <div className="mt-4 space-y-4 pt-4 border-t border-purple-500/30">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-sm">Theme</Label>
                        <Select value={aiTheme} onValueChange={(v: any) => setAiTheme(v)}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pirate">🏴‍☠️ Pirate Adventure</SelectItem>
                            <SelectItem value="space">🚀 Space Explorer</SelectItem>
                            <SelectItem value="medieval">🏰 Medieval Quest</SelectItem>
                            <SelectItem value="modern">💹 Modern Trading</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm">Milestone Count</Label>
                        <Input
                          type="number"
                          min={5}
                          max={25}
                          value={generatorIslandCount}
                          onChange={e => setGeneratorIslandCount(Math.max(5, Math.min(25, parseInt(e.target.value) || 10)))}
                        />
                      </div>
                    </div>

                    <div className="p-3 rounded-lg bg-slate-800/50 text-sm">
                      <div className="font-medium text-green-400 mb-2 flex items-center gap-2">
                        <Star className="h-4 w-4" />
                        AI Agent Guarantees:
                      </div>
                      <ul className="space-y-1 text-muted-foreground text-xs">
                        <li>✓ Strictly linear progression (must complete N to unlock N+1)</li>
                        <li>✓ Progressive difficulty (each milestone harder than previous)</li>
                        <li>✓ No duplicate conditions</li>
                        <li>✓ Proper XP scaling (5-150 XP based on difficulty)</li>
                        <li>✓ {aiTheme === "pirate" ? "Pirate-themed" : aiTheme === "space" ? "Space-themed" : aiTheme === "medieval" ? "Medieval-themed" : "Modern"} creative names</li>
                      </ul>
                    </div>

                    <Button 
                      onClick={generateAIJourney} 
                      disabled={aiGenerating}
                      className="w-full bg-purple-600 hover:bg-purple-700"
                      size="lg"
                    >
                      {aiGenerating ? (
                        <>
                          <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                          AI is Generating...
                        </>
                      ) : (
                        <>
                          <Wand2 className="h-4 w-4 mr-2" />
                          Generate with AI Agent
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </div>

              {/* Manual Mode - Island Count */}
              {!aiModeEnabled && (
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
                    Islands, zones & milestones will be auto-generated
                  </span>
                </div>
              </div>
              )}

              {/* Auto-generation Preview */}
              <div className="space-y-3 p-4 bg-slate-800/50 rounded-lg border border-slate-700">
                <Label className="text-lg font-semibold flex items-center gap-2">
                  <Wand2 className="h-4 w-4 text-purple-400" />
                  Auto-Generation Preview
                </Label>
                
                {/* Stats Preview */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-slate-900/50 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-blue-400">{generatorIslandCount}</div>
                    <div className="text-xs text-muted-foreground">Islands</div>
                  </div>
                  <div className="bg-slate-900/50 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-purple-400">{calculateOptimalZones(generatorIslandCount)}</div>
                    <div className="text-xs text-muted-foreground">Zones</div>
                  </div>
                  <div className="bg-slate-900/50 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-amber-400">
                      {/* Estimate milestones: avg 2 per island */}
                      ~{Math.round(generatorIslandCount * 2.5)}
                    </div>
                    <div className="text-xs text-muted-foreground">Milestones</div>
                  </div>
                </div>

                {/* Zone Preview */}
                <div className="space-y-2">
                  <div className="text-sm font-medium text-muted-foreground">Zones that will be created:</div>
                  <div className="flex flex-wrap gap-2">
                    {ZONE_TEMPLATES.slice(0, calculateOptimalZones(generatorIslandCount)).map((zone, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-full text-sm text-white"
                        style={{ backgroundColor: zone.color }}
                      >
                        <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-xs">
                          {idx + 1}
                        </span>
                        {zone.name}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Progression Info */}
                <div className="text-sm text-muted-foreground mt-2 p-3 bg-slate-900/30 rounded-lg">
                  <div className="font-medium text-slate-300 mb-1">Game-like progression:</div>
                  <ul className="list-disc list-inside space-y-1 text-xs">
                    <li>Early islands: 1-2 milestones (easy challenges)</li>
                    <li>Mid islands: 2-3 milestones (moderate challenges)</li>
                    <li>Late islands: 3-4 milestones (hard challenges)</li>
                    <li>Each zone requires higher player level to unlock</li>
                    <li>Milestones use varied conditions (trades, wins, competitions...)</li>
                  </ul>
                </div>
              </div>

              {/* Customize hint */}
              <div className="text-xs text-muted-foreground text-center">
                You can customize island names, zones, and milestones after placement
              </div>

              <Button onClick={initializeGenerator} className="w-full" size="lg">
                <Wand2 className="h-4 w-4 mr-2" />
                Generate & Place Islands
                <MapPin className="h-4 w-4 ml-2" />
              </Button>
            </div>
          )}

          {/* Step 2: Place Islands - Show message to use fullscreen */}
          {generatorStep === 2 && (
            <div className="text-center py-8">
              <p className="text-lg mb-4">Island placement is now open in fullscreen mode.</p>
              <p className="text-muted-foreground mb-4">Click on the map to place each island in order.</p>
              <Button variant="outline" onClick={() => setGeneratorStep(1)}>
                Back to Configure
              </Button>
            </div>
          )}

          {/* Step 3: Review & Generate */}
          {generatorStep === 3 && (
            <div className="space-y-4">
              {/* AI Generated View */}
              {aiModeEnabled && aiGeneratedMilestones.length > 0 ? (
                <>
                  {/* AI Validation Status */}
                  {aiValidation && (
                    <div className={`p-4 rounded-lg border ${
                      aiValidation.isValid 
                        ? "border-green-500/50 bg-green-500/10" 
                        : "border-amber-500/50 bg-amber-500/10"
                    }`}>
                      <div className="flex items-center gap-2 mb-2">
                        {aiValidation.isValid ? (
                          <>
                            <Star className="h-5 w-5 text-green-500" />
                            <span className="font-semibold text-green-400">AI Validation Passed!</span>
                          </>
                        ) : (
                          <>
                            <AlertTriangle className="h-5 w-5 text-amber-500" />
                            <span className="font-semibold text-amber-400">
                              {aiValidation.errors?.length || 0} errors, {aiValidation.warnings?.length || 0} warnings
                            </span>
                          </>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        ✓ Linear progression • ✓ No duplicates • ✓ Progressive difficulty
                      </div>
                    </div>
                  )}

                  {/* AI Generated Stats */}
                  <div className="grid grid-cols-4 gap-4">
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Milestones</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold text-purple-400">{aiGeneratedMilestones.length}</div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Total XP</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold text-green-400">
                          {aiGeneratedMilestones.reduce((sum, m) => sum + (m.rewards?.xp || 0), 0)}
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Theme</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-lg font-bold capitalize">{aiTheme}</div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Zones</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">
                          {new Set(aiGeneratedMilestones.map(m => m.zoneId)).size}
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* AI Generated Milestones Preview */}
                  <div className="border rounded-lg p-4 max-h-[300px] overflow-y-auto">
                    <h3 className="font-semibold mb-3 flex items-center gap-2">
                      <Wand2 className="h-4 w-4 text-purple-400" />
                      AI Generated Journey Path
                    </h3>
                    <div className="space-y-2">
                      {aiGeneratedMilestones.map((milestone, idx) => (
                        <div 
                          key={milestone.id || idx} 
                          className="flex items-center gap-3 p-2 rounded-lg bg-slate-800/50"
                        >
                          <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center text-sm font-bold text-purple-400">
                            {idx + 1}
                          </div>
                          <div className="flex-1">
                            <div className="font-medium">{milestone.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {milestone.completeCondition?.type}
                              {milestone.completeCondition?.value ? ` ≥ ${milestone.completeCondition.value}` : ""}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">
                              {milestone.rewards?.xp || 0} XP
                            </Badge>
                            <Badge 
                              className="text-xs"
                              style={{ backgroundColor: milestone.color }}
                            >
                              {milestone.nodeType}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => {
                      setGeneratorStep(1);
                      setAiGeneratedMilestones([]);
                    }}>
                      Back
                    </Button>
                    <Button variant="outline" onClick={generateAIJourney} disabled={aiGenerating}>
                      <RefreshCw className={`h-4 w-4 mr-2 ${aiGenerating ? "animate-spin" : ""}`} />
                      Regenerate
                    </Button>
                    <Button 
                      onClick={applyAIMilestones}
                      className="flex-1 bg-purple-600 hover:bg-purple-700"
                    >
                      <Star className="h-4 w-4 mr-2" />
                      Apply AI Journey
                    </Button>
                  </div>
                </>
              ) : (
                /* Manual Generator View */
                <>
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
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Fullscreen Island Placement Overlay - Rendered outside dialog to avoid event conflicts */}
      {generatorOpen && generatorStep === 2 && (
        <div 
          className="fixed inset-0 z-[200] bg-slate-950 flex flex-col"
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div 
            className="flex items-center justify-between p-4 bg-slate-900 border-b border-slate-700"
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              <h2 className="text-xl font-bold flex items-center gap-2">
                <MapPin className="h-5 w-5 text-blue-500" />
                Place Islands on Map
              </h2>
              <p className="text-sm text-muted-foreground">
                {generatorPlacingMode 
                  ? `Click to place Island ${generatorCurrentIsland + 1} of ${generatorIslands.length}`
                  : `${generatorIslands.filter(i => i.isPlaced).length} / ${generatorIslands.length} islands placed`}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant={generatorPlacingMode ? "destructive" : "default"}
                onClick={(e) => {
                  e.stopPropagation();
                  setGeneratorPlacingMode(!generatorPlacingMode);
                }}
                size="lg"
              >
                {generatorPlacingMode ? "Stop Placing" : "Start Placing"}
              </Button>
              <Button 
                variant="outline" 
                onClick={(e) => {
                  e.stopPropagation();
                  setGeneratorStep(1);
                }}
              >
                Back
              </Button>
              <Button 
                onClick={(e) => {
                  e.stopPropagation();
                  setGeneratorStep(3);
                }}
                disabled={generatorIslands.filter(i => i.isPlaced).length < 2}
              >
                Next: Review
              </Button>
            </div>
          </div>

          {/* Main Content - Map and Island List side by side */}
          <div className="flex-1 flex overflow-hidden" onClick={(e) => e.stopPropagation()}>
            {/* Map Area */}
            <div className="flex-1 relative overflow-auto bg-slate-800 p-4">
              <div
                ref={generatorMapRef}
                className="relative mx-auto cursor-crosshair"
                style={{ 
                  width: "100%",
                  maxWidth: 1200,
                  aspectRatio: "1200/800",
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  handleGeneratorMapClick(e);
                }}
              >
                {/* Map Image */}
                <Image
                  src="/assets/treasure-map.png"
                  alt="Treasure Map"
                  fill
                  className="object-contain pointer-events-none"
                  draggable={false}
                  priority
                />
                
                {/* Placed island markers */}
                {generatorIslands.filter(i => i.isPlaced).map(island => {
                  // Convert map coordinates to percentage for responsive positioning
                  const leftPercent = (island.position.x / 1200) * 100;
                  const topPercent = (island.position.y / 800) * 100;
                  
                  return (
                    <div
                      key={island.id}
                      className="absolute w-10 h-10 -ml-5 -mt-5 rounded-full flex items-center justify-center text-white text-sm font-bold shadow-lg transform hover:scale-110 transition-transform pointer-events-none"
                      style={{
                        left: `${leftPercent}%`,
                        top: `${topPercent}%`,
                        backgroundColor: generatorZones.find(z => z.id === island.zoneId)?.color || "#3B82F6",
                        border: island.id === generatorCurrentIsland + 1 ? "4px solid white" : "3px solid rgba(255,255,255,0.7)",
                        boxShadow: "0 4px 15px rgba(0,0,0,0.5)",
                      }}
                    >
                      {island.id}
                    </div>
                  );
                })}
                
                {/* Placing mode indicator */}
                {generatorPlacingMode && (
                  <div className="absolute top-4 left-4 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium shadow-lg animate-pulse pointer-events-none">
                    Click to place Island {generatorCurrentIsland + 1}: {generatorIslands[generatorCurrentIsland]?.name}
                  </div>
                )}
              </div>
            </div>

            {/* Island List Sidebar - Grouped by Zone */}
            <div className="w-96 bg-slate-900 border-l border-slate-700 overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              {/* Summary Header */}
              <div className="sticky top-0 bg-slate-900 border-b border-slate-700 p-3 z-10">
                <h3 className="font-semibold text-lg mb-2">Islands by Zone</h3>
                <div className="flex gap-2 text-xs">
                  <span className="px-2 py-1 bg-slate-800 rounded">
                    {generatorIslands.length} Islands
                  </span>
                  <span className="px-2 py-1 bg-slate-800 rounded">
                    {generatorIslands.reduce((sum, i) => sum + i.milestonesCount, 0)} Milestones
                  </span>
                  <span className="px-2 py-1 bg-green-900/50 rounded text-green-400">
                    {generatorIslands.filter(i => i.isPlaced).length} Placed
                  </span>
                </div>
              </div>
              
              {/* Grouped Islands by Zone */}
              <div className="p-3 space-y-4">
                {generatorZones.map(zone => {
                  const zoneIslands = generatorIslands.filter(i => i.zoneId === zone.id);
                  const zoneMilestones = zoneIslands.reduce((sum, i) => sum + i.milestonesCount, 0);
                  const zonePlaced = zoneIslands.filter(i => i.isPlaced).length;
                  
                  return (
                    <div key={zone.id} className="space-y-2">
                      {/* Zone Header */}
                      <div 
                        className="flex items-center justify-between p-2 rounded-lg"
                        style={{ backgroundColor: zone.color + "20", borderLeft: `4px solid ${zone.color}` }}
                      >
                        <span className="font-medium text-sm flex items-center gap-2">
                          <span 
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: zone.color }}
                          />
                          {zone.name}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {zoneIslands.length} islands • {zoneMilestones} MS • {zonePlaced}/{zoneIslands.length} placed
                        </span>
                      </div>
                      
                      {/* Zone Islands */}
                      <div className="space-y-2 pl-2">
                        {zoneIslands.map((island) => {
                          const idx = generatorIslands.findIndex(i => i.id === island.id);
                          // Difficulty color based on milestone count
                          const difficultyColor = island.milestonesCount <= 2 ? "text-green-400" 
                            : island.milestonesCount <= 3 ? "text-yellow-400"
                            : island.milestonesCount <= 4 ? "text-orange-400"
                            : "text-red-400";
                          const difficultyBg = island.milestonesCount <= 2 ? "bg-green-500/20" 
                            : island.milestonesCount <= 3 ? "bg-yellow-500/20"
                            : island.milestonesCount <= 4 ? "bg-orange-500/20"
                            : "bg-red-500/20";
                          
                          return (
                            <div 
                              key={island.id}
                              className={`p-2 rounded-lg border transition-all ${
                                island.isPlaced 
                                  ? "bg-green-900/20 border-green-700/50" 
                                  : "bg-slate-800/50 border-slate-700/50"
                              } ${idx === generatorCurrentIsland && generatorPlacingMode 
                                  ? "ring-2 ring-blue-500 ring-offset-1 ring-offset-slate-900" 
                                  : ""}`}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <div className="flex items-center gap-2 mb-1.5">
                                {/* Island Number Badge */}
                                <span 
                                  className="w-6 h-6 rounded-full flex items-center justify-center text-xs text-white font-bold"
                                  style={{ backgroundColor: zone.color }}
                                >
                                  {island.id}
                                </span>
                                
                                {/* Island Name */}
                                <Input
                                  value={island.name}
                                  onChange={e => setGeneratorIslands(prev => prev.map(i => 
                                    i.id === island.id ? { ...i, name: e.target.value } : i
                                  ))}
                                  onClick={(e) => e.stopPropagation()}
                                  className="h-7 text-sm flex-1 bg-transparent border-slate-600"
                                  placeholder="Island name"
                                />
                                
                                {/* Milestone Count with Difficulty Indicator */}
                                <div 
                                  className={`flex items-center gap-1 px-2 py-1 rounded ${difficultyBg}`}
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <Input
                                    type="number"
                                    min={1}
                                    max={10}
                                    value={island.milestonesCount}
                                    onChange={e => setGeneratorIslands(prev => prev.map(i => 
                                      i.id === island.id ? { ...i, milestonesCount: Math.max(1, Math.min(10, parseInt(e.target.value) || 1)) } : i
                                    ))}
                                    onClick={(e) => e.stopPropagation()}
                                    className={`w-10 h-6 text-sm text-center bg-transparent border-0 p-0 ${difficultyColor} font-bold`}
                                  />
                                  <span className={`text-xs ${difficultyColor}`}>MS</span>
                                </div>
                                
                                {/* Placed Status */}
                                {island.isPlaced ? (
                                  <span className="text-green-500 text-lg">✓</span>
                                ) : (
                                  <span className="text-slate-600 text-lg">○</span>
                                )}
                              </div>
                              
                              {/* Position info when placed */}
                              {island.isPlaced && (
                                <div className="text-[10px] text-muted-foreground pl-8">
                                  📍 ({island.position.x}, {island.position.y})
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
              
              {/* Difficulty Legend */}
              <div className="sticky bottom-0 bg-slate-900 border-t border-slate-700 p-3">
                <div className="text-xs text-muted-foreground mb-1">Difficulty:</div>
                <div className="flex gap-2 text-xs">
                  <span className="px-2 py-0.5 bg-green-500/20 text-green-400 rounded">1-2 Easy</span>
                  <span className="px-2 py-0.5 bg-yellow-500/20 text-yellow-400 rounded">3 Medium</span>
                  <span className="px-2 py-0.5 bg-orange-500/20 text-orange-400 rounded">4 Hard</span>
                  <span className="px-2 py-0.5 bg-red-500/20 text-red-400 rounded">5+ Expert</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Full Sequence Generation Dialog */}
      <Dialog open={showSequenceDialog} onOpenChange={setShowSequenceDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wand2 className="h-5 w-5 text-purple-500" />
              Generate Full 10-Map Sequence
            </DialogTitle>
            <DialogDescription>
              This will use AI to generate milestones for all 10 maps with proper difficulty progression and XP economy.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4">
              <h4 className="font-semibold text-amber-400 mb-2">⚠️ Warning</h4>
              <p className="text-sm text-muted-foreground">
                This will generate new milestones for all maps. Existing milestones will be preserved unless you manually clear them first.
              </p>
            </div>
            
            <div className="space-y-2">
              <h4 className="font-medium">What will be generated:</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• 200 total milestones across 10 themed maps</li>
                <li>• Progressive difficulty from Pirate Cove (easy) to Hall of Legends (legendary)</li>
                <li>• Front-loaded XP economy (12,250+ total XP)</li>
                <li>• Linear prerequisite chains within each map</li>
                <li>• Map completion conditions to unlock next maps</li>
              </ul>
            </div>

            <div className="grid grid-cols-2 gap-4 text-center">
              <div className="bg-slate-800 rounded-lg p-3">
                <div className="text-2xl font-bold text-green-400">~2 min</div>
                <div className="text-xs text-muted-foreground">Estimated Time</div>
              </div>
              <div className="bg-slate-800 rounded-lg p-3">
                <div className="text-2xl font-bold text-blue-400">10</div>
                <div className="text-xs text-muted-foreground">Maps to Generate</div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSequenceDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={generateFullSequence}
              disabled={sequenceGenerating}
              className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
            >
              {sequenceGenerating ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Wand2 className="h-4 w-4 mr-2" />
                  Start Generation
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
