'use client'

import { useState } from 'react'
import type { JobTemplate, JobStep } from '@/types/database'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'

interface JobDetailCardProps {
  jobTemplate: JobTemplate & {
    job_steps: JobStep[]
  }
  upcomingSessions?: number
  completedSessions?: number
}

export function JobDetailCard({ jobTemplate, upcomingSessions = 0, completedSessions = 0 }: JobDetailCardProps) {
  const [expanded, setExpanded] = useState(false)

  const formatTime = (time: string | null) => {
    if (!time) return 'N/A'
    const [hours, minutes] = time.split(':')
    const hour = parseInt(hours, 10)
    const ampm = hour >= 12 ? 'PM' : 'AM'
    const displayHour = hour % 12 || 12
    return `${displayHour}:${minutes} ${ampm}`
  }

  const formatDuration = (minutes: number | null) => {
    if (!minutes) return 'N/A'
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    if (hours === 0) return `${mins}min`
    if (mins === 0) return `${hours}h`
    return `${hours}h ${mins}min`
  }

  const dayLabels: Record<string, string> = {
    MON: 'Mon',
    TUE: 'Tue',
    WED: 'Wed',
    THU: 'Thu',
    FRI: 'Fri',
    SAT: 'Sat',
    SUN: 'Sun'
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="outline">{jobTemplate.job_code}</Badge>
              <Badge variant={jobTemplate.status === 'ACTIVE' ? 'default' : 'secondary'}>
                {jobTemplate.status}
              </Badge>
            </div>
            <CardTitle className="text-lg">{jobTemplate.title}</CardTitle>
            {jobTemplate.description && (
              <p className="text-sm text-gray-600 mt-1">{jobTemplate.description}</p>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Job Info Grid */}
        <div className="grid grid-cols-2 gap-3">
          {jobTemplate.address && (
            <div>
              <p className="text-xs text-gray-500">Address</p>
              <p className="text-sm font-medium">{jobTemplate.address}</p>
            </div>
          )}

          {jobTemplate.duration_minutes && (
            <div>
              <p className="text-xs text-gray-500">Duration</p>
              <p className="text-sm font-medium">{formatDuration(jobTemplate.duration_minutes)}</p>
            </div>
          )}

          {jobTemplate.time_window_start && jobTemplate.time_window_end && (
            <div>
              <p className="text-xs text-gray-500">Time Window</p>
              <p className="text-sm font-medium">
                {formatTime(jobTemplate.time_window_start)} - {formatTime(jobTemplate.time_window_end)}
              </p>
            </div>
          )}

          {jobTemplate.is_recurring && (
            <div>
              <p className="text-xs text-gray-500">Frequency</p>
              <p className="text-sm font-medium">
                {jobTemplate.frequency_per_week}x per week
              </p>
            </div>
          )}
        </div>

        {/* Available Days */}
        {jobTemplate.available_days && jobTemplate.available_days.length > 0 && (
          <div>
            <p className="text-xs text-gray-500 mb-2">Available Days</p>
            <div className="flex flex-wrap gap-1">
              {jobTemplate.available_days.map((day) => (
                <Badge key={day} variant="secondary" className="text-xs">
                  {dayLabels[day] || day}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Session Stats */}
        <div className="flex gap-4 pt-3 border-t">
          <div className="flex-1 text-center">
            <p className="text-2xl font-bold text-blue-600">{upcomingSessions}</p>
            <p className="text-xs text-gray-500">Upcoming</p>
          </div>
          <div className="flex-1 text-center">
            <p className="text-2xl font-bold text-green-600">{completedSessions}</p>
            <p className="text-xs text-gray-500">Completed</p>
          </div>
        </div>

        {/* Job Steps */}
        {jobTemplate.job_steps && jobTemplate.job_steps.length > 0 && (
          <div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setExpanded(!expanded)}
              className="w-full"
            >
              {expanded ? 'Hide' : 'Show'} Job Steps ({jobTemplate.job_steps.length})
            </Button>

            {expanded && (
              <Accordion type="single" collapsible className="mt-3">
                {jobTemplate.job_steps
                  .sort((a, b) => a.step_order - b.step_order)
                  .map((step, index) => (
                    <AccordionItem key={step.id} value={step.id}>
                      <AccordionTrigger className="text-sm">
                        Step {index + 1}: {step.title}
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="space-y-2">
                          {step.description && (
                            <p className="text-sm text-gray-700">{step.description}</p>
                          )}
                          {step.products_needed && (
                            <div className="bg-blue-50 p-2 rounded">
                              <p className="text-xs font-medium text-blue-900 mb-1">
                                Products Needed:
                              </p>
                              <p className="text-xs text-blue-800">{step.products_needed}</p>
                            </div>
                          )}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
              </Accordion>
            )}
          </div>
        )}

        {/* Notes */}
        {jobTemplate.notes && (
          <div className="bg-yellow-50 p-3 rounded">
            <p className="text-xs font-medium text-yellow-900 mb-1">Notes:</p>
            <p className="text-sm text-yellow-800">{jobTemplate.notes}</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
