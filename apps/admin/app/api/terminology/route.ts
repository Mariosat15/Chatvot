import { NextResponse } from "next/server";

import { guardSection } from "@/lib/admin/section-route-guard";
import {
  getStoredTerminologyOverrides,
  saveTerminologyOverrides,
  validateTerminologyOverrides,
} from "@/lib/services/terminology.service";
import { TERMS } from "@/lib/constants/terminology";

/**
 * The display-word overrides (X6.5, chapter 14 section 2).
 *
 * Guarded with `guardSection("terminology")`, which is the grant, and deliberately not
 * `requireAdminAuth` or `verifyAdminToken` - those ask whether the caller is an admin at all,
 * so an employee granted one unrelated section passes them. That mistake has now been found
 * nine times in this codebase, so it is stated here rather than assumed.
 *
 * GET returns the STORED overrides and the defaults separately, never a merged pack. The form
 * needs to distinguish "the operator chose this word" from "this is what the platform says
 * when nobody has chosen", because a merged pack saved back turns all twenty-three defaults
 * into explicit overrides and freezes this deployment's wording for ever.
 */
export async function GET() {
  const guard = await guardSection("terminology");
  if (!guard.ok) return guard.response;

  try {
    const overrides = await getStoredTerminologyOverrides();
    return NextResponse.json({ success: true, overrides, defaults: TERMS });
  } catch (error) {
    console.error("❌ Could not read terminology overrides:", error);
    return NextResponse.json(
      { error: "Something went wrong. Please contact support." },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
  const guard = await guardSection("terminology");
  if (!guard.ok) return guard.response;

  try {
    const body = await request.json();

    // Reason: the validator refuses an unknown token with the key NAMED rather than dropping
    // it. Dropping means the save appears to succeed while doing nothing, and the operator
    // concludes they misclicked - which is this codebase's recurring failure mode.
    const validated = validateTerminologyOverrides(body?.overrides);
    if (!validated.ok) {
      return NextResponse.json({ error: validated.error }, { status: 400 });
    }

    await saveTerminologyOverrides(validated.overrides);

    console.log(
      `📝 Terminology overrides updated by ${guard.admin.email}: ${
        Object.keys(validated.overrides).join(", ") || "(no tokens sent)"
      }`,
    );

    const overrides = await getStoredTerminologyOverrides();
    return NextResponse.json({ success: true, overrides });
  } catch (error) {
    console.error("❌ Could not save terminology overrides:", error);
    return NextResponse.json(
      { error: "Something went wrong. Please contact support." },
      { status: 500 },
    );
  }
}
