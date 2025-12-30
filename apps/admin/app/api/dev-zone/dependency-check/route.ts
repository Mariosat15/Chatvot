/**
 * Dependency Check API
 * 
 * Checks for outdated npm dependencies and uses AI to analyze
 * potential breaking changes and compatibility issues.
 */

import { NextResponse } from 'next/server';
import { verifyAdminAuth } from '@/lib/admin/auth';
import { exec } from 'child_process';
import { promisify } from 'util';
import OpenAI from 'openai';
import { connectToDatabase } from '@/database/mongoose';
import WhiteLabel from '@/database/models/whitelabel.model';

const execAsync = promisify(exec);

interface OutdatedPackage {
  name: string;
  current: string;
  wanted: string;
  latest: string;
  location: string;
  type: 'dependencies' | 'devDependencies';
  isBreaking: boolean;
  aiAnalysis?: {
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    summary: string;
    breakingChanges: string[];
    recommendations: string[];
    estimatedEffort: string;
  };
}

interface DependencyCheckResult {
  packages: OutdatedPackage[];
  totalOutdated: number;
  lastChecked: string;
  aiEnabled: boolean;
  analyzing?: boolean;
}

// Cache for results (valid for 5 minutes)
let cachedResult: DependencyCheckResult | null = null;
let cacheTime: number = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Get OpenAI configuration
 */
async function getOpenAIConfig(): Promise<{ apiKey: string | null; model: string; enabled: boolean }> {
  try {
    await connectToDatabase();
    const settings = await WhiteLabel.findOne();
    if (settings?.openaiApiKey && settings?.openaiEnabled) {
      return {
        apiKey: settings.openaiApiKey,
        model: settings.openaiModel || 'gpt-4o-mini',
        enabled: true,
      };
    }
  } catch (error) {
    console.log('AI config not found in database');
  }

  // Fallback to environment
  return {
    apiKey: process.env.OPENAI_API_KEY || null,
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    enabled: !!process.env.OPENAI_API_KEY,
  };
}

/**
 * Get outdated packages using npm outdated
 */
