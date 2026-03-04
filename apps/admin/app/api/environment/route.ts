import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/database/mongoose";
import { WhiteLabel } from "@/database/models/whitelabel.model";
import { requireAdminAuth, getAdminSession } from "@/lib/admin/auth";
import { auditLogService } from "@/lib/services/audit-log.service";
import { promises as fs } from "fs";
import path from "path";

// ──────────────────────────────────────────────────────────────
// Mapping: form field name  →  .env variable name
// ──────────────────────────────────────────────────────────────
const FIELD_TO_ENV_KEY: Record<string, string> = {
  nodeEnv: "NODE_ENV",
  nextPublicAppUrl: "NEXT_PUBLIC_APP_URL",
  nextPublicBaseUrl: "NEXT_PUBLIC_BASE_URL",
  mongodbUri: "MONGODB_URI",
  betterAuthSecret: "BETTER_AUTH_SECRET",
  betterAuthUrl: "BETTER_AUTH_URL",
  openaiApiKey: "OPENAI_API_KEY",
  openaiModel: "OPENAI_MODEL",
  openaiEnabled: "OPENAI_ENABLED",
  openaiForEmails: "OPENAI_FOR_EMAILS",
  nodemailerEmail: "NODEMAILER_EMAIL",
  nodemailerPassword: "NODEMAILER_PASSWORD",
  massiveApiKey: "MASSIVE_API_KEY",
  nextPublicMassiveApiKey: "NEXT_PUBLIC_MASSIVE_API_KEY",
  adminJwtSecret: "ADMIN_JWT_SECRET",
  veriffApiKey: "VERIFF_API_KEY",
  veriffApiSecret: "VERIFF_API_SECRET",
  veriffBaseUrl: "VERIFF_BASE_URL",
  pexelsApiKey: "PEXELS_API_KEY",
  isPrimary: "IS_PRIMARY",
  serverId: "SERVER_ID",
};

// Fields that exist in the WhiteLabel Mongoose model (persist to MongoDB)
const DB_FIELDS = new Set([
  "nodeEnv",
  "nextPublicBaseUrl",
  "nodemailerEmail",
  "nodemailerPassword",
  "massiveApiKey",
  "nextPublicMassiveApiKey",
  "openaiApiKey",
  "openaiModel",
  "openaiEnabled",
  "openaiForEmails",
  "mongodbUri",
  "betterAuthSecret",
  "betterAuthUrl",
  "pexelsApiKey",
]);

