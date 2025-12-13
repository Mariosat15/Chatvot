'use client';

import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { 
  Save, 
  FileText, 
  Mail, 
  Eye, 
  Palette,
  Settings,
  Loader2,
  Info,
  AlertCircle,
  Scale,
  RotateCcw
} from 'lucide-react';
import { COUNTRY_NAMES } from '@/database/models/company-settings.model';

interface InvoiceSettings {
  vatEnabled: boolean;
  vatPercentage: number;
  vatLabel: string;
  invoicePrefix: string;
  invoiceNumberPadding: number;
  showLogo: boolean;
  showCompanyAddress: boolean;
  showBankDetails: boolean;
  showVatNumber: boolean;
  showRegistrationNumber: boolean;
  invoiceTitle: string;
  invoiceFooter: string;
  paymentTerms: string;
  thankYouMessage: string;
  legalDisclaimer: string;
  showLegalDisclaimer: boolean;
  sendInvoiceOnPurchase: boolean;
  invoiceEmailSubject: string;
  invoiceEmailBody: string;
  currencySymbol: string;
  currencyPosition: 'before' | 'after';
  primaryColor: string;
  accentColor: string;
}

interface CompanySettings {
  companyName: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  postalCode: string;
  country: string;
  email: string;
  phone: string;
  vatNumber: string;
  registrationNumber: string;
  bankName: string;
  bankIban: string;
  bankSwift: string;
}

const DEFAULT_LEGAL_DISCLAIMER = `**Nature of Purchase:** This invoice confirms the purchase of virtual credits/digital currency for use exclusively within our platform. These credits are non-transferable, have no cash value outside the platform, and cannot be exchanged for real currency or transferred to third parties.

**Refund Policy & Right of Withdrawal:** In accordance with Article 16(m) of the EU Consumer Rights Directive (2011/83/EU) and equivalent regulations, digital content supplied immediately upon purchase is exempt from the 14-day cooling-off period. By completing this purchase, you acknowledged and agreed that the digital credits would be available for immediate use, thereby waiving your right of withdrawal. Refunds are generally not available except where required by applicable law or at our sole discretion.

**VAT Information (EU Customers):** If applicable, VAT has been charged in accordance with EU VAT regulations. The VAT amount and rate are displayed on this invoice. For business customers with a valid VAT number, reverse charge rules may apply - please contact us for VAT-exempt invoicing.

**Data Protection (GDPR Compliance):** Your personal data is processed in accordance with the General Data Protection Regulation (GDPR) and our Privacy Policy. We collect and process only the data necessary to provide our services, process transactions, and comply with legal obligations. You have the right to access, rectify, erase, and port your data.

**Consumer Rights (EU/EEA Customers):** As an EU consumer, you have rights under EU consumer protection laws. These include the right to clear information before purchase, protection against unfair contract terms, and access to redress mechanisms. Nothing in this notice limits your statutory consumer rights.

**Non-EU Customers:** If you are located outside the European Union, your purchase is governed by the laws of our registered jurisdiction. Consumer protection rights vary by jurisdiction; please refer to your local laws for applicable protections.

**Dispute Resolution:** We aim to resolve any disputes amicably. EU consumers may use the European Commission's Online Dispute Resolution (ODR) platform at https://ec.europa.eu/consumers/odr.

**Terms of Service:** This purchase is subject to our full Terms of Service and User Agreement, which you accepted at registration.

**Record Retention:** Please retain this invoice for your records. This document serves as proof of your purchase and may be required for warranty claims, tax purposes, or dispute resolution.`;

