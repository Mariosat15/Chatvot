"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = require("mongoose");
const SimulatorRunSchema = new mongoose_1.Schema({
    configId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'SimulatorConfig', required: true },
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
        recommendations: { type: mongoose_1.Schema.Types.Mixed }, // Supports both strings and objects
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
const SimulatorRun = (mongoose_1.models.SimulatorRun || (0, mongoose_1.model)('SimulatorRun', SimulatorRunSchema));
exports.default = SimulatorRun;
