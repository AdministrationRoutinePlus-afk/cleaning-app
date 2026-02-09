'use client'

import { useEffect, useState, useRef } from 'react'
import type { Customer, Employer } from '@/types/database'
import { createClient } from '@/lib/supabase/client'
import { DashboardJobsContent } from '@/components/customer/DashboardJobsContent'
import { DashboardReviewsContent } from '@/components/customer/DashboardReviewsContent'
import { DashboardHistoryContent } from '@/components/customer/DashboardHistoryContent'
import { CustomerChat } from '@/components/customer/CustomerChat'
import LoadingSpinner from '@/components/LoadingSpinner'
import { Briefcase, Star, MessageSquare, Clock, CalendarCheck, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import { useTranslation } from '@/lib/i18n/useTranslation'

interface DashboardSummary {
  upcomingSessions: number
  pendingReviews: number
}

type DashboardSection = 'jobs' | 'reviews' | 'messages' | 'history'

export default function CustomerDashboardPage() {
  const { t } = useTranslation()
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [employer, setEmployer] = useState<Employer | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeSection, setActiveSection] = useState<DashboardSection>('jobs')
  const [summary, setSummary] = useState<DashboardSummary>({ upcomingSessions: 0, pendingReviews: 0 })
  const contentRef = useRef<HTMLDivElement>(null)
  const supabaseRef = useRef(createClient())
  const supabase = supabaseRef.current
  const isMountedRef = useRef(true)

  const handleSectionChange = (sectionId: DashboardSection) => {
    setActiveSection(sectionId)
    setTimeout(() => {
      contentRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 100)
  }

  useEffect(() => {
    isMountedRef.current = true
    loadCustomer()
    return () => { isMountedRef.current = false }
  }, [])

  const loadCustomer = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || !isMountedRef.current) return

      const { data: customerData, error: customerError } = await supabase
        .from('customers')
        .select('*')
        .eq('user_id', user.id)
        .single()

      if (customerError) throw customerError
      if (!isMountedRef.current) return
      setCustomer(customerData)

      // Load employer
      const { data: employerData } = await supabase
        .from('employers')
        .select('*')
        .eq('id', customerData.created_by)
        .maybeSingle()

      if (isMountedRef.current && employerData) {
        setEmployer(employerData)
      }

      // Load summary counts
      loadSummary(customerData.id)
    } catch (error) {
      console.error('Error loading customer:', error)
      toast.error(t('Failed to load dashboard'))
    } finally {
      if (isMountedRef.current) {
        setLoading(false)
      }
    }
  }

  const loadSummary = async (customerId: string) => {
    try {
      // Get customer's job template IDs
      const { data: templates } = await supabase
        .from('job_templates')
        .select('id')
        .eq('customer_id', customerId)

      if (!templates || templates.length === 0) return

      const templateIds = templates.map((t) => t.id)

      // Count upcoming sessions
      const { count: upcomingCount } = await supabase
        .from('job_sessions')
        .select('id', { count: 'exact', head: true })
        .in('job_template_id', templateIds)
        .in('status', ['OFFERED', 'CLAIMED', 'APPROVED', 'IN_PROGRESS'])
        .gte('scheduled_date', new Date().toISOString().split('T')[0])

      // Count pending reviews (COMPLETED sessions that have no evaluation yet)
      const { data: completedSessions } = await supabase
        .from('job_sessions')
        .select('id, evaluations(id)')
        .in('job_template_id', templateIds)
        .eq('status', 'COMPLETED')

      const pendingCount = (completedSessions || []).filter(
        (s: any) => !s.evaluations || s.evaluations.length === 0
      ).length

      if (isMountedRef.current) {
        setSummary({
          upcomingSessions: upcomingCount || 0,
          pendingReviews: pendingCount,
        })
      }
    } catch (error) {
      console.error('Error loading summary:', error)
    }
  }

  if (loading) {
    return <LoadingSpinner fullScreen />
  }

  if (!customer) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="bg-white/10 rounded-2xl p-8 text-center border border-white/20">
          <p className="text-gray-300">{t('Customer profile not found. Please contact support.')}</p>
        </div>
      </div>
    )
  }

  const sections = [
    {
      id: 'jobs' as DashboardSection,
      label: t('My Jobs'),
      icon: Briefcase,
      color: 'purple',
    },
    {
      id: 'reviews' as DashboardSection,
      label: t('Reviews'),
      icon: Star,
      color: 'amber',
    },
    {
      id: 'messages' as DashboardSection,
      label: t('Messages'),
      icon: MessageSquare,
      color: 'green',
    },
    {
      id: 'history' as DashboardSection,
      label: t('History'),
      icon: Clock,
      color: 'blue',
    },
  ]

  const getGradient = (color: string, isActive: boolean) => {
    if (!isActive) return 'bg-white/5'
    switch (color) {
      case 'purple': return 'bg-gradient-to-br from-purple-600 to-purple-800'
      case 'blue': return 'bg-gradient-to-br from-blue-600 to-blue-800'
      case 'green': return 'bg-gradient-to-br from-green-600 to-green-800'
      case 'amber': return 'bg-gradient-to-br from-amber-600 to-amber-800'
      default: return 'bg-gradient-to-br from-purple-600 to-purple-800'
    }
  }

  const getShadow = (color: string, isActive: boolean) => {
    if (!isActive) return ''
    switch (color) {
      case 'purple': return 'shadow-lg shadow-purple-500/30'
      case 'blue': return 'shadow-lg shadow-blue-500/30'
      case 'green': return 'shadow-lg shadow-green-500/30'
      case 'amber': return 'shadow-lg shadow-amber-500/30'
      default: return 'shadow-lg shadow-purple-500/30'
    }
  }

  const getBorder = (color: string, isActive: boolean) => {
    if (!isActive) return 'border-2 border-white/10 hover:border-white/20'
    switch (color) {
      case 'purple': return 'border-2 border-purple-400'
      case 'blue': return 'border-2 border-blue-400'
      case 'green': return 'border-2 border-green-400'
      case 'amber': return 'border-2 border-amber-400'
      default: return 'border-2 border-purple-400'
    }
  }

  return (
    <div className="min-h-screen p-4 pb-24">
      <div className="max-w-lg mx-auto">
        {/* Summary Banner */}
        {(summary.upcomingSessions > 0 || summary.pendingReviews > 0) && (
          <div className="grid grid-cols-2 gap-3 mb-6">
            <div className="bg-gradient-to-br from-blue-900/40 to-blue-800/20 rounded-xl p-4 text-center border border-blue-500/30">
              <div className="flex items-center justify-center gap-2 mb-1.5">
                <CalendarCheck className="w-5 h-5 text-blue-400" />
                <p className="text-xs uppercase font-bold tracking-wide text-blue-300">{t('Upcoming')}</p>
              </div>
              <p className="text-3xl font-bold text-white">{summary.upcomingSessions}</p>
              <p className="text-sm text-gray-400 mt-1">{t('sessions')}</p>
            </div>
            <div className="bg-gradient-to-br from-amber-900/40 to-amber-800/20 rounded-xl p-4 text-center border border-amber-500/30">
              <div className="flex items-center justify-center gap-2 mb-1.5">
                <AlertCircle className="w-5 h-5 text-amber-400" />
                <p className="text-xs uppercase font-bold tracking-wide text-amber-300">{t('Pending Reviews')}</p>
              </div>
              <p className="text-3xl font-bold text-white">{summary.pendingReviews}</p>
              <p className="text-sm text-gray-400 mt-1">{t('to review')}</p>
            </div>
          </div>
        )}

        {/* Section Selector - 2x2 Grid */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          {sections.map((section) => {
            const Icon = section.icon
            const isActive = activeSection === section.id

            return (
              <button
                key={section.id}
                onClick={() => handleSectionChange(section.id)}
                className={`aspect-square flex flex-col items-center justify-center gap-3 rounded-2xl font-bold text-base transition-all ${
                  getGradient(section.color, isActive)
                } ${getShadow(section.color, isActive)} ${getBorder(section.color, isActive)} ${
                  isActive ? 'text-white' : 'text-gray-300 hover:bg-white/10'
                }`}
              >
                <Icon className={`w-10 h-10 ${isActive ? 'text-white' : 'text-gray-400'}`} />
                <span className="text-center px-2">{section.label}</span>
              </button>
            )
          })}
        </div>

        {/* Content Section */}
        <div ref={contentRef} className="bg-gradient-to-br from-gray-900 via-gray-800 to-black rounded-2xl border border-white/20 p-4 scroll-mt-4">
          {activeSection === 'jobs' && (
            <DashboardJobsContent customerId={customer.id} />
          )}
          {activeSection === 'reviews' && (
            <DashboardReviewsContent customerId={customer.id} customer={customer} />
          )}
          {activeSection === 'messages' && (
            customer && employer ? (
              <CustomerChat customer={customer} employer={employer} />
            ) : (
              <div className="text-center text-gray-400 py-8">
                {t('Unable to load messaging. Please contact support.')}
              </div>
            )
          )}
          {activeSection === 'history' && (
            <DashboardHistoryContent
              customerId={customer.id}
              onWriteReview={() => handleSectionChange('reviews')}
              onContactUs={() => handleSectionChange('messages')}
            />
          )}
        </div>
      </div>
    </div>
  )
}
