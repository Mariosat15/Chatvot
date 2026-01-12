import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@/lib/admin/auth';
import { aiKnowledgeService } from '@/lib/services/ai-knowledge.service';

// GET - Fetch knowledge sources and stats
export async function GET(request: NextRequest) {
  try {
    const admin = await requireAdminAuth();
    
    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get('type') as any;
    const status = searchParams.get('status') || undefined;
    const includeStats = searchParams.get('stats') === 'true';
    
    const [sources, settings, stats] = await Promise.all([
      aiKnowledgeService.getSources({ 
        type: type || undefined,
        status: status || undefined,
      }),
      aiKnowledgeService.getSettings(),
      includeStats ? aiKnowledgeService.getStats() : null,
    ]);
    
    return NextResponse.json({
      success: true,
      sources,
      settings,
      stats,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error fetching AI knowledge:', error);
    return NextResponse.json(
      { error: 'Failed to fetch AI knowledge data' },
      { status: 500 }
    );
  }
}

// POST - Create new knowledge source (manual text or URL)
export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdminAuth();
    
    const body = await request.json();
    const { name, type, content, websiteUrl, metadata } = body;
    
    if (!name || !type) {
      return NextResponse.json(
        { error: 'Name and type are required' },
        { status: 400 }
      );
    }
    
    if (type === 'manual' && !content) {
      return NextResponse.json(
        { error: 'Content is required for manual entries' },
        { status: 400 }
      );
    }
    
    if (type === 'url' && !websiteUrl) {
      return NextResponse.json(
        { error: 'URL is required for URL entries' },
        { status: 400 }
      );
    }
    
    const source = await aiKnowledgeService.createSource({
      name,
      type,
      content: type === 'manual' ? content : undefined,
      websiteUrl: type === 'url' ? websiteUrl : undefined,
      metadata,
      createdBy: admin.id,
    });
    
    return NextResponse.json({
      success: true,
      source,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error creating AI knowledge source:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create knowledge source' },
      { status: 500 }
    );
  }
}
