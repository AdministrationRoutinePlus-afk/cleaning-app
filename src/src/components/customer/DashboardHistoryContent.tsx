'use client'

import { useEffect, useState, useRef } from 'react'
import { Calendar, User, CheckCircle, ChevronDown } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { useTranslation } from '@/lib/i18n/useTranslation'
import { useDateFormat } from '@/lib/i18n/useDateFormat'

interface HistorySession {
  id: string
  full_job_code: string | null
  scheduled_date: string
  status: string
  completed_at: string | null
  job_template: {
    job_code: string
    title: string
  }
  employee: {
    full_name: string
  } | null
  evaluation: {
    rating: number
  }[] | null
}

interface MonthGroup {
  key: string
  label: string
  sessions: HistorySession[]
}

interface DashboardHistoryContentProps {
  customerId: string
  onWriteReview?: (sessionId: string) => void
  onContactUs?: () => void
}

export function DashboardHistoryContent({ customerId, onWriteReview, onContactUs }: DashboardHistoryContentProps) {
  const { t } = useTranslation()
  const { formatDate: formatDateLocale } = useDateFormat()
  const [sessions, setSessions] = useState<HistorySession[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set())
  const supabaseRef = useRef(createClient())
  const supabase = supabaseRef.current
  const isMountedRef = useRef(true)

  useEffect(() => {
    isMountedRef.current = true
    loadHistory()
    return () => { isMountedRef.current = false }
  }, [customerId])

  const loadHistory = async () => {
    try {
      const { data, error } = await supabase
        .from('job_sessions')
        .select(`
          id,
          full_job_code,
          scheduled_date,
          status,
          completed_at,
          job_template:job_templates!inner(
            job_code,
            title,
            customer_id
          ),
          employee:employees!job_sessions_assigned_to_fkey(
            full_name
          ),
          evaluation:evaluations(
            rating
          )
        `)
        .eq('job_template.customer_id', customerId)
        .in('status', ['COMPLETED', 'EVALUATED', 'MISSED'])
        .order('completed_at', { ascending: false, nullsFirst: false })

      if (error) throw error

      // Also fetch evaluations separately (in case RLS blocks the join)
      const { data: evals } = await supabase
        .from('evaluations')
        .select('job_session_id, rating')
        .eq('customer_id', customerId)

      const evalMap = new Map<string, number>()
      evals?.forEach((e: any) => evalMap.set(e.job_session_id, e.rating))

      if (isMountedRef.current) {
        const sessions = ((data as unknown as HistorySession[]) || []).map(s => {
          // Merge evaluation data from separate query if the join returned empty
          if ((!s.evaluation || s.evaluation.length === 0) && evalMap.has(s.id)) {
            return { ...s, evaluation: [{ rating: evalMap.get(s.id)! }] }
          }
          return s
        })
        setSessions(sessions)
      }
    } catch (error) {
      console.error('Error loading history:', error)
      toast.error(t('Failed to load session history'))
    } finally {
      if (isMountedRef.current) setLoading(false)
    }
  }

  const toggleMonth = (key: string) => {
    setExpandedMonths(prev => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }

  const groupByMonth = (sessions: HistorySession[]): MonthGroup[] => {
    const groups: Record<string, HistorySession[]> = {}

    sessions.forEach(session => {
      const dateStr = session.completed_at || session.scheduled_date
      if (!dateStr) return
      const date = new Date(dateStr.includes('T') ? dateStr : dateStr + 'T00:00:00')
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      if (!groups[key]) groups[key] = []
      groups[key].push(session)
    })

    return Object.entries(groups)
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([key, sessions]) => {
        const [year, month] = key.split('-')
        const date = new Date(parseInt(year), parseInt(month) - 1, 1)
        const label = date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
        return { key, label: label.charAt(0).toUpperCase() + label.slice(1), sessions }
      })
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return t('N/A')
    const date = new Date(dateStr.includes('T') ? dateStr : dateStr + 'T00:00:00')
    return formatDateLocale(date, 'EEE, MMM d')
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
      case 'EVALUATED':
        return 'bg-green-500/20 text-green-300 border border-green-500/30'
      case 'MISSED':
        return 'bg-red-500/20 text-red-300 border border-red-500/30'
      default:
        return 'bg-gray-500/20 text-gray-300 border border-gray-500/30'
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'COMPLETED': return t('Completed')
      case 'EVALUATED': return t('Evaluated')
      case 'MISSED': return t('Missed')
      default: return status
    }
  }

  const renderStars = (rating: number) => {
    return (
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <span
            key={star}
            className={`text-base ${star <= rating ? 'text-yellow-400' : 'text-gray-600'}`}
          >
            ★
          </span>
        ))}
      </div>
    )
  }

  if (loading) {
    return (
      <div className="animate-pulse space-y-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-16 bg-white/5 rounded-xl"></div>
        ))}
      </div>
    )
  }

  if (sessions.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-400">{t('No history yet')}</p>
        <p className="text-sm text-gray-500 mt-1">
          {t('Completed sessions will appear here')}
        </p>
      </div>
    )
  }

  const monthGroups = groupByMonth(sessions)

  return (
    <div className="space-y-3">
      {monthGroups.map((group) => {
        const isExpanded = expandedMonths.has(group.key)

        return (
          <div key={group.key} className="bg-gray-800/60 border border-white/20 rounded-xl overflow-hidden">
            {/* Month header - clickable */}
            <button
              onClick={() => toggleMonth(group.key)}
              className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Calendar className="w-5 h-5 text-blue-400" />
                <span className="text-lg font-bold text-white">{group.label}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="bg-white/10 text-gray-200 px-2.5 py-1 rounded-lg text-sm font-bold border border-white/20">
                  {group.sessions.length}
                </span>
                <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
              </div>
            </button>

            {/* Expanded session list */}
            {isExpanded && (
              <div className="border-t border-white/10 p-3 space-y-2">
                {group.sessions.map((session) => {
                  const rating = session.evaluation && session.evaluation.length > 0
                    ? session.evaluation[0].rating
                    : null

                  return (
                    <div key={session.id} className="bg-gray-900/60 border border-white/10 rounded-xl p-4">
                      {/* Header: code + status */}
                      <div className="flex items-center justify-between mb-2">
                        <span className="bg-gray-800/80 text-white font-bold text-xs px-3 py-1 rounded-full border border-white/30">
                          {session.full_job_code || session.job_template?.job_code}
                        </span>
                        <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${getStatusBadge(rating ? 'EVALUATED' : session.status)}`}>
                          {getStatusLabel(rating ? 'EVALUATED' : session.status)}
                        </span>
                      </div>

                      {/* Title */}
                      <h4 className="font-bold text-white text-base mb-2">
                        {session.job_template?.title}
                      </h4>

                      {/* Info rows */}
                      <div className="space-y-1.5">
                        {session.employee && (
                          <div className="flex items-center gap-2">
                            <User className="w-4 h-4 text-purple-400" />
                            <span className="text-sm text-gray-400">{t('Done by')}</span>
                            <span className="text-sm font-semibold text-white">{session.employee.full_name}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-blue-400" />
                          <span className="text-sm text-gray-400">{t('Date')}</span>
                          <span className="text-sm font-semibold text-white">
                            {formatDate(session.completed_at || session.scheduled_date)}
                          </span>
                        </div>
                        {rating && (
                          <div className="flex items-center gap-2">
                            <CheckCircle className="w-4 h-4 text-yellow-400" />
                            <span className="text-sm text-gray-400">{t('Rating')}</span>
                            {renderStars(rating)}
                            <span className="text-sm font-bold text-white">{rating}/5</span>
                          </div>
                        )}
                      </div>

                      {/* Action buttons per status */}
                      {session.status === 'COMPLETED' && !rating && onWriteReview && (
                        <button
                          onClick={() => onWriteReview(session.id)}
                          className="w-full mt-3 bg-blue-600 text-white hover:bg-blue-700 py-2.5 rounded-xl text-sm font-bold transition-colors shadow-lg shadow-blue-500/20"
                        >
                          {t('Write Review')}
                        </button>
                      )}
                      {session.status === 'MISSED' && onContactUs && (
                        <button
                          onClick={onContactUs}
                          className="w-full mt-3 bg-white/10 text-white border border-white/20 hover:bg-white/20 py-2.5 rounded-xl text-sm font-bold transition-colors"
                        >
                          {t('Contact Us')}
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
