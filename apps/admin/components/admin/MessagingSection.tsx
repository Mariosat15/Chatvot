'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageCircle,
  Users,
  Send,
  Search,
  Bot,
  User,
  ArrowRight,
  Clock,
  CheckCheck,
  Check,
  Phone,
  Mail,
  MoreVertical,
  RefreshCw,
  Filter,
  Headphones,
  UserPlus,
  AlertCircle,
  Inbox,
  ArrowLeftRight,
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';

interface Conversation {
  id: string;
  type: 'user-to-support' | 'employee-internal';
  status: string;
  participants: Array<{
    id: string;
    type: string;
    name: string;
    avatar?: string;
    isActive: boolean;
  }>;
  lastMessage?: {
    content: string;
    senderId: string;
    senderName: string;
    timestamp: string;
  };
  unreadCount: number;
  isAIHandled: boolean;
  assignedEmployeeId?: string;
  assignedEmployeeName?: string;
  metadata?: any;
  createdAt: string;
  lastActivityAt: string;
}

interface Message {
  id: string;
  senderId: string;
  senderType: string;
  senderName: string;
  senderAvatar?: string;
  content: string;
  messageType: string;
  attachments?: any[];
  readBy?: Array<{ participantId: string; readAt: string }>;
  isModerated?: boolean;
  moderationReason?: string;
  aiMetadata?: any;
  createdAt: string;
}

interface Employee {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  lastSeen?: string;
}

interface AssignedCustomer {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  assignedAt: string;
  department?: string;
}

