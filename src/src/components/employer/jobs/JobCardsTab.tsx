'use client'

import { useState, useEffect, useRef } from 'react'
import type { JobTemplate } from '@/types/database'
import { createClient } from '@/lib/supabase/client'
import { JobCard } from '@/components/employer/JobCard'
import { ChevronDown, ChevronRight, Users } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import LoadingSpinner from '@/components/LoadingSpinner'
import { toast } from 'sonner'

type FilterStatus = 'all' | 'DRAFT' | 'ACTIVE'

interface JobWithCustomer extends JobTemplate {
  customer?: { full_name: string } | null
}

interface CustomerGroup {
  customerName: string
  customerCode: string | null
  jobs: JobWithCustomer[]
}

interface JobCardsTabProps {
  employerId: string
}

export function JobCardsTab({ employerId }: JobCardsTabProps) {
  const [jobs, setJobs] = useState<JobWithCustomer[]>([])
  const [sessionCounts, setSessionCounts] = useState<Record<string, { unclaimed: number; total: number }>>({})
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<FilterStatus>('all')
  const [expandedCustomers, setExpandedCustomers] = useState<Set<string>>(new Set())
  const supabaseRef = useRef(createClient())
  const supabase = supabaseRef.current
  const isMountedRef = useRef(true)

  const fetchData = async () => {
    try {
      setLoading(true)

      const { data: jobsData, error: jobsError } = await supabase
        .from('job_templates')
        .select('*, customer:customers(full_name, customer_code)')
        .eq('created_by', employerId)
        .order('created_at', { ascending: false })

      if (jobsError) throw jobsError
      if (!isMountedRef.current) return

      setJobs(jobsData || [])

      // Start with all customers collapsed
      setExpandedCustomers(new Set())

      // Fetch session counts for active jobs
      const activeJobIds = (jobsData || []).filter(j => j.status === 'ACTIVE').map(j => j.id)
      if (activeJobIds.length > 0) {
        const { data: sessionsData } = await supabase
          .from('job_sessions')
          .select('job_template_id, status')
          .in('job_template_id', activeJobIds)
          .in('status', ['OFFERED', 'CLAIMED', 'APPROVED', 'IN_PROGRESS'])

        if (sessionsData && isMountedRef.current) {
          const counts: Record<string, { unclaimed: number; total: number }> = {}
          for (const session of sessionsData) {
            if (!counts[session.job_template_id]) {
              counts[session.job_template_id] = { unclaimed: 0, total: 0 }
            }
            counts[session.job_template_id].total++
            if (session.status === 'OFFERED') {
              counts[session.job_template_id].unclaimed++
            }
          }
          setSessionCounts(counts)
        }
      }
    } catch (error) {
      console.error('Error fetching jobs:', error)
      if (isMountedRef.current) toast.error('Failed to load jobs')
    } finally {
      if (isMountedRef.current) setLoading(false)
    }
  }

  useEffect(() => {
    isMountedRef.current = true
    fetchData()
    return () => { isMountedRef.current = false }
  }, [])

  const filteredJobs = jobs.filter(job => {
    if (filter === 'all') return true
    return job.status === filter
  })

  // Group jobs by customer
  const customerGroups: CustomerGroup[] = (() => {
    const groups: Record<string, CustomerGroup> = {}

    for (const job of filteredJobs) {
      const key = job.customer_id || 'random'
      if (!groups[key]) {
        groups[key] = {
          customerName: (job as any).customer?.full_name || 'Random Jobs',
          customerCode: (job as any).customer?.customer_code || null,
          jobs: [],
        }
      }
      groups[key].jobs.push(job)
    }

    // Sort: named customers first (alphabetical), then Random Jobs last
    return Object.entries(groups)
      .sort(([keyA, a], [keyB, b]) => {
        if (keyA === 'random') return 1
        if (keyB === 'random') return -1
        return a.customerName.localeCompare(b.customerName)
      })
      .map(([, group]) => group)
  })()

  const toggleCustomer = (customerName: string) => {
    setExpandedCustomers(prev => {
      const newSet = new Set(prev)
      if (newSet.has(customerName)) {
        newSet.delete(customerName)
      } else {
        newSet.add(customerName)
      }
      return newSet
    })
  }

  const draftCount = jobs.filter(j => j.status === 'DRAFT').length
  const activeCount = jobs.filter(j => j.status === 'ACTIVE').length

  if (loading) {
    return <div className="py-12"><LoadingSpinner /></div>
  }

  return (
    <div className="space-y-4">
      {/* Filter Toggles */}
      <div className="flex gap-2">
        {([
          { key: 'all' as FilterStatus, label: 'All', count: jobs.length },
          { key: 'DRAFT' as FilterStatus, label: 'Draft', count: draftCount },
          { key: 'ACTIVE' as FilterStatus, label: 'Active', count: activeCount },
        ]).map(({ key, label, count }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              filter === key
                ? 'bg-blue-600 text-white'
                : 'bg-white/5 text-gray-400 hover:bg-white/10'
            }`}
          >
            {label} ({count})
          </button>
        ))}
      </div>

      {/* Grouped by Customer */}
      {filteredJobs.length === 0 ? (
        <div className="bg-white/5 border border-white/10 rounded-xl p-8 text-center">
          <p className="text-gray-400">
            {filter === 'all' ? 'No job cards yet' : `No ${filter.toLowerCase()} jobs`}
          </p>
          <p className="text-sm text-gray-500 mt-1">
            Create a new job template to get started
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {customerGroups.map(group => {
            const isExpanded = expandedCustomers.has(
              filteredJobs.find(j =>
                ((j as any).customer?.full_name || 'Random Jobs') === group.customerName
              )?.customer_id || 'random'
            )
            const customerId = filteredJobs.find(j =>
              ((j as any).customer?.full_name || 'Random Jobs') === group.customerName
            )?.customer_id || 'random'

            return (
              <div key={group.customerName} className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
                {/* Customer Header */}
                <button
                  onClick={() => toggleCustomer(customerId)}
                  className="w-full px-4 py-3 flex items-center justify-between hover:bg-white/5 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4 text-gray-500" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-gray-500" />
                    )}
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      customerId === 'random' ? 'bg-orange-500/20' : 'bg-blue-500/20'
                    }`}>
                      <Users className={`w-4 h-4 ${
                        customerId === 'random' ? 'text-orange-400' : 'text-blue-400'
                      }`} />
                    </div>
                    <span className="font-medium text-white">{group.customerName}</span>
                    {group.customerCode && (
                      <Badge className="bg-white/10 text-gray-300 border border-white/20 text-xs">
                        {group.customerCode}
                      </Badge>
                    )}
                  </div>
                  <span className="text-sm text-gray-500">
                    {group.jobs.length} job{group.jobs.length !== 1 ? 's' : ''}
                  </span>
                </button>

                {/* Job Cards Grid (collapsed/expanded) */}
                {isExpanded && (
                  <div className="px-4 pb-4 pt-1">
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                      {group.jobs.map(job => (
                        <JobCard
                          key={job.id}
                          job={job}
                          customerName={(job as any).customer?.full_name || null}
                          onUpdate={fetchData}
                          sessionCounts={sessionCounts[job.id]}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
