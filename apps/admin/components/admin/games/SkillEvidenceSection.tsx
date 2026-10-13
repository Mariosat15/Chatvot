"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { BarChart3, Download, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTerms } from "@/contexts/TerminologyContext";

/**
 * Skill Evidence: section 9 item 4 of the preliminary legal opinion. For each title it
 * shows the three measures a regulator asks about, each next to what pure chance would
 * produce, read from settled results only (`skill-evidence.service.ts`).
 *
 * A figure with no chance baseline beside it is not evidence, so every measure here has
 * one. A thin sample is labelled rather than hidden. Hiding it makes a young title look
 * as though it has no evidence, while showing it unlabelled lets noise be quoted as proof.
 */

interface Bucket {
  label: string;
  entries: number;
  meanPercentile: number | null;
  winRate: number | null;
  chanceWinRate: number | null;
}

interface TitleEvidence {
  gameKey: string;
  displayName: string;
  contests: number;
  entries: number;
  players: number;
  repeatPlayers: number;
  stability: { pairs: number; correlation: number | null };
  experience: { correlation: number | null; buckets: Bucket[] };
  winners: {
    wins: number;
    distinctWinners: number;
    repeatWinners: number;
    expectedRepeatWinnersByChance: number;
    topWinnerShare: number | null;
  };
  sufficient: boolean;
}

const pct = (v: number | null) => (v === null ? "-" : `${Math.round(v * 100)}%`);
const corr = (v: number | null) => (v === null ? "-" : v.toFixed(2));

function verdict(r: number | null): string {
  if (r === null) return "not enough data";
  if (r >= 0.3) return "strong skill signal";
  if (r >= 0.1) return "weak skill signal";
  if (r > -0.1) return "indistinguishable from chance";
  return "inverse - investigate";
}

export default function SkillEvidenceSection() {
  const terms = useTerms();
  const [titles, setTitles] = useState<TitleEvidence[]>([]);
  const [minPairs, setMinPairs] = useState(30);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/games/skill-evidence", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error);
      setTitles(data.titles);
      setMinPairs(data.minPairs);
      setGeneratedAt(data.generatedAt);
    } catch {
      toast.error("Could not load skill evidence. Something went wrong. Please contact support.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const download = () => {
    const blob = new Blob([JSON.stringify({ generatedAt, minPairs, titles }, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `skill-evidence-${(generatedAt ?? "").slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-bold text-white">
            <BarChart3 className="h-6 w-6 text-emerald-400" /> Skill Evidence
          </h2>
          <p className="mt-1 max-w-3xl text-sm text-gray-400">
            Settled results per title: whether the same players keep placing well, whether
            experience predicts winning, and how spread out the winners are. Each figure is shown
            beside what pure chance would give. Report the rows for titles counsel has classified
            as Category A.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => void load()} disabled={loading}>
            <RefreshCw className="mr-2 h-4 w-4" /> Refresh
          </Button>
          <Button onClick={download} disabled={loading || titles.length === 0}>
            <Download className="mr-2 h-4 w-4" /> Download for counsel
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      ) : titles.length === 0 ? (
        <p className="rounded-lg border border-gray-700 bg-gray-800/50 p-6 text-sm text-gray-400">
          No settled {terms.game} {terms.contests} yet. Evidence appears once {terms.contests} have finished and paid out.
        </p>
      ) : (
        titles.map((t) => (
          <div key={t.gameKey} className="space-y-4 rounded-lg border border-gray-700 bg-gray-800/50 p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="text-lg font-semibold text-white">{t.displayName}</h3>
              <span className="text-xs text-gray-400">
                {t.contests} {terms.contests} · {t.entries} entries · {t.players} {terms.players} · {t.repeatPlayers} repeat {terms.players}
              </span>
            </div>
            {!t.sufficient && (
              <p className="rounded border border-amber-500/30 bg-amber-500/10 p-2 text-xs text-amber-300">
                Small sample: {t.stability.pairs} repeat-play pairs, fewer than {minPairs}. Do not quote
                these correlations as evidence yet.
              </p>
            )}

            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded border border-gray-700 p-3">
                <p className="text-xs uppercase text-gray-400">Score stability (repeat players)</p>
                <p className="mt-1 text-2xl font-bold text-white">{corr(t.stability.correlation)}</p>
                <p className="text-xs text-gray-400">
                  Correlation of a {terms.player}&apos;s finishing position with their next one, over {t.stability.pairs} pairs.
                  Chance: 0.00. {verdict(t.stability.correlation)}.
                </p>
              </div>
              <div className="rounded border border-gray-700 p-3">
                <p className="text-xs uppercase text-gray-400">Experience vs winning</p>
                <p className="mt-1 text-2xl font-bold text-white">{corr(t.experience.correlation)}</p>
                <p className="text-xs text-gray-400">
                  Rank correlation between {terms.contests} already played and finishing position. Chance: 0.00.{" "}
                  {verdict(t.experience.correlation)}.
                </p>
              </div>
              <div className="rounded border border-gray-700 p-3">
                <p className="text-xs uppercase text-gray-400">Spread of winners</p>
                <p className="mt-1 text-2xl font-bold text-white">
                  {t.winners.distinctWinners} / {t.winners.wins}
                </p>
                <p className="text-xs text-gray-400">
                  Distinct winners over wins. {t.winners.repeatWinners} {terms.players} won twice or more, against{" "}
                  {t.winners.expectedRepeatWinnersByChance} expected by chance. Top 10% of winners took{" "}
                  {pct(t.winners.topWinnerShare)} of wins.
                </p>
              </div>
            </div>

            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-gray-400">
                  <th className="py-1">Experience</th>
                  <th>Entries</th>
                  <th>Mean position</th>
                  <th>Win rate</th>
                  <th>Chance win rate</th>
                </tr>
              </thead>
              <tbody>
                {t.experience.buckets.map((b) => (
                  <tr key={b.label} className="border-t border-gray-700 text-gray-200">
                    <td className="py-1">{b.label}</td>
                    <td>{b.entries}</td>
                    <td>{pct(b.meanPercentile)}</td>
                    <td>{pct(b.winRate)}</td>
                    <td>{pct(b.chanceWinRate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-xs text-gray-500">
              Mean position: 100% is always first, 0% always last, 50% is what chance gives.
            </p>
          </div>
        ))
      )}
    </div>
  );
}
