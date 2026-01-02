import nodemailer from 'nodemailer';
import { INVOICE_EMAIL_TEMPLATE, DEPOSIT_COMPLETED_EMAIL_TEMPLATE, WITHDRAWAL_COMPLETED_EMAIL_TEMPLATE } from "@/lib/nodemailer/templates";
import { connectToDatabase } from '@/database/mongoose';
import { WhiteLabel } from '@/database/models/whitelabel.model';
import { getSettings } from '@/lib/services/settings.service';
import InvoiceSettings from '@/database/models/invoice-settings.model';
import CompanySettings, { COUNTRY_NAMES } from '@/database/models/company-settings.model';
import Invoice from '@/database/models/invoice.model';
import EmailTemplate, { getEmailTemplate, IEmailTemplate } from '@/database/models/email-template.model';

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
        
        return nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: settings.nodemailerEmail || process.env.NODEMAILER_EMAIL!,
                pass: settings.nodemailerPassword || process.env.NODEMAILER_PASSWORD!,
            }
        });
    } catch (error) {
        console.error('⚠️ Error getting email settings from database, using environment variables:', error);
        // Fallback to environment variables
        return nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.NODEMAILER_EMAIL!,
                pass: process.env.NODEMAILER_PASSWORD!,
            }
        });
    }
}

// Legacy export for backward compatibility (deprecated - use getTransporter() instead)
export const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.NODEMAILER_EMAIL || 'default@example.com',
        pass: process.env.NODEMAILER_PASSWORD || 'default',
    }
})

/**
 * Get email-friendly logo URLs from WhiteLabel settings
 * Always uses uploaded images from admin panel
 * Automatically uses the correct domain from environment variables
 */
