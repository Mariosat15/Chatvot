'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageCircle,
  Users,
  UserPlus,
  Search,
  Send,
  Paperclip,
  Check,
  CheckCheck,
  Clock,
  Headphones,
  Bot,
  ArrowLeft,
  X,
  UserCircle,
  Briefcase,
  Loader2,
  ChevronDown,
  Sparkles,
  Shield,
  Trash2,
  MoreVertical,
  Plus,
  Archive,
  AlertTriangle,
  Ticket,
} from 'lucide-react';
import EmojiPicker from '@/components/chat/EmojiPicker';
import { formatDistanceToNow, format } from 'date-fns';
import { useWebSocket } from '@/hooks/useWebSocket';

interface Session {
  user: {
    id: string;
    name: string;
    email: string;
    image?: string;
  };
}

interface MessagingClientProps {
  session: Session;
}

interface Conversation {
  id: string;
  type: 'user-to-user' | 'user-to-support';
  status: string;
  // Ticket system fields
  ticketNumber?: number;
  isArchived?: boolean;
  archivedAt?: string;
  resolvedByName?: string;
  // Participants
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
  assignedEmployeeName?: string;
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
  isEdited: boolean;
  createdAt: string;
}

interface Friend {
  id: string;
  friendId: string;
  friendName: string;
  friendAvatar?: string;
  isMuted: boolean;
}

interface FriendRequest {
  id: string;
  fromUserId?: string;
  fromUserName?: string;
  fromUserAvatar?: string;
  toUserId?: string;
  toUserName?: string;
  message?: string;
  createdAt: string;
}

interface AssignedAgent {
  id: string;
  name: string;
  email: string;
  role: string;
  avatar?: string;
  assignedAt: string;
}

