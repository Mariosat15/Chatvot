'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useWhiteLabelImages } from '@/hooks/useWhiteLabelImages';
import { signOut } from '@/lib/actions/auth.actions';
import NotificationDropdown from '@/components/notifications/NotificationDropdown';
import {
  LayoutDashboard,
  Trophy,
  Swords,
  ShoppingBag,
  Medal,
  User,
  Wallet,
  HelpCircle,
  LogOut,
  Menu,
  X,
  ChevronRight,
  TrendingUp,
  Settings,
  Bell,
  Sparkles,
} from 'lucide-react';

interface SidebarUser {
  id: string;
  name: string;
  email: string;
}

interface UserSidebarProps {
  user: SidebarUser;
}

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  color: string;
  gradient: string;
  badge?: string;
}

const mainNavItems: NavItem[] = [
  {
    href: '/',
    label: 'Dashboard',
    icon: <LayoutDashboard className="h-5 w-5" />,
    color: 'text-blue-400',
    gradient: 'from-blue-500/20 to-blue-600/5',
  },
  {
    href: '/competitions',
    label: 'Competitions',
    icon: <Trophy className="h-5 w-5" />,
    color: 'text-yellow-400',
    gradient: 'from-yellow-500/20 to-yellow-600/5',
    badge: 'HOT',
  },
  {
    href: '/challenges',
    label: '1v1 Challenges',
    icon: <Swords className="h-5 w-5" />,
    color: 'text-red-400',
    gradient: 'from-red-500/20 to-red-600/5',
  },
  {
    href: '/marketplace',
    label: 'Marketplace',
    icon: <ShoppingBag className="h-5 w-5" />,
    color: 'text-purple-400',
    gradient: 'from-purple-500/20 to-purple-600/5',
  },
  {
    href: '/leaderboard',
    label: 'Leaderboard',
    icon: <Medal className="h-5 w-5" />,
    color: 'text-emerald-400',
    gradient: 'from-emerald-500/20 to-emerald-600/5',
  },
];

const accountNavItems: NavItem[] = [
  {
    href: '/profile',
    label: 'Profile',
    icon: <User className="h-5 w-5" />,
    color: 'text-cyan-400',
    gradient: 'from-cyan-500/20 to-cyan-600/5',
  },
  {
    href: '/wallet',
    label: 'Wallet',
    icon: <Wallet className="h-5 w-5" />,
    color: 'text-green-400',
    gradient: 'from-green-500/20 to-green-600/5',
  },
  {
    href: '/help',
    label: 'Help Center',
    icon: <HelpCircle className="h-5 w-5" />,
    color: 'text-orange-400',
    gradient: 'from-orange-500/20 to-orange-600/5',
  },
];

