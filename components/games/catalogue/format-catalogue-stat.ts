/**
 * Compact launcher figures (12.4K / 320 / 96%). Never invents a value — callers hide zeros.
 */

export function formatCatalogueCount(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "";
  if (value < 1000) return String(Math.round(value));
  // Reason: Image 1 shows 12.4K — keep one decimal until 100K, then whole thousands.
  if (value < 100_000) {
    const k = value / 1000;
    const rounded = Math.round(k * 10) / 10;
    return `${rounded % 1 === 0 ? rounded.toFixed(0) : rounded.toFixed(1)}K`;
  }
  if (value < 1_000_000) return `${Math.round(value / 1000)}K`;
  const m = value / 1_000_000;
  const rounded = Math.round(m * 10) / 10;
  return `${rounded % 1 === 0 ? rounded.toFixed(0) : rounded.toFixed(1)}M`;
}

export function formatPositiveRate(value: number): string {
  if (!Number.isFinite(value) || value < 0) return "";
  return `${Math.min(100, Math.round(value))}%`;
}
