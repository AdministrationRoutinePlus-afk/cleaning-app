'use client'

import { BottomNav } from '@/components/BottomNav'
import { ErrorBoundary } from '@/components/ErrorBoundary'

export default function CustomerLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="fixed inset-0 bg-gradient-to-br from-gray-900 via-gray-800 to-black overflow-hidden">
      <div className="h-full overflow-y-auto pb-20">
        <ErrorBoundary>
          {children}
        </ErrorBoundary>
      </div>
      <BottomNav profile="CUSTOMER" />
    </div>
  )
}
