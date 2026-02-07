'use client'

/**
 * Employer Jobs Page - 3 Tab Layout
 *
 * Tabs:
 * 1. Job Cards - All templates (blueprints). Create, edit, duplicate, publish.
 * 2. Active Jobs - All live sessions. Unclaimed alert, status filters, session actions.
 * 3. History - Past sessions. Filter by employee, customer, date, status, rating.
 */

import { useEffect, useState, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Plus, LayoutGrid, Zap, History } from 'lucide-react'
import LoadingSpinner from '@/components/LoadingSpinner'
import { JobCardsTab } from '@/components/employer/jobs/JobCardsTab'
import { ActiveJobsTab } from '@/components/employer/jobs/ActiveJobsTab'
import { HistoryTab } from '@/components/employer/jobs/HistoryTab'

type TabKey = 'cards' | 'active' | 'history'

function EmployerJobsPageContent() {
  const [employerId, setEmployerId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabaseRef = useRef(createClient())
  const supabase = supabaseRef.current
  const isMountedRef = useRef(true)

  const activeTab = (searchParams.get('tab') as TabKey) || 'cards'

  const setTab = (tab: TabKey) => {
    router.push(`/employer/jobs?tab=${tab}`, { scroll: false })
  }

  useEffect(() => {
    isMountedRef.current = true
    const init = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          router.push('/login')
          return
        }

        const { data: employer } = await supabase
          .from('employers')
          .select('id')
          .eq('user_id', user.id)
          .single()

        if (!employer) {
          router.push('/employee/marketplace')
          return
        }

        if (isMountedRef.current) {
          setEmployerId(employer.id)
        }
      } catch (error) {
        console.error('Error initializing:', error)
      } finally {
        if (isMountedRef.current) setLoading(false)
      }
    }
    init()
    return () => { isMountedRef.current = false }
  }, [])

  if (loading) {
    return <LoadingSpinner fullScreen />
  }

  if (!employerId) {
    return null
  }

  const tabs: { key: TabKey; label: string; icon: React.ReactNode }[] = [
    { key: 'cards', label: 'Job Cards', icon: <LayoutGrid className="h-4 w-4" /> },
    { key: 'active', label: 'Active Jobs', icon: <Zap className="h-4 w-4" /> },
    { key: 'history', label: 'History', icon: <History className="h-4 w-4" /> },
  ]

  return (
    <div className="min-h-screen p-4 pb-20">
      <div className="max-w-7xl mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-white">Jobs</h1>
          <Button
            onClick={() => router.push('/employer/jobs/new')}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Plus className="h-4 w-4 mr-1" />
            Create Job
          </Button>
        </div>

        {/* Tab Buttons */}
        <div className="flex gap-1 bg-white/5 border border-white/10 rounded-xl p-1">
          {tabs.map(({ key, label, icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                activeTab === key
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              {icon}
              {label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === 'cards' && <JobCardsTab employerId={employerId} />}
        {activeTab === 'active' && <ActiveJobsTab employerId={employerId} />}
        {activeTab === 'history' && <HistoryTab employerId={employerId} />}
      </div>
    </div>
  )
}

export default function EmployerJobsPage() {
  return (
    <Suspense fallback={<LoadingSpinner fullScreen />}>
      <EmployerJobsPageContent />
    </Suspense>
  )
}
