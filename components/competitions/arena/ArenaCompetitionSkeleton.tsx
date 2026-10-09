/** Shimmer skeleton matching horizontal card geometry — used while paging. */
export function ArenaCompetitionSkeleton() {
  return (
    <div
      className="flex min-h-[310px] animate-pulse flex-col overflow-hidden rounded-2xl border border-white/10 bg-[rgba(7,22,55,.7)] md:flex-row md:min-h-[340px]"
      aria-hidden
    >
      <div className="h-[140px] w-full bg-white/5 md:h-auto md:w-[42%]" />
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex justify-between gap-2">
          <div className="h-6 w-28 rounded-full bg-white/10" />
          <div className="h-6 w-24 rounded-full bg-white/10" />
        </div>
        <div className="h-6 w-3/4 rounded bg-white/15" />
        <div className="h-4 w-full rounded bg-white/8" />
        <div className="h-4 w-2/3 rounded bg-white/8" />
        <div className="mt-2 grid grid-cols-3 gap-2">
          <div className="h-14 rounded-xl bg-white/8" />
          <div className="h-14 rounded-xl bg-white/8" />
          <div className="h-14 rounded-xl bg-white/8" />
        </div>
        <div className="mt-auto h-12 w-full rounded-xl bg-white/10 sm:ml-auto sm:w-[200px]" />
      </div>
    </div>
  );
}

export function ArenaCompetitionSkeletonGrid({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-[14px] md:grid-cols-2">
      {Array.from({ length: count }, (_, i) => (
        <ArenaCompetitionSkeleton key={i} />
      ))}
    </div>
  );
}
