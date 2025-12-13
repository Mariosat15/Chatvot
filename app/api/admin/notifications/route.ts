import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/database/mongoose';
import { requireAdminAuth, getAdminSession } from '@/lib/admin/auth';
import { notificationService } from '@/lib/services/notification.service';
import { auditLogService } from '@/lib/services/audit-log.service';
import { checkAndSeedTemplates } from '@/lib/services/notification-seed.service';
import NotificationTemplate from '@/database/models/notification-template.model';
import Notification from '@/database/models/notification.model';

// GET - Get notification templates and stats
export async function GET(request: NextRequest) {
  try {
    await requireAdminAuth();
    await connectToDatabase();
    
    // Auto-seed templates if none exist
    await checkAndSeedTemplates();

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const category = searchParams.get('category');

    if (action === 'stats') {
      // Get notification statistics
      const stats = await notificationService.getNotificationStats();
      const templateCount = await NotificationTemplate.countDocuments();
      const enabledCount = await NotificationTemplate.countDocuments({ isEnabled: true });

      return NextResponse.json({
        ...stats,
        templateCount,
        enabledCount,
      });
    }

    if (action === 'history') {
      // Get sent notifications history
      const limit = parseInt(searchParams.get('limit') || '100');
      const offset = parseInt(searchParams.get('offset') || '0');

      const [notifications, total] = await Promise.all([
        Notification.find()
          .sort({ createdAt: -1 })
          .skip(offset)
          .limit(limit)
          .lean(),
        Notification.countDocuments(),
      ]);

      return NextResponse.json({ notifications, total });
    }

    // Default: Get templates
    const templates = await notificationService.getTemplates(
      category as any || undefined
    );

    // Group by category
    const grouped = templates.reduce((acc, template) => {
      if (!acc[template.category]) {
        acc[template.category] = [];
      }
      acc[template.category].push(template);
      return acc;
    }, {} as Record<string, typeof templates>);

    return NextResponse.json({ templates, grouped });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error fetching notifications:', error);
    return NextResponse.json(
      { error: 'Failed to fetch notifications' },
      { status: 500 }
    );
  }
}

// POST - Send notification or create template
export async function POST(request: NextRequest) {
  try {
    await requireAdminAuth();
    await connectToDatabase();

    const body = await request.json();
    const { action } = body;
    const admin = await getAdminSession();

    if (action === 'send_instant') {
      // Send instant notification to users
      const { userId, title, message, category, priority, icon, color, actionUrl, actionText } = body;

      if (!title || !message) {
        return NextResponse.json(
          { error: 'Title and message are required' },
          { status: 400 }
        );
      }

      const result = await notificationService.sendInstant({
        userId: userId || 'all',
        title,
        message,
        category: category || 'admin',
        priority: priority || 'normal',
        icon,
        color,
        actionUrl,
        actionText,
        sentBy: admin ? { adminId: admin.id, adminEmail: admin.email } : undefined,
      });

      // Log action
      if (admin) {
        await auditLogService.logSettingsUpdated(
          admin.id,
          admin.email,
          'notification_sent',
          [`type: instant`, `to: ${userId || 'all'}`, `title: ${title}`],
          request
        );
      }

      return NextResponse.json({
        success: true,
        message: userId === 'all' 
          ? 'Notification broadcast to all users'
          : 'Notification sent',
        count: Array.isArray(result) ? result.length : 1,
      });
    }

    if (action === 'send_template') {
      // Send notification using template
      const { templateId, userIds, variables } = body;

      if (!templateId || !userIds || !Array.isArray(userIds) || userIds.length === 0) {
        return NextResponse.json(
          { error: 'Template ID and user IDs are required' },
          { status: 400 }
        );
      }

      const count = await notificationService.sendBulk({
        userIds,
        templateId,
        variables,
      });

      // Log action
      if (admin) {
        await auditLogService.logSettingsUpdated(
          admin.id,
          admin.email,
          'notification_sent',
          [`type: template`, `template: ${templateId}`, `count: ${count}`],
          request
        );
      }

      return NextResponse.json({
        success: true,
        message: `Notification sent to ${count} users`,
        count,
      });
    }

    if (action === 'create_template') {
      // Create custom template
      const { templateId, name, description, category, title, message, icon, priority, color, actionUrl, actionText } = body;

      if (!templateId || !name || !title || !message || !category) {
        return NextResponse.json(
          { error: 'Template ID, name, category, title, and message are required' },
          { status: 400 }
        );
      }

      // Check if template ID already exists
      const existing = await NotificationTemplate.findOne({ templateId });
      if (existing) {
        return NextResponse.json(
          { error: 'Template ID already exists' },
          { status: 400 }
        );
      }

      const template = await notificationService.createCustomTemplate({
        templateId,
        name,
        description,
        category,
        title,
        message,
        icon,
        priority,
        color,
        actionUrl,
        actionText,
      });

      // Log action
      if (admin) {
        await auditLogService.logSettingsUpdated(
          admin.id,
          admin.email,
          'notification_template_created',
          [`id: ${templateId}`, `name: ${name}`],
          request
        );
      }

      return NextResponse.json({
        success: true,
        message: 'Custom template created',
        template,
      });
    }

    if (action === 'seed_defaults') {
      // Seed default templates
      await notificationService.seedDefaultTemplates();

      // Log action
      if (admin) {
        await auditLogService.logSettingsUpdated(
          admin.id,
          admin.email,
          'notification_templates_seeded',
          ['Seeded default notification templates'],
          request
        );
      }

      return NextResponse.json({
        success: true,
        message: 'Default templates seeded',
      });
    }

    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    );
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error in notification action:', error);
    return NextResponse.json(
      { error: 'Failed to process notification action' },
      { status: 500 }
    );
  }
}

