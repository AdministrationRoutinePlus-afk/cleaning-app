'use client'

import { useEffect, useState, useRef } from 'react'
import type { Employee } from '@/types/database'
import { createClient } from '@/lib/supabase/client'
import { CurrentJobsContent } from '@/components/employee/CurrentJobsCard'
import { SpecificAvailabilityContent } from '@/components/employee/SpecificAvailabilityEditor'
import { QuickMessageContent } from '@/components/employee/QuickMessageCard'
import { NextDepositContent } from '@/components/employee/NextDepositCard'
import LoadingSpinner from '@/components/LoadingSpinner'
import { Clock, Calendar, MessageSquare, DollarSign } from 'lucide-react'
import { getDay } from 'date-fns'

type DashboardSection = 'jobs' | 'availability' | 'message' | 'deposit'

export default function EmployeeDashboardPage() {
  const [employee, setEmployee] = useState<Employee | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeSection, setActiveSection] = useState<DashboardSection>('jobs')
  const contentRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()

  const handleSectionChange = (sectionId: DashboardSection) => {
    setActiveSection(sectionId)
    // Smooth scroll to content after a brief delay to allow render
    setTimeout(() => {
      contentRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 100)
  }

  // Check if Next Deposit should be visible (Mon-Thu only)
  const dayOfWeek = getDay(new Date())
  const showNextDeposit = ![0, 5, 6].includes(dayOfWeek) // Hide on Fri, Sat, Sun

  useEffect(() => {
    loadEmployee()
  }, [])

  const loadEmployee = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data, error } = await supabase
        .from('employees')
        .select('*')
        .eq('user_id', user.id)
        .single()

      if (error) throw error
      setEmployee(data)
    } catch (error) {
      console.error('Error loading employee:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <LoadingSpinner fullScreen />
  }

  if (!employee) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="bg-white/10 rounded-2xl p-8 text-center border border-white/20">
          <p className="text-gray-300">Employee profile not found</p>
        </div>
      </div>
    )
  }

  const sections = [
    {
      id: 'jobs' as DashboardSection,
      label: 'Current Jobs',
      icon: Clock,
      color: 'purple',
      show: true
    },
    {
      id: 'availability' as DashboardSection,
      label: 'Availability',
      icon: Calendar,
      color: 'blue',
      show: true
    },
    {
      id: 'message' as DashboardSection,
      label: 'Message Boss',
      icon: MessageSquare,
      color: 'green',
      show: true
    },
    {
      id: 'deposit' as DashboardSection,
      label: 'Next Deposit',
      icon: DollarSign,
      color: 'amber',
      show: showNextDeposit
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
