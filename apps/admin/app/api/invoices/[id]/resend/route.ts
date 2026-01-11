import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/database/mongoose';
import { requireAdminAuth } from '@/lib/admin/auth';
import Invoice from '@/database/models/invoice.model';
import { sendInvoiceEmail } from '@/lib/nodemailer';

/**
 * POST /api/invoices/[id]/resend
 * Resend an invoice email to the customer
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdminAuth();
    await connectToDatabase();

    const { id } = await params;

    if (!id) {
      return NextResponse.json({ error: 'Invoice ID is required' }, { status: 400 });
    }

    const invoice = await Invoice.findById(id);

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    // Send invoice email directly (replaces Inngest)
    await sendInvoiceEmail({
      invoiceId: (invoice._id as any).toString(),
      customerEmail: invoice.customerEmail,
      customerName: invoice.customerName,
    });

    console.log(`📧 Invoice ${invoice.invoiceNumber} sent to ${invoice.customerEmail}`);

    return NextResponse.json({
      success: true,
      message: `Invoice ${invoice.invoiceNumber} has been sent to ${invoice.customerEmail}`,
    });
  } catch (error) {
    console.error('Error resending invoice:', error);
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Failed to resend invoice' }, { status: 500 });
  }
}

