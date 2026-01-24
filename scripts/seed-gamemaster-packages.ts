/**
 * Seed Script: Create Game Master Packages in Marketplace
 * 
 * Run with: npx ts-node scripts/seed-gamemaster-packages.ts
 * Or: npx tsx scripts/seed-gamemaster-packages.ts
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables - try multiple paths
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI is not defined in environment variables');
  process.exit(1);
}

// Game Master package definitions
const gameMasterPackages = [
  {
    name: 'Game Master Starter',
    slug: 'game-master-starter',
    description: 'Perfect for getting started as a Game Master. Create 1 competition per day and earn 5% from your referrals\' entry fees.',
    category: 'gamemaster',
    price: 299,
    currency: 'credits',
    isActive: true,
    isFeatured: false,
    version: '1.0.0',
    tags: ['gamemaster', 'starter', 'referral'],
    gameMasterConfig: {
      maxCompetitionsPerDay: 1,
      maxUsersPerCompetition: 30,
      referralFeePercentage: 5,
      subscriptionDurationDays: 30,
    },
  },
  {
    name: 'Game Master Pro',
    slug: 'game-master-pro',
    description: 'For serious Game Masters. Create up to 3 competitions per day with larger participant limits and earn 7.5% from referrals.',
    category: 'gamemaster',
    price: 599,
    currency: 'credits',
    isActive: true,
    isFeatured: true,
    version: '1.0.0',
    tags: ['gamemaster', 'pro', 'referral', 'popular'],
    gameMasterConfig: {
      maxCompetitionsPerDay: 3,
      maxUsersPerCompetition: 75,
      referralFeePercentage: 7.5,
      subscriptionDurationDays: 30,
    },
  },
  {
    name: 'Game Master Elite',
    slug: 'game-master-elite',
    description: 'The ultimate Game Master experience. Unlimited daily competitions, massive participant limits, and earn 10% from all your referrals.',
    category: 'gamemaster',
    price: 999,
    currency: 'credits',
    isActive: true,
    isFeatured: true,
    version: '1.0.0',
    tags: ['gamemaster', 'elite', 'referral', 'premium', 'unlimited'],
    gameMasterConfig: {
      maxCompetitionsPerDay: 10,
      maxUsersPerCompetition: 150,
      referralFeePercentage: 10,
      subscriptionDurationDays: 30,
    },
  },
];

async function seedGameMasterPackages() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI!);
    console.log('✅ Connected to MongoDB');

    const db = mongoose.connection.db;
    if (!db) {
      throw new Error('Database connection not established');
    }

    const collection = db.collection('marketplaceitems');

    console.log('\n📦 Creating Game Master packages...\n');

    for (const pkg of gameMasterPackages) {
      // Check if package already exists
      const existing = await collection.findOne({ 
        $or: [
          { name: pkg.name, category: 'gamemaster' },
          { slug: pkg.slug }
        ]
      });

      if (existing) {
        console.log(`⏭️  "${pkg.name}" already exists, updating...`);
        await collection.updateOne(
          { _id: existing._id },
          { 
            $set: {
              ...pkg,
              updatedAt: new Date(),
            }
          }
        );
        console.log(`   ✅ Updated "${pkg.name}"`);
      } else {
        await collection.insertOne({
          ...pkg,
          totalSales: 0,
          totalRevenue: 0,
          averageRating: 0,
          reviewCount: 0,
          createdBy: 'system',
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        console.log(`   ✅ Created "${pkg.name}" - ${pkg.price} credits`);
        console.log(`      • ${pkg.gameMasterConfig.maxCompetitionsPerDay} competitions/day`);
        console.log(`      • ${pkg.gameMasterConfig.maxUsersPerCompetition} max users/competition`);
        console.log(`      • ${pkg.gameMasterConfig.referralFeePercentage}% referral fee`);
        console.log(`      • ${pkg.gameMasterConfig.subscriptionDurationDays} days duration`);
      }
    }

    console.log('\n✅ Game Master packages seeded successfully!');
    console.log('\n📋 Summary:');
    console.log('   • Game Master Starter - 299 credits (5% referral)');
    console.log('   • Game Master Pro - 599 credits (7.5% referral) ⭐ Featured');
    console.log('   • Game Master Elite - 999 credits (10% referral) ⭐ Featured');

  } catch (error) {
    console.error('❌ Error seeding packages:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

// Run the seed
seedGameMasterPackages();
