import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@/lib/admin/auth';
import { aiKnowledgeService } from '@/lib/services/ai-knowledge.service';

// POST - Search knowledge base
export async function POST(request: NextRequest) {
  try {
    await requireAdminAuth();
    
    const body = await request.json();
    const { query, maxResults, threshold, category, sourceTypes } = body;
    
    if (!query) {
      return NextResponse.json(
        { error: 'Query is required' },
        { status: 400 }
      );
    }
    
    const results = await aiKnowledgeService.search(query, {
      maxResults,
      threshold,
      category,
      sourceTypes,
    });
    
    return NextResponse.json({
      success: true,
      results: results.map(r => ({
        id: r._id,
        content: r.content,
        headingPath: r.headingPath,
        similarity: r.similarity,
        source: r.sourceId,
        metadata: r.metadata,
      })),
      count: results.length,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error searching AI knowledge:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Search failed' },
      { status: 500 }
    );
  }
}
