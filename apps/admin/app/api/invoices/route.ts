import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/database/mongoose';
import Invoice from '@/database/models/invoice.model';
import { requireAdminAuth } from '@/lib/admin/auth';

/**
 * GET /api/admin/invoices
 * Get all invoices with filtering
 */
export async function GET(request: Request) {
  try {
    await requireAdminAuth();
    await connectToDatabase();

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const status = searchParams.get('status');
    const search = searchParams.get('search');
    
    const skip = (page - 1) * limit;
    
    // Build query
    const query: any = {};
    
    if (status && status !== 'all') {
      query.status = status;
    }
    
    if (search) {
      query.$or = [
        { invoiceNumber: { $regex: search, $options: 'i' } },
        { customerEmail: { $regex: search, $options: 'i' } },
        { customerName: { $regex: search, $options: 'i' } },
      ];
    }
    
    const [invoices, total] = await Promise.all([
      Invoice.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Invoice.countDocuments(query),
    ]);
    
    return NextResponse.json({
      invoices,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error('Error fetching invoices:', error);
    
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    return NextResponse.json(
      { error: 'Failed to fetch invoices' },
      { status: 500 }
    );
  }
}

