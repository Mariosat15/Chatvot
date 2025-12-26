import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/database/mongoose';
import Invoice from '@/database/models/invoice.model';
import { InvoiceService } from '@/lib/services/invoice.service';
import { requireAdminAuth } from '@/lib/admin/auth';

/**
 * GET /api/admin/invoices/[id]
 * Get a single invoice with HTML
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdminAuth();
    await connectToDatabase();

    const { id } = await params;
    
    const invoice = await Invoice.findById(id);
    
    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }
    
    // Generate HTML for preview/download
    const html = await InvoiceService.generateInvoiceHTML(invoice);
    
    return NextResponse.json({
      invoice,
      html,
    });
  } catch (error) {
    console.error('Error fetching invoice:', error);
    
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    return NextResponse.json(
      { error: 'Failed to fetch invoice' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/invoices/[id]/resend
 * Resend invoice email
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdminAuth();
    await connectToDatabase();

    const { id } = await params;
    
    const invoice = await Invoice.findById(id);
    
    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }
    
    // Send invoice email directly (replaces Inngest)
    const { sendInvoiceEmail } = await import('@/lib/nodemailer');
    
    await sendInvoiceEmail({
      invoiceId: (invoice._id as any).toString(),
      customerEmail: invoice.customerEmail,
      customerName: invoice.customerName,
    });
    
    console.log(`📧 Invoice email sent to ${invoice.customerEmail}`);
    
    return NextResponse.json({
      success: true,
      message: `Invoice email sent to ${invoice.customerEmail}`,
    });
  } catch (error) {
    console.error('Error resending invoice:', error);
    
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    return NextResponse.json(
      { error: 'Failed to resend invoice' },
      { status: 500 }
    );
  }
}

