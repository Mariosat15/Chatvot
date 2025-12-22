"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = require("mongoose");
const InvoiceLineItemSchema = new mongoose_1.Schema({
    description: { type: String, required: true },
    quantity: { type: Number, required: true, default: 1 },
    unitPrice: { type: Number, required: true },
    total: { type: Number, required: true },
}, { _id: false });
const InvoiceSchema = new mongoose_1.Schema({
    // Invoice Identity
    invoiceNumber: {
        type: String,
        required: true,
        unique: true,
        index: true,
    },
    // Customer Information
    userId: {
        type: String,
        required: true,
        index: true,
    },
    customerName: {
        type: String,
        required: true,
    },
    customerEmail: {
        type: String,
        required: true,
    },
    customerAddress: {
        line1: String,
        line2: String,
        city: String,
        stateProvince: String,
        postalCode: String,
        country: String,
    },
    // Company Information
    companyName: {
        type: String,
        required: true,
    },
    companyAddress: {
        line1: { type: String, required: true },
        line2: String,
        city: { type: String, required: true },
        stateProvince: String,
        postalCode: { type: String, required: true },
        country: { type: String, required: true },
    },
    companyVatNumber: String,
    companyRegistrationNumber: String,
    companyEmail: { type: String, required: true },
    companyPhone: String,
    companyLogoUrl: String,
    // Financial Details
    subtotal: {
        type: Number,
        required: true,
    },
    vatRate: {
        type: Number,
        required: true,
        default: 0,
    },
    vatAmount: {
        type: Number,
        required: true,
        default: 0,
    },
    total: {
        type: Number,
        required: true,
    },
    currency: {
        type: String,
        required: true,
        default: 'EUR',
    },
    // Line Items
    lineItems: [InvoiceLineItemSchema],
    // Transaction Reference
    transactionId: {
        type: String,
        required: true,
        index: true,
    },
    transactionType: {
        type: String,
        enum: ['deposit', 'purchase', 'subscription'],
        required: true,
    },
    paymentMethod: String,
    paymentId: String,
    // Status
    status: {
        type: String,
        enum: ['draft', 'sent', 'paid', 'cancelled', 'refunded'],
        default: 'draft',
    },
    // Dates
    invoiceDate: {
        type: Date,
        default: Date.now,
    },
    dueDate: Date,
    sentAt: Date,
    paidAt: Date,
    // Notes
    notes: String,
    internalNotes: String,
}, {
    timestamps: true,
});
// Indexes
InvoiceSchema.index({ userId: 1, createdAt: -1 });
InvoiceSchema.index({ status: 1 });
InvoiceSchema.index({ invoiceDate: -1 });
const Invoice = mongoose_1.models?.Invoice ||
    (0, mongoose_1.model)('Invoice', InvoiceSchema);
exports.default = Invoice;
