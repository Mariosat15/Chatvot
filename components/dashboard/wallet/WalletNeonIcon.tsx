"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * Overview-matching neon tile — contain + soft glow so operator art is not cropped.
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
        bgClass ?? "bg-black/35",
        className,
      )}
    >
      <span className="pointer-events-none absolute inset-0 z-[1] bg-gradient-to-br from-white/10 to-transparent" />
      <Image
        src={src}
        alt=""
        fill
        sizes={`${size}px`}
        className="scale-[1.08] object-contain object-center drop-shadow-[0_0_10px_rgba(255,255,255,0.3)]"
      />
    </span>
  );
}
