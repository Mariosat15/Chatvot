import { Schema, model, models, Document } from "mongoose";

export interface ITestSchedule extends Document {
  frequency: "manual" | "weekly" | "monthly";
  dayOfWeek: number;
  dayOfMonth: number;
  timeOfDay: string;
  timezone: string;
  isActive: boolean;
  lastRunAt?: Date;
  nextRunAt?: Date;
  suites?: string[];
}

const TestScheduleSchema = new Schema<ITestSchedule>(
  {
    frequency: {
      type: String,
      enum: ["manual", "weekly", "monthly"],
      default: "manual",
    },
    dayOfWeek: { type: Number, min: 0, max: 6, default: 0 },
    dayOfMonth: { type: Number, min: 1, max: 31, default: 1 },
    timeOfDay: { type: String, default: "00:00" },
    timezone: { type: String, default: "UTC" },
    isActive: { type: Boolean, default: false },
    lastRunAt: { type: Date },
    nextRunAt: { type: Date },
    suites: [{ type: String }],
  },
  { timestamps: true },
);

const TestSchedule =
  models.TestSchedule || model<ITestSchedule>("TestSchedule", TestScheduleSchema);
export default TestSchedule;
