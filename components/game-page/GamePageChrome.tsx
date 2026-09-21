export function GamePagePanel({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-2xl border border-[var(--gp-border)] bg-[var(--gp-panel)] p-5 shadow-[0_0_40px_rgba(0,0,0,0.35)] ${className}`}
    >
      {children}
    </section>
  );
}

export function PlayNowButton({
  href,
  className = "",
}: {
  href: string | null;
  className?: string;
}) {
  if (!href) {
    return (
      <button
        type="button"
        disabled
        className={`inline-flex cursor-not-allowed items-center gap-2 rounded-xl bg-white/10 px-5 py-2.5 text-sm font-semibold text-white/40 ${className}`}
      >
        No session available
      </button>
    );
  }
  return (
    <a
      href={href}
      className={`inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[var(--gp-cta-from)] to-[var(--gp-cta-to)] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_0_24px_var(--gp-glow)] transition hover:brightness-110 ${className}`}
    >
      Play Now
    </a>
  );
}
