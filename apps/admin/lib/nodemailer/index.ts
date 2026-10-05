import nodemailer from "nodemailer";
import { applyEmailFinalizer } from "./email-brand";
import { escapeHtml, renderChartVoltEmail } from "./chartvolt-email-layout";
import {
  INVOICE_EMAIL_TEMPLATE,
} from "@/lib/nodemailer/templates";
import { connectToDatabase } from "@/database/mongoose";
import { WhiteLabel } from "@/database/models/whitelabel.model";
import { getSettings } from "@/lib/services/settings.service";
import { mayEmailAddress } from "@/lib/services/email-preferences";
import InvoiceSettings from "@/database/models/invoice-settings.model";
import CompanySettings, {
  COUNTRY_NAMES,
} from "@/database/models/company-settings.model";
import Invoice from "@/database/models/invoice.model";
import {
  getEmailTemplate,
  IEmailTemplate,
} from "@/database/models/email-template.model";

interface WelcomeEmailData {
  email: string;
  name: string;
  intro: string;
}

/**
 * Get email transporter with credentials from database
 * Falls back to environment variables if database is unavailable
 */
export async function getTransporter() {
  try {
    const settings = await getSettings();

    return applyEmailFinalizer(nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: settings.nodemailerEmail || process.env.NODEMAILER_EMAIL!,
        pass: settings.nodemailerPassword || process.env.NODEMAILER_PASSWORD!,
      },
    }));
  } catch (error) {
    console.error(
      "⚠️ Error getting email settings from database, using environment variables:",
      error,
    );
    // Fallback to environment variables
    return applyEmailFinalizer(nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.NODEMAILER_EMAIL!,
        pass: process.env.NODEMAILER_PASSWORD!,
      },
    }));
  }
}

// Legacy export for backward compatibility (deprecated - use getTransporter() instead)
export const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.NODEMAILER_EMAIL || "default@example.com",
    pass: process.env.NODEMAILER_PASSWORD || "default",
  },
});

/**
 * Get welcome email configuration from database
 */
async function getWelcomeEmailConfig() {
  await connectToDatabase();

  // Get all necessary settings in parallel
  const [emailTemplate, companySettings, whiteLabelSettings, settings] =
    await Promise.all([
      getEmailTemplate("welcome"),
      CompanySettings.getSingleton(),
      WhiteLabel.findOne(),
      getSettings(),
    ]);

  const baseUrl =
    process.env.NEXT_PUBLIC_BASE_URL ||
    process.env.BETTER_AUTH_URL ||
    "http://localhost:3000";
  const platformName =
    settings.appName || companySettings.companyName || "Chatvolt";
  const isLocalhost =
    baseUrl.includes("localhost") || baseUrl.includes("127.0.0.1");

  // Get logo URLs - use placeholders if localhost (email clients can't access localhost)
  let logoUrl = whiteLabelSettings?.emailLogo || "/assets/images/logo.png";
  let dashboardUrl =
    whiteLabelSettings?.dashboardPreview ||
    "/assets/images/dashboard-preview.png";

  // If the URL is already a full URL (CDN, etc.), use it
  // Otherwise, prepend the base URL (or use placeholder if localhost)
  if (!logoUrl.startsWith("http")) {
    if (isLocalhost) {
      // Use placeholder for testing - replace with your production URL or CDN
      logoUrl = "https://placehold.co/150x50/141414/FDD458?text=Logo";
    } else {
      logoUrl = `${baseUrl}${logoUrl}`;
    }
  }
  if (!dashboardUrl.startsWith("http")) {
    if (isLocalhost) {
      // Use placeholder for testing
      dashboardUrl =
        "https://placehold.co/520x300/141414/FDD458?text=Dashboard+Preview";
    } else {
      dashboardUrl = `${baseUrl}${dashboardUrl}`;
    }
  }

  // Build company address from flat fields
  let companyAddress = "";
  if (companySettings.addressLine1 || companySettings.city) {
    const parts = [
      companySettings.addressLine1,
      companySettings.addressLine2,
      companySettings.city,
      companySettings.postalCode,
      COUNTRY_NAMES[companySettings.country] || companySettings.country,
    ].filter(Boolean);
    companyAddress = parts.join(", ");
  }

  return {
    template: emailTemplate,
    platformName,
    baseUrl,
    logoUrl,
    dashboardPreviewUrl: dashboardUrl,
    companyAddress,
    companyEmail: companySettings.email || settings.nodemailerEmail || "",
    settings,
  };
}

/**
 * Build welcome email HTML from database template
 */
function buildWelcomeEmailHtml(
  template: IEmailTemplate,
  config: {
    name: string;
    intro: string;
    platformName: string;
    baseUrl: string;
    logoUrl: string;
    dashboardPreviewUrl: string;
    companyAddress: string;
  },
): string {
  // If using custom HTML template
  if (template.useCustomHtml && template.customHtmlTemplate) {
    return template.customHtmlTemplate
      .replace(/\{\{name\}\}/g, config.name)
      .replace(/\{\{intro\}\}/g, config.intro)
      .replace(/\{\{platformName\}\}/g, config.platformName)
      .replace(/\{\{baseUrl\}\}/g, config.baseUrl)
      .replace(/\{\{logoUrl\}\}/g, config.logoUrl)
      .replace(/\{\{dashboardPreviewUrl\}\}/g, config.dashboardPreviewUrl)
      .replace(/\{\{companyAddress\}\}/g, config.companyAddress);
  }

  // Build feature list HTML
  const featureItems = template.featureItems || [
    "Set up your watchlist to follow your favorite stocks",
    "Create price and volume alerts so you never miss a move",
    "Explore the dashboard for trends and the latest market news",
  ];


  // Get the CTA URL
  let ctaUrl = template.ctaButtonUrl || config.baseUrl;
  ctaUrl = ctaUrl.replace(/\{\{baseUrl\}\}/g, config.baseUrl);

  // Get footer links
  const unsubscribeUrl = template.footerLinks?.unsubscribeUrl || "#";
  let websiteUrl = template.footerLinks?.websiteUrl || config.baseUrl;
  websiteUrl = websiteUrl.replace(/\{\{baseUrl\}\}/g, config.baseUrl);

  // Get footer address
  let footerAddress = template.footerAddress || config.companyAddress;
  footerAddress = footerAddress.replace(
    /\{\{companyAddress\}\}/g,
    config.companyAddress,
  );

  // Build the heading
  const heading = (template.headingText || "Welcome aboard {{name}}").replace(
    /\{\{name\}\}/g,
    config.name,
  );

  // Build the dynamic template
  return renderChartVoltEmail({
    title: `Welcome to ${config.platformName}`,
    platformName: config.platformName,
    logoUrl: config.logoUrl,
    eyebrow: "Welcome",
    heading,
    bodyHtml: config.intro,
    listTitle: template.featureListLabel || "Here's what you can do right now:",
    listItems: featureItems,
    closingHtml:
      template.closingText ||
      "We'll keep you informed with timely updates, insights and alerts, so you can focus on making the right calls.",
    cta: { text: template.ctaButtonText || "Go to Dashboard", url: ctaUrl },
    footerAddress,
    footerLinks: [
      { label: "Unsubscribe", url: unsubscribeUrl === "#" ? "" : unsubscribeUrl },
      { label: `Visit ${config.platformName}`, url: websiteUrl },
    ],
  });
}

export const sendWelcomeEmail = async ({
  email,
  name,
  intro,
}: WelcomeEmailData) => {
  // Get welcome email configuration from database
  const config = await getWelcomeEmailConfig();
  const {
    template,
    platformName,
    baseUrl,
    logoUrl,
    dashboardPreviewUrl,
    companyAddress,
    settings,
  } = config;

  console.log("📧 Sending welcome email:");
  console.log("   - To:", email);
  console.log("   - Platform:", platformName);
  console.log("   - Logo:", logoUrl);
  console.log("   - Using AI:", template.useAIPersonalization);

  // Format intro as HTML paragraph if it's plain text
  const introHtml = intro.startsWith("<")
    ? intro
    : `<p class="mobile-text" style="margin: 0 0 30px 0; font-size: 16px; line-height: 1.6; color: #CCDADC;">${intro}</p>`;

  // Build HTML from database template
  const htmlTemplate = buildWelcomeEmailHtml(template, {
    name,
    intro: introHtml,
    platformName,
    baseUrl,
    logoUrl,
    dashboardPreviewUrl,
    companyAddress,
  });

  // Replace variables in subject
  let subject =
    template.subject ||
    "Welcome to {{platformName}} - your Asset market toolkit is ready!";
  subject = subject
    .replace(/\{\{platformName\}\}/g, platformName)
    .replace(/\{\{name\}\}/g, name);

  // Replace variables in fromName
  let fromName = template.fromName || platformName;
  fromName = fromName.replace(/\{\{platformName\}\}/g, platformName);

  const mailOptions = {
    from: `"${fromName}" <${settings.nodemailerEmail || process.env.NODEMAILER_EMAIL}>`,
    to: email,
    subject,
    text: `Welcome to ${platformName}, ${name}! ${template.introText || "Thanks for joining us."}`,
    html: htmlTemplate,
  };

  // Get transporter with database credentials
  const emailTransporter = await getTransporter();
  await emailTransporter.sendMail(mailOptions);

  console.log(`✅ Welcome email sent to ${email}`);
};

