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
  Clock,
  CheckCheck,
  Check,
  CheckCircle,
  Mail,
  MoreVertical,
  RefreshCw,
  Headphones,
  AlertCircle,
  Inbox,
  ArrowLeftRight,
  RotateCcw,
  CircleDot,
  Wifi,
  WifiOff,
  ChevronDown,
  Sparkles,
  Shield,
  Loader2,
  X,
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';

// Simple WebSocket hook for admin
function useAdminWebSocket(onMessage: (msg: any) => void) {
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    
    try {
      const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = process.env.NEXT_PUBLIC_WEBSOCKET_URL || `${wsProtocol}//${window.location.hostname}:3003`;
      const adminId = document.cookie.split('; ').find(c => c.startsWith('admin_id='))?.split('=')[1] || 'admin';
      const ws = new WebSocket(`${wsUrl}/ws?token=${encodeURIComponent(adminId)}&type=employee`);

      ws.onopen = () => {
        console.log('✅ [Admin WS] Connected');
        setIsConnected(true);
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          onMessage(message);
        } catch (e) {
          console.error('Failed to parse WS message:', e);
        }
      };

      ws.onclose = () => {
        console.log('❌ [Admin WS] Disconnected');
        setIsConnected(false);
        wsRef.current = null;
        reconnectTimeoutRef.current = setTimeout(connect, 3000);
      };

      ws.onerror = (error) => {
        console.error('[Admin WS] Error:', error);
      };

      wsRef.current = ws;
    } catch (error) {
      console.error('Failed to connect WS:', error);
    }
  }, [onMessage]);

  const subscribe = useCallback((conversationId: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'subscribe', conversationId }));
    }
  }, []);

  const unsubscribe = useCallback((conversationId: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'unsubscribe', conversationId }));
    }
  }, []);

  const setTyping = useCallback((conversationId: string, isTyping: boolean) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'typing', conversationId, isTyping }));
    }
  }, []);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (wsRef.current) wsRef.current.close();
    };
  }, [connect]);

  return { isConnected, subscribe, unsubscribe, setTyping };
}

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
  isResolved?: boolean;
  resolvedAt?: string;
  resolvedByName?: string;
  assignedEmployeeId?: string;
  assignedEmployeeName?: string;
  originalEmployeeId?: string;
  originalEmployeeName?: string;
  temporarilyRedirected?: boolean;
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
  isSuperAdmin?: boolean;
  avatar?: string;
  status: string;
  lastSeen?: string;
  isAvailableForChat?: boolean;
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
  const [isAvailable, setIsAvailable] = useState(true);
  const [isTogglingAvailability, setIsTogglingAvailability] = useState(false);
  const [transferReason, setTransferReason] = useState('');
  const [selectedEmployeeForTransfer, setSelectedEmployeeForTransfer] = useState<string>('');
  const [assignedCustomers, setAssignedCustomers] = useState<AssignedCustomer[]>([]);
  const [typingUsers, setTypingUsers] = useState<Map<string, { name: string; timestamp: number }>>(new Map());
  const [currentAdminId, setCurrentAdminId] = useState<string>('');
  const [currentAdminName, setCurrentAdminName] = useState<string>('');
  const [showScrollButton, setShowScrollButton] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const messageInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const selectedConvRef = useRef<string | null>(null);
  const isUserAtBottomRef = useRef(true);
  const isInitialLoadRef = useRef(true); // Track if this is the first load of messages

  // Get current admin info from cookie/session
  useEffect(() => {
    const adminIdCookie = document.cookie.split('; ').find(c => c.startsWith('admin_id='))?.split('=')[1];
    const adminNameCookie = document.cookie.split('; ').find(c => c.startsWith('admin_name='))?.split('=')[1];
    if (adminIdCookie) setCurrentAdminId(decodeURIComponent(adminIdCookie));
    if (adminNameCookie) setCurrentAdminName(decodeURIComponent(adminNameCookie));
  }, []);

  useEffect(() => {
    selectedConvRef.current = selectedConversation?.id || null;
  }, [selectedConversation?.id]);

  // Scroll handling
  const handleScroll = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    
    const { scrollTop, scrollHeight, clientHeight } = container;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 100;
    isUserAtBottomRef.current = isAtBottom;
    setShowScrollButton(!isAtBottom && messages.length > 0);
  }, [messages.length]);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    isUserAtBottomRef.current = true;
    setShowScrollButton(false);
  }, []);

  // WebSocket message handler
  const handleWebSocketMessage = useCallback((message: { type: string; data?: any; [key: string]: any }) => {
    switch (message.type) {
      case 'new_message':
        if (message.data?.conversationId === selectedConvRef.current) {
          setMessages(prev => {
            if (prev.some(m => m.id === message.data.message?.id)) return prev;
            return [...prev, message.data.message];
          });
          if (isUserAtBottomRef.current) {
            setTimeout(() => scrollToBottom(), 100);
          }
        }
        fetchConversations();
        break;
        
      case 'typing':
        if (message.data?.conversationId === selectedConvRef.current) {
          if (message.data.isTyping) {
            setTypingUsers(prev => {
              const newMap = new Map(prev);
              newMap.set(message.data.participantId, {
                name: message.data.participantName,
                timestamp: Date.now(),
              });
              return newMap;
            });
          } else {
            setTypingUsers(prev => {
              const newMap = new Map(prev);
              newMap.delete(message.data.participantId);
              return newMap;
            });
          }
        }
        break;
    }
  }, [scrollToBottom]);

  const { isConnected: wsConnected, subscribe: wsSubscribe, unsubscribe: wsUnsubscribe, setTyping: wsSetTyping } = useAdminWebSocket(handleWebSocketMessage);

  useEffect(() => {
    if (selectedConversation?.id && wsConnected) {
      wsSubscribe(selectedConversation.id);
      return () => wsUnsubscribe(selectedConversation.id);
    }
  }, [selectedConversation?.id, wsConnected, wsSubscribe, wsUnsubscribe]);

  // Clear stale typing indicators
  useEffect(() => {
    const interval = setInterval(() => {
      setTypingUsers(prev => {
        const now = Date.now();
        const newMap = new Map(prev);
        for (const [id, data] of newMap) {
          if (now - data.timestamp > 5000) newMap.delete(id);
        }
        return newMap.size !== prev.size ? newMap : prev;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

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

  const startConversationWithCustomer = async (customerId: string, customerName: string, customerAvatar?: string) => {
    try {
      const response = await fetch('/api/messaging/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'user-to-support', customerId, customerName }),
      });
      
      if (response.ok) {
        const data = await response.json();
        setActiveTab('support');
        await fetchConversations();
        
        const convResponse = await fetch(`/api/messaging/conversations/${data.conversation.id}`);
        if (convResponse.ok) {
          const convData = await convResponse.json();
          setSelectedConversation({
            id: data.conversation.id,
            type: data.conversation.type || 'user-to-support',
            status: data.conversation.status || 'active',
            participants: convData.participants || data.conversation.participants || [],
            lastMessage: convData.lastMessage,
            unreadCount: 0,
            isAIHandled: false,
            createdAt: convData.createdAt,
            lastActivityAt: convData.lastActivityAt,
          });
          setMessages(convData.messages || []);
          setTimeout(() => scrollToBottom(), 100);
        }
      }
    } catch (error) {
      console.error('Error starting conversation:', error);
    }
  };

  const fetchConversations = useCallback(async () => {
    try {
      const type = activeTab === 'support' ? 'support' : activeTab === 'internal' ? 'internal' : 'all';
      const response = await fetch(`/api/messaging/conversations?type=${type}&status=active`);
      if (response.ok) {
        const data = await response.json();
        setConversations(data.conversations || []);
      }
    } catch (error) {
      console.error('Error fetching conversations:', error);
    }
  }, [activeTab]);

  const fetchEmployees = useCallback(async () => {
    try {
      const response = await fetch('/api/messaging/employees');
      if (response.ok) {
        const data = await response.json();
        setEmployees(data.employees || []);
      }
    } catch (error) {
      console.error('Error fetching employees:', error);
    }
  }, []);

  const fetchAvailability = useCallback(async () => {
    try {
      const response = await fetch('/api/employees/availability');
      if (response.ok) {
        const data = await response.json();
        setIsAvailable(data.isAvailableForChat !== false);
      }
    } catch (error) {
      console.error('Error fetching availability:', error);
    }
  }, []);

  const toggleAvailability = async () => {
    setIsTogglingAvailability(true);
    try {
      const response = await fetch('/api/employees/availability', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isAvailable: !isAvailable, reason: !isAvailable ? undefined : 'Away' }),
      });
      if (response.ok) setIsAvailable(!isAvailable);
    } catch (error) {
      console.error('Error toggling availability:', error);
    }
    setIsTogglingAvailability(false);
  };

  const handleReassignBack = async (conversationId: string) => {
    try {
      const response = await fetch(`/api/messaging/conversations/${conversationId}/reassign-back`, { method: 'POST' });
      if (response.ok) {
        await fetchConversations();
        if (selectedConversation?.id === conversationId) fetchMessages(conversationId);
      }
    } catch (error) {
      console.error('Error reassigning conversation:', error);
    }
  };

  const handleResolve = async (conversationId: string) => {
    if (!confirm('Mark this conversation as resolved? AI will handle the next customer message.')) return;
    
    try {
      const response = await fetch(`/api/messaging/conversations/${conversationId}/resolve`, { method: 'POST' });
      if (response.ok) {
        await fetchConversations();
        if (selectedConversation?.id === conversationId) fetchMessages(conversationId);
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to resolve conversation');
      }
    } catch (error) {
      console.error('Error resolving conversation:', error);
    }
  };

  const handleReopen = async (conversationId: string) => {
    try {
      const response = await fetch(`/api/messaging/conversations/${conversationId}/resolve`, { method: 'DELETE' });
      if (response.ok) {
        await fetchConversations();
        if (selectedConversation?.id === conversationId) fetchMessages(conversationId);
      }
    } catch (error) {
      console.error('Error reopening conversation:', error);
    }
  };

  const fetchMessages = useCallback(async (conversationId: string, isInitial: boolean = false) => {
    try {
      const response = await fetch(`/api/messaging/conversations/${conversationId}`);
      if (response.ok) {
        const data = await response.json();
        setMessages(data.messages || []);
        setConversations(prev => prev.map(c => c.id === conversationId ? { ...c, unreadCount: 0 } : c));
        // Only scroll to bottom on initial conversation load, not on refresh/poll
        if (isInitial) {
          setTimeout(() => scrollToBottom(), 100);
        }
      } else {
        setMessages([]);
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
      setMessages([]);
    }
  }, [scrollToBottom]);

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      await Promise.all([fetchConversations(), fetchEmployees(), fetchAssignedCustomers(), fetchAvailability()]);
      setIsLoading(false);
    };
    loadData();
  }, [fetchConversations, fetchEmployees, fetchAssignedCustomers, fetchAvailability]);

  useEffect(() => {
    const pollInterval = wsConnected ? 30000 : 5000;
    const interval = setInterval(() => {
      fetchConversations();
      if (!wsConnected && selectedConversation) fetchMessages(selectedConversation.id);
    }, pollInterval);
    return () => clearInterval(interval);
  }, [fetchConversations, fetchMessages, selectedConversation, wsConnected]);

  const handleSendMessage = async () => {
    if (!messageInput.trim() || !selectedConversation || isSending) return;

    const content = messageInput.trim();
    setIsSending(true);
    setMessageInput('');
    
    try {
      const response = await fetch(`/api/messaging/conversations/${selectedConversation.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });

      if (response.ok) {
        const data = await response.json();
        setMessages(prev => [...prev, data.message]);
        messageInputRef.current?.focus();
        fetchConversations();
        scrollToBottom();
      } else {
        setMessageInput(content);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      setMessageInput(content);
    }
    setIsSending(false);
  };

  const handleTransfer = async () => {
    if (!selectedConversation || !selectedEmployeeForTransfer) return;
    const employee = employees.find(e => e.id === selectedEmployeeForTransfer);
    if (!employee) return;

    try {
      const response = await fetch(`/api/messaging/conversations/${selectedConversation.id}/transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toEmployeeId: employee.id, toEmployeeName: employee.name, reason: transferReason }),
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

  const handleStartInternalChat = async (employee: Employee) => {
    try {
      const existingConv = conversations.find(c => 
        c.type === 'employee-internal' && c.participants.some(p => p.id === employee.id)
      );
      
      if (existingConv) {
        setSelectedConversation(existingConv);
        await fetchMessages(existingConv.id, true); // Initial load - scroll to bottom
        return;
      }
      
      const response = await fetch('/api/messaging/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ participantIds: [employee.id], participantNames: [employee.name] }),
      });

      if (response.ok) {
        const data = await response.json();
        const conv: Conversation = {
          id: data.conversation.id,
          type: data.conversation.type || 'employee-internal',
          status: data.conversation.status || 'active',
          participants: data.conversation.participants || [],
          lastMessage: data.conversation.lastMessage,
          unreadCount: 0,
          isAIHandled: false,
          createdAt: data.conversation.createdAt || new Date().toISOString(),
          lastActivityAt: data.conversation.lastActivityAt || new Date().toISOString(),
        };
        
        setConversations(prev => {
          const exists = prev.some(c => c.id === conv.id);
          return exists ? prev : [conv, ...prev];
        });
        
        setSelectedConversation(conv);
        await fetchMessages(conv.id, true); // Initial load - scroll to bottom
      }
    } catch (error) {
      console.error('Error starting internal chat:', error);
    }
  };

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

  const getCustomer = (conversation: Conversation) => conversation.participants.find(p => p.type === 'user');

  const formatConversationTime = (date: string) => {
    const d = new Date(date);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    if (diff < 60000) return 'now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
    if (diff < 86400000) return format(d, 'HH:mm');
    if (diff < 604800000) return format(d, 'EEE');
    return format(d, 'dd/MM');
  };

  const unassignedCount = conversations.filter(c => !c.assignedEmployeeId && c.type === 'user-to-support').length;
  const aiHandledCount = conversations.filter(c => c.isAIHandled).length;
  const totalUnread = conversations.reduce((sum, c) => sum + c.unreadCount, 0);

  if (isLoading) {
    return (
      <div className="min-h-[600px] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
            <MessageCircle className="w-6 h-6 text-emerald-500 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
          </div>
          <p className="text-gray-400">Loading messaging center...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-cyan-600 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <MessageCircle className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">Messaging Center</h2>
            <p className="text-gray-500 text-sm">Manage customer support and internal communications</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-2 px-4 py-2 rounded-xl border ${wsConnected ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
            {wsConnected ? (
              <>
                <Wifi className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-medium text-emerald-400">Live</span>
              </>
            ) : (
              <>
                <WifiOff className="w-4 h-4 text-red-400" />
                <span className="text-xs font-medium text-red-400">Offline</span>
              </>
            )}
          </div>
          
          <button
            onClick={toggleAvailability}
            disabled={isTogglingAvailability}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl border transition-all ${
              isAvailable 
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20' 
                : 'bg-amber-500/10 border-amber-500/30 text-amber-400 hover:bg-amber-500/20'
            } ${isTogglingAvailability ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <CircleDot className={`w-4 h-4 ${isAvailable ? 'text-emerald-400' : 'text-amber-400'}`} />
            <span className="text-xs font-medium">{isAvailable ? 'Available' : 'Away'}</span>
          </button>

          <button
            onClick={() => fetchConversations()}
            className="p-2.5 bg-white/5 border border-white/10 rounded-xl text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Active Chats', value: conversations.length, icon: MessageCircle, color: 'emerald' },
          { label: 'Unread', value: totalUnread, icon: Inbox, color: 'amber' },
          { label: 'AI Handled', value: aiHandledCount, icon: Bot, color: 'cyan' },
          { label: 'Unassigned', value: unassignedCount, icon: AlertCircle, color: 'red' },
        ].map((stat) => (
          <div key={stat.label} className="bg-[#0d0d14] border border-white/5 rounded-2xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-xs font-medium">{stat.label}</p>
                <p className="text-2xl font-bold text-white mt-1">{stat.value}</p>
              </div>
              <div className={`w-10 h-10 rounded-xl bg-${stat.color}-500/10 flex items-center justify-center`}>
                <stat.icon className={`w-5 h-5 text-${stat.color}-400`} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Main Content */}
      <div className="bg-[#0d0d14] border border-white/5 rounded-2xl overflow-hidden min-h-[650px] flex">
        {/* Sidebar */}
        <div className="w-[360px] border-r border-white/5 flex flex-col">
          {/* Tabs */}
          <div className="flex border-b border-white/5 bg-white/[0.02]">
            {[
              { id: 'support', label: 'Support', icon: Headphones },
              { id: 'my-customers', label: 'My Clients', icon: Users },
              { id: 'internal', label: 'Team', icon: Shield },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => { setActiveTab(tab.id as any); setSelectedConversation(null); }}
                className={`flex-1 flex items-center justify-center gap-2 py-4 text-sm font-medium transition-all relative ${
                  activeTab === tab.id
                    ? 'text-emerald-400'
                    : 'text-gray-500 hover:text-white'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
                {activeTab === tab.id && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-emerald-500 to-cyan-500"
                  />
                )}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="p-4 border-b border-white/5">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="text"
                placeholder="Search conversations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500/50 transition-colors"
              />
            </div>
            {activeTab === 'support' && (
              <div className="flex gap-2 mt-3">
                {(['all', 'assigned', 'unassigned'] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`flex-1 py-2 text-xs font-medium rounded-lg transition-all ${
                      filter === f
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : 'bg-white/5 text-gray-500 border border-white/5 hover:text-white hover:bg-white/10'
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
            {activeTab === 'my-customers' && (
              <div className="p-3">
                {assignedCustomers.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center mb-4">
                      <Users className="w-8 h-8 text-gray-600" />
                    </div>
                    <p className="text-gray-400 font-medium">No customers assigned</p>
                    <p className="text-gray-600 text-sm mt-1">Customers will appear here when assigned</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-2 mb-3">
                      Your Clients ({assignedCustomers.length})
                    </p>
                    {assignedCustomers.map((customer) => (
                      <button
                        key={customer.id}
                        onClick={() => startConversationWithCustomer(customer.id, customer.name, customer.avatar)}
                        className="w-full flex items-center gap-3 p-3 bg-white/5 hover:bg-white/10 rounded-xl border border-white/5 hover:border-emerald-500/30 transition-all group"
                      >
                        <div className="w-11 h-11 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
                          <span className="text-white font-bold">{customer.name.charAt(0).toUpperCase()}</span>
                        </div>
                        <div className="flex-1 min-w-0 text-left">
                          <p className="text-sm font-medium text-white truncate">{customer.name}</p>
                          <p className="text-xs text-gray-500 truncate">{customer.email}</p>
                        </div>
                        <MessageCircle className="w-4 h-4 text-gray-500 group-hover:text-emerald-400 transition-colors" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'internal' && (
              <div className="p-3 space-y-4">
                {/* Active Internal Chats */}
                {filteredConversations.filter(c => c.type === 'employee-internal').length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-2 mb-3">
                      Active Chats
                    </p>
                    <div className="space-y-1">
                      {filteredConversations.filter(c => c.type === 'employee-internal').map((conv) => {
                        const otherParticipant = conv.participants.find(p => p.id !== currentAdminId && p.type === 'employee');
                        const isSelected = selectedConversation?.id === conv.id;
                        
                        return (
                          <button
                            key={conv.id}
                            onClick={() => { setSelectedConversation(conv); fetchMessages(conv.id, true); }}
                            className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${
                              isSelected
                                ? 'bg-violet-500/20 border border-violet-500/40'
                                : 'hover:bg-white/5 border border-transparent hover:border-white/10'
                            }`}
                          >
                            <div className="relative">
                              <div className="w-11 h-11 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl flex items-center justify-center">
                                <span className="text-white font-bold">{otherParticipant?.name?.charAt(0) || 'E'}</span>
                              </div>
                              <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-500 rounded-full border-2 border-[#0d0d14]" />
                            </div>
                            <div className="flex-1 min-w-0 text-left">
                              <p className="text-sm font-medium text-white truncate">{otherParticipant?.name || 'Team Member'}</p>
                              <p className="text-xs text-gray-500 truncate">{conv.lastMessage?.content || 'Start chatting'}</p>
                            </div>
                            {conv.unreadCount > 0 && (
                              <span className="bg-violet-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                                {conv.unreadCount}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
                
                {/* Team Members */}
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-2 mb-3">
                    Team Members ({employees.length})
                  </p>
                  {employees.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                      <Users className="w-10 h-10 text-gray-600 mb-3" />
                      <p className="text-gray-500 text-sm">No team members found</p>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {employees.map((employee) => (
                        <button
                          key={employee.id}
                          onClick={() => handleStartInternalChat(employee)}
                          className="w-full flex items-center gap-3 p-3 hover:bg-white/5 rounded-xl border border-transparent hover:border-violet-500/20 transition-all group"
                        >
                          <div className="relative">
                            <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${
                              employee.isSuperAdmin
                                ? 'bg-gradient-to-br from-amber-500 to-orange-600'
                                : 'bg-gradient-to-br from-violet-500 to-purple-600'
                            }`}>
                              <span className="text-white font-bold">{employee.name?.charAt(0) || 'E'}</span>
                            </div>
                            <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-[#0d0d14] ${
                              employee.status === 'online' ? 'bg-emerald-500' : 'bg-gray-500'
                            }`} />
                          </div>
                          <div className="flex-1 min-w-0 text-left">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium text-white truncate">{employee.name}</p>
                              {employee.isSuperAdmin && (
                                <span className="px-1.5 py-0.5 text-[10px] bg-amber-500/20 text-amber-400 rounded font-semibold">
                                  ADMIN
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-gray-500">{employee.role}</p>
                          </div>
                          <MessageCircle className="w-4 h-4 text-gray-600 group-hover:text-violet-400 transition-colors" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'support' && (
              filteredConversations.filter(c => c.type === 'user-to-support').length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full py-12 text-center px-4">
                  <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center mb-4">
                    <Inbox className="w-8 h-8 text-gray-600" />
                  </div>
                  <p className="text-gray-400 font-medium">No support conversations</p>
                  <p className="text-gray-600 text-sm mt-1">Customer chats will appear here</p>
                </div>
              ) : (
                <div className="p-3 space-y-1">
                  {filteredConversations.filter(c => c.type === 'user-to-support').map((conv) => {
                    const customer = getCustomer(conv);
                    const isSelected = selectedConversation?.id === conv.id;
                    
                    return (
                      <button
                        key={conv.id}
                        onClick={() => { setSelectedConversation(conv); fetchMessages(conv.id, true); }}
                        className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${
                          isSelected
                            ? 'bg-emerald-500/10 border border-emerald-500/30'
                            : 'hover:bg-white/5 border border-transparent hover:border-white/10'
                        }`}
                      >
                        <div className="relative">
                          <div className="w-11 h-11 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center">
                            <span className="text-white font-bold">{customer?.name?.charAt(0) || '?'}</span>
                          </div>
                          {conv.isResolved ? (
                            <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-emerald-500 rounded-full border-2 border-[#0d0d14] flex items-center justify-center">
                              <Check className="w-2.5 h-2.5 text-white" />
                            </div>
                          ) : conv.isAIHandled ? (
                            <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-cyan-500 rounded-full border-2 border-[#0d0d14] flex items-center justify-center">
                              <Sparkles className="w-2.5 h-2.5 text-white" />
                            </div>
                          ) : null}
                        </div>
                        <div className="flex-1 min-w-0 text-left">
                          <div className="flex items-center justify-between mb-0.5">
                            <p className={`text-sm font-medium truncate ${conv.unreadCount > 0 ? 'text-white' : 'text-gray-300'}`}>
                              {customer?.name || 'Customer'}
                            </p>
                            <span className="text-[10px] text-gray-500 ml-2">
                              {conv.lastMessage?.timestamp && formatConversationTime(conv.lastMessage.timestamp)}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            {conv.isAIHandled && !conv.isResolved && (
                              <span className="text-[10px] text-cyan-400 flex items-center gap-0.5">
                                <Bot className="w-3 h-3" />
                              </span>
                            )}
                            <p className={`text-xs truncate ${conv.unreadCount > 0 ? 'text-gray-300' : 'text-gray-500'}`}>
                              {conv.lastMessage?.content || 'No messages yet'}
                            </p>
                          </div>
                        </div>
                        {conv.unreadCount > 0 && (
                          <span className="bg-emerald-500 text-white text-xs font-bold min-w-[20px] h-5 px-1.5 rounded-full flex items-center justify-center">
                            {conv.unreadCount}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )
            )}
          </div>
        </div>

        {/* Chat Area */}
        <div className="flex-1 flex flex-col bg-[#08080c]">
          {selectedConversation ? (
            <>
              {/* Chat Header */}
              <div className="px-6 py-4 border-b border-white/5 bg-[#0d0d14] flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                    selectedConversation.type === 'user-to-support'
                      ? 'bg-gradient-to-br from-blue-500 to-indigo-600'
                      : 'bg-gradient-to-br from-violet-500 to-purple-600'
                  }`}>
                    {selectedConversation.type === 'user-to-support' ? (
                      <User className="w-6 h-6 text-white" />
                    ) : (
                      <Users className="w-6 h-6 text-white" />
                    )}
                  </div>
                  <div>
                    <h3 className="font-semibold text-white text-lg">
                      {selectedConversation.type === 'user-to-support'
                        ? getCustomer(selectedConversation)?.name || 'Customer'
                        : selectedConversation.participants.find(p => p.id !== currentAdminId)?.name || 'Team Chat'
                      }
                    </h3>
                    <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
                      {selectedConversation.type === 'employee-internal' && (
                        <span className="flex items-center gap-1 text-violet-400">
                          <Shield className="w-3 h-3" /> Internal
                        </span>
                      )}
                      {selectedConversation.isResolved && (
                        <span className="flex items-center gap-1 text-emerald-400">
                          <CheckCircle className="w-3 h-3" /> Resolved
                        </span>
                      )}
                      {selectedConversation.isAIHandled && !selectedConversation.isResolved && (
                        <span className="flex items-center gap-1 text-cyan-400">
                          <Bot className="w-3 h-3" /> AI Handling
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  {selectedConversation.type === 'user-to-support' && (
                    <>
                      <button
                        onClick={() => setShowTransferModal(true)}
                        className="px-4 py-2 bg-white/5 border border-white/10 text-white text-sm rounded-xl hover:bg-white/10 transition-colors flex items-center gap-2"
                      >
                        <ArrowLeftRight className="w-4 h-4" />
                        Transfer
                      </button>
                      
                      {!selectedConversation.isAIHandled && (
                        selectedConversation.isResolved ? (
                          <button
                            onClick={() => handleReopen(selectedConversation.id)}
                            className="px-4 py-2 bg-violet-500/20 border border-violet-500/30 text-violet-400 text-sm rounded-xl hover:bg-violet-500/30 transition-colors flex items-center gap-2"
                          >
                            <RotateCcw className="w-4 h-4" />
                            Reopen
                          </button>
                        ) : (
                          <button
                            onClick={() => handleResolve(selectedConversation.id)}
                            className="px-4 py-2 bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-sm rounded-xl hover:bg-emerald-500/30 transition-colors flex items-center gap-2"
                          >
                            <CheckCircle className="w-4 h-4" />
                            Resolve
                          </button>
                        )
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Customer Info Bar */}
              {selectedConversation.type === 'user-to-support' && (
                <div className="px-6 py-2 bg-white/[0.02] border-b border-white/5 flex items-center gap-6 text-xs">
                  <span className="flex items-center gap-1.5 text-gray-400">
                    <User className="w-3.5 h-3.5" />
                    {getCustomer(selectedConversation)?.name || 'Customer'}
                  </span>
                  <span className="flex items-center gap-1.5 text-gray-400">
                    <Clock className="w-3.5 h-3.5" />
                    Started {formatDistanceToNow(new Date(selectedConversation.createdAt), { addSuffix: true })}
                  </span>
                  {selectedConversation.assignedEmployeeName && (
                    <span className="flex items-center gap-1.5 text-emerald-400">
                      <Shield className="w-3.5 h-3.5" />
                      Assigned to {selectedConversation.assignedEmployeeName}
                    </span>
                  )}
                </div>
              )}

              {/* Messages */}
              <div 
                ref={messagesContainerRef}
                onScroll={handleScroll}
                className="flex-1 overflow-y-auto p-6 space-y-4"
                style={{ background: 'radial-gradient(ellipse at top, rgba(16,185,129,0.02) 0%, transparent 50%)' }}
              >
                {messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center">
                    <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center mb-4">
                      <MessageCircle className="w-8 h-8 text-gray-600" />
                    </div>
                    <p className="text-gray-400">No messages yet</p>
                    <p className="text-gray-600 text-sm mt-1">Start the conversation</p>
                  </div>
                ) : (
                  messages.map((message, index) => {
                    const isOwnMessage = message.senderId === currentAdminId;
                    const isAI = message.senderType === 'ai';
                    const isSystem = message.messageType === 'system' || message.senderType === 'system';
                    const showAvatar = !isOwnMessage && (index === 0 || messages[index - 1].senderId !== message.senderId);

                    if (isSystem) {
                      return (
                        <div key={message.id} className="flex justify-center my-4">
                          <span className="text-xs text-gray-500 bg-white/5 px-4 py-2 rounded-full max-w-[80%] text-center">
                            {message.content}
                          </span>
                        </div>
                      );
                    }

                    return (
                      <div key={message.id} className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'} gap-2`}>
                        {!isOwnMessage && showAvatar && (
                          <div className={`w-8 h-8 rounded-xl flex-shrink-0 flex items-center justify-center ${
                            isAI ? 'bg-gradient-to-br from-cyan-500 to-emerald-600' 
                              : message.senderType === 'employee' ? 'bg-gradient-to-br from-purple-500 to-pink-600'
                              : 'bg-gradient-to-br from-blue-500 to-indigo-600'
                          }`}>
                            {isAI ? (
                              <Sparkles className="w-4 h-4 text-white" />
                            ) : (
                              <span className="text-white text-xs font-bold">{message.senderName?.charAt(0)}</span>
                            )}
                          </div>
                        )}
                        {!isOwnMessage && !showAvatar && <div className="w-8" />}
                        
                        <div className={`max-w-[70%] ${isOwnMessage ? 'order-first' : ''}`}>
                          {!isOwnMessage && showAvatar && (
                            <p className="text-xs text-gray-500 mb-1 ml-1 flex items-center gap-1">
                              {isAI && <Sparkles className="w-3 h-3 text-cyan-400" />}
                              {message.senderName}
                              {message.senderType === 'employee' && <span className="text-purple-400">(Staff)</span>}
                            </p>
                          )}
                          <div
                            className={`px-4 py-3 ${
                              isOwnMessage
                                ? 'bg-gradient-to-r from-emerald-500 to-cyan-600 text-white rounded-2xl rounded-br-md'
                                : isAI
                                  ? 'bg-white/5 text-white rounded-2xl rounded-bl-md border border-cyan-500/20'
                                  : message.senderType === 'employee'
                                    ? 'bg-white/5 text-white rounded-2xl rounded-bl-md border border-purple-500/20'
                                    : 'bg-white/10 text-white rounded-2xl rounded-bl-md'
                            }`}
                          >
                            <p className="text-[15px] whitespace-pre-wrap leading-relaxed">{message.content}</p>
                            {message.isModerated && (
                              <p className="text-xs text-amber-400 mt-2">⚠️ Content moderated: {message.moderationReason}</p>
                            )}
                          </div>
                          <div className={`flex items-center gap-1.5 mt-1.5 text-[11px] ${isOwnMessage ? 'justify-end text-white/50' : 'text-gray-500'}`}>
                            <span>{format(new Date(message.createdAt), 'HH:mm')}</span>
                            {isOwnMessage && (
                              message.readBy && message.readBy.length > 0 
                                ? <CheckCheck className="w-3.5 h-3.5 text-emerald-400" />
                                : <Check className="w-3.5 h-3.5" />
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Scroll to Bottom Button */}
              <AnimatePresence>
                {showScrollButton && (
                  <motion.button
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    onClick={scrollToBottom}
                    className="absolute bottom-24 right-8 w-10 h-10 bg-emerald-500 text-white rounded-full shadow-lg shadow-emerald-500/25 flex items-center justify-center hover:bg-emerald-400 transition-colors z-10"
                  >
                    <ChevronDown className="w-5 h-5" />
                  </motion.button>
                )}
              </AnimatePresence>

              {/* Typing Indicator */}
              {typingUsers.size > 0 && (
                <div className="px-6 py-3 border-t border-white/5 text-sm text-gray-400 flex items-center gap-2">
                  <div className="flex gap-1">
                    {[0, 1, 2].map((i) => (
                      <span key={i} className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: `${i * 150}ms` }} />
                    ))}
                  </div>
                  <span>{Array.from(typingUsers.values()).map(u => u.name).join(', ')} is typing...</span>
                </div>
              )}

              {/* Message Input */}
              <div className="p-4 border-t border-white/5 bg-[#0d0d14]">
                <div className="flex items-center gap-3">
                  <div className="flex-1 relative">
                    <input
                      ref={messageInputRef}
                      type="text"
                      placeholder="Type a message..."
                      value={messageInput}
                      onChange={(e) => {
                        setMessageInput(e.target.value);
                        if (selectedConversation && wsConnected) {
                          wsSetTyping(selectedConversation.id, true);
                          if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
                          typingTimeoutRef.current = setTimeout(() => {
                            if (selectedConversation) wsSetTyping(selectedConversation.id, false);
                          }, 2000);
                        }
                      }}
                      onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500/50 transition-colors"
                    />
                  </div>
                  <button
                    onClick={handleSendMessage}
                    disabled={!messageInput.trim() || isSending}
                    className="w-12 h-12 bg-gradient-to-r from-emerald-500 to-cyan-600 rounded-xl text-white flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg hover:shadow-emerald-500/25 transition-all"
                  >
                    {isSending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center">
              <div className="w-24 h-24 bg-white/5 rounded-3xl flex items-center justify-center mb-6">
                <MessageCircle className="w-12 h-12 text-gray-600" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Select a Conversation</h3>
              <p className="text-gray-500 text-center max-w-md">
                Choose a conversation from the sidebar to view messages and respond to customers or team members.
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
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50"
            onClick={() => setShowTransferModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-[#0d0d14] border border-white/10 rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <ArrowLeftRight className="w-5 h-5 text-emerald-400" />
                  Transfer Conversation
                </h3>
                <button onClick={() => setShowTransferModal(false)} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                  <X className="w-4 h-4 text-gray-400" />
                </button>
              </div>

              <div className="space-y-5">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Transfer to</label>
                  <select
                    value={selectedEmployeeForTransfer}
                    onChange={(e) => setSelectedEmployeeForTransfer(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500/50"
                  >
                    <option value="">Select an employee...</option>
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.id}>{emp.name} ({emp.role})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-2">Reason (optional)</label>
                  <input
                    type="text"
                    value={transferReason}
                    onChange={(e) => setTransferReason(e.target.value)}
                    placeholder="e.g., Specialist needed"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500/50"
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => setShowTransferModal(false)}
                    className="flex-1 px-4 py-3 bg-white/5 border border-white/10 text-white rounded-xl hover:bg-white/10 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleTransfer}
                    disabled={!selectedEmployeeForTransfer}
                    className="flex-1 px-4 py-3 bg-gradient-to-r from-emerald-500 to-cyan-600 text-white rounded-xl disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg hover:shadow-emerald-500/25 transition-all"
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
