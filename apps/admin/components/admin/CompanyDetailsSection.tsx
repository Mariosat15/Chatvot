'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { 
  Save, 
  Building2, 
  MapPin, 
  Mail, 
  Phone, 
  Globe, 
  CreditCard,
  FileText,
  Loader2,
  Info,
  Check,
  Plus,
  Trash2,
  Star,
  Pencil,
  Landmark,
  X,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { EU_COUNTRIES, COUNTRY_NAMES } from '@/database/models/company-settings.model';

// Admin bank account interface
interface AdminBankAccount {
  _id: string;
  accountName: string;
  accountHolderName: string;
  bankName: string;
  country: string;
  currency: string;
  iban?: string;
  accountNumber?: string;
  routingNumber?: string;
  swiftBic?: string;
  isDefault: boolean;
  isActive: boolean;
  totalWithdrawals: number;
  totalAmount: number;
  notes?: string;
}

interface CompanySettings {
  companyName: string;
  legalName: string;
  registrationNumber: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  stateProvince: string;
  postalCode: string;
  country: string;
  email: string;
  phone: string;
  website: string;
  vatNumber: string;
  taxId: string;
  isVatRegistered: boolean;
  bankName: string;
  bankAccountNumber: string;
  bankIban: string;
  bankSwift: string;
}

const defaultSettings: CompanySettings = {
  companyName: '',
  legalName: '',
  registrationNumber: '',
  addressLine1: '',
  addressLine2: '',
  city: '',
  stateProvince: '',
  postalCode: '',
  country: 'US',
  email: '',
  phone: '',
  website: '',
  vatNumber: '',
  taxId: '',
  isVatRegistered: false,
  bankName: '',
  bankAccountNumber: '',
  bankIban: '',
  bankSwift: '',
};

// All countries with EU countries first
const ALL_COUNTRIES = [
  { code: '', name: '-- Select Country --', isEU: false },
  ...EU_COUNTRIES.map(code => ({ 
    code, 
    name: `🇪🇺 ${COUNTRY_NAMES[code] || code}`, 
    isEU: true 
  })),
  { code: 'divider', name: '─────────────────', isEU: false },
  ...Object.entries(COUNTRY_NAMES)
    .filter(([code]) => !EU_COUNTRIES.includes(code as any))
    .map(([code, name]) => ({ code, name, isEU: false }))
    .sort((a, b) => a.name.localeCompare(b.name)),
];

