import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/database/mongoose';
import { MarketplaceItem } from '@/database/models/marketplace/marketplace-item.model';
import { UserPurchase } from '@/database/models/marketplace/user-purchase.model';
import { auth } from '@/lib/better-auth/auth';
import { headers } from 'next/headers';
import { seedMarketplaceItems } from '@/lib/services/marketplace-seed.service';

/**
 * GET /api/marketplace
 * Get all marketplace items with optional filters
 */
export async function GET(request: NextRequest) {
  try {
    await connectToDatabase();
    
    // Auto-seed if no items exist
    const existingCount = await MarketplaceItem.countDocuments();
    if (existingCount === 0) {
      await seedMarketplaceItems();
    }
    
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const featured = searchParams.get('featured');
    const free = searchParams.get('free');
    const search = searchParams.get('search');
    
    // Build query
    const query: any = {
      isPublished: true,
      status: 'active',
    };
    
    if (category) {
      query.category = category;
    }
    
    if (featured === 'true') {
      query.isFeatured = true;
    }
    
    if (free === 'true') {
      query.isFree = true;
    }
    
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { shortDescription: { $regex: search, $options: 'i' } },
        { tags: { $in: [new RegExp(search, 'i')] } },
      ];
    }
    
    const items = await MarketplaceItem.find(query)
      .sort({ isFeatured: -1, totalPurchases: -1, createdAt: -1 })
      .lean();
    
    // Get user's purchases if authenticated
    let userPurchases: string[] = [];
    try {
      const session = await auth.api.getSession({ headers: await headers() });
      if (session?.user?.id) {
        const purchases = await UserPurchase.find({ userId: session.user.id }).lean();
        userPurchases = purchases.map(p => p.itemId.toString());
      }
    } catch {
      // Not authenticated, continue without purchases
    }
    
    // Add owned flag to items
    const itemsWithOwnership = items.map(item => ({
      ...item,
      owned: userPurchases.includes(item._id.toString()),
    }));
    
    return NextResponse.json({
      success: true,
      items: itemsWithOwnership,
    });
  } catch (error: any) {
    console.error('Error fetching marketplace items:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

