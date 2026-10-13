"use client";

import * as React from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";

import { cn } from "@/lib/utils";

const TooltipProvider = TooltipPrimitive.Provider;

/**
 * Radix tooltips open on hover and focus only, and deliberately close on a tap - so on a
 * phone they never appear at all (owner, 13 Oct 2026: "tooltips for mobile not work").
 * The root below owns the open state so the trigger can open it from a touch tap; a tap
 * outside closes it through Radix's own outside-pointer handling. Mouse behaviour is
 * unchanged.
 */
type TouchTapApi = { isOpen: () => boolean; openFromTap: () => void };

const TouchTapContext = React.createContext<TouchTapApi | null>(null);

function Tooltip({
  open: openProp,
  defaultOpen,
  onOpenChange,
  ...props
}: React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Root>) {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(defaultOpen ?? false);
  const controlled = openProp !== undefined;
  const open = controlled ? openProp : uncontrolledOpen;

  const setOpen = React.useCallback(
    (next: boolean) => {
      if (!controlled) setUncontrolledOpen(next);
      onOpenChange?.(next);
    },
    [controlled, onOpenChange]
  );

  const api = React.useMemo<TouchTapApi>(
    () => ({
      isOpen: () => open,
      // Reason: Radix's trigger closes the tooltip in its own click handler, which runs
      // after ours - opening on the next tick lets the tap win.
      openFromTap: () => window.setTimeout(() => setOpen(true), 0),
    }),
    [open, setOpen]
  );

  return (
    <TouchTapContext.Provider value={api}>
      <TooltipPrimitive.Root open={open} onOpenChange={setOpen} {...props} />
    </TouchTapContext.Provider>
  );
}

const TooltipTrigger = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Trigger>
>(({ onPointerDown, onClick, ...props }, ref) => {
  const tap = React.useContext(TouchTapContext);
  const tapState = React.useRef({ touch: false, wasOpen: false });

  return (
    <TooltipPrimitive.Trigger
      ref={ref}
      onPointerDown={(event) => {
        tapState.current = {
          touch: event.pointerType !== "mouse",
          wasOpen: tap?.isOpen() ?? false,
        };
        onPointerDown?.(event);
      }}
      onClick={(event) => {
        onClick?.(event);
        // A second tap on the trigger closes it, so only open when it was closed.
        if (tapState.current.touch && !tapState.current.wasOpen && !event.defaultPrevented) {
          tap?.openFromTap();
        }
      }}
      {...props}
    />
  );
});
TooltipTrigger.displayName = TooltipPrimitive.Trigger.displayName;

const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 4, ...props }, ref) => (
  <TooltipPrimitive.Portal>
    <TooltipPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        "z-50 max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-md border border-gray-700 bg-gray-900 px-3 py-1.5 text-sm text-gray-100 shadow-md animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
        className,
      )}
      {...props}
    />
  </TooltipPrimitive.Portal>
));
TooltipContent.displayName = TooltipPrimitive.Content.displayName;

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider };
