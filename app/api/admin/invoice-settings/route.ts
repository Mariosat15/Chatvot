import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/database/mongoose';
import InvoiceSettings from '@/database/models/invoice-settings.model';
import CompanySettings, { isEUCountry } from '@/database/models/company-settings.model';
import { requireAdminAuth, getAdminSession } from '@/lib/admin/auth';
import { auditLogService } from '@/lib/services/audit-log.service';

/**
 * GET /api/admin/invoice-settings
 * Fetch invoice settings with company context
 */
export async function GET() {
  try {
    await requireAdminAuth();
    await connectToDatabase();

    const [invoiceSettings, companySettings] = await Promise.all([
      InvoiceSettings.getSingleton(),
      CompanySettings.getSingleton(),
    ]);
    
    // Determine if VAT should be applied based on company location
    const companyInEU = isEUCountry(companySettings.country);
    
    return NextResponse.json({
      invoiceSettings,
      companySettings,
      companyInEU,
      shouldApplyVat: companyInEU && invoiceSettings.vatEnabled,
    });
  } catch (error: any) {
    console.error('Error fetching invoice settings:', error);
    
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    return NextResponse.json(
      { error: 'Failed to fetch invoice settings' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/invoice-settings
 * Update invoice settings
 */
export async function PUT(request: Request) {
  try {
    await requireAdminAuth();
    await connectToDatabase();

    const body = await request.json();
    
    // Get existing settings
    const settings = await InvoiceSettings.getSingleton();
    
    // Update fields
    const updateFields = [
      'vatEnabled',
      'vatPercentage',
      'vatLabel',
      'invoicePrefix',
      'invoiceNumberPadding',
      'showLogo',
      'showCompanyAddress',
      'showBankDetails',
      'showVatNumber',
      'showRegistrationNumber',
      'invoiceTitle',
      'invoiceFooter',
      'paymentTerms',
      'thankYouMessage',
      'legalDisclaimer',
      'showLegalDisclaimer',
      'sendInvoiceOnPurchase',
      'invoiceEmailSubject',
      'invoiceEmailBody',
      'currencySymbol',
      'currencyPosition',
      'primaryColor',
      'accentColor',
    ];
    
    for (const field of updateFields) {
      if (body[field] !== undefined) {
        (settings as any)[field] = body[field];
      }
    }
    
    // Handle numeric fields
    if (body.vatPercentage !== undefined) {
      settings.vatPercentage = parseFloat(body.vatPercentage) || 0;
    }
    if (body.invoiceNumberPadding !== undefined) {
      settings.invoiceNumberPadding = parseInt(body.invoiceNumberPadding) || 6;
    }
    
    await settings.save();
    
    console.log('✅ Invoice settings updated:', {
      vatEnabled: settings.vatEnabled,
      vatPercentage: settings.vatPercentage,
      sendInvoiceOnPurchase: settings.sendInvoiceOnPurchase,
    });

    // Log audit action
    try {
      const admin = await getAdminSession();
      if (admin) {
        await auditLogService.logInvoiceSettingsUpdated({
          id: admin.id,
          email: admin.email,
          name: admin.email.split('@')[0],
          role: 'admin',
        });
      }
    } catch (auditError) {
      console.error('Failed to log audit action:', auditError);
    }
    
    return NextResponse.json({
      success: true,
      settings,
    });
  } catch (error: any) {
    console.error('Error updating invoice settings:', error);
    
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    return NextResponse.json(
      { error: 'Failed to update invoice settings' },
      { status: 500 }
    );
  }
}

