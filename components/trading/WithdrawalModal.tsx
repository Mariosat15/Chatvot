'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Coins, Loader2, CheckCircle2, XCircle, Info, TrendingDown } from 'lucide-react';
import { initiateWithdrawal } from '@/lib/actions/trading/wallet.actions';
import { useRouter } from 'next/navigation';

interface WithdrawalModalProps {
  children: React.ReactNode;
}

export default function WithdrawalModal({ children }: WithdrawalModalProps) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [conversionRate, setConversionRate] = useState(100);
  const [minWithdrawal, setMinWithdrawal] = useState(20);
  const [withdrawalFee, setWithdrawalFee] = useState(2);
  const router = useRouter();

  // Fetch conversion settings
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await fetch('/api/credit-settings');
        const data = await response.json();
        if (data.success) {
          setConversionRate(data.rate);
          setMinWithdrawal(data.minimumWithdrawal);
          setWithdrawalFee(data.withdrawalFeePercentage);
        }
      } catch (error) {
        console.error('Failed to fetch credit settings:', error);
      }
    };
    fetchSettings();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const creditsAmount = parseFloat(amount);

      if (isNaN(creditsAmount) || creditsAmount <= 0) {
        setError('Please enter a valid amount');
        setLoading(false);
        return;
      }

      const minCredits = minWithdrawal * conversionRate;
      if (creditsAmount < minCredits) {
        setError(`Minimum withdrawal is ${minCredits} Credits (€${minWithdrawal})`);
        setLoading(false);
        return;
      }

      // Initiate withdrawal (now works with credits)
      const result = await initiateWithdrawal(creditsAmount);

      if (result.success) {
        setSuccess(true);
        setTimeout(() => {
          router.refresh();
          setOpen(false);
          resetModal();
        }, 3000);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Withdrawal request failed');
      setLoading(false);
    }
  };

  // Calculate withdrawal breakdown
  const calculateWithdrawal = () => {
    const creditsAmount = parseFloat(amount) || 0;
    const eurGross = creditsAmount / conversionRate;
    const feeAmount = eurGross * (withdrawalFee / 100);
    const eurNet = eurGross - feeAmount;
    const feeInCredits = Math.ceil(feeAmount * conversionRate);
    const totalCreditsDeducted = creditsAmount + feeInCredits;

    return {
      creditsAmount,
      eurGross,
      feePercentage: withdrawalFee,
      feeAmount,
      feeInCredits,
      eurNet,
      totalCreditsDeducted,
    };
  };

  const withdrawal = calculateWithdrawal();

  const resetModal = () => {
    setAmount('');
    setError('');
    setSuccess(false);
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

      <DialogContent className="sm:max-w-[500px] bg-gray-900 border-gray-700">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-gray-100">
            <Coins className="h-5 w-5 text-yellow-500" />
            Withdraw Credits
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            Convert your credits to EUR and withdraw to your bank account
          </DialogDescription>
        </DialogHeader>

        {success ? (
          // Success State
          <div className="py-8 text-center space-y-4">
            <div className="mx-auto w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center">
              <CheckCircle2 className="h-8 w-8 text-green-500" />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-gray-100">Withdrawal Requested!</h3>
              <p className="text-sm text-gray-400 mt-2">
                Your withdrawal request has been submitted. We'll process it within 1-3 business days.
              </p>
              <p className="text-xs text-gray-500 mt-4">
                You'll receive an email confirmation shortly.
              </p>
            </div>
          </div>
        ) : (
          // Withdrawal Form
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Info Banner */}
            <div className="rounded-lg bg-blue-500/10 border border-blue-500/20 p-4 space-y-2">
              <div className="flex items-start gap-2">
                <Info className="h-4 w-4 text-blue-400 mt-0.5 shrink-0" />
                <div className="space-y-1 text-xs text-blue-300">
                  <p>• Minimum withdrawal: {minWithdrawal * conversionRate} Credits (€{minWithdrawal})</p>
                  <p>• Withdrawal fee: {withdrawalFee}% (platform fee)</p>
                  <p>• Processing time: 1-3 business days</p>
                  <p>• Funds sent to your registered bank account</p>
                  <p>• KYC verification required</p>
                </div>
              </div>
            </div>

            {/* Amount Input */}
            <div className="space-y-2">
              <Label htmlFor="withdrawal-amount" className="text-gray-300 flex items-center gap-2">
                <Coins className="h-4 w-4 text-yellow-500" />
                Amount (Credits)
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-yellow-500 font-semibold">C</span>
                <Input
                  id="withdrawal-amount"
                  type="number"
                  step="1"
                  min={minWithdrawal * conversionRate}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="pl-8 bg-gray-800 border-gray-700 text-gray-100"
                  placeholder={(minWithdrawal * conversionRate).toString()}
                  required
                  disabled={loading}
                />
              </div>
              <p className="text-xs text-gray-500">Minimum: {minWithdrawal * conversionRate} Credits</p>
            </div>

            {/* Quick Amount Buttons */}
            <div className="grid grid-cols-4 gap-2">
              {[1000, 2500, 5000, 10000].map((preset) => (
                <Button
                  key={preset}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setAmount(preset.toString())}
                  disabled={loading}
                  className="bg-gray-800 border-gray-700 hover:bg-gray-700 text-gray-100"
                >
                  {preset} C
                </Button>
              ))}
            </div>

            {/* Withdrawal Breakdown */}
            {amount && !isNaN(parseFloat(amount)) && parseFloat(amount) > 0 && (
              <div className="rounded-lg bg-gradient-to-br from-yellow-900/20 to-orange-900/20 border border-yellow-500/30 p-4 space-y-3">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingDown className="h-4 w-4 text-yellow-500" />
                  <span className="text-sm font-semibold text-white">Withdrawal Breakdown</span>
                </div>

                <div className="space-y-2 text-sm">
                  {/* Credits to Withdraw */}
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Credits to Withdraw:</span>
                    <span className="font-semibold text-white tabular-nums">
                      {withdrawal.creditsAmount.toLocaleString()} C
                    </span>
                  </div>

                  {/* Withdrawal Fee */}
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Withdrawal Fee ({withdrawalFee}%):</span>
                    <span className="font-semibold text-red-400 tabular-nums">
                      -{withdrawal.feeInCredits.toLocaleString()} C
                    </span>
                  </div>

                  <div className="border-t border-gray-700 pt-2"></div>

                  {/* Total Deducted */}
                  <div className="flex items-center justify-between">
                    <span className="text-gray-300 font-semibold">Total Deducted from Wallet:</span>
                    <span className="font-bold text-red-400 tabular-nums">
                      -{withdrawal.totalCreditsDeducted.toLocaleString()} C
                    </span>
                  </div>

                  <div className="border-t border-yellow-500/30 pt-2 mt-2"></div>

                  {/* EUR You Receive */}
                  <div className="flex items-center justify-between bg-green-500/10 p-3 rounded-lg">
                    <span className="text-green-300 font-semibold">💶 You Will Receive:</span>
                    <span className="font-bold text-green-400 text-lg tabular-nums">
                      €{withdrawal.eurNet.toFixed(2)}
                    </span>
                  </div>

                  <p className="text-xs text-gray-500 text-center mt-2">
                    Gross: €{withdrawal.eurGross.toFixed(2)} - Fee: €{withdrawal.feeAmount.toFixed(2)} = Net: €{withdrawal.eurNet.toFixed(2)}
                  </p>
                </div>
              </div>
            )}

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
                disabled={loading}
                className="flex-1 bg-yellow-500 hover:bg-yellow-600 text-gray-900 font-semibold"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  'Request Withdrawal'
                )}
              </Button>
            </div>

            <p className="text-xs text-center text-gray-500">
              Withdrawals are processed manually. You'll be notified once approved.
            </p>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

