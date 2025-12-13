'use client';

import { useState, useEffect } from 'react';
import { Bell, BellOff, Mail, Smartphone, Clock, RefreshCw, Check, ChevronDown, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';

interface NotificationTemplate {
  templateId: string;
  name: string;
  category: string;
  type: string;
  icon: string;
}

interface CategoryPreferences {
  purchase: boolean;
  competition: boolean;
  trading: boolean;
  achievement: boolean;
  system: boolean;
  admin: boolean;
  security: boolean;
}

interface Preferences {
  notificationsEnabled: boolean;
  emailNotificationsEnabled: boolean;
  pushNotificationsEnabled: boolean;
  categoryPreferences: CategoryPreferences;
  disabledNotifications: string[];
  quietHoursEnabled: boolean;
  quietHoursStart?: string;
  quietHoursEnd?: string;
  digestEnabled: boolean;
  digestFrequency: 'daily' | 'weekly' | 'never';
}

const CATEGORY_INFO: Record<string, { label: string; icon: string; description: string; color: string }> = {
  purchase: {
    label: 'Purchases & Wallet',
    icon: '💳',
    description: 'Deposits, withdrawals, and balance updates',
    color: 'text-blue-400',
  },
  competition: {
    label: 'Competitions',
    icon: '🏆',
    description: 'Competition updates, results, and prizes',
    color: 'text-yellow-400',
  },
  trading: {
    label: 'Trading',
    icon: '📈',
    description: 'Order fills, position updates, and alerts',
    color: 'text-green-400',
  },
  achievement: {
    label: 'Achievements',
    icon: '🏅',
    description: 'Badges earned and level ups',
    color: 'text-purple-400',
  },
  system: {
    label: 'System',
    icon: '⚙️',
    description: 'Platform updates and maintenance notices',
    color: 'text-gray-400',
  },
  admin: {
    label: 'Admin Messages',
    icon: '📢',
    description: 'Important announcements from the platform',
    color: 'text-orange-400',
  },
  security: {
    label: 'Security',
    icon: '🔐',
    description: 'Login alerts and account security (always enabled)',
    color: 'text-red-400',
  },
};

export default function NotificationSettings() {
  const [preferences, setPreferences] = useState<Preferences | null>(null);
  const [templatesByCategory, setTemplatesByCategory] = useState<Record<string, NotificationTemplate[]>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<string[]>([]);

  useEffect(() => {
    fetchPreferences();
  }, []);

  const fetchPreferences = async () => {
    try {
      const response = await fetch('/api/notifications/preferences');
      if (response.ok) {
        const data = await response.json();
        setPreferences(data.preferences);
        setTemplatesByCategory(data.templatesByCategory || {});
      }
    } catch (error) {
      console.error('Error fetching preferences:', error);
      toast.error('Failed to load notification preferences');
    } finally {
      setLoading(false);
    }
  };

  const updatePreferences = async (updates: Partial<Preferences>) => {
    if (!preferences) return;
    
    setSaving(true);
    try {
      const response = await fetch('/api/notifications/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });

      if (response.ok) {
        const data = await response.json();
        setPreferences(data.preferences);
        toast.success('Preferences saved');
      } else {
        toast.error('Failed to save preferences');
      }
    } catch (error) {
      toast.error('Failed to save preferences');
    } finally {
      setSaving(false);
    }
  };

  const toggleCategory = async (category: string, enabled: boolean) => {
    try {
      const response = await fetch('/api/notifications/preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'toggle_category', category, enabled }),
      });

      if (response.ok) {
        setPreferences(prev => prev ? {
          ...prev,
          categoryPreferences: {
            ...prev.categoryPreferences,
            [category]: enabled,
          },
        } : null);
        toast.success(`${CATEGORY_INFO[category]?.label || category} notifications ${enabled ? 'enabled' : 'disabled'}`);
      }
    } catch (error) {
      toast.error('Failed to update preference');
    }
  };

  const toggleTemplate = async (templateId: string, enabled: boolean) => {
    try {
      const response = await fetch('/api/notifications/preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'toggle_template', templateId, enabled }),
      });

      if (response.ok) {
        setPreferences(prev => {
          if (!prev) return null;
          const newDisabled = enabled
            ? prev.disabledNotifications.filter(id => id !== templateId)
            : [...prev.disabledNotifications, templateId];
          return { ...prev, disabledNotifications: newDisabled };
        });
      }
    } catch (error) {
      toast.error('Failed to update preference');
    }
  };

  const resetToDefaults = async () => {
    try {
      const response = await fetch('/api/notifications/preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset_defaults' }),
      });

      if (response.ok) {
        toast.success('Preferences reset to defaults');
        fetchPreferences();
      }
    } catch (error) {
      toast.error('Failed to reset preferences');
    }
  };

  const toggleCategoryExpand = (category: string) => {
    setExpandedCategories(prev =>
      prev.includes(category)
        ? prev.filter(c => c !== category)
        : [...prev, category]
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <RefreshCw className="h-6 w-6 animate-spin text-yellow-500" />
      </div>
    );
  }

  if (!preferences) {
    return (
      <div className="text-center py-8 text-gray-400">
        <Bell className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>Failed to load notification preferences</p>
        <Button onClick={fetchPreferences} className="mt-4">
          Try Again
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Master Switch */}
      <Card className="bg-gray-900/50 border-gray-800">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {preferences.notificationsEnabled ? (
                <Bell className="h-6 w-6 text-yellow-500" />
              ) : (
                <BellOff className="h-6 w-6 text-gray-500" />
              )}
              <div>
                <CardTitle className="text-white">Notifications</CardTitle>
                <CardDescription>
                  {preferences.notificationsEnabled
                    ? 'You will receive notifications based on your preferences'
                    : 'All notifications are currently disabled'}
                </CardDescription>
              </div>
            </div>
            <Switch
              checked={preferences.notificationsEnabled}
              onCheckedChange={enabled => updatePreferences({ notificationsEnabled: enabled })}
            />
          </div>
        </CardHeader>
      </Card>

      {preferences.notificationsEnabled && (
        <>
          {/* Delivery Methods */}
          <Card className="bg-gray-900/50 border-gray-800">
            <CardHeader>
              <CardTitle className="text-white text-lg">Delivery Methods</CardTitle>
              <CardDescription>Choose how you want to receive notifications</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Bell className="h-5 w-5 text-gray-400" />
                  <div>
                    <Label className="text-white">In-App Notifications</Label>
                    <p className="text-xs text-gray-500">Always enabled for instant updates</p>
                  </div>
                </div>
                <Badge className="bg-green-500/20 text-green-400">Always On</Badge>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Mail className="h-5 w-5 text-gray-400" />
                  <div>
                    <Label className="text-white">Email Notifications</Label>
                    <p className="text-xs text-gray-500">Important updates sent to your email</p>
                  </div>
                </div>
                <Switch
                  checked={preferences.emailNotificationsEnabled}
                  onCheckedChange={enabled => updatePreferences({ emailNotificationsEnabled: enabled })}
                />
              </div>
            </CardContent>
          </Card>

          {/* Category Preferences */}
          <Card className="bg-gray-900/50 border-gray-800">
            <CardHeader>
              <CardTitle className="text-white text-lg">Notification Categories</CardTitle>
              <CardDescription>Enable or disable notifications by category</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {Object.entries(CATEGORY_INFO).map(([category, info]) => {
                const isEnabled = preferences.categoryPreferences[category as keyof CategoryPreferences];
                const isExpanded = expandedCategories.includes(category);
                const templates = templatesByCategory[category] || [];
                const isSecurity = category === 'security';

                return (
                  <div key={category} className="border border-gray-800 rounded-lg overflow-hidden">
                    {/* Category Header */}
                    <div
                      className={`flex items-center justify-between p-4 ${
                        isEnabled ? 'bg-gray-800/50' : 'bg-gray-900/30 opacity-60'
                      }`}
                    >
                      <div className="flex items-center gap-3 flex-1">
                        <button
                          onClick={() => toggleCategoryExpand(category)}
                          className="text-gray-400 hover:text-white"
                        >
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </button>
                        <span className="text-xl">{info.icon}</span>
                        <div>
                          <p className={`font-medium ${info.color}`}>{info.label}</p>
                          <p className="text-xs text-gray-500">{info.description}</p>
                        </div>
                      </div>
                      
                      {isSecurity ? (
                        <Badge className="bg-red-500/20 text-red-400">Always On</Badge>
                      ) : (
                        <Switch
                          checked={isEnabled}
                          onCheckedChange={enabled => toggleCategory(category, enabled)}
                        />
                      )}
                    </div>

                    {/* Expanded Templates */}
                    {isExpanded && templates.length > 0 && (
                      <div className="border-t border-gray-800 p-4 space-y-2 bg-gray-900/20">
                        <p className="text-xs text-gray-500 mb-3">
                          Fine-tune individual notification types:
                        </p>
                        {templates.map(template => {
                          const isTemplateEnabled = !preferences.disabledNotifications.includes(template.templateId);
                          const isCategoryOff = !isEnabled && !isSecurity;

                          return (
                            <div
                              key={template.templateId}
                              className={`flex items-center justify-between py-2 px-3 rounded ${
                                isCategoryOff ? 'opacity-40' : ''
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <span>{template.icon}</span>
                                <span className="text-sm text-gray-300">{template.name}</span>
                              </div>
                              <Switch
                                checked={isTemplateEnabled && !isCategoryOff}
                                disabled={isCategoryOff}
                                onCheckedChange={enabled => toggleTemplate(template.templateId, enabled)}
                              />
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* Quiet Hours */}
          <Card className="bg-gray-900/50 border-gray-800">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Clock className="h-5 w-5 text-gray-400" />
                  <div>
                    <CardTitle className="text-white text-lg">Quiet Hours</CardTitle>
                    <CardDescription>Pause notifications during specific hours</CardDescription>
                  </div>
                </div>
                <Switch
                  checked={preferences.quietHoursEnabled}
                  onCheckedChange={enabled => updatePreferences({ quietHoursEnabled: enabled })}
                />
              </div>
            </CardHeader>
            {preferences.quietHoursEnabled && (
              <CardContent>
                <div className="flex items-center gap-4">
                  <div>
                    <Label className="text-gray-400 text-xs">From</Label>
                    <Input
                      type="time"
                      value={preferences.quietHoursStart || '22:00'}
                      onChange={e => updatePreferences({ quietHoursStart: e.target.value })}
                      className="w-32 bg-gray-800 border-gray-700 text-white"
                    />
                  </div>
                  <span className="text-gray-500 mt-5">to</span>
                  <div>
                    <Label className="text-gray-400 text-xs">Until</Label>
                    <Input
                      type="time"
                      value={preferences.quietHoursEnd || '08:00'}
                      onChange={e => updatePreferences({ quietHoursEnd: e.target.value })}
                      className="w-32 bg-gray-800 border-gray-700 text-white"
                    />
                  </div>
                </div>
              </CardContent>
            )}
          </Card>

          {/* Reset Button */}
          <div className="flex justify-end">
            <Button
              variant="outline"
              onClick={resetToDefaults}
              className="border-gray-700 text-gray-400 hover:text-white"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Reset to Defaults
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