export default function MessagingSection() {
  const [activeTab, setActiveTab] = useState<'support' | 'internal' | 'my-customers'>('support');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [messageInput, setMessageInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'assigned' | 'unassigned'>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferReason, setTransferReason] = useState('');
  const [selectedEmployeeForTransfer, setSelectedEmployeeForTransfer] = useState<string>('');
  const [assignedCustomers, setAssignedCustomers] = useState<AssignedCustomer[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageInputRef = useRef<HTMLInputElement>(null);

  // Fetch assigned customers
  const fetchAssignedCustomers = useCallback(async () => {
    try {
      const response = await fetch('/api/messaging/assigned-customers');
      if (response.ok) {
        const data = await response.json();
        setAssignedCustomers(data.customers || []);
      }
    } catch (error) {
      console.error('Error fetching assigned customers:', error);
    }
  }, []);

  // Start conversation with assigned customer
  const startConversationWithCustomer = async (customerId: string, customerName: string) => {
    try {
      // First check if there's an existing support conversation
      const response = await fetch(`/api/messaging/conversations?type=support&customerId=${customerId}`);
      if (response.ok) {
        const data = await response.json();
        const existingConv = data.conversations?.find((c: Conversation) => 
          c.participants.some(p => p.id === customerId)
        );
        if (existingConv) {
          setSelectedConversation(existingConv);
          setActiveTab('support');
          return;
        }
      }
      
      // If no existing conversation, show info message
      alert(`To chat with ${customerName}, they need to initiate a support conversation first, or you can reach out via email.`);
    } catch (error) {
      console.error('Error starting conversation:', error);
    }
  };

  // Fetch conversations
  const fetchConversations = useCallback(async () => {
    try {
      const type = activeTab === 'support' ? 'support' : 'internal';
      const response = await fetch(`/api/messaging/conversations?type=${type}&status=active`);
      if (response.ok) {
        const data = await response.json();
        setConversations(data.conversations);
      }
    } catch (error) {
      console.error('Error fetching conversations:', error);
    }
  }, [activeTab]);

  // Fetch employees for internal chat and transfers
  const fetchEmployees = useCallback(async () => {
    try {
      const response = await fetch('/api/messaging/employees');
      if (response.ok) {
        const data = await response.json();
        setEmployees(data.employees);
      }
    } catch (error) {
      console.error('Error fetching employees:', error);
    }
  }, []);

  // Fetch messages for selected conversation
  const fetchMessages = useCallback(async (conversationId: string) => {
    try {
      const response = await fetch(`/api/messaging/conversations/${conversationId}`);
      if (response.ok) {
        const data = await response.json();
        setMessages(data.messages);
        // Update unread count
        setConversations(prev =>
          prev.map(c => c.id === conversationId ? { ...c, unreadCount: 0 } : c)
        );
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  }, []);

  // Initial load
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      await Promise.all([fetchConversations(), fetchEmployees(), fetchAssignedCustomers()]);
      setIsLoading(false);
    };
    loadData();
  }, [fetchConversations, fetchEmployees, fetchAssignedCustomers]);

  // Poll for new messages
  useEffect(() => {
    const interval = setInterval(() => {
      fetchConversations();
      if (selectedConversation) {
        fetchMessages(selectedConversation.id);
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [fetchConversations, fetchMessages, selectedConversation]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Send message
  const handleSendMessage = async () => {
    if (!messageInput.trim() || !selectedConversation || isSending) return;

    setIsSending(true);
    try {
      const response = await fetch(`/api/messaging/conversations/${selectedConversation.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: messageInput.trim() }),
      });

      if (response.ok) {
        const data = await response.json();
        setMessages(prev => [...prev, data.message]);
        setMessageInput('');
        messageInputRef.current?.focus();
        fetchConversations();
      }
    } catch (error) {
      console.error('Error sending message:', error);
    }
    setIsSending(false);
  };

  // Transfer conversation
  const handleTransfer = async () => {
    if (!selectedConversation || !selectedEmployeeForTransfer) return;

    const employee = employees.find(e => e.id === selectedEmployeeForTransfer);
    if (!employee) return;

    try {
      const response = await fetch(`/api/messaging/conversations/${selectedConversation.id}/transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toEmployeeId: employee.id,
          toEmployeeName: employee.name,
          reason: transferReason,
        }),
      });

      if (response.ok) {
        setShowTransferModal(false);
        setTransferReason('');
        setSelectedEmployeeForTransfer('');
        fetchConversations();
        fetchMessages(selectedConversation.id);
      }
    } catch (error) {
      console.error('Error transferring conversation:', error);
    }
  };

  // Start internal chat
  const handleStartInternalChat = async (employee: Employee) => {
    try {
      const response = await fetch('/api/messaging/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          participantIds: [employee.id],
          participantNames: [employee.name],
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setActiveTab('internal');
        setSelectedConversation(data.conversation);
        fetchMessages(data.conversation.id);
        fetchConversations();
      }
    } catch (error) {
      console.error('Error starting internal chat:', error);
    }
  };

  // Filter conversations
  const filteredConversations = conversations.filter(conv => {
    if (searchQuery) {
      const searchLower = searchQuery.toLowerCase();
      const matchesSearch =
        conv.participants.some(p => p.name.toLowerCase().includes(searchLower)) ||
        conv.lastMessage?.content.toLowerCase().includes(searchLower);
      if (!matchesSearch) return false;
    }
    
    if (filter === 'assigned' && !conv.assignedEmployeeId) return false;
    if (filter === 'unassigned' && conv.assignedEmployeeId) return false;
    
    return true;
  });

  // Get customer from support conversation
  const getCustomer = (conversation: Conversation) => {
    return conversation.participants.find(p => p.type === 'user');
  };

  // Stats
  const unassignedCount = conversations.filter(c => !c.assignedEmployeeId && c.type === 'user-to-support').length;
  const aiHandledCount = conversations.filter(c => c.isAIHandled).length;
  const totalUnread = conversations.reduce((sum, c) => sum + c.unreadCount, 0);

  if (isLoading) {
    return (
      <div className="min-h-[600px] flex items-center justify-center">
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
              <MessageCircle className="w-6 h-6 text-emerald-500" />
            </div>
            Messaging Center
          </h2>
          <p className="text-[#6b7280] mt-1">Manage customer support and internal communications</p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchConversations()}
            className="px-4 py-2 bg-[#1E1E1E] text-white rounded-lg hover:bg-[#2A2A2A] transition-colors flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'Active Chats', value: conversations.length, icon: MessageCircle, color: 'emerald' },
          { label: 'Unread Messages', value: totalUnread, icon: Inbox, color: 'amber' },
          { label: 'AI Handled', value: aiHandledCount, icon: Bot, color: 'cyan' },
          { label: 'Unassigned', value: unassignedCount, icon: AlertCircle, color: 'red' },
        ].map((stat, index) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="bg-[#111111] border border-[#2A2A2A] rounded-xl p-4"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[#6b7280]">{stat.label}</p>
                <p className="text-2xl font-bold text-white">{stat.value}</p>
              </div>
              <div className={`p-3 rounded-xl bg-${stat.color}-500/10`}>
                <stat.icon className={`w-6 h-6 text-${stat.color}-500`} />
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Main Content */}
      <div className="bg-[#111111] border border-[#2A2A2A] rounded-xl overflow-hidden min-h-[600px] flex">
        {/* Sidebar */}
        <div className="w-80 border-r border-[#2A2A2A] flex flex-col">
          {/* Tabs */}
          <div className="flex border-b border-[#2A2A2A]">
            <button
              onClick={() => { setActiveTab('support'); setSelectedConversation(null); }}
              className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors ${
                activeTab === 'support'
                  ? 'text-emerald-500 border-b-2 border-emerald-500 bg-emerald-500/5'
                  : 'text-[#6b7280] hover:text-white'
              }`}
            >
              <Headphones className="w-4 h-4" />
              Support
            </button>
            <button
              onClick={() => { setActiveTab('my-customers'); setSelectedConversation(null); }}
              className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors ${
                activeTab === 'my-customers'
                  ? 'text-emerald-500 border-b-2 border-emerald-500 bg-emerald-500/5'
                  : 'text-[#6b7280] hover:text-white'
              }`}
            >
              <Users className="w-4 h-4" />
              My Customers
              {assignedCustomers.length > 0 && (
                <span className="bg-emerald-500/20 text-emerald-500 text-xs px-1.5 py-0.5 rounded-full">
                  {assignedCustomers.length}
                </span>
              )}
            </button>
            <button
              onClick={() => { setActiveTab('internal'); setSelectedConversation(null); }}
              className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors ${
                activeTab === 'internal'
                  ? 'text-emerald-500 border-b-2 border-emerald-500 bg-emerald-500/5'
                  : 'text-[#6b7280] hover:text-white'
              }`}
            >
              <Users className="w-4 h-4" />
              Internal
            </button>
          </div>

          {/* Search & Filter */}
          <div className="p-3 border-b border-[#2A2A2A] space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6b7280]" />
              <input
                type="text"
                placeholder="Search conversations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#1E1E1E] border border-[#2A2A2A] rounded-lg pl-10 pr-4 py-2 text-sm text-white placeholder-[#6b7280] focus:outline-none focus:border-emerald-500/50"
              />
            </div>
            {activeTab === 'support' && (
              <div className="flex gap-2">
                {(['all', 'assigned', 'unassigned'] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`flex-1 px-2 py-1 text-xs rounded-lg transition-colors ${
                      filter === f
                        ? 'bg-emerald-500/20 text-emerald-500 border border-emerald-500/30'
                        : 'bg-[#1E1E1E] text-[#6b7280] hover:text-white'
                    }`}
                  >
                    {f.charAt(0).toUpperCase() + f.slice(1)}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Conversation List */}
          <div className="flex-1 overflow-y-auto">
            {/* My Customers Tab Content */}
            {activeTab === 'my-customers' && (
              <div className="p-2">
                {assignedCustomers.length === 0 ? (
                  <div className="text-center py-12">
                    <Users className="w-12 h-12 text-[#4b5563] mx-auto mb-4" />
                    <p className="text-[#6b7280]">No customers assigned to you</p>
                    <p className="text-xs text-[#4b5563] mt-2">
                      Customers will appear here when assigned by an admin
                    </p>
                  </div>
                ) : (
                  <>
                    <p className="text-xs text-[#6b7280] px-2 py-1 mb-2">
                      Your Assigned Customers ({assignedCustomers.length})
                    </p>
                    {assignedCustomers.map((customer) => (
                      <div
                        key={customer.id}
                        className="flex items-center gap-3 p-3 hover:bg-[#1E1E1E] rounded-lg cursor-pointer transition-colors border border-[#2A2A2A] mb-2"
                        onClick={() => startConversationWithCustomer(customer.id, customer.name)}
                      >
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center">
                          {customer.avatar ? (
                            <img src={customer.avatar} alt="" className="w-10 h-10 rounded-full" />
                          ) : (
                            <span className="text-white text-sm font-bold">
                              {customer.name.charAt(0).toUpperCase()}
                            </span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-white font-medium truncate">{customer.name}</p>
                          <p className="text-xs text-[#6b7280] truncate">{customer.email}</p>
                          {customer.assignedAt && (
                            <p className="text-xs text-emerald-500/70">
                              Assigned {formatDistanceToNow(new Date(customer.assignedAt), { addSuffix: true })}
                            </p>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <a
                            href={`mailto:${customer.email}`}
                            onClick={(e) => e.stopPropagation()}
                            className="p-1.5 hover:bg-emerald-500/20 rounded-lg text-[#6b7280] hover:text-emerald-500 transition-colors"
                            title="Send email"
                          >
                            <Mail className="w-4 h-4" />
                          </a>
                          <MessageCircle className="w-4 h-4 text-[#6b7280]" />
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </div>
            )}

            {activeTab === 'internal' && (
              <div className="p-2 border-b border-[#2A2A2A]">
                <p className="text-xs text-[#6b7280] px-2 py-1">Team Members</p>
                {employees.map((employee) => (
                  <div
                    key={employee.id}
                    onClick={() => handleStartInternalChat(employee)}
                    className="flex items-center gap-3 p-2 hover:bg-[#1E1E1E] rounded-lg cursor-pointer transition-colors"
                  >
                    <div className="relative">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center">
                        <span className="text-white text-sm font-bold">
                          {employee.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-[#111111] ${
                        employee.status === 'online' ? 'bg-emerald-500' : 'bg-[#6b7280]'
                      }`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white font-medium truncate">{employee.name}</p>
                      <p className="text-xs text-[#6b7280] truncate">{employee.role}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeTab !== 'my-customers' && (
              filteredConversations.length === 0 ? (
                <div className="text-center py-12">
                  <Inbox className="w-12 h-12 text-[#4b5563] mx-auto mb-4" />
                  <p className="text-[#6b7280]">No conversations</p>
                </div>
              ) : (
                filteredConversations.map((conversation) => {
                const customer = getCustomer(conversation);
                const isSelected = selectedConversation?.id === conversation.id;

                return (
                  <motion.div
                    key={conversation.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    onClick={() => {
                      setSelectedConversation(conversation);
                      fetchMessages(conversation.id);
                    }}
                    className={`flex items-center gap-3 p-3 cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-emerald-500/10 border-l-2 border-emerald-500'
                        : 'hover:bg-[#1E1E1E] border-l-2 border-transparent'
                    }`}
                  >
                    <div className="relative">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        conversation.type === 'user-to-support'
                          ? 'bg-gradient-to-br from-blue-500 to-indigo-500'
                          : 'bg-gradient-to-br from-violet-500 to-fuchsia-500'
                      }`}>
                        {conversation.type === 'user-to-support' ? (
                          customer?.name?.charAt(0).toUpperCase() || <User className="w-5 h-5 text-white" />
                        ) : (
                          <Users className="w-5 h-5 text-white" />
                        )}
                      </div>
                      {conversation.isAIHandled && (
                        <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-cyan-500 rounded-full flex items-center justify-center border-2 border-[#111111]">
                          <Bot className="w-3 h-3 text-white" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-white truncate">
                          {conversation.type === 'user-to-support'
                            ? customer?.name || 'Customer'
                            : conversation.participants.filter(p => p.type === 'employee').map(p => p.name).join(', ')}
                        </p>
                        {conversation.lastMessage && (
                          <span className="text-xs text-[#6b7280]">
                            {formatDistanceToNow(new Date(conversation.lastMessage.timestamp), { addSuffix: false })}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-[#9ca3af] truncate">
                          {conversation.lastMessage?.content || 'No messages'}
                        </p>
                        {conversation.unreadCount > 0 && (
                          <span className="bg-emerald-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full">
                            {conversation.unreadCount}
                          </span>
                        )}
                      </div>
                      {conversation.assignedEmployeeName && (
                        <p className="text-xs text-emerald-500 mt-0.5">
                          → {conversation.assignedEmployeeName}
                        </p>
                      )}
                    </div>
                  </motion.div>
                );
              })
              )
            )}
          </div>
        </div>

        {/* Chat Area */}
        <div className="flex-1 flex flex-col">
          {selectedConversation ? (
            <>
              {/* Chat Header */}
              <div className="h-14 px-4 border-b border-[#2A2A2A] flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    selectedConversation.type === 'user-to-support'
                      ? 'bg-gradient-to-br from-blue-500 to-indigo-500'
                      : 'bg-gradient-to-br from-violet-500 to-fuchsia-500'
                  }`}>
                    {selectedConversation.type === 'user-to-support' ? (
                      <User className="w-5 h-5 text-white" />
                    ) : (
                      <Users className="w-5 h-5 text-white" />
                    )}
                  </div>
                  <div>
                    <h3 className="font-medium text-white">
                      {selectedConversation.type === 'user-to-support'
                        ? getCustomer(selectedConversation)?.name || 'Customer'
                        : 'Internal Chat'}
                    </h3>
                    <div className="flex items-center gap-2 text-xs text-[#6b7280]">
                      {selectedConversation.isAIHandled && (
                        <span className="flex items-center gap-1 text-cyan-500">
                          <Bot className="w-3 h-3" /> AI Handling
                        </span>
                      )}
                      {selectedConversation.assignedEmployeeName && (
                        <span>Assigned to {selectedConversation.assignedEmployeeName}</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {selectedConversation.type === 'user-to-support' && (
                    <button
                      onClick={() => setShowTransferModal(true)}
                      className="px-3 py-1.5 bg-[#1E1E1E] text-white text-sm rounded-lg hover:bg-[#2A2A2A] transition-colors flex items-center gap-2"
                    >
                      <ArrowLeftRight className="w-4 h-4" />
                      Transfer
                    </button>
                  )}
                  <button className="p-2 hover:bg-[#1E1E1E] rounded-lg transition-colors">
                    <MoreVertical className="w-5 h-5 text-[#6b7280]" />
                  </button>
                </div>
              </div>

              {/* Customer Info Bar (for support) */}
              {selectedConversation.type === 'user-to-support' && (
                <div className="px-4 py-2 bg-[#0A0A0A] border-b border-[#2A2A2A] flex items-center gap-4 text-xs">
                  <span className="flex items-center gap-1 text-[#6b7280]">
                    <User className="w-3 h-3" />
                    {getCustomer(selectedConversation)?.name}
                  </span>
                  <span className="flex items-center gap-1 text-[#6b7280]">
                    <Clock className="w-3 h-3" />
                    Started {formatDistanceToNow(new Date(selectedConversation.createdAt), { addSuffix: true })}
                  </span>
                </div>
              )}

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#0A0A0A]">
                {messages.map((message) => {
                  const isEmployee = message.senderType === 'employee';
                  const isAI = message.senderType === 'ai';
                  const isSystem = message.messageType === 'system';

                  if (isSystem) {
                    return (
                      <div key={message.id} className="flex justify-center">
                        <span className="text-xs text-[#6b7280] bg-[#1E1E1E] px-3 py-1 rounded-full">
                          {message.content}
                        </span>
                      </div>
                    );
                  }

                  return (
                    <motion.div
                      key={message.id}
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`flex ${isEmployee ? 'justify-end' : 'justify-start'}`}
                    >
                      <div className={`max-w-[70%] ${isEmployee ? 'order-2' : 'order-1'}`}>
                        {!isEmployee && (
                          <div className="flex items-center gap-2 mb-1">
                            <div className={`w-5 h-5 rounded-full flex items-center justify-center ${
                              isAI
                                ? 'bg-gradient-to-br from-cyan-500 to-emerald-500'
                                : 'bg-gradient-to-br from-blue-500 to-indigo-500'
                            }`}>
                              {isAI ? (
                                <Bot className="w-3 h-3 text-white" />
                              ) : (
                                <span className="text-white text-xs font-bold">
                                  {message.senderName?.charAt(0).toUpperCase()}
                                </span>
                              )}
                            </div>
                            <span className="text-xs text-[#6b7280]">{message.senderName}</span>
                          </div>
                        )}
                        <div
                          className={`rounded-2xl px-4 py-2 ${
                            isEmployee
                              ? 'bg-gradient-to-r from-emerald-500 to-cyan-500 text-white rounded-tr-sm'
                              : isAI
                              ? 'bg-[#1E1E1E] text-white border border-cyan-500/30 rounded-tl-sm'
                              : 'bg-[#1E1E1E] text-white rounded-tl-sm'
                          }`}
                        >
                          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                          {message.isModerated && (
                            <p className="text-xs text-yellow-400 mt-1">
                              ⚠️ Content moderated: {message.moderationReason}
                            </p>
                          )}
                        </div>
                        <div className={`flex items-center gap-1 mt-1 text-xs text-[#6b7280] ${isEmployee ? 'justify-end' : ''}`}>
                          <span>{format(new Date(message.createdAt), 'HH:mm')}</span>
                          {isEmployee && (
                            <span className="text-emerald-500">
                              {message.readBy && message.readBy.length > 0 ? (
                                <CheckCheck className="w-4 h-4" />
                              ) : (
                                <Check className="w-4 h-4" />
                              )}
                            </span>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Message Input */}
              <div className="p-4 border-t border-[#2A2A2A]">
                <div className="flex items-center gap-3">
                  <input
                    ref={messageInputRef}
                    type="text"
                    placeholder="Type a message..."
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                    className="flex-1 bg-[#1E1E1E] border border-[#2A2A2A] rounded-xl px-4 py-2.5 text-white placeholder-[#6b7280] focus:outline-none focus:border-emerald-500/50"
                  />
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleSendMessage}
                    disabled={!messageInput.trim() || isSending}
                    className="p-3 bg-gradient-to-r from-emerald-500 to-cyan-500 rounded-xl text-white disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Send className="w-5 h-5" />
                  </motion.button>
                </div>
              </div>
            </>
          ) : (
            /* Empty State */
            <div className="flex-1 flex flex-col items-center justify-center">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 flex items-center justify-center mb-6">
                <MessageCircle className="w-10 h-10 text-emerald-500" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Select a Conversation</h3>
              <p className="text-[#6b7280] text-center max-w-md">
                Choose a conversation from the sidebar to view messages and respond to customers or colleagues.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Transfer Modal */}
      <AnimatePresence>
        {showTransferModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
            onClick={() => setShowTransferModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-[#111111] border border-[#2A2A2A] rounded-xl p-6 max-w-md w-full mx-4"
            >
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <ArrowLeftRight className="w-5 h-5 text-emerald-500" />
                Transfer Conversation
              </h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-[#6b7280] mb-2">Transfer to</label>
                  <select
                    value={selectedEmployeeForTransfer}
                    onChange={(e) => setSelectedEmployeeForTransfer(e.target.value)}
                    className="w-full bg-[#1E1E1E] border border-[#2A2A2A] rounded-lg px-4 py-2 text-white focus:outline-none focus:border-emerald-500/50"
                  >
                    <option value="">Select an employee...</option>
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.name} ({emp.role})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm text-[#6b7280] mb-2">Reason (optional)</label>
                  <input
                    type="text"
                    value={transferReason}
                    onChange={(e) => setTransferReason(e.target.value)}
                    placeholder="e.g., Specialist needed for technical issue"
                    className="w-full bg-[#1E1E1E] border border-[#2A2A2A] rounded-lg px-4 py-2 text-white placeholder-[#6b7280] focus:outline-none focus:border-emerald-500/50"
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => setShowTransferModal(false)}
                    className="flex-1 px-4 py-2 bg-[#1E1E1E] text-white rounded-lg hover:bg-[#2A2A2A] transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleTransfer}
                    disabled={!selectedEmployeeForTransfer}
                    className="flex-1 px-4 py-2 bg-gradient-to-r from-emerald-500 to-cyan-500 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Transfer
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

