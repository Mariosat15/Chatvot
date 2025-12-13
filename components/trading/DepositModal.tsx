'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { loadStripe, Stripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { Zap, Loader2, CheckCircle2, XCircle, ArrowRight } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAppSettings } from '@/contexts/AppSettingsContext';

interface DepositModalProps {
  children: React.ReactNode;
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
  const [processingFee, setProcessingFee] = useState(0); // Percentage
  const [vatEnabled, setVatEnabled] = useState(false);
  const [vatPercentage, setVatPercentage] = useState(0);

  const minDeposit = settings?.transactions?.minimumDeposit || 10;

  // Calculate VAT on the EUR amount
  const calculateVAT = (amountEur: number) => {
    if (!vatEnabled || vatPercentage <= 0) return 0;
    return amountEur * (vatPercentage / 100);
  };

  // Calculate platform fee on the EUR amount (charged to card, not deducted from credits)
  const calculatePlatformFee = (amountEur: number) => {
    if (processingFee <= 0) return 0;
    return amountEur * (processingFee / 100);
  };

  // Calculate total payment (base + VAT + platform fee)
  const calculateTotalPayment = (amountEur: number) => {
    const vat = calculateVAT(amountEur);
    const platformFee = calculatePlatformFee(amountEur);
    return amountEur + vat + platformFee;
  };

  // Check if payment provider is configured on mount
  useEffect(() => {
    async function checkPaymentConfig() {
      try {
        const response = await fetch('/api/payment-config');
        const config = await response.json();
        
        setPaymentConfigured(config.configured);
        setProcessingFee(config.processingFee || 0); // Store fee percentage
        setVatEnabled(config.vatEnabled || false);
        setVatPercentage(config.vatPercentage || 0);
        
        if (config.configured && config.publishableKey) {
          // Initialize Stripe with database credentials
          const stripe = loadStripe(config.publishableKey);
          setStripePromise(stripe);
        } else {
          setStripePromise(Promise.resolve(null));
        }
      } catch (error) {
        console.error('Error checking payment configuration:', error);
        setPaymentConfigured(false);
        setStripePromise(Promise.resolve(null));
      } finally {
        setCheckingConfig(false);
      }
    }
    
    if (open) {
      checkPaymentConfig();
    }
  }, [open]);

  const handleAmountSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const amountNum = parseFloat(amount);
      const currencySymbol = settings?.currency.symbol || '€';

      if (isNaN(amountNum) || amountNum < minDeposit) {
        setError(`Minimum is ${currencySymbol}${minDeposit}`);
        setLoading(false);
        return;
      }

      if (amountNum > 10000) {
        setError(`Maximum is ${currencySymbol}10,000`);
        setLoading(false);
        return;
      }

      // Calculate fees (all charged to card)
      const vatAmount = calculateVAT(amountNum);
      const platformFeeAmount = calculatePlatformFee(amountNum);
      const totalPayment = calculateTotalPayment(amountNum);

      // Create payment intent with total including all fees
      const response = await fetch('/api/stripe/create-payment-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          amount: amountNum, // Base amount for credits (user receives full credits)
          totalAmount: totalPayment, // Amount to charge (including VAT + platform fee)
          vatAmount: vatAmount,
          vatPercentage: vatEnabled ? vatPercentage : 0,
          platformFeeAmount: platformFeeAmount,
          platformFeePercentage: processingFee,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create payment intent');
      }

