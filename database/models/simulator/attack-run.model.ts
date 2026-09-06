import { Schema, model, models, Document } from "mongoose";

// Reason: Attack runs are distinct from performance simulations. They don't need
// hardware metrics, AI analysis, or entity counts. A dedicated lightweight model
// keeps the collection focused and avoids bloating the existing SimulatorRun
// schema with fields that would never be populated for security tests.

export type AttackScenarioStatus =
  | "pending"
  | "running"
  | "passed"
  | "failed"
  | "skipped";

export type AttackRunStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

export interface IAttackScenarioResult {
  id: string;
  name: string;
  description: string;
  status: AttackScenarioStatus;
  verdict?: string; // e.g., "PASS (rate limiter engaged at request 6)"
  assertions: {
    label: string;
    passed: boolean;
    detail?: string;
  }[];
  startTime?: Date;
  endTime?: Date;
  durationMs?: number;
  errorMessage?: string;
}

export interface IAttackRunLog {
  timestamp: Date;
  level: "info" | "warn" | "error";
  scenarioId?: string;
  message: string;
}

export interface IAttackRun extends Document {
  status: AttackRunStatus;
  startTime?: Date;
  endTime?: Date;
  durationMs?: number;

  progress: {
    phase: string;
    currentStep: number;
    totalSteps: number;
    percentage: number;
    message: string;
  };

  scenarios: IAttackScenarioResult[];
  logs: IAttackRunLog[];

  // Identifiers used by the run so cleanup can target only them
  testUserIds: string[];
  testIps: string[];

  // Admin who initiated the run (for audit trail)
  initiatedBy?: {
    adminId: string;
    email: string;
    name?: string;
  };

  summary?: {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
  };

  cleanedUp: boolean;
  cleanedUpAt?: Date;

  createdAt: Date;
  updatedAt: Date;
}

const AttackScenarioResultSchema = new Schema<IAttackScenarioResult>(
  {
    id: { type: String, required: true },
    name: { type: String, required: true },
    description: { type: String, default: "" },
    status: {
      type: String,
      enum: ["pending", "running", "passed", "failed", "skipped"],
      default: "pending",
    },
    verdict: String,
    assertions: [
      {
        label: { type: String, required: true },
        passed: { type: Boolean, required: true },
        detail: String,
      },
    ],
    startTime: Date,
    endTime: Date,
    durationMs: Number,
    errorMessage: String,
  },
  { _id: false },
);

const AttackRunLogSchema = new Schema<IAttackRunLog>(
  {
    timestamp: { type: Date, default: Date.now },
    level: {
      type: String,
      enum: ["info", "warn", "error"],
      default: "info",
    },
    scenarioId: String,
    message: { type: String, required: true },
  },
  { _id: false },
);

const AttackRunSchema = new Schema<IAttackRun>(
  {
    status: {
      type: String,
      enum: ["pending", "running", "completed", "failed", "cancelled"],
      default: "pending",
      index: true,
    },
    startTime: Date,
    endTime: Date,
    durationMs: Number,

    progress: {
      phase: { type: String, default: "Initializing" },
      currentStep: { type: Number, default: 0 },
      totalSteps: { type: Number, default: 0 },
      percentage: { type: Number, default: 0 },
      message: { type: String, default: "Preparing attack suite..." },
    },

    scenarios: [AttackScenarioResultSchema],
    logs: [AttackRunLogSchema],

    testUserIds: { type: [String], default: [] },
    testIps: { type: [String], default: [] },

    initiatedBy: {
      adminId: String,
      email: String,
      name: String,
    },

    summary: {
      total: Number,
      passed: Number,
      failed: Number,
      skipped: Number,
    },

    cleanedUp: { type: Boolean, default: false },
    cleanedUpAt: Date,
  },
  { timestamps: true },
);

AttackRunSchema.index({ createdAt: -1 });

const AttackRun =
  models.AttackRun || model<IAttackRun>("AttackRun", AttackRunSchema);

export default AttackRun;
