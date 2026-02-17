'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { EmployerSettings, CompanyInfo, ThemeType } from '@/types/database'
import { AppearanceSettings } from '@/components/employer/AppearanceSettings'
import { NotificationSettings } from '@/components/employer/NotificationSettings'
import { CompanyInfoForm } from '@/components/employer/CompanyInfoForm'
import { AccountManagement } from '@/components/employer/AccountManagement'
import { AccountSettings } from '@/components/employer/AccountSettings'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import LoadingSpinner from '@/components/LoadingSpinner'
import { toast } from 'sonner'
import { useTranslation } from '@/lib/i18n/useTranslation'

export default function EmployerSettingsPage() {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(true)
  const [employerId, setEmployerId] = useState<string | null>(null)
  const [userEmail, setUserEmail] = useState<string>('')
  const [settings, setSettings] = useState<EmployerSettings | null>(null)
  const [companyInfo, setCompanyInfo] = useState<CompanyInfo | null>(null)
  const supabaseRef = useRef(createClient())
  const supabase = supabaseRef.current
  const isMountedRef = useRef(true)

  // Load employer data and settings
  useEffect(() => {
    isMountedRef.current = true
    loadSettings()
    return () => { isMountedRef.current = false }
  }, [])

  const loadSettings = async () => {
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        window.location.href = '/login'
        return
      }
      setUserEmail(user.email || '')

      // Get employer record
      const { data: employer, error: employerError } = await supabase
        .from('employers')
        .select('id')
        .eq('user_id', user.id)
        .single()

      if (employerError) throw employerError
      setEmployerId(employer.id)

      // Get employer settings
      const { data: settingsData, error: settingsError } = await supabase
        .from('employer_settings')
        .select('*')
        .eq('employer_id', employer.id)
        .single()

      if (settingsError && settingsError.code !== 'PGRST116') {
        throw settingsError
      }

      // If no settings exist, create default ones
      if (!settingsData) {
        const { data: newSettings, error: createError } = await supabase
          .from('employer_settings')
          .insert({
            employer_id: employer.id,
            theme: 'LIGHT' as ThemeType,
            primary_color: '#3B82F6',
            language: 'en',
            push_enabled: true,
            notify_new_message: true,
            notify_job_claimed: true,
            notify_exchange_request: true,
            reminder_2_days: true,
            reminder_1_day: true,
            reminder_6_hours: true,
            sound_enabled: true,
            email_review_enabled: true,
          })
          .select()
          .single()

        if (createError) throw createError
        setSettings(newSettings)
      } else {
        setSettings(settingsData)
      }

      // Get company info
      const { data: companyData, error: companyError } = await supabase
        .from('company_info')
        .select('*')
        .eq('employer_id', employer.id)
        .single()

      if (companyError && companyError.code !== 'PGRST116') {
        throw companyError
      }

      setCompanyInfo(companyData || null)
    } catch (error) {
      console.error('Error loading settings:', error)
      toast.error(t('Failed to load settings'))
    } finally {
      setLoading(false)
    }
  }

  // Save appearance settings
  const handleSaveAppearance = async (data: {
    theme: ThemeType
    primaryColor: string
    language: string
    logoUrl: string | null
  }) => {
    if (!employerId) return

    const { error } = await supabase
      .from('employer_settings')
      .update({
        theme: data.theme,
        primary_color: data.primaryColor,
        language: data.language,
        logo_url: data.logoUrl,
        updated_at: new Date().toISOString(),
      })
      .eq('employer_id', employerId)

    if (error) {
      console.error('Error saving appearance:', error)
      throw error
    }

    await loadSettings()
  }

  // Save notification settings
  const handleSaveNotifications = async (data: {
    pushEnabled: boolean
    soundEnabled: boolean
    notifyNewMessage: boolean
    notifyJobClaimed: boolean
    notifyExchangeRequest: boolean
    reminder2Days: boolean
    reminder1Day: boolean
    reminder6Hours: boolean
    emailReviewEnabled: boolean
  }) => {
    if (!employerId) return

    const { error } = await supabase
      .from('employer_settings')
      .update({
        push_enabled: data.pushEnabled,
        sound_enabled: data.soundEnabled,
        notify_new_message: data.notifyNewMessage,
        notify_job_claimed: data.notifyJobClaimed,
        notify_exchange_request: data.notifyExchangeRequest,
        reminder_2_days: data.reminder2Days,
        reminder_1_day: data.reminder1Day,
        reminder_6_hours: data.reminder6Hours,
        email_review_enabled: data.emailReviewEnabled,
        updated_at: new Date().toISOString(),
      })
      .eq('employer_id', employerId)

    if (error) {
      console.error('Error saving notifications:', error)
      throw error
    }

    await loadSettings()
  }

  // Save company info
  const handleSaveCompanyInfo = async (data: {
    companyName: string | null
    phone: string | null
    email: string | null
    address: string | null
    website: string | null
    defaultHourlyRate: number | null
    taxNumber: string | null
  }) => {
    if (!employerId) return

    if (companyInfo) {
      const { error } = await supabase
        .from('company_info')
        .update({
          company_name: data.companyName,
          phone: data.phone,
          email: data.email,
          address: data.address,
          website: data.website,
          default_hourly_rate: data.defaultHourlyRate,
          tax_number: data.taxNumber,
          updated_at: new Date().toISOString(),
        })
        .eq('employer_id', employerId)

      if (error) {
        console.error('Error updating company info:', error)
        throw error
      }
    } else {
      const { error } = await supabase
        .from('company_info')
        .insert({
          employer_id: employerId,
          company_name: data.companyName,
          phone: data.phone,
          email: data.email,
          address: data.address,
          website: data.website,
          default_hourly_rate: data.defaultHourlyRate,
          tax_number: data.taxNumber,
        })

      if (error) {
        console.error('Error creating company info:', error)
        throw error
      }
    }

    await loadSettings()
  }

  // Change email
  const handleChangeEmail = async (newEmail: string) => {
    const { error } = await supabase.auth.updateUser({
      email: newEmail,
    })

    if (error) {
      console.error('Error changing email:', error)
      throw error
    }

    if (employerId) {
      await supabase
        .from('employers')
        .update({ email: newEmail, updated_at: new Date().toISOString() })
        .eq('id', employerId)
    }
  }

  // Change password
  const handleChangePassword = async (currentPassword: string, newPassword: string) => {
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    })

    if (error) {
      console.error('Error changing password:', error)
      throw error
    }
  }

  // Logout
  const handleLogout = async () => {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  // Delete account
  const handleDeleteAccount = async () => {
    if (!employerId) return

    const { error } = await supabase
      .from('employers')
      .delete()
      .eq('id', employerId)

    if (error) {
      console.error('Error deleting account:', error)
      throw error
    }

    await supabase.auth.signOut()
    window.location.href = '/'
  }

  if (loading) {
    return <LoadingSpinner fullScreen />
  }

  if (!settings) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-lg font-medium text-red-400">{t('Failed to load settings')}</div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen p-4 pb-20">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-white mb-2">{t('Settings')}</h1>
        <p className="text-gray-400 mb-6">
          {t('Manage your account, notifications, and company information')}
        </p>

        <Accordion type="single" collapsible className="space-y-4">
          <AccordionItem value="appearance" className="bg-white/5 rounded-xl border border-white/10">
            <AccordionTrigger className="px-6 hover:no-underline">
              <span className="text-lg font-semibold text-white">{t('App Appearance')}</span>
            </AccordionTrigger>
            <AccordionContent className="px-6 pb-6">
              <AppearanceSettings
                theme={settings.theme}
                primaryColor={settings.primary_color}
                language={settings.language}
                logoUrl={settings.logo_url}
                employerId={employerId!}
                onSave={handleSaveAppearance}
              />
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="notifications" className="bg-white/5 rounded-xl border border-white/10">
            <AccordionTrigger className="px-6 hover:no-underline">
              <span className="text-lg font-semibold text-white">{t('Notifications')}</span>
            </AccordionTrigger>
            <AccordionContent className="px-6 pb-6">
              <NotificationSettings
                pushEnabled={settings.push_enabled}
                soundEnabled={settings.sound_enabled}
                notifyNewMessage={settings.notify_new_message}
                notifyJobClaimed={settings.notify_job_claimed}
                notifyExchangeRequest={settings.notify_exchange_request}
                reminder2Days={settings.reminder_2_days}
                reminder1Day={settings.reminder_1_day}
                reminder6Hours={settings.reminder_6_hours}
                emailReviewEnabled={settings.email_review_enabled ?? true}
                onSave={handleSaveNotifications}
              />
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="company" className="bg-white/5 rounded-xl border border-white/10">
            <AccordionTrigger className="px-6 hover:no-underline">
              <span className="text-lg font-semibold text-white">{t('Company Information')}</span>
            </AccordionTrigger>
            <AccordionContent className="px-6 pb-6">
              <CompanyInfoForm
                companyInfo={companyInfo}
                onSave={handleSaveCompanyInfo}
              />
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="management" className="bg-white/5 rounded-xl border border-white/10">
            <AccordionTrigger className="px-6 hover:no-underline">
              <span className="text-lg font-semibold text-white">{t('Account Management')}</span>
            </AccordionTrigger>
            <AccordionContent className="px-6 pb-6">
              <AccountManagement />
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="account" className="bg-white/5 rounded-xl border border-white/10">
            <AccordionTrigger className="px-6 hover:no-underline">
              <span className="text-lg font-semibold text-white">{t('Account & Security')}</span>
            </AccordionTrigger>
            <AccordionContent className="px-6 pb-6">
              <AccountSettings
                currentEmail={userEmail}
                onChangeEmail={handleChangeEmail}
                onChangePassword={handleChangePassword}
                onLogout={handleLogout}
                onDeleteAccount={handleDeleteAccount}
              />
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
    </div>
  )
}