/**
 * Send a test welcome email (for admin preview)
 */
export const sendTestWelcomeEmail = async (testEmail: string) => {
  const config = await getWelcomeEmailConfig();
  const {
    template,
    platformName,
    baseUrl,
    logoUrl,
    dashboardPreviewUrl,
    companyAddress,
    settings,
  } = config;

  // Use default intro or template intro for test
  const testIntro = `<p class="mobile-text" style="margin: 0 0 30px 0; font-size: 16px; line-height: 1.6; color: #CCDADC;">${template.introText || "Thanks for joining! You now have access to our trading competition platform where you can compete against other traders and win real prizes."}</p>`;

  // Build HTML from database template
  const htmlTemplate = buildWelcomeEmailHtml(template, {
    name: "Test User",
    intro: testIntro,
    platformName,
    baseUrl,
    logoUrl,
    dashboardPreviewUrl,
    companyAddress,
  });

  // Replace variables in subject
  let subject = `[TEST] ${template.subject || "Welcome to {{platformName}}"}`;
  subject = subject
    .replace(/\{\{platformName\}\}/g, platformName)
    .replace(/\{\{name\}\}/g, "Test User");

  // Replace variables in fromName
  let fromName = template.fromName || platformName;
  fromName = fromName.replace(/\{\{platformName\}\}/g, platformName);

  const mailOptions = {
    from: `"${fromName}" <${settings.nodemailerEmail || process.env.NODEMAILER_EMAIL}>`,
    to: testEmail,
    subject,
    text: `[TEST] Welcome to ${platformName}! This is a test email.`,
    html: htmlTemplate,
  };

  const emailTransporter = await getTransporter();
  await emailTransporter.sendMail(mailOptions);

  console.log(`✅ Test welcome email sent to ${testEmail}`);
};

interface InvoiceEmailData {
  invoiceId: string;
  customerEmail: string;
  customerName: string;
}

/**
 * Send invoice email to customer after purchase
 */
