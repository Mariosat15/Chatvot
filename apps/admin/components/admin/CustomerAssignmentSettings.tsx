'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Users,
  Settings,
  RefreshCw,
  Save,
  AlertCircle,
  CheckCircle,
  Info,
  UserPlus,
  Shuffle,
  ArrowUpDown,
  Shield,
  Bell,
  Eye,
  Zap,
  UserCheck,
  Mail,
  HelpCircle,
  Trash2,
  Lock,
} from 'lucide-react';
import { toast } from 'sonner';

interface AssignmentSettings {
  autoAssignEnabled: boolean;
  assignmentStrategy: string;
  assignableRoles: string[];
  maxCustomersPerEmployee: number;
  autoReassignOnEmployeeDelete: boolean;
  reassignmentStrategy: string;
  notifyEmployeeOnAssignment: boolean;
  notifyCustomerOnAssignment: boolean;
  backofficeCanOnlyEditOwn: boolean;
  financeBypassAssignment: boolean;
  complianceBypassAssignment: boolean;
  allowSelfAssignment: boolean;
  requireApprovalForSelfAssign: boolean;
  showUnassignedFirst: boolean;
  highlightUnassigned: boolean;
}

interface AvailableRole {
  name: string;
  description: string;
}

const STRATEGIES = [
  { value: 'least_customers', label: 'Least Customers First', description: 'Balance workload evenly', icon: '⚖️' },
  { value: 'round_robin', label: 'Round Robin', description: 'Rotate assignments A→B→C', icon: '🔄' },
  { value: 'newest_employee', label: 'Newest Employee First', description: 'Good for training', icon: '🆕' },
  { value: 'oldest_employee', label: 'Oldest Employee First', description: 'Experience priority', icon: '👴' },
  { value: 'random', label: 'Random', description: 'Random selection', icon: '🎲' },
];

// Toggle Setting Row Component
function SettingToggle({
  label,
  description,
  checked,
  onCheckedChange,
  icon: Icon,
  iconColor = 'text-gray-400',
  disabled = false,
}: {
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  icon?: React.ElementType;
  iconColor?: string;
  disabled?: boolean;
}) {
  return (
    <div className={`flex items-center justify-between py-3 px-4 rounded-lg bg-gray-800/50 border border-gray-700/50 ${disabled ? 'opacity-50' : ''}`}>
      <div className="flex items-start gap-3">
        {Icon && <Icon className={`h-5 w-5 mt-0.5 ${iconColor}`} />}
        <div>
          <Label className="text-white font-medium">{label}</Label>
          <p className="text-sm text-gray-400 mt-0.5">{description}</p>
        </div>
      </div>
      <Switch
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        className="data-[state=checked]:bg-blue-600"
      />
    </div>
  );
}

// Section Header Component
function SectionHeader({
  icon: Icon,
  iconColor,
  title,
  description,
  badge,
}: {
  icon: React.ElementType;
  iconColor: string;
  title: string;
  description: string;
  badge?: { text: string; variant: 'success' | 'warning' | 'info' };
}) {
  return (
    <div className="flex items-start justify-between mb-6">
      <div className="flex items-start gap-4">
        <div className={`p-3 rounded-xl ${iconColor.replace('text-', 'bg-').replace('400', '500/20')}`}>
          <Icon className={`h-6 w-6 ${iconColor}`} />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-white">{title}</h3>
          <p className="text-sm text-gray-400 mt-1">{description}</p>
        </div>
      </div>
      {badge && (
        <Badge 
          variant="outline" 
          className={`
            ${badge.variant === 'success' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : ''}
            ${badge.variant === 'warning' ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30' : ''}
            ${badge.variant === 'info' ? 'bg-blue-500/10 text-blue-400 border-blue-500/30' : ''}
          `}
        >
          {badge.text}
        </Badge>
      )}
    </div>
  );
}

