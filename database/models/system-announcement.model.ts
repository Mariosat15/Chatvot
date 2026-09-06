import mongoose, { Document, Model, Schema } from "mongoose";

export type AnnouncementType =
  | "maintenance"
  | "info"
  | "warning"
  | "critical"
  | "update"
  | "promotion";

export type AnnouncementStatus = "active" | "scheduled" | "expired" | "draft";

export interface ISystemAnnouncement extends Document {
  title: string;
  message: string;
  type: AnnouncementType;
  status: AnnouncementStatus;

  isActive: boolean;
  scheduledStart?: Date;
  scheduledEnd?: Date;

  dismissible: boolean;
  showCountdown: boolean;

  createdBy: string;
  createdByEmail: string;

  createdAt: Date;
  updatedAt: Date;
}

export interface ISystemAnnouncementModel extends Model<ISystemAnnouncement> {
  getActiveAnnouncements(): Promise<ISystemAnnouncement[]>;
}

const SystemAnnouncementSchema = new Schema<ISystemAnnouncement>(
  {
    title: { type: String, required: true, maxlength: 200 },
    message: { type: String, required: true, maxlength: 2000 },
    type: {
      type: String,
      enum: ["maintenance", "info", "warning", "critical", "update", "promotion"],
      default: "info",
    },
    status: {
      type: String,
      enum: ["active", "scheduled", "expired", "draft"],
      default: "draft",
    },
    isActive: { type: Boolean, default: false },
    scheduledStart: { type: Date },
    scheduledEnd: { type: Date },
    dismissible: { type: Boolean, default: true },
    showCountdown: { type: Boolean, default: false },
    createdBy: { type: String, required: true },
    createdByEmail: { type: String, required: true },
  },
  { timestamps: true },
);

SystemAnnouncementSchema.index({ status: 1, isActive: 1 });
SystemAnnouncementSchema.index({ scheduledStart: 1, scheduledEnd: 1 });

// Reason: Returns announcements that are either manually active or within
// their scheduled window. Called on every user page load (cached client-side).
SystemAnnouncementSchema.statics.getActiveAnnouncements = async function () {
  const now = new Date();
  return this.find({
    $or: [
      // Manually activated (no schedule)
      {
        isActive: true,
        status: "active",
        $or: [
          { scheduledEnd: { $exists: false } },
          { scheduledEnd: null },
          { scheduledEnd: { $gte: now } },
        ],
      },
      // Scheduled and currently within window
      {
        status: "scheduled",
        scheduledStart: { $lte: now },
        $or: [
          { scheduledEnd: { $exists: false } },
          { scheduledEnd: null },
          { scheduledEnd: { $gte: now } },
        ],
      },
    ],
  })
    .sort({ type: -1, createdAt: -1 })
    .limit(5)
    .lean();
};

const SystemAnnouncement =
  (mongoose.models
    ?.SystemAnnouncement as unknown as ISystemAnnouncementModel) ||
  mongoose.model<ISystemAnnouncement, ISystemAnnouncementModel>(
    "SystemAnnouncement",
    SystemAnnouncementSchema,
  );

export default SystemAnnouncement;
