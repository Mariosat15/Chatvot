import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/database/mongoose';
import BadgeConfig from '@/database/models/badge-config.model';
import { getBadgesFromDB } from '@/lib/services/badge-config-seed.service';

/**
 * GET /api/admin/badges
 * Get all badges from database
 */
export async function GET() {
  try {
    await connectToDatabase();
    const badges = await getBadgesFromDB();
    
    return NextResponse.json({
      success: true,
      badges,
      total: badges.length,
    });
  } catch (error) {
    console.error('Error fetching badges:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch badges' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/badges
 * Add a new badge to database
 */
export async function POST(request: NextRequest) {
  try {
    await connectToDatabase();
    const badge = await request.json();
    
    // Validate badge structure
    if (!badge.id || !badge.name || !badge.category || !badge.rarity) {
      return NextResponse.json(
        { success: false, error: 'Invalid badge structure' },
        { status: 400 }
      );
    }

    // Check if badge ID already exists
    const existing = await BadgeConfig.findOne({ id: badge.id });
    if (existing) {
      return NextResponse.json(
        { success: false, error: 'Badge ID already exists' },
        { status: 400 }
      );
    }

    // Create badge in database
    const newBadge = await BadgeConfig.create({
      id: badge.id,
      name: badge.name,
      description: badge.description,
      category: badge.category,
      icon: badge.icon || '🏆',
      rarity: badge.rarity,
      condition: badge.condition || { type: 'manual' },
      isActive: true,
    });

    return NextResponse.json({
      success: true,
      message: 'Badge created successfully!',
      badge: newBadge,
    });
  } catch (error) {
    console.error('Error adding badge:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to add badge' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/badges
 * Update an existing badge in database
 */
export async function PUT(request: NextRequest) {
  try {
    await connectToDatabase();
    const badge = await request.json();
    
    if (!badge.id) {
      return NextResponse.json(
        { success: false, error: 'Badge ID required' },
        { status: 400 }
      );
    }

    // Validate badge structure
    if (!badge.name || !badge.category || !badge.rarity) {
      return NextResponse.json(
        { success: false, error: 'Invalid badge structure' },
        { status: 400 }
      );
    }

    // Update badge in database
    const updatedBadge = await BadgeConfig.findOneAndUpdate(
      { id: badge.id },
      {
        name: badge.name,
        description: badge.description,
        category: badge.category,
        icon: badge.icon || '🏆',
        rarity: badge.rarity,
        condition: badge.condition || { type: 'manual' },
      },
      { new: true }
    );

    if (!updatedBadge) {
      return NextResponse.json(
        { success: false, error: 'Badge not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Badge updated successfully!',
      badge: updatedBadge,
    });
  } catch (error) {
    console.error('Error updating badge:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update badge' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/badges
 * Delete a badge from database (soft delete by setting isActive to false)
 */
export async function DELETE(request: NextRequest) {
  try {
    await connectToDatabase();
    const { searchParams } = new URL(request.url);
    const badgeId = searchParams.get('badgeId');
    
    if (!badgeId) {
      return NextResponse.json(
        { success: false, error: 'Badge ID required' },
        { status: 400 }
      );
    }

    // Soft delete - set isActive to false
    const deletedBadge = await BadgeConfig.findOneAndUpdate(
      { id: badgeId },
      { isActive: false },
      { new: true }
    );

    if (!deletedBadge) {
      return NextResponse.json(
        { success: false, error: 'Badge not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Badge deleted successfully!',
      badgeId,
    });
  } catch (error) {
    console.error('Error deleting badge:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete badge' },
      { status: 500 }
    );
  }
}

