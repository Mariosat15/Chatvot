'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  Building2,
  Plus,
  Trash2,
  Star,
  Check,
  AlertTriangle,
  RefreshCw,
  CreditCard,
  Globe,
  Info,
  X,
  Pencil,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface BankAccount {
  id: string;
  accountHolderName: string;
  accountHolderType: string;
  bankName?: string;
  country: string;
  currency: string;
  iban?: string; // Full IBAN for editing
  ibanLast4?: string;
  accountNumberLast4?: string;
  swiftBic?: string;
  isVerified: boolean;
  isDefault: boolean;
  isActive: boolean;
  nickname?: string;
  addedAt: string;
  lastUsedAt?: string;
  totalPayouts: number;
  nuveiConnected?: boolean; // Whether bank account has Nuvei UPO
  nuveiUpoId?: string;
  nuveiStatus?: string;
}

interface EditFormData {
  accountHolderName: string;
  bankName: string;
  country: string;
  iban: string;
  swiftBic: string;
  nickname: string;
  setAsDefault: boolean;
}

// European countries with SEPA support
const SEPA_COUNTRIES = [
  { code: 'AT', name: 'Austria' },
  { code: 'BE', name: 'Belgium' },
  { code: 'BG', name: 'Bulgaria' },
  { code: 'HR', name: 'Croatia' },
  { code: 'CY', name: 'Cyprus' },
  { code: 'CZ', name: 'Czech Republic' },
  { code: 'DK', name: 'Denmark' },
  { code: 'EE', name: 'Estonia' },
  { code: 'FI', name: 'Finland' },
  { code: 'FR', name: 'France' },
  { code: 'DE', name: 'Germany' },
  { code: 'GR', name: 'Greece' },
  { code: 'HU', name: 'Hungary' },
  { code: 'IE', name: 'Ireland' },
  { code: 'IT', name: 'Italy' },
  { code: 'LV', name: 'Latvia' },
  { code: 'LT', name: 'Lithuania' },
  { code: 'LU', name: 'Luxembourg' },
  { code: 'MT', name: 'Malta' },
  { code: 'NL', name: 'Netherlands' },
  { code: 'NO', name: 'Norway' },
  { code: 'PL', name: 'Poland' },
  { code: 'PT', name: 'Portugal' },
  { code: 'RO', name: 'Romania' },
  { code: 'SK', name: 'Slovakia' },
  { code: 'SI', name: 'Slovenia' },
  { code: 'ES', name: 'Spain' },
  { code: 'SE', name: 'Sweden' },
  { code: 'CH', name: 'Switzerland' },
  { code: 'GB', name: 'United Kingdom' },
];

