'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  CreditCard,
  Plus,
  Settings,
  Trash2,
  Eye,
  EyeOff,
  RefreshCw,
  Check,
  X,
  AlertCircle,
  DollarSign,
  Zap,
  Copy,
  ExternalLink,
  Terminal,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface Credential {
  key: string;
  value: string;
  isSecret: boolean;
  description?: string;
}

interface PaymentProvider {
  _id: string;
  name: string;
  slug: string;
  displayName: string;
  logo?: string;
  isActive: boolean;
  isBuiltIn: boolean;
  saveToEnv: boolean;
  credentials: Credential[];
  webhookUrl?: string;
  testMode: boolean;
  priority: number;
}

// Built-in provider configurations
const BUILT_IN_PROVIDERS = [
  {
    slug: 'clerk',
    displayName: 'Clerk',
    logo: '🔐',
    defaultCredentials: [
      { key: 'publishable_key', isSecret: false, description: 'Clerk publishable key' },
      { key: 'secret_key', isSecret: true, description: 'Clerk secret key' },
    ],
  },
  {
    slug: 'stripe',
    displayName: 'Stripe',
    logo: '💳',
    defaultCredentials: [
      { key: 'secret_key', isSecret: true, description: 'Stripe secret key (sk_test_ or sk_live_)' },
      { key: 'publishable_key', isSecret: false, description: 'Stripe publishable key' },
      { key: 'webhook_secret', isSecret: true, description: 'Stripe webhook signing secret' },
    ],
  },
  {
    slug: 'polar',
    displayName: 'Polar',
    logo: '❄️',
    defaultCredentials: [
      { key: 'api_key', isSecret: true, description: 'Polar API key' },
      { key: 'secret', isSecret: true, description: 'Polar secret' },
    ],
  },
  {
    slug: 'paddle',
    displayName: 'Paddle',
    logo: '🏓',
    defaultCredentials: [
      { key: 'vendor_id', isSecret: false, description: 'Paddle vendor ID (from Settings → Business)' },
      { key: 'api_key', isSecret: true, description: 'Paddle API key (pdl_live_ or pdl_test_)' },
      { key: 'public_key', isSecret: false, description: 'Paddle public key (for inline checkout)' },
      { key: 'webhook_secret', isSecret: true, description: 'Paddle webhook signing secret (optional)' },
    ],
  },
];

