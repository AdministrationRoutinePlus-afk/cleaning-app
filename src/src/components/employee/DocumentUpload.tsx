'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'

interface DocumentUploadProps {
  employeeId: string
  currentDocumentUrl: string | null
  onUploadSuccess: (url: string) => void
}

export function DocumentUpload({ employeeId, currentDocumentUrl, onUploadSuccess }: DocumentUploadProps) {
  const [uploading, setUploading] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentDocumentUrl)
  const supabase = createClient()

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type (images and PDFs)
    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf']
    if (!allowedTypes.includes(file.type)) {
      alert('Please upload a JPEG, PNG, or PDF file')
      return
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('File size must be less than 5MB')
      return
    }

    setUploading(true)
    try {
      // Create unique file path
      const fileExt = file.name.split('.').pop()
      const fileName = `${employeeId}-void-cheque-${Date.now()}.${fileExt}`
      const filePath = `${employeeId}/${fileName}`

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('employee-documents')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        })

      if (uploadError) throw uploadError

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('employee-documents')
        .getPublicUrl(filePath)

      // Update employee record
      const { error: updateError } = await supabase
        .from('employees')
        .update({ void_cheque_url: publicUrl })
        .eq('id', employeeId)

      if (updateError) throw updateError

      // Delete old file if exists
      if (currentDocumentUrl) {
        const oldPath = currentDocumentUrl.split('/employee-documents/')[1]
        if (oldPath) {
          await supabase.storage
            .from('employee-documents')
            .remove([oldPath])
        }
      }

      setPreviewUrl(publicUrl)
      onUploadSuccess(publicUrl)
      alert('Document uploaded successfully!')
    } catch (error) {
      console.error('Error uploading document:', error)
      alert('Failed to upload document. Please try again.')
    } finally {
      setUploading(false)
    }
  }

  const handleRemove = async () => {
    if (!currentDocumentUrl) return

    const confirmed = confirm('Are you sure you want to remove this document?')
    if (!confirmed) return

    setUploading(true)
    try {
      // Delete file from storage
      const filePath = currentDocumentUrl.split('/employee-documents/')[1]
      if (filePath) {
        const { error: deleteError } = await supabase.storage
          .from('employee-documents')
          .remove([filePath])

        if (deleteError) throw deleteError
      }

      // Update employee record
      const { error: updateError } = await supabase
        .from('employees')
        .update({ void_cheque_url: null })
        .eq('id', employeeId)

      if (updateError) throw updateError

      setPreviewUrl(null)
      onUploadSuccess('')
      alert('Document removed successfully!')
    } catch (error) {
      console.error('Error removing document:', error)
      alert('Failed to remove document. Please try again.')
    } finally {
      setUploading(false)
    }
  }

  const handleView = () => {
    if (previewUrl) {
      window.open(previewUrl, '_blank')
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Void Cheque</CardTitle>
        <p className="text-sm text-gray-600">
          Upload a void cheque for direct deposit setup
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {previewUrl ? (
          <div className="space-y-3">
            {/* Document Preview */}
            <div className="border rounded-lg p-4 bg-gray-50">
              {previewUrl.endsWith('.pdf') ? (
                <div className="text-center py-8">
                  <svg
                    className="mx-auto h-16 w-16 text-gray-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                  <p className="mt-2 text-sm text-gray-600">PDF Document</p>
                </div>
              ) : (
                <img
                  src={previewUrl}
                  alt="Void cheque"
                  className="w-full h-auto rounded-lg"
                />
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <Button
                onClick={handleView}
                variant="outline"
                className="flex-1"
                disabled={uploading}
              >
                View Document
              </Button>
              <Button
                onClick={handleRemove}
                variant="destructive"
                disabled={uploading}
              >
                {uploading ? 'Removing...' : 'Remove'}
              </Button>
            </div>

            {/* Replace Document */}
            <div className="pt-2 border-t">
              <Label
                htmlFor="replace-file"
                className="cursor-pointer inline-block text-sm text-blue-600 hover:text-blue-700"
              >
                Replace with new document
              </Label>
              <input
                id="replace-file"
                type="file"
                accept="image/jpeg,image/png,image/jpg,application/pdf"
                onChange={handleFileChange}
                disabled={uploading}
                className="hidden"
              />
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Upload Area */}
            <label
              htmlFor="file-upload"
              className={`
                flex flex-col items-center justify-center
                border-2 border-dashed border-gray-300 rounded-lg
                p-8 cursor-pointer
                hover:border-gray-400 hover:bg-gray-50
                transition-colors
                ${uploading ? 'opacity-50 cursor-not-allowed' : ''}
              `}
            >
              <svg
                className="h-12 w-12 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
              </svg>
              <p className="mt-2 text-sm text-gray-600">
                {uploading ? 'Uploading...' : 'Click to upload or drag and drop'}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                JPEG, PNG, or PDF (max 5MB)
              </p>
            </label>

            <input
              id="file-upload"
              type="file"
              accept="image/jpeg,image/png,image/jpg,application/pdf"
              onChange={handleFileChange}
              disabled={uploading}
              className="hidden"
            />
          </div>
        )}

        {/* Information */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <p className="text-xs text-blue-800">
            <strong>Note:</strong> A void cheque is required for payroll setup. This document is
            securely stored and only accessible by your employer.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
