'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Search, RefreshCw, Trophy, Trash2, AlertTriangle, Shield, Download } from 'lucide-react';
import { toast } from 'sonner';

export default function DatabaseSection() {
  const router = useRouter();
  const [checking, setChecking] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [recovering, setRecovering] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [verifyingPassword, setVerifyingPassword] = useState(false);
  const [resetConfirmation, setResetConfirmation] = useState('');

  const handleCheckDatabase = async () => {
    setChecking(true);
    try {
      toast.loading('Checking database...', { id: 'check' });
      
      const response = await fetch('/api/admin/check-database', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      const data = await response.json();

      if (data.success) {
        console.log('📊 DATABASE CHECK:', data);
        toast.success(
          `✅ Database Check:\n\n` +
          `Participants: ${data.summary.totalParticipants}\n` +
          `Positions: ${data.summary.totalPositions} (${data.summary.openPositions} open, ${data.summary.closedPositions} closed)\n` +
          `Trade History: ${data.summary.totalTradeHistory}\n\n` +
          `Recent Trades: ${data.recentTrades.length}\n` +
          `Active Participants: ${data.participantsWithStats.length}\n\n` +
          `Check console (F12) for full details!`,
          { id: 'check', duration: 8000 }
        );
      } else {
        toast.error(`Failed: ${data.message}`, { id: 'check' });
      }
    } catch (error) {
      toast.error('Database check failed. Check console for details.', { id: 'check' });
      console.error('Database check error:', error);
    } finally {
      setChecking(false);
    }
  };

  const handleFinalizeOldCompetitions = async () => {
    setFinalizing(true);
    try {
      toast.loading('Finalizing old competitions (closing positions, calculating stats)...', { id: 'finalize' });
      
      const response = await fetch('/api/admin/finalize-old-competitions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      const data = await response.json();

      if (data.success) {
        toast.success(
          `✅ ${data.message}\n\nFinalized: ${data.finalized}\nAlready Done: ${data.alreadyDone}\nErrors: ${data.errors}`,
          { id: 'finalize', duration: 6000 }
        );
        router.refresh();
      } else {
        toast.error(`Failed: ${data.message}`, { id: 'finalize' });
      }
    } catch (error) {
      toast.error('Finalization failed. Check console for details.', { id: 'finalize' });
      console.error('Finalization error:', error);
    } finally {
      setFinalizing(false);
    }
  };

  const handleRecoverStats = async () => {
    setRecovering(true);
    try {
      toast.loading('Recovering competition stats...', { id: 'recover' });
      
      const response = await fetch('/api/admin/recover-stats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      const data = await response.json();

      if (data.success) {
        toast.success(
          `✅ ${data.message}\n\nFixed: ${data.fixed} participants\nSkipped: ${data.skipped} (no trades)`,
          { id: 'recover', duration: 5000 }
        );
        router.refresh();
      } else {
        toast.error(`Failed: ${data.message}`, { id: 'recover' });
      }
    } catch (error) {
      toast.error('Recovery failed. Check console for details.', { id: 'recover' });
      console.error('Recovery error:', error);
    } finally {
      setRecovering(false);
    }
  };

  const handleVerifyPassword = async () => {
    if (!adminPassword) {
      toast.error('Please enter admin password');
      return;
    }

    setVerifyingPassword(true);
    try {
      const response = await fetch('/api/admin/verify-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: adminPassword }),
      });

      if (response.ok) {
        toast.success('Password verified');
        setShowPasswordDialog(false);
        setAdminPassword('');
        // Show the reset confirmation dialog
        setShowResetDialog(true);
      } else {
        const error = await response.json();
        toast.error(error.message || 'Invalid admin password');
      }
    } catch (error) {
      console.error('Error verifying password:', error);
      toast.error('Error verifying password');
    } finally {
      setVerifyingPassword(false);
    }
  };

  const handleResetAllData = async () => {
    if (resetConfirmation !== 'RESET_ALL_DATA') {
      toast.error('⚠️ You must type exactly: RESET_ALL_DATA');
      return;
    }

    setResetting(true);
    try {
      toast.loading('🚨 Deleting ALL data...', { id: 'reset' });
      
      const response = await fetch('/api/admin/reset-all-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmationCode: resetConfirmation }),
      });

      const data = await response.json();

      if (data.success) {
        toast.success(
          `✅ ALL DATA DELETED!\n\n` +
          `Competitions: ${data.deleted.competitions}\n` +
          `Participants: ${data.deleted.participants}\n` +
          `Positions: ${data.deleted.positions}\n` +
          `Trade History: ${data.deleted.tradeHistory}\n` +
          `Orders: ${data.deleted.orders}\n` +
          `Transactions: ${data.deleted.walletTransactions}\n` +
          `Wallets Reset: ${data.walletsReset}`,
          { id: 'reset', duration: 8000 }
        );
        setShowResetDialog(false);
        setResetConfirmation('');
        router.refresh();
      } else {
        toast.error(`Failed: ${data.message}`, { id: 'reset' });
      }
    } catch (error) {
      toast.error('Reset failed. Check console for details.', { id: 'reset' });
      console.error('Reset error:', error);
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Database Diagnostics */}
      <div className="bg-gradient-to-br from-gray-800 to-gray-900 border border-blue-500/50 rounded-2xl shadow-2xl shadow-blue-500/10 overflow-hidden">
        <div className="bg-gradient-to-r from-blue-500 to-blue-600 p-6">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
              <Search className="h-6 w-6 text-white" />
            </div>
            <div>
              <h3 className="text-2xl font-bold text-white">Database Diagnostics</h3>
              <p className="text-blue-100 text-sm">Check and recover data</p>
            </div>
          </div>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Button
              onClick={handleCheckDatabase}
              disabled={checking}
              className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white h-12"
            >
              <Search className={`h-4 w-4 mr-2 ${checking ? 'animate-spin' : ''}`} />
              {checking ? 'Checking...' : 'Check DB'}
            </Button>

            <Button
              onClick={handleFinalizeOldCompetitions}
              disabled={finalizing}
              className="bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white h-12"
            >
              <Trophy className={`h-4 w-4 mr-2 ${finalizing ? 'animate-spin' : ''}`} />
              {finalizing ? 'Finalizing...' : 'Finalize Old'}
            </Button>

            <Button
              onClick={handleRecoverStats}
              disabled={recovering}
              className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white h-12"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${recovering ? 'animate-spin' : ''}`} />
              {recovering ? 'Recovering...' : 'Recover Stats'}
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2">
            <div className="text-xs text-gray-400">
              Shows what data exists in MongoDB
            </div>
            <div className="text-xs text-gray-400">
              Closes open positions from old competitions
            </div>
            <div className="text-xs text-gray-400">
              Rebuilds stats from trade history
            </div>
          </div>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="bg-gradient-to-br from-gray-800 to-gray-900 border-2 border-red-500/50 rounded-2xl shadow-2xl shadow-red-500/20 overflow-hidden">
        <div className="bg-gradient-to-r from-red-600 to-red-700 p-6">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
              <AlertTriangle className="h-6 w-6 text-white" />
            </div>
            <div>
              <h3 className="text-2xl font-bold text-white">⚠️ Danger Zone</h3>
              <p className="text-red-100 text-sm">Irreversible actions - use with extreme caution</p>
            </div>
          </div>
        </div>
        <div className="p-6">
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-4">
            <p className="text-red-300 text-sm font-semibold mb-2">⚠️ Warning:</p>
            <p className="text-gray-300 text-sm">
              The button below will permanently delete all trading data including competitions, 
              participants, positions, trade history, orders, wallet transactions, and reset all wallet balances (including competition spending/winnings).
              User accounts will be preserved.
            </p>
          </div>

          <Button
            onClick={() => setShowPasswordDialog(true)}
            className="w-full bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white h-14 text-lg font-bold"
          >
            <Trash2 className="h-5 w-5 mr-2" />
            Reset All Data
          </Button>

          <div className="space-y-3">
            <Button
              onClick={async () => {
                try {
                  setLoading(true);
                  toast.loading('Testing badge models...', { id: 'test' });
                  
                  const response = await fetch('/api/admin/test-badge-models');
                  const data = await response.json();
                  console.log('Test response:', data);

                  if (data.success) {
                    toast.success(
                      `✅ Models working!\n\n` +
                      `Collections: ${data.details.collections.join(', ')}\n` +
                      `Badges: ${data.details.counts.badges}\n` +
                      `XP Configs: ${data.details.counts.xpConfigs}\n\n` +
                      `Check console (F12) for full details!`,
                      { id: 'test', duration: 5000 }
                    );
                  } else {
                    console.error('Test error:', data);
                    toast.error(
                      `Test failed: ${data.error}\n${data.details || ''}`,
                      { id: 'test' }
                    );
                  }
                } catch (error) {
                  console.error('Error testing models:', error);
                  toast.error(`Failed to test: ${error}`, { id: 'test' });
                } finally {
                  setLoading(false);
                }
              }}
              className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white h-12 text-base font-semibold"
              disabled={loading}
            >
              <Search className="h-4 w-4 mr-2" />
              Test Badge Models
            </Button>

            <Button
              onClick={async () => {
                try {
                  setLoading(true);
                  toast.loading('Seeding badge and XP defaults...', { id: 'seed' });
                  
                  const response = await fetch('/api/admin/seed-badges-xp', {
                    method: 'POST',
                  });

                  const data = await response.json();
                  console.log('Seed response:', data);

                  if (data.success) {
                    toast.success(
                      `✅ Seeding complete!\n\n` +
                      `Badges: ${data.counts.badges}\n` +
                      `XP Configs: ${data.counts.xpConfigs}\n\n` +
                      `Check console (F12) for details!`,
                      { id: 'seed', duration: 5000 }
                    );
                  } else {
                    console.error('Seed error:', data);
                    toast.error(
                      `Failed to seed: ${data.error}\n${data.details || ''}`,
                      { id: 'seed' }
                    );
                  }
                } catch (error) {
                  console.error('Error seeding defaults:', error);
                  toast.error(`Failed to seed defaults: ${error}`, { id: 'seed' });
                } finally {
                  setLoading(false);
                }
              }}
              className="w-full bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white h-14 text-lg font-bold"
              disabled={loading}
            >
              <Download className="h-5 w-5 mr-2" />
              Seed Badge & XP Defaults
            </Button>
          </div>
        </div>
      </div>

      {/* Password Verification Dialog */}
      <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
        <DialogContent className="bg-gradient-to-br from-gray-800 to-gray-900 border-2 border-yellow-700 text-gray-100">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-yellow-500 flex items-center gap-2">
              <Shield className="h-6 w-6" />
              Admin Verification Required
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              Enter your admin password to proceed with database reset
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-red-500">⚠️ CRITICAL ACTION</p>
                  <p className="text-xs text-gray-400 mt-1">
                    You are about to reset the entire database. This action requires admin authentication.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="adminPasswordReset" className="text-gray-300">
                Admin Password *
              </Label>
              <Input
                id="adminPasswordReset"
                type="password"
                placeholder="Enter admin password"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !verifyingPassword) {
                    handleVerifyPassword();
                  }
                }}
                className="bg-gray-900 border-gray-700 text-gray-100"
                autoFocus
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowPasswordDialog(false);
                setAdminPassword('');
              }}
              className="bg-gray-700 hover:bg-gray-600 text-gray-100 border-gray-600"
            >
              Cancel
            </Button>
            <Button
              onClick={handleVerifyPassword}
              disabled={verifyingPassword || !adminPassword}
              className="bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 text-gray-900 font-bold"
            >
              {verifyingPassword ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Verifying...
                </>
              ) : (
                <>
                  <Shield className="h-4 w-4 mr-2" />
                  Verify & Continue
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Confirmation Dialog */}
      <AlertDialog open={showResetDialog} onOpenChange={setShowResetDialog}>
        <AlertDialogContent className="bg-gray-900 border-2 border-red-500">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-2xl font-bold text-red-500 flex items-center gap-2">
              <AlertTriangle className="h-6 w-6" />
              ⚠️ DANGER: Reset ALL Data
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-gray-400">
              This action will permanently delete all competition data and reset wallets.
            </AlertDialogDescription>
          </AlertDialogHeader>
          
          <div className="text-gray-300 space-y-4 px-6">
            <p className="text-lg font-semibold">This will PERMANENTLY DELETE:</p>
            <ul className="list-disc list-inside space-y-2 text-sm">
              <li>❌ All competitions</li>
              <li>❌ All participants</li>
              <li>❌ All trading positions</li>
              <li>❌ All trade history</li>
              <li>❌ All orders</li>
              <li>❌ All wallet transactions</li>
              <li>❌ Reset all wallet balances to 0</li>
              <li>❌ Reset competition spending to 0</li>
              <li>❌ Reset competition winnings to 0</li>
            </ul>
            <p className="text-green-400 font-semibold">✅ KEEPS: User accounts and login credentials</p>
            <p className="text-yellow-400 font-bold mt-4">⚠️ THIS CANNOT BE UNDONE!</p>
            
            <div className="mt-6 space-y-2">
              <Label htmlFor="resetConfirmation" className="text-white font-bold">
                Type <span className="text-red-400 font-mono">RESET_ALL_DATA</span> to confirm:
              </Label>
              <Input
                id="resetConfirmation"
                value={resetConfirmation}
                onChange={(e) => setResetConfirmation(e.target.value)}
                placeholder="RESET_ALL_DATA"
                className="bg-gray-800 border-red-500 text-white font-mono"
                autoComplete="off"
              />
            </div>
          </div>
          
          <AlertDialogFooter>
            <AlertDialogCancel 
              className="bg-gray-700 text-white hover:bg-gray-600"
              onClick={() => {
                setShowResetDialog(false);
                setResetConfirmation('');
              }}
            >
              Cancel (Safe)
            </AlertDialogCancel>
            <Button
              onClick={handleResetAllData}
              disabled={resetConfirmation !== 'RESET_ALL_DATA' || resetting}
              className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {resetting ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Everything
                </>
              )}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