const defaultInvoiceSettings: InvoiceSettings = {
  vatEnabled: true,
  vatPercentage: 21,
  vatLabel: 'VAT',
  invoicePrefix: 'INV-',
  invoiceNumberPadding: 6,
  showLogo: true,
  showCompanyAddress: true,
  showBankDetails: true,
  showVatNumber: true,
  showRegistrationNumber: true,
  invoiceTitle: 'INVOICE',
  invoiceFooter: 'Thank you for your purchase!',
  paymentTerms: 'Payment received via credit card.',
  thankYouMessage: 'Thank you for your business!',
  legalDisclaimer: DEFAULT_LEGAL_DISCLAIMER,
  showLegalDisclaimer: true,
  sendInvoiceOnPurchase: true,
  invoiceEmailSubject: 'Your Invoice from {{companyName}} - {{invoiceNumber}}',
  invoiceEmailBody: 'Dear {{customerName}},\n\nThank you for your purchase! Please find your invoice attached.\n\nBest regards,\n{{companyName}}',
  currencySymbol: '€',
  currencyPosition: 'before',
  primaryColor: '#FDD458',
  accentColor: '#141414',
};

const defaultCompanySettings: CompanySettings = {
  companyName: 'Your Company',
  addressLine1: '123 Business Street',
  addressLine2: '',
  city: 'Amsterdam',
  postalCode: '1012 AB',
  country: 'NL',
  email: 'info@yourcompany.com',
  phone: '+31 20 123 4567',
  vatNumber: 'NL123456789B01',
  registrationNumber: '12345678',
  bankName: 'ING Bank',
  bankIban: 'NL91 INGB 0001 2345 67',
  bankSwift: 'INGBNL2A',
};

