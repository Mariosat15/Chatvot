/**
 * Password-reset email — uses the editable `password_reset` EmailTemplate.
 * Called from better-auth's `sendResetPassword` and the admin test-send route.
 */

import { getTransporter } from "./index";
import { getSettings } from "@/lib/services/settings.service";
import { getEmailTemplate } from "@/database/models/email-template.model";
import { connectToDatabase } from "@/database/mongoose";
import { escapeHtml, renderChartVoltEmail } from "./chartvolt-email-layout";
import { getEmailBrand } from "./email-brand";

const DEFAULT_EXPIRY_HOURS = 1;

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

  const brand = await getEmailBrand();
  const html = renderChartVoltEmail({
    title: subject,
    platformName,
    logoUrl: brand.logoUrl,
    preheader: introText,
    eyebrow: "Account security",
    heading: escapeHtml(headingText),
    bodyHtml: `<p style="margin:0;">${escapeHtml(introText)}</p>`,
    cta: { text: ctaButtonText, url: resetLink },
    ctaNote: `This link expires in ${expiryHours} hour${expiryHours === 1 ? "" : "s"}.`,
    showFallbackLink: true,
    panel: {
      icon: "&#128274;",
      title: featureListLabel || "Security tips",
      lines: featureItems.map((item) => escapeHtml(item)),
    },
    closingHtml: closingText.includes(resetLink) ? undefined : escapeHtml(closingText),
    footerAddress: companyAddress || brand.companyAddress,
  });

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