export default function BankAccountsSection() {
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<BankAccount | null>(null);
  const [editFormData, setEditFormData] = useState<EditFormData>({
    accountHolderName: '',
    bankName: '',
    country: '',
    iban: '',
    swiftBic: '',
    nickname: '',
    setAsDefault: false,
  });
  const [submitting, setSubmitting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    accountHolderName: '',
    accountHolderType: 'individual',
    bankName: '',
    country: 'DE',
    currency: 'eur',
    iban: '',
    swiftBic: '',
    nickname: '',
    setAsDefault: true,
  });

  useEffect(() => {
    fetchAccounts();
    
    // Check for bank setup callback params
    const urlParams = new URLSearchParams(window.location.search);
    const bankSetup = urlParams.get('bank_setup');
    const message = urlParams.get('message');
    const error = urlParams.get('error');
    
    if (bankSetup === 'success' && message) {
      toast.success(decodeURIComponent(message));
      // Clear URL params
      window.history.replaceState({}, '', window.location.pathname);
    } else if (bankSetup === 'failed' && error) {
      toast.error(decodeURIComponent(error));
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const fetchAccounts = async () => {
    try {
      const response = await fetch('/api/wallet/bank-accounts');
      const data = await response.json();
      if (data.success) {
        setAccounts(data.accounts);
      }
    } catch (error) {
      console.error('Error fetching bank accounts:', error);
      toast.error('Failed to load bank accounts');
    } finally {
      setLoading(false);
    }
  };

  const handleAddAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const response = await fetch('/api/wallet/bank-accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || 'Failed to add bank account');
        return;
      }

      toast.success(data.message || 'Bank account added successfully!');
      setAddDialogOpen(false);
      fetchAccounts();
      
      // Reset form
      setFormData({
        accountHolderName: '',
        accountHolderType: 'individual',
        bankName: '',
        country: 'DE',
        currency: 'eur',
        iban: '',
        swiftBic: '',
        nickname: '',
        setAsDefault: true,
      });
    } catch (error) {
      console.error('Error adding bank account:', error);
      toast.error('Failed to add bank account');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSetDefault = async (accountId: string) => {
    try {
      const response = await fetch(`/api/wallet/bank-accounts/${accountId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ setAsDefault: true }),
      });

      if (response.ok) {
        toast.success('Default account updated');
        fetchAccounts();
      }
    } catch (error) {
      toast.error('Failed to update default account');
    }
  };

  const openEditDialog = async (account: BankAccount) => {
    setEditingAccount(account);
    
    // Fetch full account details including IBAN
    try {
      const response = await fetch(`/api/wallet/bank-accounts/${account.id}`);
      const data = await response.json();
      
      if (data.success && data.account) {
        setEditFormData({
          accountHolderName: data.account.accountHolderName || '',
          bankName: data.account.bankName || '',
          country: data.account.country || '',
          iban: data.account.iban || '',
          swiftBic: data.account.swiftBic || '',
          nickname: data.account.nickname || '',
          setAsDefault: data.account.isDefault || false,
        });
      } else {
        // Fallback to display data if full details not available
        setEditFormData({
          accountHolderName: account.accountHolderName || '',
          bankName: account.bankName || '',
          country: account.country || '',
          iban: '', // Need to re-enter IBAN
          swiftBic: account.swiftBic || '',
          nickname: account.nickname || '',
          setAsDefault: account.isDefault || false,
        });
      }
    } catch (error) {
      console.error('Error fetching account details:', error);
      // Fallback to display data
      setEditFormData({
        accountHolderName: account.accountHolderName || '',
        bankName: account.bankName || '',
        country: account.country || '',
        iban: '',
        swiftBic: account.swiftBic || '',
        nickname: account.nickname || '',
        setAsDefault: account.isDefault || false,
      });
    }
    
    setEditDialogOpen(true);
  };

  const handleEditAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAccount) return;

    // Validation
    if (!editFormData.accountHolderName.trim()) {
      toast.error('Account holder name is required');
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch(`/api/wallet/bank-accounts/${editingAccount.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountHolderName: editFormData.accountHolderName.trim(),
          bankName: editFormData.bankName.trim() || undefined,
          country: editFormData.country,
          iban: editFormData.iban.replace(/\s/g, '').toUpperCase() || undefined,
          swiftBic: editFormData.swiftBic.toUpperCase() || undefined,
          nickname: editFormData.nickname.trim() || undefined,
          setAsDefault: editFormData.setAsDefault,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || 'Failed to update bank account');
        return;
      }

      toast.success('Bank account updated successfully!');
      setEditDialogOpen(false);
      setEditingAccount(null);
      fetchAccounts();
    } catch (error) {
      console.error('Error updating bank account:', error);
      toast.error('Failed to update bank account');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (accountId: string) => {
    try {
      const response = await fetch(`/api/wallet/bank-accounts/${accountId}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || 'Failed to remove bank account');
        return;
      }

      toast.success('Bank account removed');
      setDeleteConfirm(null);
      fetchAccounts();
    } catch (error) {
      toast.error('Failed to remove bank account');
    }
  };

  // Format IBAN with spaces for display
  const formatIban = (value: string) => {
    return value.replace(/\s/g, '').replace(/(.{4})/g, '$1 ').trim();
  };

  if (loading) {
    return (
      <Card className="bg-gray-800/50 border-gray-700">
        <CardContent className="py-8 text-center">
          <RefreshCw className="h-8 w-8 text-gray-400 animate-spin mx-auto mb-2" />
          <p className="text-gray-400">Loading bank accounts...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="bg-gray-800/50 border-gray-700">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-white flex items-center gap-2">
                <Building2 className="h-5 w-5 text-blue-400" />
                Bank Accounts for Withdrawals
              </CardTitle>
              <CardDescription className="text-gray-400">
                Add your bank account to receive withdrawals. Withdrawals are sent via bank transfer.
              </CardDescription>
            </div>
            <div className="flex gap-2">
              {/* Bank Account Entry - Primary method for SEPA withdrawals */}
              <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-blue-600 hover:bg-blue-700">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Bank Account
                  </Button>
                </DialogTrigger>
              <DialogContent className="bg-gray-900 border-gray-700 text-white max-w-lg">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Building2 className="h-5 w-5 text-blue-400" />
                    Add Bank Account
                  </DialogTitle>
                  <DialogDescription className="text-gray-400">
                    Enter your IBAN to receive withdrawals via SEPA bank transfer. 
                    Your bank details are stored securely and verified when you make a withdrawal.
                  </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleAddAccount} className="space-y-4 mt-4">
                  {/* Account Holder Name */}
                  <div className="space-y-2">
                    <Label htmlFor="accountHolderName" className="text-gray-300">
                      Account Holder Name *
                    </Label>
                    <Input
                      id="accountHolderName"
                      value={formData.accountHolderName}
                      onChange={(e) => setFormData({ ...formData, accountHolderName: e.target.value })}
                      placeholder="Full name as it appears on your bank account"
                      className="bg-gray-800 border-gray-600 text-white"
                      required
                    />
                  </div>

                  {/* Country */}
                  <div className="space-y-2">
                    <Label htmlFor="country" className="text-gray-300">
                      Country *
                    </Label>
                    <Select
                      value={formData.country}
                      onValueChange={(value) => setFormData({ ...formData, country: value })}
                    >
                      <SelectTrigger className="bg-gray-800 border-gray-600 text-white">
                        <SelectValue placeholder="Select country" />
                      </SelectTrigger>
                      <SelectContent className="bg-gray-800 border-gray-600">
                        {SEPA_COUNTRIES.map((country) => (
                          <SelectItem key={country.code} value={country.code}>
                            {country.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* IBAN */}
                  <div className="space-y-2">
                    <Label htmlFor="iban" className="text-gray-300">
                      IBAN *
                    </Label>
                    <Input
                      id="iban"
                      value={formData.iban}
                      onChange={(e) => setFormData({ ...formData, iban: e.target.value.toUpperCase() })}
                      placeholder="DE89 3704 0044 0532 0130 00"
                      className="bg-gray-800 border-gray-600 text-white font-mono"
                      required
                    />
                    <p className="text-xs text-gray-500 flex items-center gap-1">
                      <Info className="h-3 w-3" />
                      For testing, use: DE89370400440532013000
                    </p>
                  </div>

                  {/* Bank Name (optional) */}
                  <div className="space-y-2">
                    <Label htmlFor="bankName" className="text-gray-300">
                      Bank Name (optional)
                    </Label>
                    <Input
                      id="bankName"
                      value={formData.bankName}
                      onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
                      placeholder="e.g., Deutsche Bank"
                      className="bg-gray-800 border-gray-600 text-white"
                    />
                  </div>

                  {/* BIC/SWIFT (optional) */}
                  <div className="space-y-2">
                    <Label htmlFor="swiftBic" className="text-gray-300">
                      BIC/SWIFT Code (optional)
                    </Label>
                    <Input
                      id="swiftBic"
                      value={formData.swiftBic}
                      onChange={(e) => setFormData({ ...formData, swiftBic: e.target.value.toUpperCase() })}
                      placeholder="DEUTDEDB"
                      className="bg-gray-800 border-gray-600 text-white font-mono"
                      maxLength={11}
                    />
                  </div>

                  {/* Nickname */}
                  <div className="space-y-2">
                    <Label htmlFor="nickname" className="text-gray-300">
                      Nickname (optional)
                    </Label>
                    <Input
                      id="nickname"
                      value={formData.nickname}
                      onChange={(e) => setFormData({ ...formData, nickname: e.target.value })}
                      placeholder="e.g., My Main Account"
                      className="bg-gray-800 border-gray-600 text-white"
                    />
                  </div>

                  {/* Set as Default */}
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="setAsDefault"
                      checked={formData.setAsDefault}
                      onChange={(e) => setFormData({ ...formData, setAsDefault: e.target.checked })}
                      className="rounded border-gray-600 bg-gray-800"
                    />
                    <Label htmlFor="setAsDefault" className="text-gray-300 cursor-pointer">
                      Set as default withdrawal account
                    </Label>
                  </div>

                  <DialogFooter className="mt-6">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setAddDialogOpen(false)}
                      className="border-gray-600 text-gray-300"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={submitting || !formData.accountHolderName || !formData.iban}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      {submitting ? (
                        <>
                          <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                          Adding...
                        </>
                      ) : (
                        <>
                          <Plus className="h-4 w-4 mr-2" />
                          Add Account
                        </>
                      )}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {accounts.length === 0 ? (
            <div className="text-center py-8 border border-dashed border-gray-600 rounded-lg">
              <Building2 className="h-12 w-12 text-gray-500 mx-auto mb-3" />
              <h3 className="text-lg font-medium text-white mb-1">No Bank Accounts</h3>
              <p className="text-gray-400 mb-4">
                Add a bank account to receive withdrawals
              </p>
              <p className="text-gray-500 text-sm mb-4">
                <span className="text-blue-400">Note:</span> If you don&apos;t add a bank account, withdrawals will be refunded to your original payment method (the card or account you used to purchase credits).
              </p>
              <Button onClick={() => setAddDialogOpen(true)} className="bg-blue-600 hover:bg-blue-700">
                <Plus className="h-4 w-4 mr-2" />
                Add Bank Account
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {accounts.map((account) => (
                <div
                  key={account.id}
                  className={`p-4 rounded-lg border ${
                    account.isDefault
                      ? 'bg-blue-500/10 border-blue-500/30'
                      : 'bg-gray-700/50 border-gray-600'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded-lg ${account.isDefault ? 'bg-blue-500/20' : 'bg-gray-600'}`}>
                        <Building2 className={`h-5 w-5 ${account.isDefault ? 'text-blue-400' : 'text-gray-400'}`} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-white">
                            {account.nickname || account.bankName || 'Bank Account'}
                          </span>
                          {account.isDefault && (
                            <Badge className="bg-blue-500/20 text-blue-300 text-xs">
                              <Star className="h-3 w-3 mr-1" />
                              Default
                            </Badge>
                          )}
                          {account.isVerified && (
                            <Badge className="bg-green-500/20 text-green-300 text-xs">
                              <Check className="h-3 w-3 mr-1" />
                              Verified
                            </Badge>
                          )}
                          {account.nuveiStatus === 'ready' || account.nuveiConnected ? (
                            <Badge className="bg-emerald-500/20 text-emerald-300 text-xs">
                              <Check className="h-3 w-3 mr-1" />
                              Ready for Withdrawals
                            </Badge>
                          ) : (
                            <Badge className="bg-blue-500/20 text-blue-300 text-xs">
                              Manual Review
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-gray-400 mt-1">
                          {account.accountHolderName}
                        </p>
                        <div className="flex items-center gap-4 mt-2 text-sm">
                          <span className="text-gray-400 flex items-center gap-1">
                            <CreditCard className="h-3 w-3" />
                            ****{account.ibanLast4 || account.accountNumberLast4}
                          </span>
                          <span className="text-gray-400 flex items-center gap-1">
                            <Globe className="h-3 w-3" />
                            {account.country} ({account.currency.toUpperCase()})
                          </span>
                          {account.totalPayouts > 0 && (
                            <span className="text-gray-400">
                              {account.totalPayouts} payout{account.totalPayouts !== 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {!account.isDefault && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleSetDefault(account.id)}
                          className="border-gray-600 text-gray-300 hover:bg-gray-700"
                        >
                          <Star className="h-3 w-3 mr-1" />
                          Set Default
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openEditDialog(account)}
                        className="border-gray-600 text-blue-400 hover:bg-blue-500/10"
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                      {deleteConfirm === account.id ? (
                        <div className="flex items-center gap-1">
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDelete(account.id)}
                            className="bg-red-600 hover:bg-red-700"
                          >
                            Confirm
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setDeleteConfirm(null)}
                            className="border-gray-600"
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setDeleteConfirm(account.id)}
                          className="border-gray-600 text-red-400 hover:bg-red-500/10"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Info Box */}
          <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
            <div className="flex gap-2">
              <Info className="h-4 w-4 text-blue-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-300">
                <p className="font-medium">How Withdrawals Work</p>
                <p className="text-blue-200/80 mt-1">
                  When you request a withdrawal, you can choose to receive funds via bank transfer (SEPA) 
                  or refund to your original payment method. If you haven&apos;t added a bank account, 
                  withdrawals will automatically go back to the card or account you used to purchase credits. 
                  Withdrawals typically arrive in 3-5 business days.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Edit Bank Account Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={(open) => {
        if (!open) {
          setEditDialogOpen(false);
          setEditingAccount(null);
        }
      }}>
        <DialogContent className="bg-gray-900 border-gray-700 text-white max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-5 w-5 text-blue-400" />
              Edit Bank Account
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              Update your bank account details
            </DialogDescription>
          </DialogHeader>

          {editingAccount && (
            <form onSubmit={handleEditAccount} className="space-y-4 mt-4">
              {/* Account Holder Name */}
              <div className="space-y-2">
                <Label htmlFor="editAccountHolderName" className="text-gray-300">
                  Account Holder Name *
                </Label>
                <Input
                  id="editAccountHolderName"
                  value={editFormData.accountHolderName}
                  onChange={(e) => setEditFormData({ ...editFormData, accountHolderName: e.target.value })}
                  placeholder="Full name as it appears on your bank account"
                  className="bg-gray-800 border-gray-600 text-white"
                  required
                />
              </div>

              {/* Country */}
              <div className="space-y-2">
                <Label htmlFor="editCountry" className="text-gray-300">
                  Country *
                </Label>
                <Select
                  value={editFormData.country}
                  onValueChange={(value) => setEditFormData({ ...editFormData, country: value })}
                >
                  <SelectTrigger className="bg-gray-800 border-gray-600 text-white">
                    <SelectValue placeholder="Select country" />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-600">
                    {SEPA_COUNTRIES.map((country) => (
                      <SelectItem key={country.code} value={country.code}>
                        {country.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* IBAN */}
              <div className="space-y-2">
                <Label htmlFor="editIban" className="text-gray-300">
                  IBAN
                </Label>
                <Input
                  id="editIban"
                  value={editFormData.iban}
                  onChange={(e) => setEditFormData({ ...editFormData, iban: e.target.value.toUpperCase() })}
                  placeholder="DE89 3704 0044 0532 0130 00"
                  className="bg-gray-800 border-gray-600 text-white font-mono"
                />
                {editingAccount.ibanLast4 && !editFormData.iban && (
                  <p className="text-xs text-amber-400 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    Current IBAN ends in: ****{editingAccount.ibanLast4}. Leave empty to keep unchanged.
                  </p>
                )}
              </div>

              {/* Bank Name */}
              <div className="space-y-2">
                <Label htmlFor="editBankName" className="text-gray-300">
                  Bank Name (optional)
                </Label>
                <Input
                  id="editBankName"
                  value={editFormData.bankName}
                  onChange={(e) => setEditFormData({ ...editFormData, bankName: e.target.value })}
                  placeholder="e.g., Deutsche Bank"
                  className="bg-gray-800 border-gray-600 text-white"
                />
              </div>

              {/* BIC/SWIFT */}
              <div className="space-y-2">
                <Label htmlFor="editSwiftBic" className="text-gray-300">
                  BIC/SWIFT Code (optional)
                </Label>
                <Input
                  id="editSwiftBic"
                  value={editFormData.swiftBic}
                  onChange={(e) => setEditFormData({ ...editFormData, swiftBic: e.target.value.toUpperCase() })}
                  placeholder="DEUTDEDB"
                  className="bg-gray-800 border-gray-600 text-white font-mono"
                  maxLength={11}
                />
              </div>

              {/* Nickname */}
              <div className="space-y-2">
                <Label htmlFor="editNickname" className="text-gray-300">
                  Nickname (optional)
                </Label>
                <Input
                  id="editNickname"
                  value={editFormData.nickname}
                  onChange={(e) => setEditFormData({ ...editFormData, nickname: e.target.value })}
                  placeholder="e.g., My Main Account"
                  className="bg-gray-800 border-gray-600 text-white"
                />
                <p className="text-xs text-gray-500">
                  A friendly name to identify this account
                </p>
              </div>

              {/* Set as Default */}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="editSetAsDefault"
                  checked={editFormData.setAsDefault}
                  onChange={(e) => setEditFormData({ ...editFormData, setAsDefault: e.target.checked })}
                  className="rounded border-gray-600 bg-gray-800"
                />
                <Label htmlFor="editSetAsDefault" className="text-gray-300 cursor-pointer">
                  Set as default withdrawal account
                </Label>
              </div>

              <DialogFooter className="mt-6">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setEditDialogOpen(false);
                    setEditingAccount(null);
                  }}
                  className="border-gray-600 text-gray-300"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={submitting || !editFormData.accountHolderName.trim()}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {submitting ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4 mr-2" />
                      Save Changes
                    </>
                  )}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

