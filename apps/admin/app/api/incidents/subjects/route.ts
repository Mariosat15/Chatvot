import { NextResponse } from "next/server";
import { guardSection } from "@/lib/admin/section-route-guard";
import { listIncidentSubjects } from "@/lib/services/incidents/incident-subjects.service";

/**
 * GET /api/incidents/subjects
 *
 * Live and upcoming contests, live challenges, and rounds that still need a decision.
 * Reading this does not grant the right to act on them.
 */
export async function GET() {
  const guard = await guardSection("incidents");
  if (!guard.ok) return guard.response;

  const subjects = await listIncidentSubjects();
  return NextResponse.json({ success: true, subjects });
}
