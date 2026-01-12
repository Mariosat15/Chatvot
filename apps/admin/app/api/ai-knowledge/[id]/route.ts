import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@/lib/admin/auth';
import { aiKnowledgeService } from '@/lib/services/ai-knowledge.service';

// GET - Get single source with chunks
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdminAuth();
    const { id } = await params;
    
    const source = await aiKnowledgeService.getSource(id);
    
    if (!source) {
      return NextResponse.json({ error: 'Source not found' }, { status: 404 });
    }
    
    return NextResponse.json({
      success: true,
      source,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error fetching AI knowledge source:', error);
    return NextResponse.json(
      { error: 'Failed to fetch source' },
      { status: 500 }
    );
  }
}

// PATCH - Update source (toggle active, reprocess)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdminAuth();
    const { id } = await params;
    const body = await request.json();
    
    const { action, isActive, content } = body;
    
    if (action === 'toggle') {
      await aiKnowledgeService.toggleSourceActive(id, isActive);
      return NextResponse.json({ success: true, message: 'Source toggled' });
    }
    
    if (action === 'reprocess' && content) {
      const result = await aiKnowledgeService.processSource(id, content);
      return NextResponse.json({ success: true, ...result });
    }
    
    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    );
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error updating AI knowledge source:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update source' },
      { status: 500 }
    );
  }
}

// DELETE - Delete source and chunks
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdminAuth();
    const { id } = await params;
    
    await aiKnowledgeService.deleteSource(id);
    
    return NextResponse.json({
      success: true,
      message: 'Source deleted',
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error deleting AI knowledge source:', error);
    return NextResponse.json(
      { error: 'Failed to delete source' },
      { status: 500 }
    );
  }
}
