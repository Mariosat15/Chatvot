'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import {
  Shield,
  Save,
  RefreshCw,
  AlertTriangle,
  Settings,
  Key,
  Clock,
  FileText,
  Globe,
  CheckCircle,
  XCircle,
  MessageSquare,
  Info,
  Eye,
  EyeOff,
  ExternalLink,
  Plug,
  TestTube,
  Loader2,
  Copy,
  Check,
  Search,
  Users,
  Fingerprint,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';

interface KYCSettings {
  enabled: boolean;
  requiredForWithdrawal: boolean;
  requiredForDeposit: boolean;
  requiredAmount: number;
  veriffApiKey: string;
  veriffApiSecret: string;
  veriffBaseUrl: string;
  allowedDocumentTypes: string[];
  allowedCountries: string[];
  autoApproveOnSuccess: boolean;
  autoSuspendOnFail: boolean;
  maxVerificationAttempts: number;
  sessionExpiryMinutes: number;
  verificationValidDays: number;
  kycRequiredMessage: string;
  kycPendingMessage: string;
  kycApprovedMessage: string;
  kycDeclinedMessage: string;
}

const DOCUMENT_TYPES = [
  { value: 'PASSPORT', label: 'Passport' },
  { value: 'ID_CARD', label: 'ID Card' },
  { value: 'DRIVERS_LICENSE', label: "Driver's License" },
  { value: 'RESIDENCE_PERMIT', label: 'Residence Permit' },
];

