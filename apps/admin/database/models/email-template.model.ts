import mongoose, { Schema, Document } from 'mongoose';

export interface IEmailTemplate extends Document {
  templateType: 'welcome' | 'price_alert' | 'invoice' | 'news_summary' | 'inactive_reminder' | 'deposit_completed' | 'withdrawal_completed' | 'email_verification' | 'account_manager_assigned' | 'account_manager_changed';
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
    enum: ['welcome', 'price_alert', 'invoice', 'news_summary', 'inactive_reminder', 'deposit_completed', 'withdrawal_completed', 'email_verification', 'account_manager_assigned', 'account_manager_changed'],
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
    // Create default template with proper defaults for each type
    const defaults = getTemplateDefaults(templateType);
    template = await EmailTemplate.create({
      templateType,
      ...defaults,
    });
  }
  
  return template;
}

function getTemplateDefaults(type: string): Partial<IEmailTemplate> {
  switch (type) {
    case 'deposit_completed':
      return {
        name: 'Deposit Completed Email',
        subject: '✓ Deposit Confirmed - {{credits}} credits added to your account',
        headingText: '✓ Deposit Successful!',
        introText: 'Great news! Your deposit has been processed successfully and your credits are ready to use.',
        featureListLabel: "What's Next?",
        featureItems: [
          'Browse active competitions and join one that matches your style',
          'Challenge other traders in head-to-head matches',
          'Climb the leaderboard and win real prizes!',
        ],
        closingText: '',
        ctaButtonText: 'Start Competing Now',
        ctaButtonUrl: '{{baseUrl}}/competitions',
        useAIPersonalization: false,
      };
    
    case 'withdrawal_completed':
      return {
        name: 'Withdrawal Completed Email',
        subject: '💸 Withdrawal Processed - €{{netAmount}} on the way',
        headingText: '💸 Withdrawal Processed',
        introText: 'Your withdrawal request has been processed and your funds are on the way!',
        featureListLabel: "What's Next?",
        featureItems: [
          'Check your bank account or card statement for the incoming transfer',
          'Allow 3-5 business days for the funds to appear',
          'Contact support if you haven\'t received it after 7 days',
        ],
        closingText: '',
        ctaButtonText: 'View Wallet',
        ctaButtonUrl: '{{baseUrl}}/wallet',
        useAIPersonalization: false,
      };
    
    case 'welcome':
      return {
        name: 'Welcome Email',
        subject: 'Welcome to {{platformName}} - Start competing and win real prizes!',
        headingText: 'Welcome aboard {{name}}',
        introText: 'Thanks for joining! You now have access to our trading competition platform where you can compete against other traders and win real prizes.',
        featureListLabel: "Here's what you can do right now:",
        featureItems: [
          'Deposit credits to your wallet and enter trading competitions',
          'Compete in live trading competitions with real-time market prices',
          'Climb the leaderboard by trading smarter and win cash prizes',
        ],
        closingText: "Competitions run daily with prize pools waiting to be won. The top traders take home real money — will you be one of them?",
        ctaButtonText: 'View Competitions',
        ctaButtonUrl: '{{baseUrl}}/competitions',
        useAIPersonalization: true,
      };
    
    case 'price_alert':
      return { name: 'Price Alert Email' };
    
    case 'invoice':
      return { name: 'Invoice Email' };
    
    case 'news_summary':
      return { name: 'News Summary Email' };
    
    case 'inactive_reminder':
      return { name: 'Inactive User Reminder' };
    
    case 'account_manager_assigned':
      return {
        name: 'Account Manager Assigned',
        subject: '🎉 Meet Your Dedicated Account Manager at {{platformName}}',
        headingText: '👋 Welcome to Personalized Support!',
        introText: 'Great news! You have been assigned a dedicated account manager who will be your primary point of contact for all your needs.',
        featureListLabel: 'Your Account Manager',
        featureItems: [
          '{{managerFirstName}} will assist you with any questions about your account',
          'Get personalized guidance for competitions and trading',
          'Receive priority support whenever you need help',
        ],
        closingText: 'Feel free to reach out through the messaging feature in your account. {{managerFirstName}} is here to help you succeed!',
        ctaButtonText: 'Send a Message',
        ctaButtonUrl: '{{baseUrl}}/messaging',
        useAIPersonalization: false,
      };
    
    case 'account_manager_changed':
      return {
        name: 'Account Manager Changed',
        subject: '🔄 Your Account Manager Has Changed at {{platformName}}',
        headingText: '👋 Meet Your New Account Manager',
        introText: 'We wanted to let you know that your account has been reassigned to a new account manager who will be taking care of your needs going forward.',
        featureListLabel: 'Your New Account Manager',
        featureItems: [
          '{{newManagerFirstName}} is now your dedicated point of contact',
          'All your account history and preferences have been transferred',
          'You can reach out anytime through the messaging feature',
        ],
        closingText: '{{newManagerFirstName}} is excited to work with you and help you achieve your trading goals!',
        ctaButtonText: 'Say Hello',
        ctaButtonUrl: '{{baseUrl}}/messaging',
        useAIPersonalization: false,
      };
    
    default:
      return { name: 'Email Template' };
  }
}

