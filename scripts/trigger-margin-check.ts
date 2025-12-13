/**
 * Manual script to immediately check and liquidate positions
 * below the admin-configured stopout level
 * 
 * Run with: tsx scripts/trigger-margin-check.ts
 */

import dotenv from 'dotenv';
import { connectToDatabase } from '@/database/mongoose';
import { checkMarginCalls } from '@/lib/actions/trading/position.actions';
import Competition from '@/database/models/trading/competition.model';

dotenv.config();

async function triggerMarginCheck() {
  try {
    console.log('🔌 Connecting to database...');
    await connectToDatabase();
    console.log('✅ Connected');

    // Get all active competitions
    const activeCompetitions = await Competition.find({
      status: 'active',
    }).select('_id slug name').lean();

    if (!activeCompetitions || activeCompetitions.length === 0) {
      console.log('ℹ️  No active competitions found');
      return;
    }

    console.log(`\n📊 Found ${activeCompetitions.length} active competition(s):\n`);

    for (const competition of activeCompetitions) {
      console.log(`\n🎯 Checking margins for: ${(competition as any).name}`);
      console.log(`   Slug: ${(competition as any).slug}`);
      console.log(`   ID: ${(competition as any)._id}\n`);

      const competitionId = String((competition as any)._id);
      await checkMarginCalls(competitionId);
      
      console.log(`   ✅ Completed margin check`);
    }

    console.log('\n✅ Done! All active competitions checked.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

triggerMarginCheck();

