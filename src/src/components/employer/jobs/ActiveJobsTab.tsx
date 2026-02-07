'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import type { JobTemplate, JobSessionFull, Customer } from '@/types/database'
import { createClient } from '@/lib/supabase/client'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { ScheduleJobPopup } from '@/components/employer/ScheduleJobPopup'
import { format, differenceInDays, parseISO } from 'date-fns'
import { AlertTriangle, Calendar, User, Search, X, MapPin, Briefcase, Clock, Users, CalendarDays, Check } from 'lucide-react'
import LoadingSpinner from '@/components/LoadingSpinner'
import { toast } from 'sonner'

type StatusFilter = 'all' | 'unclaimed' | 'pending' | 'scheduled' | 'in_progress' | 'issues'

interface ActiveJobsTabProps {
  employerId: string
}

export function ActiveJobsTab({ employerId }: ActiveJobsTabProps) {
  const [sessions, setSessions] = useState<JobSessionFull[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [selectedSession, setSelectedSession] = useState<JobSessionFull | null>(null)
  const [popupOpen, setPopupOpen] = useState(false)
  const supabaseRef = useRef(createClient())
  const supabase = supabaseRef.current
  const isMountedRef = useRef(true)

  // Filter state
  type FilterTab = 'employee' | 'customer' | 'dates' | null
  const [activeFilterTab, setActiveFilterTab] = useState<FilterTab>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterEmployee, setFilterEmployee] = useState('')
  const [filterCustomer, setFilterCustomer] = useState('')
  const [filterDateFrom, setFilterDateFrom] = useState('')
  const [filterDateTo, setFilterDateTo] = useState('')

  const fetchData = async () => {
    try {
      setLoading(true)

      const { data: templates } = await supabase
        .from('job_templates')
        .select('id')
        .eq('created_by', employerId)

      const templateIds = templates?.map(t => t.id) || []
      if (templateIds.length === 0) {
        if (isMountedRef.current) {
          setSessions([])
          setLoading(false)
        }
        return
      }

      const { data: sessionsData, error } = await supabase
        .from('job_sessions')
        .select(`
          *,
          job_template:job_templates(
            *,
            customer:customers(*)
          ),
          employee:employees(*)
        `)
        .in('job_template_id', templateIds)
        .in('status', ['OFFERED', 'CLAIMED', 'APPROVED', 'IN_PROGRESS', 'MISSED', 'OVERDUE'])
        .order('scheduled_date', { ascending: true })

      if (error) throw error
      if (!isMountedRef.current) return

      setSessions(sessionsData as JobSessionFull[] || [])
    } catch (error) {
      console.error('Error fetching active sessions:', error)
      if (isMountedRef.current) toast.error('Failed to load active jobs')
    } finally {
      if (isMountedRef.current) setLoading(false)
    }
  }

  useEffect(() => {
    isMountedRef.current = true
    fetchData()
    return () => { isMountedRef.current = false }
  }, [])

  // Derive unique employees/customers for filter dropdowns
  const uniqueEmployees = useMemo(() => {
    const map = new Map<string, string>()
    for (const s of sessions) {
      if (s.employee) map.set(s.employee.id, s.employee.full_name)
    }
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]))
  }, [sessions])

  const uniqueCustomers = useMemo(() => {
    const map = new Map<string, string>()
    for (const s of sessions) {
      const tmpl = s.job_template as JobTemplate & { customer: Customer | null }
      if (tmpl?.customer) map.set(tmpl.customer.id, tmpl.customer.full_name)
    }
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]))
  }, [sessions])

  // Check if session is missed/overdue
  const getDisplayStatus = (session: JobSessionFull): string => {
    if (session.status === 'MISSED' || session.status === 'OVERDUE') return session.status
    if (!session.scheduled_date) return session.status

    const now = new Date()
    const jobTemplate = session.job_template as JobTemplate & { customer: Customer | null }

    if (jobTemplate?.time_window_end) {
      const [endH, endM] = jobTemplate.time_window_end.split(':').map(Number)
      const endDate = new Date(session.scheduled_end_date || session.scheduled_date)
      endDate.setHours(endH, endM, 0, 0)
      if (now > endDate) {
        if (session.status === 'IN_PROGRESS') return 'OVERDUE'
        if (session.status === 'APPROVED') return 'MISSED'
      }
    } else {
      const endOfDay = new Date(session.scheduled_end_date || session.scheduled_date)
      endOfDay.setHours(23, 59, 59, 999)
      if (now > endOfDay) {
        if (session.status === 'IN_PROGRESS') return 'OVERDUE'
        if (session.status === 'APPROVED') return 'MISSED'
      }
    }
    return session.status
  }

  const filteredSessions = useMemo(() => {
    return sessions.filter(session => {
      // Status filter
      const displayStatus = getDisplayStatus(session)
      switch (statusFilter) {
        case 'unclaimed': if (session.status !== 'OFFERED') return false; break
        case 'pending': if (session.status !== 'CLAIMED') return false; break
        case 'scheduled': if (session.status !== 'APPROVED' || displayStatus === 'MISSED') return false; break
        case 'in_progress': if (session.status !== 'IN_PROGRESS' || displayStatus === 'OVERDUE') return false; break
        case 'issues': if (displayStatus !== 'MISSED' && displayStatus !== 'OVERDUE') return false; break
      }

      // Search
      if (searchQuery) {
        const q = searchQuery.toLowerCase()
        const tmpl = session.job_template as JobTemplate & { customer: Customer | null }
        const matches =
          session.full_job_code?.toLowerCase().includes(q) ||
          session.session_code?.toLowerCase().includes(q) ||
          tmpl?.title?.toLowerCase().includes(q) ||
          tmpl?.job_code?.toLowerCase().includes(q) ||
          tmpl?.customer?.full_name?.toLowerCase().includes(q) ||
          session.employee?.full_name?.toLowerCase().includes(q) ||
          tmpl?.address?.toLowerCase().includes(q)
        if (!matches) return false
      }

      // Employee
      if (filterEmployee) {
        if (filterEmployee === '_unclaimed') {
          if (session.assigned_to) return false
        } else {
          if (session.employee?.id !== filterEmployee) return false
        }
      }

      // Customer
      if (filterCustomer) {
        const tmpl = session.job_template as JobTemplate & { customer: Customer | null }
        if (tmpl?.customer?.id !== filterCustomer) return false
      }

      // Date range
      if (filterDateFrom && session.scheduled_date && session.scheduled_date < filterDateFrom) return false
      if (filterDateTo && session.scheduled_date && session.scheduled_date > filterDateTo) return false

      return true
    })
  }, [sessions, statusFilter, searchQuery, filterEmployee, filterCustomer, filterDateFrom, filterDateTo])

  // Unclaimed counts for alert
  const unclaimedSessions = sessions.filter(s => s.status === 'OFFERED')
  const urgentUnclaimed = unclaimedSessions.filter(s => {
    if (!s.scheduled_date) return false
    const days = differenceInDays(new Date(s.scheduled_date), new Date())
    return days <= 2
  })
  const warningUnclaimed = unclaimedSessions.filter(s => {
    if (!s.scheduled_date) return false
    const days = differenceInDays(new Date(s.scheduled_date), new Date())
    return days > 2 && days <= 4
  })

  // Status filter counts
  const statusCounts = {
    all: sessions.length,
    unclaimed: sessions.filter(s => s.status === 'OFFERED').length,
    pending: sessions.filter(s => s.status === 'CLAIMED').length,
    scheduled: sessions.filter(s => s.status === 'APPROVED' && getDisplayStatus(s) !== 'MISSED').length,
    in_progress: sessions.filter(s => s.status === 'IN_PROGRESS' && getDisplayStatus(s) !== 'OVERDUE').length,
    issues: sessions.filter(s => {
      const ds = getDisplayStatus(s)
      return ds === 'MISSED' || ds === 'OVERDUE'
    }).length,
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'OFFERED': return 'bg-gray-500/20 text-gray-300 border border-gray-500/30'
      case 'CLAIMED': return 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30'
      case 'APPROVED': return 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
      case 'IN_PROGRESS': return 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
      case 'MISSED': return 'bg-red-500/20 text-red-300 border border-red-500/30'
      case 'OVERDUE': return 'bg-red-500/20 text-red-300 border border-red-500/30'
      default: return 'bg-gray-500/20 text-gray-300 border border-gray-500/30'
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'OFFERED': return 'Unclaimed'
      case 'CLAIMED': return 'Pending'
      case 'APPROVED': return 'Scheduled'
      case 'IN_PROGRESS': return 'In Progress'
      case 'MISSED': return 'Missed'
      case 'OVERDUE': return 'Overdue'
      default: return status
    }
  }

  const hasActiveFilters = searchQuery || filterEmployee || filterCustomer || filterDateFrom || filterDateTo

  const clearFilters = () => {
    setSearchQuery('')
    setFilterEmployee('')
    setFilterCustomer('')
    setFilterDateFrom('')
    setFilterDateTo('')
  }

  const handleSessionClick = (session: JobSessionFull) => {
    setSelectedSession(session)
    setPopupOpen(true)
  }

  const handlePopupClose = () => {
    setPopupOpen(false)
    setSelectedSession(null)
  }

  if (loading) {
    return <div className="py-12"><LoadingSpinner /></div>
  }

  return (
    <div className="space-y-4">
      {/* Unclaimed Alert Banner */}
      {unclaimedSessions.length > 0 && (
        <div className={`rounded-xl p-4 border ${
          urgentUnclaimed.length > 0
            ? 'bg-gradient-to-r from-red-500/20 to-orange-500/20 border-red-500/30'
            : 'bg-gradient-to-r from-orange-500/20 to-yellow-500/20 border-orange-500/30'
        }`}>
          <div className="flex items-center gap-3">
            <AlertTriangle className={`h-5 w-5 shrink-0 ${urgentUnclaimed.length > 0 ? 'text-red-400' : 'text-orange-400'}`} />
            <div className="flex-1">
              <p className="font-medium text-white">
                {unclaimedSessions.length} unclaimed job{unclaimedSessions.length !== 1 ? 's' : ''}
              </p>
              <p className="text-sm text-gray-300">
                {urgentUnclaimed.length > 0 && (
                  <span className="text-red-300 font-medium">{urgentUnclaimed.length} urgent (within 2 days)</span>
                )}
                {urgentUnclaimed.length > 0 && warningUnclaimed.length > 0 && ' · '}
                {warningUnclaimed.length > 0 && (
                  <span className="text-orange-300">{warningUnclaimed.length} coming soon (within 4 days)</span>
                )}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
        <Input
          placeholder="Search jobs, employees, customers..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9 h-10 bg-white/5 border-white/20 text-white placeholder:text-gray-500"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Status Filter Row */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
        {([
          { key: 'all' as StatusFilter, label: 'All' },
          { key: 'unclaimed' as StatusFilter, label: 'Unclaimed' },
          { key: 'pending' as StatusFilter, label: 'Pending' },
          { key: 'scheduled' as StatusFilter, label: 'Scheduled' },
          { key: 'in_progress' as StatusFilter, label: 'In Progress' },
          { key: 'issues' as StatusFilter, label: 'Issues' },
        ]).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setStatusFilter(key)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap ${
              statusFilter === key
                ? key === 'issues' && statusCounts.issues > 0
                  ? 'bg-red-600 text-white'
                  : 'bg-blue-600 text-white'
                : 'bg-white/5 text-gray-400 hover:bg-white/10'
            }`}
          >
            {label} ({statusCounts[key]})
          </button>
        ))}
      </div>

      {/* Filter Tabs: Employee | Customer | Dates */}
      <div className="space-y-0">
        {/* Tab Headers */}
        <div className="flex">
          {([
            { key: 'employee' as FilterTab, label: 'Employee', icon: User, active: !!filterEmployee },
            { key: 'customer' as FilterTab, label: 'Customer', icon: Briefcase, active: !!filterCustomer },
            { key: 'dates' as FilterTab, label: 'Dates', icon: CalendarDays, active: !!(filterDateFrom || filterDateTo) },
          ]).map(({ key, label, icon: Icon, active }) => (
            <button
              key={key}
              onClick={() => setActiveFilterTab(activeFilterTab === key ? null : key)}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium transition-colors border-b-2 ${
                activeFilterTab === key
                  ? 'border-blue-500 text-blue-400'
                  : active
                    ? 'border-blue-500/40 text-blue-300/80'
                    : 'border-white/10 text-gray-500 hover:text-gray-300'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
              {active && activeFilterTab !== key && (
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
              )}
            </button>
          ))}
        </div>

        {/* Employee Options */}
        {activeFilterTab === 'employee' && (
          <div className="bg-white/5 border border-white/10 border-t-0 rounded-b-xl p-3">
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setFilterEmployee('')}
                className={`px-3 py-1.5 rounded-full text-sm transition-colors flex items-center gap-1.5 ${
                  !filterEmployee
                    ? 'bg-blue-600 text-white'
                    : 'bg-white/5 text-gray-400 hover:bg-white/10'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                All
              </button>
              <button
                onClick={() => setFilterEmployee(filterEmployee === '_unclaimed' ? '' : '_unclaimed')}
                className={`px-3 py-1.5 rounded-full text-sm transition-colors flex items-center gap-1.5 ${
                  filterEmployee === '_unclaimed'
                    ? 'bg-orange-600 text-white'
                    : 'bg-white/5 text-orange-400/70 hover:bg-white/10'
                }`}
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                Unclaimed
              </button>
              {uniqueEmployees.map(([id, name]) => (
                <button
                  key={id}
                  onClick={() => setFilterEmployee(filterEmployee === id ? '' : id)}
                  className={`px-3 py-1.5 rounded-full text-sm transition-colors flex items-center gap-1.5 ${
                    filterEmployee === id
                      ? 'bg-blue-600 text-white'
                      : 'bg-white/5 text-gray-300 hover:bg-white/10'
                  }`}
                >
                  {filterEmployee === id && <Check className="w-3.5 h-3.5" />}
                  <User className="w-3.5 h-3.5" />
                  {name}
                </button>
              ))}
              {uniqueEmployees.length === 0 && (
                <p className="text-xs text-gray-500 py-1">No employees assigned yet</p>
              )}
            </div>
          </div>
        )}

        {/* Customer Options */}
        {activeFilterTab === 'customer' && (
          <div className="bg-white/5 border border-white/10 border-t-0 rounded-b-xl p-3">
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setFilterCustomer('')}
                className={`px-3 py-1.5 rounded-full text-sm transition-colors flex items-center gap-1.5 ${
                  !filterCustomer
                    ? 'bg-blue-600 text-white'
                    : 'bg-white/5 text-gray-400 hover:bg-white/10'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                All
              </button>
              {uniqueCustomers.map(([id, name]) => (
                <button
                  key={id}
                  onClick={() => setFilterCustomer(filterCustomer === id ? '' : id)}
                  className={`px-3 py-1.5 rounded-full text-sm transition-colors flex items-center gap-1.5 ${
                    filterCustomer === id
                      ? 'bg-blue-600 text-white'
                      : 'bg-white/5 text-gray-300 hover:bg-white/10'
                  }`}
                >
                  {filterCustomer === id && <Check className="w-3.5 h-3.5" />}
                  <Briefcase className="w-3.5 h-3.5" />
                  {name}
                </button>
              ))}
              {uniqueCustomers.length === 0 && (
                <p className="text-xs text-gray-500 py-1">No customers found</p>
              )}
            </div>
          </div>
        )}

        {/* Dates Options */}
        {activeFilterTab === 'dates' && (
          <div className="bg-white/5 border border-white/10 border-t-0 rounded-b-xl p-3">
            {/* Quick date presets */}
            <div className="flex flex-wrap gap-2 mb-3">
              {([
                { label: 'Today', from: format(new Date(), 'yyyy-MM-dd'), to: format(new Date(), 'yyyy-MM-dd') },
                { label: 'This week', from: (() => { const d = new Date(); d.setDate(d.getDate() - d.getDay()); return format(d, 'yyyy-MM-dd') })(), to: (() => { const d = new Date(); d.setDate(d.getDate() + (6 - d.getDay())); return format(d, 'yyyy-MM-dd') })() },
                { label: 'Next 7 days', from: format(new Date(), 'yyyy-MM-dd'), to: (() => { const d = new Date(); d.setDate(d.getDate() + 7); return format(d, 'yyyy-MM-dd') })() },
                { label: 'Next 30 days', from: format(new Date(), 'yyyy-MM-dd'), to: (() => { const d = new Date(); d.setDate(d.getDate() + 30); return format(d, 'yyyy-MM-dd') })() },
              ]).map(({ label, from, to }) => {
                const isActive = filterDateFrom === from && filterDateTo === to
                return (
                  <button
                    key={label}
                    onClick={() => {
                      if (isActive) {
                        setFilterDateFrom('')
                        setFilterDateTo('')
                      } else {
                        setFilterDateFrom(from)
                        setFilterDateTo(to)
                      }
                    }}
                    className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                      isActive
                        ? 'bg-blue-600 text-white'
                        : 'bg-white/5 text-gray-300 hover:bg-white/10'
                    }`}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
            {/* Custom range */}
            <div className="flex items-center gap-2">
              <div className="flex-1 space-y-1">
                <label className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">From</label>
                <Input
                  type="date"
                  value={filterDateFrom}
                  onChange={(e) => setFilterDateFrom(e.target.value)}
                  className="h-9 text-sm bg-white/5 border-white/20 text-white"
                />
              </div>
              <span className="text-gray-600 mt-4">-</span>
              <div className="flex-1 space-y-1">
                <label className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">To</label>
                <Input
                  type="date"
                  value={filterDateTo}
                  onChange={(e) => setFilterDateTo(e.target.value)}
                  min={filterDateFrom || undefined}
                  className="h-9 text-sm bg-white/5 border-white/20 text-white"
                />
              </div>
              {(filterDateFrom || filterDateTo) && (
                <button
                  onClick={() => { setFilterDateFrom(''); setFilterDateTo('') }}
                  className="mt-4 text-gray-500 hover:text-gray-300"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Active Filters Summary */}
      {hasActiveFilters && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-500">{filteredSessions.length} result{filteredSessions.length !== 1 ? 's' : ''}</span>
          <span className="text-gray-700">|</span>
          {filterEmployee && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-blue-500/15 text-blue-300 border border-blue-500/25">
              <User className="w-3 h-3" />
              {filterEmployee === '_unclaimed' ? 'Unclaimed' : uniqueEmployees.find(([id]) => id === filterEmployee)?.[1]}
              <button onClick={() => setFilterEmployee('')} className="ml-0.5 hover:text-white"><X className="w-3 h-3" /></button>
            </span>
          )}
          {filterCustomer && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-blue-500/15 text-blue-300 border border-blue-500/25">
              <Briefcase className="w-3 h-3" />
              {uniqueCustomers.find(([id]) => id === filterCustomer)?.[1]}
              <button onClick={() => setFilterCustomer('')} className="ml-0.5 hover:text-white"><X className="w-3 h-3" /></button>
            </span>
          )}
          {(filterDateFrom || filterDateTo) && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-blue-500/15 text-blue-300 border border-blue-500/25">
              <CalendarDays className="w-3 h-3" />
              {filterDateFrom && filterDateTo
                ? `${format(parseISO(filterDateFrom), 'MMM d')} - ${format(parseISO(filterDateTo), 'MMM d')}`
                : filterDateFrom
                  ? `From ${format(parseISO(filterDateFrom), 'MMM d')}`
                  : `Until ${format(parseISO(filterDateTo), 'MMM d')}`}
              <button onClick={() => { setFilterDateFrom(''); setFilterDateTo('') }} className="ml-0.5 hover:text-white"><X className="w-3 h-3" /></button>
            </span>
          )}
          <button onClick={clearFilters} className="text-xs text-gray-500 hover:text-gray-300 ml-auto">
            Clear all
          </button>
        </div>
      )}

      {/* Session Cards */}
      {filteredSessions.length === 0 ? (
        <div className="bg-white/5 border border-white/10 rounded-xl p-8 text-center">
          <p className="text-gray-400">
            {hasActiveFilters ? 'No matching sessions' : statusFilter === 'all' ? 'No active sessions' : `No ${statusFilter.replace('_', ' ')} sessions`}
          </p>
          {hasActiveFilters && (
            <button onClick={clearFilters} className="text-sm text-blue-400 hover:text-blue-300 mt-2">
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {filteredSessions.map(session => {
            const displayStatus = getDisplayStatus(session)
            const jobTemplate = session.job_template as JobTemplate & { customer: Customer | null }
            const daysUntil = session.scheduled_date
              ? differenceInDays(new Date(session.scheduled_date), new Date())
              : null

            return (
              <div
                key={session.id}
                onClick={() => handleSessionClick(session)}
                className="bg-white/5 border border-white/10 rounded-xl p-4 hover:bg-white/[0.07] cursor-pointer transition-colors"
              >
                {/* Top row: date + status */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-gray-500" />
                    <span className="text-sm font-medium text-white">
                      {session.scheduled_date
                        ? format(new Date(session.scheduled_date), 'EEE, MMM d, yyyy')
                        : 'No date'}
                    </span>
                    {daysUntil !== null && daysUntil >= 0 && daysUntil <= 7 && (
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                        daysUntil <= 1 ? 'bg-red-500/20 text-red-300' :
                        daysUntil <= 3 ? 'bg-orange-500/20 text-orange-300' :
                        'bg-gray-500/20 text-gray-400'
                      }`}>
                        {daysUntil === 0 ? 'Today' : daysUntil === 1 ? 'Tomorrow' : `In ${daysUntil}d`}
                      </span>
                    )}
                    {session.scheduled_time && (
                      <span className="text-xs text-gray-500 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {session.scheduled_time.slice(0, 5)}
                      </span>
                    )}
                  </div>
                  <Badge className={`${getStatusBadge(displayStatus)} text-xs`}>
                    {getStatusLabel(displayStatus)}
                  </Badge>
                </div>

                {/* Middle row: job info */}
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="font-mono text-xs text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded">
                    {session.full_job_code || session.session_code}
                  </span>
                  <span className="text-sm font-medium text-white truncate">
                    {jobTemplate?.title || 'Untitled'}
                  </span>
                </div>

                {/* Bottom row: customer + employee */}
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-3 text-gray-400">
                    {jobTemplate?.customer && (
                      <span className="flex items-center gap-1">
                        <Briefcase className="w-3 h-3" />
                        {jobTemplate.customer.full_name}
                      </span>
                    )}
                    {jobTemplate?.address && (
                      <span className="flex items-center gap-1 truncate max-w-[200px] hidden sm:flex">
                        <MapPin className="w-3 h-3 shrink-0" />
                        {jobTemplate.address}
                      </span>
                    )}
                  </div>
                  <div>
                    {session.employee ? (
                      <span className="text-gray-300 flex items-center gap-1">
                        <User className="w-3 h-3" />
                        {session.employee.full_name}
                      </span>
                    ) : (
                      <span className="text-orange-400 italic">Unclaimed</span>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Schedule Job Popup */}
      <ScheduleJobPopup
        jobSession={selectedSession as any}
        open={popupOpen}
        onClose={handlePopupClose}
        onUpdate={fetchData}
      />
    </div>
  )
}
