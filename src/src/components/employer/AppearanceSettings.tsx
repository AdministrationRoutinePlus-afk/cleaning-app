'use client'

import { useState } from 'react'
import type { ThemeType } from '@/types/database'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface AppearanceSettingsProps {
  theme: ThemeType
  primaryColor: string
  language: string
  onSave: (data: { theme: ThemeType; primaryColor: string; language: string }) => Promise<void>
}

const PRESET_COLORS = [
  { name: 'Blue', value: '#3B82F6' },
  { name: 'Green', value: '#10B981' },
  { name: 'Purple', value: '#8B5CF6' },
  { name: 'Orange', value: '#F59E0B' },
  { name: 'Red', value: '#EF4444' },
  { name: 'Teal', value: '#14B8A6' },
]

const LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'fr', name: 'Français' },
  { code: 'es', name: 'Español' },
]

export function AppearanceSettings({ theme, primaryColor, language, onSave }: AppearanceSettingsProps) {
  const [selectedTheme, setSelectedTheme] = useState<ThemeType>(theme)
  const [selectedColor, setSelectedColor] = useState(primaryColor)
  const [selectedLanguage, setSelectedLanguage] = useState(language)
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    try {
      await onSave({
        theme: selectedTheme,
        primaryColor: selectedColor,
        language: selectedLanguage,
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>App Appearance</CardTitle>
        <CardDescription>Customize how the app looks to you</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Theme Toggle */}
        <div className="space-y-2">
          <Label>Theme</Label>
          <div className="flex gap-2">
            <Button
              type="button"
              variant={selectedTheme === 'LIGHT' ? 'default' : 'outline'}
              onClick={() => setSelectedTheme('LIGHT')}
              className="flex-1"
            >
              Light
            </Button>
            <Button
              type="button"
              variant={selectedTheme === 'DARK' ? 'default' : 'outline'}
              onClick={() => setSelectedTheme('DARK')}
              className="flex-1"
            >
              Dark
            </Button>
          </div>
        </div>

        {/* Primary Color Picker */}
        <div className="space-y-2">
          <Label>Primary Color</Label>
          <div className="grid grid-cols-3 gap-2">
            {PRESET_COLORS.map((color) => (
              <button
                key={color.value}
                type="button"
                onClick={() => setSelectedColor(color.value)}
                className={`flex items-center gap-2 p-3 rounded-lg border-2 transition-all ${
                  selectedColor === color.value
                    ? 'border-gray-900 bg-gray-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div
                  className="w-6 h-6 rounded-full"
                  style={{ backgroundColor: color.value }}
                />
                <span className="text-sm font-medium">{color.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Language Selector */}
        <div className="space-y-2">
          <Label>Language</Label>
          <Select value={selectedLanguage} onValueChange={setSelectedLanguage}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LANGUAGES.map((lang) => (
                <SelectItem key={lang.code} value={lang.code}>
                  {lang.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Save Button */}
        <Button onClick={handleSave} disabled={saving} className="w-full">
          {saving ? 'Saving...' : 'Save Appearance Settings'}
        </Button>
      </CardContent>
    </Card>
  )
}
