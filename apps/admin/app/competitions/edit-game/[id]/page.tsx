import { redirect } from "next/navigation";
import Link from "next/link";
import { requireSectionAccess } from "@/lib/admin/auth";
import { connectToDatabase } from "@/database/mongoose";
import AppSettings from "@/database/models/app-settings.model";
import { ProviderContestEditor } from "@/components/admin/games/ProviderContestEditor";

/**
 * Editing a provider-game contest.
 *
 * A SIBLING ROUTE TO `/competitions/edit/[id]`, NOT A BRANCH INSIDE IT. That page fetches
 * the contest server-side and hands it to the trading editor; making it conditional would
 * mean editing the trading edit path to add a game it does not understand, which is exactly
 * the "no phase may require a simultaneous change to trading in order to be correct" rule.
 *
 * The route is `edit-game`, not `edit/game`, because `edit/[id]` already owns that segment -
 * `edit/game` would be read as a contest with the id "game".
 *
 * The guard follows the `competitions/new` convention: not signed in goes to login, signed
 * in without the grant goes to the dashboard rather than to a login screen they are past.
 */

export const dynamic = "force-dynamic";

export default async function EditGameContestPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  try {
    await requireSectionAccess("competitions");
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    redirect(message === "Unauthorized" ? "/login" : "/dashboard");
  }

  const { id } = await params;

  // The entry-fee label reads the operator's configured credit symbol rather than the
  // formatter's default. Reason: the editor is a client component that fetches the contest
  // itself, so without this it printed the fallback glyph - which is right for a platform
  // nobody has configured and wrong, silently, for every platform that has.
  await connectToDatabase();
  const appSettings = await AppSettings.findById("app-settings")
    .select("credits.symbol")
    .lean<{ credits?: { symbol?: string } } | null>()
    .catch(() => null);

  return (
    <div className="min-h-screen bg-gray-900 p-6">
      <div className="max-w-3xl mx-auto mb-6">
        <Link
          href="/?activeTab=competitions"
          className="text-sm text-gray-400 hover:text-white"
        >
          &larr; Back to competitions
        </Link>
      </div>
      <div className="max-w-3xl mx-auto">
        <ProviderContestEditor
          competitionId={id}
          creditSymbol={appSettings?.credits?.symbol || undefined}
        />
      </div>
    </div>
  );
}
