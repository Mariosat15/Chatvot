import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/database/mongoose';
import { MarketplaceItem } from '@/database/models/marketplace/marketplace-item.model';
import { UserPurchase } from '@/database/models/marketplace/user-purchase.model';
import { requireAdminAuth, getAdminSession } from '@/lib/admin/auth';
import { auditLogService } from '@/lib/services/audit-log.service';
import { seedMarketplaceItems, getMarketplaceStats } from '@/lib/services/marketplace-seed.service';

/**
 * GET /api/admin/marketplace
 * Get all marketplace items (admin view - includes unpublished)
 */
export async function GET(request: NextRequest) {
  try {
    await requireAdminAuth();
    await connectToDatabase();
    
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    
    // Seed default items
    if (action === 'seed') {
      const admin = await getAdminSession();
      const result = await seedMarketplaceItems(admin?.email || 'admin');
      return NextResponse.json({ success: true, ...result });
    }
    
    // Get stats
    if (action === 'stats') {
      const stats = await getMarketplaceStats();
      return NextResponse.json({ success: true, ...stats });
    }
    
    // Get all items
    const items = await MarketplaceItem.find()
      .sort({ createdAt: -1 })
      .lean();
    
    // Get purchase counts per item
    const purchaseCounts = await UserPurchase.aggregate([
      { $group: { _id: '$itemId', count: { $sum: 1 } } },
    ]);
    
    const purchaseMap = new Map(purchaseCounts.map(p => [p._id.toString(), p.count]));
    
    // Add real purchase counts
    const itemsWithStats = items.map(item => ({
      ...item,
      actualPurchases: purchaseMap.get(item._id.toString()) || 0,
    }));
    
    const stats = await getMarketplaceStats();
    
    return NextResponse.json({
      success: true,
      items: itemsWithStats,
      stats,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error fetching marketplace items:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/marketplace
 * Create a new marketplace item
 */
export async function POST(request: NextRequest) {
  try {
    await requireAdminAuth();
    await connectToDatabase();
    
    const admin = await getAdminSession();
    const data = await request.json();
    
    // Generate slug from name if not provided
    if (!data.slug && data.name) {
      data.slug = data.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
    }
    
    // Check for duplicate slug
    const existing = await MarketplaceItem.findOne({ slug: data.slug });
    if (existing) {
      // Append number to make unique
      let counter = 2;
      let newSlug = `${data.slug}-${counter}`;
      while (await MarketplaceItem.findOne({ slug: newSlug })) {
        counter++;
        newSlug = `${data.slug}-${counter}`;
      }
      data.slug = newSlug;
    }
    
    // Set defaults
    data.createdBy = admin?.email || 'admin';
    data.isFree = data.price === 0;
    
    // Parse code template if it's a string
    if (typeof data.codeTemplate === 'object') {
      data.codeTemplate = JSON.stringify(data.codeTemplate);
    }
    
    const item = await MarketplaceItem.create(data);
    
    // Log audit
    const adminSession = await getAdminSession();
    if (adminSession) {
      await auditLogService.logSettingsUpdated(
        { id: adminSession.id, email: adminSession.email, name: adminSession.name },
        'marketplace_item_created',
        null,
        { itemId: (item._id as any).toString(), name: item.name, category: item.category, price: item.price }
      );
    }
    
    return NextResponse.json({
      success: true,
      item,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error creating marketplace item:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/marketplace
 * Update a marketplace item
 */
export async function PUT(request: NextRequest) {
  try {
    await requireAdminAuth();
    await connectToDatabase();
    
    const { itemId, ...updates } = await request.json();
    
    if (!itemId) {
      return NextResponse.json(
        { success: false, error: 'Item ID is required' },
        { status: 400 }
      );
    }
    
    // Update isFree based on price
    if (typeof updates.price === 'number') {
      updates.isFree = updates.price === 0;
    }
    
    // Parse code template if needed
    if (typeof updates.codeTemplate === 'object') {
      updates.codeTemplate = JSON.stringify(updates.codeTemplate);
    }
    
    const item = await MarketplaceItem.findByIdAndUpdate(
      itemId,
      { $set: updates },
      { new: true }
    );
    
    if (!item) {
      return NextResponse.json(
        { success: false, error: 'Item not found' },
        { status: 404 }
      );
    }
    
    // Log audit
    const adminSession2 = await getAdminSession();
    if (adminSession2) {
      await auditLogService.logSettingsUpdated(
        { id: adminSession2.id, email: adminSession2.email, name: adminSession2.name },
        'marketplace_item_updated',
        null,
        { itemId: (item._id as any).toString(), name: item.name, updates: Object.keys(updates) }
      );
    }
    
    return NextResponse.json({
      success: true,
      item,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error updating marketplace item:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/marketplace
 * Delete a marketplace item
 */
export async function DELETE(request: NextRequest) {
  try {
    await requireAdminAuth();
    await connectToDatabase();
    
    const { searchParams } = new URL(request.url);
    const itemId = searchParams.get('itemId');
    
    if (!itemId) {
      return NextResponse.json(
        { success: false, error: 'Item ID is required' },
        { status: 400 }
      );
    }
    
    // Check if item has purchases
    const purchaseCount = await UserPurchase.countDocuments({ itemId });
    if (purchaseCount > 0) {
      return NextResponse.json(
        { success: false, error: `Cannot delete item with ${purchaseCount} purchases. Set it to inactive instead.` },
        { status: 400 }
      );
    }
    
    const item = await MarketplaceItem.findByIdAndDelete(itemId);
    
    if (!item) {
      return NextResponse.json(
        { success: false, error: 'Item not found' },
        { status: 404 }
      );
    }
    
    // Log audit
    const adminSession3 = await getAdminSession();
    if (adminSession3) {
      await auditLogService.logSettingsUpdated(
        { id: adminSession3.id, email: adminSession3.email, name: adminSession3.name },
        'marketplace_item_deleted',
        null,
        { itemId: (item._id as any).toString(), name: item.name }
      );
    }
    
    return NextResponse.json({
      success: true,
      message: 'Item deleted',
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error deleting marketplace item:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

