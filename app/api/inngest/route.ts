import {serve} from "inngest/next";
import {inngest} from "@/lib/inngest/client";
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

export const { GET, POST, PUT } = serve({
    client: inngest,
    functions: [
      sendSignUpEmail, 
      updateCompetitionStatuses,
      monitorMarginLevels,
      evaluateUserBadges,
      sendInvoiceEmailJob,
    ],
    servePath: '/api/inngest',
})
