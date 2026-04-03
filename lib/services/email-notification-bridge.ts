/**
 * Email Notification Bridge
 *
 * Sends notification emails for competition, margin, and challenge events.
 * Uses the same admin-managed email template system as all other emails
 * (Settings → Email Templates). Each type can be enabled/disabled independently.
 *
 * Respects user notification preferences before sending.
 */
import { connectToDatabase } from "@/database/mongoose";
import { getEmailTemplate, IEmailTemplate } from "@/database/models/email-template.model";
import { getTransporter } from "@/lib/nodemailer";
import { getSettings } from "@/lib/services/settings.service";
import UserNotificationPreferences from "@/database/models/user-notification-preferences.model";
import { WhiteLabel } from "@/database/models/whitelabel.model";
import CompanySettings, { COUNTRY_NAMES } from "@/database/models/company-settings.model";

interface EmailTarget {
  userId: string;
  email: string;
  name: string;
}

const ALLOWED_CATEGORIES = new Set(["competitions", "trading", "challenges"]);

async function shouldSendEmail(userId: string, category: string): Promise<boolean> {
  try {
    if (!ALLOWED_CATEGORIES.has(category)) return true;
    const prefs = await UserNotificationPreferences.findOne({ userId }).lean();
    if (!prefs) return true;
     
    const p = prefs as Record<string, unknown>;
    if (p.emailNotifications === false) return false;
    const catPrefs = p[category] as { email?: boolean } | undefined; // eslint-disable-line security/detect-object-injection
    if (catPrefs?.email === false) return false;
    return true;
  } catch {
    return true;
  }
}

async function getEmailContext() {
  const [companySettings, settings, whiteLabelSettings] = await Promise.all([
    CompanySettings.getSingleton(),
    getSettings(),
    WhiteLabel.findOne(),
  ]);
  const platformName = settings.appName || companySettings.companyName || "ChartVolt";
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
  const isLocalhost = baseUrl.includes("localhost") || baseUrl.includes("127.0.0.1");
  let logoUrl = (whiteLabelSettings as unknown as Record<string, unknown>)?.emailLogo as string || "/assets/images/logo.png";
  if (!logoUrl.startsWith("http")) {
    logoUrl = isLocalhost ? "https://placehold.co/150x50/141414/FDD458?text=Logo" : `${baseUrl}${logoUrl}`;
  }
  let companyAddress = "";
  if (companySettings.addressLine1 || companySettings.city) {
    companyAddress = [
      companySettings.addressLine1, companySettings.addressLine2,
      companySettings.city, companySettings.postalCode,
      COUNTRY_NAMES[companySettings.country] || companySettings.country,
    ].filter(Boolean).join(", ");
  }
  return { platformName, baseUrl, logoUrl, companyAddress, settings };
}

function replacePlaceholders(text: string, vars: Record<string, string>): string {
  let result = text;
  for (const [key, val] of Object.entries(vars)) {
    result = result.split(`{{${key}}}`).join(val);
  }
  return result;
}

