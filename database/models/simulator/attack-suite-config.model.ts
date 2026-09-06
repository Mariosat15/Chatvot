import { Schema, model, models, Document } from "mongoose";

// Reason: DB-driven config for the Attack Suite so admins can enable/disable
// the feature and rotate the inter-service secret from the admin UI without
// touching env vars or redeploying. A single document (enforced via a fixed
// slug) lives in this collection; all reads/writes go through
// attack-suite-config.service.ts.

export interface IAttackSuiteConfig extends Document {
  slug: "attack-suite"; // Reason: enforce singleton via unique index
  enabled: boolean;
  secret: string | null; // 32-byte hex; null when never set / cleared
  secretSetAt?: Date | null;
  updatedBy?: {
    adminId: string;
    email: string;
    name?: string;
  } | null;
  updatedAt: Date;
  createdAt: Date;
}

const AttackSuiteConfigSchema = new Schema<IAttackSuiteConfig>(
  {
    slug: {
      type: String,
      required: true,
      unique: true,
      default: "attack-suite",
      enum: ["attack-suite"],
    },
    enabled: {
      type: Boolean,
      required: true,
      default: false,
    },
    secret: {
      type: String,
      default: null,
      // Reason: stored in plain text inside MongoDB because both the admin app
      // and the main app must be able to read it to verify inter-service
      // requests. This is an internal shared secret, not a credential a user
      // supplies — protect it via DB access control, not hashing.
    },
    secretSetAt: {
      type: Date,
      default: null,
    },
    updatedBy: {
      type: new Schema(
        {
          adminId: { type: String, required: true },
          email: { type: String, required: true },
          name: { type: String },
        },
        { _id: false },
      ),
      default: null,
    },
  },
  {
    timestamps: true,
    collection: "attack_suite_configs",
  },
);

export const AttackSuiteConfig =
  models.AttackSuiteConfig ||
  model<IAttackSuiteConfig>("AttackSuiteConfig", AttackSuiteConfigSchema);
