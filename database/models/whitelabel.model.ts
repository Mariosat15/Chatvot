import { Schema, model, models, type Document, type Model } from 'mongoose';

export interface WhiteLabelDocument extends Document {
  // App Branding
  appLogo: string;
  emailLogo: string;
  profileImage: string;
  dashboardPreview: string;
  
  // General Settings
  nodeEnv: string;
  nextPublicBaseUrl: string;
  
  // Email Configuration
  nodemailerEmail: string;
  nodemailerPassword: string;
  
  // API Keys & URLs
  geminiApiKey: string;
  massiveApiKey: string;
  nextPublicMassiveApiKey: string;
  
  // Database
  mongodbUri: string;
  
  // Authentication
  betterAuthSecret: string;
  betterAuthUrl: string;
  
  // Admin Credentials
  adminEmail: string;
  adminPassword: string;
  adminName: string;
  
  updatedAt: Date;
  createdAt: Date;
}

const WhiteLabelSchema = new Schema<WhiteLabelDocument>(
  {
    // App Branding
    appLogo: { 
      type: String, 
      default: '/assets/images/logo.png' 
    },
    emailLogo: { 
      type: String, 
      default: '/assets/images/logo.png' 
    },
    profileImage: { 
      type: String, 
      default: '/assets/images/PROFILE.png' 
    },
    dashboardPreview: { 
      type: String, 
      default: '/assets/images/dashboard-preview.png' 
    },
    
    // General Settings
    nodeEnv: { 
      type: String, 
      default: 'development' 
    },
    nextPublicBaseUrl: { 
      type: String, 
      default: 'http://localhost:3000' 
    },
    
    // Email Configuration
    nodemailerEmail: { 
      type: String, 
      default: '' 
    },
    nodemailerPassword: { 
      type: String, 
      default: '' 
    },
    
    // API Keys & URLs
    geminiApiKey: { 
      type: String, 
      default: '' 
    },
    massiveApiKey: { 
      type: String, 
      default: '' 
    },
    nextPublicMassiveApiKey: { 
      type: String, 
      default: '' 
    },
    
    // Database
    mongodbUri: { 
      type: String, 
      default: '' 
    },
    
    // Authentication
    betterAuthSecret: { 
      type: String, 
      default: '' 
    },
    betterAuthUrl: { 
      type: String, 
      default: 'http://localhost:3000' 
    },
    
    // Admin Credentials
    adminEmail: {
      type: String,
      default: ''
    },
    adminPassword: {
      type: String,
      default: ''
    },
    adminName: {
      type: String,
      default: 'Admin'
    },
  },
  { 
    timestamps: true 
  }
);

export const WhiteLabel: Model<WhiteLabelDocument> =
  (models?.WhiteLabel as Model<WhiteLabelDocument>) || 
  model<WhiteLabelDocument>('WhiteLabel', WhiteLabelSchema);

