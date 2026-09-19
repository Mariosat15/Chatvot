import { getTitleLevels } from "@/lib/services/xp-config.service";
import GMCreateCompetitionContent from "./page-content";

// Force dynamic rendering - the ladder is read from the database on every request.
export const dynamic = "force-dynamic";

/**
 * Reason: R88/R90. The form is a client component, so it cannot read the level ladder itself.
 * This wrapper exists only to read it here and hand it down, which is the same split
 * `app/(root)/competitions/page.tsx` and the two admin contest forms already use.
 */
const GMCreateCompetitionPage = async () => {
  const levelLadder = await getTitleLevels();

  return <GMCreateCompetitionContent levelLadder={levelLadder} />;
};

export default GMCreateCompetitionPage;
