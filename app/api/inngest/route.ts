import { serve } from "inngest/next";
import { NextRequest, NextResponse } from "next/server";
import { inngest } from "@/lib/inngest/client";
import { connectToDatabase } from "@/database/mongoose";
import { WhiteLabel } from "@/database/models/whitelabel.model";
import {
  sendSignUpEmail, 
  updateCompetitionStatuses, 
  monitorMarginLevels, 
  evaluateUserBadges,
  sendInvoiceEmailJob,
  updatePriceCache,
  processTradeQueue,
} from "@/lib/inngest/functions";

// Disable body parsing for Inngest to handle signature verification
export const runtime = 'nodejs';
export const preferredRegion = 'auto';

// All Inngest functions
const functions = [
  sendSignUpEmail, 
  updateCompetitionStatuses,
  monitorMarginLevels,
  evaluateUserBadges,
  sendInvoiceEmailJob,
  updatePriceCache,
  processTradeQueue,
];

// Cache for credentials (refresh every 5 minutes)
let cachedSigningKey: string | undefined;
let cachedEventKey: string | undefined;
let cachedMode: 'dev' | 'cloud' = 'dev';
let lastCredentialsFetch = 0;
const CREDENTIALS_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

interface InngestConfig {
  signingKey?: string;
  eventKey?: string;
  mode: 'dev' | 'cloud';
}

/**
 * Get Inngest credentials from database or environment
 */
async function getInngestCredentials(): Promise<InngestConfig> {
  const now = Date.now();
  
  // Return cached credentials if still valid
  if (cachedSigningKey && (now - lastCredentialsFetch) < CREDENTIALS_CACHE_TTL) {
    return { signingKey: cachedSigningKey, eventKey: cachedEventKey, mode: cachedMode };
  }

  try {
    await connectToDatabase();
    const settings = await WhiteLabel.findOne();
    
    if (settings) {
      cachedSigningKey = settings.inngestSigningKey || undefined;
      cachedEventKey = settings.inngestEventKey || undefined;
      cachedMode = (settings.inngestMode as 'dev' | 'cloud') || 'dev';
      lastCredentialsFetch = now;
      return { signingKey: cachedSigningKey, eventKey: cachedEventKey, mode: cachedMode };
    }
  } catch (error) {
    console.error('Failed to fetch Inngest credentials from database:', error);
  }

  // Fallback to environment variables
  return {
    signingKey: process.env.INNGEST_SIGNING_KEY,
    eventKey: process.env.INNGEST_EVENT_KEY,
    mode: process.env.NODE_ENV === 'production' ? 'cloud' : 'dev',
  };
}

/**
 * Create Inngest handler with credentials from database
 * 
 * Mode:
 * - 'dev': Local development with inngest-cli dev server (no signing)
 * - 'cloud': Inngest Cloud production (requires signing key)
 */
function createHandler(config: InngestConfig) {
  const options: Parameters<typeof serve>[0] = {
    client: inngest,
    functions,
    servePath: '/api/inngest',
  };

  // In cloud mode, signing key is required for signed responses
  if (config.mode === 'cloud' && config.signingKey) {
    options.signingKey = config.signingKey;
    options.signingKeyFallback = config.signingKey; // Ensure signing is used
  }

  return serve(options);
}

// Default handler for dev mode
const defaultHandler = createHandler({ mode: 'dev' });

export async function GET(request: NextRequest) {
  const config = await getInngestCredentials();
  const handler = config.mode === 'cloud' && config.signingKey 
    ? createHandler(config) 
    : defaultHandler;
  return handler.GET(request, undefined);
}

export async function POST(request: NextRequest) {
  const config = await getInngestCredentials();
  const handler = config.mode === 'cloud' && config.signingKey 
    ? createHandler(config) 
    : defaultHandler;
  return handler.POST(request, undefined);
}

export async function PUT(request: NextRequest) {
  try {
    const contentLength = request.headers.get('content-length');
    if (contentLength === '0' || !contentLength) {
      return NextResponse.json({ ok: true }, { status: 200 });
    }
    
    const config = await getInngestCredentials();
    const handler = config.mode === 'cloud' && config.signingKey 
      ? createHandler(config) 
      : defaultHandler;
    return handler.PUT(request, undefined);
  } catch {
    return NextResponse.json({ ok: true }, { status: 200 });
  }
}
