'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import LoadingSpinner from '@/components/LoadingSpinner'

/**
 * History page now redirects to the main jobs page with the history tab active.
 * The HistoryTab component handles all the functionality.
 */
export default function JobsHistoryPage() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/employer/jobs?tab=history')
  }, [router])

  return <LoadingSpinner fullScreen />
}
