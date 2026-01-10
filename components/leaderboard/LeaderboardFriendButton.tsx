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

  const sendFriendRequest = async () => {
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

  // Loading state
  if (status === 'loading') {
    return (
      <div className={cn(
        "flex items-center justify-center",
        compact ? "w-7 h-7" : "w-8 h-8"
      )}>
        <div className="w-3 h-3 border border-gray-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Already friends
  if (status === 'friends') {
    return (
      <div 
        className={cn(
          "flex items-center justify-center bg-emerald-500/20 text-emerald-400 rounded-lg",
          compact ? "w-7 h-7" : "w-8 h-8"
        )}
        title="Already friends"
      >
        <Users className={compact ? "w-3.5 h-3.5" : "w-4 h-4"} />
      </div>
    );
  }

  // Request pending
  if (status === 'pending') {
    return (
      <div 
        className={cn(
          "flex items-center justify-center bg-amber-500/20 text-amber-400 rounded-lg",
          compact ? "w-7 h-7" : "w-8 h-8"
        )}
        title="Request pending"
      >
        <Clock className={compact ? "w-3.5 h-3.5" : "w-4 h-4"} />
      </div>
    );
  }

  // Friend requests disabled
  if (status === 'disabled') {
    return (
      <div 
        className={cn(
          "flex items-center justify-center bg-gray-500/20 text-gray-500 rounded-lg cursor-not-allowed",
          compact ? "w-7 h-7" : "w-8 h-8"
        )}
        title="Friend requests disabled by user"
      >
        <UserPlus className={compact ? "w-3.5 h-3.5" : "w-4 h-4"} />
      </div>
    );
  }

  // Can send request
  return (
    <button
      onClick={sendFriendRequest}
      disabled={sending}
      className={cn(
        "flex items-center justify-center bg-cyan-500/20 text-cyan-400 rounded-lg hover:bg-cyan-500/30 transition-colors",
        compact ? "w-7 h-7" : "w-8 h-8",
        sending && "opacity-50 cursor-not-allowed"
      )}
      title={`Add ${username} as friend`}
    >
      {sending ? (
        <div className="w-3 h-3 border border-cyan-400 border-t-transparent rounded-full animate-spin" />
      ) : (
        <UserPlus className={compact ? "w-3.5 h-3.5" : "w-4 h-4"} />
      )}
    </button>
  );
}
