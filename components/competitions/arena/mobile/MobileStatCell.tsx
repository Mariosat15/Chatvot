"use client";

import Image from "next/image";
import { useState, type ReactNode } from "react";
import { Info } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

/**
 * Phone stat chip: icon, label above value, and a tap-to-open explanation.
 *
 * Reason: a phone has no hover, so the whole chip is a button that pins the
 * explanation in a popover, the same help the desktop card offers. The value
 * never truncates; it keeps the full figure on one line where it fits.
 */
export function MobileStatCell({
  icon,
  label,
  explanation,
  children,
  tone = "default",
}: {
  icon: string;
  label: string;
  explanation: string;
  children: ReactNode;
  tone?: "default" | "prize";
}) {
  const [open, setOpen] = useState(false);
  const prize = tone === "prize";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`${label}: ${explanation}`}
          className={`relative flex min-h-[46px] w-full min-w-0 items-center gap-2 rounded-lg border px-2 py-1.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/80 ${
            prize
              ? "border-amber-300/45 bg-amber-400/10"
              : "border-white/10 bg-black/45"
          }`}
        >
          <Image
            src={icon}
            alt=""
            width={22}
            height={22}
            className="h-[22px] w-[22px] shrink-0 object-contain"
          />
          <span className="min-w-0 flex-1 pr-3">
            <span
              className={`block text-[10px] font-semibold leading-tight ${
                prize ? "text-amber-200/90" : "text-white/60"
              }`}
            >
              {label}
            </span>
            <span
              className={`block break-words font-black leading-tight text-white tabular-nums ${
                prize ? "text-[15px]" : "text-[13px]"
              }`}
            >
              {children}
            </span>
          </span>
          <Info
            aria-hidden
            className="pointer-events-none absolute right-1.5 top-1.5 h-3 w-3 text-white/35"
          />
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        sideOffset={8}
        onOpenAutoFocus={(event) => event.preventDefault()}
        className="w-[min(16rem,calc(100vw-2rem))] border-cyan-300/35 bg-[#071126] px-3 py-2 text-xs leading-relaxed text-slate-100 shadow-[0_0_24px_rgba(0,216,255,.2)]"
      >
        <span className="mb-0.5 block font-bold text-white">{label}</span>
        {explanation}
      </PopoverContent>
    </Popover>
  );
}
