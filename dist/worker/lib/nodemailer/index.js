"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendInvoiceEmail = exports.sendTestWelcomeEmail = exports.sendWelcomeEmail = exports.transporter = void 0;
exports.getTransporter = getTransporter;
const nodemailer_1 = __importDefault(require("nodemailer"));
const templates_1 = require("@/lib/nodemailer/templates");
const mongoose_1 = require("@/database/mongoose");
const whitelabel_model_1 = require("@/database/models/whitelabel.model");
const settings_service_1 = require("@/lib/services/settings.service");
const invoice_settings_model_1 = __importDefault(require("@/database/models/invoice-settings.model"));
const company_settings_model_1 = __importStar(require("@/database/models/company-settings.model"));
const invoice_model_1 = __importDefault(require("@/database/models/invoice.model"));
const email_template_model_1 = require("@/database/models/email-template.model");
/**
 * Get email transporter with credentials from database
 * Falls back to environment variables if database is unavailable
 */
async function getTransporter() {
    try {
        const settings = await (0, settings_service_1.getSettings)();
        return nodemailer_1.default.createTransport({
            service: 'gmail',
            auth: {
                user: settings.nodemailerEmail || process.env.NODEMAILER_EMAIL,
                pass: settings.nodemailerPassword || process.env.NODEMAILER_PASSWORD,
            }
        });
    }
    catch (error) {
        console.error('⚠️ Error getting email settings from database, using environment variables:', error);
        // Fallback to environment variables
        return nodemailer_1.default.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.NODEMAILER_EMAIL,
                pass: process.env.NODEMAILER_PASSWORD,
            }
        });
    }
}
// Legacy export for backward compatibility (deprecated - use getTransporter() instead)
exports.transporter = nodemailer_1.default.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.NODEMAILER_EMAIL || 'default@example.com',
        pass: process.env.NODEMAILER_PASSWORD || 'default',
    }
});
/**
 * Get email-friendly logo URLs from WhiteLabel settings
 * Always uses uploaded images from admin panel
 * Automatically uses the correct domain from environment variables
 */
async function getEmailImageUrls() {
    try {
        await (0, mongoose_1.connectToDatabase)();
        const settings = await whitelabel_model_1.WhiteLabel.findOne();
        // Get base URL from environment (works for both dev and production)
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.BETTER_AUTH_URL || 'http://localhost:3000';
        // Get logo URLs from database (uploaded via admin panel)
        let logoUrl = settings?.emailLogo || '/assets/images/logo.png';
        let dashboardUrl = settings?.dashboardPreview || '/assets/images/dashboard-preview.png';
        // If URLs are already full URLs (e.g., CDN links), use them directly
        // Otherwise, prepend the base domain
        if (!logoUrl.startsWith('http')) {
            logoUrl = `${baseUrl}${logoUrl}`;
        }
        if (!dashboardUrl.startsWith('http')) {
            dashboardUrl = `${baseUrl}${dashboardUrl}`;
        }
        console.log('🖼️  Email images configuration:');
        console.log('   - Base URL:', baseUrl);
        console.log('   - Logo:', logoUrl);
        console.log('   - Dashboard:', dashboardUrl);
        return { logoUrl, dashboardPreviewUrl: dashboardUrl };
    }
    catch (error) {
        console.error('❌ Error fetching white label settings:', error);
        // Fallback to default
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.BETTER_AUTH_URL || 'http://localhost:3000';
        return {
            logoUrl: `${baseUrl}/assets/images/logo.png`,
            dashboardPreviewUrl: `${baseUrl}/assets/images/dashboard-preview.png`
        };
    }
}
/**
 * Get welcome email configuration from database
 */
