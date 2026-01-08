'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
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
  { value: 'least_customers', label: 'Least Customers First', description: 'Balance workload evenly' },
  { value: 'round_robin', label: 'Round Robin', description: 'Rotate assignments A→B→C' },
  { value: 'newest_employee', label: 'Newest Employee First', description: 'Good for training' },
  { value: 'oldest_employee', label: 'Oldest Employee First', description: 'Experience priority' },
  { value: 'random', label: 'Random', description: 'Random selection' },
];

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
        // Set available roles from API (dynamically from role templates)
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
        // Update available roles in case templates changed
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
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="text-center py-12 text-gray-400">
        <AlertCircle className="h-12 w-12 mx-auto mb-3" />
        <p>Failed to load settings</p>
        <Button onClick={fetchSettings} className="mt-4">
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-blue-400" />
            Customer Assignment Settings
          </h2>
          <p className="text-sm text-gray-400 mt-1">
            Configure how customers are assigned to employees
          </p>
        </div>
        <div className="flex items-center gap-2">
          {hasChanges && (
            <Badge variant="outline" className="bg-yellow-500/10 text-yellow-400 border-yellow-500/30">
              Unsaved Changes
            </Badge>
          )}
          <Button
            onClick={handleSave}
            disabled={saving || !hasChanges}
            className="bg-blue-600 hover:bg-blue-700"
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

      {/* Auto-Assignment Section */}
      <Card className="bg-gray-900/50 border-gray-800">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Shuffle className="h-5 w-5 text-emerald-400" />
            Auto-Assignment
          </CardTitle>
          <CardDescription className="text-gray-400">
            Automatically assign new customers to employees
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-white">Enable Auto-Assignment</Label>
              <p className="text-sm text-gray-400">
                Automatically assign new customers when they register
              </p>
            </div>
            <Switch
              checked={settings.autoAssignEnabled}
              onCheckedChange={(checked) => updateSetting('autoAssignEnabled', checked)}
            />
          </div>

          {settings.autoAssignEnabled && (
            <>
              <div className="space-y-2">
                <Label className="text-gray-300">Assignment Strategy</Label>
                <Select
                  value={settings.assignmentStrategy}
                  onValueChange={(value) => updateSetting('assignmentStrategy', value)}
                >
                  <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-700">
                    {STRATEGIES.map((strategy) => (
                      <SelectItem key={strategy.value} value={strategy.value} className="text-white">
                        <div>
                          <p className="font-medium">{strategy.label}</p>
                          <p className="text-xs text-gray-400">{strategy.description}</p>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-gray-300">Assignable Roles</Label>
                <p className="text-xs text-gray-500">
                  Select which employee roles can be assigned customers. 
                  Roles are loaded from your Employee Role Templates.
                </p>
                {availableRoles.length === 0 ? (
                  <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-yellow-400 mt-0.5" />
                    <p className="text-sm text-yellow-400">
                      No role templates found. Create role templates in the Employees section first.
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {availableRoles.map((role) => (
                      <Badge
                        key={role.name}
                        variant="outline"
                        className={`cursor-pointer transition-colors ${
                          settings.assignableRoles?.includes(role.name)
                            ? 'bg-blue-500/20 text-blue-400 border-blue-500/50'
                            : 'bg-gray-800 text-gray-400 border-gray-700 hover:bg-gray-700'
                        }`}
                        onClick={() => toggleRole(role.name)}
                        title={role.description}
                      >
                        {settings.assignableRoles?.includes(role.name) && (
                          <CheckCircle className="h-3 w-3 mr-1" />
                        )}
                        {role.name}
                      </Badge>
                    ))}
                  </div>
                )}
                {settings.assignableRoles?.length === 0 && availableRoles.length > 0 && (
                  <p className="text-xs text-orange-400 mt-1">
                    ⚠️ No roles selected. Auto-assignment won't work until at least one role is selected.
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label className="text-gray-300">Max Customers Per Employee</Label>
                <p className="text-xs text-gray-500">Set to 0 for unlimited</p>
                <Input
                  type="number"
                  min="0"
                  value={settings.maxCustomersPerEmployee}
                  onChange={(e) => updateSetting('maxCustomersPerEmployee', parseInt(e.target.value) || 0)}
                  className="bg-gray-800 border-gray-700 text-white w-32"
                />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Reassignment on Delete Section */}
      <Card className="bg-gray-900/50 border-gray-800">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <ArrowUpDown className="h-5 w-5 text-orange-400" />
            Employee Deletion Handling
          </CardTitle>
          <CardDescription className="text-gray-400">
            What happens when an employee is deleted
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-white">Auto-Reassign Customers</Label>
              <p className="text-sm text-gray-400">
                Automatically reassign customers to other employees when one is deleted
              </p>
            </div>
            <Switch
              checked={settings.autoReassignOnEmployeeDelete}
              onCheckedChange={(checked) => updateSetting('autoReassignOnEmployeeDelete', checked)}
            />
          </div>

          {settings.autoReassignOnEmployeeDelete && (
            <div className="space-y-2">
              <Label className="text-gray-300">Reassignment Strategy</Label>
              <Select
                value={settings.reassignmentStrategy}
                onValueChange={(value) => updateSetting('reassignmentStrategy', value)}
              >
                <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-700">
                  {STRATEGIES.map((strategy) => (
                    <SelectItem key={strategy.value} value={strategy.value} className="text-white">
                      <div>
                        <p className="font-medium">{strategy.label}</p>
                        <p className="text-xs text-gray-400">{strategy.description}</p>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {!settings.autoReassignOnEmployeeDelete && (
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-yellow-400 mt-0.5" />
              <p className="text-sm text-yellow-400">
                When disabled, customers will become unassigned when their employee is deleted
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Access Control Section */}
      <Card className="bg-gray-900/50 border-gray-800">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Settings className="h-5 w-5 text-purple-400" />
            Access Control
          </CardTitle>
          <CardDescription className="text-gray-400">
            Control which departments can access customer data
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-white">Backoffice: Edit Only Own Customers</Label>
              <p className="text-sm text-gray-400">
                Backoffice employees can only edit customers assigned to them
              </p>
            </div>
            <Switch
              checked={settings.backofficeCanOnlyEditOwn}
              onCheckedChange={(checked) => updateSetting('backofficeCanOnlyEditOwn', checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-white">Finance: Process Any Customer</Label>
              <p className="text-sm text-gray-400">
                Finance can process payments for any customer regardless of assignment
              </p>
            </div>
            <Switch
              checked={settings.financeBypassAssignment}
              onCheckedChange={(checked) => updateSetting('financeBypassAssignment', checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-white">Compliance: Process Any Customer</Label>
              <p className="text-sm text-gray-400">
                Compliance can review KYC for any customer regardless of assignment
              </p>
            </div>
            <Switch
              checked={settings.complianceBypassAssignment}
              onCheckedChange={(checked) => updateSetting('complianceBypassAssignment', checked)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Self-Assignment Section */}
      <Card className="bg-gray-900/50 border-gray-800">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Users className="h-5 w-5 text-cyan-400" />
            Self-Assignment
          </CardTitle>
          <CardDescription className="text-gray-400">
            Allow employees to assign themselves to customers
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-white">Allow Self-Assignment</Label>
              <p className="text-sm text-gray-400">
                Employees can claim unassigned customers
              </p>
            </div>
            <Switch
              checked={settings.allowSelfAssignment}
              onCheckedChange={(checked) => updateSetting('allowSelfAssignment', checked)}
            />
          </div>

          {settings.allowSelfAssignment && (
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-white">Require Admin Approval</Label>
                <p className="text-sm text-gray-400">
                  Self-assignments need admin approval before becoming active
                </p>
              </div>
              <Switch
                checked={settings.requireApprovalForSelfAssign}
                onCheckedChange={(checked) => updateSetting('requireApprovalForSelfAssign', checked)}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Notifications Section */}
      <Card className="bg-gray-900/50 border-gray-800">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Info className="h-5 w-5 text-blue-400" />
            Notifications
          </CardTitle>
          <CardDescription className="text-gray-400">
            Configure assignment notifications
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-white">Notify Employee</Label>
              <p className="text-sm text-gray-400">
                Send notification when a customer is assigned to an employee
              </p>
            </div>
            <Switch
              checked={settings.notifyEmployeeOnAssignment}
              onCheckedChange={(checked) => updateSetting('notifyEmployeeOnAssignment', checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-white">Notify Customer</Label>
              <p className="text-sm text-gray-400">
                Send email to customer when they are assigned an agent
              </p>
            </div>
            <Switch
              checked={settings.notifyCustomerOnAssignment}
              onCheckedChange={(checked) => updateSetting('notifyCustomerOnAssignment', checked)}
            />
          </div>
        </CardContent>
      </Card>

      {/* UI Settings Section */}
      <Card className="bg-gray-900/50 border-gray-800">
        <CardHeader>
          <CardTitle className="text-white">Display Settings</CardTitle>
          <CardDescription className="text-gray-400">
            Configure how assignments are displayed
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-white">Show Unassigned First</Label>
              <p className="text-sm text-gray-400">
                Display unassigned customers at the top of the user list
              </p>
            </div>
            <Switch
              checked={settings.showUnassignedFirst}
              onCheckedChange={(checked) => updateSetting('showUnassignedFirst', checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-white">Highlight Unassigned</Label>
              <p className="text-sm text-gray-400">
                Visually highlight customers who need to be assigned
              </p>
            </div>
            <Switch
              checked={settings.highlightUnassigned}
              onCheckedChange={(checked) => updateSetting('highlightUnassigned', checked)}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default CustomerAssignmentSettings;
