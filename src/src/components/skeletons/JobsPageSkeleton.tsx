import { Skeleton } from '@/components/ui/skeleton'

export function JobsPageSkeleton() {
  return (
    <div className="min-h-screen p-4 pb-20">
      <div className="max-w-7xl mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-20" />
          <Skeleton className="h-9 w-28 rounded-lg" />
        </div>

        {/* Tab bar */}
        <Skeleton className="h-11 rounded-xl" />

        {/* Content: simulated customer groups */}
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-14 rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  )
}
