import { NextResponse } from "next/server";
import type { AdminSection } from "@/database/models/admin-employee.model";
import { requireSectionAccess, getAdminSession } from "@/lib/admin/auth";

/**
 * Shared guard for admin API routes that belong to one RBAC section.
 *
 * `requireSectionAccess` signals refusal by throwing, and the two refusals have to become
 * different HTTP statuses: not signed in is 401, signed in without the grant is 403. The
 * forbidden message is `Access denied to section: <id>` - matching a guessed "Forbidden"
 * prefix instead would quietly turn every permission refusal into a 500, which reads as a
 * server fault rather than a denied grant.
 */

export interface GuardedAdmin {
  id: string;
  email: string;
  name?: string;
  role?: string;
}

export type GuardOutcome =
  | { ok: true; admin: GuardedAdmin }
  | { ok: false; response: NextResponse };

export async function guardSection(
  section: AdminSection,
): Promise<GuardOutcome> {
  try {
    const auth = await requireSectionAccess(section);
    const session = await getAdminSession();

    return {
      ok: true,
      admin: {
        id: session?.id ?? "unknown",
        email: session?.email ?? "unknown@admin",
        name: session?.name,
        role: auth.isSuperAdmin ? "super_admin" : "admin",
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";

    if (message === "Unauthorized") {
      return {
        ok: false,
        response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      };
    }
    if (message.startsWith("Access denied to section")) {
      return {
        ok: false,
        response: NextResponse.json(
          { error: "You do not have access to this section." },
          { status: 403 },
        ),
      };
    }

    console.error(`❌ Section guard failed for "${section}":`, error);
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Something went wrong. Please contact support." },
        { status: 500 },
      ),
    };
  }
}
