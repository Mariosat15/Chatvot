"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WhiteLabel = void 0;
const mongoose_1 = require("mongoose");
const WhiteLabelSchema = new mongoose_1.Schema({
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
}, {
    timestamps: true
});
exports.WhiteLabel = mongoose_1.models?.WhiteLabel ||
    (0, mongoose_1.model)('WhiteLabel', WhiteLabelSchema);
