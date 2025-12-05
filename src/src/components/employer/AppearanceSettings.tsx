'use client'

import { useState, useRef } from 'react'
import type { ThemeType } from '@/types/database'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Upload, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface AppearanceSettingsProps {
  theme: ThemeType
  primaryColor: string
  language: string
  logoUrl: string | null
  employerId: string
  onSave: (data: { theme: ThemeType; primaryColor: string; language: string; logoUrl: string | null }) => Promise<void>
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

export function AppearanceSettings({ theme, primaryColor, language, logoUrl, employerId, onSave }: AppearanceSettingsProps) {
  const [selectedTheme, setSelectedTheme] = useState<ThemeType>(theme)
  const [selectedColor, setSelectedColor] = useState(primaryColor)
  const [selectedLanguage, setSelectedLanguage] = useState(language)
  const [currentLogoUrl, setCurrentLogoUrl] = useState<string | null>(logoUrl)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file')
      return
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      alert('Image must be less than 2MB')
      return
    }

    setUploading(true)
    try {
      // Upload to Supabase storage
      const fileExt = file.name.split('.').pop()
      const fileName = `${employerId}/logo.${fileExt}`

      const { error: uploadError } = await supabase.storage
        .from('company-logos')
        .upload(fileName, file, { upsert: true })

      if (uploadError) throw uploadError

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('company-logos')
        .getPublicUrl(fileName)

      setCurrentLogoUrl(publicUrl)
    } catch (error) {
      console.error('Error uploading logo:', error)
      alert('Failed to upload logo')
    } finally {
      setUploading(false)
    }
  }

  const handleRemoveLogo = async () => {
    if (!currentLogoUrl) return

    try {
      // Extract file path from URL
      const urlParts = currentLogoUrl.split('/company-logos/')
      if (urlParts[1]) {
        await supabase.storage
          .from('company-logos')
          .remove([urlParts[1]])
      }
      setCurrentLogoUrl(null)
    } catch (error) {
      console.error('Error removing logo:', error)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await onSave({
        theme: selectedTheme,
        primaryColor: selectedColor,
        language: selectedLanguage,
        logoUrl: currentLogoUrl,
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
        {/* Logo Upload */}
        <div className="space-y-2">
          <Label>Company Logo</Label>
          <div className="flex items-center gap-4">
            {currentLogoUrl ? (
              <div className="relative">
                <img
                  src={currentLogoUrl}
                  alt="Company logo"
                  className="w-20 h-20 object-contain rounded-lg border bg-white"
                />
                <button
                  type="button"
                  onClick={handleRemoveLogo}
                  className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <div className="w-20 h-20 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center bg-gray-50">
                <Upload className="w-6 h-6 text-gray-400" />
              </div>
            )}
            <div className="flex-1">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleLogoUpload}
                className="hidden"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                size="sm"
              >
                {uploading ? 'Uploading...' : currentLogoUrl ? 'Change Logo' : 'Upload Logo'}
              </Button>
              <p className="text-xs text-gray-500 mt-1">PNG, JPG up to 2MB</p>
            </div>
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
