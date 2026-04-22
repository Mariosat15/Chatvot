import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";

import { auth } from "@/lib/better-auth/auth";
import { connectToDatabase } from "@/database/mongoose";
import UserRestriction from "@/database/models/user-restriction.model";
import MessagingService from "@/lib/services/messaging/messaging.service";
import { toCaseId } from "@/lib/services/account-review.service";

/**
 * POST /api/user/restrictions/appeal
 *
 * Body: { restrictionId?: string; message?: string }
 *
 * Creates (or reuses) a user-to-support conversation and posts an initial
 * appeal message stamped with the public case ID. The restriction record
 * is updated with `appealSubmittedAt` and the conversation ID so admins
 * can trace the appeal back to the case and the UI can avoid opening
 * duplicate tickets if the user refreshes.
 */
const MAX_APPEAL_LENGTH = 2000;

export async function POST(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    const userId = session.user.id;
    const userName = session.user.name || "User";
    const userAvatar = session.user.image ?? undefined;

    const body = (await req.json().catch(() => ({}))) as {
      restrictionId?: string;
      message?: string;
    };

    const userMessageRaw = (body.message ?? "").trim();
    if (userMessageRaw.length > MAX_APPEAL_LENGTH) {
      return NextResponse.json(
        {
          success: false,
          error: `Appeal message is too long (max ${MAX_APPEAL_LENGTH} characters).`,
        },
        { status: 400 },
      );
    }

    await connectToDatabase();

    // Pick the target restriction. Prefer the explicit ID if provided;
    // otherwise fall back to the user's most recent active restriction.
    const restriction = body.restrictionId
      ? await UserRestriction.findOne({
          _id: body.restrictionId,
          userId,
          isActive: true,
        })
      : await UserRestriction.findOne({ userId, isActive: true }).sort({
          restrictedAt: -1,
        });

    if (!restriction) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Something went wrong. Please contact support if you need assistance.",
        },
        { status: 404 },
      );
    }

    const caseId = toCaseId(String(restriction._id));

    // Get or create the user's support conversation.
    const conversation = await MessagingService.getOrCreateSupportConversation(
      userId,
      userName,
      userAvatar,
    );
    const conversationId = conversation._id.toString();

    // Post a clearly-labelled system message so admins immediately see the
    // case context when opening the ticket.
    const systemContent = [
      `🛡️ Appeal submitted for case ${caseId}`,
      `Restriction type: ${restriction.restrictionType}`,
      `Reason: ${restriction.reason}`,
      restriction.customReason ? `Admin note: ${restriction.customReason}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    await MessagingService.sendMessage({
      conversationId,
      senderId: "system",
      senderType: "system",
      senderName: "System",
      content: systemContent,
      messageType: "system",
    });

    // Post the user's own appeal message (if any).
    if (userMessageRaw.length > 0) {
      await MessagingService.sendMessage({
        conversationId,
        senderId: userId,
        senderType: "user",
        senderName: userName,
        senderAvatar: userAvatar,
        content: `Appeal for ${caseId}:\n\n${userMessageRaw}`,
        messageType: "text",
      });
    }

    // Stamp the restriction so we can de-duplicate future appeal clicks
    // and link the support conversation from the admin panel.
    restriction.appealSubmittedAt = new Date();
    restriction.appealConversationId = conversationId;
    await restriction.save();

    return NextResponse.json({
      success: true,
      caseId,
      conversationId,
      alreadyOpen: false,
    });
  } catch (error) {
    console.error("❌ [Appeal] Failed to submit appeal:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          "Something went wrong. Please contact support if you need assistance.",
      },
      { status: 500 },
    );
  }
}
