'use client'

import { useState, useEffect, useRef } from 'react'
import type { Employee } from '@/types/database'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { AlertTriangle, Users, Check, Clock, Star, CheckCircle } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { toast } from 'sonner'
import { useTranslation } from '@/lib/i18n/useTranslation'

interface SplitJobDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  jobSessionId: string
  currentEmployeeId: string
  totalDurationMinutes: number | null
  onSuccess?: () => void
}

export function SplitJobDialog({
  open,
  onOpenChange,
  jobSessionId,
  currentEmployeeId,
  totalDurationMinutes,
  onSuccess,
}: SplitJobDialogProps) {
  const { t } = useTranslation()
  const [teammates, setTeammates] = useState<Employee[]>([])
  const [selectedPartnerId, setSelectedPartnerId] = useState<string | null>(null)
  const [partnerMinutes, setPartnerMinutes] = useState(0)
  const [loading, setLoading] = useState(false)
  const [loadingTeammates, setLoadingTeammates] = useState(false)
  const [trainingMap, setTrainingMap] = useState<Record<string, { is_trained: boolean; can_coach: boolean }>>({})
  const supabaseRef = useRef(createClient())
  const supabase = supabaseRef.current

  const totalMins = totalDurationMinutes || 60

  const formatMinutes = (mins: number) => {
    const h = Math.floor(mins / 60)
    const m = mins % 60
    if (h === 0) return `${m}m`
    if (m === 0) return `${h}h`
    return `${h}h${m}m`
  }

  useEffect(() => {
    if (open) {
      loadTeammates()
      setPartnerMinutes(Math.round(totalMins / 2))
    }
  }, [open])

  const loadTeammates = async () => {
    setLoadingTeammates(true)
    try {
      // Get job_template_id from this session
      const { data: session } = await supabase
        .from('job_sessions')
        .select('job_template_id')
        .eq('id', jobSessionId)
        .single()

      const { data, error } = await supabase
        .from('employees')
        .select('*')
        .eq('status', 'ACTIVE')
        .neq('id', currentEmployeeId)
        .order('full_name')

      if (error) throw error

      // Fetch training data for this job template
      let tMap: Record<string, { is_trained: boolean; can_coach: boolean }> = {}
      if (session?.job_template_id) {
        const { data: trainingData } = await supabase
          .from('employee_job_training')
          .select('employee_id, is_trained, can_coach')
          .eq('job_template_id', session.job_template_id)

        if (trainingData) {
          for (const rec of trainingData) {
            tMap[rec.employee_id] = { is_trained: rec.is_trained, can_coach: rec.can_coach }
          }
        }
      }
      setTrainingMap(tMap)

      // Sort: coaches first, then trained, then untrained
      const sorted = [...(data || [])].sort((a, b) => {
        const aT = tMap[a.id]
        const bT = tMap[b.id]
        const aScore = aT?.can_coach ? 2 : aT?.is_trained ? 1 : 0
        const bScore = bT?.can_coach ? 2 : bT?.is_trained ? 1 : 0
        return bScore - aScore
      })

      setTeammates(sorted)
    } catch (error) {
      console.error('Error loading teammates:', error)
      toast.error(t('Failed to load teammates'))
    } finally {
      setLoadingTeammates(false)
    }
  }

  const handleSubmit = async () => {
    if (!selectedPartnerId) {
      toast.error(t('Please select a teammate'))
      return
    }

    setLoading(true)
    try {
      const { error } = await supabase
        .from('job_splits')
        .insert({
          job_session_id: jobSessionId,
          requested_by: currentEmployeeId,
          partner_id: selectedPartnerId,
          partner_minutes: partnerMinutes,
          status: 'PENDING_PARTNER',
        })

      if (error) {
        if (error.code === '23505') {
          toast.error(t('A split request already exists for this job'))
        } else {
          throw error
        }
        return
      }

      toast.success(t('Split request sent! Waiting for your teammate to accept.'))
      onOpenChange(false)
      setSelectedPartnerId(null)
      onSuccess?.()
    } catch (error) {
      console.error('Error creating split request:', error)
      toast.error(t('Failed to send split request'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="bg-gradient-to-br from-gray-900 via-gray-800 to-black border-white/20 max-h-[90vh] overflow-y-auto">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-400" />
            {t('Split Job with Teammate')}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-gray-300">
            {t('Choose a teammate to split this job with. They will need to accept the request, and then the employer must approve it.')}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {/* Warning banner */}
        <div className="p-3 bg-amber-500/10 rounded-lg border border-amber-500/30">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-amber-300">
              {t('You are responsible for each other\'s work. You must confirm every step is done in your app, even if it wasn\'t your part of the job.')}
            </p>
          </div>
        </div>

        {/* Hours split */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="w-4 h-4 text-blue-400" />
            <p className="text-sm text-gray-400">{t('Hours to give')}</p>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-lg p-3 space-y-3">
            <input
              type="range"
              min={15}
              max={totalMins - 15}
              step={15}
              value={partnerMinutes}
              onChange={(e) => setPartnerMinutes(Number(e.target.value))}
              className="w-full accent-blue-500"
            />
            <div className="flex justify-between text-xs">
              <div className="text-center">
                <p className="text-gray-500">{t('You')}</p>
                <p className="text-white font-semibold">{formatMinutes(totalMins - partnerMinutes)}</p>
              </div>
              <div className="text-center">
                <p className="text-gray-500">{t('Total')}</p>
                <p className="text-gray-400 font-semibold">{formatMinutes(totalMins)}</p>
              </div>
              <div className="text-center">
                <p className="text-gray-500">{t('Teammate')}</p>
                <p className="text-blue-400 font-semibold">{formatMinutes(partnerMinutes)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Teammate picker */}
        <div className="space-y-2">
          <p className="text-sm text-gray-400">{t('Select teammate')}</p>
          <div className="bg-white/5 border border-white/10 rounded-lg p-2 max-h-48 overflow-y-auto space-y-1">
            {loadingTeammates ? (
              <p className="text-sm text-gray-500 p-2">{t('Loading...')}</p>
            ) : teammates.length === 0 ? (
              <p className="text-sm text-gray-500 p-2">{t('No teammates available')}</p>
            ) : (
              teammates.map((emp) => {
                const isSelected = selectedPartnerId === emp.id
                const training = trainingMap[emp.id]
                return (
                  <button
                    key={emp.id}
                    type="button"
                    onClick={() => setSelectedPartnerId(emp.id)}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-left transition-colors ${
                      isSelected
                        ? 'bg-blue-600/30 border border-blue-500/50 text-white'
                        : 'hover:bg-white/10 text-gray-300'
                    }`}
                  >
                    <span className="flex-1">{emp.full_name}</span>
                    {training?.can_coach && (
                      <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                        <Star className="w-2.5 h-2.5" />
                        {t('Coach')}
                      </span>
                    )}
                    {training?.is_trained && !training?.can_coach && (
                      <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full bg-green-500/20 text-green-300 border border-green-500/30">
                        <CheckCircle className="w-2.5 h-2.5" />
                        {t('Trained')}
                      </span>
                    )}
                    {isSelected && <Check className="w-4 h-4 text-blue-400" />}
                  </button>
                )
              })
            )}
          </div>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel
            disabled={loading}
            className="bg-white/10 text-white border border-white/20 hover:bg-white/20"
          >
            {t('Cancel')}
          </AlertDialogCancel>
          <Button
            onClick={handleSubmit}
            disabled={loading || !selectedPartnerId}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {loading ? t('Sending...') : t('Send Split Request')}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
