'use client';

import { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Coins, Loader2, CheckCircle2, XCircle, TrendingDown, AlertTriangle, Clock, Shield, CreditCard, Zap, Building2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Switch } from '@/components/ui/switch';

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
  nuveiEnabled?: boolean; // Whether Nuvei automatic withdrawals are enabled
}

interface NuveiPaymentOption {
  id: string;
  type: 'card' | 'bank';
  label: string;
  details: string;
  cardBrand?: string;
  cardLast4?: string;
  expiryDate?: string;
  userPaymentOptionId?: string;
  isFromNuvei: boolean;
}

interface BankDetails {
  iban: string;
  bic: string;
  accountHolderName: string;
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
  
  // Nuvei automatic withdrawal state
  const [useAutomaticWithdrawal, setUseAutomaticWithdrawal] = useState(false);
  const [nuveiPaymentOptions, setNuveiPaymentOptions] = useState<NuveiPaymentOption[]>([]);
  const [loadingNuveiOptions, setLoadingNuveiOptions] = useState(false);
  const [selectedNuveiOption, setSelectedNuveiOption] = useState<string>('');
  const [withdrawalMethodType, setWithdrawalMethodType] = useState<'card_refund' | 'bank_transfer'>('card_refund');
  const [bankDetails, setBankDetails] = useState<BankDetails>({
    iban: '',
    bic: '',
    accountHolderName: '',
  });

  // Fetch withdrawal info when modal opens
  useEffect(() => {
    if (open) {
      fetchWithdrawalInfo();
    }
  }, [open]);
  
  // Fetch Nuvei payment options when automatic mode is enabled
  const fetchNuveiPaymentOptions = useCallback(async () => {
    setLoadingNuveiOptions(true);
    try {
      const response = await fetch('/api/nuvei/user-payment-options');
      const data = await response.json();
      
      if (response.ok && data.paymentOptions) {
        setNuveiPaymentOptions(data.paymentOptions);
        // Auto-select first Nuvei option if available
        const firstNuveiOption = data.paymentOptions.find((p: NuveiPaymentOption) => p.isFromNuvei);
        if (firstNuveiOption) {
          setSelectedNuveiOption(firstNuveiOption.id);
          setWithdrawalMethodType('card_refund');
        } else {
          // No card available, switch to bank transfer
          setWithdrawalMethodType('bank_transfer');
        }
      }
    } catch (err) {
      console.error('Failed to fetch Nuvei payment options:', err);
    } finally {
      setLoadingNuveiOptions(false);
    }
  }, []);
  
  useEffect(() => {
    if (useAutomaticWithdrawal && withdrawalInfo?.nuveiEnabled) {
      fetchNuveiPaymentOptions();
    }
  }, [useAutomaticWithdrawal, withdrawalInfo?.nuveiEnabled, fetchNuveiPaymentOptions]);

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
      
