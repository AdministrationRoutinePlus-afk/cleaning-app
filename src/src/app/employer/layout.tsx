'use client'

import { useEffect, useState } from 'react'
import { BottomNav } from '@/components/BottomNav'
import { createClient } from '@/lib/supabase/client'
import LoadingSpinner from '@/components/LoadingSpinner'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { useTranslation } from '@/lib/i18n/useTranslation'

export default function EmployerLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { t } = useTranslation()
  const [hasAccess, setHasAccess] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  const checkEmployerAccess = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setHasAccess(false)
      setLoading(false)
      return
    }

    const { data: employer } = await supabase
      .from('employers')
      .select('id')
      .eq('user_id', user.id)
      .single()

    setHasAccess(!!employer)
    setLoading(false)
  }

  useEffect(() => {
    checkEmployerAccess()
  }, [])

  if (loading) {
    return <LoadingSpinner fullScreen />
  }

  if (!hasAccess) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black flex items-center justify-center p-4">
        <div className="bg-white/10 rounded-2xl shadow-2xl p-8 max-w-md text-center border border-white/20">
          <h1 className="text-xl font-bold text-white mb-2">
            {t('Access Denied')}
          </h1>
          <p className="text-gray-300">
            {t('You do not have employer access. Please contact your administrator.')}
          </p>
        </div>
      </div>
    )
  }

  return (
    <>
      <ErrorBoundary>
        {children}
      </ErrorBoundary>
      <BottomNav profile="EMPLOYER" />
    </>
  )
}
