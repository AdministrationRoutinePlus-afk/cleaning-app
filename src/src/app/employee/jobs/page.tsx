'use client'

import { useEffect, useState, useRef } from 'react'
import type { JobSessionFull } from '@/types/database'
import { createClient } from '@/lib/supabase/client'
import { MyJobCard } from '@/components/employee/MyJobCard'
import LoadingSpinner from '@/components/LoadingSpinner'
import { Briefcase, History, Play, ThumbsUp, Clock, CheckCircle, XCircle, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { useTranslation } from '@/lib/i18n/useTranslation'

type MainTab = 'current' | 'history'
type SubTab = 'active' | 'upcoming' | 'pending' | 'completed' | 'refused' | 'issues'

export default function EmployeeJobsPage() {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(true)
  const [jobs, setJobs] = useState<JobSessionFull[]>([])
  const [mainTab, setMainTab] = useState<MainTab>('current')
  const [subTab, setSubTab] = useState<SubTab>('active')
  const contentRef = useRef<HTMLDivElement>(null)
  const supabaseRef = useRef(createClient())
  const supabase = supabaseRef.current
  const isMountedRef = useRef(true)

  // Fetch jobs for the current employee
  const fetchJobs = async () => {
    setLoading(true)
    try {
      // Get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError || !user) {
        console.error('Error getting user:', userError)
        return
      }

      // Get employee record for current user
      const { data: employeeData, error: employeeError } = await supabase
        .from('employees')
        .select('id')
        .eq('user_id', user.id)
        .single()

      if (employeeError || !employeeData) {
        console.error('Error getting employee:', employeeError)
        return
      }

      // Fetch job sessions with related data
      const { data, error } = await supabase
        .from('job_sessions')
        .select(`
          *,
          job_template:job_templates(
            *,
            customer:customers(*)
          )
        `)
        .eq('assigned_to', employeeData.id)
        .order('scheduled_date', { ascending: true })

      if (error) {
        console.error('Error fetching jobs:', error)
        return
      }

      if (!isMountedRef.current) return

      // Type assertion to ensure proper typing
      const typedData = data as unknown as JobSessionFull[]
      setJobs(typedData || [])
    } catch (error) {
      console.error('Error in fetchJobs:', error)
      toast.error(t('Failed to load your jobs'))
    } finally {
      if (isMountedRef.current) {
        setLoading(false)
      }
    }
  }

  // Load jobs on mount
  useEffect(() => {
    isMountedRef.current = true
    fetchJobs()
    return () => { isMountedRef.current = false }
  }, [])

  // Scroll to top when tabs change
  useEffect(() => {
    const scrollContainer = document.getElementById('main-scroll-container')
    if (scrollContainer) {
      scrollContainer.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }, [mainTab, subTab])

  // Helper to check if job is missed or overdue (for backwards compatibility)
  const isJobMissedOrOverdue = (session: JobSessionFull) => {
    if (session.status === 'MISSED' || session.status === 'OVERDUE') return true
    if (!session.scheduled_date) return false

    const now = new Date()
    const jobTemplate = session.job_template

    if (jobTemplate?.time_window_end) {
      const [endH, endM] = jobTemplate.time_window_end.split(':').map(Number)
      const endDate = new Date(session.scheduled_end_date || session.scheduled_date)
      endDate.setHours(endH, endM, 0, 0)

      if (now > endDate) {
        return session.status === 'APPROVED' || session.status === 'IN_PROGRESS'
      }
    } else {
      const endOfDay = new Date(session.scheduled_end_date || session.scheduled_date)
      endOfDay.setHours(23, 59, 59, 999)
      if (now > endOfDay) {
        return session.status === 'APPROVED' || session.status === 'IN_PROGRESS'
      }
    }
    return false
  }

  // Filter jobs by status for each tab
  const pendingJobs = jobs.filter(job => job.status === 'CLAIMED') // Waiting for employer approval
  const approvedJobs = jobs.filter(job => job.status === 'APPROVED' && !isJobMissedOrOverdue(job))
  const inProgressJobs = jobs.filter(job => job.status === 'IN_PROGRESS' && !isJobMissedOrOverdue(job))
  const completedJobs = jobs.filter(job =>
    job.status === 'COMPLETED' || job.status === 'EVALUATED'
  )
  const refusedJobs = jobs.filter(job => job.status === 'REFUSED')
  const issueJobs = jobs.filter(job =>
    job.status === 'MISSED' || job.status === 'OVERDUE' || isJobMissedOrOverdue(job)
  )

  // Get job count for each tab
  const getCounts = () => ({
    pending: pendingJobs.length,
    approved: approvedJobs.length,
    inProgress: inProgressJobs.length,
    completed: completedJobs.length,
    refused: refusedJobs.length,
    issues: issueJobs.length
  })

  const counts = getCounts()

  // Count totals for main tabs
  const currentCount = counts.inProgress + counts.approved + counts.pending
  const historyCount = counts.completed + counts.refused + counts.issues

  const handleMainTabChange = (tab: MainTab) => {
    setMainTab(tab)
    // Set default sub-tab for each main tab
    if (tab === 'current') {
      setSubTab('active')
    } else {
      setSubTab('completed')
    }
  }

  const handleSubTabChange = (tab: SubTab) => {
    setSubTab(tab)
  }

  // Get jobs for current sub-tab
  const getJobsForSubTab = () => {
    switch (subTab) {
      case 'active': return inProgressJobs
      case 'upcoming': return approvedJobs
      case 'pending': return pendingJobs
      case 'completed': return completedJobs
      case 'refused': return refusedJobs
      case 'issues': return issueJobs
      default: return []
    }
  }

  const getEmptyMessage = () => {
    switch (subTab) {
      case 'active': return t('No jobs in progress')
      case 'upcoming': return t('No upcoming jobs')
      case 'pending': return t('No pending approvals')
      case 'completed': return t('No completed jobs yet')
      case 'refused': return t('No refused jobs')
      case 'issues': return t('No issues')
      default: return t('No jobs')
    }
  }

  const currentSubTabs = [
    { id: 'active' as SubTab, label: 'Active', count: counts.inProgress, color: 'blue', icon: Play },
    { id: 'upcoming' as SubTab, label: 'Upcoming', count: counts.approved, color: 'green', icon: ThumbsUp },
    { id: 'pending' as SubTab, label: 'Pending', count: counts.pending, color: 'amber', icon: Clock }
  ]

  const historySubTabs = [
    { id: 'completed' as SubTab, label: 'Completed', count: counts.completed, color: 'purple', icon: CheckCircle },
    { id: 'refused' as SubTab, label: 'Refused', count: counts.refused, color: 'red', icon: XCircle },
    { id: 'issues' as SubTab, label: 'Issues', count: counts.issues, color: 'orange', icon: AlertTriangle }
  ]

  const getSubTabStyle = (color: string, isActive: boolean) => {
    if (!isActive) return 'bg-white/5 text-gray-300 border-2 border-white/10 hover:border-white/20 hover:bg-white/10'
    switch (color) {
      case 'blue': return 'bg-gradient-to-br from-blue-600 to-blue-800 text-white shadow-lg shadow-blue-500/30 border-2 border-blue-400'
      case 'green': return 'bg-gradient-to-br from-green-600 to-green-800 text-white shadow-lg shadow-green-500/30 border-2 border-green-400'
      case 'amber': return 'bg-gradient-to-br from-amber-600 to-amber-800 text-white shadow-lg shadow-amber-500/30 border-2 border-amber-400'
      case 'purple': return 'bg-gradient-to-br from-purple-600 to-purple-800 text-white shadow-lg shadow-purple-500/30 border-2 border-purple-400'
      case 'red': return 'bg-gradient-to-br from-red-600 to-red-800 text-white shadow-lg shadow-red-500/30 border-2 border-red-400'
      case 'orange': return 'bg-gradient-to-br from-orange-600 to-orange-800 text-white shadow-lg shadow-orange-500/30 border-2 border-orange-400'
      default: return 'bg-gradient-to-br from-blue-600 to-blue-800 text-white shadow-lg shadow-blue-500/30 border-2 border-blue-400'
    }
  }

  const activeSubTabs = mainTab === 'current' ? currentSubTabs : historySubTabs
  const currentJobs = getJobsForSubTab()

  return (
    <div className="min-h-screen pb-20">
      <div className="max-w-lg mx-auto p-4">
        {/* Main Tab Selector - 2 Square Buttons */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <button
            onClick={() => handleMainTabChange('current')}
            className={`aspect-square flex flex-col items-center justify-center rounded-2xl font-bold text-base transition-all ${
              mainTab === 'current'
                ? 'bg-gradient-to-br from-blue-600 to-blue-800 text-white shadow-lg shadow-blue-500/30 border-2 border-blue-400'
                : 'bg-white/5 text-gray-300 border-2 border-white/10 hover:border-white/20 hover:bg-white/10'
            }`}
          >
            <Briefcase className={`w-10 h-10 mb-2 ${mainTab === 'current' ? 'text-white' : 'text-gray-400'}`} />
            <span>{t('My Jobs')}</span>
          </button>

          <button
            onClick={() => handleMainTabChange('history')}
            className={`aspect-square flex flex-col items-center justify-center rounded-2xl font-bold text-base transition-all ${
              mainTab === 'history'
                ? 'bg-gradient-to-br from-purple-600 to-purple-800 text-white shadow-lg shadow-purple-500/30 border-2 border-purple-400'
                : 'bg-white/5 text-gray-300 border-2 border-white/10 hover:border-white/20 hover:bg-white/10'
            }`}
          >
            <History className={`w-10 h-10 mb-2 ${mainTab === 'history' ? 'text-white' : 'text-gray-400'}`} />
            <span>{t('History')}</span>
          </button>
        </div>

        {/* Sub-tabs - Same style as Fixed Weekly / Custom Dates (inside container) */}
        <div className="bg-white/10 rounded-2xl border border-white/20 p-4 mb-6">
          <div className="flex justify-center">
            <div className="grid grid-cols-3 gap-3 w-full max-w-sm">
              {activeSubTabs.map((tab) => {
                const isActive = subTab === tab.id
                const Icon = tab.icon
                return (
                  <button
                    key={tab.id}
                    onClick={() => handleSubTabChange(tab.id)}
                    className={`aspect-square flex flex-col items-center justify-center gap-2 rounded-2xl font-bold transition-all ${
                      isActive
                        ? getSubTabStyle(tab.color, true)
                        : 'bg-white/5 text-gray-400 border border-white/10 hover:border-white/20 hover:bg-white/10'
                    }`}
                  >
                    <Icon className={`w-8 h-8 ${isActive ? 'text-white' : 'text-gray-500'}`} />
                    <span className="text-center px-2 text-sm">{t(tab.label)}</span>
                    {tab.count > 0 && (
                      <span className={`text-xs rounded-full px-2 py-0.5 ${
                        isActive ? 'bg-white/20' : 'bg-white/10'
                      }`}>
                        {tab.count}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* Content Section */}
        <div ref={contentRef} className="bg-white/10 rounded-2xl border border-white/20 p-4 scroll-mt-4">
          {loading ? (
            <LoadingSpinner size="md" />
          ) : currentJobs.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-400">{getEmptyMessage()}</p>
            </div>
          ) : (
            <div className="space-y-4">
              {currentJobs.map(job => (
                <MyJobCard
                  key={job.id}
                  jobSession={job}
                  onStatusChange={fetchJobs}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
