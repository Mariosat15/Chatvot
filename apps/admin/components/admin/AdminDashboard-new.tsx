'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Shield, LogOut, Trophy, Plus, DollarSign, BarChart3, Settings as SettingsIcon, Database } from 'lucide-react';
import { toast } from 'sonner';
import CredentialsSection from '@/components/admin/CredentialsSection';
import EnvironmentSection from '@/components/admin/EnvironmentSection';
import ImagesSection from '@/components/admin/ImagesSection';
import TradingRiskSection from '@/components/admin/TradingRiskSection';
import CurrencySettingsSection from '@/components/admin/CurrencySettingsSection';
import FinancialDashboard from '@/components/admin/FinancialDashboard';
import CompetitionAnalytics from '@/components/admin/CompetitionAnalytics';
import CompetitionsListSection from '@/components/admin/CompetitionsListSection';
import DatabaseSection from '@/components/admin/DatabaseSection';

interface AdminDashboardProps {
  isFirstLogin: boolean;
  adminEmail: string;
}

export default function AdminDashboard({
  isFirstLogin,
  adminEmail,
}: AdminDashboardProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState(isFirstLogin ? 'credentials' : 'competitions');
  const [settingsTab, setSettingsTab] = useState('general');

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      toast.success('Logged out successfully');
      router.push('/login');
    } catch (error) {
      toast.error('Logout failed');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-900 to-gray-800">
      {/* Header */}
      <header className="bg-gradient-to-r from-gray-800 via-gray-800 to-gray-700 border-b border-gray-700/50 shadow-2xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="absolute inset-0 bg-yellow-500 rounded-xl blur-lg opacity-50"></div>
                <div className="relative h-12 w-12 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-xl flex items-center justify-center shadow-xl">
                  <Shield className="h-6 w-6 text-gray-900" />
                </div>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">Admin Panel</h1>
                <p className="text-sm text-gray-400">{adminEmail}</p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3">
              <Link href="/competitions/create">
                <Button
                  variant="outline"
                  className="bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 text-gray-900 border-0 font-bold shadow-lg shadow-yellow-500/50 transition-all duration-300 hover:shadow-xl hover:shadow-yellow-500/70"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Create Competition
                </Button>
              </Link>

              <Button
                onClick={handleLogout}
                variant="outline"
                className="bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white border-0 font-semibold shadow-lg shadow-red-500/50 transition-all duration-300 hover:shadow-xl hover:shadow-red-500/70"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          {/* Main Navigation */}
          <div className="bg-gradient-to-r from-gray-800 to-gray-700 rounded-2xl p-2 shadow-xl border border-gray-600">
            <TabsList className="w-full bg-transparent gap-2 h-auto p-0">
              <TabsTrigger
                value="competitions"
                className="flex-1 data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-500 data-[state=active]:to-orange-600 data-[state=active]:text-white rounded-xl py-3 px-6"
              >
                <Trophy className="h-4 w-4 mr-2" />
                Competitions
              </TabsTrigger>
              <TabsTrigger
                value="financial"
                className="flex-1 data-[state=active]:bg-gradient-to-r data-[state=active]:from-green-500 data-[state=active]:to-green-600 data-[state=active]:text-white rounded-xl py-3 px-6"
              >
                <DollarSign className="h-4 w-4 mr-2" />
                Financial
              </TabsTrigger>
              <TabsTrigger
                value="analytics"
                className="flex-1 data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-blue-600 data-[state=active]:text-white rounded-xl py-3 px-6"
              >
                <BarChart3 className="h-4 w-4 mr-2" />
                Analytics
              </TabsTrigger>
              <TabsTrigger
                value="settings"
                className="flex-1 data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-500 data-[state=active]:to-purple-600 data-[state=active]:text-white rounded-xl py-3 px-6"
              >
                <SettingsIcon className="h-4 w-4 mr-2" />
                Settings
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Tab Content */}
          <div className="mt-6">
            {/* Competitions Tab */}
            <TabsContent value="competitions">
              <div className="space-y-6">
                <div className="bg-gradient-to-br from-gray-800 to-gray-900 border border-orange-500/50 rounded-2xl shadow-2xl shadow-orange-500/10 overflow-hidden">
                  <div className="bg-gradient-to-r from-orange-500 to-orange-600 p-8">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="relative">
                          <div className="absolute inset-0 bg-yellow-500 rounded-xl blur-lg opacity-50"></div>
                          <div className="relative h-16 w-16 bg-white rounded-xl flex items-center justify-center shadow-xl">
                            <Trophy className="h-8 w-8 text-orange-500" />
                          </div>
                        </div>
                        <div>
                          <h2 className="text-3xl font-bold text-white flex items-center gap-2">
                            Competition Management
                          </h2>
                          <p className="text-orange-100 mt-1">
                            View, edit, and manage all trading competitions
                          </p>
                        </div>
                      </div>
                      <Link href="/competitions/create">
                        <Button className="bg-white hover:bg-gray-100 text-orange-600 font-bold shadow-xl h-12 px-6 transition-all hover:scale-105">
                          <Plus className="h-5 w-5 mr-2" />
                          Create New Competition
                        </Button>
                      </Link>
                    </div>
                  </div>
                </div>
                <CompetitionsListSection />
              </div>
            </TabsContent>

            {/* Financial Tab */}
            <TabsContent value="financial">
              <FinancialDashboard />
            </TabsContent>

            {/* Analytics Tab */}
            <TabsContent value="analytics">
              <CompetitionAnalytics />
            </TabsContent>

            {/* Settings Tab */}
            <TabsContent value="settings">
              <Tabs value={settingsTab} onValueChange={setSettingsTab} className="space-y-6">
                {/* Settings Sub-Navigation */}
                <div className="bg-gradient-to-r from-purple-800/50 to-purple-700/50 rounded-xl p-2 border border-purple-500/30">
                  <TabsList className="w-full bg-transparent gap-2 h-auto p-0 flex-wrap">
                    <TabsTrigger
                      value="general"
                      className="data-[state=active]:bg-purple-500 data-[state=active]:text-white rounded-lg py-2 px-4"
                    >
                      Credentials
                    </TabsTrigger>
                    <TabsTrigger
                      value="environment"
                      className="data-[state=active]:bg-purple-500 data-[state=active]:text-white rounded-lg py-2 px-4"
                    >
                      Environment
                    </TabsTrigger>
                    <TabsTrigger
                      value="branding"
                      className="data-[state=active]:bg-purple-500 data-[state=active]:text-white rounded-lg py-2 px-4"
                    >
                      Branding
                    </TabsTrigger>
                    <TabsTrigger
                      value="trading"
                      className="data-[state=active]:bg-purple-500 data-[state=active]:text-white rounded-lg py-2 px-4"
                    >
                      Trading Risk
                    </TabsTrigger>
                    <TabsTrigger
                      value="currency"
                      className="data-[state=active]:bg-purple-500 data-[state=active]:text-white rounded-lg py-2 px-4"
                    >
                      Currency
                    </TabsTrigger>
                    <TabsTrigger
                      value="database"
                      className="data-[state=active]:bg-red-500 data-[state=active]:text-white rounded-lg py-2 px-4"
                    >
                      <Database className="h-4 w-4 mr-2" />
                      Database
                    </TabsTrigger>
                  </TabsList>
                </div>

                {/* Settings Sub-Content */}
                <TabsContent value="general">
                  <CredentialsSection currentEmail={adminEmail} />
                </TabsContent>

                <TabsContent value="environment">
                  <EnvironmentSection />
                </TabsContent>

                <TabsContent value="branding">
                  <ImagesSection />
                </TabsContent>

                <TabsContent value="trading">
                  <TradingRiskSection />
                </TabsContent>

                <TabsContent value="currency">
                  <CurrencySettingsSection />
                </TabsContent>

                <TabsContent value="database">
                  <DatabaseSection />
                </TabsContent>
              </Tabs>
            </TabsContent>
          </div>
        </Tabs>
      </main>
    </div>
  );
}

