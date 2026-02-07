'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { Checkbox } from '@/components/ui/checkbox'
import { ChevronLeft, ChevronRight, Check, X } from 'lucide-react'
import { useTranslation } from '@/lib/i18n/useTranslation'

interface RegistrationData {
  fullName: string
  username: string
  email: string
  phone: string
  password: string
  confirmPassword: string
  address: string
  previousWork: string
  workDuration: string
  hoursPerWeek: string
  expectedSalary: string
  availability: string[]
  resumeFile: File | null
  documentsFiles: File[]
}

export default function RegisterPage() {
  const router = useRouter()
  const { t } = useTranslation()
  const [currentStep, setCurrentStep] = useState(1)
  const totalSteps = 12
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Username availability check
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle')
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)

  const checkUsernameAvailability = useCallback(async (username: string) => {
    if (!username || username.length < 2) {
      setUsernameStatus('idle')
      return
    }

    setUsernameStatus('checking')

    try {
      const res = await fetch('/api/auth/check-username', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username }),
      })

      if (!res.ok) {
        setUsernameStatus('idle')
        return
      }

      const result = await res.json()
      setUsernameStatus(result.available ? 'available' : 'taken')
    } catch {
      setUsernameStatus('idle')
    }
  }, [])

  const handleUsernameChange = useCallback((value: string) => {
    const sanitized = value.toLowerCase().replace(/[^a-z0-9]/g, '')
    setData(prev => ({ ...prev, username: sanitized }))

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }

    if (!sanitized || sanitized.length < 2) {
      setUsernameStatus('idle')
      return
    }

    debounceTimerRef.current = setTimeout(() => {
      checkUsernameAvailability(sanitized)
    }, 500)
  }, [checkUsernameAvailability])

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
    }
  }, [])

  // Form data
  const [data, setData] = useState<RegistrationData>({
    fullName: '',
    username: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    address: '',
    previousWork: '',
    workDuration: '',
    hoursPerWeek: '',
    expectedSalary: '',
    availability: [],
    resumeFile: null,
    documentsFiles: []
  })

  const handleNext = () => {
    setError(null)
    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1)
    } else {
      handleSubmit()
    }
  }

  const handleSkip = () => {
    setError(null)
    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1)
    } else {
      handleSubmit()
    }
  }

  const handleBack = () => {
    setError(null)
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
    }
  }

  const handleAvailabilityToggle = (value: string) => {
    setData(prev => ({
      ...prev,
      availability: prev.availability.includes(value)
        ? prev.availability.filter(v => v !== value)
        : [...prev.availability, value]
    }))
  }

  const handleSubmit = async () => {
    setLoading(true)
    setError(null)

    try {
      // Validation
      if (!data.fullName || !data.username || !data.password) {
        setError(t('Please provide at least name, username, and password'))
        setLoading(false)
        return
      }

      if (data.password !== data.confirmPassword) {
        setError(t('Passwords do not match'))
        setLoading(false)
        return
      }

      if (data.password.length < 6) {
        setError(t('Password must be at least 6 characters long'))
        setLoading(false)
        return
      }

      // Create auth user using API endpoint
      const createUserResponse = await fetch('/api/auth/create-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: data.username,
          password: data.password,
          full_name: data.fullName,
          role: 'employee'
        })
      })

      const createUserResult = await createUserResponse.json()
      if (!createUserResponse.ok) {
        throw new Error(createUserResult.error || 'Failed to create account')
      }

      const userId = createUserResult.user_id
      if (!userId) {
        throw new Error('No user ID returned from registration')
      }

      // Create employee profile
      const supabase = createClient()
      const { error: profileError } = await supabase
        .from('employees')
        .insert({
          user_id: userId,
          full_name: data.fullName,
          email: data.email || null,
          phone: data.phone || '',
          address: data.address || null,
          notes: [
            data.previousWork ? `Previous Work: ${data.previousWork}` : '',
            data.workDuration ? `Duration: ${data.workDuration}` : '',
            data.hoursPerWeek ? `Hours/Week: ${data.hoursPerWeek}` : '',
            data.expectedSalary ? `Expected Salary: ${data.expectedSalary}` : '',
            data.availability.length > 0 ? `Availability: ${data.availability.join(', ')}` : ''
          ].filter(Boolean).join('\n') || null,
          status: 'PENDING',
        })

      if (profileError) throw profileError

      // TODO: Upload resume and documents to storage if provided

      // Auto-login the user
      const { error: loginError } = await supabase.auth.signInWithPassword({
        email: `${data.username.toLowerCase()}@cleaning.local`,
        password: data.password,
      })

      if (loginError) {
        console.error('Auto-login failed:', loginError)
        // Don't throw - registration was successful, just redirect to login
        router.push('/login')
        return
      }

      router.push('/employee/pending')
    } catch (err: unknown) {
      console.error('Registration error:', err)
      if (err instanceof Error) {
        setError(err.message)
      } else if (typeof err === 'object' && err !== null && 'message' in err) {
        setError(String((err as { message: unknown }).message))
      } else {
        setError(t('An error occurred during registration'))
      }
    } finally {
      setLoading(false)
    }
  }

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-4">
            <label htmlFor="fullName" className="block text-gray-300 text-lg">{t("What's your full name?")}</label>
            <input
              id="fullName"
              type="text"
              placeholder="John Doe"
              value={data.fullName}
              onChange={(e) => setData({ ...data, fullName: e.target.value })}
              disabled={loading}
              className="w-full px-3 py-4 rounded-md bg-white/5 border border-white/20 text-white placeholder:text-gray-500 text-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            />
          </div>
        )

      case 2:
        return (
          <div className="space-y-4">
            <label htmlFor="username" className="block text-gray-300 text-lg">{t('Choose a username')}</label>
            <div className="relative">
              <input
                id="username"
                type="text"
                placeholder="johndoe"
                value={data.username}
                onChange={(e) => handleUsernameChange(e.target.value)}
                disabled={loading}
                className={`w-full px-3 py-4 rounded-md bg-white/5 border text-white placeholder:text-gray-500 text-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 pr-10 ${
                  usernameStatus === 'taken' ? 'border-red-500/50' :
                  usernameStatus === 'available' ? 'border-green-500/50' :
                  'border-white/20'
                }`}
              />
              {usernameStatus === 'checking' && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <div className="w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                </div>
              )}
              {usernameStatus === 'available' && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <Check className="w-5 h-5 text-green-400" />
                </div>
              )}
              {usernameStatus === 'taken' && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <X className="w-5 h-5 text-red-400" />
                </div>
              )}
            </div>
            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-400">{t('Only lowercase letters and numbers allowed')}</p>
              {usernameStatus === 'available' && (
                <p className="text-xs text-green-400 font-medium">{t('Available')}</p>
              )}
              {usernameStatus === 'taken' && (
                <p className="text-xs text-red-400 font-medium">{t('Username taken')}</p>
              )}
            </div>
          </div>
        )

      case 3:
        return (
          <div className="space-y-4">
            <label htmlFor="email" className="block text-gray-300 text-lg">{t("What's your email address? (optional)")}</label>
            <input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={data.email}
              onChange={(e) => setData({ ...data, email: e.target.value })}
              disabled={loading}
              className="w-full px-3 py-4 rounded-md bg-white/5 border border-white/20 text-white placeholder:text-gray-500 text-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            />
          </div>
        )

      case 4:
        return (
          <div className="space-y-4">
            <label htmlFor="phone" className="block text-gray-300 text-lg">{t("What's your phone number?")}</label>
            <input
              id="phone"
              type="tel"
              placeholder="(555) 123-4567"
              value={data.phone}
              onChange={(e) => setData({ ...data, phone: e.target.value })}
              disabled={loading}
              className="w-full px-3 py-4 rounded-md bg-white/5 border border-white/20 text-white placeholder:text-gray-500 text-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            />
          </div>
        )

      case 5:
        return (
          <div className="space-y-4">
            <label htmlFor="password" className="block text-gray-300 text-lg">{t('Create a password')}</label>
            <input
              id="password"
              type="password"
              placeholder={t('At least 6 characters')}
              value={data.password}
              onChange={(e) => setData({ ...data, password: e.target.value })}
              disabled={loading}
              className="w-full px-3 py-4 rounded-md bg-white/5 border border-white/20 text-white placeholder:text-gray-500 text-lg mb-3 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            />
            <input
              id="confirmPassword"
              type="password"
              placeholder={t('Confirm password')}
              value={data.confirmPassword}
              onChange={(e) => setData({ ...data, confirmPassword: e.target.value })}
              disabled={loading}
              className="w-full px-3 py-4 rounded-md bg-white/5 border border-white/20 text-white placeholder:text-gray-500 text-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            />
          </div>
        )

      case 6:
        return (
          <div className="space-y-4">
            <label htmlFor="address" className="block text-gray-300 text-lg">{t("What's your address?")}</label>
            <textarea
              id="address"
              placeholder={t('Street, City, State, ZIP')}
              value={data.address}
              onChange={(e) => setData({ ...data, address: e.target.value })}
              disabled={loading}
              rows={4}
              className="w-full px-3 py-3 rounded-md bg-white/5 border border-white/20 text-white placeholder:text-gray-500 text-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            />
          </div>
        )

      case 7:
        return (
          <div className="space-y-4">
            <label htmlFor="previousWork" className="block text-gray-300 text-lg">{t('What previous work experience do you have?')}</label>
            <textarea
              id="previousWork"
              placeholder={t('Tell us about your cleaning or related experience...')}
              value={data.previousWork}
              onChange={(e) => setData({ ...data, previousWork: e.target.value })}
              disabled={loading}
              rows={5}
              className="w-full px-3 py-3 rounded-md bg-white/5 border border-white/20 text-white placeholder:text-gray-500 text-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            />
          </div>
        )

      case 8:
        return (
          <div className="space-y-4">
            <label htmlFor="workDuration" className="block text-gray-300 text-lg">{t('How much time did you spend at your previous job?')}</label>
            <input
              id="workDuration"
              type="text"
              placeholder={t('e.g., 2 years, 6 months...')}
              value={data.workDuration}
              onChange={(e) => setData({ ...data, workDuration: e.target.value })}
              disabled={loading}
              className="w-full px-3 py-4 rounded-md bg-white/5 border border-white/20 text-white placeholder:text-gray-500 text-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            />
          </div>
        )

      case 9:
        return (
          <div className="space-y-4">
            <label className="block text-gray-300 text-lg">{t('How many hours per week do you want to work?')}</label>
            <div className="space-y-3">
              {[t('10-20 hours'), t('20-30 hours'), t('30-40 hours'), t('40+ hours')].map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setData({ ...data, hoursPerWeek: option })}
                  className={`w-full p-4 rounded-lg text-left transition-all ${
                    data.hoursPerWeek === option
                      ? 'bg-blue-600 text-white border-2 border-blue-500'
                      : 'bg-white/5 text-gray-300 border-2 border-white/20 hover:bg-white/10'
                  }`}
                  disabled={loading}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
        )

      case 10:
        return (
          <div className="space-y-4">
            <label htmlFor="expectedSalary" className="block text-gray-300 text-lg">{t('What salary do you find acceptable?')}</label>
            <input
              id="expectedSalary"
              type="text"
              placeholder={t('e.g., $20/hour or $800/week')}
              value={data.expectedSalary}
              onChange={(e) => setData({ ...data, expectedSalary: e.target.value })}
              disabled={loading}
              className="w-full px-3 py-4 rounded-md bg-white/5 border border-white/20 text-white placeholder:text-gray-500 text-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            />
          </div>
        )

      case 11:
        return (
          <div className="space-y-4">
            <label className="block text-gray-300 text-lg">{t('When are you available to work?')}</label>
            <div className="space-y-3">
              {[
                { value: 'morning', label: t('Morning (6am-12pm)') },
                { value: 'day', label: t('Day (12pm-6pm)') },
                { value: 'evening', label: t('Evening (6pm-10pm)') },
                { value: 'night', label: t('Night (10pm-6am)') },
                { value: 'weekends', label: t('Weekends') }
              ].map((option) => (
                <div
                  key={option.value}
                  className={`flex items-center space-x-3 p-4 rounded-lg border-2 transition-all cursor-pointer ${
                    data.availability.includes(option.value)
                      ? 'bg-blue-600/20 border-blue-500'
                      : 'bg-white/5 border-white/20 hover:bg-white/10'
                  }`}
                  onClick={() => handleAvailabilityToggle(option.value)}
                >
                  <Checkbox
                    id={option.value}
                    checked={data.availability.includes(option.value)}
                    onCheckedChange={() => handleAvailabilityToggle(option.value)}
                    disabled={loading}
                    className="border-white/30"
                  />
                  <label htmlFor={option.value} className="text-gray-300 text-base cursor-pointer flex-1">
                    {option.label}
                  </label>
                </div>
              ))}
            </div>
          </div>
        )

      case 12:
        return (
          <div className="space-y-4">
            <label htmlFor="resume" className="block text-gray-300 text-lg">{t('Upload your resume (optional)')}</label>
            <div className="border-2 border-dashed border-white/20 rounded-lg p-8 text-center hover:border-white/40 transition-colors">
              <input
                id="resume"
                type="file"
                accept=".pdf,.doc,.docx"
                onChange={(e) => setData({ ...data, resumeFile: e.target.files?.[0] || null })}
                disabled={loading}
                className="w-full bg-white/5 border border-white/20 text-white rounded-md px-3 py-2"
              />
              {data.resumeFile && (
                <p className="text-green-400 mt-2 text-sm">{data.resumeFile.name}</p>
              )}
            </div>
          </div>
        )

      default:
        return null
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black flex items-center justify-center p-4 py-8">
      <div className="w-full max-w-2xl">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <Image
            src="/logo-dark.png"
            alt="Groupe ABR | Routine"
            width={300}
            height={230}
            priority
            className="w-auto max-w-[280px]"
          />
        </div>

        {/* Progress Bar */}
        <div className="mb-6">
          <div className="flex justify-between text-sm text-gray-400 mb-2">
            <span>{t('Step')} {currentStep} {t('of')} {totalSteps}</span>
            <span>{Math.round((currentStep / totalSteps) * 100)}%</span>
          </div>
          <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-600 transition-all duration-300"
              style={{ width: `${(currentStep / totalSteps) * 100}%` }}
            ></div>
          </div>
        </div>

        {/* Card */}
        <div className="bg-white/5 border border-white/10 rounded-xl backdrop-blur-md">
          <div className="p-6 pb-2">
            <h2 className="text-white text-2xl font-semibold">{t('Employee Registration')}</h2>
          </div>

          <div className="p-6 min-h-[300px]">
            {error && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-300 px-4 py-3 rounded-lg text-sm mb-4">
                {error}
              </div>
            )}

            {renderStep()}
          </div>

          <div className="flex justify-between gap-3 p-6 pt-2">
            {currentStep > 1 && (
              <button
                type="button"
                onClick={handleBack}
                disabled={loading}
                className="bg-white/10 border border-white/20 text-white hover:bg-white/20 px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 flex items-center"
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                {t('Back')}
              </button>
            )}

            <div className="flex gap-3 ml-auto">
              <button
                type="button"
                onClick={handleSkip}
                disabled={loading}
                className="bg-white/10 border border-white/20 text-gray-300 hover:bg-white/20 px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              >
                {t('Skip')}
              </button>

              <button
                type="button"
                onClick={handleNext}
                disabled={loading || (currentStep === 2 && (usernameStatus === 'taken' || usernameStatus === 'checking'))}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 flex items-center"
              >
                {loading ? t('Processing...') : currentStep === totalSteps ? t('Submit') : t('Next')}
                {currentStep < totalSteps && <ChevronRight className="w-4 h-4 ml-1" />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