async function getEmailImageUrls() {
    try {
        await connectToDatabase();
        const settings = await WhiteLabel.findOne();
        
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
    } catch (error) {
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
    await connectToDatabase();
    
    // Get all necessary settings in parallel
    const [emailTemplate, companySettings, whiteLabelSettings, settings] = await Promise.all([
        getEmailTemplate('welcome'),
        CompanySettings.getSingleton(),
        WhiteLabel.findOne(),
        getSettings(),
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
        } else {
            logoUrl = `${baseUrl}${logoUrl}`;
        }
    }
    if (!dashboardUrl.startsWith('http')) {
        if (isLocalhost) {
            // Use placeholder for testing
            dashboardUrl = 'https://placehold.co/520x300/141414/FDD458?text=Dashboard+Preview';
        } else {
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
            COUNTRY_NAMES[companySettings.country] || companySettings.country,
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
    }
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
        'Set up your watchlist to follow your favorite stocks',
        'Create price and volume alerts so you never miss a move',
        'Explore the dashboard for trends and the latest market news',
    ];
    
    const featureListHtml = featureItems
        .map((item: string) => `<li style="margin-bottom: 12px;">${item}</li>`)
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

export const sendWelcomeEmail = async ({ email, name, intro }: WelcomeEmailData) => {
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
}

/**
 * Send a test welcome email (for admin preview)
 */
export const sendTestWelcomeEmail = async (testEmail: string) => {
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
}

interface InvoiceEmailData {
    invoiceId: string;
    customerEmail: string;
    customerName: string;
}

/**
 * Send invoice email to customer after purchase
 */
export const sendInvoiceEmail = async ({ invoiceId, customerEmail, customerName }: InvoiceEmailData) => {
    await connectToDatabase();
    
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
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    let logoUrl = companySettings.logoUrl || settings.appLogo || '/assets/images/logo.png';
    if (!logoUrl.startsWith('http')) {
        logoUrl = `${baseUrl}${logoUrl}`;
    }
    
    // Format currency
    const formatCurrency = (amount: number) => {
        const symbol = invoiceSettings.currencySymbol || '€';
        const formatted = amount.toFixed(2);
        return invoiceSettings.currencyPosition === 'after' 
            ? `${formatted}${symbol}` 
            : `${symbol}${formatted}`;
    };
    
    // Format date
    const formatDate = (date: Date) => {
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
    const companyCountryName = COUNTRY_NAMES[invoice.companyAddress.country] || invoice.companyAddress.country;
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
    let htmlTemplate = INVOICE_EMAIL_TEMPLATE
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
    } else {
        // Remove the entire disclaimer section if disabled
        htmlTemplate = htmlTemplate.replace(/\{\{#if showLegalDisclaimer\}\}[\s\S]*?\{\{\/if\}\}/g, '');
    }
    
    // Generate PDF invoice using PDFKit (no browser required!)
    let pdfAttachment = null;
    console.log(`📄 [INVOICE] Starting PDF generation for ${invoice.invoiceNumber}...`);
    
    try {
        const { generateInvoicePDF } = await import('@/lib/services/pdf-generator.service');
        
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
    } catch (pdfError: any) {
        console.error('❌ [INVOICE] Failed to generate PDF:');
        console.error('   Error name:', pdfError?.name);
        console.error('   Error message:', pdfError?.message);
        console.error('   Error stack:', pdfError?.stack?.substring(0, 500));
        console.log('⚠️ [INVOICE] Will send email WITHOUT PDF attachment');
        // Continue without PDF attachment if generation fails
    }
    
    const mailOptions: any = {
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
 * Build deposit completed email HTML from database template
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
    }
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
        'Browse active competitions and join one that matches your style',
        'Challenge other traders in head-to-head matches',
        'Climb the leaderboard and win real prizes!',
    ];
    
    const featureListHtml = featureItems
        .map((item: string) => `<li style="margin-bottom: 12px;">${item}</li>`)
        .join('\n                                ');
    
    // Get the CTA URL
    let ctaUrl = template.ctaButtonUrl || `${config.baseUrl}/competitions`;
    ctaUrl = ctaUrl.replace(/\{\{baseUrl\}\}/g, config.baseUrl);
    
    // Build the dynamic template using database values
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Deposit Confirmed - ${config.platformName}</title>
    <style type="text/css">
        @media only screen and (max-width: 600px) {
            .email-container { width: 100% !important; margin: 0 !important; }
            .mobile-padding { padding: 24px !important; }
        }
    </style>
</head>
<body style="margin: 0; padding: 0; background-color: #050505; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #050505;">
        <tr>
            <td align="center" style="padding: 40px 20px;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" class="email-container" style="max-width: 600px; background-color: #141414; border-radius: 8px; border: 1px solid #30333A;">
                    
                    <!-- Header with Logo -->
                    <tr>
                        <td align="left" style="padding: 40px 40px 20px 40px;">
                            <img src="${config.logoUrl}" alt="${config.platformName}" width="150" style="max-width: 100%; height: auto;">
                        </td>
                    </tr>
                    
                    <!-- Main Content -->
                    <tr>
                        <td class="mobile-padding" style="padding: 20px 40px 40px 40px;">
                            
                            <!-- Success Banner -->
                            <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); border-radius: 8px; padding: 24px; margin-bottom: 24px; text-align: center;">
                                <h1 style="margin: 0 0 8px 0; font-size: 24px; font-weight: 600; color: #ffffff;">
                                    ${template.headingText || '✓ Deposit Successful!'}
                                </h1>
                                <p style="margin: 0; font-size: 14px; color: rgba(255,255,255,0.9);">
                                    Your credits are now available
                                </p>
                            </div>
                            
                            <!-- Greeting -->
                            <p style="margin: 0 0 24px 0; font-size: 16px; line-height: 1.6; color: #CCDADC;">
                                Hi ${config.name},
                            </p>
                            
                            <p style="margin: 0 0 24px 0; font-size: 16px; line-height: 1.6; color: #CCDADC;">
                                ${template.introText || 'Great news! Your deposit has been processed successfully and your credits are ready to use.'}
                            </p>
                            
                            <!-- Transaction Details -->
                            <div style="background-color: #1E1E1E; border-radius: 8px; padding: 24px; margin-bottom: 24px;">
                                <h2 style="margin: 0 0 16px 0; font-size: 18px; font-weight: 600; color: #ffffff;">
                                    Transaction Details
                                </h2>
                                
                                <table style="width: 100%; border-collapse: collapse;">
                                    <tr>
                                        <td style="padding: 12px 0; color: #9ca3af; border-bottom: 1px solid #30333A;">Credits Purchased</td>
                                        <td style="padding: 12px 0; text-align: right; color: #10b981; font-weight: 700; font-size: 18px; border-bottom: 1px solid #30333A;">${config.credits} ⚡</td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 12px 0; color: #9ca3af; border-bottom: 1px solid #30333A;">Amount Charged</td>
                                        <td style="padding: 12px 0; text-align: right; color: #ffffff; border-bottom: 1px solid #30333A;">€${config.amount.toFixed(2)}</td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 12px 0; color: #9ca3af; border-bottom: 1px solid #30333A;">Payment Method</td>
                                        <td style="padding: 12px 0; text-align: right; color: #ffffff; border-bottom: 1px solid #30333A;">${config.paymentMethod}</td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 12px 0; color: #9ca3af;">Transaction ID</td>
                                        <td style="padding: 12px 0; text-align: right; color: #9ca3af; font-family: monospace; font-size: 12px;">${config.transactionId}</td>
                                    </tr>
                                </table>
                            </div>
                            
                            <!-- New Balance -->
                            <div style="background-color: #1E1E1E; border-radius: 8px; padding: 24px; margin-bottom: 24px; text-align: center; border: 1px solid #FDD458;">
                                <p style="margin: 0 0 8px 0; font-size: 14px; color: #9ca3af; text-transform: uppercase;">Your New Balance</p>
                                <p style="margin: 0; font-size: 32px; font-weight: 700; color: #FDD458;">${config.newBalance.toFixed(0)} ⚡</p>
                            </div>
                            
                            <!-- What's Next -->
                            <div style="background-color: #050505; border-radius: 8px; padding: 20px; margin-bottom: 24px; border: 1px solid #30333A;">
                                <h3 style="margin: 0 0 12px 0; font-size: 16px; font-weight: 600; color: #FDD458;">
                                    ${template.featureListLabel || "What's Next?"}
                                </h3>
                                <ul style="margin: 0; padding-left: 20px; color: #CCDADC; font-size: 14px; line-height: 1.8;">
                                    ${featureListHtml}
                                </ul>
                            </div>
                            
                            <!-- Closing Text -->
                            ${template.closingText ? `<p style="margin: 0 0 24px 0; font-size: 16px; line-height: 1.6; color: #CCDADC;">${template.closingText}</p>` : ''}
                            
                            <!-- CTA Button -->
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                <tr>
                                    <td align="center">
                                        <a href="${ctaUrl}" style="display: inline-block; background: linear-gradient(135deg, #FDD458 0%, #E8BA40 100%); color: #000000; text-decoration: none; padding: 16px 32px; border-radius: 8px; font-size: 16px; font-weight: 500; line-height: 1;">
                                            ${template.ctaButtonText || 'Start Competing Now'}
                                        </a>
                                    </td>
                                </tr>
                            </table>
                            
                        </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                        <td style="padding: 20px 40px 40px 40px; border-top: 1px solid #30333A;">
                            <p style="margin: 0 0 10px 0; font-size: 12px; color: #6b7280; text-align: center;">
                                ${config.companyAddress}
                            </p>
                            <p style="margin: 0; font-size: 12px; color: #6b7280; text-align: center;">
                                © ${new Date().getFullYear()} ${config.platformName} | <a href="${config.baseUrl}" style="color: #CCDADC !important; text-decoration: underline;">Visit Website</a>
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

/**
 * Send deposit completed email to user
 */
export const sendDepositCompletedEmail = async (data: DepositCompletedEmailData) => {
    try {
        await connectToDatabase();
        
        // Get settings and template
        const [companySettings, settings, whiteLabelSettings, template] = await Promise.all([
            CompanySettings.getSingleton(),
            getSettings(),
            WhiteLabel.findOne(),
            getEmailTemplate('deposit_completed'),
        ]);
        
        // Check if template is active
        if (!template.isActive) {
            console.log(`ℹ️ [DEPOSIT] Email template is disabled, skipping email to ${data.email}`);
            return;
        }
        
        const platformName = settings.appName || companySettings.companyName || 'Chatvolt';
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
        const isLocalhost = baseUrl.includes('localhost') || baseUrl.includes('127.0.0.1');
        
        // Get logo URL
        let logoUrl = whiteLabelSettings?.emailLogo || '/assets/images/logo.png';
        if (!logoUrl.startsWith('http')) {
            if (isLocalhost) {
                logoUrl = 'https://placehold.co/150x50/141414/FDD458?text=Logo';
            } else {
                logoUrl = `${baseUrl}${logoUrl}`;
            }
        }
        
        // Build company address
        let companyAddress = '';
        if (companySettings.addressLine1 || companySettings.city) {
            const parts = [
                companySettings.addressLine1,
                companySettings.addressLine2,
                companySettings.city,
                companySettings.postalCode,
                COUNTRY_NAMES[companySettings.country] || companySettings.country,
            ].filter(Boolean);
            companyAddress = parts.join(', ');
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
        let subject = template.subject || '✓ Deposit Confirmed - {{credits}} credits added to your account';
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
        
        console.log(`✅ [DEPOSIT] Email sent to ${data.email} for ${data.credits} credits`);
    } catch (error) {
        console.error('❌ [DEPOSIT] Failed to send deposit email:', error);
        // Don't throw - we don't want to fail the deposit if email fails
    }
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
 * Build withdrawal completed email HTML from database template
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
    }
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
        'Check your bank account or card statement for the incoming transfer',
        'Allow 3-5 business days for the funds to appear',
        'Contact support if you haven\'t received it after 7 days',
    ];
    
    const featureListHtml = featureItems
        .map((item: string) => `<li style="margin-bottom: 12px;">${item}</li>`)
        .join('\n                                ');
    
    // Get the CTA URL
    let ctaUrl = template.ctaButtonUrl || `${config.baseUrl}/wallet`;
    ctaUrl = ctaUrl.replace(/\{\{baseUrl\}\}/g, config.baseUrl);
    
    // Build the dynamic template using database values
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Withdrawal Processed - ${config.platformName}</title>
    <style type="text/css">
        @media only screen and (max-width: 600px) {
            .email-container { width: 100% !important; margin: 0 !important; }
            .mobile-padding { padding: 24px !important; }
        }
    </style>
</head>
<body style="margin: 0; padding: 0; background-color: #050505; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #050505;">
        <tr>
            <td align="center" style="padding: 40px 20px;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" class="email-container" style="max-width: 600px; background-color: #141414; border-radius: 8px; border: 1px solid #30333A;">
                    
                    <!-- Header with Logo -->
                    <tr>
                        <td align="left" style="padding: 40px 40px 20px 40px;">
                            <img src="${config.logoUrl}" alt="${config.platformName}" width="150" style="max-width: 100%; height: auto;">
                        </td>
                    </tr>
                    
                    <!-- Main Content -->
                    <tr>
                        <td class="mobile-padding" style="padding: 20px 40px 40px 40px;">
                            
                            <!-- Success Banner -->
                            <div style="background: linear-gradient(135deg, #8B5CF6 0%, #7C3AED 100%); border-radius: 8px; padding: 24px; margin-bottom: 24px; text-align: center;">
                                <h1 style="margin: 0 0 8px 0; font-size: 24px; font-weight: 600; color: #ffffff;">
                                    ${template.headingText || '💸 Withdrawal Processed'}
                                </h1>
                                <p style="margin: 0; font-size: 14px; color: rgba(255,255,255,0.9);">
                                    Your funds are on the way
                                </p>
                            </div>
                            
                            <!-- Greeting -->
                            <p style="margin: 0 0 24px 0; font-size: 16px; line-height: 1.6; color: #CCDADC;">
                                Hi ${config.name},
                            </p>
                            
                            <p style="margin: 0 0 24px 0; font-size: 16px; line-height: 1.6; color: #CCDADC;">
                                ${template.introText || 'Your withdrawal request has been processed and your funds are on the way!'}
                            </p>
                            
                            <!-- Transaction Details -->
                            <div style="background-color: #1E1E1E; border-radius: 8px; padding: 24px; margin-bottom: 24px;">
                                <h2 style="margin: 0 0 16px 0; font-size: 18px; font-weight: 600; color: #ffffff;">
                                    Withdrawal Details
                                </h2>
                                
                                <table style="width: 100%; border-collapse: collapse;">
                                    <tr>
                                        <td style="padding: 12px 0; color: #9ca3af; border-bottom: 1px solid #30333A;">Credits Withdrawn</td>
                                        <td style="padding: 12px 0; text-align: right; color: #ffffff; font-weight: 600; border-bottom: 1px solid #30333A;">${config.credits} ⚡</td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 12px 0; color: #9ca3af; border-bottom: 1px solid #30333A;">Processing Fee</td>
                                        <td style="padding: 12px 0; text-align: right; color: #ef4444; border-bottom: 1px solid #30333A;">-€${config.fee.toFixed(2)}</td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 12px 0; color: #9ca3af; border-bottom: 1px solid #30333A;">Amount You Receive</td>
                                        <td style="padding: 12px 0; text-align: right; color: #10b981; font-weight: 700; font-size: 18px; border-bottom: 1px solid #30333A;">€${config.netAmount.toFixed(2)}</td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 12px 0; color: #9ca3af; border-bottom: 1px solid #30333A;">Payment Method</td>
                                        <td style="padding: 12px 0; text-align: right; color: #ffffff; border-bottom: 1px solid #30333A;">${config.paymentMethod}</td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 12px 0; color: #9ca3af;">Reference ID</td>
                                        <td style="padding: 12px 0; text-align: right; color: #9ca3af; font-family: monospace; font-size: 12px;">${config.withdrawalId}</td>
                                    </tr>
                                </table>
                            </div>
                            
                            <!-- Remaining Balance -->
                            <div style="background-color: #1E1E1E; border-radius: 8px; padding: 24px; margin-bottom: 24px; text-align: center; border: 1px solid #30333A;">
                                <p style="margin: 0 0 8px 0; font-size: 14px; color: #9ca3af; text-transform: uppercase;">Remaining Balance</p>
                                <p style="margin: 0; font-size: 32px; font-weight: 700; color: #FDD458;">${config.remainingBalance.toFixed(0)} ⚡</p>
                            </div>
                            
                            <!-- Timeline Info -->
                            <div style="background-color: #1E1E1E; border-radius: 8px; padding: 20px; margin-bottom: 24px; border-left: 4px solid #8B5CF6;">
                                <p style="margin: 0; font-size: 14px; color: #CCDADC;">
                                    ⏱️ ${config.timelineMessage}
                                </p>
                            </div>
                            
                            <!-- What's Next -->
                            <div style="background-color: #050505; border-radius: 8px; padding: 20px; margin-bottom: 24px; border: 1px solid #30333A;">
                                <h3 style="margin: 0 0 12px 0; font-size: 16px; font-weight: 600; color: #FDD458;">
                                    ${template.featureListLabel || "What's Next?"}
                                </h3>
                                <ul style="margin: 0; padding-left: 20px; color: #CCDADC; font-size: 14px; line-height: 1.8;">
                                    ${featureListHtml}
                                </ul>
                            </div>
                            
                            <!-- Closing Text -->
                            ${template.closingText ? `<p style="margin: 0 0 24px 0; font-size: 16px; line-height: 1.6; color: #CCDADC;">${template.closingText}</p>` : ''}
                            
                            <!-- CTA Button -->
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                <tr>
                                    <td align="center">
                                        <a href="${ctaUrl}" style="display: inline-block; background: linear-gradient(135deg, #FDD458 0%, #E8BA40 100%); color: #000000; text-decoration: none; padding: 16px 32px; border-radius: 8px; font-size: 16px; font-weight: 500; line-height: 1;">
                                            ${template.ctaButtonText || 'View Wallet'}
                                        </a>
                                    </td>
                                </tr>
                            </table>
                            
                            <!-- Support Note -->
                            ${config.supportEmail ? `
                            <p style="margin: 24px 0 0 0; font-size: 13px; color: #6b7280; text-align: center;">
                                Questions? Contact us at <a href="mailto:${config.supportEmail}" style="color: #FDD458; text-decoration: none;">${config.supportEmail}</a>
                            </p>
                            ` : ''}
                            
                        </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                        <td style="padding: 20px 40px 40px 40px; border-top: 1px solid #30333A;">
                            <p style="margin: 0 0 10px 0; font-size: 12px; color: #6b7280; text-align: center;">
                                ${config.companyAddress}
                            </p>
                            <p style="margin: 0; font-size: 12px; color: #6b7280; text-align: center;">
                                © ${new Date().getFullYear()} ${config.platformName} | <a href="${config.baseUrl}" style="color: #CCDADC !important; text-decoration: underline;">Visit Website</a>
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

/**
 * Send withdrawal completed email to user
 */
export const sendWithdrawalCompletedEmail = async (data: WithdrawalCompletedEmailData) => {
    console.log(`📧 [WITHDRAWAL] sendWithdrawalCompletedEmail called for ${data.email}`);
    
    try {
        await connectToDatabase();
        
        // Get settings and template
        const [companySettings, settings, whiteLabelSettings, template] = await Promise.all([
            CompanySettings.getSingleton(),
            getSettings(),
            WhiteLabel.findOne(),
            getEmailTemplate('withdrawal_completed'),
        ]);
        
        console.log(`📧 [WITHDRAWAL] Template found: ${template?.name || 'NONE'}, isActive: ${template?.isActive}`);
        
        // Check if template is active
        if (!template.isActive) {
            console.log(`⚠️ [WITHDRAWAL] Email template "withdrawal_completed" is DISABLED in admin settings, skipping email to ${data.email}`);
            console.log(`   → Go to Admin → Email Settings → Enable "withdrawal_completed" template`);
            return;
        }
        
        const platformName = settings.appName || companySettings.companyName || 'Chatvolt';
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
        const isLocalhost = baseUrl.includes('localhost') || baseUrl.includes('127.0.0.1');
        
        // Get logo URL
        let logoUrl = whiteLabelSettings?.emailLogo || '/assets/images/logo.png';
        if (!logoUrl.startsWith('http')) {
            if (isLocalhost) {
                logoUrl = 'https://placehold.co/150x50/141414/FDD458?text=Logo';
            } else {
                logoUrl = `${baseUrl}${logoUrl}`;
            }
        }
        
        // Build company address
        let companyAddress = '';
        if (companySettings.addressLine1 || companySettings.city) {
            const parts = [
                companySettings.addressLine1,
                companySettings.addressLine2,
                companySettings.city,
                companySettings.postalCode,
                COUNTRY_NAMES[companySettings.country] || companySettings.country,
            ].filter(Boolean);
            companyAddress = parts.join(', ');
        }
        
        // Get support email
        const supportEmail = companySettings.email || settings.nodemailerEmail || '';
        
        // Determine timeline message based on payment method
        let timelineMessage = 'Funds typically arrive within 3-5 business days, depending on your bank and payment method.';
        if (data.paymentMethod.toLowerCase().includes('card')) {
            timelineMessage = 'Card refunds typically arrive within 3-5 business days, depending on your card issuer.';
        } else if (data.paymentMethod.toLowerCase().includes('bank') || data.paymentMethod.toLowerCase().includes('sepa')) {
            timelineMessage = 'Bank transfers typically arrive within 3-5 business days, depending on your bank.';
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
        let subject = template.subject || '💸 Withdrawal Processed - €{{netAmount}} on the way';
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
        
        console.log(`✅ [WITHDRAWAL] Email sent to ${data.email} for €${data.netAmount.toFixed(2)}`);
    } catch (error) {
        console.error('❌ [WITHDRAWAL] Failed to send withdrawal email:', error);
        // Don't throw - we don't want to fail the withdrawal if email fails
    }
};
