'use client'

import { useState, useEffect, useMemo } from 'react'
import type { JobSession, JobTemplate, Employee } from '@/types/database'
import { createClient } from '@/lib/supabase/client'
import { Badge } from '@/components/ui/badge'
import { DollarSign, Clock, Briefcase, User, ChevronDown, ChevronUp } from 'lucide-react'
import LoadingSpinner from '@/components/LoadingSpinner'
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, format, parseISO, isWithinInterval } from 'date-fns'
import { useTranslation } from '@/lib/i18n/useTranslation'

interface JobSessionWithDetails extends JobSession {
  job_template: JobTemplate
  employee: Employee | null
}

interface EmployeePayroll {
  employee: Employee
  totalHours: number
  totalEarnings: number
  jobsCompleted: number
  sessions: JobSessionWithDetails[]
}

type PayrollPeriod = 'weekly' | 'monthly'

interface PayrollContentProps {
  employerId: string
}

export function PayrollContent({ employerId }: PayrollContentProps) {
  const { t } = useTranslation()
  const [sessions, setSessions] = useState<JobSessionWithDetails[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<PayrollPeriod>('weekly')
  const [expandedEmployee, setExpandedEmployee] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const { data: sessionsData, error: sessionsError } = await supabase
        .from('job_sessions')
        .select(`
          *,
          job_template:job_templates(*),
          employee:employees!job_sessions_assigned_to_fkey(*)
        `)
        .in('status', ['COMPLETED', 'EVALUATED'])
        .not('assigned_to', 'is', null)
        .order('completed_at', { ascending: false })

      if (sessionsError) throw sessionsError

      const { data: employeesData, error: employeesError } = await supabase
        .from('employees')
        .select('*')
        .eq('status', 'ACTIVE')
        .order('full_name')

      if (employeesError) throw employeesError

      setSessions((sessionsData || []) as JobSessionWithDetails[])
      setEmployees(employeesData || [])
    } catch (error) {
      console.error('Error loading payroll data:', error)
    } finally {
      setLoading(false)
    }
  }

  const { periodStart, periodEnd, periodLabel } = useMemo(() => {
    const now = new Date()
    if (period === 'weekly') {
      return {
        periodStart: startOfWeek(now, { weekStartsOn: 1 }),
        periodEnd: endOfWeek(now, { weekStartsOn: 1 }),
        periodLabel: `${t('Week of')} ${format(startOfWeek(now, { weekStartsOn: 1 }), 'MMM d, yyyy')}`
      }
    } else {
      return {
        periodStart: startOfMonth(now),
        periodEnd: endOfMonth(now),
        periodLabel: format(now, 'MMMM yyyy')
      }
    }
  }, [period])

  const employeePayrolls: EmployeePayroll[] = useMemo(() => {
    return employees.map(employee => {
      const employeeSessions = sessions.filter(session => {
        if (session.assigned_to !== employee.id) return false
        if (!session.completed_at) return false

        const completedDate = parseISO(session.completed_at)
        return isWithinInterval(completedDate, { start: periodStart, end: periodEnd })
      })

      const totalHours = employeeSessions.reduce((sum, session) => {
        const durationMinutes = session.job_template?.duration_minutes || 60
        return sum + (durationMinutes / 60)
      }, 0)

      const totalEarnings = employeeSessions.reduce((sum, session) => {
        const durationMinutes = session.job_template?.duration_minutes || 60
        const hours = durationMinutes / 60
        const rate = session.price_override || session.job_template?.price_per_hour || 0
        return sum + (hours * rate)
      }, 0)

      return {
        employee,
        totalHours,
        totalEarnings,
        jobsCompleted: employeeSessions.length,
        sessions: employeeSessions
      }
    }).filter(p => p.jobsCompleted > 0 || p.totalHours > 0)
      .sort((a, b) => b.totalEarnings - a.totalEarnings)
  }, [employees, sessions, periodStart, periodEnd])

  const totals = useMemo(() => {
    return employeePayrolls.reduce(
      (acc, p) => ({
        hours: acc.hours + p.totalHours,
        earnings: acc.earnings + p.totalEarnings,
        jobs: acc.jobs + p.jobsCompleted
      }),
      { hours: 0, earnings: 0, jobs: 0 }
    )
  }, [employeePayrolls])

  if (loading) {
    return <LoadingSpinner />
  }

  return (
    <div className="space-y-4">
      {/* Period Toggle */}
      <div className="flex gap-2">
        <button
          onClick={() => setPeriod('weekly')}
          className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
            period === 'weekly'
              ? 'bg-green-600 text-white'
              : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-gray-300'
          }`}
        >
          {t('Weekly')}
        </button>
        <button
          onClick={() => setPeriod('monthly')}
          className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
            period === 'monthly'
              ? 'bg-green-600 text-white'
              : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-gray-300'
          }`}
        >
          {t('Monthly')}
        </button>
      </div>

      {/* Period Label */}
      <div className="text-center text-sm text-gray-400 font-medium">
        {periodLabel}
      </div>

      {/* Totals Summary */}
      <div className="bg-green-500/10 rounded-xl p-4 border border-green-500/20">
        <h3 className="font-semibold text-green-400 mb-3">{t('Period Summary')}</h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-green-500 mb-1">
              <DollarSign className="w-4 h-4" />
            </div>
            <div className="text-xl font-bold text-green-400">
              ${totals.earnings.toFixed(2)}
            </div>
            <div className="text-xs text-green-500/70">{t('Total')}</div>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-green-500 mb-1">
              <Clock className="w-4 h-4" />
            </div>
            <div className="text-xl font-bold text-green-400">
              {totals.hours.toFixed(1)}h
            </div>
            <div className="text-xs text-green-500/70">{t('Hours')}</div>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-green-500 mb-1">
              <Briefcase className="w-4 h-4" />
            </div>
            <div className="text-xl font-bold text-green-400">
              {totals.jobs}
            </div>
            <div className="text-xs text-green-500/70">{t('Jobs')}</div>
          </div>
        </div>
      </div>

      {/* Employee Payrolls */}
      <div className="space-y-3">
        {employeePayrolls.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            {t('No completed jobs in this period')}
          </div>
        ) : (
          employeePayrolls.map((payroll) => (
            <div
              key={payroll.employee.id}
              className="bg-white/5 rounded-xl border border-white/10 overflow-hidden"
            >
              {/* Employee Header */}
              <button
                onClick={() => setExpandedEmployee(
                  expandedEmployee === payroll.employee.id ? null : payroll.employee.id
                )}
                className="w-full p-4 flex items-center justify-between hover:bg-white/5 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                    <User className="w-5 h-5 text-green-400" />
                  </div>
                  <div className="text-left">
                    <h4 className="font-semibold text-white">
                      {payroll.employee.full_name}
                    </h4>
                    <p className="text-sm text-gray-400">
                      {payroll.jobsCompleted} {t('jobs')} | {payroll.totalHours.toFixed(1)} {t('hours')}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="font-bold text-green-400">
                      ${payroll.totalEarnings.toFixed(2)}
                    </div>
                  </div>
                  {expandedEmployee === payroll.employee.id ? (
                    <ChevronUp className="w-5 h-5 text-gray-500" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-500" />
                  )}
                </div>
              </button>

              {/* Expanded Details */}
              {expandedEmployee === payroll.employee.id && (
                <div className="px-4 pb-4 border-t border-white/10">
                  <div className="pt-3 space-y-2">
                    {payroll.sessions.map((session) => (
                      <div
                        key={session.id}
                        className="flex items-center justify-between py-2 text-sm"
                      >
                        <div>
                          <span className="font-medium text-white">
                            {session.job_template?.job_code}
                          </span>
                          <span className="text-gray-500 ml-2">
                            {session.completed_at && format(parseISO(session.completed_at), 'MMM d')}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-gray-400">
                            {((session.job_template?.duration_minutes || 60) / 60).toFixed(1)}h
                          </span>
                          <span className="text-green-400 font-medium ml-3">
                            ${(
                              ((session.job_template?.duration_minutes || 60) / 60) *
                              (session.price_override || session.job_template?.price_per_hour || 0)
                            ).toFixed(2)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
