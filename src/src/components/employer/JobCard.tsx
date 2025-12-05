'use client'

import { useState } from 'react'
import type { JobTemplate } from '@/types/database'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

interface JobCardProps {
  job: JobTemplate
  onUpdate: () => void
}

export function JobCard({ job, onUpdate }: JobCardProps) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleActivate = async () => {
    setLoading(true)
    try {
      const newStatus = job.status === 'ACTIVE' ? 'DRAFT' : 'ACTIVE'
      const { error } = await supabase
        .from('job_templates')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', job.id)

      if (error) throw error
      onUpdate()
    } catch (error) {
      console.error('Error updating job status:', error)
      alert('Failed to update job status')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this job template?')) return

    setLoading(true)
    try {
      const { error } = await supabase
        .from('job_templates')
        .delete()
        .eq('id', job.id)

      if (error) throw error
      onUpdate()
    } catch (error) {
      console.error('Error deleting job:', error)
      alert('Failed to delete job. Make sure there are no active sessions.')
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = () => {
    router.push(`/employer/jobs/${job.id}/edit`)
  }

  const formatDuration = (minutes: number | null) => {
    if (!minutes) return 'Not set'
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    if (hours === 0) return `${mins}m`
    if (mins === 0) return `${hours}h`
    return `${hours}h ${mins}m`
  }

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-mono text-gray-500">{job.job_code}</span>
              <Badge variant={job.status === 'ACTIVE' ? 'default' : 'secondary'}>
                {job.status}
              </Badge>
            </div>
            <CardTitle className="text-lg">{job.title}</CardTitle>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pb-3 space-y-2">
        {job.description && (
          <p className="text-sm text-gray-600 line-clamp-2">{job.description}</p>
        )}

        <div className="grid grid-cols-2 gap-3 pt-2">
          <div>
            <p className="text-xs text-gray-500">Duration</p>
            <p className="text-sm font-medium">{formatDuration(job.duration_minutes)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Rate</p>
            <p className="text-sm font-medium">
              {job.price_per_hour ? `$${job.price_per_hour}/hr` : 'Not set'}
            </p>
          </div>
        </div>

        {job.address && (
          <div className="pt-1">
            <p className="text-xs text-gray-500">Address</p>
            <p className="text-sm">{job.address}</p>
          </div>
        )}
      </CardContent>

      <CardFooter className="flex gap-2 pt-3 border-t">
        <Button
          variant="outline"
          size="sm"
          onClick={handleEdit}
          disabled={loading}
          className="flex-1"
        >
          Edit
        </Button>
        <Button
          variant={job.status === 'ACTIVE' ? 'secondary' : 'default'}
          size="sm"
          onClick={handleActivate}
          disabled={loading}
          className="flex-1"
        >
          {loading ? '...' : job.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
        </Button>
        <Button
          variant="destructive"
          size="sm"
          onClick={handleDelete}
          disabled={loading}
        >
          Delete
        </Button>
      </CardFooter>
    </Card>
  )
}