export default function KYCSettingsSection() {
  const [settings, setSettings] = useState<KYCSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showApiSecret, setShowApiSecret] = useState(false);
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const [testing, setTesting] = useState(false);
  const [copiedWebhook, setCopiedWebhook] = useState(false);
  
  // Temporary state for provider config dialog
  const [tempApiKey, setTempApiKey] = useState('');
  const [tempApiSecret, setTempApiSecret] = useState('');
  const [tempBaseUrl, setTempBaseUrl] = useState('https://stationapi.veriff.com');
  const [savingProvider, setSavingProvider] = useState(false);
  
  // Scan duplicates state
  const [scanning, setScanning] = useState(false);
  const [scanResults, setScanResults] = useState<{
    success: boolean;
    message: string;
    stats: {
      sessionsScanned: number;
      duplicateGroupsFound: number;
      alertsCreated: number;
      scoresUpdated: number;
      usersSuspended: number;
    };
    duplicates: any[];
  } | null>(null);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await fetch('/api/kyc-settings');
      const data = await response.json();
      if (data.settings) {
        setSettings(data.settings);
      }
    } catch (error) {
      console.error('Error fetching KYC settings:', error);
      toast.error('Failed to load KYC settings');
    } finally {
      setLoading(false);
    }
  };

  const handleScanDuplicates = async () => {
    setScanning(true);
    setScanResults(null);
    
    try {
      const response = await fetch('/api/kyc-settings/scan-duplicates', {
        method: 'POST',
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setScanResults(data);
        if (data.stats.duplicateGroupsFound > 0) {
          toast.warning(`Found ${data.stats.duplicateGroupsFound} duplicate group(s)!`);
        } else {
          toast.success('No duplicates found. All KYC sessions are unique.');
        }
      } else {
        toast.error(data.error || 'Failed to scan for duplicates');
      }
    } catch (error) {
      console.error('Error scanning for duplicates:', error);
      toast.error('Failed to scan for duplicates');
    } finally {
      setScanning(false);
    }
  };

  const handleSave = async () => {
    if (!settings) return;

    setSaving(true);
    try {
      const response = await fetch('/api/kyc-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });

      if (response.ok) {
        const data = await response.json();
        setSettings(data.settings);
        toast.success('KYC settings saved successfully');
      } else {
        toast.error('Failed to save KYC settings');
      }
    } catch (error) {
      console.error('Error saving KYC settings:', error);
      toast.error('Failed to save KYC settings');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveProvider = async () => {
    if (!tempApiKey || !tempApiSecret) {
      toast.error('Please fill in API Key and Secret');
      return;
    }

    setSavingProvider(true);
    try {
      const response = await fetch('/api/kyc-settings/provider', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: 'veriff',
          apiKey: tempApiKey,
          apiSecret: tempApiSecret,
          baseUrl: tempBaseUrl,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        toast.success('Veriff credentials saved successfully');
        setConfigDialogOpen(false);
        // Refresh settings
        fetchSettings();
      } else {
        const error = await response.json();
        toast.error(error.message || 'Failed to save credentials');
      }
    } catch (error) {
      console.error('Error saving provider:', error);
      toast.error('Failed to save credentials');
    } finally {
      setSavingProvider(false);
    }
  };

  const handleTestConnection = async () => {
    setTesting(true);
    try {
      const response = await fetch('/api/kyc-settings/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey: tempApiKey || settings?.veriffApiKey,
          apiSecret: tempApiSecret || settings?.veriffApiSecret,
          baseUrl: tempBaseUrl || settings?.veriffBaseUrl,
        }),
      });

      const data = await response.json();
      if (data.success) {
        toast.success('Connection successful! Veriff API is working.');
      } else {
        toast.error(data.message || 'Connection failed');
      }
    } catch (error) {
      toast.error('Failed to test connection');
    } finally {
      setTesting(false);
    }
  };

  const openConfigDialog = () => {
    setTempApiKey(settings?.veriffApiKey || '');
    setTempApiSecret('');
    setTempBaseUrl(settings?.veriffBaseUrl || 'https://stationapi.veriff.com');
    setConfigDialogOpen(true);
  };

  const copyWebhookUrl = () => {
    const url = typeof window !== 'undefined' 
      ? `${window.location.origin
          .replace(':3001', ':3000')
          .replace('admin.', '')}/api/kyc/webhook`
      : '/api/kyc/webhook';
    navigator.clipboard.writeText(url);
    setCopiedWebhook(true);
    setTimeout(() => setCopiedWebhook(false), 2000);
    toast.success('Webhook URL copied to clipboard');
  };

  const updateSetting = <K extends keyof KYCSettings>(key: K, value: KYCSettings[K]) => {
    if (settings) {
      setSettings({ ...settings, [key]: value });
    }
  };

  const toggleDocumentType = (type: string) => {
    if (!settings) return;
    const types = settings.allowedDocumentTypes.includes(type)
      ? settings.allowedDocumentTypes.filter((t) => t !== type)
      : [...settings.allowedDocumentTypes, type];
    updateSetting('allowedDocumentTypes', types);
  };

  const isVeriffConfigured = settings?.veriffApiKey && settings?.veriffApiSecret;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="text-center py-8 text-gray-400">
        Failed to load KYC settings
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-green-500/20 rounded-lg">
            <Shield className="h-6 w-6 text-green-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">KYC Verification Settings</h2>
            <p className="text-sm text-gray-400">
              Configure identity verification providers and requirements
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant={settings.enabled ? 'default' : 'secondary'} className="px-3 py-1">
            {settings.enabled ? (
              <>
                <CheckCircle className="h-3 w-3 mr-1" />
                KYC Enabled
              </>
            ) : (
              <>
                <XCircle className="h-3 w-3 mr-1" />
                KYC Disabled
              </>
            )}
          </Badge>
          <Button onClick={handleSave} disabled={saving}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>

      {/* Main Toggle */}
      <Card className="bg-gray-800/50 border-gray-700">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-lg ${settings.enabled ? 'bg-green-500/20' : 'bg-gray-700'}`}>
                <Shield className={`h-6 w-6 ${settings.enabled ? 'text-green-400' : 'text-gray-400'}`} />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">Enable KYC Verification</h3>
                <p className="text-sm text-gray-400">
                  When enabled, users will be required to verify their identity
                </p>
              </div>
            </div>
            <Switch
              checked={settings.enabled}
              onCheckedChange={(checked) => updateSetting('enabled', checked)}
            />
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="providers" className="space-y-4">
        <TabsList className="bg-gray-800/50 border border-gray-700">
          <TabsTrigger value="providers">
            <Plug className="h-4 w-4 mr-2" />
            KYC Providers
          </TabsTrigger>
          <TabsTrigger value="general">
            <Settings className="h-4 w-4 mr-2" />
            General
          </TabsTrigger>
          <TabsTrigger value="verification">
            <FileText className="h-4 w-4 mr-2" />
            Verification Options
          </TabsTrigger>
          <TabsTrigger value="messages">
            <MessageSquare className="h-4 w-4 mr-2" />
            Messages
          </TabsTrigger>
          <TabsTrigger value="tools">
            <Search className="h-4 w-4 mr-2" />
            Tools
          </TabsTrigger>
        </TabsList>

        {/* KYC Providers Tab */}
        <TabsContent value="providers">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-white">KYC Providers</h3>
                <p className="text-sm text-gray-400">Configure identity verification providers</p>
              </div>
            </div>

            {/* Veriff Provider Card */}
            <Card className={`bg-gray-800/50 border-2 transition-all ${
              isVeriffConfigured ? 'border-green-500/50' : 'border-gray-700'
            }`}>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    {/* Veriff Logo */}
                    <div className="w-16 h-16 bg-[#0066FF] rounded-xl flex items-center justify-center shadow-lg">
                      <span className="text-white font-bold text-xl">V</span>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="text-lg font-bold text-white">Veriff</h4>
                        {isVeriffConfigured ? (
                          <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Configured
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="bg-gray-700 text-gray-400">
                            Not Configured
                          </Badge>
                        )}
                        {settings.veriffBaseUrl?.includes('test') && (
                          <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30">
                            <TestTube className="h-3 w-3 mr-1" />
                            Sandbox
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-gray-400 mt-1">
                        AI-powered identity verification with document scanning and facial recognition
                      </p>
                      
                      {/* Features */}
                      <div className="flex flex-wrap gap-2 mt-3">
                        <Badge variant="outline" className="text-xs text-gray-300 border-gray-600">
                          Document Verification
                        </Badge>
                        <Badge variant="outline" className="text-xs text-gray-300 border-gray-600">
                          Face Match
                        </Badge>
                        <Badge variant="outline" className="text-xs text-gray-300 border-gray-600">
                          Liveness Detection
                        </Badge>
                        <Badge variant="outline" className="text-xs text-gray-300 border-gray-600">
                          200+ Countries
                        </Badge>
                      </div>

                      {/* Connection Status */}
                      {isVeriffConfigured && (
                        <div className="mt-4 p-3 bg-gray-900/50 rounded-lg">
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <p className="text-gray-400">API Key</p>
                              <p className="text-white font-mono">
                                {settings.veriffApiKey?.slice(0, 12)}...
                              </p>
                            </div>
                            <div>
                              <p className="text-gray-400">Environment</p>
                              <p className="text-white">
                                {settings.veriffBaseUrl?.includes('test') ? 'Sandbox' : 'Production'}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Button
                      onClick={openConfigDialog}
                      className={isVeriffConfigured 
                        ? 'bg-blue-600 hover:bg-blue-700' 
                        : 'bg-green-600 hover:bg-green-700'
                      }
                    >
                      <Key className="h-4 w-4 mr-2" />
                      {isVeriffConfigured ? 'Update Credentials' : 'Configure'}
                    </Button>
                    <a
                      href="https://www.veriff.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-400 hover:underline flex items-center justify-center gap-1"
                    >
                      Visit Veriff
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </div>

                {/* Webhook Configuration */}
                {isVeriffConfigured && (
                  <div className="mt-6 pt-4 border-t border-gray-700">
                    <h5 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
                      <Globe className="h-4 w-4" />
                      Webhook Configuration
                    </h5>
                    <div className="space-y-3">
                      <div className="p-3 bg-gray-900/50 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <Label className="text-gray-300 text-sm">Webhook Events URL</Label>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={copyWebhookUrl}
                            className="h-7 px-2"
                          >
                            {copiedWebhook ? (
                              <Check className="h-3 w-3 text-green-400" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                          </Button>
                        </div>
                        <code className="block p-2 bg-gray-800 rounded text-xs text-green-400 break-all">
                          {typeof window !== 'undefined' 
                            ? `${window.location.origin
                                .replace(':3001', ':3000')
                                .replace('admin.', '')}/api/kyc/webhook`
                            : '/api/kyc/webhook'}
                        </code>
                      </div>
                      <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                        <p className="text-xs text-gray-300">
                          <Info className="h-3 w-3 inline mr-1" />
                          Add this URL in your Veriff Dashboard → Settings → Webhook events URL and Webhook decisions URL
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Future Provider Placeholder */}
            <Card className="bg-gray-800/30 border-gray-700 border-dashed opacity-50">
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-gray-700 rounded-xl flex items-center justify-center">
                    <Plug className="h-8 w-8 text-gray-500" />
                  </div>
                  <div>
                    <h4 className="text-lg font-medium text-gray-400">More providers coming soon</h4>
                    <p className="text-sm text-gray-500">
                      Additional KYC providers will be available in future updates
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* General Settings */}
        <TabsContent value="general">
          <Card className="bg-gray-800/50 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Settings className="h-5 w-5" />
                General Settings
              </CardTitle>
              <CardDescription>Configure when KYC verification is required</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* When KYC is Required */}
              <div className="space-y-4">
                <h4 className="text-sm font-medium text-white">KYC Requirements</h4>
                
                <div className="flex items-center justify-between p-4 bg-gray-900/50 rounded-lg">
                  <div>
                    <p className="font-medium text-white">Required for Withdrawals</p>
                    <p className="text-sm text-gray-400">Users must verify identity before withdrawing</p>
                  </div>
                  <Switch
                    checked={settings.requiredForWithdrawal}
                    onCheckedChange={(checked) => updateSetting('requiredForWithdrawal', checked)}
                  />
                </div>

                <div className="flex items-center justify-between p-4 bg-gray-900/50 rounded-lg">
                  <div>
                    <p className="font-medium text-white">Required for Deposits</p>
                    <p className="text-sm text-gray-400">Users must verify identity before depositing</p>
                  </div>
                  <Switch
                    checked={settings.requiredForDeposit}
                    onCheckedChange={(checked) => updateSetting('requiredForDeposit', checked)}
                  />
                </div>

                <div className="p-4 bg-gray-900/50 rounded-lg space-y-2">
                  <Label className="text-white">Minimum Amount Threshold (€)</Label>
                  <Input
                    type="number"
                    value={settings.requiredAmount}
                    onChange={(e) => updateSetting('requiredAmount', parseFloat(e.target.value) || 0)}
                    className="bg-gray-800 border-gray-600"
                    placeholder="0 = Always required"
                  />
                  <p className="text-xs text-gray-400">
                    Set to 0 to require KYC for all amounts, or specify a minimum amount
                  </p>
                </div>
              </div>

              {/* Auto Actions */}
              <div className="space-y-4 pt-4 border-t border-gray-700">
                <h4 className="text-sm font-medium text-white">Automatic Actions</h4>

                <div className="flex items-center justify-between p-4 bg-gray-900/50 rounded-lg">
                  <div>
                    <p className="font-medium text-white">Auto-Approve on Success</p>
                    <p className="text-sm text-gray-400">Automatically approve verified users</p>
                  </div>
                  <Switch
                    checked={settings.autoApproveOnSuccess}
                    onCheckedChange={(checked) => updateSetting('autoApproveOnSuccess', checked)}
                  />
                </div>

                <div className="flex items-center justify-between p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                  <div>
                    <p className="font-medium text-yellow-400 flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4" />
                      Auto-Suspend on Failure
                    </p>
                    <p className="text-sm text-gray-400">Suspend users who fail verification</p>
                  </div>
                  <Switch
                    checked={settings.autoSuspendOnFail}
                    onCheckedChange={(checked) => updateSetting('autoSuspendOnFail', checked)}
                  />
                </div>
              </div>

              {/* Timing */}
              <div className="space-y-4 pt-4 border-t border-gray-700">
                <h4 className="text-sm font-medium text-white flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Timing Settings
                </h4>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-gray-300">Max Verification Attempts</Label>
                    <Input
                      type="number"
                      value={settings.maxVerificationAttempts}
                      onChange={(e) => updateSetting('maxVerificationAttempts', parseInt(e.target.value) || 3)}
                      className="bg-gray-800 border-gray-600"
                      min={1}
                      max={10}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-gray-300">Session Expiry (minutes)</Label>
                    <Input
                      type="number"
                      value={settings.sessionExpiryMinutes}
                      onChange={(e) => updateSetting('sessionExpiryMinutes', parseInt(e.target.value) || 30)}
                      className="bg-gray-800 border-gray-600"
                      min={5}
                      max={120}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-gray-300">Verification Valid (days)</Label>
                    <Input
                      type="number"
                      value={settings.verificationValidDays}
                      onChange={(e) => updateSetting('verificationValidDays', parseInt(e.target.value) || 365)}
                      className="bg-gray-800 border-gray-600"
                      min={30}
                      max={1825}
                    />
                    <p className="text-xs text-gray-400">How long a successful verification remains valid</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Verification Options */}
        <TabsContent value="verification">
          <Card className="bg-gray-800/50 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Verification Options
              </CardTitle>
              <CardDescription>Configure accepted documents and countries</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Document Types */}
              <div className="space-y-3">
                <h4 className="text-sm font-medium text-white">Accepted Document Types</h4>
                <div className="grid grid-cols-2 gap-3">
                  {DOCUMENT_TYPES.map((doc) => (
                    <div
                      key={doc.value}
                      className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                        settings.allowedDocumentTypes.includes(doc.value)
                          ? 'bg-green-500/20 border-green-500/50'
                          : 'bg-gray-900/50 border-gray-700 hover:border-gray-600'
                      }`}
                      onClick={() => toggleDocumentType(doc.value)}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-white">{doc.label}</span>
                        {settings.allowedDocumentTypes.includes(doc.value) && (
                          <CheckCircle className="h-4 w-4 text-green-400" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Countries */}
              <div className="space-y-3 pt-4 border-t border-gray-700">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-medium text-white flex items-center gap-2">
                      <Globe className="h-4 w-4" />
                      Allowed Countries
                    </h4>
                    <p className="text-xs text-gray-400">Leave empty to allow all countries</p>
                  </div>
                  <Badge variant="secondary">
                    {settings.allowedCountries.length === 0
                      ? 'All Countries'
                      : `${settings.allowedCountries.length} Selected`}
                  </Badge>
                </div>
                <Textarea
                  value={settings.allowedCountries.join(', ')}
                  onChange={(e) =>
                    updateSetting(
                      'allowedCountries',
                      e.target.value
                        .split(',')
                        .map((c) => c.trim().toUpperCase())
                        .filter(Boolean)
                    )
                  }
                  className="bg-gray-800 border-gray-600"
                  placeholder="US, GB, DE, FR, ES (ISO 2-letter codes, comma-separated)"
                  rows={2}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Messages */}
        <TabsContent value="messages">
          <Card className="bg-gray-800/50 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                User Messages
              </CardTitle>
              <CardDescription>Customize messages shown to users during KYC</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-white">KYC Required Message</Label>
                  <Textarea
                    value={settings.kycRequiredMessage}
                    onChange={(e) => updateSetting('kycRequiredMessage', e.target.value)}
                    className="bg-gray-800 border-gray-600"
                    rows={2}
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-white">KYC Pending Message</Label>
                  <Textarea
                    value={settings.kycPendingMessage}
                    onChange={(e) => updateSetting('kycPendingMessage', e.target.value)}
                    className="bg-gray-800 border-gray-600"
                    rows={2}
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-white">KYC Approved Message</Label>
                  <Textarea
                    value={settings.kycApprovedMessage}
                    onChange={(e) => updateSetting('kycApprovedMessage', e.target.value)}
                    className="bg-gray-800 border-gray-600"
                    rows={2}
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-white">KYC Declined Message</Label>
                  <Textarea
                    value={settings.kycDeclinedMessage}
                    onChange={(e) => updateSetting('kycDeclinedMessage', e.target.value)}
                    className="bg-gray-800 border-gray-600"
                    rows={2}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tools Tab */}
        <TabsContent value="tools">
          <div className="space-y-4">
            {/* Scan for Duplicate KYC */}
            <Card className="bg-gray-800/50 border-gray-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Fingerprint className="h-5 w-5 text-orange-500" />
                  Scan for Duplicate KYC
                </CardTitle>
                <CardDescription>
                  Scan all approved KYC sessions in the database for duplicates
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 bg-orange-500/10 border border-orange-500/30 rounded-lg">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-orange-400 mt-0.5" />
                    <div className="text-sm text-gray-300">
                      <p className="font-medium text-orange-400 mb-1">What this does:</p>
                      <ul className="list-disc list-inside space-y-1 text-gray-400">
                        <li>Scans all approved KYC sessions for duplicate documents</li>
                        <li>Creates fraud alerts for any duplicates found</li>
                        <li>Updates fraud scores for involved users (+50%)</li>
                        <li>Applies suspensions if auto-suspend is enabled</li>
                      </ul>
                    </div>
                  </div>
                </div>

                <Button
                  onClick={handleScanDuplicates}
                  disabled={scanning}
                  className="w-full bg-orange-600 hover:bg-orange-700"
                >
                  {scanning ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Scanning KYC Sessions...
                    </>
                  ) : (
                    <>
                      <Search className="h-4 w-4 mr-2" />
                      Scan for Duplicates
                    </>
                  )}
                </Button>

                {/* Scan Results */}
                {scanResults && (
                  <div className={`p-4 rounded-lg border ${
                    scanResults.stats.duplicateGroupsFound > 0 
                      ? 'bg-red-500/10 border-red-500/30'
                      : 'bg-green-500/10 border-green-500/30'
                  }`}>
                    <div className="flex items-start gap-3">
                      {scanResults.stats.duplicateGroupsFound > 0 ? (
                        <AlertTriangle className="h-5 w-5 text-red-400 mt-0.5" />
                      ) : (
                        <CheckCircle className="h-5 w-5 text-green-400 mt-0.5" />
                      )}
                      <div className="flex-1">
                        <p className={`font-medium ${
                          scanResults.stats.duplicateGroupsFound > 0 ? 'text-red-400' : 'text-green-400'
                        }`}>
                          {scanResults.message}
                        </p>
                        
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-3">
                          <div className="bg-gray-800/50 p-2 rounded">
                            <p className="text-xs text-gray-500">Sessions Scanned</p>
                            <p className="text-lg font-bold text-white">{scanResults.stats.sessionsScanned}</p>
                          </div>
                          <div className="bg-gray-800/50 p-2 rounded">
                            <p className="text-xs text-gray-500">Duplicates Found</p>
                            <p className={`text-lg font-bold ${
                              scanResults.stats.duplicateGroupsFound > 0 ? 'text-red-400' : 'text-green-400'
                            }`}>
                              {scanResults.stats.duplicateGroupsFound}
                            </p>
                          </div>
                          <div className="bg-gray-800/50 p-2 rounded">
                            <p className="text-xs text-gray-500">Alerts Created</p>
                            <p className="text-lg font-bold text-orange-400">{scanResults.stats.alertsCreated}</p>
                          </div>
                          <div className="bg-gray-800/50 p-2 rounded">
                            <p className="text-xs text-gray-500">Scores Updated</p>
                            <p className="text-lg font-bold text-blue-400">{scanResults.stats.scoresUpdated}</p>
                          </div>
                          <div className="bg-gray-800/50 p-2 rounded">
                            <p className="text-xs text-gray-500">Users Suspended</p>
                            <p className="text-lg font-bold text-purple-400">{scanResults.stats.usersSuspended}</p>
                          </div>
                        </div>

                        {/* Duplicate Details */}
                        {scanResults.duplicates && scanResults.duplicates.length > 0 && (
                          <div className="mt-4 space-y-2">
                            <p className="text-sm font-medium text-gray-300">Duplicate Groups:</p>
                            {scanResults.duplicates.map((dup, index) => (
                              <div key={index} className="p-3 bg-gray-800/70 rounded border border-gray-700">
                                <div className="flex items-center justify-between mb-2">
                                  <Badge variant="outline" className="text-orange-400 border-orange-400">
                                    {dup.matchType.replace('_', ' ')}
                                  </Badge>
                                  {dup.alertExisted ? (
                                    <Badge variant="secondary" className="bg-gray-700">Alert already existed</Badge>
                                  ) : (
                                    <Badge variant="secondary" className="bg-red-500/20 text-red-400">New alert created</Badge>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 text-sm text-gray-400">
                                  <Users className="h-4 w-4" />
                                  <span>{dup.userIds.length} accounts involved</span>
                                </div>
                                {dup.documentInfo && (
                                  <div className="text-xs text-gray-500 mt-1">
                                    Document: {dup.documentInfo.type} from {dup.documentInfo.country} ({dup.documentInfo.numberMasked})
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Provider Configuration Dialog */}
      <Dialog open={configDialogOpen} onOpenChange={setConfigDialogOpen}>
        <DialogContent className="bg-gray-800 border-gray-700 max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-3">
              <div className="w-10 h-10 bg-[#0066FF] rounded-lg flex items-center justify-center">
                <span className="text-white font-bold">V</span>
              </div>
              Configure Veriff
            </DialogTitle>
            <DialogDescription>
              Enter your Veriff API credentials. Get them from{' '}
              <a
                href="https://station.veriff.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:underline"
              >
                Veriff Station
              </a>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Setup Instructions */}
            <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
              <h4 className="text-sm font-medium text-blue-400 mb-2 flex items-center gap-2">
                <Info className="h-4 w-4" />
                Setup Instructions
              </h4>
              <ol className="text-xs text-gray-300 space-y-1 list-decimal list-inside">
                <li>Go to <a href="https://station.veriff.com" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">station.veriff.com</a></li>
                <li>Navigate to Workspace → All integrations</li>
                <li>Create or select your integration</li>
                <li>Copy API Key and create a Shared Secret Key</li>
                <li>In Settings tab, configure webhook URLs</li>
              </ol>
            </div>

            <div className="space-y-2">
              <Label className="text-white">API Key</Label>
              <Input
                value={tempApiKey}
                onChange={(e) => setTempApiKey(e.target.value)}
                className="bg-gray-900 border-gray-600 font-mono"
                placeholder="c9f5ed12-5439-47d5-ae8f-..."
              />
            </div>

            <div className="space-y-2">
              <Label className="text-white">Shared Secret Key</Label>
              <div className="relative">
                <Input
                  type={showApiSecret ? 'text' : 'password'}
                  value={tempApiSecret}
                  onChange={(e) => setTempApiSecret(e.target.value)}
                  className="bg-gray-900 border-gray-600 font-mono pr-10"
                  placeholder="a99cd02b-df0c-458d-89cd-..."
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-2 top-1/2 -translate-y-1/2"
                  onClick={() => setShowApiSecret(!showApiSecret)}
                >
                  {showApiSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-xs text-gray-400">
                Found under "Authentication methods" → "Shared secret keys"
              </p>
            </div>

            <div className="space-y-2">
              <Label className="text-white">Environment</Label>
              <Select value={tempBaseUrl} onValueChange={setTempBaseUrl}>
                <SelectTrigger className="bg-gray-900 border-gray-600">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="https://stationapi.veriff.com">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-green-500"></div>
                      Production
                    </div>
                  </SelectItem>
                  <SelectItem value="https://stationapi-test.veriff.com">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-purple-500"></div>
                      Sandbox (Testing)
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={handleTestConnection}
              disabled={testing || !tempApiKey}
            >
              {testing ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <TestTube className="h-4 w-4 mr-2" />
              )}
              Test Connection
            </Button>
            <Button
              onClick={handleSaveProvider}
              disabled={savingProvider || !tempApiKey || !tempApiSecret}
              className="bg-green-600 hover:bg-green-700"
            >
              {savingProvider ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save Credentials
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
