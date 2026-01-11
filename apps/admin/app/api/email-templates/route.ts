import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/database/mongoose';
import EmailTemplate, { IEmailTemplate } from '@/database/models/email-template.model';
import { requireAdminAuth, getAdminSession } from '@/lib/admin/auth';
import { auditLogService } from '@/lib/services/audit-log.service';

// GET - Get all email templates or specific template
export async function GET(request: NextRequest) {
  try {
    await requireAdminAuth();
    await connectToDatabase();

    const { searchParams } = new URL(request.url);
    const templateType = searchParams.get('type');

    if (templateType) {
      // Get specific template
      let template = await EmailTemplate.findOne({ templateType });
      
      if (!template) {
        // Create default template if it doesn't exist
        template = await EmailTemplate.create({
          templateType,
          name: getDefaultName(templateType),
        });
      }
      
      return NextResponse.json({ template });
    }

    // Get all templates
    const templates = await EmailTemplate.find().sort({ templateType: 1 });
    
    // Ensure all template types exist
    const templateTypes: IEmailTemplate['templateType'][] = [
      'welcome',
      'price_alert',
      'invoice',
      'news_summary',
      'inactive_reminder',
      'deposit_completed',
      'withdrawal_completed',
      'email_verification',
    ];
    
    const existingTypes = new Set(templates.map(t => t.templateType));
    
    for (const type of templateTypes) {
      if (!existingTypes.has(type)) {
        const newTemplate = await EmailTemplate.create({
          templateType: type,
          name: getDefaultName(type),
        });
        templates.push(newTemplate);
      }
    }
    
    // Sort again after potentially adding new templates
    templates.sort((a, b) => a.templateType.localeCompare(b.templateType));

    return NextResponse.json({ templates });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error fetching email templates:', error);
    return NextResponse.json(
      { error: 'Failed to fetch email templates' },
      { status: 500 }
    );
  }
}

// PUT - Update email template
export async function PUT(request: NextRequest) {
  try {
    await requireAdminAuth();
    await connectToDatabase();

    const body = await request.json();
    const { templateType, ...updates } = body;

    if (!templateType) {
      return NextResponse.json(
        { error: 'Template type is required' },
        { status: 400 }
      );
    }

    // Get old values for audit log
    const _oldTemplate = await EmailTemplate.findOne({ templateType }).lean();

    const template = await EmailTemplate.findOneAndUpdate(
      { templateType },
      { $set: updates },
      { new: true, upsert: true }
    );

    // Log the update
    const admin = await getAdminSession();
    if (admin) {
      await auditLogService.logSettingsUpdated(
        { id: admin.id, email: admin.email || 'admin', name: admin.name },
        `email_template_${templateType}`,
        null,
        Object.keys(updates)
      );
    }

    return NextResponse.json({ 
      success: true, 
      template,
      message: 'Email template updated successfully'
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error updating email template:', error);
    return NextResponse.json(
      { error: 'Failed to update email template' },
      { status: 500 }
    );
  }
}

// POST - Send test email
export async function POST(request: NextRequest) {
  try {
    await requireAdminAuth();
    await connectToDatabase();

    const body = await request.json();
    const { templateType, testEmail } = body;

    if (!templateType || !testEmail) {
      return NextResponse.json(
        { error: 'Template type and test email are required' },
        { status: 400 }
      );
    }

    // Import the email sending functions
    const { 
      sendTestWelcomeEmail, 
      sendTestDepositCompletedEmail, 
      sendTestWithdrawalCompletedEmail, 
      sendTestEmailVerificationEmail,
      sendTestAccountManagerAssignedEmail,
      sendTestAccountManagerChangedEmail,
    } = await import('@/lib/nodemailer');

    let emailSent = false;

    if (templateType === 'welcome') {
      await sendTestWelcomeEmail(testEmail);
      emailSent = true;
    } else if (templateType === 'deposit_completed') {
      await sendTestDepositCompletedEmail(testEmail);
      emailSent = true;
    } else if (templateType === 'withdrawal_completed') {
      await sendTestWithdrawalCompletedEmail(testEmail);
      emailSent = true;
    } else if (templateType === 'email_verification') {
      await sendTestEmailVerificationEmail(testEmail);
      emailSent = true;
    } else if (templateType === 'account_manager_assigned') {
      await sendTestAccountManagerAssignedEmail(testEmail);
      emailSent = true;
    } else if (templateType === 'account_manager_changed') {
      await sendTestAccountManagerChangedEmail(testEmail);
      emailSent = true;
    }

    if (emailSent) {
      // Log the test email
      const admin = await getAdminSession();
      if (admin) {
        await auditLogService.logSettingsUpdated(
          { id: admin.id, email: admin.email || 'admin', name: admin.name },
          'test_email_sent',
          null,
          { templateType, testEmail }
        );
      }
      
      return NextResponse.json({ 
        success: true, 
        message: `Test email sent to ${testEmail}`
      });
    }

    return NextResponse.json(
      { error: 'Test email not implemented for this template type' },
      { status: 400 }
    );
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error sending test email:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to send test email' },
      { status: 500 }
    );
  }
}

function getDefaultName(type: string): string {
  const names: Record<string, string> = {
    welcome: 'Welcome Email',
    price_alert: 'Price Alert Email',
    invoice: 'Invoice Email',
    news_summary: 'News Summary Email',
    inactive_reminder: 'Inactive User Reminder',
    deposit_completed: 'Deposit Completed Email',
    withdrawal_completed: 'Withdrawal Completed Email',
    email_verification: 'Email Verification',
  };
  return names[type] || 'Email Template';
}

