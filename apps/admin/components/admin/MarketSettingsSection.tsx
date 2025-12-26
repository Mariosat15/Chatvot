'use client';

import { useState, useEffect } from 'react';
import {
  Clock,
  Calendar,
  Save,
  Plus,
  Trash2,
  Settings,
  Zap,
  AlertTriangle,
  CheckCircle,
  TrendingUp,
  Loader2,
  Info,
  ChevronDown,
  ChevronRight,
  Shield,
  Ban,
  Activity,
  Globe,
  Sun,
  Moon,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';

interface DaySchedule {
  enabled: boolean;
  openTime: string;
  closeTime: string;
}

interface AssetClassSchedule {
  enabled: boolean;
  monday: DaySchedule;
  tuesday: DaySchedule;
  wednesday: DaySchedule;
  thursday: DaySchedule;
  friday: DaySchedule;
  saturday: DaySchedule;
  sunday: DaySchedule;
}

interface MarketHoliday {
  _id?: string;
  name: string;
  date: string;
  affectedAssets: string[];
  isRecurring: boolean;
  createdAt?: string;
}

interface MarketSettings {
  mode: 'automatic' | 'manual';
  automaticSettings: {
    useMassiveAPI: boolean;
    cacheMinutes: number;
    fallbackToManual: boolean;
  };
  assetSchedules: {
    forex: AssetClassSchedule;
    crypto: AssetClassSchedule;
    stocks: AssetClassSchedule;
    indices: AssetClassSchedule;
    commodities: AssetClassSchedule;
  };
  holidays: MarketHoliday[];
  blockTradingOnHolidays: boolean;
  blockCompetitionsOnHolidays: boolean;
  blockChallengesOnHolidays: boolean;
  showHolidayWarning: boolean;
}

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;
const DAY_LABELS: Record<string, string> = {
  monday: 'Mon',
  tuesday: 'Tue',
  wednesday: 'Wed',
  thursday: 'Thu',
  friday: 'Fri',
  saturday: 'Sat',
  sunday: 'Sun',
};

const ASSET_CLASSES = [
  { id: 'forex', label: 'Forex', icon: '💱', color: 'from-emerald-500 to-teal-600', bgColor: 'bg-emerald-500/10', borderColor: 'border-emerald-500/30' },
  { id: 'crypto', label: 'Crypto', icon: '₿', color: 'from-orange-500 to-amber-600', bgColor: 'bg-orange-500/10', borderColor: 'border-orange-500/30' },
  { id: 'stocks', label: 'Stocks', icon: '📈', color: 'from-blue-500 to-indigo-600', bgColor: 'bg-blue-500/10', borderColor: 'border-blue-500/30' },
  { id: 'indices', label: 'Indices', icon: '📊', color: 'from-purple-500 to-violet-600', bgColor: 'bg-purple-500/10', borderColor: 'border-purple-500/30' },
  { id: 'commodities', label: 'Commodities', icon: '🛢️', color: 'from-yellow-500 to-orange-600', bgColor: 'bg-yellow-500/10', borderColor: 'border-yellow-500/30' },
];

const DEFAULT_DAY_SCHEDULE: DaySchedule = {
  enabled: true,
  openTime: '00:00',
  closeTime: '23:59',
};

interface AutomaticHoliday {
  id: string;
  name: string;
  date: string;
  exchange: string;
  status: string;
  daysUntil: number;
}

export default function MarketSettingsSection() {
  const [settings, setSettings] = useState<MarketSettings | null>(null);
  const [originalSettings, setOriginalSettings] = useState<MarketSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [addHolidayOpen, setAddHolidayOpen] = useState(false);
  const [expandedAssets, setExpandedAssets] = useState<string[]>(['forex']);
  const [activeSection, setActiveSection] = useState<'schedules' | 'holidays' | 'blocking'>('schedules');
  const [automaticHolidays, setAutomaticHolidays] = useState<AutomaticHoliday[]>([]);
  const [loadingAutoHolidays, setLoadingAutoHolidays] = useState(false);
  const [newHoliday, setNewHoliday] = useState<Partial<MarketHoliday>>({
    name: '',
    date: '',
    affectedAssets: ['forex'],
    isRecurring: false,
  });

  useEffect(() => {
    fetchSettings();
    fetchAutomaticHolidays();
  }, []);

  useEffect(() => {
    if (settings && originalSettings) {
      const changed = JSON.stringify(settings) !== JSON.stringify(originalSettings);
      setHasChanges(changed);
    }
  }, [settings, originalSettings]);

  const fetchSettings = async () => {
    try {
      const response = await fetch('/api/market-settings');
      if (response.ok) {
        const data = await response.json();
        setSettings(data);
        setOriginalSettings(JSON.parse(JSON.stringify(data)));
      }
    } catch (error) {
      console.error('Error fetching market settings:', error);
      toast.error('Failed to load market settings');
    } finally {
      setLoading(false);
    }
  };

  const fetchAutomaticHolidays = async () => {
    setLoadingAutoHolidays(true);
    try {
      const response = await fetch('/api/market-settings/automatic-holidays');
      if (response.ok) {
        const data = await response.json();
        setAutomaticHolidays(data.holidays || []);
      }
    } catch (error) {
      console.error('Error fetching automatic holidays:', error);
    } finally {
      setLoadingAutoHolidays(false);
    }
  };

  const handleSaveAll = async () => {
    if (!settings) return;
    
    setSaving(true);
    try {
      const response = await fetch('/api/market-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });

      if (response.ok) {
        const updatedSettings = await response.json();
        setSettings(updatedSettings);
        setOriginalSettings(JSON.parse(JSON.stringify(updatedSettings)));
        setHasChanges(false);
        toast.success('✅ Market settings saved!', {
          description: 'Changes are now active.',
          duration: 3000,
        });
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to save settings');
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleAddHoliday = () => {
    if (!newHoliday.name || !newHoliday.date) {
      toast.error('Please enter holiday name and date');
      return;
    }

    if (!settings) return;

    const holiday: MarketHoliday = {
      _id: `temp_${Date.now()}`,
      name: newHoliday.name,
      date: newHoliday.date,
      affectedAssets: newHoliday.affectedAssets || ['forex'],
      isRecurring: newHoliday.isRecurring || false,
    };

    setSettings({
      ...settings,
      holidays: [...settings.holidays, holiday],
    });

    setNewHoliday({ name: '', date: '', affectedAssets: ['forex'], isRecurring: false });
    setAddHolidayOpen(false);
    toast.info('Holiday added - click Save to apply');
  };

  const handleDeleteHoliday = (holidayId: string) => {
    if (!settings) return;
    setSettings({
      ...settings,
      holidays: settings.holidays.filter(h => h._id !== holidayId),
    });
  };

  const toggleAssetExpanded = (assetId: string) => {
    setExpandedAssets(prev => 
      prev.includes(assetId) 
        ? prev.filter(id => id !== assetId)
        : [...prev, assetId]
    );
  };

  const updateDaySchedule = (
    asset: keyof MarketSettings['assetSchedules'],
    day: typeof DAYS[number],
    field: keyof DaySchedule,
    value: boolean | string
  ) => {
    if (!settings) return;
    
    setSettings({
      ...settings,
      assetSchedules: {
        ...settings.assetSchedules,
        [asset]: {
          ...settings.assetSchedules[asset],
          [day]: {
            ...settings.assetSchedules[asset][day],
            [field]: value,
          },
        },
      },
    });
  };

  const getEnabledDaysCount = (schedule: AssetClassSchedule) => {
    return DAYS.filter(day => schedule[day]?.enabled).length;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-emerald-500 mx-auto mb-4" />
          <p className="text-gray-400">Loading market settings...</p>
        </div>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="text-center py-16 text-gray-400">
        <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-red-400" />
        <p>Failed to load market settings</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-24">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-gray-800/80 via-gray-900/90 to-gray-950 border border-gray-700/50 p-6">
        <div className="absolute inset-0 bg-grid-white/[0.02]" />
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl" />
        
        <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/25">
              <TrendingUp className="h-7 w-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Market Settings</h1>
              <p className="text-gray-400 text-sm">Configure trading hours, holidays & blocking rules</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {hasChanges && (
              <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 animate-pulse px-3 py-1">
                <span className="w-2 h-2 rounded-full bg-amber-400 mr-2 animate-ping" />
                Unsaved Changes
              </Badge>
            )}
            <Button 
              onClick={handleSaveAll} 
              disabled={saving || !hasChanges}
              className={`${
                hasChanges 
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 shadow-lg shadow-emerald-500/25' 
                  : 'bg-gray-700 text-gray-400'
              } font-semibold px-6`}
            >
              {saving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save Settings
            </Button>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="relative grid grid-cols-2 md:grid-cols-4 gap-3 mt-6">
          <div className="bg-gray-800/50 backdrop-blur rounded-xl p-3 border border-gray-700/50">
            <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
              <Settings className="h-3.5 w-3.5" />
              Mode
            </div>
            <p className="text-white font-semibold capitalize">{settings.mode}</p>
          </div>
          <div className="bg-gray-800/50 backdrop-blur rounded-xl p-3 border border-gray-700/50">
            <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
              <Calendar className="h-3.5 w-3.5" />
              Holidays
            </div>
            <p className="text-white font-semibold">{settings.holidays.length}</p>
          </div>
          <div className="bg-gray-800/50 backdrop-blur rounded-xl p-3 border border-gray-700/50">
            <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
              <Shield className="h-3.5 w-3.5" />
              Blocking
            </div>
            <p className="text-white font-semibold">
              {[settings.blockTradingOnHolidays, settings.blockCompetitionsOnHolidays, settings.blockChallengesOnHolidays].filter(Boolean).length}/3
            </p>
          </div>
          <div className="bg-gray-800/50 backdrop-blur rounded-xl p-3 border border-gray-700/50">
            <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
              <Activity className="h-3.5 w-3.5" />
              Active Assets
            </div>
            <p className="text-white font-semibold">
              {ASSET_CLASSES.filter(a => settings.assetSchedules[a.id as keyof typeof settings.assetSchedules]?.enabled).length}/5
            </p>
          </div>
        </div>
      </div>

      {/* Mode Selection */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <button
          onClick={() => setSettings({ ...settings, mode: 'automatic' })}
          className={`relative overflow-hidden rounded-xl p-5 text-left transition-all duration-300 ${
            settings.mode === 'automatic'
              ? 'bg-gradient-to-br from-emerald-500/20 to-teal-600/10 border-2 border-emerald-500 shadow-lg shadow-emerald-500/10'
              : 'bg-gray-800/50 border border-gray-700/50 hover:border-gray-600'
          }`}
        >
          {settings.mode === 'automatic' && (
            <div className="absolute top-3 right-3">
              <CheckCircle className="h-5 w-5 text-emerald-400" />
            </div>
          )}
          <div className="flex items-center gap-3 mb-3">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
              settings.mode === 'automatic' 
                ? 'bg-gradient-to-br from-emerald-500 to-teal-600' 
                : 'bg-gray-700'
            }`}>
              <Zap className="h-6 w-6 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-white text-lg">Automatic Mode</h3>
              <p className="text-xs text-gray-400">Real-time API data</p>
            </div>
          </div>
          <p className="text-sm text-gray-400">
            Uses Massive.com API for live market status. Your custom holidays will still apply.
          </p>
          
          {settings.mode === 'automatic' && (
            <div className="mt-4 pt-4 border-t border-gray-700/50 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-400">API Fallback</span>
                <Switch
                  checked={settings.automaticSettings.fallbackToManual}
                  onCheckedChange={(checked) => setSettings({
                    ...settings,
                    automaticSettings: { ...settings.automaticSettings, fallbackToManual: checked }
                  })}
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-400">Cache</span>
                <Select
                  value={String(settings.automaticSettings.cacheMinutes)}
                  onValueChange={(val) => setSettings({
                    ...settings,
                    automaticSettings: { ...settings.automaticSettings, cacheMinutes: parseInt(val) }
                  })}
                >
                  <SelectTrigger className="w-24 h-8 bg-gray-800 border-gray-600 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 min</SelectItem>
                    <SelectItem value="5">5 min</SelectItem>
                    <SelectItem value="15">15 min</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </button>

        <button
          onClick={() => setSettings({ ...settings, mode: 'manual' })}
          className={`relative overflow-hidden rounded-xl p-5 text-left transition-all duration-300 ${
            settings.mode === 'manual'
              ? 'bg-gradient-to-br from-blue-500/20 to-indigo-600/10 border-2 border-blue-500 shadow-lg shadow-blue-500/10'
              : 'bg-gray-800/50 border border-gray-700/50 hover:border-gray-600'
          }`}
        >
          {settings.mode === 'manual' && (
            <div className="absolute top-3 right-3">
              <CheckCircle className="h-5 w-5 text-blue-400" />
            </div>
          )}
          <div className="flex items-center gap-3 mb-3">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
              settings.mode === 'manual' 
                ? 'bg-gradient-to-br from-blue-500 to-indigo-600' 
                : 'bg-gray-700'
            }`}>
              <Clock className="h-6 w-6 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-white text-lg">Manual Mode</h3>
              <p className="text-xs text-gray-400">Custom schedules</p>
            </div>
          </div>
          <p className="text-sm text-gray-400">
            Full control over trading hours. Define custom schedules for each day and asset class.
          </p>
        </button>
      </div>

      {/* Section Navigation */}
      <div className="flex gap-2 p-1 bg-gray-800/50 rounded-xl border border-gray-700/50">
        {[
          { id: 'schedules', label: 'Trading Schedules', icon: Clock },
          { id: 'holidays', label: 'Holidays', icon: Calendar, count: settings.holidays.length },
          { id: 'blocking', label: 'Blocking Rules', icon: Shield },
        ].map((section) => (
          <button
            key={section.id}
            onClick={() => setActiveSection(section.id as typeof activeSection)}
            className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-lg font-medium transition-all ${
              activeSection === section.id
                ? 'bg-gradient-to-r from-gray-700 to-gray-800 text-white shadow-lg'
                : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
            }`}
          >
            <section.icon className="h-4 w-4" />
            <span className="hidden sm:inline">{section.label}</span>
            {section.count !== undefined && section.count > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                {section.count}
              </Badge>
            )}
          </button>
        ))}
      </div>

      {/* Trading Schedules Section */}
      {activeSection === 'schedules' && (
        <div className="space-y-3">
          {settings.mode === 'automatic' && (
            <div className="flex items-center gap-3 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
              <Info className="h-5 w-5 text-emerald-400 flex-shrink-0" />
              <p className="text-sm text-gray-300">
                <span className="text-emerald-400 font-medium">Automatic mode active.</span> These schedules are used as fallback when API is unavailable.
              </p>
            </div>
          )}

          {ASSET_CLASSES.map((asset) => {
            const schedule = settings.assetSchedules[asset.id as keyof typeof settings.assetSchedules];
            const isExpanded = expandedAssets.includes(asset.id);
            const enabledDays = getEnabledDaysCount(schedule);

            return (
              <Collapsible key={asset.id} open={isExpanded} onOpenChange={() => toggleAssetExpanded(asset.id)}>
                <div className={`rounded-xl border overflow-hidden transition-all ${
                  schedule?.enabled 
                    ? `${asset.bgColor} ${asset.borderColor}` 
                    : 'bg-gray-800/30 border-gray-700/50 opacity-60'
                }`}>
                  <CollapsibleTrigger asChild>
                    <button className="w-full p-4 flex items-center justify-between hover:bg-white/5 transition-colors">
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${asset.color} flex items-center justify-center text-2xl shadow-lg`}>
                          {asset.icon}
                        </div>
                        <div className="text-left">
                          <h3 className="font-bold text-white text-lg">{asset.label}</h3>
                          <p className="text-sm text-gray-400">
                            {schedule?.enabled ? `${enabledDays} days active` : 'Disabled'}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-4">
                        <div className="flex gap-1 mr-2">
                          {DAYS.map((day) => (
                            <div
                              key={day}
                              className={`w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-bold ${
                                schedule?.[day]?.enabled
                                  ? 'bg-emerald-500/30 text-emerald-400'
                                  : 'bg-gray-700/50 text-gray-500'
                              }`}
                            >
                              {DAY_LABELS[day][0]}
                            </div>
                          ))}
                        </div>
                        
                        <Switch
                          checked={schedule?.enabled ?? true}
                          onCheckedChange={(checked) => {
                            setSettings({
                              ...settings,
                              assetSchedules: {
                                ...settings.assetSchedules,
                                [asset.id]: { ...schedule, enabled: checked },
                              },
                            });
                          }}
                          onClick={(e) => e.stopPropagation()}
                        />
                        
                        {isExpanded ? (
                          <ChevronDown className="h-5 w-5 text-gray-400" />
                        ) : (
                          <ChevronRight className="h-5 w-5 text-gray-400" />
                        )}
                      </div>
                    </button>
                  </CollapsibleTrigger>

                  <CollapsibleContent>
                    <div className="px-4 pb-4 pt-2 border-t border-gray-700/30">
                      <div className="grid grid-cols-7 gap-2">
                        {DAYS.map((day) => {
                          const daySchedule = schedule?.[day] || DEFAULT_DAY_SCHEDULE;
                          const isWeekend = day === 'saturday' || day === 'sunday';
                          
                          return (
                            <div 
                              key={day} 
                              className={`rounded-lg p-3 ${
                                daySchedule.enabled 
                                  ? 'bg-gray-800/50' 
                                  : 'bg-gray-900/30'
                              } ${isWeekend ? 'ring-1 ring-orange-500/20' : ''}`}
                            >
                              <div className="flex items-center justify-between mb-2">
                                <span className={`text-xs font-bold ${
                                  daySchedule.enabled ? 'text-white' : 'text-gray-500'
                                }`}>
                                  {DAY_LABELS[day]}
                                </span>
                                <Switch
                                  checked={daySchedule.enabled}
                                  onCheckedChange={(checked) => 
                                    updateDaySchedule(asset.id as keyof typeof settings.assetSchedules, day, 'enabled', checked)
                                  }
                                  className="scale-75"
                                />
                              </div>
                              
                              {daySchedule.enabled ? (
                                <div className="space-y-2">
                                  <div className="flex items-center gap-1">
                                    <Sun className="h-3 w-3 text-amber-400" />
                                    <Input
                                      type="time"
                                      value={daySchedule.openTime}
                                      onChange={(e) => 
                                        updateDaySchedule(asset.id as keyof typeof settings.assetSchedules, day, 'openTime', e.target.value)
                                      }
                                      className="h-7 text-xs bg-gray-900/50 border-gray-700 px-2"
                                    />
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <Moon className="h-3 w-3 text-blue-400" />
                                    <Input
                                      type="time"
                                      value={daySchedule.closeTime}
                                      onChange={(e) => 
                                        updateDaySchedule(asset.id as keyof typeof settings.assetSchedules, day, 'closeTime', e.target.value)
                                      }
                                      className="h-7 text-xs bg-gray-900/50 border-gray-700 px-2"
                                    />
                                  </div>
                                </div>
                              ) : (
                                <div className="h-[60px] flex items-center justify-center">
                                  <div className="flex items-center gap-1 text-red-400/70">
                                    <Ban className="h-4 w-4" />
                                    <span className="text-xs font-medium">Closed</span>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                      <p className="text-xs text-gray-500 mt-3 text-center">All times in UTC</p>
                    </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>
            );
          })}
        </div>
      )}

      {/* Holidays Section */}
      {activeSection === 'holidays' && (
        <div className="space-y-6">
          {/* Automatic Holidays from API - Show when in automatic mode */}
          {settings.mode === 'automatic' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                    <Zap className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">Automatic Holidays</h3>
                    <p className="text-sm text-gray-400">Detected from Massive.com API</p>
                  </div>
                </div>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={fetchAutomaticHolidays}
                  disabled={loadingAutoHolidays}
                  className="border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                >
                  {loadingAutoHolidays ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Globe className="h-4 w-4 mr-2" />
                      Refresh
                    </>
                  )}
                </Button>
              </div>

              {loadingAutoHolidays ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
                </div>
              ) : automaticHolidays.length === 0 ? (
                <div className="p-6 bg-gray-800/30 rounded-xl border border-dashed border-gray-700 text-center">
                  <Globe className="h-10 w-10 mx-auto mb-3 text-gray-600" />
                  <p className="text-gray-400 text-sm">No upcoming holidays detected from API</p>
                  <p className="text-gray-500 text-xs mt-1">This may mean all markets are operating normally</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {automaticHolidays.slice(0, 9).map((holiday) => (
                    <div
                      key={holiday.id}
                      className="relative overflow-hidden rounded-xl bg-gradient-to-br from-emerald-500/10 to-teal-600/5 border border-emerald-500/20 p-4"
                    >
                      <div className="absolute top-2 right-2">
                        <Badge className="bg-emerald-500/20 text-emerald-400 text-[10px] px-1.5">
                          API
                        </Badge>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                          <Calendar className="h-5 w-5 text-emerald-400" />
                        </div>
                        <div className="min-w-0">
                          <h4 className="font-semibold text-white text-sm truncate">{holiday.name}</h4>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {new Date(holiday.date + 'T00:00:00').toLocaleDateString('en-US', { 
                              weekday: 'short', 
                              month: 'short', 
                              day: 'numeric'
                            })}
                          </p>
                          <div className="flex items-center gap-2 mt-2">
                            <Badge variant="outline" className="text-[10px] border-gray-600 px-1.5">
                              {holiday.exchange}
                            </Badge>
                            {holiday.daysUntil === 0 ? (
                              <Badge className="bg-red-500/20 text-red-400 text-[10px] px-1.5">Today</Badge>
                            ) : holiday.daysUntil === 1 ? (
                              <Badge className="bg-orange-500/20 text-orange-400 text-[10px] px-1.5">Tomorrow</Badge>
                            ) : (
                              <span className="text-[10px] text-gray-500">in {holiday.daysUntil} days</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {automaticHolidays.length > 9 && (
                <p className="text-xs text-center text-gray-500">
                  And {automaticHolidays.length - 9} more upcoming holidays...
                </p>
              )}
            </div>
          )}

          {/* Manual/Custom Holidays */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                  <Calendar className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">
                    {settings.mode === 'automatic' ? 'Custom Holidays' : 'Market Holidays'}
                  </h3>
                  <p className="text-sm text-gray-400">
                    {settings.mode === 'automatic' 
                      ? 'Additional holidays you define (added to automatic detection)'
                      : 'Define days when markets are closed'}
                  </p>
                </div>
              </div>
              <Button onClick={() => setAddHolidayOpen(true)} className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700">
                <Plus className="h-4 w-4 mr-2" />
                Add Holiday
              </Button>
            </div>

            {settings.holidays.length === 0 ? (
              <div className="text-center py-12 bg-gray-800/30 rounded-xl border border-dashed border-gray-700">
                <Calendar className="h-12 w-12 mx-auto mb-3 text-gray-600" />
                <h3 className="text-base font-semibold text-gray-400 mb-1">No Custom Holidays</h3>
                <p className="text-sm text-gray-500 mb-4">
                  {settings.mode === 'automatic' 
                    ? 'API holidays will still apply. Add custom holidays if needed.'
                    : 'Add holidays to block trading during market closures'}
                </p>
                <Button onClick={() => setAddHolidayOpen(true)} variant="outline" className="border-gray-600">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Holiday
                </Button>
              </div>
            ) : (
              <div className="grid gap-3">
                {settings.holidays.map((holiday) => (
                  <div
                    key={holiday._id}
                    className={`flex items-center justify-between p-4 rounded-xl border transition-all ${
                      holiday._id?.startsWith('temp_')
                        ? 'bg-amber-500/10 border-amber-500/30'
                        : 'bg-gray-800/50 border-gray-700/50 hover:border-gray-600'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
                        <Calendar className="h-6 w-6 text-white" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold text-white">{holiday.name}</h4>
                          {holiday._id?.startsWith('temp_') && (
                            <Badge className="bg-amber-500/20 text-amber-400 text-xs">New</Badge>
                          )}
                          <Badge className="bg-blue-500/20 text-blue-400 text-xs">Custom</Badge>
                          {holiday.isRecurring && (
                            <Badge variant="outline" className="text-xs border-gray-600">Yearly</Badge>
                          )}
                        </div>
                        <p className="text-sm text-gray-400">
                          {new Date(holiday.date + 'T00:00:00').toLocaleDateString('en-US', { 
                            weekday: 'short', 
                            month: 'short', 
                            day: 'numeric',
                            year: 'numeric'
                          })}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <div className="flex gap-1">
                        {holiday.affectedAssets.map((asset) => (
                          <Badge key={asset} variant="secondary" className="text-xs capitalize">
                            {asset}
                          </Badge>
                        ))}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => holiday._id && handleDeleteHoliday(holiday._id)}
                        className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Info Box */}
          <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl">
            <div className="flex items-start gap-3">
              <Info className="h-5 w-5 text-blue-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm text-blue-400 font-medium mb-1">
                  {settings.mode === 'automatic' ? 'How Holidays Work' : 'Common Forex Holidays'}
                </p>
                <p className="text-xs text-gray-400">
                  {settings.mode === 'automatic' 
                    ? 'In automatic mode, API-detected holidays and your custom holidays are combined. Both will block trading when the relevant blocking rules are enabled.'
                    : 'Christmas (Dec 25), New Year\'s (Jan 1), Good Friday, Easter Monday. Mark as "Yearly" for recurring holidays.'}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Blocking Rules Section */}
      {activeSection === 'blocking' && (
        <div className="space-y-4">
          <div className="p-4 bg-orange-500/10 border border-orange-500/20 rounded-xl">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-orange-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm text-orange-400 font-medium mb-1">About Blocking Rules</p>
                <p className="text-xs text-gray-400">
                  These rules apply when the market is closed - holidays, weekends, or disabled days. 
                  Enable to prevent users from joining competitions/challenges during closures.
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-3">
            {[
              {
                id: 'blockTradingOnHolidays',
                label: 'Block Trading',
                description: 'Prevent opening/closing positions',
                icon: TrendingUp,
                color: 'from-red-500 to-rose-600',
              },
              {
                id: 'blockCompetitionsOnHolidays',
                label: 'Block Competition Entry',
                description: 'Prevent joining competitions',
                icon: Globe,
                color: 'from-orange-500 to-amber-600',
              },
              {
                id: 'blockChallengesOnHolidays',
                label: 'Block Challenge Entry',
                description: 'Prevent creating/accepting 1v1 challenges',
                icon: Shield,
                color: 'from-purple-500 to-violet-600',
              },
              {
                id: 'showHolidayWarning',
                label: 'Show Warning Banner',
                description: 'Display notice to users when market is closed',
                icon: AlertTriangle,
                color: 'from-yellow-500 to-amber-600',
              },
            ].map((rule) => (
              <div
                key={rule.id}
                className={`flex items-center justify-between p-4 rounded-xl border transition-all ${
                  settings[rule.id as keyof MarketSettings]
                    ? 'bg-gray-800/50 border-gray-600'
                    : 'bg-gray-800/30 border-gray-700/50'
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${rule.color} flex items-center justify-center shadow-lg ${
                    settings[rule.id as keyof MarketSettings] ? 'opacity-100' : 'opacity-40'
                  }`}>
                    <rule.icon className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-white">{rule.label}</h4>
                    <p className="text-sm text-gray-400">{rule.description}</p>
                  </div>
                </div>
                <Switch
                  checked={settings[rule.id as keyof MarketSettings] as boolean}
                  onCheckedChange={(checked) => setSettings({ ...settings, [rule.id]: checked })}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Floating Save Button */}
      {hasChanges && (
        <div className="fixed bottom-6 right-6 z-50 animate-bounce">
          <Button 
            onClick={handleSaveAll} 
            disabled={saving}
            size="lg"
            className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 shadow-2xl shadow-emerald-500/30 font-bold px-8"
          >
            {saving ? (
              <Loader2 className="h-5 w-5 mr-2 animate-spin" />
            ) : (
              <Save className="h-5 w-5 mr-2" />
            )}
            Save Settings
          </Button>
        </div>
      )}

      {/* Add Holiday Dialog */}
      <Dialog open={addHolidayOpen} onOpenChange={setAddHolidayOpen}>
        <DialogContent className="bg-gray-900 border-gray-700 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2 text-xl">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center">
                <Calendar className="h-5 w-5 text-white" />
              </div>
              Add Holiday
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-white">Holiday Name</Label>
              <Input
                value={newHoliday.name}
                onChange={(e) => setNewHoliday({ ...newHoliday, name: e.target.value })}
                placeholder="e.g., Christmas Day"
                className="bg-gray-800 border-gray-700 focus:border-emerald-500"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-white">Date</Label>
              <Input
                type="date"
                value={newHoliday.date}
                onChange={(e) => setNewHoliday({ ...newHoliday, date: e.target.value })}
                className="bg-gray-800 border-gray-700 focus:border-emerald-500"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-white">Affected Markets</Label>
              <div className="grid grid-cols-3 gap-2">
                {ASSET_CLASSES.map((asset) => (
                  <label 
                    key={asset.id} 
                    className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-all ${
                      newHoliday.affectedAssets?.includes(asset.id)
                        ? `${asset.bgColor} ${asset.borderColor} border`
                        : 'bg-gray-800/50 border border-gray-700 hover:border-gray-600'
                    }`}
                  >
                    <Checkbox
                      checked={newHoliday.affectedAssets?.includes(asset.id)}
                      onCheckedChange={(checked) => {
                        const assets = newHoliday.affectedAssets || [];
                        setNewHoliday({
                          ...newHoliday,
                          affectedAssets: checked
                            ? [...assets, asset.id]
                            : assets.filter(a => a !== asset.id),
                        });
                      }}
                      className="hidden"
                    />
                    <span className="text-lg">{asset.icon}</span>
                    <span className="text-xs text-gray-300">{asset.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <label className="flex items-center gap-3 p-3 rounded-lg bg-gray-800/50 cursor-pointer">
              <Checkbox
                checked={newHoliday.isRecurring}
                onCheckedChange={(checked) => setNewHoliday({ ...newHoliday, isRecurring: !!checked })}
              />
              <div>
                <span className="text-white font-medium">Recurring Yearly</span>
                <p className="text-xs text-gray-400">Repeats every year on the same date</p>
              </div>
            </label>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setAddHolidayOpen(false)} className="border-gray-700">
              Cancel
            </Button>
            <Button onClick={handleAddHoliday} className="bg-gradient-to-r from-emerald-500 to-teal-600">
              <Plus className="h-4 w-4 mr-2" />
              Add Holiday
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
