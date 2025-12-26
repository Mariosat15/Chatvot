import { Schema, model, models, Document, Types } from 'mongoose';

// Test case status
export type TestStatus = 'pending' | 'running' | 'passed' | 'failed' | 'skipped';

// Individual test case result
export interface ITestCaseResult {
  id: string;
  category: string;
  name: string;
  description: string;
  status: TestStatus;
  startTime?: Date;
  endTime?: Date;
  duration?: number; // ms
  iterations: number;
  successCount: number;
  failureCount: number;
  errorMessage?: string;
  errorStack?: string;
  metrics: {
    avgResponseTime?: number;
    minResponseTime?: number;
    maxResponseTime?: number;
    p95ResponseTime?: number;
    p99ResponseTime?: number;
    throughput?: number; // requests per second
    errorRate?: number;
  };
}

// Hardware metrics at a point in time
export interface IHardwareMetrics {
  timestamp: Date;
  cpu: {
    usage: number; // percentage
    load: number[];
  };
  memory: {
    used: number; // bytes
    free: number;
    total: number;
    percentage: number;
  };
  disk?: {
    read: number; // bytes/sec
    write: number;
  };
  network?: {
    bytesIn: number;
    bytesOut: number;
  };
  database?: {
    connections: number;
    queryTime: number;
    activeQueries: number;
  };
}

// AI Analysis result
export interface IAIAnalysis {
  summary: string;
  performanceScore: number; // 0-100
  overallGrade?: string; // A, B, C, D, F
  productionReadiness?: 'ready' | 'needs_work' | 'not_ready';
  scalabilityAssessment?: {
    currentCapacity: string;
    scalingNeeds: string;
    limitingFactor: string;
  };
  findings: {
    type: 'success' | 'warning' | 'error' | 'info';
    title: string;
    description: string;
    recommendation?: string;
    priority?: 'high' | 'medium' | 'low';
    impact?: string;
  }[];
  bottlenecks: {
    component: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    description: string;
    evidence?: string;
    suggestedFix?: string;
    estimatedEffort?: string;
  }[];
  responseTimeAnalysis?: {
    assessment: string;
    p95Analysis: string;
    p99Analysis: string;
    outlierConcerns?: string;
  };
  resourceUtilization?: {
    cpuAssessment: string;
    memoryAssessment: string;
    databaseAssessment: string;
    headroom: string;
  };
  testCaseAnalysis?: {
    testName: string;
    verdict: string;
    analysis: string;
    improvementSuggestion?: string;
  }[];
  recommendations: (string | {
    title: string;
    description: string;
    priority?: string;
    effort?: string;
    impact?: string;
  })[];
  riskAssessment?: {
    productionRisks: string[];
    mitigations: string[];
  };
  nextSteps?: string[];
  generatedAt: Date;
}

export interface ISimulatorRun extends Document {
  configId: Types.ObjectId;
  configSnapshot: Record<string, unknown>; // Snapshot of config at run time
  
  // Run Status
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  startTime?: Date;
  endTime?: Date;
  duration?: number; // ms
  
  // Progress
  progress: {
    phase: string;
    currentStep: number;
    totalSteps: number;
    percentage: number;
    message: string;
  };
  
  // Test Results
  testCases: ITestCaseResult[];
  
  // Aggregate Metrics
  metrics: {
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    avgResponseTime: number;
    maxResponseTime: number;
    minResponseTime: number;
    p95ResponseTime: number;
    p99ResponseTime: number;
    requestsPerSecond: number;
    errorRate: number;
    
    // Entity counts
    usersCreated: number;
    competitionsCreated: number;
    challengesCreated: number;
    tradesExecuted: number;
    depositsProcessed: number;
    withdrawalsProcessed: number;
  };
  
  // Hardware Metrics (sampled)
  hardwareMetrics: IHardwareMetrics[];
  
  // Peak Hardware Usage
  peakMetrics: {
    maxCpuUsage: number;
    maxMemoryUsage: number;
    maxDbConnections: number;
    maxQueryTime: number;
  };
  
  // AI Analysis
  aiAnalysis?: IAIAnalysis;
  
  // Logs (last N entries)
  logs: {
    timestamp: Date;
    level: 'info' | 'warn' | 'error' | 'debug';
    message: string;
    details?: Record<string, unknown>;
  }[];
  
  // Cleanup Info
  testDataIds: {
    users: string[];
    competitions: string[];
    challenges: string[];
    positions: string[];
    transactions: string[];
  };
  
  cleanedUp: boolean;
  cleanedUpAt?: Date;
  
  createdAt: Date;
  updatedAt: Date;
}

