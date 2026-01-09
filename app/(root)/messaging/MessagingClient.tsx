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
  Smile,
  Phone,
  Video,
  MoreVertical,
  Check,
  CheckCheck,
  Clock,
  Headphones,
  Bot,
  ArrowLeft,
  X,
  Bell,
  Settings,
  Image as ImageIcon,
  File,
  UserCircle,
  Briefcase,
  Loader2,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
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
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // WebSocket for real-time messaging
  const handleWebSocketMessage = useCallback((message: { type: string; data: any }) => {
    console.log('📨 [WS] Received:', message.type, message.data?.conversationId);
    
    switch (message.type) {
      case 'new_message':
        // Add new message if it's for the current conversation
        if (message.data.conversationId === selectedConversation?.id) {
          console.log('📨 [WS] New message for current conv, senderId:', message.data.message?.senderId);
          
          setMessages(prev => {
            // Check if message already exists (prevent duplicates)
            if (prev.some(m => m.id === message.data.message.id)) {
              console.log('📨 [WS] Message already exists, skipping');
              return prev;
            }
            console.log('📨 [WS] Adding message:', message.data.message.content?.slice(0, 30));
            return [...prev, message.data.message];
          });
          scrollToBottom();
        }
        // Update conversation list (but don't refetch messages)
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
        // Update message read status
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
        // Handle online/offline status updates
        break;
    }
  }, [selectedConversation?.id, session.user.id]);

  const { 
    isConnected: wsConnected, 
    subscribe: wsSubscribe, 
    unsubscribe: wsUnsubscribe,
    setTyping: wsSetTyping,
  } = useWebSocket({
    token: session.user.id, // Use user ID as token for now
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

  // Scroll to bottom helper
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  // Fetch assigned account manager
  const fetchAssignedAgent = useCallback(async () => {
    try {
      const response = await fetch('/api/messaging/assigned-support');
      if (response.ok) {
        const data = await response.json();
        setAssignedAgent(data.assignedAgent);
      }
    } catch (error) {
      console.error('Error fetching assigned agent:', error);
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
        setFriendRequests({ received: data.received, sent: data.sent });
      }
    } catch (error) {
      console.error('Error fetching friend requests:', error);
    }
  }, []);

  // Fetch messages for selected conversation
  const fetchMessages = useCallback(async (conversationId: string) => {
    try {
      const response = await fetch(`/api/messaging/conversations/${conversationId}`);
      if (response.ok) {
        const data = await response.json();
        setMessages(data.messages);
        
        // Mark as read
        fetch(`/api/messaging/conversations/${conversationId}/read`, {
          method: 'POST',
        });
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  }, []);

  // Search users
  const searchUsers = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    
    setIsSearching(true);
    try {
      const response = await fetch(`/api/messaging/search/users?q=${encodeURIComponent(query)}`);
      if (response.ok) {
        const data = await response.json();
        setSearchResults(data.users);
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
    
    // Optimistically clear input immediately for better UX
    setMessageInput('');
    
    try {
      // Use support endpoint for support conversations
      const endpoint = selectedConversation.type === 'user-to-support'
        ? '/api/messaging/support'
        : `/api/messaging/conversations/${selectedConversation.id}/messages`;
      
      console.log(`📤 [Send] Sending to: ${endpoint}`);
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: messageContent }),
      });

      const data = await response.json();
      
      if (response.ok) {
        console.log(`📤 [Send] Success, hasAI: ${!!data.aiResponse}`);
        
        // Mark that we just added messages (prevent poll from overwriting)
        lastMessageFetchRef.current = Date.now();
        
        // Add user's message
        if (data.message) {
          setMessages(prev => {
            // Don't add if already exists
            if (prev.some(m => m.id === data.message.id)) return prev;
            return [...prev, data.message];
          });
        }
        scrollToBottom();
        
        // If there's an AI response, add it after a short delay for natural feel
        if (data.aiResponse) {
          setTimeout(() => {
            lastMessageFetchRef.current = Date.now(); // Extend protection
            setMessages(prev => {
              // Don't add if already exists (might come via WebSocket)
              if (prev.some(m => m.id === data.aiResponse.id)) return prev;
              return [...prev, data.aiResponse];
            });
            scrollToBottom();
          }, 800);
        }
        
        // Refresh conversation list (but NOT messages)
        fetchConversations();
      } else {
        console.error('❌ [Send] Failed:', response.status, data);
        // Restore the message if sending failed
        setMessageInput(messageContent);
        alert(data.error || 'Failed to send message. Please try again.');
      }
    } catch (error) {
      console.error('❌ [Send] Error:', error);
      // Restore the message on error
      setMessageInput(messageContent);
      alert('Network error. Please check your connection.');
    } finally {
      setIsSending(false);
    }
  };

  // Start support conversation - GET to create/get, then display
  const startSupportConversation = async () => {
    console.log('📨 [Support] Starting support conversation...');
    try {
      const response = await fetch('/api/messaging/support');
      console.log('📨 [Support] Response status:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log('📨 [Support] Received conversation:', data.conversation?.id);
        console.log('📨 [Support] Messages count:', data.messages?.length || 0);
        console.log('📨 [Support] isAIHandled:', data.conversation?.isAIHandled);
        console.log('📨 [Support] assignedEmployee:', data.conversation?.assignedEmployeeName);
        
        // Set the conversation and messages
        setSelectedConversation(data.conversation);
        setMessages(data.messages || []);
        setShowMobileChat(true);
        
        // Refresh conversation list
        await fetchConversations();
        console.log('📨 [Support] Conversation loaded successfully');
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.error('❌ [Support] Failed:', response.status, errorData);
        alert('Failed to start support conversation. Please try again.');
      }
    } catch (error) {
      console.error('❌ [Support] Error:', error);
      alert('Error connecting to support. Please check your connection.');
    }
  };

  // Send friend request
  const sendFriendRequest = async (toUserId: string) => {
    try {
      const response = await fetch('/api/messaging/friends/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toUserId }),
      });
      if (response.ok) {
        fetchFriendRequests();
        setSearchResults([]);
        setSearchQuery('');
      }
    } catch (error) {
      console.error('Error sending friend request:', error);
    }
  };

  // Accept friend request
  const acceptFriendRequest = async (requestId: string) => {
    try {
      const response = await fetch(`/api/messaging/friends/requests/${requestId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'accept' }),
      });
      if (response.ok) {
        fetchFriendRequests();
        fetchFriends();
      }
    } catch (error) {
      console.error('Error accepting friend request:', error);
    }
  };

  // Decline friend request
  const declineFriendRequest = async (requestId: string) => {
    try {
      const response = await fetch(`/api/messaging/friends/requests/${requestId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'decline' }),
      });
      if (response.ok) {
        fetchFriendRequests();
      }
    } catch (error) {
      console.error('Error declining friend request:', error);
    }
  };

  // Start conversation with friend
  const startConversationWithFriend = async (friendId: string) => {
    try {
      const response = await fetch('/api/messaging/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ participantId: friendId, type: 'user-to-user' }),
      });
      if (response.ok) {
        const data = await response.json();
        fetchConversations();
        setSelectedConversation(data.conversation);
        setActiveTab('chats');
        setShowMobileChat(true);
      }
    } catch (error) {
      console.error('Error starting conversation:', error);
    }
  };

  // Initial data fetch
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      await Promise.all([
        fetchConversations(),
        fetchFriends(),
        fetchFriendRequests(),
        fetchAssignedAgent(),
      ]);
      setIsLoading(false);
    };
    loadData();
  }, [fetchConversations, fetchFriends, fetchFriendRequests, fetchAssignedAgent]);

  // Track selected conversation ID to avoid re-fetching on object reference change
  const selectedConversationIdRef = useRef<string | null>(null);
  const lastMessageFetchRef = useRef<number>(0);
  
  // Fetch messages when conversation ID changes (not object reference)
  useEffect(() => {
    const conversationId = selectedConversation?.id;
    
    // Only fetch if ID actually changed
    if (conversationId && conversationId !== selectedConversationIdRef.current) {
      selectedConversationIdRef.current = conversationId;
      lastMessageFetchRef.current = Date.now();
      fetchMessages(conversationId);
    }
  }, [selectedConversation?.id, fetchMessages]);

  // Poll for new messages (fallback when WebSocket not connected)
  useEffect(() => {
    // Only poll when WebSocket is NOT connected
    if (wsConnected) return;
    
    const pollInterval = 8000; // 8 seconds when not connected
    
    const interval = setInterval(() => {
      // Don't fetch messages if we just added some (avoid overwriting)
      const timeSinceLastFetch = Date.now() - lastMessageFetchRef.current;
      if (timeSinceLastFetch < 3000) {
        console.log('🔄 [Poll] Skipping - recent message activity');
        return;
      }
      
      fetchConversations();
      if (selectedConversation) {
        lastMessageFetchRef.current = Date.now();
        fetchMessages(selectedConversation.id);
      }
    }, pollInterval);

    return () => clearInterval(interval);
  }, [selectedConversation?.id, fetchConversations, fetchMessages, wsConnected]);

  // Search debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery) {
        searchUsers(searchQuery);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, searchUsers]);

  // Scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Get other participant name for display
  const getConversationName = (conv: Conversation) => {
    if (conv.type === 'user-to-support') {
      return conv.isAIHandled ? '🤖 AI Support' : `💬 ${conv.assignedEmployeeName || 'Support'}`;
    }
    const other = conv.participants.find(p => p.id !== session.user.id);
    return other?.name || 'Unknown';
  };

  // Get conversation avatar
  const getConversationAvatar = (conv: Conversation) => {
    if (conv.type === 'user-to-support') {
      return null;
    }
    const other = conv.participants.find(p => p.id !== session.user.id);
    return other?.avatar;
  };

  // Check if message is from current user
  const isOwnMessage = (msg: Message) => {
    return msg.senderId === session.user.id;
  };

  // Get message status icon
  const getMessageStatus = (msg: Message) => {
    if (msg.readBy && msg.readBy.some(r => r.participantId !== session.user.id)) {
      return <CheckCheck className="w-4 h-4 text-blue-400" />;
    }
    return <Check className="w-4 h-4 text-gray-400" />;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-400">Loading messages...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      {/* Sidebar */}
      <div className={`w-full md:w-96 border-r border-gray-700 flex flex-col ${showMobileChat ? 'hidden md:flex' : 'flex'}`}>
        {/* Header */}
        <div className="p-4 border-b border-gray-700 bg-gray-800/50">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <MessageCircle className="w-6 h-6 text-primary-500" />
              Messages
              {unreadTotal > 0 && (
                <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
                  {unreadTotal}
                </span>
              )}
              {/* WebSocket Status */}
              <span 
                className={`w-2 h-2 rounded-full ${wsConnected ? 'bg-green-500' : 'bg-amber-500 animate-pulse'}`}
                title={wsConnected ? 'Live connection' : 'Connecting...'}
              />
            </h1>
            <button
              onClick={startSupportConversation}
              className="p-2 bg-primary-500/20 text-primary-400 rounded-lg hover:bg-primary-500/30 transition-colors"
              title="Contact Support"
            >
              <Headphones className="w-5 h-5" />
            </button>
          </div>

          {/* Assigned Account Manager - Click to Chat */}
          {assignedAgent && (
            <button
              onClick={startSupportConversation}
              className="w-full mb-4 p-4 bg-gradient-to-r from-primary-500/20 to-purple-500/20 rounded-xl border border-primary-500/30 hover:border-primary-500/50 hover:from-primary-500/30 hover:to-purple-500/30 transition-all group"
            >
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-primary-500/30 rounded-full flex items-center justify-center group-hover:scale-105 transition-transform">
                  {assignedAgent.avatar ? (
                    <img src={assignedAgent.avatar} alt="" className="w-12 h-12 rounded-full" />
                  ) : (
                    <Briefcase className="w-6 h-6 text-primary-400" />
                  )}
                </div>
                <div className="flex-1 text-left">
                  <p className="text-xs text-primary-400 font-medium">Your Account Manager</p>
                  <p className="font-semibold text-white">{assignedAgent.name}</p>
                  <p className="text-xs text-gray-400">{assignedAgent.role}</p>
                </div>
                <div className="flex flex-col items-center gap-1 text-primary-400 group-hover:text-primary-300">
                  <MessageCircle className="w-5 h-5" />
                  <span className="text-[10px] font-medium">TAP TO CHAT</span>
                </div>
              </div>
            </button>
          )}
          
          {/* No assigned agent - Show support button */}
          {!assignedAgent && (
            <button
              onClick={startSupportConversation}
              className="w-full mb-4 p-4 bg-gradient-to-r from-emerald-500/20 to-teal-500/20 rounded-xl border border-emerald-500/30 hover:border-emerald-500/50 transition-all flex items-center gap-3"
            >
              <div className="w-12 h-12 bg-emerald-500/30 rounded-full flex items-center justify-center">
                <Headphones className="w-6 h-6 text-emerald-400" />
              </div>
              <div className="flex-1 text-left">
                <p className="font-semibold text-white">Contact Support</p>
                <p className="text-xs text-gray-400">Get help from our support team</p>
              </div>
              <MessageCircle className="w-5 h-5 text-emerald-400" />
            </button>
          )}

          {/* Tabs */}
          <div className="flex gap-1 bg-gray-700/50 rounded-lg p-1">
            <button
              onClick={() => setActiveTab('chats')}
              className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'chats' ? 'bg-primary-500 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              Chats
            </button>
            <button
              onClick={() => setActiveTab('friends')}
              className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'friends' ? 'bg-primary-500 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              Friends
            </button>
            <button
              onClick={() => setActiveTab('requests')}
              className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors relative ${
                activeTab === 'requests' ? 'bg-primary-500 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              Requests
              {friendRequests.received.length > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center">
                  {friendRequests.received.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Search */}
        {(activeTab === 'friends' || activeTab === 'requests') && (
          <div className="p-4 border-b border-gray-700">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search users..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-primary-500"
              />
            </div>
            
            {/* Search Results */}
            {searchResults.length > 0 && (
              <div className="mt-2 bg-gray-700 rounded-lg overflow-hidden">
                {searchResults.map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center justify-between p-3 hover:bg-gray-600 border-b border-gray-600 last:border-0"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-primary-500/20 rounded-full flex items-center justify-center">
                        {user.avatar ? (
                          <img src={user.avatar} alt="" className="w-10 h-10 rounded-full" />
                        ) : (
                          <span className="text-primary-400 font-medium">
                            {user.name?.charAt(0) || '?'}
                          </span>
                        )}
                      </div>
                      <span className="text-white">{user.name}</span>
                    </div>
                    <button
                      onClick={() => sendFriendRequest(user.id)}
                      className="p-2 bg-primary-500/20 text-primary-400 rounded-lg hover:bg-primary-500/30"
                    >
                      <UserPlus className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {/* Chats Tab */}
          {activeTab === 'chats' && (
            <div>
              {conversations.length === 0 ? (
                <div className="p-8 text-center">
                  <MessageCircle className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                  <p className="text-gray-400">No conversations yet</p>
                  <button
                    onClick={startSupportConversation}
                    className="mt-4 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600"
                  >
                    Start with Support
                  </button>
                </div>
              ) : (
                conversations.map((conv) => (
                  <button
                    key={conv.id}
                    onClick={async () => {
                      console.log('📂 [Conv] Selecting conversation:', conv.id);
                      setSelectedConversation(conv);
                      setShowMobileChat(true);
                      // Always fetch messages when clicking (handles re-selection of same conv)
                      lastMessageFetchRef.current = Date.now();
                      await fetchMessages(conv.id);
                    }}
                    className={`w-full p-4 flex items-center gap-3 hover:bg-gray-700/50 border-b border-gray-700/50 transition-colors ${
                      selectedConversation?.id === conv.id ? 'bg-gray-700/50' : ''
                    }`}
                  >
                    <div className="relative">
                      <div className="w-12 h-12 bg-primary-500/20 rounded-full flex items-center justify-center">
                        {getConversationAvatar(conv) ? (
                          <img src={getConversationAvatar(conv)!} alt="" className="w-12 h-12 rounded-full" />
                        ) : conv.type === 'user-to-support' ? (
                          conv.isAIHandled ? (
                            <Bot className="w-6 h-6 text-primary-400" />
                          ) : (
                            <Headphones className="w-6 h-6 text-primary-400" />
                          )
                        ) : (
                          <span className="text-primary-400 font-medium text-lg">
                            {getConversationName(conv).charAt(0)}
                          </span>
                        )}
                      </div>
                      {conv.participants.some(p => p.isActive && p.id !== session.user.id) && (
                        <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-gray-800" />
                      )}
                    </div>
                    <div className="flex-1 text-left">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-white">{getConversationName(conv)}</span>
                        {conv.lastMessage && (
                          <span className="text-xs text-gray-400">
                            {formatDistanceToNow(new Date(conv.lastMessage.timestamp), { addSuffix: true })}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-between">
                        <p className="text-sm text-gray-400 truncate max-w-[200px]">
                          {conv.lastMessage?.content || 'No messages yet'}
                        </p>
                        {conv.unreadCount > 0 && (
                          <span className="bg-primary-500 text-white text-xs px-2 py-0.5 rounded-full">
                            {conv.unreadCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          )}

          {/* Friends Tab */}
          {activeTab === 'friends' && (
            <div>
              {friends.length === 0 ? (
                <div className="p-8 text-center">
                  <Users className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                  <p className="text-gray-400">No friends yet</p>
                  <p className="text-sm text-gray-500 mt-2">Search for users to add friends</p>
                </div>
              ) : (
                friends.map((friend) => (
                  <button
                    key={friend.id}
                    onClick={() => startConversationWithFriend(friend.friendId)}
                    className="w-full p-4 flex items-center gap-3 hover:bg-gray-700/50 border-b border-gray-700/50"
                  >
                    <div className="w-12 h-12 bg-primary-500/20 rounded-full flex items-center justify-center">
                      {friend.friendAvatar ? (
                        <img src={friend.friendAvatar} alt="" className="w-12 h-12 rounded-full" />
                      ) : (
                        <span className="text-primary-400 font-medium text-lg">
                          {friend.friendName?.charAt(0) || '?'}
                        </span>
                      )}
                    </div>
                    <div className="flex-1 text-left">
                      <span className="font-medium text-white">{friend.friendName}</span>
                    </div>
                    <MessageCircle className="w-5 h-5 text-gray-400" />
                  </button>
                ))
              )}
            </div>
          )}

          {/* Requests Tab */}
          {activeTab === 'requests' && (
            <div>
              {/* Received */}
              <div className="p-3 bg-gray-800/50 border-b border-gray-700">
                <h3 className="text-sm font-medium text-gray-400">Received ({friendRequests.received.length})</h3>
              </div>
              {friendRequests.received.length === 0 ? (
                <div className="p-4 text-center text-gray-500 text-sm">No pending requests</div>
              ) : (
                friendRequests.received.map((req) => (
                  <div key={req.id} className="p-4 flex items-center gap-3 border-b border-gray-700/50">
                    <div className="w-12 h-12 bg-primary-500/20 rounded-full flex items-center justify-center">
                      {req.fromUserAvatar ? (
                        <img src={req.fromUserAvatar} alt="" className="w-12 h-12 rounded-full" />
                      ) : (
                        <span className="text-primary-400 font-medium text-lg">
                          {req.fromUserName?.charAt(0) || '?'}
                        </span>
                      )}
                    </div>
                    <div className="flex-1">
                      <span className="font-medium text-white">{req.fromUserName}</span>
                      <p className="text-xs text-gray-400">
                        {formatDistanceToNow(new Date(req.createdAt), { addSuffix: true })}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => acceptFriendRequest(req.id)}
                        className="p-2 bg-green-500/20 text-green-400 rounded-lg hover:bg-green-500/30"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => declineFriendRequest(req.id)}
                        className="p-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}

              {/* Sent */}
              <div className="p-3 bg-gray-800/50 border-b border-gray-700 mt-4">
                <h3 className="text-sm font-medium text-gray-400">Sent ({friendRequests.sent.length})</h3>
              </div>
              {friendRequests.sent.length === 0 ? (
                <div className="p-4 text-center text-gray-500 text-sm">No sent requests</div>
              ) : (
                friendRequests.sent.map((req) => (
                  <div key={req.id} className="p-4 flex items-center gap-3 border-b border-gray-700/50">
                    <div className="w-12 h-12 bg-primary-500/20 rounded-full flex items-center justify-center">
                      <span className="text-primary-400 font-medium text-lg">
                        {req.toUserName?.charAt(0) || '?'}
                      </span>
                    </div>
                    <div className="flex-1">
                      <span className="font-medium text-white">{req.toUserName}</span>
                      <p className="text-xs text-gray-400 flex items-center gap-1">
                        <Clock className="w-3 h-3" /> Pending
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div className={`flex-1 flex flex-col ${!showMobileChat ? 'hidden md:flex' : 'flex'}`}>
        {selectedConversation ? (
          <>
            {/* Chat Header */}
            <div className="p-4 border-b border-gray-700 bg-gray-800/50 flex items-center gap-3">
              <button
                onClick={() => setShowMobileChat(false)}
                className="md:hidden p-2 hover:bg-gray-700 rounded-lg"
              >
                <ArrowLeft className="w-5 h-5 text-gray-400" />
              </button>
              <div className="w-10 h-10 bg-primary-500/20 rounded-full flex items-center justify-center">
                {getConversationAvatar(selectedConversation) ? (
                  <img src={getConversationAvatar(selectedConversation)!} alt="" className="w-10 h-10 rounded-full" />
                ) : selectedConversation.type === 'user-to-support' ? (
                  selectedConversation.isAIHandled ? (
                    <Bot className="w-5 h-5 text-primary-400" />
                  ) : (
                    <Headphones className="w-5 h-5 text-primary-400" />
                  )
                ) : (
                  <span className="text-primary-400 font-medium">
                    {getConversationName(selectedConversation).charAt(0)}
                  </span>
                )}
              </div>
              <div className="flex-1">
                <h2 className="font-medium text-white">{getConversationName(selectedConversation)}</h2>
                <p className="text-xs text-gray-400">
                  {selectedConversation.type === 'user-to-support'
                    ? selectedConversation.isAIHandled ? 'AI Assistant' : 'Customer Support'
                    : selectedConversation.participants.some(p => p.isActive && p.id !== session.user.id)
                      ? 'Online'
                      : 'Offline'}
                </p>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${isOwnMessage(msg) ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[70%] ${
                      isOwnMessage(msg)
                        ? 'bg-primary-500 text-white rounded-l-2xl rounded-tr-2xl'
                        : msg.senderType === 'ai'
                          ? 'bg-purple-500/20 text-white rounded-r-2xl rounded-tl-2xl'
                          : 'bg-gray-700 text-white rounded-r-2xl rounded-tl-2xl'
                    } px-4 py-2`}
                  >
                    {!isOwnMessage(msg) && (
                      <p className="text-xs text-gray-400 mb-1 flex items-center gap-1">
                        {msg.senderType === 'ai' && <Bot className="w-3 h-3" />}
                        {msg.senderName}
                      </p>
                    )}
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                    <div className={`flex items-center justify-end gap-1 mt-1 ${isOwnMessage(msg) ? 'text-white/70' : 'text-gray-400'}`}>
                      <span className="text-xs">
                        {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {isOwnMessage(msg) && getMessageStatus(msg)}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Typing Indicator */}
            {typingUsers.size > 0 && (
              <div className="px-4 py-2 text-sm text-gray-400 flex items-center gap-2">
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-primary-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 bg-primary-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 bg-primary-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
                <span>
                  {Array.from(typingUsers.values()).map(u => u.name).join(', ')} {typingUsers.size === 1 ? 'is' : 'are'} typing...
                </span>
              </div>
            )}

            {/* Message Input */}
            <div className="p-4 border-t border-gray-700 bg-gray-800/50">
              <div className="flex items-center gap-2">
                <button className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg">
                  <Paperclip className="w-5 h-5" />
                </button>
                <input
                  ref={messageInputRef}
                  type="text"
                  placeholder="Type a message..."
                  value={messageInput}
                  onChange={(e) => {
                    setMessageInput(e.target.value);
                    // Send typing indicator
                    if (selectedConversation && wsConnected) {
                      wsSetTyping(selectedConversation.id, true);
                      // Clear typing after 2 seconds of no input
                      if (typingTimeoutRef.current) {
                        clearTimeout(typingTimeoutRef.current);
                      }
                      typingTimeoutRef.current = setTimeout(() => {
                        if (selectedConversation) {
                          wsSetTyping(selectedConversation.id, false);
                        }
                      }, 2000);
                    }
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                  className="flex-1 px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-primary-500"
                />
                <button className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg">
                  <Smile className="w-5 h-5" />
                </button>
                <button
                  onClick={sendMessage}
                  disabled={!messageInput.trim() || isSending}
                  className="p-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center bg-gray-800/30">
            <div className="text-center">
              <MessageCircle className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <h2 className="text-xl font-medium text-white mb-2">Welcome to Messages</h2>
              <p className="text-gray-400 max-w-md">
                Select a conversation or start chatting with support
              </p>
              <button
                onClick={startSupportConversation}
                className="mt-4 px-6 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 flex items-center gap-2 mx-auto"
              >
                <Headphones className="w-5 h-5" />
                Contact Support
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

