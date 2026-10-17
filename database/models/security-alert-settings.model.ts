/**
 * Retention settings for SecurityAlert documents (Dev Zone → Command Alerts).
 *
 * Singleton row. Auto-purge is off until an operator turns it on; the worker job
 * reads this once a day and deletes alerts older than `retentionDays`.
 *
 * Not mirrored — admin-only ops concern; the main app only writes alerts.
 */

import { Schema, model, models, Document } from "mongoose";

export const SECURITY_ALERT_RETENTION_DAYS = [1, 5, 7, 30] as const;
export type SecurityAlertRetentionDays =
  (typeof SECURITY_ALERT_RETENTION_DAYS)[number];

export interface ISecurityAlertSettings extends Document {
  /** Singleton key — always "default". */
  key: string;
  /** When false, the purge job is a no-op. */
  autoDeleteEnabled: boolean;
  /** How old an alert must be before auto-delete removes it. */
  retentionDays: SecurityAlertRetentionDays;
  updatedAt: Date;
  createdAt: Date;
}

const SecurityAlertSettingsSchema = new Schema<ISecurityAlertSettings>(
  {
    key: { type: String, required: true, unique: true, default: "default" },
    autoDeleteEnabled: { type: Boolean, default: false },
    retentionDays: {
      type: Number,
      enum: [...SECURITY_ALERT_RETENTION_DAYS],
      default: 7,
    },
  },
  { timestamps: true, collection: "security_alert_settings" },
);

const SecurityAlertSettings =
  models.SecurityAlertSettings ||
  model<ISecurityAlertSettings>(
    "SecurityAlertSettings",
    SecurityAlertSettingsSchema,
  );

export default SecurityAlertSettings;
