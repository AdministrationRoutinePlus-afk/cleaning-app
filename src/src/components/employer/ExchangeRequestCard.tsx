'use client'

import { useState } from 'react'
import type { JobExchange, JobSession, Employee } from '@/types/database'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

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

      // Update exchange status
      const { error: exchangeError } = await supabase
        .from('job_exchanges')
        .update({
          status: approved ? 'APPROVED' : 'DENIED',
          decided_at: new Date().toISOString(),
          decided_by: user.id
        })
        .eq('id', exchange.id)

      if (exchangeError) throw exchangeError

      // If approved, reassign the job
      if (approved && exchange.to_employee_id) {
        const { error: sessionError } = await supabase
          .from('job_sessions')
          .update({
            assigned_to: exchange.to_employee_id,
            updated_at: new Date().toISOString()
          })
          .eq('id', exchange.job_session_id)

        if (sessionError) throw sessionError

        // Notify new employee
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

      // Notify original employee
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
      alert('Failed to process exchange request')
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
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-mono text-gray-500">
                {exchange.job_session.job_template?.job_code || exchange.job_session.session_code}
              </span>
              <Badge variant="secondary">PENDING</Badge>
            </div>
            <h3 className="font-medium text-gray-900">
              {exchange.job_session.job_template?.title || 'Job Exchange Request'}
            </h3>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pb-3 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs text-gray-500">From</p>
            <p className="text-sm font-medium">{exchange.from_employee.full_name}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">To</p>
            <p className="text-sm font-medium">
              {exchange.to_employee?.full_name || 'Marketplace'}
            </p>
          </div>
        </div>

        <div>
          <p className="text-xs text-gray-500">Scheduled Date</p>
          <p className="text-sm">{formatDate(exchange.job_session.scheduled_date)}</p>
        </div>

        {exchange.reason && (
          <div>
            <p className="text-xs text-gray-500">Reason</p>
            <p className="text-sm text-gray-700">{exchange.reason}</p>
          </div>
        )}

        <div>
          <p className="text-xs text-gray-500">Requested</p>
          <p className="text-sm">{formatDate(exchange.requested_at)}</p>
        </div>
      </CardContent>

      <CardFooter className="flex gap-2 pt-3 border-t">
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleDecision(false)}
          disabled={loading}
          className="flex-1"
        >
          {loading ? '...' : 'Deny'}
        </Button>
        <Button
          variant="default"
          size="sm"
          onClick={() => handleDecision(true)}
          disabled={loading}
          className="flex-1"
        >
          {loading ? '...' : 'Approve'}
        </Button>
      </CardFooter>
    </Card>
  )
}
