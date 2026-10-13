import type { DifficultyLevel } from "@/lib/utils/competition-difficulty";
import { NeonNote, NeonPanel } from "@/components/neon/Cards";
import { NEON_ICON } from "@/lib/services/games/overview-assets";

/**
 * Difficulty from real configured data (Complobyymobile §12).
 * Score is the existing calculator output — not invented from a label alone.
 */

const DIFFICULTY_TEXT = new Map<DifficultyLevel, string>([
  ["Novice", "text-emerald-300"],
  ["Apprentice", "text-emerald-300"],
  ["Skilled", "text-sky-300"],
  ["Expert", "text-sky-300"],
  ["Elite", "text-amber-300"],
  ["Master", "text-amber-300"],
  ["Grand Master", "text-orange-300"],
  ["Champion", "text-orange-300"],
  ["Legend", "text-rose-300"],
  ["Trading God", "text-rose-300"],
]);

const DIFFICULTY_COPY = new Map<DifficultyLevel, string>([
  ["Novice", "Great first game - learn as you go!"],
  ["Apprentice", "Easy going, with room to grow."],
  ["Skilled", "A fair fight - not too easy, not too hard."],
  ["Expert", "Tougher rivals. Bring your A-game!"],
  ["Elite", "Hard. Only sharp traders will shine."],
  ["Master", "Very hard. The pros come here."],
  ["Grand Master", "Brutal! Guard your money every move."],
  ["Champion", "Huge pressure, huge glory."],
  ["Legend", "Only the very best survive this one."],
  ["Trading God", "The final boss. Good luck!"],
]);

export function MobileLobbyDifficulty({
  difficultyData,
}: {
  difficultyData: {
    level: DifficultyLevel;
    label: string;
    score: number;
  };
}) {
  const tone = DIFFICULTY_TEXT.get(difficultyData.level) ?? "text-gray-300";

  return (
    <NeonPanel
      iconSrc={NEON_ICON("target-purple")}
      accent="score"
      title="Difficulty"
      size="lg"
      action={
        <span className={`text-sm font-black ${tone}`}>
          {difficultyData.label}
        </span>
      }
    >
      <div className="h-2.5 overflow-hidden rounded-full border border-white/10 bg-black/40">
        <div
          className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-sky-400 to-rose-500"
          style={{
            width: `${Math.min(100, Math.max(0, difficultyData.score))}%`,
          }}
        />
      </div>
      <div className="mt-2 flex justify-between text-[11px] font-semibold text-gray-400">
        <span>Easier</span>
        <span className={`font-bold ${tone}`}>{difficultyData.score}/100</span>
        <span>Harder</span>
      </div>
      <NeonNote>
        {DIFFICULTY_COPY.get(difficultyData.level) ??
          "A fair fight - not too easy, not too hard."}
      </NeonNote>
    </NeonPanel>
  );
}
