'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { format, parseISO } from 'date-fns'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Search, Star, Filter, X, ChevronDown, ChevronUp, Download } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import LoadingSpinner from '@/components/LoadingSpinner'
import { toast } from 'sonner'
import { useTranslation } from '@/lib/i18n/useTranslation'

const PAGE_SIZE = 20

interface CompletedJob {
  id: string
  session_code: string
  full_job_code: string | null
  scheduled_date: string | null
  scheduled_time: string | null
  completed_at: string | null
  status: string
  job_template: {
    id: string
    job_code: string
    title: string
    description: string | null
    address: string | null
    customer: {
      id: string
      full_name: string
      customer_code: string
    } | null
  }
  employee: {
    id: string
    full_name: string
  } | null
  evaluation: {
    id: string
    rating: number
    comment: string | null
    submitted_at: string | null
  } | null
}

interface HistoryTabProps {
  employerId: string
}

export function HistoryTab({ employerId }: HistoryTabProps) {
  const { t } = useTranslation()
  const supabaseRef = useRef(createClient())
  const supabase = supabaseRef.current
  const isMountedRef = useRef(true)

  const [loading, setLoading] = useState(true)
  const [jobs, setJobs] = useState<CompletedJob[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const [customers, setCustomers] = useState<{ id: string; full_name: string; customer_code: string }[]>([])
  const [employees, setEmployees] = useState<{ id: string; full_name: string }[]>([])

  // Filter state
  const [showFilters, setShowFilters] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterCustomer, setFilterCustomer] = useState('')
  const [filterEmployee, setFilterEmployee] = useState('')
  const [filterDateFrom, setFilterDateFrom] = useState('')
  const [filterDateTo, setFilterDateTo] = useState('')
  const [filterRating, setFilterRating] = useState('')
  const [filterHasReview, setFilterHasReview] = useState('')
  const [filterStatus, setFilterStatus] = useState('')

  // Expanded job details
  const [expandedJob, setExpandedJob] = useState<string | null>(null)

  useEffect(() => {
    isMountedRef.current = true
    fetchFilterOptions()
    return () => { isMountedRef.current = false }
  }, [])

  // Reset visible count when filters change
  useEffect(() => {
    setVisibleCount(PAGE_SIZE)
  }, [searchQuery, filterCustomer, filterEmployee, filterDateFrom, filterDateTo, filterRating, filterHasReview, filterStatus])

  // Fetch data when filters change
  useEffect(() => {
    fetchData()
  }, [searchQuery, filterCustomer, filterEmployee, filterDateFrom, filterDateTo, filterRating, filterHasReview, filterStatus])

  const fetchFilterOptions = async () => {
    // Fetch customers for filter
    const { data: customersData } = await supabase
      .from('customers')
      .select('id, full_name, customer_code')
      .eq('created_by', employerId)
      .eq('status', 'ACTIVE')
      .order('full_name')

    if (isMountedRef.current) setCustomers(customersData || [])

    // Fetch employees for filter
    const { data: employeesData } = await supabase
      .from('employees')
      .select('id, full_name')
      .eq('created_by', employerId)
      .order('full_name')

    if (isMountedRef.current) setEmployees(employeesData || [])
  }

  const fetchData = async () => {
    try {
      setLoading(true)

      // Fetch completed/evaluated/cancelled/refused/missed jobs
      const { data: sessionsData, error: sessionsError } = await supabase
        .from('job_sessions')
        .select(`
          id,
          session_code,
          full_job_code,
          scheduled_date,
          scheduled_time,
          completed_at,
          status,
          job_template:job_templates!inner(
            id,
            job_code,
            title,
            description,
            address,
            created_by,
            customer:customers(
              id,
              full_name,
              customer_code
            )
          ),
          employee:employees!job_sessions_assigned_to_fkey(
            id,
            full_name
          )
        `)
        .in('status', ['COMPLETED', 'EVALUATED', 'CANCELLED', 'REFUSED', 'MISSED'])
        .order('scheduled_date', { ascending: false })

      if (sessionsError) {
        console.error('Error fetching sessions:', sessionsError)
        return
      }

      // Filter by employer
      let employerSessions = (sessionsData || []).filter(
        (s: any) => s.job_template?.created_by === employerId
      )

      // Fetch evaluations for these sessions
      const sessionIds = employerSessions.map((s: any) => s.id)
      let evaluationMap = new Map()
      if (sessionIds.length > 0) {
        const { data: evaluationsData } = await supabase
          .from('evaluations')
          .select('*')
          .in('job_session_id', sessionIds)

        evaluationMap = new Map(
          (evaluationsData || []).map(e => [e.job_session_id, e])
        )
      }

      let jobsWithEvaluations: CompletedJob[] = employerSessions.map((session: any) => ({
        ...session,
        evaluation: evaluationMap.get(session.id) || null
      }))

      // Apply client-side filters
      jobsWithEvaluations = jobsWithEvaluations.filter(job => {
        if (searchQuery) {
          const query = searchQuery.toLowerCase()
          const matchesSearch =
            job.full_job_code?.toLowerCase().includes(query) ||
            job.job_template.job_code.toLowerCase().includes(query) ||
            job.job_template.title.toLowerCase().includes(query) ||
            job.job_template.description?.toLowerCase().includes(query) ||
            job.job_template.customer?.full_name.toLowerCase().includes(query) ||
            job.job_template.customer?.customer_code.toLowerCase().includes(query) ||
            job.employee?.full_name.toLowerCase().includes(query)

          if (!matchesSearch) return false
        }

        if (filterCustomer && job.job_template.customer?.id !== filterCustomer) return false
        if (filterEmployee && job.employee?.id !== filterEmployee) return false
        if (filterDateFrom && job.scheduled_date && job.scheduled_date < filterDateFrom) return false
        if (filterDateTo && job.scheduled_date && job.scheduled_date > filterDateTo) return false
        if (filterRating) {
          const rating = parseInt(filterRating)
          if (!job.evaluation || job.evaluation.rating !== rating) return false
        }
        if (filterHasReview === 'yes' && !job.evaluation) return false
        if (filterHasReview === 'no' && job.evaluation) return false
        if (filterStatus && job.status !== filterStatus) return false

        return true
      })

      if (!isMountedRef.current) return

      setTotalCount(jobsWithEvaluations.length)
      setJobs(jobsWithEvaluations)
      // Store all filtered jobs for CSV export
      allFilteredJobsRef.current = jobsWithEvaluations
    } catch (error) {
      console.error('Error fetching data:', error)
      toast.error(t('Failed to load job history'))
    } finally {
      if (isMountedRef.current) setLoading(false)
    }
  }

  // Store all filtered jobs for CSV export (not just current page)
  const allFilteredJobsRef = useRef<CompletedJob[]>([])

  const visibleJobs = jobs.slice(0, visibleCount)
  const hasMore = visibleCount < totalCount

  const clearFilters = () => {
    setSearchQuery('')
    setFilterCustomer('')
    setFilterEmployee('')
    setFilterDateFrom('')
    setFilterDateTo('')
    setFilterRating('')
    setFilterHasReview('')
    setFilterStatus('')
  }

  const hasActiveFilters = searchQuery || filterCustomer || filterEmployee || filterDateFrom || filterDateTo || filterRating || filterHasReview || filterStatus

  const handleExportCSV = () => {
    const allJobs = allFilteredJobsRef.current
    if (allJobs.length === 0) {
      toast.error(t('No data to export'))
      return
    }

    const headers = ['Date', 'Job Code', 'Title', 'Customer', 'Employee', 'Status', 'Rating', 'Duration', 'Price']

    const escapeCSV = (value: string) => {
      if (value.includes(',') || value.includes('"') || value.includes('\n')) {
        return `"${value.replace(/"/g, '""')}"`
      }
      return value
    }

    const rows = allJobs.map(job => [
      job.scheduled_date ? format(parseISO(job.scheduled_date), 'yyyy-MM-dd') : '',
      job.full_job_code || job.job_template.job_code,
      job.job_template.title,
      job.job_template.customer?.full_name || '',
      job.employee?.full_name || '',
      job.status,
      job.evaluation ? String(job.evaluation.rating) : '',
      '', // Duration not available on session
      '', // Price not available on session
    ])

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(escapeCSV).join(','))
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `job-history-${format(new Date(), 'yyyy-MM-dd')}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    toast.success(`${t('Exported')} ${allJobs.length} ${allJobs.length !== 1 ? t('records') : t('record')}`)
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'COMPLETED': return 'bg-green-500/20 text-green-300 border border-green-500/30'
      case 'EVALUATED': return 'bg-teal-500/20 text-teal-300 border border-teal-500/30'
      case 'CANCELLED': return 'bg-red-500/20 text-red-300 border border-red-500/30'
      case 'REFUSED': return 'bg-orange-500/20 text-orange-300 border border-orange-500/30'
      case 'MISSED': return 'bg-red-500/20 text-red-300 border border-red-500/30'
      default: return 'bg-gray-500/20 text-gray-300 border border-gray-500/30'
    }
  }

  const renderStars = (rating: number) => {
    return (
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map(star => (
          <Star
            key={star}
            className={`h-4 w-4 ${star <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-600'}`}
          />
        ))}
      </div>
    )
  }

  if (loading && jobs.length === 0) {
    return <div className="py-12"><LoadingSpinner /></div>
  }

  return (
    <div className="space-y-3">
      {/* Search & Filters Row */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
          <Input
            placeholder={t('Search...')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 h-9 text-sm bg-white/5 border-white/20 text-white placeholder:text-gray-500"
          />
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleExportCSV}
          className="h-9 border-white/20 text-gray-300 hover:bg-white/10"
          title={t('Export CSV')}
        >
          <Download className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowFilters(!showFilters)}
          className={`h-9 border-white/20 ${showFilters ? 'bg-blue-600 text-white border-blue-500' : 'text-gray-300 hover:bg-white/10'}`}
        >
          <Filter className="h-4 w-4" />
          {hasActiveFilters && <span className="ml-1 text-xs">·</span>}
        </Button>
      </div>

      {/* Compact Filters */}
      {showFilters && (
        <div className="bg-white/5 border border-white/10 rounded-xl p-3 space-y-2">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="h-8 text-xs bg-white/5 border-white/20 text-white">
                <SelectValue placeholder={t('Status')} />
              </SelectTrigger>
              <SelectContent className="bg-gray-800 border-white/20">
                <SelectItem value="" className="text-white hover:bg-white/10">{t('All')}</SelectItem>
                <SelectItem value="COMPLETED" className="text-white hover:bg-white/10">{t('Completed')}</SelectItem>
                <SelectItem value="EVALUATED" className="text-white hover:bg-white/10">{t('Evaluated')}</SelectItem>
                <SelectItem value="CANCELLED" className="text-white hover:bg-white/10">{t('Cancelled')}</SelectItem>
                <SelectItem value="REFUSED" className="text-white hover:bg-white/10">{t('Refused')}</SelectItem>
                <SelectItem value="MISSED" className="text-white hover:bg-white/10">{t('Missed')}</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterCustomer} onValueChange={setFilterCustomer}>
              <SelectTrigger className="h-8 text-xs bg-white/5 border-white/20 text-white">
                <SelectValue placeholder={t('Customer')} />
              </SelectTrigger>
              <SelectContent className="bg-gray-800 border-white/20">
                <SelectItem value="" className="text-white hover:bg-white/10">{t('All')}</SelectItem>
                {customers.map(c => (
                  <SelectItem key={c.id} value={c.id} className="text-white hover:bg-white/10">{c.full_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterEmployee} onValueChange={setFilterEmployee}>
              <SelectTrigger className="h-8 text-xs bg-white/5 border-white/20 text-white">
                <SelectValue placeholder={t('Employee')} />
              </SelectTrigger>
              <SelectContent className="bg-gray-800 border-white/20">
                <SelectItem value="" className="text-white hover:bg-white/10">{t('All')}</SelectItem>
                {employees.map(e => (
                  <SelectItem key={e.id} value={e.id} className="text-white hover:bg-white/10">{e.full_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterRating} onValueChange={setFilterRating}>
              <SelectTrigger className="h-8 text-xs bg-white/5 border-white/20 text-white">
                <SelectValue placeholder={t('Rating')} />
              </SelectTrigger>
              <SelectContent className="bg-gray-800 border-white/20">
                <SelectItem value="" className="text-white hover:bg-white/10">{t('Any')}</SelectItem>
                {[5, 4, 3, 2, 1].map(r => (
                  <SelectItem key={r} value={r.toString()} className="text-white hover:bg-white/10">{r} {t('star')}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <Input
              type="date"
              value={filterDateFrom}
              onChange={(e) => setFilterDateFrom(e.target.value)}
              className="h-8 text-xs bg-white/5 border-white/20 text-white"
              placeholder="From"
            />
            <Input
              type="date"
              value={filterDateTo}
              onChange={(e) => setFilterDateTo(e.target.value)}
              className="h-8 text-xs bg-white/5 border-white/20 text-white"
              placeholder="To"
            />
            <Select value={filterHasReview} onValueChange={setFilterHasReview}>
              <SelectTrigger className="h-8 text-xs bg-white/5 border-white/20 text-white">
                <SelectValue placeholder={t('Review')} />
              </SelectTrigger>
              <SelectContent className="bg-gray-800 border-white/20">
                <SelectItem value="" className="text-white hover:bg-white/10">{t('All')}</SelectItem>
                <SelectItem value="yes" className="text-white hover:bg-white/10">{t('Has review')}</SelectItem>
                <SelectItem value="no" className="text-white hover:bg-white/10">{t('No review')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {hasActiveFilters && (
            <button onClick={clearFilters} className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1">
              <X className="h-3 w-3" /> {t('Clear filters')}
            </button>
          )}
        </div>
      )}

      {/* Results Count */}
      <div className="text-sm text-gray-500">{totalCount} {totalCount !== 1 ? t('results') : t('result')}</div>

      {/* Jobs List */}
      <div className="space-y-2">
        {visibleJobs.length === 0 ? (
          <div className="bg-white/5 border border-white/10 rounded-xl p-6 text-center text-gray-400 text-sm">
            {hasActiveFilters ? t('No matches') : t('No history yet')}
          </div>
        ) : (
          visibleJobs.map(job => (
            <div
              key={job.id}
              className="bg-white/5 border border-white/10 rounded-xl overflow-hidden"
            >
              {/* Compact Row */}
              <div
                className="p-3 flex items-center gap-3 cursor-pointer hover:bg-white/5"
                onClick={() => setExpandedJob(expandedJob === job.id ? null : job.id)}
              >
                <div className="text-xs text-gray-500 w-16 shrink-0">
                  {job.scheduled_date ? format(parseISO(job.scheduled_date), 'MMM d') : '-'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-semibold text-blue-400">
                      {job.full_job_code || job.job_template.job_code}
                    </span>
                    <span className="text-sm font-medium text-white truncate">{job.job_template.title}</span>
                    <Badge className={`${getStatusBadge(job.status)} text-[10px] px-1.5 py-0`}>
                      {job.status}
                    </Badge>
                  </div>
                  <div className="text-xs text-gray-500 truncate">
                    {job.job_template.customer?.full_name || t('No customer')}
                    {job.employee && ` · ${job.employee.full_name}`}
                  </div>
                </div>
                <div className="shrink-0 flex items-center gap-2">
                  {job.evaluation ? (
                    <div className="flex items-center gap-0.5">
                      <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
                      <span className="text-xs font-medium text-yellow-400">{job.evaluation.rating}</span>
                    </div>
                  ) : (
                    <span className="text-[10px] text-gray-500 bg-white/10 px-1.5 py-0.5 rounded">-</span>
                  )}
                  {expandedJob === job.id ? (
                    <ChevronUp className="h-4 w-4 text-gray-500" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-gray-500" />
                  )}
                </div>
              </div>

              {/* Expanded */}
              {expandedJob === job.id && (
                <div className="px-3 pb-3 pt-0 border-t border-white/10 bg-white/[0.02] space-y-2">
                  <div className="grid grid-cols-2 gap-2 text-xs pt-2">
                    {job.job_template.description && (
                      <div className="col-span-2">
                        <span className="text-gray-500">{t('Description:')}</span>{' '}
                        <span className="text-gray-300">{job.job_template.description}</span>
                      </div>
                    )}
                    {job.job_template.address && (
                      <div className="col-span-2">
                        <span className="text-gray-500">{t('Address:')}</span>{' '}
                        <span className="text-gray-300">{job.job_template.address}</span>
                      </div>
                    )}
                    {job.completed_at && (
                      <div>
                        <span className="text-gray-500">{t('Completed:')}</span>{' '}
                        <span className="text-gray-300">{format(parseISO(job.completed_at), 'MMM d, h:mm a')}</span>
                      </div>
                    )}
                  </div>
                  {job.evaluation && (
                    <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-2 text-xs">
                      <div className="flex items-center gap-1 mb-1">
                        {renderStars(job.evaluation.rating)}
                      </div>
                      {job.evaluation.comment && (
                        <p className="text-gray-300 italic">&ldquo;{job.evaluation.comment}&rdquo;</p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Load More */}
      {hasMore && (
        <button
          onClick={() => setVisibleCount(prev => prev + PAGE_SIZE)}
          className="w-full py-3 text-sm text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-colors"
        >
          {t('Load More')}
        </button>
      )}
    </div>
  )
}
