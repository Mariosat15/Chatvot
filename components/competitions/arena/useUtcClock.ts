"use client";

import { useEffect, useState } from "react";

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export function formatUtcParts(date = new Date()): {
  time: string;
  dateLabel: string;
} {
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const h = date.getUTCHours();
  const m = date.getUTCMinutes();
  const s = date.getUTCSeconds();
  const time = `${pad(h)}:${pad(m)}:${pad(s)}`;
  const dateLabel = `${days[date.getUTCDay()]}, ${pad(date.getUTCDate())} ${months[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
  return { time, dateLabel };
}

export function useUtcClock(): { time: string; dateLabel: string } {
  const [parts, setParts] = useState(() => formatUtcParts());
  useEffect(() => {
    const id = window.setInterval(() => setParts(formatUtcParts()), 1000);
    return () => window.clearInterval(id);
  }, []);
  return parts;
}
