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
Object.defineProperty(exports, "__esModule", { value: true });
exports.getEmailTemplate = getEmailTemplate;
const mongoose_1 = __importStar(require("mongoose"));
const EmailTemplateSchema = new mongoose_1.Schema({
    templateType: {
        type: String,
        enum: ['welcome', 'price_alert', 'invoice', 'news_summary', 'inactive_reminder'],
        required: true,
        unique: true,
    },
    name: {
        type: String,
        required: true,
        default: 'Welcome Email',
    },
    subject: {
        type: String,
        required: true,
        default: 'Welcome to {{platformName}} - Start competing and win real prizes!',
    },
    fromName: {
        type: String,
        required: true,
        default: '{{platformName}}',
    },
    // Welcome email specific fields
    headingText: {
        type: String,
        default: 'Welcome aboard {{name}}',
    },
    introText: {
        type: String,
        default: 'Thanks for joining! You now have access to our trading competition platform where you can compete against other traders and win real prizes.',
    },
    featureListLabel: {
        type: String,
        default: "Here's what you can do right now:",
    },
    featureItems: {
        type: [String],
        default: [
            'Deposit credits to your wallet and enter trading competitions',
            'Compete in live trading competitions with real-time market prices',
            'Climb the leaderboard by trading smarter and win cash prizes',
        ],
    },
    closingText: {
        type: String,
        default: "Competitions run daily with prize pools waiting to be won. The top traders take home real money — will you be one of them?",
    },
    ctaButtonText: {
        type: String,
        default: 'View Competitions',
    },
    ctaButtonUrl: {
        type: String,
        default: '{{baseUrl}}/competitions',
    },
    footerAddress: {
        type: String,
        default: '{{companyAddress}}',
    },
    footerLinks: {
        unsubscribeUrl: { type: String, default: '#' },
        websiteUrl: { type: String, default: '{{baseUrl}}' },
    },
    // AI Personalization
    useAIPersonalization: {
        type: Boolean,
        default: true,
    },
    aiPersonalizationPrompt: {
        type: String,
        default: `Generate a personalized welcome message for a new user joining a trading competition platform.

User profile:
{{userProfile}}

Platform info: This is a trading competition platform where users buy credits, enter competitions, trade forex/stocks with simulated capital, and win real cash prizes based on their performance.

Requirements:
- Write 2-3 sentences maximum
- Be warm and welcoming
- Reference any specific interests if mentioned
- Focus on the excitement of competing and winning
- Keep it professional but friendly
- Do NOT start with "Welcome" (already in heading)

Return only the message text, no HTML.`,
    },
    // Custom HTML Template
    customHtmlTemplate: {
        type: String,
        default: '',
    },
    useCustomHtml: {
        type: Boolean,
        default: false,
    },
    isActive: {
        type: Boolean,
        default: true,
    },
}, {
    timestamps: true,
});
// Note: unique: true on templateType already creates an index
const EmailTemplate = (mongoose_1.default.models.EmailTemplate || mongoose_1.default.model('EmailTemplate', EmailTemplateSchema));
exports.default = EmailTemplate;
// Helper function to get or create default template
async function getEmailTemplate(templateType) {
    let template = await EmailTemplate.findOne({ templateType });
    if (!template) {
        // Create default template
        template = await EmailTemplate.create({
            templateType,
            name: getDefaultName(templateType),
        });
    }
    return template;
}
function getDefaultName(type) {
    const names = {
        welcome: 'Welcome Email',
        price_alert: 'Price Alert Email',
        invoice: 'Invoice Email',
        news_summary: 'News Summary Email',
        inactive_reminder: 'Inactive User Reminder',
    };
    return names[type] || 'Email Template';
}
