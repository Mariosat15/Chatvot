/**
 * Competition Start Job
 *
 * Every minute: starts each due competition, or cancels and refunds it when it has fewer
 * than its minimum players (or its game provider is down). Same shared service the Inngest
 * cron calls, so the platform no longer depends on Inngest firing for refunds to happen.
 */

import { connectToDatabase } from "../config/database";

export async function runCompetitionStartCheck() {
  await connectToDatabase();
  const { startOrCancelDueCompetitions } = await import(
    "../../lib/services/competition-start.service"
  );
  return startOrCancelDueCompetitions({ revalidate: false });
}

export default runCompetitionStartCheck;
