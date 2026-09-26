import { redirect } from "next/navigation";
import {
  isCompetitionIdShaped,
  logMalformedCompetitionId,
} from "@/lib/utils/competition-id";
import { notFound } from "next/navigation";

/**
 * Permanent inward redirect — the `/play` dispatcher owns every contest's gameplay.
 *
 * Trading contests render the trading workspace from `/play`; provider contests render the
 * provider host there. Old bookmarks, emails and CTAs that still name `/trade` keep working.
 * `viewOnly` is preserved so "Review charts" links still open the history view.
 *
 * Chapter 13 section 1: `/trade` is a redirect, never a second play surface.
 */

interface TradingPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ viewOnly?: string }>;
}

export default async function TradingPageRedirect({
  params,
  searchParams,
}: TradingPageProps) {
  const { id: competitionId } = await params;
  const { viewOnly } = await searchParams;

  if (!isCompetitionIdShaped(competitionId)) {
    logMalformedCompetitionId("/competitions/[id]/trade", competitionId);
    notFound();
  }

  const qs = viewOnly === "true" ? "?viewOnly=true" : "";
  redirect(`/competitions/${competitionId}/play${qs}`);
}
