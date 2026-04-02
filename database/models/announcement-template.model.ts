import mongoose, { Document, Model, Schema } from "mongoose";
import type { AnnouncementType } from "./system-announcement.model";

export interface IAnnouncementTemplate extends Document {
  name: string;
  title: string;
  message: string;
  type: AnnouncementType;
  isDefault: boolean;
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

interface IAnnouncementTemplateModel extends Model<IAnnouncementTemplate> {
  seedDefaults(): Promise<void>;
}

const AnnouncementTemplateSchema = new Schema<IAnnouncementTemplate>(
  {
    name: { type: String, required: true, maxlength: 100 },
    title: { type: String, required: true, maxlength: 200 },
    message: { type: String, required: true, maxlength: 2000 },
    type: {
      type: String,
      enum: ["maintenance", "info", "warning", "critical", "update", "promotion"],
      default: "info",
    },
    isDefault: { type: Boolean, default: false },
    createdBy: { type: String },
  },
  { timestamps: true },
);

const DEFAULT_TEMPLATES = [
  {
    name: "Scheduled Maintenance",
    title: "Scheduled Maintenance",
    message:
      "We will be performing scheduled maintenance. The platform may be temporarily unavailable. We apologize for the inconvenience.",
    type: "maintenance" as const,
    isDefault: true,
  },
  {
    name: "Emergency Maintenance",
    title: "Emergency Maintenance in Progress",
    message:
      "We are currently performing emergency maintenance to resolve a critical issue. Some features may be temporarily unavailable. Thank you for your patience.",
    type: "critical" as const,
    isDefault: true,
  },
  {
    name: "Platform Update",
    title: "Platform Update Available",
    message:
      "We have released a new update with improvements and bug fixes. Refresh your browser to get the latest version.",
    type: "update" as const,
    isDefault: true,
  },
  {
    name: "Trading Hours Notice",
    title: "Trading Hours Update",
    message:
      "Please note that trading hours will be adjusted due to an upcoming market holiday. Check the Market Holidays section for details.",
    type: "info" as const,
    isDefault: true,
  },
  {
    name: "Welcome Promotion",
    title: "Special Promotion",
    message:
      "Take advantage of our limited-time promotion! Check the Competitions section for exciting new opportunities.",
    type: "promotion" as const,
    isDefault: true,
  },
  {
    name: "Service Degradation",
    title: "Service Degradation Notice",
    message:
      "We are currently experiencing some service degradation. Our team is actively working on a resolution. Core trading functionality remains available.",
    type: "warning" as const,
    isDefault: true,
  },
];

AnnouncementTemplateSchema.statics.seedDefaults = async function () {
  const existing = await this.countDocuments({ isDefault: true });
  if (existing === 0) {
    await this.insertMany(DEFAULT_TEMPLATES);
  }
};

const AnnouncementTemplate =
  (mongoose.models
    ?.AnnouncementTemplate as unknown as IAnnouncementTemplateModel) ||
  mongoose.model<IAnnouncementTemplate, IAnnouncementTemplateModel>(
    "AnnouncementTemplate",
    AnnouncementTemplateSchema,
  );

export default AnnouncementTemplate;
