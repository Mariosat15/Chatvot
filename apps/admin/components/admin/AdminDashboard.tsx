'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useAdminEvents } from '@/hooks/useAdminEvents';
import { 
  Shield, 
  LogOut, 
  Trophy,
  Swords,
  Plus, 
  DollarSign, 
  BarChart3, 
  Settings as SettingsIcon, 
  Database, 
  Users, 
  CreditCard, 
  AlertTriangle, 
  BookOpen, 
  Award,
  ChevronRight,
  ChevronDown,
  Building2,
  FileText,
  Palette,
  Key,
  Globe,
  Gauge,
  Coins,
  Server,
  Menu,
  X,
  Home,
  TrendingUp,
  Bell,
  Search,
  ScrollText,
  Mail,
  ShoppingBag,
  Terminal,
  History,
  Wallet,
  LineChart,
  ShieldAlert,
  Cog,
  LayoutDashboard,
  Activity,
  ArrowUpFromLine,
  Calendar,
  Clock,
  Package,
  Bot,
  Sparkles,
  Crown,
  Wifi,
  UserPlus,
  UserCircle,
  MessageCircle,
  Headphones,
} from 'lucide-react';
import { toast } from 'sonner';
import CredentialsSection from '@/components/admin/CredentialsSection';
import EnvironmentSection from '@/components/admin/EnvironmentSection';
import ImagesSection from '@/components/admin/ImagesSection';
import TradingRiskSection from '@/components/admin/TradingRiskSection';
import SymbolsSection from '@/components/admin/SymbolsSection';
import CurrencySettingsSection from '@/components/admin/CurrencySettingsSection';
import FinancialDashboard from '@/components/admin/FinancialDashboard';
import CompetitionAnalytics from '@/components/admin/CompetitionAnalytics';
import CompetitionsListSection from '@/components/admin/CompetitionsListSection';
import ChallengeSettingsSection from '@/components/admin/ChallengeSettingsSection';
import DatabaseSection from '@/components/admin/DatabaseSection';
import UsersSection from '@/components/admin/UsersSection';
import PaymentProvidersSection from '@/components/admin/PaymentProvidersSection';
import PendingPaymentsSection from '@/components/admin/PendingPaymentsSection';
import FailedDepositsSection from '@/components/admin/FailedDepositsSection';
import FraudMonitoringSection from '@/components/admin/FraudMonitoringSection';
import AdminWikiSection from '@/components/admin/AdminWikiSection';
import BadgeXPManagementSection from '@/components/admin/BadgeXPManagementSection';
import FeeSettingsSection from '@/components/admin/FeeSettingsSection';
import CompanyDetailsSection from '@/components/admin/CompanyDetailsSection';
import InvoiceTemplateSection from '@/components/admin/InvoiceTemplateSection';
import AuditLogSection from '@/components/admin/AuditLogSection';
import EmailTemplatesSection from '@/components/admin/EmailTemplatesSection';
import NotificationSystemSection from '@/components/admin/NotificationSystemSection';
import MarketplaceSection from '@/components/admin/MarketplaceSection';
import LandingPageBuilder from '@/components/admin/LandingPageBuilder';
import RedisSettingsSection from '@/components/admin/RedisSettingsSection';
import DevSettingsSection from '@/components/admin/DevSettingsSection';
import TradingHistorySection from '@/components/admin/TradingHistorySection';
import PerformanceSimulatorSection from '@/components/admin/PerformanceSimulatorSection';
import WithdrawalSettingsSection from '@/components/admin/WithdrawalSettingsSection';
import PendingWithdrawalsSection from '@/components/admin/PendingWithdrawalsSection';
import KYCSettingsSection from '@/components/admin/KYCSettingsSection';
import KYCHistorySection from '@/components/admin/KYCHistorySection';
import MarketSettingsSection from '@/components/admin/MarketSettingsSection';
import DependencyUpdatesSection from '@/components/admin/DependencyUpdatesSection';
import AdminOverviewDashboard from '@/components/admin/AdminOverviewDashboard';
import AIAgentSection from '@/components/admin/AIAgentSection';
import EmployeesSection from '@/components/admin/EmployeesSection';
import CustomerAssignmentSettings from '@/components/admin/CustomerAssignmentSettings';
import EmployeeProfileSection from '@/components/admin/EmployeeProfileSection';
import MessagingSection from '@/components/admin/MessagingSection';
import MessagingSettingsSection from '@/components/admin/MessagingSettingsSection';

