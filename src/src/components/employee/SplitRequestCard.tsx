'use client'

import { useState, useRef } from 'react'
import type { JobSplit, Employee, JobSession, JobTemplate, Customer } from '@/types/database'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { AlertTriangle, Users, Clock, Calendar, FileText } from 'lucide-react'
import { toast } from 'sonner'
import { useTranslation } from '@/lib/i18n/useTranslation'

interface SplitRequestWithDetails extends JobSplit {
  requested_by_employee: Employee
  job_session: JobSession & {
    job_template: JobTemplate & {
      customer: Customer | null
    }
  }
}

interface SplitRequestCardProps {
  split: SplitRequestWithDetails
  onUpdate: () => void
}

export function SplitRequestCard({ split, onUpdate }: SplitRequestCardProps) {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(false)
  const supabaseRef = useRef(createClient())
  const supabase = supabaseRef.current

  const { job_session, requested_by_employee } = split
  const { job_template } = job_session
  const customerName = job_template.customer?.full_name || job_template.customer?.customer_code || ''

  const handleAccept = async () => {
    setLoading(true)
    try {
      const { error } = await supabase
        .from('job_splits')
        .update({
          status: 'PENDING_EMPLOYER',
          updated_at: new Date().toISOString(),
        })
        .eq('id', split.id)

      if (error) throw error

      // Notify the initiator that their split was accepted
      const { data: initiatorEmployee } = await supabase
        .from('employees')
        .select('user_id')
        .eq('id', split.requested_by)
        .single()

      if (initiatorEmployee) {
        // Get current user's name for the notification message
        const { data: { user } } = await supabase.auth.getUser()
        let partnerName = t('Your partner')
        if (user) {
          const { data: myEmployee } = await supabase
            .from('employees')
            .select('full_name')
            .eq('user_id', user.id)
            .single()
          if (myEmployee) partnerName = myEmployee.full_name
        }

        await supabase.from('notifications').insert({
          user_id: initiatorEmployee.user_id,
          user_type: 'EMPLOYEE',
          type: 'SPLIT_ACCEPTED',
          title: t('Split request accepted'),
          message: `${partnerName} ${t('accepted your split request for')} ${job_template.title}`,
        })
      }

      toast.success(t('Split accepted! Waiting for employer approval.'))
      onUpdate()
    } catch (error) {
      console.error('Error accepting split:', error)
      toast.error(t('Failed to accept split request'))
    } finally {
      setLoading(false)
    }
  }

  const handleDecline = async () => {
    setLoading(true)
    try {
      const { error } = await supabase
        .from('job_splits')
        .update({
          status: 'DENIED_PARTNER',
          updated_at: new Date().toISOString(),
          decided_at: new Date().toISOString(),
        })
        .eq('id', split.id)

      if (error) throw error

      // Notify the initiator that their split was declined
      const { data: initiatorEmployee } = await supabase
        .from('employees')
        .select('user_id')
        .eq('id', split.requested_by)
        .single()

      if (initiatorEmployee) {
        const { data: { user } } = await supabase.auth.getUser()
        let partnerName = t('Your partner')
        if (user) {
          const { data: myEmployee } = await supabase
            .from('employees')
            .select('full_name')
            .eq('user_id', user.id)
            .single()
          if (myEmployee) partnerName = myEmployee.full_name
        }

        await supabase.from('notifications').insert({
          user_id: initiatorEmployee.user_id,
          user_type: 'EMPLOYEE',
          type: 'SPLIT_DECLINED',
          title: t('Split request declined'),
          message: `${partnerName} ${t('declined your split request for')} ${job_template.title}`,
        })
      }

      toast.success(t('Split request declined'))
      onUpdate()
    } catch (error) {
      console.error('Error declining split:', error)
      toast.error(t('Failed to decline split request'))
    } finally {
      setLoading(false)
    }
  }

  const formatDuration = (minutes: number | null) => {
    if (!minutes) return '\u2014'
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    if (hours === 0) return `${mins}m`
    if (mins === 0) return `${hours}h`
    return `${hours}h${mins}m`
  }

  const formatScheduledDate = (dateStr: string | null) => {
    if (!dateStr) return '\u2014'
    const date = new Date(dateStr)
    return date.toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    })
  }

  return (
    <div className="bg-white/10 rounded-2xl border border-purple-500/30 overflow-hidden p-4">
      <div className="space-y-2">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600/20 to-blue-600/20 rounded-lg px-3 py-2 flex items-center justify-between border border-white/10">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-purple-400" />
            <p className="text-white font-bold text-base">{t('Split Request')}</p>
          </div>
          <span className="text-purple-300 text-xs">{requested_by_employee.full_name}</span>
        </div>

        {/* Customer */}
        {customerName && (
          <div className="bg-white/10 rounded-lg px-3 py-2">
            <p className="text-white font-semibold text-sm">{customerName}</p>
          </div>
        )}

        {/* Job name with code */}
        <div className="bg-white/10 rounded-lg px-3 py-2 flex items-center gap-2">
          <FileText className="w-4 h-4 text-purple-400 flex-shrink-0" />
          <div>
            <p className="text-gray-300 text-xs">{t('Job')}</p>
            <p className="text-white font-semibold text-sm">
              {job_template.job_code && <span className="text-gray-400 mr-1">{job_template.job_code}</span>}
              {job_template.title}
            </p>
          </div>
        </div>

        {/* Duration & Hours given */}
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-white/10 rounded-lg px-3 py-2 flex items-center gap-2">
            <Clock className="w-4 h-4 text-blue-400 flex-shrink-0" />
            <div>
              <p className="text-gray-300 text-xs">{t('Total Duration')}</p>
              <p className="text-white font-semibold text-sm">{formatDuration(job_template.duration_minutes)}</p>
            </div>
          </div>
          {split.partner_minutes && (
            <div className="bg-purple-500/10 rounded-lg px-3 py-2 flex items-center gap-2 border border-purple-500/20">
              <Clock className="w-4 h-4 text-purple-400 flex-shrink-0" />
              <div>
                <p className="text-purple-300 text-xs">{t('Your Part')}</p>
                <p className="text-white font-semibold text-sm">{formatDuration(split.partner_minutes)}</p>
              </div>
            </div>
          )}
        </div>

        {/* Date */}
        <div className="bg-white/10 rounded-lg px-3 py-2 flex items-center gap-2">
          <Calendar className="w-4 h-4 text-amber-400 flex-shrink-0" />
          <div>
            <p className="text-gray-300 text-xs">{t('Scheduled Date')}</p>
            <p className="text-white font-semibold text-sm">{formatScheduledDate(job_session.scheduled_date)}</p>
          </div>
        </div>

        {/* Warning */}
        <div className="p-2 bg-amber-500/10 rounded-lg border border-amber-500/30">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-300">
              {t('You are responsible for each other\'s work. You must confirm every step is done in your app, even if it wasn\'t your part of the job.')}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 pt-1">
          <Button
            onClick={handleDecline}
            disabled={loading}
            className="flex-1 bg-red-500/20 text-red-300 border border-red-500/30 hover:bg-red-500/30"
          >
            {loading ? '...' : t('Decline')}
          </Button>
          <Button
            onClick={handleAccept}
            disabled={loading}
            className="flex-1 bg-green-600 hover:bg-green-700 text-white"
          >
            {loading ? '...' : t('Accept Split')}
          </Button>
        </div>
      </div>
    </div>
  )
}
