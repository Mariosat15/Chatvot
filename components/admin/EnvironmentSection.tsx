'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Save, Eye, EyeOff, RefreshCw, Settings, Globe, Mail, Key, Database, Shield, AlertCircle, Server, Lock } from 'lucide-react';

export default function EnvironmentSection() {
  const [formData, setFormData] = useState({
    // General
    nodeEnv: 'development',
    nextPublicBaseUrl: '',
    
    // Email
    nodemailerEmail: '',
    nodemailerPassword: '',
    
    // API Keys & URLs
    geminiApiKey: '',
    massiveApiKey: '',
    nextPublicMassiveApiKey: '',
    
    // Database
    mongodbUri: '',
    
    // Authentication
    betterAuthSecret: '',
    betterAuthUrl: '',
  });
  
  const [showPasswords, setShowPasswords] = useState({
    nodemailerPassword: false,
    geminiApiKey: false,
    massiveApiKey: false,
    nextPublicMassiveApiKey: false,
    mongodbUri: false,
    betterAuthSecret: false,
  });
  
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setIsFetching(true);
    try {
      const response = await fetch('/api/admin/environment');
      if (response.ok) {
        const data = await response.json();
        setFormData(data);
      }
    } catch (error) {
      toast.error('Failed to load settings');
    } finally {
      setIsFetching(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await fetch('/api/admin/environment', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success('Environment variables updated successfully');
        toast.info('Restart your application for changes to take effect');
      } else {
        toast.error(data.error || 'Update failed');
      }
    } catch (error) {
      toast.error('An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const togglePasswordVisibility = (field: keyof typeof showPasswords) => {
    setShowPasswords((prev) => ({ ...prev, [field]: !prev[field] }));
  };

  if (isFetching) {
    return (
      <div className="bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700 rounded-2xl p-6">
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="h-8 w-8 text-blue-400 animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="bg-gradient-to-br from-gray-800 to-gray-900 border border-blue-500/50 rounded-2xl shadow-2xl shadow-blue-500/10 overflow-hidden">
        <div className="bg-gradient-to-r from-blue-500 to-blue-600 p-8">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="absolute inset-0 bg-white rounded-xl blur-lg opacity-50"></div>
              <div className="relative h-16 w-16 bg-white rounded-xl flex items-center justify-center shadow-xl">
                <Settings className="h-8 w-8 text-blue-600" />
              </div>
            </div>
            <div>
              <h2 className="text-3xl font-bold text-white flex items-center gap-2">
                Environment Variables
              </h2>
              <p className="text-blue-100 mt-1">
                Configure all application settings, API keys, and integrations
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Form with Tabs */}
      <div className="bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700 rounded-2xl shadow-xl overflow-hidden">
        <form onSubmit={handleSubmit}>
          <Tabs defaultValue="general" className="w-full">
            <div className="bg-gray-800/50 border-b border-gray-700 px-6 pt-6">
              <TabsList className="bg-transparent w-full justify-start gap-2">
                <TabsTrigger 
                  value="general" 
                  className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-green-500 data-[state=active]:to-green-600 data-[state=active]:text-white data-[state=inactive]:text-gray-400"
                >
                  <Globe className="h-4 w-4 mr-2" />
                  General
                </TabsTrigger>
                <TabsTrigger 
                  value="email"
                  className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-500 data-[state=active]:to-purple-600 data-[state=active]:text-white data-[state=inactive]:text-gray-400"
                >
                  <Mail className="h-4 w-4 mr-2" />
                  Email
                </TabsTrigger>
                <TabsTrigger 
                  value="apis"
                  className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-500 data-[state=active]:to-orange-600 data-[state=active]:text-white data-[state=inactive]:text-gray-400"
                >
                  <Key className="h-4 w-4 mr-2" />
                  API Keys
                </TabsTrigger>
                <TabsTrigger 
                  value="database"
                  className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-cyan-500 data-[state=active]:to-cyan-600 data-[state=active]:text-white data-[state=inactive]:text-gray-400"
                >
                  <Database className="h-4 w-4 mr-2" />
                  Database
                </TabsTrigger>
                <TabsTrigger 
                  value="auth"
                  className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-red-500 data-[state=active]:to-red-600 data-[state=active]:text-white data-[state=inactive]:text-gray-400"
                >
                  <Shield className="h-4 w-4 mr-2" />
                  Auth
                </TabsTrigger>
              </TabsList>
            </div>

            <div className="p-8">
              <TabsContent value="general" className="mt-0">
                <div className="space-y-6">
                  <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
                    <h3 className="text-lg font-semibold text-gray-100 mb-4 flex items-center gap-2">
                      <Globe className="h-5 w-5 text-green-400" />
                      General Settings
                    </h3>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="nodeEnv" className="text-gray-300 flex items-center gap-2 mb-2">
                          <Settings className="h-4 w-4 text-green-400" />
                          Node Environment
                        </Label>
                        <Select
                          value={formData.nodeEnv}
                          onValueChange={(value) =>
                            setFormData({ ...formData, nodeEnv: value })
                          }
                        >
                          <SelectTrigger className="bg-gray-800 border-gray-600 text-gray-100 h-11">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="development">Development</SelectItem>
                            <SelectItem value="production">Production</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label htmlFor="nextPublicBaseUrl" className="text-gray-300 flex items-center gap-2 mb-2">
                          <Globe className="h-4 w-4 text-green-400" />
                          Base URL (Public)
                        </Label>
                        <Input
                          id="nextPublicBaseUrl"
                          type="url"
                          value={formData.nextPublicBaseUrl}
                          onChange={(e) =>
                            setFormData({ ...formData, nextPublicBaseUrl: e.target.value })
                          }
                          className="bg-gray-800 border-gray-600 text-gray-100 h-11"
                          placeholder="http://localhost:3000"
                        />
                        <p className="text-xs text-gray-500 mt-2">The public URL where your application is hosted</p>
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="email" className="mt-0">

                <div className="space-y-6">
                  <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
                    <h3 className="text-lg font-semibold text-gray-100 mb-4 flex items-center gap-2">
                      <Mail className="h-5 w-5 text-purple-400" />
                      Email Configuration (Nodemailer)
                    </h3>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="nodemailerEmail" className="text-gray-300 flex items-center gap-2 mb-2">
                          <Mail className="h-4 w-4 text-purple-400" />
                          Email Address
                        </Label>
                        <Input
                          id="nodemailerEmail"
                          type="email"
                          value={formData.nodemailerEmail}
                          onChange={(e) =>
                            setFormData({ ...formData, nodemailerEmail: e.target.value })
                          }
                          className="bg-gray-800 border-gray-600 text-gray-100 h-11"
                          placeholder="your-email@gmail.com"
                        />
                        <p className="text-xs text-gray-500 mt-2">Gmail account for sending emails</p>
                      </div>

                      <div>
                        <Label htmlFor="nodemailerPassword" className="text-gray-300 flex items-center gap-2 mb-2">
                          <Key className="h-4 w-4 text-purple-400" />
                          App Password
                        </Label>
                        <div className="relative">
                          <Input
                            id="nodemailerPassword"
                            type={showPasswords.nodemailerPassword ? 'text' : 'password'}
                            value={formData.nodemailerPassword}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                nodemailerPassword: e.target.value,
                              })
                            }
                            className="bg-gray-800 border-gray-600 text-gray-100 h-11 pr-10"
                            placeholder="Gmail app-specific password"
                          />
                          <button
                            type="button"
                            onClick={() => togglePasswordVisibility('nodemailerPassword')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-300"
                          >
                            {showPasswords.nodemailerPassword ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                        <p className="text-xs text-gray-500 mt-2">Generate this in Google Account settings → Security → App passwords</p>
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="apis" className="mt-0">

                <div className="space-y-6">
                  {/* Notice */}
                  <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 flex items-start gap-3">
                    <Lock className="h-5 w-5 text-yellow-500 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-sm font-semibold text-yellow-500 mb-1">Read-Only Credentials</h4>
                      <p className="text-sm text-gray-300">
                        API credentials shown here are <strong>read-only</strong>. 
                        Payment provider credentials (Stripe, Clerk, etc.) are managed in the <strong>Payment Providers</strong> tab.
                        To edit other credentials, update them directly in your <code className="bg-gray-800 px-2 py-1 rounded text-xs">.env</code> file.
                      </p>
                    </div>
                  </div>

                  <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
                    <h3 className="text-lg font-semibold text-gray-100 mb-4 flex items-center gap-2">
                      <Key className="h-5 w-5 text-orange-400" />
                      API Keys & URLs (Read-Only)
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Gemini API Key */}
                      <div className="md:col-span-2">
                        <Label htmlFor="geminiApiKey" className="text-gray-300 flex items-center gap-2 mb-2">
                          <Key className="h-4 w-4 text-orange-400" />
                          Gemini API Key
                        </Label>
                        <div className="relative">
                          <Input
                            id="geminiApiKey"
                            type={showPasswords.geminiApiKey ? 'text' : 'password'}
                            value={formData.geminiApiKey}
                            disabled
                            className="bg-gray-900 border-gray-700 text-gray-400 h-11 pr-10 cursor-not-allowed"
                            placeholder="Managed in Payment Providers"
                          />
                          <button
                            type="button"
                            onClick={() => togglePasswordVisibility('geminiApiKey')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-300"
                          >
                            {showPasswords.geminiApiKey ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      </div>

                      {/* Massive API Key */}
                      <div>
                        <Label htmlFor="massiveApiKey" className="text-gray-300 flex items-center gap-2 mb-2">
                          <Key className="h-4 w-4 text-orange-400" />
                          Massive API Key
                        </Label>
                        <div className="relative">
                          <Input
                            id="massiveApiKey"
                            type={showPasswords.massiveApiKey ? 'text' : 'password'}
                            value={formData.massiveApiKey}
                            disabled
                            className="bg-gray-900 border-gray-700 text-gray-400 h-11 pr-10 cursor-not-allowed"
                            placeholder="Managed in Payment Providers"
                          />
                          <button
                            type="button"
                            onClick={() => togglePasswordVisibility('massiveApiKey')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-300"
                          >
                            {showPasswords.massiveApiKey ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      </div>

                      <div>
                        <Label htmlFor="nextPublicMassiveApiKey" className="text-gray-300 flex items-center gap-2 mb-2">
                          <Key className="h-4 w-4 text-orange-400" />
                          Massive API Key (Public)
                        </Label>
                        <div className="relative">
                          <Input
                            id="nextPublicMassiveApiKey"
                            type={showPasswords.nextPublicMassiveApiKey ? 'text' : 'password'}
                            value={formData.nextPublicMassiveApiKey}
                            disabled
                            className="bg-gray-900 border-gray-700 text-gray-400 h-11 pr-10 cursor-not-allowed"
                            placeholder="Managed in Payment Providers"
                          />
                          <button
                            type="button"
                            onClick={() => togglePasswordVisibility('nextPublicMassiveApiKey')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-300"
                          >
                            {showPasswords.nextPublicMassiveApiKey ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="database" className="mt-0">
                <div className="space-y-6">
                  <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
                    <h3 className="text-lg font-semibold text-gray-100 mb-4 flex items-center gap-2">
                      <Database className="h-5 w-5 text-cyan-400" />
                      MongoDB Configuration
                    </h3>
                    <div>
                      <Label htmlFor="mongodbUri" className="text-gray-300 flex items-center gap-2 mb-2">
                        <Database className="h-4 w-4 text-cyan-400" />
                        MongoDB Connection String
                      </Label>
                      <div className="relative">
                        <Input
                          id="mongodbUri"
                          type={showPasswords.mongodbUri ? 'text' : 'password'}
                          value={formData.mongodbUri}
                          onChange={(e) =>
                            setFormData({ ...formData, mongodbUri: e.target.value })
                          }
                          className="bg-gray-800 border-gray-600 text-gray-100 h-11 pr-10"
                          placeholder="mongodb+srv://username:password@cluster.mongodb.net/dbname"
                        />
                        <button
                          type="button"
                          onClick={() => togglePasswordVisibility('mongodbUri')}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-300"
                        >
                          {showPasswords.mongodbUri ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                      <p className="text-xs text-gray-500 mt-2">Your MongoDB Atlas connection string</p>
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="auth" className="mt-0">
                <div className="space-y-6">
                  <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
                    <h3 className="text-lg font-semibold text-gray-100 mb-4 flex items-center gap-2">
                      <Shield className="h-5 w-5 text-red-400" />
                      Better Auth Configuration
                    </h3>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="betterAuthSecret" className="text-gray-300 flex items-center gap-2 mb-2">
                          <Key className="h-4 w-4 text-red-400" />
                          Better Auth Secret
                        </Label>
                        <div className="relative">
                          <Input
                            id="betterAuthSecret"
                            type={showPasswords.betterAuthSecret ? 'text' : 'password'}
                            value={formData.betterAuthSecret}
                            onChange={(e) =>
                              setFormData({ ...formData, betterAuthSecret: e.target.value })
                            }
                            className="bg-gray-800 border-gray-600 text-gray-100 h-11 pr-10"
                            placeholder="Random secret string for authentication"
                          />
                          <button
                            type="button"
                            onClick={() => togglePasswordVisibility('betterAuthSecret')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-300"
                          >
                            {showPasswords.betterAuthSecret ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      </div>

                      <div>
                        <Label htmlFor="betterAuthUrl" className="text-gray-300 flex items-center gap-2 mb-2">
                          <Globe className="h-4 w-4 text-red-400" />
                          Better Auth URL
                        </Label>
                        <Input
                          id="betterAuthUrl"
                          type="url"
                          value={formData.betterAuthUrl}
                          onChange={(e) =>
                            setFormData({ ...formData, betterAuthUrl: e.target.value })
                          }
                          className="bg-gray-800 border-gray-600 text-gray-100 h-11"
                          placeholder="http://localhost:3000"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>
            </div>

            {/* Warning & Save Button */}
            <div className="p-8 bg-gray-800/30 border-t border-gray-700 space-y-6">
              <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-yellow-400 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-semibold text-yellow-400">Important</h4>
                    <p className="text-xs text-gray-400 mt-1">
                      After saving changes, you must restart your application for the new environment variables to take effect.
                    </p>
                  </div>
                </div>
              </div>

              <Button
                type="submit"
                disabled={isLoading}
                className="w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-bold h-14 text-lg shadow-lg shadow-blue-500/50"
              >
                <Save className="h-5 w-5 mr-2" />
                {isLoading ? 'Saving Changes...' : 'Save All Environment Variables'}
              </Button>
            </div>
          </Tabs>
        </form>
      </div>
    </div>
  );
}