export default function CompanyDetailsSection() {
  const [settings, setSettings] = useState<CompanySettings>(defaultSettings);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  // Bank accounts state
  const [bankAccounts, setBankAccounts] = useState<AdminBankAccount[]>([]);
  const [bankDialogOpen, setBankDialogOpen] = useState(false);
  const [editingBank, setEditingBank] = useState<AdminBankAccount | null>(null);
  const [bankFormData, setBankFormData] = useState({
    accountName: '',
    accountHolderName: '',
    bankName: '',
    country: 'DE',
    currency: 'eur',
    iban: '',
    accountNumber: '',
    routingNumber: '',
    swiftBic: '',
    isDefault: false,
    notes: '',
  });
  const [savingBank, setSavingBank] = useState(false);

  useEffect(() => {
    fetchSettings();
    fetchBankAccounts();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await fetch('/api/company-settings');
      if (response.ok) {
        const data = await response.json();
        setSettings({
          ...defaultSettings,
          ...data,
        });
      }
    } catch (error) {
      console.error('Error fetching company settings:', error);
      toast.error('Failed to load company settings');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const response = await fetch('/api/company-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });

      if (response.ok) {
        toast.success('Company settings saved successfully');
      } else {
        toast.error('Failed to save company settings');
      }
    } catch (error) {
      console.error('Error saving company settings:', error);
      toast.error('An error occurred while saving');
    } finally {
      setIsSaving(false);
    }
  };

  // Bank account functions
  const fetchBankAccounts = async () => {
    try {
      const response = await fetch('/api/admin-bank-accounts');
      if (response.ok) {
        const data = await response.json();
        setBankAccounts(data.accounts || []);
      }
    } catch (error) {
      console.error('Error fetching bank accounts:', error);
    }
  };

  const openAddBankDialog = () => {
    setEditingBank(null);
    setBankFormData({
      accountName: '',
      accountHolderName: '',
      bankName: '',
      country: 'DE',
      currency: 'eur',
      iban: '',
      accountNumber: '',
      routingNumber: '',
      swiftBic: '',
      isDefault: bankAccounts.length === 0, // First account is default
      notes: '',
    });
    setBankDialogOpen(true);
  };

  const openEditBankDialog = (account: AdminBankAccount) => {
    setEditingBank(account);
    setBankFormData({
      accountName: account.accountName,
      accountHolderName: account.accountHolderName,
      bankName: account.bankName,
      country: account.country,
      currency: account.currency,
      iban: account.iban || '',
      accountNumber: account.accountNumber || '',
      routingNumber: account.routingNumber || '',
      swiftBic: account.swiftBic || '',
      isDefault: account.isDefault,
      notes: account.notes || '',
    });
    setBankDialogOpen(true);
  };

  const handleSaveBank = async () => {
    if (!bankFormData.accountName || !bankFormData.accountHolderName || !bankFormData.bankName) {
      toast.error('Please fill in required fields');
      return;
    }

    setSavingBank(true);
    try {
      const url = editingBank 
        ? `/api/admin-bank-accounts/${editingBank._id}`
        : '/api/admin-bank-accounts';
      const method = editingBank ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bankFormData),
      });

      if (response.ok) {
        toast.success(editingBank ? 'Bank account updated' : 'Bank account added');
        setBankDialogOpen(false);
        fetchBankAccounts();
      } else {
        toast.error('Failed to save bank account');
      }
    } catch (error) {
      console.error('Error saving bank account:', error);
      toast.error('An error occurred');
    } finally {
      setSavingBank(false);
    }
  };

  const handleDeleteBank = async (id: string) => {
    if (!confirm('Are you sure you want to delete this bank account?')) return;

    try {
      const response = await fetch(`/api/admin-bank-accounts/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        toast.success('Bank account deleted');
        fetchBankAccounts();
      } else {
        toast.error('Failed to delete bank account');
      }
    } catch (error) {
      console.error('Error deleting bank account:', error);
      toast.error('An error occurred');
    }
  };

  const handleSetDefault = async (id: string) => {
    try {
      const response = await fetch(`/api/admin-bank-accounts/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isDefault: true }),
      });

      if (response.ok) {
        toast.success('Default bank account updated');
        fetchBankAccounts();
      }
    } catch (error) {
      console.error('Error setting default:', error);
    }
  };

  const isEUCountry = EU_COUNTRIES.includes(settings.country as any);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-yellow-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Company Information */}
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <Building2 className="h-5 w-5 text-yellow-500" />
            Company Information
          </CardTitle>
          <CardDescription>
            Your company details used on invoices and official documents
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-gray-300">Company Name *</Label>
              <Input
                value={settings.companyName}
                onChange={(e) => setSettings({ ...settings, companyName: e.target.value })}
                placeholder="Your Company Name"
                className="bg-gray-800 border-gray-700 text-white"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-gray-300">Legal Name</Label>
              <Input
                value={settings.legalName}
                onChange={(e) => setSettings({ ...settings, legalName: e.target.value })}
                placeholder="Official registered name"
                className="bg-gray-800 border-gray-700 text-white"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-gray-300">Registration Number</Label>
              <Input
                value={settings.registrationNumber}
                onChange={(e) => setSettings({ ...settings, registrationNumber: e.target.value })}
                placeholder="Company registration number"
                className="bg-gray-800 border-gray-700 text-white"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Address */}
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <MapPin className="h-5 w-5 text-blue-500" />
            Address
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4">
            <div className="space-y-2">
              <Label className="text-gray-300">Address Line 1 *</Label>
              <Input
                value={settings.addressLine1}
                onChange={(e) => setSettings({ ...settings, addressLine1: e.target.value })}
                placeholder="Street address"
                className="bg-gray-800 border-gray-700 text-white"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-gray-300">Address Line 2</Label>
              <Input
                value={settings.addressLine2}
                onChange={(e) => setSettings({ ...settings, addressLine2: e.target.value })}
                placeholder="Suite, floor, etc."
                className="bg-gray-800 border-gray-700 text-white"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label className="text-gray-300">City *</Label>
              <Input
                value={settings.city}
                onChange={(e) => setSettings({ ...settings, city: e.target.value })}
                placeholder="City"
                className="bg-gray-800 border-gray-700 text-white"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-gray-300">State/Province</Label>
              <Input
                value={settings.stateProvince}
                onChange={(e) => setSettings({ ...settings, stateProvince: e.target.value })}
                placeholder="State or province"
                className="bg-gray-800 border-gray-700 text-white"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-gray-300">Postal Code *</Label>
              <Input
                value={settings.postalCode}
                onChange={(e) => setSettings({ ...settings, postalCode: e.target.value })}
                placeholder="Postal code"
                className="bg-gray-800 border-gray-700 text-white"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-gray-300">Country *</Label>
            <select
              value={settings.country}
              onChange={(e) => setSettings({ ...settings, country: e.target.value })}
              className="w-full bg-gray-800 border border-gray-700 text-white rounded-md px-3 py-2"
            >
              {ALL_COUNTRIES.map((country, index) => (
                <option 
                  key={`${country.code}-${index}`}
                  value={country.code} 
                  disabled={country.code === 'divider' || country.code === ''}
                >
                  {country.name}
                </option>
              ))}
            </select>
            {isEUCountry && (
              <p className="text-sm text-blue-400 flex items-center gap-1 mt-1">
                <Info className="h-4 w-4" />
                EU country - VAT may apply to invoices
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Contact Information */}
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <Mail className="h-5 w-5 text-green-500" />
            Contact Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label className="text-gray-300">Email *</Label>
              <Input
                type="email"
                value={settings.email}
                onChange={(e) => setSettings({ ...settings, email: e.target.value })}
                placeholder="company@example.com"
                className="bg-gray-800 border-gray-700 text-white"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-gray-300">Phone</Label>
              <Input
                value={settings.phone}
                onChange={(e) => setSettings({ ...settings, phone: e.target.value })}
                placeholder="+1 234 567 8900"
                className="bg-gray-800 border-gray-700 text-white"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-gray-300">Website</Label>
              <Input
                value={settings.website}
                onChange={(e) => setSettings({ ...settings, website: e.target.value })}
                placeholder="https://yourcompany.com"
                className="bg-gray-800 border-gray-700 text-white"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tax Information */}
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <FileText className="h-5 w-5 text-purple-500" />
            Tax Information
          </CardTitle>
          <CardDescription>
            {isEUCountry 
              ? 'Your company is in the EU. VAT will be applied to invoices.'
              : 'Your company is outside the EU. VAT typically does not apply.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-gray-800 rounded-lg">
            <div className="space-y-0.5">
              <Label className="text-white">VAT Registered</Label>
              <p className="text-sm text-gray-400">
                Enable if your company is registered for VAT
              </p>
            </div>
            <Switch
              checked={settings.isVatRegistered}
              onCheckedChange={(checked) => setSettings({ ...settings, isVatRegistered: checked })}
            />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {settings.isVatRegistered && (
              <div className="space-y-2">
                <Label className="text-gray-300">VAT Number</Label>
                <Input
                  value={settings.vatNumber}
                  onChange={(e) => setSettings({ ...settings, vatNumber: e.target.value })}
                  placeholder="e.g., DE123456789"
                  className="bg-gray-800 border-gray-700 text-white"
                />
                <p className="text-xs text-gray-500">
                  EU format: Country code + numbers (e.g., DE123456789)
                </p>
              </div>
            )}
            <div className="space-y-2">
              <Label className="text-gray-300">Tax ID</Label>
              <Input
                value={settings.taxId}
                onChange={(e) => setSettings({ ...settings, taxId: e.target.value })}
                placeholder="Local tax identification number"
                className="bg-gray-800 border-gray-700 text-white"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Banking Information for Invoices */}
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <CreditCard className="h-5 w-5 text-cyan-500" />
            Invoice Bank Details
          </CardTitle>
          <CardDescription>
            Primary bank details shown on invoices (for reference only)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-gray-300">Bank Name</Label>
              <Input
                value={settings.bankName}
                onChange={(e) => setSettings({ ...settings, bankName: e.target.value })}
                placeholder="Bank name"
                className="bg-gray-800 border-gray-700 text-white"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-gray-300">Account Number</Label>
              <Input
                value={settings.bankAccountNumber}
                onChange={(e) => setSettings({ ...settings, bankAccountNumber: e.target.value })}
                placeholder="Account number"
                className="bg-gray-800 border-gray-700 text-white"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-gray-300">IBAN</Label>
              <Input
                value={settings.bankIban}
                onChange={(e) => setSettings({ ...settings, bankIban: e.target.value })}
                placeholder="e.g., DE89370400440532013000"
                className="bg-gray-800 border-gray-700 text-white"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-gray-300">SWIFT/BIC</Label>
              <Input
                value={settings.bankSwift}
                onChange={(e) => setSettings({ ...settings, bankSwift: e.target.value })}
                placeholder="e.g., COBADEFFXXX"
                className="bg-gray-800 border-gray-700 text-white"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Company Bank Accounts for Withdrawals */}
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-white">
                <Landmark className="h-5 w-5 text-emerald-500" />
                Company Bank Accounts
              </CardTitle>
              <CardDescription>
                Bank accounts used for processing user withdrawals. Select which account to use when completing withdrawals.
              </CardDescription>
            </div>
            <Button onClick={openAddBankDialog} className="bg-emerald-600 hover:bg-emerald-700">
              <Plus className="h-4 w-4 mr-2" />
              Add Bank Account
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {bankAccounts.length === 0 ? (
            <div className="text-center py-8 border border-dashed border-gray-600 rounded-lg">
              <Landmark className="h-12 w-12 text-gray-500 mx-auto mb-3" />
              <h3 className="text-lg font-medium text-white mb-1">No Bank Accounts</h3>
              <p className="text-gray-400 mb-4">
                Add company bank accounts to process user withdrawals
              </p>
              <Button onClick={openAddBankDialog} className="bg-emerald-600 hover:bg-emerald-700">
                <Plus className="h-4 w-4 mr-2" />
                Add Your First Bank Account
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {bankAccounts.map((account) => (
                <div
                  key={account._id}
                  className={`p-4 rounded-lg border ${
                    account.isDefault
                      ? 'bg-emerald-500/10 border-emerald-500/30'
                      : 'bg-gray-800 border-gray-700'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded-lg ${account.isDefault ? 'bg-emerald-500/20' : 'bg-gray-700'}`}>
                        <Landmark className={`h-5 w-5 ${account.isDefault ? 'text-emerald-400' : 'text-gray-400'}`} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-white">{account.accountName}</span>
                          {account.isDefault && (
                            <Badge className="bg-emerald-500/20 text-emerald-300 text-xs">
                              <Star className="h-3 w-3 mr-1" />
                              Default
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-gray-400 mt-1">
                          {account.bankName} • {account.accountHolderName}
                        </p>
                        <div className="flex items-center gap-4 mt-2 text-sm">
                          {account.iban && (
                            <span className="text-gray-400 font-mono">
                              IBAN: ****{account.iban.slice(-4)}
                            </span>
                          )}
                          {account.accountNumber && (
                            <span className="text-gray-400 font-mono">
                              Acc: ****{account.accountNumber.slice(-4)}
                            </span>
                          )}
                          <span className="text-gray-500">
                            {account.totalWithdrawals} withdrawals
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {!account.isDefault && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleSetDefault(account._id)}
                          className="text-gray-400 hover:text-emerald-400"
                        >
                          <Star className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditBankDialog(account)}
                        className="text-gray-400 hover:text-blue-400"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteBank(account._id)}
                        className="text-gray-400 hover:text-red-400"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Info box */}
          <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
            <div className="flex gap-2">
              <Info className="h-4 w-4 text-blue-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-blue-300">
                When processing withdrawals, you can select which company bank account to use. 
                The selected bank will be recorded in the withdrawal details for tracking.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bank Account Dialog */}
      <Dialog open={bankDialogOpen} onOpenChange={setBankDialogOpen}>
        <DialogContent className="bg-gray-900 border-gray-800 max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-white">
              {editingBank ? 'Edit Bank Account' : 'Add Bank Account'}
            </DialogTitle>
            <DialogDescription>
              {editingBank 
                ? 'Update bank account details'
                : 'Add a new company bank account for processing withdrawals'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-gray-300">Account Name *</Label>
              <Input
                value={bankFormData.accountName}
                onChange={(e) => setBankFormData({ ...bankFormData, accountName: e.target.value })}
                placeholder="e.g., Main Business Account"
                className="bg-gray-800 border-gray-700 text-white"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-gray-300">Account Holder Name *</Label>
                <Input
                  value={bankFormData.accountHolderName}
                  onChange={(e) => setBankFormData({ ...bankFormData, accountHolderName: e.target.value })}
                  placeholder="Company legal name"
                  className="bg-gray-800 border-gray-700 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-gray-300">Bank Name *</Label>
                <Input
                  value={bankFormData.bankName}
                  onChange={(e) => setBankFormData({ ...bankFormData, bankName: e.target.value })}
                  placeholder="Bank name"
                  className="bg-gray-800 border-gray-700 text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-gray-300">Country</Label>
                <select
                  value={bankFormData.country}
                  onChange={(e) => setBankFormData({ ...bankFormData, country: e.target.value })}
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-md px-3 py-2"
                >
                  {ALL_COUNTRIES.filter(c => c.code && c.code !== 'divider').map((country) => (
                    <option key={country.code} value={country.code}>
                      {country.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label className="text-gray-300">Currency</Label>
                <select
                  value={bankFormData.currency}
                  onChange={(e) => setBankFormData({ ...bankFormData, currency: e.target.value })}
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-md px-3 py-2"
                >
                  <option value="eur">EUR - Euro</option>
                  <option value="usd">USD - US Dollar</option>
                  <option value="gbp">GBP - British Pound</option>
                  <option value="chf">CHF - Swiss Franc</option>
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-gray-300">IBAN</Label>
              <Input
                value={bankFormData.iban}
                onChange={(e) => setBankFormData({ ...bankFormData, iban: e.target.value.toUpperCase() })}
                placeholder="e.g., DE89370400440532013000"
                className="bg-gray-800 border-gray-700 text-white font-mono"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-gray-300">Account Number</Label>
                <Input
                  value={bankFormData.accountNumber}
                  onChange={(e) => setBankFormData({ ...bankFormData, accountNumber: e.target.value })}
                  placeholder="Account number"
                  className="bg-gray-800 border-gray-700 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-gray-300">SWIFT/BIC</Label>
                <Input
                  value={bankFormData.swiftBic}
                  onChange={(e) => setBankFormData({ ...bankFormData, swiftBic: e.target.value.toUpperCase() })}
                  placeholder="e.g., COBADEFFXXX"
                  className="bg-gray-800 border-gray-700 text-white font-mono"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-gray-300">Notes (Internal)</Label>
              <Input
                value={bankFormData.notes}
                onChange={(e) => setBankFormData({ ...bankFormData, notes: e.target.value })}
                placeholder="Optional internal notes"
                className="bg-gray-800 border-gray-700 text-white"
              />
            </div>

            <div className="flex items-center justify-between p-3 bg-gray-800 rounded-lg">
              <div>
                <Label className="text-white">Set as Default</Label>
                <p className="text-xs text-gray-400">Use this account by default for withdrawals</p>
              </div>
              <Switch
                checked={bankFormData.isDefault}
                onCheckedChange={(checked) => setBankFormData({ ...bankFormData, isDefault: checked })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setBankDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSaveBank} 
              disabled={savingBank}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {savingBank ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  {editingBank ? 'Update' : 'Add'} Bank Account
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button 
          onClick={handleSave} 
          disabled={isSaving}
          className="bg-yellow-500 hover:bg-yellow-600 text-black"
        >
          {isSaving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Save Company Details
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

