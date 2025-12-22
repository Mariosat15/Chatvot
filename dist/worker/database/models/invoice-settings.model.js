"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = require("mongoose");
const InvoiceSettingsSchema = new mongoose_1.Schema({
    // VAT Configuration
    vatEnabled: {
        type: Boolean,
        default: true,
    },
    vatPercentage: {
        type: Number,
        default: 21, // Default EU VAT rate
        min: 0,
        max: 100,
    },
    vatLabel: {
        type: String,
        default: 'VAT',
    },
    // Invoice Numbering
    invoicePrefix: {
        type: String,
        default: 'INV-',
    },
    nextInvoiceNumber: {
        type: Number,
        default: 1,
    },
    invoiceNumberPadding: {
        type: Number,
        default: 6,
        min: 1,
        max: 10,
    },
    // Invoice Template Settings
    showLogo: {
        type: Boolean,
        default: true,
    },
    showCompanyAddress: {
        type: Boolean,
        default: true,
    },
    showBankDetails: {
        type: Boolean,
        default: true,
    },
    showVatNumber: {
        type: Boolean,
        default: true,
    },
    showRegistrationNumber: {
        type: Boolean,
        default: true,
    },
    // Custom Text
    invoiceTitle: {
        type: String,
        default: 'INVOICE',
    },
    invoiceFooter: {
        type: String,
        default: 'Thank you for your purchase!',
    },
    paymentTerms: {
        type: String,
        default: 'Payment received via credit card.',
    },
    thankYouMessage: {
        type: String,
        default: 'Thank you for your business!',
    },
    legalDisclaimer: {
        type: String,
        default: `**Nature of Purchase:** This invoice confirms the purchase of virtual credits/digital currency for use exclusively within our platform. These credits are non-transferable, have no cash value outside the platform, and cannot be exchanged for real currency or transferred to third parties.

**Refund Policy & Right of Withdrawal:** In accordance with Article 16(m) of the EU Consumer Rights Directive (2011/83/EU) and equivalent regulations, digital content supplied immediately upon purchase is exempt from the 14-day cooling-off period. By completing this purchase, you acknowledged and agreed that the digital credits would be available for immediate use, thereby waiving your right of withdrawal. Refunds are generally not available except where required by applicable law or at our sole discretion.

**VAT Information (EU Customers):** If applicable, VAT has been charged in accordance with EU VAT regulations. The VAT amount and rate are displayed on this invoice. For business customers with a valid VAT number, reverse charge rules may apply - please contact us for VAT-exempt invoicing.

**Data Protection (GDPR Compliance):** Your personal data is processed in accordance with the General Data Protection Regulation (GDPR) and our Privacy Policy. We collect and process only the data necessary to provide our services, process transactions, and comply with legal obligations. You have the right to access, rectify, erase, and port your data.

**Consumer Rights (EU/EEA Customers):** As an EU consumer, you have rights under EU consumer protection laws. These include the right to clear information before purchase, protection against unfair contract terms, and access to redress mechanisms. Nothing in this notice limits your statutory consumer rights.

**Non-EU Customers:** If you are located outside the European Union, your purchase is governed by the laws of our registered jurisdiction. Consumer protection rights vary by jurisdiction; please refer to your local laws for applicable protections.

**Dispute Resolution:** We aim to resolve any disputes amicably. EU consumers may use the European Commission's Online Dispute Resolution (ODR) platform at https://ec.europa.eu/consumers/odr.

**Terms of Service:** This purchase is subject to our full Terms of Service and User Agreement, which you accepted at registration.

**Record Retention:** Please retain this invoice for your records. This document serves as proof of your purchase and may be required for warranty claims, tax purposes, or dispute resolution.`,
    },
    showLegalDisclaimer: {
        type: Boolean,
        default: true,
    },
    // Email Settings
    sendInvoiceOnPurchase: {
        type: Boolean,
        default: true,
    },
    invoiceEmailSubject: {
        type: String,
        default: 'Your Invoice from {{companyName}} - {{invoiceNumber}}',
    },
    invoiceEmailBody: {
        type: String,
        default: 'Dear {{customerName}},\n\nThank you for your purchase! Please find your invoice attached.\n\nBest regards,\n{{companyName}}',
    },
    // Currency Display
    currencySymbol: {
        type: String,
        default: '€',
    },
    currencyPosition: {
        type: String,
        enum: ['before', 'after'],
        default: 'before',
    },
    // Styling
    primaryColor: {
        type: String,
        default: '#FDD458', // Brand yellow
    },
    accentColor: {
        type: String,
        default: '#141414',
    },
}, {
    timestamps: true,
});
// Static method to get singleton instance
InvoiceSettingsSchema.statics.getSingleton = async function () {
    let settings = await this.findOne();
    if (!settings) {
        settings = await this.create({});
    }
    return settings;
};
// Static method to get next invoice number and increment
InvoiceSettingsSchema.statics.getNextInvoiceNumber = async function () {
    const settings = await this.findOneAndUpdate({}, { $inc: { nextInvoiceNumber: 1 } }, { new: false, upsert: true });
    const currentNumber = settings?.nextInvoiceNumber || 1;
    const padding = settings?.invoiceNumberPadding || 6;
    const prefix = settings?.invoicePrefix || 'INV-';
    return `${prefix}${currentNumber.toString().padStart(padding, '0')}`;
};
const InvoiceSettings = mongoose_1.models?.InvoiceSettings ||
    (0, mongoose_1.model)('InvoiceSettings', InvoiceSettingsSchema);
exports.default = InvoiceSettings;
