'use client'

import { toast } from 'sonner'
import { useEffect, useState, useRef } from 'react'
import { User, Calendar, CheckCircle } from 'lucide-react'
import type { JobSession, Customer, Evaluation } from '@/types/database'
import { createClient } from '@/lib/supabase/client'
import { ReviewForm } from '@/components/customer/ReviewForm'
import { ReviewCard } from '@/components/customer/ReviewCard'
import { useTranslation } from '@/lib/i18n/useTranslation'

interface JobSessionWithDetails extends JobSession {
  job_template?: {
    job_code: string
    title: string
  }
  employee?: {
    id: string
    full_name: string
  }
}

interface EvaluationWithDetails extends Evaluation {
  job_session?: {
    job_template?: {
      job_code: string
      title: string
    }
  }
  employee?: {
    full_name: string
  }
}

export default function CustomerReviewsPage() {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState('pending')
  const [pendingSessions, setPendingSessions] = useState<JobSessionWithDetails[]>([])
  const [submittedReviews, setSubmittedReviews] = useState<EvaluationWithDetails[]>([])
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [selectedSession, setSelectedSession] = useState<JobSessionWithDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const supabaseRef = useRef(createClient())
  const supabase = supabaseRef.current
  const isMountedRef = useRef(true)

  useEffect(() => {
    isMountedRef.current = true
    loadCustomerData()
    return () => { isMountedRef.current = false }
  }, [])

  useEffect(() => {
    if (customer) {
      if (activeTab === 'pending') {
        loadPendingSessions()
      } else if (activeTab === 'submitted') {
        loadSubmittedReviews()
      }
    }
  }, [activeTab, customer])

  const loadCustomerData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || !isMountedRef.current) {
        if (user === null) toast.error(t('Please log in to view reviews'))
        return
      }

      // Get customer profile
      const { data: customerData, error: customerError } = await supabase
        .from('customers')
        .select('*')
        .eq('user_id', user.id)
        .single()

      if (customerError) throw customerError
      if (isMountedRef.current) {
        setCustomer(customerData)
      }
    } catch (error) {
      console.error('Error loading customer data:', error)
      if (isMountedRef.current) toast.error(t('Failed to load customer profile'))
    } finally {
      if (isMountedRef.current) {
        setLoading(false)
      }
    }
  }

  const loadPendingSessions = async () => {
    if (!customer) return

    try {
      const { data, error } = await supabase
        .from('job_sessions')
        .select(`
          *,
          job_template:job_templates!inner(
            job_code,
            title,
            customer_id
          ),
          employee:employees!job_sessions_assigned_to_fkey(
            id,
            full_name
          ),
          evaluations(id)
        `)
        .eq('job_template.customer_id', customer.id)
        .eq('status', 'COMPLETED')
        .order('completed_at', { ascending: false })

      if (error) throw error
      // Filter out sessions that already have an evaluation
      const pending = (data || []).filter((s: any) => !s.evaluations || s.evaluations.length === 0)
      setPendingSessions(pending as JobSessionWithDetails[])
    } catch (error) {
      console.error('Error loading pending sessions:', error)
      toast.error(t('Failed to load pending reviews'))
    }
  }

  const loadSubmittedReviews = async () => {
    if (!customer) return

    try {
      const { data, error } = await supabase
        .from('evaluations')
        .select(`
          *,
          job_session:job_sessions(
            job_template:job_templates(
              job_code,
              title
            )
          ),
          employee:employees(
            full_name
          )
        `)
        .eq('customer_id', customer.id)
        .order('submitted_at', { ascending: false })

      if (error) throw error
      setSubmittedReviews((data as EvaluationWithDetails[]) || [])
    } catch (error) {
      console.error('Error loading submitted reviews:', error)
      toast.error(t('Failed to load submitted reviews'))
    }
  }

  const handleReviewSuccess = () => {
    setSelectedSession(null)
    loadPendingSessions()
    loadSubmittedReviews()
  }

  const formatDate = (timestamp: string | null) => {
    if (!timestamp) return 'N/A'
    const date = new Date(timestamp)
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  if (loading) {
    return (
      <div className="p-4">
        <div className="max-w-lg mx-auto">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-white/10 rounded w-1/4"></div>
            <div className="h-12 bg-white/10 rounded"></div>
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-32 bg-white/10 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!customer) {
    return (
      <div className="p-4">
        <div className="max-w-lg mx-auto">
          <div className="bg-white/5 border border-white/10 rounded-xl p-6">
            <p className="text-center text-gray-400">
              {t('Customer profile not found. Please contact support.')}
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 pb-24">
      <div className="max-w-lg mx-auto">
        <h1 className="text-2xl font-bold text-white mb-6">{t('Reviews')}</h1>

        {selectedSession ? (
          <ReviewForm
            jobSession={selectedSession}
            customer={customer}
            onSuccess={handleReviewSuccess}
            onCancel={() => setSelectedSession(null)}
          />
        ) : (
          <div className="w-full">
            {/* Custom Tab Buttons */}
            <div className="flex gap-2 mb-6">
              <button
                onClick={() => setActiveTab('pending')}
                className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === 'pending'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-gray-200'
                }`}
              >
                {t('Awaiting Review')} ({pendingSessions.length})
              </button>
              <button
                onClick={() => setActiveTab('submitted')}
                className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === 'submitted'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-gray-200'
                }`}
              >
                {t('Submitted')} ({submittedReviews.length})
              </button>
            </div>

            {/* Pending Reviews Tab */}
            {activeTab === 'pending' && (
              <>
                {pendingSessions.length === 0 ? (
                  <div className="bg-gray-800/60 border border-white/20 rounded-xl p-8 text-center">
                    <p className="text-gray-300 font-medium">{t('No completed jobs awaiting review')}</p>
                    <p className="text-sm text-gray-500 mt-1">
                      {t('Reviews will appear here after jobs are completed')}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {pendingSessions.map((session) => (
                      <div key={session.id} className="bg-gray-800/60 border border-white/20 rounded-xl p-4">
                        {/* Header: code + status */}
                        <div className="flex items-center justify-between mb-2">
                          <span className="bg-gray-800/80 text-white font-bold text-xs px-3 py-1 rounded-full border border-white/30">
                            {session.full_job_code || session.job_template?.job_code}
                          </span>
                          <span className="bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs px-2.5 py-1 rounded-lg font-bold">
                            {t('Awaiting Review')}
                          </span>
                        </div>

                        {/* Title */}
                        <h3 className="text-lg font-bold text-white mb-3">
                          {session.job_template?.title}
                        </h3>

                        {/* Info rows */}
                        <div className="space-y-2 mb-4">
                          {session.employee && (
                            <div className="flex items-center gap-2">
                              <User className="w-4 h-4 text-purple-400" />
                              <span className="text-sm text-gray-400">{t('Done by')}</span>
                              <span className="text-sm font-semibold text-white">{session.employee.full_name}</span>
                            </div>
                          )}
                          {session.scheduled_date && (
                            <div className="flex items-center gap-2">
                              <Calendar className="w-4 h-4 text-green-400" />
                              <span className="text-sm text-gray-400">{t('Scheduled')}</span>
                              <span className="text-sm font-semibold text-white">{formatDate(session.scheduled_date)}</span>
                            </div>
                          )}
                          <div className="flex items-center gap-2">
                            <CheckCircle className="w-4 h-4 text-blue-400" />
                            <span className="text-sm text-gray-400">{t('Completed')}</span>
                            <span className="text-sm font-semibold text-white">{formatDate(session.completed_at)}</span>
                          </div>
                        </div>

                        <button
                          onClick={() => setSelectedSession(session)}
                          className="w-full bg-blue-600 text-white hover:bg-blue-700 py-3 rounded-xl text-sm font-bold transition-colors shadow-lg shadow-blue-500/20"
                        >
                          {t('Write Review')}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {/* Submitted Reviews Tab */}
            {activeTab === 'submitted' && (
              <>
                {submittedReviews.length === 0 ? (
                  <div className="bg-gray-800/60 border border-white/20 rounded-xl p-8 text-center">
                    <p className="text-gray-300 font-medium">{t('No reviews submitted yet')}</p>
                    <p className="text-sm text-gray-500 mt-1">
                      {t('Your submitted reviews will appear here')}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {submittedReviews.map((review) => (
                      <ReviewCard key={review.id} evaluation={review} />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