function buildHtmlFromTemplate(template: IEmailTemplate, vars: Record<string, string>, logoUrl: string): string {
  const heading = replacePlaceholders(template.headingText || "", vars);
  const intro = replacePlaceholders(template.introText || "", vars);
  const closing = replacePlaceholders(template.closingText || "", vars);
  const ctaText = replacePlaceholders(template.ctaButtonText || "", vars);
  const ctaUrl = replacePlaceholders(template.ctaButtonUrl || "", vars);
  const features = (template.featureItems || []).map((f) => replacePlaceholders(f, vars));
  const featureListHtml = features.map((f) => `<li style="margin-bottom:8px;color:#d1d5db">${f}</li>`).join("");

  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background-color:#0a0a0a;font-family:Arial,Helvetica,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0a0a0a;padding:40px 20px">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background-color:#141414;border-radius:12px;overflow:hidden">
<tr><td style="padding:30px;text-align:center;background:#1a1a2e">
  <img src="${logoUrl}" alt="Logo" height="40" style="max-height:40px"/>
</td></tr>
<tr><td style="padding:30px 40px">
  <h1 style="color:#fff;font-size:24px;margin:0 0 20px">${heading}</h1>
  <p style="color:#d1d5db;font-size:16px;line-height:1.6;margin:0 0 20px">${intro}</p>
  ${featureListHtml ? `<p style="color:#a3a3a3;font-size:14px;font-weight:600;margin:0 0 10px">${replacePlaceholders(template.featureListLabel || "", vars)}</p><ul style="padding-left:20px;margin:0 0 20px">${featureListHtml}</ul>` : ""}
  ${closing ? `<p style="color:#d1d5db;font-size:14px;line-height:1.5;margin:0 0 24px">${closing}</p>` : ""}
  ${ctaText ? `<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center"><a href="${ctaUrl}" style="display:inline-block;padding:14px 32px;background:#6366f1;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:15px">${ctaText}</a></td></tr></table>` : ""}
</td></tr>
<tr><td style="padding:20px 40px;border-top:1px solid #2a2a2a;text-align:center">
  <p style="color:#666;font-size:12px;margin:0">${vars.platformName || "ChartVolt"}</p>
</td></tr>
</table>
</td></tr></table>
</body></html>`;
}

async function sendTemplateEmail(
  templateType: IEmailTemplate["templateType"],
  to: string,
  vars: Record<string, string>,
): Promise<void> {
  try {
    await connectToDatabase();
    const template = await getEmailTemplate(templateType);

    if (!template.isActive) {
      console.log(`ℹ️ [EMAIL] Template "${templateType}" is disabled, skipping email to ${to}`);
      return;
    }

    const ctx = await getEmailContext();
    const allVars = { ...vars, platformName: ctx.platformName, baseUrl: ctx.baseUrl };
    const subject = replacePlaceholders(template.subject || "", allVars);
    const html = buildHtmlFromTemplate(template, allVars, ctx.logoUrl);

    const transporter = await getTransporter();
    await transporter.sendMail({
      from: `"${ctx.platformName}" <${ctx.settings.nodemailerEmail || process.env.NODEMAILER_EMAIL}>`,
      to,
      subject,
      html,
    });
    console.log(`✅ [EMAIL] "${templateType}" sent to ${to}`);
  } catch (error) {
    console.error(`❌ [EMAIL] Failed to send "${templateType}" to ${to}:`, error);
  }
}

export const emailNotificationBridge = {
  async competitionStarting(
    targets: EmailTarget[],
    competitionName: string,
    startsAt: Date,
  ): Promise<void> {
    const timeStr = startsAt.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" });
    for (const t of targets) {
      if (!(await shouldSendEmail(t.userId, "competitions"))) continue;
      await sendTemplateEmail("competition_starting", t.email, {
        name: t.name,
        competitionName,
        startTime: timeStr,
      });
    }
  },

  async competitionEnded(
    targets: EmailTarget[],
    competitionName: string,
    competitionId: string,
  ): Promise<void> {
    for (const t of targets) {
      if (!(await shouldSendEmail(t.userId, "competitions"))) continue;
      await sendTemplateEmail("competition_ended", t.email, {
        name: t.name,
        competitionName,
        competitionId,
      });
    }
  },

  async marginWarning(
    target: EmailTarget,
    marginLevel: number,
    competitionName: string,
  ): Promise<void> {
    if (!(await shouldSendEmail(target.userId, "trading"))) return;
    await sendTemplateEmail("margin_warning", target.email, {
      name: target.name,
      marginLevel: marginLevel.toFixed(1),
      competitionName,
    });
  },

  async challengeReceived(
    target: EmailTarget,
    challengerName: string,
    stakeAmount: number,
  ): Promise<void> {
    if (!(await shouldSendEmail(target.userId, "challenges"))) return;
    await sendTemplateEmail("challenge_received", target.email, {
      name: target.name,
      challengerName,
      stakeAmount: stakeAmount.toString(),
    });
  },
};

export default emailNotificationBridge;