const SimulatorRunSchema = new Schema<ISimulatorRun>({
  configId: { type: Schema.Types.ObjectId, ref: 'SimulatorConfig', required: true },
  configSnapshot: { type: Object, required: true },
  
  status: { 
    type: String, 
    enum: ['pending', 'running', 'completed', 'failed', 'cancelled'],
    default: 'pending'
  },
  startTime: Date,
  endTime: Date,
  duration: Number,
  
  progress: {
    phase: { type: String, default: 'Initializing' },
    currentStep: { type: Number, default: 0 },
    totalSteps: { type: Number, default: 0 },
    percentage: { type: Number, default: 0 },
    message: { type: String, default: 'Preparing simulation...' },
  },
  
  testCases: [{
    id: String,
    category: String,
    name: String,
    description: String,
    status: { type: String, enum: ['pending', 'running', 'passed', 'failed', 'skipped'], default: 'pending' },
    startTime: Date,
    endTime: Date,
    duration: Number,
    iterations: { type: Number, default: 0 },
    successCount: { type: Number, default: 0 },
    failureCount: { type: Number, default: 0 },
    errorMessage: String,
    errorStack: String,
    metrics: {
      avgResponseTime: Number,
      minResponseTime: Number,
      maxResponseTime: Number,
      p95ResponseTime: Number,
      p99ResponseTime: Number,
      throughput: Number,
      errorRate: Number,
    },
  }],
  
  metrics: {
    totalRequests: { type: Number, default: 0 },
    successfulRequests: { type: Number, default: 0 },
    failedRequests: { type: Number, default: 0 },
    avgResponseTime: { type: Number, default: 0 },
    maxResponseTime: { type: Number, default: 0 },
    minResponseTime: { type: Number, default: Infinity },
    p95ResponseTime: { type: Number, default: 0 },
    p99ResponseTime: { type: Number, default: 0 },
    requestsPerSecond: { type: Number, default: 0 },
    errorRate: { type: Number, default: 0 },
    usersCreated: { type: Number, default: 0 },
    competitionsCreated: { type: Number, default: 0 },
    challengesCreated: { type: Number, default: 0 },
    tradesExecuted: { type: Number, default: 0 },
    depositsProcessed: { type: Number, default: 0 },
    withdrawalsProcessed: { type: Number, default: 0 },
  },
  
  hardwareMetrics: [{
    timestamp: Date,
    cpu: {
      usage: Number,
      load: [Number],
    },
    memory: {
      used: Number,
      free: Number,
      total: Number,
      percentage: Number,
    },
    disk: {
      read: Number,
      write: Number,
    },
    network: {
      bytesIn: Number,
      bytesOut: Number,
    },
    database: {
      connections: Number,
      queryTime: Number,
      activeQueries: Number,
    },
  }],
  
  peakMetrics: {
    maxCpuUsage: { type: Number, default: 0 },
    maxMemoryUsage: { type: Number, default: 0 },
    maxDbConnections: { type: Number, default: 0 },
    maxQueryTime: { type: Number, default: 0 },
  },
  
  aiAnalysis: {
    summary: String,
    performanceScore: Number,
    overallGrade: String,
    productionReadiness: { type: String, enum: ['ready', 'needs_work', 'not_ready'] },
    scalabilityAssessment: {
      currentCapacity: String,
      scalingNeeds: String,
      limitingFactor: String,
    },
    findings: [{
      type: { type: String, enum: ['success', 'warning', 'error', 'info'] },
      title: String,
      description: String,
      recommendation: String,
      priority: { type: String, enum: ['high', 'medium', 'low'] },
      impact: String,
    }],
    bottlenecks: [{
      component: String,
      severity: { type: String, enum: ['low', 'medium', 'high', 'critical'] },
      description: String,
      evidence: String,
      suggestedFix: String,
      estimatedEffort: String,
    }],
    responseTimeAnalysis: {
      assessment: String,
      p95Analysis: String,
      p99Analysis: String,
      outlierConcerns: String,
    },
    resourceUtilization: {
      cpuAssessment: String,
      memoryAssessment: String,
      databaseAssessment: String,
      headroom: String,
    },
    testCaseAnalysis: [{
      testName: String,
      verdict: String,
      analysis: String,
      improvementSuggestion: String,
    }],
    recommendations: { type: Schema.Types.Mixed }, // Supports both strings and objects
    riskAssessment: {
      productionRisks: [String],
      mitigations: [String],
    },
    nextSteps: [String],
    generatedAt: Date,
  },
  
  logs: [{
    timestamp: { type: Date, default: Date.now },
    level: { type: String, enum: ['info', 'warn', 'error', 'debug'], default: 'info' },
    message: String,
    details: Object,
  }],
  
  testDataIds: {
    users: [String],
    competitions: [String],
    challenges: [String],
    positions: [String],
    transactions: [String],
  },
  
  cleanedUp: { type: Boolean, default: false },
  cleanedUpAt: Date,
}, {
  timestamps: true,
});

// Index for efficient queries
SimulatorRunSchema.index({ status: 1, createdAt: -1 });
SimulatorRunSchema.index({ configId: 1 });

const SimulatorRun = models.SimulatorRun || model<ISimulatorRun>('SimulatorRun', SimulatorRunSchema);

export default SimulatorRun;