export default function PaymentProvidersSection() {
  const [providers, setProviders] = useState<PaymentProvider[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedProvider, setSelectedProvider] = useState<PaymentProvider | null>(null);
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [isRegenerating, setIsRegenerating] = useState(false);
  
  // Auto-configure webhook state
  const [isAutoConfiguring, setIsAutoConfiguring] = useState(false);
  const [autoConfigResult, setAutoConfigResult] = useState<{
    success?: boolean;
    message?: string;
    isLocalhost?: boolean;
    suggestion?: string;
    webhookSecret?: string;
  } | null>(null);
  
  // New provider form state
  const [newProvider, setNewProvider] = useState({
    name: '',
    slug: '',
    displayName: '',
    logo: '',
    saveToEnv: true,
    credentials: [] as Credential[],
  });

  useEffect(() => {
    fetchProviders();
  }, []);

  const fetchProviders = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/payment-providers');
      if (response.ok) {
        const data = await response.json();
        setProviders(data.providers || []);
        
        // Initialize built-in providers if they don't exist
        await initializeBuiltInProviders(data.providers || []);
      }
    } catch (error) {
      toast.error('Failed to load payment providers');
    } finally {
      setIsLoading(false);
    }
  };

  const initializeBuiltInProviders = async (existingProviders: PaymentProvider[]) => {
    const existingSlugs = existingProviders.map(p => p.slug);
    
    for (const builtIn of BUILT_IN_PROVIDERS) {
      if (!existingSlugs.includes(builtIn.slug)) {
        try {
          await fetch('/api/payment-providers', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: builtIn.slug,
              slug: builtIn.slug,
              displayName: builtIn.displayName,
              logo: builtIn.logo,
              credentials: builtIn.defaultCredentials.map(c => ({
                key: c.key,
                value: '',
                isSecret: c.isSecret,
                description: c.description,
              })),
              saveToEnv: true,
            }),
          });
        } catch (error) {
          console.error(`Failed to initialize ${builtIn.slug}:`, error);
        }
      }
    }
    
    // Refresh if we added any
    if (BUILT_IN_PROVIDERS.some(b => !existingSlugs.includes(b.slug))) {
      fetchProviders();
    }
  };

  const handleToggleActive = async (provider: PaymentProvider) => {
    try {
      const response = await fetch(`/api/payment-providers/${provider._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !provider.isActive }),
      });

      if (response.ok) {
        toast.success(`${provider.displayName} ${!provider.isActive ? 'activated' : 'deactivated'}`);
        fetchProviders();
      } else {
        toast.error('Failed to update provider');
      }
    } catch (error) {
      toast.error('Error updating provider');
    }
  };

  const handleOpenConfig = (provider: PaymentProvider) => {
    setSelectedProvider(provider);
    setAutoConfigResult(null); // Reset auto-config result
    setConfigDialogOpen(true);
  };

  // Auto-configure webhooks for Stripe/Paddle
  const handleAutoConfigureWebhook = async () => {
    if (!selectedProvider) return;
    
    // Only supported for Stripe and Paddle
    if (!['stripe', 'paddle'].includes(selectedProvider.slug)) {
      toast.error('Auto-configure only supported for Stripe and Paddle');
      return;
    }

    // Use custom main app URL if provided, otherwise use current origin
    const baseUrl = mainAppUrl || window.location.origin;
    const webhookPath = selectedProvider.slug === 'stripe' 
      ? '/api/stripe/webhook' 
      : '/api/paddle/webhook';
    const webhookUrl = `${baseUrl}${webhookPath}`;

    setIsAutoConfiguring(true);
    setAutoConfigResult(null);

    try {
      const response = await fetch('/api/payment-providers/auto-configure-webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: selectedProvider.slug,
          webhookUrl,
        }),
      });

      const result = await response.json();

      if (response.ok) {
        setAutoConfigResult({ 
          success: true, 
          message: result.message,
          webhookSecret: result.webhookSecret,
        });
        toast.success(result.message);
        
        // Update the selected provider's credentials in state immediately
        if (selectedProvider && result.webhookSecret) {
          const updatedCredentials = [...selectedProvider.credentials];
          const secretIndex = updatedCredentials.findIndex(c => c.key === 'webhook_secret');
          if (secretIndex >= 0) {
            updatedCredentials[secretIndex].value = result.webhookSecret;
          } else {
            updatedCredentials.push({
              key: 'webhook_secret',
              value: result.webhookSecret,
              isSecret: true,
              description: 'Stripe webhook signing secret (auto-configured)',
            });
          }
          setSelectedProvider({ ...selectedProvider, credentials: updatedCredentials });
        }
        
        // Refresh providers to get updated data from database
        fetchProviders();
      } else {
        setAutoConfigResult({
          success: false,
          message: result.error,
          isLocalhost: result.isLocalhost,
          suggestion: result.suggestion,
        });
        if (!result.isLocalhost) {
          toast.error(result.error);
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to auto-configure';
      setAutoConfigResult({ success: false, message });
      toast.error(message);
    } finally {
      setIsAutoConfiguring(false);
    }
  };

  // State for custom main app URL
  const [mainAppUrl, setMainAppUrl] = useState('');

  // Get detected webhook URL - use main app URL if provided, otherwise current origin
  const getDetectedWebhookUrl = () => {
    if (!selectedProvider) return '';
    const webhookPath = selectedProvider.slug === 'stripe' 
      ? '/api/stripe/webhook' 
      : '/api/paddle/webhook';
    // Use custom main app URL if provided (for when admin runs on different port)
    const baseUrl = mainAppUrl || window.location.origin;
    return `${baseUrl}${webhookPath}`;
  };

  // Check if target URL is localhost
  const isLocalhost = () => {
    if (typeof window === 'undefined') return false;
    // Check main app URL if provided
    if (mainAppUrl) {
      try {
        const url = new URL(mainAppUrl);
        return url.hostname === 'localhost' || url.hostname === '127.0.0.1';
      } catch {
        return true; // Invalid URL, treat as localhost
      }
    }
    // Otherwise check current origin
    return window.location.hostname === 'localhost' || 
           window.location.hostname === '127.0.0.1';
  };

  const handleSaveConfig = async () => {
    if (!selectedProvider) return;

    try {
      const response = await fetch(`/api/payment-providers/${selectedProvider._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          credentials: selectedProvider.credentials,
          webhookUrl: selectedProvider.webhookUrl,
          testMode: selectedProvider.testMode,
          saveToEnv: selectedProvider.saveToEnv,
        }),
      });

      if (response.ok) {
        toast.success('Configuration saved successfully');
        setConfigDialogOpen(false);
        fetchProviders();
      } else {
        toast.error('Failed to save configuration');
      }
    } catch (error) {
      toast.error('Error saving configuration');
    }
  };

  const handleAddProvider = async () => {
    if (!newProvider.name || !newProvider.slug || !newProvider.displayName) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      const response = await fetch('/api/payment-providers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newProvider),
      });

      if (response.ok) {
        toast.success('Payment provider added successfully');
        setAddDialogOpen(false);
        setNewProvider({
          name: '',
          slug: '',
          displayName: '',
          logo: '',
          saveToEnv: true,
          credentials: [],
        });
        fetchProviders();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to add provider');
      }
    } catch (error) {
      toast.error('Error adding provider');
    }
  };

  const handleRegenerateEnv = async () => {
    if (!confirm('This will clean up duplicate entries in your .env file. Continue?')) {
      return;
    }

    setIsRegenerating(true);
    try {
      const response = await fetch('/api/payment-providers/regenerate-env', {
        method: 'POST',
      });

      if (response.ok) {
        const data = await response.json();
        toast.success(data.message || '.env file regenerated successfully');
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to regenerate .env file');
      }
    } catch (error) {
      toast.error('Error regenerating .env file');
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleDeleteProvider = async (provider: PaymentProvider) => {
    if (provider.isBuiltIn) {
      toast.error('Cannot delete built-in providers');
      return;
    }

    if (!confirm(`Are you sure you want to delete ${provider.displayName}?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/payment-providers/${provider._id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        toast.success('Provider deleted successfully');
        fetchProviders();
      } else {
        toast.error('Failed to delete provider');
      }
    } catch (error) {
      toast.error('Error deleting provider');
    }
  };

  const addCredentialToNew = () => {
    setNewProvider({
      ...newProvider,
      credentials: [
        ...newProvider.credentials,
        { key: '', value: '', isSecret: true, description: '' },
      ],
    });
  };

  const removeCredentialFromNew = (index: number) => {
    setNewProvider({
      ...newProvider,
      credentials: newProvider.credentials.filter((_, i) => i !== index),
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-100 flex items-center gap-2">
            <CreditCard className="h-6 w-6 text-green-500" />
            Payment Providers
          </h2>
          <p className="text-sm text-gray-400 mt-1">
            Manage payment provider integrations and credentials
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={handleRegenerateEnv}
            disabled={isRegenerating}
            variant="outline"
            className="bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-500 border-yellow-500/30 hover:border-yellow-500/50 font-bold"
          >
            {isRegenerating ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Regenerating...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                Clean .env Duplicates
              </>
            )}
          </Button>
          <Button
            onClick={() => setAddDialogOpen(true)}
            className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-bold"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Custom Provider
          </Button>
        </div>
      </div>

      {/* Providers Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {providers.map((provider) => (
          <div
            key={provider._id}
            className={`bg-gray-800/50 border rounded-xl p-6 transition-all ${
              provider.isActive
                ? 'border-green-500/50 shadow-lg shadow-green-500/20'
                : 'border-gray-700'
            }`}
          >
            {/* Provider Header */}
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="text-4xl">{provider.logo || '💳'}</div>
                <div>
                  <h3 className="text-lg font-bold text-gray-100">
                    {provider.displayName}
                  </h3>
                  <p className="text-xs text-gray-500">{provider.slug}</p>
                </div>
              </div>
              
              {provider.isBuiltIn && (
                <span className="text-xs px-2 py-1 bg-blue-500/20 text-blue-400 rounded">
                  Built-in
                </span>
              )}
            </div>

            {/* Status */}
            <div className="flex items-center gap-2 mb-4">
              <Switch
                checked={provider.isActive}
                onCheckedChange={() => handleToggleActive(provider)}
              />
              <span className="text-sm text-gray-400">
                {provider.isActive ? (
                  <span className="text-green-500 flex items-center gap-1">
                    <Check className="h-3 w-3" /> Active
                  </span>
                ) : (
                  <span className="text-gray-500 flex items-center gap-1">
                    <X className="h-3 w-3" /> Inactive
                  </span>
                )}
              </span>
            </div>

            {/* Provider Info */}
            <div className="space-y-2 mb-4 text-xs text-gray-500">
              <div className="flex items-center gap-2">
                <span>Mode:</span>
                <span className={provider.testMode ? 'text-yellow-400' : 'text-green-400'}>
                  {provider.testMode ? 'Test' : 'Live'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span>Credentials:</span>
                <span className="text-gray-300">{provider.credentials.length} keys</span>
              </div>
              <div className="flex items-center gap-2">
                <span>Save to .env:</span>
                <span className="text-gray-300">{provider.saveToEnv ? 'Yes' : 'No'}</span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <Button
                onClick={() => handleOpenConfig(provider)}
                variant="outline"
                size="sm"
                className="flex-1 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border-blue-500/30"
              >
                <Settings className="h-4 w-4 mr-1" />
                Configure
              </Button>
              
              {!provider.isBuiltIn && (
                <Button
                  onClick={() => handleDeleteProvider(provider)}
                  variant="outline"
                  size="sm"
                  className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border-red-500/30"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        ))}

        {providers.length === 0 && (
          <div className="col-span-full text-center py-12 text-gray-500">
            <CreditCard className="h-16 w-16 mx-auto mb-4 opacity-50" />
            <p>No payment providers configured</p>
            <p className="text-sm mt-2">Click &quot;Add Custom Provider&quot; to get started</p>
          </div>
        )}
      </div>

      {/* Configure Provider Dialog */}
      <Dialog open={configDialogOpen} onOpenChange={setConfigDialogOpen}>
        <DialogContent className="bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700 text-gray-100 max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-blue-500 flex items-center gap-2">
              <Settings className="h-6 w-6" />
              Configure {selectedProvider?.displayName}
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              Update credentials and settings for this payment provider
            </DialogDescription>
          </DialogHeader>

          {selectedProvider && (
            <div className="space-y-6 py-4">
              {/* Test Mode */}
              <div className="flex items-center justify-between bg-gray-900/50 rounded-lg p-4 border border-gray-700">
                <div>
                  <Label className="text-gray-300 font-semibold">Test Mode</Label>
                  <p className="text-xs text-gray-500 mt-1">Use test/sandbox credentials</p>
                </div>
                <Switch
                  checked={selectedProvider.testMode}
                  onCheckedChange={(checked) =>
                    setSelectedProvider({ ...selectedProvider, testMode: checked })
                  }
                />
              </div>

              {/* Save to .env */}
              <div className="flex items-center justify-between bg-gray-900/50 rounded-lg p-4 border border-gray-700">
                <div>
                  <Label className="text-gray-300 font-semibold">Save to .env File</Label>
                  <p className="text-xs text-gray-500 mt-1">Write credentials to .env file</p>
                </div>
                <Switch
                  checked={selectedProvider.saveToEnv}
                  onCheckedChange={(checked) =>
                    setSelectedProvider({ ...selectedProvider, saveToEnv: checked })
                  }
                />
              </div>

              {/* Fee Settings Info */}
              <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-4">
                <p className="text-sm text-emerald-400 font-semibold flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Fee Configuration
                </p>
                <p className="text-xs text-gray-400 mt-2">
                  All deposit and withdrawal fees are now managed centrally in <strong>Settings → Fees</strong>. 
                  This includes both platform fees (charged to users) and bank fees (charged by Stripe/providers).
                </p>
              </div>

              {/* Webhook URL */}
              <div>
                <Label htmlFor="webhookUrl" className="text-gray-300">
                  Webhook URL (Optional)
                </Label>
                <Input
                  id="webhookUrl"
                  type="url"
                  value={selectedProvider.webhookUrl || ''}
                  onChange={(e) =>
                    setSelectedProvider({ ...selectedProvider, webhookUrl: e.target.value })
                  }
                  placeholder="https://yourapp.com/api/webhooks/provider"
                  className="bg-gray-900 border-gray-700 text-gray-100 mt-2"
                />
              </div>

              {/* Auto-Configure Webhooks - Only for Stripe and Paddle */}
              {['stripe', 'paddle'].includes(selectedProvider.slug) && (
                <div className="bg-gradient-to-r from-purple-500/10 to-blue-500/10 border border-purple-500/30 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Zap className="h-5 w-5 text-purple-400" />
                    <Label className="text-purple-300 font-semibold">Auto-Configure Webhooks (Optional)</Label>
                  </div>
                  
                  <p className="text-xs text-gray-400 mb-3">
                    Automatically create webhook endpoint in {selectedProvider.displayName} and save the secret.
                    This is optional - you can still configure webhooks manually.
                  </p>

                  {/* Main App URL Input */}
                  <div className="mb-3">
                    <Label className="text-xs text-gray-400 mb-1 block">
                      Main App URL (if different from current)
                    </Label>
                    <Input
                      type="url"
                      placeholder="https://your-main-app.ngrok-free.app"
                      value={mainAppUrl}
                      onChange={(e) => setMainAppUrl(e.target.value)}
                      className="bg-gray-900 border-gray-700 text-gray-100 text-xs h-8"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Leave empty to use current URL. Set this if admin runs on different port (e.g., 3001) than main app (3000).
                    </p>
                  </div>

                  {/* Detected URL */}
                  <div className="bg-gray-900/50 rounded p-2 mb-3 flex items-center justify-between">
                    <code className="text-xs text-gray-300 break-all">
                      {typeof window !== 'undefined' ? getDetectedWebhookUrl() : 'Loading...'}
                    </code>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(getDetectedWebhookUrl());
                        toast.success('URL copied!');
                      }}
                      className="ml-2 p-1 hover:bg-gray-700 rounded"
                    >
                      <Copy className="h-3 w-3 text-gray-400" />
                    </button>
                  </div>

                  {/* Localhost Warning */}
                  {isLocalhost() ? (
                    <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 mb-3">
                      <p className="text-sm text-yellow-400 font-semibold flex items-center gap-2">
                        <Terminal className="h-4 w-4" />
                        Localhost Detected
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        Auto-configure requires a public URL. For local development, use:
                      </p>
                      <div className="mt-2 space-y-2">
                        <div className="bg-gray-900 rounded p-2">
                          <code className="text-xs text-green-400">
                            {selectedProvider.slug === 'stripe' 
                              ? 'stripe listen --forward-to localhost:3000/api/stripe/webhook'
                              : '# Use ngrok: ngrok http 3000'}
                          </code>
                        </div>
                        {selectedProvider.slug === 'stripe' && (
                          <a
                            href="https://stripe.com/docs/stripe-cli"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-blue-400 hover:underline flex items-center gap-1"
                          >
                            <ExternalLink className="h-3 w-3" />
                            Stripe CLI Documentation
                          </a>
                        )}
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* Auto-configure button */}
                      <Button
                        type="button"
                        onClick={handleAutoConfigureWebhook}
                        disabled={isAutoConfiguring}
                        className="w-full bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white font-semibold"
                      >
                        {isAutoConfiguring ? (
                          <>
                            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                            Configuring...
                          </>
                        ) : (
                          <>
                            <Zap className="h-4 w-4 mr-2" />
                            Auto-Configure Webhooks
                          </>
                        )}
                      </Button>

                      {/* Result message */}
                      {autoConfigResult && (
                        <div className={`mt-3 rounded-lg p-3 ${
                          autoConfigResult.success 
                            ? 'bg-green-500/10 border border-green-500/30' 
                            : 'bg-red-500/10 border border-red-500/30'
                        }`}>
                          <p className={`text-sm ${autoConfigResult.success ? 'text-green-400' : 'text-red-400'}`}>
                            {autoConfigResult.success ? '✅ ' : '❌ '}
                            {autoConfigResult.message}
                          </p>
                          {autoConfigResult.success && autoConfigResult.webhookSecret && (
                            <div className="mt-2 p-2 bg-gray-900 rounded">
                              <p className="text-xs text-gray-400 mb-1">Webhook Secret (saved to database & .env):</p>
                              <code className="text-xs text-green-300 break-all">
                                {autoConfigResult.webhookSecret}
                              </code>
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  )}

                  <p className="text-xs text-gray-500 mt-3">
                    💡 This creates the webhook in {selectedProvider.displayName}&apos;s system and saves the secret to both database and .env file.
                  </p>
                </div>
              )}

              {/* Credentials */}
              <div>
                <Label className="text-gray-300 font-semibold mb-3 block">Credentials</Label>
                <div className="space-y-4">
                  {selectedProvider.credentials.map((cred, index) => (
                    <div key={index} className="bg-gray-900/50 rounded-lg p-4 border border-gray-700">
                      <div className="flex items-center justify-between mb-2">
                        <Label className="text-gray-400 text-sm uppercase tracking-wide">
                          {cred.key.replace(/_/g, ' ')}
                        </Label>
                        {cred.isSecret && (
                          <span className="text-xs px-2 py-1 bg-yellow-500/20 text-yellow-400 rounded">
                            Secret
                          </span>
                        )}
                      </div>
                      {cred.description && (
                        <p className="text-xs text-gray-500 mb-2">{cred.description}</p>
                      )}
                      <div className="relative">
                        <Input
                          type={showSecrets[`${selectedProvider._id}-${index}`] ? 'text' : 'password'}
                          value={cred.value}
                          onChange={(e) => {
                            const newCreds = [...selectedProvider.credentials];
                            newCreds[index].value = e.target.value;
                            setSelectedProvider({ ...selectedProvider, credentials: newCreds });
                          }}
                          placeholder={`Enter ${cred.key}`}
                          className="bg-gray-800 border-gray-600 text-gray-100 pr-10"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setShowSecrets({
                              ...showSecrets,
                              [`${selectedProvider._id}-${index}`]: !showSecrets[`${selectedProvider._id}-${index}`],
                            })
                          }
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-300"
                        >
                          {showSecrets[`${selectedProvider._id}-${index}`] ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Warning */}
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 flex items-start gap-2">
                <AlertCircle className="h-5 w-5 text-yellow-500 shrink-0 mt-0.5" />
                <div className="text-sm text-gray-300">
                  <p className="font-semibold text-yellow-500 mb-1">Important</p>
                  <p>
                    Changes will be saved to the database{selectedProvider.saveToEnv && ' and .env file'}.
                    Restart your application after saving for changes to take effect.
                  </p>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfigDialogOpen(false)}
              className="bg-gray-700 hover:bg-gray-600 text-gray-100 border-gray-600"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveConfig}
              className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-bold"
            >
              Save Configuration
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Custom Provider Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700 text-gray-100 max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-green-500 flex items-center gap-2">
              <Plus className="h-6 w-6" />
              Add Custom Payment Provider
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              Integrate any payment provider without coding
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Name */}
            <div>
              <Label htmlFor="name" className="text-gray-300">
                Provider Name *
              </Label>
              <Input
                id="name"
                value={newProvider.name}
                onChange={(e) => setNewProvider({ ...newProvider, name: e.target.value })}
                placeholder="e.g., PayPal"
                className="bg-gray-900 border-gray-700 text-gray-100 mt-2"
              />
            </div>

            {/* Slug */}
            <div>
              <Label htmlFor="slug" className="text-gray-300">
                Slug * (lowercase, no spaces)
              </Label>
              <Input
                id="slug"
                value={newProvider.slug}
                onChange={(e) =>
                  setNewProvider({ ...newProvider, slug: e.target.value.toLowerCase().replace(/\s+/g, '_') })
                }
                placeholder="e.g., paypal"
                className="bg-gray-900 border-gray-700 text-gray-100 mt-2"
              />
              <p className="text-xs text-gray-500 mt-1">Used for environment variable naming</p>
            </div>

            {/* Display Name */}
            <div>
              <Label htmlFor="displayName" className="text-gray-300">
                Display Name *
              </Label>
              <Input
                id="displayName"
                value={newProvider.displayName}
                onChange={(e) => setNewProvider({ ...newProvider, displayName: e.target.value })}
                placeholder="e.g., PayPal Payments"
                className="bg-gray-900 border-gray-700 text-gray-100 mt-2"
              />
            </div>

            {/* Logo */}
            <div>
              <Label htmlFor="logo" className="text-gray-300">
                Logo/Icon (emoji or URL)
              </Label>
              <Input
                id="logo"
                value={newProvider.logo}
                onChange={(e) => setNewProvider({ ...newProvider, logo: e.target.value })}
                placeholder="🏦 or https://..."
                className="bg-gray-900 border-gray-700 text-gray-100 mt-2"
              />
            </div>

            {/* Save to .env */}
            <div className="flex items-center justify-between bg-gray-900/50 rounded-lg p-4 border border-gray-700">
              <div>
                <Label className="text-gray-300 font-semibold">Save to .env File</Label>
                <p className="text-xs text-gray-500 mt-1">Write credentials to .env file</p>
              </div>
              <Switch
                checked={newProvider.saveToEnv}
                onCheckedChange={(checked) =>
                  setNewProvider({ ...newProvider, saveToEnv: checked })
                }
              />
            </div>

            {/* Fee Settings Info */}
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-4">
              <p className="text-sm text-emerald-400 font-semibold flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Fee Configuration
              </p>
              <p className="text-xs text-gray-400 mt-2">
                Deposit and withdrawal fees are managed centrally in <strong>Settings → Fees</strong>.
              </p>
            </div>

            {/* Credentials */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <Label className="text-gray-300 font-semibold">Credentials</Label>
                <Button
                  type="button"
                  onClick={addCredentialToNew}
                  size="sm"
                  variant="outline"
                  className="bg-green-500/10 hover:bg-green-500/20 text-green-400 border-green-500/30"
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Add Credential
                </Button>
              </div>

              <div className="space-y-3">
                {newProvider.credentials.map((cred, index) => (
                  <div key={index} className="bg-gray-900/50 rounded-lg p-4 border border-gray-700">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-3">
                        <div>
                          <Label className="text-gray-400 text-xs">Credential Key</Label>
                          <Input
                            value={cred.key}
                            onChange={(e) => {
                              const newCreds = [...newProvider.credentials];
                              newCreds[index].key = e.target.value.toLowerCase().replace(/\s+/g, '_');
                              setNewProvider({ ...newProvider, credentials: newCreds });
                            }}
                            placeholder="api_key"
                            className="bg-gray-800 border-gray-600 text-gray-100 text-sm mt-1"
                          />
                        </div>
                        <div>
                          <Label className="text-gray-400 text-xs">Description (Optional)</Label>
                          <Input
                            value={cred.description || ''}
                            onChange={(e) => {
                              const newCreds = [...newProvider.credentials];
                              newCreds[index].description = e.target.value;
                              setNewProvider({ ...newProvider, credentials: newCreds });
                            }}
                            placeholder="API key for authentication"
                            className="bg-gray-800 border-gray-600 text-gray-100 text-sm mt-1"
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={cred.isSecret}
                            onCheckedChange={(checked) => {
                              const newCreds = [...newProvider.credentials];
                              newCreds[index].isSecret = checked;
                              setNewProvider({ ...newProvider, credentials: newCreds });
                            }}
                          />
                          <Label className="text-gray-400 text-xs">Secret/Private Key</Label>
                        </div>
                      </div>
                      <Button
                        type="button"
                        onClick={() => removeCredentialFromNew(index)}
                        size="sm"
                        variant="outline"
                        className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border-red-500/30 mt-6"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}

                {newProvider.credentials.length === 0 && (
                  <p className="text-sm text-gray-500 text-center py-4">
                    No credentials added yet. Click &quot;Add Credential&quot; to get started.
                  </p>
                )}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAddDialogOpen(false)}
              className="bg-gray-700 hover:bg-gray-600 text-gray-100 border-gray-600"
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddProvider}
              className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-bold"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Provider
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

