"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Play, Loader2, Search, CheckCircle, XCircle, AlertTriangle } from "lucide-react";

interface PartRow {
  id: string;
  contextId: string;
  status: string;
  rank: number;
  isWinner: boolean;
  opens: number;
  winningTrades: number;
  losingTrades: number;
  realizedPnl: number;
  pnl: number;
  openPositions: number;
}
interface CompareField {
  participants: number;
  history: number;
  match: boolean;
}
interface AccountMatch {
  userId: string;
  name: string;
  competitionParticipants: PartRow[];
  challengeParticipants: PartRow[];
  tradeHistory: {
    count: number;
    winners: number;
    losers: number;
    breakeven: number;
    realizedPnl: number;
    byCompetition: Array<{ id: string; count: number; pnl: number }>;
    byCloseReason: Array<{ reason: string; count: number }>;
  };
  openPositions: number;
  comparison: {
    realizedPnl: CompareField;
    winners: CompareField;
    losers: CompareField;
    opens: number;
    closedInHistory: number;
  };
  driftSources: {
    orphanParticipants: Array<{ participantId: string; trades: number }>;
    orphanContexts: Array<{ id: string; count: number; pnl: number }>;
  };
}
interface InspectResult {
  success: boolean;
  query?: string;
  matchCount?: number;
  matches?: AccountMatch[];
  error?: string;
}

export default function AccountInspectorCard() {
  const [query, setQuery] = useState("Marios Athinos");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<InspectResult | null>(null);

  const run = async () => {
    if (query.trim().length < 2) {
      toast.error("Enter at least 2 characters");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(
        `/api/simulator/inspect-account?q=${encodeURIComponent(query.trim())}`,
      );
      const data: InspectResult = await res.json();
      if (data.success) {
        setResult(data);
        if (!data.matchCount) toast.warning("No account matched that search");
      } else {
        toast.error(data.error || "Inspection failed");
      }
    } catch (error) {
      toast.error("Inspection failed");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="bg-gray-800/50 border-gray-700">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <Search className="h-5 w-5 text-cyan-400" />
          Inspect Account
        </CardTitle>
        <CardDescription className="text-gray-400">
          Deep-dive one account&apos;s raw participant rows vs trade history to
          confirm the exact source of any win/loss drift.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && run()}
            placeholder="Name or email…"
            className="bg-gray-900 border-gray-600 text-white"
          />
          <Button
            onClick={run}
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700 shrink-0"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Inspecting…
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-2" />
                Inspect
              </>
            )}
          </Button>
        </div>

        {result?.matches?.map((m) => (
          <AccountMatchView key={m.userId} match={m} />
        ))}
        {result && result.matchCount === 0 && (
          <p className="text-sm text-gray-500">No account matched “{result.query}”.</p>
        )}
      </CardContent>
    </Card>
  );
}

