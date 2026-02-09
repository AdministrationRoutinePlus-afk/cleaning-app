'use client'

import { useEffect, useState, useRef } from 'react'
import type { Employer } from '@/types/database'
import { createClient } from '@/lib/supabase/client'
import { JobsOverviewContent } from '@/components/employer/dashboard/JobsOverviewContent'
import { PayrollContent } from '@/components/employer/dashboard/PayrollContent'
import { EmployeeNotesContent } from '@/components/employer/dashboard/EmployeeNotesContent'
import { TodoAndNotesContent } from '@/components/employer/dashboard/TodoAndNotesContent'
import { AnalyticsSection } from '@/components/employer/AnalyticsSection'
import { DashboardSkeleton } from '@/components/skeletons/DashboardSkeleton'
import { Briefcase, DollarSign, FileText, ListTodo, BarChart3, Settings } from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'
import { useTranslation } from '@/lib/i18n/useTranslation'

type DashboardSection = 'jobs' | 'payroll' | 'notes' | 'todos' | 'analytics'

export default function EmployerDashboardPage() {
  const { t } = useTranslation()
  const [employer, setEmployer] = useState<Employer | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeSection, setActiveSection] = useState<DashboardSection>('jobs')
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
    loadEmployer()
    return () => { isMountedRef.current = false }
  }, [])

  const loadEmployer = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || !isMountedRef.current) return

      const { data, error } = await supabase
        .from('employers')
        .select('*')
        .eq('user_id', user.id)
        .single()

      if (error) throw error
      if (isMountedRef.current) {
        setEmployer(data)
      }
    } catch (error) {
      console.error('Error loading employer:', error)
      toast.error(t('Failed to load dashboard'))
    } finally {
      if (isMountedRef.current) {
        setLoading(false)
      }
    }
  }

  if (loading) {
    return <DashboardSkeleton />
  }

  if (!employer) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="bg-white/10 rounded-2xl p-8 text-center border border-white/20">
          <p className="text-gray-300">{t('Employer profile not found')}</p>
        </div>
      </div>
    )
  }

  const sections = [
    {
      id: 'jobs' as DashboardSection,
      label: t('Jobs Overview'),
      icon: Briefcase,
      color: 'purple',
    },
    {
      id: 'payroll' as DashboardSection,
      label: t('Payroll'),
      icon: DollarSign,
      color: 'green',
    },
    {
      id: 'notes' as DashboardSection,
      label: t('Employee Notes'),
      icon: FileText,
      color: 'blue',
    },
    {
      id: 'todos' as DashboardSection,
      label: t('To-Do & Notes'),
      icon: ListTodo,
      color: 'amber',
    },
    {
      id: 'analytics' as DashboardSection,
      label: t('Analytics'),
      icon: BarChart3,
      color: 'cyan',
    }
  ]

  const getGradient = (color: string, isActive: boolean) => {
    if (!isActive) return 'bg-white/5'
    switch (color) {
      case 'purple': return 'bg-gradient-to-br from-purple-600 to-purple-800'
      case 'blue': return 'bg-gradient-to-br from-blue-600 to-blue-800'
      case 'green': return 'bg-gradient-to-br from-green-600 to-green-800'
      case 'amber': return 'bg-gradient-to-br from-amber-600 to-amber-800'
      case 'cyan': return 'bg-gradient-to-br from-cyan-600 to-cyan-800'
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
      case 'cyan': return 'shadow-lg shadow-cyan-500/30'
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
      case 'cyan': return 'border-2 border-cyan-400'
      default: return 'border-2 border-purple-400'
    }
  }

  return (
    <div className="min-h-screen p-4 pb-24">
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-white">{t('Dashboard')}</h1>
          <Link
            href="/employer/settings"
            className="p-2 rounded-full bg-white/10 border border-white/20 hover:bg-white/20 transition-colors"
          >
            <Settings className="w-5 h-5 text-gray-300" />
          </Link>
        </div>

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
            <JobsOverviewContent employerId={employer.id} />
          )}
          {activeSection === 'payroll' && (
            <PayrollContent employerId={employer.id} />
          )}
          {activeSection === 'notes' && (
            <EmployeeNotesContent employerId={employer.id} />
          )}
          {activeSection === 'todos' && (
            <TodoAndNotesContent employerId={employer.id} />
          )}
          {activeSection === 'analytics' && (
            <AnalyticsSection employerId={employer.id} />
          )}
        </div>
      </div>
    </div>
  )
}
