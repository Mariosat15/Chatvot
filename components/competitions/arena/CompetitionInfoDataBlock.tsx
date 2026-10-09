"use client";

import { useState, type PointerEvent, type ReactNode } from "react";
import { Info } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { CompetitionDataShell } from "./CompetitionDataBlock";

/**
 * A data box with help that works with a mouse, keyboard, or touch.
 *
 * Reason: a native title only helps mouse users. The whole box is therefore a
 * real button: mouse hover previews the explanation, while click/Enter/touch
 * pins a popover until the player presses elsewhere or closes it.
 */
export function CompetitionInfoDataBlock({
  icon,
  label,
  value,
  explanation,
  accent,
}: {
  icon: string;
  label: string;
  value: ReactNode;
  explanation: string;
  accent: string;
}) {
  const [open, setOpen] = useState(false);

  const showForMouse = (event: PointerEvent<HTMLButtonElement>) => {
    if (event.pointerType === "mouse") setOpen(true);
  };
  const hideForMouse = (event: PointerEvent<HTMLButtonElement>) => {
    if (event.pointerType === "mouse") setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`${label}: ${explanation}`}
          className="group relative block h-full w-full cursor-help rounded-xl text-left outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/80"
          onPointerEnter={showForMouse}
          onPointerLeave={hideForMouse}
        >
          <CompetitionDataShell
            icon={icon}
            label={label}
            value={value}
            accent={accent}
          />
          <Info
            aria-hidden
            className="pointer-events-none absolute right-1.5 top-1.5 size-3 text-white/35 transition-colors group-hover:text-white/80 group-focus-visible:text-white/80"
          />
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        sideOffset={8}
        onOpenAutoFocus={(event) => event.preventDefault()}
        className="w-[min(18rem,calc(100vw-2rem))] border-cyan-300/35 bg-[#071126] px-3 py-2 text-xs leading-relaxed text-slate-100 shadow-[0_0_24px_rgba(0,216,255,.2)]"
      >
        {explanation}
      </PopoverContent>
    </Popover>
  );
}
