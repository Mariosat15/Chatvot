import { redirect } from "next/navigation";

/**
 * Permanent inward redirect — challenge gameplay lives at `/play`.
 *
 * Same contract as the competition `/trade` redirect. Provider and trading challenges both
 * resolve through `/challenges/[id]/play`; this URL exists so bookmarks and `ChallengePopup`
 * accept-handlers that still name `/trade` keep working.
 */

interface ChallengeTradingPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ viewOnly?: string }>;
}

export default async function ChallengeTradingPageRedirect({
  params,
  searchParams,
}: ChallengeTradingPageProps) {
  const { id: challengeId } = await params;
  const { viewOnly } = await searchParams;
  const qs = viewOnly === "true" ? "?viewOnly=true" : "";
  redirect(`/challenges/${challengeId}/play${qs}`);
}
