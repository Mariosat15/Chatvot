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
  } catch (error: any) {
    console.error('Error fetching invoice:', error);
    
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    return NextResponse.json(
      { error: 'Failed to fetch invoice' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/invoices/[id]/resend
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
    
    // Queue email via Inngest
    const { inngest } = await import('@/lib/inngest/client');
    
    await inngest.send({
      name: 'app/invoice.created',
      data: {
        invoiceId: invoice._id.toString(),
        customerEmail: invoice.customerEmail,
        customerName: invoice.customerName,
        invoiceNumber: invoice.invoiceNumber,
      },
    });
    
    console.log(`📧 Invoice email re-queued for ${invoice.customerEmail}`);
    
    return NextResponse.json({
      success: true,
      message: `Invoice email queued for ${invoice.customerEmail}`,
    });
  } catch (error: any) {
    console.error('Error resending invoice:', error);
    
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    return NextResponse.json(
      { error: 'Failed to resend invoice' },
      { status: 500 }
    );
  }
}