async function getOutdatedPackages(): Promise<OutdatedPackage[]> {
  try {
    // Run npm outdated in JSON format
    // Note: npm outdated returns exit code 1 if there are outdated packages
    const { stdout } = await execAsync('npm outdated --json', {
      cwd: process.cwd(),
    }).catch((error) => {
      // npm outdated returns exit code 1 when packages are outdated
      if (error.stdout) {
        return { stdout: error.stdout };
      }
      throw error;
    });

    if (!stdout || stdout.trim() === '') {
      return [];
    }

    const outdated = JSON.parse(stdout);
    const packages: OutdatedPackage[] = [];

    for (const [name, info] of Object.entries(outdated)) {
      const pkg = info as {
        current: string;
        wanted: string;
        latest: string;
        location: string;
        type?: string;
      };

      // Determine if it's a major version change (breaking)
      const currentMajor = parseInt(pkg.current?.split('.')[0] || '0');
      const latestMajor = parseInt(pkg.latest?.split('.')[0] || '0');
      const isBreaking = latestMajor > currentMajor;

      packages.push({
        name,
        current: pkg.current || 'unknown',
        wanted: pkg.wanted || 'unknown',
        latest: pkg.latest || 'unknown',
        location: pkg.location || '',
        type: (pkg.type as 'dependencies' | 'devDependencies') || 'dependencies',
        isBreaking,
      });
    }

    // Sort: breaking changes first, then by name
    packages.sort((a, b) => {
      if (a.isBreaking !== b.isBreaking) return a.isBreaking ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    return packages;
  } catch (error) {
    console.error('Error checking outdated packages:', error);
    return [];
  }
}

/**
 * Use AI to analyze a package update
 */
async function analyzePackageWithAI(
  openai: OpenAI,
  model: string,
  pkg: OutdatedPackage
): Promise<OutdatedPackage['aiAnalysis']> {
  try {
    const prompt = `Analyze this npm package update for a Next.js 14+ web application:

Package: ${pkg.name}
Current Version: ${pkg.current}
Latest Version: ${pkg.latest}
Is Major Version Change: ${pkg.isBreaking ? 'Yes' : 'No'}

Please provide a concise analysis in JSON format:
{
  "riskLevel": "low|medium|high|critical",
  "summary": "Brief summary of the update (1-2 sentences)",
  "breakingChanges": ["List of known breaking changes, if any"],
  "recommendations": ["Specific recommendations for this update"],
  "estimatedEffort": "time estimate (e.g., '5 minutes', '1 hour', '1 day')"
}

Consider:
- Known breaking changes in this version range
- Compatibility with Next.js 14, React 18, TypeScript 5
- Common migration issues
- Impact on existing code

Return ONLY the JSON, no additional text.`;

    const response = await openai.chat.completions.create({
      model,
      messages: [
        {
          role: 'system',
          content: 'You are a senior developer expert in npm packages, JavaScript/TypeScript, and Next.js. Provide accurate, concise analysis of package updates.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.3,
      max_tokens: 500,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) return undefined;

    // Parse JSON response
    const analysis = JSON.parse(content.trim());
    return {
      riskLevel: analysis.riskLevel || 'medium',
      summary: analysis.summary || 'No summary available',
      breakingChanges: analysis.breakingChanges || [],
      recommendations: analysis.recommendations || [],
      estimatedEffort: analysis.estimatedEffort || 'Unknown',
    };
  } catch (error) {
    console.error(`Error analyzing ${pkg.name} with AI:`, error);
    return undefined;
  }
}

/**
 * GET /api/dev-zone/dependency-check
 * Get list of outdated packages with optional AI analysis
 */
export async function GET() {
  try {
    const admin = await verifyAdminAuth();
    if (!admin.isAuthenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check cache
    if (cachedResult && Date.now() - cacheTime < CACHE_DURATION) {
      return NextResponse.json(cachedResult);
    }

    // Get outdated packages
    const packages = await getOutdatedPackages();
    
    // Get AI config
    const aiConfig = await getOpenAIConfig();

    const result: DependencyCheckResult = {
      packages,
      totalOutdated: packages.length,
      lastChecked: new Date().toISOString(),
      aiEnabled: aiConfig.enabled,
    };

    // Cache result
    cachedResult = result;
    cacheTime = Date.now();

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error checking dependencies:', error);
    return NextResponse.json(
      { error: 'Failed to check dependencies' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/dev-zone/dependency-check
 * Analyze a specific package with AI
 */
export async function POST(request: Request) {
  try {
    const admin = await verifyAdminAuth();
    if (!admin.isAuthenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { packageName, analyzeAll } = body;

    // Get AI config
    const aiConfig = await getOpenAIConfig();
    if (!aiConfig.enabled || !aiConfig.apiKey) {
      return NextResponse.json(
        { error: 'AI is not configured. Please set up OpenAI in Platform Settings.' },
        { status: 400 }
      );
    }

    const openai = new OpenAI({ apiKey: aiConfig.apiKey });

    // Get current packages (from cache or fresh)
    let packages: OutdatedPackage[];
    if (cachedResult && Date.now() - cacheTime < CACHE_DURATION) {
      packages = cachedResult.packages;
    } else {
      packages = await getOutdatedPackages();
    }

    if (analyzeAll) {
      // Analyze all packages (limit to 10 to avoid rate limits)
      const toAnalyze = packages.slice(0, 10);
      
      for (const pkg of toAnalyze) {
        if (!pkg.aiAnalysis) {
          pkg.aiAnalysis = await analyzePackageWithAI(openai, aiConfig.model, pkg);
        }
      }

      const result: DependencyCheckResult = {
        packages,
        totalOutdated: packages.length,
        lastChecked: new Date().toISOString(),
        aiEnabled: true,
      };

      // Update cache
      cachedResult = result;
      cacheTime = Date.now();

      return NextResponse.json(result);
    } else if (packageName) {
      // Analyze specific package
      const pkg = packages.find((p) => p.name === packageName);
      if (!pkg) {
        return NextResponse.json(
          { error: 'Package not found in outdated list' },
          { status: 404 }
        );
      }

      pkg.aiAnalysis = await analyzePackageWithAI(openai, aiConfig.model, pkg);

      // Update cache
      if (cachedResult) {
        const idx = cachedResult.packages.findIndex((p) => p.name === packageName);
        if (idx >= 0) {
          cachedResult.packages[idx] = pkg;
        }
      }

      return NextResponse.json({ package: pkg });
    }

    return NextResponse.json({ error: 'Missing packageName or analyzeAll flag' }, { status: 400 });
  } catch (error) {
    console.error('Error analyzing package:', error);
    return NextResponse.json(
      { error: 'Failed to analyze package' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/dev-zone/dependency-check
 * Clear cache and force refresh
 */
export async function DELETE() {
  try {
    const admin = await verifyAdminAuth();
    if (!admin.isAuthenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    cachedResult = null;
    cacheTime = 0;

    return NextResponse.json({ success: true, message: 'Cache cleared' });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to clear cache' }, { status: 500 });
  }
}

