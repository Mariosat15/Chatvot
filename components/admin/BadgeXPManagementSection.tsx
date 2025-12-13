'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { 
  Trophy, Award, Star, Zap, Search, RefreshCw, 
  TrendingUp, Users, Target, Crown, Medal,
  Eye, ChevronRight, Settings, Plus, Edit, Trash2,
  Save, X, Shield
} from 'lucide-react';
import { toast } from 'sonner';

interface UserLevelData {
  userId: string;
  name: string;
  email: string;
  image: string | null;
  currentXP: number;
  currentLevel: number;
  currentTitle: string;
  totalBadgesEarned: number;
  lastXPGain: Date;
}

interface BadgeDetails {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
}

interface UserBadgeData {
  userId: string;
  badgeId: string;
  earnedAt: Date;
  progress: number;
  badgeDetails?: BadgeDetails;
}

interface Stats {
  totalUsers: number;
  totalXPAwarded: number;
  totalBadgesAwarded: number;
  averageLevel: number;
}


export default function BadgeXPManagementSection() {
  // Fetch badges and XP config from database
  const [badgesFromDB, setBadgesFromDB] = useState<any[]>([]);
  const [TITLE_LEVELS, setTitleLevels] = useState<any[]>([
    { level: 1, title: 'Novice Trader', minXP: 0, icon: '🌱', color: 'text-gray-400' },
    { level: 2, title: 'Apprentice Trader', minXP: 100, icon: '📚', color: 'text-green-400' },
    { level: 3, title: 'Skilled Trader', minXP: 300, icon: '⚔️', color: 'text-blue-400' },
    { level: 4, title: 'Expert Trader', minXP: 600, icon: '🎯', color: 'text-cyan-400' },
    { level: 5, title: 'Elite Trader', minXP: 1000, icon: '💎', color: 'text-purple-400' },
    { level: 6, title: 'Master Trader', minXP: 1600, icon: '👑', color: 'text-pink-400' },
    { level: 7, title: 'Grand Master', minXP: 2400, icon: '🔥', color: 'text-orange-400' },
    { level: 8, title: 'Trading Champion', minXP: 3400, icon: '⚡', color: 'text-red-400' },
    { level: 9, title: 'Market Legend', minXP: 4600, icon: '🌟', color: 'text-yellow-400' },
    { level: 10, title: 'Trading God', minXP: 6000, icon: '👑', color: 'text-yellow-300' },
  ]);
  const [BADGE_XP_VALUES, setBadgeXPValues] = useState<any>({
    common: 10,
    rare: 25,
    epic: 50,
    legendary: 100,
  });

  // Fetch data from database on mount
  useEffect(() => {
    const fetchAllData = async () => {
      try {
        // Fetch badges
        const badgesRes = await fetch('/api/admin/badges');
        const badgesData = await badgesRes.json();
        if (badgesData.success) {
          setBadgesFromDB(badgesData.badges);
          console.log('✅ Loaded badges from database:', badgesData.badges.length);
        }

        // Fetch XP config
        const xpRes = await fetch('/api/admin/badges-xp/manage');
        const xpData = await xpRes.json();
        if (xpData.success) {
          if (xpData.badgeXP) {
            setBadgeXPValues(xpData.badgeXP);
            setXpValues(xpData.badgeXP);
            console.log('✅ Loaded Badge XP values from database:', xpData.badgeXP);
          }
          if (xpData.levels) {
            setTitleLevels(xpData.levels);
            setLevels(xpData.levels);
            console.log('✅ Loaded Level Progression from database:', xpData.levels.length, 'levels');
          }
        }
      } catch (error) {
        console.error('Error fetching badge/XP data:', error);
        toast.error('Failed to load badge/XP configuration from database');
      }
    };

    fetchAllData();
  }, []);

  // Use badges from DB, fallback to empty array
  const BADGES = badgesFromDB.length > 0 ? badgesFromDB : [];

  const [users, setUsers] = useState<UserLevelData[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState(false);
  const [selectedUser, setSelectedUser] = useState<{
    user: { id: string; name: string; email: string; image: string | null };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    level: any;
    badges: UserBadgeData[];
  } | null>(null);
  const [editingBadgeXP, setEditingBadgeXP] = useState(false);
  const [editingLevel, setEditingLevel] = useState(false);
  const [xpValues, setXpValues] = useState(BADGE_XP_VALUES);
  const [levels, setLevels] = useState<any[]>(TITLE_LEVELS);
  const [managingBadges, setManagingBadges] = useState(false);
  const [editingBadge, setEditingBadge] = useState<any>(null);
  const [badgeSearchTerm, setBadgeSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [badgeForm, setBadgeForm] = useState({
    id: '',
    name: '',
    description: '',
    category: '',
    rarity: '',
    icon: ''
  });
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/badges-xp');
      const data = await response.json();

      if (data.success) {
        setUsers(data.users || []);
        setStats(data.stats);
      } else {
        toast.error('Failed to load badge/XP data');
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Error loading data');
    } finally {
      setLoading(false);
    }
  };

  const triggerBadgeEvaluation = async (userId?: string) => {
    try {
      setTriggering(true);
      const response = await fetch('/api/admin/trigger-badge-evaluation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });

      const data = await response.json();

      if (data.success) {
        toast.success(data.message || 'Badge evaluation completed');
        await fetchData();
      } else {
        toast.error(data.error || 'Failed to trigger evaluation');
      }
    } catch (error) {
      console.error('Error triggering evaluation:', error);
      toast.error('Error triggering evaluation');
    } finally {
      setTriggering(false);
    }
  };

  const viewUserBadges = async (userId: string) => {
    try {
      const response = await fetch(`/api/admin/badges-xp?userId=${userId}`);
      const data = await response.json();

      if (data.success) {
        setSelectedUser({
          user: data.user,
          level: data.level,
          badges: data.badges,
        });
      } else {
        toast.error('Failed to load user badges');
      }
    } catch (error) {
      console.error('Error loading user badges:', error);
      toast.error('Error loading user badges');
    }
  };

  const filteredUsers = users.filter(
    (user) =>
      user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getRarityColor = (rarity: string) => {
    switch (rarity) {
      case 'legendary':
        return 'bg-yellow-500/20 text-yellow-300 border-yellow-500';
      case 'epic':
        return 'bg-purple-500/20 text-purple-300 border-purple-500';
      case 'rare':
        return 'bg-blue-500/20 text-blue-300 border-blue-500';
      default:
        return 'bg-gray-500/20 text-gray-300 border-gray-500';
    }
  };

  const calculateProgress = (currentXP: number, level: number) => {
    const currentLevelData = TITLE_LEVELS.find(l => l.level === level);
    const nextLevelData = TITLE_LEVELS.find(l => l.level === level + 1);

    if (!currentLevelData || !nextLevelData) return 100;

    const xpInCurrentLevel = currentXP - currentLevelData.minXP;
    const xpNeeded = nextLevelData.minXP - currentLevelData.minXP;
    return Math.min(100, (xpInCurrentLevel / xpNeeded) * 100);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const saveXPValues = async () => {
    try {
      console.log('Saving XP values:', xpValues);
      
      const response = await fetch('/api/admin/badges-xp/manage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ badgeXP: xpValues }),
      });

      const data = await response.json();
      console.log('Save XP response:', data);
      
      if (data.success) {
        toast.success('XP values saved to database!');
        setEditingBadgeXP(false);
        // Update local state with DB values
        setBadgeXPValues(xpValues);
        
        // Refresh data from database to confirm
        const refreshRes = await fetch('/api/admin/badges-xp/manage');
        const refreshData = await refreshRes.json();
        if (refreshData.success && refreshData.badgeXP) {
          setXpValues(refreshData.badgeXP);
          setBadgeXPValues(refreshData.badgeXP);
          console.log('✅ Refreshed XP values from database:', refreshData.badgeXP);
        }
      } else {
        toast.error(data.error || 'Failed to update XP values');
      }
    } catch (error) {
      console.error('Error saving XP values:', error);
      toast.error('Error saving XP values');
    }
  };

  const saveLevels = async () => {
    try {
      console.log('Saving levels:', levels);
      
      const response = await fetch('/api/admin/badges-xp/manage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ levels: levels }),
      });

      const data = await response.json();
      console.log('Save levels response:', data);
      
      if (data.success) {
        toast.success('Level progression saved to database!');
        setEditingLevel(false);
        // Update local state with DB values
        setTitleLevels(levels);
        
        // Refresh data from database to confirm
        const refreshRes = await fetch('/api/admin/badges-xp/manage');
        const refreshData = await refreshRes.json();
        if (refreshData.success && refreshData.levels) {
          setLevels(refreshData.levels);
          setTitleLevels(refreshData.levels);
          console.log('✅ Refreshed levels from database:', refreshData.levels.length, 'levels');
        }
      } else {
        toast.error(data.error || 'Failed to update levels');
      }
    } catch (error) {
      console.error('Error saving levels:', error);
      toast.error('Error saving levels');
    }
  };

  return (
    <div className="space-y-6 max-w-[1920px] mx-auto">
      {/* Header Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-gradient-to-br from-blue-500/10 to-blue-600/10 border-2 border-blue-500/20 rounded-xl p-6 hover:border-blue-500/40 transition-all">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground font-semibold">Total Users</p>
              <p className="text-4xl font-bold text-blue-400">{stats?.totalUsers || 0}</p>
            </div>
            <Users className="h-12 w-12 text-blue-500" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-yellow-500/10 to-yellow-600/10 border-2 border-yellow-500/20 rounded-xl p-6 hover:border-yellow-500/40 transition-all">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground font-semibold">Total XP Awarded</p>
              <p className="text-4xl font-bold text-yellow-400">{stats?.totalXPAwarded.toLocaleString() || 0}</p>
            </div>
            <Star className="h-12 w-12 text-yellow-500" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-500/10 to-purple-600/10 border-2 border-purple-500/20 rounded-xl p-6 hover:border-purple-500/40 transition-all">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground font-semibold">Total Badges</p>
              <p className="text-4xl font-bold text-purple-400">{stats?.totalBadgesAwarded || 0}</p>
            </div>
            <Trophy className="h-12 w-12 text-purple-500" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-500/10 to-green-600/10 border-2 border-green-500/20 rounded-xl p-6 hover:border-green-500/40 transition-all">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground font-semibold">Average Level</p>
              <p className="text-4xl font-bold text-green-400">{stats?.averageLevel.toFixed(1) || '0.0'}</p>
            </div>
            <TrendingUp className="h-12 w-12 text-green-500" />
          </div>
        </div>
      </div>

      {/* Trigger Evaluation */}
      <div className="bg-card border rounded-lg p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Target className="h-5 w-5" />
              Badge Evaluation System
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              Manually trigger badge evaluation for all users or wait for automatic real-time evaluation
            </p>
          </div>
          <Button
            onClick={() => triggerBadgeEvaluation()}
            disabled={triggering}
            size="lg"
          >
            {triggering ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Evaluating...
              </>
            ) : (
              <>
                <Zap className="h-4 w-4 mr-2" />
                Trigger Evaluation
              </>
            )}
          </Button>
        </div>
      </div>

      {/* XP & Level System Configuration */}
      <div className="bg-card border rounded-lg p-6">
        <h3 className="text-2xl font-bold mb-6 flex items-center gap-3">
          <Settings className="h-6 w-6 text-yellow-500" />
          System Configuration
        </h3>
        
        <Tabs defaultValue="levels" className="w-full">
          <TabsList className="grid w-full grid-cols-3 h-12">
            <TabsTrigger value="levels" className="text-base">
              <Crown className="h-4 w-4 mr-2" />
              Level Progression
            </TabsTrigger>
            <TabsTrigger value="xp" className="text-base">
              <Star className="h-4 w-4 mr-2" />
              XP Values
            </TabsTrigger>
            <TabsTrigger value="badges" className="text-base">
              <Trophy className="h-4 w-4 mr-2" />
              Badge Management
            </TabsTrigger>
          </TabsList>

          <TabsContent value="levels" className="space-y-6 mt-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h4 className="text-lg font-semibold">Level Progression System</h4>
                <p className="text-sm text-muted-foreground">Configure XP thresholds and titles for each level</p>
              </div>
              {editingLevel ? (
                <div className="flex gap-2">
                  <Button onClick={saveLevels} size="sm">
                    <Save className="h-4 w-4 mr-2" />
                    Save Changes
                  </Button>
                  <Button onClick={() => setEditingLevel(false)} variant="outline" size="sm">
                    <X className="h-4 w-4 mr-2" />
                    Cancel
                  </Button>
                </div>
              ) : (
                <Button onClick={() => setEditingLevel(true)} variant="outline" size="sm">
                  <Edit className="h-4 w-4 mr-2" />
                  Edit Levels
                </Button>
              )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
              {levels.map((level) => (
                <div key={level.level} className="bg-background border-2 rounded-xl p-6 hover:border-primary/50 transition-all">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <span className="text-4xl">{level.icon}</span>
                      <div>
                        <p className={`text-xl font-bold ${level.color}`}>
                          Level {level.level}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {level.title}
                        </p>
                      </div>
                    </div>
                    {editingLevel && (
                      <Button variant="ghost" size="icon">
                        <Edit className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  {editingLevel ? (
                    <div className="space-y-2">
                      <label className="text-xs text-muted-foreground">Title</label>
                      <Input
                        placeholder="Title"
                        value={level.title}
                        onChange={(e) => {
                          const newLevels = [...levels];
                          newLevels[level.level - 1].title = e.target.value;
                          setLevels(newLevels);
                        }}
                      />
                      <label className="text-xs text-muted-foreground">Min XP Required</label>
                      <Input
                        type="number"
                        placeholder="Min XP"
                        value={level.minXP}
                        onChange={(e) => {
                          const newLevels = [...levels];
                          const newMinXP = parseInt(e.target.value) || 0;
                          newLevels[level.level - 1].minXP = newMinXP;
                          
                          // Auto-update maxXP for previous level
                          if (level.level > 1) {
                            newLevels[level.level - 2].maxXP = newMinXP - 1;
                          }
                          
                          setLevels(newLevels);
                        }}
                      />
                      <label className="text-xs text-muted-foreground">Icon (Emoji)</label>
                      <Input
                        placeholder="Icon"
                        value={level.icon}
                        onChange={(e) => {
                          const newLevels = [...levels];
                          newLevels[level.level - 1].icon = e.target.value;
                          setLevels(newLevels);
                        }}
                      />
                      <label className="text-xs text-muted-foreground">Description</label>
                      <Input
                        placeholder="Description"
                        value={level.description || ''}
                        onChange={(e) => {
                          const newLevels = [...levels];
                          newLevels[level.level - 1].description = e.target.value;
                          console.log('Updated description for level', level.level, ':', e.target.value);
                          setLevels(newLevels);
                        }}
                      />
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Min XP Required</span>
                        <Badge variant="outline" className="text-base font-bold">{level.minXP} XP</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">Level {level.level}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="xp" className="space-y-6 mt-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h4 className="text-lg font-semibold">XP Reward Values</h4>
                <p className="text-sm text-muted-foreground">Configure how much XP each badge rarity awards</p>
              </div>
              {editingBadgeXP ? (
                <div className="flex gap-2">
                  <Button onClick={saveXPValues} size="sm">
                    <Save className="h-4 w-4 mr-2" />
                    Save Changes
                  </Button>
                  <Button onClick={() => setEditingBadgeXP(false)} variant="outline" size="sm">
                    <X className="h-4 w-4 mr-2" />
                    Cancel
                  </Button>
                </div>
              ) : (
                <Button onClick={() => setEditingBadgeXP(true)} variant="outline" size="sm">
                  <Edit className="h-4 w-4 mr-2" />
                  Edit XP Values
                </Button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-gradient-to-br from-gray-500/10 to-gray-600/10 border-2 border-gray-500/20 rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <Medal className="h-10 w-10 text-gray-400" />
                    <div>
                      <p className="text-sm font-semibold text-gray-400">Common Badge</p>
                      <p className="text-xs text-muted-foreground">Most frequent</p>
                    </div>
                  </div>
                </div>
                {editingBadgeXP ? (
                  <Input
                    type="number"
                    value={xpValues.common}
                    onChange={(e) => setXpValues({ ...xpValues, common: parseInt(e.target.value) || 0 })}
                    className="text-2xl font-bold"
                  />
                ) : (
                  <p className="text-4xl font-bold text-gray-400">{xpValues.common} XP</p>
                )}
              </div>

              <div className="bg-gradient-to-br from-blue-500/10 to-blue-600/10 border-2 border-blue-500/20 rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <Medal className="h-10 w-10 text-blue-400" />
                    <div>
                      <p className="text-sm font-semibold text-blue-400">Rare Badge</p>
                      <p className="text-xs text-muted-foreground">Uncommon</p>
                    </div>
                  </div>
                </div>
                {editingBadgeXP ? (
                  <Input
                    type="number"
                    value={xpValues.rare}
                    onChange={(e) => setXpValues({ ...xpValues, rare: parseInt(e.target.value) || 0 })}
                    className="text-2xl font-bold"
                  />
                ) : (
                  <p className="text-4xl font-bold text-blue-400">{xpValues.rare} XP</p>
                )}
              </div>

              <div className="bg-gradient-to-br from-purple-500/10 to-purple-600/10 border-2 border-purple-500/20 rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <Medal className="h-10 w-10 text-purple-400" />
                    <div>
                      <p className="text-sm font-semibold text-purple-400">Epic Badge</p>
                      <p className="text-xs text-muted-foreground">Rare achievement</p>
                    </div>
                  </div>
                </div>
                {editingBadgeXP ? (
                  <Input
                    type="number"
                    value={xpValues.epic}
                    onChange={(e) => setXpValues({ ...xpValues, epic: parseInt(e.target.value) || 0 })}
                    className="text-2xl font-bold"
                  />
                ) : (
                  <p className="text-4xl font-bold text-purple-400">{xpValues.epic} XP</p>
                )}
              </div>

              <div className="bg-gradient-to-br from-yellow-500/10 to-yellow-600/10 border-2 border-yellow-500/20 rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <Medal className="h-10 w-10 text-yellow-400" />
                    <div>
                      <p className="text-sm font-semibold text-yellow-400">Legendary Badge</p>
                      <p className="text-xs text-muted-foreground">Ultimate</p>
                    </div>
                  </div>
                </div>
                {editingBadgeXP ? (
                  <Input
                    type="number"
                    value={xpValues.legendary}
                    onChange={(e) => setXpValues({ ...xpValues, legendary: parseInt(e.target.value) || 0 })}
                    className="text-2xl font-bold"
                  />
                ) : (
                  <p className="text-4xl font-bold text-yellow-400">{xpValues.legendary} XP</p>
                )}
              </div>
            </div>

            <div className="bg-muted/50 rounded-xl p-6">
              <h4 className="font-semibold text-lg mb-4">How XP System Works:</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <Star className="h-4 w-4 mt-0.5 text-yellow-500" />
                    Users earn XP automatically when they earn badges
                  </li>
                  <li className="flex items-start gap-2">
                    <Zap className="h-4 w-4 mt-0.5 text-yellow-500" />
                    XP is awarded in real-time after each achievement
                  </li>
                  <li className="flex items-start gap-2">
                    <Trophy className="h-4 w-4 mt-0.5 text-yellow-500" />
                    Each badge rarity awards different XP amounts
                  </li>
                </ul>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <Award className="h-4 w-4 mt-0.5 text-yellow-500" />
                    Higher rarity badges provide more XP rewards
                  </li>
                  <li className="flex items-start gap-2">
                    <Crown className="h-4 w-4 mt-0.5 text-yellow-500" />
                    Levels unlock as users accumulate XP
                  </li>
                  <li className="flex items-start gap-2">
                    <Target className="h-4 w-4 mt-0.5 text-yellow-500" />
                    Level 10 (Trading God) is the maximum level
                  </li>
                </ul>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="badges" className="space-y-6 mt-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h4 className="text-lg font-semibold">Badge Library (120 Total)</h4>
                <p className="text-sm text-muted-foreground">Manage all badges: add, edit, delete, and change icons</p>
              </div>
              <div className="flex gap-2">
                <Button onClick={() => setManagingBadges(true)} variant="default" size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Add New Badge
                </Button>
                <Badge variant="secondary" className="text-base px-4 py-2">
                  <Trophy className="h-4 w-4 mr-2" />
                  120 Badges
                </Badge>
              </div>
            </div>

            {/* Badge Filter & Search */}
            <div className="flex gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search badges by name, description, or ID..."
                  value={badgeSearchTerm}
                  onChange={(e) => setBadgeSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Filter by category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  <SelectItem value="Competition">Competition</SelectItem>
                  <SelectItem value="Volume">Volume</SelectItem>
                  <SelectItem value="Profit">Profit</SelectItem>
                  <SelectItem value="Risk">Risk</SelectItem>
                  <SelectItem value="Speed">Speed</SelectItem>
                  <SelectItem value="Consistency">Consistency</SelectItem>
                  <SelectItem value="Strategy">Strategy</SelectItem>
                  <SelectItem value="Social">Social</SelectItem>
                  <SelectItem value="Legendary">Legendary</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Badge Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {BADGES
                .filter(badge => 
                  (selectedCategory === 'all' || badge.category === selectedCategory) &&
                  (badgeSearchTerm === '' || 
                    badge.name.toLowerCase().includes(badgeSearchTerm.toLowerCase()) ||
                    badge.description.toLowerCase().includes(badgeSearchTerm.toLowerCase()) ||
                    badge.id.toLowerCase().includes(badgeSearchTerm.toLowerCase())
                  )
                )
                .map((badge) => (
                  <div
                    key={badge.id}
                    className={`border-2 rounded-xl p-6 hover:scale-105 transition-transform cursor-pointer ${getRarityColor(badge.rarity)}`}
                    onClick={() => {
                      setEditingBadge(badge);
                      setBadgeForm({
                        id: badge.id,
                        name: badge.name,
                        description: badge.description,
                        category: badge.category,
                        rarity: badge.rarity,
                        icon: badge.icon
                      });
                    }}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <span className="text-5xl">{badge.icon}</span>
                      <div className="flex flex-col gap-2 items-end">
                        <Badge variant="outline" className="text-sm font-semibold capitalize">
                          {badge.rarity}
                        </Badge>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { 
                          e.stopPropagation(); 
                          setEditingBadge(badge);
                          setBadgeForm({
                            id: badge.id,
                            name: badge.name,
                            description: badge.description,
                            category: badge.category,
                            rarity: badge.rarity,
                            icon: badge.icon
                          });
                        }}>
                          <Edit className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <p className="font-bold text-lg mb-2">{badge.name}</p>
                    <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                      {badge.description}
                    </p>
                    <div className="flex items-center justify-between mb-3 pt-3 border-t border-border">
                      <span className="text-sm text-muted-foreground font-semibold">{badge.category}</span>
                      <Badge variant="secondary" className="font-bold">
                        <Star className="h-3 w-3 mr-1" />
                        +{BADGE_XP_VALUES[badge.rarity]} XP
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <code className="bg-muted px-2 py-1 rounded">{badge.id}</code>
                    </div>
                  </div>
                ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Users Table */}
      <div className="bg-card border rounded-xl p-8">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-2xl font-bold flex items-center gap-3">
            <Users className="h-6 w-6 text-blue-500" />
            User Badges & XP Leaderboard
          </h3>

          <div className="flex items-center gap-3">
            <div className="relative w-96">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                placeholder="Search by name or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-12 h-12 text-base"
              />
            </div>
          </div>
        </div>

        <div className="overflow-auto max-h-[800px]">
          <Table>
            <TableHeader>
              <TableRow className="text-base">
                <TableHead className="text-base font-bold w-16">#</TableHead>
                <TableHead className="text-base font-bold min-w-[250px]">User</TableHead>
                <TableHead className="text-base font-bold min-w-[200px]">Level & Title</TableHead>
                <TableHead className="text-base font-bold">XP</TableHead>
                <TableHead className="text-base font-bold min-w-[180px]">Progress</TableHead>
                <TableHead className="text-base font-bold">Badges</TableHead>
                <TableHead className="text-base font-bold">Last XP Gain</TableHead>
                <TableHead className="text-base font-bold">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.map((user, index) => {
                const levelData = TITLE_LEVELS.find(l => l.level === user.currentLevel) || TITLE_LEVELS[0];
                const progress = calculateProgress(user.currentXP, user.currentLevel);

                return (
                  <TableRow key={user.userId} className="h-20">
                    <TableCell className="font-bold text-lg text-muted-foreground">
                      #{index + 1}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        {user.image ? (
                          <img src={user.image} alt={user.name} className="h-12 w-12 rounded-full" />
                        ) : (
                          <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                            <Users className="h-6 w-6 text-primary" />
                          </div>
                        )}
                        <div>
                          <p className="font-semibold text-base">{user.name || user.email?.split('@')[0] || `User ${user.userId.slice(-4)}`}</p>
                          <p className="text-sm text-muted-foreground">{user.email || 'No email'}</p>
                          <p className="text-xs text-muted-foreground font-mono">ID: {user.userId}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <span className="text-3xl">{levelData.icon}</span>
                        <div>
                          <p className={`font-bold text-lg ${levelData.color}`}>
                            Level {user.currentLevel}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {user.currentTitle}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-base px-3 py-2 font-bold">
                        <Star className="h-4 w-4 mr-2 text-yellow-500" />
                        {user.currentXP.toLocaleString()}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="w-40">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs text-muted-foreground">
                            {progress.toFixed(0)}%
                          </span>
                          <span className="text-xs text-muted-foreground">
                            Next: {TITLE_LEVELS[user.currentLevel]?.minXP || 'MAX'}
                          </span>
                        </div>
                        <Progress value={progress} className="h-3" />
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-base px-3 py-2 font-bold">
                        <Trophy className="h-4 w-4 mr-2 text-purple-500" />
                        {user.totalBadgesEarned}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-base text-muted-foreground">
                      {new Date(user.lastXPGain).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          size="default"
                          variant="outline"
                          onClick={() => viewUserBadges(user.userId)}
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          View
                        </Button>
                        <Button
                          size="default"
                          variant="outline"
                          onClick={() => triggerBadgeEvaluation(user.userId)}
                          disabled={triggering}
                        >
                          <RefreshCw className={`h-4 w-4 ${triggering ? 'animate-spin' : ''}`} />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Badge Edit/Create Dialog - Full Screen */}
      <Dialog open={(!!editingBadge || managingBadges) && !isClosing} onOpenChange={(open) => { 
        if (!open && !isClosing) {
          setIsClosing(true);
          setTimeout(() => {
            setEditingBadge(null); 
            setManagingBadges(false);
            setBadgeForm({ id: '', name: '', description: '', category: '', rarity: '', icon: '' });
            setIsClosing(false);
          }, 300);
        }
      }}>
        <DialogContent showCloseButton={false} className="max-w-none w-screen h-screen p-0 m-0 rounded-none border-0 left-0 top-0 translate-x-0 translate-y-0 sm:max-w-none sm:rounded-none data-[state=open]:slide-in-from-left-0 data-[state=open]:slide-in-from-top-0">
          <div className="h-full w-full overflow-y-auto bg-background">
            <DialogHeader className="px-8 py-6 border-b bg-background">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  {editingBadge ? <Edit className="h-10 w-10 text-primary" /> : <Plus className="h-10 w-10 text-primary" />}
                  <div>
                    <DialogTitle className="text-4xl font-bold">
                      {editingBadge ? 'Edit Badge' : 'Create New Badge'}
                    </DialogTitle>
                    <DialogDescription className="text-xl mt-1">
                      {editingBadge ? `Editing ${editingBadge.name}` : 'Add a new badge to the system'}
                    </DialogDescription>
                  </div>
                </div>
                <Button variant="ghost" size="icon" className="h-14 w-14" onClick={() => { 
                  setIsClosing(true);
                  setTimeout(() => {
                    setEditingBadge(null); 
                    setManagingBadges(false);
                    setBadgeForm({ id: '', name: '', description: '', category: '', rarity: '', icon: '' });
                    setIsClosing(false);
                  }, 300);
                }}>
                  <X className="h-7 w-7" />
                </Button>
              </div>
            </DialogHeader>

            <div className="space-y-8 px-8 py-6">
              {/* Badge Preview - Live Preview */}
              <div className="bg-muted rounded-xl p-6 flex items-center gap-4">
                <span className="text-6xl">{badgeForm.icon || '🏆'}</span>
                <div className="flex-1">
                  <p className="text-2xl font-bold">{badgeForm.name || 'New Badge'}</p>
                  <p className="text-muted-foreground">{badgeForm.description || 'Badge description'}</p>
                </div>
                <Badge variant="outline" className="text-lg px-4 py-2 capitalize">
                  {badgeForm.rarity || 'common'}
                </Badge>
              </div>

              {/* Badge Form */}
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-3">
                  <Label className="text-xl font-semibold">Badge ID {!editingBadge && '(Optional - Auto-generated)'}</Label>
                  <Input
                    value={badgeForm.id}
                    onChange={(e) => setBadgeForm({...badgeForm, id: e.target.value})}
                    placeholder={editingBadge ? badgeForm.id : "Leave empty for auto-generation"}
                    disabled={!!editingBadge}
                    className="text-lg h-12"
                  />
                  <p className="text-base text-muted-foreground">{editingBadge ? 'Cannot be changed after creation' : 'Auto-generated from name if empty'}</p>
                </div>

                <div className="space-y-3">
                  <Label className="text-xl font-semibold">Badge Name *</Label>
                  <Input
                    value={badgeForm.name}
                    onChange={(e) => setBadgeForm({...badgeForm, name: e.target.value})}
                    placeholder="Amazing Achievement"
                    className="text-lg h-12"
                  />
                </div>

                <div className="space-y-3 col-span-2">
                  <Label className="text-xl font-semibold">Description *</Label>
                  <Textarea
                    value={badgeForm.description}
                    onChange={(e) => setBadgeForm({...badgeForm, description: e.target.value})}
                    placeholder="Earned by achieving something amazing..."
                    rows={4}
                    className="text-lg"
                  />
                </div>

                <div className="space-y-3">
                  <Label className="text-xl font-semibold">Category *</Label>
                  <Select value={badgeForm.category || 'Competition'} onValueChange={(value) => setBadgeForm({...badgeForm, category: value})}>
                    <SelectTrigger className="text-lg h-12">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Competition">Competition</SelectItem>
                      <SelectItem value="Volume">Volume</SelectItem>
                      <SelectItem value="Profit">Profit</SelectItem>
                      <SelectItem value="Risk">Risk</SelectItem>
                      <SelectItem value="Speed">Speed</SelectItem>
                      <SelectItem value="Consistency">Consistency</SelectItem>
                      <SelectItem value="Strategy">Strategy</SelectItem>
                      <SelectItem value="Social">Social</SelectItem>
                      <SelectItem value="Legendary">Legendary</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-3">
                  <Label className="text-xl font-semibold">Rarity *</Label>
                  <Select value={badgeForm.rarity || 'common'} onValueChange={(value) => setBadgeForm({...badgeForm, rarity: value})}>
                    <SelectTrigger className="text-lg h-12">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="common">Common (10 XP)</SelectItem>
                      <SelectItem value="rare">Rare (25 XP)</SelectItem>
                      <SelectItem value="epic">Epic (50 XP)</SelectItem>
                      <SelectItem value="legendary">Legendary (100 XP)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Icon Picker */}
                <div className="space-y-3 col-span-2">
                  <Label className="text-xl font-semibold">Badge Icon *</Label>
                  <p className="text-base text-muted-foreground mb-3">Click an emoji to select it</p>
                  <div className="grid grid-cols-12 gap-2 bg-muted/50 rounded-lg p-4 max-h-[400px] overflow-y-auto">
                    {[
                      '🏆', '🥇', '🥈', '🥉', '🎯', '🎪', '🎭', '🎬', '🏛️', '👑', '⚡', '🌟',
                      '🎖️', '🔄', '🚀', '⚔️', '🐕', '🧹', '🏃', '🐦', '🦉', '💚', '🟢', '💵',
                      '💰', '💎', '🎰', '🏅', '🔥', '🌡️', '📈', '💹', '✨', '⭐', '🛡️', '🦾',
                      '📉', '🔒', '📏', '🐢', '⚖️', '🔪', '🧘', '🧮', '🌈', '🎨', '🎲', '🎓',
                      '🥁', '🎸', '🎮', '🏁', '🚦', '💡', '💫', '🌙', '☀️', '🎉', '🎊', '🎁',
                      '🎈', '💝', '💖', '💗', '💓', '💞', '💕', '💟', '❤️', '🧡', '💛', '💙',
                      '💜', '🤎', '🖤', '🤍', '👍', '👏', '🙌', '✊', '💪', '🤝', '🙏', '✌️'
                    ].map((icon, idx) => (
                      <button
                        key={`${icon}-${idx}`}
                        type="button"
                      className={`text-4xl p-3 rounded hover:bg-background transition-colors ${
                        badgeForm.icon === icon ? 'bg-primary/20 ring-2 ring-primary' : ''
                      }`}
                      onClick={() => {
                        setBadgeForm({...badgeForm, icon});
                      }}
                      >
                        {icon}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="px-8 py-6 border-t flex gap-3 bg-background">
              {editingBadge && (
                <Button
                  variant="destructive"
                  size="lg"
                  onClick={() => {
                    toast.success('Badge deleted. Changes will apply after server restart.');
                    setEditingBadge(null);
                  }}
                >
                  <Trash2 className="h-5 w-5 mr-2" />
                  Delete Badge
                </Button>
              )}
              <Button variant="outline" size="lg" onClick={() => { setEditingBadge(null); setManagingBadges(false); }}>
                <X className="h-5 w-5 mr-2" />
                Cancel
              </Button>
              <Button size="lg" onClick={async () => {
                try {
                  // Auto-generate ID from name if not provided for new badges
                  let badgeId = badgeForm.id;
                  if (!editingBadge && !badgeId && badgeForm.name) {
                    badgeId = badgeForm.name
                      .toLowerCase()
                      .replace(/[^a-z0-9]+/g, '_')
                      .replace(/^_+|_+$/g, '');
                  }

                  const formData = {
                    id: badgeId,
                    name: badgeForm.name,
                    description: badgeForm.description,
                    category: badgeForm.category || 'Competition',
                    rarity: badgeForm.rarity || 'common',
                    icon: badgeForm.icon || '🏆',
                  };

                  console.log('Saving badge:', editingBadge ? 'UPDATE' : 'CREATE', formData);

                  const method = editingBadge ? 'PUT' : 'POST';
                  const response = await fetch('/api/admin/badges', {
                    method,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(formData),
                  });

                  if (response.ok) {
                    toast.success(editingBadge ? 'Badge updated successfully!' : 'Badge created successfully!');
                    
                    // Refresh badges from database
                    const refreshRes = await fetch('/api/admin/badges');
                    const refreshData = await refreshRes.json();
                    if (refreshData.success) {
                      setBadgesFromDB(refreshData.badges);
                      console.log('✅ Refreshed badges from database:', refreshData.badges.length);
                    }
                    
                    setIsClosing(true);
                    setTimeout(() => {
                      setEditingBadge(null);
                      setManagingBadges(false);
                      setBadgeForm({ id: '', name: '', description: '', category: '', rarity: '', icon: '' });
                      setIsClosing(false);
                    }, 300);
                  } else {
                    const error = await response.json();
                    toast.error(error.error || 'Failed to save badge');
                  }
                } catch (error) {
                  console.error('Error saving badge:', error);
                  toast.error('Failed to save badge');
                }
              }}>
                <Save className="h-5 w-5 mr-2" />
                {editingBadge ? 'Save Changes' : 'Create Badge'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* User Badges Dialog - Full Screen */}
      <Dialog open={!!selectedUser} onOpenChange={() => setSelectedUser(null)}>
        <DialogContent showCloseButton={false} className="max-w-none w-screen h-screen p-0 m-0 rounded-none border-0 left-0 top-0 translate-x-0 translate-y-0 sm:max-w-none sm:rounded-none data-[state=open]:slide-in-from-left-0 data-[state=open]:slide-in-from-top-0">
          <div className="h-full w-full overflow-y-auto bg-background">
            <DialogHeader className="px-8 py-6 border-b bg-background">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <Trophy className="h-10 w-10 text-yellow-500" />
                  <div>
                    <DialogTitle className="text-4xl font-bold">
                      {(() => {
                        const user = selectedUser?.user;
                        if (user?.name && user.name !== 'Unknown') return `${user.name}'s Profile`;
                        if (user?.email) return `${user.email.split('@')[0]}'s Profile`;
                        return `User Profile`;
                      })()}
                    </DialogTitle>
                    <DialogDescription className="text-xl mt-1">
                      {(() => {
                        const user = selectedUser?.user;
                        const parts = [];
                        if (user?.email) parts.push(user.email);
                        if (user?.id) parts.push(`ID: ${user.id}`);
                        return parts.join(' • ') || 'No user data';
                      })()}
                    </DialogDescription>
                  </div>
                </div>
                <Button variant="ghost" size="icon" className="h-14 w-14" onClick={() => setSelectedUser(null)}>
                  <X className="h-7 w-7" />
                </Button>
              </div>
            </DialogHeader>

            {selectedUser && (
              <div className="space-y-8 px-8 py-6">
              {/* User Level Info */}
              <div className="bg-gradient-to-r from-primary/10 to-purple-500/10 rounded-xl p-12 border-2 border-primary/20">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-6">
                    {selectedUser.user.image ? (
                      <img src={selectedUser.user.image} alt={selectedUser.user.name} className="h-24 w-24 rounded-full border-4 border-primary" />
                    ) : (
                      <div className="h-24 w-24 rounded-full bg-primary/20 flex items-center justify-center border-4 border-primary">
                        <Users className="h-12 w-12 text-primary" />
                      </div>
                    )}
                    <div>
                      <div className="flex items-center gap-4 mb-2">
                        <span className="text-6xl">
                          {TITLE_LEVELS.find(l => l.level === selectedUser.level.currentLevel)?.icon}
                        </span>
                        <div>
                          <p className="text-4xl font-bold">{selectedUser.level.currentTitle}</p>
                          <p className="text-xl text-muted-foreground">Level {selectedUser.level.currentLevel}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-5xl font-bold text-primary mb-2">{selectedUser.level.currentXP.toLocaleString()}</p>
                    <p className="text-lg text-muted-foreground">Total XP Earned</p>
                    <Badge variant="outline" className="mt-2 text-base px-3 py-1">
                      <Trophy className="h-4 w-4 mr-2" />
                      {selectedUser.badges.length} Badges
                    </Badge>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between text-base">
                    <span className="font-semibold">Progress to next level</span>
                    <span className="font-bold">{calculateProgress(selectedUser.level.currentXP, selectedUser.level.currentLevel).toFixed(0)}%</span>
                  </div>
                  <Progress 
                    value={calculateProgress(selectedUser.level.currentXP, selectedUser.level.currentLevel)} 
                    className="h-4"
                  />
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>Current: {selectedUser.level.currentXP.toLocaleString()} XP</span>
                    <span>Next: {TITLE_LEVELS[selectedUser.level.currentLevel]?.minXP.toLocaleString() || 'MAX'} XP</span>
                  </div>
                </div>
              </div>

              {/* Badge Statistics */}
              <div className="grid grid-cols-4 gap-6">
                {Object.entries(
                  selectedUser.badges.reduce((acc, badge) => {
                    const rarity = badge.badgeDetails?.rarity || 'common';
                    acc[rarity] = (acc[rarity] || 0) + 1;
                    return acc;
                  }, {} as Record<string, number>)
                ).map(([rarity, count]) => (
                  <div key={rarity} className={`border-2 rounded-xl p-6 ${getRarityColor(rarity)}`}>
                    <div className="text-center">
                      <Medal className="h-10 w-10 mx-auto mb-3" />
                      <p className="text-sm font-semibold mb-1 capitalize">{rarity} Badges</p>
                      <p className="text-3xl font-bold">{count}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Badges Grid */}
              <div>
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-2xl font-bold flex items-center gap-2">
                    <Award className="h-6 w-6 text-yellow-500" />
                    Earned Badges ({selectedUser.badges.length})
                  </h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {selectedUser.badges.map((badge) => (
                    <div
                      key={badge.badgeId}
                      className={`border-2 rounded-xl p-6 hover:scale-105 transition-transform ${getRarityColor(badge.badgeDetails?.rarity || 'common')}`}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <span className="text-5xl">{badge.badgeDetails?.icon}</span>
                        <Badge variant="outline" className="text-sm font-semibold capitalize">
                          {badge.badgeDetails?.rarity}
                        </Badge>
                      </div>
                      <p className="font-bold text-lg mb-2">{badge.badgeDetails?.name}</p>
                      <p className="text-sm text-muted-foreground mb-4">
                        {badge.badgeDetails?.description}
                      </p>
                      <div className="flex items-center justify-between mb-3 pt-3 border-t border-border">
                        <span className="text-sm text-muted-foreground font-semibold">{badge.badgeDetails?.category}</span>
                        <Badge variant="secondary" className="font-bold">
                          <Star className="h-3 w-3 mr-1" />
                          +{BADGE_XP_VALUES[badge.badgeDetails?.rarity || 'common']} XP
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Award className="h-3 w-3" />
                        <span>Earned: {new Date(badge.earnedAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

