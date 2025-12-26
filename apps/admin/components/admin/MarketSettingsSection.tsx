'use client';

import { useState, useEffect } from 'react';
import {
  Clock,
  Calendar,
  Save,
  RefreshCw,
  Plus,
  Trash2,
  Settings,
  Zap,
  AlertTriangle,
  CheckCircle,
  Globe,
  TrendingUp,
  Loader2,
  Info,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  monday: 'Monday',
  tuesday: 'Tuesday',
  wednesday: 'Wednesday',
  thursday: 'Thursday',
  friday: 'Friday',
  saturday: 'Saturday',
  sunday: 'Sunday',
};

const ASSET_CLASSES = [
  { id: 'forex', label: 'Forex', icon: '💱' },
  { id: 'crypto', label: 'Crypto', icon: '₿' },
  { id: 'stocks', label: 'Stocks', icon: '📈' },
  { id: 'indices', label: 'Indices', icon: '📊' },
  { id: 'commodities', label: 'Commodities', icon: '🛢️' },
];

const DEFAULT_DAY_SCHEDULE: DaySchedule = {
  enabled: true,
  openTime: '00:00',
  closeTime: '23:59',
};

export default function MarketSettingsSection() {
  const [settings, setSettings] = useState<MarketSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [addHolidayOpen, setAddHolidayOpen] = useState(false);
  const [newHoliday, setNewHoliday] = useState<Partial<MarketHoliday>>({
    name: '',
    date: '',
    affectedAssets: ['forex'],
    isRecurring: false,
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await fetch('/api/market-settings');
      if (response.ok) {
        const data = await response.json();
        setSettings(data);
      }
    } catch (error) {
      console.error('Error fetching market settings:', error);
      toast.error('Failed to load market settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!settings) return;
    
    setSaving(true);
    try {
      const response = await fetch('/api/market-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });

      if (response.ok) {
        toast.success('Market settings saved');
      } else {
        toast.error('Failed to save settings');
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleAddHoliday = async () => {
    if (!newHoliday.name || !newHoliday.date) {
      toast.error('Please enter holiday name and date');
      return;
    }

    try {
      const response = await fetch('/api/market-settings/holidays', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newHoliday),
      });

      if (response.ok) {
        const { holiday } = await response.json();
        setSettings(prev => prev ? {
          ...prev,
          holidays: [...prev.holidays, holiday],
        } : null);
        setNewHoliday({ name: '', date: '', affectedAssets: ['forex'], isRecurring: false });
        setAddHolidayOpen(false);
        toast.success('Holiday added');
      } else {
        toast.error('Failed to add holiday');
      }
    } catch (error) {
      console.error('Error adding holiday:', error);
      toast.error('Failed to add holiday');
    }
  };

  const handleDeleteHoliday = async (holidayId: string) => {
    try {
      const response = await fetch(`/api/market-settings/holidays?id=${holidayId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setSettings(prev => prev ? {
          ...prev,
          holidays: prev.holidays.filter(h => h._id !== holidayId),
        } : null);
        toast.success('Holiday removed');
      } else {
        toast.error('Failed to remove holiday');
      }
    } catch (error) {
      console.error('Error removing holiday:', error);
      toast.error('Failed to remove holiday');
    }
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="text-center py-8 text-gray-400">
        Failed to load market settings
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <TrendingUp className="h-6 w-6 text-green-500" />
            Market Settings
          </h2>
          <p className="text-gray-400 mt-1">
            Configure market hours and holidays for competitions and challenges
          </p>
        </div>
        <Button onClick={handleSave} disabled={saving} className="bg-green-600 hover:bg-green-700">
          {saving ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          Save Settings
        </Button>
      </div>

      {/* Mode Selection */}
      <Card className="bg-gray-800/50 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Market Hours Mode
          </CardTitle>
          <CardDescription>
            Choose how market hours are determined
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Automatic Mode */}
            <div
              className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                settings.mode === 'automatic'
                  ? 'border-green-500 bg-green-500/10'
                  : 'border-gray-700 hover:border-gray-600'
              }`}
              onClick={() => setSettings({ ...settings, mode: 'automatic' })}
            >
              <div className="flex items-center gap-3 mb-2">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                  settings.mode === 'automatic' ? 'bg-green-500' : 'bg-gray-700'
                }`}>
                  <Zap className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h4 className="font-semibold text-white">Automatic</h4>
                  <p className="text-xs text-gray-400">Use Massive.com API</p>
                </div>
                {settings.mode === 'automatic' && (
                  <CheckCircle className="h-5 w-5 text-green-500 ml-auto" />
                )}
              </div>
              <p className="text-sm text-gray-400">
                Real-time market status from Massive.com API with automatic holiday detection
              </p>
            </div>

            {/* Manual Mode */}
            <div
              className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                settings.mode === 'manual'
                  ? 'border-blue-500 bg-blue-500/10'
                  : 'border-gray-700 hover:border-gray-600'
              }`}
              onClick={() => setSettings({ ...settings, mode: 'manual' })}
            >
              <div className="flex items-center gap-3 mb-2">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                  settings.mode === 'manual' ? 'bg-blue-500' : 'bg-gray-700'
                }`}>
                  <Clock className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h4 className="font-semibold text-white">Manual</h4>
                  <p className="text-xs text-gray-400">Custom schedules</p>
                </div>
                {settings.mode === 'manual' && (
                  <CheckCircle className="h-5 w-5 text-blue-500 ml-auto" />
                )}
              </div>
              <p className="text-sm text-gray-400">
                Define custom trading hours and holidays for each asset class
              </p>
            </div>
          </div>

          {/* Automatic Mode Settings */}
          {settings.mode === 'automatic' && (
            <div className="mt-4 p-4 bg-gray-900/50 rounded-lg space-y-4">
              <h4 className="text-sm font-medium text-white">Automatic Mode Settings</h4>
              
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-white">Fallback to Manual Settings</Label>
                  <p className="text-xs text-gray-400">If API fails, use manual schedules</p>
                </div>
                <Switch
                  checked={settings.automaticSettings.fallbackToManual}
                  onCheckedChange={(checked) => setSettings({
                    ...settings,
                    automaticSettings: { ...settings.automaticSettings, fallbackToManual: checked }
                  })}
                />
              </div>

              <div className="flex items-center gap-4">
                <Label className="text-white">Cache Duration</Label>
                <Select
                  value={String(settings.automaticSettings.cacheMinutes)}
                  onValueChange={(val) => setSettings({
                    ...settings,
                    automaticSettings: { ...settings.automaticSettings, cacheMinutes: parseInt(val) }
                  })}
                >
                  <SelectTrigger className="w-32 bg-gray-800 border-gray-600">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 minute</SelectItem>
                    <SelectItem value="5">5 minutes</SelectItem>
                    <SelectItem value="15">15 minutes</SelectItem>
                    <SelectItem value="30">30 minutes</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Tabs defaultValue="schedules" className="space-y-4">
        <TabsList className="bg-gray-800/50 border border-gray-700">
          <TabsTrigger value="schedules">
            <Clock className="h-4 w-4 mr-2" />
            Trading Schedules
          </TabsTrigger>
          <TabsTrigger value="holidays">
            <Calendar className="h-4 w-4 mr-2" />
            Holidays
          </TabsTrigger>
          <TabsTrigger value="blocking">
            <AlertTriangle className="h-4 w-4 mr-2" />
            Blocking Rules
          </TabsTrigger>
        </TabsList>

        {/* Trading Schedules Tab */}
        <TabsContent value="schedules">
          <div className="space-y-4">
            {ASSET_CLASSES.map((asset) => (
              <Card key={asset.id} className="bg-gray-800/50 border-gray-700">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-white flex items-center gap-2">
                      <span className="text-xl">{asset.icon}</span>
                      {asset.label}
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      <Label className="text-gray-400 text-sm">Enabled</Label>
                      <Switch
                        checked={settings.assetSchedules[asset.id as keyof typeof settings.assetSchedules]?.enabled ?? true}
                        onCheckedChange={(checked) => setSettings({
                          ...settings,
                          assetSchedules: {
                            ...settings.assetSchedules,
                            [asset.id]: {
                              ...settings.assetSchedules[asset.id as keyof typeof settings.assetSchedules],
                              enabled: checked,
                            },
                          },
                        })}
                      />
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-7 gap-2">
                    {DAYS.map((day) => {
                      const schedule = settings.assetSchedules[asset.id as keyof typeof settings.assetSchedules]?.[day] || DEFAULT_DAY_SCHEDULE;
                      return (
                        <div key={day} className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label className="text-xs text-gray-400">{DAY_LABELS[day].slice(0, 3)}</Label>
                            <Switch
                              checked={schedule.enabled}
                              onCheckedChange={(checked) => 
                                updateDaySchedule(asset.id as keyof typeof settings.assetSchedules, day, 'enabled', checked)
                              }
                              className="scale-75"
                            />
                          </div>
                          {schedule.enabled && (
                            <>
                              <Input
                                type="time"
                                value={schedule.openTime}
                                onChange={(e) => 
                                  updateDaySchedule(asset.id as keyof typeof settings.assetSchedules, day, 'openTime', e.target.value)
                                }
                                className="h-7 text-xs bg-gray-900 border-gray-600"
                              />
                              <Input
                                type="time"
                                value={schedule.closeTime}
                                onChange={(e) => 
                                  updateDaySchedule(asset.id as keyof typeof settings.assetSchedules, day, 'closeTime', e.target.value)
                                }
                                className="h-7 text-xs bg-gray-900 border-gray-600"
                              />
                            </>
                          )}
                          {!schedule.enabled && (
                            <div className="h-14 flex items-center justify-center text-xs text-gray-500">
                              Closed
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <p className="text-xs text-gray-500 mt-2">All times are in UTC</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Holidays Tab */}
        <TabsContent value="holidays">
          <Card className="bg-gray-800/50 border-gray-700">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-white flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    Market Holidays
                  </CardTitle>
                  <CardDescription>
                    Define holidays when markets are closed
                  </CardDescription>
                </div>
                <Button onClick={() => setAddHolidayOpen(true)} className="bg-blue-600 hover:bg-blue-700">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Holiday
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {settings.holidays.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <Calendar className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No holidays configured</p>
                  <p className="text-sm">Add holidays to block trading during market closures</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {settings.holidays.map((holiday) => (
                    <div
                      key={holiday._id}
                      className="flex items-center justify-between p-3 bg-gray-900/50 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-red-500/20 rounded-lg flex items-center justify-center">
                          <Calendar className="h-5 w-5 text-red-400" />
                        </div>
                        <div>
                          <p className="font-medium text-white">{holiday.name}</p>
                          <div className="flex items-center gap-2 text-xs text-gray-400">
                            <span>{new Date(holiday.date).toLocaleDateString()}</span>
                            {holiday.isRecurring && (
                              <Badge variant="outline" className="text-xs">Recurring</Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex gap-1">
                          {holiday.affectedAssets.map((asset) => (
                            <Badge key={asset} variant="secondary" className="text-xs">
                              {asset}
                            </Badge>
                          ))}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => holiday._id && handleDeleteHoliday(holiday._id)}
                          className="text-red-400 hover:text-red-300"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Common Holidays Quick Add */}
              <div className="mt-4 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                <div className="flex items-start gap-2">
                  <Info className="h-4 w-4 text-blue-400 mt-0.5" />
                  <div>
                    <p className="text-sm text-blue-400 font-medium">Common Forex Holidays</p>
                    <p className="text-xs text-gray-400 mt-1">
                      Forex markets typically close on: Christmas Day (Dec 25), New Year's Day (Jan 1), 
                      Good Friday, Easter Monday. Add these as recurring holidays.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Blocking Rules Tab */}
        <TabsContent value="blocking">
          <Card className="bg-gray-800/50 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-orange-500" />
                Holiday Blocking Rules
              </CardTitle>
              <CardDescription>
                Configure what actions to block during holidays
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-gray-900/50 rounded-lg">
                <div>
                  <Label className="text-white">Block Trading on Holidays</Label>
                  <p className="text-xs text-gray-400">Prevent users from opening/closing positions</p>
                </div>
                <Switch
                  checked={settings.blockTradingOnHolidays}
                  onCheckedChange={(checked) => setSettings({ ...settings, blockTradingOnHolidays: checked })}
                />
              </div>

              <div className="flex items-center justify-between p-4 bg-gray-900/50 rounded-lg">
                <div>
                  <Label className="text-white">Block Competition Entry on Holidays</Label>
                  <p className="text-xs text-gray-400">Prevent joining competitions when market is closed</p>
                </div>
                <Switch
                  checked={settings.blockCompetitionsOnHolidays}
                  onCheckedChange={(checked) => setSettings({ ...settings, blockCompetitionsOnHolidays: checked })}
                />
              </div>

              <div className="flex items-center justify-between p-4 bg-gray-900/50 rounded-lg">
                <div>
                  <Label className="text-white">Block Challenge Entry on Holidays</Label>
                  <p className="text-xs text-gray-400">Prevent joining 1v1 challenges when market is closed</p>
                </div>
                <Switch
                  checked={settings.blockChallengesOnHolidays}
                  onCheckedChange={(checked) => setSettings({ ...settings, blockChallengesOnHolidays: checked })}
                />
              </div>

              <div className="flex items-center justify-between p-4 bg-gray-900/50 rounded-lg">
                <div>
                  <Label className="text-white">Show Holiday Warning</Label>
                  <p className="text-xs text-gray-400">Display warning banner when market is closed</p>
                </div>
                <Switch
                  checked={settings.showHolidayWarning}
                  onCheckedChange={(checked) => setSettings({ ...settings, showHolidayWarning: checked })}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add Holiday Dialog */}
      <Dialog open={addHolidayOpen} onOpenChange={setAddHolidayOpen}>
        <DialogContent className="bg-gray-800 border-gray-700">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Add Market Holiday
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-white">Holiday Name</Label>
              <Input
                value={newHoliday.name}
                onChange={(e) => setNewHoliday({ ...newHoliday, name: e.target.value })}
                placeholder="e.g., Christmas Day"
                className="bg-gray-900 border-gray-600"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-white">Date</Label>
              <Input
                type="date"
                value={newHoliday.date}
                onChange={(e) => setNewHoliday({ ...newHoliday, date: e.target.value })}
                className="bg-gray-900 border-gray-600"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-white">Affected Asset Classes</Label>
              <div className="flex flex-wrap gap-2">
                {ASSET_CLASSES.map((asset) => (
                  <label key={asset.id} className="flex items-center gap-2">
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
                    />
                    <span className="text-sm text-gray-300">{asset.icon} {asset.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                checked={newHoliday.isRecurring}
                onCheckedChange={(checked) => setNewHoliday({ ...newHoliday, isRecurring: !!checked })}
              />
              <Label className="text-gray-300">Recurring yearly</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAddHolidayOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddHoliday} className="bg-blue-600 hover:bg-blue-700">
              <Plus className="h-4 w-4 mr-2" />
              Add Holiday
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