async function getWelcomeEmailConfig() {
    await (0, mongoose_1.connectToDatabase)();
    // Get all necessary settings in parallel
    const [emailTemplate, companySettings, whiteLabelSettings, settings] = await Promise.all([
        (0, email_template_model_1.getEmailTemplate)('welcome'),
        company_settings_model_1.default.getSingleton(),
        whitelabel_model_1.WhiteLabel.findOne(),
        (0, settings_service_1.getSettings)(),
    ]);
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.BETTER_AUTH_URL || 'http://localhost:3000';
    const platformName = settings.appName || companySettings.companyName || 'Chatvolt';
    const isLocalhost = baseUrl.includes('localhost') || baseUrl.includes('127.0.0.1');
    // Get logo URLs - use placeholders if localhost (email clients can't access localhost)
    let logoUrl = whiteLabelSettings?.emailLogo || '/assets/images/logo.png';
    let dashboardUrl = whiteLabelSettings?.dashboardPreview || '/assets/images/dashboard-preview.png';
    // If the URL is already a full URL (CDN, etc.), use it
    // Otherwise, prepend the base URL (or use placeholder if localhost)
    if (!logoUrl.startsWith('http')) {
        if (isLocalhost) {
            // Use placeholder for testing - replace with your production URL or CDN
            logoUrl = 'https://placehold.co/150x50/141414/FDD458?text=Logo';
        }
        else {
            logoUrl = `${baseUrl}${logoUrl}`;
        }
    }
    if (!dashboardUrl.startsWith('http')) {
        if (isLocalhost) {
            // Use placeholder for testing
            dashboardUrl = 'https://placehold.co/520x300/141414/FDD458?text=Dashboard+Preview';
        }
        else {
            dashboardUrl = `${baseUrl}${dashboardUrl}`;
        }
    }
    // Build company address from flat fields
    let companyAddress = '';
    if (companySettings.addressLine1 || companySettings.city) {
        const parts = [
            companySettings.addressLine1,
            companySettings.addressLine2,
            companySettings.city,
            companySettings.postalCode,
            company_settings_model_1.COUNTRY_NAMES[companySettings.country] || companySettings.country,
        ].filter(Boolean);
        companyAddress = parts.join(', ');
    }
    return {
        template: emailTemplate,
        platformName,
        baseUrl,
        logoUrl,
        dashboardPreviewUrl: dashboardUrl,
        companyAddress,
        companyEmail: companySettings.email || settings.nodemailerEmail || '',
        settings,
    };
}
/**
 * Build welcome email HTML from database template
 */
