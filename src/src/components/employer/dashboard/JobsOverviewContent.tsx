'use client'

import { useState, useEffect } from 'react'
import type { JobSession, JobTemplate, Employee, Customer, JobSessionStatus } from '@/types/database'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { formatDate, formatTime } from '@/lib/utils/dateFormatters'
import { Check, X, Clock, Calendar, MapPin, User, ChevronRight, AlertTriangle, GraduationCap } from 'lucide-react'
import LoadingSpinner from '@/components/LoadingSpinner'
import { useTranslation } from '@/lib/i18n/useTranslation'

interface JobSessionWithDetails extends JobSession {
  job_template: JobTemplate & { customer: Customer | null }
  employee: Employee | null
}

type JobTab = 'confirm' | 'scheduled' | 'completed'

interface JobsOverviewContentProps {
  employerId: string
}

export function JobsOverviewContent({ employerId }: JobsOverviewContentProps) {
  const { t } = useTranslation()
  const [sessions, setSessions] = useState<JobSessionWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<JobTab>('confirm')
  const [selectedSession, setSelectedSession] = useState<JobSessionWithDetails | null>(null)
  const [showRefuseDialog, setShowRefuseDialog] = useState(false)
  const [refuseReason, setRefuseReason] = useState('')
  const [actionLoading, setActionLoading] = useState(false)
  // Map of sessionId -> { is_trained, can_coach }
  const [trainingMap, setTrainingMap] = useState<Record<string, { is_trained: boolean; can_coach: boolean }>>({})
  const supabase = createClient()

  useEffect(() => {
    loadSessions()
  }, [])

  const loadSessions = async () => {
    try {
      const { data, error } = await supabase
        .from('job_sessions')
        .select(`
          *,
          job_template:job_templates(*, customer:customers(*)),
          employee:employees!job_sessions_assigned_to_fkey(*)
        `)
        .order('scheduled_date', { ascending: true })

      if (error) throw error
      const allSessions = (data || []) as JobSessionWithDetails[]
      setSessions(allSessions)

      // Load training status for CLAIMED sessions with assigned employees
      const claimedWithEmployee = allSessions.filter(s => s.status === 'CLAIMED' && s.assigned_to && s.job_template_id)
      if (claimedWithEmployee.length > 0) {
        const pairs = claimedWithEmployee.map(s => ({ employee_id: s.assigned_to!, template_id: s.job_template_id }))
        const { data: trainings } = await supabase
          .from('employee_job_training')
          .select('employee_id, job_template_id, is_trained, can_coach')
          .in('employee_id', [...new Set(pairs.map(p => p.employee_id))])
          .in('job_template_id', [...new Set(pairs.map(p => p.template_id))])

        const map: Record<string, { is_trained: boolean; can_coach: boolean }> = {}
        for (const s of claimedWithEmployee) {
          const match = trainings?.find(t => t.employee_id === s.assigned_to && t.job_template_id === s.job_template_id)
          map[s.id] = match ? { is_trained: match.is_trained, can_coach: match.can_coach } : { is_trained: false, can_coach: false }
        }
        setTrainingMap(map)
      }
    } catch (error) {
      console.error('Error loading sessions:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = async (session: JobSessionWithDetails) => {
    setActionLoading(true)
    try {
      const { error } = await supabase
        .from('job_sessions')
        .update({
          status: 'APPROVED',
          updated_at: new Date().toISOString()
        })
        .eq('id', session.id)

      if (error) throw error
      await loadSessions()
    } catch (error) {
      console.error('Error approving job:', error)
    } finally {
      setActionLoading(false)
    }
  }

  const handleRefuse = async () => {
    if (!selectedSession || !refuseReason.trim()) return

    setActionLoading(true)
    try {
      const { error } = await supabase
        .from('job_sessions')
        .update({
          status: 'REFUSED',
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedSession.id)

      if (error) throw error

      if (selectedSession.assigned_to) {
        await supabase
          .from('schedule_messages')
          .insert({
            job_session_id: selectedSession.id,
            employee_id: selectedSession.assigned_to,
            message: `Your claim was refused: ${refuseReason.trim()}`
          })
      }

      setShowRefuseDialog(false)
      setRefuseReason('')
      setSelectedSession(null)
      await loadSessions()
    } catch (error) {
      console.error('Error refusing job:', error)
    } finally {
      setActionLoading(false)
    }
  }

  const filteredSessions = sessions.filter(session => {
    switch (activeTab) {
      case 'confirm':
        return session.status === 'CLAIMED'
      case 'scheduled':
        return session.status === 'APPROVED'
      case 'completed':
        return session.status === 'COMPLETED' || session.status === 'EVALUATED'
      default:
        return false
    }
  })

  const tabs = [
    { id: 'confirm' as JobTab, label: t('To Confirm'), count: sessions.filter(s => s.status === 'CLAIMED').length },
    { id: 'scheduled' as JobTab, label: t('Scheduled'), count: sessions.filter(s => s.status === 'APPROVED').length },
    { id: 'completed' as JobTab, label: t('Completed'), count: sessions.filter(s => s.status === 'COMPLETED' || s.status === 'EVALUATED').length },
  ]

  const getStatusBadge = (status: JobSessionStatus) => {
    switch (status) {
      case 'CLAIMED':
        return <Badge className="bg-yellow-500/20 text-yellow-300 border border-yellow-500/30">{t('Pending')}</Badge>
      case 'APPROVED':
        return <Badge className="bg-blue-500/20 text-blue-300 border border-blue-500/30">{t('Scheduled')}</Badge>
      case 'COMPLETED':
        return <Badge className="bg-green-500/20 text-green-300 border border-green-500/30">{t('Completed')}</Badge>
      case 'EVALUATED':
        return <Badge className="bg-teal-500/20 text-teal-300 border border-teal-500/30">{t('Evaluated')}</Badge>
      default:
        return <Badge>{status}</Badge>
    }
  }

  if (loading) {
    return <LoadingSpinner />
  }

  return (
    <div className="space-y-4">
      {/* Sub-tabs */}
      <div className="flex gap-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-purple-600 text-white'
                : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-gray-300'
            }`}
          >
            {tab.label}
            {tab.count > 0 && (
              <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-xs ${
                activeTab === tab.id ? 'bg-white/20' : 'bg-white/10'
              }`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Sessions list */}
      <div className="space-y-3">
        {filteredSessions.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            {activeTab === 'confirm' && t('No jobs waiting for confirmation')}
            {activeTab === 'scheduled' && t('No scheduled jobs')}
            {activeTab === 'completed' && t('No completed jobs')}
          </div>
        ) : (
          filteredSessions.map((session) => (
            <div
              key={session.id}
              className="bg-white/5 rounded-xl p-4 border border-white/10"
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-white">
                    {session.job_template?.job_code}
                  </h3>
                  <p className="text-sm text-gray-400">
                    {session.job_template?.title}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {session.job_template?.customer && (
                    <span className="text-sm text-gray-400">{session.job_template.customer.full_name}</span>
                  )}
                  {getStatusBadge(session.status)}
                </div>
              </div>

              {/* Details */}
              <div className="space-y-2 text-sm text-gray-400 mb-3">
                {session.scheduled_date && (
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-gray-500" />
                    <span>{formatDate(session.scheduled_date)}</span>
                    {session.scheduled_time && (
                      <span>at {formatTime(session.scheduled_time)}</span>
                    )}
                  </div>
                )}
                {session.job_template?.address && (
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-gray-500" />
                    <span>{session.job_template.address}</span>
                  </div>
                )}
                {session.employee && (
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-gray-500" />
                    <span>{session.employee.full_name}</span>
                  </div>
                )}
              </div>

              {/* Training warning for untrained employees */}
              {activeTab === 'confirm' && session.status === 'CLAIMED' && trainingMap[session.id] && !trainingMap[session.id].is_trained && (
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 mb-3 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                    <span className="text-sm text-amber-300 font-medium">{t('This employee is not trained for this job')}</span>
                  </div>
                  <div className="flex items-center gap-2 ml-6">
                    <GraduationCap className="w-4 h-4 text-purple-400 shrink-0" />
                    <span className="text-xs text-purple-300">{t('Consider assigning a coach from the schedule view')}</span>
                  </div>
                </div>
              )}

              {/* Actions for CLAIMED status */}
              {activeTab === 'confirm' && session.status === 'CLAIMED' && (
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => handleApprove(session)}
                    disabled={actionLoading}
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                  >
                    <Check className="w-4 h-4 mr-1" />
                    {t('Approve')}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setSelectedSession(session)
                      setShowRefuseDialog(true)
                    }}
                    disabled={actionLoading}
                    className="flex-1 border-red-500/30 text-red-400 hover:bg-red-500/10"
                  >
                    <X className="w-4 h-4 mr-1" />
                    {t('Refuse')}
                  </Button>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Refuse Dialog */}
      <Dialog open={showRefuseDialog} onOpenChange={setShowRefuseDialog}>
        <DialogContent className="bg-gradient-to-br from-gray-900 via-gray-800 to-black border-white/20">
          <DialogHeader>
            <DialogTitle className="text-white">{t('Refuse Claim')}</DialogTitle>
            <DialogDescription className="text-gray-400">
              {t('Please provide a reason for refusing this claim. The employee will be notified.')}
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder={t('Reason for refusal...')}
            value={refuseReason}
            onChange={(e) => setRefuseReason(e.target.value)}
            rows={3}
            className="bg-white/5 border-white/20 text-white placeholder:text-gray-500"
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowRefuseDialog(false)
                setRefuseReason('')
                setSelectedSession(null)
              }}
              className="bg-white/10 border-white/30 text-white hover:bg-white/20"
            >
              {t('Cancel')}
            </Button>
            <Button
              onClick={handleRefuse}
              disabled={!refuseReason.trim() || actionLoading}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {t('Refuse Claim')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
