import Link from "next/link";
import { redirect } from "next/navigation";
import { TrendingUp, Gamepad2 } from "lucide-react";
import { requireSectionAccess } from "@/lib/admin/auth";
import { listContestableTitles } from "@/lib/services/game-providers/provider-contest.service";
import { ProviderContestWizard } from "@/components/admin/games/ProviderContestWizard";
import { WizardPageHeader } from "@/components/admin/wizard/WizardShell";
import type { ContestableTitle } from "@/components/admin/games/contest-types";

/**
 * The game picker: the one shared entry point to contest creation.
 *
 * A NEW ROUTE RATHER THAN A CHANGE TO `/competitions/create`. That page is the trading
 * wizard, 2,892 lines of it, and chapter 12 requires trading creation to be unchanged.
 * Interposing a picker inside it would put a step in front of every trading contest an
 * operator creates and would need that file edited; a sibling route needs neither.
 * `/competitions/create` still works if typed or bookmarked.
 *
 * WITH NO PROVIDER GAMES AVAILABLE IT REDIRECTS STRAIGHT TO TRADING. Reason: until a
 * provider is live, a "choose your game" screen with exactly one choice is pure friction,
 * and friction on the path operators use daily is how a new screen gets worked around.
 */

export const dynamic = "force-dynamic";

export default async function NewContestPage({
  searchParams,
}: {
  searchParams: Promise<{ game?: string }>;
}) {
  // Follows the `dashboard/page.tsx` convention: unauthenticated goes to login, and a
  // signed-in employee without the grant goes back to the dashboard rather than to a login
  // screen they are already past.
  try {
    await requireSectionAccess("competitions");
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    redirect(message === "Unauthorized" ? "/login" : "/dashboard");
  }

  const params = await searchParams;

  let titles: ContestableTitle[] = [];
  try {
    titles = (await listContestableTitles()) as ContestableTitle[];
  } catch (error) {
    // A provider lookup failure must not block trading contest creation, which needs none
    // of it. Log and carry on with an empty list.
    console.error("❌ Could not load provider games for the picker:", error);
  }

  if (params.game === "provider") {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-900 to-gray-800">
        {/*
          THE SAME BANNER AS THE TRADING WIZARD, from the shared shell. The owner's report was
          that the two creation screens looked like two different products; the header is half
          of what made that true, so it cannot stay a local one-off here.

          `icon` is passed as a rendered element rather than as `Gamepad2` itself: this page is
          a server component, and a component is a function, which cannot cross that boundary.
        */}
        <WizardPageHeader
          title="Create Game Competition"
          subtitle="Configure and launch a new competition on a provider game"
          icon={<Gamepad2 />}
          backHref="/competitions/new"
          backLabel="Choose a different game"
        />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <ProviderContestWizard titles={titles} />
        </div>
      </div>
    );
  }

  if (titles.length === 0) {
    redirect("/competitions/create");
  }

  return (
    <div className="min-h-screen bg-gray-900 p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white">
            What game is this contest on?
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            Each game has its own settings, so the rest of the form depends on this answer.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Link
            href="/competitions/create"
            className="block p-6 rounded-2xl border border-gray-700 hover:border-yellow-500 bg-gray-800/50 transition"
          >
            <TrendingUp className="h-8 w-8 text-yellow-400 mb-3" />
            <h2 className="font-semibold text-white">Trading</h2>
            <p className="text-sm text-gray-400 mt-1">
              Instruments, starting capital and leverage. The full trading wizard.
            </p>
          </Link>

          <Link
            href="/competitions/new?game=provider"
            className="block p-6 rounded-2xl border border-gray-700 hover:border-yellow-500 bg-gray-800/50 transition"
          >
            <Gamepad2 className="h-8 w-8 text-yellow-400 mb-3" />
            <h2 className="font-semibold text-white">A provider game</h2>
            <p className="text-sm text-gray-400 mt-1">
              {titles.length} game{titles.length === 1 ? "" : "s"} available. Settings come
              from the game itself.
            </p>
          </Link>
        </div>
      </div>
    </div>
  );
}
