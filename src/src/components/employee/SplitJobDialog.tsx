'use client'

import { useState, useEffect, useRef } from 'react'
import type { Employee } from '@/types/database'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { AlertTriangle, Users, Check } from 'lucide-react'
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
  onSuccess?: () => void
}

export function SplitJobDialog({
  open,
  onOpenChange,
  jobSessionId,
  currentEmployeeId,
  onSuccess,
}: SplitJobDialogProps) {
  const { t } = useTranslation()
  const [teammates, setTeammates] = useState<Employee[]>([])
  const [selectedPartnerId, setSelectedPartnerId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadingTeammates, setLoadingTeammates] = useState(false)
  const supabaseRef = useRef(createClient())
  const supabase = supabaseRef.current

  useEffect(() => {
    if (open) {
      loadTeammates()
    }
  }, [open])

  const loadTeammates = async () => {
    setLoadingTeammates(true)
    try {
      const { data, error } = await supabase
        .from('employees')
        .select('*')
        .eq('status', 'ACTIVE')
        .neq('id', currentEmployeeId)
        .order('full_name')

      if (error) throw error
      setTeammates(data || [])
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