export default function MessagingClient({ session }: MessagingClientProps) {
  const [activeTab, setActiveTab] = useState<'chats' | 'friends' | 'requests'>('chats');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [friendRequests, setFriendRequests] = useState<{ received: FriendRequest[]; sent: FriendRequest[] }>({ received: [], sent: [] });
  const [messageInput, setMessageInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [showMobileChat, setShowMobileChat] = useState(false);
  const [unreadTotal, setUnreadTotal] = useState(0);
  const [assignedAgent, setAssignedAgent] = useState<AssignedAgent | null>(null);
  const [typingUsers, setTypingUsers] = useState<Map<string, { name: string; timestamp: number }>>(new Map());
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [showChatMenu, setShowChatMenu] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [supportTickets, setSupportTickets] = useState<Conversation[]>([]);
  const [showNewTicketConfirm, setShowNewTicketConfirm] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatMenuRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const messageInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isUserAtBottomRef = useRef(true);
  const isInitialLoadRef = useRef(true); // Track if this is the first load of messages

  // WebSocket for real-time messaging
  const handleWebSocketMessage = useCallback((message: { type: string; data: any }) => {
    console.log('📨 [WS] Received:', message.type, message.data?.conversationId);
    
    switch (message.type) {
      case 'new_message':
        if (message.data.conversationId === selectedConversation?.id) {
          console.log('📨 [WS] New message for current conv, senderId:', message.data.message?.senderId);
          
          setMessages(prev => {
            if (prev.some(m => m.id === message.data.message.id)) {
              console.log('📨 [WS] Message already exists, skipping');
              return prev;
            }
            console.log('📨 [WS] Adding message:', message.data.message.content?.slice(0, 30));
            return [...prev, message.data.message];
          });
          
          // Only scroll if user is at bottom
          if (isUserAtBottomRef.current) {
            setTimeout(() => scrollToBottom(), 100);
          }
        }
        fetchConversations();
        break;
        
      case 'typing':
        if (message.data.conversationId === selectedConversation?.id) {
          if (message.data.isTyping && message.data.participantId !== session.user.id) {
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
        
      case 'read_receipt':
        if (message.data.conversationId === selectedConversation?.id) {
          setMessages(prev => prev.map(m => ({
            ...m,
            readBy: [...(m.readBy || []), { 
              participantId: message.data.participantId, 
              readAt: message.data.readAt 
            }]
          })));
        }
        break;
        
      case 'friend_request':
        fetchFriendRequests();
        break;
        
      case 'presence':
        break;
    }
  }, [selectedConversation?.id, session.user.id]);

  const { 
    isConnected: wsConnected, 
    subscribe: wsSubscribe, 
    unsubscribe: wsUnsubscribe,
    setTyping: wsSetTyping,
  } = useWebSocket({
    token: session.user.id,
    onMessage: handleWebSocketMessage,
    onConnect: () => console.log('✅ [WS] Connected'),
    onDisconnect: () => console.log('❌ [WS] Disconnected'),
  });

  // Subscribe to conversation when selected
  useEffect(() => {
    if (selectedConversation?.id && wsConnected) {
      wsSubscribe(selectedConversation.id);
      return () => {
        wsUnsubscribe(selectedConversation.id);
      };
    }
  }, [selectedConversation?.id, wsConnected, wsSubscribe, wsUnsubscribe]);

  // Clear stale typing indicators
  useEffect(() => {
    const interval = setInterval(() => {
      setTypingUsers(prev => {
        const now = Date.now();
        const newMap = new Map(prev);
        for (const [id, data] of newMap) {
          if (now - data.timestamp > 5000) {
            newMap.delete(id);
          }
        }
        return newMap.size !== prev.size ? newMap : prev;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Scroll handling - detect if user is at bottom
  const handleScroll = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    
    const { scrollTop, scrollHeight, clientHeight } = container;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 100;
    isUserAtBottomRef.current = isAtBottom;
    setShowScrollButton(!isAtBottom && messages.length > 0);
  }, [messages.length]);

  // Scroll to bottom helper
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    isUserAtBottomRef.current = true;
    setShowScrollButton(false);
  }, []);

  // Fetch assigned account manager
  const fetchAssignedAgent = useCallback(async () => {
    try {
      const response = await fetch('/api/messaging/assigned-support');
      if (response.ok) {
        const data = await response.json();
        setAssignedAgent(data.agent);
      }
    } catch (error) {
      console.error('Error fetching assigned agent:', error);
    }
  }, []);

  // Fetch support ticket history
  const fetchSupportTickets = useCallback(async () => {
    try {
      const response = await fetch('/api/messaging/support/history');
      if (response.ok) {
        const data = await response.json();
        // Map tickets to conversation format
        const tickets = data.tickets.map((t: any) => ({
          id: t.id,
          type: 'user-to-support' as const,
          status: t.status,
          ticketNumber: t.ticketNumber,
          isArchived: t.isArchived || t.isResolved,
          archivedAt: t.archivedAt,
          resolvedByName: t.resolvedByName,
          participants: [],
          lastMessage: t.lastMessage,
          unreadCount: 0,
          isAIHandled: t.isAIHandled,
          assignedEmployeeName: t.assignedEmployeeName,
          lastActivityAt: t.lastActivityAt || t.createdAt,
        }));
        setSupportTickets(tickets);
      }
    } catch (error) {
      console.error('Error fetching support tickets:', error);
    }
  }, []);

  // Fetch conversations
  const fetchConversations = useCallback(async () => {
    try {
      const response = await fetch('/api/messaging/conversations');
      if (response.ok) {
        const data = await response.json();
        setConversations(data.conversations);
        setUnreadTotal(data.conversations.reduce((sum: number, c: Conversation) => sum + c.unreadCount, 0));
      }
    } catch (error) {
      console.error('Error fetching conversations:', error);
    }
  }, []);

  // Fetch friends
  const fetchFriends = useCallback(async () => {
    try {
      const response = await fetch('/api/messaging/friends');
      if (response.ok) {
        const data = await response.json();
        setFriends(data.friends);
      }
    } catch (error) {
      console.error('Error fetching friends:', error);
    }
  }, []);

  // Fetch friend requests
  const fetchFriendRequests = useCallback(async () => {
    try {
      const response = await fetch('/api/messaging/friends/requests');
      if (response.ok) {
        const data = await response.json();
        setFriendRequests(data);
      }
    } catch (error) {
      console.error('Error fetching friend requests:', error);
    }
  }, []);

  // Fetch messages for selected conversation
  const fetchMessages = useCallback(async (conversationId: string, isInitial: boolean = false) => {
    try {
      console.log(`📩 [FetchMsg] Fetching messages for: ${conversationId}, isInitial: ${isInitial}`);
      const response = await fetch(`/api/messaging/conversations/${conversationId}`);
      if (response.ok) {
        const data = await response.json();
        console.log(`📩 [FetchMsg] Received ${data.messages?.length || 0} messages`);
        setMessages(data.messages || []);
        
        // Only scroll to bottom on initial conversation load, not on refresh/poll
        if (isInitial) {
          setTimeout(() => scrollToBottom(), 100);
        }
        
        fetch(`/api/messaging/conversations/${conversationId}/read`, { method: 'POST' });
      } else {
        console.error(`📩 [FetchMsg] Failed: ${response.status}`);
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  }, [scrollToBottom]);

  // Search users
  const searchUsers = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    
    setIsSearching(true);
    try {
      const response = await fetch(`/api/messaging/users/search?q=${encodeURIComponent(query)}`);
      if (response.ok) {
        const data = await response.json();
        setSearchResults(data.users || []);
      }
    } catch (error) {
      console.error('Error searching users:', error);
    } finally {
      setIsSearching(false);
    }
  }, []);

  // Send message
  const sendMessage = async () => {
    if (!messageInput.trim() || !selectedConversation || isSending) return;

    const messageContent = messageInput.trim();
    setIsSending(true);
    setMessageInput('');
    
    try {
      const endpoint = selectedConversation.type === 'user-to-support'
        ? '/api/messaging/support'
        : `/api/messaging/conversations/${selectedConversation.id}/messages`;
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: messageContent }),
      });

      const data = await response.json();
      
      if (response.ok) {
        if (data.message) {
          setMessages(prev => {
            if (prev.some(m => m.id === data.message.id)) return prev;
            return [...prev, data.message];
          });
        }
        scrollToBottom();
        
        if (data.aiResponse) {
          setTimeout(() => {
            setMessages(prev => {
              if (prev.some(m => m.id === data.aiResponse.id)) return prev;
              return [...prev, data.aiResponse];
            });
            scrollToBottom();
          }, 800);
        }
        
        fetchConversations();
      } else {
        setMessageInput(messageContent);
        alert(data.error || 'Failed to send message');
      }
    } catch (error) {
      setMessageInput(messageContent);
      alert('Network error');
    } finally {
      setIsSending(false);
    }
  };

  // Check if there's an active (non-archived) support conversation
  const hasActiveTicket = supportTickets.some(t => !t.isArchived);
  const activeTicket = supportTickets.find(t => !t.isArchived);

  // Start support conversation (opens active one or creates new)
  const startSupportConversation = async () => {
    try {
      const response = await fetch('/api/messaging/support');
      if (response.ok) {
        const data = await response.json();
        setSelectedConversation(data.conversation);
        setMessages(data.messages || []);
        setShowMobileChat(true);
        await Promise.all([fetchConversations(), fetchSupportTickets()]);
        setTimeout(() => scrollToBottom(), 100);
      } else {
        alert('Failed to start support conversation');
      }
    } catch (error) {
      alert('Error connecting to support');
    }
  };

  // Request to create a new support ticket (resolve current if exists)
  const requestNewTicket = () => {
    if (hasActiveTicket) {
      setShowNewTicketConfirm(true);
    } else {
      startSupportConversation();
    }
  };

  // Create new ticket (after confirmation)
  const createNewTicket = async () => {
    setShowNewTicketConfirm(false);
    
    // First, we need to resolve the current active ticket by sending it to the server
    // The server's getOrCreateSupportConversation will create a new one if current is resolved
    if (activeTicket) {
      try {
        // Mark current as needing new ticket (server will handle this)
        const response = await fetch(`/api/messaging/support/new-ticket`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });
        
        if (response.ok) {
          const data = await response.json();
          setSelectedConversation(data.conversation);
          setMessages(data.messages || []);
          setShowMobileChat(true);
          await Promise.all([fetchConversations(), fetchSupportTickets()]);
          setTimeout(() => scrollToBottom(), 100);
        } else {
          alert('Failed to create new ticket');
        }
      } catch (error) {
        alert('Error creating new ticket');
      }
    }
  };

  // View an existing ticket (including archived ones)
  const viewTicket = async (ticketId: string) => {
    try {
      const response = await fetch(`/api/messaging/conversations/${ticketId}`);
      if (response.ok) {
        const data = await response.json();
        // Find the ticket in our list to get metadata
        const ticket = supportTickets.find(t => t.id === ticketId);
        setSelectedConversation({
          ...data.conversation,
          ticketNumber: ticket?.ticketNumber,
          isArchived: ticket?.isArchived,
          archivedAt: ticket?.archivedAt,
          resolvedByName: ticket?.resolvedByName,
        });
        setMessages(data.messages || []);
        setShowMobileChat(true);
        setTimeout(() => scrollToBottom(), 100);
      }
    } catch (error) {
      console.error('Error viewing ticket:', error);
    }
  };

  // Clear conversation history
  const clearConversation = async () => {
    if (!selectedConversation) return;
    
    if (!confirm('Are you sure you want to clear the chat history? This action cannot be undone.')) {
      return;
    }
    
    setIsClearing(true);
    setShowChatMenu(false);
    
    try {
      const response = await fetch(`/api/messaging/conversations/${selectedConversation.id}/clear`, {
        method: 'POST',
      });
      
      if (response.ok) {
        // Refresh messages
        await fetchMessages(selectedConversation.id, true);
        await fetchConversations();
      } else {
        alert('Failed to clear conversation');
      }
    } catch (error) {
      alert('Error clearing conversation');
    } finally {
      setIsClearing(false);
    }
  };

  // Handle emoji selection
  const handleEmojiSelect = (emoji: string) => {
    setMessageInput(prev => prev + emoji);
    messageInputRef.current?.focus();
  };

  // Close chat menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (chatMenuRef.current && !chatMenuRef.current.contains(event.target as Node)) {
        setShowChatMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Initial data fetch
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      await Promise.all([
        fetchConversations(),
        fetchFriends(),
        fetchFriendRequests(),
        fetchAssignedAgent(),
        fetchSupportTickets(),
      ]);
      setIsLoading(false);
    };
    loadData();
  }, [fetchConversations, fetchFriends, fetchFriendRequests, fetchAssignedAgent, fetchSupportTickets]);

  // Track selected conversation ID
  const selectedConversationIdRef = useRef<string | null>(null);
  const lastMessageFetchRef = useRef<number>(0);
  
  useEffect(() => {
    const conversationId = selectedConversation?.id;
    if (conversationId && conversationId !== selectedConversationIdRef.current) {
      selectedConversationIdRef.current = conversationId;
      lastMessageFetchRef.current = Date.now();
      fetchMessages(conversationId, true); // Initial load - scroll to bottom
    }
  }, [selectedConversation?.id, fetchMessages]);

  // Poll for new messages (fallback when WebSocket not connected)
  useEffect(() => {
    if (wsConnected) return;
    
    const interval = setInterval(() => {
      const timeSinceLastFetch = Date.now() - lastMessageFetchRef.current;
      if (timeSinceLastFetch < 3000) return;
      
      fetchConversations();
      if (selectedConversation) {
        lastMessageFetchRef.current = Date.now();
        fetchMessages(selectedConversation.id);
      }
    }, 8000);

    return () => clearInterval(interval);
  }, [selectedConversation?.id, fetchConversations, fetchMessages, wsConnected]);

  // Search debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery) searchUsers(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, searchUsers]);

  // Helper functions
  const getConversationName = (conv: Conversation) => {
    if (conv.type === 'user-to-support') {
      return conv.isAIHandled ? 'AI Support' : conv.assignedEmployeeName || 'Support';
    }
    const other = conv.participants.find(p => p.id !== session.user.id);
    return other?.name || 'Unknown';
  };

  const getConversationAvatar = (conv: Conversation) => {
    if (conv.type === 'user-to-support') return null;
    const other = conv.participants.find(p => p.id !== session.user.id);
    return other?.avatar;
  };

  const isOwnMessage = (msg: Message) => msg.senderId === session.user.id;

  const getMessageStatus = (msg: Message) => {
    if (msg.readBy && msg.readBy.some(r => r.participantId !== session.user.id)) {
      return <CheckCheck className="w-3.5 h-3.5 text-cyan-400" />;
    }
    return <Check className="w-3.5 h-3.5 text-gray-400" />;
  };

  const formatMessageTime = (date: string) => {
    return format(new Date(date), 'HH:mm');
  };

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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#0a0a0f]">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
            <MessageCircle className="w-6 h-6 text-cyan-500 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
          </div>
          <p className="text-gray-400 font-medium">Loading messages...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] bg-[#0a0a0f]">
      {/* Sidebar */}
      <div className={`w-full md:w-[380px] bg-[#0d0d14] border-r border-white/5 flex flex-col ${showMobileChat ? 'hidden md:flex' : 'flex'}`}>
        {/* Header */}
        <div className="p-5 border-b border-white/5">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl flex items-center justify-center">
                <MessageCircle className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-white">Messages</h1>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <span className={`w-2 h-2 rounded-full ${wsConnected ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`} />
                  {wsConnected ? 'Connected' : 'Connecting...'}
                </div>
              </div>
            </div>
            {unreadTotal > 0 && (
              <span className="bg-red-500 text-white text-xs font-bold px-2.5 py-1 rounded-full">
                {unreadTotal}
              </span>
            )}
          </div>

          {/* Account Manager Card */}
          {assignedAgent && (
            <button
              onClick={startSupportConversation}
              className="w-full p-4 bg-gradient-to-r from-cyan-500/10 via-blue-500/10 to-purple-500/10 rounded-2xl border border-cyan-500/20 hover:border-cyan-500/40 transition-all duration-300 group mb-4"
            >
              <div className="flex items-center gap-4">
                <div className="relative">
                  <div className="w-14 h-14 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-cyan-500/20 group-hover:shadow-cyan-500/40 transition-shadow">
                    {assignedAgent.avatar ? (
                      <img src={assignedAgent.avatar} alt="" className="w-14 h-14 rounded-2xl object-cover" />
                    ) : (
                      <UserCircle className="w-8 h-8 text-white" />
                    )}
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-emerald-500 rounded-full border-2 border-[#0d0d14] flex items-center justify-center">
                    <Shield className="w-2.5 h-2.5 text-white" />
                  </div>
                </div>
                <div className="flex-1 text-left">
                  <p className="text-[11px] uppercase tracking-wider text-cyan-400 font-semibold mb-0.5">Your Account Manager</p>
                  <p className="text-white font-semibold text-base">{assignedAgent.name}</p>
                  <p className="text-gray-400 text-xs">{assignedAgent.role}</p>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <div className="w-10 h-10 bg-cyan-500/20 rounded-xl flex items-center justify-center group-hover:bg-cyan-500/30 transition-colors">
                    <MessageCircle className="w-5 h-5 text-cyan-400" />
                  </div>
                  <span className="text-[9px] text-cyan-400 font-medium">CHAT</span>
                </div>
              </div>
            </button>
          )}
          
          {/* Support Button (no assigned agent) */}
          {!assignedAgent && (
            <button
              onClick={startSupportConversation}
              className="w-full p-4 bg-gradient-to-r from-emerald-500/10 to-teal-500/10 rounded-2xl border border-emerald-500/20 hover:border-emerald-500/40 transition-all flex items-center gap-4 mb-4"
            >
              <div className="w-14 h-14 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-500/20">
                <Headphones className="w-7 h-7 text-white" />
              </div>
              <div className="flex-1 text-left">
                <p className="text-white font-semibold">Contact Support</p>
                <p className="text-gray-400 text-sm">Get help from our team</p>
              </div>
              <Send className="w-5 h-5 text-emerald-400" />
            </button>
          )}

          {/* Tabs */}
          <div className="flex bg-white/5 rounded-xl p-1">
            {['chats', 'friends', 'requests'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab as any)}
                className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-all relative ${
                  activeTab === tab 
                    ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/25' 
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
                {tab === 'requests' && friendRequests.received.length > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center">
                    {friendRequests.received.length}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Conversations List */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === 'chats' && (
            <>
              {/* Support Tickets Section */}
              {supportTickets.length > 0 && (
                <div className="border-b border-white/5">
                  <div className="flex items-center justify-between px-4 py-3 bg-white/[0.02]">
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                      <Ticket className="w-3.5 h-3.5" />
                      Support Tickets ({supportTickets.length})
                    </span>
                    <button
                      onClick={requestNewTicket}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-500/20 text-cyan-400 text-xs font-medium rounded-lg hover:bg-cyan-500/30 transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      New Ticket
                    </button>
                  </div>
                  <div className="divide-y divide-white/5">
                    {supportTickets.map((ticket) => {
                      const isArchived = ticket.isArchived;
                      return (
                        <button
                          key={ticket.id}
                          onClick={() => viewTicket(ticket.id)}
                          className={`w-full p-4 flex items-center gap-3 hover:bg-white/5 transition-colors ${
                            selectedConversation?.id === ticket.id ? 'bg-white/5' : ''
                          } ${isArchived ? 'opacity-60' : ''}`}
                        >
                          <div className="relative">
                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                              isArchived 
                                ? 'bg-gradient-to-br from-gray-500/20 to-gray-600/20 border border-gray-500/30'
                                : ticket.isAIHandled 
                                  ? 'bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/30'
                                  : 'bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-500/30'
                            }`}>
                              {isArchived ? (
                                <Archive className="w-6 h-6 text-gray-400" />
                              ) : ticket.isAIHandled ? (
                                <Sparkles className="w-6 h-6 text-purple-400" />
                              ) : (
                                <Headphones className="w-6 h-6 text-cyan-400" />
                              )}
                            </div>
                            {isArchived && (
                              <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-gray-500 rounded-full border-2 border-[#0d0d14] flex items-center justify-center">
                                <Check className="w-2.5 h-2.5 text-white" />
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0 text-left">
                            <div className="flex items-center justify-between mb-1">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className={`font-semibold truncate ${isArchived ? 'text-gray-400' : 'text-gray-300'}`}>
                                  {ticket.assignedEmployeeName || (ticket.isAIHandled ? 'AI Support' : 'Support')}
                                </span>
                                {ticket.ticketNumber && (
                                  <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${
                                    isArchived
                                      ? 'bg-gray-500/20 text-gray-500'
                                      : 'bg-cyan-500/20 text-cyan-400'
                                  }`}>
                                    #{ticket.ticketNumber}
                                  </span>
                                )}
                                {isArchived && (
                                  <span className="text-[9px] px-1.5 py-0.5 bg-gray-500/20 text-gray-400 rounded font-medium">
                                    RESOLVED
                                  </span>
                                )}
                              </div>
                              <span className="text-xs text-gray-500 ml-2 flex-shrink-0">
                                {ticket.lastMessage?.timestamp && formatConversationTime(ticket.lastMessage.timestamp)}
                              </span>
                            </div>
                            <p className={`text-sm truncate ${isArchived ? 'text-gray-500' : 'text-gray-400'}`}>
                              {ticket.lastMessage?.content || 'No messages yet'}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              
              {/* Start Support Button (when no tickets) */}
              {supportTickets.length === 0 && (
                <div className="p-4 border-b border-white/5">
                  <button
                    onClick={startSupportConversation}
                    className="w-full p-4 bg-gradient-to-r from-cyan-500/10 to-blue-500/10 rounded-2xl border border-cyan-500/20 hover:border-cyan-500/40 transition-all flex items-center gap-4"
                  >
                    <div className="w-12 h-12 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-cyan-500/20">
                      <Headphones className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex-1 text-left">
                      <p className="text-white font-semibold">Start Support Conversation</p>
                      <p className="text-gray-400 text-sm">Get help from our team</p>
                    </div>
                    <Plus className="w-5 h-5 text-cyan-400" />
                  </button>
                </div>
              )}

              {/* Other Conversations (user-to-user) */}
              {conversations.filter(c => c.type !== 'user-to-support').length > 0 && (
                <div>
                  <div className="px-4 py-3 bg-white/[0.02]">
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Direct Messages
                    </span>
                  </div>
                  <div className="divide-y divide-white/5">
                    {conversations.filter(c => c.type !== 'user-to-support').map((conv) => (
                      <button
                        key={conv.id}
                        onClick={async () => {
                          setSelectedConversation(conv);
                          setShowMobileChat(true);
                          lastMessageFetchRef.current = Date.now();
                          await fetchMessages(conv.id, true);
                        }}
                        className={`w-full p-4 flex items-center gap-3 hover:bg-white/5 transition-colors ${
                          selectedConversation?.id === conv.id ? 'bg-white/5' : ''
                        }`}
                      >
                        <div className="relative">
                          <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-gradient-to-br from-gray-500/20 to-gray-600/20 border border-gray-500/30">
                            {getConversationAvatar(conv) ? (
                              <img src={getConversationAvatar(conv)!} alt="" className="w-12 h-12 rounded-2xl object-cover" />
                            ) : (
                              <span className="text-white font-semibold text-lg">
                                {getConversationName(conv).charAt(0)}
                              </span>
                            )}
                          </div>
                          {conv.unreadCount > 0 && (
                            <div className="absolute -top-1 -right-1 min-w-[20px] h-5 bg-red-500 rounded-full flex items-center justify-center px-1.5">
                              <span className="text-white text-[10px] font-bold">{conv.unreadCount}</span>
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0 text-left">
                          <div className="flex items-center justify-between mb-1">
                            <span className={`font-semibold truncate ${conv.unreadCount > 0 ? 'text-white' : 'text-gray-300'}`}>
                              {getConversationName(conv)}
                            </span>
                            <span className="text-xs text-gray-500 ml-2 flex-shrink-0">
                              {conv.lastMessage?.timestamp && formatConversationTime(conv.lastMessage.timestamp)}
                            </span>
                          </div>
                          <p className={`text-sm truncate ${conv.unreadCount > 0 ? 'text-gray-300' : 'text-gray-500'}`}>
                            {conv.lastMessage?.content || 'No messages yet'}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Empty State */}
              {supportTickets.length === 0 && conversations.filter(c => c.type !== 'user-to-support').length === 0 && (
                <div className="flex flex-col items-center justify-center h-full p-8 text-center">
                  <div className="w-20 h-20 bg-white/5 rounded-3xl flex items-center justify-center mb-4">
                    <MessageCircle className="w-10 h-10 text-gray-600" />
                  </div>
                  <p className="text-gray-400 mb-4">No conversations yet</p>
                </div>
              )}
            </>
          )}

          {activeTab === 'friends' && (
            <div className="p-4">
              {/* Search */}
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="text"
                  placeholder="Search users..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500/50 transition-colors"
                />
              </div>
              
              {friends.length === 0 ? (
                <div className="text-center py-8">
                  <Users className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-500">No friends yet</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {friends.map((friend) => (
                    <div key={friend.id} className="p-3 bg-white/5 rounded-xl flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-cyan-500/20 to-blue-500/20 rounded-xl flex items-center justify-center">
                        {friend.friendAvatar ? (
                          <img src={friend.friendAvatar} alt="" className="w-10 h-10 rounded-xl" />
                        ) : (
                          <span className="text-cyan-400 font-medium">{friend.friendName?.charAt(0)}</span>
                        )}
                      </div>
                      <span className="text-white font-medium flex-1">{friend.friendName}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'requests' && (
            <div className="p-4">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                Received ({friendRequests.received.length})
              </h3>
              {friendRequests.received.length === 0 ? (
                <p className="text-gray-500 text-sm text-center py-4">No pending requests</p>
              ) : (
                <div className="space-y-2 mb-6">
                  {friendRequests.received.map((req) => (
                    <div key={req.id} className="p-3 bg-white/5 rounded-xl flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-emerald-500/20 to-teal-500/20 rounded-xl flex items-center justify-center">
                        <span className="text-emerald-400 font-medium">{req.fromUserName?.charAt(0)}</span>
                      </div>
                      <div className="flex-1">
                        <p className="text-white font-medium">{req.fromUserName}</p>
                      </div>
                      <div className="flex gap-2">
                        <button className="w-8 h-8 bg-emerald-500/20 text-emerald-400 rounded-lg flex items-center justify-center hover:bg-emerald-500/30">
                          <Check className="w-4 h-4" />
                        </button>
                        <button className="w-8 h-8 bg-red-500/20 text-red-400 rounded-lg flex items-center justify-center hover:bg-red-500/30">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                Sent ({friendRequests.sent.length})
              </h3>
              {friendRequests.sent.length === 0 ? (
                <p className="text-gray-500 text-sm text-center py-4">No sent requests</p>
              ) : (
                <div className="space-y-2">
                  {friendRequests.sent.map((req) => (
                    <div key={req.id} className="p-3 bg-white/5 rounded-xl flex items-center gap-3">
                      <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center">
                        <span className="text-gray-400 font-medium">{req.toUserName?.charAt(0)}</span>
                      </div>
                      <div className="flex-1">
                        <p className="text-white font-medium">{req.toUserName}</p>
                        <p className="text-xs text-gray-500 flex items-center gap-1">
                          <Clock className="w-3 h-3" /> Pending
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div className={`flex-1 flex flex-col bg-[#08080c] ${!showMobileChat ? 'hidden md:flex' : 'flex'}`}>
        {selectedConversation ? (
          <>
            {/* Chat Header */}
            <div className="px-5 py-4 border-b border-white/5 bg-[#0d0d14] flex items-center gap-4">
              <button
                onClick={() => setShowMobileChat(false)}
                className="md:hidden w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center hover:bg-white/10 transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-gray-400" />
              </button>
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                selectedConversation.type === 'user-to-support'
                  ? selectedConversation.isAIHandled
                    ? 'bg-gradient-to-br from-purple-500 to-pink-600'
                    : 'bg-gradient-to-br from-cyan-500 to-blue-600'
                  : 'bg-gradient-to-br from-gray-500 to-gray-600'
              }`}>
                {getConversationAvatar(selectedConversation) ? (
                  <img src={getConversationAvatar(selectedConversation)!} alt="" className="w-12 h-12 rounded-2xl object-cover" />
                ) : selectedConversation.type === 'user-to-support' ? (
                  selectedConversation.isAIHandled ? (
                    <Sparkles className="w-6 h-6 text-white" />
                  ) : (
                    <Headphones className="w-6 h-6 text-white" />
                  )
                ) : (
                  <span className="text-white font-semibold text-lg">
                    {getConversationName(selectedConversation).charAt(0)}
                  </span>
                )}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h2 className="font-semibold text-white text-lg">{getConversationName(selectedConversation)}</h2>
                  {selectedConversation.ticketNumber && (
                    <span className={`text-xs px-2 py-0.5 rounded-lg font-medium ${
                      selectedConversation.isArchived 
                        ? 'bg-gray-500/20 text-gray-400' 
                        : 'bg-cyan-500/20 text-cyan-400'
                    }`}>
                      Ticket #{selectedConversation.ticketNumber}
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-400">
                  {selectedConversation.isArchived 
                    ? '✓ Resolved' + (selectedConversation.resolvedByName ? ` by ${selectedConversation.resolvedByName}` : '')
                    : selectedConversation.type === 'user-to-support'
                      ? selectedConversation.isAIHandled ? 'AI-Powered Support' : 'Customer Support'
                      : 'Direct Message'}
                </p>
              </div>
              
              {/* Chat Menu */}
              <div className="relative" ref={chatMenuRef}>
                <button
                  onClick={() => setShowChatMenu(!showChatMenu)}
                  className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center hover:bg-white/10 transition-colors"
                >
                  <MoreVertical className="w-5 h-5 text-gray-400" />
                </button>
                
                <AnimatePresence>
                  {showChatMenu && (
                    <motion.div
                      initial={{ opacity: 0, y: -10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -10, scale: 0.95 }}
                      className="absolute right-0 top-full mt-2 w-48 bg-[#1a1a24] border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50"
                    >
                      <button
                        onClick={clearConversation}
                        disabled={isClearing}
                        className="w-full px-4 py-3 text-left text-sm text-red-400 hover:bg-white/5 flex items-center gap-3 disabled:opacity-50"
                      >
                        {isClearing ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                        Clear Chat History
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Messages */}
            <div 
              ref={messagesContainerRef}
              onScroll={handleScroll}
              className="flex-1 overflow-y-auto p-5 space-y-4"
              style={{ 
                background: 'radial-gradient(ellipse at top, rgba(6,182,212,0.03) 0%, transparent 50%)',
              }}
            >
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <div className="w-20 h-20 bg-white/5 rounded-3xl flex items-center justify-center mb-4">
                    <MessageCircle className="w-10 h-10 text-gray-600" />
                  </div>
                  <p className="text-gray-400">Start the conversation</p>
                </div>
              ) : (
                messages.map((msg, index) => {
                  const isOwn = isOwnMessage(msg);
                  const isAI = msg.senderType === 'ai';
                  const isSystem = msg.messageType === 'system' || msg.senderType === 'system';
                  const showAvatar = !isOwn && (index === 0 || messages[index - 1].senderId !== msg.senderId);

                  if (isSystem) {
                    return (
                      <div key={msg.id} className="flex justify-center my-4">
                        <div className="px-4 py-2 bg-white/5 rounded-full text-xs text-gray-400 max-w-[80%] text-center">
                          {msg.content}
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div key={msg.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'} gap-2`}>
                      {!isOwn && showAvatar && (
                        <div className={`w-8 h-8 rounded-xl flex-shrink-0 flex items-center justify-center ${
                          isAI ? 'bg-gradient-to-br from-purple-500 to-pink-600' : 'bg-gradient-to-br from-cyan-500 to-blue-600'
                        }`}>
                          {isAI ? (
                            <Sparkles className="w-4 h-4 text-white" />
                          ) : (
                            <span className="text-white text-xs font-medium">{msg.senderName?.charAt(0)}</span>
                          )}
                        </div>
                      )}
                      {!isOwn && !showAvatar && <div className="w-8" />}
                      
                      <div className={`max-w-[70%] ${isOwn ? 'order-first' : ''}`}>
                        {!isOwn && showAvatar && (
                          <p className="text-xs text-gray-500 mb-1 ml-1 flex items-center gap-1">
                            {isAI && <Sparkles className="w-3 h-3 text-purple-400" />}
                            {msg.senderName}
                          </p>
                        )}
                        <div
                          className={`px-4 py-3 ${
                            isOwn
                              ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-2xl rounded-br-md'
                              : isAI
                                ? 'bg-gradient-to-r from-purple-500/20 to-pink-500/20 text-white rounded-2xl rounded-bl-md border border-purple-500/20'
                                : 'bg-white/10 text-white rounded-2xl rounded-bl-md'
                          }`}
                        >
                          <p className="whitespace-pre-wrap text-[15px] leading-relaxed">{msg.content}</p>
                          <div className={`flex items-center justify-end gap-1.5 mt-1 ${isOwn ? 'text-white/60' : 'text-gray-500'}`}>
                            <span className="text-[11px]">{formatMessageTime(msg.createdAt)}</span>
                            {isOwn && getMessageStatus(msg)}
                          </div>
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
                  className="absolute bottom-24 right-6 w-10 h-10 bg-cyan-500 text-white rounded-full shadow-lg shadow-cyan-500/25 flex items-center justify-center hover:bg-cyan-400 transition-colors"
                >
                  <ChevronDown className="w-5 h-5" />
                </motion.button>
              )}
            </AnimatePresence>

            {/* Typing Indicator */}
            {typingUsers.size > 0 && (
              <div className="px-5 py-2 text-sm text-gray-400 flex items-center gap-2">
                <div className="flex gap-1">
                  {[0, 1, 2].map((i) => (
                    <span 
                      key={i}
                      className="w-2 h-2 bg-cyan-500 rounded-full animate-bounce" 
                      style={{ animationDelay: `${i * 150}ms` }} 
                    />
                  ))}
                </div>
                <span>{Array.from(typingUsers.values()).map(u => u.name).join(', ')} is typing...</span>
              </div>
            )}

            {/* Message Input */}
            <div className="p-4 border-t border-white/5 bg-[#0d0d14]">
              {selectedConversation.isArchived ? (
                // Archived ticket - read only with option to create new
                <div className="bg-gray-500/10 border border-gray-500/30 rounded-xl p-4 text-center">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <Archive className="w-5 h-5 text-gray-400" />
                    <p className="text-gray-400 font-medium">This ticket has been resolved</p>
                  </div>
                  <p className="text-gray-500 text-sm mb-3">
                    {selectedConversation.resolvedByName 
                      ? `Resolved by ${selectedConversation.resolvedByName}`
                      : 'This conversation is now read-only'
                    }
                  </p>
                  <button
                    onClick={requestNewTicket}
                    className="px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-xl font-medium hover:shadow-lg hover:shadow-cyan-500/25 transition-all inline-flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Start New Conversation
                  </button>
                </div>
              ) : (
                // Active conversation - normal input
                <div className="flex items-center gap-3">
                  <button className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-colors">
                    <Paperclip className="w-5 h-5" />
                  </button>
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
                      onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                      className="w-full px-5 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500/50 transition-colors pr-12"
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <EmojiPicker onEmojiSelect={handleEmojiSelect} />
                    </div>
                  </div>
                  <button
                    onClick={sendMessage}
                    disabled={!messageInput.trim() || isSending}
                    className="w-12 h-12 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-xl flex items-center justify-center hover:shadow-lg hover:shadow-cyan-500/25 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    {isSending ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Send className="w-5 h-5" />
                    )}
                  </button>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="w-24 h-24 bg-white/5 rounded-3xl flex items-center justify-center mx-auto mb-6">
                <MessageCircle className="w-12 h-12 text-gray-600" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">Welcome to Messages</h2>
              <p className="text-gray-400 max-w-md mb-6">
                Select a conversation from the list or start chatting with our support team
              </p>
              <button
                onClick={startSupportConversation}
                className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-xl font-medium hover:shadow-lg hover:shadow-cyan-500/25 transition-all flex items-center gap-2 mx-auto"
              >
                <Headphones className="w-5 h-5" />
                Contact Support
              </button>
            </div>
          </div>
        )}
      </div>

      {/* New Ticket Confirmation Modal */}
      <AnimatePresence>
        {showNewTicketConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50"
            onClick={() => setShowNewTicketConfirm(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-[#0d0d14] border border-white/10 rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl"
            >
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 bg-amber-500/20 rounded-xl flex items-center justify-center">
                  <AlertTriangle className="w-6 h-6 text-amber-400" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Start New Conversation?</h3>
                  <p className="text-sm text-gray-400">You have an active support ticket</p>
                </div>
              </div>

              <p className="text-gray-300 mb-6">
                Starting a new conversation will mark your current ticket 
                {activeTicket?.ticketNumber && <span className="text-cyan-400"> #{activeTicket.ticketNumber}</span>} as 
                <span className="text-amber-400 font-medium"> resolved</span>. 
                You can still view it in your ticket history.
              </p>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowNewTicketConfirm(false)}
                  className="flex-1 px-4 py-3 bg-white/5 border border-white/10 text-white rounded-xl hover:bg-white/10 transition-colors"
                >
                  Keep Current
                </button>
                <button
                  onClick={createNewTicket}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-xl hover:shadow-lg hover:shadow-cyan-500/25 transition-all"
                >
                  Start New
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
