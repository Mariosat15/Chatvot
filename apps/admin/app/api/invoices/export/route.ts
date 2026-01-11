import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/database/mongoose';
import { requireAdminAuth, getAdminSession } from '@/lib/admin/auth';
import Invoice from '@/database/models/invoice.model';
import { generateInvoicePDF } from '@/lib/services/pdf-generator.service';
import InvoiceSettings from '@/database/models/invoice-settings.model';
import CompanySettings from '@/database/models/company-settings.model';
import archiver from 'archiver';
import { auditLogService } from '@/lib/services/audit-log.service';

/**
 * GET /api/admin/invoices/export
 * Export invoices as a ZIP file containing PDFs
 * Query params:
 *   - startDate: ISO date string
 *   - endDate: ISO date string
 *   - format: 'zip' (default) or 'csv'
 */
export async function GET(request: NextRequest) {
  try {
    await requireAdminAuth();
    await connectToDatabase();

    const { searchParams } = new URL(request.url);
    const startDateStr = searchParams.get('startDate');
    const endDateStr = searchParams.get('endDate');
    const format = searchParams.get('format') || 'zip';

    // Build date filter
    const dateFilter: any = {};
    if (startDateStr) {
      dateFilter.$gte = new Date(startDateStr);
    }
    if (endDateStr) {
      const endDate = new Date(endDateStr);
      endDate.setHours(23, 59, 59, 999);
      dateFilter.$lte = endDate;
    }

    const query: any = {};
    if (Object.keys(dateFilter).length > 0) {
      query.invoiceDate = dateFilter;
    }

    // Fetch invoices
    const invoices = await Invoice.find(query).sort({ invoiceDate: -1 }).lean();

    if (invoices.length === 0) {
      return NextResponse.json(
        { error: 'No invoices found for the selected date range' },
        { status: 404 }
      );
    }

    console.log(`📦 Exporting ${invoices.length} invoices...`);

    // CSV Export
    if (format === 'csv') {
      const csvRows = [
        ['Invoice Number', 'Date', 'Customer Name', 'Customer Email', 'Subtotal', 'VAT Rate', 'VAT Amount', 'Total', 'Currency', 'Status'].join(','),
      ];

      for (const invoice of invoices) {
        csvRows.push([
          invoice.invoiceNumber,
          new Date(invoice.invoiceDate).toISOString().split('T')[0],
          `"${invoice.customerName?.replace(/"/g, '""') || ''}"`,
          invoice.customerEmail || '',
          invoice.subtotal?.toFixed(2) || '0.00',
          invoice.vatRate?.toString() || '0',
          invoice.vatAmount?.toFixed(2) || '0.00',
          invoice.total?.toFixed(2) || '0.00',
          invoice.currency || 'EUR',
          invoice.status || 'unknown',
        ].join(','));
      }

      const csvContent = csvRows.join('\n');
      const dateRange = startDateStr && endDateStr 
        ? `${startDateStr}_to_${endDateStr}` 
        : 'all';

      // Log audit action for CSV export
      try {
        const admin = await getAdminSession();
        if (admin) {
          await auditLogService.logInvoicesExported(
            {
              id: admin.id,
              email: admin.email,
              name: admin.email.split('@')[0],
              role: 'admin',
            },
            invoices.length,
            { start: startDateStr || 'all', end: endDateStr || 'all' },
            'csv'
          );
        }
      } catch (auditError) {
        console.error('Failed to log audit action:', auditError);
      }

      return new NextResponse(csvContent, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="invoices_${dateRange}.csv"`,
        },
      });
    }

    // ZIP Export with PDFs
    // Get settings for PDF generation
    const [invoiceSettings, companySettings] = await Promise.all([
      InvoiceSettings.getSingleton(),
      CompanySettings.getSingleton(),
    ]);

    // Generate all PDFs first
    const pdfBuffers: { buffer: Buffer; filename: string }[] = [];
    let successCount = 0;
    let errorCount = 0;

    for (const invoice of invoices) {
      try {
        const pdfInvoiceData = {
          invoiceNumber: invoice.invoiceNumber,
          invoiceDate: new Date(invoice.invoiceDate),
          status: invoice.status || 'sent',
          
          companyName: invoice.companyName || companySettings.companyName,
          companyAddress: invoice.companyAddress || {
            line1: companySettings.addressLine1,
            city: companySettings.city,
            postalCode: companySettings.postalCode,
            country: companySettings.country,
          },
          companyEmail: invoice.companyEmail || companySettings.email,
          companyVatNumber: invoice.companyVatNumber || companySettings.vatNumber,
          
          customerName: invoice.customerName,
          customerEmail: invoice.customerEmail,
          customerAddress: invoice.customerAddress,
          
          lineItems: invoice.lineItems || [],
          subtotal: invoice.subtotal || 0,
          vatRate: invoice.vatRate || 0,
          vatAmount: invoice.vatAmount || 0,
          total: invoice.total || 0,
          currency: invoice.currency || 'EUR',
          
          primaryColor: invoiceSettings.primaryColor,
          showBankDetails: invoiceSettings.showBankDetails,
          bankName: companySettings.bankName,
          bankIban: companySettings.bankIban,
          bankSwift: companySettings.bankSwift,
          paymentTerms: invoiceSettings.paymentTerms,
          thankYouMessage: invoiceSettings.thankYouMessage,
          legalDisclaimer: invoiceSettings.legalDisclaimer,
          showLegalDisclaimer: invoiceSettings.showLegalDisclaimer,
        };

        const { buffer, filename } = await generateInvoicePDF(pdfInvoiceData);
        pdfBuffers.push({ buffer, filename });
        successCount++;
      } catch (error) {
        console.error(`Failed to generate PDF for ${invoice.invoiceNumber}:`, error);
        errorCount++;
        pdfBuffers.push({
          buffer: Buffer.from(`Failed to generate PDF: ${error instanceof Error ? error.message : 'Unknown error'}`),
          filename: `ERROR_${invoice.invoiceNumber}.txt`,
        });
      }
    }

    // Create summary
    const summary = [
      `Invoice Export Summary`,
      `====================`,
      ``,
      `Date Range: ${startDateStr || 'Start'} to ${endDateStr || 'End'}`,
      `Total Invoices: ${invoices.length}`,
      `Successfully Generated: ${successCount}`,
      `Errors: ${errorCount}`,
      ``,
      `Generated on: ${new Date().toISOString()}`,
    ].join('\n');

    // Create ZIP archive
    const zipBuffer = await new Promise<Buffer>((resolve, reject) => {
      const archive = archiver('zip', { zlib: { level: 5 } });
      const chunks: Buffer[] = [];

      archive.on('data', (chunk) => chunks.push(chunk));
      archive.on('end', () => {
        console.log('📦 Archive finalized');
        resolve(Buffer.concat(chunks));
      });
      archive.on('error', (err) => {
        console.error('Archive error:', err);
        reject(err);
      });

      // Add all PDFs to archive
      for (const pdf of pdfBuffers) {
        archive.append(pdf.buffer, { name: pdf.filename });
      }

      // Add summary
      archive.append(summary, { name: 'SUMMARY.txt' });

      // Finalize
      archive.finalize();
    });

    const dateRange = startDateStr && endDateStr 
      ? `${startDateStr}_to_${endDateStr}` 
      : 'all';

    console.log(`✅ Export complete: ${successCount} PDFs in ${(zipBuffer.length / 1024).toFixed(2)} KB`);

    // Log audit action
    try {
      const admin = await getAdminSession();
      if (admin) {
        await auditLogService.logInvoicesExported(
          {
            id: admin.id,
            email: admin.email,
            name: admin.email.split('@')[0],
            role: 'admin',
          },
          invoices.length,
          { start: startDateStr || 'all', end: endDateStr || 'all' },
          'zip'
        );
      }
    } catch (auditError) {
      console.error('Failed to log audit action:', auditError);
    }

    return new NextResponse(new Uint8Array(zipBuffer), {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="invoices_${dateRange}.zip"`,
      },
    });

  } catch (error) {
    console.error('Error exporting invoices:', error);
    
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    return NextResponse.json(
      { error: 'Failed to export invoices', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/invoices/export
 * Get invoice count and summary for date range (for preview)
 */
export async function POST(request: NextRequest) {
  try {
    await requireAdminAuth();
    await connectToDatabase();

    const { startDate, endDate } = await request.json();

    // Build date filter
    const dateFilter: any = {};
    if (startDate) {
      dateFilter.$gte = new Date(startDate);
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      dateFilter.$lte = end;
    }

    const query: any = {};
    if (Object.keys(dateFilter).length > 0) {
      query.invoiceDate = dateFilter;
    }

    // Get count and totals
    const [count, totals] = await Promise.all([
      Invoice.countDocuments(query),
      Invoice.aggregate([
        { $match: query },
        {
          $group: {
            _id: null,
            totalAmount: { $sum: '$total' },
            totalVAT: { $sum: '$vatAmount' },
            totalSubtotal: { $sum: '$subtotal' },
          },
        },
      ]),
    ]);

    const summary = totals[0] || { totalAmount: 0, totalVAT: 0, totalSubtotal: 0 };

    return NextResponse.json({
      success: true,
      count,
      totalAmount: summary.totalAmount,
      totalVAT: summary.totalVAT,
      totalSubtotal: summary.totalSubtotal,
    });

  } catch (error) {
    console.error('Error getting invoice summary:', error);
    
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    return NextResponse.json({ error: 'Failed to get invoice summary' }, { status: 500 });
  }
}

