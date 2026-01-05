import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/database/mongoose';
import TradingSymbol from '@/database/models/trading/symbol-settings.model';

/**
 * GET /api/symbols/[symbol]
 * Get a specific symbol's settings
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ symbol: string }> }
) {
  try {
    await connectToDatabase();
    
    const { symbol: symbolParam } = await params;
    const symbol = decodeURIComponent(symbolParam).toUpperCase();
    
    const symbolData = await TradingSymbol.findOne({ symbol }).lean();
    
    if (!symbolData) {
      return NextResponse.json(
        { error: 'Symbol not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ symbol: symbolData });
  } catch (error) {
    console.error('Failed to fetch symbol:', error);
    return NextResponse.json(
      { error: 'Failed to fetch symbol' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/symbols/[symbol]
 * Update a symbol's settings
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ symbol: string }> }
) {
  try {
    await connectToDatabase();
    
    const { symbol: symbolParam } = await params;
    const symbol = decodeURIComponent(symbolParam).toUpperCase();
    const body = await request.json();
    
    // Don't allow changing the symbol itself
    delete body.symbol;
    delete body._id;
    delete body.createdAt;
    
    const updated = await TradingSymbol.findOneAndUpdate(
      { symbol },
      { $set: body },
      { new: true }
    );
    
    if (!updated) {
      return NextResponse.json(
        { error: 'Symbol not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ 
      success: true, 
      symbol: updated,
      message: `${symbol} settings updated successfully`
    });
  } catch (error) {
    console.error('Failed to update symbol:', error);
    return NextResponse.json(
      { error: 'Failed to update symbol' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/symbols/[symbol]
 * Remove a symbol (only custom symbols can be deleted)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ symbol: string }> }
) {
  try {
    await connectToDatabase();
    
    const { symbol: symbolParam } = await params;
    const symbol = decodeURIComponent(symbolParam).toUpperCase();
    
    // Check if symbol exists
    const existing = await TradingSymbol.findOne({ symbol });
    
    if (!existing) {
      return NextResponse.json(
        { error: 'Symbol not found' },
        { status: 404 }
      );
    }
    
    // Only allow deleting custom symbols
    if (existing.category !== 'custom') {
      return NextResponse.json(
        { error: 'Cannot delete default symbols. You can disable them instead.' },
        { status: 400 }
      );
    }
    
    await TradingSymbol.deleteOne({ symbol });
    
    return NextResponse.json({ 
      success: true, 
      message: `${symbol} deleted successfully`
    });
  } catch (error) {
    console.error('Failed to delete symbol:', error);
    return NextResponse.json(
      { error: 'Failed to delete symbol' },
      { status: 500 }
    );
  }
}

