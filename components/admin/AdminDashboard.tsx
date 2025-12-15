'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
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
} from 'lucide-react';
import { toast } from 'sonner';
import CredentialsSection from '@/components/admin/CredentialsSection';
import EnvironmentSection from '@/components/admin/EnvironmentSection';
import ImagesSection from '@/components/admin/ImagesSection';
import TradingRiskSection from '@/components/admin/TradingRiskSection';
import CurrencySettingsSection from '@/components/admin/CurrencySettingsSection';
import FinancialDashboard from '@/components/admin/FinancialDashboard';
import CompetitionAnalytics from '@/components/admin/CompetitionAnalytics';
import CompetitionsListSection from '@/components/admin/CompetitionsListSection';
import ChallengeSettingsSection from '@/components/admin/ChallengeSettingsSection';
import DatabaseSection from '@/components/admin/DatabaseSection';
import UsersSection from '@/components/admin/UsersSection';
import PaymentProvidersSection from '@/components/admin/PaymentProvidersSection';
import PendingPaymentsSection from '@/components/admin/PendingPaymentsSection';
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

interface AdminDashboardProps {
  isFirstLogin: boolean;
  adminEmail: string;
  adminName?: string;
}

interface MenuItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  children?: { id: string; label: string; icon: React.ReactNode }[];
}

const menuItems: MenuItem[] = [
  {
    id: 'hero-page',
    label: 'Hero Page',
    icon: <Home className="h-5 w-5" />,
    color: 'text-yellow-400',
    bgColor: 'bg-yellow-500/10 hover:bg-yellow-500/20',
  },
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
    id: 'marketplace',
    label: 'Marketplace',
    icon: <ShoppingBag className="h-5 w-5" />,
    color: 'text-fuchsia-400',
    bgColor: 'bg-fuchsia-500/10 hover:bg-fuchsia-500/20',
  },
  {
    id: 'users',
    label: 'Users',
    icon: <Users className="h-5 w-5" />,
    color: 'text-cyan-400',
    bgColor: 'bg-cyan-500/10 hover:bg-cyan-500/20',
  },
  {
    id: 'financial',
    label: 'Financial',
    icon: <DollarSign className="h-5 w-5" />,
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/10 hover:bg-emerald-500/20',
  },
  {
    id: 'analytics',
    label: 'Analytics',
    icon: <BarChart3 className="h-5 w-5" />,
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10 hover:bg-blue-500/20',
  },
  {
    id: 'payments',
    label: 'Payments',
    icon: <CreditCard className="h-5 w-5" />,
    color: 'text-yellow-400',
    bgColor: 'bg-yellow-500/10 hover:bg-yellow-500/20',
  },
  {
    id: 'fraud',
    label: 'Fraud Detection',
    icon: <AlertTriangle className="h-5 w-5" />,
    color: 'text-red-400',
    bgColor: 'bg-red-500/10 hover:bg-red-500/20',
  },
  {
    id: 'badges',
    label: 'Badges & XP',
    icon: <Award className="h-5 w-5" />,
    color: 'text-pink-400',
    bgColor: 'bg-pink-500/10 hover:bg-pink-500/20',
  },
  {
    id: 'wiki',
    label: 'Documentation',
    icon: <BookOpen className="h-5 w-5" />,
    color: 'text-indigo-400',
    bgColor: 'bg-indigo-500/10 hover:bg-indigo-500/20',
  },
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
      { id: 'trading', label: 'Trading Risk', icon: <Gauge className="h-4 w-4" /> },
      { id: 'currency', label: 'Currency', icon: <Coins className="h-4 w-4" /> },
      { id: 'fees', label: 'Fees', icon: <DollarSign className="h-4 w-4" /> },
      { id: 'payment-providers', label: 'Payment Providers', icon: <CreditCard className="h-4 w-4" /> },
      { id: 'database', label: 'Database', icon: <Database className="h-4 w-4" /> },
      { id: 'audit-logs', label: 'Audit Logs', icon: <ScrollText className="h-4 w-4" /> },
    ],
  },
];

