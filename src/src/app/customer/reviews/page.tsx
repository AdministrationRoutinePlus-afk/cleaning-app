'use client'

import { useEffect, useState } from 'react'
import type { JobSession, Customer, Evaluation } from '@/types/database'
import { createClient } from '@/lib/supabase/client'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { ReviewForm } from '@/components/customer/ReviewForm'
import { ReviewCard } from '@/components/customer/ReviewCard'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

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
  const [activeTab, setActiveTab] = useState('pending')
  const [pendingSessions, setPendingSessions] = useState<JobSessionWithDetails[]>([])
  const [submittedReviews, setSubmittedReviews] = useState<EvaluationWithDetails[]>([])
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [selectedSession, setSelectedSession] = useState<JobSessionWithDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    loadCustomerData()
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
      if (!user) {
        alert('Please log in to view reviews')
        return
      }

      // Get customer profile
      const { data: customerData, error: customerError } = await supabase
        .from('customers')
        .select('*')
        .eq('user_id', user.id)
        .single()

      if (customerError) throw customerError
      setCustomer(customerData)
    } catch (error) {
      console.error('Error loading customer data:', error)
      alert('Failed to load customer profile')
    } finally {
      setLoading(false)
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
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-4xl mx-auto">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 rounded w-1/4"></div>
            <div className="h-12 bg-gray-200 rounded"></div>
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-32 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!customer) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-4xl mx-auto">
          <Card>
            <CardContent className="p-6">
              <p className="text-center text-gray-500">
                Customer profile not found. Please contact support.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Reviews</h1>

        {selectedSession ? (
          <ReviewForm
            jobSession={selectedSession}
            customer={customer}
            onSuccess={handleReviewSuccess}
            onCancel={() => setSelectedSession(null)}
          />
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="w-full grid grid-cols-2 mb-6">
              <TabsTrigger value="pending">
                Awaiting Review ({pendingSessions.length})
              </TabsTrigger>
              <TabsTrigger value="submitted">
                Submitted ({submittedReviews.length})
              </TabsTrigger>
            </TabsList>

            {/* Pending Reviews Tab */}
            <TabsContent value="pending">
              {pendingSessions.length === 0 ? (
                <Card>
                  <CardContent className="p-8 text-center">
                    <p className="text-gray-500">No completed jobs awaiting review</p>
                    <p className="text-sm text-gray-400 mt-1">
                      Reviews will appear here after jobs are completed
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">
                  {pendingSessions.map((session) => (
                    <Card key={session.id}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h3 className="font-semibold text-gray-900">
                              {session.job_template?.job_code} - {session.job_template?.title}
                            </h3>
                            {session.employee && (
                              <p className="text-sm text-gray-600 mt-1">
                                Employee: {session.employee.full_name}
                              </p>
                            )}
                            <p className="text-sm text-gray-500 mt-1">
                              Completed: {formatDate(session.completed_at)}
                            </p>
                          </div>
                          <Button
                            onClick={() => setSelectedSession(session)}
                            size="sm"
                          >
                            Write Review
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* Submitted Reviews Tab */}
            <TabsContent value="submitted">
              {submittedReviews.length === 0 ? (
                <Card>
                  <CardContent className="p-8 text-center">
                    <p className="text-gray-500">No reviews submitted yet</p>
                    <p className="text-sm text-gray-400 mt-1">
                      Your submitted reviews will appear here
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">
                  {submittedReviews.map((review) => (
                    <ReviewCard key={review.id} evaluation={review} />
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  )
}
