'use client'

import { useState } from 'react'
import type { JobSplit, JobSession, Employee } from '@/types/database'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Users, Check, X, Clock } from 'lucide-react'
import { toast } from 'sonner'
import { useTranslation } from '@/lib/i18n/useTranslation'

interface JobSplitWithDetails extends JobSplit {
  job_session: JobSession & {
    job_template?: {
      job_code: string
      title: string
    }
  }
  requested_by_employee: Employee
  partner_employee: Employee
}

interface SplitApprovalCardProps {
  split: JobSplitWithDetails
  onUpdate: () => void
}

export function SplitApprovalCard({ split, onUpdate }: SplitApprovalCardProps) {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  const handleDecision = async (approved: boolean) => {
    setLoading(true)
    try {
      // Update split status
      const { error: splitError } = await supabase
        .from('job_splits')
        .update({
          status: approved ? 'APPROVED' : 'DENIED_EMPLOYER',
          updated_at: new Date().toISOString(),
          decided_at: new Date().toISOString(),
        })
        .eq('id', split.id)

      if (splitError) throw splitError

      // If approved, set split_with on the job session
      if (approved) {
        const { error: sessionError } = await supabase
          .from('job_sessions')
          .update({
            split_with: split.partner_id,
            updated_at: new Date().toISOString(),
          })
          .eq('id', split.job_session_id)

        if (sessionError) throw sessionError

        // Notify both employees
        if (split.requested_by_employee.user_id) {
          await supabase.from('notifications').insert({
            user_id: split.requested_by_employee.user_id,
            user_type: 'EMPLOYEE',
            type: 'SPLIT_APPROVED',
            title: t('Split Approved'),
            message: t('Your job split request has been approved'),
            related_id: split.job_session_id,
            is_read: false,
          })
        }
        if (split.partner_employee.user_id) {
          await supabase.from('notifications').insert({
            user_id: split.partner_employee.user_id,
            user_type: 'EMPLOYEE',
            type: 'SPLIT_APPROVED',
            title: t('Split Approved'),
            message: t('A job split you accepted has been approved by the employer'),
            related_id: split.job_session_id,
            is_read: false,
          })
        }
      } else {
        // Notify initiator of denial
        if (split.requested_by_employee.user_id) {
          await supabase.from('notifications').insert({
            user_id: split.requested_by_employee.user_id,
            user_type: 'EMPLOYEE',
            type: 'SPLIT_DENIED',
            title: t('Split Denied'),
            message: t('Your job split request has been denied by the employer'),
            related_id: split.job_session_id,
            is_read: false,
          })
        }
      }

      toast.success(approved ? t('Split approved') : t('Split denied'))
      onUpdate()
    } catch (error) {
      console.error('Error handling split decision:', error)
      toast.error(t('Failed to process split request'))
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return t('Not scheduled')
    const date = new Date(dateStr)
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  return (
    <div className="bg-white/5 rounded-xl border border-white/10 overflow-hidden hover:bg-white/[0.07] transition-colors">
      <div className="p-4 pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-mono text-gray-500">
                {split.job_session.job_template?.job_code || split.job_session.session_code}
              </span>
              <Badge className="bg-purple-500/20 text-purple-300 border border-purple-500/30">
                <Users className="w-3 h-3 mr-1" />
                {t('SPLIT')}
              </Badge>
              {split.partner_minutes && (
                <span className="text-xs text-purple-300">
                  {Math.floor(split.partner_minutes / 60)}h{split.partner_minutes % 60 > 0 ? `${split.partner_minutes % 60}m` : ''} → {split.partner_employee.full_name}
                </span>
              )}
            </div>
            <h3 className="font-medium text-white">
              {split.job_session.job_template?.job_code && <span className="text-gray-400 mr-1">{split.job_session.job_template.job_code}</span>}
              {split.job_session.job_template?.title || t('Job Split Request')}
            </h3>
          </div>
        </div>
      </div>

      <div className="px-4 pb-3 space-y-3">
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <p className="text-xs text-gray-500">{t('Requested by')}</p>
            <p className="text-sm font-medium text-white">{split.requested_by_employee.full_name}</p>
          </div>
          <Users className="w-4 h-4 text-purple-400" />
          <div className="flex-1">
            <p className="text-xs text-gray-500">{t('Partner')}</p>
            <p className="text-sm font-medium text-white">{split.partner_employee.full_name}</p>
          </div>
        </div>

        <div>
          <p className="text-xs text-gray-500">{t('Scheduled Date')}</p>
          <p className="text-sm text-gray-300">{formatDate(split.job_session.scheduled_date)}</p>
        </div>

        <div>
          <p className="text-xs text-gray-500">{t('Requested')}</p>
          <p className="text-sm text-gray-300">{formatDate(split.created_at)}</p>
        </div>
      </div>

      {split.status === 'PENDING_PARTNER' ? (
        <div className="px-4 pb-4 pt-3 border-t border-white/10">
          <div className="flex items-center gap-2 text-amber-300 bg-amber-500/10 rounded-lg p-2.5 border border-amber-500/20">
            <Clock className="w-4 h-4 flex-shrink-0" />
            <p className="text-xs">{t('Waiting for partner to accept')}</p>
          </div>
        </div>
      ) : (
        <div className="px-4 pb-4 pt-3 border-t border-white/10 flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleDecision(false)}
            disabled={loading}
            className="flex-1 border-red-500/30 text-red-400 hover:bg-red-500/10"
          >
            <X className="w-3 h-3 mr-1" />
            {loading ? '...' : t('Deny')}
          </Button>
          <Button
            size="sm"
            onClick={() => handleDecision(true)}
            disabled={loading}
            className="flex-1 bg-green-600 hover:bg-green-700 text-white"
          >
            <Check className="w-3 h-3 mr-1" />
            {loading ? '...' : t('Approve')}
          </Button>
        </div>
      )}
    </div>
  )
}
