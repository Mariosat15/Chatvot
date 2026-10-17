/** Shimmer skeleton matching the arena card anatomy — used while paging. */
export function ArenaCompetitionSkeleton() {
  return (
    <div
      className="@container animate-pulse overflow-hidden rounded-[18px] border border-white/10 bg-[#050b1c]"
      aria-hidden
    >
      <div className="grid grid-cols-1 @[600px]:grid-cols-[28%_72%]">
        <div className="h-[150px] bg-white/5 p-3 @[600px]:h-auto">
          <div className="h-7 w-28 rounded-full bg-white/10" />
        </div>
        <div className="flex flex-col gap-2.5 p-3.5">
          <div className="flex justify-between gap-2">
            <div className="h-6 w-3/5 rounded bg-white/15" />
            <div className="h-7 w-24 rounded-full bg-white/10" />
          </div>
          <div className="h-4 w-full rounded bg-white/8" />
          <div className="grid grid-cols-2 gap-2 @[600px]:grid-cols-4">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="h-[72px] rounded-xl bg-white/8" />
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2 @[420px]:grid-cols-3 @[720px]:grid-cols-[repeat(3,minmax(0,1fr))_minmax(190px,1.3fr)]">
            {Array.from({ length: 3 }, (_, i) => (
              <div key={i} className="h-[72px] rounded-xl bg-white/8" />
            ))}
            <div className="col-span-full h-[64px] rounded-xl bg-white/10 @[720px]:col-span-1" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function ArenaCompetitionSkeletonGrid({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-[14px] 2xl:grid-cols-2">
      {Array.from({ length: count }, (_, i) => (
        <ArenaCompetitionSkeleton key={i} />
      ))}
    </div>
  );
}