interface AdminDashboardProps {
  isFirstLogin: boolean;
  adminEmail: string;
  adminName?: string;
  isSuperAdmin?: boolean;
  role?: string;
  allowedSections?: string[];
}

interface MenuItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  children?: { id: string; label: string; icon: React.ReactNode }[];
}

interface MenuGroup {
  id: string;
  label: string;
  icon: React.ReactNode;
  color: string;
  items: MenuItem[];
}

// Menu organized by groups
const menuGroups: MenuGroup[] = [
  // Dashboard Overview (First Item)
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: <LayoutDashboard className="h-4 w-4" />,
    color: 'text-blue-400',
    items: [
      {
        id: 'overview',
        label: 'Overview',
        icon: <LayoutDashboard className="h-5 w-5" />,
        color: 'text-blue-400',
        bgColor: 'bg-blue-500/10 hover:bg-blue-500/20',
      },
    ],
  },
  // Content Management
  {
    id: 'content',
    label: 'Content',
    icon: <Home className="h-4 w-4" />,
    color: 'text-yellow-400',
    items: [
      {
        id: 'hero-page',
        label: 'Hero Page',
        icon: <Home className="h-5 w-5" />,
        color: 'text-yellow-400',
        bgColor: 'bg-yellow-500/10 hover:bg-yellow-500/20',
      },
      {
        id: 'marketplace',
        label: 'Marketplace',
        icon: <ShoppingBag className="h-5 w-5" />,
        color: 'text-fuchsia-400',
        bgColor: 'bg-fuchsia-500/10 hover:bg-fuchsia-500/20',
      },
    ],
  },
  // Trading
  {
    id: 'trading',
    label: 'Trading',
    icon: <LineChart className="h-4 w-4" />,
    color: 'text-orange-400',
    items: [
      {
        id: 'competitions',
        label: 'Competitions',
        icon: <Trophy className="h-5 w-5" />,
        color: 'text-orange-400',
        bgColor: 'bg-orange-500/10 hover:bg-orange-500/20',
      },
      {
        id: 'challenges',
        label: '1v1 Challenges',
        icon: <Swords className="h-5 w-5" />,
        color: 'text-red-400',
        bgColor: 'bg-red-500/10 hover:bg-red-500/20',
      },
      {
        id: 'trading-history',
        label: 'Trading History',
        icon: <History className="h-5 w-5" />,
        color: 'text-cyan-400',
        bgColor: 'bg-cyan-500/10 hover:bg-cyan-500/20',
      },
      {
        id: 'analytics',
        label: 'Analytics',
        icon: <BarChart3 className="h-5 w-5" />,
        color: 'text-blue-400',
        bgColor: 'bg-blue-500/10 hover:bg-blue-500/20',
      },
      {
        id: 'market',
        label: 'Market Hours',
        icon: <Calendar className="h-5 w-5" />,
        color: 'text-green-400',
        bgColor: 'bg-green-500/10 hover:bg-green-500/20',
      },
      {
        id: 'symbols',
        label: 'Trading Symbols',
        icon: <TrendingUp className="h-5 w-5" />,
        color: 'text-violet-400',
        bgColor: 'bg-violet-500/10 hover:bg-violet-500/20',
      },
    ],
  },
  // User Management
  {
    id: 'user-management',
    label: 'User Management',
    icon: <Users className="h-4 w-4" />,
    color: 'text-cyan-400',
    items: [
      {
        id: 'users',
        label: 'Users',
        icon: <Users className="h-5 w-5" />,
        color: 'text-cyan-400',
        bgColor: 'bg-cyan-500/10 hover:bg-cyan-500/20',
      },
      {
        id: 'badges',
        label: 'Badges & XP',
        icon: <Award className="h-5 w-5" />,
        color: 'text-pink-400',
        bgColor: 'bg-pink-500/10 hover:bg-pink-500/20',
      },
      {
        id: 'customer-assignment',
        label: 'Customer Assignment',
        icon: <UserPlus className="h-5 w-5" />,
        color: 'text-blue-400',
        bgColor: 'bg-blue-500/10 hover:bg-blue-500/20',
      },
    ],
  },
  // Finance & Payments
  {
    id: 'finance',
    label: 'Finance',
    icon: <Wallet className="h-4 w-4" />,
    color: 'text-emerald-400',
    items: [
      {
        id: 'financial',
        label: 'Financial Dashboard',
        icon: <DollarSign className="h-5 w-5" />,
        color: 'text-emerald-400',
        bgColor: 'bg-emerald-500/10 hover:bg-emerald-500/20',
      },
      {
        id: 'payments',
        label: 'Pending Payments',
        icon: <CreditCard className="h-5 w-5" />,
        color: 'text-yellow-400',
        bgColor: 'bg-yellow-500/10 hover:bg-yellow-500/20',
      },
      {
        id: 'failed-deposits',
        label: 'Failed Deposits',
        icon: <AlertTriangle className="h-5 w-5" />,
        color: 'text-red-400',
        bgColor: 'bg-red-500/10 hover:bg-red-500/20',
      },
      {
        id: 'withdrawals',
        label: 'Withdrawal Settings',
        icon: <Wallet className="h-5 w-5" />,
        color: 'text-teal-400',
        bgColor: 'bg-teal-500/10 hover:bg-teal-500/20',
      },
      {
        id: 'pending-withdrawals',
        label: 'Pending Withdrawals',
        icon: <ArrowUpFromLine className="h-5 w-5" />,
        color: 'text-cyan-400',
        bgColor: 'bg-cyan-500/10 hover:bg-cyan-500/20',
      },
    ],
  },
  // Security
  {
    id: 'security',
    label: 'Security',
    icon: <ShieldAlert className="h-4 w-4" />,
    color: 'text-red-400',
    items: [
      {
        id: 'kyc-settings',
        label: 'KYC Settings',
        icon: <Shield className="h-5 w-5" />,
        color: 'text-green-400',
        bgColor: 'bg-green-500/10 hover:bg-green-500/20',
      },
      {
        id: 'kyc-history',
        label: 'KYC History',
        icon: <History className="h-5 w-5" />,
        color: 'text-green-400',
        bgColor: 'bg-green-500/10 hover:bg-green-500/20',
      },
      {
        id: 'fraud',
        label: 'Fraud Detection',
        icon: <AlertTriangle className="h-5 w-5" />,
        color: 'text-red-400',
        bgColor: 'bg-red-500/10 hover:bg-red-500/20',
      },
    ],
  },
  // Help
  {
    id: 'help',
    label: 'Help',
    icon: <BookOpen className="h-4 w-4" />,
    color: 'text-indigo-400',
    items: [
      {
        id: 'wiki',
        label: 'Documentation',
        icon: <BookOpen className="h-5 w-5" />,
        color: 'text-indigo-400',
        bgColor: 'bg-indigo-500/10 hover:bg-indigo-500/20',
      },
    ],
  },
  // Messaging
  {
    id: 'messaging-group',
    label: 'Messaging',
    icon: <MessageCircle className="h-4 w-4" />,
    color: 'text-pink-400',
    items: [
      {
        id: 'messaging',
        label: 'Support Center',
        icon: <Headphones className="h-5 w-5" />,
        color: 'text-pink-400',
        bgColor: 'bg-pink-500/10 hover:bg-pink-500/20',
      },
      {
        id: 'messaging-settings',
        label: 'Messaging Settings',
        icon: <MessageCircle className="h-5 w-5" />,
        color: 'text-pink-400',
        bgColor: 'bg-pink-500/10 hover:bg-pink-500/20',
      },
    ],
  },
  // AI & Automation
  {
    id: 'ai-automation',
    label: 'AI & Automation',
    icon: <Bot className="h-4 w-4" />,
    color: 'text-violet-400',
    items: [
      {
        id: 'ai-agent',
        label: 'AI Agent',
        icon: <Bot className="h-5 w-5" />,
        color: 'text-violet-400',
        bgColor: 'bg-violet-500/10 hover:bg-violet-500/20',
      },
    ],
  },
  // Settings
  {
    id: 'settings-group',
    label: 'Settings',
    icon: <Cog className="h-4 w-4" />,
    color: 'text-purple-400',
    items: [
      {
        id: 'settings',
        label: 'Settings',
        icon: <SettingsIcon className="h-5 w-5" />,
        color: 'text-purple-400',
        bgColor: 'bg-purple-500/10 hover:bg-purple-500/20',
        children: [
          { id: 'credentials', label: 'Credentials', icon: <Key className="h-4 w-4" /> },
          { id: 'environment', label: 'Environment', icon: <Globe className="h-4 w-4" /> },
          { id: 'branding', label: 'Branding', icon: <Palette className="h-4 w-4" /> },
          { id: 'company', label: 'Company', icon: <Building2 className="h-4 w-4" /> },
          { id: 'invoices', label: 'Invoices', icon: <FileText className="h-4 w-4" /> },
          { id: 'email-templates', label: 'Email Templates', icon: <Mail className="h-4 w-4" /> },
          { id: 'notifications', label: 'Notifications', icon: <Bell className="h-4 w-4" /> },
          { id: 'trading-risk', label: 'Trading Risk', icon: <Gauge className="h-4 w-4" /> },
          { id: 'currency', label: 'Currency', icon: <Coins className="h-4 w-4" /> },
          { id: 'fees', label: 'Fees', icon: <DollarSign className="h-4 w-4" /> },
          { id: 'payment-providers', label: 'Payment Providers', icon: <CreditCard className="h-4 w-4" /> },
          { id: 'database', label: 'Database', icon: <Database className="h-4 w-4" /> },
          { id: 'audit-logs', label: 'Audit Logs', icon: <ScrollText className="h-4 w-4" /> },
        ],
      },
    ],
  },
  // Dev Zone
  {
    id: 'dev-zone',
    label: 'Dev Zone',
    icon: <Terminal className="h-4 w-4" />,
    color: 'text-lime-400',
    items: [
      {
        id: 'dev-zone-menu',
        label: 'Dev Zone',
        icon: <Terminal className="h-5 w-5" />,
        color: 'text-lime-400',
        bgColor: 'bg-lime-500/10 hover:bg-lime-500/20',
        children: [
          { id: 'redis', label: 'Redis Cache', icon: <Server className="h-4 w-4" /> },
          { id: 'dev-settings', label: 'Test', icon: <Terminal className="h-4 w-4" /> },
          { id: 'performance-simulator', label: 'Performance Simulator', icon: <Activity className="h-4 w-4" /> },
          { id: 'dependency-updates', label: 'Dependency Updates', icon: <Package className="h-4 w-4" /> },
        ],
      },
    ],
  },
  // Employee Management (Super Admin Only)
  {
    id: 'admin-management',
    label: 'Admin',
    icon: <Crown className="h-4 w-4" />,
    color: 'text-yellow-400',
    items: [
      {
        id: 'employees',
        label: 'Employees',
        icon: <Users className="h-5 w-5" />,
        color: 'text-yellow-400',
        bgColor: 'bg-yellow-500/10 hover:bg-yellow-500/20',
      },
    ],
  },
  // My Account (for employees only, not super admin)
  {
    id: 'my-account',
    label: 'My Account',
    icon: <UserCircle className="h-4 w-4" />,
    color: 'text-indigo-400',
    items: [
      {
        id: 'profile',
        label: 'My Profile',
        icon: <UserCircle className="h-5 w-5" />,
        color: 'text-indigo-400',
        bgColor: 'bg-indigo-500/10 hover:bg-indigo-500/20',
      },
    ],
  },
];

