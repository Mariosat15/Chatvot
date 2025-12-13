'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Trophy, Award, Settings, Bell, ShoppingBag } from 'lucide-react';

interface ProfileTabsProps {
  overviewContent: React.ReactNode;
  badgesContent: React.ReactNode;
  settingsContent?: React.ReactNode;
  notificationsContent?: React.ReactNode;
  arsenalContent?: React.ReactNode;
}

export default function ProfileTabs({ overviewContent, badgesContent, settingsContent, notificationsContent, arsenalContent }: ProfileTabsProps) {
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<'overview' | 'badges' | 'settings' | 'notifications' | 'arsenal'>('overview');
  
  // Handle tab from URL query param
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'arsenal') {
      setActiveTab('arsenal');
    }
  }, [searchParams]);

  return (
    <div className="space-y-6">
      {/* Tab Buttons */}
      <div className="flex gap-4 border-b border-gray-700 overflow-x-auto">
        <button
          onClick={() => setActiveTab('overview')}
          className={`flex items-center gap-2 px-6 py-3 font-semibold transition-all whitespace-nowrap ${
            activeTab === 'overview'
              ? 'text-primary-400 border-b-2 border-primary-400'
              : 'text-gray-400 hover:text-gray-300'
          }`}
        >
          <Trophy className="h-5 w-5" />
          Overview
        </button>
        <button
          onClick={() => setActiveTab('badges')}
          className={`flex items-center gap-2 px-6 py-3 font-semibold transition-all whitespace-nowrap ${
            activeTab === 'badges'
              ? 'text-primary-400 border-b-2 border-primary-400'
              : 'text-gray-400 hover:text-gray-300'
          }`}
        >
          <Award className="h-5 w-5" />
          Badges
        </button>
        <button
          onClick={() => setActiveTab('notifications')}
          className={`flex items-center gap-2 px-6 py-3 font-semibold transition-all whitespace-nowrap ${
            activeTab === 'notifications'
              ? 'text-primary-400 border-b-2 border-primary-400'
              : 'text-gray-400 hover:text-gray-300'
          }`}
        >
          <Bell className="h-5 w-5" />
          Notifications
        </button>
        {arsenalContent && (
          <button
            onClick={() => setActiveTab('arsenal')}
            className={`flex items-center gap-2 px-6 py-3 font-semibold transition-all whitespace-nowrap ${
              activeTab === 'arsenal'
                ? 'text-cyan-400 border-b-2 border-cyan-400'
                : 'text-gray-400 hover:text-gray-300'
            }`}
          >
            <ShoppingBag className="h-5 w-5" />
            Trading Arsenal
          </button>
        )}
        {settingsContent && (
          <button
            onClick={() => setActiveTab('settings')}
            className={`flex items-center gap-2 px-6 py-3 font-semibold transition-all whitespace-nowrap ${
              activeTab === 'settings'
                ? 'text-primary-400 border-b-2 border-primary-400'
                : 'text-gray-400 hover:text-gray-300'
            }`}
          >
            <Settings className="h-5 w-5" />
            Settings
          </button>
        )}
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === 'overview' && overviewContent}
        {activeTab === 'badges' && badgesContent}
        {activeTab === 'notifications' && (notificationsContent || <div className="text-gray-400">Loading notifications...</div>)}
        {activeTab === 'arsenal' && arsenalContent}
        {activeTab === 'settings' && settingsContent}
      </div>
    </div>
  );
}

