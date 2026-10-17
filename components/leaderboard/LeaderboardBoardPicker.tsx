"use client";

export interface BoardOption {
  id: string;
  label: string;
}

/**
 * One dropdown — Global, Trading, Games.
 *
 * Reason: the list comes from the server. Opaque `bg-gray-800` stays (R60 —
 * translucent backgrounds make native option text white-on-white).
 */
export default function LeaderboardBoardPicker({
  boards,
  value,
  onChange,
  disabled,
}: {
  boards: BoardOption[];
  value: string;
  onChange: (boardId: string) => void;
  disabled?: boolean;
}) {
  return (
    <label className="flex items-center gap-2">
      <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
        Board
      </span>
      <select
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 min-w-[200px] rounded-xl border border-gray-700 bg-gray-800 px-3 text-sm font-semibold text-white focus:border-primary-500 focus:outline-none disabled:opacity-60"
      >
        {boards.map((board) => (
          <option key={board.id} value={board.id}>
            {board.label}
          </option>
        ))}
      </select>
    </label>
  );
}
