'use client'

import { useState, useEffect } from 'react'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { Bell, BellOff, CheckCircle } from 'lucide-react'
import {
  requestNotificationPermission,
  getNotificationPermissionStatus,
  areNotificationsEnabled
} from '@/lib/firebase/notifications'
import { useTranslation } from '@/lib/i18n/useTranslation'

interface NotificationSettingsProps {
  pushEnabled: boolean
  soundEnabled: boolean
  notifyNewMessage: boolean
  notifyJobClaimed: boolean
  notifyExchangeRequest: boolean
  reminder2Days: boolean
  reminder1Day: boolean
  reminder6Hours: boolean
  emailReviewEnabled: boolean
  onSave: (data: {
    pushEnabled: boolean
    soundEnabled: boolean
    notifyNewMessage: boolean
    notifyJobClaimed: boolean
    notifyExchangeRequest: boolean
    reminder2Days: boolean
    reminder1Day: boolean
    reminder6Hours: boolean
    emailReviewEnabled: boolean
  }) => Promise<void>
}

export function NotificationSettings({
  pushEnabled,
  soundEnabled,
  notifyNewMessage,
  notifyJobClaimed,
  notifyExchangeRequest,
  reminder2Days,
  reminder1Day,
  reminder6Hours,
  emailReviewEnabled,
  onSave,
}: NotificationSettingsProps) {
  const { t } = useTranslation()
  const [settings, setSettings] = useState({
    pushEnabled,
    soundEnabled,
    notifyNewMessage,
    notifyJobClaimed,
    notifyExchangeRequest,
    reminder2Days,
    reminder1Day,
    reminder6Hours,
    emailReviewEnabled,
  })
  const [saving, setSaving] = useState(false)
  const [permissionStatus, setPermissionStatus] = useState<string>('default')
  const [requestingPermission, setRequestingPermission] = useState(false)

  useEffect(() => {
    const status = getNotificationPermissionStatus()
    setPermissionStatus(status)
  }, [])

  const updateSetting = (key: keyof typeof settings, value: boolean) => {
    setSettings((prev) => ({ ...prev, [key]: value }))
  }

  const handlePushToggle = async (checked: boolean) => {
    if (checked && permissionStatus !== 'granted') {
      setRequestingPermission(true)
      const token = await requestNotificationPermission()
      setRequestingPermission(false)

      if (token) {
        setPermissionStatus('granted')
        updateSetting('pushEnabled', true)
      } else {
        setPermissionStatus(getNotificationPermissionStatus())
      }
    } else {
      updateSetting('pushEnabled', checked)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await onSave(settings)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* General Settings */}
      <div className="space-y-4">
        <h3 className="font-medium text-sm text-gray-400">{t('General')}</h3>
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {permissionStatus === 'granted' ? (
                  <Bell className="w-4 h-4 text-green-400" />
                ) : (
                  <BellOff className="w-4 h-4 text-gray-500" />
                )}
                <Label htmlFor="push_enabled" className="flex-1 text-gray-300">
                  {t('Push Notifications')}
                </Label>
              </div>
              <Switch
                id="push_enabled"
                checked={settings.pushEnabled}
                onCheckedChange={handlePushToggle}
                disabled={requestingPermission || permissionStatus === 'denied'}
              />
            </div>
            {permissionStatus === 'granted' && (
              <p className="text-xs text-green-400 flex items-center gap-1 ml-6">
                <CheckCircle className="w-3 h-3" />
                {t('Notifications enabled')}
              </p>
            )}
            {permissionStatus === 'denied' && (
              <p className="text-xs text-red-400 ml-6">
                {t('Notifications blocked. Enable in browser settings.')}
              </p>
            )}
            {permissionStatus === 'default' && !requestingPermission && (
              <p className="text-xs text-gray-500 ml-6">
                {t('Enable to receive alerts on your device')}
              </p>
            )}
            {requestingPermission && (
              <p className="text-xs text-blue-400 ml-6">
                {t('Requesting permission...')}
              </p>
            )}
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="sound_enabled" className="flex-1 text-gray-300">
              {t('Sound Alerts')}
            </Label>
            <Switch
              id="sound_enabled"
              checked={settings.soundEnabled}
              onCheckedChange={(checked) => updateSetting('soundEnabled', checked)}
            />
          </div>
        </div>
      </div>

      {/* Event Notifications */}
      <div className="space-y-4">
        <h3 className="font-medium text-sm text-gray-400">{t('Events')}</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="notify_new_message" className="flex-1 text-gray-300">
              {t('New Messages')}
            </Label>
            <Switch
              id="notify_new_message"
              checked={settings.notifyNewMessage}
              onCheckedChange={(checked) => updateSetting('notifyNewMessage', checked)}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="notify_job_claimed" className="flex-1 text-gray-300">
              {t('Job Claimed by Employee')}
            </Label>
            <Switch
              id="notify_job_claimed"
              checked={settings.notifyJobClaimed}
              onCheckedChange={(checked) => updateSetting('notifyJobClaimed', checked)}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="notify_exchange_request" className="flex-1 text-gray-300">
              {t('Job Exchange Requests')}
            </Label>
            <Switch
              id="notify_exchange_request"
              checked={settings.notifyExchangeRequest}
              onCheckedChange={(checked) => updateSetting('notifyExchangeRequest', checked)}
            />
          </div>
        </div>
      </div>

      {/* Email Reviews */}
      <div className="space-y-4">
        <h3 className="font-medium text-sm text-gray-400">{t('Email Reviews')}</h3>
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="email_review_enabled" className="flex-1 text-gray-300">
                {t('Send review request emails')}
              </Label>
              <Switch
                id="email_review_enabled"
                checked={settings.emailReviewEnabled}
                onCheckedChange={(checked) => updateSetting('emailReviewEnabled', checked)}
              />
            </div>
            <p className="text-xs text-gray-500 ml-0">
              {t('When enabled, customers receive an email to rate their cleaning after job completion')}
            </p>
          </div>
        </div>
      </div>

      {/* Reminders */}
      <div className="space-y-4">
        <h3 className="font-medium text-sm text-gray-400">{t('Job Reminders')}</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="reminder_2_days" className="flex-1 text-gray-300">
              {t('2 Days Before')}
            </Label>
            <Switch
              id="reminder_2_days"
              checked={settings.reminder2Days}
              onCheckedChange={(checked) => updateSetting('reminder2Days', checked)}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="reminder_1_day" className="flex-1 text-gray-300">
              {t('1 Day Before')}
            </Label>
            <Switch
              id="reminder_1_day"
              checked={settings.reminder1Day}
              onCheckedChange={(checked) => updateSetting('reminder1Day', checked)}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="reminder_6_hours" className="flex-1 text-gray-300">
              {t('6 Hours Before')}
            </Label>
            <Switch
              id="reminder_6_hours"
              checked={settings.reminder6Hours}
              onCheckedChange={(checked) => updateSetting('reminder6Hours', checked)}
            />
          </div>
        </div>
      </div>

      {/* Save Button */}
      <Button onClick={handleSave} disabled={saving} className="w-full bg-blue-600 hover:bg-blue-700 text-white">
        {saving ? t('Saving...') : t('Save Notification Settings')}
      </Button>
    </div>
  )
}
