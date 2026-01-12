import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@/lib/admin/auth';
import { aiKnowledgeService } from '@/lib/services/ai-knowledge.service';

// GET - Get settings
export async function GET() {
  try {
    await requireAdminAuth();
    
    const settings = await aiKnowledgeService.getSettings();
    
    return NextResponse.json({
      success: true,
      settings,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error fetching AI knowledge settings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch settings' },
      { status: 500 }
    );
  }
}

// PUT - Update settings
export async function PUT(request: NextRequest) {
  try {
    await requireAdminAuth();
    
    const body = await request.json();
    const {
      autoIndexHelpArticles,
      autoIndexOnHelpUpdate,
      chunkSize,
      chunkOverlap,
      maxChunksPerQuery,
      similarityThreshold,
      categories,
    } = body;
    
    const updates: any = {};
    
    if (autoIndexHelpArticles !== undefined) updates.autoIndexHelpArticles = autoIndexHelpArticles;
    if (autoIndexOnHelpUpdate !== undefined) updates.autoIndexOnHelpUpdate = autoIndexOnHelpUpdate;
    if (chunkSize !== undefined) updates.chunkSize = chunkSize;
    if (chunkOverlap !== undefined) updates.chunkOverlap = chunkOverlap;
    if (maxChunksPerQuery !== undefined) updates.maxChunksPerQuery = maxChunksPerQuery;
    if (similarityThreshold !== undefined) updates.similarityThreshold = similarityThreshold;
    if (categories !== undefined) updates.categories = categories;
    
    const settings = await aiKnowledgeService.updateSettings(updates);
    
    return NextResponse.json({
      success: true,
      settings,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error updating AI knowledge settings:', error);
    return NextResponse.json(
      { error: 'Failed to update settings' },
      { status: 500 }
    );
  }
}
