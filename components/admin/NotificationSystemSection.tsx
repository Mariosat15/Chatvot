'use client';

import { useState, useEffect } from 'react';
import { 
  Bell, Send, Settings, Trash2, Edit, Save, 
  RefreshCw, CheckCircle, Users, User,
  Search, ToggleLeft, ToggleRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
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
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { toast } from 'sonner';

interface NotificationTemplate {
  _id: string;
  templateId: string;
  name: string;
  description: string;
  category: string;
  type: string;
  title: string;
  message: string;
  icon: string;
  priority: string;
  color: string;
  isEnabled: boolean;
  isDefault: boolean;
  isCustom: boolean;
  channels: { inApp: boolean; email: boolean; push: boolean };
  actionUrl?: string;
  actionText?: string;
}

interface NotificationStats {
  totalSent: number;
  unreadCount: number;
  templateCount: number;
  enabledCount: number;
  byCategory: Record<string, number>;
}

const CATEGORY_LABELS: Record<string, { label: string; icon: string; color: string }> = {
  purchase: { label: 'Purchases & Wallet', icon: '💳', color: 'text-blue-400' },
  competition: { label: 'Competitions', icon: '🏆', color: 'text-yellow-400' },
  trading: { label: 'Trading', icon: '📈', color: 'text-green-400' },
  achievement: { label: 'Achievements', icon: '🏅', color: 'text-purple-400' },
  system: { label: 'System', icon: '⚙️', color: 'text-gray-400' },
  admin: { label: 'Admin Messages', icon: '📢', color: 'text-orange-400' },
  security: { label: 'Security', icon: '🔐', color: 'text-red-400' },
};

const PRIORITY_COLORS: Record<string, string> = {
  low: 'bg-gray-500/20 text-gray-400',
  normal: 'bg-blue-500/20 text-blue-400',
  high: 'bg-orange-500/20 text-orange-400',
  urgent: 'bg-red-500/20 text-red-400',
};

export default function NotificationSystemSection() {
  const [templates, setTemplates] = useState<NotificationTemplate[]>([]);
  const [_groupedTemplates, setGroupedTemplates] = useState<Record<string, NotificationTemplate[]>>({});
  const [stats, setStats] = useState<NotificationStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('templates');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Send notification state
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [sendType, setSendType] = useState<'instant' | 'template'>('instant');
  const [sendTarget, setSendTarget] = useState<'all' | 'specific'>('all');
  const [targetUserIds, setTargetUserIds] = useState('');
  const [instantTitle, setInstantTitle] = useState('');
  const [instantMessage, setInstantMessage] = useState('');
  const [instantCategory, setInstantCategory] = useState('admin');
  const [instantPriority, setInstantPriority] = useState('normal');
  const [instantIcon, setInstantIcon] = useState('📢');
  const [sending, setSending] = useState(false);

  // Edit template state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<NotificationTemplate | null>(null);
  const [editForm, setEditForm] = useState({
    name: '',
    title: '',
    message: '',
    icon: '',
    priority: 'normal',
    color: '#FDD458',
    actionUrl: '',
    actionText: '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [templatesRes, statsRes] = await Promise.all([
        fetch('/api/admin/notifications'),
        fetch('/api/admin/notifications?action=stats'),
      ]);

      if (templatesRes.ok) {
        const data = await templatesRes.json();
        setTemplates(data.templates || []);
        setGroupedTemplates(data.grouped || {});
      }

      if (statsRes.ok) {
        const data = await statsRes.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load notification data');
    } finally {
      setLoading(false);
    }
  };

  const handleSeedDefaults = async () => {
    try {
      const response = await fetch('/api/admin/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'seed_defaults' }),
      });

      if (response.ok) {
        toast.success('Default templates seeded successfully');
        fetchData();
      } else {
        toast.error('Failed to seed templates');
      }
    } catch (_error) {
      toast.error('Failed to seed templates');
    }
  };

  const handleToggleTemplate = async (templateId: string, isEnabled: boolean) => {
    try {
      const response = await fetch('/api/admin/notifications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateId, action: 'toggle', isEnabled }),
      });

      if (response.ok) {
        setTemplates(prev => prev.map(t => 
          t.templateId === templateId ? { ...t, isEnabled } : t
        ));
        toast.success(`Template ${isEnabled ? 'enabled' : 'disabled'}`);
      }
    } catch (_error) {
      toast.error('Failed to toggle template');
    }
  };

  const handleToggleAll = async (isEnabled: boolean) => {
    try {
      const response = await fetch('/api/admin/notifications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateId: 'all', action: 'toggle_all', isEnabled }),
      });

      if (response.ok) {
        setTemplates(prev => prev.map(t => ({ ...t, isEnabled })));
        toast.success(`All templates ${isEnabled ? 'enabled' : 'disabled'}`);
      }
    } catch (_error) {
      toast.error('Failed to toggle templates');
    }
  };

  const handleSendNotification = async () => {
    if (sendType === 'instant' && (!instantTitle || !instantMessage)) {
      toast.error('Title and message are required');
      return;
    }

    setSending(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const body: any = {
        action: 'send_instant',
        title: instantTitle,
        message: instantMessage,
        category: instantCategory,
        priority: instantPriority,
        icon: instantIcon,
      };

      if (sendTarget === 'all') {
        body.userId = 'all';
      } else {
        // Parse comma-separated user IDs
        const userIds = targetUserIds.split(',').map(id => id.trim()).filter(Boolean);
        if (userIds.length === 0) {
          toast.error('Please enter at least one user ID');
          setSending(false);
          return;
        }
        body.userId = userIds[0]; // For now, single user
      }

      const response = await fetch('/api/admin/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        const data = await response.json();
        toast.success(data.message);
        setSendDialogOpen(false);
        setInstantTitle('');
        setInstantMessage('');
        fetchData();
      } else {
        const data = await response.json();
        toast.error(data.error || 'Failed to send notification');
      }
    } catch (_error) {
      toast.error('Failed to send notification');
    } finally {
      setSending(false);
    }
  };

  const handleEditTemplate = (template: NotificationTemplate) => {
    setEditingTemplate(template);
    setEditForm({
      name: template.name,
      title: template.title,
      message: template.message,
      icon: template.icon,
      priority: template.priority,
      color: template.color,
      actionUrl: template.actionUrl || '',
      actionText: template.actionText || '',
    });
    setEditDialogOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editingTemplate) return;

    setSaving(true);
    try {
      const response = await fetch('/api/admin/notifications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateId: editingTemplate.templateId,
          ...editForm,
        }),
      });

      if (response.ok) {
        toast.success('Template updated');
        setEditDialogOpen(false);
        fetchData();
      } else {
        toast.error('Failed to update template');
      }
    } catch (_error) {
      toast.error('Failed to update template');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTemplate = async (templateId: string) => {
    if (!confirm('Are you sure you want to delete this template?')) return;

    try {
      const response = await fetch(`/api/admin/notifications?templateId=${templateId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        toast.success('Template deleted');
        fetchData();
      } else {
        const data = await response.json();
        toast.error(data.error || 'Failed to delete template');
      }
    } catch (_error) {
      toast.error('Failed to delete template');
    }
  };

  const filteredTemplates = templates.filter(t =>
    t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.templateId.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-yellow-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Bell className="h-6 w-6 text-yellow-500" />
            Notification System
          </h2>
          <p className="text-gray-400 mt-1">
            Manage notification templates and send notifications to users
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleSeedDefaults}
            className="border-gray-700 text-gray-300 hover:bg-gray-800"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Seed Defaults
          </Button>
          <Dialog open={sendDialogOpen} onOpenChange={setSendDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-yellow-500 hover:bg-yellow-600 text-black">
                <Send className="h-4 w-4 mr-2" />
                Send Notification
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-gray-900 border-gray-800 max-w-lg">
              <DialogHeader>
                <DialogTitle className="text-white">Send Notification</DialogTitle>
                <DialogDescription className="text-gray-400">
                  Send an instant notification to users
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="flex gap-2">
                  <Button
                    variant={sendTarget === 'all' ? 'default' : 'outline'}
                    onClick={() => setSendTarget('all')}
                    className={sendTarget === 'all' ? 'bg-yellow-500 text-black' : 'border-gray-700'}
                  >
                    <Users className="h-4 w-4 mr-2" />
                    All Users
                  </Button>
                  <Button
                    variant={sendTarget === 'specific' ? 'default' : 'outline'}
                    onClick={() => setSendTarget('specific')}
                    className={sendTarget === 'specific' ? 'bg-yellow-500 text-black' : 'border-gray-700'}
                  >
                    <User className="h-4 w-4 mr-2" />
                    Specific User
                  </Button>
                </div>

                {sendTarget === 'specific' && (
                  <div>
                    <Label className="text-gray-300">User ID</Label>
                    <Input
                      value={targetUserIds}
                      onChange={e => setTargetUserIds(e.target.value)}
                      placeholder="Enter user ID"
                      className="mt-1 bg-gray-800 border-gray-700 text-white"
                    />
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-gray-300">Category</Label>
                    <Select value={instantCategory} onValueChange={setInstantCategory}>
                      <SelectTrigger className="mt-1 bg-gray-800 border-gray-700 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-gray-800 border-gray-700">
                        {Object.entries(CATEGORY_LABELS).map(([key, { label, icon }]) => (
                          <SelectItem key={key} value={key} className="text-white">
                            {icon} {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-gray-300">Priority</Label>
                    <Select value={instantPriority} onValueChange={setInstantPriority}>
                      <SelectTrigger className="mt-1 bg-gray-800 border-gray-700 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-gray-800 border-gray-700">
                        <SelectItem value="low" className="text-white">Low</SelectItem>
                        <SelectItem value="normal" className="text-white">Normal</SelectItem>
                        <SelectItem value="high" className="text-white">High</SelectItem>
                        <SelectItem value="urgent" className="text-white">Urgent</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-4">
                  <div className="col-span-1">
                    <Label className="text-gray-300">Icon</Label>
                    <Input
                      value={instantIcon}
                      onChange={e => setInstantIcon(e.target.value)}
                      className="mt-1 bg-gray-800 border-gray-700 text-white text-center text-xl"
                      maxLength={2}
                    />
                  </div>
                  <div className="col-span-3">
                    <Label className="text-gray-300">Title</Label>
                    <Input
                      value={instantTitle}
                      onChange={e => setInstantTitle(e.target.value)}
                      placeholder="Notification title"
                      className="mt-1 bg-gray-800 border-gray-700 text-white"
                    />
                  </div>
                </div>

                <div>
                  <Label className="text-gray-300">Message</Label>
                  <Textarea
                    value={instantMessage}
                    onChange={e => setInstantMessage(e.target.value)}
                    placeholder="Write your notification message..."
                    className="mt-1 bg-gray-800 border-gray-700 text-white min-h-[100px]"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setSendDialogOpen(false)}
                  className="border-gray-700"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSendNotification}
                  disabled={sending}
                  className="bg-yellow-500 hover:bg-yellow-600 text-black"
                >
                  {sending ? (
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4 mr-2" />
                  )}
                  Send
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-4 gap-4">
          <Card className="bg-gray-900/50 border-gray-800">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-400">Total Sent</p>
                  <p className="text-2xl font-bold text-white">{stats.totalSent}</p>
                </div>
                <Send className="h-8 w-8 text-blue-400 opacity-50" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gray-900/50 border-gray-800">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-400">Unread</p>
                  <p className="text-2xl font-bold text-yellow-400">{stats.unreadCount}</p>
                </div>
                <Bell className="h-8 w-8 text-yellow-400 opacity-50" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gray-900/50 border-gray-800">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-400">Templates</p>
                  <p className="text-2xl font-bold text-white">{stats.templateCount}</p>
                </div>
                <Settings className="h-8 w-8 text-gray-400 opacity-50" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gray-900/50 border-gray-800">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-400">Enabled</p>
                  <p className="text-2xl font-bold text-green-400">{stats.enabledCount}</p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-400 opacity-50" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-gray-800 border-gray-700">
          <TabsTrigger value="templates" className="data-[state=active]:bg-yellow-500 data-[state=active]:text-black">
            <Settings className="h-4 w-4 mr-2" />
            Templates
          </TabsTrigger>
        </TabsList>

        {/* Templates Tab */}
        <TabsContent value="templates" className="space-y-4 mt-6">
          {/* Search and Actions */}
          <div className="flex items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
              <Input
                placeholder="Search templates..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-10 bg-gray-800 border-gray-700 text-white"
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => handleToggleAll(true)}
                className="border-green-600 text-green-400 hover:bg-green-950"
              >
                <ToggleRight className="h-4 w-4 mr-2" />
                Enable All
              </Button>
              <Button
                variant="outline"
                onClick={() => handleToggleAll(false)}
                className="border-red-600 text-red-400 hover:bg-red-950"
              >
                <ToggleLeft className="h-4 w-4 mr-2" />
                Disable All
              </Button>
            </div>
          </div>

          {/* Templates by Category */}
          <Accordion type="multiple" defaultValue={Object.keys(CATEGORY_LABELS)} className="space-y-2">
            {Object.entries(CATEGORY_LABELS).map(([category, { label, icon, color }]) => {
              const categoryTemplates = filteredTemplates.filter(t => t.category === category);
              if (categoryTemplates.length === 0) return null;

              return (
                <AccordionItem
                  key={category}
                  value={category}
                  className="border border-gray-800 rounded-lg bg-gray-900/50 overflow-hidden"
                >
                  <AccordionTrigger className="px-4 py-3 hover:bg-gray-800/50">
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{icon}</span>
                      <span className={`font-medium ${color}`}>{label}</span>
                      <Badge variant="secondary" className="bg-gray-800">
                        {categoryTemplates.length}
                      </Badge>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-4">
                    <div className="space-y-2">
                      {categoryTemplates.map(template => (
                        <div
                          key={template.templateId}
                          className={`flex items-center justify-between p-3 rounded-lg border ${
                            template.isEnabled
                              ? 'bg-gray-800/50 border-gray-700'
                              : 'bg-gray-900/50 border-gray-800 opacity-60'
                          }`}
                        >
                          <div className="flex items-center gap-3 flex-1">
                            <span className="text-xl">{template.icon}</span>
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <p className="font-medium text-white">{template.name}</p>
                                <Badge className={PRIORITY_COLORS[template.priority]}>
                                  {template.priority}
                                </Badge>
                                {template.isCustom && (
                                  <Badge className="bg-purple-500/20 text-purple-400">Custom</Badge>
                                )}
                              </div>
                              <p className="text-xs text-gray-500 font-mono">{template.templateId}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditTemplate(template)}
                              className="text-gray-400 hover:text-white"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            {template.isCustom && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteTemplate(template.templateId)}
                                className="text-red-400 hover:text-red-300"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                            <Switch
                              checked={template.isEnabled}
                              onCheckedChange={checked => handleToggleTemplate(template.templateId, checked)}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        </TabsContent>

      </Tabs>

      {/* Edit Template Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="bg-gray-900 border-gray-800 max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-white">Edit Template</DialogTitle>
            <DialogDescription className="text-gray-400">
              {editingTemplate?.templateId}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label className="text-gray-300">Name</Label>
              <Input
                value={editForm.name}
                onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                className="mt-1 bg-gray-800 border-gray-700 text-white"
              />
            </div>
            <div className="grid grid-cols-4 gap-4">
              <div className="col-span-1">
                <Label className="text-gray-300">Icon</Label>
                <Input
                  value={editForm.icon}
                  onChange={e => setEditForm({ ...editForm, icon: e.target.value })}
                  className="mt-1 bg-gray-800 border-gray-700 text-white text-center text-xl"
                  maxLength={2}
                />
              </div>
              <div className="col-span-3">
                <Label className="text-gray-300">Title</Label>
                <Input
                  value={editForm.title}
                  onChange={e => setEditForm({ ...editForm, title: e.target.value })}
                  className="mt-1 bg-gray-800 border-gray-700 text-white"
                />
              </div>
            </div>
            <div>
              <Label className="text-gray-300">Message</Label>
              <Textarea
                value={editForm.message}
                onChange={e => setEditForm({ ...editForm, message: e.target.value })}
                className="mt-1 bg-gray-800 border-gray-700 text-white min-h-[80px]"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-gray-300">Priority</Label>
                <Select
                  value={editForm.priority}
                  onValueChange={v => setEditForm({ ...editForm, priority: v })}
                >
                  <SelectTrigger className="mt-1 bg-gray-800 border-gray-700 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-700">
                    <SelectItem value="low" className="text-white">Low</SelectItem>
                    <SelectItem value="normal" className="text-white">Normal</SelectItem>
                    <SelectItem value="high" className="text-white">High</SelectItem>
                    <SelectItem value="urgent" className="text-white">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-gray-300">Color</Label>
                <Input
                  type="color"
                  value={editForm.color}
                  onChange={e => setEditForm({ ...editForm, color: e.target.value })}
                  className="mt-1 h-10 bg-gray-800 border-gray-700"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditDialogOpen(false)}
              className="border-gray-700"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveEdit}
              disabled={saving}
              className="bg-yellow-500 hover:bg-yellow-600 text-black"
            >
              {saving ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

