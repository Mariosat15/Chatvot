/**
 * AI Analyzer Service for Performance Simulator
 * 
 * Uses OpenAI to:
 * - Generate realistic trading patterns
 * - Analyze test results
 * - Identify bottlenecks
 * - Provide recommendations
 */

import OpenAI from 'openai';
import { ISimulatorRun, IAIAnalysis } from '../../../database/models/simulator/simulator-run.model';
import { connectToDatabase } from '../../../database/mongoose';
import { WhiteLabel } from '../../../database/models/whitelabel.model';

// Cache for API config
let cachedApiKey: string | null = null;
let cachedModel: string = 'gpt-4o-mini';
let cachedEnabled: boolean = false;

interface AIConfig {
  apiKey: string | null;
  model: string;
  enabled: boolean;
}

/**
 * Get AI configuration from database or environment
 */
async function getAIConfig(): Promise<AIConfig> {
  if (cachedApiKey !== null) {
    return { apiKey: cachedApiKey, model: cachedModel, enabled: cachedEnabled };
  }

  try {
    await connectToDatabase();
    const settings = await WhiteLabel.findOne();
    if (settings) {
      cachedApiKey = settings.openaiApiKey || null;
      cachedModel = settings.openaiModel || 'gpt-4o-mini';
      cachedEnabled = settings.openaiEnabled ?? false;
      return { apiKey: cachedApiKey, model: cachedModel, enabled: cachedEnabled };
    }
  } catch (error) {
    console.log('ℹ️ AI config not found in database, checking environment');
  }

  // Fallback to environment variables
  cachedApiKey = process.env.OPENAI_API_KEY || null;
  cachedModel = process.env.OPENAI_MODEL || 'gpt-4o-mini';
  cachedEnabled = process.env.OPENAI_ENABLED === 'true';
  return { apiKey: cachedApiKey, model: cachedModel, enabled: cachedEnabled };
}

/**
 * Initialize OpenAI client
 */
async function getOpenAIClient(): Promise<OpenAI | null> {
  const config = await getAIConfig();
  
  if (!config.enabled) {
    console.log('ℹ️ AI features are disabled');
    return null;
  }
  
  if (!config.apiKey) {
    console.log('ℹ️ No OpenAI API key configured');
    return null;
  }
  
  return new OpenAI({ apiKey: config.apiKey });
}

/**
 * Generate realistic trading patterns using AI
 */
export async function generateTradingPatterns(
  type: 'deposit_amounts' | 'trade_params' | 'user_behavior' | 'market_scenario'
): Promise<Record<string, unknown>> {
  const openai = await getOpenAIClient();
  if (!openai) {
    return getDefaultPatterns(type);
  }

  try {
    const config = await getAIConfig();
    const prompts: Record<string, string> = {
      deposit_amounts: `Generate a JSON array of realistic deposit amounts in EUR for a trading platform.
        Include a mix of small, medium, and large deposits that follow a typical user distribution.
        Return only valid JSON in this format: { "amounts": [10, 25, 50, 100, 250, 500, 1000] }`,

      trade_params: `Generate realistic trading parameters for a forex trade.
        Include lot size (0.01-1.0), leverage preference, and typical risk tolerance.
        Return only valid JSON in this format: { "lotSize": 0.1, "leverage": 10, "riskPercent": 2 }`,

      user_behavior: `Generate realistic user behavior patterns for a trading platform stress test.
        Include typical session duration, trades per session, and activity distribution.
        Return only valid JSON in this format: { 
          "avgSessionMinutes": 45, 
          "tradesPerSession": 5, 
          "peakHours": [9, 10, 14, 15],
          "inactivityChance": 0.2
        }`,

      market_scenario: `Generate a market stress scenario for testing a trading platform.
        Include volatility levels, price movement patterns, and extreme conditions.
        Return only valid JSON in this format: {
          "volatility": "high",
          "trendDirection": "bearish",
          "flashCrashChance": 0.05,
          "gapOpeningChance": 0.1
        }`,
    };

    const completion = await openai.chat.completions.create({
      model: config.model,
      messages: [
        { role: 'system', content: 'You are a trading platform expert. Return only valid JSON without markdown formatting.' },
        { role: 'user', content: prompts[type] }
      ],
      temperature: 0.7,
      max_tokens: 500,
    });

    const response = completion.choices[0]?.message?.content || '';
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }

    return getDefaultPatterns(type);
  } catch (error) {
    console.log('ℹ️ AI pattern generation unavailable, using defaults');
    return getDefaultPatterns(type);
  }
}

