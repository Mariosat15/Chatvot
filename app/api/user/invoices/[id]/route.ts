import { NextResponse } from 'next/server';
import { auth } from '@/lib/better-auth/auth';
import { headers } from 'next/headers';
import { connectToDatabase } from '@/database/mongoose';
import Invoice from '@/database/models/invoice.model';
import { InvoiceService } from '@/lib/services/invoice.service';

/**
 * GET /api/user/invoices/[id]
 * Get a single invoice for the authenticated user
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    await connectToDatabase();

    const { id } = await params;
    
    const invoice = await Invoice.findOne({ 
      _id: id, 
      userId: session.user.id 
    });
    
    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }
    
    // Generate HTML for download
    const html = await InvoiceService.generateInvoiceHTML(invoice);
    
    return NextResponse.json({
      invoice,
      html,
    });
  } catch (error: any) {
    console.error('Error fetching invoice:', error);
    
    return NextResponse.json(
      { error: 'Failed to fetch invoice' },
      { status: 500 }
    );
  }
}

