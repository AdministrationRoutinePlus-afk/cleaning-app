'use client'

import { useEffect, useState, useRef } from 'react'
import type { Employee } from '@/types/database'
import { createClient } from '@/lib/supabase/client'
import { CurrentJobsContent } from '@/components/employee/CurrentJobsCard'
import { SpecificAvailabilityContent } from '@/components/employee/SpecificAvailabilityEditor'
import { QuickMessageContent } from '@/components/employee/QuickMessageCard'
import { NextDepositContent } from '@/components/employee/NextDepositCard'
import LoadingSpinner from '@/components/LoadingSpinner'
import { Clock, Calendar, MessageSquare, DollarSign, TrendingUp, Briefcase } from 'lucide-react'
import { toast } from 'sonner'
import { useTranslation } from '@/lib/i18n/useTranslation'

interface EarningsSummary {
  monthTotal: number
  allTimeTotal: number
  monthJobCount: number
}

type DashboardSection = 'jobs' | 'availability' | 'message' | 'deposit'

export default function EmployeeDashboardPage() {
  const { t } = useTranslation()
  const [employee, setEmployee] = useState<Employee | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeSection, setActiveSection] = useState<DashboardSection>('jobs')
  const [earnings, setEarnings] = useState<EarningsSummary | null>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const supabaseRef = useRef(createClient())
  const supabase = supabaseRef.current
  const isMountedRef = useRef(true)

  const handleSectionChange = (sectionId: DashboardSection) => {
    setActiveSection(sectionId)
    // Smooth scroll to content after a brief delay to allow render
    setTimeout(() => {
      contentRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 100)
  }

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
        loadEarnings(data.id)
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

  const loadEarnings = async (employeeId: string) => {
    try {
      // Get all completed/evaluated sessions with their job template price info
      let { data: sessions, error } = await supabase
        .from('job_sessions')
        .select(`
          id,
          status,
          completed_at,
          price_override,
          job_template:job_templates(price_per_hour, duration_minutes)
        `)
        .or(`assigned_to.eq.${employeeId},split_with.eq.${employeeId}`)
        .in('status', ['COMPLETED', 'EVALUATED'])

      // Fallback if split_with column doesn't exist yet
      if (error) {
        const fallback = await supabase
          .from('job_sessions')
          .select(`
            id,
            status,
            completed_at,
            price_override,
            job_template:job_templates(price_per_hour, duration_minutes)
          `)
          .eq('assigned_to', employeeId)
          .in('status', ['COMPLETED', 'EVALUATED'])

        if (fallback.error) throw fallback.error
        sessions = fallback.data
      }
      if (!isMountedRef.current) return

      const now = new Date()
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

      let monthTotal = 0
      let allTimeTotal = 0
      let monthJobCount = 0

      ;(sessions || []).forEach((s: any) => {
        const template = s.job_template
        const pricePerHour = s.price_override ?? template?.price_per_hour ?? 0
        const durationHours = (template?.duration_minutes ?? 0) / 60
        const sessionEarning = pricePerHour * durationHours

        allTimeTotal += sessionEarning

        if (s.completed_at && s.completed_at >= monthStart) {
          monthTotal += sessionEarning
          monthJobCount++
        }
      })

      if (isMountedRef.current) {
        setEarnings({ monthTotal, allTimeTotal, monthJobCount })
      }
    } catch (error) {
      console.error('Error loading earnings:', error)
    }
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
      show: true
    },
    {
      id: 'availability' as DashboardSection,
      label: t('Availability'),
      icon: Calendar,
      color: 'blue',
      show: true
    },
    {
      id: 'message' as DashboardSection,
      label: t('Message Boss'),
      icon: MessageSquare,
      color: 'green',
      show: true
    },
    {
      id: 'deposit' as DashboardSection,
      label: t('Next Deposit'),
      icon: DollarSign,
      color: 'amber',
      show: true
    }
  ].filter(s => s.show)

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
        {/* Earnings Summary Card (#8) */}
        {earnings && (
          <div className="bg-white/5 rounded-xl border border-white/10 p-4 mb-6">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="w-5 h-5 text-green-400" />
              <h3 className="text-base font-semibold text-white">{t('Earnings Summary')}</h3>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-white/5 rounded-lg p-3 text-center">
                <p className="text-xs text-gray-400 mb-1">{t('This Month')}</p>
                <p className="text-lg font-bold text-green-400">${earnings.monthTotal.toFixed(2)}</p>
              </div>
              <div className="bg-white/5 rounded-lg p-3 text-center">
                <p className="text-xs text-gray-400 mb-1">{t('All Time')}</p>
                <p className="text-lg font-bold text-white">${earnings.allTimeTotal.toFixed(2)}</p>
              </div>
              <div className="bg-white/5 rounded-lg p-3 text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <Briefcase className="w-3 h-3 text-gray-400" />
                  <p className="text-xs text-gray-400">{t('This Month')}</p>
                </div>
                <p className="text-lg font-bold text-blue-400">{earnings.monthJobCount}</p>
                <p className="text-xs text-gray-500">{t('jobs')}</p>
              </div>
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
        <div ref={contentRef} className="bg-white/10 rounded-2xl border border-white/20 p-4 scroll-mt-4">
          {activeSection === 'jobs' && (
            <CurrentJobsContent employeeId={employee.id} />
          )}
          {activeSection === 'availability' && (
            <SpecificAvailabilityContent employeeId={employee.id} />
          )}
          {activeSection === 'message' && (
            <QuickMessageContent />
          )}
          {activeSection === 'deposit' && (
            <NextDepositContent employeeId={employee.id} />
          )}
        </div>
      </div>
    </div>
  )
}
