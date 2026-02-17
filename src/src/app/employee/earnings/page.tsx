'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { toast } from 'sonner'
import type { JobSession, JobTemplate, Customer } from '@/types/database'
import { createClient } from '@/lib/supabase/client'
import { ChevronLeft } from 'lucide-react'
import { format, startOfWeek, subWeeks, parseISO } from 'date-fns'
import LoadingSpinner from '@/components/LoadingSpinner'
import { useTranslation } from '@/lib/i18n/useTranslation'

interface EarningsSession extends JobSession {
  job_template: JobTemplate & {
    customer: Customer | null
  }
}

interface SplitInfo {
  partner_minutes: number | null
  requested_by: string
  partner_id: string
}

export default function EmployeeEarningsPage() {
  const { t } = useTranslation()
  const [sessions, setSessions] = useState<EarningsSession[]>([])
  const [loading, setLoading] = useState(true)
  const [displayCount, setDisplayCount] = useState(20)
  const [splitInfoMap, setSplitInfoMap] = useState<Map<string, SplitInfo>>(new Map())
  const [currentEmployeeId, setCurrentEmployeeId] = useState<string | null>(null)
  const supabaseRef = useRef(createClient())
  const supabase = supabaseRef.current
  const isMountedRef = useRef(true)

  useEffect(() => {
    isMountedRef.current = true
    loadEarnings()
    return () => { isMountedRef.current = false }
  }, [])

  const loadEarnings = async () => {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: employee } = await supabase
        .from('employees')
        .select('id')
        .eq('user_id', user.id)
        .single()

      if (!employee) return
      if (isMountedRef.current) setCurrentEmployeeId(employee.id)

      let { data, error } = await supabase
        .from('job_sessions')
        .select(`
          *,
          job_template:job_templates(
            *,
            customer:customers(*)
          )
        `)
        .or(`assigned_to.eq.${employee.id},split_with.eq.${employee.id}`)
        .in('status', ['COMPLETED', 'EVALUATED'])
        .order('completed_at', { ascending: false })

      if (error) {
        const fallback = await supabase
          .from('job_sessions')
          .select(`
            *,
            job_template:job_templates(
              *,
              customer:customers(*)
            )
          `)
          .eq('assigned_to', employee.id)
          .in('status', ['COMPLETED', 'EVALUATED'])
          .order('completed_at', { ascending: false })

        data = fallback.data
        error = fallback.error
        if (error) throw error
      }

      const sessionsData = (data as EarningsSession[]) || []

      // Load split info for sessions that have split_with
      const splitSessionIds = sessionsData
        .filter(s => s.split_with)
        .map(s => s.id)

      if (splitSessionIds.length > 0) {
        const { data: splits } = await supabase
          .from('job_splits')
          .select('job_session_id, partner_minutes, requested_by, partner_id')
          .in('job_session_id', splitSessionIds)
          .eq('status', 'APPROVED')

        if (splits && isMountedRef.current) {
          const map = new Map<string, SplitInfo>()
          for (const s of splits) {
            map.set(s.job_session_id, {
              partner_minutes: s.partner_minutes,
              requested_by: s.requested_by,
              partner_id: s.partner_id,
            })
          }
          setSplitInfoMap(map)
        }
      }

      if (isMountedRef.current) {
        setSessions(sessionsData)
      }
    } catch (error) {
      console.error('Error loading earnings:', error)
      toast.error(t('Failed to load earnings'))
    } finally {
      if (isMountedRef.current) {
        setLoading(false)
      }
    }
  }

  const calcEarnings = (session: EarningsSession) => {
    const totalMinutes = session.job_template.duration_minutes || 0
    const rate = session.job_template.price_per_hour || 0

    if (session.split_with && currentEmployeeId) {
      const splitInfo = splitInfoMap.get(session.id)
      if (splitInfo && splitInfo.partner_minutes) {
        const partnerMinutes = splitInfo.partner_minutes
        // Am I the partner or the primary employee?
        if (splitInfo.partner_id === currentEmployeeId) {
          // I'm the partner - I get partner_minutes worth
          return (partnerMinutes / 60) * rate
        } else {
          // I'm the primary - I get the remainder
          return ((totalMinutes - partnerMinutes) / 60) * rate
        }
      }
      // Fallback to 50/50 if no split info
      return ((totalMinutes / 60) * rate) / 2
    }

    return (totalMinutes / 60) * rate
  }

  const now = new Date()
  const thisWeekStart = startOfWeek(now, { weekStartsOn: 1 })
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)

  const weekTotal = useMemo(() =>
    sessions
      .filter(s => {
        const d = s.completed_at ? parseISO(s.completed_at) : null
        return d && d >= thisWeekStart
      })
      .reduce((sum, s) => sum + calcEarnings(s), 0),
    [sessions]
  )

  const monthTotal = useMemo(() =>
    sessions
      .filter(s => {
        const d = s.completed_at ? parseISO(s.completed_at) : null
        return d && d >= thisMonthStart
      })
      .reduce((sum, s) => sum + calcEarnings(s), 0),
    [sessions]
  )

  const allTimeTotal = useMemo(() =>
    sessions.reduce((sum, s) => sum + calcEarnings(s), 0),
    [sessions]
  )

  // Weekly breakdown for bar chart (last 8 weeks)
  const weeklyBreakdown = useMemo(() => {
    const weeks: { label: string; total: number; start: Date }[] = []
    for (let i = 7; i >= 0; i--) {
      const weekStart = subWeeks(thisWeekStart, i)
      const weekEnd = new Date(weekStart)
      weekEnd.setDate(weekEnd.getDate() + 7)

      const total = sessions
        .filter(s => {
          const d = s.completed_at ? parseISO(s.completed_at) : null
          return d && d >= weekStart && d < weekEnd
        })
        .reduce((sum, s) => sum + calcEarnings(s), 0)

      weeks.push({
        label: format(weekStart, 'MMM d'),
        total,
        start: weekStart,
      })
    }
    return weeks
  }, [sessions])

  const maxWeeklyEarning = Math.max(...weeklyBreakdown.map(w => w.total), 1)

  const visibleSessions = sessions.slice(0, displayCount)

  if (loading) {
    return <LoadingSpinner fullScreen />
  }

  return (
    <div className="min-h-screen p-4 pb-24">
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => window.history.back()}
            className="p-2 rounded-xl bg-white/10 border border-white/20 hover:bg-white/20 transition-all"
          >
            <ChevronLeft className="w-5 h-5 text-white" />
          </button>
          <h1 className="text-2xl font-bold text-white">{t('Earnings')}</h1>
        </div>

        {/* Summary Cards */}
        <div className="flex gap-3 overflow-x-auto pb-2 mb-6 -mx-1 px-1">
          <div className="flex-shrink-0 w-36 bg-gradient-to-br from-green-600/30 to-green-800/30 rounded-xl p-4 border border-green-500/30">
            <p className="text-xs text-green-400 font-medium">{t('This Week')}</p>
            <p className="text-xl font-bold text-white mt-1">${weekTotal.toFixed(2)}</p>
          </div>
          <div className="flex-shrink-0 w-36 bg-gradient-to-br from-blue-600/30 to-blue-800/30 rounded-xl p-4 border border-blue-500/30">
            <p className="text-xs text-blue-400 font-medium">{t('This Month')}</p>
            <p className="text-xl font-bold text-white mt-1">${monthTotal.toFixed(2)}</p>
          </div>
          <div className="flex-shrink-0 w-36 bg-gradient-to-br from-purple-600/30 to-purple-800/30 rounded-xl p-4 border border-purple-500/30">
            <p className="text-xs text-purple-400 font-medium">{t('All Time')}</p>
            <p className="text-xl font-bold text-white mt-1">${allTimeTotal.toFixed(2)}</p>
          </div>
        </div>

        {/* Weekly Breakdown Bar Chart */}
        <div className="bg-white/10 rounded-2xl border border-white/20 p-4 mb-6">
          <h2 className="text-sm font-semibold text-gray-300 mb-4">{t('Weekly Breakdown')}</h2>
          <div className="flex items-end gap-2 h-40">
            {weeklyBreakdown.map((week, i) => {
              const heightPercent = maxWeeklyEarning > 0 ? (week.total / maxWeeklyEarning) * 100 : 0
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-[10px] text-gray-400 font-medium">
                    {week.total > 0 ? `$${Math.round(week.total)}` : ''}
                  </span>
                  <div className="w-full flex items-end" style={{ height: '120px' }}>
                    <div
                      className="w-full bg-green-500 rounded-t transition-all"
                      style={{ height: `${Math.max(heightPercent, week.total > 0 ? 4 : 0)}%` }}
                    />
                  </div>
                  <span className="text-[9px] text-gray-500 whitespace-nowrap">
                    {week.label}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Job History List */}
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-gray-300 mb-3">{t('Job History')}</h2>
          {visibleSessions.length === 0 ? (
            <div className="text-center py-8 bg-white/5 rounded-xl border border-white/10">
              <p className="text-gray-400">{t('No completed jobs yet')}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {visibleSessions.map(session => {
                const earnings = calcEarnings(session)
                const completedDate = session.completed_at
                  ? format(parseISO(session.completed_at), 'MMM d, yyyy')
                  : session.scheduled_date
                    ? format(parseISO(session.scheduled_date), 'MMM d, yyyy')
                    : ''
                const durationMin = session.job_template.duration_minutes || 0
                const hours = Math.floor(durationMin / 60)
                const mins = durationMin % 60

                return (
                  <div
                    key={session.id}
                    className="bg-white/5 rounded-xl p-3 border border-white/10"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-medium truncate text-sm">
                          {session.job_template.title}
                        </p>
                        <p className="text-xs text-gray-400 truncate">
                          {session.job_template.customer?.full_name || t('No customer')}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-gray-500">{completedDate}</span>
                          {durationMin > 0 && (
                            <span className="text-xs text-gray-500">
                              {hours > 0 ? `${hours}h` : ''}{mins > 0 ? `${mins}m` : ''}
                            </span>
                          )}
                        </div>
                      </div>
                      <span className="text-green-400 font-bold text-sm flex-shrink-0">
                        ${earnings.toFixed(2)}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {sessions.length > displayCount && (
            <button
              onClick={() => setDisplayCount(prev => prev + 20)}
              className="w-full mt-3 py-2 rounded-xl text-sm font-medium bg-white/10 border border-white/20 text-gray-300 hover:bg-white/20 transition-all"
            >
              {t('Load More')}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
