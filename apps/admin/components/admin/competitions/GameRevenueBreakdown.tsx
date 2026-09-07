"use client";

/**
 * Entry-fee volume, prizes, fees and payout ratio by game and by provider.
 *
 * `12` s5's acceptance criterion is that analytics and financials filter "by game **and by
 * provider**", and the two are not the same view. **Provider cost is per-provider, not
 * per-title** - a supplier bills for rounds across their whole catalogue - so a commercial
 * decision about a supplier is made on the provider row, while a scheduling decision about
 * which contest to run again is made on the title row. Showing only one of them is what makes
 * the other question unanswerable.
 *
 * It is a separate file because `CompetitionAnalytics.tsx` is already 1,500 lines, well over the
 * 500-line limit, so the direction to grow it in is out.
 *
 * ALL ARITHMETIC LIVES IN `contest-analytics-presentation.ts`, none of it here. This file
 * chooses colours and words. That split is why the aggregation can be asserted by calling it
 * with rows rather than by grepping this JSX, which can only ever prove a file mentions a field.
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Gamepad2, Server, AlertTriangle } from "lucide-react";
import {
  summariseByGame,
  summariseByProvider,
  type AnalyticsContestRow,
  type GameSummaryRow,
} from "@/lib/admin/contest-analytics-presentation";

interface Props {
  contests: AnalyticsContestRow[];
  creditSymbol: string;
}

export default function GameRevenueBreakdown({ contests, creditSymbol }: Props) {
  const byGame = summariseByGame(contests);
  const byProvider = summariseByProvider(contests);

  if (byGame.length === 0) return null;

  // Reason the provider table is hidden while there is only one group: with trading alone it is
  // a byte-for-byte repeat of the game table, and a second identical table teaches an operator
  // that one of the two is redundant - so they stop reading it on the day it stops being.
  const showProviderTable = byProvider.length > 1;

  return (
    <div className="space-y-6">
      <SummaryTable
        title="By game"
        description="Which game each competition belonged to, and what it took and paid. Grouped on the contest's immutable game key, so a renamed or retired title keeps its history in one row."
        icon={<Gamepad2 className="h-5 w-5 text-cyan-400" />}
        rows={byGame}
        firstColumn="Game"
        showProvider
        creditSymbol={creditSymbol}
      />

      {showProviderTable && (
        <SummaryTable
          title="By provider"
          description="The same figures grouped by supplier, because a provider's cost is charged across their whole catalogue rather than per title. Trading is shown alongside as our own."
          icon={<Server className="h-5 w-5 text-purple-400" />}
          rows={byProvider}
          firstColumn="Provider"
          showProvider={false}
          creditSymbol={creditSymbol}
        />
      )}
    </div>
  );
}

function SummaryTable({
  title,
  description,
  icon,
  rows,
  firstColumn,
  showProvider,
  creditSymbol,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  rows: GameSummaryRow[];
  firstColumn: string;
  showProvider: boolean;
  creditSymbol: string;
}) {
  const estimatedTotal = rows.reduce((sum, row) => sum + row.estimatedFeeContests, 0);

  return (
    <Card className="bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700 shadow-xl">
      <CardHeader>
        <CardTitle className="text-white text-xl flex items-center gap-2">
          <div className="h-10 w-10 bg-gray-700/50 rounded-lg flex items-center justify-center">
            {icon}
          </div>
          {title}
        </CardTitle>
        <CardDescription className="text-sm">{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow className="border-gray-700">
              <TableHead className="text-gray-400">{firstColumn}</TableHead>
              <TableHead className="text-gray-400 text-right">Contests</TableHead>
              <TableHead className="text-gray-400 text-right">Entrants</TableHead>
              <TableHead className="text-gray-400 text-right">Collected</TableHead>
              <TableHead className="text-gray-400 text-right">Prizes paid</TableHead>
              <TableHead className="text-gray-400 text-right">Platform fee</TableHead>
              <TableHead className="text-gray-400 text-right">Payout ratio</TableHead>
              <TableHead className="text-gray-400 text-right">Average pot</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.key} className="border-gray-700">
                <TableCell>
                  <div className="font-semibold text-white">{row.label}</div>
                  <div className="text-xs text-gray-500">
                    {showProvider && row.provider ? `${row.provider} · ` : ""}
                    {row.completed} completed
                    {row.cancelled > 0 ? `, ${row.cancelled} cancelled` : ""}
                  </div>
                </TableCell>
                <TableCell className="text-right text-gray-300 tabular-nums">
                  {row.contests}
                </TableCell>
                <TableCell className="text-right text-gray-300 tabular-nums">
                  {row.participants}
                </TableCell>
                <TableCell className="text-right text-white tabular-nums">
                  {creditSymbol} {Math.round(row.collected).toLocaleString()}
                </TableCell>
                <TableCell className="text-right text-green-400 tabular-nums">
                  {creditSymbol} {Math.round(row.prizesPaid).toLocaleString()}
                </TableCell>
                <TableCell className="text-right text-yellow-400 tabular-nums">
                  {creditSymbol} {Math.round(row.platformFees).toLocaleString()}
                  {row.estimatedFeeContests > 0 && (
                    <span className="ml-1 text-[10px] text-yellow-600">est.</span>
                  )}
                </TableCell>
                {/*
                  Reason a dash rather than 0%: nothing collected means there is no ratio, and a
                  bold `0%` beside a free contest reads as a payout failure. Same distinction as
                  the score column's `-` (R45) and the unclaimed rank's `null` prize.
                */}
                <TableCell className="text-right text-gray-300 tabular-nums">
                  {row.payoutRatio === null ? "-" : `${row.payoutRatio.toFixed(1)}%`}
                </TableCell>
                <TableCell className="text-right text-gray-300 tabular-nums">
                  {row.averagePot === null
                    ? "-"
                    : `${creditSymbol} ${Math.round(row.averagePot).toLocaleString()}`}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {estimatedTotal > 0 && (
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-yellow-500/30 bg-yellow-900/10 p-3 text-xs text-yellow-300/90">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              {estimatedTotal === 1
                ? "One competition has no recorded platform-fee ledger row, so its fee is inferred from the configured percentage and marked"
                : `${estimatedTotal} competitions have no recorded platform-fee ledger row, so their fees are inferred from the configured percentage and marked`}{" "}
              <span className="font-semibold">est.</span> Those figures will not reconcile
              against the platform ledger.
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