// Flat menuItems for backward compatibility
const menuItems: MenuItem[] = menuGroups.flatMap(group => group.items);

export default function AdminDashboard({
  isFirstLogin,
  adminEmail,
  adminName = 'Admin',
  isSuperAdmin = false,
  role = 'Employee',
  allowedSections = [],
}: AdminDashboardProps) {
  const router = useRouter();
  
  // Check if user has access to a section
  const hasAccessToSection = (sectionId: string): boolean => {
    if (isSuperAdmin) return true;
    // Profile is always accessible for non-super-admin employees
    if (sectionId === 'profile' && !isSuperAdmin) return true;
    return allowedSections.includes(sectionId);
  };

  // Determine the initial section - use first allowed section if user doesn't have access to overview
  const getInitialSection = () => {
    if (isFirstLogin && hasAccessToSection('credentials')) return 'credentials';
    if (hasAccessToSection('overview')) return 'overview';
    // Find first accessible section
    return allowedSections[0] || 'overview';
  };

  const [activeSection, setActiveSection] = useState(getInitialSection());
  const [expandedMenus, setExpandedMenus] = useState<string[]>(['settings', 'dev-zone-menu']);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [serverTime, setServerTime] = useState(new Date());
  
  // Refresh keys for each section - increment to force refresh
  const [refreshKeys, setRefreshKeys] = useState<Record<string, number>>({});
  
  // Get current refresh key for active section
  const currentRefreshKey = refreshKeys[activeSection] || 0;
  
  // Trigger refresh for a specific section
  const triggerSectionRefresh = useCallback((section: string) => {
    setRefreshKeys(prev => ({
      ...prev,
      [section]: (prev[section] || 0) + 1,
    }));
  }, []);

  // Admin events subscription (polls every 30s) - toasts disabled to prevent spam
  const { isConnected: isEventConnected } = useAdminEvents({
    onEvent: (event) => {
      // Only log significant events, not routine updates
      if (event.type !== 'general_refresh') {
        console.log('📡 Received event for section:', event.section);
      }
      // Trigger refresh for the affected section
      triggerSectionRefresh(event.section);
      
      // Also refresh related sections
      if (event.section === 'users') {
        triggerSectionRefresh('badges');
      }
      if (event.section === 'financial' || event.section === 'pending-withdrawals') {
        triggerSectionRefresh('financial');
        triggerSectionRefresh('pending-withdrawals');
      }
    },
    showToasts: false, // Disabled - was causing spam notifications
  });

  // Alias for backward compatibility
  const hasAccess = hasAccessToSection;

  // Filter menu groups based on allowed sections
  const filteredMenuGroups = menuGroups
    .filter(group => {
      // My Account section: show for employees only, not super admin
      if (group.id === 'my-account') {
        return !isSuperAdmin;
      }
      return true;
    })
    .map(group => ({
      ...group,
      items: group.items
        .filter(item => {
          // Profile is always accessible for non-super-admin employees
          if (item.id === 'profile') {
            return !isSuperAdmin;
          }
          // If item has children, check if any child is accessible
          if (item.children) {
            return item.children.some(child => hasAccess(child.id));
          }
          // Otherwise check if the item itself is accessible
          return hasAccess(item.id);
        })
        .map(item => {
          // Filter children if they exist
          if (item.children) {
            return {
              ...item,
              children: item.children.filter(child => hasAccess(child.id)),
            };
          }
          return item;
        }),
    })).filter(group => group.items.length > 0);

  // Live server clock
  useEffect(() => {
    const timer = setInterval(() => {
      setServerTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Real-time session validation - checks every 10 seconds
  // This ensures force logout and suspension take effect immediately
  useEffect(() => {
    const checkSession = async () => {
      try {
        const response = await fetch('/api/auth/check-session');
        const data = await response.json();
        
        if (!data.valid) {
          console.log('⚠️ Session invalidated:', data.reason);
          
          // Show appropriate message based on reason
          if (data.reason === 'account_disabled') {
            toast.error('Your account has been suspended');
          } else if (data.reason === 'force_logout') {
            toast.error('You have been logged out by an administrator');
          } else if (data.reason === 'password_changed') {
            toast.error('Your password was changed. Please log in again.');
          } else {
            toast.error('Session expired. Please log in again.');
          }
          
          // Redirect to login
          router.push('/login');
        }
      } catch (error) {
        console.error('Session check failed:', error);
        // Don't redirect on network errors - let user continue working
      }
    };

    // Check immediately on mount
    checkSession();
    
    // Then check every 10 seconds
    const sessionCheckInterval = setInterval(checkSession, 10000);
    
    return () => clearInterval(sessionCheckInterval);
  }, [router]);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      toast.success('Logged out successfully');
      router.push('/login');
    } catch (error) {
      toast.error('Logout failed');
    }
  };

  const toggleMenu = (menuId: string) => {
    setExpandedMenus(prev => 
      prev.includes(menuId) 
        ? prev.filter(id => id !== menuId)
        : [...prev, menuId]
    );
  };

  const handleMenuClick = (item: MenuItem, childId?: string) => {
    if (item.children && !childId) {
      toggleMenu(item.id);
    } else {
      const targetSection = childId || item.id;
      // Check access before navigating
      if (!hasAccess(targetSection)) {
        toast.error('You do not have access to this section');
        return;
      }
      setActiveSection(targetSection);
      setMobileMenuOpen(false);
    }
  };

  const isActive = (itemId: string, childId?: string) => {
    if (childId) return activeSection === childId;
    for (const group of menuGroups) {
      const item = group.items.find(m => m.id === itemId);
      if (item?.children) {
        return item.children.some(c => c.id === activeSection);
      }
    }
    return activeSection === itemId;
  };

  const getPageTitle = () => {
    for (const group of menuGroups) {
      for (const item of group.items) {
        if (item.id === activeSection) return item.label;
        if (item.children) {
          const child = item.children.find(c => c.id === activeSection);
          if (child) return `${item.label} → ${child.label}`;
        }
      }
    }
    return 'Dashboard';
  };

  const renderContent = () => {
    // Check access before rendering content
    if (!hasAccess(activeSection)) {
      return (
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <Shield className="h-16 w-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-white mb-2">Access Denied</h2>
            <p className="text-gray-400 mb-4">
              You do not have permission to access this section.
            </p>
            <p className="text-sm text-gray-500">
              Contact your administrator if you believe this is an error.
            </p>
          </div>
        </div>
      );
    }

    // Pass key={currentRefreshKey} to force re-render when data changes
    switch (activeSection) {
      case 'overview':
        return <AdminOverviewDashboard key={currentRefreshKey} onNavigate={(section) => hasAccess(section) && setActiveSection(section)} />;
      case 'hero-page':
        return <LandingPageBuilder key={currentRefreshKey} />;
      case 'competitions':
        return <CompetitionsListSection key={currentRefreshKey} />;
      case 'challenges':
        return <ChallengeSettingsSection key={currentRefreshKey} />;
      case 'marketplace':
        return <MarketplaceSection key={currentRefreshKey} />;
      case 'users':
        return <UsersSection key={currentRefreshKey} />;
      case 'trading-history':
        return <TradingHistorySection key={currentRefreshKey} />;
      case 'financial':
        return <FinancialDashboard key={currentRefreshKey} />;
      case 'analytics':
        return <CompetitionAnalytics key={currentRefreshKey} />;
      case 'market':
        return <MarketSettingsSection key={currentRefreshKey} />;
      case 'symbols':
        return <SymbolsSection key={currentRefreshKey} />;
      case 'payments':
        return <PendingPaymentsSection key={currentRefreshKey} />;
      case 'failed-deposits':
        return <FailedDepositsSection key={currentRefreshKey} />;
      case 'withdrawals':
        return <WithdrawalSettingsSection key={currentRefreshKey} />;
      case 'pending-withdrawals':
        return <PendingWithdrawalsSection key={currentRefreshKey} />;
      case 'kyc-settings':
        return <KYCSettingsSection key={currentRefreshKey} />;
      case 'kyc-history':
        return <KYCHistorySection key={currentRefreshKey} />;
      case 'fraud':
        return <FraudMonitoringSection key={currentRefreshKey} />;
      case 'badges':
        return <BadgeXPManagementSection key={currentRefreshKey} />;
      case 'wiki':
        return <AdminWikiSection key={currentRefreshKey} />;
      case 'credentials':
        return <CredentialsSection key={currentRefreshKey} currentEmail={adminEmail} currentName={adminName} />;
      case 'environment':
        return <EnvironmentSection key={currentRefreshKey} />;
      case 'branding':
        return <ImagesSection key={currentRefreshKey} />;
      case 'company':
        return <CompanyDetailsSection key={currentRefreshKey} />;
      case 'invoices':
        return <InvoiceTemplateSection key={currentRefreshKey} />;
      case 'email-templates':
        return <EmailTemplatesSection key={currentRefreshKey} />;
      case 'notifications':
        return <NotificationSystemSection key={currentRefreshKey} />;
      case 'trading':
      case 'trading-risk':
        return <TradingRiskSection key={currentRefreshKey} />;
      case 'currency':
        return <CurrencySettingsSection key={currentRefreshKey} />;
      case 'fees':
        return <FeeSettingsSection key={currentRefreshKey} />;
      case 'payment-providers':
        return <PaymentProvidersSection key={currentRefreshKey} />;
      case 'redis':
        return <RedisSettingsSection key={currentRefreshKey} />;
      case 'database':
        return <DatabaseSection key={currentRefreshKey} />;
      case 'audit-logs':
        return <AuditLogSection key={currentRefreshKey} />;
      case 'dev-settings':
        return <DevSettingsSection key={currentRefreshKey} />;
      case 'performance-simulator':
        return <PerformanceSimulatorSection key={currentRefreshKey} />;
      case 'dependency-updates':
        return <DependencyUpdatesSection key={currentRefreshKey} />;
      case 'ai-agent':
        return <AIAgentSection key={currentRefreshKey} />;
      case 'employees':
        return <EmployeesSection key={currentRefreshKey} />;
      case 'customer-assignment':
        return <CustomerAssignmentSettings key={currentRefreshKey} />;
      case 'profile':
        return <EmployeeProfileSection key={currentRefreshKey} />;
      case 'messaging':
        return <MessagingSection key={currentRefreshKey} />;
      case 'messaging-settings':
        return <MessagingSettingsSection key={currentRefreshKey} />;
      default:
        return <CompetitionsListSection key={currentRefreshKey} />;
    }
  };

  // Render sidebar content as JSX variable (not a component) to prevent unmount/remount on state changes
  const sidebarContent = (
    <>
      {/* Logo */}
      <div className={cn(
        "flex items-center gap-3 px-4 py-6 border-b border-gray-700/50",
        sidebarCollapsed && "justify-center px-2"
      )}>
        <div className="relative shrink-0">
          <div className="absolute inset-0 bg-yellow-500 rounded-xl blur-md opacity-40"></div>
          <div className="relative h-10 w-10 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-xl flex items-center justify-center shadow-lg">
            <Shield className="h-5 w-5 text-gray-900" />
          </div>
        </div>
        {!sidebarCollapsed && (
          <div className="overflow-hidden">
            <h1 className="text-lg font-bold text-white truncate">Admin Panel</h1>
            <p className="text-xs text-gray-500 truncate">{adminName}</p>
            <div className="flex items-center gap-1">
              <span className={cn(
                "text-[10px] px-1.5 py-0.5 rounded font-medium",
                isSuperAdmin 
                  ? "bg-yellow-500/20 text-yellow-400" 
                  : "bg-purple-500/20 text-purple-400"
              )}>
                {role}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Quick Actions */}
      {!sidebarCollapsed && (
        <div className="px-4 py-4 border-b border-gray-700/50">
          <Link href="/competitions/create">
            <Button className="w-full bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-600 hover:to-amber-600 text-gray-900 font-semibold shadow-lg shadow-yellow-500/20">
              <Plus className="h-4 w-4 mr-2" />
              New Competition
            </Button>
          </Link>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-4">
        {filteredMenuGroups.map((group) => (
          <div key={group.id}>
            {/* Group Header */}
            {!sidebarCollapsed && (
              <div className="flex items-center gap-2 px-3 mb-2">
                <span className={cn("shrink-0", group.color)}>{group.icon}</span>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                  {group.label}
                </span>
              </div>
            )}
            
            {/* Group Items */}
            <div className="space-y-1">
              {group.items.map((item) => (
                <div key={item.id}>
                  <button
                    type="button"
                    onClick={() => handleMenuClick(item)}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group",
                      isActive(item.id) && !item.children
                        ? `${item.bgColor} ${item.color}`
                        : "text-gray-400 hover:text-white hover:bg-gray-800/50",
                      sidebarCollapsed && "justify-center px-2"
                    )}
                  >
                    <span className={cn(
                      "shrink-0 transition-colors",
                      isActive(item.id) ? item.color : "group-hover:text-white"
                    )}>
                      {item.icon}
                    </span>
                    {!sidebarCollapsed && (
                      <>
                        <span className="flex-1 text-left text-sm font-medium truncate">
                          {item.label}
                        </span>
                        {item.children && (
                          <span className="shrink-0">
                            {expandedMenus.includes(item.id) ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </span>
                        )}
                      </>
                    )}
                  </button>

                  {/* Submenu */}
                  {item.children && expandedMenus.includes(item.id) && !sidebarCollapsed && (
                    <div className="mt-1 ml-4 pl-4 border-l border-gray-700/50 space-y-1">
                      {item.children.map((child) => (
                        <button
                          type="button"
                          key={child.id}
                          onClick={() => handleMenuClick(item, child.id)}
                          className={cn(
                            "w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 text-sm",
                            activeSection === child.id
                              ? "bg-purple-500/20 text-purple-400"
                              : "text-gray-500 hover:text-gray-300 hover:bg-gray-800/30"
                          )}
                        >
                          <span className="shrink-0">{child.icon}</span>
                          <span className="truncate">{child.label}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className={cn(
        "p-4 border-t border-gray-700/50",
        sidebarCollapsed && "px-2"
      )}>
        <button
          type="button"
          onClick={handleLogout}
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-red-400 hover:bg-red-500/10 transition-all duration-200",
            sidebarCollapsed && "justify-center px-2"
          )}
        >
          <LogOut className="h-5 w-5 shrink-0" />
          {!sidebarCollapsed && <span className="text-sm font-medium">Logout</span>}
        </button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-gray-900 flex">
      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar - Desktop */}
      <aside className={cn(
        "hidden lg:flex flex-col fixed left-0 top-0 bottom-0 bg-gray-800/95 backdrop-blur-xl border-r border-gray-700/50 z-30 transition-all duration-300",
        sidebarCollapsed ? "w-20" : "w-64"
      )}>
        {sidebarContent}
        
        {/* Collapse Button */}
        <button
          type="button"
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className="absolute -right-3 top-20 h-6 w-6 bg-gray-700 hover:bg-gray-600 rounded-full flex items-center justify-center border border-gray-600 shadow-lg transition-colors"
        >
          <ChevronRight className={cn(
            "h-4 w-4 text-gray-300 transition-transform",
            sidebarCollapsed ? "" : "rotate-180"
          )} />
        </button>
      </aside>

      {/* Sidebar - Mobile */}
      <aside className={cn(
        "lg:hidden fixed left-0 top-0 bottom-0 w-72 bg-gray-800/98 backdrop-blur-xl border-r border-gray-700/50 z-50 transform transition-transform duration-300 flex flex-col",
        mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        {sidebarContent}
      </aside>

      {/* Main Content */}
      <div className={cn(
        "flex-1 flex flex-col min-h-screen transition-all duration-300",
        sidebarCollapsed ? "lg:ml-20" : "lg:ml-64"
      )}>
        {/* Top Header */}
        <header className="sticky top-0 z-20 bg-gray-900/80 backdrop-blur-xl border-b border-gray-700/50">
          <div className="flex items-center justify-between h-16 px-4 lg:px-6">
            {/* Left */}
            <div className="flex items-center gap-4">
              {/* Mobile Menu Button */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="lg:hidden p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
              >
                {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
              
              {/* Page Title */}
              <div>
                <h1 className="text-xl font-bold text-white">{getPageTitle()}</h1>
              </div>
            </div>

            {/* Right */}
            <div className="flex items-center gap-3">
              {/* Auto Sync Indicator */}
              <div 
                className="hidden lg:flex items-center gap-2 px-3 py-2 rounded-xl border bg-emerald-500/10 border-emerald-500/30"
                title="Auto-sync active - data refreshes every 30 seconds"
              >
                <Wifi className="h-4 w-4 text-emerald-400" />
                <span className="text-[10px] uppercase tracking-wider text-emerald-400/80">
                  Auto Sync
                </span>
              </div>

              {/* Live Server Clock */}
              <div className="hidden lg:flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border border-cyan-500/30">
                <Clock className="h-4 w-4 text-cyan-400" />
                <div className="flex flex-col">
                  <span className="text-[10px] text-cyan-400/80 uppercase tracking-wider">Server UTC</span>
                  <span className="font-mono text-lg font-bold text-cyan-300">
                    {serverTime.getUTCHours().toString().padStart(2, '0')}
                    <span className="animate-pulse">:</span>
                    {serverTime.getUTCMinutes().toString().padStart(2, '0')}
                    <span className="animate-pulse">:</span>
                    {serverTime.getUTCSeconds().toString().padStart(2, '0')}
                  </span>
                </div>
              </div>

              {/* Search (Desktop) */}
              <div className="hidden md:flex items-center bg-gray-800/50 rounded-lg px-3 py-2 border border-gray-700/50">
                <Search className="h-4 w-4 text-gray-500 mr-2" />
                <input
                  type="text"
                  placeholder="Search..."
                  className="bg-transparent border-none outline-none text-sm text-gray-300 placeholder-gray-500 w-48"
                />
              </div>
              
              {/* Quick Create (Desktop) */}
              <Link href="/competitions/create" className="hidden sm:block">
                <Button size="sm" className="bg-yellow-500 hover:bg-yellow-600 text-gray-900 font-semibold">
                  <Plus className="h-4 w-4 mr-1" />
                  Create
                </Button>
              </Link>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-4 lg:p-6 overflow-auto">
          <div className="max-w-[1600px] mx-auto">
            {renderContent()}
          </div>
        </main>
      </div>
    </div>
  );
}