/**
 * Default patterns when AI is not available
 */
function getDefaultPatterns(type: string): Record<string, unknown> {
  const defaults: Record<string, Record<string, unknown>> = {
    deposit_amounts: { amounts: [10, 25, 50, 100, 250, 500, 1000] },
    trade_params: { lotSize: 0.1, leverage: 10, riskPercent: 2 },
    user_behavior: {
      avgSessionMinutes: 45,
      tradesPerSession: 5,
      peakHours: [9, 10, 14, 15],
      inactivityChance: 0.2,
    },
    market_scenario: {
      volatility: 'normal',
      trendDirection: 'neutral',
      flashCrashChance: 0,
      gapOpeningChance: 0,
    },
  };

  return defaults[type] || {};
}

/**
 * Analyze simulation results using AI
 */
export async function analyzeSimulationResults(run: ISimulatorRun): Promise<IAIAnalysis> {
  // Prepare analysis data
  const analysisData = {
    duration: run.duration,
    totalRequests: run.metrics.totalRequests,
    successRate: run.metrics.totalRequests > 0
      ? ((run.metrics.successfulRequests / run.metrics.totalRequests) * 100).toFixed(2)
      : 0,
    errorRate: run.metrics.errorRate.toFixed(2),
    avgResponseTime: run.metrics.avgResponseTime.toFixed(2),
    p95ResponseTime: run.metrics.p95ResponseTime.toFixed(2),
    p99ResponseTime: run.metrics.p99ResponseTime.toFixed(2),
    maxResponseTime: run.metrics.maxResponseTime.toFixed(2),
    requestsPerSecond: run.metrics.requestsPerSecond.toFixed(2),
    peakCpuUsage: run.peakMetrics.maxCpuUsage.toFixed(2),
    peakMemoryUsage: run.peakMetrics.maxMemoryUsage.toFixed(2),
    testCases: run.testCases.map(tc => ({
      name: tc.name,
      status: tc.status,
      successRate: tc.iterations > 0 ? ((tc.successCount / tc.iterations) * 100).toFixed(2) : 0,
      avgResponseTime: tc.metrics?.avgResponseTime?.toFixed(2) || 'N/A',
      errorMessage: tc.errorMessage,
    })),
    usersCreated: run.metrics.usersCreated,
    tradesExecuted: run.metrics.tradesExecuted,
    competitionsCreated: run.metrics.competitionsCreated,
    challengesCreated: run.metrics.challengesCreated,
  };

  const openai = await getOpenAIClient();
  if (!openai) {
    return generateBasicAnalysis(analysisData);
  }

  try {
    const config = await getAIConfig();
    const prompt = `You are a senior performance engineer analyzing load test results for a trading platform. Provide a comprehensive, detailed analysis.

## TEST RESULTS DATA:
${JSON.stringify(analysisData, null, 2)}

## REQUIRED OUTPUT FORMAT (JSON):
{
  "summary": "A detailed 4-5 sentence executive summary covering overall performance, key issues, and readiness for production",
  "performanceScore": 85,
  "overallGrade": "A|B|C|D|F",
  "productionReadiness": "ready|needs_work|not_ready",
  "scalabilityAssessment": {
    "currentCapacity": "Estimated concurrent users the system can handle",
    "scalingNeeds": "What needs to change to scale 10x",
    "limitingFactor": "The primary bottleneck preventing scaling"
  },
  "findings": [
    {
      "type": "success|warning|error|info",
      "title": "Clear descriptive title",
      "description": "Detailed explanation with specific numbers and context",
      "impact": "Business impact",
      "recommendation": "Specific actionable fix with implementation guidance",
      "priority": "high|medium|low"
    }
  ],
  "bottlenecks": [
    {
      "component": "Database|API|Memory|CPU|Network|Authentication",
      "severity": "critical|high|medium|low",
      "description": "Detailed description of the bottleneck with metrics",
      "evidence": "Specific data points that indicate this bottleneck",
      "suggestedFix": "Step-by-step fix recommendation",
      "estimatedEffort": "Quick fix|Medium effort|Major refactor"
    }
  ],
  "responseTimeAnalysis": {
    "assessment": "good|acceptable|concerning|critical",
    "p95Analysis": "Analysis of 95th percentile response times",
    "p99Analysis": "Analysis of 99th percentile response times",
    "outlierConcerns": "Any concerning outliers or spikes"
  },
  "resourceUtilization": {
    "cpuAssessment": "Analysis of CPU usage patterns",
    "memoryAssessment": "Analysis of memory usage patterns",
    "databaseAssessment": "Analysis of database connection/query patterns",
    "headroom": "Estimated headroom before resource exhaustion"
  },
  "recommendations": [
    {
      "title": "Recommendation title",
      "description": "Detailed recommendation with context",
      "priority": "critical|high|medium|low",
      "effort": "low|medium|high",
      "impact": "Expected improvement from implementing this"
    }
  ],
  "riskAssessment": {
    "productionRisks": ["List of risks if deployed to production now"],
    "mitigations": ["Steps to mitigate each risk"]
  },
  "nextSteps": [
    "Ordered list of next steps to improve performance"
  ]
}

## ANALYSIS GUIDELINES:
1. Be specific - use actual numbers from the data
2. Provide context - compare to industry standards (e.g., API response <200ms is excellent, <500ms is good, >1000ms needs work)
3. Consider trading platform requirements - milliseconds matter for trading
4. Be actionable - every finding should have a clear next step
5. Grade fairly - 90+ is excellent, 80-89 is good, 70-79 is acceptable, 60-69 needs work, <60 is failing

Return ONLY valid JSON, no markdown formatting.`;

    const completion = await openai.chat.completions.create({
      model: config.model,
      messages: [
        { role: 'system', content: 'You are a senior performance engineer. Return only valid JSON without markdown formatting.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.3,
      max_tokens: 4000,
    });

    const response = completion.choices[0]?.message?.content || '';
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const analysis = JSON.parse(jsonMatch[0]) as IAIAnalysis;
      analysis.generatedAt = new Date();
      return analysis;
    }

    return generateBasicAnalysis(analysisData);
  } catch (error) {
    console.log('ℹ️ AI analysis unavailable, using basic analysis instead');
    return generateBasicAnalysis(analysisData);
  }
}

/**
 * Generate comprehensive basic analysis without AI
 */
function generateBasicAnalysis(data: Record<string, unknown>): IAIAnalysis {
  const findings: IAIAnalysis['findings'] = [];
  const bottlenecks: IAIAnalysis['bottlenecks'] = [];
  const recommendations: IAIAnalysis['recommendations'] = [];
  let score = 100;

  // Parse all metrics
  const errorRate = parseFloat(data.errorRate as string) || 0;
  const successRate = parseFloat(data.successRate as string) || 0;
  const avgResponse = parseFloat(data.avgResponseTime as string) || 0;
  const p95Response = parseFloat(data.p95ResponseTime as string) || 0;
  const p99Response = parseFloat(data.p99ResponseTime as string) || 0;
  const maxResponse = parseFloat(data.maxResponseTime as string) || 0;
  const rps = parseFloat(data.requestsPerSecond as string) || 0;
  const cpuUsage = parseFloat(data.peakCpuUsage as string) || 0;
  const memUsage = parseFloat(data.peakMemoryUsage as string) || 0;
  const totalRequests = data.totalRequests as number || 0;
  const duration = (data.duration as number || 0) / 1000;
  const testCases = data.testCases as Array<{ name: string; status: string; successRate: string | number; avgResponseTime: string; errorMessage?: string }> || [];
  const usersCreated = data.usersCreated as number || 0;
  const tradesExecuted = data.tradesExecuted as number || 0;
  const competitionsCreated = data.competitionsCreated as number || 0;
  const challengesCreated = data.challengesCreated as number || 0;

  // ===== ERROR RATE ANALYSIS =====
  if (errorRate > 10) {
    findings.push({
      type: 'error',
      title: 'Critical Error Rate',
      description: `Error rate of ${errorRate.toFixed(1)}% is critically high (threshold: <10%).`,
      recommendation: 'URGENT: Review error logs, identify failing endpoints, and fix critical bugs.',
      priority: 'high',
      impact: 'Users will frequently encounter errors.',
    });
    score -= 25;
    bottlenecks.push({
      component: 'API Layer',
      severity: 'critical',
      description: `${errorRate.toFixed(1)}% of requests are failing`,
      evidence: `${Math.round(totalRequests * errorRate / 100)} failed requests out of ${totalRequests}`,
      suggestedFix: 'Implement proper error handling and fix underlying bugs',
      estimatedEffort: 'Major refactor',
    });
  } else if (errorRate > 5) {
    findings.push({
      type: 'warning',
      title: 'Elevated Error Rate',
      description: `Error rate of ${errorRate.toFixed(1)}% exceeds recommended threshold of 5%.`,
      recommendation: 'Review error patterns and implement fixes.',
      priority: 'medium',
    });
    score -= 12;
  } else if (errorRate > 1) {
    findings.push({
      type: 'info',
      title: 'Acceptable Error Rate',
      description: `Error rate of ${errorRate.toFixed(1)}% is within acceptable range.`,
      priority: 'low',
    });
    score -= 3;
  } else {
    findings.push({
      type: 'success',
      title: 'Excellent Error Rate',
      description: `Error rate of ${errorRate.toFixed(2)}% is excellent.`,
    });
  }

  // ===== RESPONSE TIME ANALYSIS =====
  if (avgResponse > 2000) {
    findings.push({
      type: 'error',
      title: 'Critical Response Times',
      description: `Average response time of ${avgResponse.toFixed(0)}ms is unacceptable for a trading platform.`,
      recommendation: 'URGENT: Profile slow endpoints, optimize queries, implement caching.',
      priority: 'high',
    });
    bottlenecks.push({
      component: 'API Layer',
      severity: 'critical',
      description: `Average response ${avgResponse.toFixed(0)}ms, P95: ${p95Response.toFixed(0)}ms`,
      evidence: `Max response reached ${maxResponse.toFixed(0)}ms`,
      suggestedFix: 'Add Redis caching, optimize DB queries, use connection pooling',
      estimatedEffort: 'Major refactor',
    });
    score -= 20;
  } else if (avgResponse > 1000) {
    findings.push({
      type: 'warning',
      title: 'Slow Response Times',
      description: `Average response time of ${avgResponse.toFixed(0)}ms is above recommended threshold.`,
      recommendation: 'Implement query optimization and caching.',
      priority: 'medium',
    });
    score -= 10;
  } else if (avgResponse > 500) {
    findings.push({
      type: 'info',
      title: 'Acceptable Response Times',
      description: `Average response time of ${avgResponse.toFixed(0)}ms is acceptable.`,
      priority: 'low',
    });
    score -= 3;
  } else {
    findings.push({
      type: 'success',
      title: 'Excellent Response Times',
      description: `Average response time of ${avgResponse.toFixed(0)}ms is excellent.`,
    });
  }

  // ===== CPU ANALYSIS =====
  if (cpuUsage > 90) {
    findings.push({
      type: 'error',
      title: 'CPU Saturation',
      description: `Peak CPU usage of ${cpuUsage.toFixed(1)}% indicates resource exhaustion.`,
      recommendation: 'Scale horizontally or optimize algorithms.',
      priority: 'high',
    });
    bottlenecks.push({
      component: 'CPU',
      severity: 'critical',
      description: `Peak CPU at ${cpuUsage.toFixed(1)}%`,
      evidence: 'CPU saturated during test',
      suggestedFix: 'Add load balancing with multiple instances',
      estimatedEffort: 'Medium effort',
    });
    score -= 20;
  } else if (cpuUsage > 70) {
    findings.push({
      type: 'warning',
      title: 'High CPU Usage',
      description: `Peak CPU usage of ${cpuUsage.toFixed(1)}% leaves limited headroom.`,
      priority: 'medium',
    });
    score -= 8;
  } else {
    findings.push({
      type: 'success',
      title: 'Healthy CPU Usage',
      description: `Peak CPU usage of ${cpuUsage.toFixed(1)}% is healthy.`,
    });
  }

  // ===== MEMORY ANALYSIS =====
  if (memUsage > 90) {
    findings.push({
      type: 'error',
      title: 'Critical Memory Pressure',
      description: `Peak memory usage of ${memUsage.toFixed(1)}% risks out-of-memory crashes.`,
      recommendation: 'Increase RAM or fix memory leaks.',
      priority: 'high',
    });
    bottlenecks.push({
      component: 'Memory',
      severity: 'critical',
      description: `Memory at ${memUsage.toFixed(1)}%`,
      evidence: 'Memory nearly exhausted',
      suggestedFix: 'Profile memory usage and fix leaks',
      estimatedEffort: 'Medium effort',
    });
    score -= 18;
  } else if (memUsage > 70) {
    findings.push({
      type: 'warning',
      title: 'High Memory Usage',
      description: `Peak memory usage of ${memUsage.toFixed(1)}% - limited buffer.`,
      priority: 'medium',
    });
    score -= 6;
  } else {
    findings.push({
      type: 'success',
      title: 'Healthy Memory Usage',
      description: `Peak memory usage of ${memUsage.toFixed(1)}% is efficient.`,
    });
  }

  // ===== TEST CASE ANALYSIS =====
  const failedTests = testCases.filter(tc => tc.status === 'failed');
  const passedTests = testCases.filter(tc => tc.status === 'passed');

  if (failedTests.length > 0) {
    findings.push({
      type: 'error',
      title: `${failedTests.length} Test(s) Failed`,
      description: `Failed: ${failedTests.map(t => t.name).join(', ')}`,
      recommendation: 'Fix failing tests before deployment.',
      priority: 'high',
    });
    score -= failedTests.length * 4;
  }

  if (passedTests.length === testCases.length && testCases.length > 0) {
    findings.push({
      type: 'success',
      title: 'All Tests Passed',
      description: `All ${testCases.length} test scenarios completed successfully.`,
    });
  }

  // ===== RECOMMENDATIONS =====
  if (errorRate > 5) {
    recommendations.push({
      title: 'Implement Retry Logic',
      description: 'Add exponential backoff retry for transient failures',
      priority: 'high',
      effort: 'low',
      impact: 'Reduce failed requests by 50-70%',
    });
  }

  if (avgResponse > 500) {
    recommendations.push({
      title: 'Implement Caching Layer',
      description: 'Add Redis caching for frequently accessed data',
      priority: 'high',
      effort: 'medium',
      impact: 'Reduce response times by 60-80%',
    });
  }

  if (cpuUsage > 70 || memUsage > 70) {
    recommendations.push({
      title: 'Set Up Auto-Scaling',
      description: 'Configure horizontal auto-scaling',
      priority: 'medium',
      effort: 'medium',
      impact: 'Handle traffic spikes automatically',
    });
  }

  recommendations.push({
    title: 'Implement Performance Monitoring',
    description: 'Set up APM with alerts',
    priority: 'medium',
    effort: 'low',
    impact: 'Early detection of issues',
  });

  // ===== PRODUCTION READINESS =====
  let productionReadiness: 'ready' | 'needs_work' | 'not_ready' = 'ready';
  if (score < 60 || failedTests.length > 2 || errorRate > 10 || cpuUsage > 90) {
    productionReadiness = 'not_ready';
  } else if (score < 80 || failedTests.length > 0 || errorRate > 5 || cpuUsage > 70) {
    productionReadiness = 'needs_work';
  }

  // ===== CALCULATE GRADE =====
  let overallGrade: string;
  if (score >= 90) overallGrade = 'A';
  else if (score >= 80) overallGrade = 'B';
  else if (score >= 70) overallGrade = 'C';
  else if (score >= 60) overallGrade = 'D';
  else overallGrade = 'F';

  const summary = `Performance test completed with a score of ${Math.max(0, score)}/100 (Grade: ${overallGrade}). ` +
    `Processed ${totalRequests.toLocaleString()} requests over ${duration.toFixed(0)} seconds at ${rps.toFixed(1)} req/sec with ${successRate}% success rate. ` +
    `Average response time: ${avgResponse.toFixed(0)}ms. Resource utilization: CPU ${cpuUsage.toFixed(1)}%, Memory ${memUsage.toFixed(1)}%. ` +
    `${passedTests.length}/${testCases.length} tests passed. Production readiness: ${productionReadiness.replace('_', ' ').toUpperCase()}.`;

  return {
    summary,
    performanceScore: Math.max(0, Math.min(100, score)),
    overallGrade,
    productionReadiness,
    scalabilityAssessment: {
      currentCapacity: `~${Math.round(rps * 0.7)} concurrent users`,
      scalingNeeds: cpuUsage > 70 || memUsage > 70 ? 'Horizontal scaling required' : 'System has headroom for 2-3x load',
      limitingFactor: cpuUsage > memUsage ? `CPU at ${cpuUsage.toFixed(1)}%` : avgResponse > 500 ? `Response time at ${avgResponse.toFixed(0)}ms` : 'No critical bottleneck',
    },
    findings,
    bottlenecks,
    responseTimeAnalysis: {
      assessment: avgResponse < 200 ? 'excellent' : avgResponse < 500 ? 'good' : avgResponse < 1000 ? 'acceptable' : 'concerning',
      p95Analysis: `95% of requests completed in ${p95Response.toFixed(0)}ms`,
      p99Analysis: `99% of requests completed in ${p99Response.toFixed(0)}ms`,
      outlierConcerns: maxResponse > p99Response * 3 ? `Max response ${maxResponse.toFixed(0)}ms is concerning` : 'No significant outliers',
    },
    resourceUtilization: {
      cpuAssessment: cpuUsage < 50 ? 'Efficient' : cpuUsage < 70 ? 'Moderate' : cpuUsage < 90 ? 'High' : 'Critical',
      memoryAssessment: memUsage < 50 ? 'Efficient' : memUsage < 70 ? 'Moderate' : memUsage < 90 ? 'High' : 'Critical',
      databaseAssessment: avgResponse > 500 ? 'Likely bottleneck' : 'Healthy',
      headroom: `CPU: ${(100 - cpuUsage).toFixed(1)}%, Memory: ${(100 - memUsage).toFixed(1)}%`,
    },
    recommendations: recommendations.slice(0, 8),
    riskAssessment: {
      productionRisks: [
        ...(errorRate > 5 ? [`High error rate (${errorRate.toFixed(1)}%)`] : []),
        ...(cpuUsage > 80 ? [`CPU at ${cpuUsage.toFixed(1)}%`] : []),
        ...(memUsage > 80 ? [`Memory at ${memUsage.toFixed(1)}%`] : []),
        ...(avgResponse > 1000 ? [`Slow response times (${avgResponse.toFixed(0)}ms)`] : []),
        ...(failedTests.length > 0 ? [`${failedTests.length} failed tests`] : []),
      ],
      mitigations: [
        ...(errorRate > 5 ? ['Fix failing endpoints and add retry logic'] : []),
        ...(cpuUsage > 80 ? ['Set up auto-scaling'] : []),
        ...(memUsage > 80 ? ['Profile memory usage'] : []),
        ...(avgResponse > 1000 ? ['Implement caching'] : []),
        ...(failedTests.length > 0 ? ['Fix failing tests'] : []),
      ],
    },
    nextSteps: [
      ...(failedTests.length > 0 ? ['1. Fix failing test scenarios'] : []),
      ...(errorRate > 5 ? ['2. Investigate error-prone endpoints'] : []),
      ...(avgResponse > 500 ? ['3. Implement caching'] : []),
      ...(cpuUsage > 70 || memUsage > 70 ? ['4. Set up auto-scaling'] : []),
      '5. Set up performance monitoring',
    ].filter(Boolean),
    generatedAt: new Date(),
  };
}

/**
 * Generate smart test scenario using AI
 */
export async function generateTestScenario(description: string): Promise<Record<string, unknown>> {
  const openai = await getOpenAIClient();

  if (!openai) {
    return getDefaultScenario();
  }

  try {
    const config = await getAIConfig();
    const prompt = `Generate a performance test scenario for a trading platform based on this description:
"${description}"

Return a JSON configuration:
{
  "name": "Scenario name",
  "description": "What this scenario tests",
  "virtualUsers": 100,
  "competitions": 5,
  "challenges": 50,
  "tradesPerUser": 10,
  "tradingDuration": 30,
  "tpSlPercentage": 70,
  "simulateFraud": true,
  "fraudPercentage": 5
}`;

    const completion = await openai.chat.completions.create({
      model: config.model,
      messages: [
        { role: 'system', content: 'You are a trading platform testing expert. Return only valid JSON.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 500,
    });

    const response = completion.choices[0]?.message?.content || '';
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }

    return getDefaultScenario();
  } catch (error) {
    console.log('ℹ️ AI scenario generation unavailable, using defaults');
    return getDefaultScenario();
  }
}

/**
 * Analyze failure root cause using AI
 */
export async function analyzeFailureRootCause(
  errorLogs: Array<{ timestamp: Date; level: string; message: string; details?: Record<string, unknown> }>
): Promise<{ rootCause: string; suggestions: string[] }> {
  const openai = await getOpenAIClient();

  if (!openai) {
    return {
      rootCause: 'Unable to determine root cause without AI analysis',
      suggestions: ['Review error logs manually', 'Check database connectivity', 'Verify API endpoints'],
    };
  }

  try {
    const config = await getAIConfig();
    const recentErrors = errorLogs
      .filter(log => log.level === 'error')
      .slice(-20)
      .map(log => `[${log.timestamp}] ${log.message}${log.details ? ` - ${JSON.stringify(log.details)}` : ''}`)
      .join('\n');

    const prompt = `Analyze these error logs from a trading platform and identify the root cause:

${recentErrors}

Return analysis in JSON format:
{
  "rootCause": "Description of the most likely root cause",
  "suggestions": [
    "Specific suggestion to fix the issue",
    "Another suggestion"
  ]
}`;

    const completion = await openai.chat.completions.create({
      model: config.model,
      messages: [
        { role: 'system', content: 'You are a debugging expert. Return only valid JSON.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.3,
      max_tokens: 500,
    });

    const response = completion.choices[0]?.message?.content || '';
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }

    return {
      rootCause: 'Analysis failed - review logs manually',
      suggestions: ['Check error patterns', 'Verify system resources'],
    };
  } catch (error) {
    console.log('ℹ️ AI root cause analysis unavailable');
    return {
      rootCause: 'AI analysis unavailable',
      suggestions: ['Review error logs manually'],
    };
  }
}

/**
 * Default test scenario when AI is not available
 */
function getDefaultScenario(): Record<string, unknown> {
  return {
    name: 'Standard Load Test',
    description: 'Default performance test scenario',
    virtualUsers: 50,
    duration: 300,
    rampUp: 60,
    scenarios: [
      { type: 'user_registration', weight: 0.1 },
      { type: 'login', weight: 0.2 },
      { type: 'trading', weight: 0.5 },
      { type: 'deposit', weight: 0.1 },
      { type: 'withdrawal', weight: 0.1 },
    ],
  };
}

/**
 * Clear cached API config (call when settings change)
 */
export function clearAICache(): void {
  cachedApiKey = null;
  cachedModel = 'gpt-4o-mini';
  cachedEnabled = false;
}
