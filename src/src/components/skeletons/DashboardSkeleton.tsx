import { Skeleton } from '@/components/ui/skeleton'

export function DashboardSkeleton() {
  return (
    <div className="min-h-screen p-4 pb-24">
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <Skeleton className="h-8 w-36" />
          <Skeleton className="w-9 h-9 rounded-full" />
        </div>

        {/* 2x2 Section Selector Grid */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="aspect-square rounded-2xl" />
          ))}
        </div>

        {/* Content area */}
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    </div>
  )
}
