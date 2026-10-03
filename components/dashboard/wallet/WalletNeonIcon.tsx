"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * Overview-matching neon tile — contain + screen-blend so black export
 * canvases drop out and the glyph stays crisp at a fixed box size.
 * Reason: Lucide chips made Wallet Analytics look like a different product from Overview.
 */
export default function WalletNeonIcon({
  src,
  size = 56,
  className,
  ringClass,
  bgClass,
}: {
  src: string;
  size?: 24 | 32 | 36 | 44 | 56;
  className?: string;
  ringClass?: string;
  bgClass?: string;
}) {
  const box =
    size === 24
      ? "h-6 w-6 rounded-md"
      : size === 32
        ? "h-8 w-8 rounded-lg"
        : size === 36
          ? "h-9 w-9 rounded-lg"
          : size === 44
            ? "h-11 w-11 rounded-xl"
            : "h-14 w-14 rounded-[12px]";
  return (
    <span
      className={cn(
        "relative flex shrink-0 items-center justify-center overflow-hidden ring-1 shadow-[0_0_14px_rgba(255,255,255,0.08)]",
        box,
        ringClass ?? "ring-white/15",
        // Reason: no fill behind the plate — owner asked for no icon background.
        bgClass ?? "bg-transparent",
        className,
      )}
    >
      <Image
        src={src}
        alt=""
        fill
        sizes={`${size}px`}
        // Reason: scale>1 softens JPG plates; screen blend knocks the black canvas.
        className="object-contain object-center mix-blend-screen"
      />
    </span>
  );
}
