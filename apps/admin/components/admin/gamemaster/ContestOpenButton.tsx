"use client";

import Link from "next/link";
import { Eye } from "lucide-react";
import { adminContestViewHref } from "@/lib/admin/admin-contest-href";

/**
 * The "Open" button beside a competition or challenge row on Manage Game Masters. It goes to
 * the same admin view page the Competitions and Challenges screens open.
 *
 * Opening the page still needs that page's own section grant; this link widens nothing.
 */
export default function ContestOpenButton({
  kind,
  id,
}: {
  kind: string;
  id: string | null | undefined;
}) {
  const href = adminContestViewHref(kind, id);
  // Reason: an earning written before ids were returned, or a row whose kind is unknown,
  // has nowhere to go - say so rather than render a button that opens a 404.
  if (!href) {
    return <span className="text-xs text-gray-500">No link</span>;
  }
  const label = kind === "challenge" ? "Open challenge" : "Open competition";
  return (
    <Link
      href={href}
      aria-label={label}
      title={label}
      className="inline-flex items-center gap-1 rounded-md border border-blue-500 px-2.5 py-1 text-xs font-medium text-blue-400 transition-colors hover:bg-blue-500 hover:text-white"
    >
      <Eye className="h-3.5 w-3.5" />
      Open
    </Link>
  );
}
