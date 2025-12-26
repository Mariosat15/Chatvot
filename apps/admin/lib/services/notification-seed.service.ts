import { connectToDatabase } from '@/database/mongoose';
import NotificationTemplate from '@/database/models/notification-template.model';

let hasSeeded = false;

/**
 * Seed default notification templates if they don't exist
 * This is safe to call multiple times - it uses upsert
 */
export async function seedNotificationTemplates(): Promise<void> {
  // Only seed once per server instance
  if (hasSeeded) {
    return;
  }

  try {
    await connectToDatabase();
    await NotificationTemplate.seedDefaults();
    hasSeeded = true;
    console.log('✅ Notification templates seeded');
  } catch (error) {
    console.error('❌ Error seeding notification templates:', error);
  }
}

/**
 * Check if templates need seeding
 */
export async function checkAndSeedTemplates(): Promise<void> {
  try {
    await connectToDatabase();
    
    // Check if any templates exist
    const count = await NotificationTemplate.countDocuments();
    
    if (count === 0) {
      console.log('📋 No notification templates found, seeding defaults...');
      await NotificationTemplate.seedDefaults();
      hasSeeded = true;
    } else {
      hasSeeded = true;
    }
  } catch (error) {
    console.error('❌ Error checking notification templates:', error);
  }
}

// Export for use in API routes
export { hasSeeded };

