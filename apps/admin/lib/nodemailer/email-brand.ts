/**
 * Branding facts every email needs: platform name, logo, base URL, company
 * address and the platform-wide disclaimer. MIRRORED byte-for-byte into
 * `apps/admin/lib/nodemailer/email-brand.ts`.
 *
 * Reason: each sender used to rebuild these from three models on its own,
 * which is how the logo, address and wording drifted between emails.
 */
import { connectToDatabase } from "@/database/mongoose";
import { WhiteLabel } from "@/database/models/whitelabel.model";
import CompanySettings, {
  COUNTRY_NAMES,
} from "@/database/models/company-settings.model";
import { getSettings } from "@/lib/services/settings.service";
import type { Transporter } from "nodemailer";
import {
  DEFAULT_EMAIL_DISCLAIMER,
  finalizeEmailHtml,
} from "./chartvolt-email-layout";

export interface EmailBrand {
  platformName: string;
  baseUrl: string;
  logoUrl: string;
  companyAddress: string;
  /** `null` when an operator switched the disclaimer off. */
  disclaimer: string | null;
}

const CACHE_MS = 60_000;
let cached: { at: number; brand: EmailBrand } | null = null;

export function emailBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_BASE_URL ||
    process.env.BETTER_AUTH_URL ||
    "http://localhost:3000"
  );
}

/** Absolute URL for a stored asset path; email clients cannot follow `/x`. */
export function absoluteEmailUrl(path: string, baseUrl = emailBaseUrl()): string {
  if (!path) return "";
  return /^https?:\/\//i.test(path) ? path : `${baseUrl}${path.startsWith("/") ? "" : "/"}${path}`;
}

/**
 * Resolve the disclaimer from the stored pair. Empty text means the built-in
 * default; `showEmailDisclaimer === false` is the only way to switch it off.
 */
export function resolveEmailDisclaimer(
  text: string | null | undefined,
  show: boolean | null | undefined,
): string | null {
  if (show === false) return null;
  const trimmed = (text ?? "").trim();
  return trimmed || DEFAULT_EMAIL_DISCLAIMER;
}

export async function getEmailBrand(): Promise<EmailBrand> {
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.brand;
  const baseUrl = emailBaseUrl();
  try {
    await connectToDatabase();
    const [whiteLabel, company, settings] = await Promise.all([
      WhiteLabel.findOne()
        .select("emailLogo emailDisclaimer showEmailDisclaimer")
        .lean<{ emailLogo?: string; emailDisclaimer?: string; showEmailDisclaimer?: boolean }>(),
      CompanySettings.getSingleton(),
      getSettings(),
    ]);
    const addressParts = [
      company?.addressLine1,
      company?.addressLine2,
      company?.city,
      company?.postalCode,
      company?.country ? COUNTRY_NAMES[company.country] || company.country : "",
    ].filter(Boolean);
    const brand: EmailBrand = {
      platformName: settings?.appName || company?.companyName || "ChartVolt",
      baseUrl,
      logoUrl: absoluteEmailUrl(whiteLabel?.emailLogo || "/assets/images/logo.png", baseUrl),
      companyAddress: addressParts.join(", "),
      disclaimer: resolveEmailDisclaimer(whiteLabel?.emailDisclaimer, whiteLabel?.showEmailDisclaimer),
    };
    cached = { at: Date.now(), brand };
    return brand;
  } catch (error) {
    console.warn("⚠️ [EMAIL] Could not load email branding, using defaults:", error);
    return {
      platformName: "ChartVolt",
      baseUrl,
      logoUrl: absoluteEmailUrl("/assets/images/logo.png", baseUrl),
      companyAddress: "",
      disclaimer: DEFAULT_EMAIL_DISCLAIMER,
    };
  }
}

/**
 * Register the final pass on a transporter: every HTML email it sends gets the
 * dark `color-scheme` hint and the platform disclaimer.
 *
 * Reason: this is the single door shared by all senders (templates, operator
 * custom HTML, notification bridge, password reset, 2FA), so the disclaimer is
 * guaranteed rather than remembered per template. It fails open - a branding
 * read failure must never stop a receipt or a reset link going out.
 */
export async function applyEmailFinalizer<T extends Transporter>(transport: T): Promise<T> {
  const brand = await getEmailBrand();
  transport.use("compile", (mail, done) => {
    try {
      const html = mail.data.html;
      if (typeof html === "string") {
        mail.data.html = finalizeEmailHtml(html, brand.disclaimer);
      }
    } catch (error) {
      console.warn("⚠️ [EMAIL] Could not finalize email HTML, sending as-is:", error);
    }
    done();
  });
  return transport;
}

/** Drop the cache after an operator edits the disclaimer or logo. */
export function clearEmailBrandCache(): void {
  cached = null;
}
