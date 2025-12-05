'use client'

import { useEffect, useState } from 'react'
import type { JobTemplate, JobStep, Customer, JobSession } from '@/types/database'
import { createClient } from '@/lib/supabase/client'
import { JobDetailCard } from '@/components/customer/JobDetailCard'
import { Card, CardContent } from '@/components/ui/card'

interface JobTemplateWithSteps extends JobTemplate {
  job_steps: JobStep[]
}

interface SessionCount {
  job_template_id: string
  upcoming: number
  completed: number
}

export default function CustomerJobsPage() {
  const [jobTemplates, setJobTemplates] = useState<JobTemplateWithSteps[]>([])
  const [sessionCounts, setSessionCounts] = useState<Record<string, SessionCount>>({})
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    loadCustomerData()
  }, [])

  useEffect(() => {
    if (customer) {
      loadJobTemplates()
    }
  }, [customer])

  const loadCustomerData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        alert('Please log in to view jobs')
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

  const loadJobTemplates = async () => {
    if (!customer) return

    try {
      // Get job templates for this customer
      const { data: templates, error: templatesError } = await supabase
        .from('job_templates')
        .select(`
          *,
          job_steps(*)
        `)
        .eq('customer_id', customer.id)
        .order('created_at', { ascending: false })

      if (templatesError) throw templatesError

      const templatesData = (templates as JobTemplateWithSteps[]) || []
      setJobTemplates(templatesData)

      // Get session counts for each template
      if (templatesData.length > 0) {
        const templateIds = templatesData.map((t) => t.id)

        const { data: sessions, error: sessionsError } = await supabase
          .from('job_sessions')
          .select('job_template_id, status')
          .in('job_template_id', templateIds)

        if (sessionsError) throw sessionsError

        // Count upcoming and completed sessions per template
        const counts: Record<string, SessionCount> = {}
        templatesData.forEach((template) => {
          counts[template.id] = {
            job_template_id: template.id,
            upcoming: 0,
            completed: 0
          }
        })

        sessions?.forEach((session) => {
          if (!counts[session.job_template_id]) {
            counts[session.job_template_id] = {
              job_template_id: session.job_template_id,
              upcoming: 0,
              completed: 0
            }
          }

          if (['OFFERED', 'CLAIMED', 'APPROVED', 'IN_PROGRESS'].includes(session.status)) {
            counts[session.job_template_id].upcoming++
          } else if (['COMPLETED', 'EVALUATED'].includes(session.status)) {
            counts[session.job_template_id].completed++
          }
        })

        setSessionCounts(counts)
      }
    } catch (error) {
      console.error('Error loading job templates:', error)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-4xl mx-auto">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 rounded w-1/4"></div>
            <div className="space-y-3">
              {[...Array(2)].map((_, i) => (
                <div key={i} className="h-64 bg-gray-200 rounded"></div>
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
        <h1 className="text-2xl font-bold text-gray-900 mb-6">My Jobs</h1>

        {jobTemplates.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <p className="text-gray-500">No jobs found</p>
              <p className="text-sm text-gray-400 mt-1">
                Jobs assigned to you will appear here
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {jobTemplates.map((template) => (
              <JobDetailCard
                key={template.id}
                jobTemplate={template}
                upcomingSessions={sessionCounts[template.id]?.upcoming || 0}
                completedSessions={sessionCounts[template.id]?.completed || 0}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
