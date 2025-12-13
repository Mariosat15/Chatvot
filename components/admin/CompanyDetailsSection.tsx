'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
  Check
} from 'lucide-react';
import { EU_COUNTRIES, COUNTRY_NAMES } from '@/database/models/company-settings.model';

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

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await fetch('/api/admin/company-settings');
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
      const response = await fetch('/api/admin/company-settings', {
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

      {/* Banking Information */}
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <CreditCard className="h-5 w-5 text-cyan-500" />
            Banking Information
          </CardTitle>
          <CardDescription>
            Bank details shown on invoices for reference
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

