"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { BarChart3, Download, FileText, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HelpTooltip } from "@/components/ui/help-tooltip";
import { useTerms } from "@/contexts/TerminologyContext";
import {
  evidenceCards,
  pct,
  smallSampleWarning,
  TABLE_HELP,
  type Tone,
} from "@/lib/admin/skill-evidence-copy";
import { describeEvidenceRange } from "@/lib/admin/skill-evidence-range";
import type { TitleSkillEvidence } from "@/lib/services/games/skill-evidence.service";

/**
 * Skill Evidence: section 9 item 4 of the preliminary legal opinion. For each title it
 * shows the three measures a regulator asks about, each next to what pure chance would
 * produce, read from settled results only (`skill-evidence.service.ts`).
 *
 * Wording and verdicts come from `skill-evidence-copy.ts`, which the regulator PDF uses
 * too, so the screen and the report cannot describe one figure two ways. A thin sample is
 * labelled rather than hidden: hiding it makes a young title look as though it has no
 * evidence, while showing it unlabelled lets noise be quoted as proof.
 */

const TONE_CLASS: Record<Tone, string> = {
  skill: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
  weak: "border-sky-500/40 bg-sky-500/10 text-sky-300",
  chance: "border-gray-500/40 bg-gray-500/10 text-gray-300",
  inverse: "border-rose-500/40 bg-rose-500/10 text-rose-300",
  none: "border-gray-600/40 bg-gray-700/20 text-gray-400",
};

const today = () => new Date().toISOString().slice(0, 10);
const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);

const PRESETS = [
  { label: "Last 30 days", from: () => daysAgo(30) },
  { label: "Last 90 days", from: () => daysAgo(90) },
  { label: "This year", from: () => `${new Date().getUTCFullYear()}-01-01` },
];

const DATE_INPUT =
  "rounded-md border border-gray-600 bg-gray-900 px-2 py-1.5 text-sm text-white [color-scheme:dark]";

function Th({ label, help }: { label: string; help: string }) {
  return (
    <th className="py-1">
      <span className="inline-flex items-center gap-1">
        {label} <HelpTooltip content={help} side="top" className="size-4" />
      </span>
    </th>
  );
}

