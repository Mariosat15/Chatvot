/**
 * Password-reset email — uses the editable `password_reset` EmailTemplate.
 * Called from better-auth's `sendResetPassword` and the admin test-send route.
 */

import { getTransporter } from "./index";
import { getSettings } from "@/lib/services/settings.service";
import { getEmailTemplate } from "@/database/models/email-template.model";
import { connectToDatabase } from "@/database/mongoose";

const DEFAULT_EXPIRY_HOURS = 1;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function applyVars(
  text: string,
  vars: Record<string, string>,
): string {
  let out = text;
  for (const [key, value] of Object.entries(vars)) {
    out = out.split(key).join(value);
  }
  return out;
}

export interface SendPasswordResetEmailArgs {
  email: string;
  name?: string;
  resetLink: string;
  expiryHours?: number;
}

/**
 * Sends the branded password-reset email. Never throws to the caller’s
 * success path for missing templates — falls back to a safe default body.
 */
export async function sendPasswordResetEmail({
  email,
  name,
  resetLink,
  expiryHours = DEFAULT_EXPIRY_HOURS,
}: SendPasswordResetEmailArgs): Promise<void> {
  await connectToDatabase();

  let fromAddress = process.env.NODEMAILER_EMAIL || "noreply@chartvolt.com";
  let platformName = "ChartVolt";
  let companyAddress = "";

  try {
    const settings = await getSettings();
    if (settings?.nodemailerEmail) fromAddress = settings.nodemailerEmail;
    if (settings?.siteName) platformName = settings.siteName;
    const addr = (settings as { companyAddress?: string } | null)
      ?.companyAddress;
    if (addr) companyAddress = addr;
  } catch {
    // Fall back to defaults — never block a reset email on settings errors.
  }

  const baseUrl =
    process.env.NEXT_PUBLIC_BASE_URL ||
    process.env.BETTER_AUTH_URL ||
    "http://localhost:3000";

  const safeName = (name || "").trim() || "there";
  const vars: Record<string, string> = {
    "{{name}}": safeName,
    "{{platformName}}": platformName,
    "{{baseUrl}}": baseUrl,
    "{{resetLink}}": resetLink,
    "{{expiryHours}}": String(expiryHours),
    "{{companyAddress}}": companyAddress,
  };

  // Reason: always go through getEmailTemplate — a findOne-only path keeps a
  // row that was name-seeded with the schema's welcome subject forever.
  let template: Awaited<ReturnType<typeof getEmailTemplate>> | null = null;
  try {
    template = await getEmailTemplate("password_reset");
    if (template.isActive === false) {
      template = null;
    }
  } catch (err) {
    console.warn("⚠️ [password-reset] could not load template:", err);
  }

  const subject = applyVars(
    template?.subject || "Reset your {{platformName}} password",
    vars,
  );
  const fromName = applyVars(
    template?.fromName || "{{platformName}}",
    vars,
  );
  const headingText = applyVars(
    template?.headingText || "Reset your password",
    vars,
  );
  const introText = applyVars(
    template?.introText ||
      "Hi {{name}}, we received a request to reset your password. Click the button below to choose a new one.",
    vars,
  );
  const featureListLabel = applyVars(
    template?.featureListLabel || "Security tips",
    vars,
  );
  const featureItems = (template?.featureItems?.length
    ? template.featureItems
    : [
        "This link expires in {{expiryHours}} hours",
        "If you did not request a reset, you can ignore this email",
        "Never share this link with anyone",
      ]
  ).map((item) => applyVars(item, vars));
  const closingText = applyVars(
    template?.closingText ||
      "If the button does not work, copy and paste this link into your browser: {{resetLink}}",
    vars,
  );
  const ctaButtonText = applyVars(
    template?.ctaButtonText || "Reset Password",
    vars,
  );

  const featureHtml = featureItems
    .map(
      (item) =>
        `<li style="color:#a0a0a0;font-size:15px;line-height:1.6;margin:0 0 8px;">${escapeHtml(item)}</li>`,
    )
    .join("");

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background-color:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0a0a0a;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color:#1a1a1a;border-radius:16px;overflow:hidden;">
          <tr>
            <td style="padding:40px 40px 20px;text-align:center;">
              <h1 style="color:#f5c518;margin:0;font-size:28px;font-weight:bold;">${escapeHtml(platformName)}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 40px;">
              <h2 style="color:#ffffff;margin:0 0 20px;font-size:24px;">${escapeHtml(headingText)}</h2>
              <p style="color:#a0a0a0;font-size:16px;line-height:1.6;margin:0 0 24px;">
                ${escapeHtml(introText)}
              </p>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding:12px 0 28px;">
                    <a href="${escapeHtml(resetLink)}"
                       style="display:inline-block;background-color:#f5c518;color:#000000;text-decoration:none;padding:16px 40px;border-radius:8px;font-weight:bold;font-size:16px;">
                      ${escapeHtml(ctaButtonText)}
                    </a>
                  </td>
                </tr>
              </table>
              ${
                featureListLabel
                  ? `<p style="color:#ffffff;font-size:15px;font-weight:600;margin:0 0 10px;">${escapeHtml(featureListLabel)}</p>`
                  : ""
              }
              <ul style="padding-left:20px;margin:0 0 24px;">${featureHtml}</ul>
              <p style="color:#7a7a7a;font-size:13px;line-height:1.6;margin:0;word-break:break-all;">
                ${escapeHtml(closingText)}
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 40px 36px;text-align:center;border-top:1px solid #2a2a2a;">
              <p style="color:#555;font-size:12px;margin:0;">
                ${escapeHtml(companyAddress || platformName)}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = [
    headingText,
    "",
    introText,
    "",
    `${ctaButtonText}: ${resetLink}`,
    "",
    ...featureItems.map((item) => `• ${item}`),
    "",
    closingText,
  ].join("\n");

  const transporter = await getTransporter();
  await transporter.sendMail({
    from: `"${fromName}" <${fromAddress}>`,
    to: email,
    subject,
    text,
    html,
  });
}

/** Admin Email Templates → Send Test. */
export async function sendTestPasswordResetEmail(
  testEmail: string,
): Promise<void> {
  const baseUrl =
    process.env.NEXT_PUBLIC_BASE_URL ||
    process.env.BETTER_AUTH_URL ||
    "http://localhost:3000";
  await sendPasswordResetEmail({
    email: testEmail,
    name: "Test User",
    resetLink: `${baseUrl}/reset-password?token=TEST_TOKEN_DO_NOT_USE`,
    expiryHours: DEFAULT_EXPIRY_HOURS,
  });
}
