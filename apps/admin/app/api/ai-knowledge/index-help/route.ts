import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@/lib/admin/auth';
import { aiKnowledgeService } from '@/lib/services/ai-knowledge.service';
import { PLATFORM_KNOWLEDGE_BASE } from '@/lib/ai-agent/knowledge-base';
import { AIKnowledgeSource } from '@/database/models/ai-knowledge.model';

// POST - Index the built-in help/wiki content
export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdminAuth();
    
    const body = await request.json().catch(() => ({}));
    const { force = false } = body;
    
    // Check if we already have the built-in help indexed
    const existingHelpSource = await AIKnowledgeSource.findOne({ 
      type: 'help_article',
      name: 'ChartVolt Platform Knowledge Base'
    });
    
    if (existingHelpSource && !force) {
      return NextResponse.json({
        success: true,
        message: 'Built-in help is already indexed',
        source: existingHelpSource,
        alreadyIndexed: true,
      });
    }
    
    // Delete existing help source if forcing re-index
    if (existingHelpSource && force) {
      await aiKnowledgeService.deleteSource(existingHelpSource._id.toString());
    }
    
    // Create the knowledge source from the built-in knowledge base
    const source = await aiKnowledgeService.createSource({
      name: 'ChartVolt Platform Knowledge Base',
      type: 'help_article',
      content: PLATFORM_KNOWLEDGE_BASE,
      metadata: {
        title: 'ChartVolt Platform - Complete Admin Guide',
        description: 'Built-in comprehensive documentation for the admin panel',
        category: 'General',
        tags: ['help', 'documentation', 'admin', 'guide', 'built-in'],
      },
      createdBy: admin.adminId || 'system',
    });
    
    return NextResponse.json({
      success: true,
      message: 'Built-in help has been indexed successfully',
      source,
      alreadyIndexed: false,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error indexing help articles:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to index help articles' },
      { status: 500 }
    );
  }
}

// GET - Check if help is indexed
export async function GET() {
  try {
    await requireAdminAuth();
    
    const existingHelpSource = await AIKnowledgeSource.findOne({ 
      type: 'help_article',
      name: 'ChartVolt Platform Knowledge Base'
    });
    
    return NextResponse.json({
      success: true,
      indexed: !!existingHelpSource,
      source: existingHelpSource,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error checking help index status:', error);
    return NextResponse.json(
      { error: 'Failed to check help index status' },
      { status: 500 }
    );
  }
}
