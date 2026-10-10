import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/better-auth/auth";

/**
 * POST /api/auth/password-reset/request
 * Starts the forgot-password flow. Always returns a generic success so the
 * response cannot be used to probe which emails are registered.
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as { email?: string };
    const email = (body.email || "").trim().toLowerCase();

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { success: false, error: "Please enter a valid email address." },
        { status: 400 },
      );
    }

    const baseUrl =
      process.env.NEXT_PUBLIC_BASE_URL ||
      process.env.BETTER_AUTH_URL ||
      "http://localhost:3000";

    // Reason: better-auth always returns the same message whether or not the
    // user exists — do not change that contract here.
    await auth.api.requestPasswordReset({
      body: {
        email,
        redirectTo: `${baseUrl.replace(/\/$/, "")}/reset-password`,
      },
    });

    return NextResponse.json({
      success: true,
      message:
        "If this email exists in our system, check your inbox for a reset link.",
    });
  } catch (error) {
    console.error("❌ [password-reset/request]", error);
    return NextResponse.json(
      {
        success: false,
        error: "Something went wrong. Please contact support.",
      },
      { status: 500 },
    );
  }
}
