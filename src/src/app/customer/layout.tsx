'use client'

import { BottomNav } from '@/components/BottomNav'
import { ErrorBoundary } from '@/components/ErrorBoundary'

export default function CustomerLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      <ErrorBoundary>
        {children}
      </ErrorBoundary>
      <BottomNav profile="CUSTOMER" />
    </>
  )
}
