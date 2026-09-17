"use client";

export interface BoardOption {
  id: string;
  label: string;
}

/**
 * One dropdown, every board — replaces the row of tab buttons.
 *
 * Reason: the list comes from the server on every response and is never
 * hard-coded here. A per-game board is named by a stored `gameKey`, so a client
 * holding its own list stops offering a game the moment one is added, silently.
 *
 * `bg-gray-800` is deliberate and must stay opaque: a browser paints a native
 * select's option list itself and takes the background from the element, so a
 * translucent theme colour composites over the browser's light list surface and
 * renders every option white on white (R60).
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
