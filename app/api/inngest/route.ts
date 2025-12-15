import { serve } from "inngest/next";
import { NextRequest, NextResponse } from "next/server";
import { inngest } from "@/lib/inngest/client";
import {
  sendSignUpEmail, 
  updateCompetitionStatuses, 
  monitorMarginLevels, 
  evaluateUserBadges,
  sendInvoiceEmailJob,
} from "@/lib/inngest/functions";

// Disable body parsing for Inngest to handle signature verification
export const runtime = 'nodejs';
export const preferredRegion = 'auto';

const inngestHandler = serve({
    client: inngest,
    functions: [
      sendSignUpEmail, 
      updateCompetitionStatuses,
      monitorMarginLevels,
      evaluateUserBadges,
      sendInvoiceEmailJob,
    ],
    servePath: '/api/inngest',
});

export const GET = inngestHandler.GET;
export const POST = inngestHandler.POST;

// Wrap PUT to handle empty body gracefully (health checks)
export async function PUT(request: NextRequest) {
  try {
    // Check if body is empty
    const contentLength = request.headers.get('content-length');
    if (contentLength === '0' || !contentLength) {
      // Health check or empty body - respond OK
      return NextResponse.json({ ok: true }, { status: 200 });
    }
    // Pass undefined as second arg for Next.js App Router compatibility
    return inngestHandler.PUT(request, undefined);
  } catch {
    // Silent handling of body parsing errors
    return NextResponse.json({ ok: true }, { status: 200 });
  }
}
