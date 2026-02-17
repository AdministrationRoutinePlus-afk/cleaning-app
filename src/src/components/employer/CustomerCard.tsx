'use client'

import { useState, useRef } from 'react'
import type { Customer, JobTemplate } from '@/types/database'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Building2, Edit2, Eye, EyeOff, ShieldOff, Briefcase, ChevronRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useTranslation } from '@/lib/i18n/useTranslation'

interface CustomerCardProps {
  customer: Customer
  onEdit?: (customer: Customer) => void
  onDeactivate?: (customer: Customer) => void
  onBlock?: (customer: Customer) => void
  onViewJobs?: (customer: Customer) => void
}

export function CustomerCard({
  customer,
  onEdit,
  onDeactivate,
  onBlock,
  onViewJobs
}: CustomerCardProps) {
  const { t } = useTranslation()
  const [showJobs, setShowJobs] = useState(false)
  const [jobs, setJobs] = useState<JobTemplate[]>([])
  const [loadingJobs, setLoadingJobs] = useState(false)
  const [jobsFetched, setJobsFetched] = useState(false)
  const supabaseRef = useRef(createClient())

  const getStatusBadge = (status: Customer['status']) => {
    switch (status) {
      case 'ACTIVE':
        return <Badge className="bg-green-500/20 text-green-300 border border-green-500/30">{t('ACTIVE')}</Badge>
      case 'INACTIVE':
        return <Badge className="bg-gray-500/20 text-gray-300 border border-gray-500/30">{t('INACTIVE')}</Badge>
      case 'BLOCKED':
        return <Badge className="bg-red-500/20 text-red-300 border border-red-500/30">{t('BLOCKED')}</Badge>
      default:
        return <Badge className="bg-gray-500/20 text-gray-300 border border-gray-500/30">{status}</Badge>
    }
  }

  const handleToggleJobs = async () => {
    if (showJobs) {
      setShowJobs(false)
      return
    }

    setShowJobs(true)

    if (!jobsFetched) {
      setLoadingJobs(true)
      try {
        const { data } = await supabaseRef.current
          .from('job_templates')
          .select('*')
          .eq('customer_id', customer.id)
          .order('job_code')

        setJobs((data || []) as JobTemplate[])
        setJobsFetched(true)
      } catch (error) {
        console.error('Error fetching jobs:', error)
      } finally {
        setLoadingJobs(false)
      }
    }
  }

  return (
    <div className="bg-gradient-to-br from-gray-900 via-gray-800 to-black rounded-xl border border-white/20 overflow-hidden w-full">
      <div className="p-4 pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3 flex-1">
            <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center border border-purple-500/30">
              <Building2 className="w-5 h-5 text-purple-400" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="inline-block bg-gray-800/80 text-white font-bold text-xs px-3 py-1.5 rounded-full shadow-lg border border-white/30 font-mono">
                  {customer.customer_code}
                </span>
                {getStatusBadge(customer.status)}
              </div>
              <h3 className="font-bold text-lg text-white">{customer.full_name}</h3>
              <p className="text-sm text-gray-400">{customer.email}</p>
            </div>
          </div>
        </div>
      </div>
      <div className="px-4 pb-3 space-y-3">
        {(customer.phone || customer.address) && (
          <div className="bg-gray-800/60 rounded-xl p-3 border border-white/20 space-y-1">
            {customer.phone && <p className="text-sm text-gray-300">{t('Phone:')} {customer.phone}</p>}
            {customer.address && <p className="text-sm text-gray-300">{t('Address:')} {customer.address}</p>}
          </div>
        )}

        <div className="flex flex-wrap gap-2 pt-2">
          {onEdit && (
            <Button
              size="sm"
              onClick={() => onEdit(customer)}
              className="flex-1 bg-white/10 text-white border border-white/20 hover:bg-white/20"
            >
              <Edit2 className="w-3 h-3 mr-1" />
              {t('Edit')}
            </Button>
          )}
          {customer.status === 'ACTIVE' && onDeactivate && (
            <Button
              size="sm"
              onClick={() => onDeactivate(customer)}
              className="flex-1 bg-white/10 text-white border border-white/20 hover:bg-white/20"
            >
              {t('Deactivate')}
            </Button>
          )}
          {customer.status !== 'BLOCKED' && onBlock && (
            <Button
              size="sm"
              onClick={() => onBlock(customer)}
              className="flex-1 bg-red-500/20 text-red-300 border border-red-500/30 hover:bg-red-500/30"
            >
              <ShieldOff className="w-3 h-3 mr-1" />
              {t('Block')}
            </Button>
          )}
        </div>

        {/* View Jobs toggle button */}
        <Button
          size="sm"
          onClick={handleToggleJobs}
          className={`w-full transition-all ${
            showJobs
              ? 'bg-blue-600/30 text-blue-200 border border-blue-500/40'
              : 'bg-blue-500/20 text-blue-300 border border-blue-500/30 hover:bg-blue-500/30'
          }`}
        >
          {showJobs ? <EyeOff className="w-3 h-3 mr-1" /> : <Eye className="w-3 h-3 mr-1" />}
          {t('View Jobs')}
        </Button>

        {/* Inline jobs list */}
        {showJobs && (
          <div className="space-y-2 pt-1">
            {loadingJobs ? (
              <div className="py-4 text-center">
                <div className="w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin mx-auto" />
              </div>
            ) : jobs.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-3">{t('No jobs found')}</p>
            ) : (
              jobs.map(job => (
                <button
                  key={job.id}
                  onClick={() => onViewJobs?.(customer)}
                  className="w-full text-left bg-white/5 rounded-lg p-3 border border-white/10 hover:bg-white/10 transition-all"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <Briefcase className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
                      <span className="font-mono text-xs font-semibold text-gray-400">{job.job_code}</span>
                      <Badge className={`text-[10px] px-1.5 py-0 ${
                        job.status === 'ACTIVE'
                          ? 'bg-green-500/20 text-green-300 border border-green-500/30'
                          : 'bg-gray-500/20 text-gray-300 border border-gray-500/30'
                      }`}>
                        {t(job.status)}
                      </Badge>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />
                  </div>
                  <p className="text-sm text-white font-medium mt-1 truncate">{job.title}</p>
                  <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                    {job.duration_minutes && (
                      <span>{Math.floor(job.duration_minutes / 60)}h{job.duration_minutes % 60 > 0 ? `${job.duration_minutes % 60}m` : ''}</span>
                    )}
                    {job.price_per_hour && (
                      <span className="text-green-400">${job.price_per_hour}/hr</span>
                    )}
                    {job.is_recurring && (
                      <span className="text-purple-400">{t('Recurring')}</span>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}
