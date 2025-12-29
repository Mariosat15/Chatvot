'use client';

import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { loadStripe, Stripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { Zap, Loader2, CheckCircle2, XCircle, ArrowRight, CreditCard, Globe, Gem } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAppSettings } from '@/contexts/AppSettingsContext';
import Script from 'next/script';

interface DepositModalProps {
  children: React.ReactNode;
}

interface PaymentProviders {
  stripe: {
    available: boolean;
    publishableKey: string;
    testMode: boolean;
  };
  paddle: {
    available: boolean;
    clientToken: string | null;
    environment: 'sandbox' | 'production';
    vendorId: string | null;
  };
  nuvei: {
    available: boolean;
    merchantId: string | null;
    siteId: string | null;
    testMode: boolean;
    sdkUrl: string;
  };
}

type PaymentProvider = 'stripe' | 'paddle' | 'nuvei';

// Declare SafeCharge global type
declare global {
  interface Window {
    SafeCharge?: (config: {
      env: string;
      merchantId: string;
      merchantSiteId: string;
    }) => {
      fields: (options?: { fonts?: Array<{ cssUrl: string }> }) => {
        create: (type: string, options?: { style?: Record<string, unknown>; classes?: Record<string, string> }) => {
          attach: (element: string | HTMLElement | null) => void;
          on: (event: string, callback: (evt: unknown) => void) => void;
        };
      };
      createPayment: (
        options: {
          sessionToken: string;
          clientUniqueId?: string;
          cardHolderName?: string;
          paymentOption: unknown;
          billingAddress?: {
            email?: string;
            country?: string;
          };
        },
        callback: (result: {
          result: string;
          errCode: string;
          errorDescription?: string;
          transactionId?: string;
        }) => void
      ) => void;
    };
  }
}

