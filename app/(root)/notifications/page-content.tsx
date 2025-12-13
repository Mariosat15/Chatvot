'use client';

import { useState, useEffect, useCallback } from 'react';
import { 
  Bell, Check, CheckCheck, Trash2, ChevronRight, RefreshCw, 
  Filter, Search, BellOff, Settings, ArrowLeft
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import Link from 'next/link';
import { formatDistanceToNow, format } from 'date-fns';
import { toast } from 'sonner';

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

const CATEGORY_INFO: Record<string, { label: string; icon: string; color: string }> = {
  purchase: { label: 'Purchases', icon: '💳', color: 'bg-blue-500/20 text-blue-400' },
  competition: { label: 'Competitions', icon: '🏆', color: 'bg-yellow-500/20 text-yellow-400' },
  trading: { label: 'Trading', icon: '📈', color: 'bg-green-500/20 text-green-400' },
  achievement: { label: 'Achievements', icon: '🏅', color: 'bg-purple-500/20 text-purple-400' },
  system: { label: 'System', icon: '⚙️', color: 'bg-gray-500/20 text-gray-400' },
  admin: { label: 'Admin', icon: '📢', color: 'bg-orange-500/20 text-orange-400' },
  security: { label: 'Security', icon: '🔐', color: 'bg-red-500/20 text-red-400' },
};

export default function NotificationsPageContent() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [filteredNotifications, setFilteredNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [readFilter, setReadFilter] = useState<string>('all');

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/notifications?limit=100');
      if (response.ok) {
        const data = await response.json();
        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
      toast.error('Failed to load notifications');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Filter notifications
  useEffect(() => {
    let filtered = [...notifications];

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        n => n.title.toLowerCase().includes(query) || n.message.toLowerCase().includes(query)
      );
    }

    // Category filter
    if (categoryFilter !== 'all') {
      filtered = filtered.filter(n => n.category === categoryFilter);
    }

    // Read status filter
    if (readFilter === 'unread') {
      filtered = filtered.filter(n => !n.isRead);
    } else if (readFilter === 'read') {
      filtered = filtered.filter(n => n.isRead);
    }

    setFilteredNotifications(filtered);
  }, [notifications, searchQuery, categoryFilter, readFilter]);

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
    } catch {
      toast.error('Failed to mark as read');
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
        toast.success('All notifications marked as read');
      }
    } catch {
      toast.error('Failed to mark all as read');
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
        toast.success('Notification deleted');
      }
    } catch {
      toast.error('Failed to delete notification');
    }
  };

  const handleClearAll = async () => {
    if (!confirm('Are you sure you want to delete all notifications?')) return;

    try {
      const response = await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'clear_all' }),
      });

      if (response.ok) {
        setNotifications([]);
        setUnreadCount(0);
        toast.success('All notifications cleared');
      }
    } catch {
      toast.error('Failed to clear notifications');
    }
  };

  // Group notifications by date
  const groupedNotifications = filteredNotifications.reduce((groups, notification) => {
    const date = new Date(notification.createdAt);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    let groupKey: string;
    if (date.toDateString() === today.toDateString()) {
      groupKey = 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      groupKey = 'Yesterday';
    } else {
      groupKey = format(date, 'MMMM d, yyyy');
    }

    if (!groups[groupKey]) {
      groups[groupKey] = [];
    }
    groups[groupKey].push(notification);
    return groups;
  }, {} as Record<string, Notification[]>);

  return (
    <div className="flex min-h-screen flex-col gap-6 p-4 md:p-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/profile" className="text-gray-400 hover:text-white">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <Bell className="h-8 w-8 text-yellow-500" />
              Notifications
              {unreadCount > 0 && (
                <Badge className="bg-yellow-500/20 text-yellow-400 ml-2">
                  {unreadCount} unread
                </Badge>
              )}
            </h1>
            <p className="text-gray-400 mt-1">
              {notifications.length} total notifications
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/profile?tab=notifications">
            <Button variant="outline" className="border-gray-700 text-gray-300">
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </Button>
          </Link>
          {unreadCount > 0 && (
            <Button onClick={handleMarkAllAsRead} variant="outline" className="border-gray-700 text-gray-300">
              <CheckCheck className="h-4 w-4 mr-2" />
              Mark All Read
            </Button>
          )}
          {notifications.length > 0 && (
            <Button onClick={handleClearAll} variant="outline" className="border-red-700 text-red-400 hover:bg-red-950">
              <Trash2 className="h-4 w-4 mr-2" />
              Clear All
            </Button>
          )}
        </div>
      </div>

      {/* Filters */}
      <Card className="bg-gray-900/50 border-gray-800">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
              <Input
                placeholder="Search notifications..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-10 bg-gray-800 border-gray-700 text-white"
              />
            </div>

            {/* Category Filter */}
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[180px] bg-gray-800 border-gray-700 text-white">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent className="bg-gray-800 border-gray-700">
                <SelectItem value="all" className="text-white">All Categories</SelectItem>
                {Object.entries(CATEGORY_INFO).map(([key, { label, icon }]) => (
                  <SelectItem key={key} value={key} className="text-white">
                    {icon} {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Read Status Filter */}
            <Select value={readFilter} onValueChange={setReadFilter}>
              <SelectTrigger className="w-[150px] bg-gray-800 border-gray-700 text-white">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent className="bg-gray-800 border-gray-700">
                <SelectItem value="all" className="text-white">All</SelectItem>
                <SelectItem value="unread" className="text-white">Unread</SelectItem>
                <SelectItem value="read" className="text-white">Read</SelectItem>
              </SelectContent>
            </Select>

            {/* Refresh */}
            <Button
              variant="outline"
              onClick={fetchNotifications}
              className="border-gray-700"
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Notifications List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="h-8 w-8 animate-spin text-yellow-500" />
        </div>
      ) : filteredNotifications.length === 0 ? (
        <Card className="bg-gray-900/50 border-gray-800">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <BellOff className="h-16 w-16 text-gray-600 mb-4" />
            <h3 className="text-xl font-semibold text-gray-400 mb-2">No notifications</h3>
            <p className="text-gray-500 text-center max-w-md">
              {notifications.length === 0
                ? "You're all caught up! New notifications will appear here."
                : "No notifications match your filters."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedNotifications).map(([date, dateNotifications]) => (
            <div key={date}>
              <h3 className="text-sm font-medium text-gray-500 mb-3 px-2">{date}</h3>
              <Card className="bg-gray-900/50 border-gray-800 overflow-hidden">
                <div className="divide-y divide-gray-800/50">
                  {dateNotifications.map(notification => (
                    <div
                      key={notification._id}
                      className={`relative p-4 hover:bg-gray-800/50 transition-colors border-l-4 ${
                        PRIORITY_STYLES[notification.priority]
                      } ${!notification.isRead ? 'bg-gray-800/30' : ''}`}
                    >
                      {/* Unread indicator */}
                      {!notification.isRead && (
                        <div className="absolute left-6 top-5 h-2 w-2 rounded-full bg-yellow-500" />
                      )}

                      <div className="flex gap-4 pl-4">
                        {/* Icon */}
                        <div className="flex-shrink-0 text-2xl">{notification.icon}</div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <p className={`font-medium ${notification.isRead ? 'text-gray-300' : 'text-white'}`}>
                                {notification.title}
                              </p>
                              <p className="text-sm text-gray-500 mt-1">
                                {notification.message}
                              </p>
                            </div>

                            {/* Actions */}
                            <div className="flex items-center gap-2 flex-shrink-0">
                              {!notification.isRead && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleMarkAsRead(notification._id)}
                                  className="text-gray-400 hover:text-green-400"
                                >
                                  <Check className="h-4 w-4" />
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDelete(notification._id)}
                                className="text-gray-400 hover:text-red-400"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>

                          {/* Meta */}
                          <div className="flex items-center gap-3 mt-3">
                            <Badge className={`text-xs ${CATEGORY_INFO[notification.category]?.color || 'bg-gray-500/20 text-gray-400'}`}>
                              {CATEGORY_INFO[notification.category]?.icon} {CATEGORY_INFO[notification.category]?.label || notification.category}
                            </Badge>
                            <span className="text-xs text-gray-600">
                              {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                            </span>
                            {notification.actionUrl && (
                              <Link
                                href={notification.actionUrl}
                                className="inline-flex items-center gap-1 text-xs text-yellow-400 hover:text-yellow-300"
                              >
                                {notification.actionText || 'View'}
                                <ChevronRight className="h-3 w-3" />
                              </Link>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

