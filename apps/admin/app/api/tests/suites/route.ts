import { NextResponse } from "next/server";
import path from "path";
import fs from "fs/promises";

/**
 * GET /api/tests/suites
 * Scan __tests__/ directory to list available test files
 */
export async function GET() {
  try {
    // Reason: The test files live in the monorepo root, not in apps/admin.
    // We resolve upward from the admin app to the workspace root.
    const rootDir = path.resolve(process.cwd(), "..", "..");
    const testsDir = path.join(rootDir, "__tests__");

    let suites: { name: string; path: string; relativePath: string }[] = [];

    try {
      const entries = await scanTestFiles(testsDir, testsDir);
      suites = entries;
    } catch {
      // __tests__ directory may not exist on this server
    }

    return NextResponse.json({ success: true, suites });
  } catch (error) {
    console.error("Error scanning test suites:", error);
    return NextResponse.json(
      { success: false, error: "Failed to scan test suites" },
      { status: 500 },
    );
  }
}

async function scanTestFiles(
  dir: string,
  baseDir: string,
): Promise<{ name: string; path: string; relativePath: string }[]> {
  const results: { name: string; path: string; relativePath: string }[] = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory() && entry.name !== "node_modules" && entry.name !== "helpers") {
      const nested = await scanTestFiles(fullPath, baseDir);
      results.push(...nested);
    } else if (entry.isFile() && /\.(test|spec)\.(ts|tsx|js|jsx)$/.test(entry.name)) {
      const relativePath = path.relative(baseDir, fullPath).replace(/\\/g, "/");
      const name = entry.name.replace(/\.(test|spec)\.(ts|tsx|js|jsx)$/, "");
      results.push({ name, path: fullPath, relativePath });
    }
  }

  return results;
}
