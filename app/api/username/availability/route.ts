import { NextResponse } from "next/server";
import { checkUsernameAvailability } from "@/lib/services/username.service";
import { checkRateLimit, getClientIP } from "@/lib/utils/rate-limiter";

/**
 * GET /api/username/availability?u=<username>
 *
 * Public on purpose: the registration form calls it before an account exists. It reveals
 * only whether a username is in use, and usernames are public by definition. Rate limited
 * per IP so it cannot be used to walk the whole namespace quickly.
 */
export async function GET(request: Request) {
  const limit = checkRateLimit(`username-availability:${getClientIP(request)}`, {
    maxRequests: 30,
    windowMs: 60_000,
  });
  if (!limit.success) {
    return NextResponse.json(
      { available: false, error: "Too many checks. Please wait a moment." },
      { status: 429 },
    );
  }

  try {
    const username = new URL(request.url).searchParams.get("u");
    const result = await checkUsernameAvailability(username);
    return NextResponse.json(result);
  } catch (error) {
    console.error("❌ Username availability check failed:", error);
    return NextResponse.json(
      {
        available: false,
        error: "Something went wrong. Please contact support.",
      },
      { status: 500 },
    );
  }
}
