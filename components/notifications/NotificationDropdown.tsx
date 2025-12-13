'use client';

import { useState, useEffect, useCallback } from 'react';
import { Bell, Check, CheckCheck, Trash2, ChevronRight, X, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';

interface Notification {
  _id: string;
  title: string;
  message: string;
  icon: string;
  category: string;
  type: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  color: string;
  isRead: boolean;
  actionUrl?: string;
  actionText?: string;
  createdAt: string;
}

const PRIORITY_STYLES: Record<string, string> = {
  low: 'border-l-gray-500',
  normal: 'border-l-blue-500',
  high: 'border-l-orange-500',
  urgent: 'border-l-red-500 bg-red-500/5',
};

const CATEGORY_COLORS: Record<string, string> = {
  purchase: 'bg-blue-500/20 text-blue-400',
  competition: 'bg-yellow-500/20 text-yellow-400',
  trading: 'bg-green-500/20 text-green-400',
  achievement: 'bg-purple-500/20 text-purple-400',
  system: 'bg-gray-500/20 text-gray-400',
  admin: 'bg-orange-500/20 text-orange-400',
  security: 'bg-red-500/20 text-red-400',
};

export default function NotificationDropdown() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  const fetchNotifications = useCallback(async () => {
    try {
      const response = await fetch('/api/notifications?limit=20');
      if (response.ok) {
        const data = await response.json();
        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch on mount and when opening
  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Poll for new notifications every 30 seconds
  useEffect(() => {
    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch('/api/notifications?action=count');
        if (response.ok) {
          const data = await response.json();
          if (data.count !== unreadCount) {
            setUnreadCount(data.count);
            // If new notifications, refresh the list
            if (data.count > unreadCount) {
              fetchNotifications();
            }
          }
        }
      } catch (error) {
        // Silent fail for polling
      }
    }, 30000);

    return () => clearInterval(pollInterval);
  }, [unreadCount, fetchNotifications]);

  // Refresh when opening
  useEffect(() => {
    if (open) {
      fetchNotifications();
    }
  }, [open, fetchNotifications]);

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      const response = await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'mark_read', notificationId }),
      });

      if (response.ok) {
        setNotifications(prev =>
          prev.map(n => (n._id === notificationId ? { ...n, isRead: true } : n))
        );
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      const response = await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'mark_read' }),
      });

      if (response.ok) {
        setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
        setUnreadCount(0);
      }
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  const handleDelete = async (notificationId: string) => {
    try {
      const response = await fetch(`/api/notifications?id=${notificationId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        const deletedNotification = notifications.find(n => n._id === notificationId);
        setNotifications(prev => prev.filter(n => n._id !== notificationId));
        if (deletedNotification && !deletedNotification.isRead) {
          setUnreadCount(prev => Math.max(0, prev - 1));
        }
      }
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  };

  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.isRead) {
      await handleMarkAsRead(notification._id);
    }
    if (notification.actionUrl) {
      setOpen(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative text-gray-400 hover:text-white hover:bg-gray-800"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-yellow-400 opacity-75" />
              <span className="relative inline-flex h-4 w-4 items-center justify-center rounded-full bg-yellow-500 text-[10px] font-bold text-black">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-96 p-0 bg-gray-900 border-gray-800"
        align="end"
        sideOffset={8}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-yellow-500" />
            <span className="font-semibold text-white">Notifications</span>
            {unreadCount > 0 && (
              <Badge className="bg-yellow-500/20 text-yellow-400 text-xs">
                {unreadCount} new
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={fetchNotifications}
              className="h-8 w-8 p-0 text-gray-400 hover:text-white"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleMarkAllAsRead}
                className="h-8 px-2 text-xs text-gray-400 hover:text-white"
              >
                <CheckCheck className="h-3 w-3 mr-1" />
                Mark all read
              </Button>
            )}
          </div>
        </div>

        {/* Notifications List */}
        <ScrollArea className="h-[400px]">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <RefreshCw className="h-6 w-6 animate-spin text-gray-500" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-gray-500">
              <Bell className="h-8 w-8 mb-2 opacity-50" />
              <p className="text-sm">No notifications yet</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-800/50">
              {notifications.map(notification => (
                <div
                  key={notification._id}
                  className={`relative px-4 py-3 hover:bg-gray-800/50 transition-colors border-l-2 ${
                    PRIORITY_STYLES[notification.priority]
                  } ${!notification.isRead ? 'bg-gray-800/30' : ''}`}
                >
                  {/* Unread indicator */}
                  {!notification.isRead && (
                    <div className="absolute left-4 top-4 h-2 w-2 rounded-full bg-yellow-500" />
                  )}

                  <div className="flex gap-3 pl-3">
                    {/* Icon */}
                    <div className="flex-shrink-0 text-xl">{notification.icon}</div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <p className={`text-sm font-medium ${
                            notification.isRead ? 'text-gray-300' : 'text-white'
                          }`}>
                            {notification.title}
                          </p>
                          <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">
                            {notification.message}
                          </p>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {!notification.isRead && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleMarkAsRead(notification._id);
                              }}
                              className="h-6 w-6 p-0 text-gray-500 hover:text-green-400"
                            >
                              <Check className="h-3 w-3" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(notification._id);
                            }}
                            className="h-6 w-6 p-0 text-gray-500 hover:text-red-400"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>

                      {/* Meta */}
                      <div className="flex items-center gap-2 mt-2">
                        <Badge className={`text-[10px] px-1.5 py-0 ${CATEGORY_COLORS[notification.category]}`}>
                          {notification.category}
                        </Badge>
                        <span className="text-[10px] text-gray-600">
                          {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                        </span>
                      </div>

                      {/* Action Button */}
                      {notification.actionUrl && (
                        <Link
                          href={notification.actionUrl}
                          onClick={() => handleNotificationClick(notification)}
                          className="inline-flex items-center gap-1 mt-2 text-xs text-yellow-400 hover:text-yellow-300"
                        >
                          {notification.actionText || 'View'}
                          <ChevronRight className="h-3 w-3" />
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        {/* Footer */}
        {notifications.length > 0 && (
          <div className="px-4 py-2 border-t border-gray-800">
            <Link
              href="/notifications"
              onClick={() => setOpen(false)}
              className="text-xs text-gray-400 hover:text-yellow-400 flex items-center justify-center gap-1"
            >
              View all notifications
              <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

