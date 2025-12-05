'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'

export function EmployeeStatusGate({ children }: { children: React.ReactNode }) {
  const [employeeStatus, setEmployeeStatus] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  const checkStatus = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: employee } = await supabase
        .from('employees')
        .select('status')
        .eq('user_id', user.id)
        .single()

      if (employee) {
        setEmployeeStatus(employee.status)
      }
    }
    setLoading(false)
  }

  useEffect(() => {
    checkStatus()
  }, [])

  // Show loading while checking
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">Loading...</p>
      </div>
    )
  }

  // Lock screen for PENDING accounts
  if (employeeStatus === 'PENDING') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md text-center">
          <div className="text-6xl mb-4">⏳</div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">
            Account Being Validated
          </h1>
          <p className="text-gray-600 mb-6">
            Your account is being reviewed by the administrator. Please come back later.
          </p>
          <Button
            variant="outline"
            onClick={() => {
              setLoading(true)
              checkStatus()
            }}
          >
            Check Again
          </Button>
        </div>
      </div>
    )
  }

  // Lock screen for INACTIVE/BLOCKED accounts
  if (employeeStatus === 'INACTIVE' || employeeStatus === 'BLOCKED') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md text-center">
          <div className="text-6xl mb-4">🚫</div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">
            Account {employeeStatus === 'BLOCKED' ? 'Blocked' : 'Inactive'}
          </h1>
          <p className="text-gray-600">
            Please contact your administrator for assistance.
          </p>
        </div>
      </div>
    )
  }

  // Account is ACTIVE - show the app
  return <>{children}</>
}
