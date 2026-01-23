'use client'

import { useEffect, useState } from 'react'
import type { Employee } from '@/types/database'
import { createClient } from '@/lib/supabase/client'
import { DashboardDrawer } from '@/components/employee/DashboardDrawer'
import { CurrentJobsContent } from '@/components/employee/CurrentJobsCard'
import { SpecificAvailabilityContent } from '@/components/employee/SpecificAvailabilityEditor'
import { QuickMessageContent } from '@/components/employee/QuickMessageCard'
import { NextDepositContent } from '@/components/employee/NextDepositCard'
import LoadingSpinner from '@/components/LoadingSpinner'
import { Clock, Calendar, MessageSquare, DollarSign } from 'lucide-react'
import { getDay } from 'date-fns'

export default function EmployeeDashboardPage() {
  const [employee, setEmployee] = useState<Employee | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

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

  return (
    <div className="min-h-screen p-4 pb-24 flex flex-col items-center">
      <div className="w-full max-w-lg space-y-4">
        {/* Current Jobs */}
        <DashboardDrawer
          title="Current Jobs"
          icon={<Clock className="w-6 h-6" />}
          defaultOpen={true}
        >
          <CurrentJobsContent employeeId={employee.id} />
        </DashboardDrawer>

        {/* Availability */}
        <DashboardDrawer
          title="Your Availability"
          icon={<Calendar className="w-6 h-6" />}
          defaultOpen={false}
        >
          <SpecificAvailabilityContent employeeId={employee.id} />
        </DashboardDrawer>

        {/* Message Boss */}
        <DashboardDrawer
          title="Message Boss"
          icon={<MessageSquare className="w-6 h-6" />}
          defaultOpen={false}
        >
          <QuickMessageContent />
        </DashboardDrawer>

        {/* Next Deposit - Hidden Fri-Sun */}
        {showNextDeposit && (
          <DashboardDrawer
            title="Next Deposit"
            icon={<DollarSign className="w-6 h-6" />}
            defaultOpen={false}
          >
            <NextDepositContent employeeId={employee.id} />
          </DashboardDrawer>
        )}
      </div>
    </div>
  )
}
