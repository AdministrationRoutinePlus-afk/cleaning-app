'use client'

import { useEffect, useState } from 'react'
import type { JobSession, JobTemplate } from '@/types/database'
import { createClient } from '@/lib/supabase/client'
import { Clock, Briefcase, CalendarDays } from 'lucide-react'
import { format, startOfWeek, endOfWeek, addDays } from 'date-fns'

interface NextDepositCardProps {
  employeeId: string
}

interface JobSessionWithTemplate extends JobSession {
  job_template: JobTemplate
}

interface WeeklyEarnings {
  totalEarnings: number
  totalHours: number
  jobCount: number
  weekStart: Date
  weekEnd: Date
  depositDate: Date
}

export function NextDepositCard({ employeeId }: NextDepositCardProps) {
  const [earnings, setEarnings] = useState<WeeklyEarnings | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    loadWeeklyEarnings()
  }, [employeeId])

  const loadWeeklyEarnings = async () => {
    try {
      const today = new Date()
      // Week starts on Monday
      const weekStart = startOfWeek(today, { weekStartsOn: 1 })
      const weekEnd = endOfWeek(today, { weekStartsOn: 1 })

      // Get completed jobs for this week
      const { data, error } = await supabase
        .from('job_sessions')
        .select(`
          *,
          job_template:job_templates(*)
        `)
        .eq('assigned_to', employeeId)
        .eq('status', 'COMPLETED')
        .gte('completed_at', weekStart.toISOString())
        .lte('completed_at', weekEnd.toISOString())

      if (error) throw error

      const jobs = data as JobSessionWithTemplate[]

      // Calculate earnings
      let totalEarnings = 0
      let totalMinutes = 0

      jobs.forEach(job => {
        const hourlyRate = job.price_override || job.job_template.price_per_hour || 0
        const durationMinutes = job.job_template.duration_minutes || 0

        totalMinutes += durationMinutes
        totalEarnings += (hourlyRate * durationMinutes) / 60
      })

      // Calculate deposit date (Thursday of current week)
      // weekStart is Monday (day 0 of week), Thursday is day 3
      const depositDate = addDays(weekStart, 3)

      setEarnings({
        totalEarnings,
        totalHours: totalMinutes / 60,
        jobCount: jobs.length,
        weekStart,
        weekEnd,
        depositDate
      })
    } catch (error) {
      console.error('Error loading weekly earnings:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="animate-pulse space-y-3">
        <div className="h-10 bg-white/10 rounded-lg"></div>
        <div className="h-4 bg-white/10 rounded w-3/4"></div>
      </div>
    )
  }

  if (!earnings) {
    return null
  }

  return (
    <div className="space-y-4">
      {/* Main Earnings Display */}
      <div className="text-center">
        <p className="text-4xl font-bold text-green-400">
          ${earnings.totalEarnings.toFixed(2)}
        </p>
        <p className="text-sm text-gray-400 mt-1">
          Estimated for this week
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white/5 rounded-lg p-3 text-center">
          <div className="flex items-center justify-center gap-1 text-gray-400 mb-1">
            <Clock className="w-4 h-4" />
            <span className="text-xs">Hours</span>
          </div>
          <p className="text-lg font-semibold text-white">
            {earnings.totalHours.toFixed(1)}h
          </p>
        </div>
        <div className="bg-white/5 rounded-lg p-3 text-center">
          <div className="flex items-center justify-center gap-1 text-gray-400 mb-1">
            <Briefcase className="w-4 h-4" />
            <span className="text-xs">Jobs</span>
          </div>
          <p className="text-lg font-semibold text-white">
            {earnings.jobCount}
          </p>
        </div>
      </div>

      {/* Deposit Date */}
      <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 text-center">
        <p className="text-amber-400 font-semibold">
          Deposit on {format(earnings.depositDate, 'EEEE, MMM d')}
        </p>
      </div>

      {/* Week Range */}
      <div className="flex items-center justify-center gap-2 text-xs text-gray-400">
        <CalendarDays className="w-4 h-4" />
        <span>
          Week: {format(earnings.weekStart, 'MMM d')} - {format(earnings.weekEnd, 'MMM d')}
        </span>
      </div>

      {/* Notice */}
      {earnings.jobCount === 0 && (
        <p className="text-xs text-center text-gray-500">
          Complete jobs to see your earnings here
        </p>
      )}
    </div>
  )
}

// Export with alias for drawer usage
export { NextDepositCard as NextDepositContent }
