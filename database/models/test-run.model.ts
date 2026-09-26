import { Schema, model, models, Document } from "mongoose";

export interface ITestResult {
  name: string;
  suite: string;
  status: "passed" | "failed" | "skipped";
  duration: number;
  error?: string;
}

export interface ITestRun extends Document {
  status: "pending" | "running" | "passed" | "failed" | "error";
  trigger: "manual" | "scheduled" | "ci";
  startedAt: Date;
  completedAt?: Date;
  duration?: number;
  totalTests: number;
  passed: number;
  failed: number;
  skipped: number;
  testResults: ITestResult[];
  rawOutput?: string;
  errorMessage?: string;
  triggeredBy?: string;
  scheduleId?: string;
  suites?: string[];
}

const TestResultSchema = new Schema<ITestResult>(
  {
    name: { type: String, required: true },
    suite: { type: String, required: true },
    status: { type: String, enum: ["passed", "failed", "skipped"], required: true },
    duration: { type: Number, default: 0 },
    error: { type: String },
  },
  { _id: false },
);

const TestRunSchema = new Schema<ITestRun>(
  {
    status: {
      type: String,
      enum: ["pending", "running", "passed", "failed", "error"],
      default: "pending",
    },
    trigger: {
      type: String,
      enum: ["manual", "scheduled", "ci"],
      required: true,
    },
    startedAt: { type: Date, default: Date.now },
    completedAt: { type: Date },
    duration: { type: Number },
    totalTests: { type: Number, default: 0 },
    passed: { type: Number, default: 0 },
    failed: { type: Number, default: 0 },
    skipped: { type: Number, default: 0 },
    testResults: [TestResultSchema],
    rawOutput: { type: String },
    errorMessage: { type: String },
    triggeredBy: { type: String },
    scheduleId: { type: String },
    suites: [{ type: String }],
  },
  { timestamps: true },
);

TestRunSchema.index({ status: 1, createdAt: -1 });
TestRunSchema.index({ trigger: 1 });

const TestRun = models.TestRun || model<ITestRun>("TestRun", TestRunSchema);
export default TestRun;
