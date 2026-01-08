'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Settings,
  Bot,
  Users,
  Bell,
  Shield,
  Clock,
  FileText,
  MessageCircle,
  Zap,
  Save,
  RefreshCw,
  AlertTriangle,
  Plus,
  X,
  Info,
} from 'lucide-react';
import { toast } from 'sonner';

interface MessagingSettings {
  // AI Support
  enableAISupport: boolean;
  aiGreetingMessage: string;
  aiEscalationKeywords: string[];
  aiMaxResponsesBeforeEscalation: number;
  aiSystemPrompt: string;
  aiKnowledgeBaseEnabled: boolean;

  // Auto-routing
  autoAssignToEmployeeEnabled: boolean;
  autoAssignToRoleIfUnassigned: string[];
  roundRobinEnabled: boolean;
  maxConcurrentChatsPerEmployee: number;

  // Notifications
  notifyEmployeeOnNewMessage: boolean;
  notifyEmployeeOnTransfer: boolean;
  notifyUserOnEmployeeReply: boolean;
  notifyUserOnTransfer: boolean;
  unreadReminderAfterMinutes: number;

  // User-to-user
  allowUserToUserChat: boolean;
  requireFriendshipForChat: boolean;
  maxFriendsPerUser: number;

  // File sharing
  allowFileSharing: boolean;
  maxFileSizeMB: number;
  maxFilesPerMessage: number;

  // Content moderation
  enableContentModeration: boolean;
  blockLinksInUserMessages: boolean;

  // Rate limiting
  messagesPerMinuteLimit: number;
  friendRequestsPerDayLimit: number;

  // Data retention
  messageRetentionDays: number;

  // Working hours
  enableWorkingHours: boolean;
  workingHoursStart: string;
  workingHoursEnd: string;
  workingDays: number[];
  workingHoursTimezone: string;
  outsideHoursMessage: string;

  // Misc
  welcomeMessageForNewUsers: string;
  maxMessageLength: number;
  enableTypingIndicators: boolean;
  enableReadReceipts: boolean;
  enableOnlineStatus: boolean;
}

const defaultSettings: MessagingSettings = {
  enableAISupport: false,
  aiGreetingMessage: "Hello! I'm your AI assistant. How can I help you today?",
  aiEscalationKeywords: ['human', 'agent', 'person', 'real person', 'talk to someone'],
  aiMaxResponsesBeforeEscalation: 10,
  aiSystemPrompt: '',
  aiKnowledgeBaseEnabled: true,
  autoAssignToEmployeeEnabled: true,
  autoAssignToRoleIfUnassigned: ['Backoffice', 'Support'],
  roundRobinEnabled: true,
  maxConcurrentChatsPerEmployee: 10,
  notifyEmployeeOnNewMessage: true,
  notifyEmployeeOnTransfer: true,
  notifyUserOnEmployeeReply: true,
  notifyUserOnTransfer: true,
  unreadReminderAfterMinutes: 5,
  allowUserToUserChat: true,
  requireFriendshipForChat: true,
  maxFriendsPerUser: 500,
  allowFileSharing: true,
  maxFileSizeMB: 10,
  maxFilesPerMessage: 5,
  enableContentModeration: true,
  blockLinksInUserMessages: false,
  messagesPerMinuteLimit: 30,
  friendRequestsPerDayLimit: 50,
  messageRetentionDays: 0,
  enableWorkingHours: false,
  workingHoursStart: '09:00',
  workingHoursEnd: '18:00',
  workingDays: [1, 2, 3, 4, 5],
  workingHoursTimezone: 'UTC',
  outsideHoursMessage: "We're currently outside working hours. We'll respond soon!",
  welcomeMessageForNewUsers: '',
  maxMessageLength: 4000,
  enableTypingIndicators: true,
  enableReadReceipts: true,
  enableOnlineStatus: true,
};

const DAYS_OF_WEEK = [
  { value: 0, label: 'Sun' },
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
];

