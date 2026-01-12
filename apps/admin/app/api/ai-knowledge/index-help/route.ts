import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@/lib/admin/auth';
import { aiKnowledgeService } from '@/lib/services/ai-knowledge.service';
import { PLATFORM_KNOWLEDGE_BASE } from '@/lib/ai-agent/knowledge-base';
import { generateCustomerKnowledgeBase, getSettingsSummary } from '@/lib/services/dynamic-knowledge-generator';
import { AIKnowledgeSource } from '@/database/models/ai-knowledge.model';

// POST - Index the built-in help/wiki content
export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdminAuth();
    
    const body = await request.json().catch(() => ({}));
    const { force = false, type = 'all' } = body; // type: 'admin', 'customer', 'all'
    
    const results: { admin?: any; customer?: any } = {};
    
    // Index ADMIN knowledge base (only for admin AI)
    if (type === 'admin' || type === 'all') {
      const existingAdminSource = await AIKnowledgeSource.findOne({ 
        type: 'help_article',
        name: 'ChartVolt Platform Knowledge Base'
      });
      
      if (existingAdminSource && !force) {
        results.admin = { alreadyIndexed: true, source: existingAdminSource };
      } else {
        if (existingAdminSource && force) {
          await aiKnowledgeService.deleteSource(existingAdminSource._id.toString());
        }
        
        const adminSource = await aiKnowledgeService.createSource({
          name: 'ChartVolt Platform Knowledge Base',
          type: 'help_article',
          audience: 'admin', // ADMIN ONLY - internal docs
          content: PLATFORM_KNOWLEDGE_BASE,
          metadata: {
            title: 'ChartVolt Platform - Complete Admin Guide',
            description: 'Internal admin documentation - NOT for customers',
            category: 'Admin',
            tags: ['admin', 'internal', 'guide', 'documentation'],
          },
          createdBy: admin.adminId || 'system',
        });
        results.admin = { alreadyIndexed: false, source: adminSource };
      }
    }
    
    // Index CUSTOMER FAQ knowledge base (for customer support AI)
    // Uses DYNAMIC content generated from actual database settings!
    if (type === 'customer' || type === 'all') {
      const existingCustomerSource = await AIKnowledgeSource.findOne({ 
        type: 'help_article',
        name: 'Customer FAQ Knowledge Base'
      });
      
      if (existingCustomerSource && !force) {
        results.customer = { alreadyIndexed: true, source: existingCustomerSource };
      } else {
        if (existingCustomerSource && force) {
          await aiKnowledgeService.deleteSource(existingCustomerSource._id.toString());
        }
        
        // Generate DYNAMIC content from database settings
        // This includes the correct credit name (Volts, Credits, etc.), 
        // conversion rates, limits, and all other configurable values
        const dynamicContent = await generateCustomerKnowledgeBase();
        const settingsSummary = await getSettingsSummary();
        console.log(`[AI Knowledge] Generating customer FAQ with settings: ${settingsSummary}`);
        
        const customerSource = await aiKnowledgeService.createSource({
          name: 'Customer FAQ Knowledge Base',
          type: 'help_article',
          audience: 'customer', // CUSTOMER ONLY - public facing FAQ
          content: dynamicContent, // DYNAMIC content with actual values!
          metadata: {
            title: 'Customer FAQ & Help (Dynamic)',
            description: 'Public-facing FAQ for customer support AI - generated from platform settings',
            category: 'Customer Support',
            tags: ['faq', 'customer', 'support', 'help', 'dynamic'],
          },
          createdBy: admin.adminId || 'system',
        });
        results.customer = { alreadyIndexed: false, source: customerSource, settingsUsed: settingsSummary };
      }
    }
    
    return NextResponse.json({
      success: true,
      message: 'Knowledge bases indexed successfully',
      results,
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
    
    const [adminSource, customerSource] = await Promise.all([
      AIKnowledgeSource.findOne({ 
        type: 'help_article',
        name: 'ChartVolt Platform Knowledge Base'
      }),
      AIKnowledgeSource.findOne({ 
        type: 'help_article',
        name: 'Customer FAQ Knowledge Base'
      }),
    ]);
    
    return NextResponse.json({
      success: true,
      indexed: !!(adminSource || customerSource),
      adminIndexed: !!adminSource,
      customerIndexed: !!customerSource,
      sources: {
        admin: adminSource,
        customer: customerSource,
      },
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