export const sendInvoiceEmail = async ({
  invoiceId,
  customerEmail,
  customerName,
}: InvoiceEmailData) => {
  await connectToDatabase();

  // A receipt the player has asked us to stop sending. See `mayEmailAddress`.
  if (!(await mayEmailAddress(customerEmail, "transactional"))) {
    console.log(
      `ℹ️ [INVOICE] Recipient has transactional emails off, skipping ${customerEmail}`,
    );
    return;
  }

  // Get invoice
  const invoice = await Invoice.findById(invoiceId);
  if (!invoice) {
    throw new Error(`Invoice not found: ${invoiceId}`);
  }

  // Get settings
  const [invoiceSettings, companySettings, settings] = await Promise.all([
    InvoiceSettings.getSingleton(),
    CompanySettings.getSingleton(),
    getSettings(),
  ]);

  // Get logo URL
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
  let logoUrl =
    companySettings.logoUrl || settings.appLogo || "/assets/images/logo.png";
  if (!logoUrl.startsWith("http")) {
    logoUrl = `${baseUrl}${logoUrl}`;
  }

  // Format currency
  const formatCurrency = (amount: number) => {
    const symbol = invoiceSettings.currencySymbol || "€";
    const formatted = amount.toFixed(2);
    return invoiceSettings.currencyPosition === "after"
      ? `${formatted}${symbol}`
      : `${symbol}${formatted}`;
  };

  // Format date
  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString("en-GB", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  // Build line items HTML
  const lineItemsHtml = invoice.lineItems
    .map(
      (item) => `
        <tr>
            <td style="padding: 12px 0; color: #ffffff;">${item.description}</td>
            <td style="padding: 12px 0; text-align: right; color: #9ca3af;">${formatCurrency(item.total)}</td>
        </tr>
    `,
    )
    .join("");

  // Build VAT row HTML
  const vatRowHtml =
    invoice.vatRate > 0
      ? `
        <tr>
            <td style="padding: 12px 0; color: #9ca3af;">${invoiceSettings.vatLabel || "VAT"} (${invoice.vatRate}%)</td>
            <td style="padding: 12px 0; text-align: right; color: #9ca3af;">${formatCurrency(invoice.vatAmount)}</td>
        </tr>
    `
      : "";

  // Build company address
  const companyCountryName =
    COUNTRY_NAMES[invoice.companyAddress.country] ||
    invoice.companyAddress.country;
  const companyAddress = [
    invoice.companyAddress.line1,
    invoice.companyAddress.line2,
    `${invoice.companyAddress.city}, ${invoice.companyAddress.postalCode}`,
    companyCountryName,
  ]
    .filter(Boolean)
    .join("<br>");

  // Build VAT info
  const vatInfo = invoice.companyVatNumber
    ? `VAT: ${invoice.companyVatNumber}`
    : "";

  // Prepare email subject
  let emailSubject =
    invoiceSettings.invoiceEmailSubject ||
    "Your Invoice from {{companyName}} - {{invoiceNumber}}";
  emailSubject = emailSubject
    .replace(/\{\{companyName\}\}/g, companySettings.companyName)
    .replace(/\{\{invoiceNumber\}\}/g, invoice.invoiceNumber);

  // Prepare email body text
  let emailBody =
    invoiceSettings.invoiceEmailBody ||
    "Thank you for your purchase! Please find your invoice attached.";
  emailBody = emailBody
    .replace(/\{\{companyName\}\}/g, companySettings.companyName)
    .replace(/\{\{customerName\}\}/g, customerName)
    .replace(/\{\{invoiceNumber\}\}/g, invoice.invoiceNumber);

  // Format legal disclaimer for email
  const showLegalDisclaimer = invoiceSettings.showLegalDisclaimer !== false;
  let legalDisclaimerHtml = "";

  if (showLegalDisclaimer && invoiceSettings.legalDisclaimer) {
    // Replace variables in disclaimer
    let disclaimer = invoiceSettings.legalDisclaimer
      .replace(/\{\{companyName\}\}/g, companySettings.companyName)
      .replace(
        /\{\{companyEmail\}\}/g,
        invoice.companyEmail || companySettings.email,
      )
      .replace(/\{\{vatNumber\}\}/g, invoice.companyVatNumber || "");

    // Convert markdown bold (**text**) to HTML strong with email styling
    disclaimer = disclaimer.replace(
      /\*\*([^*]+)\*\*/g,
      '<strong style="color: #9ca3af;">$1</strong>',
    );

    // Convert double newlines to paragraph breaks with email styling
    const paragraphs = disclaimer.split(/\n\n+/);
    legalDisclaimerHtml = paragraphs
      .map((p) => `<p style="margin: 0 0 10px 0;">${p.trim()}</p>`)
      .join("\n                                ");
  }

  // Build HTML template for email
  let htmlTemplate = INVOICE_EMAIL_TEMPLATE.replace(/\{\{logoUrl\}\}/g, logoUrl)
    .replace(/\{\{companyName\}\}/g, companySettings.companyName)
    .replace(/\{\{invoiceNumber\}\}/g, invoice.invoiceNumber)
    .replace(/\{\{invoiceDate\}\}/g, formatDate(invoice.invoiceDate))
    .replace(/\{\{customerName\}\}/g, customerName)
    .replace(/\{\{emailBody\}\}/g, emailBody.replace(/\n/g, "<br>"))
    .replace(/\{\{lineItemsHtml\}\}/g, lineItemsHtml)
    .replace(/\{\{subtotal\}\}/g, formatCurrency(invoice.subtotal))
    .replace(/\{\{vatRowHtml\}\}/g, vatRowHtml)
    .replace(/\{\{total\}\}/g, formatCurrency(invoice.total))
    .replace(/\{\{dashboardUrl\}\}/g, `${baseUrl}/wallet`)
    .replace(/\{\{companyAddress\}\}/g, companyAddress)
    .replace(/\{\{companyEmail\}\}/g, invoice.companyEmail)
    .replace(/\{\{vatInfo\}\}/g, vatInfo)
    .replace(/\{\{year\}\}/g, new Date().getFullYear().toString())
    .replace(/\{\{websiteUrl\}\}/g, companySettings.website || baseUrl)
    .replace(/\{\{\{legalDisclaimerHtml\}\}\}/g, legalDisclaimerHtml);

  // Handle conditional showLegalDisclaimer block
  if (showLegalDisclaimer) {
    htmlTemplate = htmlTemplate
      .replace(/\{\{#if showLegalDisclaimer\}\}/g, "")
      .replace(/\{\{\/if\}\}/g, "");
  } else {
    // Remove the entire disclaimer section if disabled
    htmlTemplate = htmlTemplate.replace(
      /\{\{#if showLegalDisclaimer\}\}[\s\S]*?\{\{\/if\}\}/g,
      "",
    );
  }

  // Generate PDF invoice using PDFKit (no browser required!)
  let pdfAttachment = null;
  console.log(
    `📄 [INVOICE] Starting PDF generation for ${invoice.invoiceNumber}...`,
  );

  try {
    const { generateInvoicePDF } =
      await import("@/lib/services/pdf-generator.service");

    // Prepare invoice data for PDF generation
    const pdfInvoiceData = {
      invoiceNumber: invoice.invoiceNumber,
      invoiceDate: invoice.invoiceDate,
      status: invoice.status,

      companyName: invoice.companyName,
      companyAddress: invoice.companyAddress,
      companyEmail: invoice.companyEmail,
      companyVatNumber: invoice.companyVatNumber,

      customerName: invoice.customerName,
      customerEmail: invoice.customerEmail,
      customerAddress: invoice.customerAddress,

      lineItems: invoice.lineItems,
      subtotal: invoice.subtotal,
      vatRate: invoice.vatRate,
      vatAmount: invoice.vatAmount,
      total: invoice.total,
      currency: invoice.currency,

      primaryColor: invoiceSettings.primaryColor,
      showBankDetails: invoiceSettings.showBankDetails,
      bankName: companySettings.bankName,
      bankIban: companySettings.bankIban,
      bankSwift: companySettings.bankSwift,
      paymentTerms: invoiceSettings.paymentTerms,
      thankYouMessage: invoiceSettings.thankYouMessage,
      legalDisclaimer: invoiceSettings.legalDisclaimer,
      showLegalDisclaimer: invoiceSettings.showLegalDisclaimer,
    };

    console.log(`📄 [INVOICE] Generating PDF with PDFKit...`);
    const { buffer, filename } = await generateInvoicePDF(pdfInvoiceData);

    pdfAttachment = {
      filename,
      content: buffer,
      contentType: "application/pdf",
    };

    console.log(
      `✅ [INVOICE] PDF generated successfully: ${filename} (${(buffer.length / 1024).toFixed(2)} KB)`,
    );
  } catch (pdfError) {
    const pdfErr = pdfError as Error | undefined;
    console.error("❌ [INVOICE] Failed to generate PDF:");
    console.error("   Error name:", pdfErr?.name);
    console.error("   Error message:", pdfErr?.message);
    console.error("   Error stack:", pdfErr?.stack?.substring(0, 500));
    console.log("⚠️ [INVOICE] Will send email WITHOUT PDF attachment");
    // Continue without PDF attachment if generation fails
  }

  const mailOptions: nodemailer.SendMailOptions = {
    from: `"${companySettings.companyName}" <${settings.nodemailerEmail || process.env.NODEMAILER_EMAIL}>`,
    to: customerEmail,
    subject: emailSubject,
    text: `Invoice ${invoice.invoiceNumber}\n\nTotal: ${formatCurrency(invoice.total)}\n\nPlease find your invoice attached.\n\nThank you for your purchase!`,
    html: htmlTemplate,
  };

  // Add PDF attachment if generated successfully
  if (pdfAttachment) {
    mailOptions.attachments = [pdfAttachment];
  }

  console.log(`📧 [INVOICE] Sending invoice email:`, {
    to: customerEmail,
    invoiceNumber: invoice.invoiceNumber,
    total: formatCurrency(invoice.total),
    hasAttachment: !!pdfAttachment,
  });

  // Get transporter with database credentials
  const emailTransporter = await getTransporter();
  await emailTransporter.sendMail(mailOptions);

  // Update invoice status to sent
  invoice.status = "sent";
  invoice.sentAt = new Date();
  await invoice.save();

  console.log(
    `✅ [INVOICE] Email sent successfully for ${invoice.invoiceNumber}${pdfAttachment ? " with PDF attachment" : ""}`,
  );
};

/**
 * Get deposit/withdrawal email config from database
 */
async function getEmailConfig(
  templateType: "deposit_completed" | "withdrawal_completed" | "refund_completed",
) {
  await connectToDatabase();

  const [template, companySettings, settings, whiteLabelSettings] =
    await Promise.all([
      getEmailTemplate(templateType),
      CompanySettings.getSingleton(),
      getSettings(),
      WhiteLabel.findOne(),
    ]);

  const platformName =
    settings.appName || companySettings.companyName || "Chatvolt";
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
  const isLocalhost =
    baseUrl.includes("localhost") || baseUrl.includes("127.0.0.1");

  // Get logo URL
  let logoUrl = whiteLabelSettings?.emailLogo || "/assets/images/logo.png";
  if (!logoUrl.startsWith("http")) {
    if (isLocalhost) {
      logoUrl = "https://placehold.co/150x50/141414/FDD458?text=Logo";
    } else {
      logoUrl = `${baseUrl}${logoUrl}`;
    }
  }

  // Build company address
  let companyAddress = "";
  if (companySettings.addressLine1 || companySettings.city) {
    const parts = [
      companySettings.addressLine1,
      companySettings.addressLine2,
      companySettings.city,
      companySettings.postalCode,
      COUNTRY_NAMES[companySettings.country] || companySettings.country,
    ].filter(Boolean);
    companyAddress = parts.join(", ");
  }

  return {
    template,
    platformName,
    baseUrl,
    logoUrl,
    companyAddress,
    supportEmail: companySettings.email || settings.nodemailerEmail || "",
    settings,
  };
}

/**
 * Build deposit email HTML from database template
 */
function buildDepositEmailHtml(
  template: IEmailTemplate,
  config: {
    name: string;
    credits: number;
    amount: number;
    paymentMethod: string;
    transactionId: string;
    newBalance: number;
    platformName: string;
    baseUrl: string;
    logoUrl: string;
    companyAddress: string;
  },
): string {
  // If using custom HTML template
  if (template.useCustomHtml && template.customHtmlTemplate) {
    return template.customHtmlTemplate
      .replace(/\{\{name\}\}/g, config.name)
      .replace(/\{\{credits\}\}/g, config.credits.toString())
      .replace(/\{\{amount\}\}/g, config.amount.toFixed(2))
      .replace(/\{\{paymentMethod\}\}/g, config.paymentMethod)
      .replace(/\{\{transactionId\}\}/g, config.transactionId)
      .replace(/\{\{newBalance\}\}/g, config.newBalance.toFixed(0))
      .replace(/\{\{platformName\}\}/g, config.platformName)
      .replace(/\{\{baseUrl\}\}/g, config.baseUrl)
      .replace(/\{\{logoUrl\}\}/g, config.logoUrl)
      .replace(/\{\{companyAddress\}\}/g, config.companyAddress)
      .replace(/\{\{competitionsUrl\}\}/g, `${config.baseUrl}/competitions`)
      .replace(/\{\{year\}\}/g, new Date().getFullYear().toString());
  }

  // Build feature list HTML
  const featureItems = template.featureItems || [
    "Browse active competitions and join one that matches your style",
    "Challenge other traders in head-to-head matches",
    "Climb the leaderboard and win real prizes!",
  ];


  // Get the CTA URL
  let ctaUrl = template.ctaButtonUrl || `${config.baseUrl}/competitions`;
  ctaUrl = ctaUrl.replace(/\{\{baseUrl\}\}/g, config.baseUrl);

  // Build the dynamic template using database values
  return renderChartVoltEmail({
    title: `Deposit Confirmed - ${config.platformName}`,
    platformName: config.platformName,
    logoUrl: config.logoUrl,
    eyebrow: "Wallet",
    heading: template.headingText || "Deposit Successful!",
    subheading: "Your credits are now available",
    greetingName: config.name,
    bodyHtml:
      template.introText ||
      "Great news! Your deposit has been processed successfully and your credits are ready to use.",
    detailsTitle: "Transaction Details",
    details: [
      { label: "Credits Purchased", value: `${config.credits} &#9889;`, tone: "green" },
      { label: "Amount Charged", value: `&euro;${config.amount.toFixed(2)}` },
      { label: "Payment Method", value: escapeHtml(config.paymentMethod) },
      { label: "Transaction ID", value: escapeHtml(config.transactionId), tone: "muted", mono: true },
    ],
    highlight: { label: "Your New Balance", value: `${config.newBalance.toFixed(0)} &#9889;`, tone: "gold" },
    listTitle: template.featureListLabel || "What's Next?",
    listItems: featureItems,
    closingHtml: template.closingText || undefined,
    cta: { text: template.ctaButtonText || "Start Competing Now", url: ctaUrl },
    footerAddress: config.companyAddress,
    footerLinks: [{ label: "Visit Website", url: config.baseUrl }],
  });
}

/**
 * Build withdrawal email HTML from database template
 */
function buildWithdrawalEmailHtml(
  template: IEmailTemplate,
  config: {
    name: string;
    credits: number;
    netAmount: number;
    fee: number;
    paymentMethod: string;
    withdrawalId: string;
    remainingBalance: number;
    timelineMessage: string;
    platformName: string;
    baseUrl: string;
    logoUrl: string;
    companyAddress: string;
    supportEmail: string;
  },
): string {
  // If using custom HTML template
  if (template.useCustomHtml && template.customHtmlTemplate) {
    return template.customHtmlTemplate
      .replace(/\{\{name\}\}/g, config.name)
      .replace(/\{\{credits\}\}/g, config.credits.toString())
      .replace(/\{\{netAmount\}\}/g, config.netAmount.toFixed(2))
      .replace(/\{\{fee\}\}/g, config.fee.toFixed(2))
      .replace(/\{\{paymentMethod\}\}/g, config.paymentMethod)
      .replace(/\{\{withdrawalId\}\}/g, config.withdrawalId)
      .replace(/\{\{remainingBalance\}\}/g, config.remainingBalance.toFixed(0))
      .replace(/\{\{timelineMessage\}\}/g, config.timelineMessage)
      .replace(/\{\{platformName\}\}/g, config.platformName)
      .replace(/\{\{baseUrl\}\}/g, config.baseUrl)
      .replace(/\{\{logoUrl\}\}/g, config.logoUrl)
      .replace(/\{\{companyAddress\}\}/g, config.companyAddress)
      .replace(/\{\{supportEmail\}\}/g, config.supportEmail)
      .replace(/\{\{walletUrl\}\}/g, `${config.baseUrl}/wallet`)
      .replace(/\{\{year\}\}/g, new Date().getFullYear().toString());
  }

  // Build feature list HTML
  const featureItems = template.featureItems || [
    "Check your bank account or card statement for the incoming transfer",
    "Allow 3-5 business days for the funds to appear",
    "Contact support if you haven't received it after 7 days",
  ];


  // Get the CTA URL
  let ctaUrl = template.ctaButtonUrl || `${config.baseUrl}/wallet`;
  ctaUrl = ctaUrl.replace(/\{\{baseUrl\}\}/g, config.baseUrl);

  return renderChartVoltEmail({
    title: `Withdrawal Processed - ${config.platformName}`,
    platformName: config.platformName,
    logoUrl: config.logoUrl,
    eyebrow: "Wallet",
    heading: template.headingText || "Withdrawal Processed",
    subheading: "Your funds are on the way",
    greetingName: config.name,
    bodyHtml:
      template.introText ||
      "Your withdrawal request has been processed and your funds are on the way!",
    detailsTitle: "Withdrawal Details",
    details: [
      { label: "Credits Withdrawn", value: `${config.credits} &#9889;` },
      { label: "Processing Fee", value: `-&euro;${config.fee.toFixed(2)}`, tone: "red" },
      { label: "Amount You Receive", value: `&euro;${config.netAmount.toFixed(2)}`, tone: "green" },
      { label: "Payment Method", value: escapeHtml(config.paymentMethod) },
      { label: "Reference ID", value: escapeHtml(config.withdrawalId), tone: "muted", mono: true },
    ],
    highlight: { label: "Remaining Balance", value: `${config.remainingBalance.toFixed(0)} &#9889;`, tone: "gold" },
    panel: { icon: "&#9201;", title: "When to expect it", lines: [escapeHtml(config.timelineMessage)] },
    listTitle: template.featureListLabel || "What's Next?",
    listItems: featureItems,
    closingHtml: template.closingText || undefined,
    cta: { text: template.ctaButtonText || "View Wallet", url: ctaUrl },
    ctaNote: config.supportEmail
      ? `Questions? Contact us at <a href="mailto:${escapeHtml(config.supportEmail)}" style="color:#00dcff;text-decoration:none;">${escapeHtml(config.supportEmail)}</a>`
      : undefined,
    footerAddress: config.companyAddress,
    footerLinks: [{ label: "Visit Website", url: config.baseUrl }],
  });
}

/**
 * Data for deposit completed email
 */
interface DepositCompletedEmailData {
  email: string;
  name: string;
  credits: number;
  amount: number;
  paymentMethod: string;
  transactionId: string;
  newBalance: number;
}

/**
 * Send deposit completed email to user
 */
export const sendDepositCompletedEmail = async (
  data: DepositCompletedEmailData,
) => {
  try {
    // A receipt the player has asked us to stop sending. See `mayEmailAddress`.
    if (!(await mayEmailAddress(data.email, "transactional"))) {
      console.log(
        `ℹ️ [DEPOSIT] Recipient has transactional emails off, skipping ${data.email}`,
      );
      return;
    }

    const config = await getEmailConfig("deposit_completed");
    const {
      template,
      platformName,
      baseUrl,
      logoUrl,
      companyAddress,
      settings,
    } = config;

    if (!template.isActive) {
      console.log(
        `ℹ️ [DEPOSIT] Email template is disabled, skipping email to ${data.email}`,
      );
      return;
    }

    // Build HTML from database template
    const htmlTemplate = buildDepositEmailHtml(template, {
      name: data.name,
      credits: data.credits,
      amount: data.amount,
      paymentMethod: data.paymentMethod,
      transactionId: data.transactionId,
      newBalance: data.newBalance,
      platformName,
      baseUrl,
      logoUrl,
      companyAddress,
    });

    // Replace variables in subject
    let subject =
      template.subject ||
      "✓ Deposit Confirmed - {{credits}} credits added to your account";
    subject = subject
      .replace(/\{\{credits\}\}/g, data.credits.toString())
      .replace(/\{\{amount\}\}/g, data.amount.toFixed(2))
      .replace(/\{\{platformName\}\}/g, platformName)
      .replace(/\{\{name\}\}/g, data.name);

    const mailOptions = {
      from: `"${platformName}" <${settings.nodemailerEmail || process.env.NODEMAILER_EMAIL}>`,
      to: data.email,
      subject,
      text: `Hi ${data.name}, your deposit of €${data.amount.toFixed(2)} has been processed successfully. ${data.credits} credits have been added to your account. Your new balance is ${data.newBalance} credits.`,
      html: htmlTemplate,
    };

    const emailTransporter = await getTransporter();
    await emailTransporter.sendMail(mailOptions);

    console.log(
      `✅ [DEPOSIT] Email sent to ${data.email} for ${data.credits} credits`,
    );
  } catch (error) {
    console.error("❌ [DEPOSIT] Failed to send deposit email:", error);
  }
};

/**
 * Send a test deposit completed email (for admin preview)
 */
export const sendTestDepositCompletedEmail = async (testEmail: string) => {
  const config = await getEmailConfig("deposit_completed");
  const { template, platformName, baseUrl, logoUrl, companyAddress, settings } =
    config;

  // Build HTML from database template with test data
  const htmlTemplate = buildDepositEmailHtml(template, {
    name: "Test User",
    credits: 100,
    amount: 124.95,
    paymentMethod: "Visa •••• 4242",
    transactionId: "TEST_TXN_123456789",
    newBalance: 250,
    platformName,
    baseUrl,
    logoUrl,
    companyAddress,
  });

  // Replace variables in subject
  let subject = `[TEST] ${template.subject || "✓ Deposit Confirmed - {{credits}} credits added"}`;
  subject = subject
    .replace(/\{\{credits\}\}/g, "100")
    .replace(/\{\{amount\}\}/g, "124.95")
    .replace(/\{\{platformName\}\}/g, platformName)
    .replace(/\{\{name\}\}/g, "Test User");

  const mailOptions = {
    from: `"${platformName}" <${settings.nodemailerEmail || process.env.NODEMAILER_EMAIL}>`,
    to: testEmail,
    subject,
    text: "[TEST] Deposit email preview",
    html: htmlTemplate,
  };

  const emailTransporter = await getTransporter();
  await emailTransporter.sendMail(mailOptions);

  console.log(`✅ [TEST] Deposit email sent to ${testEmail}`);
};

/**
 * Build refund completed email HTML (admin mirror of the main app builder).
 */
function buildRefundEmailHtml(
  template: IEmailTemplate,
  config: {
    name: string;
    refundAmount: number;
    currency: string;
    paymentMethod: string;
    transactionId: string;
    refundId: string;
    platformName: string;
    baseUrl: string;
    logoUrl: string;
    companyAddress: string;
  },
): string {
  const vars: Record<string, string> = {
    name: config.name,
    refundAmount: config.refundAmount.toFixed(2),
    currency: config.currency,
    platformName: config.platformName,
    baseUrl: config.baseUrl,
  };
  const replace = (text: string) => {
    let out = text || "";
    for (const [k, v] of Object.entries(vars)) {
      out = out.split(`{{${k}}}`).join(v);
    }
    return out;
  };
  const features = (template.featureItems || []).map(replace);
  const ctaUrl = replace(template.ctaButtonUrl || `${config.baseUrl}/wallet`);

  const details = [
    {
      label: "Refund Amount",
      value: `${config.currency === "EUR" ? "&euro;" : escapeHtml(config.currency) + " "}${config.refundAmount.toFixed(2)}`,
      tone: "gold" as const,
    },
    { label: "Refunded To", value: escapeHtml(config.paymentMethod) },
    { label: "Original Transaction", value: escapeHtml(config.transactionId), tone: "muted" as const, mono: true },
  ];
  if (config.refundId) {
    details.push({ label: "Refund Reference", value: escapeHtml(config.refundId), tone: "muted" as const, mono: true });
  }
  return renderChartVoltEmail({
    title: `Refund Processed - ${config.platformName}`,
    platformName: config.platformName,
    logoUrl: config.logoUrl,
    eyebrow: "Wallet",
    heading: replace(template.headingText || "Refund Processed"),
    subheading: "Money is on its way back to you",
    greetingName: config.name,
    bodyHtml: replace(template.introText || "Your refund has been processed successfully."),
    detailsTitle: "Refund Details",
    details,
    listTitle: replace(template.featureListLabel || "What happens next?"),
    listItems: features,
    closingHtml: template.closingText ? replace(template.closingText) : undefined,
    cta: { text: replace(template.ctaButtonText || "View Wallet"), url: ctaUrl },
    footerAddress: config.companyAddress,
    footerLinks: [{ label: "Visit Website", url: config.baseUrl }],
  });
}

/**
 * Send refund completed email to user (best-effort — never throws).
 */
export const sendRefundCompletedEmail = async (data: {
  email: string;
  name: string;
  refundAmount: number;
  currency?: string;
  paymentMethod?: string;
  transactionId: string;
  refundId?: string;
}) => {
  try {
    // A receipt the player has asked us to stop sending. See `mayEmailAddress`.
    if (!(await mayEmailAddress(data.email, "transactional"))) {
      console.log(
        `ℹ️ [REFUND] Recipient has transactional emails off, skipping ${data.email}`,
      );
      return;
    }

    const config = await getEmailConfig("refund_completed");
    const {
      template,
      platformName,
      baseUrl,
      logoUrl,
      companyAddress,
      settings,
    } = config;

    if (!template.isActive) {
      console.log(
        `ℹ️ [REFUND] Email template is disabled, skipping email to ${data.email}`,
      );
      return;
    }

    const currency = data.currency || "EUR";
    const htmlTemplate = buildRefundEmailHtml(template, {
      name: data.name,
      refundAmount: data.refundAmount,
      currency,
      paymentMethod: data.paymentMethod || "your original payment method",
      transactionId: data.transactionId,
      refundId: data.refundId || "",
      platformName,
      baseUrl,
      logoUrl,
      companyAddress,
    });

    let subject =
      template.subject || "Your refund of €{{refundAmount}} has been processed";
    subject = subject
      .replace(/\{\{refundAmount\}\}/g, data.refundAmount.toFixed(2))
      .replace(/\{\{platformName\}\}/g, platformName)
      .replace(/\{\{name\}\}/g, data.name);

    const emailTransporter = await getTransporter();
    await emailTransporter.sendMail({
      from: `"${platformName}" <${settings.nodemailerEmail || process.env.NODEMAILER_EMAIL}>`,
      to: data.email,
      subject,
      text: `Hi ${data.name}, your refund of ${currency === "EUR" ? "€" : currency + " "}${data.refundAmount.toFixed(2)} has been processed and will appear on your statement within 3-10 business days.`,
      html: htmlTemplate,
    });

    console.log(
      `✅ [REFUND] Email sent to ${data.email} for €${data.refundAmount.toFixed(2)}`,
    );
  } catch (error) {
    console.error("❌ [REFUND] Failed to send refund email:", error);
  }
};

/**
 * Send a test refund completed email (for admin preview).
 */
export const sendTestRefundCompletedEmail = async (testEmail: string) => {
  await sendRefundCompletedEmail({
    email: testEmail,
    name: "Test User",
    refundAmount: 49.99,
    currency: "EUR",
    paymentMethod: "Visa •••• 4242",
    transactionId: "test_txn_000000000000",
    refundId: "test_refund_123",
  });
};

/**
 * Data for withdrawal completed email
 */
interface WithdrawalCompletedEmailData {
  email: string;
  name: string;
  credits: number;
  netAmount: number;
  fee: number;
  paymentMethod: string;
  withdrawalId: string;
  remainingBalance: number;
}

/**
 * Send withdrawal completed email to user
 */
export const sendWithdrawalCompletedEmail = async (
  data: WithdrawalCompletedEmailData,
) => {
  try {
    // A receipt the player has asked us to stop sending. See `mayEmailAddress`.
    if (!(await mayEmailAddress(data.email, "transactional"))) {
      console.log(
        `ℹ️ [WITHDRAWAL] Recipient has transactional emails off, skipping ${data.email}`,
      );
      return;
    }

    const config = await getEmailConfig("withdrawal_completed");
    const {
      template,
      platformName,
      baseUrl,
      logoUrl,
      companyAddress,
      supportEmail,
      settings,
    } = config;

    if (!template.isActive) {
      console.log(
        `ℹ️ [WITHDRAWAL] Email template is disabled, skipping email to ${data.email}`,
      );
      return;
    }

    // Determine timeline message based on payment method
    let timelineMessage =
      "Funds typically arrive within 3-5 business days, depending on your bank and payment method.";
    if (data.paymentMethod.toLowerCase().includes("card")) {
      timelineMessage =
        "Card refunds typically arrive within 3-5 business days, depending on your card issuer.";
    } else if (
      data.paymentMethod.toLowerCase().includes("bank") ||
      data.paymentMethod.toLowerCase().includes("sepa")
    ) {
      timelineMessage =
        "Bank transfers typically arrive within 3-5 business days, depending on your bank.";
    }

    // Build HTML from database template
    const htmlTemplate = buildWithdrawalEmailHtml(template, {
      name: data.name,
      credits: data.credits,
      netAmount: data.netAmount,
      fee: data.fee,
      paymentMethod: data.paymentMethod,
      withdrawalId: data.withdrawalId,
      remainingBalance: data.remainingBalance,
      timelineMessage,
      platformName,
      baseUrl,
      logoUrl,
      companyAddress,
      supportEmail,
    });

    // Replace variables in subject
    let subject =
      template.subject || "💸 Withdrawal Processed - €{{netAmount}} on the way";
    subject = subject
      .replace(/\{\{netAmount\}\}/g, data.netAmount.toFixed(2))
      .replace(/\{\{credits\}\}/g, data.credits.toString())
      .replace(/\{\{platformName\}\}/g, platformName)
      .replace(/\{\{name\}\}/g, data.name);

    const mailOptions = {
      from: `"${platformName}" <${settings.nodemailerEmail || process.env.NODEMAILER_EMAIL}>`,
      to: data.email,
      subject,
      text: `Hi ${data.name}, your withdrawal of ${data.credits} credits has been processed. €${data.netAmount.toFixed(2)} will be sent to your ${data.paymentMethod}. Your remaining balance is ${data.remainingBalance} credits.`,
      html: htmlTemplate,
    };

    const emailTransporter = await getTransporter();
    await emailTransporter.sendMail(mailOptions);

    console.log(
      `✅ [WITHDRAWAL] Email sent to ${data.email} for €${data.netAmount.toFixed(2)}`,
    );
  } catch (error) {
    console.error("❌ [WITHDRAWAL] Failed to send withdrawal email:", error);
  }
};

/**
 * Send a test withdrawal completed email (for admin preview)
 */
export const sendTestWithdrawalCompletedEmail = async (testEmail: string) => {
  const config = await getEmailConfig("withdrawal_completed");
  const {
    template,
    platformName,
    baseUrl,
    logoUrl,
    companyAddress,
    supportEmail,
    settings,
  } = config;

  // Build HTML from database template with test data
  const htmlTemplate = buildWithdrawalEmailHtml(template, {
    name: "Test User",
    credits: 50,
    netAmount: 49.0,
    fee: 1.0,
    paymentMethod: "Bank Transfer (SEPA)",
    withdrawalId: "TEST_WD_987654321",
    remainingBalance: 150,
    timelineMessage:
      "Bank transfers typically arrive within 3-5 business days, depending on your bank.",
    platformName,
    baseUrl,
    logoUrl,
    companyAddress,
    supportEmail,
  });

  // Replace variables in subject
  let subject = `[TEST] ${template.subject || "💸 Withdrawal Processed - €{{netAmount}} on the way"}`;
  subject = subject
    .replace(/\{\{netAmount\}\}/g, "49.00")
    .replace(/\{\{credits\}\}/g, "50")
    .replace(/\{\{platformName\}\}/g, platformName)
    .replace(/\{\{name\}\}/g, "Test User");

  const mailOptions = {
    from: `"${platformName}" <${settings.nodemailerEmail || process.env.NODEMAILER_EMAIL}>`,
    to: testEmail,
    subject,
    text: "[TEST] Withdrawal email preview",
    html: htmlTemplate,
  };

  const emailTransporter = await getTransporter();
  await emailTransporter.sendMail(mailOptions);

  console.log(`✅ [TEST] Withdrawal email sent to ${testEmail}`);
};

/**
 * Get email verification email config from database
 */
async function getEmailVerificationConfig() {
  await connectToDatabase();

  const [template, companySettings, settings, whiteLabelSettings] =
    await Promise.all([
      getEmailTemplate("email_verification"),
      CompanySettings.getSingleton(),
      getSettings(),
      WhiteLabel.findOne(),
    ]);

  const platformName =
    settings.appName || companySettings.companyName || "Chatvolt";
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
  const isLocalhost =
    baseUrl.includes("localhost") || baseUrl.includes("127.0.0.1");

  // Get logo URL
  let logoUrl = whiteLabelSettings?.emailLogo || "/assets/images/logo.png";
  if (!logoUrl.startsWith("http")) {
    if (isLocalhost) {
      logoUrl = "https://placehold.co/150x50/141414/FDD458?text=Logo";
    } else {
      logoUrl = `${baseUrl}${logoUrl}`;
    }
  }

  // Build company address
  let companyAddress = "";
  if (companySettings.addressLine1 || companySettings.city) {
    const parts = [
      companySettings.addressLine1,
      companySettings.addressLine2,
      companySettings.city,
      companySettings.postalCode,
      COUNTRY_NAMES[companySettings.country] || companySettings.country,
    ].filter(Boolean);
    companyAddress = parts.join(", ");
  }

  return {
    template,
    platformName,
    baseUrl,
    logoUrl,
    companyAddress,
    supportEmail: companySettings.email || settings.nodemailerEmail || "",
    settings,
  };
}

/**
 * Build email verification HTML from database template
 */
function buildEmailVerificationHtml(
  template: IEmailTemplate,
  config: {
    name: string;
    verificationLink: string;
    expiryHours: number;
    platformName: string;
    baseUrl: string;
    logoUrl: string;
    companyAddress: string;
  },
): string {
  // If using custom HTML template
  if (template.useCustomHtml && template.customHtmlTemplate) {
    return template.customHtmlTemplate
      .replace(/\{\{name\}\}/g, config.name)
      .replace(/\{\{verificationLink\}\}/g, config.verificationLink)
      .replace(/\{\{expiryHours\}\}/g, config.expiryHours.toString())
      .replace(/\{\{platformName\}\}/g, config.platformName)
      .replace(/\{\{baseUrl\}\}/g, config.baseUrl)
      .replace(/\{\{logoUrl\}\}/g, config.logoUrl)
      .replace(/\{\{companyAddress\}\}/g, config.companyAddress)
      .replace(/\{\{year\}\}/g, new Date().getFullYear().toString());
  }

  // Build feature list HTML
  const featureItems = template.featureItems || [
    "Access your account and wallet",
    "Deposit funds and enter competitions",
    "Compete with other traders and win prizes",
  ];


  // Get the CTA URL (verification link)
  const ctaUrl = config.verificationLink;

  return renderChartVoltEmail({
    title: `Verify Your Email - ${config.platformName}`,
    platformName: config.platformName,
    logoUrl: config.logoUrl,
    eyebrow: "Account Security",
    heading: template.headingText || "Verify Your Email",
    subheading: "One more step to activate your account",
    greetingName: config.name,
    bodyHtml:
      template.introText ||
      "Thanks for signing up! Please verify your email address to activate your account.",
    cta: { text: template.ctaButtonText || "Verify Email Address", url: ctaUrl },
    ctaNote: `This link expires in ${config.expiryHours} hours.`,
    showFallbackLink: true,
    listTitle: template.featureListLabel || "After verification you can:",
    listItems: featureItems,
    panel: {
      title: "Security Notice",
      lines: [
        "If you didn't create an account, you can safely ignore this email.",
        `Never share this link. ${escapeHtml(config.platformName)} will never ask for your password.`,
      ],
    },
    footerAddress: config.companyAddress,
    footerLinks: [{ label: "Visit Website", url: config.baseUrl }],
  });
}

/**
 * Send a test email verification email (for admin preview)
 */
export const sendTestEmailVerificationEmail = async (testEmail: string) => {
  const config = await getEmailVerificationConfig();
  const { template, platformName, baseUrl, logoUrl, companyAddress, settings } =
    config;

  // Create a fake verification link for testing
  const testVerificationLink = `${baseUrl}/api/auth/verify-email?token=TEST_TOKEN_123456789`;

  // Build HTML from database template with test data
  const htmlTemplate = buildEmailVerificationHtml(template, {
    name: "Test User",
    verificationLink: testVerificationLink,
    expiryHours: 24,
    platformName,
    baseUrl,
    logoUrl,
    companyAddress,
  });

  // Replace variables in subject
  let subject = `[TEST] ${template.subject || "Verify your email address - {{platformName}}"}`;
  subject = subject
    .replace(/\{\{platformName\}\}/g, platformName)
    .replace(/\{\{name\}\}/g, "Test User");

  const mailOptions = {
    from: `"${platformName}" <${settings.nodemailerEmail || process.env.NODEMAILER_EMAIL}>`,
    to: testEmail,
    subject,
    text: "[TEST] Email verification preview. Click the link to verify your email address.",
    html: htmlTemplate,
  };

  const emailTransporter = await getTransporter();
  await emailTransporter.sendMail(mailOptions);

  console.log(`✅ [TEST] Email verification email sent to ${testEmail}`);
};

/**
 * Data for account manager assigned email
 */
interface AccountManagerAssignedEmailData {
  customerEmail: string;
  customerName: string;
  managerName: string; // Full name for internal use
  managerFirstName: string; // Only first name shown in email
}

/**
 * Data for account manager changed email
 */
interface AccountManagerChangedEmailData {
  customerEmail: string;
  customerName: string;
  newManagerName: string;
  newManagerFirstName: string;
  previousManagerName?: string;
}

/**
 * Build account manager assigned email HTML from database template
 */
function buildAccountManagerAssignedEmailHtml(
  template: IEmailTemplate,
  config: {
    customerName: string;
    managerFirstName: string;
    platformName: string;
    baseUrl: string;
    logoUrl: string;
    companyAddress: string;
  },
): string {
  // If using custom HTML template
  if (template.useCustomHtml && template.customHtmlTemplate) {
    return template.customHtmlTemplate
      .replace(/\{\{customerName\}\}/g, config.customerName)
      .replace(/\{\{managerFirstName\}\}/g, config.managerFirstName)
      .replace(/\{\{platformName\}\}/g, config.platformName)
      .replace(/\{\{baseUrl\}\}/g, config.baseUrl)
      .replace(/\{\{logoUrl\}\}/g, config.logoUrl)
      .replace(/\{\{companyAddress\}\}/g, config.companyAddress)
      .replace(/\{\{year\}\}/g, new Date().getFullYear().toString());
  }

  // Build feature list HTML with manager name replacement
  const featureItems = (
    template.featureItems || [
      "{{managerFirstName}} will assist you with any questions about your account",
      "Get personalized guidance for competitions and trading",
      "Receive priority support whenever you need help",
    ]
  ).map((item) =>
    item.replace(/\{\{managerFirstName\}\}/g, config.managerFirstName),
  );


  // Replace template variables
  const heading = (
    template.headingText || "👋 Welcome to Personalized Support!"
  ).replace(/\{\{managerFirstName\}\}/g, config.managerFirstName);

  const introText = (
    template.introText ||
    "Great news! You have been assigned a dedicated account manager who will be your primary point of contact for all your needs."
  ).replace(/\{\{managerFirstName\}\}/g, config.managerFirstName);

  const closingText = (
    template.closingText ||
    "Feel free to reach out through the messaging feature in your account. {{managerFirstName}} is here to help you succeed!"
  ).replace(/\{\{managerFirstName\}\}/g, config.managerFirstName);

  // Get the CTA URL
  let ctaUrl = template.ctaButtonUrl || `${config.baseUrl}/messaging`;
  ctaUrl = ctaUrl.replace(/\{\{baseUrl\}\}/g, config.baseUrl);

  return renderChartVoltEmail({
    title: `Your Account Manager - ${config.platformName}`,
    platformName: config.platformName,
    logoUrl: config.logoUrl,
    eyebrow: "Personal Support",
    heading,
    subheading: "Your dedicated support is here",
    greetingName: config.customerName,
    bodyHtml: introText,
    highlight: { label: "Your Dedicated Account Manager", value: escapeHtml(config.managerFirstName), tone: "gold" },
    listTitle: template.featureListLabel || "Your Account Manager",
    listItems: featureItems,
    closingHtml: closingText,
    cta: { text: template.ctaButtonText || "Send a Message", url: ctaUrl },
    footerAddress: config.companyAddress,
    footerLinks: [{ label: "Visit Website", url: config.baseUrl }],
  });
}

/**
 * Build account manager changed email HTML from database template
 */
function buildAccountManagerChangedEmailHtml(
  template: IEmailTemplate,
  config: {
    customerName: string;
    newManagerFirstName: string;
    previousManagerName?: string;
    platformName: string;
    baseUrl: string;
    logoUrl: string;
    companyAddress: string;
  },
): string {
  // If using custom HTML template
  if (template.useCustomHtml && template.customHtmlTemplate) {
    return template.customHtmlTemplate
      .replace(/\{\{customerName\}\}/g, config.customerName)
      .replace(/\{\{newManagerFirstName\}\}/g, config.newManagerFirstName)
      .replace(
        /\{\{previousManagerName\}\}/g,
        config.previousManagerName || "your previous manager",
      )
      .replace(/\{\{platformName\}\}/g, config.platformName)
      .replace(/\{\{baseUrl\}\}/g, config.baseUrl)
      .replace(/\{\{logoUrl\}\}/g, config.logoUrl)
      .replace(/\{\{companyAddress\}\}/g, config.companyAddress)
      .replace(/\{\{year\}\}/g, new Date().getFullYear().toString());
  }

  // Build feature list HTML with manager name replacement
  const featureItems = (
    template.featureItems || [
      "{{newManagerFirstName}} is now your dedicated point of contact",
      "All your account history and preferences have been transferred",
      "You can reach out anytime through the messaging feature",
    ]
  ).map((item) =>
    item.replace(/\{\{newManagerFirstName\}\}/g, config.newManagerFirstName),
  );


  // Replace template variables
  const heading = (
    template.headingText || "👋 Meet Your New Account Manager"
  ).replace(/\{\{newManagerFirstName\}\}/g, config.newManagerFirstName);

  const introText = (
    template.introText ||
    "We wanted to let you know that your account has been reassigned to a new account manager who will be taking care of your needs going forward."
  ).replace(/\{\{newManagerFirstName\}\}/g, config.newManagerFirstName);

  const closingText = (
    template.closingText ||
    "{{newManagerFirstName}} is excited to work with you and help you achieve your trading goals!"
  ).replace(/\{\{newManagerFirstName\}\}/g, config.newManagerFirstName);

  // Get the CTA URL
  let ctaUrl = template.ctaButtonUrl || `${config.baseUrl}/messaging`;
  ctaUrl = ctaUrl.replace(/\{\{baseUrl\}\}/g, config.baseUrl);

  return renderChartVoltEmail({
    title: `New Account Manager - ${config.platformName}`,
    platformName: config.platformName,
    logoUrl: config.logoUrl,
    eyebrow: "Personal Support",
    heading,
    subheading: "Your account has a new point of contact",
    greetingName: config.customerName,
    bodyHtml: introText,
    highlight: { label: "Your New Account Manager", value: escapeHtml(config.newManagerFirstName), tone: "gold" },
    listTitle: template.featureListLabel || "Your New Account Manager",
    listItems: featureItems,
    closingHtml: closingText,
    cta: { text: template.ctaButtonText || "Say Hello", url: ctaUrl },
    footerAddress: config.companyAddress,
    footerLinks: [{ label: "Visit Website", url: config.baseUrl }],
  });
}

/**
 * Send account manager assigned email to customer
 */
export const sendAccountManagerAssignedEmail = async (
  data: AccountManagerAssignedEmailData,
) => {
  console.log(
    `📧 [MANAGER] sendAccountManagerAssignedEmail called for ${data.customerEmail}`,
  );

  try {
    await connectToDatabase();

    // Get settings and template
    const [companySettings, appSettings, whiteLabelSettings, template] =
      await Promise.all([
        CompanySettings.getSingleton(),
        getSettings(),
        WhiteLabel.findOne(),
        getEmailTemplate("account_manager_assigned"),
      ]);

    console.log(
      `📧 [MANAGER] Template found: ${template?.name || "NONE"}, isActive: ${template?.isActive}`,
    );

    // Check if template is active
    if (!template.isActive) {
      console.log(
        `⚠️ [MANAGER] Email template "account_manager_assigned" is DISABLED, skipping email to ${data.customerEmail}`,
      );
      return;
    }

    const platformName =
      appSettings.appName || companySettings.companyName || "Chatvolt";
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
    const isLocalhost =
      baseUrl.includes("localhost") || baseUrl.includes("127.0.0.1");

    // Get logo URL
    let logoUrl = whiteLabelSettings?.emailLogo || "/assets/images/logo.png";
    if (!logoUrl.startsWith("http")) {
      if (isLocalhost) {
        logoUrl = "https://placehold.co/150x50/141414/FDD458?text=Logo";
      } else {
        logoUrl = `${baseUrl}${logoUrl}`;
      }
    }

    // Build company address
    let companyAddress = "";
    if (companySettings.addressLine1 || companySettings.city) {
      const parts = [
        companySettings.addressLine1,
        companySettings.addressLine2,
        companySettings.city,
        companySettings.postalCode,
        COUNTRY_NAMES[companySettings.country] || companySettings.country,
      ].filter(Boolean);
      companyAddress = parts.join(", ");
    }

    // Build HTML from database template
    const htmlTemplate = buildAccountManagerAssignedEmailHtml(template, {
      customerName: data.customerName,
      managerFirstName: data.managerFirstName,
      platformName,
      baseUrl,
      logoUrl,
      companyAddress,
    });

    // Replace variables in subject
    let subject =
      template.subject ||
      "🎉 Meet Your Dedicated Account Manager at {{platformName}}";
    subject = subject
      .replace(/\{\{platformName\}\}/g, platformName)
      .replace(/\{\{managerFirstName\}\}/g, data.managerFirstName)
      .replace(/\{\{customerName\}\}/g, data.customerName);

    const mailOptions = {
      from: `"${platformName}" <${appSettings.nodemailerEmail || process.env.NODEMAILER_EMAIL}>`,
      to: data.customerEmail,
      subject,
      text: `Hi ${data.customerName}, you have been assigned a dedicated account manager: ${data.managerFirstName}. They will be your primary point of contact for any questions or assistance you may need. You can reach them through the messaging feature in your account.`,
      html: htmlTemplate,
    };

    const emailTransporter = await getTransporter();
    await emailTransporter.sendMail(mailOptions);

    console.log(
      `✅ [MANAGER] Account manager assigned email sent to ${data.customerEmail}`,
    );
  } catch (error) {
    console.error(
      "❌ [MANAGER] Failed to send account manager assigned email:",
      error,
    );
    // Don't throw - we don't want to fail the assignment if email fails
  }
};

/**
 * Send account manager changed email to customer
 */
export const sendAccountManagerChangedEmail = async (
  data: AccountManagerChangedEmailData,
) => {
  console.log(
    `📧 [MANAGER] sendAccountManagerChangedEmail called for ${data.customerEmail}`,
  );

  try {
    await connectToDatabase();

    // Get settings and template
    const [companySettings, appSettings, whiteLabelSettings, template] =
      await Promise.all([
        CompanySettings.getSingleton(),
        getSettings(),
        WhiteLabel.findOne(),
        getEmailTemplate("account_manager_changed"),
      ]);

    console.log(
      `📧 [MANAGER] Template found: ${template?.name || "NONE"}, isActive: ${template?.isActive}`,
    );

    // Check if template is active
    if (!template.isActive) {
      console.log(
        `⚠️ [MANAGER] Email template "account_manager_changed" is DISABLED, skipping email to ${data.customerEmail}`,
      );
      return;
    }

    const platformName =
      appSettings.appName || companySettings.companyName || "Chatvolt";
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
    const isLocalhost =
      baseUrl.includes("localhost") || baseUrl.includes("127.0.0.1");

    // Get logo URL
    let logoUrl = whiteLabelSettings?.emailLogo || "/assets/images/logo.png";
    if (!logoUrl.startsWith("http")) {
      if (isLocalhost) {
        logoUrl = "https://placehold.co/150x50/141414/FDD458?text=Logo";
      } else {
        logoUrl = `${baseUrl}${logoUrl}`;
      }
    }

    // Build company address
    let companyAddress = "";
    if (companySettings.addressLine1 || companySettings.city) {
      const parts = [
        companySettings.addressLine1,
        companySettings.addressLine2,
        companySettings.city,
        companySettings.postalCode,
        COUNTRY_NAMES[companySettings.country] || companySettings.country,
      ].filter(Boolean);
      companyAddress = parts.join(", ");
    }

    // Build HTML from database template
    const htmlTemplate = buildAccountManagerChangedEmailHtml(template, {
      customerName: data.customerName,
      newManagerFirstName: data.newManagerFirstName,
      previousManagerName: data.previousManagerName,
      platformName,
      baseUrl,
      logoUrl,
      companyAddress,
    });

    // Replace variables in subject
    let subject =
      template.subject ||
      "🔄 Your Account Manager Has Changed at {{platformName}}";
    subject = subject
      .replace(/\{\{platformName\}\}/g, platformName)
      .replace(/\{\{newManagerFirstName\}\}/g, data.newManagerFirstName)
      .replace(/\{\{customerName\}\}/g, data.customerName);

    const mailOptions = {
      from: `"${platformName}" <${appSettings.nodemailerEmail || process.env.NODEMAILER_EMAIL}>`,
      to: data.customerEmail,
      subject,
      text: `Hi ${data.customerName}, your account has been reassigned to a new account manager: ${data.newManagerFirstName}. They are now your primary point of contact and are ready to assist you. You can reach them through the messaging feature in your account.`,
      html: htmlTemplate,
    };

    const emailTransporter = await getTransporter();
    await emailTransporter.sendMail(mailOptions);

    console.log(
      `✅ [MANAGER] Account manager changed email sent to ${data.customerEmail}`,
    );
  } catch (error) {
    console.error(
      "❌ [MANAGER] Failed to send account manager changed email:",
      error,
    );
    // Don't throw - we don't want to fail the transfer if email fails
  }
};

/**
 * Send a test account manager assigned email (for admin preview)
 */
export const sendTestAccountManagerAssignedEmail = async (
  testEmail: string,
) => {
  console.log(
    `📧 [TEST] sendTestAccountManagerAssignedEmail called for ${testEmail}`,
  );

  try {
    await connectToDatabase();

    // Get settings and template
    const [companySettings, appSettings, whiteLabelSettings, template] =
      await Promise.all([
        CompanySettings.getSingleton(),
        getSettings(),
        WhiteLabel.findOne(),
        getEmailTemplate("account_manager_assigned"),
      ]);

    const platformName =
      appSettings.appName || companySettings.companyName || "Chatvolt";
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
    const isLocalhost =
      baseUrl.includes("localhost") || baseUrl.includes("127.0.0.1");

    // Get logo URL
    let logoUrl = whiteLabelSettings?.emailLogo || "/assets/images/logo.png";
    if (!logoUrl.startsWith("http")) {
      if (isLocalhost) {
        logoUrl = "https://placehold.co/150x50/141414/FDD458?text=Logo";
      } else {
        logoUrl = `${baseUrl}${logoUrl}`;
      }
    }

    // Build company address
    let companyAddress = "";
    if (companySettings.addressLine1 || companySettings.city) {
      const parts = [
        companySettings.addressLine1,
        companySettings.addressLine2,
        companySettings.city,
        companySettings.postalCode,
        COUNTRY_NAMES[companySettings.country] || companySettings.country,
      ].filter(Boolean);
      companyAddress = parts.join(", ");
    }

    // Build HTML from database template with test data
    const htmlTemplate = buildAccountManagerAssignedEmailHtml(template, {
      customerName: "Test Customer",
      managerFirstName: "John",
      platformName,
      baseUrl,
      logoUrl,
      companyAddress,
    });

    // Replace variables in subject
    let subject = `[TEST] ${template.subject || "🎉 Meet Your Dedicated Account Manager at {{platformName}}"}`;
    subject = subject
      .replace(/\{\{platformName\}\}/g, platformName)
      .replace(/\{\{managerFirstName\}\}/g, "John")
      .replace(/\{\{customerName\}\}/g, "Test Customer");

    const mailOptions = {
      from: `"${platformName}" <${appSettings.nodemailerEmail || process.env.NODEMAILER_EMAIL}>`,
      to: testEmail,
      subject,
      text: `Hi Test Customer, great news! You have been assigned a dedicated account manager: John. They will be your primary point of contact. You can reach them through the messaging feature in your account.`,
      html: htmlTemplate,
    };

    const emailTransporter = await getTransporter();
    await emailTransporter.sendMail(mailOptions);

    console.log(
      `✅ [TEST] Account manager assigned test email sent to ${testEmail}`,
    );
  } catch (error) {
    console.error(
      "❌ [TEST] Failed to send account manager assigned test email:",
      error,
    );
    throw error;
  }
};

/**
 * Send a test account manager changed email (for admin preview)
 */
export const sendTestAccountManagerChangedEmail = async (testEmail: string) => {
  console.log(
    `📧 [TEST] sendTestAccountManagerChangedEmail called for ${testEmail}`,
  );

  try {
    await connectToDatabase();

    // Get settings and template
    const [companySettings, appSettings, whiteLabelSettings, template] =
      await Promise.all([
        CompanySettings.getSingleton(),
        getSettings(),
        WhiteLabel.findOne(),
        getEmailTemplate("account_manager_changed"),
      ]);

    const platformName =
      appSettings.appName || companySettings.companyName || "Chatvolt";
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
    const isLocalhost =
      baseUrl.includes("localhost") || baseUrl.includes("127.0.0.1");

    // Get logo URL
    let logoUrl = whiteLabelSettings?.emailLogo || "/assets/images/logo.png";
    if (!logoUrl.startsWith("http")) {
      if (isLocalhost) {
        logoUrl = "https://placehold.co/150x50/141414/FDD458?text=Logo";
      } else {
        logoUrl = `${baseUrl}${logoUrl}`;
      }
    }

    // Build company address
    let companyAddress = "";
    if (companySettings.addressLine1 || companySettings.city) {
      const parts = [
        companySettings.addressLine1,
        companySettings.addressLine2,
        companySettings.city,
        companySettings.postalCode,
        COUNTRY_NAMES[companySettings.country] || companySettings.country,
      ].filter(Boolean);
      companyAddress = parts.join(", ");
    }

    // Build HTML from database template with test data
    const htmlTemplate = buildAccountManagerChangedEmailHtml(template, {
      customerName: "Test Customer",
      newManagerFirstName: "Sarah",
      previousManagerName: "John",
      platformName,
      baseUrl,
      logoUrl,
      companyAddress,
    });

    // Replace variables in subject
    let subject = `[TEST] ${template.subject || "🔄 Your Account Manager Has Changed at {{platformName}}"}`;
    subject = subject
      .replace(/\{\{platformName\}\}/g, platformName)
      .replace(/\{\{newManagerFirstName\}\}/g, "Sarah")
      .replace(/\{\{customerName\}\}/g, "Test Customer");

    const mailOptions = {
      from: `"${platformName}" <${appSettings.nodemailerEmail || process.env.NODEMAILER_EMAIL}>`,
      to: testEmail,
      subject,
      text: `Hi Test Customer, your account has been reassigned to a new account manager: Sarah. They are now your primary point of contact. You can reach them through the messaging feature in your account.`,
      html: htmlTemplate,
    };

    const emailTransporter = await getTransporter();
    await emailTransporter.sendMail(mailOptions);

    console.log(
      `✅ [TEST] Account manager changed test email sent to ${testEmail}`,
    );
  } catch (error) {
    console.error(
      "❌ [TEST] Failed to send account manager changed test email:",
      error,
    );
    throw error;
  }
};
