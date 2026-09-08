"use client";

import { Check, Clock, Gamepad2, TrendingDown, TrendingUp } from "lucide-react";
import type { ContestableTitle } from "../contest-types";
import { Problem } from "./fields";

/**
 * Step one: which title the contest is played on.
 *
 * IT IS FIRST BECAUSE EVERY LATER STEP DEPENDS ON THE ANSWER. The settings form is generated
 * from this title's `configSchema`, the clock note reads its `maxDurationSeconds`, and the AI
 * panel on the next step describes this game to the model. Choosing the game last would mean
 * a form built against a schema the operator had not picked yet.
 *
 * NO GAME IS NAMED IN THIS FILE. Everything rendered here comes off the catalogue row, so a
 * title we have never seen appears with its own name, its own scoring direction and its own
 * round length. A `switch` on game code here is what would make the "no developer needed for
 * a new title" claim quietly false.
 */
export function StepChooseGame({
  titles,
  selected,
  onSelect,
}: {
  titles: ContestableTitle[];
  selected?: ContestableTitle;
  onSelect: (title: ContestableTitle) => void;
}) {
  if (titles.length === 0) {
    return (
      <Problem
        title="No games are available yet"
        lines={[
          "A game appears here once its provider is enabled, its catalogue is synced, and the title is switched on in the provider's game list.",
        ]}
      />
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-400">
        The rest of the form is built from the game you choose - its settings, its
        round length and how its scores are ranked all come from the catalogue.
      </p>

      {titles.map((title) => {
        const isSelected =
          selected?.providerKey === title.providerKey &&
          selected?.gameCode === title.gameCode;
        const lowerWins = title.scoreDirection === "lower_is_better";

        return (
          <button
            key={`${title.providerKey}:${title.gameCode}`}
            type="button"
            onClick={() => onSelect(title)}
            disabled={!title.supportsCompetition || !title.supportsContentSeed}
            className={`w-full text-left p-4 rounded-xl border transition ${
              isSelected
                ? "border-yellow-500 bg-yellow-500/10 shadow-lg shadow-yellow-500/10"
                : "border-gray-700 bg-gray-800/40 hover:border-gray-600"
            } disabled:opacity-40 disabled:cursor-not-allowed`}
          >
            <div className="flex items-start gap-4">
              <div
                className={`h-11 w-11 flex-shrink-0 rounded-xl grid place-items-center ${
                  isSelected
                    ? "bg-gradient-to-br from-yellow-500 to-yellow-600"
                    : "bg-gray-700/60"
                }`}
              >
                {isSelected ? (
                  <Check className="h-5 w-5 text-gray-900" />
                ) : (
                  <Gamepad2 className="h-5 w-5 text-gray-300" />
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-semibold text-white truncate">
                    {title.displayName}
                  </span>
                  <span className="text-xs text-gray-400 flex-shrink-0">
                    {title.providerName}
                  </span>
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                  <span className="inline-flex items-center gap-1 rounded-md bg-gray-900/70 px-2 py-1 text-gray-300">
                    {lowerWins ? (
                      <TrendingDown className="h-3 w-3 text-blue-400" />
                    ) : (
                      <TrendingUp className="h-3 w-3 text-green-400" />
                    )}
                    {lowerWins ? "Lower score wins" : "Higher score wins"}
                  </span>

                  {title.maxDurationSeconds ? (
                    <span className="inline-flex items-center gap-1 rounded-md bg-gray-900/70 px-2 py-1 text-gray-300">
                      <Clock className="h-3 w-3 text-purple-400" />
                      Up to {title.maxDurationSeconds}s an attempt
                    </span>
                  ) : null}

                  <span className="rounded-md bg-gray-900/70 px-2 py-1 text-gray-500">
                    {title.family}
                  </span>

                  {!title.supportsCompetition && (
                    <span className="rounded-md bg-red-500/15 px-2 py-1 text-red-300">
                      Does not support competitions
                    </span>
                  )}

                  {/*
                    Reason: greying the row out is not enough - an operator needs to know which
                    of the two missing capabilities to ask the provider for, and this one is
                    unlike the other refusals on this screen in that it is a fairness rule
                    rather than a feature. `01` s4.3.
                  */}
                  {!title.supportsContentSeed && (
                    <span className="rounded-md bg-red-500/15 px-2 py-1 text-red-300">
                      No identical content for every player
                    </span>
                  )}
                </div>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