// PUT - Update template
export async function PUT(request: NextRequest) {
  try {
    await requireAdminAuth();
    await connectToDatabase();

    const body = await request.json();
    const { templateId, action: updateAction, ...updates } = body;

    if (!templateId) {
      return NextResponse.json(
        { error: 'Template ID is required' },
        { status: 400 }
      );
    }

    const admin = await getAdminSession();

    if (updateAction === 'toggle') {
      // Toggle single template
      const template = await notificationService.toggleTemplate(templateId, updates.isEnabled);

      if (admin) {
        await auditLogService.logSettingsUpdated(
          admin.id,
          admin.email,
          'notification_template_toggled',
          [`id: ${templateId}`, `enabled: ${updates.isEnabled}`],
          request
        );
      }

      return NextResponse.json({
        success: true,
        message: `Template ${updates.isEnabled ? 'enabled' : 'disabled'}`,
        template,
      });
    }

    if (updateAction === 'toggle_all') {
      // Toggle all templates
      await notificationService.toggleAllTemplates(updates.isEnabled);

      if (admin) {
        await auditLogService.logSettingsUpdated(
          admin.id,
          admin.email,
          'notification_templates_toggled_all',
          [`enabled: ${updates.isEnabled}`],
          request
        );
      }

      return NextResponse.json({
        success: true,
        message: `All templates ${updates.isEnabled ? 'enabled' : 'disabled'}`,
      });
    }

    // Default: Update template
    const template = await notificationService.updateTemplate(templateId, updates);

    if (!template) {
      return NextResponse.json(
        { error: 'Template not found' },
        { status: 404 }
      );
    }

    if (admin) {
      await auditLogService.logSettingsUpdated(
        admin.id,
        admin.email,
        'notification_template_updated',
        [`id: ${templateId}`, ...Object.keys(updates)],
        request
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Template updated',
      template,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error updating template:', error);
    return NextResponse.json(
      { error: 'Failed to update template' },
      { status: 500 }
    );
  }
}

// DELETE - Delete custom template
export async function DELETE(request: NextRequest) {
  try {
    await requireAdminAuth();
    await connectToDatabase();

    const { searchParams } = new URL(request.url);
    const templateId = searchParams.get('templateId');

    if (!templateId) {
      return NextResponse.json(
        { error: 'Template ID is required' },
        { status: 400 }
      );
    }

    const deleted = await notificationService.deleteCustomTemplate(templateId);

    if (!deleted) {
      return NextResponse.json(
        { error: 'Template not found or cannot be deleted (only custom templates can be deleted)' },
        { status: 404 }
      );
    }

    const admin = await getAdminSession();
    if (admin) {
      await auditLogService.logSettingsUpdated(
        admin.id,
        admin.email,
        'notification_template_deleted',
        [`id: ${templateId}`],
        request
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Template deleted',
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error deleting template:', error);
    return NextResponse.json(
      { error: 'Failed to delete template' },
      { status: 500 }
    );
  }
}

