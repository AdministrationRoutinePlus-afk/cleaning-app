import { cn } from '@/lib/utils'

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('animate-pulse bg-white/10 rounded-xl', className)}
      {...props}
    />
  )
}

export { Skeleton }
