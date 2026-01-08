'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useSession } from 'next-auth/react';
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
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

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

export default function MessagingPage() {
  const { data: session } = useSession();
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
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageInputRef = useRef<HTMLInputElement>(null);

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
      await Promise.all([fetchConversations(), fetchFriends(), fetchFriendRequests()]);
      setIsLoading(false);
    };
    loadData();
  }, [fetchConversations, fetchFriends, fetchFriendRequests]);

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

  // Search users
  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (query.length < 2) {
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
    }
    setIsSearching(false);
  };

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
        
        // Update conversation list
        setConversations(prev =>
          prev.map(c =>
            c.id === selectedConversation.id
              ? {
                  ...c,
                  lastMessage: {
                    content: data.message.content,
                    senderId: session?.user?.id || '',
                    senderName: session?.user?.name || 'You',
                    timestamp: data.message.createdAt,
                  },
                }
              : c
          ).sort((a, b) => 
            new Date(b.lastMessage?.timestamp || 0).getTime() - 
            new Date(a.lastMessage?.timestamp || 0).getTime()
          )
        );
      }
    } catch (error) {
      console.error('Error sending message:', error);
    }
    setIsSending(false);
  };

  // Start support chat
  const handleStartSupportChat = async () => {
    try {
      const response = await fetch('/api/messaging/support');
      if (response.ok) {
        const data = await response.json();
        setSelectedConversation(data.conversation);
        setMessages(data.messages);
        setShowMobileChat(true);
        fetchConversations();
      }
    } catch (error) {
      console.error('Error starting support chat:', error);
    }
  };

  // Send friend request
  const handleSendFriendRequest = async (userId: string, userName: string) => {
    try {
      const response = await fetch('/api/messaging/friends/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toUserId: userId, toUserName: userName }),
      });

      if (response.ok) {
        fetchFriendRequests();
        setSearchResults(prev =>
          prev.map(u => u.id === userId ? { ...u, hasPendingRequest: true } : u)
        );
      }
    } catch (error) {
      console.error('Error sending friend request:', error);
    }
  };

  // Respond to friend request
  const handleRespondToRequest = async (requestId: string, action: 'accept' | 'decline') => {
    try {
      const response = await fetch(`/api/messaging/friends/requests/${requestId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });

      if (response.ok) {
        fetchFriendRequests();
        if (action === 'accept') {
          fetchFriends();
        }
      }
    } catch (error) {
      console.error('Error responding to friend request:', error);
    }
  };

  // Start conversation with friend
  const handleStartConversation = async (friend: Friend) => {
    try {
      const response = await fetch('/api/messaging/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          participantId: friend.friendId,
          participantName: friend.friendName,
          participantAvatar: friend.friendAvatar,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setSelectedConversation(data.conversation);
        await fetchMessages(data.conversation.id);
        setShowMobileChat(true);
        setActiveTab('chats');
        fetchConversations();
      }
    } catch (error) {
      console.error('Error starting conversation:', error);
    }
  };

  // Get other participant in conversation
  const getOtherParticipant = (conversation: Conversation) => {
    return conversation.participants.find(p => p.id !== session?.user?.id);
  };

  // Render conversation list item
  const renderConversationItem = (conversation: Conversation) => {
    const otherParticipant = getOtherParticipant(conversation);
    const isSelected = selectedConversation?.id === conversation.id;
    const isSupport = conversation.type === 'user-to-support';

    return (
      <motion.div
        key={conversation.id}
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        className={`flex items-center gap-3 p-3 cursor-pointer rounded-xl transition-all duration-200 ${
          isSelected
            ? 'bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 border border-emerald-500/30'
            : 'hover:bg-[#1E1E1E]'
        }`}
        onClick={() => {
          setSelectedConversation(conversation);
          fetchMessages(conversation.id);
          setShowMobileChat(true);
        }}
      >
        {/* Avatar */}
        <div className="relative">
          <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
            isSupport
              ? 'bg-gradient-to-br from-emerald-500 to-cyan-500'
              : 'bg-gradient-to-br from-violet-500 to-fuchsia-500'
          }`}>
            {isSupport ? (
              conversation.isAIHandled ? (
                <Bot className="w-6 h-6 text-white" />
              ) : (
                <Headphones className="w-6 h-6 text-white" />
              )
            ) : otherParticipant?.avatar ? (
              <img
                src={otherParticipant.avatar}
                alt={otherParticipant.name}
                className="w-full h-full rounded-full object-cover"
              />
            ) : (
              <span className="text-white font-bold text-lg">
                {otherParticipant?.name?.charAt(0).toUpperCase() || '?'}
              </span>
            )}
          </div>
          {/* Online indicator */}
          {!isSupport && (
            <div className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 rounded-full border-2 border-[#0A0A0A]" />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-white truncate">
              {isSupport
                ? conversation.isAIHandled
                  ? 'AI Assistant'
                  : conversation.assignedEmployeeName || 'Customer Support'
                : otherParticipant?.name || 'Unknown'}
            </h3>
            {conversation.lastMessage && (
              <span className="text-xs text-[#6b7280]">
                {formatDistanceToNow(new Date(conversation.lastMessage.timestamp), { addSuffix: true })}
              </span>
            )}
          </div>
          <div className="flex items-center justify-between">
            <p className="text-sm text-[#9ca3af] truncate">
              {conversation.lastMessage?.content || 'No messages yet'}
            </p>
            {conversation.unreadCount > 0 && (
              <span className="bg-emerald-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                {conversation.unreadCount}
              </span>
            )}
          </div>
        </div>
      </motion.div>
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A] flex">
      {/* Sidebar */}
      <div className={`w-full md:w-96 bg-[#111111] border-r border-[#2A2A2A] flex flex-col ${
        showMobileChat ? 'hidden md:flex' : 'flex'
      }`}>
        {/* Header */}
        <div className="p-4 border-b border-[#2A2A2A]">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <MessageCircle className="w-7 h-7 text-emerald-500" />
              Messages
              {unreadTotal > 0 && (
                <span className="bg-emerald-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                  {unreadTotal}
                </span>
              )}
            </h1>
            <button className="p-2 hover:bg-[#1E1E1E] rounded-lg transition-colors">
              <Settings className="w-5 h-5 text-[#6b7280]" />
            </button>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#6b7280]" />
            <input
              type="text"
              placeholder="Search users..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              className="w-full bg-[#1E1E1E] border border-[#2A2A2A] rounded-xl pl-10 pr-4 py-2.5 text-white placeholder-[#6b7280] focus:outline-none focus:border-emerald-500/50"
            />
          </div>

          {/* Search Results */}
          {searchResults.length > 0 && (
            <div className="absolute left-4 right-4 mt-2 bg-[#1E1E1E] border border-[#2A2A2A] rounded-xl shadow-xl z-50 max-h-64 overflow-y-auto">
              {searchResults.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center justify-between p-3 hover:bg-[#2A2A2A] transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center">
                      {user.avatar ? (
                        <img src={user.avatar} alt={user.name} className="w-full h-full rounded-full object-cover" />
                      ) : (
                        <span className="text-white font-bold">{user.name?.charAt(0).toUpperCase()}</span>
                      )}
                    </div>
                    <span className="text-white font-medium">{user.name}</span>
                  </div>
                  {user.isFriend ? (
                    <span className="text-xs text-emerald-500">Friend</span>
                  ) : user.hasPendingRequest ? (
                    <span className="text-xs text-yellow-500">Pending</span>
                  ) : (
                    <button
                      onClick={() => handleSendFriendRequest(user.id, user.name)}
                      className="text-xs bg-emerald-500/20 text-emerald-500 px-3 py-1 rounded-full hover:bg-emerald-500/30 transition-colors"
                    >
                      Add Friend
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex border-b border-[#2A2A2A]">
          {[
            { id: 'chats', icon: MessageCircle, label: 'Chats' },
            { id: 'friends', icon: Users, label: 'Friends' },
            { id: 'requests', icon: UserPlus, label: 'Requests', badge: friendRequests.received.length },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors relative ${
                activeTab === tab.id
                  ? 'text-emerald-500 border-b-2 border-emerald-500'
                  : 'text-[#6b7280] hover:text-white'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
              {tab.badge ? (
                <span className="bg-red-500 text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">
                  {tab.badge}
                </span>
              ) : null}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === 'chats' && (
            <div className="p-2">
              {/* Support Chat Button */}
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleStartSupportChat}
                className="w-full flex items-center gap-3 p-3 bg-gradient-to-r from-emerald-500/10 to-cyan-500/10 border border-emerald-500/20 rounded-xl mb-2 hover:border-emerald-500/40 transition-colors"
              >
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center">
                  <Headphones className="w-6 h-6 text-white" />
                </div>
                <div className="text-left">
                  <h3 className="font-semibold text-white">Customer Support</h3>
                  <p className="text-sm text-[#9ca3af]">Get help from our team</p>
                </div>
              </motion.button>

              {/* Conversation List */}
              {conversations.length === 0 ? (
                <div className="text-center py-12">
                  <MessageCircle className="w-12 h-12 text-[#4b5563] mx-auto mb-4" />
                  <p className="text-[#6b7280]">No conversations yet</p>
                  <p className="text-sm text-[#4b5563]">Start chatting with friends or support!</p>
                </div>
              ) : (
                conversations.map(renderConversationItem)
              )}
            </div>
          )}

          {activeTab === 'friends' && (
            <div className="p-2">
              {friends.length === 0 ? (
                <div className="text-center py-12">
                  <Users className="w-12 h-12 text-[#4b5563] mx-auto mb-4" />
                  <p className="text-[#6b7280]">No friends yet</p>
                  <p className="text-sm text-[#4b5563]">Search for users to add friends!</p>
                </div>
              ) : (
                friends.map((friend) => (
                  <motion.div
                    key={friend.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center justify-between p-3 hover:bg-[#1E1E1E] rounded-xl cursor-pointer transition-colors"
                    onClick={() => handleStartConversation(friend)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center">
                          {friend.friendAvatar ? (
                            <img
                              src={friend.friendAvatar}
                              alt={friend.friendName}
                              className="w-full h-full rounded-full object-cover"
                            />
                          ) : (
                            <span className="text-white font-bold text-lg">
                              {friend.friendName?.charAt(0).toUpperCase()}
                            </span>
                          )}
                        </div>
                        <div className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 rounded-full border-2 border-[#111111]" />
                      </div>
                      <span className="text-white font-medium">{friend.friendName}</span>
                    </div>
                    <MessageCircle className="w-5 h-5 text-emerald-500" />
                  </motion.div>
                ))
              )}
            </div>
          )}

          {activeTab === 'requests' && (
            <div className="p-2 space-y-4">
              {/* Received Requests */}
              <div>
                <h3 className="text-sm font-medium text-[#6b7280] px-2 mb-2">Received Requests</h3>
                {friendRequests.received.length === 0 ? (
                  <p className="text-sm text-[#4b5563] px-2">No pending requests</p>
                ) : (
                  friendRequests.received.map((request) => (
                    <motion.div
                      key={request.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex items-center justify-between p-3 bg-[#1E1E1E] rounded-xl mb-2"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center">
                          <span className="text-white font-bold">
                            {request.fromUserName?.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <p className="text-white font-medium">{request.fromUserName}</p>
                          {request.message && (
                            <p className="text-sm text-[#6b7280]">"{request.message}"</p>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleRespondToRequest(request.id, 'accept')}
                          className="px-3 py-1 bg-emerald-500 text-white text-sm rounded-lg hover:bg-emerald-600 transition-colors"
                        >
                          Accept
                        </button>
                        <button
                          onClick={() => handleRespondToRequest(request.id, 'decline')}
                          className="px-3 py-1 bg-red-500/20 text-red-500 text-sm rounded-lg hover:bg-red-500/30 transition-colors"
                        >
                          Decline
                        </button>
                      </div>
                    </motion.div>
                  ))
                )}
              </div>

              {/* Sent Requests */}
              <div>
                <h3 className="text-sm font-medium text-[#6b7280] px-2 mb-2">Sent Requests</h3>
                {friendRequests.sent.length === 0 ? (
                  <p className="text-sm text-[#4b5563] px-2">No sent requests</p>
                ) : (
                  friendRequests.sent.map((request) => (
                    <div
                      key={request.id}
                      className="flex items-center justify-between p-3 bg-[#1E1E1E] rounded-xl mb-2"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
                          <span className="text-white font-bold">
                            {request.toUserName?.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <p className="text-white font-medium">{request.toUserName}</p>
                          <p className="text-sm text-yellow-500">Pending...</p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div className={`flex-1 flex flex-col ${!showMobileChat ? 'hidden md:flex' : 'flex'}`}>
        {selectedConversation ? (
          <>
            {/* Chat Header */}
            <div className="h-16 px-4 border-b border-[#2A2A2A] flex items-center justify-between bg-[#111111]">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowMobileChat(false)}
                  className="md:hidden p-2 hover:bg-[#1E1E1E] rounded-lg transition-colors"
                >
                  <ArrowLeft className="w-5 h-5 text-[#6b7280]" />
                </button>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  selectedConversation.type === 'user-to-support'
                    ? 'bg-gradient-to-br from-emerald-500 to-cyan-500'
                    : 'bg-gradient-to-br from-violet-500 to-fuchsia-500'
                }`}>
                  {selectedConversation.type === 'user-to-support' ? (
                    selectedConversation.isAIHandled ? (
                      <Bot className="w-5 h-5 text-white" />
                    ) : (
                      <Headphones className="w-5 h-5 text-white" />
                    )
                  ) : (
                    <span className="text-white font-bold">
                      {getOtherParticipant(selectedConversation)?.name?.charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>
                <div>
                  <h2 className="font-semibold text-white">
                    {selectedConversation.type === 'user-to-support'
                      ? selectedConversation.isAIHandled
                        ? 'AI Assistant'
                        : selectedConversation.assignedEmployeeName || 'Customer Support'
                      : getOtherParticipant(selectedConversation)?.name}
                  </h2>
                  <p className="text-xs text-emerald-500">Online</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button className="p-2 hover:bg-[#1E1E1E] rounded-lg transition-colors">
                  <Phone className="w-5 h-5 text-[#6b7280]" />
                </button>
                <button className="p-2 hover:bg-[#1E1E1E] rounded-lg transition-colors">
                  <Video className="w-5 h-5 text-[#6b7280]" />
                </button>
                <button className="p-2 hover:bg-[#1E1E1E] rounded-lg transition-colors">
                  <MoreVertical className="w-5 h-5 text-[#6b7280]" />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#0A0A0A]">
              {messages.map((message) => {
                const isOwn = message.senderId === session?.user?.id;
                const isSystem = message.messageType === 'system';
                const isAI = message.senderType === 'ai';

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
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`max-w-[70%] ${isOwn ? 'order-2' : 'order-1'}`}>
                      {!isOwn && (
                        <div className="flex items-center gap-2 mb-1">
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                            isAI
                              ? 'bg-gradient-to-br from-emerald-500 to-cyan-500'
                              : 'bg-gradient-to-br from-violet-500 to-fuchsia-500'
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
                          isOwn
                            ? 'bg-gradient-to-r from-emerald-500 to-cyan-500 text-white rounded-tr-sm'
                            : isAI
                            ? 'bg-[#1E1E1E] text-white border border-emerald-500/30 rounded-tl-sm'
                            : 'bg-[#1E1E1E] text-white rounded-tl-sm'
                        }`}
                      >
                        <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                      </div>
                      <div className={`flex items-center gap-1 mt-1 ${isOwn ? 'justify-end' : 'justify-start'}`}>
                        <span className="text-xs text-[#6b7280]">
                          {formatDistanceToNow(new Date(message.createdAt), { addSuffix: true })}
                        </span>
                        {isOwn && (
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
            <div className="p-4 border-t border-[#2A2A2A] bg-[#111111]">
              <div className="flex items-center gap-3">
                <button className="p-2 hover:bg-[#1E1E1E] rounded-lg transition-colors">
                  <Smile className="w-5 h-5 text-[#6b7280]" />
                </button>
                <button className="p-2 hover:bg-[#1E1E1E] rounded-lg transition-colors">
                  <Paperclip className="w-5 h-5 text-[#6b7280]" />
                </button>
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
          <div className="flex-1 flex flex-col items-center justify-center bg-[#0A0A0A]">
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 flex items-center justify-center mb-6">
              <MessageCircle className="w-12 h-12 text-emerald-500" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Welcome to Messages</h2>
            <p className="text-[#6b7280] text-center max-w-md mb-6">
              Connect with friends, get support, and chat in real-time. Select a conversation to start messaging.
            </p>
            <button
              onClick={handleStartSupportChat}
              className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-500 to-cyan-500 text-white font-semibold rounded-xl hover:opacity-90 transition-opacity"
            >
              <Headphones className="w-5 h-5" />
              Chat with Support
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

