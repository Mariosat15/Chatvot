import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/database/mongoose";
import TestSchedule from "@/database/models/test-schedule.model";

/**
 * GET /api/tests/schedule
 * Get the current test schedule configuration.
 */
export async function GET() {
  try {
    await connectToDatabase();

    let schedule = await TestSchedule.findOne().lean();

    if (!schedule) {
      const created = await TestSchedule.create({
        frequency: "manual",
        isActive: false,
      });
      schedule = created.toObject();
    }

    return NextResponse.json({ success: true, schedule });
  } catch (error) {
    console.error("Error fetching test schedule:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch test schedule" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/tests/schedule
 * Save test schedule configuration.
 * Body: { frequency, dayOfWeek, dayOfMonth, timeOfDay, timezone, isActive, suites }
 */
export async function POST(request: NextRequest) {
  try {
    await connectToDatabase();

    const body = await request.json();
    const {
      frequency,
      dayOfWeek,
      dayOfMonth,
      timeOfDay,
      timezone,
      isActive,
      suites,
    } = body;

    let schedule = await TestSchedule.findOne();

    if (schedule) {
      if (frequency !== undefined) schedule.frequency = frequency;
      if (dayOfWeek !== undefined) schedule.dayOfWeek = dayOfWeek;
      if (dayOfMonth !== undefined) schedule.dayOfMonth = dayOfMonth;
      if (timeOfDay !== undefined) schedule.timeOfDay = timeOfDay;
      if (timezone !== undefined) schedule.timezone = timezone;
      if (isActive !== undefined) schedule.isActive = isActive;
      if (suites !== undefined) schedule.suites = suites;

      if (schedule.isActive && schedule.frequency !== "manual") {
        schedule.nextRunAt = computeNextRun(schedule);
      } else {
        schedule.nextRunAt = undefined;
      }

      await schedule.save();
    } else {
      const nextRunAt =
        isActive && frequency !== "manual"
          ? computeNextRun({ frequency, dayOfWeek, dayOfMonth, timeOfDay, timezone })
          : undefined;

      schedule = await TestSchedule.create({
        frequency: frequency || "manual",
        dayOfWeek: dayOfWeek ?? 0,
        dayOfMonth: dayOfMonth ?? 1,
        timeOfDay: timeOfDay || "00:00",
        timezone: timezone || "UTC",
        isActive: isActive ?? false,
        suites: suites || [],
        nextRunAt,
      });
    }

    return NextResponse.json({ success: true, schedule });
  } catch (error) {
    console.error("Error saving test schedule:", error);
    return NextResponse.json(
      { success: false, error: "Failed to save test schedule" },
      { status: 500 },
    );
  }
}

function computeNextRun(config: {
  frequency?: string;
  dayOfWeek?: number;
  dayOfMonth?: number;
  timeOfDay?: string;
  timezone?: string;
}): Date {
  const now = new Date();
  const [hours, minutes] = (config.timeOfDay || "00:00").split(":").map(Number);
  const next = new Date(now);
  next.setUTCHours(hours, minutes, 0, 0);

  if (config.frequency === "weekly") {
    const targetDay = config.dayOfWeek ?? 0;
    const currentDay = next.getUTCDay();
    let daysUntil = targetDay - currentDay;
    if (daysUntil < 0 || (daysUntil === 0 && next <= now)) daysUntil += 7;
    next.setUTCDate(next.getUTCDate() + daysUntil);
  } else if (config.frequency === "monthly") {
    const targetDay = config.dayOfMonth ?? 1;
    next.setUTCDate(targetDay);
    if (next <= now) {
      next.setUTCMonth(next.getUTCMonth() + 1);
      next.setUTCDate(targetDay);
    }
  }

  if (next <= now) {
    next.setUTCDate(next.getUTCDate() + 1);
  }

  return next;
}
