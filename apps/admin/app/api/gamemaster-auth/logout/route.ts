import { NextResponse } from "next/server";

/**
 * POST /api/gamemaster-auth/logout
 * Logout endpoint for game masters
 */
export async function POST() {
  const response = NextResponse.json({ success: true });

  // Clear the game master token cookie
  response.cookies.set("gm_token", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0, // Expire immediately
    path: "/",
  });

  return response;
}
