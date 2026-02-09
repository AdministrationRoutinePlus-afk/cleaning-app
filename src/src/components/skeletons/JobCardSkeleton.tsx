import { Skeleton } from '@/components/ui/skeleton'

export function JobCardSkeleton() {
  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-3">
      {/* Status badge + title */}
      <div className="flex items-center gap-2">
        <Skeleton className="h-5 w-16 rounded-full" />
        <Skeleton className="h-5 w-32" />
      </div>
      {/* 2-column grid for duration/rate */}
      <div className="grid grid-cols-2 gap-3">
        <Skeleton className="h-10 rounded-lg" />
        <Skeleton className="h-10 rounded-lg" />
      </div>
      {/* Action buttons row */}
      <div className="flex gap-2">
        <Skeleton className="h-8 w-20 rounded-lg" />
        <Skeleton className="h-8 w-20 rounded-lg" />
      </div>
    </div>
  )
}

export function JobCardsTabSkeleton() {
  return (
    <div className="space-y-4">
      {/* Filter toggles */}
      <div className="flex gap-2">
        <Skeleton className="h-8 w-16 rounded-lg" />
        <Skeleton className="h-8 w-16 rounded-lg" />
        <Skeleton className="h-8 w-20 rounded-lg" />
      </div>
      {/* Customer groups */}
      {[1, 2, 3].map(i => (
        <div key={i} className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
          {/* Customer header */}
          <div className="px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Skeleton className="w-4 h-4 rounded" />
              <Skeleton className="w-8 h-8 rounded-full" />
              <Skeleton className="h-4 w-28" />
            </div>
            <Skeleton className="h-4 w-14" />
          </div>
        </div>
      ))}
    </div>
  )
}
