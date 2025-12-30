'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Coins, Loader2, CheckCircle2, XCircle, TrendingDown, AlertTriangle, Clock, Shield, CreditCard, Building2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface WithdrawalModalProps {
  children: React.ReactNode;
}

interface WithdrawalMethod {
  id: string;
  type: 'original_method' | 'bank_account';
  label: string;
  details: string;
  cardBrand?: string;
  cardLast4?: string;
  bankName?: string;
  ibanLast4?: string;
  country?: string;
  isDefault?: boolean;
  userPaymentOptionId?: string; // Nuvei UPO ID for card refunds
}

interface WithdrawalInfo {
  eligible: boolean;
  reason: string;
  warnings: string[];
  wallet: {
    balance: number;
    balanceEUR: number;
    totalDeposited: number;
    totalWithdrawn: number;
    kycVerified: boolean;
    withdrawalEnabled: boolean;
  };
  settings: {
    minimumWithdrawal: number;
    maximumWithdrawal: number;
    dailyLimit: number;
    monthlyLimit: number;
    feePercentage: number;
    feeFixed: number;
    processingTimeHours: number;
    allowedMethods: string[];
    preferredMethod: string;
    requireKYC: boolean;
    conversionRate: number;
  };
  isSandbox: boolean;
  originalPaymentMethod: string | null;
  availableWithdrawalMethods: WithdrawalMethod[];
  hasWithdrawalMethod: boolean;
  nuveiEnabled?: boolean; // Whether Nuvei automatic withdrawals are enabled by admin
}