function AccountMatchView({ match: m }: { match: AccountMatch }) {
  const rows = [...m.competitionParticipants, ...m.challengeParticipants];
  const hasDrift =
    m.driftSources.orphanParticipants.length > 0 ||
    m.driftSources.orphanContexts.length > 0;

  return (
    <div className="border border-gray-700 rounded-lg p-4 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-white font-semibold">{m.name}</p>
        <div className="flex items-center gap-2">
          {m.openPositions > 0 && (
            <Badge variant="outline" className="border-blue-700 text-blue-400">
              {m.openPositions} open
            </Badge>
          )}
          <span className="text-xs text-gray-500 font-mono">{m.userId}</span>
        </div>
      </div>

      {/* Like-for-like comparison */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <CompareRow label="Realized P&L" field={m.comparison.realizedPnl} />
        <CompareRow label="Winning trades" field={m.comparison.winners} />
        <CompareRow label="Losing trades" field={m.comparison.losers} />
      </div>
      <p className="text-xs text-gray-500">
        Context: opens (positions opened) = {m.comparison.opens} · closed in
        history = {m.comparison.closedInHistory} · open now = {m.openPositions}
      </p>

      {/* Participant rows */}
      <div>
        <p className="text-xs text-gray-400 mb-1">
          Participant rows ({rows.length})
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-gray-500">
              <tr className="text-left">
                <th className="py-1 pr-2">context</th>
                <th className="py-1 pr-2">status</th>
                <th className="py-1 pr-2">rank</th>
                <th className="py-1 pr-2">opens</th>
                <th className="py-1 pr-2">win</th>
                <th className="py-1 pr-2">lose</th>
                <th className="py-1 pr-2">realizedPnl</th>
                <th className="py-1 pr-2">openPos</th>
              </tr>
            </thead>
            <tbody className="text-gray-300 font-mono">
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-gray-800">
                  <td className="py-1 pr-2">{r.contextId.slice(-8)}</td>
                  <td className="py-1 pr-2">{r.status}</td>
                  <td className="py-1 pr-2">{r.rank || "-"}</td>
                  <td className="py-1 pr-2">{r.opens}</td>
                  <td className="py-1 pr-2 text-green-400">{r.winningTrades}</td>
                  <td className="py-1 pr-2 text-red-400">{r.losingTrades}</td>
                  <td className="py-1 pr-2">{r.realizedPnl}</td>
                  <td className="py-1 pr-2">{r.openPositions}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* TradeHistory summary */}
      <div className="text-xs text-gray-400">
        <span className="text-gray-300">TradeHistory:</span> {m.tradeHistory.count}{" "}
        closed ({m.tradeHistory.winners}W / {m.tradeHistory.losers}L
        {m.tradeHistory.breakeven ? ` / ${m.tradeHistory.breakeven}BE` : ""}),
        realizedPnl {m.tradeHistory.realizedPnl}
        <div className="mt-1 flex flex-wrap gap-1">
          {m.tradeHistory.byCloseReason.map((cr) => (
            <Badge
              key={cr.reason}
              variant="outline"
              className="border-gray-600 text-gray-400"
            >
              {cr.reason}: {cr.count}
            </Badge>
          ))}
        </div>
      </div>

      {/* Drift verdict */}
      {hasDrift ? (
        <div className="rounded-lg bg-yellow-500/10 border border-yellow-700 p-3 space-y-2">
          <div className="flex items-center gap-2 text-yellow-400 text-sm font-medium">
            <AlertTriangle className="h-4 w-4" />
            Drift source found
          </div>
          {m.driftSources.orphanParticipants.length > 0 && (
            <p className="text-xs text-gray-300">
              {m.driftSources.orphanParticipants.reduce((s, o) => s + o.trades, 0)}{" "}
              history trade(s) reference{" "}
              {m.driftSources.orphanParticipants.length} participant row(s) that
              no longer exist → the participant was reset / re-created / deleted
              while its trade history remained. This is expected on reused test
              accounts and does not affect fresh client data.
            </p>
          )}
          {m.driftSources.orphanContexts.length > 0 && (
            <p className="text-xs text-gray-300">
              {m.driftSources.orphanContexts.length} competition/challenge(s) in
              history have no participant row for this user.
            </p>
          )}
        </div>
      ) : (
        <div className="rounded-lg bg-gray-900/50 border border-gray-700 p-3 text-xs text-gray-400">
          Every history row maps to an existing participant. If numbers still
          differ, check the per-row table above for the competition whose
          counter wasn&apos;t updated on close.
        </div>
      )}
    </div>
  );
}

function CompareRow({ label, field }: { label: string; field: CompareField }) {
  return (
    <div
      className={`rounded-lg border p-2 ${
        field.match
          ? "border-green-800 bg-green-500/5"
          : "border-red-800 bg-red-500/5"
      }`}
    >
      <div className="flex items-center gap-1 text-xs text-gray-400">
        {field.match ? (
          <CheckCircle className="h-3.5 w-3.5 text-green-400" />
        ) : (
          <XCircle className="h-3.5 w-3.5 text-red-400" />
        )}
        {label}
      </div>
      <p className="text-sm text-white mt-0.5">
        <span className={field.match ? "" : "text-red-400"}>
          {field.participants}
        </span>{" "}
        <span className="text-gray-500">vs</span> {field.history}
      </p>
    </div>
  );
}
