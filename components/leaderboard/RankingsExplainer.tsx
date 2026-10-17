"use client";

import { TrendingUp } from "lucide-react";

export interface ExplainerWeight {
  id: string;
  label: string;
  percent: number;
  description?: string;
}

/**
 * "How rankings work", told per board.
 *
 * Reason: the old panel published a fixed formula — 30% Total P&L, 25% ROI and
 * so on — beside a score computed from something else, and it described trading
 * alone on a screen that now ranks games too. A caption is a claim, so the
 * percentages here are the ones the server actually used: they arrive with the
 * board rather than being written into this file.
 */
export default function RankingsExplainer({
  weights,
  intro,
  notes,
}: {
  weights: ExplainerWeight[];
  intro: string;
  notes?: string[];
}) {
  return (
    <details className="rounded-2xl bg-gray-900/50 border border-gray-800 overflow-hidden">
      <summary className="p-5 cursor-pointer hover:bg-gray-800/30 transition-colors flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center">
          <TrendingUp className="h-5 w-5 text-blue-400" />
        </div>
        <span className="font-semibold text-white">How rankings work</span>
      </summary>
      <div className="px-5 pb-5 border-t border-gray-800 pt-4 space-y-4">
        <p className="text-sm text-gray-400">{intro}</p>

        {weights.length > 0 && (
          <ul className="grid gap-2 sm:grid-cols-2">
            {weights.map((weight) => (
              <li
                key={weight.id}
                className="flex items-start gap-3 rounded-xl bg-gray-800/40 px-3 py-2"
              >
                <span className="w-12 shrink-0 text-right font-mono text-sm font-bold text-primary-400">
                  {weight.percent}%
                </span>
                <span className="text-sm">
                  <span className="block font-semibold text-gray-200">
                    {weight.label}
                  </span>
                  {weight.description && (
                    <span className="block text-xs text-gray-500">
                      {weight.description}
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}

        {notes && notes.length > 0 && (
          <ul className="space-y-1.5 text-xs text-gray-500">
            {notes.map((note) => (
              <li key={note}>• {note}</li>
            ))}
          </ul>
        )}
      </div>
    </details>
  );
}
