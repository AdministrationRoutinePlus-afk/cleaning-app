'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { format, parseISO } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ArrowLeft, Search, Star, Filter, X, ChevronDown, ChevronUp } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import LoadingSpinner from '@/components/LoadingSpinner'

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

export default function JobsHistoryPage() {
  const router = useRouter()
  const supabaseRef = useRef(createClient())
  const supabase = supabaseRef.current
  const isMountedRef = useRef(true)

  const [loading, setLoading] = useState(true)
  const [jobs, setJobs] = useState<CompletedJob[]>([])
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

  // Expanded job details
  const [expandedJob, setExpandedJob] = useState<string | null>(null)

  useEffect(() => {
    isMountedRef.current = true
    fetchData()
    return () => { isMountedRef.current = false }
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)

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
        router.push('/login')
        return
      }

      // Fetch completed/evaluated jobs
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
          employee:employees(
            id,
            full_name
          )
        `)
        .in('status', ['COMPLETED', 'EVALUATED'])
        .order('completed_at', { ascending: false })

      if (sessionsError) {
        console.error('Error fetching sessions:', sessionsError)
        return
      }

      // Filter by employer
      const employerSessions = (sessionsData || []).filter(
        (s: any) => s.job_template?.created_by === employer.id
      )

      // Fetch evaluations for these sessions
      const sessionIds = employerSessions.map((s: any) => s.id)
      const { data: evaluationsData } = await supabase
        .from('evaluations')
        .select('*')
        .in('job_session_id', sessionIds)

      // Map evaluations to sessions
      const evaluationMap = new Map(
        (evaluationsData || []).map(e => [e.job_session_id, e])
      )

      const jobsWithEvaluations: CompletedJob[] = employerSessions.map((session: any) => ({
        ...session,
        evaluation: evaluationMap.get(session.id) || null
      }))

      setJobs(jobsWithEvaluations)

      // Fetch customers for filter
      const { data: customersData } = await supabase
        .from('customers')
        .select('id, full_name, customer_code')
        .eq('created_by', employer.id)
        .eq('status', 'ACTIVE')
        .order('full_name')

      setCustomers(customersData || [])

      // Fetch employees for filter
      const { data: employeesData } = await supabase
        .from('employees')
        .select('id, full_name')
        .eq('created_by', employer.id)
        .order('full_name')

      setEmployees(employeesData || [])

    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  // Filtered jobs
  const filteredJobs = useMemo(() => {
    return jobs.filter(job => {
      // Search query (job code, title, description, customer name, employee name)
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

      // Customer filter
      if (filterCustomer && job.job_template.customer?.id !== filterCustomer) {
        return false
      }

      // Employee filter
      if (filterEmployee && job.employee?.id !== filterEmployee) {
        return false
      }

      // Date range filter
      if (filterDateFrom && job.scheduled_date) {
        if (job.scheduled_date < filterDateFrom) return false
      }
      if (filterDateTo && job.scheduled_date) {
        if (job.scheduled_date > filterDateTo) return false
      }

      // Rating filter
      if (filterRating) {
        const rating = parseInt(filterRating)
        if (!job.evaluation || job.evaluation.rating !== rating) return false
      }

      // Has review filter
      if (filterHasReview === 'yes' && !job.evaluation) return false
      if (filterHasReview === 'no' && job.evaluation) return false

      return true
    })
  }, [jobs, searchQuery, filterCustomer, filterEmployee, filterDateFrom, filterDateTo, filterRating, filterHasReview])

  const clearFilters = () => {
    setSearchQuery('')
    setFilterCustomer('')
    setFilterEmployee('')
    setFilterDateFrom('')
    setFilterDateTo('')
    setFilterRating('')
    setFilterHasReview('')
  }

  const hasActiveFilters = searchQuery || filterCustomer || filterEmployee || filterDateFrom || filterDateTo || filterRating || filterHasReview

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

  if (loading) {
    return <LoadingSpinner fullScreen />
  }

  return (
    <div className="min-h-screen p-3 pb-20">
      <div className="max-w-4xl mx-auto space-y-3">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push('/employer/jobs')}
            className="border-white/20 text-gray-300 hover:bg-white/10"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-xl font-bold text-white">History</h1>
          <span className="text-sm text-gray-500">({filteredJobs.length})</span>
        </div>

        {/* Search & Filters Row */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
            <Input
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-9 text-sm bg-white/5 border-white/20 text-white placeholder:text-gray-500"
            />
          </div>
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
            <div className="grid grid-cols-3 gap-2">
              <Select value={filterCustomer} onValueChange={setFilterCustomer}>
                <SelectTrigger className="h-8 text-xs bg-white/5 border-white/20 text-white">
                  <SelectValue placeholder="Customer" />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-white/20">
                  <SelectItem value="" className="text-white hover:bg-white/10">All</SelectItem>
                  {customers.map(c => (
                    <SelectItem key={c.id} value={c.id} className="text-white hover:bg-white/10">{c.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterEmployee} onValueChange={setFilterEmployee}>
                <SelectTrigger className="h-8 text-xs bg-white/5 border-white/20 text-white">
                  <SelectValue placeholder="Employee" />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-white/20">
                  <SelectItem value="" className="text-white hover:bg-white/10">All</SelectItem>
                  {employees.map(e => (
                    <SelectItem key={e.id} value={e.id} className="text-white hover:bg-white/10">{e.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterRating} onValueChange={setFilterRating}>
                <SelectTrigger className="h-8 text-xs bg-white/5 border-white/20 text-white">
                  <SelectValue placeholder="Rating" />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-white/20">
                  <SelectItem value="" className="text-white hover:bg-white/10">Any</SelectItem>
                  {[5,4,3,2,1].map(r => (
                    <SelectItem key={r} value={r.toString()} className="text-white hover:bg-white/10">{r}★</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-3 gap-2">
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
                  <SelectValue placeholder="Review" />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-white/20">
                  <SelectItem value="" className="text-white hover:bg-white/10">All</SelectItem>
                  <SelectItem value="yes" className="text-white hover:bg-white/10">Has review</SelectItem>
                  <SelectItem value="no" className="text-white hover:bg-white/10">No review</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {hasActiveFilters && (
              <button onClick={clearFilters} className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1">
                <X className="h-3 w-3" /> Clear filters
              </button>
            )}
          </div>
        )}

        {/* Jobs List */}
        <div className="space-y-2">
          {filteredJobs.length === 0 ? (
            <div className="bg-white/5 border border-white/10 rounded-xl p-6 text-center text-gray-400 text-sm">
              {hasActiveFilters ? 'No matches' : 'No completed jobs'}
            </div>
          ) : (
            filteredJobs.map(job => (
              <div
                key={job.id}
                className="bg-white/5 border border-white/10 rounded-xl overflow-hidden"
              >
                {/* Compact Row */}
                <div
                  className="p-3 flex items-center gap-3 cursor-pointer hover:bg-white/5"
                  onClick={() => setExpandedJob(expandedJob === job.id ? null : job.id)}
                >
                  {/* Date */}
                  <div className="text-xs text-gray-500 w-16 shrink-0">
                    {job.scheduled_date ? format(parseISO(job.scheduled_date), 'MMM d') : '-'}
                  </div>

                  {/* Main Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-semibold text-blue-400">
                        {job.full_job_code || job.job_template.job_code}
                      </span>
                      <span className="text-sm font-medium text-white truncate">{job.job_template.title}</span>
                      {(job.status === 'MISSED' || job.status === 'OVERDUE') && (
                        <Badge className="bg-red-500/20 text-red-300 border border-red-500/30 text-[10px] px-1.5 py-0">
                          {job.status}
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-gray-500 truncate">
                      {job.job_template.customer?.full_name || 'No customer'}
                      {job.employee && ` · ${job.employee.full_name}`}
                    </div>
                  </div>

                  {/* Rating */}
                  <div className="shrink-0 flex items-center gap-2">
                    {job.evaluation ? (
                      <div className="flex items-center gap-0.5">
                        <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
                        <span className="text-xs font-medium text-yellow-400">{job.evaluation.rating}</span>
                      </div>
                    ) : (
                      <span className="text-[10px] text-gray-500 bg-white/10 px-1.5 py-0.5 rounded">—</span>
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
                          <span className="text-gray-500">Description:</span>{' '}
                          <span className="text-gray-300">{job.job_template.description}</span>
                        </div>
                      )}
                      {job.job_template.address && (
                        <div className="col-span-2">
                          <span className="text-gray-500">Address:</span>{' '}
                          <span className="text-gray-300">{job.job_template.address}</span>
                        </div>
                      )}
                      {job.completed_at && (
                        <div>
                          <span className="text-gray-500">Completed:</span>{' '}
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
                          <p className="text-gray-300 italic">"{job.evaluation.comment}"</p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