export default function WithdrawalModal({ children }: WithdrawalModalProps) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [selectedMethodId, setSelectedMethodId] = useState('');
  const [userNote, setUserNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetchingInfo, setFetchingInfo] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState<{
    message: string;
    netAmountEUR: number;
    processingHours: number;
    isAutoApproved: boolean;
    isAutomatic?: boolean;
  } | null>(null);
  const [withdrawalInfo, setWithdrawalInfo] = useState<WithdrawalInfo | null>(null);
  const router = useRouter();

  // Fetch withdrawal info when modal opens
  useEffect(() => {
    if (open) {
      fetchWithdrawalInfo();
    }
  }, [open]);

  const fetchWithdrawalInfo = async () => {
    setFetchingInfo(true);
    setError('');
    try {
      const response = await fetch('/api/wallet/withdraw');
      const data = await response.json();
      
      if (!response.ok) {
        setError(data.error || 'Failed to fetch withdrawal information');
        return;
      }
      
      setWithdrawalInfo(data);
      
      // Set default method: prefer default bank account, then original method, then first available
      const methods = data.availableWithdrawalMethods || [];
      const defaultBankAccount = methods.find((m: WithdrawalMethod) => m.type === 'bank_account' && m.isDefault);
      const originalMethod = methods.find((m: WithdrawalMethod) => m.type === 'original_method');
      
      if (defaultBankAccount) {
        setSelectedMethodId(defaultBankAccount.id);
      } else if (originalMethod) {
        setSelectedMethodId(originalMethod.id);
      } else if (methods.length > 0) {
        setSelectedMethodId(methods[0].id);
      }
    } catch (err) {
      setError('Failed to connect to server');
      console.error('Failed to fetch withdrawal info:', err);
    } finally {
      setFetchingInfo(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const amountEUR = parseFloat(amount);

      if (isNaN(amountEUR) || amountEUR <= 0) {
        setError('Please enter a valid amount');
        setLoading(false);
        return;
      }
      
      if (!selectedMethodId) {
        setError('Please select a withdrawal method');
        setLoading(false);
        return;
      }

      // Get selected method details
      const selectedMethod = withdrawalInfo?.availableWithdrawalMethods?.find(m => m.id === selectedMethodId);
      
      if (!selectedMethod) {
        setError('Selected withdrawal method not found');
        setLoading(false);
        return;
      }
      
      // Check if Nuvei automatic withdrawals are enabled by admin
      const isAutomatic = withdrawalInfo?.nuveiEnabled === true;
      
      if (isAutomatic) {
        // AUTOMATIC WITHDRAWAL via Nuvei - determined by admin settings, not user choice
        const withdrawalMethod = selectedMethod.type === 'original_method' ? 'card_refund' : 'bank_transfer';
        
        const requestBody: any = {
          amountEUR,
          withdrawalMethod,
        };
        
        if (withdrawalMethod === 'card_refund') {
          // For card refund, we MUST pass the UPO ID for Nuvei to process
          if (!selectedMethod.userPaymentOptionId) {
            setError('This card cannot be used for automatic refund. No UPO available. Please use bank transfer instead.');
            setLoading(false);
            return;
          }
          
          requestBody.userPaymentOptionId = selectedMethod.userPaymentOptionId;
          requestBody.cardDetails = {
            cardBrand: selectedMethod.cardBrand,
            cardLast4: selectedMethod.cardLast4,
            userPaymentOptionId: selectedMethod.userPaymentOptionId,
          };
        } else {
          // For bank transfer, pass the bank account ID
          requestBody.bankAccountId = selectedMethod.id;
        }
        
        const response = await fetch('/api/nuvei/withdrawal', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
        });
        
        const data = await response.json();
        
        if (!response.ok) {
          setError(data.error || 'Automatic withdrawal failed');
          setLoading(false);
          return;
        }
        
        setSuccess({
          message: data.message || 'Withdrawal submitted for automatic processing',
          netAmountEUR: data.netAmountEUR,
          processingHours: withdrawalMethod === 'card_refund' ? 72 : 48,
          isAutoApproved: true,
          isAutomatic: true,
        });
        
        setTimeout(() => {
          router.refresh();
          setOpen(false);
          resetModal();
        }, 4000);
        return;
      }

      // MANUAL WITHDRAWAL (when Nuvei is disabled)
      const response = await fetch('/api/wallet/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amountEUR,
          withdrawalMethodId: selectedMethodId,
          userNote: userNote.trim() || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Withdrawal request failed');
        setLoading(false);
        return;
      }

      setSuccess({
        message: data.message,
        netAmountEUR: data.withdrawalRequest.netAmountEUR,
        processingHours: data.withdrawalRequest.estimatedProcessingHours,
        isAutoApproved: data.withdrawalRequest.isAutoApproved,
      });
      
      setTimeout(() => {
        router.refresh();
        setOpen(false);
        resetModal();
      }, 4000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Withdrawal request failed');
      setLoading(false);
    }
  };

  // Calculate withdrawal breakdown
  const calculateWithdrawal = () => {
    const eurAmount = parseFloat(amount) || 0;
    if (!withdrawalInfo) return null;
    
    const { feePercentage, feeFixed, conversionRate } = withdrawalInfo.settings;
    const platformFee = (eurAmount * feePercentage / 100) + feeFixed;
    const netAmount = eurAmount - platformFee;
    const creditsRequired = eurAmount * conversionRate;
    
    return {
      eurAmount,
      platformFee,
      netAmount,
      creditsRequired,
    };
  };

  const withdrawal = calculateWithdrawal();

  const resetModal = () => {
    setAmount('');
    setSelectedMethodId('');
    setUserNote('');
    setError('');
    setSuccess(null);
    setLoading(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        setOpen(isOpen);
        if (!isOpen) resetModal();
      }}
    >
      <DialogTrigger asChild>{children}</DialogTrigger>

      <DialogContent className="bg-gray-900 border-gray-700 max-sm:border-0" fullScreenMobile size="default">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-gray-100">
            <Coins className="h-5 w-5 text-yellow-500" />
            Withdraw Funds
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            Request a withdrawal of your credits to EUR
          </DialogDescription>
        </DialogHeader>

        {fetchingInfo ? (
          <div className="py-8 flex items-center justify-center">
            <Loader2 className="h-8 w-8 text-yellow-500 animate-spin" />
          </div>
        ) : success ? (
          // Success State
          <div className="py-8 text-center space-y-4">
            <div className="mx-auto w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center">
              <CheckCircle2 className="h-8 w-8 text-green-500" />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-gray-100">
                🎉 Withdrawal Submitted!
              </h3>
              <p className="text-sm text-gray-400 mt-2">{success.message}</p>
              <div className="mt-4 bg-green-500/10 border border-green-500/30 rounded-lg p-4">
                <p className="text-green-400 font-bold text-lg">
                  €{success.netAmountEUR.toFixed(2)} will be sent to you
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  Typically arrives in 3-5 business days
                </p>
              </div>
            </div>
          </div>
        ) : !withdrawalInfo?.eligible ? (
          // Not Eligible State
          <div className="py-8 text-center space-y-4">
            <div className="mx-auto w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center">
              <XCircle className="h-8 w-8 text-red-500" />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-gray-100">Cannot Withdraw</h3>
              <p className="text-sm text-red-400 mt-2">{withdrawalInfo?.reason}</p>
              {withdrawalInfo?.settings?.requireKYC && !withdrawalInfo?.wallet?.kycVerified && (
                <Button
                  className="mt-4 bg-blue-600 hover:bg-blue-700"
                  onClick={() => {
                    setOpen(false);
                    router.push('/profile?tab=verification');
                  }}
                >
                  <Shield className="h-4 w-4 mr-2" />
                  Complete KYC Verification
                </Button>
              )}
            </div>
          </div>
        ) : (
          // Withdrawal Form
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Status Badges */}
            <div className="flex flex-wrap gap-2">
              {withdrawalInfo.isSandbox && (
                <Badge className="bg-purple-500/20 text-purple-300">SANDBOX MODE</Badge>
              )}
              {withdrawalInfo.wallet.kycVerified && (
                <Badge className="bg-green-500/20 text-green-300">
                  <Shield className="h-3 w-3 mr-1" />
                  KYC Verified
                </Badge>
              )}
              {withdrawalInfo.originalPaymentMethod && (
                <Badge className="bg-blue-500/20 text-blue-300">
                  <CreditCard className="h-3 w-3 mr-1" />
                  {withdrawalInfo.originalPaymentMethod}
                </Badge>
              )}
            </div>

            {/* Warnings */}
            {withdrawalInfo.warnings && withdrawalInfo.warnings.length > 0 && (
              <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-3 space-y-1">
                {withdrawalInfo.warnings.map((warning, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
                    <p className="text-xs text-amber-300">{warning}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Balance Info */}
            <div className="rounded-lg bg-gray-800 border border-gray-700 p-4">
              <div className="flex items-center justify-between">
                <span className="text-gray-400 text-sm">Available Balance</span>
                <span className="text-yellow-400 font-bold text-lg" suppressHydrationWarning>
                  {withdrawalInfo.wallet.balance.toLocaleString()} Credits
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                ≈ €{withdrawalInfo.wallet.balanceEUR.toFixed(2)} EUR
              </p>
            </div>
            

            {/* Amount Input */}
            <div className="space-y-2">
              <Label htmlFor="withdrawal-amount" className="text-gray-300">
                Amount (EUR)
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-semibold">€</span>
                <Input
                  id="withdrawal-amount"
                  type="number"
                  step="0.01"
                  min={withdrawalInfo.settings.minimumWithdrawal}
                  max={Math.min(
                    withdrawalInfo.settings.maximumWithdrawal,
                    withdrawalInfo.wallet.balanceEUR
                  )}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="pl-8 bg-gray-800 border-gray-700 text-gray-100"
                  placeholder={withdrawalInfo.settings.minimumWithdrawal.toString()}
                  required
                  disabled={loading}
                />
              </div>
              <p className="text-xs text-gray-500">
                Min: €{withdrawalInfo.settings.minimumWithdrawal.toFixed(2)} | 
                Max: €{Math.min(
                  withdrawalInfo.settings.maximumWithdrawal,
                  withdrawalInfo.wallet.balanceEUR
                ).toFixed(2)}
                {withdrawalInfo.wallet.balanceEUR < withdrawalInfo.settings.maximumWithdrawal && (
                  <span className="text-gray-600"> (limited by balance)</span>
                )}
              </p>
            </div>

            {/* Quick Amount Buttons */}
            <div className="grid grid-cols-4 gap-2">
              {(() => {
                const maxEUR = Math.floor(withdrawalInfo.wallet.balanceEUR);
                const minEUR = withdrawalInfo.settings.minimumWithdrawal;
                // Generate smart presets based on balance
                const presets = [];
                if (minEUR <= maxEUR) presets.push(minEUR);
                if (minEUR * 2 <= maxEUR && minEUR * 2 > minEUR) presets.push(minEUR * 2);
                if (minEUR * 5 <= maxEUR && !presets.includes(minEUR * 5)) presets.push(minEUR * 5);
                if (maxEUR > 0 && !presets.includes(maxEUR)) presets.push(maxEUR);
                // Fill remaining slots
                const suggestions = [10, 25, 50, 100, 200, 500].filter(v => v >= minEUR && v <= maxEUR && !presets.includes(v));
                while (presets.length < 4 && suggestions.length > 0) {
                  presets.push(suggestions.shift()!);
                }
                // Sort and take up to 4
                return presets.sort((a, b) => a - b).slice(0, 4);
              })().map((preset) => (
                <Button
                  key={preset}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setAmount(preset.toString())}
                  disabled={loading}
                  className={`bg-gray-800 border-gray-700 hover:bg-gray-700 text-gray-100 ${
                    preset === Math.floor(withdrawalInfo.wallet.balanceEUR) ? 'border-yellow-500/50 text-yellow-400' : ''
                  }`}
                >
                  {preset === Math.floor(withdrawalInfo.wallet.balanceEUR) ? 'All' : `€${preset}`}
                </Button>
              ))}
            </div>

            {/* Withdrawal Method Selection */}
            <div className="space-y-2">
              <Label className="text-gray-300">Where to Send Funds</Label>
              {withdrawalInfo.availableWithdrawalMethods && withdrawalInfo.availableWithdrawalMethods.length > 0 ? (
                <Select value={selectedMethodId} onValueChange={setSelectedMethodId} disabled={loading}>
                  <SelectTrigger className="bg-gray-800 border-gray-700">
                    <SelectValue placeholder="Select withdrawal method" />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-700">
                    {withdrawalInfo.availableWithdrawalMethods.map((method) => (
                      <SelectItem key={method.id} value={method.id}>
                        <div className="flex items-center gap-2">
                          {method.type === 'original_method' ? (
                            <CreditCard className="h-4 w-4 text-blue-400" />
                          ) : (
                            <Building2 className="h-4 w-4 text-green-400" />
                          )}
                          <div className="flex flex-col">
                            <span className="text-gray-100">{method.label}</span>
                            <span className="text-xs text-gray-400">{method.details}</span>
                          </div>
                          {method.isDefault && (
                            <Badge variant="secondary" className="text-xs bg-green-500/20 text-green-300 ml-2">Default</Badge>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm text-amber-300 font-medium">No withdrawal method available</p>
                      <p className="text-xs text-amber-200/70 mt-1">
                        Please add a bank account in your wallet settings or make a deposit first.
                      </p>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Show selected method details */}
              {selectedMethodId && withdrawalInfo.availableWithdrawalMethods && (
                <div className="mt-2 p-3 bg-gray-800/50 border border-gray-700 rounded-lg">
                  {(() => {
                    const selected = withdrawalInfo.availableWithdrawalMethods.find(m => m.id === selectedMethodId);
                    if (!selected) return null;
                    
                    if (selected.type === 'original_method') {
                      return (
                        <div className="flex items-center gap-2 text-sm">
                          <CreditCard className="h-4 w-4 text-blue-400" />
                          <span className="text-gray-400">Refund to card:</span>
                          <span className="text-white font-medium">
                            {selected.cardBrand} •••• {selected.cardLast4}
                          </span>
                        </div>
                      );
                    } else {
                      return (
                        <div className="flex items-center gap-2 text-sm">
                          <Building2 className="h-4 w-4 text-green-400" />
                          <span className="text-gray-400">Bank transfer to:</span>
                          <span className="text-white font-medium">
                            {selected.bankName ? `${selected.bankName} ` : ''}****{selected.ibanLast4}
                          </span>
                        </div>
                      );
                    }
                  })()}
                </div>
              )}
            </div>

            {/* Withdrawal Breakdown */}
            {withdrawal && withdrawal.eurAmount > 0 && (
              <div className="rounded-lg bg-gradient-to-br from-yellow-900/20 to-orange-900/20 border border-yellow-500/30 p-4 space-y-3">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingDown className="h-4 w-4 text-yellow-500" />
                  <span className="text-sm font-semibold text-white">Withdrawal Breakdown</span>
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Withdrawal Amount:</span>
                    <span className="font-semibold text-white">€{withdrawal.eurAmount.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">
                      Platform Fee ({withdrawalInfo.settings.feePercentage}%
                      {withdrawalInfo.settings.feeFixed > 0 && ` + €${withdrawalInfo.settings.feeFixed}`}):
                    </span>
                    <span className="font-semibold text-red-400">-€{withdrawal.platformFee.toFixed(2)}</span>
                  </div>

                  <div className="border-t border-yellow-500/30 pt-2"></div>

                  <div className="flex items-center justify-between bg-green-500/10 p-3 rounded-lg">
                    <span className="text-green-300 font-semibold">💶 You Will Receive:</span>
                    <span className="font-bold text-green-400 text-lg">€{withdrawal.netAmount.toFixed(2)}</span>
                  </div>

                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>Credits Deducted:</span>
                    <span suppressHydrationWarning>{withdrawal.creditsRequired.toLocaleString()} Credits</span>
                  </div>
                </div>
              </div>
            )}

            {/* Optional Note */}
            <div className="space-y-2">
              <Label className="text-gray-300">Note (optional)</Label>
              <Textarea
                value={userNote}
                onChange={(e) => setUserNote(e.target.value)}
                placeholder="Any additional information..."
                className="bg-gray-800 border-gray-700 text-gray-100 min-h-[60px]"
                disabled={loading}
              />
            </div>

            {/* Processing Info */}
            <div className="rounded-lg p-4 space-y-2 bg-blue-500/10 border border-blue-500/20">
              <div className="flex items-start gap-2">
                <Clock className="h-4 w-4 text-blue-400 mt-0.5 shrink-0" />
                <div className="space-y-1 text-xs text-blue-300">
                  <p>• Card refunds typically arrive in 3-5 business days</p>
                  <p>• Bank transfers typically arrive in 3-5 business days</p>
                  <p className="text-blue-400/70 italic mt-2">
                    Note: Processing times may vary depending on your bank, card issuer, or public holidays.
                  </p>
                </div>
              </div>
            </div>

            {error && (
              <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3 flex items-start gap-2">
                <XCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                <p className="text-xs text-red-400">{error}</p>
              </div>
            )}

            {/* Buttons */}
            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={loading}
                className="flex-1 bg-gray-800 border-gray-700 hover:bg-gray-700 text-gray-100"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={
                  loading || 
                  !withdrawal || 
                  withdrawal.eurAmount < withdrawalInfo.settings.minimumWithdrawal ||
                  !selectedMethodId || 
                  !withdrawalInfo.hasWithdrawalMethod
                }
                className="flex-1 font-semibold bg-yellow-500 hover:bg-yellow-600 text-gray-900"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  'Submit Withdrawal'
                )}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