export default function AdminDashboard({
  isFirstLogin,
  adminEmail,
  adminName = 'Admin',
}: AdminDashboardProps) {
  const router = useRouter();
  const [activeSection, setActiveSection] = useState(isFirstLogin ? 'credentials' : 'competitions');
  const [expandedMenus, setExpandedMenus] = useState<string[]>(['settings']);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    try {
      await fetch('/api/admin/auth/logout', { method: 'POST' });
      toast.success('Logged out successfully');
      router.push('/admin/login');
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
      setActiveSection(childId || item.id);
      setMobileMenuOpen(false);
    }
  };

  const isActive = (itemId: string, childId?: string) => {
    if (childId) return activeSection === childId;
    const item = menuItems.find(m => m.id === itemId);
    if (item?.children) {
      return item.children.some(c => c.id === activeSection);
    }
    return activeSection === itemId;
  };

  const getPageTitle = () => {
    for (const item of menuItems) {
      if (item.id === activeSection) return item.label;
      if (item.children) {
        const child = item.children.find(c => c.id === activeSection);
        if (child) return `Settings → ${child.label}`;
      }
    }
    return 'Dashboard';
  };

  const renderContent = () => {
    switch (activeSection) {
      case 'hero-page':
        return <LandingPageBuilder />;
      case 'competitions':
        return <CompetitionsListSection />;
      case 'challenges':
        return <ChallengeSettingsSection />;
      case 'marketplace':
        return <MarketplaceSection />;
      case 'users':
        return <UsersSection />;
      case 'financial':
        return <FinancialDashboard />;
      case 'analytics':
        return <CompetitionAnalytics />;
      case 'payments':
        return <PendingPaymentsSection />;
      case 'fraud':
        return <FraudMonitoringSection />;
      case 'badges':
        return <BadgeXPManagementSection />;
      case 'wiki':
        return <AdminWikiSection />;
      case 'credentials':
        return <CredentialsSection currentEmail={adminEmail} currentName={adminName} />;
      case 'environment':
        return <EnvironmentSection />;
      case 'branding':
        return <ImagesSection />;
      case 'company':
        return <CompanyDetailsSection />;
      case 'invoices':
        return <InvoiceTemplateSection />;
      case 'email-templates':
        return <EmailTemplatesSection />;
      case 'notifications':
        return <NotificationSystemSection />;
      case 'trading':
        return <TradingRiskSection />;
      case 'currency':
        return <CurrencySettingsSection />;
      case 'fees':
        return <FeeSettingsSection />;
      case 'payment-providers':
        return <PaymentProvidersSection />;
      case 'database':
        return <DatabaseSection />;
      case 'audit-logs':
        return <AuditLogSection />;
      default:
        return <CompetitionsListSection />;
    }
  };

  const SidebarContent = () => (
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
            <p className="text-[10px] text-gray-600 truncate">{adminEmail}</p>
          </div>
        )}
      </div>

      {/* Quick Actions */}
      {!sidebarCollapsed && (
        <div className="px-4 py-4 border-b border-gray-700/50">
          <Link href="/admin/competitions/create">
            <Button className="w-full bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-600 hover:to-amber-600 text-gray-900 font-semibold shadow-lg shadow-yellow-500/20">
              <Plus className="h-4 w-4 mr-2" />
              New Competition
            </Button>
          </Link>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
        {menuItems.map((item) => (
          <div key={item.id}>
            <button
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
      </nav>

      {/* Footer */}
      <div className={cn(
        "p-4 border-t border-gray-700/50",
        sidebarCollapsed && "px-2"
      )}>
        <button
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
        <SidebarContent />
        
        {/* Collapse Button */}
        <button
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
        <SidebarContent />
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
              <Link href="/admin/competitions/create" className="hidden sm:block">
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