export default function InvoiceTemplateSection() {
  const [invoiceSettings, setInvoiceSettings] = useState<InvoiceSettings>(defaultInvoiceSettings);
  const [companySettings, setCompanySettings] = useState<CompanySettings>(defaultCompanySettings);
  const [companyInEU, setCompanyInEU] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('settings');

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await fetch('/api/admin/invoice-settings');
      if (response.ok) {
        const data = await response.json();
        if (data.invoiceSettings) {
          setInvoiceSettings({ ...defaultInvoiceSettings, ...data.invoiceSettings });
        }
        if (data.companySettings) {
          setCompanySettings({ ...defaultCompanySettings, ...data.companySettings });
        }
        setCompanyInEU(data.companyInEU ?? true);
      }
    } catch (error) {
      console.error('Error fetching invoice settings:', error);
      toast.error('Failed to load invoice settings');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const response = await fetch('/api/admin/invoice-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invoiceSettings),
      });

      if (response.ok) {
        toast.success('Invoice settings saved successfully');
      } else {
        toast.error('Failed to save invoice settings');
      }
    } catch (error) {
      console.error('Error saving invoice settings:', error);
      toast.error('An error occurred while saving');
    } finally {
      setIsSaving(false);
    }
  };

  // Calculate sample invoice values
  const sampleInvoice = useMemo(() => {
    const subtotal = 50.00;
    const shouldApplyVat = companyInEU && invoiceSettings.vatEnabled;
    const vatAmount = shouldApplyVat ? (subtotal * invoiceSettings.vatPercentage) / 100 : 0;
    const total = subtotal + vatAmount;
    const invoiceNumber = `${invoiceSettings.invoicePrefix}${'1'.padStart(invoiceSettings.invoiceNumberPadding, '0')}`;
    
    return { subtotal, vatAmount, total, invoiceNumber, shouldApplyVat };
  }, [companyInEU, invoiceSettings.vatEnabled, invoiceSettings.vatPercentage, invoiceSettings.invoicePrefix, invoiceSettings.invoiceNumberPadding]);

  const formatCurrency = (amount: number) => {
    const formatted = amount.toFixed(2);
    return invoiceSettings.currencyPosition === 'after' 
      ? `${formatted}${invoiceSettings.currencySymbol}` 
      : `${invoiceSettings.currencySymbol}${formatted}`;
  };

  const companyCountryName = COUNTRY_NAMES[companySettings.country] || companySettings.country;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-yellow-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="bg-gray-800 border-gray-700">
          <TabsTrigger value="settings" className="data-[state=active]:bg-yellow-500 data-[state=active]:text-black">
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </TabsTrigger>
          <TabsTrigger value="template" className="data-[state=active]:bg-yellow-500 data-[state=active]:text-black">
            <FileText className="h-4 w-4 mr-2" />
            Template
          </TabsTrigger>
          <TabsTrigger value="email" className="data-[state=active]:bg-yellow-500 data-[state=active]:text-black">
            <Mail className="h-4 w-4 mr-2" />
            Email
          </TabsTrigger>
          <TabsTrigger value="legal" className="data-[state=active]:bg-yellow-500 data-[state=active]:text-black">
            <Scale className="h-4 w-4 mr-2" />
            Legal
          </TabsTrigger>
          <TabsTrigger value="preview" className="data-[state=active]:bg-yellow-500 data-[state=active]:text-black">
            <Eye className="h-4 w-4 mr-2" />
            Preview
          </TabsTrigger>
        </TabsList>

        {/* Settings Tab */}
        <TabsContent value="settings" className="space-y-6 mt-6">
          {/* VAT Configuration */}
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <FileText className="h-5 w-5 text-yellow-500" />
                VAT Configuration
              </CardTitle>
              <CardDescription>
                {companyInEU 
                  ? '🇪🇺 Your company is registered in the EU. Configure VAT settings below.'
                  : '🌍 Your company is outside the EU. VAT typically does not apply.'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!companyInEU && (
                <div className="p-4 bg-blue-900/20 border border-blue-800 rounded-lg">
                  <p className="text-sm text-blue-300 flex items-center gap-2">
                    <Info className="h-4 w-4" />
                    VAT is disabled because your company is not in the EU. Change your company country in Company Details to enable VAT.
                  </p>
                </div>
              )}
              
              <div className="flex items-center justify-between p-4 bg-gray-800 rounded-lg">
                <div className="space-y-0.5">
                  <Label className="text-white">Enable VAT</Label>
                  <p className="text-sm text-gray-400">
                    Add VAT to invoices for EU customers
                  </p>
                </div>
                <Switch
                  checked={invoiceSettings.vatEnabled}
                  onCheckedChange={(checked) => setInvoiceSettings({ ...invoiceSettings, vatEnabled: checked })}
                  disabled={!companyInEU}
                />
              </div>
              
              {invoiceSettings.vatEnabled && companyInEU && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-gray-300">VAT Percentage (%)</Label>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      value={invoiceSettings.vatPercentage}
                      onChange={(e) => setInvoiceSettings({ ...invoiceSettings, vatPercentage: parseFloat(e.target.value) || 0 })}
                      className="bg-gray-800 border-gray-700 text-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-gray-300">VAT Label</Label>
                    <Input
                      value={invoiceSettings.vatLabel}
                      onChange={(e) => setInvoiceSettings({ ...invoiceSettings, vatLabel: e.target.value })}
                      placeholder="VAT, BTW, MwSt, etc."
                      className="bg-gray-800 border-gray-700 text-white"
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Invoice Numbering */}
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader>
              <CardTitle className="text-white">Invoice Numbering</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-gray-300">Invoice Prefix</Label>
                  <Input
                    value={invoiceSettings.invoicePrefix}
                    onChange={(e) => setInvoiceSettings({ ...invoiceSettings, invoicePrefix: e.target.value })}
                    placeholder="INV-"
                    className="bg-gray-800 border-gray-700 text-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-gray-300">Number Padding</Label>
                  <Input
                    type="number"
                    min="1"
                    max="10"
                    value={invoiceSettings.invoiceNumberPadding}
                    onChange={(e) => setInvoiceSettings({ ...invoiceSettings, invoiceNumberPadding: parseInt(e.target.value) || 6 })}
                    className="bg-gray-800 border-gray-700 text-white"
                  />
                </div>
              </div>
              <p className="text-sm text-gray-400">
                Example: <span className="text-yellow-500 font-mono">{sampleInvoice.invoiceNumber}</span>
              </p>
            </CardContent>
          </Card>

          {/* Currency Settings */}
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader>
              <CardTitle className="text-white">Currency Display</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-gray-300">Currency Symbol</Label>
                  <Input
                    value={invoiceSettings.currencySymbol}
                    onChange={(e) => setInvoiceSettings({ ...invoiceSettings, currencySymbol: e.target.value })}
                    placeholder="€"
                    className="bg-gray-800 border-gray-700 text-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-gray-300">Symbol Position</Label>
                  <select
                    value={invoiceSettings.currencyPosition}
                    onChange={(e) => setInvoiceSettings({ ...invoiceSettings, currencyPosition: e.target.value as 'before' | 'after' })}
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-md px-3 py-2"
                  >
                    <option value="before">Before amount (€50.00)</option>
                    <option value="after">After amount (50.00€)</option>
                  </select>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Template Tab */}
        <TabsContent value="template" className="space-y-6 mt-6">
          {/* Display Options */}
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader>
              <CardTitle className="text-white">Display Options</CardTitle>
              <CardDescription>Choose what to show on invoices</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  { key: 'showLogo', label: 'Show Logo', desc: 'Display company logo' },
                  { key: 'showCompanyAddress', label: 'Show Address', desc: 'Display company address' },
                  { key: 'showBankDetails', label: 'Show Bank Details', desc: 'Display banking information' },
                  { key: 'showVatNumber', label: 'Show VAT Number', desc: 'Display VAT registration number' },
                  { key: 'showRegistrationNumber', label: 'Show Registration Number', desc: 'Display company registration' },
                ].map((option) => (
                  <div key={option.key} className="flex items-center justify-between p-3 bg-gray-800 rounded-lg">
                    <div>
                      <Label className="text-white">{option.label}</Label>
                      <p className="text-xs text-gray-400">{option.desc}</p>
                    </div>
                    <Switch
                      checked={(invoiceSettings as any)[option.key]}
                      onCheckedChange={(checked) => setInvoiceSettings({ ...invoiceSettings, [option.key]: checked })}
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Custom Text */}
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader>
              <CardTitle className="text-white">Custom Text</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="text-gray-300">Invoice Title</Label>
                <Input
                  value={invoiceSettings.invoiceTitle}
                  onChange={(e) => setInvoiceSettings({ ...invoiceSettings, invoiceTitle: e.target.value })}
                  placeholder="INVOICE"
                  className="bg-gray-800 border-gray-700 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-gray-300">Payment Terms</Label>
                <Input
                  value={invoiceSettings.paymentTerms}
                  onChange={(e) => setInvoiceSettings({ ...invoiceSettings, paymentTerms: e.target.value })}
                  placeholder="Payment received via credit card."
                  className="bg-gray-800 border-gray-700 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-gray-300">Footer Text</Label>
                <Input
                  value={invoiceSettings.invoiceFooter}
                  onChange={(e) => setInvoiceSettings({ ...invoiceSettings, invoiceFooter: e.target.value })}
                  placeholder="Thank you for your purchase!"
                  className="bg-gray-800 border-gray-700 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-gray-300">Thank You Message</Label>
                <Input
                  value={invoiceSettings.thankYouMessage}
                  onChange={(e) => setInvoiceSettings({ ...invoiceSettings, thankYouMessage: e.target.value })}
                  placeholder="Thank you for your business!"
                  className="bg-gray-800 border-gray-700 text-white"
                />
              </div>
            </CardContent>
          </Card>

          {/* Colors */}
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <Palette className="h-5 w-5 text-purple-500" />
                Colors
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-gray-300">Primary Color</Label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={invoiceSettings.primaryColor}
                      onChange={(e) => setInvoiceSettings({ ...invoiceSettings, primaryColor: e.target.value })}
                      className="h-10 w-14 rounded cursor-pointer"
                    />
                    <Input
                      value={invoiceSettings.primaryColor}
                      onChange={(e) => setInvoiceSettings({ ...invoiceSettings, primaryColor: e.target.value })}
                      className="bg-gray-800 border-gray-700 text-white font-mono"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-gray-300">Accent Color</Label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={invoiceSettings.accentColor}
                      onChange={(e) => setInvoiceSettings({ ...invoiceSettings, accentColor: e.target.value })}
                      className="h-10 w-14 rounded cursor-pointer"
                    />
                    <Input
                      value={invoiceSettings.accentColor}
                      onChange={(e) => setInvoiceSettings({ ...invoiceSettings, accentColor: e.target.value })}
                      className="bg-gray-800 border-gray-700 text-white font-mono"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Email Tab */}
        <TabsContent value="email" className="space-y-6 mt-6">
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <Mail className="h-5 w-5 text-green-500" />
                Email Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-gray-800 rounded-lg">
                <div className="space-y-0.5">
                  <Label className="text-white">Send Invoice on Purchase</Label>
                  <p className="text-sm text-gray-400">
                    Automatically email invoice after successful credit purchase
                  </p>
                </div>
                <Switch
                  checked={invoiceSettings.sendInvoiceOnPurchase}
                  onCheckedChange={(checked) => setInvoiceSettings({ ...invoiceSettings, sendInvoiceOnPurchase: checked })}
                />
              </div>
              
              <div className="space-y-2">
                <Label className="text-gray-300">Email Subject</Label>
                <Input
                  value={invoiceSettings.invoiceEmailSubject}
                  onChange={(e) => setInvoiceSettings({ ...invoiceSettings, invoiceEmailSubject: e.target.value })}
                  placeholder="Your Invoice from {{companyName}} - {{invoiceNumber}}"
                  className="bg-gray-800 border-gray-700 text-white"
                />
                <p className="text-xs text-gray-500">
                  Available variables: {'{{companyName}}'}, {'{{invoiceNumber}}'}, {'{{customerName}}'}
                </p>
              </div>
              
              <div className="space-y-2">
                <Label className="text-gray-300">Email Body</Label>
                <Textarea
                  value={invoiceSettings.invoiceEmailBody}
                  onChange={(e) => setInvoiceSettings({ ...invoiceSettings, invoiceEmailBody: e.target.value })}
                  placeholder="Dear {{customerName}},&#10;&#10;Thank you for your purchase!..."
                  className="bg-gray-800 border-gray-700 text-white min-h-[150px]"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Legal Tab */}
        <TabsContent value="legal" className="space-y-6 mt-6">
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <Scale className="h-5 w-5 text-blue-500" />
                Legal Disclaimer
              </CardTitle>
              <CardDescription>
                This disclaimer appears at the bottom of invoices and emails. It covers EU consumer rights, refund policies, VAT information, and GDPR compliance.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-gray-800 rounded-lg">
                <div className="space-y-0.5">
                  <Label className="text-white">Show Legal Disclaimer</Label>
                  <p className="text-sm text-gray-400">
                    Include the legal disclaimer on invoices and email
                  </p>
                </div>
                <Switch
                  checked={invoiceSettings.showLegalDisclaimer}
                  onCheckedChange={(checked) => setInvoiceSettings({ ...invoiceSettings, showLegalDisclaimer: checked })}
                />
              </div>

              {invoiceSettings.showLegalDisclaimer && (
                <>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-gray-300">Disclaimer Text</Label>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setInvoiceSettings({ ...invoiceSettings, legalDisclaimer: DEFAULT_LEGAL_DISCLAIMER })}
                        className="text-xs bg-gray-800 border-gray-700 hover:bg-gray-700"
                      >
                        <RotateCcw className="h-3 w-3 mr-1" />
                        Reset to Default
                      </Button>
                    </div>
                    <Textarea
                      value={invoiceSettings.legalDisclaimer}
                      onChange={(e) => setInvoiceSettings({ ...invoiceSettings, legalDisclaimer: e.target.value })}
                      className="bg-gray-800 border-gray-700 text-white min-h-[400px] font-mono text-sm"
                      placeholder="Enter your legal disclaimer text here..."
                    />
                    <p className="text-xs text-gray-500">
                      Use **text** for bold. Available variables: {'{{companyName}}'}, {'{{companyEmail}}'}, {'{{vatNumber}}'}
                    </p>
                  </div>

                  <div className="p-4 bg-blue-900/20 border border-blue-800 rounded-lg">
                    <div className="flex items-start gap-2">
                      <Info className="h-5 w-5 text-blue-400 shrink-0 mt-0.5" />
                      <div className="text-sm text-blue-300">
                        <p className="font-semibold mb-1">Important Sections to Include:</p>
                        <ul className="list-disc list-inside space-y-1 text-blue-200/80 text-xs">
                          <li><strong>Nature of Purchase</strong> - Clarify digital content/credits</li>
                          <li><strong>Refund Policy</strong> - EU Consumer Rights Directive compliance</li>
                          <li><strong>VAT Information</strong> - For EU customers</li>
                          <li><strong>GDPR Compliance</strong> - Data protection notice</li>
                          <li><strong>Consumer Rights</strong> - EU/EEA specific rights</li>
                          <li><strong>Non-EU Customers</strong> - Jurisdiction information</li>
                          <li><strong>Dispute Resolution</strong> - ODR platform link for EU</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Preview Tab */}
        <TabsContent value="preview" className="mt-6">
          <Card className="bg-white border-gray-300">
            <CardContent className="p-0">
              <div 
                className="overflow-hidden rounded-lg"
                style={{ backgroundColor: '#f5f5f5' }}
              >
                {/* Invoice Preview */}
                <div 
                  className="max-w-2xl mx-auto bg-white shadow-lg rounded-lg overflow-hidden my-6"
                  style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}
                >
                  {/* Header */}
                  <div 
                    className="p-10 flex justify-between items-start"
                    style={{ backgroundColor: invoiceSettings.accentColor, color: '#fff' }}
                  >
                    <div>
                      {invoiceSettings.showLogo && (
                        <div className="mb-4">
                          <div 
                            className="text-2xl font-bold"
                            style={{ color: invoiceSettings.primaryColor }}
                          >
                            {companySettings.companyName}
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="text-right">
                      <div 
                        className="text-3xl font-bold mb-2"
                        style={{ color: invoiceSettings.primaryColor }}
                      >
                        {invoiceSettings.invoiceTitle}
                      </div>
                      <div className="text-sm opacity-90">{sampleInvoice.invoiceNumber}</div>
                      <div className="text-sm opacity-80">
                        {new Date().toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric' })}
                      </div>
                      <div 
                        className="inline-block mt-2 px-3 py-1 rounded-full text-xs font-semibold"
                        style={{ backgroundColor: '#10b981', color: '#fff' }}
                      >
                        PAID
                      </div>
                    </div>
                  </div>
                  
                  {/* Body */}
                  <div className="p-10">
                    {/* Addresses */}
                    <div className="flex justify-between mb-10">
                      <div>
                        <div className="text-xs uppercase text-gray-500 mb-2 font-semibold">From</div>
                        <div className="font-semibold text-gray-900">{companySettings.companyName}</div>
                        {invoiceSettings.showCompanyAddress && (
                          <div className="text-sm text-gray-600">
                            {companySettings.addressLine1}<br />
                            {companySettings.city}, {companySettings.postalCode}<br />
                            {companyCountryName}
                          </div>
                        )}
                        <div className="text-xs text-gray-500 mt-2">
                          {companySettings.email}<br />
                          {invoiceSettings.showVatNumber && companySettings.vatNumber && `VAT: ${companySettings.vatNumber}`}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs uppercase text-gray-500 mb-2 font-semibold">Bill To</div>
                        <div className="font-semibold text-gray-900">John Doe</div>
                        <div className="text-sm text-gray-600">john.doe@example.com</div>
                      </div>
                    </div>
                    
                    {/* Items Table */}
                    <table className="w-full mb-8">
                      <thead>
                        <tr className="border-b-2 border-gray-200">
                          <th className="text-left py-3 text-xs uppercase text-gray-500">Description</th>
                          <th className="text-right py-3 text-xs uppercase text-gray-500">Qty</th>
                          <th className="text-right py-3 text-xs uppercase text-gray-500">Price</th>
                          <th className="text-right py-3 text-xs uppercase text-gray-500">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-b border-gray-100">
                          <td className="py-4 text-gray-900">Credit Purchase - 50 Credits</td>
                          <td className="py-4 text-right text-gray-600">1</td>
                          <td className="py-4 text-right text-gray-600">{formatCurrency(50)}</td>
                          <td className="py-4 text-right text-gray-900">{formatCurrency(50)}</td>
                        </tr>
                      </tbody>
                    </table>
                    
                    {/* Totals */}
                    <div className="ml-auto w-72">
                      <div className="flex justify-between py-2 border-b border-gray-100">
                        <span className="text-gray-500">Subtotal</span>
                        <span className="text-gray-900">{formatCurrency(sampleInvoice.subtotal)}</span>
                      </div>
                      {sampleInvoice.shouldApplyVat && (
                        <div className="flex justify-between py-2 text-gray-500">
                          <span>{invoiceSettings.vatLabel} ({invoiceSettings.vatPercentage}%)</span>
                          <span>{formatCurrency(sampleInvoice.vatAmount)}</span>
                        </div>
                      )}
                      <div 
                        className="flex justify-between py-4 text-lg font-bold mt-2"
                        style={{ borderTop: `2px solid ${invoiceSettings.primaryColor}` }}
                      >
                        <span className="text-gray-900">Total</span>
                        <span style={{ color: invoiceSettings.primaryColor }}>{formatCurrency(sampleInvoice.total)}</span>
                      </div>
                    </div>
                  </div>
                  
                  {/* Footer */}
                  <div className="p-10 bg-gray-50 border-t border-gray-200">
                    {invoiceSettings.paymentTerms && (
                      <div className="mb-4">
                        <div className="text-xs uppercase text-gray-500 mb-1 font-semibold">Payment Information</div>
                        <div className="text-sm text-gray-700">{invoiceSettings.paymentTerms}</div>
                      </div>
                    )}
                    
                    {invoiceSettings.showBankDetails && companySettings.bankName && (
                      <div className="mb-4">
                        <div className="text-xs uppercase text-gray-500 mb-1 font-semibold">Bank Details</div>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div><span className="text-gray-500">Bank:</span> {companySettings.bankName}</div>
                          <div><span className="text-gray-500">IBAN:</span> {companySettings.bankIban}</div>
                          <div><span className="text-gray-500">SWIFT:</span> {companySettings.bankSwift}</div>
                        </div>
                      </div>
                    )}
                    
                    {invoiceSettings.invoiceFooter && (
                      <div className="text-sm text-gray-600">{invoiceSettings.invoiceFooter}</div>
                    )}
                  </div>
                  
                  {invoiceSettings.thankYouMessage && (
                    <div 
                      className="text-center py-4 font-medium"
                      style={{ color: invoiceSettings.primaryColor }}
                    >
                      {invoiceSettings.thankYouMessage}
                    </div>
                  )}
                  
                  {/* Legal Disclaimer Preview */}
                  {invoiceSettings.showLegalDisclaimer && invoiceSettings.legalDisclaimer && (
                    <div className="mx-10 mb-10 p-5 bg-gray-50 border border-gray-200 rounded-lg">
                      <h4 className="text-[11px] font-semibold text-gray-700 uppercase tracking-wide border-b border-gray-200 pb-2 mb-4">
                        Important Legal Information
                      </h4>
                      <div 
                        className="text-[9px] text-gray-600 leading-relaxed space-y-2"
                        dangerouslySetInnerHTML={{
                          __html: invoiceSettings.legalDisclaimer
                            .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
                            .replace(/\{\{companyName\}\}/g, companySettings.companyName)
                            .replace(/\{\{companyEmail\}\}/g, companySettings.email)
                            .replace(/\{\{vatNumber\}\}/g, companySettings.vatNumber)
                            .split(/\n\n+/)
                            .map(p => `<p class="mb-2">${p.trim()}</p>`)
                            .join('')
                        }}
                      />
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

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
              Save Invoice Settings
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

