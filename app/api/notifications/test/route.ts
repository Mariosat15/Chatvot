import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/better-auth/auth';
import { headers } from 'next/headers';
import { connectToDatabase } from '@/database/mongoose';
import { notificationService } from '@/lib/services/notification.service';
import NotificationTemplate from '@/database/models/notification-template.model';
import Notification from '@/database/models/notification.model';

// POST - Send a test notification or reseed templates
export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectToDatabase();

    const userId = session.user.id;
    
    // Check for reseed action
    const url = new URL(request.url);
    if (url.searchParams.get('action') === 'reseed') {
      console.log('🔄 Force re-seeding notification templates...');
      await NotificationTemplate.deleteMany({});
      await NotificationTemplate.seedDefaults();
      const count = await NotificationTemplate.countDocuments();
      console.log(`✅ Re-seeded ${count} templates`);
      return NextResponse.json({ success: true, message: `Re-seeded ${count} templates` });
    }

    console.log(`\n🧪 TEST NOTIFICATION for user: ${userId}`);

    // Check template count
    const templateCount = await NotificationTemplate.countDocuments();
    console.log(`📋 Total templates in database: ${templateCount}`);

    if (templateCount === 0) {
      console.log('⚠️ No templates found, seeding...');
      await NotificationTemplate.seedDefaults();
      const newCount = await NotificationTemplate.countDocuments();
      console.log(`✅ Seeded ${newCount} templates`);
    }

    // Check if deposit_completed template exists
    const template = await NotificationTemplate.findOne({ templateId: 'deposit_completed' });
    console.log(`📄 deposit_completed template:`, template ? 'EXISTS' : 'NOT FOUND');
    if (template) {
      console.log(`   Enabled: ${template.isEnabled}`);
    }

    // Send a test notification
    console.log(`\n📤 Sending test notification...`);
    const result = await notificationService.send({
      userId,
      templateId: 'deposit_completed',
      variables: { 
        amount: '€10.00', 
        balance: '100.00' 
      },
    });

    console.log(`📬 Result:`, result ? `Created with ID ${result._id}` : 'NOT CREATED');

    // Count user's notifications
    const userNotifications = await Notification.countDocuments({ userId });
    console.log(`📊 Total notifications for user: ${userNotifications}`);

    return NextResponse.json({
      success: true,
      message: result ? 'Test notification sent!' : 'Notification not created (check logs)',
      templateCount,
      templateExists: !!template,
      templateEnabled: template?.isEnabled,
      notificationCreated: !!result,
      notificationId: result?._id?.toString(),
      userNotificationCount: userNotifications,
    });
  } catch (error) {
    console.error('❌ Error in test notification:', error);
    return NextResponse.json(
      { 
        error: 'Failed to send test notification',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// GET - Check notification system status and list all templates
export async function GET() {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectToDatabase();

    const userId = session.user.id;

    // Seed templates if none exist
    const templateCount = await NotificationTemplate.countDocuments();
    if (templateCount === 0) {
      console.log('⚠️ No templates found, seeding...');
      await NotificationTemplate.seedDefaults();
    }

    // Get all templates
    const allTemplates = await NotificationTemplate.find({}).select('templateId name category isEnabled').lean();
    
    const [
      enabledTemplates,
      userNotifications,
      unreadCount,
    ] = await Promise.all([
      NotificationTemplate.countDocuments({ isEnabled: true }),
      Notification.countDocuments({ userId }),
      Notification.countDocuments({ userId, isRead: false }),
    ]);

    // Group templates by category
    const templatesByCategory = allTemplates.reduce((acc: any, t: any) => {
      if (!acc[t.category]) acc[t.category] = [];
      acc[t.category].push({ id: t.templateId, name: t.name, enabled: t.isEnabled });
      return acc;
    }, {});

    return NextResponse.json({
      status: 'ok',
      userId,
      templates: {
        total: allTemplates.length,
        enabled: enabledTemplates,
        byCategory: templatesByCategory,
      },
      notifications: {
        total: userNotifications,
        unread: unreadCount,
      },
    });
  } catch (error) {
    console.error('Error checking notification status:', error);
    return NextResponse.json(
      { error: 'Failed to check status' },
      { status: 500 }
    );
  }
}

