import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/database/mongoose";
import EmailTemplate, {
  getEmailTemplate,
  IEmailTemplate,
} from "@/database/models/email-template.model";
import { guardSection } from "@/lib/admin/section-route-guard";
import { auditLogService } from "@/lib/services/audit-log.service";

// GET - Get all email templates or specific template
export async function GET(request: NextRequest) {
  try {
    const guard = await guardSection("email-templates");
    if (!guard.ok) return guard.response;
    await connectToDatabase();

    const { searchParams } = new URL(request.url);
    const templateType = searchParams.get("type");

    if (templateType) {
      // Reason: getEmailTemplate applies type-specific defaults (and repairs
      // rows that were created with only a name, which inherit welcome copy
      // from the schema). Never EmailTemplate.create({ templateType, name }).
      const template = await getEmailTemplate(
        templateType as IEmailTemplate["templateType"],
      );

      return NextResponse.json({ template });
    }

    // Get all templates
    const templates = await EmailTemplate.find().sort({ templateType: 1 });

    // Ensure all template types exist
    const templateTypes: IEmailTemplate["templateType"][] = [
      "welcome",
      "price_alert",
      "invoice",
      "news_summary",
      "inactive_reminder",
      "deposit_completed",
      "withdrawal_completed",
      "refund_completed",
      "email_verification",
      "account_manager_assigned",
      "account_manager_changed",
      "competition_starting",
      "competition_ended",
      "margin_warning",
      "challenge_received",
      "gm_terms_request",
      "password_reset",
      "two_factor_otp",
    ];

    const existingTypes = new Set(templates.map((t) => t.templateType));

    for (const type of templateTypes) {
      if (!existingTypes.has(type)) {
        // Reason: same footgun as above — name-only create fills welcome defaults.
        const newTemplate = await getEmailTemplate(type);
        templates.push(newTemplate);
      }
    }

    // Sort again after potentially adding new templates
    templates.sort((a, b) => a.templateType.localeCompare(b.templateType));

    return NextResponse.json({ templates });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error fetching email templates:", error);
    return NextResponse.json(
      { error: "Failed to fetch email templates" },
      { status: 500 },
    );
  }
}

// PUT - Update email template
export async function PUT(request: NextRequest) {
  try {
    const guard = await guardSection("email-templates");
    if (!guard.ok) return guard.response;
    await connectToDatabase();

    const body = await request.json();
    const { templateType, ...updates } = body;

    if (!templateType) {
      return NextResponse.json(
        { error: "Template type is required" },
        { status: 400 },
      );
    }

    // Get old values for audit log
    const _oldTemplate = await EmailTemplate.findOne({ templateType }).lean();

    const template = await EmailTemplate.findOneAndUpdate(
      { templateType },
      { $set: updates },
      { new: true, upsert: true },
    );

    // Log the update
    const admin = guard.admin;
    if (admin) {
      await auditLogService.logSettingsUpdated(
        { id: admin.id, email: admin.email || "admin", name: admin.name },
        `email_template_${templateType}`,
        null,
        Object.keys(updates),
      );
    }

    return NextResponse.json({
      success: true,
      template,
      message: "Email template updated successfully",
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error updating email template:", error);
    return NextResponse.json(
      { error: "Failed to update email template" },
      { status: 500 },
    );
  }
}

// POST - Send test email
export async function POST(request: NextRequest) {
  try {
    const guard = await guardSection("email-templates");
    if (!guard.ok) return guard.response;
    await connectToDatabase();

    const body = await request.json();
    const { templateType, testEmail } = body;

    if (!templateType || !testEmail) {
      return NextResponse.json(
        { error: "Template type and test email are required" },
        { status: 400 },
      );
    }

    // Import the email sending functions
    const {
      sendTestWelcomeEmail,
      sendTestDepositCompletedEmail,
      sendTestWithdrawalCompletedEmail,
      sendTestRefundCompletedEmail,
      sendTestEmailVerificationEmail,
      sendTestAccountManagerAssignedEmail,
      sendTestAccountManagerChangedEmail,
    } = await import("@/lib/nodemailer");

    let emailSent = false;

    if (templateType === "welcome") {
      await sendTestWelcomeEmail(testEmail);
      emailSent = true;
    } else if (templateType === "deposit_completed") {
      await sendTestDepositCompletedEmail(testEmail);
      emailSent = true;
    } else if (templateType === "withdrawal_completed") {
      await sendTestWithdrawalCompletedEmail(testEmail);
      emailSent = true;
    } else if (templateType === "refund_completed") {
      await sendTestRefundCompletedEmail(testEmail);
      emailSent = true;
    } else if (templateType === "email_verification") {
      await sendTestEmailVerificationEmail(testEmail);
      emailSent = true;
    } else if (templateType === "account_manager_assigned") {
      await sendTestAccountManagerAssignedEmail(testEmail);
      emailSent = true;
    } else if (templateType === "account_manager_changed") {
      await sendTestAccountManagerChangedEmail(testEmail);
      emailSent = true;
    } else if (
      templateType === "competition_starting" ||
      templateType === "competition_ended" ||
      templateType === "margin_warning" ||
      templateType === "challenge_received" ||
      templateType === "gm_terms_request"
    ) {
      const { sendTestNotificationEmail } = await import(
        "../../../../../lib/services/email-notification-bridge"
      );
      await sendTestNotificationEmail(templateType, testEmail);
      emailSent = true;
    } else if (templateType === "password_reset") {
      // Reason: main-app helper — same relative import pattern as
      // email-notification-bridge above. Admin `@/` does not reach root lib.
      const { sendTestPasswordResetEmail } = await import(
        "../../../../../lib/nodemailer/send-password-reset"
      );
      await sendTestPasswordResetEmail(testEmail);
      emailSent = true;
    } else if (templateType === "two_factor_otp") {
      const { sendTwoFactorOTP } = await import(
        "../../../../../lib/nodemailer/send-two-factor-otp"
      );
      await sendTwoFactorOTP({ email: testEmail, name: "Test User", otp: "123456" });
      emailSent = true;
    }

    if (emailSent) {
      // Log the test email
      const admin = guard.admin;
      if (admin) {
        await auditLogService.logSettingsUpdated(
          { id: admin.id, email: admin.email || "admin", name: admin.name },
          "test_email_sent",
          null,
          { templateType, testEmail },
        );
      }

      return NextResponse.json({
        success: true,
        message: `Test email sent to ${testEmail}`,
      });
    }

    return NextResponse.json(
      { error: "Test email not implemented for this template type" },
      { status: 400 },
    );
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error sending test email:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to send test email",
      },
      { status: 500 },
    );
  }
}