export default function SkillEvidenceSection() {
  const pack = useTerms();
  // The pack is title case ("Players") for headings; these sentences need it mid-line.
  const terms = {
    contest: pack.contest.toLowerCase(),
    contests: pack.contests.toLowerCase(),
    player: pack.player.toLowerCase(),
    players: pack.players.toLowerCase(),
    game: pack.game.toLowerCase(),
  };
  const nouns = { player: terms.player, players: terms.players, contests: terms.contests };
  const [titles, setTitles] = useState<TitleSkillEvidence[]>([]);
  const [minPairs, setMinPairs] = useState(30);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [applied, setApplied] = useState<{ from: string; to: string }>({ from: "", to: "" });

  const load = useCallback(async (range: { from: string; to: string }) => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (range.from) qs.set("from", range.from);
      if (range.to) qs.set("to", range.to);
      const res = await fetch(`/api/games/skill-evidence?${qs.toString()}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error);
      setTitles(data.titles);
      setMinPairs(data.minPairs);
      setGeneratedAt(data.generatedAt);
      setApplied(range);
    } catch (error) {
      toast.error(
        error instanceof Error && error.message
          ? error.message
          : "Could not load skill evidence. Something went wrong. Please contact support.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load({ from: "", to: "" });
  }, [load]);

  const apply = (range: { from: string; to: string }) => {
    setFrom(range.from);
    setTo(range.to);
    void load(range);
  };

  const downloadPdf = async () => {
    setExporting(true);
    try {
      const res = await fetch("/api/games/skill-evidence/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from: applied.from || null, to: applied.to || null }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Something went wrong. Please contact support.");
      }
      const blob = await res.blob();
      const name =
        /filename="([^"]+)"/.exec(res.headers.get("Content-Disposition") ?? "")?.[1] ?? "skill-evidence.pdf";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      a.click();
      URL.revokeObjectURL(url);
      if (res.headers.get("X-Narrative-Source") === "rules") {
        toast.info("AI is switched off or unavailable, so the report uses a standard written summary.");
      } else {
        toast.success("Report downloaded. Review the AI-written summary before sending it.");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Something went wrong. Please contact support.");
    } finally {
      setExporting(false);
    }
  };

  const downloadJson = () => {
    const blob = new Blob(
      [JSON.stringify({ generatedAt, from: applied.from || null, to: applied.to || null, minPairs, titles }, null, 2)],
      { type: "application/json" },
    );
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
            Does skill or luck decide who wins? For each game, this page checks three things from finished,
            paid-out {terms.contests} and compares each one with what pure luck would produce.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => void load(applied)} disabled={loading}>
            <RefreshCw className="mr-2 h-4 w-4" /> Refresh
          </Button>
          <Button variant="outline" onClick={downloadJson} disabled={loading || titles.length === 0}>
            <Download className="mr-2 h-4 w-4" /> Raw data
          </Button>
          <Button onClick={() => void downloadPdf()} disabled={loading || exporting || titles.length === 0}>
            {exporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
            {exporting ? "Writing report..." : "Download PDF report"}
          </Button>
        </div>
      </div>

      <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-4 text-sm text-gray-300">
        <p className="font-semibold text-emerald-300">How to read this page</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Each game has three questions. The big number is the answer; the coloured label says what it means.</li>
          <li>
            For the first two, <strong>0 means luck</strong> and closer to 1 means skill. 0.30 or more is a clear sign of
            skill.
          </li>
          <li>The third compares how many people won more than once with how many would by luck alone.</li>
          <li>A yellow warning means there are not enough games yet - do not quote those numbers as proof.</li>
          <li>Hover or tap any ? for a fuller explanation.</li>
        </ul>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-gray-700 bg-gray-800/50 p-4">
        <label className="text-xs text-gray-400">
          From
          <input type="date" value={from} max={to || today()} onChange={(e) => setFrom(e.target.value)} className={`mt-1 block ${DATE_INPUT}`} />
        </label>
        <label className="text-xs text-gray-400">
          To
          <input type="date" value={to} min={from || undefined} max={today()} onChange={(e) => setTo(e.target.value)} className={`mt-1 block ${DATE_INPUT}`} />
        </label>
        <Button onClick={() => apply({ from, to })} disabled={loading}>
          Apply
        </Button>
        <Button variant="outline" onClick={() => apply({ from: "", to: "" })} disabled={loading}>
          All time
        </Button>
        {PRESETS.map((p) => (
          <Button key={p.label} variant="ghost" size="sm" onClick={() => apply({ from: p.from(), to: today() })} disabled={loading}>
            {p.label}
          </Button>
        ))}
        <p className="ml-auto text-xs text-gray-400">
          Showing: <span className="text-white">{describeEvidenceRange(applied.from || null, applied.to || null)}</span>{" "}
          (by the day each {terms.contest} ended)
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      ) : titles.length === 0 ? (
        <p className="rounded-lg border border-gray-700 bg-gray-800/50 p-6 text-sm text-gray-400">
          No settled {terms.game} {terms.contests} in this period. Evidence appears once {terms.contests} have finished and paid out.
        </p>
      ) : (
        titles.map((t) => (
          <div key={t.gameKey} className="space-y-4 rounded-lg border border-gray-700 bg-gray-800/50 p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="text-lg font-semibold text-white">{t.displayName}</h3>
              <span className="text-xs text-gray-400">
                {t.contests} {terms.contests} · {t.entries} entries · {t.players} {terms.players} · {t.repeatPlayers} played more than once
              </span>
            </div>
            {!t.sufficient && (
              <p className="rounded border border-amber-500/30 bg-amber-500/10 p-2 text-xs text-amber-300">
                {smallSampleWarning(t.stability.pairs, minPairs)}
              </p>
            )}

            <div className="grid gap-4 md:grid-cols-3">
              {evidenceCards(t, nouns).map((c) => (
                <div key={c.id} className="rounded border border-gray-700 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold text-white">{c.question}</p>
                    <HelpTooltip content={c.help} side="left" />
                  </div>
                  <p className="text-[11px] uppercase tracking-wide text-gray-500">{c.technical}</p>
                  <p className="mt-2 text-2xl font-bold text-white">{c.value}</p>
                  <span className={`mt-1 inline-block rounded border px-2 py-0.5 text-xs ${TONE_CLASS[c.verdict.tone]}`}>
                    {c.verdict.label}
                  </span>
                  <p className="mt-2 text-xs text-gray-400">{c.reading}</p>
                </div>
              ))}
            </div>

            <div>
              <p className="mb-1 text-sm font-semibold text-white">Do experienced {terms.players} do better?</p>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase text-gray-400">
                    <Th label="Experience" help={TABLE_HELP.experience} />
                    <Th label="Entries" help={TABLE_HELP.entries} />
                    <Th label="Average finish" help={TABLE_HELP.meanPosition} />
                    <Th label="Actually won" help={TABLE_HELP.winRate} />
                    <Th label="Would win by luck" help={TABLE_HELP.chanceWinRate} />
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
              <p className="mt-1 text-xs text-gray-500">
                Average finish: 100% = always first, 0% = always last, 50% = what luck gives. If skill matters, the
                &quot;Actually won&quot; column beats &quot;Would win by luck&quot; more as experience grows.
              </p>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
