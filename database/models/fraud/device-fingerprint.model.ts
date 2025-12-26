import { Schema, model, models, Document } from 'mongoose';

export interface IDeviceFingerprint extends Document {
  fingerprintId: string;
  userId: string;
  
  // Device information
  deviceType: 'desktop' | 'mobile' | 'tablet' | 'unknown';
  browser: string;
  browserVersion: string;
  os: string;
  osVersion: string;
  
  // Display information
  screenResolution: string;
  colorDepth: number;
  timezone: string;
  language: string;
  
  // Network information
  ipAddress: string;
  country?: string;
  city?: string;
  
  // Additional metadata
  userAgent: string;
  canvas?: string; // Canvas fingerprint
  webgl?: string;  // WebGL fingerprint
  webglVendor?: string;
  webglRenderer?: string;
  gpuInfo?: string;
  fonts?: string[]; // Installed fonts
  confidence?: number;
  
  // Enhanced Hardware Information (50+ data points)
  hardware?: {
    cpuCores?: number;
    deviceMemory?: number; // GB
    maxTouchPoints?: number;
    hardwareConcurrency?: number;
    screenOrientation?: string;
    pixelRatio?: number;
    touchSupport?: boolean;
    battery?: {
      charging?: boolean;
      level?: number; // percentage
    };
  };
  
  // Media Capabilities
  media?: {
    audioFormats?: string[]; // ['mp3', 'ogg', 'wav']
    videoFormats?: string[]; // ['mp4', 'webm', 'ogg']
    mediaDevices?: number;
  };
  
  // Browser Plugins
  plugins?: string[];
  
  // Storage Capabilities
  storage?: {
    localStorage?: boolean;
    sessionStorage?: boolean;
    indexedDB?: boolean;
    cookiesEnabled?: boolean;
  };
  
  // Browser Features
  features?: {
    webgl2?: boolean;
    webrtc?: boolean;
    geolocation?: boolean;
    notifications?: boolean;
    serviceWorker?: boolean;
    webAssembly?: boolean;
  };
  
  // Tracking
  firstSeen: Date;
  lastSeen: Date;
  timesUsed: number;
  
  // Linked accounts (suspicious if multiple)
  linkedUserIds: string[];
  
  // Flags
  isVPN: boolean;
  isProxy: boolean;
  isTor: boolean;
  riskScore: number; // 0-100, higher = more suspicious
  
  createdAt: Date;
  updatedAt: Date;
}

const DeviceFingerprintSchema = new Schema<IDeviceFingerprint>({
  fingerprintId: { 
    type: String, 
    required: true,
    index: true 
  },
  userId: { 
    type: String, 
    required: true,
    index: true 
  },
  
  // Device information
  deviceType: { 
    type: String, 
    enum: ['desktop', 'mobile', 'tablet', 'unknown'],
    default: 'unknown'
  },
  browser: { type: String, default: 'Unknown' },
  browserVersion: { type: String, default: 'Unknown' },
  os: { type: String, default: 'Unknown' },
  osVersion: { type: String, default: 'Unknown' },
  
  // Display information
  screenResolution: { type: String, default: 'Unknown' },
  colorDepth: { type: Number, default: 24 },
  timezone: { type: String, default: 'UTC' },
  language: { type: String, default: 'en' },
  
  // Network information
  ipAddress: { type: String, default: 'unknown' },
  country: String,
  city: String,
  
  // Additional metadata
  userAgent: { type: String, default: 'Unknown' },
  canvas: String,
  webgl: String,
  webglVendor: String,
  webglRenderer: String,
  gpuInfo: String,
  fonts: [String],
  confidence: Number,
  
  // Enhanced Hardware Information
  hardware: {
    cpuCores: Number,
    deviceMemory: Number,
    maxTouchPoints: Number,
    hardwareConcurrency: Number,
    screenOrientation: String,
    pixelRatio: Number,
    touchSupport: Boolean,
    battery: {
      charging: Boolean,
      level: Number
    }
  },
  
  // Media Capabilities
  media: {
    audioFormats: [String],
    videoFormats: [String],
    mediaDevices: Number
  },
  
  // Browser Plugins
  plugins: [String],
  
  // Storage Capabilities
  storage: {
    localStorage: Boolean,
    sessionStorage: Boolean,
    indexedDB: Boolean,
    cookiesEnabled: Boolean
  },
  
  // Browser Features
  features: {
    webgl2: Boolean,
    webrtc: Boolean,
    geolocation: Boolean,
    notifications: Boolean,
    serviceWorker: Boolean,
    webAssembly: Boolean
  },
  
  // Tracking
  firstSeen: { type: Date, default: Date.now },
  lastSeen: { type: Date, default: Date.now },
  timesUsed: { type: Number, default: 1 },
  
  // Linked accounts
  linkedUserIds: { type: [String], default: [] },
  
  // Flags
  isVPN: { type: Boolean, default: false },
  isProxy: { type: Boolean, default: false },
  isTor: { type: Boolean, default: false },
  riskScore: { type: Number, default: 0, min: 0, max: 100 },
}, {
  timestamps: true
});

// Indexes for fast queries
// Compound unique index: same fingerprintId can exist for different users (fraud detection)
// but same user can't have duplicate fingerprintIds
DeviceFingerprintSchema.index({ fingerprintId: 1, userId: 1 }, { unique: true });
DeviceFingerprintSchema.index({ ipAddress: 1 });
DeviceFingerprintSchema.index({ linkedUserIds: 1 });
DeviceFingerprintSchema.index({ riskScore: -1 });

const DeviceFingerprint = models.DeviceFingerprint || model<IDeviceFingerprint>('DeviceFingerprint', DeviceFingerprintSchema);

export default DeviceFingerprint;

