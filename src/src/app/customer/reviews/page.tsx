'use client'

import { toast } from 'sonner'
import { useEffect, useState, useRef } from 'react'
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
          employee:employees(
            id,
            full_name
          )
        `)
        .eq('job_template.customer_id', customer.id)
        .eq('status', 'COMPLETED')
        .order('completed_at', { ascending: false })

      if (error) throw error
      setPendingSessions((data as JobSessionWithDetails[]) || [])
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
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black p-4">
        <div className="max-w-4xl mx-auto">
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
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black p-4">
        <div className="max-w-4xl mx-auto">
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
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black p-4">
      <div className="max-w-4xl mx-auto">
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
                  <div className="bg-white/5 border border-white/10 rounded-xl p-8 text-center">
                    <p className="text-gray-400">{t('No completed jobs awaiting review')}</p>
                    <p className="text-sm text-gray-500 mt-1">
                      {t('Reviews will appear here after jobs are completed')}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {pendingSessions.map((session) => (
                      <div key={session.id} className="bg-white/5 border border-white/10 rounded-xl p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h3 className="font-semibold text-white">
                              {session.job_template?.job_code} - {session.job_template?.title}
                            </h3>
                            {session.employee && (
                              <p className="text-sm text-gray-300 mt-1">
                                {t('Employee')}: {session.employee.full_name}
                              </p>
                            )}
                            <p className="text-sm text-gray-400 mt-1">
                              {t('Completed')}: {formatDate(session.completed_at)}
                            </p>
                          </div>
                          <button
                            onClick={() => setSelectedSession(session)}
                            className="bg-blue-600 text-white hover:bg-blue-700 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
                          >
                            {t('Write Review')}
                          </button>
                        </div>
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
                  <div className="bg-white/5 border border-white/10 rounded-xl p-8 text-center">
                    <p className="text-gray-400">{t('No reviews submitted yet')}</p>
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
