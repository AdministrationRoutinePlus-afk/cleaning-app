'use client'

import { useState } from 'react'
import type { CompanyInfo } from '@/types/database'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

interface CompanyInfoFormProps {
  companyInfo: CompanyInfo | null
  onSave: (data: {
    companyName: string | null
    phone: string | null
    email: string | null
    address: string | null
    website: string | null
    defaultHourlyRate: number | null
    taxNumber: string | null
  }) => Promise<void>
}

export function CompanyInfoForm({ companyInfo, onSave }: CompanyInfoFormProps) {
  const [formData, setFormData] = useState({
    companyName: companyInfo?.company_name || '',
    phone: companyInfo?.phone || '',
    email: companyInfo?.email || '',
    address: companyInfo?.address || '',
    website: companyInfo?.website || '',
    defaultHourlyRate: companyInfo?.default_hourly_rate?.toString() || '',
    taxNumber: companyInfo?.tax_number || '',
  })
  const [saving, setSaving] = useState(false)

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await onSave({
        companyName: formData.companyName || null,
        phone: formData.phone || null,
        email: formData.email || null,
        address: formData.address || null,
        website: formData.website || null,
        defaultHourlyRate: formData.defaultHourlyRate ? parseFloat(formData.defaultHourlyRate) : null,
        taxNumber: formData.taxNumber || null,
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="company_name" className="text-gray-300">Company Name</Label>
        <Input
          id="company_name"
          type="text"
          value={formData.companyName}
          onChange={(e) => handleChange('companyName', e.target.value)}
          placeholder="Routine Plus Inc."
          className="bg-white/5 border-white/20 text-white placeholder:text-gray-500"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="phone" className="text-gray-300">Phone</Label>
        <Input
          id="phone"
          type="tel"
          value={formData.phone}
          onChange={(e) => handleChange('phone', e.target.value)}
          placeholder="(555) 123-4567"
          className="bg-white/5 border-white/20 text-white placeholder:text-gray-500"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="email" className="text-gray-300">Email</Label>
        <Input
          id="email"
          type="email"
          value={formData.email}
          onChange={(e) => handleChange('email', e.target.value)}
          placeholder="contact@routineplus.com"
          className="bg-white/5 border-white/20 text-white placeholder:text-gray-500"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="address" className="text-gray-300">Address</Label>
        <Input
          id="address"
          type="text"
          value={formData.address}
          onChange={(e) => handleChange('address', e.target.value)}
          placeholder="123 Main St, City, Province"
          className="bg-white/5 border-white/20 text-white placeholder:text-gray-500"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="website" className="text-gray-300">Website</Label>
        <Input
          id="website"
          type="url"
          value={formData.website}
          onChange={(e) => handleChange('website', e.target.value)}
          placeholder="https://www.routineplus.com"
          className="bg-white/5 border-white/20 text-white placeholder:text-gray-500"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="default_hourly_rate" className="text-gray-300">Default Hourly Rate ($)</Label>
        <Input
          id="default_hourly_rate"
          type="number"
          step="0.01"
          min="0"
          value={formData.defaultHourlyRate}
          onChange={(e) => handleChange('defaultHourlyRate', e.target.value)}
          placeholder="25.00"
          className="bg-white/5 border-white/20 text-white placeholder:text-gray-500"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="tax_number" className="text-gray-300">Tax Number</Label>
        <Input
          id="tax_number"
          type="text"
          value={formData.taxNumber}
          onChange={(e) => handleChange('taxNumber', e.target.value)}
          placeholder="123456789RT0001"
          className="bg-white/5 border-white/20 text-white placeholder:text-gray-500"
        />
      </div>

      <Button onClick={handleSave} disabled={saving} className="w-full bg-blue-600 hover:bg-blue-700 text-white">
        {saving ? 'Saving...' : 'Save Company Information'}
      </Button>
    </div>
  )
}
