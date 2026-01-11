import { Schema, model, models, type Document, type Model } from 'mongoose';

export interface WhiteLabelDocument extends Document {
  // App Branding
  appLogo: string;
  emailLogo: string;
  profileImage: string;
  dashboardPreview: string;
  favicon: string;
  
  // General Settings
  nodeEnv: string;
  nextPublicBaseUrl: string;
  
  // Email Configuration
  nodemailerEmail: string;
  nodemailerPassword: string;
  
  // API Keys & URLs
  massiveApiKey: string;
  nextPublicMassiveApiKey: string;
  
  // OpenAI Configuration
  openaiApiKey: string;
  openaiModel: string;
  openaiEnabled: boolean;
  openaiForEmails: boolean;
  
  // Database
  mongodbUri: string;
  
  // Authentication
  betterAuthSecret: string;
  betterAuthUrl: string;
  
  // Admin Credentials
  adminEmail: string;
  adminPassword: string;
  adminName: string;
  
  // Redis Configuration (Upstash)
  upstashRedisUrl: string;
  upstashRedisToken: string;
  redisEnabled: boolean;
  redisPriceSyncEnabled: boolean; // Enable for multi-server deployments
  
  // Inngest Configuration
  inngestSigningKey: string;
  inngestEventKey: string;
  inngestMode: 'dev' | 'cloud'; // dev = local dev server, cloud = Inngest Cloud (production)
  
  // Price Feed Configuration
  priceFeedMode: 'websocket' | 'api' | 'both'; // both = websocket primary, api fallback
  priceFeedWebsocketEnabled: boolean;
  priceFeedApiEnabled: boolean;
  priceFeedPrimarySource: 'websocket' | 'api'; // when both enabled, which is primary
  priceFeedUpdateInterval: number; // ms - how often to sync to Redis
  priceFeedCacheTTL: number; // ms - how long prices are valid in cache
  priceFeedClientPollInterval: number; // ms - how often client polls for prices
  priceFeedWebsocketReconnectAttempts: number; // max reconnect attempts
  priceFeedWebsocketReconnectDelay: number; // ms - base delay between reconnects
  priceFeedApiConcurrency: number; // max parallel API requests
  priceFeedFallbackEnabled: boolean; // auto-fallback to API if WebSocket fails
  
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
    favicon: {
      type: String,
      default: '/favicon.ico'
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
    massiveApiKey: { 
      type: String, 
      default: '' 
    },
    nextPublicMassiveApiKey: { 
      type: String, 
      default: '' 
    },
    
    // OpenAI Configuration
    openaiApiKey: {
      type: String,
      default: ''
    },
    openaiModel: {
      type: String,
      default: 'gpt-4o-mini' // Fast and cheap default
    },
    openaiEnabled: {
      type: Boolean,
      default: false // Disabled by default
    },
    openaiForEmails: {
      type: Boolean,
      default: false // AI for email personalization disabled by default
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
    
    // Redis Configuration (Upstash)
    upstashRedisUrl: {
      type: String,
      default: ''
    },
    upstashRedisToken: {
      type: String,
      default: ''
    },
    redisEnabled: {
      type: Boolean,
      default: false
    },
    redisPriceSyncEnabled: {
      type: Boolean,
      default: false // Enable only for multi-server deployments
    },
    
    // Inngest Configuration
    inngestSigningKey: {
      type: String,
      default: ''
    },
    inngestEventKey: {
      type: String,
      default: ''
    },
    inngestMode: {
      type: String,
      enum: ['dev', 'cloud'],
      default: 'dev' // Default to dev mode (local Inngest dev server)
    },
    
    // Price Feed Configuration
    priceFeedMode: {
      type: String,
      enum: ['websocket', 'api', 'both'],
      default: 'both' // both = websocket primary with api fallback
    },
    priceFeedWebsocketEnabled: {
      type: Boolean,
      default: true
    },
    priceFeedApiEnabled: {
      type: Boolean,
      default: true
    },
    priceFeedPrimarySource: {
      type: String,
      enum: ['websocket', 'api'],
      default: 'websocket'
    },
    priceFeedUpdateInterval: {
      type: Number,
      default: 2000 // 2 seconds - sync WebSocket cache to Redis
    },
    priceFeedCacheTTL: {
      type: Number,
      default: 10000 // 10 seconds - how long cached prices are valid
    },
    priceFeedClientPollInterval: {
      type: Number,
      default: 500 // 500ms - client polls every half second
    },
    priceFeedWebsocketReconnectAttempts: {
      type: Number,
      default: 10
    },
    priceFeedWebsocketReconnectDelay: {
      type: Number,
      default: 3000 // 3 seconds base delay
    },
    priceFeedApiConcurrency: {
      type: Number,
      default: 30 // fetch 30 pairs in parallel
    },
    priceFeedFallbackEnabled: {
      type: Boolean,
      default: true // auto-fallback to API if WebSocket fails
    },
  },
  { 
    timestamps: true 
  }
);

export const WhiteLabel: Model<WhiteLabelDocument> =
  (models?.WhiteLabel as Model<WhiteLabelDocument>) || 
  model<WhiteLabelDocument>('WhiteLabel', WhiteLabelSchema);

