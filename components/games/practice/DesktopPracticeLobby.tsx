"use client";

import Link from "next/link";
import { GraduationCap, Loader2, Play } from "lucide-react";
import { PracticeRecentList } from "../PracticeRecentList";
import type { GameScoreType } from "@/lib/utils/format-game-score";
import type { PracticeRoundView } from "../practice-state";
import { PRACTICE_FEATURES } from "./practice-features";

interface DesktopPracticeLobbyProps {
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
 * Desktop Practice Area lobby (md+). Layout and proportions stay as built for the
 * cyber HUD target — mobile is a separate tree, not a shrink of this screen.
 */
export function DesktopPracticeLobby({
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
}: DesktopPracticeLobbyProps) {
  return (
    <div>
      <header className="practice-header">
        <p className="practice-header__eyebrow">Practice area</p>
        <h1 className="practice-header__title">{gameName}</h1>
      </header>

      <section className="practice-hud practice-hero" aria-label={`Practice ${gameName}`}>
        <div className="practice-hud__glow" aria-hidden />
        <div className="practice-hero__icon-row">
          <div className="practice-hero__icon">
            <GraduationCap aria-hidden />
          </div>
        </div>
        <h2 className="practice-hero__title">{`Practice ${gameName}`}</h2>
        <p className="practice-hero__desc">
          This is solo practice. It&apos;s free to play, does not count towards any ranking,
          and there is no prize. Play as many practice rounds as you like.
        </p>
        <ul className="practice-features">
          {PRACTICE_FEATURES.map(({ label, tone, Icon }) => (
            <li key={label} className={`practice-feature practice-feature--${tone}`}>
              <span className="practice-feature__glyph" aria-hidden>
                <Icon />
              </span>
              <span>{label}</span>
            </li>
          ))}
        </ul>
        {refusal ? (
          <p role="alert" className="practice-hero__refusal">
            {refusal}
          </p>
        ) : null}
        <div className="practice-cta-wrap">
          <span className="practice-cta-wrap__chevron" aria-hidden>
            ‹
          </span>
          <button
            type="button"
            onClick={onLaunch}
            disabled={launching}
            className="practice-cta"
          >
            {launching ? (
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
            ) : (
              <Play className="h-5 w-5 fill-current" aria-hidden />
            )}
            {launching ? "Starting…" : "Start practice"}
          </button>
          <span className="practice-cta-wrap__chevron" aria-hidden>
            ›
          </span>
        </div>
      </section>

      <PracticeRecentList
        rounds={rounds}
        scoreType={scoreType}
        onForget={onForget}
        onClearAll={onClearAll}
        busy={historyBusy}
      />

      <Link href={`/games/${slug}`} className="practice-back">
        ← Back to the game page
      </Link>
    </div>
  );
}
