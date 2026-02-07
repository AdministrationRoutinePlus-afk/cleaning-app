'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { useTranslation } from '@/lib/i18n/useTranslation'

export function EmployeeStatusGate({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation()
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
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black flex items-center justify-center">
        <p className="text-gray-400">{t('Loading...')}</p>
      </div>
    )
  }

  // Lock screen for PENDING accounts
  if (employeeStatus === 'PENDING') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black flex items-center justify-center p-4">
        <div className="bg-white/10 rounded-2xl shadow-2xl p-8 max-w-md text-center border border-white/20">
          <div className="text-6xl mb-4">⏳</div>
          <h1 className="text-xl font-bold text-white mb-2">
            {t('Account Being Validated')}
          </h1>
          <p className="text-gray-300 mb-6">
            {t('Your account is being reviewed by the administrator. Please come back later.')}
          </p>
          <Button
            className="bg-white/10 text-white border border-white/20 hover:bg-white/20"
            onClick={() => {
              setLoading(true)
              checkStatus()
            }}
          >
            {t('Check Again')}
          </Button>
        </div>
      </div>
    )
  }

  // Lock screen for INACTIVE/BLOCKED accounts
  if (employeeStatus === 'INACTIVE' || employeeStatus === 'BLOCKED') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black flex items-center justify-center p-4">
        <div className="bg-white/10 rounded-2xl shadow-2xl p-8 max-w-md text-center border border-white/20">
          <div className="text-6xl mb-4">🚫</div>
          <h1 className="text-xl font-bold text-white mb-2">
            {employeeStatus === 'BLOCKED' ? t('Account Blocked') : t('Account Inactive')}
          </h1>
          <p className="text-gray-300">
            {t('Please contact your administrator for assistance.')}
          </p>
        </div>
      </div>
    )
  }

  // Account is ACTIVE - show the app
  return <>{children}</>
}
