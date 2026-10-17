/**
 * Section-accurate loading shells (Complobyymobile §19).
 * The competition detail page is SSR today — kept so a client refetch can reuse them.
 */

export function MobileLobbySkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-[430px] flex-col gap-4 px-4 py-4">
      <div className="h-10 w-36 animate-pulse rounded-full bg-white/5" />
      <div className="h-[140px] animate-pulse rounded-2xl bg-white/5" />
      <div className="h-28 animate-pulse rounded-2xl bg-white/5" />
      <div className="grid grid-cols-2 gap-2.5">
        <div className="h-24 animate-pulse rounded-2xl bg-white/5" />
        <div className="h-24 animate-pulse rounded-2xl bg-white/5" />
        <div className="h-24 animate-pulse rounded-2xl bg-white/5" />
        <div className="h-24 animate-pulse rounded-2xl bg-white/5" />
      </div>
      <div className="h-40 animate-pulse rounded-2xl bg-white/5" />
    </div>
  );
}