export function CustomerAssignmentSettings() {
  const [settings, setSettings] = useState<AssignmentSettings | null>(null);
  const [availableRoles, setAvailableRoles] = useState<AvailableRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [originalSettings, setOriginalSettings] = useState<AssignmentSettings | null>(null);

  useEffect(() => {
    fetchSettings();
  }, []);

  useEffect(() => {
    if (settings && originalSettings) {
      setHasChanges(JSON.stringify(settings) !== JSON.stringify(originalSettings));
    }
  }, [settings, originalSettings]);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/customer-assignments/settings');
      const data = await response.json();

      if (data.success) {
        setSettings(data.settings);
        setOriginalSettings(data.settings);
        if (data.availableRoles) {
          setAvailableRoles(data.availableRoles);
        }
      } else {
        toast.error(data.error || 'Failed to fetch settings');
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
      toast.error('Failed to fetch settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!settings) return;

    try {
      setSaving(true);
      const response = await fetch('/api/customer-assignments/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });

      const data = await response.json();

      if (data.success) {
        toast.success('Settings saved successfully');
        setOriginalSettings(data.settings);
        setHasChanges(false);
        if (data.availableRoles) {
          setAvailableRoles(data.availableRoles);
        }
      } else {
        toast.error(data.error || 'Failed to save settings');
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const updateSetting = <K extends keyof AssignmentSettings>(
    key: K,
    value: AssignmentSettings[K]
  ) => {
    if (!settings) return;
    setSettings({ ...settings, [key]: value });
  };

  const toggleRole = (role: string) => {
    if (!settings) return;
    const roles = settings.assignableRoles || [];
    if (roles.includes(role)) {
      updateSetting('assignableRoles', roles.filter(r => r !== role));
    } else {
      updateSetting('assignableRoles', [...roles, role]);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <RefreshCw className="h-10 w-10 animate-spin text-blue-400 mx-auto mb-4" />
          <p className="text-gray-400">Loading settings...</p>
        </div>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="text-center py-20">
        <AlertCircle className="h-16 w-16 mx-auto mb-4 text-red-400" />
        <p className="text-gray-300 text-lg mb-4">Failed to load settings</p>
        <Button onClick={fetchSettings} variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" />
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-8">
      {/* Page Header */}
      <div className="bg-gradient-to-r from-blue-600/20 via-purple-600/20 to-pink-600/20 rounded-2xl p-6 border border-gray-700/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-500/20 rounded-xl">
              <UserPlus className="h-8 w-8 text-blue-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Customer Assignment Settings</h1>
              <p className="text-gray-400 mt-1">Configure how customers are assigned to employees</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {hasChanges && (
              <Badge variant="outline" className="bg-amber-500/10 text-amber-400 border-amber-500/30 animate-pulse">
                <AlertCircle className="h-3 w-3 mr-1" />
                Unsaved Changes
              </Badge>
            )}
            <Button
              onClick={handleSave}
              disabled={saving || !hasChanges}
              className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800"
            >
              {saving ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Settings
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Main Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* LEFT COLUMN */}
        <div className="space-y-6">
          
          {/* Auto-Assignment Section */}
          <Card className="bg-gray-900/80 border-gray-700/50 overflow-hidden">
            <CardContent className="p-6">
              <SectionHeader
                icon={Zap}
                iconColor="text-emerald-400"
                title="Auto-Assignment"
                description="Automatically assign new customers"
                badge={settings.autoAssignEnabled ? { text: 'Enabled', variant: 'success' } : { text: 'Disabled', variant: 'warning' }}
              />
              
              <div className="space-y-4">
                <SettingToggle
                  icon={Shuffle}
                  iconColor="text-emerald-400"
                  label="Enable Auto-Assignment"
                  description="Automatically assign new customers when they register"
                  checked={settings.autoAssignEnabled}
                  onCheckedChange={(checked) => updateSetting('autoAssignEnabled', checked)}
                />

                {settings.autoAssignEnabled && (
                  <>
                    <div className="ml-8 p-4 bg-gray-800/50 rounded-lg border border-gray-700/50 space-y-4">
                      <div className="space-y-2">
                        <Label className="text-gray-300 flex items-center gap-2">
                          <Settings className="h-4 w-4" />
                          Assignment Strategy
                        </Label>
                        <Select
                          value={settings.assignmentStrategy}
                          onValueChange={(value) => updateSetting('assignmentStrategy', value)}
                        >
                          <SelectTrigger className="bg-gray-800 border-gray-600 text-white">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-gray-800 border-gray-700">
                            {STRATEGIES.map((strategy) => (
                              <SelectItem key={strategy.value} value={strategy.value} className="text-white">
                                <div className="flex items-center gap-2">
                                  <span>{strategy.icon}</span>
                                  <span>{strategy.label}</span>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-gray-500">
                          {STRATEGIES.find(s => s.value === settings.assignmentStrategy)?.description}
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-gray-300 flex items-center gap-2">
                          <Users className="h-4 w-4" />
                          Max Customers Per Employee
                        </Label>
                        <div className="flex items-center gap-3">
                          <Input
                            type="number"
                            min="0"
                            value={settings.maxCustomersPerEmployee}
                            onChange={(e) => updateSetting('maxCustomersPerEmployee', parseInt(e.target.value) || 0)}
                            className="bg-gray-800 border-gray-600 text-white w-24"
                          />
                          <span className="text-sm text-gray-400">
                            {settings.maxCustomersPerEmployee === 0 ? '(Unlimited)' : 'customers max'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Assignable Roles */}
                    <div className="space-y-3">
                      <Label className="text-gray-300 flex items-center gap-2">
                        <Shield className="h-4 w-4" />
                        Assignable Roles
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger>
                              <HelpCircle className="h-4 w-4 text-gray-500" />
                            </TooltipTrigger>
                            <TooltipContent className="bg-gray-800 border-gray-700">
                              <p className="max-w-xs">Select which employee roles can be assigned customers. Roles come from your Employee Role Templates.</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </Label>
                      
                      {availableRoles.length === 0 ? (
                        <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 flex items-start gap-2">
                          <AlertCircle className="h-4 w-4 text-amber-400 mt-0.5" />
                          <div>
                            <p className="text-sm text-amber-400 font-medium">No role templates found</p>
                            <p className="text-xs text-amber-400/70">Create role templates in the Employees section first.</p>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {availableRoles.map((role) => {
                            const isSelected = settings.assignableRoles?.includes(role.name);
                            return (
                              <Badge
                                key={role.name}
                                variant="outline"
                                className={`cursor-pointer transition-all duration-200 ${
                                  isSelected
                                    ? 'bg-blue-500/20 text-blue-400 border-blue-500/50 shadow-sm shadow-blue-500/20'
                                    : 'bg-gray-800 text-gray-400 border-gray-700 hover:bg-gray-700 hover:border-gray-600'
                                }`}
                                onClick={() => toggleRole(role.name)}
                                title={role.description}
                              >
                                {isSelected && <CheckCircle className="h-3 w-3 mr-1" />}
                                {role.name}
                              </Badge>
                            );
                          })}
                        </div>
                      )}
                      
                      {settings.assignableRoles?.length === 0 && availableRoles.length > 0 && (
                        <p className="text-xs text-amber-400">
                          ⚠️ No roles selected. Auto-assignment won't work.
                        </p>
                      )}
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Employee Deletion Handling */}
          <Card className="bg-gray-900/80 border-gray-700/50 overflow-hidden">
            <CardContent className="p-6">
              <SectionHeader
                icon={Trash2}
                iconColor="text-orange-400"
                title="Employee Deletion Handling"
                description="What happens when an employee is deleted"
              />
              
              <div className="space-y-4">
                <SettingToggle
                  icon={ArrowUpDown}
                  iconColor="text-orange-400"
                  label="Auto-Reassign Customers"
                  description="Automatically reassign customers when their employee is deleted"
                  checked={settings.autoReassignOnEmployeeDelete}
                  onCheckedChange={(checked) => updateSetting('autoReassignOnEmployeeDelete', checked)}
                />

                {settings.autoReassignOnEmployeeDelete && (
                  <div className="ml-8 p-4 bg-gray-800/50 rounded-lg border border-gray-700/50">
                    <Label className="text-gray-300 flex items-center gap-2 mb-2">
                      <Settings className="h-4 w-4" />
                      Reassignment Strategy
                    </Label>
                    <Select
                      value={settings.reassignmentStrategy}
                      onValueChange={(value) => updateSetting('reassignmentStrategy', value)}
                    >
                      <SelectTrigger className="bg-gray-800 border-gray-600 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-gray-800 border-gray-700">
                        {STRATEGIES.map((strategy) => (
                          <SelectItem key={strategy.value} value={strategy.value} className="text-white">
                            <div className="flex items-center gap-2">
                              <span>{strategy.icon}</span>
                              <span>{strategy.label}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {!settings.autoReassignOnEmployeeDelete && (
                  <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-amber-400 mt-0.5" />
                    <p className="text-sm text-amber-400">
                      When disabled, customers will become unassigned when their employee is deleted
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Self-Assignment */}
          <Card className="bg-gray-900/80 border-gray-700/50 overflow-hidden">
            <CardContent className="p-6">
              <SectionHeader
                icon={UserCheck}
                iconColor="text-cyan-400"
                title="Self-Assignment"
                description="Allow employees to claim customers themselves"
              />
              
              <div className="space-y-4">
                <SettingToggle
                  icon={UserPlus}
                  iconColor="text-cyan-400"
                  label="Allow Self-Assignment"
                  description="Employees can claim unassigned customers"
                  checked={settings.allowSelfAssignment}
                  onCheckedChange={(checked) => updateSetting('allowSelfAssignment', checked)}
                />

                {settings.allowSelfAssignment && (
                  <div className="ml-8">
                    <SettingToggle
                      icon={CheckCircle}
                      iconColor="text-cyan-400"
                      label="Require Admin Approval"
                      description="Self-assignments need admin approval before becoming active"
                      checked={settings.requireApprovalForSelfAssign}
                      onCheckedChange={(checked) => updateSetting('requireApprovalForSelfAssign', checked)}
                    />
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* RIGHT COLUMN */}
        <div className="space-y-6">
          
          {/* Notifications Section */}
          <Card className="bg-gradient-to-br from-blue-900/30 to-purple-900/30 border-blue-500/30 overflow-hidden">
            <CardContent className="p-6">
              <SectionHeader
                icon={Bell}
                iconColor="text-blue-400"
                title="Notifications"
                description="Configure assignment notifications"
                badge={{ text: 'Important', variant: 'info' }}
              />
              
              <div className="space-y-4">
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-blue-500/20 rounded-lg">
                      <Mail className="h-5 w-5 text-blue-400" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="text-white font-medium">Employee Notifications</h4>
                          <p className="text-sm text-gray-400 mt-1">
                            Send email notification when a customer is assigned to an employee
                          </p>
                        </div>
                        <Switch
                          checked={settings.notifyEmployeeOnAssignment}
                          onCheckedChange={(checked) => updateSetting('notifyEmployeeOnAssignment', checked)}
                          className="data-[state=checked]:bg-blue-600"
                        />
                      </div>
                      {settings.notifyEmployeeOnAssignment && (
                        <div className="mt-3 flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-emerald-400" />
                          <span className="text-xs text-emerald-400">Employees will receive email when assigned a customer</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-purple-500/20 rounded-lg">
                      <Users className="h-5 w-5 text-purple-400" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="text-white font-medium">Customer Notifications</h4>
                          <p className="text-sm text-gray-400 mt-1">
                            Send email to customer when they are assigned a dedicated agent
                          </p>
                        </div>
                        <Switch
                          checked={settings.notifyCustomerOnAssignment}
                          onCheckedChange={(checked) => updateSetting('notifyCustomerOnAssignment', checked)}
                          className="data-[state=checked]:bg-purple-600"
                        />
                      </div>
                      {settings.notifyCustomerOnAssignment && (
                        <div className="mt-3 flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-emerald-400" />
                          <span className="text-xs text-emerald-400">Customers will receive email about their assigned agent</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="bg-gray-800/50 rounded-lg p-3 flex items-start gap-2">
                  <Info className="h-4 w-4 text-gray-400 mt-0.5" />
                  <p className="text-xs text-gray-400">
                    Notification emails use the templates configured in Settings → Email Templates. 
                    Make sure you have templates for "customer_assigned_employee" and "customer_assigned_customer".
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Access Control */}
          <Card className="bg-gray-900/80 border-gray-700/50 overflow-hidden">
            <CardContent className="p-6">
              <SectionHeader
                icon={Lock}
                iconColor="text-purple-400"
                title="Access Control"
                description="Control who can access customer data"
              />
              
              <div className="space-y-4">
                <SettingToggle
                  icon={Users}
                  iconColor="text-purple-400"
                  label="Backoffice: Edit Only Own Customers"
                  description="Backoffice employees can only edit customers assigned to them"
                  checked={settings.backofficeCanOnlyEditOwn}
                  onCheckedChange={(checked) => updateSetting('backofficeCanOnlyEditOwn', checked)}
                />

                <Separator className="bg-gray-700/50" />

                <div className="space-y-3">
                  <Label className="text-gray-300 text-sm flex items-center gap-2">
                    <Shield className="h-4 w-4" />
                    Department Bypass Rules
                  </Label>
                  <p className="text-xs text-gray-500 -mt-1">
                    Allow certain departments to process any customer regardless of assignment
                  </p>
                  
                  <SettingToggle
                    label="Finance: Process Any Customer"
                    description="Finance can process payments for any customer"
                    checked={settings.financeBypassAssignment}
                    onCheckedChange={(checked) => updateSetting('financeBypassAssignment', checked)}
                  />

                  <SettingToggle
                    label="Compliance: Process Any Customer"
                    description="Compliance can review KYC for any customer"
                    checked={settings.complianceBypassAssignment}
                    onCheckedChange={(checked) => updateSetting('complianceBypassAssignment', checked)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Display Settings */}
          <Card className="bg-gray-900/80 border-gray-700/50 overflow-hidden">
            <CardContent className="p-6">
              <SectionHeader
                icon={Eye}
                iconColor="text-gray-400"
                title="Display Settings"
                description="Configure how assignments appear in the UI"
              />
              
              <div className="space-y-4">
                <SettingToggle
                  icon={ArrowUpDown}
                  iconColor="text-gray-400"
                  label="Show Unassigned First"
                  description="Display unassigned customers at the top of user lists"
                  checked={settings.showUnassignedFirst}
                  onCheckedChange={(checked) => updateSetting('showUnassignedFirst', checked)}
                />

                <SettingToggle
                  icon={AlertCircle}
                  iconColor="text-amber-400"
                  label="Highlight Unassigned"
                  description="Visually highlight customers who need to be assigned"
                  checked={settings.highlightUnassigned}
                  onCheckedChange={(checked) => updateSetting('highlightUnassigned', checked)}
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Floating Save Button for Mobile */}
      {hasChanges && (
        <div className="fixed bottom-6 right-6 lg:hidden">
          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-600/30"
            size="lg"
          >
            {saving ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}

export default CustomerAssignmentSettings;
