/**
 * AI Agent Configuration API
 * Returns the current AI configuration status
 */

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/database/mongoose';
import { WhiteLabel } from '@/database/models/whitelabel.model';
import { verifyAdminAuth } from '@/lib/admin/auth';

export async function GET(request: NextRequest) {
  try {
    const admin = await verifyAdminAuth();
    if (!admin.isAuthenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectToDatabase();
    const settings = await WhiteLabel.findOne();

    // Check for API key in settings or environment
    const hasApiKey = !!(settings?.openaiApiKey || process.env.OPENAI_API_KEY);
    const enabled = settings?.openaiEnabled ?? (process.env.OPENAI_ENABLED === 'true');
    const model = settings?.openaiModel || process.env.OPENAI_MODEL || 'gpt-4o-mini';

    return NextResponse.json({
      enabled,
      hasApiKey,
      model,
    });
  } catch (error) {
    console.error('Error fetching AI config:', error);
    return NextResponse.json(
      { error: 'Failed to fetch AI configuration' },
      { status: 500 }
    );
  }
}

