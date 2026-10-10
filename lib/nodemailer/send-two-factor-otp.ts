import { getTransporter } from "./index";
import { getSettings } from "@/lib/services/settings.service";
import { getEmailTemplate } from "@/database/models/email-template.model";
import { escapeHtml, renderChartVoltEmail, EMAIL_THEME } from "./chartvolt-email-layout";
import { getEmailBrand } from "./email-brand";

interface SendTwoFactorOTPArgs {
  email: string;
  name?: string;
  otp: string;
  // Minutes the code is valid — defaults to 3 (better-auth default ttl).
  ttlMinutes?: number;
}

function applyVars(text: string, vars: Record<string, string>): string {
  let out = text;
  for (const [key, value] of Object.entries(vars)) {
    out = out.split(key).join(value);
  }
  return out;
}

/**
 * Sends a one-time verification code to the user's email.
 * Used by better-auth's twoFactor plugin as the email fallback channel
 * when a user chooses "email" as their second factor.
 *
 * Wording comes from the editable `two_factor_otp` EmailTemplate; the code
 * itself is always rendered by this function so an edited template can never
 * drop it.
 */
export async function sendTwoFactorOTP({
  email,
  name,
  otp,
  ttlMinutes = 3,
}: SendTwoFactorOTPArgs): Promise<void> {
  let fromAddress = process.env.NODEMAILER_EMAIL || "noreply@chartvolt.com";
  const brand = await getEmailBrand();
  const platformName = brand.platformName;

  try {
    const settings = await getSettings();
    if (settings?.nodemailerEmail) fromAddress = settings.nodemailerEmail;
  } catch {
    // Fall back to defaults — never block 2FA email on settings errors.
  }

  // Reason: a template read failure must never stop a sign-in code going out.
  let template: Awaited<ReturnType<typeof getEmailTemplate>> | null = null;
  try {
    template = await getEmailTemplate("two_factor_otp");
    if (template.isActive === false) template = null;
  } catch (err) {
    console.warn("⚠️ [2FA email] could not load template:", err);
  }

  const vars: Record<string, string> = {
    "{{name}}": (name || "").trim() || "there",
    "{{platformName}}": platformName,
    "{{ttlMinutes}}": String(ttlMinutes),
    "{{otp}}": otp,
  };
  const subject = applyVars(template?.subject || "Your {{platformName}} verification code", vars);
  const fromName = applyVars(template?.fromName || "{{platformName}} Security", vars);
  const heading = applyVars(template?.headingText || "Your verification code", vars);
  const intro = applyVars(
    template?.introText || "Hi {{name}}, use the code below to finish signing in to {{platformName}}.",
    vars,
  );
  const tipsTitle = applyVars(template?.featureListLabel || "Keep your account safe", vars);
  const tips = (template?.featureItems?.length
    ? template.featureItems
    : [
        "This code expires in {{ttlMinutes}} minutes",
        "{{platformName}} staff will never ask you for this code",
        "If you did not try to sign in, change your password now",
      ]
  ).map((item) => applyVars(item, vars));

  const codeHtml = `<div style="margin:24px 0 8px;padding:18px;text-align:center;background-color:${EMAIL_THEME.panel};border:1px dashed ${EMAIL_THEME.border};border-radius:10px;font-family:'Courier New',monospace;font-size:32px;font-weight:700;letter-spacing:8px;color:${EMAIL_THEME.gold};">${escapeHtml(otp)}</div>`;

  const html = renderChartVoltEmail({
    title: subject,
    platformName,
    logoUrl: brand.logoUrl,
    preheader: `Your code is ${otp}`,
    eyebrow: "Account security",
    heading: escapeHtml(heading),
    bodyHtml: `<p style="margin:0;">${escapeHtml(intro)}</p>${codeHtml}`,
    panel: { icon: "&#128274;", title: tipsTitle, lines: tips.map((t) => escapeHtml(t)) },
    closingHtml: template?.closingText ? escapeHtml(applyVars(template.closingText, vars)) : undefined,
    footerAddress: brand.companyAddress,
  });

  const text = [
    heading,
    "",
    intro,
    "",
    `Code: ${otp}`,
    "",
    ...tips.map((t) => `• ${t}`),
    "",
    `— ${platformName} Security`,
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