export default function MessagingSettingsSection() {
  const [settings, setSettings] = useState<MessagingSettings>(defaultSettings);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [newKeyword, setNewKeyword] = useState('');
  const [newRole, setNewRole] = useState('');
  const [activeSection, setActiveSection] = useState('ai');

  // Fetch settings
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await fetch('/api/messaging/settings');
        if (response.ok) {
          const data = await response.json();
          setSettings({ ...defaultSettings, ...data.settings });
        }
      } catch (error) {
        console.error('Error fetching settings:', error);
      }
      setIsLoading(false);
    };
    fetchSettings();
  }, []);

  // Save settings
  const handleSave = async () => {
    setIsSaving(true);
    try {
      const response = await fetch('/api/messaging/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });

      if (response.ok) {
        toast.success('Messaging settings saved successfully');
      } else {
        const data = await response.json();
        toast.error(data.error || 'Failed to save settings');
      }
    } catch (error) {
      toast.error('Failed to save settings');
    }
    setIsSaving(false);
  };

  // Toggle setting
  const toggleSetting = (key: keyof MessagingSettings) => {
    setSettings(prev => ({
      ...prev,
      [key]: !prev[key as keyof MessagingSettings],
    }));
  };

  // Update setting
  const updateSetting = (key: keyof MessagingSettings, value: any) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  // Add keyword
  const addKeyword = () => {
    if (newKeyword.trim() && !settings.aiEscalationKeywords.includes(newKeyword.trim())) {
      setSettings(prev => ({
        ...prev,
        aiEscalationKeywords: [...prev.aiEscalationKeywords, newKeyword.trim()],
      }));
      setNewKeyword('');
    }
  };

  // Remove keyword
  const removeKeyword = (keyword: string) => {
    setSettings(prev => ({
      ...prev,
      aiEscalationKeywords: prev.aiEscalationKeywords.filter(k => k !== keyword),
    }));
  };

  // Add role
  const addRole = () => {
    if (newRole.trim() && !settings.autoAssignToRoleIfUnassigned.includes(newRole.trim())) {
      setSettings(prev => ({
        ...prev,
        autoAssignToRoleIfUnassigned: [...prev.autoAssignToRoleIfUnassigned, newRole.trim()],
      }));
      setNewRole('');
    }
  };

  // Toggle working day
  const toggleWorkingDay = (day: number) => {
    setSettings(prev => ({
      ...prev,
      workingDays: prev.workingDays.includes(day)
        ? prev.workingDays.filter(d => d !== day)
        : [...prev.workingDays, day].sort(),
    }));
  };

  const sections = [
    { id: 'ai', label: 'AI Support', icon: Bot },
    { id: 'routing', label: 'Routing', icon: Users },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'users', label: 'User Chat', icon: MessageCircle },
    { id: 'moderation', label: 'Moderation', icon: Shield },
    { id: 'hours', label: 'Working Hours', icon: Clock },
    { id: 'advanced', label: 'Advanced', icon: Settings },
  ];

  if (isLoading) {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 rounded-xl">
              <Settings className="w-6 h-6 text-emerald-500" />
            </div>
            Messaging Settings
          </h2>
          <p className="text-[#6b7280] mt-1">Configure messaging, AI support, and moderation settings</p>
        </div>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleSave}
          disabled={isSaving}
          className="px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-cyan-500 text-white rounded-lg font-medium flex items-center gap-2 disabled:opacity-50"
        >
          {isSaving ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          Save Changes
        </motion.button>
      </div>

      <div className="flex gap-6">
        {/* Sidebar Navigation */}
        <div className="w-48 shrink-0 space-y-1">
          {sections.map((section) => (
            <button
              key={section.id}
              onClick={() => setActiveSection(section.id)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                activeSection === section.id
                  ? 'bg-emerald-500/20 text-emerald-500 border border-emerald-500/30'
                  : 'text-[#6b7280] hover:text-white hover:bg-[#1E1E1E]'
              }`}
            >
              <section.icon className="w-4 h-4" />
              {section.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 bg-[#111111] border border-[#2A2A2A] rounded-xl p-6">
          {/* AI Support */}
          {activeSection === 'ai' && (
            <div className="space-y-6">
              <div className="flex items-center gap-3 pb-4 border-b border-[#2A2A2A]">
                <Bot className="w-6 h-6 text-cyan-500" />
                <h3 className="text-lg font-semibold text-white">AI Support Settings</h3>
              </div>

              {/* Enable AI Support */}
              <div className="flex items-center justify-between p-4 bg-[#0A0A0A] rounded-lg">
                <div>
                  <p className="text-white font-medium">Enable AI Support</p>
                  <p className="text-sm text-[#6b7280]">
                    Let AI handle initial customer inquiries before human takeover
                  </p>
                </div>
                <button
                  onClick={() => toggleSetting('enableAISupport')}
                  className={`w-12 h-6 rounded-full transition-colors relative ${
                    settings.enableAISupport ? 'bg-emerald-500' : 'bg-[#2A2A2A]'
                  }`}
                >
                  <div
                    className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                      settings.enableAISupport ? 'left-7' : 'left-1'
                    }`}
                  />
                </button>
              </div>

              {settings.enableAISupport && (
                <>
                  {/* Greeting Message */}
                  <div>
                    <label className="block text-sm text-[#6b7280] mb-2">AI Greeting Message</label>
                    <textarea
                      value={settings.aiGreetingMessage}
                      onChange={(e) => updateSetting('aiGreetingMessage', e.target.value)}
                      className="w-full bg-[#0A0A0A] border border-[#2A2A2A] rounded-lg px-4 py-3 text-white placeholder-[#6b7280] focus:outline-none focus:border-emerald-500/50 min-h-[100px]"
                      placeholder="Enter the AI's greeting message..."
                    />
                  </div>

                  {/* System Prompt */}
                  <div>
                    <label className="block text-sm text-[#6b7280] mb-2">
                      Custom System Prompt (optional)
                    </label>
                    <textarea
                      value={settings.aiSystemPrompt}
                      onChange={(e) => updateSetting('aiSystemPrompt', e.target.value)}
                      className="w-full bg-[#0A0A0A] border border-[#2A2A2A] rounded-lg px-4 py-3 text-white placeholder-[#6b7280] focus:outline-none focus:border-emerald-500/50 min-h-[100px]"
                      placeholder="Custom instructions for the AI..."
                    />
                  </div>

                  {/* Escalation Keywords */}
                  <div>
                    <label className="block text-sm text-[#6b7280] mb-2">Escalation Keywords</label>
                    <p className="text-xs text-[#4b5563] mb-2">
                      When users say these words, AI will transfer to a human
                    </p>
                    <div className="flex flex-wrap gap-2 mb-3">
                      {settings.aiEscalationKeywords.map((keyword) => (
                        <span
                          key={keyword}
                          className="flex items-center gap-1 px-3 py-1 bg-[#1E1E1E] text-white text-sm rounded-full"
                        >
                          {keyword}
                          <button
                            onClick={() => removeKeyword(keyword)}
                            className="hover:text-red-500"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newKeyword}
                        onChange={(e) => setNewKeyword(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && addKeyword()}
                        placeholder="Add keyword..."
                        className="flex-1 bg-[#0A0A0A] border border-[#2A2A2A] rounded-lg px-4 py-2 text-sm text-white placeholder-[#6b7280] focus:outline-none focus:border-emerald-500/50"
                      />
                      <button
                        onClick={addKeyword}
                        className="px-4 py-2 bg-emerald-500/20 text-emerald-500 rounded-lg hover:bg-emerald-500/30 transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Max Responses */}
                  <div>
                    <label className="block text-sm text-[#6b7280] mb-2">
                      Max AI Responses Before Auto-Escalation
                    </label>
                    <input
                      type="number"
                      value={settings.aiMaxResponsesBeforeEscalation}
                      onChange={(e) => updateSetting('aiMaxResponsesBeforeEscalation', parseInt(e.target.value) || 10)}
                      className="w-32 bg-[#0A0A0A] border border-[#2A2A2A] rounded-lg px-4 py-2 text-white focus:outline-none focus:border-emerald-500/50"
                    />
                  </div>

                  {/* Knowledge Base */}
                  <div className="flex items-center justify-between p-4 bg-[#0A0A0A] rounded-lg">
                    <div>
                      <p className="text-white font-medium">Use Knowledge Base</p>
                      <p className="text-sm text-[#6b7280]">
                        AI will use system knowledge base for responses
                      </p>
                    </div>
                    <button
                      onClick={() => toggleSetting('aiKnowledgeBaseEnabled')}
                      className={`w-12 h-6 rounded-full transition-colors relative ${
                        settings.aiKnowledgeBaseEnabled ? 'bg-emerald-500' : 'bg-[#2A2A2A]'
                      }`}
                    >
                      <div
                        className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                          settings.aiKnowledgeBaseEnabled ? 'left-7' : 'left-1'
                        }`}
                      />
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Routing */}
          {activeSection === 'routing' && (
            <div className="space-y-6">
              <div className="flex items-center gap-3 pb-4 border-b border-[#2A2A2A]">
                <Users className="w-6 h-6 text-violet-500" />
                <h3 className="text-lg font-semibold text-white">Auto-Routing Settings</h3>
              </div>

              <div className="flex items-center justify-between p-4 bg-[#0A0A0A] rounded-lg">
                <div>
                  <p className="text-white font-medium">Auto-Assign to Customer's Employee</p>
                  <p className="text-sm text-[#6b7280]">
                    Route messages to the employee assigned to the customer
                  </p>
                </div>
                <button
                  onClick={() => toggleSetting('autoAssignToEmployeeEnabled')}
                  className={`w-12 h-6 rounded-full transition-colors relative ${
                    settings.autoAssignToEmployeeEnabled ? 'bg-emerald-500' : 'bg-[#2A2A2A]'
                  }`}
                >
                  <div
                    className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                      settings.autoAssignToEmployeeEnabled ? 'left-7' : 'left-1'
                    }`}
                  />
                </button>
              </div>

              <div className="flex items-center justify-between p-4 bg-[#0A0A0A] rounded-lg">
                <div>
                  <p className="text-white font-medium">Round Robin Distribution</p>
                  <p className="text-sm text-[#6b7280]">
                    Distribute unassigned chats evenly among available employees
                  </p>
                </div>
                <button
                  onClick={() => toggleSetting('roundRobinEnabled')}
                  className={`w-12 h-6 rounded-full transition-colors relative ${
                    settings.roundRobinEnabled ? 'bg-emerald-500' : 'bg-[#2A2A2A]'
                  }`}
                >
                  <div
                    className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                      settings.roundRobinEnabled ? 'left-7' : 'left-1'
                    }`}
                  />
                </button>
              </div>

              <div>
                <label className="block text-sm text-[#6b7280] mb-2">
                  Max Concurrent Chats Per Employee
                </label>
                <input
                  type="number"
                  value={settings.maxConcurrentChatsPerEmployee}
                  onChange={(e) => updateSetting('maxConcurrentChatsPerEmployee', parseInt(e.target.value) || 10)}
                  className="w-32 bg-[#0A0A0A] border border-[#2A2A2A] rounded-lg px-4 py-2 text-white focus:outline-none focus:border-emerald-500/50"
                />
              </div>
            </div>
          )}

          {/* Notifications */}
          {activeSection === 'notifications' && (
            <div className="space-y-6">
              <div className="flex items-center gap-3 pb-4 border-b border-[#2A2A2A]">
                <Bell className="w-6 h-6 text-amber-500" />
                <h3 className="text-lg font-semibold text-white">Notification Settings</h3>
              </div>

              {[
                { key: 'notifyEmployeeOnNewMessage', label: 'Notify employee on new message', desc: 'Send notification when customer sends a message' },
                { key: 'notifyEmployeeOnTransfer', label: 'Notify employee on transfer', desc: 'Send notification when conversation is transferred' },
                { key: 'notifyUserOnEmployeeReply', label: 'Notify user on employee reply', desc: 'Send notification when employee responds' },
                { key: 'notifyUserOnTransfer', label: 'Notify user on transfer', desc: 'Inform user when transferred to another agent' },
              ].map((item) => (
                <div key={item.key} className="flex items-center justify-between p-4 bg-[#0A0A0A] rounded-lg">
                  <div>
                    <p className="text-white font-medium">{item.label}</p>
                    <p className="text-sm text-[#6b7280]">{item.desc}</p>
                  </div>
                  <button
                    onClick={() => toggleSetting(item.key as keyof MessagingSettings)}
                    className={`w-12 h-6 rounded-full transition-colors relative ${
                      settings[item.key as keyof MessagingSettings] ? 'bg-emerald-500' : 'bg-[#2A2A2A]'
                    }`}
                  >
                    <div
                      className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                        settings[item.key as keyof MessagingSettings] ? 'left-7' : 'left-1'
                      }`}
                    />
                  </button>
                </div>
              ))}

              <div>
                <label className="block text-sm text-[#6b7280] mb-2">
                  Unread Reminder After (minutes)
                </label>
                <input
                  type="number"
                  value={settings.unreadReminderAfterMinutes}
                  onChange={(e) => updateSetting('unreadReminderAfterMinutes', parseInt(e.target.value) || 5)}
                  className="w-32 bg-[#0A0A0A] border border-[#2A2A2A] rounded-lg px-4 py-2 text-white focus:outline-none focus:border-emerald-500/50"
                />
              </div>
            </div>
          )}

          {/* User Chat */}
          {activeSection === 'users' && (
            <div className="space-y-6">
              <div className="flex items-center gap-3 pb-4 border-b border-[#2A2A2A]">
                <MessageCircle className="w-6 h-6 text-pink-500" />
                <h3 className="text-lg font-semibold text-white">User-to-User Chat Settings</h3>
              </div>

              <div className="flex items-center justify-between p-4 bg-[#0A0A0A] rounded-lg">
                <div>
                  <p className="text-white font-medium">Allow User-to-User Chat</p>
                  <p className="text-sm text-[#6b7280]">Enable users to chat with each other</p>
                </div>
                <button
                  onClick={() => toggleSetting('allowUserToUserChat')}
                  className={`w-12 h-6 rounded-full transition-colors relative ${
                    settings.allowUserToUserChat ? 'bg-emerald-500' : 'bg-[#2A2A2A]'
                  }`}
                >
                  <div
                    className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                      settings.allowUserToUserChat ? 'left-7' : 'left-1'
                    }`}
                  />
                </button>
              </div>

              {settings.allowUserToUserChat && (
                <>
                  <div className="flex items-center justify-between p-4 bg-[#0A0A0A] rounded-lg">
                    <div>
                      <p className="text-white font-medium">Require Friendship</p>
                      <p className="text-sm text-[#6b7280]">Users must be friends to start a conversation</p>
                    </div>
                    <button
                      onClick={() => toggleSetting('requireFriendshipForChat')}
                      className={`w-12 h-6 rounded-full transition-colors relative ${
                        settings.requireFriendshipForChat ? 'bg-emerald-500' : 'bg-[#2A2A2A]'
                      }`}
                    >
                      <div
                        className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                          settings.requireFriendshipForChat ? 'left-7' : 'left-1'
                        }`}
                      />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-[#6b7280] mb-2">Max Friends Per User</label>
                      <input
                        type="number"
                        value={settings.maxFriendsPerUser}
                        onChange={(e) => updateSetting('maxFriendsPerUser', parseInt(e.target.value) || 500)}
                        className="w-full bg-[#0A0A0A] border border-[#2A2A2A] rounded-lg px-4 py-2 text-white focus:outline-none focus:border-emerald-500/50"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-[#6b7280] mb-2">Friend Requests Per Day</label>
                      <input
                        type="number"
                        value={settings.friendRequestsPerDayLimit}
                        onChange={(e) => updateSetting('friendRequestsPerDayLimit', parseInt(e.target.value) || 50)}
                        className="w-full bg-[#0A0A0A] border border-[#2A2A2A] rounded-lg px-4 py-2 text-white focus:outline-none focus:border-emerald-500/50"
                      />
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Moderation */}
          {activeSection === 'moderation' && (
            <div className="space-y-6">
              <div className="flex items-center gap-3 pb-4 border-b border-[#2A2A2A]">
                <Shield className="w-6 h-6 text-red-500" />
                <h3 className="text-lg font-semibold text-white">Content Moderation</h3>
              </div>

              <div className="flex items-center justify-between p-4 bg-[#0A0A0A] rounded-lg">
                <div>
                  <p className="text-white font-medium">Enable Content Moderation</p>
                  <p className="text-sm text-[#6b7280]">Filter inappropriate content from messages</p>
                </div>
                <button
                  onClick={() => toggleSetting('enableContentModeration')}
                  className={`w-12 h-6 rounded-full transition-colors relative ${
                    settings.enableContentModeration ? 'bg-emerald-500' : 'bg-[#2A2A2A]'
                  }`}
                >
                  <div
                    className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                      settings.enableContentModeration ? 'left-7' : 'left-1'
                    }`}
                  />
                </button>
              </div>

              <div className="flex items-center justify-between p-4 bg-[#0A0A0A] rounded-lg">
                <div>
                  <p className="text-white font-medium">Block Links in User Messages</p>
                  <p className="text-sm text-[#6b7280]">Prevent users from sharing external links</p>
                </div>
                <button
                  onClick={() => toggleSetting('blockLinksInUserMessages')}
                  className={`w-12 h-6 rounded-full transition-colors relative ${
                    settings.blockLinksInUserMessages ? 'bg-emerald-500' : 'bg-[#2A2A2A]'
                  }`}
                >
                  <div
                    className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                      settings.blockLinksInUserMessages ? 'left-7' : 'left-1'
                    }`}
                  />
                </button>
              </div>

              <div>
                <label className="block text-sm text-[#6b7280] mb-2">Messages Per Minute Limit</label>
                <input
                  type="number"
                  value={settings.messagesPerMinuteLimit}
                  onChange={(e) => updateSetting('messagesPerMinuteLimit', parseInt(e.target.value) || 30)}
                  className="w-32 bg-[#0A0A0A] border border-[#2A2A2A] rounded-lg px-4 py-2 text-white focus:outline-none focus:border-emerald-500/50"
                />
              </div>
            </div>
          )}

          {/* Working Hours */}
          {activeSection === 'hours' && (
            <div className="space-y-6">
              <div className="flex items-center gap-3 pb-4 border-b border-[#2A2A2A]">
                <Clock className="w-6 h-6 text-orange-500" />
                <h3 className="text-lg font-semibold text-white">Working Hours</h3>
              </div>

              <div className="flex items-center justify-between p-4 bg-[#0A0A0A] rounded-lg">
                <div>
                  <p className="text-white font-medium">Enable Working Hours</p>
                  <p className="text-sm text-[#6b7280]">Show different message outside working hours</p>
                </div>
                <button
                  onClick={() => toggleSetting('enableWorkingHours')}
                  className={`w-12 h-6 rounded-full transition-colors relative ${
                    settings.enableWorkingHours ? 'bg-emerald-500' : 'bg-[#2A2A2A]'
                  }`}
                >
                  <div
                    className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                      settings.enableWorkingHours ? 'left-7' : 'left-1'
                    }`}
                  />
                </button>
              </div>

              {settings.enableWorkingHours && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-[#6b7280] mb-2">Start Time</label>
                      <input
                        type="time"
                        value={settings.workingHoursStart}
                        onChange={(e) => updateSetting('workingHoursStart', e.target.value)}
                        className="w-full bg-[#0A0A0A] border border-[#2A2A2A] rounded-lg px-4 py-2 text-white focus:outline-none focus:border-emerald-500/50"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-[#6b7280] mb-2">End Time</label>
                      <input
                        type="time"
                        value={settings.workingHoursEnd}
                        onChange={(e) => updateSetting('workingHoursEnd', e.target.value)}
                        className="w-full bg-[#0A0A0A] border border-[#2A2A2A] rounded-lg px-4 py-2 text-white focus:outline-none focus:border-emerald-500/50"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm text-[#6b7280] mb-2">Working Days</label>
                    <div className="flex gap-2">
                      {DAYS_OF_WEEK.map((day) => (
                        <button
                          key={day.value}
                          onClick={() => toggleWorkingDay(day.value)}
                          className={`w-10 h-10 rounded-lg text-sm font-medium transition-colors ${
                            settings.workingDays.includes(day.value)
                              ? 'bg-emerald-500 text-white'
                              : 'bg-[#1E1E1E] text-[#6b7280] hover:text-white'
                          }`}
                        >
                          {day.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm text-[#6b7280] mb-2">Outside Hours Message</label>
                    <textarea
                      value={settings.outsideHoursMessage}
                      onChange={(e) => updateSetting('outsideHoursMessage', e.target.value)}
                      className="w-full bg-[#0A0A0A] border border-[#2A2A2A] rounded-lg px-4 py-3 text-white placeholder-[#6b7280] focus:outline-none focus:border-emerald-500/50 min-h-[80px]"
                    />
                  </div>
                </>
              )}
            </div>
          )}

          {/* Advanced */}
          {activeSection === 'advanced' && (
            <div className="space-y-6">
              <div className="flex items-center gap-3 pb-4 border-b border-[#2A2A2A]">
                <Settings className="w-6 h-6 text-gray-500" />
                <h3 className="text-lg font-semibold text-white">Advanced Settings</h3>
              </div>

              {[
                { key: 'enableTypingIndicators', label: 'Typing Indicators', desc: 'Show when someone is typing' },
                { key: 'enableReadReceipts', label: 'Read Receipts', desc: 'Show when messages are read' },
                { key: 'enableOnlineStatus', label: 'Online Status', desc: 'Show user online/offline status' },
                { key: 'allowFileSharing', label: 'File Sharing', desc: 'Allow users to share files and images' },
              ].map((item) => (
                <div key={item.key} className="flex items-center justify-between p-4 bg-[#0A0A0A] rounded-lg">
                  <div>
                    <p className="text-white font-medium">{item.label}</p>
                    <p className="text-sm text-[#6b7280]">{item.desc}</p>
                  </div>
                  <button
                    onClick={() => toggleSetting(item.key as keyof MessagingSettings)}
                    className={`w-12 h-6 rounded-full transition-colors relative ${
                      settings[item.key as keyof MessagingSettings] ? 'bg-emerald-500' : 'bg-[#2A2A2A]'
                    }`}
                  >
                    <div
                      className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                        settings[item.key as keyof MessagingSettings] ? 'left-7' : 'left-1'
                      }`}
                    />
                  </button>
                </div>
              ))}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-[#6b7280] mb-2">Max Message Length</label>
                  <input
                    type="number"
                    value={settings.maxMessageLength}
                    onChange={(e) => updateSetting('maxMessageLength', parseInt(e.target.value) || 4000)}
                    className="w-full bg-[#0A0A0A] border border-[#2A2A2A] rounded-lg px-4 py-2 text-white focus:outline-none focus:border-emerald-500/50"
                  />
                </div>
                <div>
                  <label className="block text-sm text-[#6b7280] mb-2">Max File Size (MB)</label>
                  <input
                    type="number"
                    value={settings.maxFileSizeMB}
                    onChange={(e) => updateSetting('maxFileSizeMB', parseInt(e.target.value) || 10)}
                    className="w-full bg-[#0A0A0A] border border-[#2A2A2A] rounded-lg px-4 py-2 text-white focus:outline-none focus:border-emerald-500/50"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm text-[#6b7280] mb-2">
                  Message Retention (days, 0 = forever)
                </label>
                <input
                  type="number"
                  value={settings.messageRetentionDays}
                  onChange={(e) => updateSetting('messageRetentionDays', parseInt(e.target.value) || 0)}
                  className="w-32 bg-[#0A0A0A] border border-[#2A2A2A] rounded-lg px-4 py-2 text-white focus:outline-none focus:border-emerald-500/50"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

