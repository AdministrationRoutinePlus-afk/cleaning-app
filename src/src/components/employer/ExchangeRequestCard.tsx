'use client'

import { useState } from 'react'
import type { JobExchange, JobSession, Employee } from '@/types/database'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ArrowRight, Check, X } from 'lucide-react'
import { toast } from 'sonner'

interface JobExchangeWithDetails extends JobExchange {
  job_session: JobSession & {
    job_template?: {
      job_code: string
      title: string
    }
  }
  from_employee: Employee
  to_employee: Employee | null
}

interface ExchangeRequestCardProps {
  exchange: JobExchangeWithDetails
  onUpdate: () => void
}

export function ExchangeRequestCard({ exchange, onUpdate }: ExchangeRequestCardProps) {
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  const handleDecision = async (approved: boolean) => {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      // decided_by is FK to employers table, not auth.users
      const { data: employer } = await supabase
        .from('employers')
        .select('id')
        .eq('user_id', user.id)
        .single()

      if (!employer) throw new Error('Employer not found')

      const { error: exchangeError } = await supabase
        .from('job_exchanges')
        .update({
          status: approved ? 'APPROVED' : 'DENIED',
          decided_at: new Date().toISOString(),
          decided_by: employer.id
        })
        .eq('id', exchange.id)

      if (exchangeError) throw exchangeError

      if (approved && exchange.to_employee_id) {
        const { error: sessionError } = await supabase
          .from('job_sessions')
          .update({
            assigned_to: exchange.to_employee_id,
            updated_at: new Date().toISOString()
          })
          .eq('id', exchange.job_session_id)

        if (sessionError) throw sessionError

        if (exchange.to_employee?.user_id) {
          await supabase.from('notifications').insert({
            user_id: exchange.to_employee.user_id as string,
            user_type: 'EMPLOYEE',
            type: 'EXCHANGE_APPROVED',
            title: 'Job Exchange Approved',
            message: `You've been assigned ${exchange.job_session.job_template?.job_code || 'a job'}`,
            related_id: exchange.job_session_id,
            is_read: false
          })
        }
      }

      if (exchange.from_employee.user_id) {
        await supabase.from('notifications').insert({
          user_id: exchange.from_employee.user_id,
          user_type: 'EMPLOYEE',
          type: approved ? 'EXCHANGE_APPROVED' : 'EXCHANGE_DENIED',
          title: approved ? 'Exchange Approved' : 'Exchange Denied',
          message: approved
            ? 'Your job exchange request has been approved'
            : 'Your job exchange request has been denied',
          related_id: exchange.job_session_id,
          is_read: false
        })
      }

      onUpdate()
    } catch (error) {
      console.error('Error handling exchange decision:', error)
      toast.error('Failed to process exchange request')
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Not scheduled'
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  return (
    <div className="bg-white/5 rounded-xl border border-white/10 overflow-hidden hover:bg-white/[0.07] transition-colors">
      <div className="p-4 pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-mono text-gray-500">
                {exchange.job_session.job_template?.job_code || exchange.job_session.session_code}
              </span>
              <Badge className="bg-yellow-500/20 text-yellow-300 border border-yellow-500/30">PENDING</Badge>
            </div>
            <h3 className="font-medium text-white">
              {exchange.job_session.job_template?.title || 'Job Exchange Request'}
            </h3>
          </div>
        </div>
      </div>

      <div className="px-4 pb-3 space-y-3">
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <p className="text-xs text-gray-500">From</p>
            <p className="text-sm font-medium text-white">{exchange.from_employee.full_name}</p>
          </div>
          <ArrowRight className="w-4 h-4 text-gray-500" />
          <div className="flex-1">
            <p className="text-xs text-gray-500">To</p>
            <p className="text-sm font-medium text-white">
              {exchange.to_employee?.full_name || 'Marketplace'}
            </p>
          </div>
        </div>

        <div>
          <p className="text-xs text-gray-500">Scheduled Date</p>
          <p className="text-sm text-gray-300">{formatDate(exchange.job_session.scheduled_date)}</p>
        </div>

        {exchange.reason && (
          <div>
            <p className="text-xs text-gray-500">Reason</p>
            <p className="text-sm text-gray-300">{exchange.reason}</p>
          </div>
        )}

        <div>
          <p className="text-xs text-gray-500">Requested</p>
          <p className="text-sm text-gray-300">{formatDate(exchange.requested_at)}</p>
        </div>
      </div>

      <div className="px-4 pb-4 pt-3 border-t border-white/10 flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleDecision(false)}
          disabled={loading}
          className="flex-1 border-red-500/30 text-red-400 hover:bg-red-500/10"
        >
          <X className="w-3 h-3 mr-1" />
          {loading ? '...' : 'Deny'}
        </Button>
        <Button
          size="sm"
          onClick={() => handleDecision(true)}
          disabled={loading}
          className="flex-1 bg-green-600 hover:bg-green-700 text-white"
        >
          <Check className="w-3 h-3 mr-1" />
          {loading ? '...' : 'Approve'}
        </Button>
      </div>
    </div>
  )
}