export default function DepositModal({ children }: DepositModalProps) {
  const { settings, eurToCredits } = useAppSettings();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState('50');
  const [clientSecret, setClientSecret] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [stripePromise, setStripePromise] = useState<Promise<Stripe | null> | null>(null);
  const [paymentConfigured, setPaymentConfigured] = useState<boolean | null>(null);
  const [checkingConfig, setCheckingConfig] = useState(true);
  const [processingFee, setProcessingFee] = useState(0);
  const [vatEnabled, setVatEnabled] = useState(false);
  const [vatPercentage, setVatPercentage] = useState(0);
  
  // Multi-provider support
  const [providers, setProviders] = useState<PaymentProviders | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<PaymentProvider>('stripe');
  const [step, setStep] = useState<'amount' | 'provider' | 'payment'>('amount');

  const minDeposit = (settings as { transactions?: { minimumDeposit?: number } })?.transactions?.minimumDeposit || 10;

  // Calculate VAT on the EUR amount
  const calculateVAT = (amountEur: number) => {
    if (!vatEnabled || vatPercentage <= 0) return 0;
    return amountEur * (vatPercentage / 100);
  };

  // Calculate platform fee on the EUR amount
  const calculatePlatformFee = (amountEur: number) => {
    if (processingFee <= 0) return 0;
    return amountEur * (processingFee / 100);
  };

  // Calculate total payment
  const calculateTotalPayment = (amountEur: number) => {
    const vat = calculateVAT(amountEur);
    const platformFee = calculatePlatformFee(amountEur);
    return amountEur + vat + platformFee;
  };

  // Check payment configuration on mount
  useEffect(() => {
    async function checkPaymentConfig() {
      try {
        const response = await fetch('/api/payment-config');
        const config = await response.json();
        
        setPaymentConfigured(config.configured);
        setProcessingFee(config.processingFee || 0);
        setVatEnabled(config.vatEnabled || false);
        setVatPercentage(config.vatPercentage || 0);
        setProviders(config.providers || null);
        
        // Determine default provider
        if (config.providers) {
          if (config.providers.stripe?.available) {
            setSelectedProvider('stripe');
            const stripe = loadStripe(config.providers.stripe.publishableKey);
            setStripePromise(stripe);
          } else if (config.providers.nuvei?.available) {
            setSelectedProvider('nuvei');
          } else if (config.providers.paddle?.available) {
            setSelectedProvider('paddle');
          }
        } else if (config.configured && config.publishableKey) {
          // Fallback to legacy config
          const stripe = loadStripe(config.publishableKey);
          setStripePromise(stripe);
        }
      } catch (error) {
        console.error('Error checking payment configuration:', error);
        setPaymentConfigured(false);
      } finally {
        setCheckingConfig(false);
      }
    }
    
    if (open) {
      setCheckingConfig(true);
      checkPaymentConfig();
    }
  }, [open]);

  // Nuvei state
  const [nuveiLoaded, setNuveiLoaded] = useState(false);
  const [nuveiSessionToken, setNuveiSessionToken] = useState('');
  const [nuveiClientUniqueId, setNuveiClientUniqueId] = useState('');
  const [nuveiUserEmail, setNuveiUserEmail] = useState('');

  // Get available provider count
  const getAvailableProviders = () => {
    if (!providers) return [];
    const available: PaymentProvider[] = [];
    if (providers.stripe?.available) available.push('stripe');
    if (providers.nuvei?.available) available.push('nuvei');
    if (providers.paddle?.available) available.push('paddle');
    return available;
  };

  const handleAmountSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const amountNum = parseFloat(amount);
    const currencySymbol = settings?.currency?.symbol || '€';

    if (isNaN(amountNum) || amountNum < minDeposit) {
      setError(`Minimum is ${currencySymbol}${minDeposit}`);
      return;
    }

    if (amountNum > 10000) {
      setError(`Maximum is ${currencySymbol}10,000`);
      return;
    }

    const availableProviders = getAvailableProviders();
    
    // If multiple providers available, show provider selection
    if (availableProviders.length > 1) {
      setStep('provider');
    } else if (availableProviders.length === 1) {
      // Single provider - proceed directly
      setSelectedProvider(availableProviders[0]);
      await proceedWithProvider(availableProviders[0]);
    } else {
      setError('No payment provider configured');
    }
  };

  const proceedWithProvider = async (provider: PaymentProvider) => {
    setLoading(true);
    setError('');

    try {
      const amountNum = parseFloat(amount);
      const vatAmount = calculateVAT(amountNum);
      const platformFeeAmount = calculatePlatformFee(amountNum);
      const totalPayment = calculateTotalPayment(amountNum);

      if (provider === 'stripe') {
        // Create Stripe payment intent
        const response = await fetch('/api/stripe/create-payment-intent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            amount: amountNum,
            totalAmount: totalPayment,
            vatAmount,
            vatPercentage: vatEnabled ? vatPercentage : 0,
            platformFeeAmount,
            platformFeePercentage: processingFee,
          }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to create payment intent');
        }

        const data = await response.json();
        setClientSecret(data.clientSecret);
        setStep('payment');
      } else if (provider === 'nuvei') {
        // Create Nuvei session
        const response = await fetch('/api/nuvei/open-order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            amount: totalPayment,
            currency: settings?.currency?.code || 'EUR',
          }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to create Nuvei session');
        }

        const data = await response.json();
        setNuveiSessionToken(data.sessionToken);
        setNuveiClientUniqueId(data.clientUniqueId);
        setNuveiUserEmail(data.userEmail || '');
        setStep('payment');
      } else if (provider === 'paddle') {
        // Create Paddle checkout
        const response = await fetch('/api/paddle/create-checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            amount: amountNum,
            currency: settings?.currency?.code || 'EUR',
          }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to create Paddle checkout');
        }

        const data = await response.json();
        
        // Paddle redirects to hosted checkout
        if (data.checkoutUrl) {
          window.location.href = data.checkoutUrl;
        } else {
          throw new Error('No checkout URL received from Paddle');
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setStep('amount');
    } finally {
      setLoading(false);
    }
  };

  const resetModal = () => {
    setAmount('50');
    setClientSecret('');
    setError('');
    setLoading(false);
    setStep('amount');
    // Reset Nuvei state
    setNuveiSessionToken('');
    setNuveiClientUniqueId('');
    setNuveiUserEmail('');
    setNuveiLoaded(false);
  };

  const renderProviderIcon = (provider: PaymentProvider) => {
    switch (provider) {
      case 'stripe':
        return <CreditCard className="h-5 w-5" />;
      case 'nuvei':
        return <Gem className="h-5 w-5" />;
      case 'paddle':
        return <Globe className="h-5 w-5" />;
    }
  };

  const getProviderName = (provider: PaymentProvider) => {
    switch (provider) {
      case 'stripe':
        return 'Credit/Debit Card';
      case 'nuvei':
        return 'Nuvei Secure Payment';
      case 'paddle':
        return 'Paddle (Global)';
    }
  };

  const getProviderDescription = (provider: PaymentProvider) => {
    switch (provider) {
      case 'stripe':
        return 'Pay securely with your card';
      case 'nuvei':
        return 'Fast & secure card payments';
      case 'paddle':
        return 'Multiple payment methods, taxes included';
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      setOpen(isOpen);
      if (!isOpen) resetModal();
    }}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>

      <DialogContent className="bg-gray-900 border-gray-700 max-sm:border-0" fullScreenMobile size="default">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-gray-100">
            <Zap className="h-5 w-5 text-yellow-500" />
            Buy {settings?.credits.name || 'Credits'}
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            Purchase {settings?.credits.name || 'credits'} to enter competitions and start trading
          </DialogDescription>
        </DialogHeader>

        {checkingConfig ? (
          <div className="py-8 text-center space-y-4">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-green-500" />
            <p className="text-sm text-gray-400">Checking payment options...</p>
          </div>
        ) : !paymentConfigured ? (
          <div className="py-8 text-center space-y-4">
            <div className="mx-auto w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center">
              <XCircle className="h-8 w-8 text-red-500" />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-gray-100">Payment System Not Configured</h3>
              <p className="text-sm text-gray-400 mt-2">
                No payment provider is set up. Please contact the administrator.
              </p>
            </div>
            <Button onClick={() => setOpen(false)} variant="outline" className="mt-4">
              Close
            </Button>
          </div>
        ) : step === 'amount' ? (
          // Step 1: Enter Amount
          <form onSubmit={handleAmountSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="amount" className="text-gray-300">
                Amount ({settings?.currency?.code || 'EUR'})
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">{settings?.currency?.symbol || '€'}</span>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  min={minDeposit}
                  max="10000"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="pl-8 bg-gray-800 border-gray-700 text-gray-100"
                  placeholder="50.00"
                  required
                />
              </div>
              <p className="text-xs text-gray-500">Minimum: {settings?.currency?.symbol || '€'}{minDeposit} • Maximum: {settings?.currency?.symbol || '€'}10,000</p>
            </div>

            {/* Conversion Preview */}
            {amount && !isNaN(parseFloat(amount)) && settings && (() => {
              const amountNum = parseFloat(amount);
              const vatAmount = calculateVAT(amountNum);
              const platformFeeAmount = calculatePlatformFee(amountNum);
              const totalPayment = calculateTotalPayment(amountNum);
              const creditsReceived = eurToCredits(amountNum);
              
              return (
                <div className="space-y-3">
                  <div className="rounded-lg bg-yellow-500/10 border border-yellow-500/20 p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl font-bold text-white">{settings.currency.symbol}{amountNum.toFixed(2)}</span>
                      </div>
                      <ArrowRight className="h-5 w-5 text-yellow-500" />
                      <div className="flex items-center gap-2">
                        <Zap className="h-5 w-5 text-yellow-500" />
                        <span className="text-2xl font-bold text-yellow-400">
                          {creditsReceived.toFixed(settings.credits.decimals)} {settings.credits.symbol}
                        </span>
                      </div>
                    </div>
                    
                    <div className="mt-3 pt-3 border-t border-yellow-500/20 space-y-1 text-sm">
                      <div className="flex justify-between text-gray-400">
                        <span>Credits Value:</span>
                        <span className="text-gray-300">{settings.currency.symbol}{amountNum.toFixed(2)}</span>
                      </div>
                      
                      {vatEnabled && vatAmount > 0 && (
                        <div className="flex justify-between text-gray-400">
                          <span>VAT ({vatPercentage}%):</span>
                          <span className="text-orange-400">+{settings.currency.symbol}{vatAmount.toFixed(2)}</span>
                        </div>
                      )}
                      
                      {processingFee > 0 && (
                        <div className="flex justify-between text-gray-400">
                          <span>Platform Fee ({processingFee}%):</span>
                          <span className="text-orange-400">+{settings.currency.symbol}{platformFeeAmount.toFixed(2)}</span>
                        </div>
                      )}
                      
                      {(vatEnabled || processingFee > 0) && (
                        <div className="flex justify-between font-semibold text-white pt-1 border-t border-yellow-500/20">
                          <span>Total to Pay:</span>
                          <span>{settings.currency.symbol}{totalPayment.toFixed(2)}</span>
                        </div>
                      )}
                      
                      <div className="flex justify-between font-semibold text-yellow-400 pt-1 border-t border-yellow-500/20">
                        <span>You Receive:</span>
                        <span>{creditsReceived.toFixed(settings.credits.decimals)} {settings.credits.symbol}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Quick Amount Buttons */}
            <div className="grid grid-cols-4 gap-2">
              {[10, 25, 50, 100].map((preset) => (
                <Button
                  key={preset}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setAmount(preset.toString())}
                  className="bg-gray-800 border-gray-700 hover:bg-gray-700 text-gray-100"
                >
                  {settings?.currency?.symbol || '€'}{preset}
                </Button>
              ))}
            </div>

            {error && (
              <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3 flex items-start gap-2">
                <XCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                <p className="text-xs text-red-400">{error}</p>
              </div>
            )}

            <Button
              type="submit"
              className="w-full bg-yellow-500 hover:bg-yellow-600 text-gray-900 font-semibold"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                'Continue to Payment'
              )}
            </Button>
          </form>
        ) : step === 'provider' ? (
          // Step 2: Select Payment Provider
          <div className="space-y-6">
            <div className="space-y-3">
              <Label className="text-gray-300">Select Payment Method</Label>
              
              {getAvailableProviders().map((provider) => (
                <button
                  key={provider}
                  type="button"
                  onClick={() => {
                    setSelectedProvider(provider);
                    proceedWithProvider(provider);
                  }}
                  disabled={loading}
                  className={`w-full p-4 rounded-lg border-2 transition-all ${
                    selectedProvider === provider
                      ? 'border-yellow-500 bg-yellow-500/10'
                      : 'border-gray-700 bg-gray-800/50 hover:border-gray-600'
                  } ${loading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`p-2 rounded-lg ${
                      selectedProvider === provider ? 'bg-yellow-500/20 text-yellow-500' : 'bg-gray-700 text-gray-400'
                    }`}>
                      {renderProviderIcon(provider)}
                    </div>
                    <div className="flex-1 text-left">
                      <div className="font-semibold text-gray-100">{getProviderName(provider)}</div>
                      <div className="text-sm text-gray-400">{getProviderDescription(provider)}</div>
                    </div>
                    {loading && selectedProvider === provider && (
                      <Loader2 className="h-5 w-5 animate-spin text-yellow-500" />
                    )}
                  </div>
                </button>
              ))}
            </div>

            {/* Summary */}
            <div className="rounded-lg bg-gray-800/50 border border-gray-700 p-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-400">Total to Pay</span>
                <span className="text-lg font-bold text-white">
                  {settings?.currency?.symbol || '€'}{calculateTotalPayment(parseFloat(amount)).toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between items-center mt-2">
                <span className="text-sm text-gray-400">You Receive</span>
                <span className="text-yellow-400 font-bold flex items-center gap-1">
                  <Zap className="h-4 w-4" />
                  {eurToCredits(parseFloat(amount)).toFixed(settings?.credits?.decimals || 2)} {settings?.credits?.symbol || 'Credits'}
                </span>
              </div>
            </div>

            {error && (
              <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3 flex items-start gap-2">
                <XCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                <p className="text-xs text-red-400">{error}</p>
              </div>
            )}

            <Button
              type="button"
              variant="outline"
              onClick={() => setStep('amount')}
              disabled={loading}
              className="w-full bg-gray-800 border-gray-700 hover:bg-gray-700 text-gray-100"
            >
              Back
            </Button>
          </div>
        ) : step === 'payment' && clientSecret && stripePromise && selectedProvider === 'stripe' ? (
          // Step 3: Stripe Payment Form
          <Elements
            stripe={stripePromise}
            options={{
              clientSecret,
              appearance: {
                theme: 'night',
                variables: {
                  colorPrimary: '#EAB308',
                  colorBackground: '#1F2937',
                  colorText: '#F3F4F6',
                  colorDanger: '#EF4444',
                  borderRadius: '8px',
                },
              },
            }}
          >
            <PaymentForm
              amount={parseFloat(amount)}
              totalAmount={calculateTotalPayment(parseFloat(amount))}
              vatAmount={calculateVAT(parseFloat(amount))}
              vatEnabled={vatEnabled}
              vatPercentage={vatPercentage}
              platformFeeAmount={calculatePlatformFee(parseFloat(amount))}
              platformFeePercentage={processingFee}
              onSuccess={() => {
                setOpen(false);
                resetModal();
              }}
              onCancel={() => setStep('provider')}
            />
          </Elements>
        ) : step === 'payment' && nuveiSessionToken && selectedProvider === 'nuvei' && providers?.nuvei ? (
          // Step 3: Nuvei Payment Form
          <>
            {/* Load Nuvei SDK - use afterInteractive for faster loading */}
            <Script
              src={providers.nuvei.sdkUrl}
              onLoad={() => {
                console.log('Nuvei SDK loaded successfully');
                setNuveiLoaded(true);
              }}
              onError={(e) => {
                console.error('Failed to load Nuvei SDK:', e);
                setError('Failed to load payment form. Please refresh and try again.');
              }}
              strategy="afterInteractive"
            />
            {!nuveiLoaded ? (
              // Show loading while SDK loads
              <div className="py-12 text-center space-y-4">
                <Loader2 className="h-8 w-8 animate-spin mx-auto text-green-500" />
                <p className="text-sm text-gray-400">Loading secure payment form...</p>
              </div>
            ) : (
              <NuveiPaymentForm
                sessionToken={nuveiSessionToken}
                clientUniqueId={nuveiClientUniqueId}
                merchantId={providers.nuvei.merchantId || ''}
                siteId={providers.nuvei.siteId || ''}
                testMode={providers.nuvei.testMode}
                amount={parseFloat(amount)}
                totalAmount={calculateTotalPayment(parseFloat(amount))}
                vatAmount={calculateVAT(parseFloat(amount))}
                vatEnabled={vatEnabled}
                vatPercentage={vatPercentage}
                platformFeeAmount={calculatePlatformFee(parseFloat(amount))}
                platformFeePercentage={processingFee}
                sdkLoaded={nuveiLoaded}
                userEmail={nuveiUserEmail}
                onSuccess={() => {
                  setOpen(false);
                  resetModal();
                }}
                onCancel={() => setStep('provider')}
              />
            )}
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

// Payment Form Component (inside Stripe Elements)
function PaymentForm({ 
  amount, 
  totalAmount,
  vatAmount,
  vatEnabled,
  vatPercentage,
  platformFeeAmount,
  platformFeePercentage,
  onSuccess, 
  onCancel 
}: { 
  amount: number; 
  totalAmount: number;
  vatAmount: number;
  vatEnabled: boolean;
  vatPercentage: number;
  platformFeeAmount: number;
  platformFeePercentage: number;
  onSuccess: () => void; 
  onCancel: () => void 
}) {
  const stripe = useStripe();
  const elements = useElements();
  const router = useRouter();
  const { settings, eurToCredits } = useAppSettings();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const creditsReceived = eurToCredits(amount);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { error: submitError } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/wallet?payment=success`,
        },
        redirect: 'if_required',
      });

      if (submitError) {
        setError(submitError.message || 'Payment failed');
        setLoading(false);
      } else {
        setSuccess(true);
        setTimeout(() => {
          router.refresh();
          onSuccess();
        }, 2000);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Payment failed');
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="py-8 text-center space-y-4">
        <div className="mx-auto w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center">
          <CheckCircle2 className="h-8 w-8 text-green-500" />
        </div>
        <div>
          <h3 className="text-xl font-semibold text-gray-100">Payment Successful!</h3>
          <p className="text-sm text-gray-400 mt-2">
            {creditsReceived.toFixed(settings?.credits?.decimals || 2)} {settings?.credits?.symbol || 'Credits'} added to your wallet
          </p>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="rounded-lg bg-gray-800/50 border border-gray-700 p-4 space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-400">Credits Value</span>
          <span className="text-lg font-bold text-gray-100">{settings?.currency?.symbol || '€'}{amount.toFixed(2)}</span>
        </div>
        
        {vatEnabled && vatAmount > 0 && (
          <div className="flex justify-between items-center text-sm">
            <span className="text-gray-500">VAT ({vatPercentage}%)</span>
            <span className="text-orange-400">+{settings?.currency?.symbol || '€'}{vatAmount.toFixed(2)}</span>
          </div>
        )}
        
        {platformFeePercentage > 0 && platformFeeAmount > 0 && (
          <div className="flex justify-between items-center text-sm">
            <span className="text-gray-500">Platform Fee ({platformFeePercentage}%)</span>
            <span className="text-orange-400">+{settings?.currency?.symbol || '€'}{platformFeeAmount.toFixed(2)}</span>
          </div>
        )}
        
        {(vatEnabled || platformFeePercentage > 0) && (
          <div className="flex justify-between items-center pt-2 border-t border-gray-600">
            <span className="text-sm font-semibold text-gray-300">Total to Pay</span>
            <span className="text-lg font-bold text-white">{settings?.currency?.symbol || '€'}{totalAmount.toFixed(2)}</span>
          </div>
        )}
        
        <div className="flex justify-between items-center pt-2 border-t border-gray-700">
          <span className="text-sm font-semibold text-gray-300">You Receive</span>
          <span className="text-yellow-400 font-bold flex items-center gap-1">
            <Zap className="h-4 w-4" />
            {creditsReceived.toFixed(settings?.credits?.decimals || 2)} {settings?.credits?.symbol || 'Credits'}
          </span>
        </div>
      </div>

      <PaymentElement />

      {error && (
        <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3 flex items-start gap-2">
          <XCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
          <p className="text-xs text-red-400">{error}</p>
        </div>
      )}

      <div className="flex gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={loading}
          className="flex-1 bg-gray-800 border-gray-700 hover:bg-gray-700 text-gray-100"
        >
          Back
        </Button>
        <Button
          type="submit"
          disabled={!stripe || loading}
          className="flex-1 bg-yellow-500 hover:bg-yellow-600 text-gray-900 font-semibold"
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Processing...
            </>
          ) : (
            `Pay ${settings?.currency?.symbol || '€'}${totalAmount.toFixed(2)}`
          )}
        </Button>
      </div>

      <p className="text-xs text-center text-gray-500">
        Secured by Stripe • Your payment information is encrypted
      </p>
    </form>
  );
}

// Nuvei Payment Form Component
function NuveiPaymentForm({ 
  sessionToken,
  clientUniqueId,
  merchantId,
  siteId,
  testMode,
  amount, 
  totalAmount,
  vatAmount,
  vatEnabled,
  vatPercentage,
  platformFeeAmount,
  platformFeePercentage,
  sdkLoaded,
  userEmail,
  onSuccess, 
  onCancel 
}: { 
  sessionToken: string;
  clientUniqueId: string;
  merchantId: string;
  siteId: string;
  testMode: boolean;
  amount: number; 
  totalAmount: number;
  vatAmount: number;
  vatEnabled: boolean;
  vatPercentage: number;
  platformFeeAmount: number;
  platformFeePercentage: number;
  sdkLoaded: boolean;
  userEmail: string;
  onSuccess: () => void; 
  onCancel: () => void 
}) {
  const router = useRouter();
  const { settings, eurToCredits } = useAppSettings();
  const cardFieldRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [scard, setScard] = useState<any>(null);
  const [sfcInitialized, setSfcInitialized] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [cardHolderName, setCardHolderName] = useState('');
  const [email, setEmail] = useState(userEmail || '');
  const [cardFieldReady, setCardFieldReady] = useState(false);

  // Safe calculation with fallback
  const creditsReceived = typeof amount === 'number' && !isNaN(amount) ? eurToCredits(amount) : 0;

  // Initialize Nuvei when SDK is loaded
  useEffect(() => {
    if (!sdkLoaded || !window.SafeCharge || sfcInitialized || !cardFieldRef.current) {
      console.log('Nuvei init check:', { sdkLoaded, hasWindow: !!window.SafeCharge, sfcInitialized, hasRef: !!cardFieldRef.current });
      return;
    }

    try {
      console.log('Initializing Nuvei with:', { merchantId, siteId, testMode });
      
      // Initialize SafeCharge
      const sfc = window.SafeCharge({
        env: testMode ? 'int' : 'prod',
        merchantId: merchantId,
        merchantSiteId: siteId,
      });

      // Create fields instance
      const ScFields = sfc.fields({
        fonts: [{ cssUrl: 'https://fonts.googleapis.com/css?family=Inter' }],
      });

      // Nuvei Fields styles
      const style = {
        base: {
          color: '#F3F4F6',
          fontWeight: '500',
          fontFamily: 'Inter, sans-serif',
          fontSize: '16px',
          fontSmoothing: 'antialiased',
          '::placeholder': {
            color: '#9CA3AF',
          },
        },
        invalid: {
          color: '#EF4444',
          '::placeholder': {
            color: '#FCA5A5',
          },
        },
      };

      // Create card field
      const cardField = ScFields.create('card', { style });
      cardField.attach(cardFieldRef.current);

      // Listen for ready event
      cardField.on('ready', () => {
        console.log('Nuvei card field ready');
        setCardFieldReady(true);
      });

      // Listen for error
      cardField.on('error', (evt: unknown) => {
        console.error('Nuvei card field error:', evt);
      });

      // Store reference for payment
      setScard(cardField);
      setSfcInitialized(true);
      console.log('Nuvei SDK initialized successfully');
    } catch (err) {
      console.error('Failed to initialize Nuvei:', err);
      setError('Failed to initialize payment form. Please try again.');
    }
  }, [sdkLoaded, merchantId, siteId, testMode, sfcInitialized]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!scard || !window.SafeCharge) {
      setError('Payment form not ready');
      return;
    }

    if (!cardHolderName.trim()) {
      setError('Please enter the cardholder name');
      return;
    }

    if (!email.trim() || !email.includes('@')) {
      setError('Please enter a valid email address');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const sfc = window.SafeCharge({
        env: testMode ? 'int' : 'prod',
        merchantId: merchantId,
        merchantSiteId: siteId,
      });

      // Parse cardholder name into first/last name
      const nameParts = cardHolderName.trim().split(' ');
      const firstName = nameParts[0] || 'Customer';
      const lastName = nameParts.slice(1).join(' ') || 'Customer';

      // Create payment with required user details
      sfc.createPayment(
        {
          sessionToken,
          clientUniqueId,
          cardHolderName: cardHolderName.trim(),
          paymentOption: scard,
          userDetails: {
            firstName,
            lastName,
            email: email.trim(),
          },
          billingAddress: {
            email: email.trim(),
            country: 'US',
          },
        } as Parameters<typeof sfc.createPayment>[0],
        async (result) => {
          console.log('Nuvei payment result:', result);

          if (result.result === 'APPROVED' && result.errCode === '0') {
            // Verify payment on server
            const verifyResponse = await fetch('/api/nuvei/payment-status', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                sessionToken,
                clientUniqueId,
              }),
            });

            const verifyData = await verifyResponse.json();

            if (verifyData.success || verifyData.status === 'APPROVED') {
              setSuccess(true);
              setTimeout(() => {
                router.refresh();
                onSuccess();
              }, 2000);
            } else {
              setError(verifyData.reason || 'Payment verification failed');
              setLoading(false);
            }
          } else {
            setError(result.errorDescription || result.result || 'Payment failed');
            setLoading(false);
          }
        }
      );
    } catch (err) {
      console.error('Nuvei payment error:', err);
      setError(err instanceof Error ? err.message : 'Payment failed');
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="py-8 text-center space-y-4">
        <div className="mx-auto w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center">
          <CheckCircle2 className="h-8 w-8 text-green-500" />
        </div>
        <div>
          <h3 className="text-xl font-semibold text-gray-100">Payment Successful!</h3>
          <p className="text-sm text-gray-400 mt-2">
            {(creditsReceived || 0).toFixed(settings?.credits?.decimals ?? 2)} {settings?.credits?.symbol || 'Credits'} added to your wallet
          </p>
        </div>
      </div>
    );
  }

  if (!sdkLoaded) {
    return (
      <div className="py-8 text-center space-y-4">
        <Loader2 className="h-8 w-8 animate-spin mx-auto text-green-500" />
        <p className="text-sm text-gray-400">Loading secure payment form...</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="rounded-lg bg-gray-800/50 border border-gray-700 p-4 space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-400">Credits Value</span>
          <span className="text-lg font-bold text-gray-100">{settings?.currency?.symbol || '€'}{amount.toFixed(2)}</span>
        </div>
        
        {vatEnabled && vatAmount > 0 && (
          <div className="flex justify-between items-center text-sm">
            <span className="text-gray-500">VAT ({vatPercentage}%)</span>
            <span className="text-orange-400">+{settings?.currency?.symbol || '€'}{vatAmount.toFixed(2)}</span>
          </div>
        )}
        
        {platformFeePercentage > 0 && platformFeeAmount > 0 && (
          <div className="flex justify-between items-center text-sm">
            <span className="text-gray-500">Platform Fee ({platformFeePercentage}%)</span>
            <span className="text-orange-400">+{settings?.currency?.symbol || '€'}{platformFeeAmount.toFixed(2)}</span>
          </div>
        )}
        
        {(vatEnabled || platformFeePercentage > 0) && (
          <div className="flex justify-between items-center pt-2 border-t border-gray-600">
            <span className="text-sm font-semibold text-gray-300">Total to Pay</span>
            <span className="text-lg font-bold text-white">{settings?.currency?.symbol || '€'}{totalAmount.toFixed(2)}</span>
          </div>
        )}
        
        <div className="flex justify-between items-center pt-2 border-t border-gray-700">
          <span className="text-sm font-semibold text-gray-300">You Receive</span>
          <span className="text-yellow-400 font-bold flex items-center gap-1">
            <Zap className="h-4 w-4" />
            {creditsReceived.toFixed(settings?.credits?.decimals || 2)} {settings?.credits?.symbol || 'Credits'}
          </span>
        </div>
      </div>

      {/* Cardholder Name */}
      <div className="space-y-2">
        <Label htmlFor="cardHolderName" className="text-gray-300">Cardholder Name</Label>
        <Input
          id="cardHolderName"
          type="text"
          value={cardHolderName}
          onChange={(e) => setCardHolderName(e.target.value)}
          className="bg-gray-800 border-gray-700 text-gray-100"
          placeholder="John Smith"
          required
        />
      </div>

      {/* Email */}
      <div className="space-y-2">
        <Label htmlFor="email" className="text-gray-300">Email Address</Label>
        <Input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="bg-gray-800 border-gray-700 text-gray-100"
          placeholder="john@example.com"
          required
        />
      </div>

      {/* Nuvei Card Field */}
      <div className="space-y-2">
        <Label className="text-gray-300">Card Details</Label>
        <div
          ref={cardFieldRef}
          className="bg-gray-800 border border-gray-700 rounded-lg p-4 min-h-[50px] relative"
        >
          {!cardFieldReady && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-800 rounded-lg">
              <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
              <span className="ml-2 text-sm text-gray-400">Loading card form...</span>
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3 flex items-start gap-2">
          <XCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
          <p className="text-xs text-red-400">{error}</p>
        </div>
      )}

      <div className="flex gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={loading}
          className="flex-1 bg-gray-800 border-gray-700 hover:bg-gray-700 text-gray-100"
        >
          Back
        </Button>
        <Button
          type="submit"
          disabled={loading || !sfcInitialized}
          className="flex-1 bg-yellow-500 hover:bg-yellow-600 text-gray-900 font-semibold"
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Processing...
            </>
          ) : (
            `Pay ${settings?.currency?.symbol || '€'}${totalAmount.toFixed(2)}`
          )}
        </Button>
      </div>

      <p className="text-xs text-center text-gray-500">
        Secured by Nuvei • Your payment information is encrypted
      </p>
    </form>
  );
}
