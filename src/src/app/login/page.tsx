'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { useTranslation } from '@/lib/i18n/useTranslation'

export default function LoginPage() {
  const router = useRouter()
  const { t } = useTranslation()
  // Login state
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [failedAttempts, setFailedAttempts] = useState(0)
  const [lockoutSeconds, setLockoutSeconds] = useState(0)

  const isLockedOut = lockoutSeconds > 0

  useEffect(() => {
    if (lockoutSeconds <= 0) return
    const timer = setTimeout(() => {
      setLockoutSeconds((s) => s - 1)
    }, 1000)
    return () => clearTimeout(timer)
  }, [lockoutSeconds])

  const triggerLockout = useCallback(() => {
    setLockoutSeconds(30)
    setFailedAttempts(0)
  }, [])



  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const supabase = createClient()

      // Convert username to email format for Supabase auth
      const email = username.includes('@') ? username : `${username.toLowerCase()}@cleaning.local`

      // Sign in with Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (authError) throw authError

      if (!authData.user) {
        throw new Error('No user returned from authentication')
      }

      // Check which profile type the user has
      // Check employer
      const { data: employerData } = await supabase
        .from('employers')
        .select('id')
        .eq('user_id', authData.user.id)
        .single()

      if (employerData) {
        router.push('/employer/jobs')
        return
      }

      // Check employee
      const { data: employeeData } = await supabase
        .from('employees')
        .select('id')
        .eq('user_id', authData.user.id)
        .single()

      if (employeeData) {
        router.push('/employee/dashboard')
        return
      }

      // Check customer
      const { data: customerData } = await supabase
        .from('customers')
        .select('id')
        .eq('user_id', authData.user.id)
        .single()

      if (customerData) {
        router.push('/customer/dashboard')
        return
      }

      // If no profile found, show error
      setError(t('No profile found for this account. Please contact support.'))
    } catch (err) {
      setError(err instanceof Error ? err.message : t('An error occurred during login'))
      const newAttempts = failedAttempts + 1
      setFailedAttempts(newAttempts)
      if (newAttempts >= 5) {
        triggerLockout()
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex justify-center overflow-hidden h-24 mb-6 -mt-8">
          <Image
            src="/logo-dark.png"
            alt="Groupe ABR | Routine"
            width={600}
            height={460}
            priority
            className="w-auto max-w-[480px] object-contain object-center scale-[2.5]"
          />
        </div>

        {/* LOGIN CARD */}
        <div className="w-full bg-white/5 border border-white/10 rounded-xl backdrop-blur-md mb-6">
          <form onSubmit={handleLogin}>
            <div className="space-y-4 p-6">
              {error && (
                <div className="bg-red-500/10 border border-red-500/30 text-red-300 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <label htmlFor="username" className="text-sm text-gray-300">{t('Username')}</label>
                <input
                  id="username"
                  type="text"
                  placeholder={t('Enter your username')}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  disabled={loading}
                  autoComplete="username"
                  className="w-full px-3 py-2 rounded-md bg-white/5 border border-white/20 text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="password" className="text-sm text-gray-300">{t('Password')}</label>
                <input
                  id="password"
                  type="password"
                  placeholder={t('Enter your password')}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                  autoComplete="current-password"
                  className="w-full px-3 py-2 rounded-md bg-white/5 border border-white/20 text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                />
              </div>
            </div>

            <div className="px-6 pb-6 pt-4">
              {isLockedOut && (
                <p className="text-red-400 text-sm text-center mb-3">
                  {t('Too many attempts. Try again in')} {lockoutSeconds}s
                </p>
              )}
              <button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg text-base font-medium transition-colors disabled:opacity-50"
                disabled={loading || isLockedOut}
              >
                {loading ? t('Signing in...') : isLockedOut ? `${t('Locked')} (${lockoutSeconds}s)` : t('Sign In')}
              </button>
            </div>
          </form>
        </div>

        {/* REGISTER SECTION */}
        <div className="w-full bg-white/5 border border-white/10 rounded-xl backdrop-blur-md p-6">
          <div className="text-center space-y-4">
            <div>
              <h3 className="text-lg font-bold text-white mb-2">
                {t('New Here?')}
              </h3>
              <p className="text-sm text-gray-300">
                {t('Join our team today')}
              </p>
            </div>

            <Link href="/register" className="block">
              <button
                className="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg text-base font-medium transition-colors"
              >
                {t('Register')}
              </button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
