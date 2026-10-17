/**
 * Fallback artwork when Circuit Sprint (or a puzzle title) has no gameplay preview.
 * Decorative only — never prints scores or titles as baked-in text.
 */
export function CircuitSprintFallbackArt() {
  return (
    <svg
      viewBox="0 0 640 360"
      className="h-full w-full"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <defs>
        <linearGradient id="gpCircuitBg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#0a0e1a" />
          <stop offset="100%" stopColor="#1a1040" />
        </linearGradient>
        <filter id="gpGlow">
          <feGaussianBlur stdDeviation="3" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <rect width="640" height="360" fill="url(#gpCircuitBg)" />
      <g filter="url(#gpGlow)" strokeWidth="3" fill="none">
        <path d="M80 280 C160 280 160 80 240 80" stroke="#00e5ff" />
        <path d="M240 80 C320 80 320 280 400 280" stroke="#a855f7" />
        <path d="M400 280 C480 280 480 120 560 120" stroke="#ec4899" />
      </g>
      {[
        [80, 280, "#00e5ff", "1"],
        [240, 80, "#a855f7", "2"],
        [400, 280, "#ec4899", "3"],
        [560, 120, "#fbbf24", "4"],
      ].map(([x, y, color, label]) => (
        <g key={String(label)}>
          <circle
            cx={Number(x)}
            cy={Number(y)}
            r="18"
            fill="#0a0e1a"
            stroke={String(color)}
            strokeWidth="3"
            filter="url(#gpGlow)"
          />
          <text
            x={Number(x)}
            y={Number(y) + 5}
            textAnchor="middle"
            fill={String(color)}
            fontSize="14"
            fontWeight="700"
          >
            {label}
          </text>
        </g>
      ))}
    </svg>
  );
}
