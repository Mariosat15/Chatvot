import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/better-auth/auth';
import { headers } from 'next/headers';
import { connectToDatabase } from '@/database/mongoose';
import UserNotificationPreferences from '@/database/models/user-notification-preferences.model';
import NotificationTemplate from '@/database/models/notification-template.model';

// GET - Get user's notification preferences
export async function GET() {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectToDatabase();

    // Get or create user preferences
    const preferences = await UserNotificationPreferences.getOrCreatePreferences(session.user.id);
    
    // Get all enabled templates for reference
    const templates = await NotificationTemplate.find({ isEnabled: true })
      .select('templateId name category type icon')
      .sort({ category: 1, name: 1 })
      .lean();

    // Group templates by category
    const templatesByCategory = templates.reduce((acc, template) => {
      if (!acc[template.category]) {
        acc[template.category] = [];
      }
      acc[template.category].push(template);
      return acc;
    }, {} as Record<string, typeof templates>);

    return NextResponse.json({
      preferences: JSON.parse(JSON.stringify(preferences)),
      templatesByCategory,
    });
  } catch (error) {
    console.error('Error fetching notification preferences:', error);
    return NextResponse.json(
      { error: 'Failed to fetch preferences' },
      { status: 500 }
    );
  }
}

// PUT - Update user's notification preferences
export async function PUT(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectToDatabase();

    const body = await request.json();
    const {
      notificationsEnabled,
      emailNotificationsEnabled,
      pushNotificationsEnabled,
      categoryPreferences,
      disabledNotifications,
      quietHoursEnabled,
      quietHoursStart,
      quietHoursEnd,
      digestEnabled,
      digestFrequency,
    } = body;

    // Build update object with only provided fields
    const updates: any = {};
    
    if (typeof notificationsEnabled === 'boolean') {
      updates.notificationsEnabled = notificationsEnabled;
    }
    if (typeof emailNotificationsEnabled === 'boolean') {
      updates.emailNotificationsEnabled = emailNotificationsEnabled;
    }
    if (typeof pushNotificationsEnabled === 'boolean') {
      updates.pushNotificationsEnabled = pushNotificationsEnabled;
    }
    if (categoryPreferences && typeof categoryPreferences === 'object') {
      // Merge with existing preferences
      updates['categoryPreferences'] = categoryPreferences;
    }
    if (Array.isArray(disabledNotifications)) {
      updates.disabledNotifications = disabledNotifications;
    }
    if (typeof quietHoursEnabled === 'boolean') {
      updates.quietHoursEnabled = quietHoursEnabled;
    }
    if (quietHoursStart) {
      updates.quietHoursStart = quietHoursStart;
    }
    if (quietHoursEnd) {
      updates.quietHoursEnd = quietHoursEnd;
    }
    if (typeof digestEnabled === 'boolean') {
      updates.digestEnabled = digestEnabled;
    }
    if (digestFrequency) {
      updates.digestFrequency = digestFrequency;
    }

    const preferences = await UserNotificationPreferences.findOneAndUpdate(
      { userId: session.user.id },
      { $set: updates },
      { new: true, upsert: true }
    );

    return NextResponse.json({
      success: true,
      preferences: JSON.parse(JSON.stringify(preferences)),
    });
  } catch (error) {
    console.error('Error updating notification preferences:', error);
    return NextResponse.json(
      { error: 'Failed to update preferences' },
      { status: 500 }
    );
  }
}

// POST - Toggle specific notification type
export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectToDatabase();

    const body = await request.json();
    const { action, templateId, category, enabled } = body;

    if (action === 'toggle_template') {
      // Toggle specific template
      if (!templateId) {
        return NextResponse.json(
          { error: 'Template ID is required' },
          { status: 400 }
        );
      }

      const prefs = await UserNotificationPreferences.getOrCreatePreferences(session.user.id);
      
      if (enabled) {
        // Remove from disabled list
        await UserNotificationPreferences.updateOne(
          { userId: session.user.id },
          { $pull: { disabledNotifications: templateId } }
        );
      } else {
        // Add to disabled list
        await UserNotificationPreferences.updateOne(
          { userId: session.user.id },
          { $addToSet: { disabledNotifications: templateId } }
        );
      }

      return NextResponse.json({ success: true });
    }

    if (action === 'toggle_category') {
      // Toggle entire category
      if (!category) {
        return NextResponse.json(
          { error: 'Category is required' },
          { status: 400 }
        );
      }

      await UserNotificationPreferences.updateOne(
        { userId: session.user.id },
        { $set: { [`categoryPreferences.${category}`]: enabled } },
        { upsert: true }
      );

      return NextResponse.json({ success: true });
    }

    if (action === 'reset_defaults') {
      // Reset to default preferences
      await UserNotificationPreferences.findOneAndUpdate(
        { userId: session.user.id },
        {
          $set: {
            notificationsEnabled: true,
            emailNotificationsEnabled: true,
            pushNotificationsEnabled: false,
            categoryPreferences: {
              purchase: true,
              competition: true,
              challenge: true,
              trading: true,
              achievement: true,
              system: true,
              admin: true,
              security: true,
              social: true,
              messaging: true,
            },
            disabledNotifications: [],
            quietHoursEnabled: false,
            quietHoursStart: null,
            quietHoursEnd: null,
            digestEnabled: false,
            digestFrequency: 'never',
          },
        },
        { upsert: true }
      );

      return NextResponse.json({ success: true, message: 'Preferences reset to defaults' });
    }

    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error in notification preferences action:', error);
    return NextResponse.json(
      { error: 'Failed to process action' },
      { status: 500 }
    );
  }
}

