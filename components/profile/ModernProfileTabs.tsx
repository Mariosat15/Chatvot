'use client';

import { useState, useEffect, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { 
  LayoutDashboard, 
  Award, 
  Settings, 
  Bell, 
  ShoppingBag, 
  Shield,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface Tab {
  id: string;
  label: string;
  icon: React.ReactNode;
  color: string;
  gradient: string;
}

const TABS: Tab[] = [
  { 
    id: 'overview', 
    label: 'Overview', 
    icon: <LayoutDashboard className="w-4 h-4" />,
    color: 'text-blue-400',
    gradient: 'from-blue-500/20 to-blue-600/10'
  },
  { 
    id: 'badges', 
    label: 'Badges', 
    icon: <Award className="w-4 h-4" />,
    color: 'text-purple-400',
    gradient: 'from-purple-500/20 to-purple-600/10'
  },
  { 
    id: 'arsenal', 
    label: 'Arsenal', 
    icon: <ShoppingBag className="w-4 h-4" />,
    color: 'text-cyan-400',
    gradient: 'from-cyan-500/20 to-cyan-600/10'
  },
  { 
    id: 'verification', 
    label: 'Verification', 
    icon: <Shield className="w-4 h-4" />,
    color: 'text-green-400',
    gradient: 'from-green-500/20 to-green-600/10'
  },
  { 
    id: 'notifications', 
    label: 'Notifications', 
    icon: <Bell className="w-4 h-4" />,
    color: 'text-amber-400',
    gradient: 'from-amber-500/20 to-amber-600/10'
  },
  { 
    id: 'settings', 
    label: 'Settings', 
    icon: <Settings className="w-4 h-4" />,
    color: 'text-gray-400',
    gradient: 'from-gray-500/20 to-gray-600/10'
  },
];

interface ModernProfileTabsProps {
  overviewContent: React.ReactNode;
  badgesContent: React.ReactNode;
  settingsContent?: React.ReactNode;
  notificationsContent?: React.ReactNode;
  arsenalContent?: React.ReactNode;
  verificationContent?: React.ReactNode;
}

export default function ModernProfileTabs({
  overviewContent,
  badgesContent,
  settingsContent,
  notificationsContent,
  arsenalContent,
  verificationContent,
}: ModernProfileTabsProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState('overview');
  const tabsContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // Handle tab from URL query param
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab && TABS.find(t => t.id === tab)) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  // Update URL when tab changes
  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
    router.push(`/profile?tab=${tabId}`, { scroll: false });
  };

  // Check scroll position
  const checkScroll = () => {
    if (tabsContainerRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = tabsContainerRef.current;
      setCanScrollLeft(scrollLeft > 0);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10);
    }
  };

  useEffect(() => {
    checkScroll();
    window.addEventListener('resize', checkScroll);
    return () => window.removeEventListener('resize', checkScroll);
  }, []);

  const scroll = (direction: 'left' | 'right') => {
    if (tabsContainerRef.current) {
      const scrollAmount = direction === 'left' ? -200 : 200;
      tabsContainerRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
      setTimeout(checkScroll, 300);
    }
  };

  const getContent = () => {
    switch (activeTab) {
      case 'overview':
        return overviewContent;
      case 'badges':
        return badgesContent;
      case 'arsenal':
        return arsenalContent;
      case 'verification':
        return verificationContent;
      case 'notifications':
        return notificationsContent;
      case 'settings':
        return settingsContent;
      default:
        return overviewContent;
    }
  };

  const activeTabData = TABS.find(t => t.id === activeTab);

  return (
    <div className="w-full">
      {/* Tabs Navigation */}
      <div className="relative mb-6">
        {/* Scroll Buttons */}
        {canScrollLeft && (
          <button
            onClick={() => scroll('left')}
            className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 bg-gray-900/90 backdrop-blur rounded-full flex items-center justify-center text-gray-400 hover:text-white transition-colors shadow-lg border border-gray-700"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        )}
        {canScrollRight && (
          <button
            onClick={() => scroll('right')}
            className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 bg-gray-900/90 backdrop-blur rounded-full flex items-center justify-center text-gray-400 hover:text-white transition-colors shadow-lg border border-gray-700"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        )}

        {/* Tabs Container */}
        <div
          ref={tabsContainerRef}
          onScroll={checkScroll}
          className="flex items-center gap-2 overflow-x-auto scrollbar-hide scroll-smooth px-1 py-1 bg-gray-800/50 backdrop-blur-sm rounded-2xl border border-gray-700/50"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`
                  relative flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm 
                  transition-all duration-200 whitespace-nowrap min-w-fit
                  ${isActive 
                    ? `bg-gradient-to-r ${tab.gradient} ${tab.color} shadow-lg` 
                    : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700/50'
                  }
                `}
              >
                {tab.icon}
                <span>{tab.label}</span>
                {isActive && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute inset-0 rounded-xl bg-white/5 border border-white/10"
                    transition={{ type: 'spring', bounce: 0.2, duration: 0.4 }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
        >
          {getContent()}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

