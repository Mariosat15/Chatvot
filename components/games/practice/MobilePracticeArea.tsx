"use client";

import Link from "next/link";
import { GraduationCap, Loader2, Play } from "lucide-react";
import type { GameScoreType } from "@/lib/utils/format-game-score";
import type { PracticeRoundView } from "../practice-state";
import { PRACTICE_FEATURES } from "./practice-features";
import { MobilePracticeHistory } from "./MobilePracticeHistory";
import "./mobile-practice.css";

interface MobilePracticeAreaProps {
  slug: string;
  gameName: string;
  scoreType?: GameScoreType;
  rounds: PracticeRoundView[];
  launching: boolean;
  refusal: string | null;
  historyBusy: boolean;
  onLaunch: () => void;
  onForget: (roundId: string) => void;
  onClearAll: () => void;
}

/**
 * Touch-first Practice Area below the md breakpoint. Same APIs and facts as desktop; different UX —
 * compact header, short copy, 2×2 HUD chips, full-width CTA, history capped at three rows.
 * Reason (8 Oct 2026, owner plan): do not shrink the desktop lobby.
 */
export function MobilePracticeArea({
  slug,
  gameName,
  scoreType,
  rounds,
  launching,
  refusal,
  historyBusy,
  onLaunch,
  onForget,
  onClearAll,
}: MobilePracticeAreaProps) {
  return (
    <div className="m-practice">
      <header className="m-practice__header">
        <p className="m-practice__eyebrow">Practice area</p>
        <h1 className="m-practice__game">{gameName}</h1>
      </header>

      <section className="m-practice-card" aria-label={`Practice ${gameName}`}>
        <div className="m-practice-card__icon-row">
          <div className="m-practice-card__icon">
            <GraduationCap aria-hidden />
          </div>
        </div>
        <h2 className="m-practice-card__title">{`Practice ${gameName}`}</h2>
        <p className="m-practice-card__desc">
          Solo practice is free, does not affect your ranking, and has no prize. Play as
          many rounds as you like.
        </p>

        <ul className="m-practice-features">
          {PRACTICE_FEATURES.map(({ shortLabel, tone, Icon }) => (
            <li key={shortLabel} className={`m-practice-chip m-practice-chip--${tone}`}>
              <span className="m-practice-chip__glyph" aria-hidden>
                <Icon />
              </span>
              <span>{shortLabel}</span>
            </li>
          ))}
        </ul>

        {refusal ? (
          <p role="alert" className="m-practice-card__refusal">
            {refusal}
          </p>
        ) : null}

        <button
          type="button"
          className="m-practice-cta"
          onClick={onLaunch}
          disabled={launching}
        >
          {launching ? (
            <Loader2 className="m-practice-cta__spin" aria-hidden />
          ) : (
            <Play className="m-practice-cta__play" aria-hidden />
          )}
          {launching ? "Starting…" : "Start practice"}
        </button>
      </section>

      <MobilePracticeHistory
        rounds={rounds}
        scoreType={scoreType}
        onForget={onForget}
        onClearAll={onClearAll}
        busy={historyBusy}
      />

      <Link href={`/games/${slug}`} className="m-practice__back">
        ← Back to {gameName}
      </Link>
    </div>
  );
}
