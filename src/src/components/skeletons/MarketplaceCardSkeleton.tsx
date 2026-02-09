import { Skeleton } from '@/components/ui/skeleton'

export function MarketplaceCardSkeleton() {
  return (
    <div className="bg-white/10 rounded-2xl border border-white/10 p-4 space-y-2">
      {/* Customer name header */}
      <Skeleton className="h-10 rounded-lg" />
      {/* 2-column grid: job + duration */}
      <div className="grid grid-cols-2 gap-2">
        <Skeleton className="h-14 rounded-lg" />
        <Skeleton className="h-14 rounded-lg" />
      </div>
      {/* 2-column grid: time window + rate */}
      <div className="grid grid-cols-2 gap-2">
        <Skeleton className="h-14 rounded-lg" />
        <Skeleton className="h-14 rounded-lg" />
      </div>
    </div>
  )
}

export function MarketplacePageSkeleton() {
  return (
    <div className="space-y-4">
      {/* Date header */}
      <Skeleton className="h-5 w-1/3 rounded" />
      {/* Cards */}
      {[1, 2, 3].map(i => (
        <MarketplaceCardSkeleton key={i} />
      ))}
    </div>
  )
}
