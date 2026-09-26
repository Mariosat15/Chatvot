import { getTitleLevels } from "@/lib/services/xp-config.service";
import CreateCompetitionGate from "@/components/gamemaster/CreateCompetitionGate";

// Force dynamic rendering - the ladder is read from the database on every request.
export const dynamic = "force-dynamic";

/**
 * Reason: R88/R90. The form is a client component, so it cannot read the level ladder itself.
 * This wrapper exists only to read it here and hand it down, which is the same split
 * `app/(root)/competitions/page.tsx` and the two admin contest forms already use.
 *
 * Since 23 Sep 2026 the gate also chooses trading vs provider titles when the GM package
 * allows provider contests (`19` s5 suspended for first-party / zero-cost titles).
 */
const GMCreateCompetitionPage = async () => {
  const levelLadder = await getTitleLevels();

  return <CreateCompetitionGate levelLadder={levelLadder} />;
};

export default GMCreateCompetitionPage;
