import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/database/mongoose";
import { Admin } from "@/database/models/admin.model";
import { SignJWT } from "jose";
import { auditLogService } from "@/lib/services/audit-log.service";
import { getAdminJwtSecret } from "@/lib/admin/jwt-secret";

const SECRET_KEY = new TextEncoder().encode(getAdminJwtSecret());

// Reason: In-memory rate limiter for brute-force protection. Resets on
// server restart which is acceptable — persistent rate limiting would need
// Redis, which is optional in this stack.
const LOGIN_ATTEMPTS = new Map<string, { count: number; resetAt: number }>();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes

function checkLoginRateLimit(ip: string): { allowed: boolean; retryAfterMs: number } {
  const now = Date.now();
  const entry = LOGIN_ATTEMPTS.get(ip);

  if (!entry || now > entry.resetAt) {
    LOGIN_ATTEMPTS.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return { allowed: true, retryAfterMs: 0 };
  }

  if (entry.count >= MAX_ATTEMPTS) {
    return { allowed: false, retryAfterMs: entry.resetAt - now };
  }

  entry.count++;
  return { allowed: true, retryAfterMs: 0 };
}

// All available admin sections for super admin
const ALL_ADMIN_SECTIONS = [
  "overview",
  "hero-page",
  "marketplace",
  "competitions",
  "challenges",
  "trading-history",
  "analytics",
  "market",
  "symbols",
  "users",
  "badges",
  "financial",
  "payments",
  "failed-deposits",
  "withdrawals",
  "pending-withdrawals",
  "kyc-settings",
  "kyc-history",
  "fraud",
  "wiki",
  "credentials",
  "email-templates",
  "notifications",
  "payment-providers",
  "fee",
  "invoicing",
  "reconciliation",
  "database",
  "ai-agent",
  "whitelabel",
  "audit-logs",
  "employees",
];

// Check if admin is the original/super admin
async function isOriginalAdmin(admin: any): Promise<boolean> {
  const defaultAdminEmail = (
    process.env.ADMIN_EMAIL || "admin@email.com"
  ).toLowerCase();
  const isDefaultEmail = admin.email.toLowerCase() === defaultAdminEmail;

  const oldestAdmin = await Admin.findOne({})
    .sort({ createdAt: 1 })
    .select("_id");
  const isFirstAdmin =
    !!oldestAdmin && oldestAdmin._id.toString() === admin._id.toString();

  return isDefaultEmail || isFirstAdmin;
}