function buildWelcomeEmailHtml(template, config) {
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
        'Set up your watchlist to follow your favorite stocks',
        'Create price and volume alerts so you never miss a move',
        'Explore the dashboard for trends and the latest market news',
    ];
    const featureListHtml = featureItems
        .map((item) => `<li style="margin-bottom: 12px;">${item}</li>`)
        .join('\n                                ');
    // Get the CTA URL
    let ctaUrl = template.ctaButtonUrl || config.baseUrl;
    ctaUrl = ctaUrl.replace(/\{\{baseUrl\}\}/g, config.baseUrl);
    // Get footer links
    const unsubscribeUrl = template.footerLinks?.unsubscribeUrl || '#';
    let websiteUrl = template.footerLinks?.websiteUrl || config.baseUrl;
    websiteUrl = websiteUrl.replace(/\{\{baseUrl\}\}/g, config.baseUrl);
    // Get footer address
    let footerAddress = template.footerAddress || config.companyAddress;
    footerAddress = footerAddress.replace(/\{\{companyAddress\}\}/g, config.companyAddress);
    // Build the heading
    const heading = (template.headingText || 'Welcome aboard {{name}}')
        .replace(/\{\{name\}\}/g, config.name);
    // Build the dynamic template
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="format-detection" content="telephone=no">
    <meta name="x-apple-disable-message-reformatting">
    <title>Welcome to ${config.platformName}</title>
    <style type="text/css">
        @media (prefers-color-scheme: dark) {
            .email-container { background-color: #141414 !important; border: 1px solid #30333A !important; }
            .dark-bg { background-color: #050505 !important; }
            .dark-text { color: #ffffff !important; }
            .dark-text-secondary { color: #9ca3af !important; }
            .dark-text-muted { color: #6b7280 !important; }
            .dark-border { border-color: #30333A !important; }
        }
        @media only screen and (max-width: 600px) {
            .email-container { width: 100% !important; margin: 0 !important; }
            .mobile-padding { padding: 24px !important; }
            .mobile-header-padding { padding: 24px 24px 12px 24px !important; }
            .mobile-text { font-size: 14px !important; line-height: 1.5 !important; }
            .mobile-title { font-size: 24px !important; line-height: 1.3 !important; }
            .mobile-button { width: 100% !important; text-align: center !important; }
            .mobile-button a { width: calc(100% - 64px) !important; display: block !important; text-align: center !important; }
            .mobile-outer-padding { padding: 20px 10px !important; }
            .dashboard-preview { padding: 0 15px 30px 15px !important; }
        }
        @media only screen and (max-width: 480px) {
            .mobile-title { font-size: 22px !important; }
            .mobile-padding { padding: 15px !important; }
            .mobile-header-padding { padding: 15px 15px 8px 15px !important; }
        }
    </style>
</head>
<body style="margin: 0; padding: 0; background-color: #050505; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #050505;">
        <tr>
            <td align="center" class="mobile-outer-padding" style="padding: 40px 20px;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" class="email-container" style="max-width: 600px; background-color: #141414; border-radius: 8px; border: 1px solid #30333A;">
                    
                    <!-- Header with Logo -->
                    <tr>
                        <td align="left" class="mobile-header-padding" style="padding: 40px 40px 20px 40px;">
                            <img src="${config.logoUrl}" alt="${config.platformName} Logo" width="150" style="max-width: 100%; height: auto;">
                        </td>
                    </tr>
                    
                    <!-- Dashboard Preview Image -->
                    <tr>
                        <td align="center" class="dashboard-preview" style="padding: 40px 40px 0px 40px;">
                            <img src="${config.dashboardPreviewUrl}" alt="${config.platformName} Dashboard Preview" width="100%" style="max-width: 520px; width: 100%; height: auto; border-radius: 12px; border: 1px solid #30333A;">
                        </td>
                    </tr>
                    
                    <!-- Main Content -->
                    <tr>
                        <td class="mobile-padding" style="padding: 40px 40px 40px 40px;">
                            
                            <!-- Welcome Heading -->
                            <h1 class="mobile-title dark-text" style="margin: 0 0 30px 0; font-size: 24px; font-weight: 600; color: #FDD458; line-height: 1.2;">
                                ${heading}
                            </h1>
                            
                            <!-- Intro Text -->
                            ${config.intro}  
                            
                            <!-- Feature List Label -->
                            <p class="mobile-text dark-text-secondary" style="margin: 0 0 15px 0; font-size: 16px; line-height: 1.6; color: #CCDADC; font-weight: 600;">
                                ${template.featureListLabel || "Here's what you can do right now:"}
                            </p>
                            
                            <!-- Feature List -->
                            <ul class="mobile-text dark-text-secondary" style="margin: 0 0 30px 0; padding-left: 20px; font-size: 16px; line-height: 1.6; color: #CCDADC;">
                                ${featureListHtml}
                            </ul>
                            
                            <!-- Additional Text -->
                            <p class="mobile-text dark-text-secondary" style="margin: 0 0 40px 0; font-size: 16px; line-height: 1.6; color: #CCDADC;">
                                ${template.closingText || "We'll keep you informed with timely updates, insights, and alerts — so you can focus on making the right calls."}
                            </p>
                            
                            <!-- CTA Button -->
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin: 0 0 40px 0; width: 100%;">
                                <tr>
                                    <td align="center">
                                        <a href="${ctaUrl}" style="display: block; width: 100%; background: linear-gradient(135deg, #FDD458 0%, #E8BA40 100%); color: #000000; text-decoration: none; padding: 16px 32px; border-radius: 8px; font-size: 16px; font-weight: 500; line-height: 1; text-align: center; box-sizing: border-box;">
                                            ${template.ctaButtonText || 'Go to Dashboard'}
                                        </a>
                                    </td>
                                </tr>
                            </table>
                            
                            <!-- Footer Text -->
                            <p class="mobile-text dark-text-muted" style="margin: 40px 0 0 0; font-size: 14px; line-height: 1.5; color: #CCDADC !important; text-align: center;">
                               ${footerAddress}<br>
                                <a href="${unsubscribeUrl}" style="color: #CCDADC !important; text-decoration: underline;">Unsubscribe</a> | 
                                <a href="${websiteUrl}" style="color: #CCDADC !important; text-decoration: underline;">Visit ${config.platformName}</a><br>
                                © ${new Date().getFullYear()} ${config.platformName}
                            </p>
                        </td>
                    </tr>
                    
                </table>
            </td>
        </tr>
    </table>
</body>
</html>`;
}
const sendWelcomeEmail = async ({ email, name, intro }) => {
    // Get welcome email configuration from database
    const config = await getWelcomeEmailConfig();
    const { template, platformName, baseUrl, logoUrl, dashboardPreviewUrl, companyAddress, settings } = config;
    console.log('📧 Sending welcome email:');
    console.log('   - To:', email);
    console.log('   - Platform:', platformName);
    console.log('   - Logo:', logoUrl);
    console.log('   - Using AI:', template.useAIPersonalization);
    // Format intro as HTML paragraph if it's plain text
    const introHtml = intro.startsWith('<')
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
    let subject = template.subject || 'Welcome to {{platformName}} - your Asset market toolkit is ready!';
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
        text: `Welcome to ${platformName}, ${name}! ${template.introText || 'Thanks for joining us.'}`,
        html: htmlTemplate,
    };
    // Get transporter with database credentials
    const emailTransporter = await getTransporter();
    await emailTransporter.sendMail(mailOptions);
    console.log(`✅ Welcome email sent to ${email}`);
};
exports.sendWelcomeEmail = sendWelcomeEmail;
/**
 * Send a test welcome email (for admin preview)
 */
const sendTestWelcomeEmail = async (testEmail) => {
    const config = await getWelcomeEmailConfig();
    const { template, platformName, baseUrl, logoUrl, dashboardPreviewUrl, companyAddress, settings } = config;
    // Use default intro or template intro for test
    const testIntro = `<p class="mobile-text" style="margin: 0 0 30px 0; font-size: 16px; line-height: 1.6; color: #CCDADC;">${template.introText || 'Thanks for joining! You now have access to our trading competition platform where you can compete against other traders and win real prizes.'}</p>`;
    // Build HTML from database template
    const htmlTemplate = buildWelcomeEmailHtml(template, {
        name: 'Test User',
        intro: testIntro,
        platformName,
        baseUrl,
        logoUrl,
        dashboardPreviewUrl,
        companyAddress,
    });
    // Replace variables in subject
    let subject = `[TEST] ${template.subject || 'Welcome to {{platformName}}'}`;
    subject = subject
        .replace(/\{\{platformName\}\}/g, platformName)
        .replace(/\{\{name\}\}/g, 'Test User');
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
exports.sendTestWelcomeEmail = sendTestWelcomeEmail;
/**
 * Send invoice email to customer after purchase
 */
const sendInvoiceEmail = async ({ invoiceId, customerEmail, customerName }) => {
    await (0, mongoose_1.connectToDatabase)();
    // Get invoice
    const invoice = await invoice_model_1.default.findById(invoiceId);
    if (!invoice) {
        throw new Error(`Invoice not found: ${invoiceId}`);
    }
    // Get settings
    const [invoiceSettings, companySettings, settings] = await Promise.all([
        invoice_settings_model_1.default.getSingleton(),
        company_settings_model_1.default.getSingleton(),
        (0, settings_service_1.getSettings)(),
    ]);
    // Get logo URL
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    let logoUrl = companySettings.logoUrl || settings.appLogo || '/assets/images/logo.png';
    if (!logoUrl.startsWith('http')) {
        logoUrl = `${baseUrl}${logoUrl}`;
    }
    // Format currency
    const formatCurrency = (amount) => {
        const symbol = invoiceSettings.currencySymbol || '€';
        const formatted = amount.toFixed(2);
        return invoiceSettings.currencyPosition === 'after'
            ? `${formatted}${symbol}`
            : `${symbol}${formatted}`;
    };
    // Format date
    const formatDate = (date) => {
        return new Date(date).toLocaleDateString('en-GB', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        });
    };
    // Build line items HTML
    const lineItemsHtml = invoice.lineItems.map(item => `
        <tr>
            <td style="padding: 12px 0; color: #ffffff;">${item.description}</td>
            <td style="padding: 12px 0; text-align: right; color: #9ca3af;">${formatCurrency(item.total)}</td>
        </tr>
    `).join('');
    // Build VAT row HTML
    const vatRowHtml = invoice.vatRate > 0 ? `
        <tr>
            <td style="padding: 12px 0; color: #9ca3af;">${invoiceSettings.vatLabel || 'VAT'} (${invoice.vatRate}%)</td>
            <td style="padding: 12px 0; text-align: right; color: #9ca3af;">${formatCurrency(invoice.vatAmount)}</td>
        </tr>
    ` : '';
    // Build company address
    const companyCountryName = company_settings_model_1.COUNTRY_NAMES[invoice.companyAddress.country] || invoice.companyAddress.country;
    const companyAddress = [
        invoice.companyAddress.line1,
        invoice.companyAddress.line2,
        `${invoice.companyAddress.city}, ${invoice.companyAddress.postalCode}`,
        companyCountryName,
    ].filter(Boolean).join('<br>');
    // Build VAT info
    const vatInfo = invoice.companyVatNumber ? `VAT: ${invoice.companyVatNumber}` : '';
    // Prepare email subject
    let emailSubject = invoiceSettings.invoiceEmailSubject || 'Your Invoice from {{companyName}} - {{invoiceNumber}}';
    emailSubject = emailSubject
        .replace(/\{\{companyName\}\}/g, companySettings.companyName)
        .replace(/\{\{invoiceNumber\}\}/g, invoice.invoiceNumber);
    // Prepare email body text
    let emailBody = invoiceSettings.invoiceEmailBody || 'Thank you for your purchase! Please find your invoice attached.';
    emailBody = emailBody
        .replace(/\{\{companyName\}\}/g, companySettings.companyName)
        .replace(/\{\{customerName\}\}/g, customerName)
        .replace(/\{\{invoiceNumber\}\}/g, invoice.invoiceNumber);
    // Format legal disclaimer for email
    const showLegalDisclaimer = invoiceSettings.showLegalDisclaimer !== false;
    let legalDisclaimerHtml = '';
    if (showLegalDisclaimer && invoiceSettings.legalDisclaimer) {
        // Replace variables in disclaimer
        let disclaimer = invoiceSettings.legalDisclaimer
            .replace(/\{\{companyName\}\}/g, companySettings.companyName)
            .replace(/\{\{companyEmail\}\}/g, invoice.companyEmail || companySettings.email)
            .replace(/\{\{vatNumber\}\}/g, invoice.companyVatNumber || '');
        // Convert markdown bold (**text**) to HTML strong with email styling
        disclaimer = disclaimer.replace(/\*\*([^*]+)\*\*/g, '<strong style="color: #9ca3af;">$1</strong>');
        // Convert double newlines to paragraph breaks with email styling
        const paragraphs = disclaimer.split(/\n\n+/);
        legalDisclaimerHtml = paragraphs.map(p => `<p style="margin: 0 0 10px 0;">${p.trim()}</p>`).join('\n                                ');
    }
    // Build HTML template for email
    let htmlTemplate = templates_1.INVOICE_EMAIL_TEMPLATE
        .replace(/\{\{logoUrl\}\}/g, logoUrl)
        .replace(/\{\{companyName\}\}/g, companySettings.companyName)
        .replace(/\{\{invoiceNumber\}\}/g, invoice.invoiceNumber)
        .replace(/\{\{invoiceDate\}\}/g, formatDate(invoice.invoiceDate))
        .replace(/\{\{customerName\}\}/g, customerName)
        .replace(/\{\{emailBody\}\}/g, emailBody.replace(/\n/g, '<br>'))
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
        htmlTemplate = htmlTemplate.replace(/\{\{#if showLegalDisclaimer\}\}/g, '').replace(/\{\{\/if\}\}/g, '');
    }
    else {
        // Remove the entire disclaimer section if disabled
        htmlTemplate = htmlTemplate.replace(/\{\{#if showLegalDisclaimer\}\}[\s\S]*?\{\{\/if\}\}/g, '');
    }
    // Generate PDF invoice using PDFKit (no browser required!)
    let pdfAttachment = null;
    console.log(`📄 [INVOICE] Starting PDF generation for ${invoice.invoiceNumber}...`);
    try {
        const { generateInvoicePDF } = await Promise.resolve().then(() => __importStar(require('@/lib/services/pdf-generator.service')));
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
            contentType: 'application/pdf',
        };
        console.log(`✅ [INVOICE] PDF generated successfully: ${filename} (${(buffer.length / 1024).toFixed(2)} KB)`);
    }
    catch (pdfError) {
        console.error('❌ [INVOICE] Failed to generate PDF:');
        console.error('   Error name:', pdfError?.name);
        console.error('   Error message:', pdfError?.message);
        console.error('   Error stack:', pdfError?.stack?.substring(0, 500));
        console.log('⚠️ [INVOICE] Will send email WITHOUT PDF attachment');
        // Continue without PDF attachment if generation fails
    }
    const mailOptions = {
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
    invoice.status = 'sent';
    invoice.sentAt = new Date();
    await invoice.save();
    console.log(`✅ [INVOICE] Email sent successfully for ${invoice.invoiceNumber}${pdfAttachment ? ' with PDF attachment' : ''}`);
};
exports.sendInvoiceEmail = sendInvoiceEmail;