// ──────────────────────────────────────────────────────────────
// GET — Read current environment values
// Priority: WhiteLabel DB (if non-empty) → process.env → default
// ──────────────────────────────────────────────────────────────
export async function GET() {
  try {
    await requireAdminAuth();
    await connectToDatabase();

    // Get or create WhiteLabel settings
    let settings = await WhiteLabel.findOne();
    if (!settings) {
      settings = new WhiteLabel();
      await settings.save();
    }

    // Reason: process.env is already populated by Next.js from the .env file
    // at startup. No need for manual fs.readFile — process.env is the reliable
    // source, and WhiteLabel DB overrides for fields it manages.
    // Convert settings to a Map for safe lookup (avoids object-injection-sink).
    const settingsObj = settings.toObject?.() || settings;
    const settingsMap = new Map<string, unknown>(Object.entries(settingsObj));
    const envMap = new Map<string, string | undefined>(
      Object.entries(process.env),
    );

    const getVal = (dbField: string, envKey: string, fallback: string = "") => {
      // DB value takes priority (admin may have saved a value that differs from .env)
      if (DB_FIELDS.has(dbField)) {
        const dbVal = settingsMap.get(dbField);
        if (dbVal !== undefined && dbVal !== null && dbVal !== "") {
          return dbVal;
        }
      }
      // Fall back to process.env (loaded from .env at startup)
      return envMap.get(envKey) || fallback;
    };

    return NextResponse.json({
      // General
      nodeEnv: getVal("nodeEnv", "NODE_ENV", "development"),
      nextPublicAppUrl: process.env.NEXT_PUBLIC_APP_URL || "",
      nextPublicBaseUrl: getVal(
        "nextPublicBaseUrl",
        "NEXT_PUBLIC_BASE_URL",
        "",
      ),

      // Email
      nodemailerEmail: getVal("nodemailerEmail", "NODEMAILER_EMAIL", ""),
      nodemailerPassword: getVal(
        "nodemailerPassword",
        "NODEMAILER_PASSWORD",
        "",
      ),

      // API Keys
      massiveApiKey: getVal("massiveApiKey", "MASSIVE_API_KEY", ""),
      nextPublicMassiveApiKey: getVal(
        "nextPublicMassiveApiKey",
        "NEXT_PUBLIC_MASSIVE_API_KEY",
        "",
      ),

      // OpenAI
      openaiApiKey: getVal("openaiApiKey", "OPENAI_API_KEY", ""),
      openaiModel: getVal("openaiModel", "OPENAI_MODEL", "gpt-4o-mini"),
      openaiEnabled:
        (settingsMap.get("openaiEnabled") as boolean | undefined) ??
        process.env.OPENAI_ENABLED === "true",
      openaiForEmails:
        (settingsMap.get("openaiForEmails") as boolean | undefined) ??
        process.env.OPENAI_FOR_EMAILS === "true",

      // Database
      mongodbUri: getVal("mongodbUri", "MONGODB_URI", ""),

      // Authentication
      betterAuthSecret: getVal("betterAuthSecret", "BETTER_AUTH_SECRET", ""),
      betterAuthUrl: getVal("betterAuthUrl", "BETTER_AUTH_URL", ""),
      adminJwtSecret: process.env.ADMIN_JWT_SECRET || "",

      // KYC / Veriff
      veriffApiKey: process.env.VERIFF_API_KEY || "",
      veriffApiSecret: process.env.VERIFF_API_SECRET || "",
      veriffBaseUrl: process.env.VERIFF_BASE_URL || "",

      // Pexels (Landing Pages)
      pexelsApiKey: getVal("pexelsApiKey", "PEXELS_API_KEY", ""),

      // Infrastructure
      isPrimary: process.env.IS_PRIMARY || "true",
      serverId: process.env.SERVER_ID || "",
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

// ──────────────────────────────────────────────────────────────
// PUT — Update environment variables (MongoDB + .env file)
// ──────────────────────────────────────────────────────────────
export async function PUT(request: NextRequest) {
  try {
    await requireAdminAuth();
    await connectToDatabase();

    const body = await request.json();

    // ── Step 1: Update WhiteLabel in MongoDB (for DB-backed fields) ──
    let settings = await WhiteLabel.findOne();
    if (!settings) {
      settings = new WhiteLabel();
    }

    // Reason: Use a Map for safe lookup of request body values (avoids object-injection-sink).
    const bodyMap = new Map<string, unknown>(Object.entries(body));

    const updatedDbFields: string[] = [];
    const updatePayload = new Map<string, unknown>();
    for (const field of DB_FIELDS) {
      const val = bodyMap.get(field);
      if (val !== undefined) {
        updatePayload.set(field, val);
        updatedDbFields.push(field);
      }
    }

    if (updatedDbFields.length > 0) {
      await WhiteLabel.updateOne(
        { _id: settings._id },
        { $set: Object.fromEntries(updatePayload) },
      );
      console.log(
        `✅ WhiteLabel DB updated: ${updatedDbFields.join(", ")}`,
      );
    }

    // ── Step 2: Write ALL changed values to .env file on disk ──
    const envUpdates = new Map<string, string>();
    const fieldToEnvEntries = new Map(Object.entries(FIELD_TO_ENV_KEY));
    for (const [fieldName, envKey] of fieldToEnvEntries) {
      const val = bodyMap.get(fieldName);
      if (val !== undefined) {
        envUpdates.set(
          envKey,
          typeof val === "boolean" ? String(val) : String(val),
        );
      }
    }

    if (envUpdates.size > 0) {
      await writeEnvFile(envUpdates);
      console.log(
        `✅ .env file updated: ${[...envUpdates.keys()].join(", ")}`,
      );

      // Reason: Update process.env in memory so the current running process
      // picks up the new values immediately (next restart reads from disk).
      for (const [key, value] of envUpdates) {
        // eslint-disable-next-line security/detect-object-injection -- key is from FIELD_TO_ENV_KEY whitelist
        process.env[key] = value;
      }
    }

    // ── Step 3: Audit log ──
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
        "Settings saved to database and .env file. Some changes (like NEXT_PUBLIC_* or auth secrets) require a restart to take full effect.",
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

// ──────────────────────────────────────────────────────────────
// Helper: Read → update → write the .env file on disk
// ──────────────────────────────────────────────────────────────
async function writeEnvFile(
  updates: Map<string, string>,
): Promise<void> {
  // Reason: In production the admin app's .env is a symlink to the root .env
  // (created by deploy/setup-new-customer.sh). process.cwd() resolves through
  // the symlink, so writing here updates the real file.
  const envPath = path.join(process.cwd(), ".env");

  let existingContent = "";
  try {
    existingContent = await fs.readFile(envPath, "utf-8");
  } catch {
    // File doesn't exist — we'll create a new one
    console.log("📝 No .env file found — creating new one");
  }

  const lines = existingContent.split("\n");
  const updatedKeys = new Set<string>();

  // Pass 1: Update existing lines (preserve comments and blank lines)
  const newLines = lines.map((line) => {
    const trimmed = line.trim();

    // Preserve comments and empty lines as-is
    if (!trimmed || trimmed.startsWith("#")) return line;

    // Parse KEY=VALUE (handle KEY='VALUE' and KEY="VALUE" too)
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) return line;

    const key = trimmed.substring(0, eqIdx).trim();

    if (updates.has(key)) {
      updatedKeys.add(key);
      const value = sanitizeEnvValue(updates.get(key) ?? "");
      // Reason: Quote values that contain spaces or special characters
      if (value.includes(" ") || value.includes("#")) {
        return `${key}='${value}'`;
      }
      return `${key}=${value}`;
    }

    return line;
  });

  // Pass 2: Append any new keys that weren't in the existing file
  for (const [key, value] of updates) {
    if (!updatedKeys.has(key)) {
      const safeValue = sanitizeEnvValue(value);
      if (safeValue.includes(" ") || safeValue.includes("#")) {
        newLines.push(`${key}='${safeValue}'`);
      } else {
        newLines.push(`${key}=${safeValue}`);
      }
    }
  }

  await fs.writeFile(envPath, newLines.join("\n"), "utf-8");
}

/**
 * Sanitize a value before writing to .env to prevent injection.
 * Removes newlines, carriage returns, and null bytes.
 */
function sanitizeEnvValue(value: string): string {
  return value.replace(/[\r\n\0]/g, "").trim();
}