      // AUTOMATIC WITHDRAWAL via Nuvei
      if (useAutomaticWithdrawal && withdrawalInfo?.nuveiEnabled) {
        // Validate based on method type
        if (withdrawalMethodType === 'card_refund') {
          const selectedOption = nuveiPaymentOptions.find(p => p.id === selectedNuveiOption);
          if (!selectedOption?.isFromNuvei || !selectedOption?.userPaymentOptionId) {
            setError('Please select a valid card for refund');
            setLoading(false);
            return;
          }
          
          // Submit to Nuvei
          const response = await fetch('/api/nuvei/withdrawal', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              amountEUR,
              withdrawalMethod: 'card_refund',
              userPaymentOptionId: selectedOption.userPaymentOptionId,
            }),
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
            processingHours: 24,
            isAutoApproved: true,
            isAutomatic: true,
          });
        } else {
          // Bank transfer
          if (!bankDetails.iban || !bankDetails.bic || !bankDetails.accountHolderName) {
            setError('Please fill in all bank details');
            setLoading(false);
            return;
          }
          
          // Validate IBAN format (basic check)
          if (bankDetails.iban.replace(/\s/g, '').length < 15) {
            setError('Please enter a valid IBAN');
            setLoading(false);
            return;
          }
          
          const response = await fetch('/api/nuvei/withdrawal', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              amountEUR,
              withdrawalMethod: 'bank_transfer',
              bankDetails: {
                iban: bankDetails.iban.replace(/\s/g, '').toUpperCase(),
                bic: bankDetails.bic.replace(/\s/g, '').toUpperCase(),
                accountHolderName: bankDetails.accountHolderName.trim(),
              },
            }),
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
            processingHours: 48,
            isAutoApproved: true,
            isAutomatic: true,
          });
        }
        
        setTimeout(() => {
          router.refresh();
          setOpen(false);
          resetModal();
        }, 4000);
        return;
      }

      // MANUAL WITHDRAWAL (existing flow)
      if (!selectedMethodId) {
        setError('Please select a withdrawal method');
        setLoading(false);
        return;
      }

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
    setUseAutomaticWithdrawal(false);
    setSelectedNuveiOption('');
    setWithdrawalMethodType('card_refund');
    setBankDetails({ iban: '', bic: '', accountHolderName: '' });
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
              {success.isAutomatic ? (
                <Zap className="h-8 w-8 text-green-500" />
              ) : (
                <CheckCircle2 className="h-8 w-8 text-green-500" />
              )}
            </div>
            <div>
              <h3 className="text-xl font-semibold text-gray-100">
                {success.isAutomatic 
                  ? '⚡ Automatic Withdrawal Submitted!'
                  : success.isAutoApproved 
                    ? '🎉 Withdrawal Approved!' 
                    : 'Withdrawal Requested!'}
              </h3>
              <p className="text-sm text-gray-400 mt-2">{success.message}</p>
              <div className="mt-4 bg-green-500/10 border border-green-500/30 rounded-lg p-4">
                <p className="text-green-400 font-bold text-lg">
                  €{success.netAmountEUR.toFixed(2)} will be sent to you
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  {success.isAutomatic 
                    ? 'Processing automatically via Nuvei' 
                    : `Estimated processing time: ${success.processingHours} hours`}
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
            
            {/* Automatic Withdrawal Toggle (Nuvei) */}
            {withdrawalInfo.nuveiEnabled && (
              <div className="rounded-lg bg-gradient-to-r from-purple-900/30 to-blue-900/30 border border-purple-500/30 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-purple-500/20 rounded-full flex items-center justify-center">
                      <Zap className="h-5 w-5 text-purple-400" />
                    </div>
                    <div>
                      <p className="text-white font-medium">Automatic Withdrawal</p>
                      <p className="text-xs text-gray-400">
                        Faster processing • Direct to card or bank
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={useAutomaticWithdrawal}
                    onCheckedChange={setUseAutomaticWithdrawal}
                    disabled={loading}
                  />
                </div>
                
                {useAutomaticWithdrawal && (
                  <div className="mt-4 pt-4 border-t border-purple-500/20 space-y-4">
                    {/* Method Type Selection */}
                    <div className="space-y-2">
                      <Label className="text-gray-300 text-sm">Withdrawal Method</Label>
                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setWithdrawalMethodType('card_refund')}
                          disabled={loading}
                          className={`flex items-center justify-center gap-2 ${
                            withdrawalMethodType === 'card_refund'
                              ? 'bg-purple-600 border-purple-500 text-white hover:bg-purple-700'
                              : 'bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700'
                          }`}
                        >
                          <CreditCard className="h-4 w-4" />
                          Card Refund
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setWithdrawalMethodType('bank_transfer')}
                          disabled={loading}
                          className={`flex items-center justify-center gap-2 ${
                            withdrawalMethodType === 'bank_transfer'
                              ? 'bg-purple-600 border-purple-500 text-white hover:bg-purple-700'
                              : 'bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700'
                          }`}
                        >
                          <Building2 className="h-4 w-4" />
                          Bank Transfer
                        </Button>
                      </div>
                    </div>
                    
                    {withdrawalMethodType === 'card_refund' && (
                      <div className="space-y-2">
                        {loadingNuveiOptions ? (
                          <div className="flex items-center justify-center py-4">
                            <Loader2 className="h-5 w-5 text-purple-400 animate-spin" />
                            <span className="ml-2 text-sm text-gray-400">Loading payment options...</span>
                          </div>
                        ) : nuveiPaymentOptions.filter(p => p.isFromNuvei).length > 0 ? (
                          <>
                            <Label className="text-gray-300 text-sm">Select Card</Label>
                            <Select 
                              value={selectedNuveiOption} 
                              onValueChange={setSelectedNuveiOption}
                              disabled={loading}
                            >
                              <SelectTrigger className="bg-gray-800 border-gray-700">
                                <SelectValue placeholder="Select card for refund" />
                              </SelectTrigger>
                              <SelectContent className="bg-gray-800 border-gray-700">
                                {nuveiPaymentOptions.filter(p => p.isFromNuvei).map((option) => (
                                  <SelectItem key={option.id} value={option.id}>
                                    <div className="flex items-center gap-2">
                                      <CreditCard className="h-4 w-4 text-purple-400" />
                                      <span className="text-gray-100">{option.label}</span>
                                      {option.expiryDate && (
                                        <span className="text-xs text-gray-400">({option.expiryDate})</span>
                                      )}
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <p className="text-xs text-gray-500">
                              ⚡ Funds will be refunded to your original payment card
                            </p>
                          </>
                        ) : (
                          <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                            <div className="flex items-start gap-2">
                              <AlertTriangle className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
                              <div>
                                <p className="text-sm text-amber-300">No cards available for refund</p>
                                <p className="text-xs text-amber-200/70 mt-1">
                                  Make a deposit first, or use bank transfer instead.
                                </p>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                    
                    {withdrawalMethodType === 'bank_transfer' && (
                      <div className="space-y-3">
                        <div className="space-y-2">
                          <Label htmlFor="accountHolderName" className="text-gray-300 text-sm">Account Holder Name</Label>
                          <Input
                            id="accountHolderName"
                            value={bankDetails.accountHolderName}
                            onChange={(e) => setBankDetails(prev => ({ ...prev, accountHolderName: e.target.value }))}
                            placeholder="John Doe"
                            className="bg-gray-800 border-gray-700 text-gray-100"
                            disabled={loading}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="iban" className="text-gray-300 text-sm">IBAN</Label>
                          <Input
                            id="iban"
                            value={bankDetails.iban}
                            onChange={(e) => setBankDetails(prev => ({ ...prev, iban: e.target.value.toUpperCase() }))}
                            placeholder="DE89 3704 0044 0532 0130 00"
                            className="bg-gray-800 border-gray-700 text-gray-100 font-mono"
                            disabled={loading}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="bic" className="text-gray-300 text-sm">BIC/SWIFT</Label>
                          <Input
                            id="bic"
                            value={bankDetails.bic}
                            onChange={(e) => setBankDetails(prev => ({ ...prev, bic: e.target.value.toUpperCase() }))}
                            placeholder="COBADEFFXXX"
                            className="bg-gray-800 border-gray-700 text-gray-100 font-mono"
                            disabled={loading}
                          />
                        </div>
                        <p className="text-xs text-gray-500">
                          🏦 Bank transfers typically take 1-3 business days
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

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
                Min: €{withdrawalInfo.settings.minimumWithdrawal} | 
                Max: €{Math.min(
                  withdrawalInfo.settings.maximumWithdrawal,
                  withdrawalInfo.wallet.balanceEUR
                ).toFixed(2)}
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

            {/* Withdrawal Method Selection (Manual Mode Only) */}
            {!useAutomaticWithdrawal && (
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
                            <span className="text-lg">🏦</span>
                          )}
                          <div className="flex flex-col">
                            <span className="text-gray-100">{method.label}</span>
                            <span className="text-xs text-gray-400">{method.details}</span>
                          </div>
                          {method.isDefault && (
                            <span className="text-xs text-green-400 ml-2">Default</span>
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
                          <span className="text-lg">🏦</span>
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
            )}

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
            <div className={`rounded-lg p-4 space-y-2 ${
              useAutomaticWithdrawal 
                ? 'bg-purple-500/10 border border-purple-500/20'
                : 'bg-blue-500/10 border border-blue-500/20'
            }`}>
              <div className="flex items-start gap-2">
                {useAutomaticWithdrawal ? (
                  <Zap className="h-4 w-4 text-purple-400 mt-0.5 shrink-0" />
                ) : (
                  <Clock className="h-4 w-4 text-blue-400 mt-0.5 shrink-0" />
                )}
                <div className={`space-y-1 text-xs ${useAutomaticWithdrawal ? 'text-purple-300' : 'text-blue-300'}`}>
                  {useAutomaticWithdrawal ? (
                    <>
                      <p>• ⚡ Automatic processing via Nuvei payment gateway</p>
                      <p>• {withdrawalMethodType === 'card_refund' 
                          ? 'Card refunds typically arrive in 3-5 business days' 
                          : 'Bank transfers typically arrive in 1-3 business days'}</p>
                      <p>• You will receive a confirmation once the withdrawal is processed</p>
                    </>
                  ) : (
                    <>
                      <p>• Estimated processing time: ~{withdrawalInfo.settings.processingTimeHours} hours</p>
                      <p>• Funds will be sent to your registered payment method</p>
                      <p>• You can cancel pending requests from your transaction history</p>
                    </>
                  )}
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
                  (useAutomaticWithdrawal 
                    ? (withdrawalMethodType === 'card_refund' && !selectedNuveiOption) ||
                      (withdrawalMethodType === 'bank_transfer' && (!bankDetails.iban || !bankDetails.bic || !bankDetails.accountHolderName))
                    : (!selectedMethodId || !withdrawalInfo.hasWithdrawalMethod)
                  )
                }
                className={`flex-1 font-semibold ${
                  useAutomaticWithdrawal 
                    ? 'bg-purple-600 hover:bg-purple-700 text-white'
                    : 'bg-yellow-500 hover:bg-yellow-600 text-gray-900'
                }`}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : useAutomaticWithdrawal ? (
                  <>
                    <Zap className="mr-2 h-4 w-4" />
                    Submit Automatic Withdrawal
                  </>
                ) : (
                  'Request Withdrawal'
                )}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
