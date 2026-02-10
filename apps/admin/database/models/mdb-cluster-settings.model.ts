import mongoose, { Schema, Document, Model } from "mongoose";

/**
 * MongoDB Cluster Settings Model (Singleton)
 * Controls connection pool sizes and cluster-level configuration.
 * Read by all processes (main app, worker, admin) on startup.
 *
 * Scaling guide:
 *   M10  → maxPoolSize 10, minPoolSize 2
 *   M30+ → maxPoolSize 25-50, minPoolSize 5
 *   M50+ → maxPoolSize 50-100, minPoolSize 10
 */

const SINGLETON_ID = "global-mdb-cluster-settings";

export interface IMdbClusterSettings extends Document {
  // Cluster info (display only)
  clusterTier: string; // e.g. "M10", "M30", "M50"
  clusterName: string; // e.g. "Chartvolt-Production"

  // Connection pool — main app process
  mainMaxPoolSize: number;
  mainMinPoolSize: number;

  // Connection pool — worker process
  workerMaxPoolSize: number;
  workerMinPoolSize: number;

  // Connection pool — admin process
  adminMaxPoolSize: number;
  adminMinPoolSize: number;

  // Timeouts (ms)
  serverSelectionTimeoutMS: number;
  socketTimeoutMS: number;
  connectTimeoutMS: number;
  maxIdleTimeMS: number;

  // Metadata
  lastUpdated: Date;
  updatedBy: string;
}

interface IMdbClusterSettingsModel extends Model<IMdbClusterSettings> {
  getSingleton(): Promise<IMdbClusterSettings>;
  updateSingleton(
    updates: Partial<IMdbClusterSettings>,
    updatedBy?: string,
  ): Promise<IMdbClusterSettings>;
}

const MdbClusterSettingsSchema = new Schema<IMdbClusterSettings>(
  {
    _id: {
      type: Schema.Types.Mixed,
      default: SINGLETON_ID,
    },

    // Cluster info
    clusterTier: {
      type: String,
      default: "M10",
    },
    clusterName: {
      type: String,
      default: "",
    },

    // Main app pool
    mainMaxPoolSize: {
      type: Number,
      default: 10,
      min: 1,
      max: 200,
    },
    mainMinPoolSize: {
      type: Number,
      default: 2,
      min: 0,
      max: 50,
    },

    // Worker pool
    workerMaxPoolSize: {
      type: Number,
      default: 5,
      min: 1,
      max: 100,
    },
    workerMinPoolSize: {
      type: Number,
      default: 1,
      min: 0,
      max: 20,
    },

    // Admin pool
    adminMaxPoolSize: {
      type: Number,
      default: 10,
      min: 1,
      max: 100,
    },
    adminMinPoolSize: {
      type: Number,
      default: 2,
      min: 0,
      max: 20,
    },

    // Timeouts
    serverSelectionTimeoutMS: {
      type: Number,
      default: 5000,
      min: 1000,
      max: 30000,
    },
    socketTimeoutMS: {
      type: Number,
      default: 30000,
      min: 5000,
      max: 120000,
    },
    connectTimeoutMS: {
      type: Number,
      default: 10000,
      min: 2000,
      max: 60000,
    },
    maxIdleTimeMS: {
      type: Number,
      default: 60000,
      min: 10000,
      max: 300000,
    },

    // Metadata
    lastUpdated: {
      type: Date,
      default: Date.now,
    },
    updatedBy: {
      type: String,
      default: "system",
    },
  },
  {
    timestamps: true,
  },
);

// Static method to get or create singleton
MdbClusterSettingsSchema.statics.getSingleton =
  async function (): Promise<IMdbClusterSettings> {
    let settings = await this.findById(SINGLETON_ID);
    if (!settings) {
      settings = await this.create({ _id: SINGLETON_ID });
    }
    return settings;
  };

// Static method to update singleton
MdbClusterSettingsSchema.statics.updateSingleton = async function (
  updates: Partial<IMdbClusterSettings>,
  updatedBy: string = "system",
): Promise<IMdbClusterSettings> {
  const settings = await this.findByIdAndUpdate(
    SINGLETON_ID,
    {
      ...updates,
      lastUpdated: new Date(),
      updatedBy,
    },
    {
      new: true,
      upsert: true,
      runValidators: true,
    },
  );
  return settings;
};

const MdbClusterSettings =
  (mongoose.models
    ?.MdbClusterSettings as unknown as IMdbClusterSettingsModel) ||
  mongoose.model<IMdbClusterSettings, IMdbClusterSettingsModel>(
    "MdbClusterSettings",
    MdbClusterSettingsSchema,
  );

export default MdbClusterSettings;
