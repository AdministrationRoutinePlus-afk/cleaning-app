'use client'

import { useEffect, useState } from 'react'
import { BottomNav } from '@/components/BottomNav'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import LoadingSpinner from '@/components/LoadingSpinner'

export default function EmployeeLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [status, setStatus] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  const checkStatus = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: employee } = await supabase
        .from('employees')
        .select('status')
        .eq('user_id', user.id)
        .single()

      setStatus(employee?.status || null)
    }
    setLoading(false)
  }

  useEffect(() => {
    checkStatus()
  }, [])

  // Loading state
  if (loading) {
    return <LoadingSpinner fullScreen />
  }

  // PENDING - show lock screen
  if (status === 'PENDING') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black flex items-center justify-center p-4">
        <div className="bg-white/10 backdrop-blur-md rounded-2xl shadow-2xl p-8 max-w-md text-center border border-white/20">
          <div className="text-6xl mb-4">⏳</div>
          <h1 className="text-xl font-bold text-white mb-2">
            Account Being Validated
          </h1>
          <p className="text-gray-300 mb-6">
            Your account is being reviewed by the administrator. Please come back later.
          </p>
          <Button variant="outline" onClick={checkStatus} className="bg-white/10 border-white/30 text-white hover:bg-white/20">
            Check Again
          </Button>
        </div>
      </div>
    )
  }

  // INACTIVE/BLOCKED - show lock screen
  if (status === 'INACTIVE' || status === 'BLOCKED') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black flex items-center justify-center p-4">
        <div className="bg-white/10 backdrop-blur-md rounded-2xl shadow-2xl p-8 max-w-md text-center border border-white/20">
          <div className="text-6xl mb-4">🚫</div>
          <h1 className="text-xl font-bold text-white mb-2">
            Account {status === 'BLOCKED' ? 'Blocked' : 'Inactive'}
          </h1>
          <p className="text-gray-300">
            Please contact your administrator for assistance.
          </p>
        </div>
      </div>
    )
  }

  // ACTIVE - show normal layout
  return (
    <div className="fixed inset-0 bg-gradient-to-br from-gray-900 via-gray-800 to-black overflow-hidden">
      <div className="h-full overflow-y-auto">
        {children}
      </div>
      <BottomNav profile="EMPLOYEE" />
    </div>
  )
}
