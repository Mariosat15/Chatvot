import { connectToDatabase } from '@/database/mongoose';
import Invoice, { IInvoice, IInvoiceLineItem } from '@/database/models/invoice.model';
import InvoiceSettings from '@/database/models/invoice-settings.model';
import CompanySettings, { isEUCountry, COUNTRY_NAMES } from '@/database/models/company-settings.model';
import { WhiteLabel } from '@/database/models/whitelabel.model';

/**
 * Format disclaimer text - convert markdown bold to HTML and replace placeholders
 */
function formatDisclaimer(disclaimer: string, variables: { companyName: string; companyEmail: string; vatNumber: string }): string {
  let formatted = disclaimer;
  
  // Replace variables
  formatted = formatted.replace(/\{\{companyName\}\}/g, variables.companyName);
  formatted = formatted.replace(/\{\{companyEmail\}\}/g, variables.companyEmail);
  formatted = formatted.replace(/\{\{vatNumber\}\}/g, variables.vatNumber);
  
  // Convert markdown bold (**text**) to HTML strong
  formatted = formatted.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  
  // Convert double newlines to paragraph breaks
  const paragraphs = formatted.split(/\n\n+/);
  formatted = paragraphs.map(p => `<p style="margin: 0 0 8px 0;">${p.trim()}</p>`).join('\n        ');
  
  return formatted;
}

export interface CreateInvoiceParams {
  userId: string;
  customerName: string;
  customerEmail: string;
  customerAddress?: {
    line1?: string;
    line2?: string;
    city?: string;
    stateProvince?: string;
    postalCode?: string;
    country?: string;
  };
  transactionId: string;
  transactionType: 'deposit' | 'purchase' | 'subscription';
  paymentMethod?: string;
  paymentId?: string;
  lineItems: {
    description: string;
    quantity: number;
    unitPrice: number;
  }[];
  currency?: string;
  notes?: string;
  // Optional: use actual VAT amount instead of calculating from subtotal
  // This is needed when VAT only applies to certain line items (e.g., credits but not fees)
  actualVatAmount?: number;
}

export interface GeneratedInvoice {
  invoice: IInvoice;
  html: string;
  shouldSendEmail: boolean;
}

/**
 * Invoice Service
 * Handles invoice generation, VAT calculation, and email sending
 */
