/**
 * AI Agent Audit Log Model
 * 
 * Tracks all AI agent queries for compliance, security monitoring,
 * and cost tracking purposes.
 */

import mongoose, { Schema, model, models, Document } from 'mongoose';

export interface IAIAgentAudit extends Document {
  // Admin Info
  adminEmail: string;
  adminId?: string;
  
  // Request Info
  query: string; // The user's question (masked)
  messageCount: number; // Number of messages in conversation
  
  // Tools Used
  toolsCalled: {
    name: string;
    arguments: Record<string, any>; // Masked arguments
    executionTimeMs: number;
    success: boolean;
    error?: string;
  }[];
  
  // Response Info
  responseLength: number;
  resultCount: number; // Number of data results returned
  
  // Usage & Cost
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCost: number; // USD
  model: string;
  
  // Data Masking Info
  dataMasked: boolean;
  maskingSummary?: {
    totalMasked: number;
    types: Record<string, number>;
  };
  
  // Timestamps
  requestTimestamp: Date;
  responseTimestamp: Date;
  totalDurationMs: number;
  
  // IP & Session
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
  
  createdAt: Date;
}

const AIAgentAuditSchema = new Schema<IAIAgentAudit>({
  adminEmail: {
    type: String,
    required: true,
    index: true
  },
  adminId: String,
  
  query: {
    type: String,
    required: true
  },
  messageCount: {
    type: Number,
    default: 1
  },
  
  toolsCalled: [{
    name: String,
    arguments: Schema.Types.Mixed,
    executionTimeMs: Number,
    success: Boolean,
    error: String
  }],
  
  responseLength: Number,
  resultCount: {
    type: Number,
    default: 0
  },
  
  inputTokens: {
    type: Number,
    default: 0
  },
  outputTokens: {
    type: Number,
    default: 0
  },
  totalTokens: {
    type: Number,
    default: 0
  },
  estimatedCost: {
    type: Number,
    default: 0
  },
  model: String,
  
  dataMasked: {
    type: Boolean,
    default: true
  },
  maskingSummary: {
    totalMasked: Number,
    types: Schema.Types.Mixed
  },
  
  requestTimestamp: {
    type: Date,
    required: true
  },
  responseTimestamp: Date,
  totalDurationMs: Number,
  
  ipAddress: String,
  userAgent: String,
  sessionId: String
}, {
  timestamps: true,
  collection: 'aiagentaudits'
});

// Indexes for efficient querying
AIAgentAuditSchema.index({ createdAt: -1 });
AIAgentAuditSchema.index({ adminEmail: 1, createdAt: -1 });
AIAgentAuditSchema.index({ estimatedCost: -1 });
AIAgentAuditSchema.index({ 'toolsCalled.name': 1 });

const AIAgentAudit = models.AIAgentAudit || model<IAIAgentAudit>('AIAgentAudit', AIAgentAuditSchema);

export default AIAgentAudit;