export async function POST(request: NextRequest) {
  try {
    // SECURITY: Rate limit login attempts by IP
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "unknown";
    const rateLimit = checkLoginRateLimit(ip);
    if (!rateLimit.allowed) {
      const retryAfterSec = Math.ceil(rateLimit.retryAfterMs / 1000);
      return NextResponse.json(
        { error: "Too many login attempts. Please try again later." },
        { status: 429, headers: { "Retry-After": String(retryAfterSec) } },
      );
    }

    await connectToDatabase();

    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 },
      );
    }

    let admin = await Admin.findOne({ email: email.toLowerCase() });

    // If no admin exists, create default admin (first time setup)
    if (!admin) {
      const defaultEmail = process.env.ADMIN_EMAIL || "admin@email.com";
      const defaultPassword = process.env.ADMIN_PASSWORD || "admin123";

      if (
        email.toLowerCase() === defaultEmail.toLowerCase() &&
        password === defaultPassword
      ) {
        admin = new Admin({
          email: defaultEmail.toLowerCase(),
          password: defaultPassword,
          isFirstLogin: true,
        });
        await admin.save();
      } else {
        return NextResponse.json(
          { error: "Invalid credentials" },
          { status: 401 },
        );
      }
    }

    // Check if employee account is disabled
    console.log(`🔐 Admin status: ${admin.status || "active (default)"}`);
    if (admin.status === "disabled") {
      console.log("❌ Account is disabled");
      return NextResponse.json(
        { error: "Your account has been disabled. Contact the administrator." },
        { status: 403 },
      );
    }

    // Check if employee is locked out (force logout toggle)
    // IMPORTANT: Treat undefined as false (not locked out)
    const isLockedOut = admin.isLockedOut === true;
    console.log(
      `🔐 Is locked out: ${isLockedOut} (raw value: ${admin.isLockedOut})`,
    );
    if (isLockedOut) {
      console.log("❌ Account is locked out by admin");
      return NextResponse.json(
        {
          error:
            "You have been logged out by an administrator. Contact the administrator to regain access.",
        },
        { status: 403 },
      );
    }

    // Check if temporary password has expired
    console.log(
      `🔐 Temp password expires: ${admin.tempPasswordExpiresAt || "N/A"}`,
    );
    if (
      admin.tempPasswordExpiresAt &&
      new Date() > new Date(admin.tempPasswordExpiresAt)
    ) {
      console.log("❌ Temporary password expired");
      return NextResponse.json(
        {
          error:
            "Your temporary password has expired. Please contact the administrator to reset your password.",
        },
        { status: 403 },
      );
    }

    // Verify password — SECURITY: never log plaintext passwords or hashes
    const isBcryptHash =
      admin.password.startsWith("$2a$") || admin.password.startsWith("$2b$");

    if (!isBcryptHash) {
      console.error(
        "❌ ERROR: Password in database is NOT a bcrypt hash! This means password was not hashed on save.",
      );
    }

    const isValidPassword = await admin.comparePassword(password);

    if (!isValidPassword) {
      console.log(`❌ Invalid password for ${admin.email}`);
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 },
      );
    }

    // Determine if this is the super admin
    const isSuperAdmin = await isOriginalAdmin(admin);

    // Get allowed sections - super admin gets all, others get their assigned sections
    // IMPORTANT: Convert Mongoose array to plain JS array for JWT serialization
    const allowedSections = isSuperAdmin
      ? [...ALL_ADMIN_SECTIONS]
      : admin.allowedSections
        ? [...admin.allowedSections]
        : [];
    const role = isSuperAdmin ? "Super Admin" : admin.role || "Employee";

    console.log(`🔐 Is super admin: ${isSuperAdmin}`);
    console.log(
      `🔐 Allowed sections (${allowedSections.length}): ${JSON.stringify(allowedSections)}`,
    );

    // Update last login
    admin.lastLogin = new Date();
    admin.isOnline = true;
    await Admin.updateOne(
      { _id: admin._id },
      { lastLogin: new Date(), isOnline: true },
    );

    // Generate JWT with role, name, and sections
    const adminId = (admin._id as any).toString();
    const adminName = admin.name || admin.email.split("@")[0];
    const token = await new SignJWT({
      adminId,
      email: admin.email,
      name: adminName,
      role,
      isSuperAdmin,
      allowedSections,
    })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("7d")
      .sign(SECRET_KEY);

    const response = NextResponse.json({
      success: true,
      isFirstLogin: admin.isFirstLogin,
      admin: {
        id: adminId,
        email: admin.email,
        name: admin.name,
        role,
        isSuperAdmin,
        allowedSections,
      },
    });

    // Set HTTP-only cookie for auth
    response.cookies.set("admin_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: "/",
    });

    // Set client-accessible cookies for admin info (used by UI components)
    response.cookies.set("admin_id", adminId, {
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: "/",
    });

    response.cookies.set(
      "admin_name",
      encodeURIComponent(admin.name || admin.email.split("@")[0]),
      {
        httpOnly: false,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 7, // 7 days
        path: "/",
      },
    );

    // Log admin login
    try {
      await auditLogService.logAdminLogin({
        id: adminId,
        email: admin.email,
        name: admin.name || admin.email.split("@")[0],
        role,
      });
    } catch (auditError) {
      console.error("Failed to log admin login:", auditError);
    }

    console.log(
      `✅ Admin logged in: ${admin.email} (${role}) - Sections: ${allowedSections.length}`,
    );
    return response;
  } catch (error) {
    console.error("❌ Admin login error:", error);
    console.error(
      "❌ Error stack:",
      error instanceof Error ? error.stack : "No stack",
    );
    return NextResponse.json(
      {
        error: "Login failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
