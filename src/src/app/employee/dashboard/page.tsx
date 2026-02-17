'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import type { Employee } from '@/types/database'
import { createClient } from '@/lib/supabase/client'
import { CurrentJobsCard } from '@/components/employee/CurrentJobsCard'
import { SpecificAvailabilityEditor } from '@/components/employee/SpecificAvailabilityEditor'
import { QuickMessageCard } from '@/components/employee/QuickMessageCard'
import { NextDepositCard } from '@/components/employee/NextDepositCard'
import { OnboardingWizard } from '@/components/employee/OnboardingWizard'
import LoadingSpinner from '@/components/LoadingSpinner'
import { Clock, Calendar, MessageSquare, DollarSign, ShoppingBag } from 'lucide-react'
import { toast } from 'sonner'
import { useTranslation } from '@/lib/i18n/useTranslation'

type DashboardSection = 'jobs' | 'availability' | 'message' | 'deposit'

export default function EmployeeDashboardPage() {
  const { t } = useTranslation()
  const router = useRouter()
  const [employee, setEmployee] = useState<Employee | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeSection, setActiveSection] = useState<DashboardSection>('jobs')
  const [offeredCount, setOfferedCount] = useState(0)
  const contentRef = useRef<HTMLDivElement>(null)
  const supabaseRef = useRef(createClient())
  const supabase = supabaseRef.current
  const isMountedRef = useRef(true)

  useEffect(() => {
    isMountedRef.current = true
    loadEmployee()
    return () => { isMountedRef.current = false }
  }, [])

  const loadEmployee = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || !isMountedRef.current) return

      const { data, error } = await supabase
        .from('employees')
        .select('*')
        .eq('user_id', user.id)
        .single()

      if (error) throw error
      if (isMountedRef.current) {
        setEmployee(data)
        loadOfferedCount(data.id)
      }
    } catch (error) {
      console.error('Error loading employee:', error)
      toast.error(t('Failed to load dashboard'))
    } finally {
      if (isMountedRef.current) {
        setLoading(false)
      }
    }
  }

  const loadOfferedCount = async (empId: string) => {
    try {
      const { count, error } = await supabase
        .from('job_sessions')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'OFFERED')
        .eq('assigned_to', empId)

      if (error) throw error
      if (isMountedRef.current) {
        setOfferedCount(count || 0)
      }
    } catch (error) {
      console.error('Error loading offered count:', error)
    }
  }

  const handleSectionChange = (sectionId: DashboardSection) => {
    setActiveSection(sectionId)
    setTimeout(() => {
      contentRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 100)
  }

  if (loading) {
    return <LoadingSpinner fullScreen />
  }

  if (!employee) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="bg-white/10 rounded-2xl p-8 text-center border border-white/20">
          <p className="text-gray-300">{t('Employee profile not found')}</p>
        </div>
      </div>
    )
  }

  const sections = [
    {
      id: 'jobs' as DashboardSection,
      label: t('Current Jobs'),
      icon: Clock,
      color: 'purple',
    },
    {
      id: 'availability' as DashboardSection,
      label: t('Schedule'),
      icon: Calendar,
      color: 'blue',
    },
    {
      id: 'message' as DashboardSection,
      label: t('Message Boss'),
      icon: MessageSquare,
      color: 'green',
    },
    {
      id: 'deposit' as DashboardSection,
      label: t('Next Deposit'),
      icon: DollarSign,
      color: 'amber',
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
        {/* Onboarding Wizard */}
        <OnboardingWizard employeeId={employee.id} />

        {/* Find Jobs banner */}
        {offeredCount > 0 && (
          <button
            onClick={() => router.push('/employee/jobs')}
            className="w-full bg-white/5 rounded-xl border border-green-500/30 p-3 hover:border-green-500/50 transition-colors text-left mb-4"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-green-500/20 rounded-full flex items-center justify-center">
                <ShoppingBag className="w-4 h-4 text-green-400" />
              </div>
              <div>
                <p className="font-semibold text-white text-sm">
                  {offeredCount} {offeredCount === 1 ? t('new job available') : t('new jobs available')}
                </p>
                <p className="text-xs text-gray-400">{t('Browse available jobs')}</p>
              </div>
            </div>
          </button>
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
        <div ref={contentRef} className="bg-white/10 rounded-2xl border border-white/20 p-4 scroll-mt-4">
          {activeSection === 'jobs' && (
            <CurrentJobsCard employeeId={employee.id} />
          )}
          {activeSection === 'availability' && (
            <SpecificAvailabilityEditor employeeId={employee.id} />
          )}
          {activeSection === 'message' && (
            <QuickMessageCard />
          )}
          {activeSection === 'deposit' && (
            <NextDepositCard employeeId={employee.id} />
          )}
        </div>
      </div>
    </div>
  )
}
