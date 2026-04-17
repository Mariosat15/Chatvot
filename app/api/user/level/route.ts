import { NextResponse } from "next/server";
import { auth } from "@/lib/better-auth/auth";
import { headers } from "next/headers";
import { getUserLevel } from "@/lib/services/xp-level.service";

export async function GET() {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const levelData = await getUserLevel(session.user.id);

    return NextResponse.json({
      currentLevel: levelData.currentLevel,
      currentTitle: levelData.currentTitle,
      currentIcon: levelData.currentIcon,
      currentColor: levelData.currentColor,
      currentXP: levelData.currentXP,
    });
  } catch {
    return NextResponse.json(
      { error: "Something went wrong. Please contact support." },
      { status: 500 },
    );
  }
}
