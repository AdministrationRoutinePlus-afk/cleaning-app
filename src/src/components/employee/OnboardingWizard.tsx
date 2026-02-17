'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useTranslation } from '@/lib/i18n/useTranslation'
import { X, ChevronRight, ChevronLeft, Check } from 'lucide-react'

interface OnboardingWizardProps {
  employeeId: string
}

const DAYS = [
  { key: 1, label: 'Mon' },
  { key: 2, label: 'Tue' },
  { key: 3, label: 'Wed' },
  { key: 4, label: 'Thu' },
  { key: 5, label: 'Fri' },
  { key: 6, label: 'Sat' },
  { key: 0, label: 'Sun' },
]

export function OnboardingWizard({ employeeId }: OnboardingWizardProps) {
  const { t } = useTranslation()
  const router = useRouter()
  const supabaseRef = useRef(createClient())
  const supabase = supabaseRef.current

  const storageKey = `onboarding-completed-${employeeId}`

  const [show, setShow] = useState(() => {
    if (typeof window === 'undefined') return false
    return !localStorage.getItem(storageKey)
  })

  const [step, setStep] = useState(0)
  const [availability, setAvailability] = useState<Record<number, boolean>>({
    1: true, 2: true, 3: true, 4: true, 5: true, 6: false, 0: false,
  })
  const [timeRanges, setTimeRanges] = useState<Record<number, { start: string; end: string }>>({
    1: { start: '08:00', end: '17:00' },
    2: { start: '08:00', end: '17:00' },
    3: { start: '08:00', end: '17:00' },
    4: { start: '08:00', end: '17:00' },
    5: { start: '08:00', end: '17:00' },
    6: { start: '08:00', end: '17:00' },
    0: { start: '08:00', end: '17:00' },
  })
  const [saving, setSaving] = useState(false)
  const [expandedDay, setExpandedDay] = useState<number | null>(null)
  const [configured, setConfigured] = useState<Record<number, boolean>>({
    1: false, 2: false, 3: false, 4: false, 5: false, 6: false, 0: false,
  })
  const allConfigured = DAYS.every(d => configured[d.key])

  const complete = () => {
    localStorage.setItem(storageKey, 'true')
    setShow(false)
  }

  const toggleDay = (dayKey: number) => {
    const wasOn = availability[dayKey]
    if (wasOn) {
      // Turning off — disable and collapse
      setAvailability(prev => ({ ...prev, [dayKey]: false }))
      if (expandedDay === dayKey) setExpandedDay(null)
    } else {
      // Turning on — enable, set defaults, and expand
      setAvailability(prev => ({ ...prev, [dayKey]: true }))
      setTimeRanges(prev => ({
        ...prev,
        [dayKey]: prev[dayKey] || { start: '08:00', end: '17:00' },
      }))
      setExpandedDay(dayKey)
    }
  }

  const updateTime = (dayKey: number, field: 'start' | 'end', value: string) => {
    setTimeRanges(prev => ({
      ...prev,
      [dayKey]: { ...prev[dayKey], [field]: value },
    }))
  }

  const saveAvailability = async () => {
    setSaving(true)
    try {
      // Only save records for days the user explicitly configured
      const rows = DAYS
        .filter(d => configured[d.key])
        .map(d => ({
          employee_id: employeeId,
          day_of_week: d.key,
          is_available: availability[d.key] ?? false,
          start_time: availability[d.key] ? (timeRanges[d.key]?.start || '08:00') : null,
          end_time: availability[d.key] ? (timeRanges[d.key]?.end || '17:00') : null,
        }))

      // Delete existing rows first then insert
      await supabase
        .from('employee_weekly_availability')
        .delete()
        .eq('employee_id', employeeId)

      if (rows.length > 0) {
        await supabase
          .from('employee_weekly_availability')
          .insert(rows)
      }

      // Save availability mode as 'fixed'
      await supabase
        .from('employees')
        .update({ availability_mode: 'fixed' })
        .eq('id', employeeId)
    } catch (err) {
      console.error('Error saving availability:', err)
    } finally {
      setSaving(false)
    }
  }

  const handleNext = async () => {
    if (step === 1) {
      await saveAvailability()
    }
    if (step < 2) {
      setStep(step + 1)
    } else {
      complete()
      router.push('/employee/jobs')
    }
  }

  if (!show) return null

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 rounded-2xl p-6 max-w-md w-full relative">
        {/* Skip button */}
        <button
          onClick={complete}
          className="absolute top-4 right-4 text-gray-500 hover:text-gray-300 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Progress bar */}
        <div className="flex gap-2 mb-6">
          {[0, 1, 2].map(i => (
            <div
              key={i}
              className={`h-1.5 flex-1 rounded-full transition-colors ${
                i <= step ? 'bg-blue-500' : 'bg-white/10'
              }`}
            />
          ))}
        </div>

        {/* Step 0: Welcome */}
        {step === 0 && (
          <div className="text-center space-y-4">
            <h2 className="text-2xl font-bold text-white">{t('Welcome!')}</h2>
            <p className="text-gray-400">
              {t("Let's get you set up. This app helps you manage your cleaning jobs, track your earnings, and communicate with your boss.")}
            </p>
            <p className="text-sm text-gray-500">
              {t('This will only take a minute.')}
            </p>
          </div>
        )}

        {/* Step 1: Availability */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-white">{t('Set Your Availability')}</h2>
              <p className="text-gray-300 text-sm mt-2">
                {t('Tell us when you are available to work.')}
              </p>
            </div>

            {/* Day spheres in a row */}
            <div className="flex justify-center gap-2">
              {DAYS.map(d => {
                const done = configured[d.key]
                const isOn = availability[d.key]
                const selected = expandedDay === d.key
                return (
                  <button
                    key={d.key}
                    onClick={() => setExpandedDay(selected ? null : d.key)}
                    className={`w-11 h-11 rounded-full text-xs font-bold transition-all ${
                      selected ? 'ring-2 ring-offset-2 ring-offset-gray-900' : ''
                    } ${
                      !done
                        ? `bg-blue-500 text-white shadow-lg shadow-blue-500/25 ${selected ? 'ring-blue-400' : ''}`
                        : isOn
                          ? `bg-green-500 text-white shadow-lg shadow-green-500/25 ${selected ? 'ring-green-400' : ''}`
                          : `bg-red-500 text-white shadow-lg shadow-red-500/25 ${selected ? 'ring-red-400' : ''}`
                    }`}
                  >
                    {t(d.label)}
                  </button>
                )
              })}
            </div>

            {/* Expanded panel for selected day */}
            {expandedDay !== null && (() => {
              const d = DAYS.find(day => day.key === expandedDay)!
              const isOn = availability[d.key]
              const isDone = configured[d.key]
              const time = timeRanges[d.key]
              return (
                <div className="bg-white/[0.07] border border-white/15 rounded-xl px-4 py-4 space-y-3">
                  <p className="text-base font-bold text-white text-center">{t(d.label)}</p>

                  {/* Available / Not Available */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setAvailability(prev => ({ ...prev, [d.key]: true }))
                        setConfigured(prev => ({ ...prev, [d.key]: true }))
                        setTimeRanges(prev => ({
                          ...prev,
                          [d.key]: prev[d.key] || { start: '08:00', end: '17:00' },
                        }))
                      }}
                      className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                        isDone && isOn
                          ? 'bg-green-500 text-white shadow-md shadow-green-500/20'
                          : 'bg-white/10 text-gray-300 border border-white/15 hover:bg-white/15'
                      }`}
                    >
                      {t('Available')}
                    </button>
                    <button
                      onClick={() => {
                        setAvailability(prev => ({ ...prev, [d.key]: false }))
                        setConfigured(prev => ({ ...prev, [d.key]: true }))
                      }}
                      className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                        isDone && !isOn
                          ? 'bg-red-500 text-white shadow-md shadow-red-500/20'
                          : 'bg-white/10 text-gray-300 border border-white/15 hover:bg-white/15'
                      }`}
                    >
                      {t('Not Available')}
                    </button>
                  </div>

                  {/* Time picker */}
                  {isDone && isOn && (
                    <div className="flex items-center justify-center gap-3">
                      <input
                        type="time"
                        value={time?.start || '08:00'}
                        onChange={(e) => updateTime(d.key, 'start', e.target.value)}
                        className="bg-white/10 border border-white/20 text-white rounded-lg px-3 py-1.5 text-sm w-28"
                      />
                      <span className="text-gray-500 text-sm">→</span>
                      <input
                        type="time"
                        value={time?.end || '17:00'}
                        onChange={(e) => updateTime(d.key, 'end', e.target.value)}
                        className="bg-white/10 border border-white/20 text-white rounded-lg px-3 py-1.5 text-sm w-28"
                      />
                    </div>
                  )}
                </div>
              )
            })()}

            {/* Legend */}
            <div className="flex justify-center gap-5 text-xs text-gray-400">
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-blue-500" />{t('Not set')}</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-green-500" />{t('Available')}</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-red-500" />{t('Off')}</span>
            </div>

            <p className="text-sm text-blue-400 text-center font-medium">
              {t('You can change this at any time from your profile.')}
            </p>
          </div>
        )}

        {/* Step 2: Ready */}
        {step === 2 && (
          <div className="text-center space-y-4">
            <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto">
              <Check className="w-8 h-8 text-green-400" />
            </div>
            <h2 className="text-2xl font-bold text-white">{t("You're Ready!")}</h2>
            <p className="text-gray-400">
              {t('Head to Jobs to find available work.')}
            </p>
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between mt-8">
          {step > 0 ? (
            <button
              onClick={() => setStep(step - 1)}
              className="flex items-center gap-1 text-gray-400 hover:text-white transition-colors text-sm"
            >
              <ChevronLeft className="w-4 h-4" />
              {t('Back')}
            </button>
          ) : (
            <button
              onClick={complete}
              className="text-gray-500 hover:text-gray-300 transition-colors text-sm"
            >
              {t('Skip')}
            </button>
          )}

          <button
            onClick={handleNext}
            disabled={saving || (step === 1 && !allConfigured)}
            className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white px-5 py-2.5 rounded-xl font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? t('Saving...') : step === 2 ? t('Browse Jobs') : step === 1 && !allConfigured ? t('Set all days') : t('Next')}
            {!saving && <ChevronRight className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  )
}
