import { DATA_ICON } from "@/lib/constants/data-icons";

/** The platform's one entry-fee icon, for inline rows that are not a stat card. */
export function EntryFeeIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={DATA_ICON.entryFee}
      alt=""
      aria-hidden
      className={`${className} shrink-0 object-contain`}
    />
  );
}