export const InvoiceService = {
  /**
   * Create a new invoice for a transaction
   */
  createInvoice: async (params: CreateInvoiceParams): Promise<GeneratedInvoice> => {
    await connectToDatabase();
    
    // Get settings
    const [invoiceSettings, companySettings, whiteLabelSettings] = await Promise.all([
      InvoiceSettings.getSingleton(),
      CompanySettings.getSingleton(),
      WhiteLabel.findOne(),
    ]);
    
    // Get next invoice number
    const invoiceNumber = await InvoiceSettings.getNextInvoiceNumber();
    
    // Determine if VAT applies
    const companyInEU = isEUCountry(companySettings.country);
    const applyVat = companyInEU && invoiceSettings.vatEnabled;
    const vatRate = applyVat ? invoiceSettings.vatPercentage : 0;
    
    // Calculate line items
    const lineItems: IInvoiceLineItem[] = params.lineItems.map(item => ({
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      total: item.quantity * item.unitPrice,
    }));
    
    // Calculate totals
    const subtotal = lineItems.reduce((sum, item) => sum + item.total, 0);
    // Use actual VAT amount if provided (for cases where VAT only applies to some items)
    // Otherwise calculate from subtotal
    const vatAmount = params.actualVatAmount !== undefined 
      ? params.actualVatAmount 
      : (applyVat ? (subtotal * vatRate) / 100 : 0);
    const total = subtotal + vatAmount;
    
    // Get logo URL
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    let logoUrl = companySettings.logoUrl || whiteLabelSettings?.appLogo || '/assets/images/logo.png';
    if (!logoUrl.startsWith('http')) {
      logoUrl = `${baseUrl}${logoUrl}`;
    }
    
    // Create invoice document
    const invoice = await Invoice.create({
      invoiceNumber,
      userId: params.userId,
      customerName: params.customerName,
      customerEmail: params.customerEmail,
      customerAddress: params.customerAddress,
      
      companyName: companySettings.companyName,
      companyAddress: {
        line1: companySettings.addressLine1,
        line2: companySettings.addressLine2,
        city: companySettings.city,
        stateProvince: companySettings.stateProvince,
        postalCode: companySettings.postalCode,
        country: companySettings.country,
      },
      companyVatNumber: companySettings.vatNumber,
      companyRegistrationNumber: companySettings.registrationNumber,
      companyEmail: companySettings.email,
      companyPhone: companySettings.phone,
      companyLogoUrl: logoUrl,
      
      subtotal,
      vatRate,
      vatAmount,
      total,
      currency: params.currency || 'EUR',
      
      lineItems,
      
      transactionId: params.transactionId,
      transactionType: params.transactionType,
      paymentMethod: params.paymentMethod,
      paymentId: params.paymentId,
      
      status: 'paid', // Since this is triggered after successful payment
      invoiceDate: new Date(),
      paidAt: new Date(),
      
      notes: params.notes,
    });
    
    // Generate HTML
    const html = await InvoiceService.generateInvoiceHTML(invoice, invoiceSettings, companySettings);
    
    console.log(`📄 Invoice ${invoiceNumber} created for ${params.customerEmail}`);
    console.log(`   Subtotal: €${subtotal.toFixed(2)}, VAT (${vatRate}%): €${vatAmount.toFixed(2)}, Total: €${total.toFixed(2)}`);
    
    return {
      invoice,
      html,
      shouldSendEmail: invoiceSettings.sendInvoiceOnPurchase,
    };
  },
  
  /**
   * Generate HTML for an invoice
   */
  generateInvoiceHTML: async (
    invoice: IInvoice,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    invoiceSettings?: any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    companySettings?: any
  ): Promise<string> => {
    await connectToDatabase();
    
    // Get settings if not provided
    if (!invoiceSettings) {
      invoiceSettings = await InvoiceSettings.getSingleton();
    }
    if (!companySettings) {
      companySettings = await CompanySettings.getSingleton();
    }
    
    const formatCurrency = (amount: number) => {
      const symbol = invoiceSettings.currencySymbol || '€';
      const formatted = amount.toFixed(2);
      return invoiceSettings.currencyPosition === 'after' 
        ? `${formatted}${symbol}` 
        : `${symbol}${formatted}`;
    };
    
    const formatDate = (date: Date) => {
      return new Date(date).toLocaleDateString('en-GB', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    };
    
    const companyCountryName = COUNTRY_NAMES[invoice.companyAddress.country] || invoice.companyAddress.country;
    
    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${invoiceSettings.invoiceTitle} ${invoice.invoiceNumber}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f5f5f5;
      padding: 20px;
    }
    .invoice-container {
      max-width: 800px;
      margin: 0 auto;
      background: #fff;
      border-radius: 8px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
      overflow: hidden;
    }
    .header {
      background: ${invoiceSettings.accentColor || '#141414'};
      color: #fff;
      padding: 40px;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
    }
    .header-left {
      flex: 1;
    }
    .header-right {
      text-align: right;
    }
    .logo {
      max-width: 150px;
      max-height: 60px;
      margin-bottom: 20px;
    }
    .invoice-title {
      font-size: 32px;
      font-weight: 700;
      color: ${invoiceSettings.primaryColor || '#FDD458'};
      margin-bottom: 8px;
    }
    .invoice-number {
      font-size: 16px;
      opacity: 0.9;
    }
    .invoice-date {
      font-size: 14px;
      opacity: 0.8;
      margin-top: 4px;
    }
    .body {
      padding: 40px;
    }
    .addresses {
      display: flex;
      justify-content: space-between;
      margin-bottom: 40px;
    }
    .address-block {
      flex: 1;
    }
    .address-label {
      font-size: 12px;
      text-transform: uppercase;
      color: #666;
      margin-bottom: 8px;
      font-weight: 600;
    }
    .address-name {
      font-size: 16px;
      font-weight: 600;
      color: #333;
      margin-bottom: 4px;
    }
    .address-line {
      font-size: 14px;
      color: #666;
      line-height: 1.5;
    }
    .company-details {
      font-size: 12px;
      color: #888;
      margin-top: 8px;
    }
    .items-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 30px;
    }
    .items-table th {
      background: #f8f8f8;
      text-align: left;
      padding: 12px 16px;
      font-size: 12px;
      text-transform: uppercase;
      color: #666;
      border-bottom: 2px solid #eee;
    }
    .items-table td {
      padding: 16px;
      border-bottom: 1px solid #eee;
      font-size: 14px;
    }
    .items-table .amount {
      text-align: right;
    }
    .totals {
      margin-left: auto;
      width: 300px;
    }
    .total-row {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      font-size: 14px;
    }
    .total-row.subtotal {
      border-bottom: 1px solid #eee;
      padding-bottom: 16px;
      margin-bottom: 8px;
    }
    .total-row.vat {
      color: #666;
    }
    .total-row.grand-total {
      font-size: 18px;
      font-weight: 700;
      border-top: 2px solid ${invoiceSettings.primaryColor || '#FDD458'};
      padding-top: 16px;
      margin-top: 8px;
    }
    .footer {
      background: #f8f8f8;
      padding: 30px 40px;
      border-top: 1px solid #eee;
    }
    .footer-section {
      margin-bottom: 20px;
    }
    .footer-section:last-child {
      margin-bottom: 0;
    }
    .footer-label {
      font-size: 12px;
      text-transform: uppercase;
      color: #666;
      margin-bottom: 4px;
      font-weight: 600;
    }
    .footer-text {
      font-size: 14px;
      color: #333;
    }
    .bank-details {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 16px;
    }
    .bank-detail {
      font-size: 13px;
    }
    .bank-detail-label {
      color: #666;
    }
    .thank-you {
      text-align: center;
      padding: 20px;
      color: ${invoiceSettings.primaryColor || '#FDD458'};
      font-size: 16px;
      font-weight: 500;
    }
    .status-badge {
      display: inline-block;
      background: #10b981;
      color: #fff;
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      margin-top: 8px;
    }
  </style>
</head>
<body>
  <div class="invoice-container">
    <div class="header">
      <div class="header-left">
        ${invoiceSettings.showLogo && invoice.companyLogoUrl ? `<img src="${invoice.companyLogoUrl}" alt="${invoice.companyName}" class="logo">` : ''}
      </div>
      <div class="header-right">
        <div class="invoice-title">${invoiceSettings.invoiceTitle || 'INVOICE'}</div>
        <div class="invoice-number">${invoice.invoiceNumber}</div>
        <div class="invoice-date">${formatDate(invoice.invoiceDate)}</div>
        <div class="status-badge">PAID</div>
      </div>
    </div>
    
    <div class="body">
      <div class="addresses">
        <div class="address-block">
          <div class="address-label">From</div>
          <div class="address-name">${invoice.companyName}</div>
          ${invoiceSettings.showCompanyAddress ? `
          <div class="address-line">
            ${invoice.companyAddress.line1}<br>
            ${invoice.companyAddress.line2 ? invoice.companyAddress.line2 + '<br>' : ''}
            ${invoice.companyAddress.city}, ${invoice.companyAddress.postalCode}<br>
            ${companyCountryName}
          </div>
          ` : ''}
          <div class="company-details">
            ${invoice.companyEmail}<br>
            ${invoice.companyPhone ? invoice.companyPhone + '<br>' : ''}
            ${invoiceSettings.showVatNumber && invoice.companyVatNumber ? `VAT: ${invoice.companyVatNumber}<br>` : ''}
            ${invoiceSettings.showRegistrationNumber && invoice.companyRegistrationNumber ? `Reg: ${invoice.companyRegistrationNumber}` : ''}
          </div>
        </div>
        <div class="address-block" style="text-align: right;">
          <div class="address-label">Bill To</div>
          <div class="address-name">${invoice.customerName}</div>
          <div class="address-line">${invoice.customerEmail}</div>
          ${invoice.customerAddress ? `
          <div class="address-line">
            ${invoice.customerAddress.line1 ? invoice.customerAddress.line1 + '<br>' : ''}
            ${invoice.customerAddress.city ? invoice.customerAddress.city + ', ' : ''}${invoice.customerAddress.postalCode || ''}
            ${invoice.customerAddress.country ? '<br>' + (COUNTRY_NAMES[invoice.customerAddress.country] || invoice.customerAddress.country) : ''}
          </div>
          ` : ''}
        </div>
      </div>
      
      <table class="items-table">
        <thead>
          <tr>
            <th>Description</th>
            <th class="amount">Qty</th>
            <th class="amount">Unit Price</th>
            <th class="amount">Total</th>
          </tr>
        </thead>
        <tbody>
          ${invoice.lineItems.map(item => `
          <tr>
            <td>${item.description}</td>
            <td class="amount">${item.quantity}</td>
            <td class="amount">${formatCurrency(item.unitPrice)}</td>
            <td class="amount">${formatCurrency(item.total)}</td>
          </tr>
          `).join('')}
        </tbody>
      </table>
      
      <div class="totals">
        <div class="total-row subtotal">
          <span>Subtotal</span>
          <span>${formatCurrency(invoice.subtotal)}</span>
        </div>
        ${invoice.vatRate > 0 ? `
        <div class="total-row vat">
          <span>${invoiceSettings.vatLabel || 'VAT'} (${invoice.vatRate}%)</span>
          <span>${formatCurrency(invoice.vatAmount)}</span>
        </div>
        ` : ''}
        <div class="total-row grand-total">
          <span>Total</span>
          <span>${formatCurrency(invoice.total)}</span>
        </div>
      </div>
    </div>
    
    <div class="footer">
      ${invoiceSettings.paymentTerms ? `
      <div class="footer-section">
        <div class="footer-label">Payment Information</div>
        <div class="footer-text">${invoiceSettings.paymentTerms}</div>
      </div>
      ` : ''}
      
      ${invoiceSettings.showBankDetails && (companySettings.bankName || companySettings.bankIban) ? `
      <div class="footer-section">
        <div class="footer-label">Bank Details</div>
        <div class="bank-details">
          ${companySettings.bankName ? `<div class="bank-detail"><span class="bank-detail-label">Bank:</span> ${companySettings.bankName}</div>` : ''}
          ${companySettings.bankIban ? `<div class="bank-detail"><span class="bank-detail-label">IBAN:</span> ${companySettings.bankIban}</div>` : ''}
          ${companySettings.bankSwift ? `<div class="bank-detail"><span class="bank-detail-label">SWIFT/BIC:</span> ${companySettings.bankSwift}</div>` : ''}
          ${companySettings.bankAccountNumber ? `<div class="bank-detail"><span class="bank-detail-label">Account:</span> ${companySettings.bankAccountNumber}</div>` : ''}
        </div>
      </div>
      ` : ''}
      
      ${invoiceSettings.invoiceFooter ? `
      <div class="footer-section">
        <div class="footer-text">${invoiceSettings.invoiceFooter}</div>
      </div>
      ` : ''}
    </div>
    
    ${invoiceSettings.thankYouMessage ? `
    <div class="thank-you">${invoiceSettings.thankYouMessage}</div>
    ` : ''}
    
    ${invoiceSettings.showLegalDisclaimer && invoiceSettings.legalDisclaimer ? `
    <!-- Legal Disclaimer Section -->
    <div style="margin-top: 30px; padding: 20px; background: #f9f9f9; border: 1px solid #e5e5e5; border-radius: 4px; page-break-inside: avoid;">
      <h4 style="margin: 0 0 15px 0; font-size: 11px; font-weight: 600; color: #333; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #ddd; padding-bottom: 8px;">
        Important Legal Information
      </h4>
      
      <div style="font-size: 9px; color: #555; line-height: 1.6;">
        ${formatDisclaimer(invoiceSettings.legalDisclaimer, {
          companyName: invoice.companyName,
          companyEmail: invoice.companyEmail || companySettings.email,
          vatNumber: invoice.companyVatNumber || '',
        })}
      </div>
    </div>
    ` : ''}
  </div>
</body>
</html>
    `.trim();
  },
  
  /**
   * Get invoice by ID
   */
  getInvoiceById: async (invoiceId: string): Promise<IInvoice | null> => {
    await connectToDatabase();
    return Invoice.findById(invoiceId);
  },
  
  /**
   * Get invoices for a user
   */
  getUserInvoices: async (userId: string, limit = 50): Promise<IInvoice[]> => {
    await connectToDatabase();
    return Invoice.find({ userId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean() as unknown as IInvoice[];
  },
  
  /**
   * Get invoice by transaction ID
   */
  getInvoiceByTransactionId: async (transactionId: string): Promise<IInvoice | null> => {
    await connectToDatabase();
    return Invoice.findOne({ transactionId });
  },
};

export default InvoiceService;