      const data = await response.json();
      setClientSecret(data.clientSecret);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const resetModal = () => {
    setAmount('50');
    setClientSecret('');
    setError('');
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      setOpen(isOpen);
      if (!isOpen) resetModal();
    }}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>

      <DialogContent className="sm:max-w-[500px] bg-gray-900 border-gray-700">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-gray-100">
            <Zap className="h-5 w-5 text-yellow-500" />
            Buy {settings?.credits.name || 'Credits'}
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            Purchase {settings?.credits.name || 'credits'} to enter competitions and start trading
          </DialogDescription>
        </DialogHeader>

        {!clientSecret ? (
          // Step 1: Enter Amount
          <form onSubmit={handleAmountSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="amount" className="text-gray-300">
                Amount ({settings?.currency.code || 'EUR'})
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">{settings?.currency.symbol || '€'}</span>
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
              <p className="text-xs text-gray-500">Minimum: {settings?.currency.symbol || '€'}{minDeposit} • Maximum: {settings?.currency.symbol || '€'}10,000</p>
            </div>

            {/* Conversion Preview with Fee Breakdown */}
            {amount && !isNaN(parseFloat(amount)) && settings && (() => {
              const amountNum = parseFloat(amount);
              const vatAmount = calculateVAT(amountNum);
              const platformFeeAmount = calculatePlatformFee(amountNum);
              const totalPayment = calculateTotalPayment(amountNum);
              const creditsReceived = eurToCredits(amountNum); // Full credits, no deduction
              
              return (
                <div className="space-y-3">
                  {/* Main Conversion */}
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
                    
                    {/* Fee Breakdown - All fees charged to card */}
                    <div className="mt-3 pt-3 border-t border-yellow-500/20 space-y-1 text-sm">
                      <div className="flex justify-between text-gray-400">
                        <span>Credits Value:</span>
                        <span className="text-gray-300">{settings.currency.symbol}{amountNum.toFixed(2)}</span>
                      </div>
                      
                      {/* VAT Line */}
                      {vatEnabled && vatAmount > 0 && (
                        <div className="flex justify-between text-gray-400">
                          <span>VAT ({vatPercentage}%):</span>
                          <span className="text-orange-400">+{settings.currency.symbol}{vatAmount.toFixed(2)}</span>
                        </div>
                      )}
                      
                      {/* Platform Fee Line */}
                      {processingFee > 0 && (
                        <div className="flex justify-between text-gray-400">
                          <span>Platform Fee ({processingFee}%):</span>
                          <span className="text-orange-400">+{settings.currency.symbol}{platformFeeAmount.toFixed(2)}</span>
                        </div>
                      )}
                      
                      {/* Total Payment Line */}
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
                  
                  {/* Info Messages */}
                  {(vatEnabled || processingFee > 0) && (
                    <div className="text-xs text-gray-500 flex items-start gap-2 bg-gray-800/50 rounded-lg p-3 border border-gray-700">
                      <span className="text-yellow-500">ℹ️</span>
                      <span>
                        {vatEnabled && vatAmount > 0 && `VAT (${vatPercentage}%) applies to EU customers. `}
                        {processingFee > 0 && `Platform fee (${processingFee}%) is charged to your card.`}
                      </span>
                    </div>
                  )}
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
                  {settings?.currency.symbol || '€'}{preset}
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
        ) : checkingConfig ? (
          // Checking configuration
          <div className="py-8 text-center space-y-4">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-green-500" />
            <p className="text-sm text-gray-400">Checking payment configuration...</p>
          </div>
        ) : !paymentConfigured || !stripePromise ? (
          // Stripe not configured error
          <div className="py-8 text-center space-y-4">
            <div className="mx-auto w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center">
              <XCircle className="h-8 w-8 text-red-500" />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-gray-100">Payment System Not Configured</h3>
              <p className="text-sm text-gray-400 mt-2">
                Stripe payment system is not set up. Please contact the administrator.
              </p>
              <p className="text-xs text-gray-500 mt-2">
                Admin: Configure Stripe in Admin Panel → Settings → Payment Providers
              </p>
            </div>
            <Button
              onClick={resetModal}
              variant="outline"
              className="mt-4"
            >
              Close
            </Button>
          </div>
        ) : stripePromise ? (
          // Step 2: Payment Form
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
              onCancel={resetModal}
            />
          </Elements>
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

  // User receives FULL credits (fees are charged to card, not deducted)
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
            {creditsReceived.toFixed(settings?.credits.decimals || 2)} {settings?.credits.symbol || 'Credits'} added to your wallet
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
          <span className="text-lg font-bold text-gray-100">{settings?.currency.symbol || '€'}{amount.toFixed(2)}</span>
        </div>
        
        {vatEnabled && vatAmount > 0 && (
          <div className="flex justify-between items-center text-sm">
            <span className="text-gray-500">VAT ({vatPercentage}%)</span>
            <span className="text-orange-400">+{settings?.currency.symbol || '€'}{vatAmount.toFixed(2)}</span>
          </div>
        )}
        
        {platformFeePercentage > 0 && platformFeeAmount > 0 && (
          <div className="flex justify-between items-center text-sm">
            <span className="text-gray-500">Platform Fee ({platformFeePercentage}%)</span>
            <span className="text-orange-400">+{settings?.currency.symbol || '€'}{platformFeeAmount.toFixed(2)}</span>
          </div>
        )}
        
        {(vatEnabled || platformFeePercentage > 0) && (
          <div className="flex justify-between items-center pt-2 border-t border-gray-600">
            <span className="text-sm font-semibold text-gray-300">Total to Pay</span>
            <span className="text-lg font-bold text-white">{settings?.currency.symbol || '€'}{totalAmount.toFixed(2)}</span>
          </div>
        )}
        
        <div className="flex justify-between items-center pt-2 border-t border-gray-700">
          <span className="text-sm font-semibold text-gray-300">You Receive</span>
          <span className="text-yellow-400 font-bold flex items-center gap-1">
            <Zap className="h-4 w-4" />
            {creditsReceived.toFixed(settings?.credits.decimals || 2)} {settings?.credits.symbol || 'Credits'}
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
          Cancel
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
            `Pay ${settings?.currency.symbol || '€'}${totalAmount.toFixed(2)}`
          )}
        </Button>
      </div>

      <p className="text-xs text-center text-gray-500">
        Secured by Stripe • Your payment information is encrypted
      </p>
    </form>
  );
}

