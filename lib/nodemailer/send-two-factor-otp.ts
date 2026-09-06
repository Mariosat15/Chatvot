import { getTransporter } from "./index";
import { getSettings } from "@/lib/services/settings.service";

interface SendTwoFactorOTPArgs {
  email: string;
  name?: string;
  otp: string;
  // Minutes the code is valid — defaults to 3 (better-auth default ttl).
  ttlMinutes?: number;
}

/**
 * Sends a one-time TOTP verification code to the user's email.
 * Used by better-auth's twoFactor plugin as the email fallback channel
 * when a user chooses "email" as their second factor.
 *
 * Kept intentionally small and self-contained so it can run without the
 * full `lib/nodemailer/index.ts` template stack loading.
 */
export async function sendTwoFactorOTP({
  email,
  name,
  otp,
  ttlMinutes = 3,
}: SendTwoFactorOTPArgs): Promise<void> {
  let fromAddress = process.env.NODEMAILER_EMAIL || "noreply@chartvolt.com";
  let platformName = "ChartVolt";

  try {
    const settings = await getSettings();
    if (settings?.nodemailerEmail) fromAddress = settings.nodemailerEmail;
    // Reason: Keep the platform name consistent with branding if configured.
    if ((settings as { platformName?: string })?.platformName) {
      platformName =
        (settings as { platformName?: string }).platformName || platformName;
    }
  } catch {
    // Fall back to defaults — never block 2FA email on settings errors.
  }

  const safeName = (name || "").trim() || "there";
  const subject = `Your ${platformName} verification code`;

  const text = [
    `Hi ${safeName},`,
    "",
    `Your ${platformName} verification code is: ${otp}`,
    "",
    `This code expires in ${ttlMinutes} minute${ttlMinutes === 1 ? "" : "s"}.`,
    "",
    "If you did not request this code, someone may be trying to access your account — please change your password and contact support immediately.",
    "",
    `— ${platformName} Security`,
  ].join("\n");

  const html = `<!doctype html>
<html>
<body style="margin:0;padding:24px;background:#0b1020;font-family:Inter,Arial,sans-serif;color:#e6e9ef;">
  <div style="max-width:520px;margin:0 auto;background:#111629;border:1px solid #2a3349;border-radius:12px;padding:28px;">
    <h1 style="margin:0 0 12px 0;font-size:20px;color:#ffffff;">${platformName} verification code</h1>
    <p style="margin:0 0 18px 0;color:#cbd3df;line-height:1.5;">
      Hi ${safeName}, use the code below to finish signing in.
    </p>
    <div style="font-size:30px;font-weight:700;letter-spacing:6px;text-align:center;padding:18px;background:#0b1020;border:1px dashed #3a4566;border-radius:8px;color:#ffffff;">
      ${otp}
    </div>
    <p style="margin:18px 0 0 0;color:#9aa3b2;font-size:13px;line-height:1.5;">
      This code expires in ${ttlMinutes} minute${ttlMinutes === 1 ? "" : "s"}.
      If you did not request it, please change your password and contact support.
    </p>
  </div>
</body>
</html>`;

  const transporter = await getTransporter();
  await transporter.sendMail({
    from: `"${platformName} Security" <${fromAddress}>`,
    to: email,
    subject,
    text,
    html,
  });
}