const UserSidebar = ({ user }: UserSidebarProps) => {
  const pathname = usePathname();
  const router = useRouter();
  const { images } = useWhiteLabelImages();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Close mobile menu on route change
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  // Close mobile menu on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsMobileMenuOpen(false);
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, []);

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isMobileMenuOpen]);

  const isActive = (path: string) => {
    if (path === '/') return pathname === '/';
    return pathname.startsWith(path);
  };

  const handleSignOut = async () => {
    await signOut();
    router.push('/sign-in');
  };

  const NavLink = ({ item }: { item: NavItem }) => {
    const active = isActive(item.href);
    return (
      <Link href={item.href}>
        <div
          className={cn(
            'group relative flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-300 cursor-pointer',
            active
              ? `bg-gradient-to-r ${item.gradient} border border-gray-700/50 shadow-lg`
              : 'hover:bg-gray-800/50 border border-transparent hover:border-gray-700/30'
          )}
        >
          {/* Active indicator */}
          {active && (
            <div className={cn('absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 rounded-r-full', item.color.replace('text-', 'bg-'))} />
          )}
          
          <div className={cn(
            'flex items-center justify-center w-9 h-9 rounded-lg transition-all duration-300',
            active 
              ? `${item.color.replace('text-', 'bg-')}/20 ${item.color}`
              : 'bg-gray-800/50 text-gray-400 group-hover:text-gray-200'
          )}>
            {item.icon}
          </div>
          
          {!isCollapsed && (
            <>
              <span className={cn(
                'flex-1 font-medium transition-colors duration-300',
                active ? 'text-white' : 'text-gray-300 group-hover:text-white'
              )}>
                {item.label}
              </span>
              
              {item.badge && (
                <span className="px-2 py-0.5 text-[10px] font-bold bg-gradient-to-r from-yellow-500 to-orange-500 text-gray-900 rounded-full animate-pulse">
                  {item.badge}
                </span>
              )}
              
              <ChevronRight className={cn(
                'h-4 w-4 transition-all duration-300',
                active ? 'text-gray-400 translate-x-0 opacity-100' : 'text-gray-600 -translate-x-2 opacity-0 group-hover:translate-x-0 group-hover:opacity-100'
              )} />
            </>
          )}
        </div>
      </Link>
    );
  };

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="p-4 border-b border-gray-800/50">
        <Link href="/dashboard" className="flex items-center gap-3">
          <div className="relative">
            <div className="absolute inset-0 bg-yellow-500/20 blur-xl rounded-full" />
            <Image 
              src="/assets/icons/logo.svg" 
              alt="logo" 
              width={isCollapsed ? 40 : 140} 
              height={32}
              priority
              className="relative z-10 cursor-pointer"
              style={{ width: 'auto', height: '32px' }}
            />
          </div>
        </Link>
      </div>

      {/* User Profile Card */}
      <div className="p-4 border-b border-gray-800/50">
        <div className={cn(
          'relative overflow-hidden rounded-2xl bg-gradient-to-br from-gray-800/80 via-gray-800/50 to-gray-900/80 border border-gray-700/50 p-4',
          isCollapsed && 'p-2'
        )}>
          {/* Decorative elements */}
          <div className="absolute top-0 right-0 w-20 h-20 bg-yellow-500/10 rounded-full blur-2xl" />
          <div className="absolute bottom-0 left-0 w-16 h-16 bg-blue-500/10 rounded-full blur-2xl" />
          
          <div className={cn('relative flex items-center gap-3', isCollapsed && 'justify-center')}>
            <div className="relative group">
              <div className="absolute -inset-1 bg-gradient-to-r from-yellow-500 to-orange-500 rounded-full opacity-50 group-hover:opacity-75 blur transition-opacity" />
              <Avatar className="relative h-12 w-12 ring-2 ring-gray-900">
                <AvatarImage src={images.profileImage} />
                <AvatarFallback className="bg-gradient-to-br from-yellow-500 to-orange-500 text-gray-900 font-bold text-lg">
                  {user?.name?.[0] || user?.email?.[0]?.toUpperCase() || 'U'}
                </AvatarFallback>
              </Avatar>
              <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-green-500 rounded-full border-2 border-gray-900" />
            </div>
            
            {!isCollapsed && (
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-white truncate flex items-center gap-1">
                  {user?.name || 'Trader'}
                  <Sparkles className="h-3.5 w-3.5 text-yellow-500" />
                </h3>
                <p className="text-xs text-gray-400 truncate">{user?.email}</p>
                <div className="flex items-center gap-1 mt-1">
                  <TrendingUp className="h-3 w-3 text-green-400" />
                  <span className="text-[10px] font-medium text-green-400">Active Trader</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto custom-scrollbar px-3 py-4">
        {/* Main Navigation */}
        <div className="space-y-1">
          {!isCollapsed && (
            <h4 className="px-3 mb-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Trading
            </h4>
          )}
          {mainNavItems.map((item) => (
            <NavLink key={item.href} item={item} />
          ))}
        </div>

        {/* Account Navigation */}
        <div className="mt-6 space-y-1">
          {!isCollapsed && (
            <h4 className="px-3 mb-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Account
            </h4>
          )}
          {accountNavItems.map((item) => (
            <NavLink key={item.href} item={item} />
          ))}
        </div>
      </div>

      {/* Footer Actions */}
      <div className="p-4 border-t border-gray-800/50 space-y-2">
        {/* Notifications - Desktop Only */}
        <div className="hidden lg:flex items-center justify-between px-3 py-2 rounded-xl bg-gray-800/30 border border-gray-700/30">
          {!isCollapsed && <span className="text-sm text-gray-400">Notifications</span>}
          <NotificationDropdown />
        </div>

        {/* Logout Button */}
        <Button
          onClick={handleSignOut}
          variant="ghost"
          className={cn(
            'w-full group flex items-center gap-3 px-3 py-2.5 rounded-xl text-gray-400 hover:text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/30 transition-all duration-300',
            isCollapsed && 'justify-center'
          )}
        >
          <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-gray-800/50 group-hover:bg-red-500/20 transition-colors">
            <LogOut className="h-5 w-5" />
          </div>
          {!isCollapsed && <span className="font-medium">Sign Out</span>}
        </Button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className={cn(
        'hidden lg:flex flex-col fixed left-0 top-0 h-screen bg-gradient-to-b from-gray-900 via-gray-900 to-gray-950 border-r border-gray-800/50 z-40 transition-all duration-300',
        isCollapsed ? 'w-20' : 'w-72'
      )}>
        <SidebarContent />
        
        {/* Collapse Toggle */}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="absolute -right-3 top-20 w-6 h-6 bg-gray-800 border border-gray-700 rounded-full flex items-center justify-center hover:bg-gray-700 transition-colors z-50"
        >
          <ChevronRight className={cn('h-3 w-3 text-gray-400 transition-transform', isCollapsed ? '' : 'rotate-180')} />
        </button>
      </aside>

      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-gray-900/95 backdrop-blur-xl border-b border-gray-800/50 z-50 px-4 flex items-center justify-between">
        <Link href="/dashboard" className="flex items-center">
          <Image src="/assets/icons/logo.svg" alt="logo" width={120} height={28} priority style={{ width: 'auto', height: '28px' }} />
        </Link>
        
        <div className="flex items-center gap-2">
          <NotificationDropdown />
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsMobileMenuOpen(true)}
            className="h-10 w-10 rounded-xl bg-gray-800/50 border border-gray-700/50 hover:bg-gray-800 hover:border-yellow-500/30"
          >
            <Menu className="h-5 w-5 text-gray-300" />
          </Button>
        </div>
      </header>

      {/* Mobile Menu Overlay */}
      <div
        className={cn(
          'lg:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-50 transition-opacity duration-300',
          isMobileMenuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        )}
        onClick={() => setIsMobileMenuOpen(false)}
      />

      {/* Mobile Menu Drawer */}
      <aside
        className={cn(
          'lg:hidden fixed right-0 top-0 h-full w-80 max-w-[85vw] bg-gradient-to-b from-gray-900 via-gray-900 to-gray-950 border-l border-gray-800/50 z-50 transition-transform duration-300 ease-out',
          isMobileMenuOpen ? 'translate-x-0' : 'translate-x-full'
        )}
      >
        {/* Mobile Menu Header */}
        <div className="h-16 px-4 flex items-center justify-between border-b border-gray-800/50">
          <span className="font-semibold text-white">Menu</span>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsMobileMenuOpen(false)}
            className="h-9 w-9 rounded-xl hover:bg-gray-800"
          >
            <X className="h-5 w-5 text-gray-400" />
          </Button>
        </div>
        
        <div className="h-[calc(100%-4rem)] overflow-y-auto">
          <SidebarContent />
        </div>
      </aside>

      {/* Spacer for content - adjusts based on sidebar state */}
      <div className={cn(
        'hidden lg:block transition-all duration-300',
        isCollapsed ? 'w-20' : 'w-72'
      )} />
    </>
  );
};

export default UserSidebar;

