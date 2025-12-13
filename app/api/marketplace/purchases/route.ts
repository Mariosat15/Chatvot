import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/database/mongoose';
import { UserPurchase } from '@/database/models/marketplace/user-purchase.model';
// IMPORTANT: Import MarketplaceItem to ensure it's registered before populate
import { MarketplaceItem } from '@/database/models/marketplace/marketplace-item.model';
import { auth } from '@/lib/better-auth/auth';
import { headers } from 'next/headers';

// Ensure MarketplaceItem model is registered
const _MarketplaceItem = MarketplaceItem;

/**
 * GET /api/marketplace/purchases
 * Get user's purchased items
 */
export async function GET(request: NextRequest) {
  try {
    await connectToDatabase();
    
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const enabled = searchParams.get('enabled');
    
    // Build query
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const query: any = { userId: session.user.id };
    
    if (enabled === 'true') {
      query.isEnabled = true;
    } else if (enabled === 'false') {
      query.isEnabled = false;
    }
    
    // Get purchases with populated item data
    let purchases = await UserPurchase.find(query)
      .populate('itemId')
      .sort({ purchasedAt: -1 })
      .lean();
    
    // Filter by category if specified
    if (category) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      purchases = purchases.filter((p: any) => p.itemId?.category === category);
    }
    
    console.log(`📦 Found ${purchases.length} purchases for user ${session.user.id}`);
    
    // Transform for response - ensure IDs are strings
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const items = purchases.map((purchase: any) => ({
      purchaseId: purchase._id?.toString() || purchase._id,
      itemId: purchase.itemId?._id?.toString() || purchase.itemId?._id,
      item: purchase.itemId ? {
        ...purchase.itemId,
        _id: purchase.itemId._id?.toString() || purchase.itemId._id,
      } : null,
      pricePaid: purchase.pricePaid,
      purchasedAt: purchase.purchasedAt,
      isEnabled: purchase.isEnabled,
      customSettings: purchase.customSettings || {},
      totalUsageTime: purchase.totalUsageTime,
      lastUsedAt: purchase.lastUsedAt,
      totalTradesExecuted: purchase.totalTradesExecuted,
      userRating: purchase.userRating,
    }));
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    console.log(`📦 Returning ${items.length} items:`, items.map((i: any) => i.item?.name || 'no item'));
    
    return NextResponse.json({
      success: true,
      purchases: items,
    });
  } catch (error) {
    console.error('Error fetching purchases:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/marketplace/purchases
 * Update purchase settings (enable/disable, custom settings)
 */
export async function PUT(request: NextRequest) {
  try {
    await connectToDatabase();
    
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    const { purchaseId, isEnabled, customSettings } = await request.json();
    
    if (!purchaseId) {
      return NextResponse.json(
        { success: false, error: 'Purchase ID is required' },
        { status: 400 }
      );
    }
    
    const purchase = await UserPurchase.findOne({
      _id: purchaseId,
      userId: session.user.id,
    });
    
    if (!purchase) {
      return NextResponse.json(
        { success: false, error: 'Purchase not found' },
        { status: 404 }
      );
    }
    
    // Update fields
    if (typeof isEnabled === 'boolean') {
      purchase.isEnabled = isEnabled;
    }
    
    if (customSettings) {
      purchase.customSettings = { ...purchase.customSettings, ...customSettings };
    }
    
    await purchase.save();
    
    return NextResponse.json({
      success: true,
      purchase,
    });
  } catch (error) {
    console.error('Error updating purchase:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

