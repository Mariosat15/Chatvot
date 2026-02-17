import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/database/mongoose";
import { WhiteLabel } from "@/database/models/whitelabel.model";
import { requireAdminAuth, getAdminSession } from "@/lib/admin/auth";
import { auditLogService } from "@/lib/services/audit-log.service";

export async function GET() {
  try {
    await requireAdminAuth();
    await connectToDatabase();

    // Get or create white label settings
    let settings = await WhiteLabel.findOne();
    if (!settings) {
      settings = new WhiteLabel();
      await settings.save();
    }

    // Also read from .env for fallback values
    const envPath = path.join(process.cwd(), ".env");
    let envContent = "";
    try {
      envContent = await fs.readFile(envPath, "utf-8");
    } catch (error) {
      console.error("Error reading .env:", error);
    }

    const getEnvValue = (key: string, dbValue: string) => {
      if (dbValue) return dbValue;
      const match = envContent.match(new RegExp(`^${key}=(.*)$`, "m"));
      return match ? match[1].replace(/['"]/g, "") : "";
    };

    return NextResponse.json({
      // General
      nodeEnv: settings.nodeEnv || getEnvValue("NODE_ENV", ""),
      nextPublicBaseUrl:
        settings.nextPublicBaseUrl || getEnvValue("NEXT_PUBLIC_BASE_URL", ""),

      // Email
      nodemailerEmail:
        settings.nodemailerEmail || getEnvValue("NODEMAILER_EMAIL", ""),
      nodemailerPassword:
        settings.nodemailerPassword || getEnvValue("NODEMAILER_PASSWORD", ""),

      // API Keys & URLs
      massiveApiKey:
        settings.massiveApiKey || getEnvValue("MASSIVE_API_KEY", ""),
      nextPublicMassiveApiKey:
        settings.nextPublicMassiveApiKey ||
        getEnvValue("NEXT_PUBLIC_MASSIVE_API_KEY", ""),

      // OpenAI Configuration
      openaiApiKey: settings.openaiApiKey || getEnvValue("OPENAI_API_KEY", ""),
      openaiModel: settings.openaiModel || "gpt-4o-mini",
      openaiEnabled: settings.openaiEnabled ?? false,
      openaiForEmails: settings.openaiForEmails ?? false,

      // Database
      mongodbUri: settings.mongodbUri || getEnvValue("MONGODB_URI", ""),

      // Authentication
      betterAuthSecret:
        settings.betterAuthSecret || getEnvValue("BETTER_AUTH_SECRET", ""),
      betterAuthUrl:
        settings.betterAuthUrl || getEnvValue("BETTER_AUTH_URL", ""),
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Get environment error:", error);
    return NextResponse.json(
      { error: "Failed to fetch environment variables" },
      { status: 500 },
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    await requireAdminAuth();
    await connectToDatabase();

    const body = await request.json();

    // Get or create settings
    let settings = await WhiteLabel.findOne();
    if (!settings) {
      settings = new WhiteLabel();
    }

    // Update database
    console.log("💾 Updating database with new settings...");
    console.log("📦 Received body:", Object.keys(body));

    // General
    if (body.nodeEnv !== undefined) {
      console.log("  ✏️ Updating nodeEnv:", body.nodeEnv);
      settings.nodeEnv = body.nodeEnv;
    }
    if (body.nextPublicBaseUrl !== undefined) {
      console.log("  ✏️ Updating nextPublicBaseUrl:", body.nextPublicBaseUrl);
      settings.nextPublicBaseUrl = body.nextPublicBaseUrl;
    }

    // Email
    if (body.nodemailerEmail !== undefined) {
      console.log("  ✏️ Updating nodemailerEmail:", body.nodemailerEmail);
      settings.nodemailerEmail = body.nodemailerEmail;
    }
    if (body.nodemailerPassword !== undefined) {
      console.log("  ✏️ Updating nodemailerPassword: [HIDDEN]");
      settings.nodemailerPassword = body.nodemailerPassword;
    }

    // API Keys & URLs
    if (body.massiveApiKey !== undefined) {
      console.log("  ✏️ Updating massiveApiKey: [HIDDEN]");
      settings.massiveApiKey = body.massiveApiKey;
    }
    if (body.nextPublicMassiveApiKey !== undefined) {
      console.log("  ✏️ Updating nextPublicMassiveApiKey: [HIDDEN]");
      settings.nextPublicMassiveApiKey = body.nextPublicMassiveApiKey;
    }

    // OpenAI Configuration
    if (body.openaiApiKey !== undefined) {
      console.log("  ✏️ Updating openaiApiKey: [HIDDEN]");
      settings.openaiApiKey = body.openaiApiKey;
    }
    if (body.openaiModel !== undefined) {
      console.log("  ✏️ Updating openaiModel:", body.openaiModel);
      settings.openaiModel = body.openaiModel;
    }
    if (body.openaiEnabled !== undefined) {
      console.log("  ✏️ Updating openaiEnabled:", body.openaiEnabled);
      settings.openaiEnabled = body.openaiEnabled;
    }
    if (body.openaiForEmails !== undefined) {
      console.log("  ✏️ Updating openaiForEmails:", body.openaiForEmails);
      settings.openaiForEmails = body.openaiForEmails;
    }

    // Database
    if (body.mongodbUri !== undefined) {
      console.log("  ✏️ Updating mongodbUri: [HIDDEN]");
      settings.mongodbUri = body.mongodbUri;
    }

    // Authentication
    if (body.betterAuthSecret !== undefined) {
      console.log("  ✏️ Updating betterAuthSecret: [HIDDEN]");
      settings.betterAuthSecret = body.betterAuthSecret;
    }
    if (body.betterAuthUrl !== undefined) {
      console.log("  ✏️ Updating betterAuthUrl:", body.betterAuthUrl);
      settings.betterAuthUrl = body.betterAuthUrl;
    }

    await settings.save();
    console.log("✅ Database updated successfully");

    // Settings are stored in MongoDB (WhiteLabel model) and shared across all servers.
    // No .env file write needed — all services read from MongoDB first via getSettings().

    // Log audit action
    try {
      const admin = await getAdminSession();
      if (admin) {
        await auditLogService.logSettingsUpdated(
          {
            id: admin.id,
            email: admin.email,
            name: admin.email.split("@")[0],
            role: "admin",
          },
          "Environment Settings",
          undefined,
          { updatedFields: Object.keys(body) },
        );
      }
    } catch (auditError) {
      console.error("Failed to log audit action:", auditError);
    }

    return NextResponse.json({
      success: true,
      message:
        "All settings updated in database. Changes take effect immediately on all servers.",
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Update environment error:", error);
    return NextResponse.json(
      { error: "Failed to update environment variables" },
      { status: 500 },
    );
  }
}
