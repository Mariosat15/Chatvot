import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/database/mongoose";
import { guardSection } from "@/lib/admin/section-route-guard";
import { auditLogService } from "@/lib/services/audit-log.service";
import { parseReferredPlayersQuery } from "@/lib/services/gamemaster/referral-report-filter";
import { readReferredPlayers } from "@/lib/services/gamemaster/referral-read-model";
import {
  EXPORT_BATCH_SIZE,
  REFERRED_PLAYERS_EXPORT_CAP,
  csvHeaderLine,
  csvRowLine,
  describeFilterForAudit,
  exportCapMessage,
} from "@/lib/admin/gm-report-csv";

const GENERIC_ERROR = "Something went wrong. Please contact support.";

/**
 * GET /api/gamemasters/report/export?format=csv&<the report's filters>
 *
 * The FULL filtered set of referred players as CSV (`External game plans/24` s7.5).
 *
 * Reason: TWO grants. Viewing the report is `gamemaster-management`; a bulk file of every
 * player's email is a different act, so it also needs `gamemaster-reports-export`, which no
 * default role template carries. Every export - and every refusal at the cap - is written to
 * the audit log with who, which filters and how many rows, BEFORE the first byte is streamed,
 * so a download that is interrupted is still on record.
 *
 * xlsx is deferred, deliberately: it needs a new dependency (`exceljs`) that has not been
 * vetted yet, and CSV opens in every spreadsheet.
 */
export async function GET(request: NextRequest) {
  const view = await guardSection("gamemaster-management");
  if (!view.ok) return view.response;
  const guard = await guardSection("gamemaster-reports-export");
  if (!guard.ok) return guard.response;

  const params = new URL(request.url).searchParams;
  const format = params.get("format") ?? "csv";
  if (format !== "csv") {
    return NextResponse.json(
      { success: false, error: "Only CSV export is available. Excel export is not built yet." },
      { status: 400 },
    );
  }

  const actor = {
    id: guard.admin.id,
    email: guard.admin.email,
    name: guard.admin.name ?? guard.admin.email.split("@")[0],
    role: guard.admin.role ?? "admin",
  };

  try {
    await connectToDatabase();
    const db = mongoose.connection.db;
    if (!db) throw new Error("Database connection unavailable");

    const { filter } = parseReferredPlayersQuery(params);
    // Reason: one clock for every batch, so "active in the last 30 days" cannot change
    // meaning half way through the file.
    const now = new Date();
    const first = await readReferredPlayers(db, filter, { page: 1, limit: EXPORT_BATCH_SIZE }, now);
    const auditFilter = describeFilterForAudit(filter);

    if (first.total > REFERRED_PLAYERS_EXPORT_CAP) {
      await auditLogService.logSystemAction(
        actor,
        "gm_report_export_refused",
        `Referred-players export refused: ${first.total} rows exceeds the cap of ${REFERRED_PLAYERS_EXPORT_CAP}`,
        { filters: auditFilter, rowCount: first.total, cap: REFERRED_PLAYERS_EXPORT_CAP },
      );
      return NextResponse.json(
        { success: false, error: exportCapMessage(first.total) },
        { status: 400 },
      );
    }

    await auditLogService.logSystemAction(
      actor,
      "gm_report_exported",
      `Exported ${first.total} referred-player rows as CSV`,
      { filters: auditFilter, rowCount: first.total, format: "csv" },
    );

    const total = first.total;
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          // Reason: the BOM makes Excel read the file as UTF-8, so accented names survive.
          controller.enqueue(encoder.encode("\uFEFF" + csvHeaderLine()));
          for (const row of first.rows) controller.enqueue(encoder.encode(csvRowLine(row)));
          let sent = first.rows.length;
          for (let page = 2; sent < total; page++) {
            const batch = await readReferredPlayers(db, filter, { page, limit: EXPORT_BATCH_SIZE }, now);
            if (batch.rows.length === 0) break;
            for (const row of batch.rows) controller.enqueue(encoder.encode(csvRowLine(row)));
            sent += batch.rows.length;
          }
          controller.close();
        } catch (error) {
          console.error("❌ Referred-players export stream failed:", error);
          controller.error(error);
        }
      },
    });

    const stamp = now.toISOString().slice(0, 10);
    return new Response(stream, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="gm-referred-players-${stamp}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("❌ Referred-players export failed:", error);
    return NextResponse.json({ success: false, error: GENERIC_ERROR }, { status: 500 });
  }
}
