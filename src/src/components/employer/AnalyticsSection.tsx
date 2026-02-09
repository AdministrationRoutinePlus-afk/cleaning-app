'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useTranslation } from '@/lib/i18n/useTranslation'
import { BarChart3, Star, Users, DollarSign, Building2 } from 'lucide-react'
import LoadingSpinner from '@/components/LoadingSpinner'

interface AnalyticsSectionProps {
  employerId: string
}

interface WeeklyCompletion {
  weekLabel: string
  count: number
}

interface TopEmployee {
  id: string
  name: string
  count: number
}

interface EmployeeRating {
  id: string
  name: string
  avgRating: number
}

interface CustomerJobCount {
  id: string
  name: string
  count: number
}

export function AnalyticsSection({ employerId }: AnalyticsSectionProps) {
  const { t } = useTranslation()
  const supabaseRef = useRef(createClient())
  const supabase = supabaseRef.current
  const isMountedRef = useRef(true)

  const [loading, setLoading] = useState(true)
  const [weeklyCompletions, setWeeklyCompletions] = useState<WeeklyCompletion[]>([])
  const [topEmployees, setTopEmployees] = useState<TopEmployee[]>([])
  const [employeeRatings, setEmployeeRatings] = useState<EmployeeRating[]>([])
  const [customerJobs, setCustomerJobs] = useState<CustomerJobCount[]>([])
  const [monthlyRevenue, setMonthlyRevenue] = useState(0)

  useEffect(() => {
    isMountedRef.current = true
    loadAnalytics()
    return () => { isMountedRef.current = false }
  }, [])

  const loadAnalytics = async () => {
    try {
      await Promise.all([
        loadWeeklyCompletions(),
        loadTopEmployees(),
        loadEmployeeRatings(),
        loadCustomerJobs(),
        loadMonthlyRevenue(),
      ])
    } catch (error) {
      console.error('Error loading analytics:', error)
    } finally {
      if (isMountedRef.current) {
        setLoading(false)
      }
    }
  }

  const loadWeeklyCompletions = async () => {
    const now = new Date()
    const twelveWeeksAgo = new Date(now)
    twelveWeeksAgo.setDate(twelveWeeksAgo.getDate() - 84)

    const { data, error } = await supabase
      .from('job_sessions')
      .select('completed_at, job_template:job_templates!inner(created_by)')
      .in('status', ['COMPLETED', 'EVALUATED'])
      .gte('completed_at', twelveWeeksAgo.toISOString())
      .eq('job_template.created_by', employerId)

    if (error) {
      console.error('Error loading weekly completions:', error)
      return
    }

    // Group by week
    const weekMap = new Map<string, number>()
    const weeks: string[] = []

    for (let i = 11; i >= 0; i--) {
      const weekStart = new Date(now)
      weekStart.setDate(weekStart.getDate() - (i * 7) - weekStart.getDay() + 1)
      weekStart.setHours(0, 0, 0, 0)
      const key = weekStart.toISOString().split('T')[0]
      weekMap.set(key, 0)
      weeks.push(key)
    }

    if (data) {
      for (const session of data) {
        if (!session.completed_at) continue
        const completedDate = new Date(session.completed_at)
        // Find which week this belongs to
        for (let i = 0; i < weeks.length; i++) {
          const weekStart = new Date(weeks[i])
          const weekEnd = new Date(weekStart)
          weekEnd.setDate(weekEnd.getDate() + 7)
          if (completedDate >= weekStart && completedDate < weekEnd) {
            weekMap.set(weeks[i], (weekMap.get(weeks[i]) || 0) + 1)
            break
          }
        }
      }
    }

    if (isMountedRef.current) {
      setWeeklyCompletions(
        weeks.map((w, i) => ({
          weekLabel: `W${i + 1}`,
          count: weekMap.get(w) || 0,
        }))
      )
    }
  }

  const loadTopEmployees = async () => {
    const { data, error } = await supabase
      .from('job_sessions')
      .select('assigned_to, employee:employees!job_sessions_assigned_to_fkey(id, full_name), job_template:job_templates!inner(created_by)')
      .in('status', ['COMPLETED', 'EVALUATED'])
      .not('assigned_to', 'is', null)
      .eq('job_template.created_by', employerId)

    if (error) {
      console.error('Error loading top employees:', error)
      return
    }

    if (!data) return

    const countMap = new Map<string, { name: string; count: number }>()
    for (const session of data) {
      const empRaw = session.employee as unknown
      const emp = (Array.isArray(empRaw) ? empRaw[0] : empRaw) as { id: string; full_name: string } | null
      if (!emp) continue
      const existing = countMap.get(emp.id)
      if (existing) {
        existing.count++
      } else {
        countMap.set(emp.id, { name: emp.full_name, count: 1 })
      }
    }

    const sorted = Array.from(countMap.entries())
      .map(([id, { name, count }]) => ({ id, name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)

    if (isMountedRef.current) {
      setTopEmployees(sorted)
    }
  }

  const loadEmployeeRatings = async () => {
    const { data, error } = await supabase
      .from('evaluations')
      .select('employee_id, rating, employee:employees!inner(id, full_name)')

    if (error) {
      console.error('Error loading employee ratings:', error)
      return
    }

    if (!data) return

    const ratingMap = new Map<string, { name: string; total: number; count: number }>()
    for (const evaluation of data) {
      const emp = evaluation.employee as unknown as { id: string; full_name: string } | null
      if (!emp) continue
      const existing = ratingMap.get(emp.id)
      if (existing) {
        existing.total += evaluation.rating
        existing.count++
      } else {
        ratingMap.set(emp.id, { name: emp.full_name, total: evaluation.rating, count: 1 })
      }
    }

    const sorted = Array.from(ratingMap.entries())
      .map(([id, { name, total, count }]) => ({
        id,
        name,
        avgRating: Math.round((total / count) * 10) / 10,
      }))
      .sort((a, b) => b.avgRating - a.avgRating)

    if (isMountedRef.current) {
      setEmployeeRatings(sorted)
    }
  }

  const loadCustomerJobs = async () => {
    const { data, error } = await supabase
      .from('job_templates')
      .select('id, customer_id, customer:customers(id, full_name)')
      .eq('created_by', employerId)
      .not('customer_id', 'is', null)

    if (error) {
      console.error('Error loading customer jobs:', error)
      return
    }

    if (!data) return

    const countMap = new Map<string, { name: string; count: number }>()
    for (const tmpl of data) {
      const cust = tmpl.customer as unknown as { id: string; full_name: string } | null
      if (!cust) continue
      const existing = countMap.get(cust.id)
      if (existing) {
        existing.count++
      } else {
        countMap.set(cust.id, { name: cust.full_name, count: 1 })
      }
    }

    const sorted = Array.from(countMap.entries())
      .map(([id, { name, count }]) => ({ id, name, count }))
      .sort((a, b) => b.count - a.count)

    if (isMountedRef.current) {
      setCustomerJobs(sorted)
    }
  }

  const loadMonthlyRevenue = async () => {
    const now = new Date()
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
    const lastOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString()

    const { data, error } = await supabase
      .from('job_sessions')
      .select('price_override, job_template:job_templates!inner(duration_minutes, price_per_hour, created_by)')
      .in('status', ['COMPLETED', 'EVALUATED'])
      .gte('completed_at', firstOfMonth)
      .lte('completed_at', lastOfMonth)
      .eq('job_template.created_by', employerId)

    if (error) {
      console.error('Error loading monthly revenue:', error)
      return
    }

    if (!data) return

    let total = 0
    for (const session of data) {
      const tmpl = session.job_template as unknown as { duration_minutes: number | null; price_per_hour: number | null }
      if (!tmpl) continue
      const pricePerHour = session.price_override ?? tmpl.price_per_hour ?? 0
      const durationMinutes = tmpl.duration_minutes ?? 0
      total += (durationMinutes / 60) * pricePerHour
    }

    if (isMountedRef.current) {
      setMonthlyRevenue(Math.round(total * 100) / 100)
    }
  }

  const hasData = weeklyCompletions.some(w => w.count > 0) ||
    topEmployees.length > 0 ||
    employeeRatings.length > 0 ||
    customerJobs.length > 0 ||
    monthlyRevenue > 0

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner />
      </div>
    )
  }

  if (!hasData) {
    return (
      <div className="text-center py-12">
        <BarChart3 className="w-12 h-12 text-gray-500 mx-auto mb-3" />
        <p className="text-gray-400">{t('No analytics data available yet')}</p>
      </div>
    )
  }

  const maxWeekly = Math.max(...weeklyCompletions.map(w => w.count), 1)
  const maxEmployeeCount = Math.max(...topEmployees.map(e => e.count), 1)
  const maxCustomerCount = Math.max(...customerJobs.map(c => c.count), 1)

  return (
    <div className="space-y-6">
      {/* Job Completion Rate - Last 12 Weeks */}
      {weeklyCompletions.some(w => w.count > 0) && (
        <div className="bg-white/5 border border-white/10 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <BarChart3 className="w-4 h-4 text-green-400" />
            <h3 className="text-sm font-semibold text-white">{t('Job Completion Rate')}</h3>
          </div>
          <p className="text-xs text-gray-500 mb-3">{t('Last 12 Weeks')}</p>
          <div className="space-y-1.5">
            {weeklyCompletions.map((week) => (
              <div key={week.weekLabel} className="flex items-center gap-2">
                <span className="text-xs text-gray-400 w-7 shrink-0">{week.weekLabel}</span>
                <div className="flex-1 h-3 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-green-500 rounded-full transition-all duration-500"
                    style={{ width: `${(week.count / maxWeekly) * 100}%` }}
                  />
                </div>
                <span className="text-xs text-gray-400 w-5 text-right shrink-0">{week.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top Employees */}
      {topEmployees.length > 0 && (
        <div className="bg-white/5 border border-white/10 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Users className="w-4 h-4 text-blue-400" />
            <h3 className="text-sm font-semibold text-white">{t('Top Employees')}</h3>
          </div>
          <div className="space-y-2">
            {topEmployees.map((emp) => (
              <div key={emp.id} className="flex items-center gap-2">
                <span className="text-xs text-gray-300 w-28 truncate shrink-0">{emp.name}</span>
                <div className="flex-1 h-3 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full transition-all duration-500"
                    style={{ width: `${(emp.count / maxEmployeeCount) * 100}%` }}
                  />
                </div>
                <span className="text-xs text-gray-400 shrink-0">
                  {emp.count} {t('completed')}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Average Rating per Employee */}
      {employeeRatings.length > 0 && (
        <div className="bg-white/5 border border-white/10 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Star className="w-4 h-4 text-yellow-400" />
            <h3 className="text-sm font-semibold text-white">{t('Average Rating')}</h3>
          </div>
          <div className="space-y-2">
            {employeeRatings.map((emp) => (
              <div key={emp.id} className="flex items-center gap-2">
                <span className="text-xs text-gray-300 w-28 truncate shrink-0">{emp.name}</span>
                <div className="flex-1 h-3 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-yellow-500 rounded-full transition-all duration-500"
                    style={{ width: `${(emp.avgRating / 5) * 100}%` }}
                  />
                </div>
                <div className="flex items-center gap-0.5 shrink-0">
                  <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                  <span className="text-xs text-gray-400">{emp.avgRating}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Jobs by Customer */}
      {customerJobs.length > 0 && (
        <div className="bg-white/5 border border-white/10 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Building2 className="w-4 h-4 text-purple-400" />
            <h3 className="text-sm font-semibold text-white">{t('Jobs by Customer')}</h3>
          </div>
          <div className="space-y-2">
            {customerJobs.map((cust) => (
              <div key={cust.id} className="flex items-center gap-2">
                <span className="text-xs text-gray-300 w-28 truncate shrink-0">{cust.name}</span>
                <div className="flex-1 h-3 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-purple-500 rounded-full transition-all duration-500"
                    style={{ width: `${(cust.count / maxCustomerCount) * 100}%` }}
                  />
                </div>
                <span className="text-xs text-gray-400 shrink-0">
                  {cust.count} {cust.count === 1 ? t('job') : t('jobs')}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Monthly Revenue */}
      {monthlyRevenue > 0 && (
        <div className="bg-white/5 border border-white/10 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <DollarSign className="w-4 h-4 text-green-400" />
            <h3 className="text-sm font-semibold text-white">{t('Monthly Revenue')}</h3>
          </div>
          <p className="text-xs text-gray-500 mb-2">{t('This Month')}</p>
          <p className="text-3xl font-bold text-green-400">
            ${monthlyRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>
      )}
    </div>
  )
}
