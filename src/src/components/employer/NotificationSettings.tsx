'use client'

import { useState } from 'react'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface NotificationSettingsProps {
  pushEnabled: boolean
  soundEnabled: boolean
  notifyNewMessage: boolean
  notifyJobClaimed: boolean
  notifyExchangeRequest: boolean
  reminder2Days: boolean
  reminder1Day: boolean
  reminder6Hours: boolean
  onSave: (data: {
    pushEnabled: boolean
    soundEnabled: boolean
    notifyNewMessage: boolean
    notifyJobClaimed: boolean
    notifyExchangeRequest: boolean
    reminder2Days: boolean
    reminder1Day: boolean
    reminder6Hours: boolean
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
  onSave,
}: NotificationSettingsProps) {
  const [settings, setSettings] = useState({
    pushEnabled,
    soundEnabled,
    notifyNewMessage,
    notifyJobClaimed,
    notifyExchangeRequest,
    reminder2Days,
    reminder1Day,
    reminder6Hours,
  })
  const [saving, setSaving] = useState(false)

  const updateSetting = (key: keyof typeof settings, value: boolean) => {
    setSettings((prev) => ({ ...prev, [key]: value }))
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
    <Card>
      <CardHeader>
        <CardTitle>Notifications</CardTitle>
        <CardDescription>Manage how you receive notifications</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* General Settings */}
        <div className="space-y-4">
          <h3 className="font-medium text-sm text-gray-700">General</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="push_enabled" className="flex-1">
                Push Notifications
              </Label>
              <Switch
                id="push_enabled"
                checked={settings.pushEnabled}
                onCheckedChange={(checked) => updateSetting('pushEnabled', checked)}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="sound_enabled" className="flex-1">
                Sound Alerts
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
          <h3 className="font-medium text-sm text-gray-700">Events</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="notify_new_message" className="flex-1">
                New Messages
              </Label>
              <Switch
                id="notify_new_message"
                checked={settings.notifyNewMessage}
                onCheckedChange={(checked) => updateSetting('notifyNewMessage', checked)}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="notify_job_claimed" className="flex-1">
                Job Claimed by Employee
              </Label>
              <Switch
                id="notify_job_claimed"
                checked={settings.notifyJobClaimed}
                onCheckedChange={(checked) => updateSetting('notifyJobClaimed', checked)}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="notify_exchange_request" className="flex-1">
                Job Exchange Requests
              </Label>
              <Switch
                id="notify_exchange_request"
                checked={settings.notifyExchangeRequest}
                onCheckedChange={(checked) => updateSetting('notifyExchangeRequest', checked)}
              />
            </div>
          </div>
        </div>

        {/* Reminders */}
        <div className="space-y-4">
          <h3 className="font-medium text-sm text-gray-700">Job Reminders</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="reminder_2_days" className="flex-1">
                2 Days Before
              </Label>
              <Switch
                id="reminder_2_days"
                checked={settings.reminder2Days}
                onCheckedChange={(checked) => updateSetting('reminder2Days', checked)}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="reminder_1_day" className="flex-1">
                1 Day Before
              </Label>
              <Switch
                id="reminder_1_day"
                checked={settings.reminder1Day}
                onCheckedChange={(checked) => updateSetting('reminder1Day', checked)}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="reminder_6_hours" className="flex-1">
                6 Hours Before
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
        <Button onClick={handleSave} disabled={saving} className="w-full">
          {saving ? 'Saving...' : 'Save Notification Settings'}
        </Button>
      </CardContent>
    </Card>
  )
}
