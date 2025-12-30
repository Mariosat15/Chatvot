import mongoose, { Schema, Document } from 'mongoose';

export interface IEmailTemplate extends Document {
  templateType: 'welcome' | 'price_alert' | 'invoice' | 'news_summary' | 'inactive_reminder' | 'deposit_completed' | 'withdrawal_completed';
  name: string;
  subject: string;
  fromName: string;
  
  // Welcome email specific
  headingText: string;           // "Welcome aboard {{name}}"
  introText: string;             // Default intro if AI fails
  featureListLabel: string;      // "Here's what you can do right now:"
  featureItems: string[];        // Array of feature bullet points
  closingText: string;           // Text after feature list
  ctaButtonText: string;         // "Go to Dashboard"
  ctaButtonUrl: string;          // Dashboard URL
  footerAddress: string;         // Company address for footer
  footerLinks: {
    unsubscribeUrl: string;
    websiteUrl: string;
  };
  
  // AI Personalization
  useAIPersonalization: boolean;
  aiPersonalizationPrompt: string;
  
  // Template HTML (advanced users can customize)
  customHtmlTemplate: string;
  useCustomHtml: boolean;
  
  // Status
  isActive: boolean;
  
  createdAt: Date;
  updatedAt: Date;
}

const EmailTemplateSchema = new Schema<IEmailTemplate>({
  templateType: {
    type: String,
    enum: ['welcome', 'price_alert', 'invoice', 'news_summary', 'inactive_reminder', 'deposit_completed', 'withdrawal_completed'],
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

const EmailTemplate = mongoose.models.EmailTemplate || mongoose.model<IEmailTemplate>('EmailTemplate', EmailTemplateSchema);

export default EmailTemplate;

// Helper function to get or create default template
export async function getEmailTemplate(templateType: IEmailTemplate['templateType']): Promise<IEmailTemplate> {
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

function getDefaultName(type: string): string {
  const names: Record<string, string> = {
    welcome: 'Welcome Email',
    price_alert: 'Price Alert Email',
    invoice: 'Invoice Email',
    news_summary: 'News Summary Email',
    inactive_reminder: 'Inactive User Reminder',
    deposit_completed: 'Deposit Completed Email',
    withdrawal_completed: 'Withdrawal Completed Email',
  };
  return names[type] || 'Email Template';
}

