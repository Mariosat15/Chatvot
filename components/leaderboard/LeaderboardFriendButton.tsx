'use client';

import { useState, useEffect } from 'react';
import { UserPlus, Check, Clock, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LeaderboardFriendButtonProps {
  userId: string;
  username: string;
  isCurrentUser: boolean;
  compact?: boolean;
}

export default function LeaderboardFriendButton({
  userId,
  username,
  isCurrentUser,
  compact = false,
}: LeaderboardFriendButtonProps) {
  const [status, setStatus] = useState<'none' | 'pending' | 'friends' | 'loading' | 'disabled'>('loading');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    checkFriendStatus();
  }, [userId]);

  const checkFriendStatus = async () => {
    try {
      const response = await fetch(`/api/messaging/friends/status/${userId}`);
      if (response.ok) {
        const data = await response.json();
        if (data.disabled) {
          setStatus('disabled');
        } else if (data.isFriend) {
          setStatus('friends');
        } else if (data.hasPendingRequest) {
          setStatus('pending');
        } else {
          setStatus('none');
        }
      } else {
        setStatus('none');
      }
    } catch {
      setStatus('none');
    }
  };

  const sendFriendRequest = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (sending || status !== 'none') return;
    setSending(true);
    
    try {
      const response = await fetch('/api/messaging/friends/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toUserId: userId }),
      });
      
      if (response.ok) {
        setStatus('pending');
      } else {
        const data = await response.json();
        if (data.error?.includes('disabled')) {
          setStatus('disabled');
        }
      }
    } catch {
      // Silent fail
    } finally {
      setSending(false);
    }
  };

  // Don't show button for current user
  if (isCurrentUser) return null;

  const baseClasses = cn(
    "flex items-center justify-center rounded-xl transition-all duration-200 font-medium",
    compact ? "w-9 h-9" : "w-10 h-10"
  );

  // Loading state
  if (status === 'loading') {
    return (
      <div className={cn(baseClasses, "bg-gray-800/50 border border-gray-700/50")}>
        <div className="w-4 h-4 border-2 border-gray-600 border-t-gray-400 rounded-full animate-spin" />
      </div>
    );
  }

  // Already friends
  if (status === 'friends') {
    return (
      <div 
        className={cn(
          baseClasses,
          "bg-gradient-to-br from-emerald-500/20 to-green-500/20 text-emerald-400 border border-emerald-500/30"
        )}
        title="Already friends"
      >
        <Users className="w-4 h-4" />
      </div>
    );
  }

  // Request pending
  if (status === 'pending') {
    return (
      <div 
        className={cn(
          baseClasses,
          "bg-gradient-to-br from-amber-500/20 to-orange-500/20 text-amber-400 border border-amber-500/30"
        )}
        title="Request pending"
      >
        <Clock className="w-4 h-4" />
      </div>
    );
  }

  // Friend requests disabled
  if (status === 'disabled') {
    return (
      <div 
        className={cn(
          baseClasses,
          "bg-gray-800/50 text-gray-600 border border-gray-700/50 cursor-not-allowed"
        )}
        title="Friend requests disabled by user"
      >
        <UserPlus className="w-4 h-4" />
      </div>
    );
  }

  // Can send request
  return (
    <button
      onClick={sendFriendRequest}
      disabled={sending}
      className={cn(
        baseClasses,
        "bg-gradient-to-br from-cyan-500/20 to-blue-500/20 text-cyan-400 border border-cyan-500/30",
        "hover:from-cyan-500/30 hover:to-blue-500/30 hover:border-cyan-500/50 hover:shadow-lg hover:shadow-cyan-500/10",
        sending && "opacity-50 cursor-not-allowed"
      )}
      title={`Add ${username} as friend`}
    >
      {sending ? (
        <div className="w-4 h-4 border-2 border-cyan-500/50 border-t-cyan-400 rounded-full animate-spin" />
      ) : (
        <UserPlus className="w-4 h-4" />
      )}
    </button>
  );
}
